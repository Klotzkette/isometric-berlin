import {
  BufferGeometry, Color, Float32BufferAttribute, Mesh, ShaderMaterial,
  UniformsLib, UniformsUtils, Vector2, Vector4, type Material,
} from "three";
import { FERNSEHTURM_DETAIL_PROFILE as P } from "./fernsehturmDetailProfile";

export type TowerCoverageBand = {
  bottom: number; top: number; bottomRadius: number; topRadius: number;
  color: number;
};

// A tower-only atmospheric recognition adjustment. Keep ordinary world depth
// and the actual submerged view's opaque 4..240 m fog. This applies to the
// complete models as well as the subpixel filter, independently of its fade.
export const FERNSEHTURM_HORIZON_FOG = /* glsl */ `
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float towerFog = 1. - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float towerFog = smoothstep(fogNear, fogFar, vFogDepth);
      bool towerSubmerged = fogNear <= 4.01 && fogFar <= 240.01;
      // The bright Snow sky and silver/ivory tower otherwise converge before
      // tiny coverage contributions reach the 8-bit composer. Reserve a muted
      // distant silhouette contrast, gradually beyond Snow's opaque fog range.
      // Nearby paint, all other modes and actual submerged fog are unchanged.
      bool towerSnow = abs(fogNear - 540.) < .01 && abs(fogFar - 2250.) < .01;
      float towerSnowDistance = towerSnow ? smoothstep(fogFar, fogFar * 2., vFogDepth) : 0.;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb, fogColor * .15), towerSnowDistance);
      if (!towerSubmerged) towerFog = min(towerFog, .72);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, towerFog);
  #endif
`;
const hazeMaterials = new WeakSet<Material>();
export function retainFernsehturmHorizonContrast(material: Material): void {
  if (hazeMaterials.has(material)) return;
  hazeMaterials.add(material);
  const previous = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>", FERNSEHTURM_HORIZON_FOG,
    );
  };
  material.customProgramCacheKey = () => `${key}|fernsehturm-horizon-haze-v283`;
}

/** Pixel coverage, not a minimum tower size. The complete architectural meshes
 * stay present. This small companion integrates their distant silhouette where
 * ordinary single-sample rasterization can miss the whole 32 m head. */
export function createFernsehturmHorizonCoverage(
  bands: readonly TowerCoverageBand[],
  native: boolean,
  daylight: { value: number } = { value: 1 },
): Mesh<BufferGeometry, ShaderMaterial> {
  const positions: number[] = [], profiles: number[] = [], colors: number[] = [];
  const corners: number[] = [], indices: number[] = [];
  const color = new Color();
  for (const band of bands) {
    const first = positions.length / 3;
    color.setHex(band.color);
    for (const [side, end] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      const radius = end ? band.topRadius : band.bottomRadius;
      positions.push(P.x + side * radius, P.groundY + (end ? band.top : band.bottom), P.z);
      profiles.push(band.bottom, band.top, band.bottomRadius, band.topRadius);
      corners.push(side, end);
      colors.push(color.r, color.g, color.b);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("coverageProfile", new Float32BufferAttribute(profiles, 4));
  geometry.setAttribute("coverageCorner", new Float32BufferAttribute(corners, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const material = new ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false, depthTest: true, fog: true,
    uniforms: {
      ...UniformsUtils.clone(UniformsLib.fog),
      coverageViewport: { value: new Vector4(0, 0, 1, 1) },
      coverageDaylight: daylight,
    },
    vertexShader: /* glsl */ `
      attribute vec4 coverageProfile;
      attribute vec2 coverageCorner;
      uniform vec4 coverageViewport;
      varying vec3 coverageColor;
      varying vec2 coverageA;
      varying vec2 coverageB;
      varying vec2 coverageC;
      varying vec2 coverageD;
      varying float coverageFade;
      #include <fog_pars_vertex>
      vec2 pixel(vec4 clip) { return (clip.xy / clip.w * .5 + .5) * coverageViewport.zw + coverageViewport.xy; }
      void main() {
        vec4 head = modelViewMatrix * vec4(${P.x}, ${P.groundY + P.sphereCenterHeight}, ${P.z}, 1.0);
        float diameter = ${(P.sphereRadius * 2).toFixed(1)} * projectionMatrix[1][1] * coverageViewport.w / max(1., -2. * head.z);
        coverageFade = 1. - smoothstep(.75, 2., diameter);
        // No coverage surface near the camera or behind it. In particular,
        // do not divide near-plane clips by zero while the filter is inactive.
        if (head.z >= -.25 || coverageFade <= 0.) {
          gl_Position = vec4(2., 2., 2., 1.);
          return;
        }
        vec4 lower = modelViewMatrix * vec4(${P.x}, ${P.groundY} + coverageProfile.x, ${P.z}, 1.0);
        vec4 upper = modelViewMatrix * vec4(${P.x}, ${P.groundY} + coverageProfile.y, ${P.z}, 1.0);
        // A view-facing coverage envelope stays centred on the real world axis.
        // Its conservative one-pixel border is transparent outside exact coverage.
        vec4 a = projectionMatrix * (lower + vec4(-coverageProfile.z, 0., 0., 0.));
        vec4 b = projectionMatrix * (lower + vec4( coverageProfile.z, 0., 0., 0.));
        vec4 c = projectionMatrix * (upper + vec4( coverageProfile.w, 0., 0., 0.));
        vec4 d = projectionMatrix * (upper + vec4(-coverageProfile.w, 0., 0., 0.));
        coverageA = pixel(a); coverageB = pixel(b); coverageC = pixel(c); coverageD = pixel(d);
        coverageColor = color;
        vec4 clip = coverageCorner.y > .5 ? (coverageCorner.x > 0. ? c : d) : (coverageCorner.x > 0. ? b : a);
        vec2 center = (coverageA + coverageB + coverageC + coverageD) * .25;
        vec2 edge = pixel(clip) - center;
        vec2 pad = sign(edge);
        clip.xy += pad * 2. / coverageViewport.zw * clip.w;
        gl_Position = clip;
        vec4 mvPosition = mix(lower, upper, coverageCorner.y);
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float coverageDaylight;
      varying vec3 coverageColor;
      varying vec2 coverageA;
      varying vec2 coverageB;
      varying vec2 coverageC;
      varying vec2 coverageD;
      varying float coverageFade;
      #include <fog_pars_fragment>
      // Exact area of a projected quadrilateral intersected with this unit pixel.
      // Integrating coverage keeps tiny geometry visible without a one-pixel width.
      float pixelArea() {
        vec2 points[8]; vec2 next[8]; int count = 4;
        points[0] = coverageA - gl_FragCoord.xy;
        points[1] = coverageB - gl_FragCoord.xy;
        points[2] = coverageC - gl_FragCoord.xy;
        points[3] = coverageD - gl_FragCoord.xy;
        for (int edge = 0; edge < 4; edge++) {
          if (count == 0) return 0.;
          vec2 normal = edge == 0 ? vec2(1.,0.) : edge == 1 ? vec2(-1.,0.) : edge == 2 ? vec2(0.,1.) : vec2(0.,-1.);
          vec2 previous = points[count - 1];
          float previousDistance = dot(previous,normal) + .5;
          int nextCount = 0;
          for (int i = 0; i < 8; i++) {
            if (i >= count) break;
            vec2 current = points[i]; float distance = dot(current,normal) + .5;
            if ((distance >= 0.) != (previousDistance >= 0.)) {
              if (nextCount < 8) next[nextCount++] = mix(previous,current,previousDistance / (previousDistance - distance));
            }
            if (distance >= 0. && nextCount < 8) next[nextCount++] = current;
            previous = current; previousDistance = distance;
          }
          count = nextCount;
          for (int i = 0; i < 8; i++) { if (i >= count) break; points[i] = next[i]; }
        }
        float area = 0.;
        for (int i = 0; i < 8; i++) {
          if (i >= count) break;
          vec2 a = points[i], b = points[i == count - 1 ? 0 : i + 1];
          area += a.x*b.y - a.y*b.x;
        }
        return clamp(abs(area)*.5, 0., 1.);
      }
      void main() {
        float alpha = pixelArea() * coverageFade;
        if (alpha <= .000001) discard;
        vec3 paint = mix(coverageColor * vec3(.42,.49,.60),coverageColor,clamp(coverageDaylight,0.,1.));
        #if defined(USE_FOG) && !defined(FOG_EXP2)
          // Snow's lighting hook is overcast, not nighttime.
          if (fogNear > 4.01 && fogFar <= 2250.01) paint = coverageColor;
        #endif
        gl_FragColor = vec4(paint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        ${FERNSEHTURM_HORIZON_FOG}
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = native ? "Fernsehturm native subpixel coverage" : "Fernsehturm drawn subpixel coverage";
  mesh.userData = {
    fernsehturmHorizonCoverage: true, textureFree: true, keepInMinecraft: native,
    blockNative: native, originalSourceRetained: true,
    coverageInterpretation: native ? "area-filtered silhouette of native exterior rows" : "area-filtered piecewise silhouette at original dimensions",
  };
  const viewport = material.uniforms.coverageViewport.value as Vector4;
  const buffer = new Vector2();
  mesh.onBeforeRender = (renderer) => {
    renderer.getCurrentViewport(viewport);
    if (viewport.z <= 0 || viewport.w <= 0) { renderer.getDrawingBufferSize(buffer); viewport.set(0,0,buffer.x,buffer.y); }
  };
  return mesh;
}

/** The drawn globe uses 32 horizontal trapezoids, retaining its 32 m diameter.
 * The existing full sphere, dishes, windows and antenna remain untouched. */
export function drawnFernsehturmCoverageBands(): TowerCoverageBand[] {
  const bands: TowerCoverageBand[] = [
    {bottom:0,top:20,bottomRadius:16,topRadius:8,color:0xc5c5b9},
    {bottom:20,top:196,bottomRadius:8,topRadius:5.704347826,color:0xc5c5b9},
    {bottom:228,top:250,bottomRadius:6.55,topRadius:6.55,color:0xb8b8ab},
  ];
  const radius = (y:number) => Math.sqrt(Math.max(0,256-(y-212)**2));
  for(let y=196;y<228;y++) bands.push({bottom:y,top:y+1,bottomRadius:radius(y),topRadius:radius(y+1),color:P.windowBands.some(([lo,hi])=>y+.5>=lo&&y+.5<=hi)?0x394f58:0x9aa9b0});
  for(let i=0;i<12;i++)bands.push({bottom:250+i*118/12,top:250+(i+1)*118/12,bottomRadius:1.45-i/12*1.05,topRadius:1.45-(i+1)/12*1.05,color:i%2?0xe8e6da:0xc46c50});
  return bands;
}

type NativeBlock = { p: readonly number[]; s: readonly number[]; color: number };
/** Read the actual independent native exterior rows, including their stepped
 * dimensions and colour. No smooth drawn mesh is used in native mode. At
 * subpixel scale a view-facing row envelope approximates voxel area; every
 * original orthogonal block remains rendered, resident and unchanged. */
export function nativeFernsehturmCoverageBands(blocks: readonly NativeBlock[]): TowerCoverageBand[] {
  const events = new Map<number, { add: NativeBlock[]; remove: NativeBlock[] }>();
  const event = (y: number) => {
    let e = events.get(y);
    if (!e) { e = {add: [], remove: []}; events.set(y, e); }
    return e;
  };
  for (const b of blocks) {
    event(b.p[1] - b.s[1] / 2).add.push(b);
    event(b.p[1] + b.s[1] / 2).remove.push(b);
  }
  const heights = [...events.keys()].sort((a,b)=>a-b), active = new Set<NativeBlock>();
  const bands: TowerCoverageBand[] = [];
  for (let i=0;i<heights.length-1;i++) {
    const bottom=heights[i], top=heights[i+1], e=events.get(bottom)!;
    for (const b of e.remove) active.delete(b);
    for (const b of e.add) active.add(b);
    if (top-bottom < 1e-6) continue;
    let radius=0, color=0;
    for (const b of active) {
      const r=Math.max(Math.abs(b.p[0])+b.s[0]/2, Math.abs(b.p[2])+b.s[2]/2);
      if (r>radius) { radius=r; color=b.color; }
    }
    if (radius>0) bands.push({bottom,top,bottomRadius:radius,topRadius:radius,color});
  }
  return bands;
}

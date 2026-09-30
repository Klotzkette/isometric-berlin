import {
  Camera, Color, Frustum, InstancedBufferAttribute, InstancedBufferGeometry,
  Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Sphere, Vector3,
} from "three";
import { FERNSEHTURM_DETAIL_PROFILE as TOWER } from "../../fernsehturmDetailProfile";
import { freezeStaticSceneTransforms } from "../../staticSceneTransforms";
import type { VisualMode } from "../../visualMode";

export const SCHWELLENRAUM_TOWER_STEAM_NAME = "Schwellenraum Fernsehturm rose steam";
export const SCHWELLENRAUM_TOWER_STEAM_FRAME_INTERVAL_MS = 1000 / 30;
export const SCHWELLENRAUM_TOWER_STEAM_INITIAL_TIME = 4.75;
export const TOWER_STEAM_PROFILE = {
  steadyCount: 96, burstCount: 48, ventCount: 8, burstVentCount: 4,
  ventRadius: 10.7, ventHeight: 12, burstPeriod: 23,
  steadyRise: 39, burstRise: 67,
} as const;

/** Authored dream effect, not a claim about real tower emissions. */
export function createSchwellenraumTowerSteam(): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const p = TOWER_STEAM_PROFILE;
  const plane = new PlaneGeometry(2, 2);
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(plane.index!.clone());
  geometry.setAttribute("position", plane.getAttribute("position").clone());
  geometry.setAttribute("uv", plane.getAttribute("uv").clone());
  plane.dispose();
  geometry.instanceCount = p.steadyCount + p.burstCount;
  const particles = new Float32Array(geometry.instanceCount * 4);
  for (let i = 0; i < geometry.instanceCount; i++) {
    const burst = i >= p.steadyCount, j = burst ? i - p.steadyCount : i;
    const vents = burst ? p.burstVentCount : p.ventCount;
    const rows = (burst ? p.burstCount : p.steadyCount) / vents;
    particles.set([
      (Math.floor(j / vents) + .5) / rows,
      ((i + 1) * .61803398875) % 1,
      burst ? (j % vents) * (p.ventCount / vents) : j % vents,
      Number(burst),
    ], i * 4);
  }
  geometry.setAttribute("particle", new InstancedBufferAttribute(particles, 4));
  // Shader displacement must be included in both Three.js draw culling and
  // idle-frame eligibility. Radius also includes every billboard corner.
  geometry.boundingSphere = new Sphere(new Vector3(0, 36, 0), 76);
  const material = new ShaderMaterial({
    name: "Soft procedural rose and blue vapour",
    transparent: true, depthWrite: false, depthTest: true,
    toneMapped: false,
    uniforms: {
      steamTime: { value: SCHWELLENRAUM_TOWER_STEAM_INITIAL_TIME },
      rose: { value: new Color("#edb4cc") },
      vapour: { value: new Color("#f5dce9") },
      blue: { value: new Color("#a9c5ed") },
    },
    vertexShader: `
      attribute vec4 particle;
      uniform float steamTime;
      varying vec2 steamUv;
      varying float steamFade;
      varying float steamAge;
      varying float steamSeed;
      void main() {
        float seed = particle.y, burst = particle.w;
        float lifetime = mix(13.0 + seed * 6.0, 5.8 + seed * 1.4, burst);
        float steadyAge = fract(steamTime / lifetime + particle.x);
        float episode = mod(steamTime, ${p.burstPeriod}.0);
        float burstAge = (episode - particle.x * 1.8 - particle.z * 0.32) / lifetime;
        float age = clamp(mix(steadyAge, burstAge, burst), 0.0, 1.0);
        float puffActive = mix(1.0, step(0.0, burstAge) * step(burstAge, 1.0), burst);
        float angle = particle.z * 6.28318530718 / ${p.ventCount}.0;
        vec3 centre = vec3(cos(angle) * ${p.ventRadius}, ${p.ventHeight}.0, sin(angle) * ${p.ventRadius});
        centre.y += age * mix(${p.steadyRise}.0, ${p.burstRise}.0, burst);
        // Two slow, offset curls keep the clouds breathing without jitter.
        float curl = age * 6.5 + seed * 6.2831853 + steamTime * .17;
        centre.x += age * (5.0 + sin(curl) * 5.0 + sin(steamTime * .09 + angle) * 2.0);
        centre.z += age * (cos(curl * .83 - steamTime * .12) * 5.0 - 2.0);
        float size = mix(mix(1.8, 11.0, age), mix(1.1, 8.0, age), burst);
        float turn = seed * 6.2831853 + steamTime * .025;
        mat2 rotation = mat2(cos(turn), -sin(turn), sin(turn), cos(turn));
        vec4 viewCentre = modelViewMatrix * vec4(centre, 1.0);
        viewCentre.xy += rotation * position.xy * size;
        gl_Position = projectionMatrix * viewCentre;
        steamUv = uv;
        steamAge = age;
        steamSeed = seed;
        // Fade before recycling or ending a burst; never jump a visible puff.
        steamFade = puffActive * smoothstep(0.0, .13, age) * (1.0 - smoothstep(.58, 1.0, age));
      }
    `,
    fragmentShader: `
      uniform float steamTime;
      uniform vec3 rose;
      uniform vec3 vapour;
      uniform vec3 blue;
      varying vec2 steamUv;
      varying float steamFade;
      varying float steamAge;
      varying float steamSeed;
      void main() {
        vec2 q = steamUv * 2.0 - 1.0;
        float edge = 1.0 - smoothstep(.48, 1.0, dot(q, q));
        q += .10 * vec2(sin(q.y * 5.0 + steamTime * .21 + steamSeed * 9.0),
                        cos(q.x * 4.0 - steamTime * .16 + steamSeed * 7.0));
        vec2 a = q - vec2(.23, .13), b = q + vec2(.27, .18);
        float cloud = .58 * exp(-3.3 * dot(q,q)) + .24 * exp(-5.0 * dot(a,a)) + .18 * exp(-5.0 * dot(b,b));
        float breath = .91 + .09 * sin(steamTime * .31 + steamSeed * 6.2831853);
        float alpha = .19 * breath * steamFade * cloud * edge;
        if (alpha < .001) discard;
        // Mostly rose, with a few cool wisps dissolving toward pale lavender.
        float cool = smoothstep(.65, .86, steamSeed) * .78;
        vec3 tint = mix(rose, blue, cool);
        gl_FragColor = vec4(mix(tint, vapour, .18 + steamAge * .55), alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = SCHWELLENRAUM_TOWER_STEAM_NAME;
  mesh.position.set(TOWER.x, TOWER.groundY + TOWER.sphereCenterHeight, TOWER.z);
  mesh.visible = false;
  mesh.userData = { visualModeOnly: "schwellenraum", textureFree: true,
    authoredDreamEffect: true, shaderDisplacedBounds: true };
  return freezeStaticSceneTransforms(mesh);
}

export function setSchwellenraumTowerSteamPresentation(
  mesh: Mesh | null, mode: VisualMode, obscured = false,
): void {
  if (mesh) mesh.visible = mode === "schwellenraum" && !obscured;
}

export function updateSchwellenraumTowerSteam(mesh: Mesh, elapsedSeconds: number): void {
  if (!Number.isFinite(elapsedSeconds)) return;
  (mesh.material as ShaderMaterial).uniforms.steamTime.value = Math.max(0, elapsedSeconds);
}

const frustum = new Frustum(), projection = new Matrix4(), worldSphere = new Sphere();
export function isSchwellenraumTowerSteamOnScreen(mesh: Mesh | null, camera: Camera): boolean {
  if (!mesh) return false;
  for (let parent = mesh as import("three").Object3D | null; parent; parent = parent.parent) {
    if (!parent.visible) return false;
  }
  if (!mesh.geometry.boundingSphere) return false;
  camera.updateMatrixWorld();
  mesh.updateWorldMatrix(true, false);
  projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projection);
  worldSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
  return frustum.intersectsSphere(worldSphere);
}

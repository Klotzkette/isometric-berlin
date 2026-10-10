import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, Path, ShaderMaterial,
  Shape, ShapeGeometry,
} from "three";
import scope from "./data/surroundingCityScope.json";
import { DEFAULT_FLOOD_DEPTH, floodWaterLevel, type FloodDepth } from "./floodDepth";

/** Fictional flood: about 3 m above the central city's ~4.2 m street datum.
 * One horizontal water table, not terrain-shaped water or a flood prediction.
 */
export const FLOOD_WATER_LEVEL_M = floodWaterLevel(DEFAULT_FLOOD_DEPTH);
export const FLOOD_WATER_MAX_SWELL_M = 0.24;
export const FLOOD_WATER_NAME = "Flood water — Versunkenes Berlin";
export const FLOOD_FRAME_INTERVAL_MS = 1000 / 24;

// Shared spatial functions keep geometry and shading on the same moving swells.
const SWELLS = `
float swell(vec2 p, float t) {
  return 0.14 * sin(dot(p, vec2(0.018, 0.011)) - t * 1.05)
       + 0.10 * sin(dot(p, vec2(-0.013, 0.026)) - t * 1.37);
}
`;

const VERTEX = `
uniform float time;
#ifdef FLOOD_GRID
attribute vec2 floodOffset;
#endif
varying vec3 waterPosition;
${SWELLS}
void main() {
  vec3 p = position;
  #ifdef FLOOD_GRID
  p.xz += floodOffset;
  #endif
  p.y += swell(p.xz, time);
  waterPosition = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAGMENT = `
uniform float time;
uniform float pergamonReveal;
varying vec3 waterPosition;
void main() {
  // Cut only water fragments whose viewing ray continues through the exhibit.
  // A vertical hole crops the altar at 21 m under an oblique camera (parallax).
  if (pergamonReveal > 0.5) {
    mat2 rotate = mat2(cos(0.655), sin(0.655), -sin(0.655), cos(0.655));
    vec2 local = rotate * (waterPosition.xz - vec2(1819.5, -184.0));
    vec3 direction = waterPosition - cameraPosition;
    vec2 localDirection = rotate * direction.xz;
    vec3 ray = vec3(localDirection.x, direction.y, localDirection.y);
    vec3 inverseRay = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), ray))
                    / max(abs(ray), vec3(0.000001));
    vec3 origin = vec3(local.x, waterPosition.y, local.y);
    vec3 first = (vec3(-61.0, 4.15, -94.5) - origin) * inverseRay;
    vec3 last = (vec3(-40.0, 17.0, -57.3) - origin) * inverseRay;
    vec3 entry = min(first, last), exitPoint = max(first, last);
    float nearPoint = max(entry.x, max(entry.y, entry.z));
    float farPoint = min(exitPoint.x, min(exitPoint.y, exitPoint.z));
    if (farPoint >= max(nearPoint, 0.0)) discard;
  }
  // World-anchored, advected streaks: no texture, reflection target, particles
  // or screen-space noise. Derivative filtering prevents far-view shimmer.
  vec2 p = waterPosition.xz;
  vec2 flow = p - vec2(2.4, -0.85) * time;
  float bend = 1.3 * sin(dot(flow, vec2(0.035, 0.048)))
             + 0.6 * sin(dot(flow, vec2(-0.063, 0.017)));
  float a = dot(flow, vec2(0.28, 0.52)) + bend;
  float b = dot(flow, vec2(-0.61, 0.25)) + 0.7 * sin(a * 0.42);
  float detail = 1.0 - smoothstep(0.35, 2.0, max(fwidth(a), fwidth(b)));
  float ripple = (sin(a) * 0.65 + sin(b) * 0.35) * detail;
  vec3 n = normalize(vec3(-0.16 * cos(a) * detail, 1.0,
                         -0.20 * cos(b) * detail));
  vec3 view = normalize(cameraPosition - waterPosition);
  float fresnel = pow(1.0 - abs(dot(view, n)), 3.0);
  vec3 base = mix(vec3(0.055, 0.205, 0.22), vec3(0.20, 0.38, 0.40), fresnel);
  base += ripple * vec3(0.025, 0.05, 0.052);
  float glint = pow(max(dot(reflect(-normalize(vec3(-0.5, 0.8, 0.4)), n), view), 0.0), 36.0);
  base += vec3(0.19, 0.23, 0.22) * glint * detail;
  // Broken, short crest ribbons rather than a regular white grid.
  float foamPatch = sin(dot(flow, vec2(0.095, -0.075)) + sin(b * 0.27));
  float crest = smoothstep(0.86, 0.985, sin(a + 0.26 * sin(b)));
  float foam = crest * smoothstep(0.38, 0.86, foamPatch) * detail;
  base = mix(base, vec3(0.72, 0.83, 0.80), foam * 0.82);
  gl_FragColor = vec4(base, 1.0);
  #include <colorspace_fragment>
}
`;

/** Reuse the exact approved scope including holes; never flood a new district. */
function waterGeometry(): BufferGeometry {
  const shapes = [scope.core, ...scope.footprint].map(polygon => {
    const shape = new Shape();
    polygon.ring.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z));
    for (const ring of polygon.holes) {
      const hole = new Path();
      ring.forEach(([x, z], i) => i ? hole.lineTo(x, z) : hole.moveTo(x, z));
      shape.holes.push(hole);
    }
    return shape;
  });
  const outline = new ShapeGeometry(shapes);
  const xy = outline.getAttribute("position");
  const vertices: number[] = [];
  for (let i = 0; i < xy.count; i++) vertices.push(xy.getX(i), FLOOD_WATER_LEVEL_M, xy.getY(i));
  const pending = Array.from(outline.index!.array);
  const indices: number[] = [];
  const midpoints = new Map<number, number>();
  const lengthSquared = (a: number, b: number): number =>
    (vertices[a * 3] - vertices[b * 3]) ** 2 +
    (vertices[a * 3 + 2] - vertices[b * 3 + 2]) ** 2;
  // Finite 96 m subdivision only for the gentle broad swell. Fine flowing
  // ripples/foam live in the fragment shader, so no metre-scale city mesh.
  while (pending.length) {
    const c = pending.pop()!, b = pending.pop()!, a = pending.pop()!;
    const ab = lengthSquared(a, b), bc = lengthSquared(b, c), ca = lengthSquared(c, a);
    if (Math.max(ab, bc, ca) <= 96 ** 2) { indices.push(a, b, c); continue; }
    const [u, v, w] = ab >= bc && ab >= ca ? [a, b, c] : bc >= ca ? [b, c, a] : [c, a, b];
    // Triangular pairing gives the same unordered edge a unique integer key.
    // The bounded mesh has < 45,000 vertices, far below the 2^53 precision
    // limit; avoid tens of thousands of temporary edge strings at mode entry.
    const hi = Math.max(u, v), lo = Math.min(u, v);
    const key = hi * (hi + 1) / 2 + lo;
    let m = midpoints.get(key);
    if (m === undefined) {
      m = vertices.length / 3;
      vertices.push((vertices[u * 3] + vertices[v * 3]) / 2, FLOOD_WATER_LEVEL_M,
        (vertices[u * 3 + 2] + vertices[v * 3 + 2]) / 2);
      midpoints.set(key, m);
    }
    pending.push(u, m, w, m, v, w);
  }
  outline.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.boundingBox!.min.y -= FLOOD_WATER_MAX_SWELL_M;
  geometry.boundingBox!.max.y += FLOOD_WATER_MAX_SWELL_M;
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius += FLOOD_WATER_MAX_SWELL_M;
  return geometry;
}

export type FloodWater = Mesh<BufferGeometry, ShaderMaterial>;

/** One lazily created draw call; opaque depth preserves building silhouettes. */
export function createFloodWater(depth: FloodDepth = DEFAULT_FLOOD_DEPTH): FloodWater {
  const mesh = new Mesh(waterGeometry(), new ShaderMaterial({
    uniforms: { time: { value: 0 }, pergamonReveal: { value: 0 } }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    side: DoubleSide, toneMapped: false, depthWrite: true,
  }));
  mesh.name = FLOOD_WATER_NAME;
  mesh.userData.floodWater = true;
  mesh.userData.fictionalPresentation = "Horizontal flood table; not a hazard map";
  // Water is presentation, not an extra walking floor/click-teleport target.
  mesh.raycast = () => {};
  setFloodWaterDepth(mesh, depth);
  return mesh;
}

/** Move the existing table without allocating buffers or recompiling shaders. */
export function setFloodWaterDepth(water: FloodWater, depth: FloodDepth): void {
  water.position.y = floodWaterLevel(depth) - FLOOD_WATER_LEVEL_M;
  water.updateMatrix();
  water.updateMatrixWorld(true);
}

/** Absolute active time is supplied by the viewer; hidden tabs never catch up. */
export function updateFloodWater(water: FloodWater, elapsedSeconds: number): void {
  if (!Number.isFinite(elapsedSeconds)) return;
  water.material.uniforms.time.value = Math.max(0, elapsedSeconds);
}

import { Box3, Frustum, Material, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3, Vector4, type Object3D } from "three";
import { isSceneMaterialProgramRetirementV321 } from "./sceneMaterialPrograms";
import type { SurroundingNavigation } from "./SurroundingCityGeometry";
import type { VisualMode } from "./visualMode";

/** Display-only centimetre-scale wind ripples; no displacement or changed water level. */
export const WATER_RIPPLE_INTERVAL_V348 = 1000 / 24;
export const PACKED_RIVER_PAINT_V348 = [36, 76, 86] as const;
export type PackedRiverSelectorV348 = { rgb: readonly number[]; localY: number; triangles: number; bounds: number[] };
type Point = readonly number[];
const TOLERANCE = .018; // The original packet quantises source coordinates to centimetres.

function cross(a: Point, b: Point, p: Point): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}
function ringContains(p: Point, ring: readonly Point[], boundary = true): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) <= TOLERANCE) return boundary;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), cd = Math.hypot(d[0] - c[0], d[1] - c[1]);
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 &&
    Math.min(Math.abs(cross(a, b, c)), Math.abs(cross(a, b, d))) > TOLERANCE * ab &&
    Math.min(Math.abs(cross(c, d, a)), Math.abs(cross(c, d, b))) > TOLERANCE * cd;
}
function triangleInWater(triangle: Point[], polygon: SurroundingNavigation["water"][number]): boolean {
  if (!triangle.every(p => ringContains(p, polygon.ring) && !polygon.holes.some(h => ringContains(p, h, false)))) return false;
  // A triangle may not bridge a concave bank or hide a small island/hole.
  for (const ring of [polygon.ring, ...polygon.holes]) {
    for (let i = 0; i < ring.length; i++) for (let j = 0; j < 3; j++) {
      if (crosses(ring[i], ring[(i + 1) % ring.length], triangle[j], triangle[(j + 1) % 3])) return false;
    }
  }
  return !polygon.holes.some(h => h.some(p => ringContains(p, triangle, false)));
}

/** Certify existing mixed packet faces, never infer a water mask from colour alone.
 * Only the ordinary exporter swatch at the retained river/canal datum is eligible.
 * A colour/height collision, mixed triangle, bank or hole crossing rejects the
 * entire selector. Nothing in source arrays, navigation or mesh groups changes.
 */
export function* certifyPackedRiverWaterV348(
  originY: number, nav: SurroundingNavigation, vertices: Uint16Array,
  indices: Uint16Array | Uint32Array, native = false,
): Generator<void, PackedRiverSelectorV348 | undefined> {
  if (native || nav.water.length === 0 || nav.water.length > 256) return undefined;
  const edges = nav.water.map(p => p.ring.length + p.holes.reduce((n,h) => n + h.length, 0));
  if (edges.reduce((n,v) => n + v, 0) > 8192) return undefined;
  let probeBudget = 1048576;
  const localY = Math.round((-1.15 - originY) * 100);
  if (localY < 0 || localY > 65535) return undefined;
  const rgb = PACKED_RIVER_PAINT_V348.map(c => c * 257);
  const isCandidate = (i: number) => vertices[i * 6 + 1] === localY && rgb.every((c, axis) => vertices[i * 6 + 3 + axis] === c);
  const polygons = nav.water.map(p => ({ p, box: p.ring.reduce((b, q) =>
    [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])], [Infinity, Infinity, -Infinity, -Infinity]) }));
  let triangles = 0;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (let start = 0; start < indices.length; start += 768) {
    for (let i = start; i < Math.min(start + 768, indices.length); i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      if (a === b || b === c || c === a) continue; // Existing retired triangles are inert.
      const flags = [isCandidate(a), isCandidate(b), isCandidate(c)];
      if (!flags.some(Boolean)) continue;
      if (!flags.every(Boolean)) return undefined;
      const triangle = [a, b, c].map(k => [vertices[k * 6] * .01, vertices[k * 6 + 2] * .01]);
      if (Math.abs(cross(triangle[0], triangle[1], triangle[2])) < .00001) continue;
      if (!polygons.some(({ p, box }, polygonIndex) => triangle.every(q => q[0] >= box[0] - TOLERANCE && q[0] <= box[2] + TOLERANCE &&
        q[1] >= box[1] - TOLERANCE && q[1] <= box[3] + TOLERANCE) && (probeBudget -= edges[polygonIndex] * 12) >= 0 && triangleInWater(triangle, p))) return undefined;
      for (const p of triangle) { bounds[0] = Math.min(bounds[0], p[0] * 100); bounds[1] = Math.min(bounds[1], p[1] * 100);
        bounds[2] = Math.max(bounds[2], p[0] * 100); bounds[3] = Math.max(bounds[3], p[1] * 100); }
      triangles++;
    }
    yield;
  }
  return triangles ? { rgb: rgb.map(c => c / 65535), localY, triangles, bounds } : undefined;
}

const VERTEX_DECLARATIONS = `
varying vec3 vRiverWorldV348;
varying float vRiverEligibleV348;
uniform vec4 uRiverSelectorV348;
`;
const FRAGMENT_DECLARATIONS = `
varying vec3 vRiverWorldV348;
varying float vRiverEligibleV348;
uniform float uRiverTimeV348;
uniform float uRiverEnabledV348;
uniform float uRiverDaylight;
`;
const RIPPLE_FRAGMENT = `
if (uRiverEnabledV348 > 0.5 && vRiverEligibleV348 > 0.999) {
  vec2 riverP = vRiverWorldV348.xz;
  float riverSwell = sin(dot(riverP, vec2(0.11, -0.075)));
  float riverA = dot(riverP, vec2(0.72, 1.24)) - uRiverTimeV348 * 0.58 + 0.38 * riverSwell;
  float riverB = dot(riverP, vec2(-0.93, 0.43)) - uRiverTimeV348 * 0.37;
  float riverFootprint = max(fwidth(riverA), fwidth(riverB));
  float riverFilter = 1.0 - smoothstep(0.6, 2.0, riverFootprint);
  vec3 riverFace = cross(dFdx(vRiverWorldV348), dFdy(vRiverWorldV348));
  float riverTop = step(0.98, abs(riverFace.y) / max(length(riverFace), 0.000001));
  float riverWave = 0.74 * sin(riverA) + 0.26 * sin(riverB);
  outgoingLight *= 1.0 + riverTop * riverFilter * riverWave * 0.115;
  if (uRiverDaylight > 0.5) {
    // Only the broken, resolved crests catch light. The reflected direction
    // follows the daytime sun at (-760, 980, 720) above a horizontal surface.
    vec3 riverEye = normalize(cameraPosition - vRiverWorldV348);
    float sunward = smoothstep(0.42, 0.95, dot(riverEye, vec3(0.530, 0.683, -0.502)));
    float crest = smoothstep(0.58, 0.94, riverWave) * smoothstep(-0.6, 0.65, riverSwell);
    float resolved = 1.0 - smoothstep(0.28, 1.2, riverFootprint);
    vec3 reflection = mix(vec3(0.12, 0.16, 0.18), vec3(0.38, 0.35, 0.27), sunward);
    outgoingLight += riverTop * smoothstep(0.0, 0.16, riverEye.y) * resolved * crest * reflection;
  }
}
`;

export function patchRiverShaderV348(vertex: string, fragment: string, mixed: boolean): { vertex: string; fragment: string } {
  if (!vertex.includes("#include <project_vertex>") || !fragment.includes("#include <opaque_fragment>")) {
    throw Error("River ripple material lacks its retained Three.js shader anchors");
  }
  const eligibility = mixed
    ? "vRiverEligibleV348 = (abs(position.y-uRiverSelectorV348.w)<0.1 && distance(color.rgb,uRiverSelectorV348.xyz)<0.00001) ? 1.0 : 0.0;"
    : "vRiverEligibleV348 = 1.0;";
  return {
    vertex: VERTEX_DECLARATIONS + vertex.replace("#include <project_vertex>", `#include <project_vertex>
      vec4 riverWorldV348 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      riverWorldV348 = instanceMatrix * riverWorldV348;
      #endif
      vRiverWorldV348 = (modelMatrix * riverWorldV348).xyz;
      ${eligibility}`),
    fragment: FRAGMENT_DECLARATIONS + fragment.replace("#include <opaque_fragment>", RIPPLE_FRAGMENT + "\n#include <opaque_fragment>"),
  };
}

type Patch = { material: Material; undo: () => void };
export function createWaterRipplesV348() {
  const time = { value: 0 }, enabled = { value: 1 }, daylight = { value: 0 };
  const patches = new Map<Material, Patch>();
  const frustum = new Frustum(), projection = new Matrix4(), worldBox = new Box3();
  let disposed = false, now = 0, previous: number | undefined, lastVisible = -Infinity, lastFrame = -Infinity;
  function bindMaterial(material: Material, selector?: PackedRiverSelectorV348): void {
    if (disposed || patches.has(material) || material.userData.schwellenraumMaterialGrade === true ||
      !(material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial)) return;
    const before = material.onBeforeCompile, cache = material.customProgramCacheKey, render = material.onBeforeRender;
    const beforeDescriptor = Object.getOwnPropertyDescriptor(material, "onBeforeCompile");
    const cacheDescriptor = Object.getOwnPropertyDescriptor(material, "customProgramCacheKey");
    const renderDescriptor = Object.getOwnPropertyDescriptor(material, "onBeforeRender");
    // Evaluate Three's default function-derived key before installing the wrapper.
    const baselineKey = cache.call(material);
    const cell = { value: new Vector4(...(selector ? [...selector.rgb, selector.localY] : [0, 0, 0, 0]) as [number, number, number, number]) };
    const localBox = selector ? new Box3(new Vector3(selector.bounds[0], selector.localY - 1, selector.bounds[1]),
      new Vector3(selector.bounds[2], selector.localY + 1, selector.bounds[3])) : null;
    const compile: Material["onBeforeCompile"] = function(this: Material, shader, renderer) {
      before.call(this, shader, renderer);
      const next = patchRiverShaderV348(shader.vertexShader, shader.fragmentShader, !!selector);
      shader.vertexShader = next.vertex; shader.fragmentShader = next.fragment;
      shader.uniforms.uRiverTimeV348 = time; shader.uniforms.uRiverEnabledV348 = enabled; shader.uniforms.uRiverSelectorV348 = cell;
      shader.uniforms.uRiverDaylight = daylight;
    };
    const key = () => `${baselineKey}|ordinary-river-ripples-v348-${selector ? "mixed" : "pure"}`;
    const onRender: Material["onBeforeRender"] = function(this: Material, ...args) {
      render.apply(this, args);
      if (!enabled.value) return;
      if (localBox) {
        const camera = args[2], object = args[4];
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        if (!frustum.intersectsBox(worldBox.copy(localBox).applyMatrix4(object.matrixWorld))) return;
      }
      lastVisible = now;
    };
    const undo = () => {
      material.removeEventListener("dispose", onDispose);
      for (const [property, wrapper, descriptor] of [
        ["onBeforeCompile", compile, beforeDescriptor], ["customProgramCacheKey", key, cacheDescriptor], ["onBeforeRender", onRender, renderDescriptor],
      ] as const) if (material[property] === wrapper) {
        if (descriptor) Object.defineProperty(material, property, descriptor); else delete (material as unknown as Record<string, unknown>)[property];
      }
      patches.delete(material);
      material.needsUpdate = true;
    };
    const onDispose = () => { if (!isSceneMaterialProgramRetirementV321(material)) undo(); };
    material.onBeforeCompile = compile; material.customProgramCacheKey = key; material.onBeforeRender = onRender;
    material.addEventListener("dispose", onDispose); material.needsUpdate = true;
    patches.set(material, { material, undo });
  }
  return {
    /** Call after mode-material selection, before any aperture ownership receipt.
     * The overlay material group is deliberately untouched: it contains land only. */
    bind(object: Object3D, selector?: PackedRiverSelectorV348): void {
      if (!(object instanceof Mesh) || object.userData.nativeMinecraft === true || disposed) return;
      if (!selector && object.name !== "smooth water surface" && object.name !== "drawn water surface") return;
      const assigned = Array.isArray(object.material) ? object.material[0] : object.material;
      for (const material of [assigned, object.userData.dayMaterial, object.userData.nightMaterial, object.userData.moonlitMaterial]) {
        if (material instanceof Material) bindMaterial(material, selector);
      }
    },
    /** Existing shared loop only. False means no ripple-driven redraw is due.
     * Hidden/reduced/still modes freeze time, and offscreen owners expire after
     * the last actual material draw instead of traversing the city each frame. */
    update(timestamp: number, mode: VisualMode, reducedMotion: boolean, hidden: boolean): boolean {
      if (disposed || !Number.isFinite(timestamp)) return false;
      now = timestamp;
      enabled.value = mode === "minecraft" || mode === "flood" || mode === "schwellenraum" ? 0 : 1;
      daylight.value = mode === "day" ? 1 : 0;
      if (hidden || reducedMotion || !enabled.value || lastVisible < timestamp - 150) { previous = undefined; return false; }
      if (previous === undefined) previous = timestamp;
      time.value += Math.min(.1, Math.max(0, (timestamp - previous) / 1000)); previous = timestamp;
      if (timestamp - lastFrame < WATER_RIPPLE_INTERVAL_V348) return false;
      lastFrame = timestamp;
      return true;
    },
    dispose(): void { if (!disposed) { disposed = true; enabled.value = 0; for (const p of [...patches.values()]) p.undo(); } },
    get boundMaterials(): number { return patches.size; },
  };
}
export type WaterRipplesV348 = ReturnType<typeof createWaterRipplesV348>;

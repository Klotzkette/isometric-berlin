import { BufferAttribute, Mesh, MeshBasicMaterial } from "three";
import type { VisualMode } from "./visualMode";

type Point = readonly [number, number];

// Existing Hbf v252, Reichstag v256 and Paul-Löbe v343 joint owners, including
// their full extents. Keep their laid-out joints even where a course extends
// out of the detailed area. The face and lip can still catch daylight.
const authoredJointExtents = [
  [-418, -896, 10, -419],
  [-42, -80, 383, 155],
  [-221, -82, 42, 109],
] as const;

/** A single short per existing vertex. The four vertices of each cross-section
 * share the same station, including duplicate coordinates and sharp turns. */
export function kerbStoneCourses(lines: readonly (readonly Point[])[], pointCount: number) {
  const lengths = new Float64Array(lines.length);
  let longest = 0;
  for (const [i, line] of lines.entries()) {
    if (line.length < 2) continue;
    let length = 0, minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let j = 0; j < line.length; j++) {
      const [x, z] = line[j];
      if (j) length += Math.hypot(x - line[j-1][0], z - line[j-1][1]);
      minX = Math.min(x, minX); minZ = Math.min(z, minZ);
      maxX = Math.max(x, maxX); maxZ = Math.max(z, maxZ);
    }
    if (authoredJointExtents.some(([x0,z0,x1,z1]) => minX <= x1 && maxX >= x0 && minZ <= z1 && maxZ >= z0)) continue;
    lengths[i] = length;
    longest = Math.max(longest, length);
  }
  const scale = Math.max(1 / 64, Math.ceil(longest) / 65534);
  const stations = new Uint16Array(pointCount * 4);
  let vertex = 0;
  for (const [i, line] of lines.entries()) {
    const length = lengths[i];
    if (!length) { vertex += 4 * line.length; continue; }
    // Close each run on a whole stone, with a nominal one-metre course.
    const stonesPerMetre = Math.max(1, Math.round(length)) / length;
    let distance = 0;
    for (let j = 0; j < line.length; j++) {
      if (j) distance += Math.hypot(line[j][0] - line[j-1][0], line[j][1] - line[j-1][1]);
      stations.fill(1 + Math.round(distance * stonesPerMetre / scale), vertex, vertex + 4);
      vertex += 4;
    }
  }
  return { attribute: new BufferAttribute(stations, 1), scale };
}

const bindings = new WeakMap<MeshBasicMaterial, { value: number }>();

/** Indexed strips carry a fitted course. Existing boulevard instances have
 * a known box cross-section, but no source chainage across segment boundaries. */
export function presentKerbStoneFinish(mesh: Mesh, mode: VisualMode): void {
  const scale = mesh.userData.kerbStoneScale;
  const box = mesh.userData.kerbBoxProfile === true;
  if (!box && typeof scale !== "number") return;
  const material = mesh.userData.dayMaterial;
  if (!(material instanceof MeshBasicMaterial)) return;
  let gate = bindings.get(material);
  if (!gate && mode === "day") {
    const enabled = { value: 1 };
    const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.kerbStoneEnabled = enabled;
      if (!box) shader.uniforms.kerbStoneScale = { value: scale };
      const stationInputs = box ? "" : "attribute float kerbStation;\nuniform float kerbStoneScale;\n";
      const profile = box ? "vKerbProfile = vec3(-1.0, position.z + 0.5, position.y + 0.5);" : `
int corner = gl_VertexID % 4;
vKerbProfile = vec3(kerbStation > 0.0 ? (kerbStation - 1.0) * kerbStoneScale : -1.0,
  float(corner % 2), float(corner / 2));`;
      shader.vertexShader = stationInputs + "varying vec3 vKerbProfile;\n" +
        shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n" + profile);
      shader.fragmentShader = "uniform float kerbStoneEnabled;\nvarying vec3 vKerbProfile;\n" +
        shader.fragmentShader.replace("#include <opaque_fragment>", `
if (kerbStoneEnabled > 0.0) {
  float course = vKerbProfile.x;
  vec2 pixel = fwidth(vKerbProfile.yz);
  float detail = 1.0 - smoothstep(0.18, 0.85, max(pixel.x, pixel.y));
  float lip = smoothstep(0.89, 1.0, abs(vKerbProfile.y * 2.0 - 1.0)) * smoothstep(0.89, 1.0, vKerbProfile.z);
  float heel = 1.0 - smoothstep(0.0, 0.72, vKerbProfile.z);
  float stone = 0.0;
  float halfPixel = max(0.0001, fwidth(course) * 0.5);
  if (course >= 0.0) {
    // Pixel coverage of a narrow joint. Subpixel seams lose contrast as
    // the observer rises, instead of turning into a shimmering dotted line.
    float phase = fract(course + 0.5) - 0.5;
    float covered = max(0.0, min(phase + halfPixel, 0.006) - max(phase - halfPixel, -0.006));
    float tone = fract(floor(course) * 0.618034) - 0.5;
    stone = (tone * 0.085 - 0.48 * covered / (2.0 * halfPixel)) * (1.0 - smoothstep(0.08, 0.38, halfPixel));
  }
  outgoingLight *= 1.0 + detail * (stone + 0.10 * lip - 0.17 * heel);
}
#include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => key + (box ? "|kerb-stone-box" : "|kerb-stone-course");
    material.needsUpdate = true;
    bindings.set(material, enabled);
    gate = enabled;
  }
  if (gate) gate.value = mode === "day" ? 1 : 0;
}

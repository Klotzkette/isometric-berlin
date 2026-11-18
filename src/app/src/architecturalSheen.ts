import { InstancedMesh, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector2 } from "three";
import type { VisualMode } from "./visualMode";

import { finishPaints, finishes, strengths, type Finish, type SurfaceFinish } from "./architecturalFinishTypes";
import { civicArchitecturalFinish } from "./civicArchitecturalFinish";
import { skylineArchitecturalFinish } from "./skylineFinishes";

// These batches own the indicated surface. Other batches can combine trees,
// paving, buildings or signs into the same paint and deliberately stay outside.
const surfaces = new Map<string, Finish>([
  ["LoD2 prism buildings", "masonry"],
  ["LoD2 distant building shells", "masonry"],
  ["Berliner Dom retained LoD2 footprint", "masonry"],
  ["Altes Museum retained LoD2 wings and courts", "masonry"],
  ["Museum island details ionic", "masonry"],
  ["Moltkebrücke ornamental stone bodies", "masonry"],
  ["Berliner Dom copper main cupola", "patina"],
  ["Berliner Dom corner copper cupola", "patina"],
  ["Museum island details bronze", "patina"],
  ["Brandenburg Gate pavilion patinated gable roof", "patina"],
  ["Goldelse gilded Viktoria bodies", "patina"],
  ["bridge structure lamps", "glass"],
  ["Moltkebrücke ornamental stone lamps", "glass"],
  ["LoD2 glass prisms", "glass"],
  ["Kollhoff recessed window panes", "glass"],
  ["Charite aluminium facade window panes", "glass"],
  ["Hauptbahnhof 321 m east-west glass roof", "glass"],
  ["Hauptbahnhof 180 m north-south hall", "glass"],
  ["Hauptbahnhof entrance cantilevered glass canopy", "glass"],
  ["Hauptbahnhof v291 glazing", "glass"],
  ["24-sector glass envelope with 13 glazed rows", "glass"],
  ["Chancellery photo v287 clear louvre glazing", "glass"],
  ["Chancellery retained rounded glazed vestibule v289", "glass"],
]);

const vertexDeclaration = "varying vec3 vArchitecturalView;";
const fragmentDeclaration = vertexDeclaration + "\nuniform vec2 uArchitecturalSheen;";

// Fragment derivatives also give the right plane on the compact city prisms
// that carry no normals. mvPosition already includes batching and instancing.
const dayFinish = `
if (uArchitecturalSheen.x > 0.0 && surfaceStrength.x > 0.0) {
  vec3 plane = cross(dFdx(vArchitecturalView), dFdy(vArchitecturalView));
  vec3 n = plane * inversesqrt(max(dot(plane, plane), 1e-20));
  vec3 sun = mat3(viewMatrix) * vec3(-0.530, 0.684, 0.502);
  float facing = dot(n, sun);
  vec3 base = clamp(outgoingLight, 0.0, 1.0);
  vec3 room = 1.0 - base;
  outgoingLight += room * base * surfaceStrength.x *
    max(0.0, facing) * vec3(1.0, 0.90, 0.75);
  if (surfaceStrength.y > 0.0) {
    vec3 eye = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vArchitecturalView);
    vec3 reflected = reflect(-eye, n);
    float sky = clamp(0.5 + 0.5 * dot(reflected, viewMatrix[1].xyz), 0.0, 1.0);
    float gleam = max(0.0, dot(reflected, sun));
    gleam *= gleam;
    gleam *= gleam;
    vec3 silver = vec3(0.68, 0.86, 1.0) * (0.10 + 0.46 * sky * sky);
    vec3 gold = vec3(1.0, 0.92, 0.76) * (0.54 * gleam * gleam);
    outgoingLight += room * (0.16 + 0.72 * base) * surfaceStrength.y * (silver + gold);
  }
}
`;

type SurfaceMaterial = MeshBasicMaterial | MeshStandardMaterial;
type Uniform = { value: unknown };
type Selector = { key: string; declarations: string; choice: string; uniforms: Record<string, Uniform> };
const bindings = new WeakMap<Material, { gate: Vector2; profile: unknown }>();
const claims = new WeakMap<Material, unknown>();
const conflict = Symbol("shared with another surface");
const wholeSurface: Selector = { key: "", declarations: "", choice: "", uniforms: {} };

function bucket(count: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, count)));
}

function selectPaint(mesh: Mesh, profile: Exclude<SurfaceFinish, string>, material: SurfaceMaterial): Selector {
  const paints = finishPaints(profile);
  const size = bucket(paints.length);
  const table = new Float32Array(size * 4);
  const instanceColor = mesh instanceof InstancedMesh ? mesh.instanceColor : null;
  const attribute = instanceColor ?? mesh.geometry.getAttribute("color");
  const byteColor = attribute?.normalized && attribute.array instanceof Uint8Array;
  for (const [i, { color, id }] of paints.entries()) {
    const offset = i * 4;
    color.toArray(table, offset);
    if (byteColor) {
      for (let c = offset; c < offset + 3; c++) table[c] = Math.round(table[c] * 255) / 255;
    }
    table[offset + 3] = id;
  }
  return {
    key: "paint" + size,
    uniforms: { uArchitecturalPaint: { value: table }, uBodyPaint: { value: material.color } },
    declarations: `uniform vec4 uArchitecturalPaint[${size}];
uniform vec3 uBodyPaint;
float architecturalRole() {
  #ifdef USE_INSTANCING_COLOR
    vec3 paint = instanceColor.rgb;
  #elif defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
    vec3 paint = color.rgb;
  #else
    vec3 paint = uBodyPaint;
  #endif
  for (int i = 0; i < ${size}; i++) {
    vec4 swatch = uArchitecturalPaint[i];
    if (all(lessThanEqual(abs(swatch.rgb - paint), vec3(0.000016)))) return swatch.w;
  }
  return 0.0;
}`,
    choice: "architecturalRole()",
  };
}

function selectRuns(runs: number[]): Selector {
  const size = bucket(Math.ceil(runs.length / 4));
  const data = new Uint32Array(size * 4);
  data.set(runs);
  return {
    key: "runs" + size, choice: "architecturalRole()",
    uniforms: { uArchitecturalRuns: { value: data }, uArchitecturalRunCount: { value: runs.length } },
    declarations: `uniform highp uvec4 uArchitecturalRuns[${size}];
uniform int uArchitecturalRunCount;
float architecturalRole() {
  uint vertex = uint(gl_VertexID);
  int low = 0, high = uArchitecturalRunCount;
  for (int step = 0; step < ${Math.ceil(Math.log2(size * 4 + 1))}; step++) {
    if (low >= high) break;
    int mid = (low + high) / 2;
    uint code = uArchitecturalRuns[mid / 4][mid % 4];
    uint start = code >> 13u;
    uint end = start + ((code >> 2u) & 2047u);
    if (vertex < start) high = mid;
    else if (vertex > end) low = mid + 1;
    else return float((code & 3u) + 1u);
  }
  return 0.0;
}`,
  };
}

const taggedSurface: Selector = {
  key: "attribute", declarations: "attribute float architecturalFinishId;",
  choice: "architecturalFinishId", uniforms: {},
};
const chooseStrength = [
  "vec2 architecturalStrength(float role) {",
  ...finishes.map((finish, i) => `if (role == ${i + 1}.0) return vec2(${strengths[finish].join(", ")});`),
  "return vec2(0.0); }",
].join("\n");

function install(material: SurfaceMaterial, profile: unknown, selector: Selector) {
  const gate = new Vector2();
  const previous = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  const mixed = !!selector.choice;
  const varying = mixed ? "varying vec2 vArchitecturalStrength;\n" : "";
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, selector.uniforms);
    shader.uniforms.uArchitecturalSheen = { value: gate };
    shader.vertexShader = [vertexDeclaration, varying, selector.declarations, mixed ? chooseStrength : "",
      shader.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\nvArchitecturalView = mvPosition.xyz;" +
        (mixed ? "\nvArchitecturalStrength = architecturalStrength(" + selector.choice + ");" : ""))].join("\n");
    shader.fragmentShader = fragmentDeclaration + "\n" + varying + shader.fragmentShader.replace(
      "#include <opaque_fragment>", "vec2 surfaceStrength = " + (mixed ? "vArchitecturalStrength" : "uArchitecturalSheen") +
        ";\n" + dayFinish + "\n#include <opaque_fragment>",
    );
  };
  material.customProgramCacheKey = () => key + "|architectural-sheen|" + selector.key;
  material.needsUpdate = true;
  const binding = { gate, profile };
  bindings.set(material, binding);
  return binding;
}

/** Runs inside the presentation walk for both initial and subsequently added geometry. */
export function presentArchitecturalSheen(mesh: Mesh, mode: VisualMode): void {
  const material = mesh.userData.dayMaterial instanceof Material ? mesh.userData.dayMaterial : mesh.material;
  if (!(material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial)) return;
  let binding = bindings.get(material);
  if (mode !== "day") { binding?.gate.set(0, 0); return; }

  const legacy = surfaces.get(mesh.name);
  const runs: number[] | undefined = mesh.userData.architecturalRuns;
  const tagged = mesh.geometry.hasAttribute("architecturalFinishId");
  const authored = legacy ?? civicArchitecturalFinish(mesh) ?? skylineArchitecturalFinish(mesh);
  const profile = runs ?? (tagged ? taggedSurface : authored);
  // One material can also paint neighbouring lettering, trees or furniture.
  // An incompatible owner keeps the original shared paint throughout.
  if (!legacy) {
    if (claims.has(material) && claims.get(material) !== profile) {
      claims.set(material, conflict);
      binding?.gate.set(0, 0);
      return;
    }
    claims.set(material, profile);
  }
  if (!profile) return;
  if (!binding) {
    let selector = wholeSurface;
    if (runs) selector = selectRuns(runs);
    else if (tagged) selector = taggedSurface;
    else if (authored && typeof authored !== "string") selector = selectPaint(mesh, authored, material);
    binding = install(material, profile, selector);
  }
  if (binding.profile !== profile) return;
  if (!runs && !tagged && typeof authored === "string") binding.gate.set(...strengths[authored]);
  else binding.gate.set(1, 0);
}

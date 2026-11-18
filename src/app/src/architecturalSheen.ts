import { Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector2 } from "three";
import type { VisualMode } from "./visualMode";

type Finish = "masonry" | "glass" | "patina";

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

// Linear-light strengths for the broad sunlit plane and the sky reflection.
const strengths: Record<Finish, readonly [number, number]> = {
  masonry: [.095, 0],
  patina: [.07, .20],
  glass: [.045, .26],
};

const bindings = new WeakMap<Material, { value: Vector2 }>();
const vertexDeclaration = "varying vec3 vArchitecturalView;";
const fragmentDeclaration = vertexDeclaration + "\nuniform vec2 uArchitecturalSheen;";

// Fragment derivatives also give the right plane on the compact city prisms
// that carry no normals. mvPosition already includes batching and instancing.
const dayFinish = `
if (uArchitecturalSheen.x > 0.0) {
  vec3 plane = cross(dFdx(vArchitecturalView), dFdy(vArchitecturalView));
  vec3 n = plane * inversesqrt(max(dot(plane, plane), 1e-20));
  vec3 sun = mat3(viewMatrix) * vec3(-0.530, 0.684, 0.502);
  float facing = dot(n, sun);
  vec3 base = clamp(outgoingLight, 0.0, 1.0);
  vec3 room = 1.0 - base;
  outgoingLight += room * base * uArchitecturalSheen.x *
    max(0.0, facing) * vec3(1.0, 0.90, 0.75);
  if (uArchitecturalSheen.y > 0.0) {
    vec3 eye = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vArchitecturalView);
    vec3 reflected = reflect(-eye, n);
    float sky = clamp(0.5 + 0.5 * dot(reflected, viewMatrix[1].xyz), 0.0, 1.0);
    float gleam = max(0.0, dot(reflected, sun));
    gleam *= gleam;
    gleam *= gleam;
    vec3 silver = vec3(0.68, 0.86, 1.0) * (0.10 + 0.46 * sky * sky);
    vec3 gold = vec3(1.0, 0.92, 0.76) * (0.54 * gleam * gleam);
    outgoingLight += room * (0.16 + 0.72 * base) * uArchitecturalSheen.y * (silver + gold);
  }
}
`;

/** Called inside existing presentation walks, including deferred city batches. */
export function presentArchitecturalSheen(mesh: Mesh, mode: VisualMode): void {
  const finish = surfaces.get(mesh.name);
  if (!finish) return;
  const material = mesh.userData.dayMaterial instanceof Material
    ? mesh.userData.dayMaterial : mesh.material;
  if (!(material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial)) return;
  let uniform = bindings.get(material);
  if (!uniform) {
    if (mode !== "day") return;
    uniform = { value: new Vector2() };
    bindings.set(material, uniform);
    const previous = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    const sheen = uniform;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.uArchitecturalSheen = sheen;
      shader.vertexShader = vertexDeclaration + "\n" + shader.vertexShader.replace(
        "#include <project_vertex>", "#include <project_vertex>\nvArchitecturalView = mvPosition.xyz;",
      );
      shader.fragmentShader = fragmentDeclaration + "\n" + shader.fragmentShader.replace(
        "#include <opaque_fragment>", dayFinish + "\n#include <opaque_fragment>",
      );
    };
    material.customProgramCacheKey = () => key + "|architectural-sheen";
    material.needsUpdate = true;
  }
  if (mode === "day") uniform.value.set(...strengths[finish]);
  else uniform.value.set(0, 0);
}

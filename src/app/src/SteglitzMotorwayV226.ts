import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import data from "./data/steglitzMotorwayV226.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const STEGLITZ_MOTORWAY_V226_CAMERA = {
  position: [-3195, 150, 7020], target: [-3415, 9.4, 6825], spanM: 590,
};

/** Complete missing mapped A103 course and its bounded join to the retained
 * cartographic projection. Constructors never keep construction JSON rows. */
export function createSteglitzMotorwayV226(native = false): Group {
  const root = new Group(); root.name = "Steglitz A103 mapped bridge and approaches v226";
  root.userData = { steglitzMotorwayV226: true, additiveOnly: true, textureFree: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, sourceXZPreserved: true, newScopeArea: 0,
    sourceReceipt: "steglitz-motorway-v226-source.json", sourceWays: 25,
    heightSource: "documented display estimate, not surveyed bridge elevation" };
  if (native) {
    const mesh = justicePalaceV183Boxes(data.nativeRows, true);
    mesh.name = "A103 independent orthogonal deck runs and parapet blocks";
    root.add(mesh);
  } else {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(data.positions), 3));
    const values = new Float32Array(data.colors.length * 3), color = new Color();
    for (let i = 0; i < data.colors.length; i++) color.setHex(data.colors[i]).toArray(values, i * 3);
    geometry.setAttribute("color", new BufferAttribute(values, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .9 });
    const mesh = new Mesh(geometry, day); mesh.name = "A103 complete source deck sheets and edge depth";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
    const rails = justicePalaceV183Boxes(data.rails);
    rails.name = "A103 restrained bridge parapets; open source junctions"; root.add(rails);
  }
  return freezeStaticSceneTransforms(root);
}

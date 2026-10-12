import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { correctedHospitalFittingsV215 } from "./bundeswehrHospitalV215Profile";
import data from "./data/bundeswehrHospitalV214.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Exact mapped ground pad; the approach is illustrative, not a flight procedure. */
export const BUNDESWEHR_HELIPAD_V214 = {
  centre: data.helipad.centre as [number, number, number],
  approach: data.helipad.approach as [number, number],
};
export const BUNDESWEHR_HOSPITAL_V214_CAMERA = {
  position: [-350, 165, -1630], target: [-55, 17, -1845], spanM: 430,
};
const materials = () => ({
  day: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
  night: new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .86 }),
});

/** Pure additive fittings; exact existing LoD2 shells and earlier city packets remain. */
export function createBundeswehrHospitalV214(native = false): Group {
  const root = new Group();
  root.name = `Bundeswehrkrankenhaus source facade and helipad v214${native ? " native" : ""}`;
  root.userData = { bundeswehrHospitalV214: true, sourceGeometryRetained: true,
    additiveOnly: true, fullStaticDetailOnTouch: true, textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    sourceReceipt: "bundeswehr-hospital-v214-source.json", newScopeArea: 0,
    sourceBodiesSuppressed: 0, helipadWay: "51804908" };
  const rows = correctedHospitalFittingsV215(native ? data.blocks : data.boxes, native);
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const normals = geometry.getAttribute("normal"), shades = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const s = normals.getY(i) > .5 ? 1 : normals.getX(i) > .5 ? .86 : .95;
    shades.set([s, s, s], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(shades, 3));
  const pair = materials(), mesh = new InstancedMesh(geometry, pair.day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(+r[3], +r[4], +r[5]).setPosition(+r[0], +r[1], +r[2]);
    else {
      matrix.makeRotationY(+r[6]);
      const elements = matrix.elements;
      for (let n = 0; n < 3; n++) for (let k = 0; k < 3; k++) elements[n * 4 + k] *= +r[n + 3];
      matrix.setPosition(+r[0], +r[1], +r[2]);
    }
    matrix.toArray(matrices, i * 16); color.setHex(+r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = "Bundeswehr ward bands, pavilion courses and mapped helipad markings";
  mesh.userData = { textureFree: true, dayMaterial: pair.day, nightMaterial: pair.night,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  if (!native) {
    const positions = new Float32Array(data.padTriangles.flat(2));
    const padGeometry = new BufferGeometry();
    padGeometry.setAttribute("position", new BufferAttribute(positions, 3));
    const padColors = new Float32Array(positions.length); color.setHex(0x626D69);
    for (let i = 0; i < positions.length; i += 3) color.toArray(padColors, i);
    padGeometry.setAttribute("color", new BufferAttribute(padColors, 3));
    padGeometry.computeVertexNormals(); padGeometry.computeBoundingSphere();
    const pad = new Mesh(padGeometry, pair.day); pad.name = "Exact OSM helipad 51804908";
    pad.userData = { textureFree: true, dayMaterial: pair.day, nightMaterial: pair.night }; root.add(pad);
  }
  return freezeStaticSceneTransforms(root);
}

import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/neukoellnPlacesV210.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const NEUKOELLN_V210_OWNER_IDS = data.owners.map(owner => owner.id);
export const NEUKOELLN_V210_GROUP = "Richardplatz and Hermannplatz current architecture v210";
function materials(vertexColors = false) {
  return { day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .86 }) };
}
function group(native: boolean, required: boolean): Group {
  const root = new Group();
  root.name = (required ? "Required Neukoelln source envelopes v210" : NEUKOELLN_V210_GROUP) + (native ? " native" : "");
  root.userData = { neukoellnPlacesV210: true, neukoellnEnvelopesV210: required,
    textureFree: true, fullStaticDetailOnTouch: true, nativeMinecraft: native,
    blockNative: native, keepInMinecraft: native, sourceOwnerIds: NEUKOELLN_V210_OWNER_IDS,
    sourceParentIds: NEUKOELLN_V210_OWNER_IDS, sourceReceipt: "neukoelln-places-v210-source.json",
    originalSourceSheetsRetained: true, sourceXZPreserved: true,
    currentPostwarStore: true, historicalTowers: false, estimatedChurchBelfry: true,
    newCourtWalls: false, newPassageClosures: false };
  return root;
}
function boxes(rows: readonly (readonly (number | string)[])[], native: boolean, name: string) {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((row, i) => {
    const r = row as readonly number[];
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(scale.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
    color.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.name = name;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: native, blockNative: native };
  return mesh;
}
/** Required before the seven exact coarse owners are retired. Every source
 * wall/roof sheet remains; the west church belfry is an explicit visual estimate. */
export function createNeukoellnEnvelopesV210(native = false): Group {
  const root = group(native, true);
  if (native) root.add(boxes(data.shellBlocks, true, "Independent orthogonal Neukoelln shell skins"));
  else {
    const positions = new Float32Array(data.surfaces.reduce((n, s) => n + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color(); let offset = 0;
    for (const surface of data.surfaces) {
      tint.setHex(surface.color);
      for (const triangle of surface.triangles) for (const p of triangle) {
        positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materials(true), mesh = new Mesh(geometry, day);
    mesh.name = "All measured Karstadt, church and smithy sheets; estimated small belfry";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}
export function createNeukoellnPlacesV210(native = false): Group {
  const root = group(native, false); root.userData.additiveOnly = true;
  root.add(boxes(native ? data.blocks : data.boxes, native, "Source-exposed facades, church clocks and mapped public-place furniture"));
  return freezeStaticSceneTransforms(root);
}

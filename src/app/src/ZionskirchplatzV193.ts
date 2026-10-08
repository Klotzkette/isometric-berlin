import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/zionskirchplatzV193.json";
import evidence from "./data/zionskirchplatzV193Evidence.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const ZIONSKIRCHPLATZ_V193_GROUP = "Zionskirchplatz complete square-facing source facades v193";
// Each complete source parent keeps its own rigid datum, including the upper
// Cafe-103 wall behind the low neighbour. Never choose a nearest old facade.
export const ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS = data.owners.map(owner =>
  buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY));

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .87 }),
  };
}

/** Additions only; all source shells, v175 details and v186 courses stay owned. */
export function createZionskirchplatzV193(native = false): Group {
  const root = new Group();
  root.name = ZIONSKIRCHPLATZ_V193_GROUP + (native ? " native" : "");
  root.userData = { zionskirchplatzV193: true, textureFree: true, additiveOnly: true,
    sourceGeometryRetained: true, sourceOwnerIds: evidence.coverageOwnerIds,
    fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, sourceReceipt: "zionskirchplatzV193Evidence.json" };
  if (!native) {
    const positions = new Float32Array(evidence.counts.drawnTriangles * 9);
    const colors = new Float32Array(positions.length), tint = new Color();
    let offset = 0;
    for (const surface of data.surfaces) {
      tint.setHex(surface.color);
      const lift = ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS[surface.owner];
      for (const triangle of surface.triangles) for (const p of triangle) {
        positions.set([p[0], p[1] + lift, p[2]], offset);
        tint.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materials(true), mesh = new Mesh(geometry, day);
    mesh.name = "Zion measured wall planes: plaster and restrained ground-floor colours";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  const rows = native ? data.blocks : data.boxes;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), tint = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[4], r[6], r[7]);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3], r[4], r[5]));
    const owner = r[native ? 8 : 11];
    matrix.setPosition(r[0], r[1] + ZIONSKIRCHPLATZ_V193_OWNER_OFFSETS[owner], r[2]).toArray(matrices, i * 16);
    tint.setHex(r[native ? 3 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "Zion bounded window divisions door frames and sill courses";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

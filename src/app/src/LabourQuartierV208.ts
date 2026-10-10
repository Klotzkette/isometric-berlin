import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/labourQuartierV208.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const LABOUR_QUARTIER_V208_GROUP = "BMAS campus and Quartier 206 architecture v208";
export const LABOUR_QUARTIER_V208_OWNER_IDS = data.owners.map(owner => owner.id);
const terrainOffsets = data.owners.map(owner =>
  buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY));
function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .88 }),
  };
}

/** Static, texture-free attachment layers; complete earlier shells remain. */
export function createLabourQuartierV208(native = false): Group {
  const root = new Group();
  root.name = LABOUR_QUARTIER_V208_GROUP + (native ? " native" : "");
  root.userData = {
    labourQuartierV208: true, textureFree: true, facadeOnly: true,
    sourceGeometryRetained: true, sourceOwnerIds: LABOUR_QUARTIER_V208_OWNER_IDS,
    fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, newCourtWalls: false, newPassageClosures: false,
  };
  if (!native) {
    const positions = new Float32Array(data.surfaces.reduce((sum, s) => sum + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color();
    let offset = 0;
    for (const surface of data.surfaces) {
      tint.setHex(surface.color);
      for (const triangle of surface.triangles) for (const p of triangle) {
        positions.set([p[0], p[1] + terrainOffsets[surface.owner], p[2]], offset);
        tint.toArray(colors, offset); offset += 3;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const { day, night } = materials(true), mesh = new Mesh(geometry, day);
    mesh.name = "Measured BMAS stone planes and Quartier 206 folded fronts";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  const rows = native ? data.blocks : data.boxes;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), tint = new Color();
  rows.forEach((row, index) => {
    const r = row as (number | string)[];
    if (native) matrix.makeScale(Number(r[3]), Number(r[4]), Number(r[5]));
    else matrix.makeRotationY(Number(r[6])).scale(size.set(Number(r[3]), Number(r[4]), Number(r[5])));
    matrix.setPosition(Number(r[0]), Number(r[1]) + terrainOffsets[Number(r[native ? 7 : 8])], Number(r[2]))
      .toArray(matrices, index * 16);
    tint.setHex(Number(r[native ? 6 : 7])).toArray(colors, index * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "BMAS framed openings, rustication and Quartier 206 limestone ribbons";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

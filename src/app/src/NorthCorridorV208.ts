import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/northCorridorV208.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const NORTH_CORRIDOR_V208_GROUP = "Northern Linden corridor architecture v208";
export const NORTH_CORRIDOR_V208_OWNER_IDS = data.owners.map(owner => owner.id);
export const NORTH_CORRIDOR_V208_OWNER_OFFSETS = data.owners.map(owner =>
  buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY));

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .83 }),
  };
}

function surfaceMesh(surfaces: typeof data.surfaces, name: string): Mesh {
    const positions = new Float32Array(surfaces.reduce((sum, s) => sum + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color();
    let offset = 0;
    for (const surface of surfaces) {
      tint.setHex(surface.color);
      const lift = NORTH_CORRIDOR_V208_OWNER_OFFSETS[surface.owner];
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
    mesh.name = name;
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    return mesh;
}

/** Required measured replacement, loaded before publishing the initial drawn city. */
export function createHungarianEnvelopeV208(): Group {
  const root = new Group();
  root.name = "Complete Hungarian measured envelope v208";
  root.userData = { northCorridorV208: true, sourceGeometryRetained: true, fullStaticDetailOnTouch: true,
    sourceParentIds: [data.owners[0].id], exactHungarianLegacySubstitution: true, textureFree: true };
  root.add(surfaceMesh(data.surfaces.filter(s => s.face === -1), "Complete Hungarian measured wall and roof sheets"));
  return freezeStaticSceneTransforms(root);
}

/** Bounded northern corridor facade fittings; complete Hungarian shell is required separately. */
export function createNorthCorridorV208(native = false): Group {
  const root = new Group();
  root.name = NORTH_CORRIDOR_V208_GROUP + (native ? " native" : "");
  root.userData = {
    northCorridorV208: true, textureFree: true, additiveOnly: true,
    sourceGeometryRetained: true, sourceOwnerIds: NORTH_CORRIDOR_V208_OWNER_IDS,
    sourceParentIds: NORTH_CORRIDOR_V208_OWNER_IDS, hungarianSourceParent: "DEBE01YYK00001vQ",
    fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, newCourtWalls: false, newPassageClosures: false,
    sourceReceipt: "northCorridorV208Evidence.json",
  };
  if (!native) root.add(surfaceMesh(data.surfaces.filter(s => s.face !== -1), "Northern corridor streetfront planes"));
  const rows = native ? data.blocks : data.boxes;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), tint = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3], r[4], r[5]));
    const oi = r[native ? 8 : 9];
    matrix.setPosition(r[0], r[1] + NORTH_CORRIDOR_V208_OWNER_OFFSETS[oi], r[2]).toArray(matrices, i * 16);
    tint.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "Northern corridor glass, ceramic, precast and stone facade fittings";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native };
  root.add(mesh);
  const nightRows = native ? data.nightBlocks : data.nightBoxes;
  const glowGeometry = new BoxGeometry(1, 1, 1); glowGeometry.deleteAttribute("uv");
  const glowDay = new MeshBasicMaterial({ color: 0xe6d1aa });
  const glowNight = new MeshStandardMaterial({ color: 0xe6d1aa, emissive: 0xffd69a, emissiveIntensity: .5, roughness: .75 });
  glowNight.userData = { nightEmissive: 0xffd69a, nightEmissiveIntensity: .5 };
  const glow = new InstancedMesh(glowGeometry, glowDay, 0);
  const glowMatrices = new Float32Array(nightRows.length * 16);
  nightRows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3] + .025, r[4] * .92, r[5] + .025);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3] * .94, r[4] * .94, r[5] + .035));
    matrix.setPosition(r[0], r[1] + NORTH_CORRIDOR_V208_OWNER_OFFSETS[r[native ? 8 : 9]], r[2]).toArray(glowMatrices, i * 16);
  });
  glow.count = nightRows.length;
  glow.instanceMatrix = new InstancedBufferAttribute(glowMatrices, 16);
  glow.computeBoundingBox(); glow.computeBoundingSphere();
  glow.name = "Northern corridor night-only glazing";
  glow.visible = false;
  glow.userData = { dayMaterial: glowDay, nightMaterial: glowNight, nightOnly: true, textureFree: true, blockNative: native, nativeMinecraft: native };
  root.add(glow);
  return freezeStaticSceneTransforms(root);
}

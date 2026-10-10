import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/ministrySpreeV207.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const MINISTRY_SPREE_V207_GROUP = "Kapelle-Ufer ministry green architecture v207";
export const MINISTRY_SPREE_V207_OWNER_IDS = data.owners.map(owner => owner.id);
export const MINISTRY_SPREE_V207_OWNER_OFFSETS = data.owners.map(owner =>
  buildingTerrainOffset(owner.id, owner.anchor[0], owner.anchor[1], owner.groundY));

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .83 }),
  };
}

/** Add shallow detail to ten ministry leaves and the retained entrance portico. */
export function createMinistrySpreeV207(native = false): Group {
  const root = new Group();
  root.name = MINISTRY_SPREE_V207_GROUP + (native ? " native" : "");
  root.userData = {
    ministrySpreeV207: true, textureFree: true, additiveOnly: true,
    sourceGeometryRetained: true, sourceOwnerIds: MINISTRY_SPREE_V207_OWNER_IDS,
    sourceParentId: "DEBE01YYK00005iG", sourcePorticoId: "DEBE01YYK0001xGY", osmIdentity: "way/1302352107",
    fullStaticDetailOnTouch: true, blockNative: native, nativeMinecraft: native,
    keepInMinecraft: native, newCourtWalls: false, newPassageClosures: false,
    sourceReceipt: "ministrySpreeV207Evidence.json",
  };
  if (!native) {
    const positions = new Float32Array(data.surfaces.reduce((sum, s) => sum + s.triangles.length * 9, 0));
    const colors = new Float32Array(positions.length), tint = new Color();
    let offset = 0;
    for (const surface of data.surfaces) {
      tint.setHex(surface.color);
      const lift = MINISTRY_SPREE_V207_OWNER_OFFSETS[surface.owner];
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
    mesh.name = "Measured ministry facade planes and exposed technical screens";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
    root.add(mesh);
  }
  const rows = native ? data.blocks : data.boxes;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const { day, night } = materials(), mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), tint = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3], r[4], r[5]));
    const oi = r[native ? 8 : 9];
    matrix.setPosition(r[0], r[1] + MINISTRY_SPREE_V207_OWNER_OFFSETS[oi], r[2]).toArray(matrices, i * 16);
    tint.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "Ministry green stone fins, pale panels, bronze frames and entrance glazing";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native };
  root.add(mesh);
  const litRows = rows.filter((r, i) => r[native ? 7 : 8] === 1 && i % 17 === 0);
  const glowGeometry = new BoxGeometry(1, 1, 1); glowGeometry.deleteAttribute("uv");
  const glowDay = new MeshBasicMaterial({ color: 0xf1dfac });
  const glowNight = new MeshStandardMaterial({ color: 0xf1dfac, emissive: 0xffdb93,
    emissiveIntensity: .7, roughness: .72 });
  glowNight.userData = { nightEmissive: 0xffdb93, nightEmissiveIntensity: .7 };
  const glow = new InstancedMesh(glowGeometry, glowDay, 0);
  const glowMatrices = new Float32Array(litRows.length * 16);
  litRows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3] + .025, r[4] * .92, r[5] + .025);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3] * .88, r[4] * .92, r[5] + .035));
    matrix.setPosition(r[0], r[1] + MINISTRY_SPREE_V207_OWNER_OFFSETS[r[native ? 8 : 9]], r[2]).toArray(glowMatrices, i * 16);
  });
  glow.count = litRows.length;
  glow.instanceMatrix = new InstancedBufferAttribute(glowMatrices, 16);
  glow.computeBoundingBox(); glow.computeBoundingSphere();
  glow.name = "Ministry night-only office glazing";
  glow.visible = false;
  glow.userData = { dayMaterial: glowDay, nightMaterial: glowNight, nightOnly: true,
    textureFree: true, blockNative: native, nativeMinecraft: native };
  root.add(glow);
  return freezeStaticSceneTransforms(root);
}

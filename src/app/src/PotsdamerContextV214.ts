import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import data from "./data/potsdamerContextV214.json";
import {
  POTSDAMER_CONTEXT_V214_OFFSETS, POTSDAMER_CONTEXT_V214_OWNER_IDS,
} from "./potsdamerContextV214Profile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const POTSDAMER_CONTEXT_V214_GROUP = "WZB and Potsdamer park-side source facade accents v214";

/** Shallow additions only: retained shells, window detail, courts and roofs stay. */
export function createPotsdamerContextV214(native = false): Group {
  const root = new Group();
  root.name = POTSDAMER_CONTEXT_V214_GROUP + (native ? " native" : "");
  root.userData = {
    potsdamerContextV214: true, additiveOnly: true, sourceGeometryRetained: true,
    sourceOwnerIds: POTSDAMER_CONTEXT_V214_OWNER_IDS,
    fullStaticDetailOnTouch: true, textureFree: true, blockNative: native,
    nativeMinecraft: native, keepInMinecraft: native,
    sourceReceipt: "potsdamerContextV214Evidence.json",
    newCourtWalls: false, newPassageClosures: false,
  };
  const rows = native ? data.blocks : data.boxes;
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial();
  const night = new MeshStandardMaterial({ roughness: .82 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16);
  const colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), size = new Vector3(), tint = new Color();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(size.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1] + POTSDAMER_CONTEXT_V214_OFFSETS[r[native ? 8 : 9]], r[2]);
    matrix.toArray(matrices, i * 16);
    tint.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  }
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = "WZB pastel courses and sandstone frames; Rogers ceramic spandrels and metal rails";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: native, nativeMinecraft: native };
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

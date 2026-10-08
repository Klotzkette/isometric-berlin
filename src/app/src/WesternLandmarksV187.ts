import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/westLandmarksV187.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Landmark = (typeof data.groups)[number];
export const WESTERN_LANDMARKS_V187_GROUP = "Western landmarks: Funkturm, Olympic site and Citadel v187";

function surfaces(item: Landmark): Mesh {
  const length = item.surfaces.reduce((sum, s) => sum + s.triangles.length * 9, 0);
  const positions = new Float32Array(length), colors = new Float32Array(length), tint = new Color();
  let offset = 0;
  for (const s of item.surfaces) {
    tint.setHex(s.color);
    for (const t of s.triangles) for (const p of t) {
      positions.set(p, offset); tint.toArray(colors, offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .86, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.name = `${item.name}: retained source sheets and mapped grounds`;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, westLandmarksV187: true };
  return mesh;
}

function details(item: Landmark, native: boolean): InstancedMesh {
  const rows = native ? item.native : item.boxes;
  const rods = native ? [] : item.rods;
  const count = rows.length + rods.length;
  const cube = new BoxGeometry(1, 1, 1); cube.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .85, flatShading: true });
  const mesh = new InstancedMesh(cube, day, 0);
  const matrices = new Float32Array(count * 16), colors = new Float32Array(count * 3);
  const matrix = new Matrix4(), tint = new Color(), scale = new Vector3();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else { matrix.makeRotationY(r[6]); matrix.scale(scale.set(r[3], r[4], r[5])); }
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    tint.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  const a = new Vector3(), b = new Vector3(), up = new Vector3(0, 1, 0);
  const direction = new Vector3(), rotation = new Quaternion();
  rods.forEach((r, i) => {
    a.fromArray(r); b.fromArray(r, 3); direction.subVectors(b, a);
    const length = direction.length(); rotation.setFromUnitVectors(up, direction.normalize());
    matrix.compose(a.add(b).multiplyScalar(.5), rotation, scale.set(r[6], length, r[6]));
    matrix.toArray(matrices, (rows.length + i) * 16);
    tint.setHex(r[7]).toArray(colors, (rows.length + i) * 3);
  });
  mesh.count = count;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.name = `${item.name}: ${native ? "independent block surface interpretation" : "bounded steel and architectural details"}`;
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, keepInMinecraft: native, westLandmarksV187: true };
  return mesh;
}

function create(native: boolean): Group {
  const root = new Group();
  root.name = native ? `${WESTERN_LANDMARKS_V187_GROUP} native` : WESTERN_LANDMARKS_V187_GROUP;
  root.userData = { westLandmarksV187: true, textureFree: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    completeSourceOwners: true, photographedPixelsBundled: false };
  for (const item of data.groups) {
    const cell = new Group(); cell.name = item.name;
    cell.userData = { westLandmarksV187: true, anchor: item.anchor, keepInMinecraft: native };
    if (!native && item.surfaces.length) cell.add(surfaces(item));
    if (native ? item.native.length : item.boxes.length + item.rods.length) cell.add(details(item, native));
    root.add(cell);
  }
  return freezeStaticSceneTransforms(root);
}

/** Final-count independently culled models; only the selected mode is allocated. */
export function createWesternLandmarksV187(): Group { return create(false); }
export function createMinecraftWesternLandmarksV187(): Group { return create(true); }

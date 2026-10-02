import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry,
  DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/berlinWallMemorialV174Source.json";

export const BERLIN_WALL_MEMORIAL_V174_GROUP = "Bernauer Straße present-day memorial and museums";
export const BERLIN_WALL_MEMORIAL_V174_NATIVE_GROUP = "Bernauer Straße independent block-native memorial";

type Options = { mobileLike?: boolean };
type Sheet = { color: number; triangles: number[][][] };
export type BerlinWallMemorialV174DrawnData = {
  boxes: number[][];
  caps: number[][];
  surfaces: Sheet[];
};
export type BerlinWallMemorialV174NativeData = { rows: number[][] };
function materials(vertexColors = false) {
  return {
    dayMaterial: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    nightMaterial: new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: 0.92, flatShading: true }),
    textureFree: true,
  };
}

function instances(rows: readonly number[][], kind: "box" | "coping" | "native"): InstancedMesh {
  const geometry = kind === "coping" ? new CylinderGeometry(1, 1, 1, 12, 1) : new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const material = materials();
  // The zero-count constructor avoids a second, throwaway instance array.
  const mesh = new InstancedMesh(geometry, material.dayMaterial, 0);
  const matrices = new Float32Array(rows.length * 16);
  const colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  const cylinderAxis = new Matrix4().makeRotationZ(Math.PI / 2);
  rows.forEach((r, i) => {
    if (kind === "coping") {
      matrix.makeRotationY(r[5]).multiply(cylinderAxis).scale(scale.set(r[4], r[3], r[4]));
    } else if (kind === "native") matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(scale.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
    color.setHex(r[kind === "box" ? 7 : 6]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = kind === "coping" ? "Vorderlandmauer rounded concrete coping" : kind === "native" ? "Independent orthogonal memorial blocks" : "Mapped wall layers and bounded recognition members";
  mesh.userData = { ...material, blockNative: kind === "native" };
  return mesh;
}

function surfaces(rows: readonly Sheet[]): Mesh {
  const count = rows.reduce((n, s) => n + s.triangles.length * 9, 0);
  const positions = new Float32Array(count), colors = new Uint8Array(count);
  const color = new Color();
  let i = 0;
  for (const sheet of rows) {
    color.setHex(sheet.color);
    const r = Math.round(color.r * 255), g = Math.round(color.g * 255), b = Math.round(color.b * 255);
    for (const triangle of sheet.triangles) for (const point of triangle) {
      positions[i] = point[0]; positions[i + 1] = point[1]; positions[i + 2] = point[2];
      colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
      i += 3;
    }
  }
  const geometry = new BufferGeometry();
  // BufferAttribute owns these exact typed arrays, without constructor copies.
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3, true));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const material = materials(true), mesh = new Mesh(geometry, material.dayMaterial);
  mesh.name = "Complete official museum roof and wall planes plus enclosed memorial sand";
  mesh.userData = material;
  return mesh;
}

function root(native: boolean): Group {
  const group = new Group();
  group.name = native ? BERLIN_WALL_MEMORIAL_V174_NATIVE_GROUP : BERLIN_WALL_MEMORIAL_V174_GROUP;
  group.userData = {
    textureFree: true,
    fullStaticDetailOnTouch: true,
    blockNative: native,
    nativeMinecraft: native,
    keepInMinecraft: native,
    presentDayMemorial: true,
    northMitteV174: "bernauer",
    originalBorderReconstructedOutsideEnclosure: false,
  };
  return group;
}

/** Options do not reduce drawn touch detail; tests may supply a decoded packet. */
export function createBerlinWallMemorialV174(
  _options: Options = {},
  data: BerlinWallMemorialV174DrawnData = source,
): Group {
  const group = root(false);
  group.add(surfaces(data.surfaces), instances(data.boxes, "box"), instances(data.caps, "coping"));
  return freezeStaticSceneTransforms(group);
}

export function createMinecraftBerlinWallMemorialV174(
  _options: Options = {},
  data: BerlinWallMemorialV174NativeData = { rows: source.nativeRows },
): Group {
  const group = root(true);
  group.add(instances(data.rows, "native"));
  return freezeStaticSceneTransforms(group);
}

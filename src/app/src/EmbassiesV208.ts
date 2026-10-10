import {
  BoxGeometry, BufferAttribute, Color, CylinderGeometry, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/embassiesV208.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const EMBASSIES_V208_GROUP = "Russian Embassy and Aeroflot architectural refinements v208";
export const EMBASSIES_V208_SOURCE_IDS = data.sourceIds;
type Extra = { matrix: Matrix4; color: number };

/** Same static surface detail on touch/pointer; no texture or camera population. */
export function createEmbassiesV208(native = false): Group {
  const root = new Group(); root.name = EMBASSIES_V208_GROUP + (native ? " native" : "");
  root.userData = {
    sourceOwnerIds: EMBASSIES_V208_SOURCE_IDS, sourceReceipt: "embassies-v208-source.json",
    sourceGeometryRetained: true, facadeOnly: true, nativeMinecraft: native,
    keepInMinecraft: native, blockNative: native, textureFree: true,
    fullStaticDetailOnTouch: true, newCourtClosures: false,
    aeroflotAxes: 12, aeroflotFloors: 4,
    existingEmbassyFrontLanternFiguresFenceRetained: true,
  };
  const f = data.faces[data.aeroflotFrontFace];
  const base = 5.2, extra: Extra[] = [];
  const normal = f.outward, axis = f.direction;
  const reach = native ? f.nativeClearanceM : 0;
  const point = (u: number, y: number, out: number) => new Vector3(
    f.start[0] + axis[0] * u + normal[0] * (out + reach), y,
    f.start[1] + axis[1] * u + normal[1] * (out + reach),
  );
  const beam = (a: Vector3, b: Vector3, thickness: number, color: number) => {
    const delta = b.clone().sub(a), length = delta.length();
    if (length < 1e-5) return;
    if (native) {
      const steps = Math.ceil(length / .14);
      for (let i = 0; i < steps; i++) extra.push({ color,
        matrix: new Matrix4().makeScale(thickness, thickness, thickness)
          .setPosition(a.clone().lerp(b, (i + .5) / steps)) });
    } else extra.push({ color, matrix: new Matrix4().compose(
      a.clone().add(b).multiplyScalar(.5),
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.divideScalar(length)),
      new Vector3(thickness, length, thickness),
    ) });
  };
  for (const [u, y, cap, color] of [
    [7.0, base + 19.67, 1.55, 0x687273],
    [7.7, base + 3.83, .68, 0x25579b],
  ]) for (const path of letteringStrokePaths("AEROFLOT", cap)) {
    // The retained facade edge runs right-to-left for the street-side viewer.
    // Reverse only glyph X around each inscription's existing centre.
    for (let i = 1; i < path.length; i++) beam(
      point(u - path[i - 1][0], y + path[i - 1][1], .88),
      point(u - path[i][0], y + path[i][1], .88), cap * .105, color,
    );
  }
  for (let i = 0; i < 24; i++) {
    const u = 14 + i * .62;
    beam(point(u + .38, base + 21.14, .72), point(u, base + 20.50, .72), .085, 0x707878);
    beam(point(u, base + 20.50, .72), point(u + .38, base + 19.86, .72), .085, 0x707878);
  }
  const rows = native ? data.blocks : data.boxes;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const unitNormals = geometry.getAttribute("normal"), vertexColors = new Float32Array(unitNormals.count * 3);
  for (let i = 0; i < unitNormals.count; i++) {
    const shade = unitNormals.getY(i) > .5 ? 1 : unitNormals.getX(i) > .5 ? .9 : .96;
    vertexColors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(vertexColors, 3));
  const day = new MeshBasicMaterial({ vertexColors: true });
  const night = new MeshStandardMaterial({ vertexColors: true, roughness: .86 });
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array((rows.length + extra.length) * 16);
  const colors = new Float32Array((rows.length + extra.length) * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((r, i) => {
    // JSON rows are a compact mixed numeric/role format; no whole-data clone.
    const row = r as (number | string)[];
    if (native) matrix.makeScale(+row[3], +row[4], +row[5]);
    else matrix.makeRotationY(+row[6]).scale(scale.set(+row[3], +row[4], +row[5]));
    matrix.setPosition(+row[0], +row[1], +row[2]).toArray(matrices, i * 16);
    color.setHex(+row[native ? 6 : 7]).toArray(colors, i * 3);
  });
  extra.forEach((e, i) => {
    e.matrix.toArray(matrices, (rows.length + i) * 16);
    color.setHex(e.color).toArray(colors, (rows.length + i) * 3);
  });
  mesh.count = rows.length + extra.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = "Source-bound embassy return windows and twelve-axis Aeroflot stone and glass";
  mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night,
    nativeMinecraft: native, blockNative: native, existingSourceRetained: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  if (!native) {
    const geometry = new CylinderGeometry(.5, .5, 1, 24); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xe3dfcf });
    const night = new MeshStandardMaterial({ color: 0xe3dfcf, roughness: .85 });
    const collars = new InstancedMesh(geometry, day, data.cylinders.length);
    data.cylinders.forEach((r, i) => collars.setMatrixAt(i,
      matrix.makeScale(r[3], r[4], r[5]).setPosition(r[0], r[1], r[2])));
    collars.name = "Embassy colossal-column base and capital collars";
    collars.userData = { textureFree: true, dayMaterial: day, nightMaterial: night };
    collars.computeBoundingBox(); collars.computeBoundingSphere(); root.add(collars);
  }
  return freezeStaticSceneTransforms(root);
}

import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from "three";
import source from "./data/tuWaterV168Source.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const TU_WATER_V168_GROUP = "TU Berlin complete main building and Schleuseninsel Umlauftank 2";
export const TU_WATER_V168_NATIVE_GROUP = "TU Berlin and Umlauftank 2 independent native blocks";
export const TU_WATER_V168_RENDER_BUDGET = Object.freeze({
  sourceParents: source.parents.length, sourceParts: source.sourceParts.length,
  facadeInstances: source.facadeBoxes.length,
  nativeSourceRuns: source.nativeRows.length,
  nativeDetailInstances: source.nativeDetailRows.length,
  drawnBatches: 2, nativeBatches: 2,
});
type Surface = { color: number; triangles: number[][][] };

function surfacesMesh(surfaces: Surface[]): Mesh {
  const count = surfaces.reduce((n, s) => n + s.triangles.length * 9, 0);
  const positions = new Float32Array(count), colors = new Float32Array(count), color = new Color();
  let offset = 0;
  for (const s of surfaces) {
    color.setHex(s.color);
    for (const t of s.triangles) for (const p of t) {
      positions.set(p, offset); colors.set([color.r, color.g, color.b], offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .89, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
  return mesh;
}
function instances(rows: readonly number[][], native = false): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), color = new Color();
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  rows.forEach((r, i) => {
    matrix.makeRotationY(native ? 0 : r[6]); matrix.scale(new Vector3(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]); matrix.toArray(matrices, i * 16);
    color.setHex(r[native ? 6 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, nativeMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

function group(native: boolean): Group {
  const root = new Group(); root.name = native ? TU_WATER_V168_NATIVE_GROUP : TU_WATER_V168_GROUP;
  root.userData = {
    textureFree: true, fullStaticDetailOnTouch: true,
    sourcePartIds: source.sourceParts.map(p => p.id), places: ["TU Berlin Straße des 17. Juni 135", "Umlauftank 2 Schleuseninsel"],
    originalGeometryRetainedInEvidence: true, industrialSurveyCorrectionDocumented: true,
    openPipeLoop: true, nativeMinecraft: native, keepInMinecraft: native, blockNative: native,
    noHiddenSolidInfill: true,
  };
  if (native) {
    const shell = instances(source.nativeRows, true); shell.name = "Independent TU source skin and open UT2 pipe blocks";
    const detail = instances(source.nativeDetailRows, true); detail.name = "Orthogonal TU and VWS facade detail blocks";
    root.add(shell, detail);
  } else {
    const shell = surfacesMesh(source.surfaces); shell.name = "Complete measured TU and VWS walls roofs courtyards and corrected open UT2 structure";
    const detail = instances(source.facadeBoxes.map(r => r.slice(0, 8).map(Number))); detail.name = "TU aluminium ribbons sandstone arcades and VWS panel window details";
    root.add(shell, detail);
  }
  return freezeStaticSceneTransforms(root);
}
export function createTuWaterV168(_options: { mobileLike?: boolean } = {}): Group { return group(false); }
export function createMinecraftTuWaterV168(_options: { mobileLike?: boolean } = {}): Group { return group(true); }

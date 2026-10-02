import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry,
  DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import drawn from "./data/zionskircheV174Drawn.json";
import native from "./data/zionskircheV174Native.json";
import evidence from "./data/zionskircheV174Evidence.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { registerZionskircheV174NativeRoof, ZIONSKIRCHE_V174_PROFILE, ZIONSKIRCHE_V174_TERRAIN_OFFSET } from "./zionskircheV174Profile";

export const ZIONSKIRCHE_V174_GROUP = "Zionskirche additive Romanesque facade and 67 m masonry spire";
export const ZIONSKIRCHE_V174_NATIVE_GROUP = "Zionskirche independent native facade and tall masonry spire";
export const ZIONSKIRCHE_V174_RENDER_BUDGET = Object.freeze({
  drawnBatches: 3, nativeBatches: 1,
  triangles: evidence.drawnCounts.triangles,
  facadeInstances: evidence.drawnCounts.boxes,
  detailInstances: evidence.drawnCounts.rods,
  nativeBlocks: evidence.nativeBlocks,
});

function materials(vertexColors = false) {
  return {
    day: new MeshBasicMaterial({ color: 0xffffff, vertexColors, side: DoubleSide }),
    night: new MeshStandardMaterial({ color: 0xffffff, vertexColors, side: DoubleSide,
      roughness: .90, flatShading: true }),
  };
}

function surfaceMesh(): Mesh {
  const count = evidence.drawnCounts.triangles * 9;
  const positions = new Float32Array(count), colors = new Float32Array(count);
  const color = new Color(); let offset = 0;
  for (const surface of drawn.surfaces) {
    color.setHex(surface.color);
    for (const triangle of surface.triangles) for (const p of triangle) {
      positions.set(p, offset); color.toArray(colors, offset); offset += 3;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const { day, night } = materials(true);
  const mesh = new Mesh(geometry, day);
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, additiveOnly: true };
  return mesh;
}

function instances(rows: readonly number[][], kind: "box" | "rod" | "native"): InstancedMesh {
  const geometry = kind === "rod" ? new CylinderGeometry(1, 1, 1, 6, 1, false) : new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const { day, night } = materials();
  // Allocate the final buffers once; Three's constructor receives no throwaway capacity.
  const mesh = new InstancedMesh(geometry, day, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), color = new Color(), up = new Vector3(0, 1, 0);
  const position = new Vector3(), direction = new Vector3(), scale = new Vector3();
  const rotation = new Quaternion();
  rows.forEach((row, i) => {
    if (kind === "native") matrix.makeScale(row[4], row[6], row[7]).setPosition(row[0], row[1], row[2]);
    else if (kind === "box") {
      matrix.makeRotationY(row[6]).scale(scale.set(row[3], row[4], row[5]));
      matrix.setPosition(row[0], row[1], row[2]);
    } else {
      direction.set(row[3] - row[0], row[4] - row[1], row[5] - row[2]);
      const length = direction.length();
      rotation.setFromUnitVectors(up, direction.multiplyScalar(1 / length));
      position.set((row[0] + row[3]) / 2, (row[1] + row[4]) / 2, (row[2] + row[5]) / 2);
      matrix.compose(position, rotation, scale.set(row[6], length, row[6]));
    }
    matrix.toArray(matrices, i * 16);
    color.setHex(row[kind === "native" ? 3 : 7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
    blockNative: kind === "native", nativeMinecraft: kind === "native", additiveOnly: true };
  return mesh;
}

/** Identical complete static detail on touch and pointer; existing source stays. */
export function createZionskircheV174(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = ZIONSKIRCHE_V174_GROUP;
  root.position.y = ZIONSKIRCHE_V174_TERRAIN_OFFSET;
  root.userData = { northMitteV174: "zion", textureFree: true, additiveOnly: true, fullStaticDetailOnTouch: true,
    sourceEnvelopeRetained: true, sourceShellDuplicated: false,
    sourceParentId: ZIONSKIRCHE_V174_PROFILE.parentId,
    renderBudget: ZIONSKIRCHE_V174_RENDER_BUDGET };
  const panels = surfaceMesh(), boxes = instances(drawn.facadeBoxes, "box"), rods = instances(drawn.detailRods, "rod");
  panels.name = "Thin brick backing arched panes and missing octagonal masonry spire";
  boxes.name = "Zionskirche pale brick bands cornices pilasters and portal doors";
  rods.name = "Zionskirche paired belfry arches clocks galleries tracery ribs and cross";
  root.add(panels, boxes, rods);
  return freezeStaticSceneTransforms(root);
}

/** Native source skin stays beneath the independent orthogonal facade overlay. */
export function createMinecraftZionskircheV174(_options: { mobileLike?: boolean } = {}): Group {
  const root = new Group(); root.name = ZIONSKIRCHE_V174_NATIVE_GROUP;
  root.position.y = ZIONSKIRCHE_V174_TERRAIN_OFFSET;
  root.userData = { northMitteV174: "zion", textureFree: true, nativeMinecraft: true, blockNative: true,
    keepInMinecraft: true, additiveOnly: true, noHiddenSolidInfill: true,
    sourceEnvelopeRetained: true, sourceShellDuplicated: false,
    renderBudget: ZIONSKIRCHE_V174_RENDER_BUDGET };
  const blocks = native.blocks;
  registerZionskircheV174NativeRoof(blocks);
  const mesh = instances(blocks, "native");
  mesh.name = "Native Zionskirche round-arch steps clock marks cornices spire and cross";
  root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

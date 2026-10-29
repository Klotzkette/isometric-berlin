import { expect, test } from "bun:test";
import { Color, InstancedMesh, Matrix4, Quaternion, Raycaster, Vector3 } from "three";
import {
  createMinecraftArchitecturalLandmarks,
  MINECRAFT_ARCHITECTURAL_PROFILES,
} from "../src/MinecraftArchitecturalLandmarks";
import { MINECRAFT_ARCHITECTURAL_BLOCKS } from "../src/visual-modes/minecraft/palette";
import { disposeStaticAudit } from "./helpers/staticGeometryAudit";

const oldCount = 489;
const cue = "owner-photo west-wing glazing transoms";
const profile = MINECRAFT_ARCHITECTURAL_PROFILES.reichstag;
const frame = new Matrix4().makeRotationY(profile.rotationDegrees * Math.PI / 180)
  .setPosition(...profile.anchorWorld);
const inverse = frame.clone().invert();
const hash = (array: ArrayBufferView) => new Bun.CryptoHasher("sha256").update(array).digest("hex");

test("all 489 preceding Reichstag block matrices and colours remain byte-identical", () => {
  const root = createMinecraftArchitecturalLandmarks();
  const mesh = root.getObjectByName("Minecraft Reichstag block signature") as InstancedMesh;
  expect(mesh.count).toBe(493);
  expect(mesh.userData.cueCounts[cue]).toBe(4);
  expect(hash(mesh.instanceMatrix.array.subarray(0, oldCount * 16)))
    .toBe("01ee430495e4648e6b996a95c7b9b7e8f7bf6a1a80e83ff5fbf62a739e09337f");
  expect(hash(mesh.instanceColor!.array.subarray(0, oldCount * 3)))
    .toBe("587190c9985650dd6736738320ea708e964c891c673f2dfa3979a770bba3e418");
  disposeStaticAudit(root);
});

test("four independent orthogonal transoms meet the existing symmetrical west panes and remain visible", () => {
  const root = createMinecraftArchitecturalLandmarks();
  const mesh = root.getObjectByName("Minecraft Reichstag block signature") as InstancedMesh;
  root.updateMatrixWorld(true);
  const matrix = new Matrix4(), position = new Vector3(), size = new Vector3();
  const rotation = new Quaternion(), color = new Color();
  const zs = [-48, -32, 32, 48];
  const east = new Vector3(1, 0, 0).transformDirection(frame);
  for (const [offset, z] of zs.entries()) {
    const index = oldCount + offset;
    mesh.getMatrixAt(index, matrix);
    matrix.premultiply(inverse).decompose(position, rotation, size);
    expect(position.x).toBeCloseTo(-53.095, 4);
    expect(position.y).toBeCloseTo(9, 4);
    expect(position.z).toBeCloseTo(z, 4);
    expect(size.x).toBeCloseTo(.24, 4);
    expect(size.y).toBeCloseTo(.34, 4);
    expect(size.z).toBeCloseTo(7.2, 4);
    expect(rotation.angleTo(new Quaternion())).toBeLessThan(1e-6);
    // The unchanged pane is centred at -52.35 and is 1.25 m deep.
    expect(position.x + size.x / 2).toBeCloseTo(-52.35 - 1.25 / 2, 4);
    mesh.getColorAt(index, color);
    expect(color.getHex()).toBe(MINECRAFT_ARCHITECTURAL_BLOCKS.iron);
    const origin = new Vector3(-70, 9, z).applyMatrix4(frame);
    const first = new Raycaster(origin, east).intersectObject(mesh)[0];
    expect(first?.instanceId).toBe(index);
  }
  disposeStaticAudit(root);
});

test("photo additions reuse the seven existing batches and retain the unchanged 5500-instance ceiling", () => {
  const root = createMinecraftArchitecturalLandmarks();
  const meshes = root.children as InstancedMesh[];
  expect(meshes).toHaveLength(7);
  expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(1);
  expect(new Set(meshes.map(mesh => mesh.material)).size).toBe(1);
  expect(meshes.reduce((total, mesh) => total + mesh.count, 0)).toBe(5498);
  expect(root.userData.instanceBudget).toBe(5500);
  expect(meshes[0].instanceMatrix.array.byteLength + meshes[0].instanceColor!.array.byteLength).toBe(37_468);
  for (const mesh of meshes) {
    expect(mesh.userData.maxHorizontalSpanM).toBeLessThanOrEqual(8.001);
    expect(mesh.userData.maxNonStructuralVerticalSpanM).toBeLessThanOrEqual(8.001);
  }
  disposeStaticAudit(root);
});

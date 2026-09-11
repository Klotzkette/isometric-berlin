import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  Box3,
  Color,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Vector3,
} from "three";
import {
  BEBELPLATZ_FACADE_PROFILES,
  createBebelplatzFacades,
  createMinecraftBebelplatzFacades,
} from "../src/BebelplatzFacades";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import source from "../src/bebelplatzBuildingSource.json";

const ground = JSON.parse(
  readFileSync(
    new URL(
      "../public/mesh/regierungsviertel/ground-context.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as VoxelPayload;
function budget(root: Group) {
  let bytes = 0,
    instances = 0;
  const geometries = new Set<BufferGeometry>();
  for (const child of root.children) {
    expect(child).toBeInstanceOf(InstancedMesh);
    const mesh = child as InstancedMesh;
    expect(mesh.matrixAutoUpdate).toBeFalse();
    expect(mesh.frustumCulled).toBeTrue();
    expect(mesh.userData.dayMaterial.map).toBeNull();
    expect(mesh.userData.nightMaterial.map).toBeNull();
    expect(mesh.geometry.attributes.uv).toBeUndefined();
    expect(
      Array.from(mesh.instanceMatrix.array).every(Number.isFinite),
    ).toBeTrue();
    expect(mesh.instanceColor?.count).toBe(mesh.count);
    instances += mesh.count;
    bytes +=
      mesh.instanceMatrix.array.byteLength +
      (mesh.instanceColor?.array.byteLength ?? 0);
    if (!geometries.has(mesh.geometry)) {
      geometries.add(mesh.geometry);
      bytes += Object.values(mesh.geometry.attributes).reduce(
        (sum, a) => sum + a.array.byteLength,
        0,
      );
      bytes += mesh.geometry.index?.array.byteLength ?? 0;
    }
  }
  return { draws: root.children.length, instances, bytes };
}

describe("Bebelplatz and Humboldt source-bound facades", () => {
  test("binds the three facades to distinct metric parents and exact exterior axes", () => {
    const p = BEBELPLATZ_FACADE_PROFILES;
    expect(p.humboldt.lod2Parent).toBe(source.profiles.humboldt.parent_id);
    expect(p.hotel.lod2Parent).toBe(source.profiles.hotelDeRome.parent_id);
    expect(p.library.lod2Parent).toBe(source.profiles.alteBibliothek.parent_id);
    for (const axis of [
      p.humboldt.centralAxis,
      p.humboldt.westAxis,
      p.humboldt.eastAxis,
    ]) {
      expect(source.profiles.humboldt.parts[0].ring).toContainEqual(axis.start);
      expect(source.profiles.humboldt.parts[0].ring).toContainEqual(axis.end);
    }
    for (const v of [
      ...p.library.frontChain,
      p.library.centralAxis.start,
      p.library.centralAxis.end,
    ])
      expect(source.profiles.alteBibliothek.parts[0].ring).toContainEqual(v);
    expect(p.humboldt.mainBayCount).toBe(17);
    expect(p.humboldt.centralColumnCount).toBe(6);
    expect(p.hotel.columnCount).toBe(6);
    expect(
      Math.max(...p.library.northWing.map((p) => p[0])) -
        Math.min(...p.library.northWing.map((p) => p[0])),
    ).toBeGreaterThan(4);
  });
  test("keeps both styles finite, static and bounded without photographic assets", () => {
    const drawn = createBebelplatzFacades(ground),
      blocks = createMinecraftBebelplatzFacades(ground);
    const smoothBudget = budget(drawn),
      blockBudget = budget(blocks);
    console.log({ smoothBudget, blockBudget });
    expect(smoothBudget.draws).toBe(4);
    expect(smoothBudget.instances).toBeLessThan(3500);
    expect(smoothBudget.bytes).toBeLessThan(300000);
    expect(blockBudget.draws).toBe(1);
    expect(blockBudget.instances).toBeLessThan(900);
    expect(blockBudget.bytes).toBeLessThan(80000);
    expect(blocks.userData.keepInMinecraft).toBeTrue();
    expect(blocks.userData.blockNative).toBeTrue();
    const bounds = new Box3().setFromObject(drawn);
    expect(bounds.min.x).toBeGreaterThan(1430);
    expect(bounds.max.x).toBeLessThan(1555);
    expect(bounds.min.z).toBeGreaterThan(124);
    expect(bounds.max.z).toBeLessThan(379);
    expect(bounds.min.y).toBeGreaterThan(3.4);
    expect(bounds.max.y).toBeLessThan(31.5);
  });
  test("keeps the street gateway centre and court approach visibly open", () => {
    const root = createBebelplatzFacades(ground),
      matrix = new Matrix4(),
      position = new Vector3(),
      scale = new Vector3();
    const gate = BEBELPLATZ_FACADE_PROFILES.humboldt.gatewayAxis;
    const centreX = (gate.start[0] + gate.end[0]) / 2,
      centreZ = (gate.start[1] + gate.end[1]) / 2;
    for (const object of root.children) {
      const mesh = object as InstancedMesh;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        scale.setFromMatrixScale(matrix);
        if (Math.abs(position.z - centreZ) > 2 || position.y > 10) continue;
        expect(Math.abs(position.x - centreX) - scale.x / 2).toBeGreaterThan(
          2.8,
        );
      }
    }
  });
  test("keeps central hotel glazing outside the projecting official front", () => {
    const root = createBebelplatzFacades(ground),
      matrix = new Matrix4(),
      position = new Vector3(),
      color = new Color();
    const glass = new Color(0x526d75);
    const a = [1515.651, 372.724],
      dx = 1538.603 - a[0],
      dz = 370.811 - a[1],
      length = Math.hypot(dx, dz);
    let checked = 0;
    for (const object of root.children) {
      const mesh = object as InstancedMesh;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getColorAt(i, color);
        if (
          Math.abs(color.r - glass.r) +
            Math.abs(color.g - glass.g) +
            Math.abs(color.b - glass.b) >
          0.001
        )
          continue;
        mesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        if (
          position.x < 1516 ||
          position.x > 1538 ||
          position.z < 360 ||
          position.y > 24
        )
          continue;
        const signed =
          (dx * (position.z - a[1]) - dz * (position.x - a[0])) / length;
        expect(signed).toBeLessThan(-0.2);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
  test("uses cube-native Minecraft details without smooth geometry or slanted beam doubles", () => {
    const root = createMinecraftBebelplatzFacades(ground),
      mesh = root.children[0] as InstancedMesh;
    expect(mesh.geometry.getAttribute("position").count).toBe(24);
    const m = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      for (const entry of [1, 2, 4, 6, 8, 9]) expect(m.elements[entry]).toBe(0);
    }
    const text = readFileSync(
      new URL("../src/BebelplatzFacades.ts", import.meta.url),
      "utf8",
    );
    expect(text).not.toMatch(/TextureLoader|CanvasTexture|\.jpe?g|\.png/i);
  });
});

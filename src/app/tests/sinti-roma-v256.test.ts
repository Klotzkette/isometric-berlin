import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Box3, InstancedMesh, LineSegments, Matrix4, Mesh, Vector3 } from "three";
import { createMemorialLandmarks } from "../src/MemorialLandmarks";
import {
  SINTI_ROMA_PAVING_V256, SINTI_ROMA_V256,
  setSintiRomaMemorialPresentation,
} from "../src/SintiRomaMemorialV256";
import {
  SCHWELLENRAUM_PROTECTED_VOLUMES,
  isSchwellenraumProtectedObjectName,
} from "../src/SchwellenraumInteriors";
import receipt from "../../../geo_data/regierungsviertel/sinti-roma-v256-preservation.json";

const NAME = "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas";
const build = () => createMemorialLandmarks([{
  name: NAME, world: [SINTI_ROMA_V256.world[0], 8, SINTI_ROMA_V256.world[1]],
}]);

describe("v256 Sinti and Roma memorial", () => {
  test("retains all source geometry and every other authored memorial detail", () => {
    const source = readFileSync(new URL("../src/MemorialLandmarks.ts", import.meta.url), "utf8");
    for (const section of receipt.retainedAuthoredSections) {
      const start = source.indexOf(section.start);
      expect(start).toBeGreaterThan(0);
      const content = source.slice(start, source.indexOf(section.end, start));
      expect(createHash("sha256").update(content).digest("hex")).toBe(section.sha256);
    }
    for (const [path, sha] of Object.entries(receipt.retainedFiles)) {
      expect(createHash("sha256").update(readFileSync(new URL(`../../../${path}`, import.meta.url))).digest("hex")).toBe(sha);
    }
  });

  test("keeps the exact ground, still black pool, triangle and protected owner", () => {
    const root = build();
    expect(root.children).toHaveLength(1);
    expect(root.children[0].position.toArray()).toEqual([
      SINTI_ROMA_V256.world[0], 4.48, SINTI_ROMA_V256.world[1],
    ]);
    const water = root.getObjectByName("Sinti and Roma memorial black reflecting water") as Mesh;
    expect(new Box3().setFromObject(water).getSize(new Vector3()).x).toBeCloseTo(12);
    expect((water.material as any).color.getHex()).toBe(0x070d0d);
    expect(water.position.y).toBeCloseTo(0.76);
    const protectedVolume = SCHWELLENRAUM_PROTECTED_VOLUMES.find((v) => v.id === "protected-sinti-roma-memorial")!;
    expect(protectedVolume).toMatchObject({
      centerWorldM: [...SINTI_ROMA_V256.world], radiusM: 32, shape: "circle", minYM: -6, maxYM: 14,
    });
    root.traverse((object) => {
      if (object instanceof Mesh) expect(isSchwellenraumProtectedObjectName(object.name)).toBeTrue();
    });
  });

  test("draws all 237 fitted slabs with no intrusion into the retained pool", () => {
    const root = build();
    expect(SINTI_ROMA_PAVING_V256.shards.filter((s) => s.named)).toHaveLength(69);
    expect(SINTI_ROMA_PAVING_V256.shards.filter((s) => !s.named)).toHaveLength(168);
    for (const shard of SINTI_ROMA_PAVING_V256.shards) {
      for (const [x, z] of shard.ring) {
        expect(Math.hypot(x, z)).toBeGreaterThan(6.27);
        expect(Math.hypot(x, z)).toBeLessThan(9.55);
      }
    }
    let slabs = 0;
    root.traverse((object) => {
      if (object.userData.slabCount) {
        slabs += object.userData.slabCount;
        expect((object as Mesh).geometry.index).not.toBeNull();
      }
    });
    expect(slabs).toBe(237);
  });

  test("switches complete drawn/native families reversibly without smooth doubles", () => {
    const root = build();
    const drawn = root.getObjectByName("Sinti and Roma memorial complete drawn geometry")!;
    const native = root.getObjectByName("Sinti and Roma memorial independent native blocks")!;
    const matrices: number[][] = [];
    native.traverse((object) => {
      if (object instanceof InstancedMesh) matrices.push(Array.from(object.instanceMatrix.array));
    });
    for (const mode of [true, false, true, false]) {
      setSintiRomaMemorialPresentation(root, mode);
      expect(native.visible).toBe(mode);
      expect(drawn.visible).toBe(!mode);
    }
    let index = 0;
    native.traverse((object) => {
      if (object instanceof InstancedMesh) expect(Array.from(object.instanceMatrix.array)).toEqual(matrices[index++]);
    });
    expect(native.userData.slabBlockCounts).toHaveLength(237);
    expect(Math.min(...native.userData.slabBlockCounts)).toBeGreaterThan(0);
  });

  test("bounds exact shared mobile detail and orthogonal native geometry", () => {
    const root = build();
    const drawn = root.getObjectByName("Sinti and Roma memorial complete drawn geometry")!;
    const native = root.getObjectByName("Sinti and Roma memorial independent native blocks")!;
    let renderables = 0, stored = 0;
    drawn.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        renderables++;
        stored += object.geometry.getAttribute("position").count;
      }
    });
    expect(renderables).toBeLessThanOrEqual(SINTI_ROMA_V256.maxDrawnRenderableCount);
    expect(stored).toBeLessThanOrEqual(SINTI_ROMA_V256.maxDrawnStoredVertices);
    expect(native.children).toHaveLength(2);
    expect(native.userData.blockCount).toBeLessThanOrEqual(SINTI_ROMA_V256.maxNativeBlocks);
    const matrix = new Matrix4();
    native.traverse((object) => {
      if (!(object instanceof InstancedMesh)) return;
      expect(object.geometry.type).toBe("BoxGeometry");
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        for (const element of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[element]).toBe(0);
      }
    });
  });
});

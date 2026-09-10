import { describe, expect, test } from "bun:test";
import {
  InstancedMesh, Matrix4, MeshBasicMaterial, Raycaster, Vector3,
} from "three";
import { createMinecraftEconomicMinistryDetails } from "../src/EconomicMinistrySourceGeometry";

type RoofBlock = {
  position: [number, number, number];
  size: [number, number, number];
  sourceId: string;
  role: string;
  instance: number;
};
type RoofSeam = {
  lower: RoofBlock;
  upper: RoofBlock;
  position: Vector3;
  direction: Vector3;
};

function roofTop(block: RoofBlock): number {
  return block.position[1] + block.size[1] / 2;
}

/** Find a real adjoining pair; the render matrices, not this metadata, are raycast. */
function findSeam(blocks: RoofBlock[], adaptive: boolean): RoofSeam | undefined {
  for (const lower of blocks) {
    for (const upper of blocks) {
      if (roofTop(upper) - roofTop(lower) < 1) continue;
      if ((Math.abs(lower.size[0] - upper.size[0]) > 0.01) !== adaptive) continue;
      for (const axis of [0, 2] as const) {
        const other = axis === 0 ? 2 : 0;
        const direction = Math.sign(upper.position[axis] - lower.position[axis]);
        const lowEdge = lower.position[axis] + direction * lower.size[axis] / 2;
        const highEdge = upper.position[axis] - direction * upper.size[axis] / 2;
        if (Math.abs(lowEdge - highEdge) > 1e-5) continue;
        const from = Math.max(
          lower.position[other] - lower.size[other] / 2,
          upper.position[other] - upper.size[other] / 2,
        );
        const to = Math.min(
          lower.position[other] + lower.size[other] / 2,
          upper.position[other] + upper.size[other] / 2,
        );
        if (to - from < 0.15) continue;
        const position = new Vector3();
        position.setComponent(axis, lowEdge - direction * 0.04);
        position.setComponent(other, (from + to) / 2);
        position.y = roofTop(lower) + 0.16;
        const rayDirection = new Vector3(0, -0.03, 0);
        rayDirection.setComponent(axis, direction);
        return { lower, upper, position, direction: rayDirection.normalize() };
      }
    }
  }
}

describe("Minecraft ministry roof steps form a closed surface", () => {
  for (const mobileLike of [false, true]) {
    test(`${mobileLike ? "mobile" : "full"}: oblique rays hit regular and adaptive roof risers`, () => {
      const root = createMinecraftEconomicMinistryDetails(undefined, {
        mobileLike, diagnostics: true,
      });
      const rendered = root.children[0] as InstancedMesh;
      expect(rendered).toBeInstanceOf(InstancedMesh);
      const blocks: RoofBlock[] = root.userData.blocks
        .map((block: RoofBlock, instance: number) => ({ ...block, instance }))
        .filter((block: RoofBlock) =>
          block.sourceId === "yAAWS2KQ" && block.role === "source roof surface block");
      const isolated = new InstancedMesh(
        rendered.geometry.clone(), new MeshBasicMaterial(), 2,
      );
      const matrix = new Matrix4();
      try {
        for (const adaptive of [false, true]) {
          const seam = findSeam(blocks, adaptive);
          expect(seam, `adaptive: ${adaptive}`).toBeDefined();
          if (!seam) continue;
          // Only these two actual roof instances are present. Facade walls,
          // the lower podium and another roof cannot conceal an open riser.
          for (const [i, block] of [seam.lower, seam.upper].entries()) {
            rendered.getMatrixAt(block.instance, matrix);
            isolated.setMatrixAt(i, matrix);
          }
          isolated.computeBoundingBox();
          isolated.computeBoundingSphere();
          isolated.updateMatrixWorld(true);
          const ray = new Raycaster(seam.position, seam.direction, 0, 0.12);
          const hits = ray.intersectObject(isolated);
          expect(hits.length, `adaptive: ${adaptive}`).toBeGreaterThan(0);
          expect(hits[0].instanceId).toBe(1);

          // Recreate the former 0.64 m roof sheets without changing either
          // top or footprint. The same ray must pass through the old gap.
          for (const [i, block] of [seam.lower, seam.upper].entries()) {
            matrix.makeScale(block.size[0], 0.64, block.size[2]);
            matrix.setPosition(block.position[0], roofTop(block) - 0.32, block.position[2]);
            isolated.setMatrixAt(i, matrix);
          }
          isolated.computeBoundingBox();
          isolated.computeBoundingSphere();
          expect(ray.intersectObject(isolated)).toHaveLength(0);
        }
      } finally {
        isolated.geometry.dispose();
        (isolated.material as MeshBasicMaterial).dispose();
        rendered.geometry.dispose();
        (rendered.material as MeshBasicMaterial).dispose();
      }
    });
  }
});

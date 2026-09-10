import { describe, expect, test } from "bun:test";
import { Raycaster, Vector3 } from "three";
import {
  ECONOMIC_MINISTRY_SOURCE,
  createEconomicMinistrySourceGeometry,
  economicMinistryContains,
} from "../src/EconomicMinistrySourceGeometry";
import {
  compilePedestrianObstacles,
  pedestrianPointIsBlocked,
} from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";

const modes: VisualMode[] = [
  "day", "night", "snowstorm", "schwellenraum", "minecraft",
];

describe("economic ministry collision follows local eaves", () => {
  for (const [id, edge] of [
    ["yAAWS2KQ", 5],
    ["K0000EU2", 3],
  ] as const) {
    test(`${id}: a capsule beside the eave clears the roof below its distant ridge`, () => {
      const part = ECONOMIC_MINISTRY_SOURCE.prisms.find(p => p.id === id)!;
      const a = part.ring[edge];
      const b = part.ring[(edge + 1) % part.ring.length];
      const area = part.ring.reduce((sum, p, i) => {
        const q = part.ring[(i + 1) % part.ring.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const length = Math.hypot(dx, dz);
      const nx = (dz / length) * Math.sign(area);
      const nz = (-dx / length) * Math.sign(area);
      const edgeX = (a[0] + b[0]) / 20;
      const edgeZ = (a[1] + b[1]) / 20;
      const outsideX = edgeX + nx * 0.2;
      const outsideZ = edgeZ + nz * 0.2;
      expect(economicMinistryContains(part, outsideX, outsideZ)).toBeFalse();

      // The visible source mesh supplies the local height, independently of
      // the collision callback whose outside-footprint fallback regressed.
      // Sample beyond the 0.071 m maximum decimetre-plan rounding error so
      // the ray hits this wing's roof, not the separate low podium below.
      const root = createEconomicMinistrySourceGeometry();
      root.updateMatrixWorld(true);
      const hits = new Raycaster(
        new Vector3(edgeX - nx * 0.12, 50, edgeZ - nz * 0.12),
        new Vector3(0, -1, 0), 0, 50,
      ).intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0);
      const localRoofY = hits[0].point.y;
      expect(localRoofY).toBeGreaterThan(id === "yAAWS2KQ" ? 19 : 15.5);
      const aboveEaveY = localRoofY + 0.8;
      const belowEaveY = localRoofY - 1;
      const sourceTop = (part.y0_dm + part.h_dm) / 10;
      expect(aboveEaveY).toBeLessThan(sourceTop - 2);

      for (const mode of modes) {
        const index = compilePedestrianObstacles({ buildings: [part] }, () => mode);
        expect(pedestrianPointIsBlocked(outsideX, outsideZ, aboveEaveY, index), mode).toBeFalse();
        expect(pedestrianPointIsBlocked(outsideX, outsideZ, belowEaveY, index), mode).toBeTrue();
        expect(pedestrianPointIsBlocked(
          edgeX + nx * 0.8, edgeZ + nz * 0.8, belowEaveY, index,
        ), mode).toBeFalse();
      }

      // Reproduce the old premature maximum-height fallback: it must block
      // this same otherwise-clear capsule, proving the regression's trigger.
      const legacy = compilePedestrianObstacles({ buildings: [part] });
      for (const obstacle of new Set([...legacy.cells.values()].flat())) {
        if (obstacle.kind !== "polygon" || !obstacle.topAt) continue;
        const actualTopAt = obstacle.topAt;
        obstacle.topAt = (x, z) => actualTopAt(x, z) ?? sourceTop;
      }
      expect(pedestrianPointIsBlocked(outsideX, outsideZ, aboveEaveY, legacy)).toBeTrue();
    });
  }
});

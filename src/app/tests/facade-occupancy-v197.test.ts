import { describe, expect, test } from "bun:test";
import source from "../public/mesh/regierungsviertel/lod2-prisms.json";
import {
  chariteHistoricFacadeExposure, createChariteHistoricFacades,
  createMinecraftChariteHistoricFacades,
} from "../src/ChariteHistoricFacades";
import { chariteContainsRing, chariteRingWalls } from "../src/HistoricChariteCampus";
import {
  createHumboldthafenBuildingDetails, planHumboldthafenBuildingDetails,
} from "../src/HumboldthafenBuildings";
import baseline from "./fixtures/facade-occupancy-v197-baseline.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

type Part = Parameters<typeof chariteHistoricFacadeExposure>[0][number];
type Wall = Parameters<ReturnType<typeof chariteHistoricFacadeExposure>>[1];
const sha = (value: unknown) => new Bun.CryptoHasher("sha256")
  .update(JSON.stringify(value)).digest("hex");

// Deliberately independent, allocation-heavy reference from the released
// algorithm. No bounding boxes/candidate caches share code with the fast path.
function referenceExposed(parts: readonly Part[], part: Part, wall: Wall,
  u: number, y: number, width = 0, height = 0): boolean {
  for (const du of [-width / 2, 0, width / 2]) for (const dy of [-height / 2, height / 2]) {
    const x = wall.x1 + wall.dirX * (u + du) + wall.nx * .38;
    const z = wall.z1 + wall.dirZ * (u + du) + wall.nz * .38;
    const yy = y + dy;
    if (parts.some(other => other.id !== part.id &&
      yy >= other.y0_dm / 10 && yy <= (other.y0_dm + other.h_dm) / 10 &&
      chariteContainsRing(other.ring, x, z) &&
      !(other.holes ?? []).some(hole => chariteContainsRing(hole, x, z)))) return false;
  }
  return true;
}

describe("lossless per-wall facade occupancy acceleration", () => {
  test("retains the complete production source inventory", () => {
    expect(source.buildings.length).toBe(baseline.sourceParts);
    expect(sha(source)).toBe(baseline.sourceHash);
  });

  for (const native of [false, true]) for (const mobile of [false, true]) {
    const profile = mobile ? "mobile" : "full", family = native ? "native" : "drawn";
    test(`Charité ${family}/${profile}: every ordered record and submitted buffer matches pre-optimization`, () => {
      const root = (native ? createMinecraftChariteHistoricFacades : createChariteHistoricFacades)(source, profile, true);
      try {
        const actual = {
          records: root.userData.facadeRecords.length,
          recordHash: sha(root.userData.facadeRecords), ...staticGeometryAudit(root),
        };
        expect(actual).toEqual(baseline.cases[`charite/${family}/${profile}`]);
      } finally { disposeStaticAudit(root); }
    });
    test(`Humboldthafen ${family}/${profile}: all ordered fittings and geometry match pre-optimization`, () => {
      const records = planHumboldthafenBuildingDetails(source.buildings, native, mobile);
      const root = createHumboldthafenBuildingDetails(source, { minecraft: native, mobileLike: mobile });
      try {
        expect({ records: records.length, recordHash: sha(records), ...staticGeometryAudit(root) })
          .toEqual(baseline.cases[`harbour/${family}/${profile}`]);
      } finally { disposeStaticAudit(root); }
      expect(sha(source)).toBe(baseline.sourceHash);
    });
  }

  test("cached candidates preserve exact holes, heights and queries beyond both wall ends", () => {
    for (const reverse of [false, true]) {
      const subject: Part = { id: "subject", ring: [[0, 0], [100, 0], [100, 100], [0, 100]], y0_dm: 0, h_dm: 100 };
      const neighbour: Part = { id: "neighbour", ring: [[-100, -100], [200, -100], [200, 200], [-100, 200]],
        holes: [[[-20, -20], [120, -20], [120, 120], [-20, 120]]], y0_dm: 40, h_dm: 60 };
      const remote: Part = { id: "remote", ring: [[290, -10], [310, -10], [310, 110], [290, 110]], y0_dm: -20, h_dm: 160 };
      const duplicateId: Part = { ...neighbour, id: "subject", holes: undefined };
      if (reverse) for (const part of [subject, neighbour, remote]) {
        part.ring.reverse(); for (const hole of part.holes ?? []) hole.reverse();
      }
      const parts = [subject, neighbour, remote, duplicateId];
      const expose = chariteHistoricFacadeExposure(parts);
      for (const wall of chariteRingWalls(subject.ring)) {
        for (const u of [5, 30, -10, 0, 10, 5]) for (const width of [0, 1.6, 20, 60]) {
          for (const y of [-2, 0, 4, 10, 14]) for (const height of [0, 2.6, 40]) {
            expect(expose(subject, wall, u, y, width, height))
              .toBe(referenceExposed(parts, subject, wall, u, y, width, height));
          }
        }
        // The public tester must also invalidate its owner exclusion when the
        // same wall object is queried on behalf of a different source part.
        for (const part of [neighbour, subject, remote, subject]) {
          expect(expose(part, wall, 5, 6, 2.4, 3.6))
            .toBe(referenceExposed(parts, part, wall, 5, 6, 2.4, 3.6));
        }
      }
    }
  });
});

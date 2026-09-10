import { describe, expect, test } from "bun:test";
import { InstancedMesh, Raycaster, Vector3 } from "three";
import {
  INVALIDENFRIEDHOF_DETAIL_PROFILE,
  createMinecraftInvalidenfriedhofDetails,
} from "../src/InvalidenfriedhofDetails";
import { NORTHERN_CITY_PROFILE } from "../src/expandedCityProfiles";

describe("Invalidenfriedhof mapped grave coverage in Minecraft", () => {
  const replaced = Object.values(
    INVALIDENFRIEDHOF_DETAIL_PROFILE.graves,
  ).flatMap((grave) => [
    grave.sourcePointWorldM,
    ...("absorbedGenericSourcePointsWorldM" in grave
      ? grave.absorbedGenericSourcePointsWorldM
      : []),
  ]);
  const ordinaryGraves =
    NORTHERN_CITY_PROFILE.invalidenfriedhof.graveWorldM.filter(
      ([x, z]) => !replaced.some(([gx, gz]) => gx === x && gz === z),
    );

  test.each([false, true])(
    "keeps every retained ordinary grave at its source anchor (mobile: %s)",
    (mobileLike) => {
      expect(ordinaryGraves).toHaveLength(29);
      const root = createMinecraftInvalidenfriedhofDetails({ mobileLike });
      root.updateMatrixWorld(true);
      const ground = INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY;
      for (const [x, z] of ordinaryGraves) {
        const hits = new Raycaster(
          new Vector3(x, ground + 2, z),
          new Vector3(0, -1, 0),
          0,
          2,
        ).intersectObject(root, true);
        expect(hits.length, `grave at ${x}, ${z}`).toBeGreaterThan(0);
        expect(hits[0].object).toBeInstanceOf(InstancedMesh);
        expect((hits[0].object as InstancedMesh).geometry.type).toBe("BoxGeometry");
        expect(hits[0].point.y).toBeGreaterThan(ground + 0.7);
        expect(hits[0].point.y).toBeLessThan(ground + 1.4);
      }
      expect(root.userData.mappedOrdinaryGraveCount).toBe(ordinaryGraves.length);
      expect(root.userData.drawCallCount).toBe(11);
    },
  );
});

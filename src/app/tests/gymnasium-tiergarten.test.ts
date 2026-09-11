import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh } from "three";
import {
  createGymnasiumTiergartenNeubau,
  createHandMitUhr,
} from "../src/GymnasiumTiergartenNeubau";
import {
  GYMNASIUM_NEUBAU_PARTS,
  GYMNASIUM_NEUBAU_SOURCE as source,
  HAND_MIT_UHR_PROFILE,
  GYMNASIUM_AULA_IDS,
  handMitUhrSolidAt,
  isGymnasiumNeubauReplacementColumn,
} from "../src/gymnasiumTiergartenProfile";

describe("Gymnasium Tiergarten Neubau and Hand mit Uhr", () => {
  test("all thirteen official parts retain their complete planes with only a rigid ground translation", () => {
    expect(GYMNASIUM_NEUBAU_PARTS).toHaveLength(13);
    expect(GYMNASIUM_AULA_IDS.size).toBe(3);
    for (const p of GYMNASIUM_NEUBAU_PARTS) {
      const original = source.parts.find((q) => q.id === p.id)!;
      expect(p.ring).toEqual(original.ring);
      expect(p.top_y_m - p.ground_y_m).toBeCloseTo(
        original.top_y_m - original.ground_y_m,
        6,
      );
      expect(p.ground_y_m).toBeCloseTo(5.2, 6);
      expect(p.surfaces).toEqual(
        original.surfaces.map((s) => ({
          ...s,
          rings: s.rings.map((r) =>
            r.map(([x, y, z]) => [x, y + source.display_y_translation_m, z]),
          ),
        })),
      );
    }
    expect(isGymnasiumNeubauReplacementColumn(-2155, -130)).toBeTrue();
    expect(isGymnasiumNeubauReplacementColumn(-2147.5, -78.7)).toBeFalse();
    expect(isGymnasiumNeubauReplacementColumn(-2040, -18)).toBeFalse();
  });
  test("the hand owns its existing OSM node, and only its narrow represented solid blocks movement", () => {
    expect(HAND_MIT_UHR_PROFILE.osmKey).toBe("node/5140418371");
    expect(handMitUhrSolidAt(-2147.5, 6, -78.7)).toBeTrue();
    for (const [x, z] of [
      [-2144, -78.7],
      [-2151, -78.7],
      [-2147.5, -74],
      [-2147.5, -83],
    ])
      expect(handMitUhrSolidAt(x, 6, z, 0.3)).toBeFalse();
    expect(handMitUhrSolidAt(-2147.5, 10, -78.7)).toBeFalse();
  });
  for (const minecraft of [false, true])
    test(`bounded static texture-free source architecture (${minecraft})`, () => {
      const before = JSON.stringify(source),
        root = createGymnasiumTiergartenNeubau(minecraft);
      root.updateMatrixWorld(true);
      let calls = 0,
        bytes = 0,
        instances = 0;
      root.traverse((o) => {
        expect(o.matrixAutoUpdate).toBeFalse();
        if (!(o instanceof Mesh)) return;
        calls++;
        for (const a of Object.values(o.geometry.attributes)) {
          bytes += a.array.byteLength;
          expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
        }
        if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
        if (o instanceof InstancedMesh) {
          instances += o.count;
          bytes +=
            o.instanceMatrix.array.byteLength +
            (o.instanceColor?.array.byteLength ?? 0);
        }
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          expect((m as any).map == null).toBeTrue();
      });
      expect(calls).toBeLessThanOrEqual(minecraft ? 2 : 4);
      expect(bytes).toBeLessThan(900_000);
      expect(instances).toBeLessThan(9000);
      expect(JSON.stringify(source)).toBe(before);
      const hand = createHandMitUhr(minecraft);
      hand.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(hand);
      expect(hand.userData.fingerCount).toBe(5);
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(4.5, 2);
      console.log({ minecraft, calls, bytes, instances });
    });
});

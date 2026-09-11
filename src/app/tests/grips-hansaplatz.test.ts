import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createGripsHansaplatz } from "../src/GripsHansaplatz";
import {
  GRIPS_HANSAPLATZ_SOURCE as source,
  GRIPS_HANSAPLATZ_PARTS as parts,
  GRIPS_ENTRANCE,
  GRIPS_ARCADE_POSTS,
  gripsAxisPoint,
  gripsHansaplatzSolidAt,
  GRIPS_HANSAPLATZ_PRISM_IDS,
  gripsHansaplatzRoofAt,
  isGripsHansaplatzReplacementColumn,
} from "../src/gripsHansaplatzProfile";
import {
  compilePedestrianObstacles,
  pedestrianPointIsBlocked,
} from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";

describe("GRIPS and the compact Hansaplatz court", () => {
  test("source roofs and heights survive the explicit open-arcade correction", () => {
    expect(parts).toHaveLength(31);
    expect(GRIPS_HANSAPLATZ_PRISM_IDS.size).toBe(31);
    for (const part of parts) {
      const building = source.buildings.find(
        (b) => b.parent_id === part.parentId,
      )!;
      const original = building.parts.find((p) => p.id === part.id)!;
      expect(part.ring).toEqual(original.ring);
      expect(part.holes).toEqual(original.holes);
      expect(part.top_y_m).toBeCloseTo(
        original.top_y_m + building.display_y_translation_m,
        6,
      );
      if (part.openBelow) expect(part.ground_y_m).toBeGreaterThan(8);
      else
        expect(part.top_y_m - part.ground_y_m).toBeCloseTo(
          original.top_y_m - original.ground_y_m,
          6,
        );
      expect(part.surfaces.filter((s) => s.kind === "RoofSurface")).toEqual(
        original.surfaces
          .filter((s) => s.kind === "RoofSurface")
          .map((s) => ({
            ...s,
            rings: s.rings.map((r) =>
              r.map(([x, y, z]) => [
                x,
                y + building.display_y_translation_m,
                z,
              ]),
            ),
          })),
      );
    }
    expect(isGripsHansaplatzReplacementColumn(-2040, -18)).toBeTrue();
    for (const [x, z] of [
      [-2000, -23],
      [-1988, -2],
      [-2040, 30],
      [-2100, -20],
    ])
      expect(isGripsHansaplatzReplacementColumn(x, z)).toBeFalse();
  });

  test("the standing capsule can traverse both courts, covered links and U9 approaches", () => {
    const payload = {
      buildings: source.previous_display_prisms,
    } as PrismPayload;
    const index = compilePedestrianObstacles(payload);
    const access = { interiorSolidAt: gripsHansaplatzSolidAt };
    for (const [x, z] of [
      [-2014.4, -23],
      [-2000, -23],
      [-1988, -2],
      [-2024.5, -42],
    ])
      expect(pedestrianPointIsBlocked(x, z, 5.2, index, access)).toBeFalse();
    for (const path of source.osm_paths.filter((p) =>
      [
        "way/392577199",
        "way/271846981",
        "way/392577198",
        "way/1332848648",
        "way/1332848649",
      ].includes(p.osm_key),
    )) {
      const [a, b] = path.points;
      for (let i = 0; i <= 16; i++) {
        const x = a[0] + ((b[0] - a[0]) * i) / 16,
          z = a[1] + ((b[1] - a[1]) * i) / 16;
        expect(
          pedestrianPointIsBlocked(x, z, 5.2, index, access),
          `${path.osm_key} ${x},${z}`,
        ).toBeFalse();
      }
    }
    expect(pedestrianPointIsBlocked(-2040, -18, 5.2, index, access)).toBeTrue();
    for (const [x, z, top] of GRIPS_ARCADE_POSTS)
      expect(gripsHansaplatzSolidAt(x, top - 0.1, z)).toBeTrue();
  });

  for (const minecraft of [false, true])
    test(`visible foyer, open courts, finite static batches (${minecraft})`, () => {
      const before = JSON.stringify(source),
        root = createGripsHansaplatz(minecraft);
      root.updateMatrixWorld(true);
      let bytes = 0,
        instances = 0;
      root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        expect(o.matrixAutoUpdate).toBeFalse();
        expect(o.userData.dayMaterial.map).toBeNull();
        expect(o.userData.nightMaterial.map).toBeNull();
        for (const a of Object.values(o.geometry.attributes)) {
          expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
          bytes += a.array.byteLength;
        }
        bytes += o.geometry.index?.array.byteLength ?? 0;
        if (o instanceof InstancedMesh) {
          instances += o.count;
          bytes +=
            o.instanceMatrix.array.byteLength +
            (o.instanceColor?.array.byteLength ?? 0);
          expect(
            Array.from(o.instanceMatrix.array).every(Number.isFinite),
          ).toBeTrue();
          if (minecraft) expect(o.geometry.attributes.position.count).toBe(24);
        }
      });
      console.log({ minecraft, draws: root.children.length, instances, bytes });
      expect(root.children).toHaveLength(minecraft ? 1 : 2);
      expect(bytes).toBeLessThan(minecraft ? 360000 : 250000);
      expect(instances).toBeLessThan(7500);
      expect(root.userData.hiddenSolidInfill).toBeFalse();
      expect(JSON.stringify(source)).toBe(before);
      const bounds = new Box3().setFromObject(root);
      expect(bounds.min.x).toBeGreaterThan(-2064);
      expect(bounds.max.x).toBeLessThan(-1926);
      expect(bounds.min.z).toBeGreaterThan(-68);
      expect(bounds.max.z).toBeLessThan(12);
      expect(bounds.max.y).toBeLessThan(20.32); // Retained narrow eastern service chimney.
      for (const [x, z] of [
        [-2000, -23],
        [-1988, -2],
      ]) {
        const hits = new Raycaster(
          new Vector3(x, 40, z),
          new Vector3(0, -1, 0),
        ).intersectObject(root, true);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeLessThan(5.26);
      }
      // Look at the actual east foyer from the covered gallery, below its roof.
      const origin = new Vector3(
        ...gripsAxisPoint(GRIPS_ENTRANCE, 5, 6.7, 2.2),
      );
      const target = new Vector3(...gripsAxisPoint(GRIPS_ENTRANCE, 5, 6.7));
      const hit = new Raycaster(
        origin,
        target.sub(origin).normalize(),
      ).intersectObject(root, true)[0];
      expect(hit.object.name).toContain("GRIPS glazing");
      expect(hit.distance).toBeLessThan(2.1);
      if (!minecraft) {
        const x = -2040,
          z = -18,
          top = Math.max(
            ...parts.map((p) => gripsHansaplatzRoofAt(p, x, z) ?? -Infinity),
          );
        const roof = new Raycaster(
          new Vector3(x, 40, z),
          new Vector3(0, -1, 0),
        ).intersectObject(root, true)[0];
        expect(roof.point.y).toBeCloseTo(top, 3);
      }
    });
});

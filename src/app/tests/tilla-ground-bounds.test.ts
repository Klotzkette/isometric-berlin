import { expect, test } from "bun:test";
import {
  createTillaDurieuxGroundTester,
  isTillaDurieuxLawn,
  type SurfacePayload,
} from "../src/IsometricCityWorld";
import { pointInWorldRing } from "../src/chancelleryExtensionProfile";
import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";

test("bounded Tilla lookup preserves the original polygon test including edges", () => {
  const payload = surfacePayload as unknown as SurfacePayload;
  const inside = createTillaDurieuxGroundTester(payload);
  const rings = payload.parks.filter(isTillaDurieuxLawn).map((surface) =>
    surface.ring.map(([x, z]) => [x / 10, z / 10] as [number, number]),
  );
  const check = (x: number, z: number): void => {
    expect(inside(x, z)).toBe(rings.some((ring) => pointInWorldRing(x, z, ring)));
  };
  for (let x = 90; x < 360; x += 2.5) {
    for (let z = 1_180; z < 1_660; z += 2.5) check(x, z);
  }
  for (const ring of rings) {
    for (const [x, z] of ring) {
      check(x, z);
      check(x + 1e-7, z);
      check(x - 1e-7, z);
    }
  }
  check(-6_450, -6_450);
  check(6_450, 6_450);
  expect(createTillaDurieuxGroundTester({ ...payload, parks: [] })(250, 1314)).toBeFalse();
});

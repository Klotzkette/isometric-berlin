import { expect, test } from "bun:test";
import { pointInDistrictStreetScope } from "../src/districtStreetScope";
import { DISTRICT_STREET_SCOPE_RINGS_M } from "../src/districtStreetScopeData";
import parkDetails from "../public/mesh/regierungsviertel/park-details.json";

const bounds = DISTRICT_STREET_SCOPE_RINGS_M.map(ring => ({
  ring,
  minX: Math.min(...ring.map(([x]) => x)), maxX: Math.max(...ring.map(([x]) => x)),
  minZ: Math.min(...ring.map(([, z]) => z)), maxZ: Math.max(...ring.map(([, z]) => z)),
}));

/** The previous unaccelerated predicate, including its strict boundary rules. */
function reference(x: number, z: number): boolean {
  for (const scope of bounds) {
    if (x < scope.minX || x > scope.maxX || z < scope.minZ || z > scope.maxZ) continue;
    let inside = false;
    const ring = scope.ring;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[j];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

function verify(x: number, z: number): void {
  expect(pointInDistrictStreetScope(x, z), `scope point ${x}, ${z}`).toBe(reference(x, z));
}

const floats = new Float64Array(1), bits = new BigUint64Array(floats.buffer);
function adjacent(value: number, direction: -1 | 1): number {
  if (value === 0) return direction * Number.MIN_VALUE;
  floats[0] = value;
  bits[0] += (value > 0) === (direction > 0) ? 1n : -1n;
  return floats[0];
}

test("Z edge bins match the original predicate on the dense map and actual park path points", () => {
  // Both positive and negative exact 64 m bin boundaries occur in this grid.
  for (let x = -3_008; x <= 2_688; x += 32) {
    for (let z = -2_048; z <= 1_824; z += 32) verify(x, z);
  }
  for (const path of parkDetails.paths) {
    for (const [x, , z] of path.points) verify(x, z);
  }
});

test("all source vertices, adjacent IEEE values and edge interiors keep exact boundary semantics", () => {
  const source = JSON.stringify(DISTRICT_STREET_SCOPE_RINGS_M);
  for (const ring of DISTRICT_STREET_SCOPE_RINGS_M) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, z] = ring[i], [bx, bz] = ring[j];
      for (const testX of [adjacent(x, -1), x, adjacent(x, 1)]) {
        for (const testZ of [adjacent(z, -1), z, adjacent(z, 1)]) verify(testX, testZ);
      }
      for (const t of [.25, .5, .75]) {
        const midX = x + (bx - x) * t, midZ = z + (bz - z) * t;
        verify(midX, midZ);
        verify(adjacent(midX, -1), adjacent(midZ, -1));
        verify(adjacent(midX, 1), adjacent(midZ, 1));
      }
    }
  }
  expect(JSON.stringify(DISTRICT_STREET_SCOPE_RINGS_M)).toBe(source);
});

test("deterministic random samples and nonfinite/outside values retain the reference result", () => {
  let seed = 0x6d2b79f5;
  const random = () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  for (let i = 0; i < 20_000; i++) verify(-3_200 + random() * 6_000, -2_200 + random() * 4_200);
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    verify(value, 0); verify(0, value); verify(value, value);
  }
  for (const z of [-1_920, -1_024, -64, -0, 0, 64, 1_024, 1_664]) {
    for (const delta of [-1, 0, 1] as const) {
      const testZ = delta === 0 ? z : adjacent(z, delta);
      for (let x = -3_000; x <= 2_600; x += 40) verify(x, testZ);
    }
  }
});

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import source from "../src/data/southElevatedV238Replacement.json";
import profile from "../src/data/elevatedCoreOwnersV238.json";
import { isElevatedStationReplacementColumnV238 } from "../src/elevatedStationV238Profile";
import {
  compilePedestrianObstacles, createPedestrianState, pedestrianPointIsBlocked,
  type PedestrianEnvironment, type PedestrianObstacleIndex,
} from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";

const originals = source.core.previousPrisms as PrismPayload["buildings"];
const obstacles = compilePedestrianObstacles({ buildings: originals });
const unique = (index: PedestrianObstacleIndex) => [...new Set([...index.cells.values()].flat())];
const environment: PedestrianEnvironment = {
  bounds: { minX: 0, maxX: 500, minZ: 1850, maxZ: 2400 },
  groundAt: () => 5.2, water: [], obstacles,
};

test("three exact Gleisdreieck proxies compile the full thin construction once without source mutation", () => {
  const before = JSON.stringify(originals);
  const index = compilePedestrianObstacles({ buildings: originals });
  expect(JSON.stringify(originals)).toBe(before);
  const replaced = unique(index).filter(o => o.sourceId?.startsWith("gleisdreieck-v238-"));
  expect(replaced).toHaveLength(source.core.navigationSolids.length);
  expect(source.core.navigationSolids.length).toBeGreaterThan(100);
  expect(unique(index).some(o => source.core.prismIds.includes(o.sourceId ?? ""))).toBeFalse();
  expect(profile.navigationSolids).toEqual(source.core.navigationSolids);
  expect(profile.previousColumns).toEqual(source.core.previousColumns);
});

test("street underpasses remain walkable while both platforms and roof are solid and support landing", () => {
  for (const [x, z] of [[135, 2135], [130, 2200], [110, 2160], [155, 2162]])
    expect(pedestrianPointIsBlocked(x, z, 5.2, obstacles)).toBeFalse();
  expect(pedestrianPointIsBlocked(135, 2135, 14.28, obstacles)).toBeTrue();
  expect(pedestrianPointIsBlocked(135, 2135, 15.2, obstacles)).toBeFalse();
  expect(pedestrianPointIsBlocked(110, 2160, 19.28, obstacles)).toBeTrue();
  expect(pedestrianPointIsBlocked(110, 2160, 20.2, obstacles)).toBeFalse();
  expect(pedestrianPointIsBlocked(110, 2160, 23, obstacles)).toBeTrue();
  for (const [x, z, hint, expected] of [[135, 2135, 17.1, 15.2], [110, 2160, 22, 20.2]]) {
    const state = createPedestrianState(environment, {
      x, z, groundYHint: hint, preserveHorizontalPosition: true, yaw: 0,
    });
    expect(state.x).toBe(x);
    expect(state.z).toBe(z);
    expect(state.groundY).toBeCloseTo(expected, 5);
  }
  const roof = createPedestrianState(environment, {
    x: 130, z: 2140, groundYHint: 40, preserveHorizontalPosition: true, yaw: 0,
  });
  expect(roof.groundY).toBeCloseTo(18.88, 5);
});

test("individual steel supports collide without restoring a full-footprint ground obstacle", () => {
  const posts = source.core.navigationSolids.filter(s => s.minY === 5.2 && s.maxY > 8);
  expect(posts.length).toBeGreaterThan(5);
  for (const post of posts) {
    const xs = post.ring.map(p => p[0]), zs = post.ring.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs), depth = Math.max(...zs) - Math.min(...zs);
    expect(width).toBeLessThanOrEqual(.56);
    expect(depth).toBeLessThanOrEqual(.56);
    expect(pedestrianPointIsBlocked(
      (Math.max(...xs) + Math.min(...xs)) / 2,
      (Math.max(...zs) + Math.min(...zs)) / 2, 5.2, obstacles,
    )).toBeTrue();
  }
});

test("native retirement matches exactly the 195 recorded source columns and no neighboring column", () => {
  const expected = new Set(source.core.previousColumns.map(c => `${c.x},${c.z}`));
  expect(expected.size).toBe(195);
  let count = 0;
  for (let x = 58; x <= 402; x += 4) for (let z = 1946; z <= 2302; z += 4) {
    const actual = isElevatedStationReplacementColumnV238(x, z);
    expect(actual).toBe(expected.has(`${x},${z}`));
    if (actual) count++;
  }
  expect(count).toBe(195);
  const voxels = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url), "utf8"));
  for (const c of source.core.previousColumns) {
    const row = voxels.building_rows[(c.z - 2) / 4 - voxels.grid.min_z_idx] as number[][];
    const column = (c.x - 2) / 4 - voxels.grid.min_x_idx;
    const span = row.find(([start, length]) => column >= start && column < start + length);
    expect(span?.slice(2)).toEqual([c.low, c.high, c.kind]);
  }
});

test("unrelated nearby warehouse navigation remains byte-equivalent to its independent compilation", () => {
  const prisms: PrismPayload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
  const neighbors = prisms.buildings.filter(p => ["67973594", "67973590"].includes(p.id));
  expect(neighbors).toHaveLength(2);
  const baseline = compilePedestrianObstacles({ buildings: neighbors });
  const combined = compilePedestrianObstacles({ buildings: [...originals, ...neighbors] });
  for (const neighbor of neighbors) {
    const select = (index: PedestrianObstacleIndex) => unique(index).filter(o => o.sourceId === neighbor.id);
    expect(JSON.stringify(select(combined))).toBe(JSON.stringify(select(baseline)));
    expect(select(combined)).toHaveLength(1);
  }
});

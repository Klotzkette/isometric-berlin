import { expect, test } from "bun:test";
import { northernNavigationNearV309 } from "../src/northernVisibilityV309";
import { northSitesV306Solids } from "../src/northSitesV306Navigation";
import { railSseArchitectureV307Solids } from "../src/railSseNavigationV307";
import { hospitalArchitectureV308Solids } from "../src/HospitalArchitectureV308Navigation";
import { railTransportCarSolidsV385 } from "../src/railTransportRemainderV385";
import bridge from "../src/data/gesundbrunnenRoadBridgesV309Profile.json";
import approach from "../src/data/railBridgeApproachV307Navigation.json";
import school from "../src/data/northSchoolGroundV306.json";
import hospital from "../src/data/hospitalArchitectureV308Profile.json";
import contact from "../src/data/coreTerrainContactV307Navigation.json";
import parks from "../src/data/northParkTerrainV306.json";
import rail from "../src/data/railSseTerrainV307.json";

test("the navigation broad phase includes every actual source cell and the capsule across its boundary", () => {
  const cells = new Set<string>();
  const includeBox = ([west, north, east, south]: number[]) => {
    // Ground providers may snap to a four-metre cell. Solids can be reached
    // from a capsule centre outside the footprint.
    for (let i = Math.floor((west - 10.001) / 256); i <= Math.floor((east + 10.001) / 256); i++) {
      for (let j = Math.floor((north - 10.001) / 256); j <= Math.floor((south + 10.001) / 256); j++) {
        cells.add(i + "," + j);
      }
    }
  };
  const includeRing = (ring: number[][]) => {
    const xs = ring.map(p => p[0]), zs = ring.map(p => p[1]);
    includeBox([Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]);
  };
  for (const native of [false, true]) {
    for (const s of [...northSitesV306Solids(native), ...railSseArchitectureV307Solids(native),
      ...hospitalArchitectureV308Solids(native), ...railTransportCarSolidsV385(native)]) includeRing(s.ring as number[][]);
  }
  for (const s of [...bridge.navigation, ...approach.houses]) includeRing(s.ring);
  for (const p of [...parks.profiles, ...rail.profiles]) includeBox(p.bounds);
  includeBox(hospital.oldCBFOverrideBounds);
  includeRing((school.geometry.coordinates as number[][][])[0]);
  for (const box of school.nativeCells) includeBox(box);
  const includeGrid = (grid: object, delimiter: string) => {
    for (const key of Object.keys(grid)) {
      const [x,z] = key.split(delimiter).map(Number);
      includeBox([x * 4, z * 4, x * 4 + 4, z * 4 + 4]);
    }
  };
  for (const m of approach.models) includeGrid(m.cells, ",");
  for (const r of contact.regions) for (const m of r.meshes) includeGrid(m.cells, "_");
  expect(cells.size).toBeGreaterThan(40);
  for (const key of cells) {
    const [x, z] = key.split(",").map(n => Number(n) * 256);
    expect(northernNavigationNearV309(x + 128, z + 128), key).toBeTrue();
  }
  expect(northernNavigationNearV309(0, 0)).toBeFalse();
  expect(northernNavigationNearV309(0, 0, 900)).toBeTrue();
});

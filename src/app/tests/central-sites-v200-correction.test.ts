import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import correction from "../src/data/centralSitesV200Correction.json";
import replacements from "../src/data/centralSitesV200Replacement.json";
import delta from "./fixtures/minecraft-world-v200-correction-delta.json";
import legacyBaseline from "./fixtures/minecraft-world-synchronous-v192.json";
import currentBaseline from "./fixtures/minecraft-world-synchronous-v200.json";
import {
  CENTRAL_SITES_V200_FALSE_PRISM_IDS,
  isCentralSitesV200FalseColumn,
} from "../src/centralSitesV200Profile";

type Column = [number, number, number, number, number];
type Prism = {
  id: string;
  ring: number[][];
  holes: number[][][];
  y0_dm: number;
  h_dm: number;
};
const voxelsFile = Bun.file(new URL(
  "../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url,
));
const prismsFile = Bun.file(new URL(
  "../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url,
));
const voxels = await voxelsFile.json();
const prisms: Prism[] = (await prismsFile.json()).buildings;
const digest = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

function* columns(): Generator<Column> {
  for (const [zi, row] of voxels.building_rows.entries()) {
    for (const [xi, length, lo, hi, material] of row) {
      for (let offset = 0; offset < length; offset++)
        yield [voxels.grid.min_x_idx + xi + offset,
          voxels.grid.min_z_idx + zi, lo, hi, material];
    }
  }
}

function ringContains(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}

function prismContains(prism: Prism, x: number, z: number): boolean {
  return ringContains(x * 10, z * 10, prism.ring) &&
    !prism.holes.some((hole) => ringContains(x * 10, z * 10, hole));
}

test("correction evidence retains the underground station and exact source rows", async () => {
  expect(correction.falsePrismId).toBe("98956069");
  expect(correction.sourceOwnerId).toBe("OSM-way-398956069");
  expect(correction.rawOsmEvidence.row.osm_way_id).toBe("398956069");
  expect(correction.rawOsmEvidence.row.building).toBe("train_station");
  expect(correction.rawOsmEvidence.tags).toMatchObject({
    layer: "-1", location: "underground", indoor: "yes",
  });
  expect(correction.retainedContextEvidence.properties.height_source)
    .toBe("display_fallback:building=train_station");
  expect(correction.retainedContextEvidence.properties.measured_height_m).toBe(12);
  expect(prisms.filter((p) => p.id === "98956069")).toEqual([correction.retainedPrism]);
  expect(digest(new Uint8Array(await prismsFile.arrayBuffer())))
    .toBe(correction.prismEvidence.fileSha256);
  expect(digest(new Uint8Array(await voxelsFile.arrayBuffer())))
    .toBe(correction.native.fileSha256);
  expect(digest(JSON.stringify(voxels.building_rows)))
    .toBe(correction.native.fullBuildingRowsSha256);
  expect(voxels.grid).toEqual(correction.native.grid);
  expect(voxels.cell_m).toBe(4);
  expect(correction.native.affectedSourceRows).toHaveLength(6);
  const reconstructed: number[][] = [];
  for (const row of correction.native.affectedSourceRows) {
    expect(voxels.building_rows[row.zOffset]).toEqual(row.runs);
    expect(digest(JSON.stringify(row.runs))).toBe(row.sha256);
    for (const match of row.matches) {
      const [xi, count, lo, hi, material] = row.runs[match.runIndex];
      // Every affected source run is fully owned; no neighbouring run is cut.
      expect(match.offsets).toEqual(Array.from({ length: count }, (_, i) => i));
      for (const offset of match.offsets)
        reconstructed.push([voxels.grid.min_x_idx + xi + offset,
          voxels.grid.min_z_idx + row.zOffset, lo, hi, material]);
    }
  }
  expect(reconstructed).toEqual(correction.native.columns);
  expect(correction.native.cellKeys).toEqual(reconstructed.map(([x, z]) => `${x},${z}`));
  expect(correction.native.matchingRunCount).toBe(7);
});

test("the complete native stock loses exactly the frozen 29 false columns", () => {
  const matched: Column[] = [];
  let visited = 0;
  for (const column of columns()) {
    const [x, z, lo, hi] = column;
    if (isCentralSitesV200FalseColumn((x + .5) * 4, (z + .5) * 4, lo / 10, hi / 10))
      matched.push(column);
    visited++;
  }
  expect(visited).toBe(correction.native.fullColumnCount);
  expect(matched).toEqual(correction.native.columns);
  expect(matched).toHaveLength(29);
  expect(new Set(correction.native.cellKeys).size).toBe(29);
});

test("native predicate rejects different heights, non-centres and every unlisted cell", () => {
  const expected = new Set(correction.native.cellKeys);
  const [firstX, firstZ] = correction.native.columns[0];
  const x = (firstX + .5) * 4, z = (firstZ + .5) * 4;
  expect(isCentralSitesV200FalseColumn(x, z, 5.2, 17.2)).toBe(true);
  for (const [lo, hi] of [[5.3, 17.2], [5.2, 17.3], [5.2, 21.2],
    [17.2, 21.2], [-6.8, 5.2], [5.2000001, 17.2], [5.2, 17.2000001]])
    expect(isCentralSitesV200FalseColumn(x, z, lo, hi)).toBe(false);
  for (const offset of [-2, -.01, .01, 2]) {
    expect(isCentralSitesV200FalseColumn(x + offset, z, 5.2, 17.2)).toBe(false);
    expect(isCentralSitesV200FalseColumn(x, z + offset, 5.2, 17.2)).toBe(false);
  }
  for (const bad of [NaN, Infinity, -Infinity]) {
    expect(isCentralSitesV200FalseColumn(bad, z, 5.2, 17.2)).toBe(false);
    expect(isCentralSitesV200FalseColumn(x, bad, 5.2, 17.2)).toBe(false);
    expect(isCentralSitesV200FalseColumn(x, z, bad, 17.2)).toBe(false);
    expect(isCentralSitesV200FalseColumn(x, z, 5.2, bad)).toBe(false);
  }
  // Exhaust the original prism's surrounding grid, including its concave gaps.
  for (let xi = 350; xi < 385; xi++) for (let zi = -185; zi < -140; zi++)
    expect(isCentralSitesV200FalseColumn((xi + .5) * 4, (zi + .5) * 4, 5.2, 17.2))
      .toBe(expected.has(`${xi},${zi}`));
});

test("no false cell shares a prism owner, and closest real owners stay intact", () => {
  const foreignOwners = new Set<string>();
  for (const [xi, zi] of correction.native.columns) {
    const x = (xi + .5) * 4, z = (zi + .5) * 4;
    expect(prismContains(correction.retainedPrism, x, z)).toBe(true);
    // Independently verify the unsimplified, projected OSM source footprint.
    expect(correction.retainedContextEvidence.geometryEpsg25833.coordinates.some(
      ([outer, ...holes]) => ringContains(x + 389500, 5820000 - z, outer) &&
        !holes.some((hole) => ringContains(x + 389500, 5820000 - z, hole)),
    )).toBe(true);
    for (const prism of prisms) if (prism.id !== "98956069" && prismContains(prism, x, z))
      foreignOwners.add(prism.id);
  }
  expect([...foreignOwners]).toEqual([]);
  expect(correction.ownershipAudit.sharedCenterOwners).toEqual([]);
  for (const neighbour of correction.ownershipAudit.nearestOtherOwners) {
    expect(prisms.find((p) => p.id === neighbour.prismId)).toEqual(neighbour.retainedPrism);
    expect(neighbour.sourceOverlapM2).toBe(0);
    expect(neighbour.matchingCellCount).toBe(0);
    expect(CENTRAL_SITES_V200_FALSE_PRISM_IDS.has(neighbour.prismId)).toBe(false);
  }
  expect(correction.ownershipAudit.nearestOtherOwners[0].sourceOwnerId)
    .toBe("OSM-way-98338944");
  expect(correction.ownershipAudit.nearestOtherOwners[0].distanceM).toBeGreaterThan(3.47);
});

test("drawn and navigation exclusion expose one immutable exact ID and no new obstacles", () => {
  expect([...CENTRAL_SITES_V200_FALSE_PRISM_IDS]).toEqual(["98956069"]);
  expect(CENTRAL_SITES_V200_FALSE_PRISM_IDS.size).toBe(1);
  expect(Object.isFrozen(CENTRAL_SITES_V200_FALSE_PRISM_IDS)).toBe(true);
  expect("add" in CENTRAL_SITES_V200_FALSE_PRISM_IDS).toBe(false);
  expect("delete" in CENTRAL_SITES_V200_FALSE_PRISM_IDS).toBe(false);
  expect("clear" in CENTRAL_SITES_V200_FALSE_PRISM_IDS).toBe(false);
  expect([...CENTRAL_SITES_V200_FALSE_PRISM_IDS.keys()]).toEqual(["98956069"]);
  expect([...CENTRAL_SITES_V200_FALSE_PRISM_IDS.entries()]).toEqual([["98956069", "98956069"]]);
  CENTRAL_SITES_V200_FALSE_PRISM_IDS.forEach((id, key, set) => {
    expect(id).toBe("98956069"); expect(key).toBe(id);
    expect(set).toBe(CENTRAL_SITES_V200_FALSE_PRISM_IDS);
  });
  for (const id of ["398956069", "OSM-way-398956069", "9895606", "989560690", "99124892"])
    expect(CENTRAL_SITES_V200_FALSE_PRISM_IDS.has(id)).toBe(false);
  expect(correction.navigation.removePrismIds).toEqual(["98956069"]);
  expect(correction.navigation.addedObstacleCount).toBe(0);
  expect(correction.navigation.addedWalkSurfaceCount).toBe(0);
});

test("production near and distant drawing omit only the exact false prism", async () => {
  const { createDistantBuildingShells, createIsometricCity, PRISM_SUPPRESSED_IDS } =
    await import("../src/IsometricCityWorld");
  const { Mesh } = await import("three");
  const { disposeStaticAudit } = await import("./helpers/staticGeometryAudit");
  const source = await prismsFile.json();
  const target = source.buildings.find((p: Prism) => p.id === "98956069");
  const neighbour = source.buildings.find((p: Prism) => p.id === "98338944");
  const foreign = { ...target, id: "v200-foreign-same-footprint-control" };
  expect(PRISM_SUPPRESSED_IDS.has(target.id)).toBe(true);
  for (const detailProfile of ["full", "mobile"] as const) {
    for (const [part, shouldRemain] of [[target, false], [neighbour, true], [foreign, true]] as const) {
      const distant = createDistantBuildingShells(source, [part]);
      const near = createIsometricCity(source, null, null, null, {
        buildings: [part], includeContext: false, detailProfile,
      });
      const body = near.getObjectByName("LoD2 prism buildings");
      const count = body instanceof Mesh ? body.geometry.getAttribute("position").count : 0;
      expect(count > 0).toBe(shouldRemain);
      expect(distant.children.length > 0).toBe(shouldRemain);
      disposeStaticAudit(near); disposeStaticAudit(distant);
    }
  }
}, 60000);

test("independent native captures preserve the old fixture and bound both correction phases", async () => {
  expect(delta.phaseCaptures.legacy).toEqual(legacyBaseline);
  expect(delta.phaseCaptures.current).toEqual(currentBaseline);
  for (const [path, expected] of Object.entries(delta.inputSha256)) {
    const file = Bun.file(new URL(`../../../${path}`, import.meta.url));
    expect(digest(new Uint8Array(await file.arrayBuffer()))).toBe(expected);
  }
  expect(delta.phases.station.full.changedMeshes.map((mesh) => [mesh.name, mesh.removedCount, mesh.addedCount]))
    .toEqual([["Voxel building columns", 87, 0], ["Voxel facade windows", 102, 0]]);
  expect(delta.phases.heckmann.full.changedMeshes.map((mesh) => [mesh.name, mesh.removedCount, mesh.addedCount]))
    .toEqual([["Voxel building columns", 275, 0], ["Voxel facade windows", 336, 189]]);
  expect(delta.phases.station.mobile.changedMeshes.map((mesh) => mesh.removedCount)).toEqual([29]);
  expect(delta.phases.heckmann.mobile.changedMeshes.map((mesh) => mesh.removedCount)).toEqual([99]);
  for (const phase of Object.values(delta.phases)) for (const run of Object.values(phase)) {
    const net = run.changedMeshes.reduce((sum, mesh) => sum + mesh.removedCount - mesh.addedCount, 0);
    expect(run.before.instances - run.after.instances).toBe(net);
    expect(run.before.bufferBytes - run.after.bufferBytes).toBe(net * 76);
    expect(run.before.renderables).toBe(run.after.renderables);
    expect(run.unchangedMeshCount + run.changedMeshes.length).toBe(run.before.renderables);
    for (const mesh of run.changedMeshes) {
      expect(mesh.retainedInstancesByteIdenticalInOrder).toBe(true);
      expect(mesh.removedInstances).toHaveLength(mesh.removedCount);
      expect(mesh.addedInstances).toHaveLength(mesh.addedCount);
      expect(mesh.retainedCount + mesh.removedCount).toBe(mesh.beforeCount);
      expect(mesh.retainedCount + mesh.addedCount).toBe(mesh.afterCount);
    }
  }
});

test("every captured removed instance belongs to an exact source column; added panes face only replaced neighbours", () => {
  const stationColumns = correction.native.columns.map(([x, z, lo, hi]) =>
    [(x + .5) * 4, (z + .5) * 4, lo / 10, hi / 10]);
  const familyColumns = replacements.replacements.flatMap((item) => item.columns);
  const liveCells = new Set([...columns()].map(([x, z]) => `${(x + .5) * 4},${(z + .5) * 4}`));
  for (const [phaseName, ownedColumns] of [["station", stationColumns], ["heckmann", familyColumns]] as const) {
    const owned = new Map(ownedColumns.map(([x, z, lo, hi]) => [`${x},${z}`, [lo, hi]]));
    for (const run of Object.values(delta.phases[phaseName])) {
      const layerHeights = new Map<string, number>();
      for (const mesh of run.changedMeshes) {
        const windows = mesh.name === "Voxel facade windows";
        for (const [kind, instances] of [["removed", mesh.removedInstances], ["added", mesh.addedInstances]] as const) {
          for (const matrix of instances) {
            expect(matrix).toHaveLength(19);
            const sourceX = matrix[12] - (windows ? matrix[8] * 2.08 : 0);
            const sourceZ = matrix[14] - (windows ? matrix[10] * 2.08 : 0);
            const x = Math.round(sourceX / 4 - .5) * 4 + 2;
            const z = Math.round(sourceZ / 4 - .5) * 4 + 2;
            const key = `${x},${z}`;
            expect(Math.abs(sourceX - x)).toBeLessThan(.0001);
            expect(Math.abs(sourceZ - z)).toBeLessThan(.0001);
            expect(liveCells.has(key)).toBe(true);
            if (kind === "added") {
              expect(windows).toBe(true);
              expect(owned.has(key)).toBe(false);
              expect(owned.has(`${x + matrix[8] * 4},${z + matrix[10] * 4}`)).toBe(true);
            } else {
              expect(owned.has(key)).toBe(true);
              const [lo, hi] = owned.get(key)!;
              expect(matrix[13]).toBeGreaterThanOrEqual(lo);
              expect(matrix[13]).toBeLessThanOrEqual(hi);
              if (!windows) {
                expect(matrix[0]).toBe(4); expect(matrix[10]).toBe(4);
                layerHeights.set(key, (layerHeights.get(key) ?? 0) + matrix[5]);
              }
            }
          }
        }
      }
      expect(layerHeights.size).toBe(owned.size);
      for (const [key, height] of layerHeights) {
        const [lo, hi] = owned.get(key)!;
        expect(height).toBeCloseTo(hi - lo, 5);
      }
    }
  }
  const occupied = new Set(stationColumns.map(([x, z]) => `${x},${z}`));
  const expectedWindows: string[] = [];
  for (const [x, z] of stationColumns) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!occupied.has(`${x + dx * 4},${z + dz * 4}`))
      for (const y of [8, 12, 16]) expectedWindows.push(`${x},${z},${dx},${dz},${y}`);
  }
  const windows = delta.phases.station.full.changedMeshes.find((mesh) => mesh.name === "Voxel facade windows")!;
  const actualWindows = windows.removedInstances.map((m) => {
    const x = Math.round((m[12] - m[8] * 2.08) / 4 - .5) * 4 + 2;
    const z = Math.round((m[14] - m[10] * 2.08) / 4 - .5) * 4 + 2;
    return `${x},${z},${m[8]},${m[10]},${m[13]}`;
  });
  expect(expectedWindows).toHaveLength(102);
  expect(actualWindows.sort()).toEqual(expectedWindows.sort());
});

test("production pedestrian index opens the false shell and retains identical foreign geometry", async () => {
  const { compilePedestrianObstacles, pedestrianPointIsBlocked } =
    await import("../src/pedestrianNavigation");
  const source = await prismsFile.json();
  const target = source.buildings.find((p: Prism) => p.id === "98956069");
  const neighbour = source.buildings.find((p: Prism) => p.id === "98338944");
  const foreign = { ...target, id: "v200-foreign-same-footprint-control" };
  for (const mode of ["day", "minecraft"] as const) {
    const corrected = compilePedestrianObstacles({ buildings: [target, neighbour] }, () => mode);
    const control = compilePedestrianObstacles({ buildings: [foreign, neighbour] }, () => mode);
    expect(corrected.buildingCount).toBe(1);
    expect(control.buildingCount).toBe(2);
    for (const [xi, zi] of correction.native.columns) {
      const x = (xi + .5) * 4, z = (zi + .5) * 4;
      expect(pedestrianPointIsBlocked(x, z, 5.2, corrected)).toBe(false);
      expect(pedestrianPointIsBlocked(x, z, 5.2, control)).toBe(true);
    }
    const sourceIds = new Set([...corrected.cells.values()].flat().map((part) => part.sourceId));
    expect(sourceIds.has("98956069")).toBe(false);
    expect(sourceIds.has("98338944")).toBe(true);
  }
}, 60000);

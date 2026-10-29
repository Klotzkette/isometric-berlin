import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { Group } from "three";
import type { PrismBuilding, PrismPayload, SurfacePayload } from "../src/IsometricCityWorld";
import {
  splitParkSurfaceFamily, splitProgressiveBuildings, surfaceFamilyPayload,
  type ProgressiveWorldWorkerInput, type ProgressiveWorldWorkerMessage,
  type ProgressiveWorldWorkerOutput,
} from "../src/progressiveWorld";
import { BuildingDetailWorker } from "../src/buildingDetailWorker";
import { PackedBuildingDistrictStore } from "../src/packedBuildingDistrictStore";
import {
  buildingDetailProfile, buildingDetailDistricts, selectBuildingDetailDistricts,
} from "../src/buildingDetailStreaming";
import { serializeObject3DForTransfer } from "../src/transferableObject3D";
import { compactStaticGeometry } from "../src/compactStaticGeometry";
import { smoothGroundTopSampler, type VoxelPayload } from "../src/MinecraftVoxelWorld";

const source = await Bun.file(new URL("../src/progressiveWorld.worker.ts", import.meta.url)).text();
const parsed = ts.createSourceFile("progressiveWorld.worker.ts", source, ts.ScriptTarget.Latest, true);
const declarations = parsed.statements.filter(ts.isFunctionDeclaration).map((node) => node.getText(parsed));
const receiver = parsed.statements.find((node) => node.getText(parsed).startsWith("workerScope.onmessage ="));
if (!receiver) throw new Error("Missing production worker message receiver");
const compiled = ts.transpileModule([...declarations, receiver.getText(parsed)].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

// Execute the production Worker and receiver. Only geometry constructors and
// network are instrumented: source partitions, ACKs, resume and readiness are real.
function workerHost(profile: "full" | "mobile", groundSource?: VoxelPayload, stationPhotoAdmitted = false, stationSourceMatches = true) {
  const messages: ProgressiveWorldWorkerOutput[] = [];
  const attachedBatchResolvers = new Map<string, () => void>();
  const attachedBatchPromises = new Map<string, Promise<void>>();
  const buildingSources: string[][] = [];
  const surfaceSources: SurfacePayload[] = [];
  const surfaceTerrain: Array<{ waterTop: number; bankY: number; samples: number[] }> = [];
  let parsedGround: VoxelPayload | undefined;
  let roadGround: VoxelPayload | undefined;
  let groundRowsAtSurfaceParse: number | undefined;
  let rasterRowReads = 0;
  const roadIds = ["restored-asphalt-0-0", "restored-paving-0-0", "restored-kerbs-0-0"];
  const roadBuilds: string[] = [];
  let autoAckBuildings = true;
  let heldSurface: string | undefined;
  let maxPendingTransfers = 0;
  const maxPendingByKind = { buildings: 0, surfaces: 0 };
  let sourceFetches = 0;
  const fetchedSources: string[] = [];
  let roadLoads = 0;
  const waiters = new Set<() => void>();
  const prisms: PrismPayload = {
    schema_version: 1, classes: ["building"],
    buildings: Array.from({ length: 12_000 }, (_, index) => ({
      class: 0, h_dm: 100, y0_dm: 0, id: `fixture-${index}`,
      ring: [[index * 10, 0], [index * 10 + 5, 0], [index * 10, 5]],
    })),
  };
  const surfaces = {
    parks: Array.from({ length: 321 }, (_, index) => ({ id: index })),
    roads: ["sand", "earth", "wood", "metal"].flatMap(kind => [{ id: `${kind}-1`, kind }, { id: `${kind}-2`, kind }]),
    water: [{ id: "basin" }], sunken_walls: [{ id: "wall" }],
    lane_markings: [{ id: "marking-1" }, { id: "marking-2" }],
    scrub_points: [[1, 2], [3, 4]],
  };
  const partition = splitProgressiveBuildings(prisms.buildings, 1, buildingDetailProfile(profile).batchSize);
  const districts = buildingDetailDistricts(partition.remaining);
  const defaultWanted = selectBuildingDetailDistricts(districts, [317.729, 40.477], undefined, { profile });
  const workerScope = {
    onmessage: null as ((event: { data: ProgressiveWorldWorkerMessage }) => void) | null,
    postMessage: (message: ProgressiveWorldWorkerOutput) => {
      messages.push(message);
      maxPendingTransfers = Math.max(maxPendingTransfers, attachedBatchPromises.size);
      for (const kind of ["buildings", "surfaces"] as const) {
        const pending = [...attachedBatchPromises.keys()].filter(id =>
          messages.some(entry => entry.type === "batch" && entry.id === id && entry.kind === kind),
        ).length;
        maxPendingByKind[kind] = Math.max(maxPendingByKind[kind], pending);
      }
      if (message.type === "batch" && (message.kind === "buildings" ? autoAckBuildings : message.id !== heldSurface)) {
        workerScope.onmessage!({ data: { type: "batch-attached", id: message.id } });
      }
      for (const wake of [...waiters]) wake();
    },
  };
  const bindings = {
    canReplacePotsdamerSouthStationPhoto: () => stationSourceMatches,
    Group, performance, setTimeout,
    BuildingDetailWorker, PackedBuildingDistrictStore, buildingDetailProfile,
    buildingDetailDistricts, selectBuildingDetailDistricts,
    splitProgressiveBuildings, splitParkSurfaceFamily, surfaceFamilyPayload,
    serializeObject3DForTransfer, compactStaticGeometry, attachedBatchResolvers, attachedBatchPromises,
    WATER_TOP_Y: 0,
    mobileDetailWorker: undefined, latestMobileView: undefined,
    smoothGroundTopSampler: groundSource ? smoothGroundTopSampler : () => () => 0,
    createIsometricCityCore: (_prisms: unknown, _ground: unknown, _tunnel: unknown,
      _surfaces: unknown, options: { buildings: PrismBuilding[]; architectureV241?: boolean; potsdamerStationPhoto?: boolean }) => {
      // Later district loads must honor the same exact AEG proxy replacement
      // as the initial core; otherwise traveling back creates duplicate shells.
      expect(options.architectureV241).toBeTrue();
      expect(options.potsdamerStationPhoto).toBe(stationPhotoAdmitted && stationSourceMatches);
      buildingSources.push(options.buildings.map((building) => building.id));
      return new Group();
    },
    createSmoothSurfaces: (payload: SurfacePayload, waterTop: number, bankY: number,
      terrainAt: (x: number, z: number) => number) => {
      surfaceSources.push(structuredClone(payload));
      if (groundSource) surfaceTerrain.push({ waterTop, bankY,
        samples: [[-24, 56], [-16, 64], [-8, 72]].map(([x, z]) => terrainAt(x, z)),
      });
      return new Group();
    },
    createRestoredRoadSurfaceBatches: async function* (ground: VoxelPayload, completed: ReadonlySet<string>) {
      roadLoads++;
      roadGround = ground;
      for (const id of roadIds) {
        if (completed.has(id)) continue;
        roadBuilds.push(id);
        yield { id, root: new Group() };
      }
    },
    fetch: async (url: string) => {
      fetchedSources.push(url);
      if (url === "prisms") sourceFetches += 1;
      return {
        ok: true,
        json: async () => {
          if (url === "ground" && groundSource) {
            parsedGround = structuredClone(groundSource);
            return new Proxy(parsedGround, {
              get(target, key, receiver) {
                if (key === "ground_rows") {
                  rasterRowReads++;
                  throw new Error("Smooth worker must not read raster ground rows");
                }
                return Reflect.get(target, key, receiver);
              },
            });
          }
          if (url === "surfaces" && parsedGround) groundRowsAtSurfaceParse = parsedGround.ground_rows.length;
          return structuredClone(url === "prisms" ? prisms : url === "surfaces" ? surfaces : {});
        },
      };
    },
    workerScope,
  };
  const build = new Function(...Object.keys(bindings), `${compiled}; return build;`)(
    ...Object.values(bindings),
  ) as (input: ProgressiveWorldWorkerInput) => Promise<void>;
  function waitFor(predicate: () => boolean): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.delete(wake);
        reject(new Error("Production worker did not reach the expected state"));
      }, 3_000);
      const wake = (): void => {
        const error = messages.find((message) => message.type === "error");
        if (!error && !predicate()) return;
        clearTimeout(timeout);
        waiters.delete(wake);
        if (error) reject(new Error(error.message));
        else resolve();
      };
      waiters.add(wake);
    });
  }
  async function start(completedBatchIds: string[] = [], surfacesComplete = false): Promise<void> {
    const common = {
      type: "build" as const, initialBuildingCount: 1, prismUrl: "prisms",
      potsdamerStationPhoto: stationPhotoAdmitted,
      groundUrl: "ground", surfacesUrl: "surfaces", completedBatchIds, surfacesComplete,
    };
    await build(profile === "mobile" ? { ...common, detailProfile: profile } : {
      ...common, detailProfile: profile, tunnel: null,
    });
    await waitFor(() => messages.some(message => message.type === "settled"));
  }
  function view(requestedBatchIds: string[], retainedBatchIds: string[], viewRevision: number): void {
    workerScope.onmessage!({ data: { type: "detail-view", requestedBatchIds, retainedBatchIds, viewRevision } });
  }
  const batches = () => messages.filter(message => message.type === "batch");
  const buildingBatches = () => batches().filter(message => message.kind === "buildings");
  return {
    messages, buildingSources, surfaceSources, surfaceTerrain, surfaces, roadIds, roadBuilds, fetchedSources, attachedBatchPromises, attachedBatchResolvers,
    districts, defaultWanted, start, view, batches, buildingBatches, waitFor, maxPendingByKind,
    ack: (id: string) => workerScope.onmessage!({ data: { type: "batch-attached", id } }),
    holdBuildingAcknowledgements: () => { autoAckBuildings = false; },
    resumeBuildingAcknowledgements: () => { autoAckBuildings = true; },
    holdSurfaceAcknowledgement: (id: string) => { heldSurface = id; },
    get buildingBuilds() { return buildingSources.length; },
    get surfaceBuilds() { return surfaceSources.length; },
    get sourceFetches() { return sourceFetches; },
    get roadLoads() { return roadLoads; },
    get maxPendingTransfers() { return maxPendingTransfers; },
    get parsedGround() { return parsedGround; },
    get roadGround() { return roadGround; },
    get groundRowsAtSurfaceParse() { return groundRowsAtSurfaceParse; },
    get rasterRowReads() { return rasterRowReads; },
  };
}

async function runWorker(profile: "full" | "mobile", retained: string[] = []) {
  const host = workerHost(profile);
  await host.start(retained);
  return host;
}

describe("complete source detail and resumable worker surfaces", () => {
  for (const profile of ["mobile", "full"] as const) {
    for (const sourceMatches of [false, true]) {
      test(`${profile}: south-station retirement requires both committed admission and unchanged worker source (${sourceMatches})`, async () => {
        const host = workerHost(profile, undefined, true, sourceMatches);
        await host.start();
        expect(host.buildingSources.length).toBeGreaterThan(0);
      });
    }
    test(`${profile}: resuming a settled surface world decodes only missing buildings`, async () => {
      const initial = await runWorker(profile);
      const retainedSurfaces = initial.batches().filter(batch => batch.kind === "surfaces").map(batch => batch.id);
      const resumed = workerHost(profile);
      resumed.holdBuildingAcknowledgements();
      const started = resumed.start(retainedSurfaces, true);
      await resumed.waitFor(() => resumed.buildingBatches().length === 1);
      expect(resumed.fetchedSources).toEqual(["prisms"]);
      expect(resumed.surfaceBuilds).toBe(0);
      expect(resumed.roadLoads).toBe(0);
      expect(resumed.messages.some(message => message.type === "settled")).toBeFalse();
      resumed.resumeBuildingAcknowledgements();
      resumed.ack(resumed.buildingBatches()[0].id);
      await started;
      expect(resumed.buildingSources).toEqual(initial.buildingSources);
      expect(resumed.batches().map(batch => batch.id)).toEqual(initial.buildingBatches().map(batch => batch.id));
      expect(resumed.fetchedSources).toEqual(["prisms"]);
      expect(resumed.surfaceBuilds).toBe(0);
      expect(resumed.roadLoads).toBe(0);
      expect(resumed.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 0 });
    });

    for (const resumed of [false, true]) test(`${profile}: ${resumed ? "resumed" : "initial"} surfaces release unused raster rows before parsing or waiting for attachment`, async () => {
      const ground: VoxelPayload = {
        schema_version: 2, cell_m: 4, classes: ["lawn"], water_top_y_m: 0.75,
        grid: { cols: 1024, rows: 128, min_x_idx: -8, min_z_idx: 12 },
        ground_height: { cols: 2, rows: 2, stride_cells: 4, y_dm: [10, 30, 50, 90] },
        ground_rows: Array.from({ length: 128 }, () =>
          Array.from({ length: 64 }, (_, index) => [index * 16, 16, 0])),
      };
      const retained = resumed ? ["surface-water", "surface-parks-1", "restored-asphalt-0-0"] : [];
      const expected = await runWorker(profile, retained);
      const host = workerHost(profile, ground);
      const expectedTerrain = { waterTop: 0.75, bankY: 6.1, samples: [1, 4.5, 9] };
      const held = resumed ? "surface-parks-2" : profile === "full" ? "surface-water" : "surface-parks-1";
      host.holdSurfaceAcknowledgement(held);
      const started = host.start(retained);
      await host.waitFor(() => host.batches().some(message => message.id === held));
      try {
        expect(host.groundRowsAtSurfaceParse).toBe(0);
        expect(host.parsedGround!.ground_rows).toEqual([]);
        expect(host.parsedGround!.ground_height).toEqual(ground.ground_height);
        expect(host.parsedGround!.grid).toEqual(ground.grid);
        expect(host.rasterRowReads).toBe(0);
        expect(host.surfaceTerrain).toEqual([expectedTerrain]);
        expect(host.attachedBatchPromises.has(held)).toBeTrue();
        expect(host.messages.some(message => message.type === "settled")).toBeFalse();
      } finally {
        host.ack(held);
        await started;
      }
      expect(host.surfaceSources).toEqual(expected.surfaceSources);
      expect(host.batches().map(batch => batch.id).sort()).toEqual(expected.batches().map(batch => batch.id).sort());
      expect(host.roadBuilds).toEqual(expected.roadBuilds);
      expect(host.roadGround!.ground_height).toBe(host.parsedGround!.ground_height);
      expect(host.roadGround!.grid).toBe(host.parsedGround!.grid);
      expect(host.roadGround!.cell_m).toBe(ground.cell_m);
      for (const terrain of host.surfaceTerrain) expect(terrain).toEqual(expectedTerrain);
      expect(host.rasterRowReads).toBe(0);
      expect(ground.ground_rows).toHaveLength(128);
      expect(ground.ground_rows.every(row => row.length === 64)).toBeTrue();
    });

    test(`${profile}: repeated suspension transfers only missing building and surface batches`, async () => {
      const initial = await runWorker(profile);
      const batches = initial.batches();
      expect(initial.buildingBuilds).toBe(initial.defaultWanted.length);
      expect(initial.surfaceBuilds).toBe(profile === "mobile" ? 7 : 8);
      expect(initial.buildingSources.every(buildings => buildings.length <= buildingDetailProfile(profile).batchSize)).toBeTrue();
      expect(initial.maxPendingTransfers).toBeLessThanOrEqual(2);
      const retained = [initial.defaultWanted[0], "surface-water", "surface-parks-1", "surface-lane-markings", "restored-asphalt-0-0"];
      const resumed = await runWorker(profile, retained);
      const remaining = resumed.batches();
      expect(remaining.map(message => message.id).sort()).toEqual(
        batches.filter(message => !retained.includes(message.id)).map(message => message.id).sort(),
      );
      expect(resumed.buildingBuilds).toBe(initial.buildingBuilds - 1);
      expect(resumed.surfaceBuilds).toBe(profile === "mobile" ? 5 : 5);
      expect(resumed.roadBuilds).toEqual(initial.roadIds.slice(1));
      expect(resumed.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 0 });
      expect(resumed.attachedBatchPromises.size).toBe(0);
      expect(resumed.attachedBatchResolvers.size).toBe(0);
      const finished = await runWorker(profile, batches.map(message => message.id));
      expect(finished.buildingBuilds).toBe(0);
      expect(finished.surfaceBuilds).toBe(0);
      expect(finished.roadBuilds).toEqual([]);
      expect(finished.messages).toEqual([{ type: "settled", viewRevision: 0 }]);
    });

    test(`${profile}: all surface source records arrive once, with water owned by exactly one constructor`, async () => {
      const host = await runWorker(profile);
      const built = host.surfaceSources;
      expect(built.flatMap(p => p.parks)).toEqual(host.surfaces.parks);
      expect(built.flatMap(p => p.scrub_points ?? [])).toEqual(host.surfaces.scrub_points);
      expect(built.flatMap(p => p.roads ?? []).map(p => (p as unknown as { id: string }).id).sort())
        .toEqual(host.surfaces.roads.map(p => p.id).sort());
      expect(built.flatMap(p => p.lane_markings ?? [])).toEqual(host.surfaces.lane_markings);
      expect(built.flatMap(p => p.water)).toEqual(profile === "full" ? host.surfaces.water : []);
      expect(built.flatMap(p => p.sunken_walls ?? [])).toEqual(profile === "full" ? host.surfaces.sunken_walls : []);
      expect(host.roadBuilds).toEqual(host.roadIds);
      expect(host.batches().filter(p => p.id.startsWith("restored-")).map(p => p.id)).toEqual(host.roadIds);
      expect(host.messages.some(message => message.type === "complete")).toBeFalse();
    });

    for (const held of ["surface-metal", "restored-paving-0-0"]) test(`${profile}: ${held} acknowledgement is required before any settled view`, async () => {
      const host = workerHost(profile);
      host.holdSurfaceAcknowledgement(held);
      const started = host.start(host.defaultWanted);
      await host.waitFor(() => host.batches().some(message => message.id === held));
      expect(host.buildingBuilds).toBe(0);
      expect(host.messages.some(message => message.type === "settled")).toBeFalse();
      host.ack(held);
      await started;
      expect(host.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 0 });
    });

    test(`${profile}: a delayed surface ACK does not gate the building lane`, async () => {
      const host = workerHost(profile);
      const held = profile === "full" ? "surface-water" : "surface-parks-1";
      expect(host.defaultWanted.length).toBeGreaterThan(1);
      host.holdSurfaceAcknowledgement(held);
      const started = host.start();
      await host.waitFor(() => host.batches().some(message => message.id === held));
      await host.waitFor(() => host.buildingBatches().length === host.defaultWanted.length);
      expect(host.buildingBatches().map(message => message.id)).toEqual(host.defaultWanted);
      expect(host.batches().filter(message => message.kind === "surfaces").map(message => message.id)).toEqual([held]);
      expect([...host.attachedBatchPromises.keys()]).toEqual([held]);
      expect(host.messages.some(message => message.type === "settled")).toBeFalse();
      expect(host.maxPendingTransfers).toBe(2);
      expect(host.maxPendingByKind).toEqual({ buildings: 1, surfaces: 1 });
      host.ack(held);
      await started;
      expect(host.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 0 });
      expect(host.attachedBatchPromises.size).toBe(0);
      expect(host.attachedBatchResolvers.size).toBe(0);
    });

    test(`${profile}: a delayed building ACK does not gate the surface lane`, async () => {
      const host = workerHost(profile);
      host.holdBuildingAcknowledgements();
      const started = host.start();
      await host.waitFor(() => host.batches().some(message => message.id === host.roadIds.at(-1)));
      expect(host.buildingBatches().map(message => message.id)).toEqual([host.defaultWanted[0]]);
      expect(host.surfaceBuilds).toBe(profile === "mobile" ? 7 : 8);
      expect(host.roadBuilds).toEqual(host.roadIds);
      expect([...host.attachedBatchPromises.keys()]).toEqual([host.defaultWanted[0]]);
      expect(host.messages.some(message => message.type === "settled")).toBeFalse();
      expect(host.maxPendingTransfers).toBe(2);
      expect(host.maxPendingByKind).toEqual({ buildings: 1, surfaces: 1 });
      host.resumeBuildingAcknowledgements();
      host.ack(host.defaultWanted[0]);
      await started;
      expect(host.buildingBatches().map(message => message.id)).toEqual(host.defaultWanted);
      expect(host.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 0 });
      expect(host.attachedBatchPromises.size).toBe(0);
      expect(host.attachedBatchResolvers.size).toBe(0);
    });

    test(`${profile}: unknown and duplicate ACKs cannot release another pending packet`, async () => {
      const host = workerHost(profile);
      const held = profile === "full" ? "surface-water" : "surface-parks-1";
      const [first, second] = host.defaultWanted;
      expect(second).toBeDefined();
      host.holdBuildingAcknowledgements();
      host.holdSurfaceAcknowledgement(held);
      const started = host.start();
      await host.waitFor(() => host.attachedBatchPromises.size === 2);
      host.ack("unknown-batch");
      expect([...host.attachedBatchPromises.keys()].sort()).toEqual([first, held].sort());
      host.ack(first);
      await host.waitFor(() => host.buildingBatches().length === 2);
      expect(host.buildingBatches().map(message => message.id)).toEqual([first, second]);
      host.ack(first);
      expect([...host.attachedBatchPromises.keys()].sort()).toEqual([second, held].sort());
      expect([...host.attachedBatchResolvers.keys()].sort()).toEqual([second, held].sort());
      expect(host.surfaceBuilds).toBe(1);
      expect(host.messages.some(message => message.type === "settled")).toBeFalse();
      host.resumeBuildingAcknowledgements();
      host.ack(second);
      host.ack(held);
      await started;
      expect(host.maxPendingTransfers).toBe(2);
      expect(host.maxPendingByKind).toEqual({ buildings: 1, surfaces: 1 });
      expect(host.attachedBatchPromises.size).toBe(0);
      expect(host.attachedBatchResolvers.size).toBe(0);
    });

    test(`${profile}: the live worker reaches previously unselected districts and returns without source refetch`, async () => {
      const host = await runWorker(profile);
      const initialIds = host.buildingBatches().map(message => message.id);
      const wanted = selectBuildingDetailDistricts(host.districts, [11_999, 0], undefined, { profile });
      const retained = initialIds.filter(id => wanted.includes(id));
      expect(wanted.some(id => !initialIds.includes(id))).toBeTrue();
      const previousMessages = host.messages.length;
      const previousBuilds = host.buildingBuilds;
      const previousSurfaces = host.surfaceBuilds;
      host.view(wanted, retained, 1);
      await host.waitFor(() => host.messages.some(message => message.type === "settled" && message.viewRevision === 1));
      const arrivals = host.messages.slice(previousMessages).filter(message => message.type === "batch");
      expect(arrivals.map(message => message.id)).toEqual(wanted.filter(id => !retained.includes(id)));
      expect(host.buildingBuilds - previousBuilds).toBe(wanted.length - retained.length);
      expect(host.sourceFetches).toBe(1);
      expect(host.surfaceBuilds).toBe(previousSurfaces);
      expect(host.maxPendingTransfers).toBeLessThanOrEqual(2);
      const beforeReturn = host.messages.length;
      const retainedOnReturn = wanted.filter(id => initialIds.includes(id));
      host.view(initialIds, retainedOnReturn, 2);
      await host.waitFor(() => host.messages.some(message => message.type === "settled" && message.viewRevision === 2));
      expect(host.messages.slice(beforeReturn).filter(message => message.type === "batch").map(message => message.id))
        .toEqual(initialIds.filter(id => !retainedOnReturn.includes(id)));
      expect(host.sourceFetches).toBe(1);
      expect(host.buildingSources.every(buildings => buildings.length > 0 && buildings.length <= buildingDetailProfile(profile).batchSize)).toBeTrue();
    });

    test(`${profile}: receiver replaces a stale queued route at the first building ACK boundary`, async () => {
      const host = workerHost(profile);
      host.holdBuildingAcknowledgements();
      const started = host.start();
      await host.waitFor(() => host.buildingBatches().length === 1);
      const original = host.buildingBatches()[0].id;
      const [remote, next] = selectBuildingDetailDistricts(host.districts, [11_999, 0], undefined, { profile });
      host.view([remote, next], [], 1);
      await Promise.resolve();
      expect(host.buildingBatches()).toHaveLength(1);
      host.ack(original);
      await host.waitFor(() => host.buildingBatches().length === 2);
      expect(host.buildingBatches()[1].id).toBe(remote);
      host.view([original], [next], 0);
      host.ack(remote);
      await host.waitFor(() => host.buildingBatches().length === 3);
      expect(host.buildingBatches()[2].id).toBe(next);
      host.ack(next);
      await started;
      expect(host.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 1 });
      expect(host.buildingBatches().map(message => message.id)).toEqual([original, remote, next]);
      expect(host.maxPendingTransfers).toBeLessThanOrEqual(2);
      expect(host.attachedBatchPromises.size).toBe(0);
      expect(host.attachedBatchResolvers.size).toBe(0);
    });
  }
});

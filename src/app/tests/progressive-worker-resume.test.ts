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
function workerHost(profile: "full" | "mobile") {
  const messages: ProgressiveWorldWorkerOutput[] = [];
  const attachedBatchResolvers = new Map<string, () => void>();
  const attachedBatchPromises = new Map<string, Promise<void>>();
  const buildingSources: string[][] = [];
  const surfaceSources: SurfacePayload[] = [];
  const roadIds = ["restored-asphalt-0-0", "restored-paving-0-0", "restored-kerbs-0-0"];
  const roadBuilds: string[] = [];
  let autoAckBuildings = true;
  let heldSurface: string | undefined;
  let maxPendingTransfers = 0;
  let sourceFetches = 0;
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
      if (message.type === "batch" && (message.kind === "buildings" ? autoAckBuildings : message.id !== heldSurface)) {
        workerScope.onmessage!({ data: { type: "batch-attached", id: message.id } });
      }
      for (const wake of [...waiters]) wake();
    },
  };
  const bindings = {
    Group, performance, setTimeout,
    BuildingDetailWorker, PackedBuildingDistrictStore, buildingDetailProfile,
    buildingDetailDistricts, selectBuildingDetailDistricts,
    splitProgressiveBuildings, splitParkSurfaceFamily, surfaceFamilyPayload,
    serializeObject3DForTransfer, compactStaticGeometry, attachedBatchResolvers, attachedBatchPromises,
    MAX_TRANSFERRED_BATCHES_IN_FLIGHT: 4, WATER_TOP_Y: 0,
    mobileDetailWorker: undefined, latestMobileView: undefined,
    smoothGroundTopSampler: () => () => 0,
    createIsometricCity: (_prisms: unknown, _ground: unknown, _tunnel: unknown,
      _surfaces: unknown, options: { buildings: PrismBuilding[] }) => {
      buildingSources.push(options.buildings.map((building) => building.id));
      return new Group();
    },
    createSmoothSurfaces: (payload: SurfacePayload) => {
      surfaceSources.push(structuredClone(payload));
      return new Group();
    },
    createRestoredRoadSurfaceBatches: async function* (_ground: unknown, completed: ReadonlySet<string>) {
      for (const id of roadIds) {
        if (completed.has(id)) continue;
        roadBuilds.push(id);
        yield { id, root: new Group() };
      }
    },
    fetch: async (url: string) => {
      if (url === "prisms") sourceFetches += 1;
      return {
        ok: true,
        json: async () => structuredClone(url === "prisms" ? prisms : url === "surfaces" ? surfaces : {}),
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
  async function start(completedBatchIds: string[] = []): Promise<void> {
    const common = {
      type: "build" as const, initialBuildingCount: 1, prismUrl: "prisms",
      groundUrl: "ground", surfacesUrl: "surfaces", completedBatchIds,
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
    messages, buildingSources, surfaceSources, surfaces, roadIds, roadBuilds, attachedBatchPromises, attachedBatchResolvers,
    districts, defaultWanted, start, view, batches, buildingBatches, waitFor,
    ack: (id: string) => workerScope.onmessage!({ data: { type: "batch-attached", id } }),
    holdBuildingAcknowledgements: () => { autoAckBuildings = false; },
    holdSurfaceAcknowledgement: (id: string) => { heldSurface = id; },
    get buildingBuilds() { return buildingSources.length; },
    get surfaceBuilds() { return surfaceSources.length; },
    get sourceFetches() { return sourceFetches; },
    get maxPendingTransfers() { return maxPendingTransfers; },
  };
}

async function runWorker(profile: "full" | "mobile", retained: string[] = []) {
  const host = workerHost(profile);
  await host.start(retained);
  return host;
}

describe("complete source detail and resumable worker surfaces", () => {
  for (const profile of ["mobile", "full"] as const) {
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

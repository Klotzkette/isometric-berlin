import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { Group } from "three";
import type { PrismBuilding, PrismPayload } from "../src/IsometricCityWorld";
import {
  DESKTOP_TOTAL_BUILDING_LIMIT,
  splitParkSurfaceFamily, splitProgressiveBuildings, surfaceFamilyPayload,
  type ProgressiveWorldWorkerInput, type ProgressiveWorldWorkerMessage,
  type ProgressiveWorldWorkerOutput,
} from "../src/progressiveWorld";
import { BuildingDetailWorker } from "../src/buildingDetailWorker";
import { PackedBuildingDistrictStore } from "../src/packedBuildingDistrictStore";
import {
  MOBILE_DETAIL_BATCH_SIZE, buildingDetailDistricts, selectBuildingDetailDistricts,
} from "../src/buildingDetailStreaming";
import { serializeObject3DForTransfer } from "../src/transferableObject3D";

const source = await Bun.file(new URL("../src/progressiveWorld.worker.ts", import.meta.url)).text();
const parsed = ts.createSourceFile("progressiveWorld.worker.ts", source, ts.ScriptTarget.Latest, true);
const declarations = parsed.statements.filter(ts.isFunctionDeclaration).map((node) => node.getText(parsed));
const receiver = parsed.statements.find((node) => node.getText(parsed).startsWith("workerScope.onmessage ="));
if (!receiver) throw new Error("Missing production worker message receiver");
const compiled = ts.transpileModule([...declarations, receiver.getText(parsed)].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

// Execute the production Worker build AND control-message receiver. Only the
// geometry constructors and fetch are instrumented; source partitioning,
// streaming, ACKs and settled revisions are the actual production functions.
function workerHost() {
  const messages: ProgressiveWorldWorkerOutput[] = [];
  const attachedBatchResolvers = new Map<string, () => void>();
  const attachedBatchPromises = new Map<string, Promise<void>>();
  const buildingSources: string[][] = [];
  let surfaceBuilds = 0;
  let autoAcknowledge = true;
  let maxPendingTransfers = 0;
  let sourceFetches = 0;
  const waiters = new Set<() => void>();
  const prisms: PrismPayload = {
    schema_version: 1, classes: ["building"],
    buildings: Array.from({ length: 6_000 }, (_, index) => ({
      class: 0, h_dm: 100, y0_dm: 0, id: `fixture-${index}`,
      ring: [[index * 10, 0], [index * 10 + 5, 0], [index * 10, 5]],
    })),
  };
  const surfaces = {
    parks: Array.from({ length: 321 }, (_, index) => ({ id: index })),
    roads: [], water: [], lane_markings: [], scrub_points: [],
  };
  const partition = splitProgressiveBuildings(prisms.buildings, 1, MOBILE_DETAIL_BATCH_SIZE);
  const districts = buildingDetailDistricts(partition.remaining);
  const workerScope = {
    onmessage: null as ((event: { data: ProgressiveWorldWorkerMessage }) => void) | null,
    postMessage: (message: ProgressiveWorldWorkerOutput) => {
      messages.push(message);
      maxPendingTransfers = Math.max(maxPendingTransfers, attachedBatchPromises.size);
      if (message.type === "batch" && autoAcknowledge) {
        workerScope.onmessage!({ data: { type: "batch-attached", id: message.id } });
      }
      for (const wake of [...waiters]) wake();
    },
  };
  const bindings = {
    Group, performance, setTimeout,
    DESKTOP_TOTAL_BUILDING_LIMIT, MOBILE_DETAIL_BATCH_SIZE, BuildingDetailWorker, PackedBuildingDistrictStore,
    buildingDetailDistricts, selectBuildingDetailDistricts,
    splitProgressiveBuildings, splitParkSurfaceFamily, surfaceFamilyPayload,
    serializeObject3DForTransfer, attachedBatchResolvers, attachedBatchPromises,
    MAX_TRANSFERRED_BATCHES_IN_FLIGHT: 4, WATER_TOP_Y: 0,
    mobileDetailWorker: undefined, latestMobileView: undefined,
    smoothGroundTopSampler: () => () => 0,
    createIsometricCity: (_prisms: unknown, _ground: unknown, _tunnel: unknown,
      _surfaces: unknown, options: { buildings: PrismBuilding[] }) => {
      buildingSources.push(options.buildings.map((building) => building.id));
      return new Group();
    },
    createSmoothSurfaces: () => { surfaceBuilds += 1; return new Group(); },
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
      }, 2_000);
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
  async function start(detailProfile: "full" | "mobile", completedBatchIds: string[] = []): Promise<void> {
    const common = { type: "build" as const, initialBuildingCount: 1, prismUrl: "prisms", completedBatchIds };
    await build(detailProfile === "mobile" ? { ...common, detailProfile } : {
      ...common, detailProfile, groundUrl: "ground", surfacesUrl: "surfaces", tunnel: null,
    });
    await waitFor(() => messages.some((message) => message.type === (detailProfile === "mobile" ? "settled" : "complete")));
  }
  function view(requestedBatchIds: string[], retainedBatchIds: string[], viewRevision: number): void {
    workerScope.onmessage!({ data: { type: "detail-view", requestedBatchIds, retainedBatchIds, viewRevision } });
  }
  const batches = () => messages.filter((message) => message.type === "batch");
  return {
    messages, buildingSources, attachedBatchPromises, attachedBatchResolvers,
    districts, start, view, batches, waitFor,
    ack: (id: string) => workerScope.onmessage!({ data: { type: "batch-attached", id } }),
    holdAcknowledgements: () => { autoAcknowledge = false; },
    get buildingBuilds() { return buildingSources.length; },
    get surfaceBuilds() { return surfaceBuilds; },
    get sourceFetches() { return sourceFetches; },
    get maxPendingTransfers() { return maxPendingTransfers; },
  };
}

async function runWorker(profile: "full" | "mobile", retained: string[] = []) {
  const host = workerHost();
  await host.start(profile, retained);
  return host;
}

describe("production worker resumes after retained scene batches", () => {
  for (const profile of ["mobile", "full"] as const) {
    test(`${profile}: repeated suspension never reconstructs or retransfers attached geometry`, async () => {
      const initial = await runWorker(profile);
      const batches = initial.batches();
      expect(initial.buildingBuilds).toBe(profile === "mobile" ? 15 : 2);
      expect(initial.surfaceBuilds).toBe(profile === "mobile" ? 0 : 8);
      if (profile === "mobile") {
        expect(initial.buildingSources.every((buildings) => buildings.length <= MOBILE_DETAIL_BATCH_SIZE)).toBeTrue();
        expect(initial.maxPendingTransfers).toBe(1);
      }
      const retained = profile === "mobile" ? batches.slice(0, 7).map((message) => message.id) : [
        "buildings-1", "surface-water", "surface-parks-1", "surface-lane-markings",
      ];
      const resumed = await runWorker(profile, retained);
      const remaining = resumed.batches();
      expect(remaining.map((message) => message.id)).toEqual(
        batches.filter((message) => !retained.includes(message.id)).map((message) => message.id),
      );
      expect(resumed.buildingBuilds).toBe(profile === "mobile" ? 8 : 1);
      expect(resumed.surfaceBuilds).toBe(profile === "mobile" ? 0 : 5);
      expect(resumed.messages.at(-1)).toMatchObject(profile === "mobile"
        ? { type: "settled", viewRevision: 0 }
        : { type: "complete", batches: remaining.length });
      expect(resumed.attachedBatchPromises.size).toBe(0);
      expect(resumed.attachedBatchResolvers.size).toBe(0);

      // A pause after the final acknowledgement but before completion needs
      // only a completion response; it must not rebuild or duplicate anything.
      const finished = await runWorker(profile, batches.map((message) => message.id));
      expect(finished.buildingBuilds).toBe(0);
      expect(finished.surfaceBuilds).toBe(0);
      expect(finished.messages).toHaveLength(1);
      expect(finished.messages[0]).toMatchObject(profile === "mobile"
        ? { type: "settled", viewRevision: 0 }
        : { type: "complete", batches: 0 });
    });
  }

  test("mobile reaches source districts beyond its initial budget without refetching or rebuilding retained overlap", async () => {
    const host = await runWorker("mobile");
    const initialIds = host.batches().map((message) => message.id);
    const wanted = selectBuildingDetailDistricts(host.districts, [5_999, 0]);
    const retained = initialIds.filter((id) => wanted.includes(id));
    expect(wanted.some((id) => !initialIds.includes(id))).toBeTrue();
    const previousMessages = host.messages.length;
    const previousBuilds = host.buildingBuilds;
    host.view(wanted, retained, 1);
    await host.waitFor(() => host.messages.some((message) => message.type === "settled" && message.viewRevision === 1));
    const arrivals = host.messages.slice(previousMessages).filter((message) => message.type === "batch");
    expect(arrivals.map((message) => message.id)).toEqual(wanted.filter((id) => !retained.includes(id)));
    expect(host.buildingBuilds - previousBuilds).toBe(wanted.length - retained.length);
    expect(host.buildingSources.at(-1)!.length).toBeGreaterThan(0);
    expect(host.sourceFetches).toBe(1);
    expect(host.surfaceBuilds).toBe(0);
    expect(host.maxPendingTransfers).toBe(1);
    expect(host.attachedBatchPromises.size).toBe(0);
    expect(host.messages.some((message) => message.type === "complete")).toBeFalse();

    const beforeReturn = host.messages.length;
    const retainedOnReturn = wanted.filter((id) => initialIds.includes(id));
    host.view(initialIds, retainedOnReturn, 2);
    await host.waitFor(() => host.messages.some((message) => message.type === "settled" && message.viewRevision === 2));
    expect(host.messages.slice(beforeReturn).filter((message) => message.type === "batch").map((message) => message.id))
      .toEqual(initialIds.filter((id) => !retainedOnReturn.includes(id)));
    expect(host.sourceFetches).toBe(1);
    expect(host.buildingSources.every((buildings) => buildings.length > 0 && buildings.length <= MOBILE_DETAIL_BATCH_SIZE)).toBeTrue();
  });

  test("actual mobile receiver replaces an obsolete queued route at the first ACK boundary", async () => {
    const host = workerHost();
    host.holdAcknowledgements();
    const started = host.start("mobile");
    await host.waitFor(() => host.batches().length === 1);
    const original = host.batches()[0].id;
    const [remote, next] = selectBuildingDetailDistricts(host.districts, [5_999, 0]);
    host.view([remote, next], [], 1);
    await Promise.resolve();
    expect(host.batches()).toHaveLength(1);
    expect(host.buildingBuilds).toBe(1);
    host.ack(original);
    await host.waitFor(() => host.batches().length === 2);
    expect(host.batches()[1].id).toBe(remote);
    // This old revision cannot change the current route or claim 'next' is
    // retained. The handler and controller execute their actual code here.
    host.view([original], [next], 0);
    host.ack(remote);
    await host.waitFor(() => host.batches().length === 3);
    expect(host.batches()[2].id).toBe(next);
    host.ack(next);
    await started;
    expect(host.messages.at(-1)).toMatchObject({ type: "settled", viewRevision: 1 });
    expect(host.batches().map((message) => message.id)).toEqual([original, remote, next]);
    expect(host.maxPendingTransfers).toBe(1);
    expect(host.attachedBatchPromises.size).toBe(0);
    expect(host.attachedBatchResolvers.size).toBe(0);
  });
});

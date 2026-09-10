import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { Group } from "three";
import {
  DESKTOP_TOTAL_BUILDING_LIMIT, MOBILE_TOTAL_BUILDING_LIMIT,
  splitParkSurfaceFamily, splitProgressiveBuildings, surfaceFamilyPayload,
  type ProgressiveWorldWorkerInput, type ProgressiveWorldWorkerOutput,
} from "../src/progressiveWorld";
import { serializeObject3DForTransfer } from "../src/transferableObject3D";

const source = await Bun.file(new URL("../src/progressiveWorld.worker.ts", import.meta.url)).text();
const parsed = ts.createSourceFile("progressiveWorld.worker.ts", source, ts.ScriptTarget.Latest, true);
const declarations = parsed.statements.filter(ts.isFunctionDeclaration).map((node) => node.getText(parsed));
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

// Run the production Worker build and partitioning with instrumented geometry
// constructors. A skipped batch must avoid construction, not merely suppress
// its transfer after spending the CPU time and allocating all its buffers.
async function runWorker(detailProfile: "full" | "mobile", completedBatchIds: string[] = []) {
  const messages: ProgressiveWorldWorkerOutput[] = [];
  const attachedBatchResolvers = new Map<string, () => void>();
  const attachedBatchPromises = new Map<string, Promise<void>>();
  let buildingBuilds = 0;
  let surfaceBuilds = 0;
  const prisms = {
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
  const bindings = {
    Group, performance, setTimeout,
    DESKTOP_TOTAL_BUILDING_LIMIT, MOBILE_TOTAL_BUILDING_LIMIT,
    splitProgressiveBuildings, splitParkSurfaceFamily, surfaceFamilyPayload,
    serializeObject3DForTransfer, attachedBatchResolvers, attachedBatchPromises,
    MAX_TRANSFERRED_BATCHES_IN_FLIGHT: 4, WATER_TOP_Y: 0,
    smoothGroundTopSampler: () => () => 0,
    createIsometricCity: () => { buildingBuilds += 1; return new Group(); },
    createSmoothSurfaces: () => { surfaceBuilds += 1; return new Group(); },
    fetch: async (url: string) => ({
      ok: true,
      json: async () => structuredClone(url === "prisms" ? prisms : url === "surfaces" ? surfaces : {}),
    }),
    workerScope: {
      postMessage: (message: ProgressiveWorldWorkerOutput) => {
        messages.push(message);
        if (message.type !== "batch") return;
        const resolve = attachedBatchResolvers.get(message.id);
        attachedBatchResolvers.delete(message.id);
        resolve?.();
      },
    },
  };
  const build = new Function(...Object.keys(bindings), `${compiled}; return build;`)(
    ...Object.values(bindings),
  ) as (input: ProgressiveWorldWorkerInput) => Promise<void>;
  const common = { type: "build" as const, initialBuildingCount: 1, prismUrl: "prisms", completedBatchIds };
  await build(detailProfile === "mobile" ? { ...common, detailProfile } : {
    ...common, detailProfile, groundUrl: "ground", surfacesUrl: "surfaces", tunnel: null,
  });
  return { messages, buildingBuilds, surfaceBuilds, attachedBatchPromises, attachedBatchResolvers };
}

describe("production worker resumes after retained scene batches", () => {
  for (const profile of ["mobile", "full"] as const) {
    test(`${profile}: repeated suspension never reconstructs or retransfers attached geometry`, async () => {
      const initial = await runWorker(profile);
      const batches = initial.messages.filter((message) => message.type === "batch");
      expect(initial.buildingBuilds).toBe(profile === "mobile" ? 1 : 2);
      expect(initial.surfaceBuilds).toBe(profile === "mobile" ? 0 : 8);
      const retained = profile === "mobile" ? ["buildings-1"] : [
        "buildings-1", "surface-water", "surface-parks-1", "surface-lane-markings",
      ];
      const resumed = await runWorker(profile, retained);
      const remaining = resumed.messages.filter((message) => message.type === "batch");
      expect(remaining.map((message) => message.id)).toEqual(
        batches.filter((message) => !retained.includes(message.id)).map((message) => message.id),
      );
      expect(resumed.buildingBuilds).toBe(profile === "mobile" ? 0 : 1);
      expect(resumed.surfaceBuilds).toBe(profile === "mobile" ? 0 : 5);
      expect(resumed.messages.at(-1)).toMatchObject({ type: "complete", batches: remaining.length });
      expect(resumed.attachedBatchPromises.size).toBe(0);
      expect(resumed.attachedBatchResolvers.size).toBe(0);

      // A pause after the final acknowledgement but before completion needs
      // only a completion response; it must not rebuild or duplicate anything.
      const finished = await runWorker(profile, batches.map((message) => message.id));
      expect(finished.buildingBuilds).toBe(0);
      expect(finished.surfaceBuilds).toBe(0);
      expect(finished.messages).toHaveLength(1);
      expect(finished.messages[0]).toMatchObject({ type: "complete", batches: 0 });
    });
  }
});

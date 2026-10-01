import { interleaveStaticGeometry } from "../src/interleaveStaticGeometry";
import { expect, test } from "bun:test";
import ts from "typescript";
import {
  BufferGeometry, Group, InstancedMesh, Line, LineSegments, Material, Mesh, Points, Scene, Texture,
} from "three";
import {
  createParkDetails, createParkDetailsCooperative, setParkDetailsFocus,
  type ParkDetailsPayload,
} from "../src/ParkDetails";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";
import {
  createMinecraftMaterialState, releaseMinecraftMaterialBindings,
} from "../src/visual-modes/minecraft/materialMode";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const dispose = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "disposeObject3D");
if (!dispose) throw new Error("Missing production park disposal");
const beginning = source.indexOf("let deferredDetailsStarted = false;");
const ending = source.indexOf("runtime.tunnel = createTunnel", beginning);
if (beginning < 0 || ending < 0) throw new Error("Missing production deferred park lifecycle");
const compiled = ts.transpileModule(`${dispose.getText(parsed)}\n${source.slice(beginning, ending)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

const payload: ParkDetailsPayload = {
  schema_version: 7,
  source: { attribution: "OSM test", geometry_status: "lifecycle fixture", name: "OpenStreetMap" },
  paths: [{ id: "path", kind: "footway", m: "g", w: 180, points: [[0, 1, 0], [12, 1, 8]] }],
  trees: [{ id: "tree", crown_radius_m: 3, height_m: 12, leaf_type: "broadleaved", position: [5, 1, 10], variant: 2 }],
  playgrounds: [],
};

type Interruption = "background" | "context" | "family";

// Execute the viewer's actual deferred-load closure, cooperative park builder
// and disposal; replace only downloading, task dispatch and presentation hooks.
function host(options: {
  mobile?: boolean;
  interrupt?: Interruption;
  atCompletion?: boolean;
  failPresentation?: boolean;
} = {}) {
  const scene = new Scene();
  const previous = new Group();
  previous.name = "previous park";
  scene.add(previous);
  const loadController = new AbortController();
  const document = { hidden: false };
  const idleTasks: (() => void)[] = [];
  const pending: Promise<unknown>[] = [];
  const warnings: string[] = [];
  const staged: Group[] = [];
  const resources = new Map<BufferGeometry | Material | InstancedMesh, number>();
  let yields = 0;
  let fetches = 0;
  let obstacleWrites = 0;
  let interrupted = false;
  const runtime = {
    coarsePointer: options.mobile !== false, disposed: false, lightingMode: "day",
    progressiveWorldState: "complete", progressiveWorldInput: undefined,
    progressiveWorldStartCancel: undefined, districtPathTerrainAt: undefined,
    sceneRootUrl: new URL("https://test.invalid/mesh/"), parkDetails: previous,
    pedestrian: { environment: {} }, tunnelPortalCourse: null, underside: false,
    nightLightsOn: true, minecraftMaterialState: createMinecraftMaterialState(),
    startDeferredDetails: () => {}, gpuWarmup: { release: () => {} },
  };
  const watch = () => {
    for (const root of staged) root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const owned: (BufferGeometry | Material | InstancedMesh)[] = [
        object.geometry, ...objectMaterialsIncludingTransferredAlternates(object),
      ];
      if (object instanceof InstancedMesh) owned.push(object);
      for (const resource of owned) {
        if (resources.has(resource)) continue;
        resources.set(resource, 0);
        (resource as BufferGeometry).addEventListener("dispose", () => resources.set(resource, resources.get(resource)! + 1));
      }
    });
  };
  const interrupt = () => {
    if (interrupted) return;
    interrupted = true;
    if (options.interrupt === "background") document.hidden = true;
    if (options.interrupt === "family") runtime.lightingMode = "minecraft";
    if (options.interrupt === "context") {
      runtime.disposed = true;
      loadController.abort();
    }
  };
  const bindings = {
    interleaveStaticGeometry,
    Group, Mesh, InstancedMesh, Line, LineSegments, Material, Points, Texture,
    runtime, scene, document, loadController,
    manifest: { park_details: { file: "park.json" }, tiergartentunnel: null },
    window: { requestIdleCallback: (callback: () => void) => { idleTasks.push(callback); return idleTasks.length; } },
    selectedRef: { current: "test sight" },
    onWarningRef: { current: (warning: string) => warnings.push(warning) },
    isoWorldIntentActive: () => runtime.lightingMode !== "minecraft",
    voxelModeActive: () => runtime.lightingMode === "minecraft",
    fetchJsonWithRetry: () => {
      fetches++;
      return { then: (callback: (value: ParkDetailsPayload) => unknown) => ({
        catch: (failure: (error: unknown) => unknown) => {
          const finished = Promise.resolve(payload).then(callback).catch(failure);
          pending.push(finished);
          return finished;
        },
      }) };
    },
    createParkDetails,
    createParkDetailsCooperative: (...args: Parameters<typeof createParkDetailsCooperative>) => {
      const [data, settings, construction] = args;
      const result = createParkDetailsCooperative(data, settings, {
        ...construction, budgetMs: 0,
        onRoot: root => { staged.push(root); construction.onRoot(root); },
      });
      if (!options.atCompletion) return result;
      return result.then(root => {
        watch();
        // A context/visibility event queued before the awaiting caller resumes
        // must not let an already completed build publish to a retired scene.
        queueMicrotask(interrupt);
        return root;
      });
    },
    yieldStartupWork: async () => {
      yields++;
      expect(runtime.parkDetails).toBe(previous);
      expect(staged.every(root => root.parent === null)).toBe(true);
      watch();
      if (options.interrupt && !options.atCompletion && yields === 2) interrupt();
    },
    addPedestrianParkObstacles: () => { obstacleWrites++; },
    setParkDetailsFocus,
    applyLightingToRoot: () => { watch(); if (options.failPresentation) throw new Error("presentation failed"); },
    setMinecraftMaterialPresentation: () => {},
    setEnvironmentalPresentation: () => {}, collectFarZoomAntiFlickerTargets: () => {},
    invalidateScenePresentation: () => {},
    objectMaterialsIncludingTransferredAlternates, releaseMinecraftMaterialBindings,
  };
  const disposeScene = new Function(...Object.keys(bindings), `${compiled}; return () => disposeObject3D(runtime, scene);`)(...Object.values(bindings));
  return {
    runtime, scene, previous, document, staged, warnings, resources,
    get yields() { return yields; }, get fetches() { return fetches; },
    get obstacleWrites() { return obstacleWrites; },
    async start() {
      runtime.startDeferredDetails();
      while (idleTasks.length) idleTasks.shift()!();
      await pending.at(-1);
    },
    dispose: () => { watch(); disposeScene(); },
  };
}

test("mobile park publishes the complete scene once after cooperative tasks", async () => {
  const h = host();
  await h.start();
  expect(h.yields).toBeGreaterThan(5);
  expect(h.runtime.parkDetails).toBe(h.staged[0]);
  expect(h.scene.children).toEqual([h.staged[0]]);
  expect(h.obstacleWrites).toBe(1);
  await h.start();
  expect(h.fetches).toBe(1);
  expect(h.warnings).toHaveLength(0);
  h.dispose();
});

for (const interrupt of ["background", "context", "family"] as const) {
  test(`mobile ${interrupt} cancellation releases unpublished park resources`, async () => {
    const h = host({ interrupt });
    await h.start();
    expect(h.staged).toHaveLength(1);
    expect(h.staged[0].children).toHaveLength(0);
    expect(h.runtime.parkDetails).toBe(h.previous);
    expect(h.scene.children).toEqual([h.previous]);
    expect(h.resources.size).toBeGreaterThan(0);
    expect([...h.resources.values()]).toEqual([...h.resources.keys()].map(() => 1));
    expect(h.obstacleWrites).toBe(0);
    expect(h.warnings).toHaveLength(0);
    h.dispose();
  });
}

test("a resumed mobile tab can rebuild its cancelled park without stale duplicates", async () => {
  const h = host({ interrupt: "background" });
  await h.start();
  h.document.hidden = false;
  await h.start();
  expect(h.fetches).toBe(2);
  expect(h.staged).toHaveLength(2);
  expect(h.runtime.parkDetails).toBe(h.staged[1]);
  expect(h.scene.children).toEqual([h.staged[1]]);
  expect(h.obstacleWrites).toBe(1);
  expect(h.warnings).toHaveLength(0);
  h.dispose();
});

test("context loss at cooperative completion cannot publish a retired park", async () => {
  const h = host({ interrupt: "context", atCompletion: true });
  await h.start();
  expect(h.runtime.parkDetails).toBe(h.previous);
  expect(h.scene.children).toEqual([h.previous]);
  expect(h.staged[0].children).toHaveLength(0);
  expect([...h.resources.values()]).toEqual([...h.resources.keys()].map(() => 1));
  expect(h.obstacleWrites).toBe(0);
  expect(h.warnings).toHaveLength(0);
  h.dispose();
});

test("a failed park publication restores the previous root and frees the staged scene", async () => {
  const h = host({ failPresentation: true });
  await h.start();
  expect(h.runtime.parkDetails).toBe(h.previous);
  expect(h.scene.children).toEqual([h.previous]);
  expect(h.staged[0].children).toHaveLength(0);
  expect([...h.resources.values()]).toEqual([...h.resources.keys()].map(() => 1));
  expect(h.obstacleWrites).toBe(0);
  expect(h.warnings).toEqual(["presentation failed"]);
  h.dispose();
});

test("desktop park loading retains its synchronous construction path", async () => {
  const h = host({ mobile: false });
  await h.start();
  expect(h.yields).toBe(0);
  expect(h.staged).toHaveLength(0);
  expect(h.runtime.parkDetails).not.toBe(h.previous);
  expect(h.runtime.parkDetails.parent).toBe(h.scene);
  expect(h.obstacleWrites).toBe(1);
  expect(h.warnings).toHaveLength(0);
  h.dispose();
});

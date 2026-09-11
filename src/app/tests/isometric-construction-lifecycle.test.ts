import { expect, test } from "bun:test";
import ts from "typescript";
import {
  BoxGeometry, Group, InstancedMesh, LineSegments, Material, Mesh,
  MeshBasicMaterial, Scene, Texture,
} from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { compactStaticGeometrySteps } from "../src/compactStaticGeometry";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";
import {
  createMinecraftMaterialState, releaseMinecraftMaterialBindings,
} from "../src/visual-modes/minecraft/materialMode";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const names = ["ensureIsoWorld", "captureMutableRootSnapshots", "rollbackMutableRoots", "disposeObject3D"];
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = names.map(name => {
  const node = parsed.statements.find(entry => ts.isFunctionDeclaration(entry) && entry.name?.text === name);
  if (!node) throw new Error(`Missing production function ${name}`);
  return node.getText(parsed).replace(/^export\s+/, "")
    .replace(/import\("(\.\/[^\"]+)"\)/g, "loadAddon(\"$1\")")
    .replaceAll("import.meta.env.DEV", "false");
});
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

// Execute the production transaction and disposal. Only model constructors,
// downloading and unrelated presentation hooks are replaced by bounded fixtures.
function host(options: { stopAtTask?: number; modeAtTask?: number; failCommit?: boolean } = {}) {
  const built: Mesh[] = [];
  const disposed = new Map<Mesh, number>();
  const warnings: string[] = [];
  const existing = new Group(); existing.name = "existing signature";
  const concurrent = new Group(); concurrent.name = "independently loaded signature";
  let taskCount = 0;
  let ready = 0;
  let reported = 0;
  let pose = 0;
  let savedPose = -1;
  let releaseCount = 0;
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const loadController = new AbortController();
  const runtime = {
    disposed: false, loadSignal: loadController.signal,
    worldFailureReported: false, isoWorldState: "idle", coarsePointer: true,
    lightingMode: "schwellenraum", nightLightsOn: true, underside: false,
    scene: new Scene(), isoWorld: null as Group | null,
    signatures: new Group(), cityStaffage: new Group(), undergroundNetwork: new Group(),
    tramCatenary: new Group(), schwellenraumPraesentation: new Group(),
    schwellenraumWorldDetailsInstaller: null, tunnelPortalCourse: null,
    controls: { target: { x: 0, z: 0 } }, camera: {},
    pedestrian: { environment: null, requested: false },
    minecraftMaterialState: createMinecraftMaterialState(),
    progressiveWorldBatches: [], progressiveWorldState: "idle", progressiveWorldInput: undefined,
    reportCoreProgress: () => {}, startDeferredDetails: () => {},
    reportWorldFailure: () => { reported++; },
    gpuWarmup: { release: () => { releaseCount++; } },
  };
  runtime.signatures.add(existing);
  runtime.scene.add(runtime.signatures, runtime.cityStaffage, runtime.undergroundNetwork,
    runtime.tramCatenary, runtime.schwellenraumPraesentation);
  function model(name: string) {
    const group = new Group(); group.name = name;
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = name;
    mesh.geometry.userData.exactIndexPending = true;
    mesh.geometry.addEventListener("dispose", () => disposed.set(mesh, (disposed.get(mesh) ?? 0) + 1));
    built.push(mesh); group.add(mesh);
    return group;
  }
  const modules = {
    "./SpreeMuseumDetails": { createSpreeMuseumDetails: () => model("Spree") },
    "./UnterDenLindenDetails": { createUnterDenLindenDetails: () => model("Unter den Linden") },
    "./AbgeordnetenhausDetails": { createAbgeordnetenhausDetails: () => model("Abgeordnetenhaus") },
    "./GropiusBauDetails": { createGropiusBauDetails: () => model("Gropius Bau") },
  };
  const bindings = {
    Group, Mesh, InstancedMesh, LineSegments, Material, Texture,
    objectMaterialsIncludingTransferredAlternates, releaseMinecraftMaterialBindings,
    compactStaticGeometrySteps,
    completeCooperatively: (steps: Generator<void, unknown>, config: Parameters<typeof completeCooperatively>[1]) =>
      completeCooperatively(steps, { ...config, budgetMs: 0 }),
    yieldStartupWork: async () => {
      taskCount++;
      // No incomplete geometry or prepared addon is visible between tasks.
      expect(runtime.isoWorld).toBeNull();
      expect(runtime.signatures.children.every(child => child === existing || child === concurrent)).toBeTrue();
      pose++;
      if (taskCount === 2) runtime.signatures.add(concurrent);
      if (taskCount === options.stopAtTask) {
        runtime.disposed = true;
        runtime.worldFailureReported = true;
        loadController.abort();
      }
      if (taskCount === options.modeAtTask) runtime.lightingMode = "minecraft";
    },
    loadAddon: (path: keyof typeof modules) => Promise.resolve(modules[path]),
    fetchPrismPayload: async () => ({ buildings: [] }),
    fetchGroundPayload: async () => null, fetchStreetPayload: async () => null,
    fetchSurfacePayload: async () => null, fetchRailPayload: async () => null,
    isoWorldIntentActive: () => runtime.lightingMode !== "minecraft",
    createSchwellenraumMemorialProtectionIndex: () => ({}),
    splitProgressiveBuildings: () => ({ initial: [], remaining: [], omitted: [] }),
    buildingDetailDistricts: () => [], selectBuildingDetailDistricts: () => [], buildingDetailViewPoints: () => [],
    createIsometricCity: () => { const city = model("core"); city.add(model("drawn bridge structures")); return city; },
    createSchlossNaturkundeShells: () => model("Schloss and Naturkunde shells"),
    createSchlossNaturkundeFacades: () => model("Schloss and Naturkunde facades"),
    createProgressiveBuildingCoverage: () => model("coverage"),
    setWeidendammerBridgePresentation: () => {}, setSandkrugBridgePresentation: () => {},
    capturePedestrianAttachment: () => { savedPose = pose; return { underside: false, pose }; },
    restorePedestrianAttachment: (_: unknown, snapshot: { pose: number }) => { pose = snapshot.pose; },
    captureProgressiveWorld: () => ({}), restoreProgressiveWorld: () => {},
    collectFarZoomAntiFlickerTargets: () => {},
    setSceneLighting: () => { if (options.failCommit) throw new Error("commit failed"); },
    markSurfaceInteraction: () => {}, applyProgressiveWorldMode: () => {},
    releaseBuiltWorldPayloads: () => {}, releaseFailedWorldPayloads: () => {},
    notifyPresentationReadyWhenPossible: () => { ready++; },
    invalidateScenePresentation: () => {}, restoreWorldPresentationAfterRollback: () => {},
    performance: { mark: () => {} },
    MOBILE_INITIAL_BUILDING_COUNT: 1, DESKTOP_INITIAL_BUILDING_COUNT: 1,
    MOBILE_DETAIL_BATCH_SIZE: 1, DESKTOP_TOTAL_BUILDING_LIMIT: Infinity,
  };
  // The production loader intentionally returns void. A settled promise task
  // runs after its private chain's success/catch without exposing production APIs.
  const nativeAll = Promise.all.bind(Promise);
  const promise = {
    all: (values: Promise<unknown>[]) => ({
      then: (callback: (values: unknown[]) => unknown) => ({
        catch: (onError: (error: unknown) => void) => {
          void nativeAll(values).then(callback).catch(onError).finally(finish);
        },
      }),
    }),
  };
  const start = new Function(...Object.keys(bindings), "Promise", `${compiled}; return ensureIsoWorld;`)(
    ...Object.values(bindings), promise,
  );
  start(runtime, (warning: string) => warnings.push(warning));
  return { finished, runtime, built, disposed, warnings, existing, concurrent,
    get taskCount() { return taskCount; }, get ready() { return ready; },
    get reported() { return reported; }, get pose() { return pose; },
    get savedPose() { return savedPose; }, get releaseCount() { return releaseCount; } };
}

test("drawn construction publishes all staged geometry at the current pose", async () => {
  const h = host(); await h.finished;
  expect(h.taskCount).toBeGreaterThan(6);
  expect(h.built).toHaveLength(9);
  expect(h.disposed.size).toBe(0);
  expect(h.runtime.isoWorld?.parent).toBe(h.runtime.scene);
  expect(h.runtime.signatures.getObjectByName("drawn bridge structures")).toBeDefined();
  expect(h.runtime.signatures.children).toContain(h.concurrent);
  expect(h.pose).toBe(h.savedPose);
  expect(h.ready).toBe(1); expect(h.warnings).toHaveLength(0);
});

test("context loss cancels later allocations and frees every unpublished buffer", async () => {
  const h = host({ stopAtTask: 4 }); await h.finished;
  expect(h.built.length).toBeGreaterThan(0); expect(h.built.length).toBeLessThan(9);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.releaseCount).toBeGreaterThan(0);
  expect(h.ready).toBe(0); expect(h.reported).toBe(0); expect(h.warnings).toHaveLength(0);
});

test("an already retired context cannot start allocating the drawn city", async () => {
  const h = host({ stopAtTask: 1 }); await h.finished;
  expect(h.built).toHaveLength(0);
  expect(h.runtime.signatures.children).toEqual([h.existing]);
  expect(h.runtime.isoWorld).toBeNull();
  expect(h.ready).toBe(0); expect(h.reported).toBe(0);
});

test("a family change cancels the unpublished city and keeps the newer camera pose", async () => {
  const h = host({ modeAtTask: 4 }); await h.finished;
  expect(h.runtime.isoWorldState).toBe("idle"); expect(h.runtime.isoWorld).toBeNull();
  expect(h.savedPose).toBe(-1); expect(h.pose).toBe(4);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.reported).toBe(0); expect(h.warnings).toHaveLength(0);
});

test("commit rollback preserves independently loaded siblings and frees moved addons once", async () => {
  const h = host({ failCommit: true }); await h.finished;
  expect(h.runtime.isoWorldState).toBe("failed"); expect(h.runtime.isoWorld).toBeNull();
  expect(h.runtime.signatures.children).toEqual([h.existing, h.concurrent]);
  expect(h.built.map(mesh => h.disposed.get(mesh))).toEqual(h.built.map(() => 1));
  expect(h.pose).toBe(h.savedPose);
  expect(h.reported).toBe(1); expect(h.warnings).toHaveLength(1);
});

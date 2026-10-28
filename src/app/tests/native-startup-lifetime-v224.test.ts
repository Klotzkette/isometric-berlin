import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import ts from "typescript";
import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshBasicMaterial } from "three";
import { completeCooperatively } from "../src/cooperativeWork";
import { parkStaticInstancesSteps } from "../src/losslessStaticStorage";
import { createZooAnimalRuntimeV282 } from "../src/ZooAnimalsV282";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ensureVoxelWorld")!;
const compiled = ts.transpileModule(declaration.getText(parsed)
  .replaceAll("import.meta.env.DEV", "false")
  .replace('import("./RequiredSiteEnvelopesV209")', "loadSites()")
  .replace('import("./MinecraftVoxelWorld")', "loadBuilder()"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function digest(array: ArrayBufferView): string {
  return createHash("sha256").update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex");
}

async function run(cancellation?: "mode" | "disposed" | "parking-failure") {
  const events: string[] = [], disposedRoots: Group[] = [], warnings: string[] = [];
  const backing: Array<{ mesh: InstancedMesh; original: Float32Array; hash: string }> = [];
  let phase = "start", parkingYields = 0, bytesBeforeParking = 0, done = false;
  const runtime = {
    disposed: false, loadSignal: new AbortController().signal, worldFailureReported: false,
    tunnelPortalCourse: {}, voxelWorldState: "idle", voxelWorld: null as Group | null,
    lightingMode: "minecraft", coarsePointer: true, underside: false,
    pedestrian: { environment: null, requested: false }, signatures: new Group(), scene: new Group(),
    europaCenterStarTargets: [], europaCenterStarElapsedSeconds: 0, nightLightsOn: false,
    reportCoreProgress() {}, reportWorldFailure() { events.push("failure"); },
  };
  function model(name: string, count: number) {
    const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), count);
    mesh.name = name;
    backing.push({ mesh, original: mesh.instanceMatrix.array as Float32Array, hash: digest(mesh.instanceMatrix.array) });
    return mesh;
  }
  function afterParking(name: string) {
    events.push(name);
    // A reference to every actual constructor-created backing remains in this
    // fixture, so this measures detachment without relying on garbage collection.
    expect(backing.reduce((sum, item) => sum + item.original.byteLength, 0)).toBe(0);
  }
  const bindings = {
    Group,
    createZooAnimalRuntimeV282,
    fetchVoxelPayload: async () => ({}), fetchPrismPayload: async () => ({ buildings: [] }),
    voxelWorldIntentActive: () => runtime.lightingMode === "minecraft",
    preloadAltMitteNativeV169Source: async () => {},
    loadBuilder: async () => ({ buildColumnToneLookup: () => null,
      *buildMinecraftVoxelWorldSteps(root: Group) {
        events.push("constructor"); phase = "constructor";
        root.add(model("base", 16384)); yield;
      },
    }),
    loadSites: async () => ({ *addRequiredSiteEnvelopesV209Steps(root: Group) {
      events.push("site-cut"); phase = "sites";
      const item = backing[0];
      item.mesh.setMatrixAt(0, new Matrix4().makeTranslation(4, 8, 12));
      item.mesh.instanceMatrix.needsUpdate = true;
      item.hash = digest(item.mesh.instanceMatrix.array);
      root.add(model("site", 2048)); yield;
    } }),
    createRosengartenMinecraft: () => { events.push("garden"); return model("garden", 4096); },
    *parkStaticInstancesSteps(root: Group) {
      events.push("parking"); phase = "parking";
      bytesBeforeParking = backing.reduce((sum, item) => sum + item.original.byteLength, 0);
      yield* parkStaticInstancesSteps(root);
      events.push("parked"); phase = "parked";
    },
    completeCooperatively: (steps: Generator<void>, options: Parameters<typeof completeCooperatively>[1]) =>
      completeCooperatively(steps, { ...options, budgetMs: 0 }),
    yieldStartupWork: async () => {
      await Promise.resolve();
      if (phase !== "parking" || ++parkingYields !== 5 || !cancellation) return;
      if (cancellation === "mode") runtime.lightingMode = "day";
      else if (cancellation === "disposed") runtime.disposed = true;
      else throw new Error("parking scheduler unavailable");
    },
    capturePedestrianAttachment: () => { afterParking("capture"); return { underside: false }; },
    createMinecraftMobs: () => { afterParking("mobs"); return { group: new Group() }; },
    createMinecraftLootBoxes: () => { afterParking("loot"); return { group: new Group() }; },
    prepareVoxelNavigation: () => { afterParking("navigation"); return {}; },
    createBridgeStructures: () => { afterParking("bridges"); return new Group(); },
    createCoreSpreeBridgesV242: () => new Group(),
    registerBerlinerEnsembleRoofSignTargets() {}, isEuropaCenterStarTarget: () => false,
    updateEuropaCenterStars() {}, setSceneLighting() { events.push("lighting"); },
    createDeferredPedestrianWater: () => () => {}, activatePedestrianMode() {},
    markSurfaceInteraction() {}, releaseBuiltWorldPayloads() {},
    notifyPresentationReadyWhenPossible() { events.push(runtime.voxelWorld ? "ready" : "cancelled"); done = true; },
    forgetFarZoomAntiFlickerTargets() {}, invalidateScenePresentation() {},
    restoreWorldPresentationAfterRollback() {}, releaseFailedWorldPayloads() {},
    restorePedestrianAttachment() {},
    disposeObject3D(_runtime: unknown, root: Group) {
      disposedRoots.push(root); root.traverse(object => {
        if (object instanceof InstancedMesh) { object.dispose(); object.geometry.dispose(); (object.material as MeshBasicMaterial).dispose(); }
      }); root.clear(); if (runtime.disposed) done = true;
    },
  };
  const ensure = new Function(...Object.keys(bindings), `${compiled}; return ensureVoxelWorld;`)(...Object.values(bindings));
  ensure(runtime, (warning: string) => warnings.push(warning));
  for (let jobs = 0; jobs < 30 && !done; jobs++) await new Promise(resolve => setTimeout(resolve, 0));
  expect(done).toBe(true);
  return { runtime, events, disposedRoots, backing, bytesBeforeParking, warnings };
}

test("production native startup finishes site mutations and parks exact matrices before navigation allocations", async () => {
  const h = await run();
  expect(h.events).toEqual(["constructor", "site-cut", "garden", "parking", "parked", "capture", "mobs", "loot", "navigation", "bridges", "lighting", "ready"]);
  expect(h.disposedRoots).toHaveLength(0);
  expect(h.warnings).toHaveLength(0);
  expect(h.bytesBeforeParking).toBe(1_441_792);
  expect(h.runtime.voxelWorld!.children.map(child => child.name)).toEqual(["base", "site", "garden"]);
  for (const item of h.backing) expect(digest(item.mesh.instanceMatrix.array)).toBe(item.hash);
  expect(h.backing[0].mesh.instanceMatrix.array.slice(12, 15)).toEqual(new Float32Array([4, 8, 12]));
});

for (const cancellation of ["mode", "disposed", "parking-failure"] as const) {
  test(`production native startup retires its unpublished root after ${cancellation} interrupts parking`, async () => {
    const h = await run(cancellation);
    expect(h.runtime.voxelWorld).toBeNull();
    expect(h.runtime.scene.children).toHaveLength(0);
    expect(h.runtime.pedestrian.environment).toBeNull();
    expect(h.disposedRoots).toHaveLength(1);
    expect(h.events).not.toContain("mobs");
    expect(h.events).not.toContain("navigation");
    expect(h.events).not.toContain("bridges");
    expect(h.events).not.toContain("ready");
    expect(h.events).not.toContain("capture");
    expect(h.backing[0].original.byteLength).toBe(0);
    expect(h.warnings).toHaveLength(cancellation === "parking-failure" ? 1 : 0);
  });
}

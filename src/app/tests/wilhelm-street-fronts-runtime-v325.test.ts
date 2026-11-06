/** Execute the real lifetime code with tiny private source/model/host doubles.
 * The final real source/model/capture suite is independent of this orchestration. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from "three";

const source = readFileSync(new URL("../src/WilhelmStreetFrontsV325Runtime.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("runtime.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const drain = <T>(steps: Generator<void, T>): T => { for (;;) { const next = steps.next(); if (next.done) return next.value; } };
function fixture() {
  const controls = { bind: true, source: true, model: true, previous: true, missingPrevious: false, core: true, throwModel: false, throwPark: false };
  const events: string[] = [], bindings: any[] = [], models = new Map<Group, { native: boolean; ready: boolean; disposed: boolean }>();
  const sourceReceipts = new WeakMap<object, boolean>(), modelSources = new Map<Group, object>(), original = new BufferAttribute(Uint16Array.from([0, 1, 2]), 1);
  const old = new Mesh(new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(9), 3)).setIndex(original), new MeshBasicMaterial());
  const world = new Group().add(old); let api: any, coreReads = 0, previousCalls = 0;
  const dispose = (root: Group) => {
    const model = models.get(root); if (!model || model.disposed) return;
    model.disposed = true; model.ready = false; root.removeFromParent(); root.clear(); events.push("model-dispose");
  };
  const modelValid = (root: Group, native: boolean) => {
    const model = models.get(root); return !!model && model.ready && !model.disposed && model.native === native && controls.model && controls.source && root.visible;
  };
  const deps = {
    Group,
    bindWilhelmStreetFrontsV325SourcesSteps: function* (prisms: unknown[], nativeSource: any, native: boolean) {
      bindings.push([prisms, nativeSource, native]); yield;
      if (!controls.bind || !controls.source || native && (!nativeSource.core || !nativeSource.voxels)) return null;
      const receipt = Object.freeze({ source: true }); sourceReceipts.set(receipt, native); return receipt;
    },
    hasWilhelmStreetFrontsV325Sources: (receipt: object, native: boolean) => sourceReceipts.has(receipt) && sourceReceipts.get(receipt) === native && controls.source,
    createWilhelmStreetFrontsV325Steps: function* (options: any, onCreate: (root: Group) => void) {
      expect(options.sourceReceipt).toBeDefined(); expect(options.sourcePrisms).toBeUndefined();
      const root = new Group(); models.set(root, { native: options.native, ready: false, disposed: false }); modelSources.set(root, options.sourceReceipt); let delivered = false;
      try { onCreate(root); yield; root.add(new Group()); yield; if (controls.throwModel) throw Error("constructor failed");
        models.get(root)!.ready = true; delivered = true; return root;
      } finally { if (!delivered) dispose(root); }
    },
    hasCompleteWilhelmStreetFrontsV325: modelValid,
    disposeWilhelmStreetFrontsV325: dispose,
    prepareWilhelmStreetFrontsPreviousV325Steps: function* (target: Group, native: boolean, model: Group, receipt: object, hooks: any = {}) {
      previousCalls++; expect(native).toBeTrue(); expect(target).toBe(world); expect(model.parent).toBe(world); expect(sourceReceipts.get(receipt)).toBeTrue();
      yield; if (controls.missingPrevious) return null;
      let active = false, closed = false, gate = () => false;
      const transaction = {
        prepared: () => !closed && !active && controls.previous,
        commit(input: () => boolean) {
          if (closed || !controls.previous || !input()) return false;
          if (hooks.beforeSwap?.(old, "geometry") === false) return false;
          old.geometry.setIndex(Uint16Array.from([0, 0, 0])); gate = input; active = true; events.push("previous-commit"); hooks.afterSwap?.(); return true;
        },
        complete: () => { const ready = active && !closed && controls.previous && gate(); if (active && !ready) transaction.rollback(); return ready; },
        rollback() { if (closed) return; closed = true; active = false; old.geometry.setIndex(original); events.push("previous-rollback"); hooks.afterSwap?.(); },
        *parkRetiredSourcesSteps() { yield; if (controls.throwPark) throw Error("parking failed"); yield; return 6; },
      };
      return transaction;
    },
  };
  const exports: any = {};
  new Function("exports", ...Object.keys(deps), code)(exports, ...Object.values(deps)); api = exports;
  const create = (native = false, onCreate?: (model: Group) => void) => api.createWilhelmStreetFrontsRuntimeV325Steps(world, [], { actual: "voxels" }, native, false, { actual: "core" }, onCreate) as Generator<void, Group | null>;
  // Stand-in for the actual V324 world owner's one combined Native operation.
  // The new runtime observes this receipt and never performs its own swap.
  const previous = (native = true, hooks: any = {}) => (function* (): Generator<void, boolean> {
    if (!native) return yield* api.prepareWilhelmStreetFrontsRuntimePreviousV325Steps(world, false, hooks);
    const model = api.getWilhelmStreetFrontsModelV325(world, true);
    if (!model) return false;
    let tx: any, delivered = false;
    try {
      tx = yield* deps.prepareWilhelmStreetFrontsPreviousV325Steps(world, true, model, modelSources.get(model)!, hooks);
      if (!tx || !tx.prepared() || !tx.commit(() => !!api.getWilhelmStreetFrontsModelV325(world, true))) return false;
      if (!api.attachWilhelmStreetFrontsPreviousGateV325(world, true, () => tx.complete())) return false;
      yield* tx.parkRetiredSourcesSteps();
      delivered = tx.complete(); return delivered;
    } catch { return false; }
    finally { if (!delivered) { tx?.rollback(); api.releaseWilhelmStreetFrontsRuntimeV325(world, true); } }
  })();
  const has = (native = false) => api.hasWilhelmStreetFrontsRuntimeV325(world, native);
  const raw = (native = false) => api.getWilhelmStreetFrontsModelV325(world, native);
  const release = (native = false) => api.releaseWilhelmStreetFrontsRuntimeV325(world, native);
  const attach = (native = false) => api.attachWilhelmStreetFrontsCoreGateV325(world, native, () => { coreReads++; return controls.core && !!raw(native); });
  return { api, controls, events, bindings, models, world, old, original, create, previous, has, raw, release, attach, previousCalls: () => previousCalls, coreReads: () => coreReads };
}

test("Drawn has one complete private lifetime and actual Core gate, with no invented previous-owner claim", () => {
  const f = fixture(), root = drain(f.create()); expect(root).not.toBeNull(); expect(root!.parent).toBe(f.world);
  expect(f.raw()).toBe(root); expect(f.has()).toBeFalse(); expect(drain(f.previous(false))).toBeTrue(); expect(f.previousCalls()).toBe(0);
  expect(f.attach()).toBeTrue(); expect(f.has()).toBeTrue(); expect(f.old.geometry.index).toBe(f.original);
  f.release(); f.release(); expect(f.raw()).toBeUndefined(); expect(f.has()).toBeFalse(); expect(f.events.filter(e => e === "model-dispose")).toHaveLength(1);
  expect(f.old.geometry.index).toBe(f.original); expect(f.coreReads()).toBeGreaterThan(0);
});

test("Native requires its actual complete predecessor before the real shared-Core gate can attach", () => {
  const f = fixture(), root = drain(f.create(true)); expect(root).not.toBeNull(); expect(f.has(true)).toBeFalse();
  const input = f.api.getWilhelmStreetFrontsPreviousInputV325(f.world, true);
  expect(input.model).toBe(root); expect(input.sourceReceipt).toBeDefined();
  expect(f.api.getWilhelmStreetFrontsPreviousInputV325(f.world, false)).toBeUndefined();
  expect(drain(f.api.prepareWilhelmStreetFrontsRuntimePreviousV325Steps(f.world, true))).toBeFalse();
  expect(f.previousCalls()).toBe(0); expect(f.old.geometry.index).toBe(f.original);
  expect(f.bindings[0][1]).toEqual({ core: { actual: "core" }, voxels: { actual: "voxels" } });
  expect(drain(f.previous())).toBeTrue(); expect(f.previousCalls()).toBe(1); expect(f.old.geometry.index).not.toBe(f.original);
  expect(f.has(true)).toBeFalse(); expect(f.attach(true)).toBeTrue(); expect(f.has(true)).toBeTrue();
  f.release(true); expect(f.old.geometry.index).toBe(f.original); expect(f.raw(true)).toBeUndefined();
  expect(f.events.indexOf("previous-rollback")).toBeGreaterThan(f.events.indexOf("model-dispose"));
  const premature = fixture(); drain(premature.create(true)); expect(premature.attach(true)).toBeFalse(); expect(premature.raw(true)).toBeUndefined();
});

test("every constructor checkpoint and a failing onCreate own cancellation exactly once", () => {
  for (let checkpoint = 0; checkpoint <= 2; checkpoint++) {
    const f = fixture(), steps = f.create(); for (let i = 0; i <= checkpoint; i++) expect(steps.next().done).toBeFalse();
    expect(f.has()).toBeFalse(); steps.return(null); expect(f.raw()).toBeUndefined(); expect(f.world.children).toHaveLength(1);
    expect(f.events.filter(e => e === "model-dispose").length).toBeLessThanOrEqual(1);
  }
  const thrown = fixture(); expect(drain(thrown.create(false, () => { throw Error("onCreate"); }))).toBeNull(); expect(thrown.world.children).toHaveLength(1);
  const released = fixture(), steps = released.create(false, () => released.release()); expect(drain(steps)).toBeNull(); expect(released.world.children).toHaveLength(1);
  const failed = fixture(); failed.controls.throwModel = true; expect(drain(failed.create())).toBeNull(); expect(failed.world.children).toHaveLength(1);
});

test("failed or absent current sources and unsupported hosts create no public model", () => {
  for (const failure of ["bind", "source"] as const) { const f = fixture(); f.controls[failure] = false; expect(drain(f.create())).toBeNull(); expect(f.has()).toBeFalse(); expect(f.world.children).toHaveLength(1); }
  const f = fixture(); expect(drain(f.api.createWilhelmStreetFrontsRuntimeV325Steps(new Object3D(), []))).toBeNull(); expect(f.bindings).toHaveLength(0);
  const active = f.create(); active.next(); expect(drain(f.create())).toBeNull(); active.return(null); expect(f.raw()).toBeUndefined();
});

test("release while Native parking is suspended restores original buffers synchronously", () => {
  const f = fixture(); drain(f.create(true)); const steps = f.previous(); steps.next(); steps.next();
  expect(f.old.geometry.index).not.toBe(f.original); f.release(true); expect(f.old.geometry.index).toBe(f.original);
  expect(drain(steps)).toBeFalse(); expect(f.has(true)).toBeFalse(); expect(f.world.children).toHaveLength(1);
});

test("a missing/failed/cancelled Native host or GPU hook rolls back before discarding the model", () => {
  for (const failure of ["missing", "before", "after", "park", "cancel"] as const) {
    const f = fixture(); drain(f.create(true)); if (failure === "missing") f.controls.missingPrevious = true;
    if (failure === "park") f.controls.throwPark = true;
    const steps = f.previous(true, { beforeSwap: () => failure === "before" ? false : true,
      afterSwap: () => { if (failure === "after") f.release(true); } });
    if (failure === "cancel") { steps.next(); steps.return(false); } else expect(drain(steps)).toBeFalse();
    expect(f.old.geometry.index).toBe(f.original); expect(f.raw(true)).toBeUndefined(); expect(f.world.children).toHaveLength(1);
  }
});

test("hidden mode ancestors remain valid; changed source/model/parent/Core/Native host revoke the complete lifetime", () => {
  for (const native of [false, true]) for (const failure of ["source", "model", "parent", "core", ...(native ? ["previous"] : [])] as const) {
    const f = fixture(); drain(f.create(native)); if (native) drain(f.previous()); expect(f.attach(native)).toBeTrue();
    const ancestor = new Group().add(f.world); ancestor.visible = false; f.world.visible = false; expect(f.has(native)).toBeTrue();
    if (failure === "parent") f.raw(native)!.removeFromParent(); else f.controls[failure as "source"] = false;
    expect(f.has(native)).toBeFalse(); expect(f.raw(native)).toBeUndefined(); expect(f.old.geometry.index).toBe(f.original);
  }
});

test("source loss before Core attachment releases both plain and already-staged Native lifetimes", () => {
  for (const native of [false, true]) for (const lookup of ["get", "has", "attach"] as const) {
    const f = fixture(); drain(f.create(native)); if (native) drain(f.previous()); f.controls.source = false;
    if (lookup === "get") expect(f.raw(native)).toBeUndefined();
    else if (lookup === "has") expect(f.has(native)).toBeFalse(); else expect(f.attach(native)).toBeFalse();
    expect(f.world.children).toHaveLength(1); expect(f.old.geometry.index).toBe(f.original);
  }
});

test("raw Government callbacks remain finite and accidental full-gate recursion fails closed", () => {
  const f = fixture(); drain(f.create());
  expect(f.api.attachWilhelmStreetFrontsCoreGateV325(f.world, false, () => f.has())).toBeFalse();
  expect(f.has()).toBeFalse(); expect(f.raw()).toBeUndefined();
  const separate = fixture(); drain(separate.create(false)); drain(separate.create(true)); drain(separate.previous());
  expect(separate.attach(false)).toBeTrue(); expect(separate.attach(true)).toBeTrue(); separate.release(false);
  expect(separate.has(true)).toBeTrue(); separate.release(true); expect(separate.old.geometry.index).toBe(separate.original);
});

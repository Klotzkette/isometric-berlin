/** Actual runtime orchestration with tiny privately branded constructor/tx doubles.
 * Real source, model and previous-owner proofs have their separate full suites. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from "three";

const source = readFileSync(new URL("../src/WilhelmHousingV324Runtime.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("WilhelmHousingV324Runtime.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const implementation = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast)).join("\n");
const javascript = ts.transpileModule(implementation, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const drain = <T>(steps: Generator<void, T>): T => { for (;;) { const next = steps.next(); if (next.done) return next.value; } };
function oldHost(): Group {
  const root = new Group(), geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setIndex([0, 1, 2]); root.add(new Mesh(geometry, new MeshBasicMaterial()));
  return root;
}
const mesh = (root: Group) => root.children[0] as Mesh;

function fixture() {
  const controls = { source: true, bind: true, model: true, throwModel: false,
    previousMissing: false, legacyMissing: false, previous: true, legacy: true, core: true, throwPark: false };
  const events: string[] = [], bindings: unknown[][] = [], options: Record<string, unknown>[] = [];
  const receipts = new WeakMap<object, boolean>();
  const models = new Map<Group, { native: boolean; receipt: object; ready: boolean; disposed: boolean }>();
  const disposal = new Map<Group, number>();
  const dispose = (root: Group) => {
    const state = models.get(root); if (!state || state.disposed) return;
    state.disposed = true; state.ready = false; root.removeFromParent();
    for (const object of root.children as Mesh[]) { object.geometry.dispose(); (object.material as MeshBasicMaterial).dispose(); }
    root.clear(); disposal.set(root, (disposal.get(root) ?? 0) + 1); events.push("model-dispose");
  };
  const modelComplete = (root: Group, native: boolean) => {
    const state = models.get(root);
    return !!state && state.ready && !state.disposed && state.native === native && controls.model && controls.source && root.visible;
  };
  let api: any;
  const dependencies = {
    Group,
    bindWilhelmHousingV324SourcesSteps: function* (prisms: readonly unknown[], nativeSource: any, native: boolean) {
      bindings.push([prisms, nativeSource, native]); yield;
      if (!controls.bind || !controls.source || native && (!nativeSource.core || !nativeSource.voxels)) return null;
      const receipt = Object.freeze({ source: true }); receipts.set(receipt, native); return receipt;
    },
    hasWilhelmHousingV324Sources: (receipt: object, native: boolean) => receipts.has(receipt) && receipts.get(receipt) === native && controls.source,
    createWilhelmHousingV324Steps: function* (input: any, onCreate: (root: Group) => void) {
      options.push(input);
      const root = new Group(); let delivered = false;
      models.set(root, { native: input.native, receipt: input.sourceReceipt, ready: false, disposed: false });
      try {
        onCreate(root); yield;
        const geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(9), 3));
        root.add(new Mesh(geometry, new MeshBasicMaterial())); yield;
        if (controls.throwModel) throw Error("constructor failed");
        yield; models.get(root)!.ready = true; delivered = true; return root;
      } finally { if (!delivered) dispose(root); }
    },
    hasCompleteWilhelmHousingV324: modelComplete,
    disposeWilhelmHousingV324: dispose,
    prepareWilhelmHousingPreviousV324Steps: function* (world: Group, native: boolean, model: Group, receipt: object, hooks: any = {}) {
      events.push("previous-prepare"); expect(model.parent).toBe(world); expect(receipts.get(receipt)).toBe(native);
      yield; return controls.previousMissing ? null : transaction("previous", world, hooks);
    },
    prepareWilhelmHousingLegacyV324Steps: function* (target: Group, _model: Group, receipt: object, hooks: any = {}) {
      events.push("legacy-prepare"); expect(receipts.get(receipt)).toBe(false);
      yield; return controls.legacyMissing ? null : transaction("legacy", target, hooks);
    },
  };
  function transaction(kind: "previous" | "legacy", target: Group, hooks: any) {
    const object = mesh(target), original = object.geometry.index!;
    let active = false, closed = false, gate: (() => boolean) | undefined;
    const rollback = () => {
      if (closed) return; closed = true;
      if (active) { object.geometry.setIndex(original); active = false; hooks.afterSwap?.(); }
      events.push(`${kind}-rollback`);
    };
    const complete = () => {
      const valid = !closed && active && controls[kind] && gate?.() === true;
      if (!valid && active) rollback(); return valid;
    };
    return { prepared: () => !closed, complete, rollback,
      commit(next: () => boolean) {
        gate = next;
        if (closed || !gate() || hooks.beforeSwap?.(object, "geometry") === false) return false;
        object.geometry.setIndex([0, 0, 0]); active = true; events.push(`${kind}-commit`); hooks.afterSwap?.();
        return complete();
      },
      *parkRetiredSourcesSteps() { yield; if (controls.throwPark) throw Error("parking failed"); return 12; },
    };
  }
  const exports: Record<string, unknown> = {};
  api = new Function("exports", ...Object.keys(dependencies), `${javascript}\nreturn exports;`)(exports, ...Object.values(dependencies));
  const world = oldHost(), prisms = [{ id: "complete-synthetic-source" }], voxels = {}, core = {};
  const create = (native = false, onCreate?: (root: Group) => void) =>
    drain(api.createWilhelmHousingRuntimeV324Steps(world, prisms, voxels, native, true, native ? core : undefined, onCreate)) as Group | null;
  const previous = (native = false, hooks?: unknown) => drain(api.prepareWilhelmHousingRuntimePreviousV324Steps(world, native, hooks));
  const activate = (native = false) => api.attachWilhelmHousingCoreGateV324(world, native, () => controls.core);
  return { api, world, prisms, voxels, core, controls, events, bindings, options, models, disposal, create, previous, activate };
}

test("raw construction is private and complete before exact Previous; full admission additionally requires the real Core gate", () => {
  const f = fixture(), oldIndex = mesh(f.world).geometry.index;
  expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeFalse();
  const root = f.create()!; expect(root).not.toBeNull(); expect(root.parent).toBe(f.world);
  expect(f.api.getWilhelmHousingModelV324(f.world, false)).toBe(root);
  expect(f.api.getWilhelmHousingModelV324(f.world, true)).toBeUndefined();
  expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeFalse();
  expect(mesh(f.world).geometry.index).toBe(oldIndex); expect(f.create()).toBeNull();
  expect(f.previous()).toBeTrue(); expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeFalse();
  expect(f.activate()).toBeTrue(); expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeTrue();
  f.api.releaseWilhelmHousingRuntimeV324(f.world, false);
  expect(mesh(f.world).geometry.index).toBe(oldIndex); expect(f.disposal.get(root)).toBe(1);
  expect(f.api.getWilhelmHousingModelV324(f.world, false)).toBeUndefined();
  f.api.releaseWilhelmHousingRuntimeV324(f.world, false); expect(f.disposal.get(root)).toBe(1);
});

test("Native binding receives the actual Core/Voxel sources once and never stages Drawn Legacy", () => {
  const f = fixture(), root = f.create(true)!; expect(root).not.toBeNull();
  expect(f.bindings).toEqual([[f.prisms, { core: f.core, voxels: f.voxels }, true]]);
  expect(f.options).toHaveLength(1); expect(f.options[0].mobileLike).toBeTrue();
  expect(f.options[0].sourceReceipt).toBeDefined(); expect(f.options[0].sourcePrisms).toBeUndefined();
  expect(f.options[0].nativeSource).toBeUndefined();
  expect(f.previous(true)).toBeTrue(); expect(f.activate(true)).toBeTrue();
  expect(drain(f.api.stageWilhelmHousingLegacyV324Steps(f.world, true, oldHost()))).toBeFalse();
  expect(f.events).not.toContain("legacy-prepare");
  f.api.releaseWilhelmHousingRuntimeV324(f.world, true); expect(f.disposal.get(root)).toBe(1);
});

test("failed source binding, unsupported hosts and constructor exceptions leave no model or claim", () => {
  const f = fixture(); f.controls.bind = false;
  expect(f.create()).toBeNull(); expect(f.world.children).toHaveLength(1); expect(f.options).toHaveLength(0);
  f.controls.bind = true; f.controls.throwModel = true;
  expect(f.create()).toBeNull(); expect(f.world.children).toHaveLength(1);
  expect([...f.disposal.values()]).toEqual([1]);
  expect(drain(f.api.createWilhelmHousingRuntimeV324Steps(new Object3D(), f.prisms))).toBeNull();
  f.controls.throwModel = false; expect(f.create()).not.toBeNull(); f.api.releaseWilhelmHousingRuntimeV324(f.world, false);
});

test("every unpublished constructor checkpoint owns cancellation and a synchronous onCreate failure exactly once", () => {
  for (const checkpoint of [0, 1, 2, 3, 4]) {
    const f = fixture(), steps = f.api.createWilhelmHousingRuntimeV324Steps(f.world, f.prisms, f.voxels, false);
    for (let i = 0; i < checkpoint; i++) if (steps.next().done) break;
    steps.return(null); expect(f.world.children).toHaveLength(1);
    expect(f.api.getWilhelmHousingModelV324(f.world, false)).toBeUndefined();
    expect([...f.disposal.values()].every(value => value === 1)).toBeTrue();
    expect(f.create()).not.toBeNull(); f.api.releaseWilhelmHousingRuntimeV324(f.world, false);
  }
  const f = fixture();
  expect(f.create(false, root => { expect(root.parent).toBe(f.world); throw Error("caller failed"); })).toBeNull();
  expect(f.world.children).toHaveLength(1); expect([...f.disposal.values()]).toEqual([1]);
  const pending = fixture(), steps = pending.api.createWilhelmHousingRuntimeV324Steps(pending.world, pending.prisms, pending.voxels);
  steps.next(); steps.next(); expect(pending.world.children).toHaveLength(2);
  pending.api.releaseWilhelmHousingRuntimeV324(pending.world, false);
  expect(drain(steps)).toBeNull(); expect(pending.world.children).toHaveLength(1);
  expect([...pending.disposal.values()]).toEqual([1]);
});

test("source loss before Core attachment still restores the already committed dedicated Previous owner", () => {
  for (const lookup of ["get", "has", "attach"] as const) {
    const f = fixture(), root = f.create()!, old = mesh(f.world).geometry.index;
    expect(f.previous()).toBeTrue(); f.controls.source = false;
    if (lookup === "get") expect(f.api.getWilhelmHousingModelV324(f.world, false)).toBeUndefined();
    else if (lookup === "has") expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeFalse();
    else expect(f.activate()).toBeFalse();
    expect(mesh(f.world).geometry.index).toBe(old); expect(f.disposal.get(root)).toBe(1);
  }
});

test("release during suspended Previous parking restores exact original words before the generator resumes", () => {
  const f = fixture(), root = f.create()!, old = mesh(f.world).geometry.index;
  const steps = f.api.prepareWilhelmHousingRuntimePreviousV324Steps(f.world, false);
  expect(steps.next().done).toBeFalse(); expect(steps.next().done).toBeFalse();
  expect(Array.from(mesh(f.world).geometry.index!.array)).toEqual([0, 0, 0]);
  f.api.releaseWilhelmHousingRuntimeV324(f.world, false);
  expect(mesh(f.world).geometry.index).toBe(old); expect(f.disposal.get(root)).toBe(1);
  expect(drain(steps)).toBeFalse(); expect(f.events.filter(e => e === "previous-rollback")).toHaveLength(1);
});

test("failed/cancelled dedicated Previous preparation removes the replacement and rolls back committed buffers", () => {
  for (const failure of ["missing", "hook", "hook-release", "parking", "cancel"] as const) {
    const f = fixture(), root = f.create()!, old = mesh(f.world).geometry.index;
    f.controls.previousMissing = failure === "missing"; f.controls.throwPark = failure === "parking";
    const hooks = failure === "hook" ? { beforeSwap: () => false } : failure === "hook-release" ? { afterSwap: () => f.api.releaseWilhelmHousingRuntimeV324(f.world, false) } : {};
    const steps = f.api.prepareWilhelmHousingRuntimePreviousV324Steps(f.world, false, hooks);
    if (failure === "cancel") { steps.next(); steps.next(); steps.return(false); }
    else expect(drain(steps)).toBeFalse();
    expect(mesh(f.world).geometry.index).toBe(old); expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeFalse();
    expect(f.disposal.get(root)).toBe(1); expect(f.world.children).toHaveLength(1);
  }
});

test("late missing Legacy can retry; release during its parking restores both dedicated transactions", () => {
  const f = fixture(), root = f.create()!, old = mesh(f.world).geometry.index, cultural = oldHost(), oldLegacy = mesh(cultural).geometry.index;
  expect(f.previous()).toBeTrue(); expect(f.activate()).toBeTrue(); f.controls.legacyMissing = true;
  expect(drain(f.api.stageWilhelmHousingLegacyV324Steps(f.world, false, cultural))).toBeFalse();
  expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeTrue();
  expect(mesh(cultural).geometry.index).toBe(oldLegacy); f.controls.legacyMissing = false;
  const steps = f.api.stageWilhelmHousingLegacyV324Steps(f.world, false, cultural);
  expect(steps.next().done).toBeFalse(); expect(steps.next().done).toBeFalse();
  expect(Array.from(mesh(cultural).geometry.index!.array)).toEqual([0, 0, 0]);
  f.api.releaseWilhelmHousingRuntimeV324(f.world, false);
  expect(mesh(cultural).geometry.index).toBe(oldLegacy); expect(mesh(f.world).geometry.index).toBe(old); expect(f.disposal.get(root)).toBe(1);
  expect(drain(steps)).toBeFalse();
});

test("hidden ancestors preserve complete ownership; a detached model or revoked source/Core restores every owner synchronously", () => {
  for (const failure of ["detach", "source", "model", "previous", "legacy", "core"] as const) {
    const f = fixture(), root = f.create()!, old = mesh(f.world).geometry.index, cultural = oldHost(), oldLegacy = mesh(cultural).geometry.index;
    const parent = new Group(); parent.add(f.world); expect(f.previous()).toBeTrue(); expect(f.activate()).toBeTrue();
    expect(drain(f.api.stageWilhelmHousingLegacyV324Steps(f.world, false, cultural))).toBeTrue();
    const prepares = f.events.filter(e => e === "legacy-prepare").length;
    expect(drain(f.api.stageWilhelmHousingLegacyV324Steps(f.world, false, cultural))).toBeTrue();
    expect(f.events.filter(e => e === "legacy-prepare")).toHaveLength(prepares);
    parent.visible = false; f.world.visible = false;
    expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeTrue();
    if (failure === "detach") root.removeFromParent(); else f.controls[failure] = false;
    expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeFalse();
    expect(mesh(f.world).geometry.index).toBe(old); expect(mesh(cultural).geometry.index).toBe(oldLegacy);
    expect(f.disposal.get(root)).toBe(1); expect(f.api.getWilhelmHousingModelV324(f.world, false)).toBeUndefined();
  }
});

test("raw Government construction and full Core admission cannot create a recursive readonly callback loop", () => {
  const f = fixture(), root = f.create()!; expect(f.previous()).toBeTrue();
  let calls = 0;
  expect(f.api.attachWilhelmHousingCoreGateV324(f.world, false, () => {
    calls++; return f.api.getWilhelmHousingModelV324(f.world, false) === root;
  })).toBeTrue();
  expect(f.api.hasWilhelmHousingRuntimeV324(f.world, false)).toBeTrue(); expect(calls).toBe(2);
  f.api.releaseWilhelmHousingRuntimeV324(f.world, false);
  const bad = fixture(); bad.create(); expect(bad.previous()).toBeTrue();
  expect(bad.api.attachWilhelmHousingCoreGateV324(bad.world, false, () => bad.api.hasWilhelmHousingRuntimeV324(bad.world, false))).toBeFalse();
  expect(bad.world.children).toHaveLength(1);
});

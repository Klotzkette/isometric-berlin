/** One private world lifetime; shared Core retirement belongs to Government. */
import { Group, type Object3D } from "three";
import {
  createWilhelmHousingV324Steps, disposeWilhelmHousingV324,
  hasCompleteWilhelmHousingV324,
} from "./WilhelmHousingV324";
import {
  bindWilhelmHousingV324SourcesSteps, hasWilhelmHousingV324Sources,
  type WilhelmHousingSourcesV324Receipt,
} from "./WilhelmHousingV324Sources";
import {
  prepareWilhelmHousingPreviousV324Steps, prepareWilhelmHousingLegacyV324Steps,
  type WilhelmHousingPreviousV324Transaction,
} from "./WilhelmHousingV324Previous";
import type { NorthCoreTerrainRebindV309 } from "./NorthCoreTerrainV309";

export type WilhelmHousingRuntimeHooksV324 = {
  beforeSwap?: NorthCoreTerrainRebindV309;
  afterSwap?: () => void;
};
type Transaction = WilhelmHousingPreviousV324Transaction;
type State = {
  world: Group; native: boolean; model?: Group;
  source?: WilhelmHousingSourcesV324Receipt;
  creating: boolean; released: boolean; checking: boolean;
  previous?: Transaction; pendingPrevious?: Transaction; preparingPrevious: boolean;
  legacy: Map<Object3D, Transaction>; pendingLegacy: Map<Object3D, Transaction>;
  preparingLegacy: Set<Object3D>; coreGate?: () => boolean;
};
const states = new WeakMap<Object3D, Map<boolean, State>>();
const stateFor = (world: Object3D, native: boolean): State | undefined => states.get(world)?.get(native);
const stillOwned = (state: State): boolean => !state.released && stateFor(state.world, state.native) === state;
function rawComplete(state: State): boolean {
  try {
    return stillOwned(state) && !state.creating && !!state.model && state.model.parent === state.world &&
      hasWilhelmHousingV324Sources(state.source, state.native) && hasCompleteWilhelmHousingV324(state.model, state.native);
  } catch { return false; }
}
function transactionComplete(transaction: Transaction | undefined): boolean {
  try { return transaction?.complete() === true; } catch { return false; }
}
function baseStatus(state: State): { model: boolean; previous: boolean; core: boolean } {
  const model = rawComplete(state), previous = transactionComplete(state.previous);
  let core = false;
  try { core = typeof state.coreGate === "function" && state.coreGate() === true; } catch { /* Closed. */ }
  return { model, previous, core };
}
/** Excludes Legacy, so its own live transaction gate cannot call itself. */
function baseComplete(state: State): boolean {
  const status = baseStatus(state);
  return status.model && status.previous && status.core && stillOwned(state);
}
function rollback(transaction: Transaction | undefined): void {
  try { transaction?.rollback(); } catch { /* Continue releasing every owned transaction. */ }
}
function release(state: State): void {
  if (state.released) return;
  state.released = true;
  const transactions = new Set([
    ...state.pendingLegacy.values(), ...state.legacy.values(),
    ...(state.pendingPrevious ? [state.pendingPrevious] : []), ...(state.previous ? [state.previous] : []),
  ]);
  state.pendingLegacy.clear(); state.legacy.clear(); state.preparingLegacy.clear();
  state.previous = undefined; state.pendingPrevious = undefined; state.source = undefined;
  for (const transaction of transactions) rollback(transaction);
  const model = state.model; state.model = undefined;
  try { if (model) { model.removeFromParent(); disposeWilhelmHousingV324(model); } }
  finally {
    // Disposing the dedicated replacement closes the linked Government gate;
    // its own transaction restores shared Core. We never own a second Core tx.
    try { state.coreGate?.(); } catch { /* Its owner also retains normal rollback. */ }
    state.coreGate = undefined;
    const family = states.get(state.world);
    if (family?.get(state.native) === state) family.delete(state.native);
    if (family?.size === 0) states.delete(state.world);
  }
}
/** A release during a suspended constructor closes it at the next checkpoint. */
function* guarded<T>(steps: Generator<void, T>, allowed: () => boolean): Generator<void, T | null> {
  let done = false;
  try {
    for (;;) {
      if (!allowed()) return null;
      const next = steps.next();
      if (next.done) { done = true; return allowed() ? next.value : null; }
      if (!allowed()) return null;
      yield;
    }
  } finally { if (!done) steps.return(undefined as T); }
}

/** Actual original sources bind before construction. The partial model enters
 * the caller's unpublished world immediately, before its first allocation/yield. */
export function* createWilhelmHousingRuntimeV324Steps(
  world: Object3D, prisms: readonly unknown[], voxels?: unknown, native = false,
  mobileLike = false, nativeCore?: unknown, onCreate?: (model: Group) => void,
): Generator<void, Group | null> {
  if (!(world instanceof Group) || stateFor(world, native)) return null;
  const state: State = {
    world, native, creating: true, released: false, checking: false,
    preparingPrevious: false, legacy: new Map(), pendingLegacy: new Map(), preparingLegacy: new Set(),
  };
  let family = states.get(world);
  if (!family) states.set(world, family = new Map());
  family.set(native, state);
  let delivered = false;
  try {
    const source = yield* guarded(bindWilhelmHousingV324SourcesSteps(prisms, { core: nativeCore, voxels }, native), () => stillOwned(state));
    if (!source || !hasWilhelmHousingV324Sources(source, native)) return null;
    state.source = source;
    const model = yield* guarded(createWilhelmHousingV324Steps({ native, mobileLike, sourceReceipt: source }, root => {
      if (!stillOwned(state)) throw new DOMException("Wilhelm construction cancelled", "AbortError");
      state.model = root; world.add(root); onCreate?.(root);
    }), () => stillOwned(state));
    state.creating = false;
    if (!model || model !== state.model || !rawComplete(state)) return null;
    delivered = true;
    return model;
  } catch { return null; }
  finally { if (!delivered) release(state); }
}

/** Construction-only lookup. Government uses this raw private model proof
 * while preparing its shared Core transaction; it must not call full has. */
export function getWilhelmHousingModelV324(world: Object3D, native = false): Group | undefined {
  const state = stateFor(world, native);
  if (!state || state.creating) return undefined;
  if (rawComplete(state)) return state.model;
  release(state);
  return undefined;
}
/** Hidden ancestors are normal mode state. Only actual model ownership,
 * complete sources and all committed private replacement gates admit fronts. */
export function hasWilhelmHousingRuntimeV324(world: Object3D, native = false): boolean {
  const state = stateFor(world, native);
  if (!state || state.creating || state.checking || state.released || !state.previous) return false;
  state.checking = true;
  let ready = false, localReady = false;
  try {
    const status = baseStatus(state);
    localReady = status.model && status.previous;
    ready = localReady && status.core;
    for (const transaction of state.legacy.values()) if (!transactionComplete(transaction)) { ready = false; localReady = false; }
    if (!stillOwned(state)) { ready = false; localReady = false; }
  } finally { state.checking = false; }
  // Until Government attaches its actual gate this is merely an unpublished
  // complete model, not an invalidated published owner.
  if (!ready && (!localReady || state.coreGate) && !state.released) release(state);
  return ready;
}

/** Only dedicated old v288/native-Alt owners. Shared Core is never staged here. */
export function* prepareWilhelmHousingRuntimePreviousV324Steps(
  world: Object3D, native = false, hooks: WilhelmHousingRuntimeHooksV324 = {},
): Generator<void, boolean> {
  const state = stateFor(world, native);
  if (!state || !rawComplete(state) || state.preparingPrevious) return false;
  if (state.previous) {
    const ready = transactionComplete(state.previous);
    if (!ready) release(state);
    return ready;
  }
  state.preparingPrevious = true;
  let transaction: Transaction | null = null, delivered = false;
  try {
    transaction = yield* guarded(prepareWilhelmHousingPreviousV324Steps(world, native, state.model!, state.source!, hooks), () => rawComplete(state));
    if (!transaction) return false;
    state.pendingPrevious = transaction;
    if (!transaction.prepared() || !transaction.commit(() => rawComplete(state)) || !transactionComplete(transaction)) return false;
    yield* guarded(transaction.parkRetiredSourcesSteps(), () => rawComplete(state) && transactionComplete(transaction!));
    if (!rawComplete(state) || !transactionComplete(transaction)) return false;
    state.previous = transaction; state.pendingPrevious = undefined;
    delivered = true;
    return true;
  } catch { return false; }
  finally {
    state.preparingPrevious = false;
    if (!delivered) { rollback(transaction ?? undefined); state.pendingPrevious = undefined; release(state); }
  }
}

/** Link only after Government has committed its one composed Core owner. */
export function attachWilhelmHousingCoreGateV324(world: Object3D, native: boolean, gate: () => boolean): boolean {
  const state = stateFor(world, native);
  if (!state || typeof gate !== "function") return false;
  if (!rawComplete(state) || !transactionComplete(state.previous)) { release(state); return false; }
  if (state.coreGate && state.coreGate !== gate) return false;
  state.coreGate = gate;
  return hasWilhelmHousingRuntimeV324(world, native);
}

/** Late Drawn cultural details may arrive after the main world. A missing
 * earlier host keeps that complete family and can be retried when it arrives. */
export function* stageWilhelmHousingLegacyV324Steps(
  world: Object3D, native: boolean, signatures: Object3D, hooks: WilhelmHousingRuntimeHooksV324 = {},
): Generator<void, boolean> {
  const state = stateFor(world, native);
  if (native || !state || !hasWilhelmHousingRuntimeV324(world, native) || state.preparingLegacy.has(signatures)) return false;
  const previous = state.legacy.get(signatures);
  if (previous) return transactionComplete(previous);
  state.preparingLegacy.add(signatures);
  let transaction: Transaction | null = null, delivered = false;
  try {
    transaction = yield* guarded(prepareWilhelmHousingLegacyV324Steps(signatures, state.model!, state.source!, hooks), () => baseComplete(state));
    if (!transaction) return false;
    state.pendingLegacy.set(signatures, transaction);
    if (!transaction.prepared() || !transaction.commit(() => baseComplete(state)) || !transactionComplete(transaction)) return false;
    yield* guarded(transaction.parkRetiredSourcesSteps(), () => baseComplete(state) && transactionComplete(transaction!));
    if (!baseComplete(state) || !transactionComplete(transaction)) return false;
    state.legacy.set(signatures, transaction); state.pendingLegacy.delete(signatures);
    delivered = true;
    return true;
  } catch { return false; }
  finally {
    state.preparingLegacy.delete(signatures);
    if (!delivered) {
      rollback(transaction ?? undefined); state.pendingLegacy.delete(signatures);
      if (state.coreGate && !baseComplete(state)) release(state);
    }
  }
}

/** Permanent and idempotent; no public tags, timer, fetch or additional owner. */
export function releaseWilhelmHousingRuntimeV324(world: Object3D, native = false): void {
  const state = stateFor(world, native);
  if (state) release(state);
}

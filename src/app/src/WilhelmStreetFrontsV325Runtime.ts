/** One additional street-family lifetime; shared Core remains Government-owned.
 * Drawn has no dedicated original host. Native additionally proves the three
 * actual northern resident fitting families before any full admission. */
import { Group, type Object3D } from "three";
import {
  createWilhelmStreetFrontsV325Steps, disposeWilhelmStreetFrontsV325,
  hasCompleteWilhelmStreetFrontsV325,
} from "./WilhelmStreetFrontsV325";
import {
  bindWilhelmStreetFrontsV325SourcesSteps, hasWilhelmStreetFrontsV325Sources,
  type WilhelmStreetFrontsSourcesV325Receipt,
} from "./WilhelmStreetFrontsV325Sources";
import type { NorthCoreTerrainRebindV309 } from "./NorthCoreTerrainV309";

export type WilhelmStreetFrontsRuntimeHooksV325 = {
  beforeSwap?: NorthCoreTerrainRebindV309;
  afterSwap?: () => void;
};
type State = {
  world: Group; native: boolean; model?: Group;
  source?: WilhelmStreetFrontsSourcesV325Receipt;
  creating: boolean; released: boolean; checking: boolean;
  previousGate?: () => boolean; coreGate?: () => boolean;
};
const states = new WeakMap<Object3D, Map<boolean, State>>();
const stateFor = (world: Object3D, native: boolean): State | undefined => states.get(world)?.get(native);
const owned = (state: State): boolean => !state.released && stateFor(state.world, state.native) === state;
function rawComplete(state: State): boolean {
  try {
    return owned(state) && !state.creating && !!state.model && state.model.parent === state.world &&
      hasWilhelmStreetFrontsV325Sources(state.source, state.native) && hasCompleteWilhelmStreetFrontsV325(state.model, state.native);
  } catch { return false; }
}
function previousComplete(state: State): boolean {
  if (!state.native) return true;
  try { return state.previousGate?.() === true; } catch { return false; }
}
function release(state: State): void {
  if (state.released) return;
  state.released = true;
  state.source = undefined;
  const model = state.model; state.model = undefined;
  try { if (model) { model.removeFromParent(); disposeWilhelmStreetFrontsV325(model); } }
  finally {
    // Removing this private model closes the actual Government callback. Its
    // existing composed transaction alone restores the shared Core complement.
    try { state.previousGate?.(); } catch { /* The actual owner retains normal rollback. */ }
    try { state.coreGate?.(); } catch { /* Its owner also retains normal rollback. */ }
    state.previousGate = undefined; state.coreGate = undefined;
    const family = states.get(state.world);
    if (family?.get(state.native) === state) family.delete(state.native);
    if (family?.size === 0) states.delete(state.world);
  }
}
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

export function* createWilhelmStreetFrontsRuntimeV325Steps(
  world: Object3D, prisms: readonly unknown[], voxels?: unknown, native = false,
  mobileLike = false, nativeCore?: unknown, onCreate?: (model: Group) => void,
): Generator<void, Group | null> {
  if (!(world instanceof Group) || stateFor(world, native)) return null;
  const state: State = { world, native, creating: true, released: false, checking: false };
  let family = states.get(world);
  if (!family) states.set(world, family = new Map());
  family.set(native, state);
  let delivered = false;
  try {
    const source = yield* guarded(bindWilhelmStreetFrontsV325SourcesSteps(prisms, { core: nativeCore, voxels }, native), () => owned(state));
    if (!source || !hasWilhelmStreetFrontsV325Sources(source, native)) return null;
    state.source = source;
    const model = yield* guarded(createWilhelmStreetFrontsV325Steps({ native, mobileLike, sourceReceipt: source }, root => {
      if (!owned(state)) throw new DOMException("Wilhelm street construction cancelled", "AbortError");
      state.model = root; world.add(root); onCreate?.(root);
    }), () => owned(state));
    state.creating = false;
    if (!model || model !== state.model || !rawComplete(state)) return null;
    delivered = true;
    return model;
  } catch { return null; }
  finally { if (!delivered) release(state); }
}

/** Construction-only raw lookup for Government; no full-gate recursion. */
export function getWilhelmStreetFrontsModelV325(world: Object3D, native = false): Group | undefined {
  const state = stateFor(world, native);
  if (!state || state.creating) return undefined;
  if (rawComplete(state)) return state.model;
  release(state); return undefined;
}
/** Borrow only the privately validated model/opaque receipt for the existing
 * V324 owner's one shared Native transaction. Full source containers stay weak. */
export function getWilhelmStreetFrontsPreviousInputV325(world: Object3D, native = true):
  { model: Group; sourceReceipt: WilhelmStreetFrontsSourcesV325Receipt } | undefined {
  if (!native) return undefined;
  const state = stateFor(world, true);
  if (!state || state.creating) return undefined;
  if (!rawComplete(state) || !state.source || !state.model) { release(state); return undefined; }
  return { model: state.model, sourceReceipt: state.source };
}
/** Hidden world/ancestor mode state is legitimate. A real attached Government
 * gate is mandatory; Native also requires its committed dedicated predecessor. */
export function hasWilhelmStreetFrontsRuntimeV325(world: Object3D, native = false): boolean {
  const state = stateFor(world, native);
  if (!state || state.creating || state.checking || state.released) return false;
  state.checking = true;
  let modelReady = false, previousReady = false, coreReady = false;
  try {
    modelReady = rawComplete(state); previousReady = previousComplete(state);
    try { coreReady = typeof state.coreGate === "function" && state.coreGate() === true; } catch { /* Closed. */ }
    if (!owned(state)) { modelReady = false; previousReady = false; }
  } finally { state.checking = false; }
  const ready = modelReady && previousReady && coreReady;
  // A valid unpublished Native model can await its actual previous-host stage.
  // Any revoked already-committed host or attached Core gate is a real failure.
  if (!ready && (!modelReady || state.previousGate && !previousReady || state.coreGate) && !state.released) release(state);
  return ready;
}

export function* prepareWilhelmStreetFrontsRuntimePreviousV325Steps(
  world: Object3D, native = false, _hooks: WilhelmStreetFrontsRuntimeHooksV325 = {},
): Generator<void, boolean> {
  const state = stateFor(world, native);
  // Compatibility checkpoint only. The eight resident Native meshes are
  // shared with V324 and must be changed by its one composed owner.
  return !!state && rawComplete(state) && previousComplete(state);
}

/** Only the completed actual shared Native V324/V325 transaction may attach.
 * Drawn has no dedicated predecessor; its Source Quarter fronts stay streamed. */
export function attachWilhelmStreetFrontsPreviousGateV325(world: Object3D, native: boolean, gate: () => boolean): boolean {
  const state = stateFor(world, native);
  if (!state || typeof gate !== "function") return false;
  if (!native) return rawComplete(state);
  if (!rawComplete(state)) { release(state); return false; }
  if (state.previousGate && state.previousGate !== gate) return false;
  state.previousGate = gate;
  const ready = previousComplete(state) && rawComplete(state);
  if (!ready) release(state);
  return ready;
}

export function attachWilhelmStreetFrontsCoreGateV325(world: Object3D, native: boolean, gate: () => boolean): boolean {
  const state = stateFor(world, native);
  if (!state || typeof gate !== "function") return false;
  if (!rawComplete(state) || !previousComplete(state)) { release(state); return false; }
  if (state.coreGate && state.coreGate !== gate) return false;
  state.coreGate = gate; return hasWilhelmStreetFrontsRuntimeV325(world, native);
}

export function releaseWilhelmStreetFrontsRuntimeV325(world: Object3D, native = false): void {
  const state = stateFor(world, native); if (state) release(state);
}

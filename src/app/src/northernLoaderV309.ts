import type { Group } from "three";
import { completeCooperatively } from "./cooperativeWork";

export type NorthernBundleV309 = { root: Group; complete: () => boolean; prepared?: () => boolean };
export type NorthernLoaderV309<B extends NorthernBundleV309> = {
  current(native: boolean): B | undefined;
  ensure(native: boolean): Promise<B | undefined>;
  dispose(): void;
};

/** One pending construction per retained world. Complete worlds own their
 * attached resources; the loader owns every unpublished allocation and never
 * retains an abandoned world through an enumerable cache. */
export function createNorthernLoaderV309<M, B extends NorthernBundleV309>(options: {
  load: () => Promise<M>;
  build: (module: M, native: boolean, onCreate: (root: Group) => void) => Generator<void, B>;
  world: (native: boolean) => Group | null | undefined;
  active: (native: boolean) => boolean;
  publish: (bundle: B, world: Group, native: boolean) => void;
  rollback: (bundle: B, world: Group, native: boolean) => void;
  release: (root: Group) => void;
  yieldTask: () => Promise<void>;
  signal?: AbortSignal;
  now?: () => number;
}): NorthernLoaderV309<B> {
  type State = { pending?: Promise<B | undefined>; bundle?: B; failedAt?: number };
  const worlds = new WeakMap<Group, State>();
  const pending = new Set<AbortController>();
  const now = options.now ?? (() => performance.now());
  let disposed = false;
  const alive = (world: Group, native: boolean, signal?: AbortSignal) =>
    !disposed && !options.signal?.aborted && !signal?.aborted && options.world(native) === world && options.active(native);
  const current = (native: boolean): B | undefined => {
    const world = options.world(native); if (!world || !alive(world, native)) return undefined;
    const state = worlds.get(world), bundle = state?.bundle;
    if (!bundle) return undefined;
    if (bundle.root.parent === world && bundle.root.visible && bundle.complete()) return bundle;
    // Restore the complete predecessor before consumers can observe a false
    // admission. Do this once, then retain the ordinary bounded retry policy.
    state!.bundle = undefined; state!.failedAt = now();
    try { options.rollback(bundle, world, native); }
    finally { if (bundle.root.parent === world) { bundle.root.removeFromParent(); options.release(bundle.root); } }
    return undefined;
  };
  const dispose = () => { disposed = true; for (const task of pending) task.abort(); pending.clear(); };
  options.signal?.addEventListener("abort", dispose, { once: true });
  return {
    current,
    ensure(native) {
      const world = options.world(native);
      if (!world || !alive(world, native)) return Promise.resolve(undefined);
      const ready = current(native); if (ready) return Promise.resolve(ready);
      const state = worlds.get(world) ?? {}; worlds.set(world, state);
      if (state.pending) return state.pending;
      if (state.bundle) return Promise.reject(Error("Northern model admission was revoked"));
      if (state.failedAt !== undefined && now() - state.failedAt < 30_000) return Promise.resolve(undefined);
      const task = new AbortController(); pending.add(task);
      state.pending = (async () => {
        let root: Group | undefined, bundle: B | undefined, rolledBack = false;
        try {
          const module = await options.load();
          if (!alive(world, native, task.signal)) return undefined;
          const constructed = await completeCooperatively(options.build(module, native, value => { root = value; }), {
            yieldTask: options.yieldTask, now, isCancelled: () => !alive(world, native, task.signal),
            onComplete: value => {
              bundle=value;
              if (!root || root !== value.root || !(value.prepared?.() ?? value.complete())) throw Error("Incomplete northern required model");
              if (!alive(world, native, task.signal)) throw new DOMException("Northern publication cancelled", "AbortError");
              // Validation, attachment and retirement share the generator's
              // final job. A deferred park cannot publish into an await gap.
              world.add(root);
              options.publish(value, world, native);
              if (!alive(world, native, task.signal) || root.parent !== world) throw new DOMException("Northern publication cancelled", "AbortError");
              if (!value.complete()) throw Error("Northern model admission changed during publication");
              state.bundle=value;root=undefined;state.failedAt=undefined;
            },
          });
          return alive(world,native,task.signal)&&state.bundle===constructed?constructed:undefined;
        } catch (error) {
          if (bundle) { options.rollback(bundle, world, native); rolledBack = true; }
          if (!(error instanceof DOMException && error.name === "AbortError")) { state.failedAt = now(); throw error; }
          return undefined;
        } finally {
          if (root) {
            if (bundle && !rolledBack) options.rollback(bundle, world, native);
            root.removeFromParent(); options.release(root);
          }
          pending.delete(task); state.pending = undefined;
        }
      })();
      return state.pending;
    },
    dispose() { options.signal?.removeEventListener("abort", dispose); dispose(); },
  };
}

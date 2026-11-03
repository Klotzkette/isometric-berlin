import { expect, test } from "bun:test";
import { Group } from "three";
import { createNorthernLoaderV309 } from "../src/northernLoaderV309";

const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const module = deferred<string>(), yields: ReturnType<typeof deferred<void>>[] = [], original = new Group();
  let world: Group = original, active = true, allocations = 0, publications = 0, rollbacks = 0, releases = 0, valid = true, clock = 0;
  const roots: Group[] = [];
  const loader = createNorthernLoaderV309({
    load: () => module.promise,
    build: function* (_module, native, onCreate) { const root = new Group(); root.name = native ? "native" : "drawn"; roots.push(root); allocations++; onCreate(root); clock += 10; yield; root.add(new Group()); clock += 10; yield; return { root, complete: () => valid && root.children.length === 1 }; },
    world: () => world, active: () => active,
    publish: () => { publications++; }, rollback: () => { rollbacks++; }, release: () => { releases++; },
    yieldTask: () => { const yield_ = deferred<void>(); yields.push(yield_); return yield_.promise; }, now: () => clock,
  });
  return { loader, module, yields, original, roots, changeWorld: () => { world = new Group(); }, deactivate: () => { active = false; }, invalidate: () => { valid = false; }, count: () => ({ allocations, publications, rollbacks, releases }), tick: () => { clock += 31_000; } };
}
async function microtasks() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
async function settle(f: ReturnType<typeof fixture>) { for (let i = 0; i < 8; i++) { for (const yield_ of f.yields) yield_.resolve(); await microtasks(); } }

test("unrelated startup allocates/imports nothing; a matching request shares its complete publication", async () => {
  const f = fixture(); expect(f.loader.current(false)).toBeUndefined(); expect(f.count().allocations).toBe(0);
  const first = f.loader.ensure(false), shared = f.loader.ensure(false); expect(shared).toBe(first);
  f.module.resolve("complete source"); await microtasks(); expect(f.count().publications).toBe(0);
  await settle(f); const complete = await first;
  expect(f.count()).toEqual({ allocations: 1, publications: 1, rollbacks: 0, releases: 0 });
  expect(complete!.root.parent).toBe(f.original); expect(f.loader.current(false)).toBe(complete); expect(await f.loader.ensure(false)).toBe(complete);
  f.loader.dispose(); expect(f.loader.current(false)).toBeUndefined();
});

test("late imports after a world/family change cannot allocate or publish stale geometry", async () => {
  for (const change of ["world", "family", "dispose"]) {
    const f = fixture(), pending = f.loader.ensure(false);
    if (change === "world") f.changeWorld(); else if (change === "family") f.deactivate(); else f.loader.dispose();
    f.module.resolve("old source"); expect(await pending).toBeUndefined();
    expect(f.count()).toEqual({ allocations: 0, publications: 0, rollbacks: 0, releases: 0 });
  }
});

test("cancelling a suspended real ownership root frees it once without touching the old world", async () => {
  const f = fixture(), pending = f.loader.ensure(false); f.module.resolve("source"); await microtasks();
  f.yields[0].resolve(); await microtasks(); expect(f.count().allocations).toBe(1);
  f.deactivate(); await settle(f); expect(await pending).toBeUndefined();
  expect(f.original.children).toEqual([]); expect(f.count()).toEqual({ allocations: 1, publications: 0, rollbacks: 0, releases: 1 });
});

test("damaged complete buffers fail closed and follow the bounded retry interval", async () => {
  const f = fixture(), pending = f.loader.ensure(false); f.module.resolve("source"); f.invalidate();
  await settle(f); await expect(pending).rejects.toThrow("Incomplete northern required model");
  expect(f.count()).toEqual({ allocations: 1, publications: 0, rollbacks: 1, releases: 1 });
  expect(await f.loader.ensure(false)).toBeUndefined(); expect(f.count().allocations).toBe(1);
  f.tick(); const retry = f.loader.ensure(false); await settle(f); await expect(retry).rejects.toThrow("Incomplete northern required model"); expect(f.count().releases).toBe(2);
});

test("revoking a published complete family restores its predecessor before reporting a closed gate", async () => {
  const f = fixture(), pending = f.loader.ensure(false); f.module.resolve("source"); await settle(f); await pending;
  f.invalidate(); expect(f.loader.current(false)).toBeUndefined();
  expect(f.count()).toEqual({ allocations: 1, publications: 1, rollbacks: 1, releases: 1 });
  expect(f.original.children).toEqual([]); expect(f.loader.current(false)).toBeUndefined();
  expect(f.count().rollbacks).toBe(1); expect(await f.loader.ensure(false)).toBeUndefined();
});

test("publication failure restores old owners and releases the complete provisional family", async () => {
  const world = new Group(); let released = 0, restored = 0, originalVisible = true;
  const loader = createNorthernLoaderV309({ load: async () => true, world: () => world, active: () => true,
    build: function* (_module, _native, onCreate) { const root = new Group(); onCreate(root); yield; return { root, complete: () => true }; },
    publish: () => { originalVisible = false; throw Error("failed atomic publication"); },
    rollback: () => { restored++; originalVisible = true; }, release: () => { released++; }, yieldTask: async () => {},
  });
  await expect(loader.ensure(false)).rejects.toThrow("failed atomic publication");
  expect(originalVisible).toBeTrue(); expect(restored).toBe(1); expect(released).toBe(1); expect(world.children).toEqual([]); expect(loader.current(false)).toBeUndefined();
});

test("a staged source transaction becomes live only inside its complete synchronous publication", async () => {
  const world = new Group(); let activated = false, originalVisible = true;
  const loader = createNorthernLoaderV309({ load: async () => true, world: () => world, active: () => true,
    build: function* (_module, _native, onCreate) { const root = new Group(); onCreate(root); yield; expect(originalVisible).toBeTrue(); return { root, prepared: () => true, complete: () => activated && root.parent === world }; },
    publish: bundle => { expect(bundle.root.parent).toBe(world); expect(bundle.complete()).toBeFalse(); originalVisible = false; activated = true; },
    rollback: () => { originalVisible = true; activated = false; }, release: () => {}, yieldTask: async () => {},
  });
  const bundle = await loader.ensure(false); expect(bundle?.complete()).toBeTrue(); expect(originalVisible).toBeFalse(); expect(loader.current(false)).toBe(bundle);
});

test("a queued final-step continuation sees the fully admitted current bundle", async () => {
  const world = new Group(); let activated = false, queued!: Promise<void>;
  const events: string[] = [];
  const loader = createNorthernLoaderV309({ load: async () => true, world: () => world, active: () => true,
    build: function* (_module, _native, onCreate) {
      const root = new Group(); onCreate(root); yield;
      const value = { root, prepared: () => true, complete: () => activated && root.parent === world };
      queued = Promise.resolve().then(() => { events.push("queued park"); expect(loader.current(false)).toBe(value); });
      return value;
    },
    publish: () => { events.push("northern publication"); activated = true; },
    rollback: () => { activated = false; }, release: () => {}, yieldTask: async () => {},
  });
  const result = await loader.ensure(false); await queued;
  expect(result?.complete()).toBe(true); expect(events).toEqual(["northern publication", "queued park"]);
  loader.dispose();
});

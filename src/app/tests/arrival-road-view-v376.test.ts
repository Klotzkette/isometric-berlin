import { expect, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { arrivalRoadIdsV376 } from "../src/arrivalRoadRangesV376";
import { createArrivalRoadViewV376, type ArrivalRoadV376 } from "../src/arrivalRoadViewV376";
import { progressiveCoverageHost } from "./helpers/progressiveCoverageHost";
import type { ProgressiveWorldWorkerOutput } from "../src/progressiveWorld";

const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();

function fixture() {
  const world = new Group();
  const sourceAbort = new AbortController();
  let visible = true;
  let releaseFirst: (() => void) | undefined;
  let fetches = 0, live = 0, maximum = 0;
  const gate = new Promise<void>(resolve => { releaseFirst = resolve; });
  const removed = new Set<Group>();
  const view = createArrivalRoadViewV376({
    signal: sourceAbort.signal, active: () => visible,
    attached: () => new Set(world.children.map(child => child.name)),
    async *load(x, z, completed) {
      fetches++;
      maximum = Math.max(maximum, ++live);
      try {
        if (fetches === 1) await gate;
        for (const id of arrivalRoadIdsV376(x, z)) {
          if (!completed.has(id)) yield { id, root: new Group() };
        }
      } finally { live--; }
    },
    async attach({ id, root }) { root.name = id; world.add(root); },
    remove(root) { expect(removed.has(root)).toBe(false); removed.add(root); root.removeFromParent(); },
  });
  return { world, sourceAbort, view, removed, release: () => releaseFirst!(),
    visible(value: boolean) { visible = value; }, get fetches() { return fetches; }, get peak() { return maximum; } };
}

test("an opening arrival is ready before publication and the worker's adopted IDs survive subsequent jumps", async () => {
  const f = fixture();
  try {
    f.view.update(-3306, 726, 100);
    f.release();
    await f.view.opening();
    expect(f.world.children).toHaveLength(0);
    f.view.activate();
    const old = f.world.children[0];
    expect(old.name).toBe("restored-asphalt--7-1");
    f.view.adopt(old.name);
    for (const [i, x] of [512, 1024, 1536].entries()) {
      f.view.update(x, 0, 400 + 300 * i);
      await f.view.opening();
      const ids = arrivalRoadIdsV376(x, 0);
      expect(f.world.children.map(item => item.name).sort()).toEqual([old.name, ...ids].sort());
    }
    expect(f.peak).toBe(1);
  } finally { f.view.stop(); }
});

test("rapid jumps discard stale delivered geometry and darkness or hidden-tab interruption retries the same destination", async () => {
  const f = fixture();
  try {
    f.view.update(-3306, 726, 100);
    f.view.activate();
    f.view.update(-2646, 1554, 400);
    f.visible(false);
    f.release();
    await f.view.opening();
    expect(f.world.children).toHaveLength(0);
    expect(f.removed.size).toBeGreaterThan(0);
    f.visible(true);
    f.view.update(-2646, 1554, performance.now() + 10_000);
    await f.view.opening();
    expect(f.world.children.map(item => item.name).sort()).toEqual(arrivalRoadIdsV376(-2646, 1554).sort());
    expect(f.peak).toBe(1);
  } finally { f.view.stop(); }
});

test("unmount cancels the outstanding arrival and releases its unowned geometry", async () => {
  const f = fixture();
  f.view.update(0, 0, 100);
  f.sourceAbort.abort();
  f.release();
  await f.view.opening();
  f.view.activate();
  expect(f.world.children).toHaveLength(0);
  expect(f.removed.size).toBe(4);
});

test("ordinary worker ACK, material switching and resume reuse a camera-attached road exactly once", async () => {
  const world = new Group();
  const host = progressiveCoverageHost(source, world, false);
  const id = "restored-asphalt--6-3", root = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 1, 2), new MeshBasicMaterial());
  mesh.userData.dayMaterial = mesh.material;
  mesh.userData.nightMaterial = new MeshBasicMaterial({ color: 0x232323 });
  root.add(mesh);
  const road: ArrivalRoadV376 = { id, root };
  host.runtime.lightingMode = "night";
  try {
    await host.arrival(road);
    expect(mesh.material).toBe(mesh.userData.nightMaterial);
    expect(mesh.geometry.userData.losslessStaticBacking).toBe(true);
    expect(host.runtime.progressiveWorldBatches).toEqual([root]);
    expect(host.acknowledged).toHaveLength(0);
    const duplicate = { type: "batch", kind: "surfaces", id, get object() {
      throw new Error("Already visible road decoded a second time"); } } as Extract<ProgressiveWorldWorkerOutput, { type: "batch" }>;
    await host.attach(duplicate);
    expect(host.acknowledged).toEqual([id]);
    expect(world.children).toEqual([root]);
    host.pause();
    host.restart();
    expect(host.builds.at(-1)?.completedBatchIds).toContain(id);
  } finally { host.dispose(); }
});

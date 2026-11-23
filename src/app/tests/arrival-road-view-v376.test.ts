import { registerMittePathPreviewsV375 } from "../src/mittePathArrivalV375";
import { expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
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
  const adopted: string[] = [];
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
    adopt(id) { adopted.push(id); },
    remove(root) { expect(removed.has(root)).toBe(false); removed.add(root); root.removeFromParent(); },
  });
  return { world, sourceAbort, view, removed, adopted, release: () => releaseFirst!(),
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
    const initial = f.world.children.slice(0, 2).map(child => child.name);
    expect(initial).toEqual(["restored-asphalt--7-1", "restored-paving--7-1"]);
    for (const id of initial) { f.view.adopt(id); f.view.adopt(id); }
    expect(f.adopted).toEqual(initial);
    for (const [i, x] of [512, 1024, 1536].entries()) {
      f.view.update(x, 0, 400 + 300 * i);
      await f.view.opening();
      const ids = arrivalRoadIdsV376(x, 0);
      expect(ids).toHaveLength(8);
      expect(f.world.children.map(item => item.name).sort()).toEqual([...initial, ...ids].sort());
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
  expect(f.removed.size).toBe(8);
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

test("temporary paving restores its exact Mitte fragment on eviction and retires it once on worker adoption", async () => {
  const world = new Group();
  const slabs = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 1);
  slabs.name = "Drawn ground slabs";
  world.add(slabs);
  const id = "restored-paving--1--2", preview = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  slabs.add(preview);
  registerMittePathPreviewsV375(slabs, new Map([[id, preview]]));
  let disposals = 0;
  preview.geometry.addEventListener("dispose", () => disposals++);
  const host = progressiveCoverageHost(source, world);
  const view = createArrivalRoadViewV376({
    ...host.arrivalHooks(),
    async *load(x, z, completed) {
      for (const selected of arrivalRoadIdsV376(x, z)) {
        if (!completed.has(selected)) yield { id: selected, root: new Group() };
      }
    },
  });
  host.runtime.arrivalRoadViewV376 = view;
  try {
    view.activate();
    view.update(-256, -768, 100);
    await view.opening();
    expect(preview.parent).toBe(slabs);
    expect(preview.visible).toBe(false);
    view.update(-3306, 726, 400);
    await view.opening();
    expect(preview.visible).toBe(true);
    expect(disposals).toBe(0);
    view.update(-256, -768, 700);
    await view.opening();
    expect(preview.visible).toBe(false);
    expect(host.runtime.progressiveWorldBatches.filter(root => root.userData.progressiveWorldBatchId === id)).toHaveLength(1);
    const duplicate = { type: "batch", kind: "surfaces", id, get object() {
      throw new Error("Camera paving already attached"); } } as Extract<ProgressiveWorldWorkerOutput, { type: "batch" }>;
    await host.attach(duplicate);
    expect(disposals).toBe(1);
    expect(preview.parent).toBeNull();
    expect(host.acknowledged).toEqual([id]);
    view.update(-3306, 726, 1000);
    await view.opening();
    expect(host.runtime.progressiveWorldBatches.some(root => root.userData.progressiveWorldBatchId === id)).toBe(true);
  } finally { view.stop(); host.dispose(); }
  expect(disposals).toBe(1);
});

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Group, Mesh } from "three";
import { NORTHERN_CORE_BATCH_IDS_V319, hasNorthernCoreSourceBatchesV319 } from "../src/northernCoreReadinessV319";
import { prepareNorthCoreEnginesV311Steps, type CoreWorkerV8ProfileV311 } from "../src/NorthCoreEnginesV311";
import type { NorthCoreTerrainRecipesV309 } from "../src/NorthCoreTerrainV309";
import type { NorthCoreBridgeDeltaV309 } from "../src/NorthCoreBridgeTerrainV309";
import type { NorthCoreActualDeltaV310 } from "../src/NorthCoreActualTerrainV310";
import { actualDrawnRuntimeV310 } from "./helpers/northRuntimeActualV310";
import { dispose, stage } from "./helpers/northCoreActualV309";
import bridge from "../src/data/gesundbrunnenBridgeCoreV309Delta.json";
import actual from "../src/data/coreTerrainActualV310.json";
import v8 from "../src/data/coreWorkerV8V311.json";

const source = () => JSON.parse(readFileSync(new URL("../src/data/coreTerrainContactV307.json", import.meta.url), "utf8")) as NorthCoreTerrainRecipesV309;
function owner(id: string): Group {
  const root = new Group(); root.userData = { progressiveWorldBatch: true, progressiveWorldBatchId: id }; return root;
}

test("the finite wait catalogue is exactly the complete retained Worker recipe's seventeen owners", () => {
  const ids = [...new Set(source().variants["drawn-worker"].parts.map(p => p.batchId).filter((id): id is string => typeof id === "string"))].sort();
  expect(NORTHERN_CORE_BATCH_IDS_V319).toEqual(ids);
  expect(ids).toHaveLength(17); expect(Object.isFrozen(NORTHERN_CORE_BATCH_IDS_V319)).toBe(true);
});

test("a partial attached prefix stays deferred until the final mandatory actual owner arrives", () => {
  const world = new Group(); expect(hasNorthernCoreSourceBatchesV319(null)).toBe(false);
  expect(hasNorthernCoreSourceBatchesV319(undefined)).toBe(false);
  for (const [index, id] of NORTHERN_CORE_BATCH_IDS_V319.entries()) {
    expect(hasNorthernCoreSourceBatchesV319(world)).toBe(false);
    world.add(owner(id)); expect(hasNorthernCoreSourceBatchesV319(world)).toBe(index === 16);
  }
  world.add(owner("surface-parks-5"), owner("unrelated-complete-buildings"));
  expect(hasNorthernCoreSourceBatchesV319(world)).toBe(true);
});

test("another world, duplicate IDs, nested labels and detached source owners do not satisfy the wait", () => {
  const world = new Group(), other = new Group(), owners = NORTHERN_CORE_BATCH_IDS_V319.map(owner); world.add(...owners);
  expect(hasNorthernCoreSourceBatchesV319(world)).toBe(true); expect(hasNorthernCoreSourceBatchesV319(other)).toBe(false);
  other.add(owners[0]); expect(hasNorthernCoreSourceBatchesV319(world)).toBe(false); world.add(owners[0]);
  const duplicate = owner(NORTHERN_CORE_BATCH_IDS_V319[0]); world.add(duplicate); expect(hasNorthernCoreSourceBatchesV319(world)).toBe(false); duplicate.removeFromParent();
  delete owners[0].userData.progressiveWorldBatch; expect(hasNorthernCoreSourceBatchesV319(world)).toBe(false); owners[0].userData.progressiveWorldBatch = true;
  const nested = new Group(); world.add(nested); nested.add(owners[0]); expect(hasNorthernCoreSourceBatchesV319(world)).toBe(false);
});

test("actual complete source admission waits for its last owner and still rejects a changed source word", async () => {
  const recipes = source(), world = await actualDrawnRuntimeV310(recipes, false);
  let transaction: ReturnType<typeof prepareNorthCoreEnginesV311Steps> extends Generator<void, infer T> ? T : never = null;
  try {
    expect(hasNorthernCoreSourceBatchesV319(world)).toBe(true);
    const last = world.children.find(o => o.userData.progressiveWorldBatchId === "restored-kerbs-2--7")!;
    expect(last).toBeDefined(); last.removeFromParent(); let started = 0;
    const prepare = async () => {
      if (!hasNorthernCoreSourceBatchesV319(world)) return undefined;
      started++;
      return stage(prepareNorthCoreEnginesV311Steps(world, false, true, recipes, bridge as unknown as NorthCoreBridgeDeltaV309, actual as unknown as NorthCoreActualDeltaV310, v8 as unknown as CoreWorkerV8ProfileV311));
    };
    expect(await prepare()).toBeUndefined(); expect(started).toBe(0); world.add(last);
    const mesh = world.getObjectsByProperty("name", "smooth parkland lawns").find(o => o instanceof Mesh && o.parent?.userData.progressiveWorldBatchId === "surface-parks-1") as Mesh;
    const a = mesh.geometry.getAttribute("position").array, words = new Uint32Array(a.buffer, a.byteOffset, a.byteLength / 4), original = words[0];
    try { words[0] ^= 1; expect(hasNorthernCoreSourceBatchesV319(world)).toBe(true); expect(await prepare()).toBeNull(); }
    finally { words[0] = original; }
    transaction = (await prepare())!; expect(started).toBe(2); expect(transaction).not.toBeNull();
    expect(transaction!.commit(true)).toBe(true); expect(transaction!.complete()).toBe(true); transaction!.rollback(); transaction = null;
  } finally { transaction?.rollback(); dispose(world); }
}, 60000);

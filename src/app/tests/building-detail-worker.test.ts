import { describe, expect, test } from "bun:test";
import { BuildingDetailWorker } from "../src/buildingDetailWorker";

function fixture() {
  const builds: string[] = [];
  const settled: number[] = [];
  const failures: unknown[] = [];
  const pending = new Map<string, { resolve: () => void; reject: (error: unknown) => void }>();
  let maxPending = 0;
  const worker = new BuildingDetailWorker({
    build: (id) => {
      builds.push(id);
      return new Promise<void>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        maxPending = Math.max(maxPending, pending.size);
      });
    },
    settled: (revision) => { settled.push(revision); },
    failed: (error) => { failures.push(error); },
  });
  async function finish(id: string, error?: unknown): Promise<void> {
    const build = pending.get(id);
    expect(build).toBeDefined();
    pending.delete(id);
    if (error !== undefined) build!.reject(error);
    else build!.resolve();
    // The public build promise resolves only after the viewer's ACK. Drain
    // that continuation, not a simulated timer or a mirror of the scheduler.
    await Promise.resolve();
  }
  return { worker, builds, settled, failures, pending, finish,
    get maxPending() { return maxPending; } };
}

describe("mobile detail worker follows the latest view", () => {
  test("starts the next exact district only after the previous transfer is acknowledged", async () => {
    const f = fixture();
    f.worker.update(["a", "b", "c"], [], 1);
    expect(f.builds).toEqual(["a"]);
    expect(f.settled).toEqual([]);
    await f.finish("a");
    expect(f.builds).toEqual(["a", "b"]);
    expect(f.settled).toEqual([]);
    await f.finish("b");
    expect(f.builds).toEqual(["a", "b", "c"]);
    await f.finish("c");
    expect(f.settled).toEqual([1]);
    expect(f.maxPending).toBe(1);
    expect(f.failures).toEqual([]);
  });

  test("fast travel coalesces intermediate views instead of building an obsolete route", async () => {
    const f = fixture();
    f.worker.update(["start", "old-neighbour", "old-far"], [], 1);
    f.worker.update(["middle", "middle-neighbour"], [], 2);
    f.worker.update(["destination", "destination-ahead"], [], 3);
    await f.finish("start");
    expect(f.builds).toEqual(["start", "destination"]);
    expect(f.settled).toEqual([]);
    await f.finish("destination");
    await f.finish("destination-ahead");
    expect(f.builds).toEqual(["start", "destination", "destination-ahead"]);
    expect(f.settled).toEqual([3]);
    expect(f.maxPending).toBe(1);
  });

  test("late old revisions cannot restore stale wanted or retained districts", async () => {
    const f = fixture();
    f.worker.update(["start", "near"], [], 4);
    f.worker.update(["current", "next"], [], 5);
    // Claiming 'current' is resident in the stale update must not skip it.
    f.worker.update(["stale"], ["current"], 3);
    await f.finish("start");
    expect(f.builds).toEqual(["start", "current"]);
    await f.finish("current");
    await f.finish("next");
    expect(f.settled).toEqual([5]);
  });

  test("a current district reused by the new view is built and transferred exactly once", async () => {
    const f = fixture();
    f.worker.update(["shared", "old"], [], 1);
    f.worker.update(["shared", "resident", "new"], ["resident"], 2);
    await f.finish("shared");
    expect(f.builds).toEqual(["shared", "new"]);
    await f.finish("new");
    expect(f.settled).toEqual([2]);
  });

  test("retained source IDs survive a resume while later evicted districts rebuild on return", async () => {
    const f = fixture();
    f.worker.update(["retained", "missing"], ["retained"], 1);
    expect(f.builds).toEqual(["missing"]);
    await f.finish("missing");
    expect(f.settled).toEqual([1]);
    f.worker.update(["remote"], [], 2);
    await f.finish("remote");
    // The main-thread retained set is authoritative after its bounded eviction.
    f.worker.update(["retained", "missing"], [], 3);
    await f.finish("retained");
    await f.finish("missing");
    expect(f.builds).toEqual(["missing", "remote", "retained", "missing"]);
    expect(f.settled).toEqual([1, 2, 3]);
    expect(f.maxPending).toBe(1);
  });

  test("stop while waiting for an ACK prevents all later builds and settled messages", async () => {
    const f = fixture();
    f.worker.update(["a", "b"], [], 1);
    f.worker.stop();
    f.worker.stop();
    f.worker.update(["c"], [], 2);
    await f.finish("a");
    expect(f.builds).toEqual(["a"]);
    expect(f.settled).toEqual([]);
    expect(f.failures).toEqual([]);
  });

  test("an intentional stop also suppresses a rejected old in-flight build", async () => {
    const f = fixture();
    f.worker.update(["a"], [], 1);
    f.worker.stop();
    await f.finish("a", new Error("old viewer disposed"));
    expect(f.failures).toEqual([]);
    expect(f.settled).toEqual([]);
  });

  test("a live build failure reports once and stops subsequent work", async () => {
    const f = fixture();
    const error = new Error("transfer failed");
    f.worker.update(["a", "b"], [], 1);
    await f.finish("a", error);
    f.worker.update(["c"], [], 2);
    expect(f.failures).toEqual([error]);
    expect(f.builds).toEqual(["a"]);
    expect(f.settled).toEqual([]);
  });

  test("copies and deduplicates caller priorities before asynchronous execution", async () => {
    const f = fixture();
    const wanted = ["a", "a", "b", "b"];
    f.worker.update(wanted, [], 1);
    wanted.splice(0, wanted.length, "mutation");
    await f.finish("a");
    await f.finish("b");
    expect(f.builds).toEqual(["a", "b"]);
    expect(f.settled).toEqual([1]);
  });
});

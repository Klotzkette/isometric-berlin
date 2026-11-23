import type { Group } from "three";
import { arrivalRoadIdsV376 } from "./arrivalRoadRangesV376";

export type ArrivalRoadV376 = { id: string; root: Group };

type RoadViewHooks = {
  signal: AbortSignal;
  active: () => boolean;
  attached: () => Set<string>;
  load: (x: number, z: number, completed: ReadonlySet<string>, signal: AbortSignal) => AsyncIterable<ArrivalRoadV376>;
  attach: (road: ArrivalRoadV376) => Promise<void>;
  remove: (root: Group) => void;
};

/** Only the current arrival may get ahead of the ordinary city stream. Once a
 * worker has accepted an attached ID, ownership passes permanently to the city. */
export function createArrivalRoadViewV376(hooks: RoadViewHooks) {
  const early = new Map<string, Group>();
  let active = false;
  let stopped = false;
  let wanted: string[] = [];
  let query: AbortController | undefined;
  let work: Promise<void> | undefined;
  let revision = 0;
  let x = NaN, z = NaN, retryAt = 0;
  let lastCheck = -Infinity;

  function release(id: string, root: Group): void {
    early.delete(id);
    hooks.remove(root);
  }

  async function publish(road: ArrivalRoadV376): Promise<void> {
    try { await hooks.attach(road); }
    catch { if (early.get(road.id) === road.root) release(road.id, road.root); }
  }

  function run(): void {
    if (stopped || work || wanted.length === 0) return;
    if (!hooks.active()) { retryAt = performance.now(); return; }
    const completed = hooks.attached();
    for (const id of early.keys()) completed.add(id);
    if (wanted.every(id => completed.has(id))) return;
    const ticket = revision;
    const controller = new AbortController();
    query = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    work = (async () => {
      for await (const road of hooks.load(x, z, completed, controller.signal)) {
        if (!hooks.active()) {
          hooks.remove(road.root);
          retryAt = performance.now();
          controller.abort();
          break;
        }
        if (stopped || controller.signal.aborted || !wanted.includes(road.id) || hooks.attached().has(road.id)) {
          hooks.remove(road.root);
          continue;
        }
        // Retire only unclaimed arrivals outside the new camera neighbourhood.
        // Its wanted set contains at most four cells, including edge crossings.
        for (const [id, root] of early) if (!wanted.includes(id)) release(id, root);
        early.set(road.id, road.root);
        if (active) void publish(road);
      }
    })().catch(() => { if (ticket === revision) retryAt = performance.now() + 2000; }).finally(() => {
      if (!stopped && controller.signal.aborted && ticket === revision && !retryAt) retryAt = performance.now() + 2000;
      clearTimeout(timeout);
      work = undefined;
      query = undefined;
      if (ticket !== revision) run();
    });
  }

  function update(nextX: number, nextZ: number, now: number): void {
    if (stopped || now - lastCheck < 100 || !hooks.active()) return;
    lastCheck = now;
    const moved = !(Math.abs(nextX - x) < 20 && Math.abs(nextZ - z) < 20);
    if (!moved && (!retryAt || now < retryAt)) return;
    x = nextX; z = nextZ;
    const ids = arrivalRoadIdsV376(x, z);
    if (ids.length !== wanted.length || ids.some((id, index) => wanted[index] !== id)) {
      revision++;
      wanted = ids;
      query?.abort();
      retryAt = 0;
      run();
    } else if (retryAt && now >= retryAt) {
      retryAt = 0;
      run();
    }
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    query?.abort();
    hooks.signal.removeEventListener("abort", stop);
    // Published groups remain owned by the world and its disposal transaction.
    for (const [id, root] of early) if (!root.parent) release(id, root);
    early.clear();
  }
  hooks.signal.addEventListener("abort", stop, { once: true });
  if (hooks.signal.aborted) stop();
  return {
    update, stop,
    adopt(id: string) { early.delete(id); },
    async opening(): Promise<void> {
      if (!work) return;
      // The bounded opening fetch normally finishes during city construction.
      // Slow or incomplete offline delivery must still permit the preview.
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 450);
        void work!.then(() => { clearTimeout(timeout); resolve(); });
      });
    },
    activate() {
      active = true;
      for (const [id, root] of early) if (!root.parent) void publish({ id, root });
    },
  };
}

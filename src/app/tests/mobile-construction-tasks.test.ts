import { expect, test } from "bun:test";
import { completeCooperatively } from "../src/cooperativeWork";
import { createMobileConstructionTasks } from "../src/mobileConstructionTasks";

function harness(active: boolean) {
  const browserJobs: Array<() => void> = [];
  const controller = new AbortController();
  const tasks = createMobileConstructionTasks(
    () => new Promise(resolve => browserJobs.push(resolve)), controller.signal, active,
  );
  return { tasks, controller, browserJobs };
}

test("a queued construction slice cannot build behind a hidden iPhone tab", async () => {
  const { tasks, browserJobs } = harness(true);
  const built: number[] = [];
  function* build() { built.push(1); yield; built.push(2); return "complete"; }
  const done = completeCooperatively(build(), {
    yieldTask: tasks.yieldTask, isCancelled: () => false, budgetMs: 0,
  });
  expect(browserJobs).toHaveLength(1);
  tasks.setActive(false);
  browserJobs.shift()!(); await Promise.resolve();
  expect(built).toEqual([]);
  expect(browserJobs).toHaveLength(0);
  tasks.setActive(true); tasks.setActive(true);
  expect(browserJobs).toHaveLength(1);
  browserJobs.shift()!(); await Promise.resolve(); await Promise.resolve();
  expect(built).toEqual([1]);
  browserJobs.shift()!();
  expect(await done).toBe("complete");
  expect(built).toEqual([1, 2]);
});

test("unmount rejects every paused continuation even when the browser never delivers its queued task", async () => {
  const { tasks, browserJobs, controller } = harness(true);
  const started = tasks.yieldTask();
  tasks.setActive(false);
  const paused = tasks.yieldTask();
  expect(browserJobs).toHaveLength(1);
  controller.abort();
  for (const p of [started, paused, tasks.yieldTask()]) {
    await expect(p).rejects.toBe(controller.signal.reason);
  }
  tasks.setActive(true);
  browserJobs.shift()!(); await Promise.resolve();
  expect(browserJobs).toHaveLength(0);
});

test("two viewers have independent visibility and cancellation", async () => {
  const hidden = harness(false), visible = harness(true);
  const waiting = hidden.tasks.yieldTask(), running = visible.tasks.yieldTask();
  expect(hidden.browserJobs).toHaveLength(0);
  hidden.controller.abort();
  await expect(waiting).rejects.toBe(hidden.controller.signal.reason);
  visible.browserJobs.shift()!(); await running;
  expect(visible.tasks.suspended).toBe(false);
});

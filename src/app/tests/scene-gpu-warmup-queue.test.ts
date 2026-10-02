import { expect, test } from "bun:test";
import { SceneGpuWarmupQueue } from "../src/sceneGpuWarmupQueue";

test("render-order removal preserves the remaining preparation order", () => {
  const queue = new SceneGpuWarmupQueue<number>();
  for (let index = 0; index < 30_000; index++) queue.add(index);
  queue.refreshView();
  for (let index = 29_999; index >= 0; index -= 2) queue.delete(index);
  expect(queue.length).toBe(15_000);
  expect(queue.pendingCount).toBe(15_000);
  for (let index = 0; index < 30_000; index += 2) {
    expect(queue.first).toBe(index);
    queue.delete(index);
  }
  expect(queue.first).toBeUndefined();
  expect(queue.length).toBe(0);
  expect(queue.pendingCount).toBe(0);
});

test("far candidates stay dormant while ordinary draws remove any position", () => {
  const queue = new SceneGpuWarmupQueue<string>();
  for (const item of ["far-a", "near-a", "far-b", "near-b"]) queue.add(item);
  queue.rotate("far-a");
  queue.delete("near-b"); // Rendered before the look-ahead reaches it.
  expect(queue.pendingCount).toBe(2);
  queue.delete("far-a"); // Already considered: do not decrement twice.
  expect(queue.pendingCount).toBe(2);
  expect(queue.first).toBe("near-a");
  queue.delete("near-a");
  queue.rotate("far-b");
  expect(queue.pendingCount).toBe(0);
  expect(queue.length).toBe(1);
  queue.add("arriving");
  queue.add("arriving");
  expect(queue.pendingCount).toBe(1);
  queue.refreshView();
  expect(queue.pendingCount).toBe(2);
  queue.rotate("far-b");
  expect(queue.first).toBe("arriving");
  queue.delete("arriving");
  expect(queue.pendingCount).toBe(0);
  queue.refreshView();
  expect(queue.pendingCount).toBe(1);
  queue.delete("far-b");
  expect(queue.first).toBeUndefined();
  expect(queue.pendingCount).toBe(0);
});

test("released subtrees and a cleared queue retain no candidate eligibility", () => {
  const queue = new SceneGpuWarmupQueue<object>();
  const first = {}, second = {}, replacement = {};
  queue.add(first); queue.add(second); queue.rotate(first);
  queue.clear();
  expect(queue.has(first)).toBeFalse();
  expect(queue.has(second)).toBeFalse();
  expect(queue.pendingCount).toBe(0);
  expect(queue.first).toBeUndefined();
  queue.delete(first); queue.rotate(second); queue.refreshView();
  expect(queue.length).toBe(0);
  queue.add(replacement);
  expect(queue.first).toBe(replacement);
  expect(queue.pendingCount).toBe(1);
});

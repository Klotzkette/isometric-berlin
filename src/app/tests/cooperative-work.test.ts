import { expect, test } from "bun:test";
import { completeCooperatively } from "../src/cooperativeWork";

test("yields to tasks at the budget and preserves result and ordering", async () => {
  let time = 0;
  const events: string[] = [];
  const result = { complete: true };
  function* build() {
    for (let i = 0; i < 7; i += 1) {
      events.push(`step${i}`);
      time += 3;
      yield;
    }
    return result;
  }
  expect(
    await completeCooperatively(build(), {
      now: () => time,
      yieldTask: async () => {
        events.push("task");
      },
      isCancelled: () => false,
    }),
  ).toBe(result);
  expect(events).toEqual([
    "task",
    "step0",
    "step1",
    "step2",
    "task",
    "step3",
    "step4",
    "step5",
    "task",
    "step6",
  ]);
});

test("a mode change before construction does not allocate a world", async () => {
  let started = false;
  function* build() {
    started = true;
    yield;
    return 1;
  }
  await expect(
    completeCooperatively(build(), {
      yieldTask: async () => {},
      isCancelled: () => true,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(started).toBe(false);
});

test("mid-build cancellation closes suspended state without the next step", async () => {
  let cancelled = false;
  let closed = false;
  let count = 0;
  function* build() {
    try {
      for (let i = 0; i < 10; i += 1) {
        count += 1;
        yield;
      }
      return 10;
    } finally {
      closed = true;
    }
  }
  await expect(
    completeCooperatively(build(), {
      budgetMs: 0,
      yieldTask: async () => {
        if (count === 2) cancelled = true;
      },
      isCancelled: () => cancelled,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(count).toBe(2);
  expect(closed).toBe(true);
});

test("scheduler failure closes suspended locals and keeps its error", async () => {
  let closed = false;
  let tasks = 0;
  function* build() {
    try {
      yield;
      return 1;
    } finally {
      closed = true;
    }
  }
  const error = new Error("scheduler failed");
  await expect(
    completeCooperatively(build(), {
      budgetMs: 0,
      yieldTask: async () => {
        if (++tasks > 1) throw error;
      },
      isCancelled: () => false,
    }),
  ).rejects.toBe(error);
  expect(closed).toBe(true);
});

test("constructor failures propagate for the caller's resource rollback", async () => {
  const error = new Error("allocation failed");
  function* build() {
    yield;
    throw error;
  }
  await expect(
    completeCooperatively(build(), {
      yieldTask: async () => {},
      isCancelled: () => false,
    }),
  ).rejects.toBe(error);
});

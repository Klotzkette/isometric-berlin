import { describe, expect, test } from "bun:test";
import { runBoundedTasks } from "../src/boundedTaskPool";

describe("bounded task pool", () => {
  test("attempts all 100 jobs without exceeding concurrency after failures", async () => {
    const jobs = Array.from({ length: 100 }, (_, index) => index);
    const attempted: number[] = [];
    let active = 0;
    let peak = 0;

    const failures = await runBoundedTasks(jobs, 4, async (job) => {
      active += 1;
      peak = Math.max(peak, active);
      attempted.push(job);
      await Promise.resolve();
      active -= 1;
      if (job % 13 === 0) {
        throw new Error(`failed ${job}`);
      }
    });

    expect(attempted.sort((left, right) => left - right)).toEqual(jobs);
    expect(peak).toBeLessThanOrEqual(4);
    expect(failures.map((failure) => failure.item)).toEqual([
      0, 13, 26, 39, 52, 65, 78, 91,
    ]);
  });
});

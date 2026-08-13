import { describe, expect, test } from "bun:test";

import { fetchJsonWithRetry, type FetchLike } from "../src/resilientFetch";

describe("resilient JSON loading", () => {
  test("retries one transient failure and returns parsed JSON", async () => {
    let calls = 0;
    const fetcher: FetchLike = async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError("temporary network failure");
      }
      return new Response(JSON.stringify({ ready: true }), { status: 200 });
    };

    await expect(
      fetchJsonWithRetry<{ ready: boolean }>("scene.json", { fetcher }),
    ).resolves.toEqual({ ready: true });
    expect(calls).toBe(2);
  });

  test("times out stalled transfers instead of waiting forever", async () => {
    const fetcher: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });

    await expect(
      fetchJsonWithRetry("stalled.json", {
        attempts: 1,
        fetcher,
        timeoutMs: 5,
      }),
    ).rejects.toBeDefined();
  });

  test("honours parent cancellation without retrying", async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetcher: FetchLike = (_input, init) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
    };
    const request = fetchJsonWithRetry("scene.json", {
      fetcher,
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toBeDefined();
    expect(calls).toBe(1);
  });
});

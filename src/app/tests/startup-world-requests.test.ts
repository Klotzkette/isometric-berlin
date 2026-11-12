import { describe, expect, test } from "bun:test";
import { fetchJsonWithRetry, type FetchLike } from "../src/resilientFetch";
import { createStartupWorldRequests } from "../src/startupWorldRequests";
import { VOXEL_WORLD_FILE } from "../src/terrainPayload";

const scene = new URL("https://viewer.example/berlin/mesh/regierungsviertel/scene.json");
const prism = new URL("lod2-prisms.json", scene);

describe("startup world request handoff", () => {
  test("starts one heavy Drawn transfer and the scene index before the runtime adopts it", async () => {
    const requests: string[] = [];
    const response = new Response(JSON.stringify({ source: "unchanged" }));
    const startup = createStartupWorldRequests(async input => {
      requests.push(String(input));
      return response;
    });

    startup.prime(scene, "flood");
    expect(requests).toEqual([scene.href, prism.href]);
    expect(response.bodyUsed).toBe(false);

    const value = await fetchJsonWithRetry(prism, { fetcher: startup.adopt() });
    expect(value).toEqual({ source: "unchanged" });
    expect(requests).toHaveLength(2);
    startup.discard();
  });

  test("Minecraft starts its own terrain and the scene index", () => {
    const requests: string[] = [];
    const startup = createStartupWorldRequests(async input => {
      requests.push(String(input));
      return new Response("{}");
    });

    startup.prime(scene, "minecraft");
    startup.prime(scene, "night");
    expect(requests).toEqual(["scene.json", VOXEL_WORLD_FILE]
      .map(file => new URL(file, scene).href));
    startup.discard();
  });

  test("reuses the normal retry after a primed response fails", async () => {
    let prismAttempts = 0;
    const startup = createStartupWorldRequests(async input => {
      if (String(input) === prism.href && ++prismAttempts === 1) throw new Error("offline");
      return new Response("[1,2,3]");
    });
    startup.prime(scene, "day");

    expect(await fetchJsonWithRetry(prism, { fetcher: startup.adopt() })).toEqual([1, 2, 3]);
    expect(prismAttempts).toBe(2);
    startup.discard();
  });

  test("discards unclaimed requests and links adopted requests to the runtime", async () => {
    const signals = new Map<string, AbortSignal>();
    const fetcher: FetchLike = (input, init) => new Promise((_, reject) => {
      const signal = init?.signal;
      if (!signal) throw new Error("Request is missing its abort signal");
      signals.set(String(input), signal);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const startup = createStartupWorldRequests(fetcher);
    startup.prime(scene, "day");
    const runtime = new AbortController();
    const result = fetchJsonWithRetry(prism, { signal: runtime.signal, fetcher: startup.adopt() });

    startup.discard();
    expect(signals.get(scene.href)?.aborted).toBe(true);
    expect(signals.get(prism.href)?.aborted).toBe(false);
    runtime.abort();
    await expect(result).rejects.toHaveProperty("name", "AbortError");
    expect(signals.get(prism.href)?.aborted).toBe(true);
  });

  test("skips priming when a cached runtime starts first", async () => {
    const requests: string[] = [];
    const startup = createStartupWorldRequests(async input => {
      requests.push(String(input));
      return new Response("{}");
    });

    const reader = startup.adopt();
    startup.prime(scene, "day");
    await fetchJsonWithRetry(prism, { fetcher: reader });
    expect(requests).toEqual([prism.href]);
  });
});

import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// v1.0.11 replaces the BahnTower, music museum and bounded Spreebogen bank
// while preserving their source records and unrelated terrain. Synchronous buffers are compared with cooperative
// construction, including all geometry, colours and instance capacities.
for (const [profile, sha256, instances, renderables, bufferBytes] of [
  ["full", "82832658023b7b1773a7328cb949578d52019e02137b1ba1e4e79b018d0d65e2", 3794603, 96, 289620142],
  ["mobile", "836445338101473a01a8c549a7ee5fd93300f2f8338c6dfde31a81da844b7d1c", 991634, 94, 76027470],
] as const) {
  test(`${profile}: interruptible construction matches the current synchronous appearance baseline`, () => {
    const script = fileURLToPath(
      new URL("../scripts/benchmark-minecraft-world.ts", import.meta.url),
    );
    const run = Bun.spawnSync([
      process.execPath,
      script,
      "--cooperative",
      ...(profile === "mobile" ? ["--mobile"] : []),
    ]);
    expect(run.exitCode).toBe(0);
    const result = JSON.parse(run.stdout.toString());
    expect(result).toMatchObject({
      detailProfile: profile,
      sha256,
      instances,
      renderables,
      bufferBytes,
    });
    expect(result.taskCount).toBeGreaterThan(2);
  }, 60000);
}

test("the viewer owns partial buffers before yielding and publishes only the complete root", async () => {
  const source = await Bun.file(
    new URL("../src/ThreeViewer.tsx", import.meta.url),
  ).text();
  const loader = source.slice(
    source.indexOf("function ensureVoxelWorld("),
    source.indexOf("function ensureVoxelWorld(") + 12000,
  );
  const owned = loader.indexOf("provisionalVoxelWorld = new Group()");
  const run = loader.indexOf("await completeCooperatively(");
  const publish = loader.indexOf("runtime.voxelWorld = provisionalVoxelWorld");
  expect(owned).toBeGreaterThan(0);
  expect(owned).toBeLessThan(run);
  expect(run).toBeLessThan(publish);
  expect(loader).toContain(
    "runtime.disposed || !voxelWorldIntentActive(runtime)",
  );
  expect(loader).toContain("disposeObject3D(runtime, provisionalVoxelWorld)");
});

test("late inactive downloads cannot leave progress above an already-ready world", async () => {
  const source = await Bun.file(new URL("../src/ThreeViewer.tsx", import.meta.url)).text();
  for (const [loaderName, intent] of [["ensureIsoWorld", "isoWorldIntentActive"], ["ensureVoxelWorld", "voxelWorldIntentActive"]]) {
    const loader = source.slice(source.indexOf(`function ${loaderName}(`));
    const tracked = loader.slice(loader.indexOf("const tracked ="), loader.indexOf("let provisional"));
    expect(tracked).toContain(`if (${intent}(runtime))`);
    expect(tracked.indexOf(`if (${intent}(runtime))`)).toBeLessThan(tracked.indexOf("runtime.reportCoreProgress"));
  }
  expect(source.replaceAll("\r\n", "\n")).toContain('if (currentStartupPresentationStatus(runtime) === "ready") {\n        runtime.reportCoreProgress(1, 1);');
});

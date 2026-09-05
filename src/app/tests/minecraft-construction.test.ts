import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Appearance baselines updated for the v0.72.43 Potsdamer panorama refinement,
// intentionally superseding the byte-identical v0.72.41/v0.72.42 output.
// Complete committed payloads remain unchanged,
// including sampled colours and the tunnel. Hashes include every geometry,
// index, colour and instance buffer, even spare allocated capacity.
for (const [profile, sha256, instances, renderables, bufferBytes] of [
  [
    "full",
    "157605b35505742f44e246becfcfc1379e49b181c95bdd083024a660c3bd7305",
    3397805,
    50,
    259656668,
  ],
  [
    "mobile",
    "68472a5b72e8ce101a6f268c93f4355aa931eeaf9578a52b8e58f34be7323430",
    788936,
    48,
    60702128,
  ],
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

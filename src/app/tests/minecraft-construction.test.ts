import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// v1.0.1 appearance baselines include the source-bound Abgeordnetenhaus
// replacement and Gropius Bau facade refinement.
// Complete committed payloads remain unchanged,
// including sampled colours and the tunnel. Hashes include every geometry,
// index, colour and instance buffer, even spare allocated capacity.
for (const [profile, sha256, instances, renderables, bufferBytes] of [
  [
    "full",
    "9ad53b3bb70e90db55589d1b26df2feefca9a12f2d599afad3af1e6b4ded3c83",
    3572980,
    52,
    272749420,
  ],
  [
    "mobile",
    "d70f0747edd976c74312461d7332c284cab0780d11acebe3a282e0f25da641d0",
    813167,
    50,
    62436604,
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

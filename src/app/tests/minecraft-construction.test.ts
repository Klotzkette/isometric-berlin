import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// v1.0.47 adds source-complete Palais, James-Simon, Komische Oper, U-Bahn
// mouths and native avenue tops, plus requested museum/Schloss refinements.
// v146 remains documented in docs/release-v1.0.47-review.md.
// Full +19,655 instances/+1,590,092 bytes; mobile +22,053/+1,772,340 bytes.
// Both add six draws; original sources and unrelated geometry remain.
// Independent synchronous measurements are compared with cooperative buffers;
// existing geometry quality and every instance capacity remain accounted for.
for (const [profile, sha256, instances, renderables, bufferBytes] of [
  ["full", "4725f688316f57506e3d269e9531948615545e85e49a4716c2bbb67fd4a42794", 3904547, 162, 302234241],
  ["mobile", "c011fe412b8e91120508643d2e873106c80e8ab2f63dd209a8a839f4f05b6537", 1141809, 160, 91816697],
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

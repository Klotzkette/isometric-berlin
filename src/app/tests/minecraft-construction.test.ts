import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import baseline from "./fixtures/minecraft-world-synchronous-v166.json";

// Synchronous v166 measurements must equal cooperative construction below.
// Earlier fixtures remain frozen. This cumulative baseline retains the v165
// world and adds the bounded Alexander-Nord, City West, Moabit, Mitte, KOSMOS
// and Upbeat refinements measured after their production models were frozen.
// It proves construction-path equality, not historical appearance preservation.
// Source retention and full/mobile detail are independently tested per model.
for (const [profile, expected] of Object.entries(baseline)) {
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
    expect(result).toMatchObject(expected);
    expect(result.taskCount).toBeGreaterThan(2);
  }, 60000);
}

test("the viewer owns partial buffers before yielding and publishes only the complete root", async () => {
  const source = await Bun.file(
    new URL("../src/ThreeViewer.tsx", import.meta.url),
  ).text();
  // Follow the actual declaration boundary: added model navigation must not
  // silently truncate the loader before its rollback/disposal branch.
  const parsed = ts.createSourceFile("ThreeViewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const loader = parsed.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === "ensureVoxelWorld")!.getText(parsed);
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

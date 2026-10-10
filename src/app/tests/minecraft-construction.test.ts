import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import baseline from "./fixtures/minecraft-world-synchronous-v204.json";
import current from "./fixtures/minecraft-world-synchronous-v206.json";
import urania from "../src/data/uraniaArcV206Navigation.json";
import historical from "./fixtures/minecraft-world-synchronous-v200.json";
import audit from "./fixtures/minecraft-world-v204-baseline-audit.json";
import bendlerblock from "../src/data/bendlerblockV202Navigation.json";
import panorama from "../src/pergamonPanoramaV202Source.json";

// Independently measured synchronous v204 geometry must equal cooperative
// construction below. All earlier fixtures remain frozen. The read-only
// audit-native-v204-baselines.ts reproduces both exact v200 hashes by restoring
// only the two v202 column predicates, the documented James-Simon model and
// the old single MuseumTriad batch. Every other mesh stays byte-identical.
// This cumulative fixture proves construction-path equality; separate source
// audits prove prior detail retention.
test("v204 fixture has an exact historical counterfactual and bounded owner-transfer accounting", async () => {
  expect(audit.releasedBase).toBe("cca429f4");
  expect(bendlerblock.columns).toHaveLength(679);
  expect(panorama.native_replacement_columns).toHaveLength(161);
  const columns = [...bendlerblock.columns, ...panorama.native_replacement_columns];
  expect(new Set(columns.map(c => c.join(","))).size).toBe(840);
  for (const [name, digest] of Object.entries(audit.sourceSha256)) {
    // Code hashes document the independent historical capture. Runtime code
    // remains free to evolve losslessly; the complete buffer hash below is
    // its contract. The retained source signatures themselves stay frozen.
    if (!name.endsWith(".json")) continue;
    const source = await Bun.file(new URL(`../../../${name}`, import.meta.url)).arrayBuffer();
    expect(new Bun.CryptoHasher("sha256").update(source).digest("hex")).toBe(digest);
  }
  for (const profile of ["full", "mobile"] as const) {
    const proof = audit.profiles[profile];
    expect(proof.legacy).toEqual(historical[profile]);
    expect(proof.current).toEqual(baseline[profile]);
    expect(proof.unchangedMeshCount).toBe(profile === "full" ? 346 : 345);
    const sum = (rows: typeof proof.beforeChanged, name: string) => rows.filter(r => r.name === name).reduce((n, r) => n + r.instances, 0);
    const delta = (name: string) => sum(proof.afterChanged, name) - sum(proof.beforeChanged, name);
    expect(delta("Voxel building columns")).toBe(profile === "full" ? -2520 : -840);
    expect(delta("Voxel facade windows")).toBe(profile === "full" ? -2697 : 0);
    expect(delta("James-Simon single native block batch")).toBe(111);
    expect(delta("Museum triad native blocks box")).toBe(0);
    const net = proof.current.instances - proof.legacy.instances;
    expect(net).toBe(profile === "full" ? -5106 : -729);
    expect(proof.current.bufferBytes - proof.legacy.bufferBytes).toBe(net * 76);
    expect(proof.current.renderables - proof.legacy.renderables).toBe(1);
  }
});
test("v206 synchronous construction transfers only the independently audited Urania coarse owner", () => {
  expect(urania.legacyVoxelColumns).toHaveLength(86);
  for (const profile of ["full", "mobile"] as const) {
    // The independent minecraft-payload-only-v206 receipt restores every old
    // instance byte: full loses 258 columns +144 panes, exposes 12 neighbour
    // panes; mobile transfers exactly 86 coarse columns. Earlier hashes stay.
    const removed = profile === "full" ? 258 + 144 - 12 : 86;
    expect(current[profile].instances).toBe(baseline[profile].instances - removed);
    expect(current[profile].bufferBytes).toBe(baseline[profile].bufferBytes - removed * 76);
    expect(current[profile].renderables).toBe(baseline[profile].renderables);
  }
});

for (const [profile, expected] of Object.entries(current)) {
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

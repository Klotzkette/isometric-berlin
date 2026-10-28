import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import baseline from "./fixtures/minecraft-world-synchronous-v204.json";
import v206 from "./fixtures/minecraft-world-synchronous-v206.json";
import v208 from "./fixtures/minecraft-world-synchronous-v208.json";
import v211 from "./fixtures/minecraft-world-synchronous-v211.json";
import v218 from "./fixtures/minecraft-world-synchronous-v218.json";
import current from "./fixtures/minecraft-world-synchronous-v219.json";
import native218 from "./fixtures/core-material-native-v218.json";
import native219 from "./fixtures/core-material-native-v219.json";
import audit218 from "./fixtures/minecraft-world-v218-baseline-audit.json";
import audit219 from "./fixtures/minecraft-world-v219-baseline-audit.json";
import audit211 from "./fixtures/minecraft-world-v211-colour-audit.json";
import audit208 from "./fixtures/minecraft-world-v208-baseline-audit.json";
import frontage208 from "./fixtures/frontage-preservation-v208.json";
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
    expect(v206[profile].instances).toBe(baseline[profile].instances - removed);
    expect(v206[profile].bufferBytes).toBe(baseline[profile].bufferBytes - removed * 76);
    expect(v206[profile].renderables).toBe(baseline[profile].renderables);
  }
});

test("v208 whole-world change is exactly the immutable v107 Aeroflot and Quartier206 facade complement", async () => {
  expect(audit208.releasedBase).toBe("edcde0e7d05552d1e8900c9c87e1da9b40e02f76");
  expect(audit208.historicalBaseline).toBe("minecraft-world-synchronous-v206.json");
  expect(Object.keys(audit208.sourceSha256)).toHaveLength(559);
  for (const path of ["src/app/src/MinecraftUnterDenLindenDetails.ts", "src/app/src/GendarmenmarktPerimeterFacades.ts"] as const)
    expect(audit208.sourceSha256[path]).toBe(frontage208.baseline.sourceSha256[path]);
  // The complete voxel columns, source roofs and ground dataset remain byte-identical.
  for (const name of ["minecraft-voxels.json", "lod2-prisms.json", "scene.json"] as const) {
    const path = `src/app/public/mesh/regierungsviertel/${name}` as const;
    const bytes = await Bun.file(new URL(`../../../${path}`, import.meta.url)).arrayBuffer();
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(audit208.sourceSha256[path]);
  }
  for (const profile of ["full", "mobile"] as const) {
    const proof = audit208.profiles[profile];
    expect(proof.legacy).toEqual(v206[profile]);
    expect(proof.current).toEqual(v208[profile]);
    expect(proof.unchangedMeshCount).toBe(profile === "full" ? 348 : 346);
    expect(proof.beforeChanged.map(r => [r.name, r.instances])).toEqual([
      ["Unter den Linden native facade blocks box", 636], ["Quartier 206 stone", 1169], ["Quartier 206 glass", 81],
    ]);
    expect(proof.afterChanged.map(r => [r.name, r.instances])).toEqual([["Unter den Linden native facade blocks box", 581]]);
    expect(proof.legacy.instances - proof.current.instances).toBe(55 + 1169 + 81);
    expect(proof.legacy.bufferBytes - proof.current.bufferBytes).toBe(99828);
    expect(proof.legacy.renderables - proof.current.renderables).toBe(2);
    // Independent small-factory capture agrees with the complete-world delta.
    const removed = frontage208.baseline.gendarmenmarkt.minecraft.budget.instances - frontage208.retained.gendarmenmarkt.minecraft.budget.instances
      + frontage208.baseline.linden.minecraft.budget.instances - frontage208.retained.linden.minecraft.budget.instances;
    expect(removed).toBe(proof.legacy.instances - proof.current.instances);
  }
});

test("v211 changes only existing column colour values with every non-colour world buffer retained", () => {
  expect(audit211.releasedBase).toBe("563028bdb0bc0e22a789edc5c3fa59f21028b1c9");
  expect(audit211.historicalBaseline).toBe("minecraft-world-synchronous-v208.json");
  expect(Object.keys(audit211.beforeSourceSha256).sort()).toEqual([
    "src/app/src/IsometricCityWorld.ts", "src/app/src/MinecraftVoxelWorld.ts",
  ]);
  for (const profile of ["full", "mobile"] as const) {
    const proof = audit211.profiles[profile];
    expect(proof.before).toEqual(v208[profile]);
    expect(proof.current).toEqual(v211[profile]);
    expect(proof.beforeNonColourSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(proof.currentNonColourSha256).toBe(proof.beforeNonColourSha256);
    expect(proof.changedColourMeshes.map(row => row.name)).toEqual(["Voxel building columns"]);
    expect(proof.changedColourMeshes[0].beforeColours).not.toBe(proof.changedColourMeshes[0].currentColours);
    expect(proof.unchangedMeshCount).toBe(v208[profile].renderables - 1);
    for (const key of ["instances", "renderables", "bufferBytes"] as const)
      expect(v211[profile][key]).toBe(v208[profile][key]);
  }
});

test("v218 whole-world receipt isolates the four refined facade meshes and one additive Kalkscheune batch from v117", async () => {
  expect(audit218.releasedBase).toBe("1db721153e44af4965bcabc80bf56eb4c7f0fe75");
  for (const [path, hash] of Object.entries(audit218.sourceSha256)) {
    const bytes = await Bun.file(new URL(`../../../${path}`, import.meta.url)).arrayBuffer();
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(hash);
  }
  const changed = ["Luisen corridor masonry and metal details", "Luisen corridor framed glazing", "Friedrichstrasse masonry and metal", "Friedrichstrasse facade glazing"];
  for (const profile of ["full", "mobile"] as const) {
    const { world, core } = audit218.profiles[profile];
    expect(world.current).toEqual(v218[profile]);
    expect(core.current).toEqual(native218[profile]);
    expect(world.unchangedObjectCount).toBe(profile === "full" ? 353 : 351);
    expect(core.unchangedObjectCount).toBe(profile === "full" ? 340 : 338);
    for (const [family, proof] of [["world", world], ["core", core]] as const) {
      expect(proof.beforeChanged.map(row => row.name)).toEqual(changed);
      expect(proof.afterChanged.map(row => row.name)).toEqual([
        ...changed.slice(0, 2), "Kalkscheune plaster, divided windows, factory glazing and sign", ...changed.slice(2),
      ]);
      const sum = (rows: typeof proof.beforeChanged, key: "instances" | "bytes") => rows.reduce((n, row) => n + row[key], 0);
      const instanceDelta = sum(proof.afterChanged, "instances") - sum(proof.beforeChanged, "instances");
      const byteDelta = sum(proof.afterChanged, "bytes") - sum(proof.beforeChanged, "bytes");
      expect(instanceDelta).toBe(family === "world" ? 8407 : 8377);
      expect(byteDelta).toBe(instanceDelta * 76 + 648); // one new shared cube
      if (family === "world") {
        expect(world.current.instances - world.before.instances).toBe(instanceDelta);
        expect(world.current.bufferBytes - world.before.bufferBytes).toBe(byteDelta);
        expect(world.current.renderables - world.before.renderables).toBe(1);
      } else {
        expect(core.current.bytes - core.before.bytes).toBe(byteDelta);
        expect(core.current.bufferRecords - core.before.bufferRecords).toBe(2);
      }
    }
  }
});

test("v219 exactly reproduces v118 and changes only the Albrechtstraße and Mori-Ôgai facade families", () => {
  expect(audit219.releasedBase).toBe("c6f7f9d4937d7689ef5b44aa98c98ab80121e96e");
  expect(audit219.historicalWorldBaseline).toBe("minecraft-world-synchronous-v218.json");
  expect(audit219.historicalCoreBaseline).toBe("core-material-native-v218.json");
  expect(audit219.sourceSha256).toEqual(audit218.sourceSha256);
  const sources = [
    "src/app/src/FriedrichstrasseArchitecture.ts", "src/app/src/LuisenCorridorArchitecture.ts",
    "src/app/src/friedrichstrasseArchitectureProfile.ts", "src/app/src/luisenCorridorProfile.ts",
  ];
  expect(Object.keys(audit219.beforeSourceSha256).sort()).toEqual(sources);
  expect(Object.keys(audit219.currentSourceSha256).sort()).toEqual(sources);
  for (const [path, digest] of Object.entries(audit219.beforeSourceSha256))
    expect(digest).toBe(audit218.currentSourceSha256[path as keyof typeof audit218.currentSourceSha256]);
  const changed = ["Luisen corridor masonry and metal details", "Luisen corridor framed glazing", "Friedrichstrasse masonry and metal", "Friedrichstrasse facade glazing"];
  for (const profile of ["full", "mobile"] as const) {
    const { world, core } = audit219.profiles[profile];
    expect(world.before).toEqual(v218[profile]);
    expect(world.current).toEqual(current[profile]);
    expect(core.before).toEqual(native218[profile]);
    expect(core.current).toEqual(native219[profile]);
    expect(world.unchangedObjectCount).toBe(profile === "full" ? 354 : 352);
    expect(core.unchangedObjectCount).toBe(profile === "full" ? 341 : 339);
    for (const [family, proof] of [["world", world], ["core", core]] as const) {
      expect(proof.beforeUnchangedSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(proof.currentUnchangedSha256).toBe(proof.beforeUnchangedSha256);
      expect(proof.beforeChanged).toEqual(audit218.profiles[profile][family].afterChanged.filter(row => changed.includes(row.name)));
      expect(proof.beforeChanged.map(row => row.name)).toEqual(changed);
      expect(proof.afterChanged.map(row => row.name)).toEqual(changed);
      expect(proof.afterChanged.map((row, i) => row.instances - proof.beforeChanged[i].instances)).toEqual([1, -3, 58, 0]);
      expect(proof.afterChanged.map((row, i) => row.bytes - proof.beforeChanged[i].bytes)).toEqual([76, -228, 4408, 0]);
      for (const [i, row] of proof.afterChanged.entries()) expect(row.sha256).not.toBe(proof.beforeChanged[i].sha256);
    }
    expect(world.current.instances - world.before.instances).toBe(56);
    expect(world.current.bufferBytes - world.before.bufferBytes).toBe(56 * 76);
    expect(world.current.renderables).toBe(world.before.renderables);
    expect(core.current.bytes - core.before.bytes).toBe(56 * 76);
    expect(core.current.bufferRecords).toBe(core.before.bufferRecords);
  }
});

for (const profile of ["full", "mobile"] as const) {
  test(`${profile}: interruptible construction exactly matches the current synchronous full world`, () => {
    const script = fileURLToPath(
      new URL("../scripts/benchmark-minecraft-world.ts", import.meta.url),
    );
    const measure = (cooperative: boolean) => {
      // Independent serial processes each load the complete real ground,
      // source prisms and tunnel. The first world's buffers are gone before
      // the second starts; no synthetic core fixture stands in for this world.
      const run = Bun.spawnSync([
        process.execPath, script,
        ...(cooperative ? ["--cooperative"] : []),
        ...(profile === "mobile" ? ["--mobile"] : []),
      ], { env: { ...process.env, MINECRAFT_REFERENCE_MODULE: "" } });
      expect(run.exitCode, run.stderr.toString()).toBe(0);
      return JSON.parse(run.stdout.toString());
    };
    const synchronous = measure(false);
    const result = measure(true);
    // The immutable v219 fixture and every v200–v219 historical/version audit
    // above remain unchanged. Later exact payload and authored-model retention
    // is covered by minecraft-voxel-world, static-native-model-preservation and
    // core-material-v211. This test compares the two current construction paths
    // with the original complete-world byte hash and buffer/count contract.
    const appearance = (value: typeof synchronous) => ({
      detailProfile: value.detailProfile, instances: value.instances,
      renderables: value.renderables, bufferBytes: value.bufferBytes, sha256: value.sha256,
      sourceTrees: value.sourceTrees, visibleTrees: value.visibleTrees, signatureTrees: value.signatureTrees,
    });
    expect(synchronous.detailProfile).toBe(profile);
    expect(synchronous.cooperative).toBeFalse();
    expect(synchronous.taskCount).toBe(0);
    expect(result.cooperative).toBeTrue();
    expect(appearance(result)).toEqual(appearance(synchronous));
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

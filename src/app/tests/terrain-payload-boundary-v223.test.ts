import { expect, test } from "bun:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import * as terrain from "../src/terrainPayload";
import * as legacy from "../src/MinecraftVoxelWorld";
import receipt from "./fixtures/terrain-payload-v223-source.json";

// The v223 extraction receipt remains intact. These five declarations have since
// acquired surveyed tree retention (v376) and the bit-identical ground writer
// (v383). Canopy tests and terrain-writer-v383 exercise their changed behavior.
const subsequentSource: Readonly<Record<string,string>> = {
  VoxelPayload: "5aeca89a29f4e71b510675284c2d0f045e17a6156e5dbde861ce2886aa6d3b60",
  minecraftVoxelTreeRetained: "6b84a8cc1109274adac416b0b6b296639ec6f3ee3dae276ec64b7cf64663d83a",
  shadeFor: "c77beca2fbcb88a5edf2f54278d04e4a24cb72eaa84e56070c3a1047ceeed6b8",
  instancedBoxes: "24f2ac851a0c710ba87c818f770e88b71563c1e43ba35e7fb6ca767effdceb9c",
  createGroundSlabsSteps: "6fdbea881da1183441d0e26a1cafcc0568255676ea90f9d8b544d79bc25aecc0",
};

test("all 32 shared terrain declarations match their separately recorded source", async () => {
  const source = await Bun.file(new URL("../src/terrainPayload.ts", import.meta.url)).text();
  const tree = ts.createSourceFile("terrainPayload.ts", source, ts.ScriptTarget.Latest, true);
  const declarations = new Map(tree.statements.flatMap(node => {
    const name = ts.isVariableStatement(node) ? node.declarationList.declarations[0].name.getText(tree)
      : "name" in node && node.name ? node.name.getText(tree) : "";
    return name ? [[name, node.getText(tree)]] : [];
  }));
  expect(receipt.records).toHaveLength(32);
  for (const record of receipt.records) {
    expect(declarations.has(record.name)).toBe(true);
    expect(new Bun.CryptoHasher("sha256").update(declarations.get(record.name)!).digest("hex")).toBe(subsequentSource[record.name] ?? record.sha256);
  }
});

test("the old shared public API aliases the same functions and constants", () => {
  for (const name of ["forEachVoxelTreeBlock", "MINECRAFT_TREE_RETENTION", "minecraftVoxelTreeRetained",
    "VOXEL_WORLD_FILE", "GROUND_CONTEXT_FILE", "WATER_TOP_Y", "groundTopSampler", "smoothGroundTopSampler",
    "worldGroundSampler", "createGroundSlabs", "cutGrosserSternGatehouseGroundSurface", "restoreGrosserSternGatehouseGroundOwnership"] as const)
    expect(legacy[name]).toBe(terrain[name]);
});

test("runtime terrain consumers cannot eagerly import the native city constructor", async () => {
  const root = new URL("../src/", import.meta.url);
  for (const relative of new Bun.Glob("**/*.{ts,tsx}").scanSync(fileURLToPath(root))) {
    const source = await Bun.file(new URL(relative, root)).text();
    if (!source.includes("MinecraftVoxelWorld")) continue;
    const tree = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
    for (const node of tree.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)
        || !node.moduleSpecifier.text.endsWith("/MinecraftVoxelWorld") || node.importClause?.isTypeOnly) continue;
      const bindings = node.importClause?.namedBindings;
      expect(bindings && ts.isNamedImports(bindings) && bindings.elements.every(binding => binding.isTypeOnly), relative).toBe(true);
    }
  }
});

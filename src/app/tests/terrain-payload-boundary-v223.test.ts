import { expect, test } from "bun:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import * as terrain from "../src/terrainPayload";
import * as legacy from "../src/MinecraftVoxelWorld";
import receipt from "./fixtures/terrain-payload-v223-source.json";

test("all 32 shared terrain declarations retain their exact released source", async () => {
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
    expect(new Bun.CryptoHasher("sha256").update(declarations.get(record.name)!).digest("hex")).toBe(record.sha256);
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

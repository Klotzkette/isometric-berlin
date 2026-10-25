import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { LOSSLESS_EAGER_FIELDS_V270 } from "../losslessEagerFieldsV270";
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS, transformLosslessJsonData } from "../losslessJsonData";

const name = "coreHouseColoursV273.json";
const original = readFileSync(new URL(`../src/data/${name}`, import.meta.url), "utf8");
type Source = { schemaVersion: number; owners: Record<string, unknown> };

async function compileFixture(packed: boolean, schemaOnly = false) {
  const dir = await mkdtemp(join(tmpdir(), "isometric-core-storage-v273-"));
  try {
    const folder = join(dir, "src/app/src/data");
    await mkdir(folder, { recursive: true });
    const path = join(folder, name), entry = join(dir, "entry.js");
    await writeFile(path, original);
    await writeFile(entry, schemaOnly
      ? `import { schemaVersion } from ${JSON.stringify(path)};window.schema=schemaVersion;`
      : `import data, { owners } from ${JSON.stringify(path)};window.fixture=data;window.named=owners;`);
    const result = await build({ configFile: false, root: dir, publicDir: false, logLevel: "silent",
      plugins: packed ? [losslessJsonData()] : [],
      build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw Error("Expected fixture output");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw Error("Missing fixture entry");
    return chunk.code;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function evaluate(code: string) {
  const window: { fixture?: Source; named?: Source["owners"]; schema?: number } = {};
  let parses = 0;
  new Function("window", "JSON", "WeakRef", code)(window, {
    parse(value: string) { parses++; return JSON.parse(value); },
  }, class ForbiddenWeakRef {
    constructor() { throw Error("Hot core paint lookup must remain strongly owned"); }
  });
  return { window, parses: () => parses };
}

test("production core colour source is smaller with exact eager values, ordinary descriptors and strong aliases", async () => {
  expect(LOSSLESS_EAGER_FIELDS_V270[`data/${name}`]).toEqual(["owners"]);
  expect(READONLY_CONSTRUCTION_JSON_FIELDS[name]).toBeUndefined();
  const baseline = await compileFixture(false), packed = await compileFixture(true);
  const expected = JSON.parse(original), before = evaluate(baseline), after = evaluate(packed);
  // Vite's default large-JSON transform already parses this object eagerly.
  expect(before.parses()).toBe(1);
  expect(after.parses()).toBe(1);
  expect(after.window.fixture).toEqual(expected);
  expect(after.window.fixture).toEqual(before.window.fixture);
  expect(JSON.stringify(after.window.fixture)).toBe(JSON.stringify(expected));
  const source = after.window.fixture!, held = source.owners;
  expect(after.window.named).toBe(held);
  expect(Object.getOwnPropertyDescriptors(source)).toEqual(Object.getOwnPropertyDescriptors(before.window.fixture!));
  expect(Object.getOwnPropertyDescriptor(source, "owners")).toEqual({
    value: held, writable: true, enumerable: true, configurable: true,
  });
  for (const key of Object.keys(held)) expect(source.owners[key]).toBe(held[key]);
  held.retainedProbe = { exact: true };
  expect(source.owners.retainedProbe).toBe(held.retainedProbe);
  expect(after.window.named!.retainedProbe).toBe(held.retainedProbe);
  source.owners = { replacement: true };
  expect(after.window.named).toBe(held);
  expect(source.owners).toEqual({ replacement: true });
  expect(after.parses()).toBe(1);
  const transform = transformLosslessJsonData(original, `/project/src/app/src/data/${name}`)!;
  expect(transform.code).not.toContain("WeakRef");
  expect(transform.code).not.toContain("get [");
  const baselineBytes = Buffer.byteLength(baseline), packedBytes = Buffer.byteLength(packed);
  expect(baselineBytes - packedBytes).toBeGreaterThan(200_000);
  console.info(JSON.stringify({ coreColourStorageV273: {
    sourceBytes: Buffer.byteLength(original), transformedBytes: Buffer.byteLength(transform.code),
    baselineProductionBytes: baselineBytes, packedProductionBytes: packedBytes,
    productionBytesSaved: baselineBytes - packedBytes,
  } }));
});

test("production schema-only import omits the eager core owner payload and decoder", async () => {
  const code = await compileFixture(true, true), result = evaluate(code);
  expect(result.window.schema).toBe(JSON.parse(original).schemaVersion);
  expect(result.parses()).toBe(0);
  expect(Buffer.byteLength(code)).toBeLessThan(1_000);
});

import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { build } from "vite";
import { losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";
import type { LegacyHouseMaterialsSourceV273 } from "../src/legacyHouseMaterialsV273";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

class CollectableReference {
  static entries: CollectableReference[] = [];
  private value: object | undefined;
  constructor(value: object) { this.value = value; CollectableReference.entries.push(this); }
  deref(): object | undefined { return this.value; }
  static collect(): void {
    for (const entry of this.entries) entry.value = undefined;
    this.entries.length = 0;
  }
}

type Writer = (tile: string, native: boolean, part: SurroundingPackedMesh, mesh: number,
  values: Uint16Array, offset: number, count: number) => Generator<void, number>;

function packet(key: string): SurroundingCityChunk {
  const [mode, tile] = key.split(":");
  if (tile.startsWith("alt-mitte-v169-")) {
    const catalogue = JSON.parse(readFileSync(new URL(`../src/data/altMitte${mode === "drawn" ? "Drawn" : "Native"}V169Source.json`, import.meta.url), "utf8"));
    const file = catalogue.chunkFiles.find((row: { id: string }) => `alt-mitte-v169-${row.id}` === tile).file;
    return JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8"));
  }
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`, import.meta.url))).toString());
}

test("production legacy/Alt-Mitte receipts are weak, eager indices stay small, and active writers survive collection", async () => {
  const directory = await mkdtemp(join(tmpdir(), "berlin-legacy-colours-v273-"));
  const names = ["legacyHouseMaterialsV273", "remainingAltMitteColoursV273"];
  const functions = ["applyLegacyHouseMaterialsV273", "applyRemainingAltMitteColoursV273"];
  const fixture: { sources?: LegacyHouseMaterialsSourceV273[]; writers?: Writer[] } = {};
  try {
    const imports = names.map((name, i) => {
      const source = fileURLToPath(new URL(`../src/data/${name}.json`, import.meta.url));
      const index = fileURLToPath(new URL(`../src/data/${name}Index.json`, import.meta.url));
      expect(transformLosslessJsonData(readFileSync(index, "utf8"), index)).toBeUndefined();
      const writer = fileURLToPath(new URL(`../src/${name}.ts`, import.meta.url));
      return `import s${i} from ${JSON.stringify(source)}; import { ${functions[i]} as w${i} } from ${JSON.stringify(writer)};`;
    }).join("\n");
    const entry = join(directory, "entry.js");
    await writeFile(entry, `${imports}\nwindow.sources = [s0, s1]; window.writers = [w0, w1];`);
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()], build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture chunk");
    let parses = 0;
    // The reused v213 writer retains its existing eager palette array. Count
    // packet-map decodes separately so that baseline contract remains intact.
    const json = { parse(text: string) {
      const value = JSON.parse(text);
      if (!Array.isArray(value)) parses++;
      return value;
    } };
    new Function("window", "JSON", "WeakRef", chunk.code)(fixture, json, CollectableReference);
    expect(parses).toBe(0);
    for (const [i, name] of names.entries()) {
      const source = fixture.sources![i], writer = fixture.writers![i];
      const expected = JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
      expect(Object.getOwnPropertyDescriptor(source, "palette")?.get).toBeUndefined();
      expect(Object.getOwnPropertyDescriptor(source, "packets")?.get).toBeFunction();
      const beforeRead = parses;
      let receiptMap = source.packets;
      expect(receiptMap).toEqual(expected.packets);
      expect(parses).toBe(beforeRead + 1);
      const key = Object.keys(receiptMap)[0], receipt = receiptMap[key][0];
      const part = packet(key).meshes[receipt.mesh], count = Buffer.from(part.positions, "base64").length / 6;
      const values = new Uint16Array(count * 6).fill(17);
      const [mode, tile] = key.split(":");
      CollectableReference.collect();
      const iterator = writer(tile, mode === "minecraft", part, receipt.mesh, values, 0, count);
      let step = iterator.next();
      expect(parses).toBe(beforeRead + 2);
      while (!step.done) { CollectableReference.collect(); step = iterator.next(); }
      const runs = new Uint32Array(Uint8Array.from(Buffer.from(receipt.runs, "base64")).buffer);
      let selected = 0;
      for (let row = 0; row < runs.length; row += 3) selected += runs[row + 1];
      expect(step.value).toBe(selected);
      expect(parses).toBe(beforeRead + 2);
      CollectableReference.collect();
      expect(source.packets).not.toBe(receiptMap);
      receiptMap = source.packets;
      expect(receiptMap).toEqual(expected.packets);
      expect(parses).toBe(beforeRead + 3);
    }
  } finally {
    CollectableReference.collect();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);

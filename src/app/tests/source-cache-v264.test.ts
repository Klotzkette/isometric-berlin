import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { build } from "vite";
import { losslessJsonData, LOSSLESS_JSON_FIELD_BYTES, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";
import { prepareAllotmentsV264, type AllotmentSourceV264 } from "../src/AllotmentsV264";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

// Deterministic collection exercises an absent weak value at the precise yield
// boundary without relying on host GC timing. Compiled production getters run.
class CollectableReference {
  static entries: CollectableReference[] = [];
  private value: object | undefined;
  constructor(value: object) { this.value = value; CollectableReference.entries.push(this); }
  deref() { return this.value; }
  static collect() { for (const ref of this.entries) ref.value = undefined; this.entries = []; }
}
function finish<T>(steps: Generator<void, T>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/** Fresh real JSON snapshots, production plugin/thresholds, one tiny fixture.
 * This build includes no app, city assets, workers or dependency installation. */
async function fixture(names: string[], allotmentRuntime = false) {
  const originals = await Promise.all(names.map(name => readFile(new URL(`../src/data/${name}`, import.meta.url), "utf8")));
  const expected = originals.map(text => JSON.parse(text));
  const dir = await mkdtemp(join(tmpdir(), "isometric-source-cache-v264-"));
  let code = "";
  try {
    const folder = join(dir, "src/app/src/data"); await mkdir(folder, { recursive: true });
    const imports: string[] = [];
    for (let i = 0; i < names.length; i++) {
      const path = join(folder, names[i]); await writeFile(path, originals[i]);
      imports.push(`import source${i} from ${JSON.stringify(path)};`);
    }
    if (allotmentRuntime) {
      const runtime = join(dir, "src/app/src/AllotmentsV264.ts");
      await writeFile(runtime, await readFile(new URL("../src/AllotmentsV264.ts", import.meta.url), "utf8"));
      imports.push(`import { prepareAllotmentsV264 } from ${JSON.stringify(runtime)};window.prepare=prepareAllotmentsV264;`);
    }
    const entry = join(dir, "entry.js");
    await writeFile(entry, imports.join("\n") + `\nwindow.sources=[${names.map((_, i) => `source${i}`).join(",")}];`);
    const result = await build({ configFile: false, root: dir, publicDir: false, logLevel: "silent", plugins: [losslessJsonData()],
      build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw Error("Expected one small source fixture");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw Error("Missing source fixture entry");
    code = chunk.code;
  } finally { await rm(dir, { recursive: true, force: true }); }
  return { code, expected, originals };
}
function evaluate(code: string, weak: unknown = CollectableReference) {
  const window: { sources?: any[]; prepare?: typeof prepareAllotmentsV264 } = {};
  let parses = 0;
  new Function("window", "JSON", "WeakRef", code)(window, { parse(text: string) { parses++; return JSON.parse(text); } }, weak);
  return { window, parses: () => parses };
}

test("real v264 garden recipes stay lazy through early guards and byte-exact across yielded collection", async () => {
  CollectableReference.collect();
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["allotmentsV264.json"]).toEqual(["chunks"]);
  const { code, expected: [expected], originals } = await fixture(["allotmentsV264.json"], true);
  expect(code.length).toBeLessThan(originals[0].length / 2);
  const { window, parses } = evaluate(code);
  const source = window.sources![0] as AllotmentSourceV264, prepare = window.prepare!;
  expect(parses()).toBe(0);
  expect(source.keys).toEqual(expected.keys);
  const unrelated = { get nav() { throw Error("unknown garden navigation inspected"); }, get meshes() { throw Error("unknown garden mesh inspected"); } } as unknown as SurroundingCityChunk;
  expect(finish(prepare(unrelated, "outside-retained-city"))).toBe(unrelated);
  expect(parses()).toBe(0);
  const existing = { meshes: [{ kind: "allotments-v264" }] } as SurroundingCityChunk;
  expect(finish(prepare(existing, source.keys![0]))).toBe(existing);
  expect(parses()).toBe(0);

  const first = source.chunks;
  expect(first).toEqual(expected.chunks);
  expect(source.chunks).toBe(first);
  expect(parses()).toBe(1);
  const id = source.keys!.find(key => (first[key].drawn?.groups.length ?? 0) >= 4)!;
  const folder = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", folder), "utf8"));
  const desc = manifest.chunks.find((value: any) => value.id === id);
  const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(new URL(desc.drawn.url, folder))).toString());
  const baseline = finish(prepareAllotmentsV264(packet, id, false, expected));
  const steps = prepare(packet, id);
  expect(steps.next().done).toBe(false);
  CollectableReference.collect();
  const built = finish(steps);
  expect(built.meshes.at(-1)).toEqual(baseline.meshes.at(-1));
  expect(built.nav).toBe(packet.nav);
  expect(built.meshes.slice(0, -1)).toEqual(packet.meshes);
  expect(parses()).toBe(1);
  const second = source.chunks;
  expect(second).not.toBe(first);
  expect(second).toEqual(expected.chunks);
  expect(parses()).toBe(2);
  expect(JSON.stringify(source)).toBe(JSON.stringify(expected));
  const fallback = evaluate(code, null);
  const retained = fallback.window.sources![0].chunks;
  CollectableReference.collect();
  expect(fallback.window.sources![0].chunks).toBe(retained);
  expect(retained).toEqual(expected.chunks);
  expect(fallback.parses()).toBe(1);
});

test("current Prenzlberg drawn, envelope and native source snapshots preserve exact values and production cache admission", async () => {
  CollectableReference.collect();
  const names = ["prenzlbergV264.json", "prenzlbergV264Envelopes.json", "prenzlbergV264Native.json"];
  for (const name of names) expect(READONLY_CONSTRUCTION_JSON_FIELDS[name]).toEqual(["sites"]);
  const { code, expected, originals } = await fixture(names);
  expect(code.length).toBeLessThan(originals.reduce((sum, text) => sum + text.length, 0) / 2);
  const { window, parses } = evaluate(code);
  expect(parses()).toBe(0);
  let decoded = 0, weakFields = 0;
  for (let i = 0; i < names.length; i++) {
    const source = window.sources![i], want = expected[i];
    expect(Object.keys(source)).toEqual(Object.keys(want));
    expect(parses()).toBe(decoded);
    const first = source.sites;
    const packed = originals[i].length >= LOSSLESS_JSON_FIELD_BYTES && JSON.stringify(want.sites).length >= LOSSLESS_JSON_FIELD_BYTES;
    if (packed) { decoded++; weakFields++; }
    expect(first).toEqual(want.sites);
    expect(source.sites).toBe(first);
    expect(parses()).toBe(decoded);
    CollectableReference.collect();
    const second = source.sites;
    if (packed) { expect(second).not.toBe(first); decoded++; }
    else expect(second).toBe(first); // Small native inventories keep eager identity.
    expect(second).toEqual(want.sites);
    expect(parses()).toBe(decoded);
    expect(JSON.stringify(source)).toBe(JSON.stringify(want));
    const transferred = { explicit: "construction ownership" };
    source.sites = transferred;
    CollectableReference.collect();
    expect(source.sites).toBe(transferred);
    Object.freeze(source);
    expect(() => { source.sites = first; }).toThrow(TypeError);
  }
  expect(weakFields).toBeGreaterThanOrEqual(2);
  const fallback = evaluate(code, null);
  for (let i = 0; i < names.length; i++) {
    const source = fallback.window.sources![i], first = source.sites;
    CollectableReference.collect();
    expect(source.sites).toBe(first);
    expect(first).toEqual(expected[i].sites);
  }
  expect(fallback.parses()).toBe(weakFields);
});

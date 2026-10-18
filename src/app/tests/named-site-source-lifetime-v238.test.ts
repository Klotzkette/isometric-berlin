import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { build } from "vite";
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import type { NamedSiteSourceV238 } from "../src/namedSiteReplacementsV238";

const files = ["northElevatedV238Replacement.json", "southElevatedV238Replacement.json", "venuesV238Replacement.json"];
const dataDirectory = fileURLToPath(new URL("../src/data/", import.meta.url));
const runtime = fileURLToPath(new URL("../src/namedSiteReplacementsV238.ts", import.meta.url));

/** Deterministic cache eviction, without depending on browser/runner GC timing. */
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

async function bundle(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "named-site-lifetime-v238-"));
  const entry = join(directory, "entry.js");
  await writeFile(entry, files.map((file, i) => `import s${i} from ${JSON.stringify(join(dataDirectory, file))};`).join("\n") + `
    import { prepareNamedSiteV238 } from ${JSON.stringify(runtime)};
    window.sources = [s0,s1,s2];
    window.prepare = (chunk,id,native=false) => {
      const generator = prepareNamedSiteV238(chunk,id,native);
      let result = generator.next(); while (!result.done) result = generator.next();
      return result.value;
    };
  `);
  try {
    const result = await build({
      configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()],
      build: { write: false, minify: true, rolldownOptions: { input: entry } },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture chunk");
    return chunk.code;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("all named-site sources keep complete tiny eager keys and only audited payloads weak", () => {
  for (const file of files) {
    const source = JSON.parse(readFileSync(join(dataDirectory, file), "utf8")) as NamedSiteSourceV238;
    expect([...source.keys!].sort()).toEqual(Object.keys(source.packets).sort());
    expect(JSON.stringify(source.keys).length).toBeLessThan(200);
    expect(READONLY_CONSTRUCTION_JSON_FIELDS[file]).toContain("packets");
  }
  expect(READONLY_CONSTRUCTION_JSON_FIELDS[files[1]]).toContain("core");
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["elevatedCoreOwnersV238.json"]).toBeUndefined();
});

test("production imports hydrate nothing; selected packets and core rehydrate losslessly after collection", async () => {
  CollectableReference.collect();
  const code = await bundle();
  let parses = 0;
  const window = {} as {
    sources: (NamedSiteSourceV238 & { core?: unknown })[];
    prepare: (chunk: SurroundingCityChunk, id: string, native?: boolean) => SurroundingCityChunk;
  };
  const json = { parse(text: string) { parses++; return JSON.parse(text); } };
  new Function("window", "JSON", "WeakRef", code)(window, json, CollectableReference);
  expect(parses).toBe(0);
  const empty = { origin: [0, -10, 0], meshes: [], nav: { groundY: 3, ground: [], buildings: [], roads: [], water: [], bridges: [] } } as unknown as SurroundingCityChunk;
  expect(window.prepare(empty, "no-such-tile")).toBe(empty);
  expect(parses).toBe(0);
  const original = JSON.parse(gunzipSync(readFileSync(new URL(
    "../public/mesh/surrounding-berlin-v159/5_-5.drawn.json.gz", import.meta.url,
  ))).toString()) as SurroundingCityChunk;
  const prepared = window.prepare(original, "5_-5");
  expect(prepared.meshes.length).toBe(original.meshes.length + 1);
  expect(parses).toBe(1);
  const first = window.sources[0].packets;
  CollectableReference.collect();
  const replay = window.sources[0].packets;
  expect(replay).not.toBe(first);
  expect(replay).toEqual(first);
  expect(parses).toBe(2);
  expect(window.prepare(original, "5_-5").meshes.at(-1)).toEqual(prepared.meshes.at(-1));
  expect(parses).toBe(2);
  const core = window.sources[1].core;
  expect(parses).toBe(3);
  CollectableReference.collect();
  expect(window.sources[1].core).not.toBe(core);
  expect(window.sources[1].core).toEqual(core);
  expect(parses).toBe(4);
  const rawBytes = files.reduce((sum, file) => sum + readFileSync(join(dataDirectory, file)).length, 0);
  expect(code.length).toBeLessThan(rawBytes * .4);
  CollectableReference.collect();
});

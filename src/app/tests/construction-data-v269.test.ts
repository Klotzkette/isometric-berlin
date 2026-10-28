import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";

const sources = [
  ["koepenickerStreetsV268.json", "chunks"],
  ["koepenickerLandmarksV268.json", "packets"],
  ["kraftwerkBerlinV268.json", "packets"],
  ["moabitHousesV269.json", "chunks"],
  ["mierendorffV269.json", "packets"],
  ["moabitLandmarksV269.json", "sites"],
] as const;
const hash = (value: unknown) => new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex");

test("actual v268/v269 construction maps load lazily and reconstruct exactly after weak-cache expiry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "berlin-construction-v269-"));
  try {
    const paths = sources.map(([name]) => fileURLToPath(new URL(`../src/data/${name}`, import.meta.url)));
    const expected = await Promise.all(paths.map(async path => JSON.parse(await readFile(path, "utf8"))));
    let rawBytes = 0, encodedBytes = 0;
    for (let i = 0; i < paths.length; i++) {
      const raw = await readFile(paths[i], "utf8");
      const transformed = transformLosslessJsonData(raw, paths[i])!;
      expect(transformed.code).toContain(`get ["${sources[i][1]}"]`);
      expect(transformed.code).toContain("new WeakRef(value)");
      rawBytes += raw.length; encodedBytes += transformed.code.length;
    }
    expect(rawBytes - encodedBytes).toBeGreaterThan(1_000_000);
    const entry = join(directory, "entry.js");
    await writeFile(entry, paths.map((p, i) => `import data${i} from ${JSON.stringify(p)};`).join("\n") +
      `\nwindow.models = [${paths.map((_, i) => `data${i}`).join(",")}];`);
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()], build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Missing entry");
    let parses = 0;
    const parsedPayloads: string[] = [];
    const json = { parse(text: string) { parses++; parsedPayloads.push(text); return JSON.parse(text); } };
    // Deterministic expiry tests the real codec and production tree-shaking
    // without relying on nondeterministic host garbage collection.
    class ExpiredWeakRef { deref() { return undefined; } }
    const window: { models?: Record<string, unknown>[] } = {};
    new Function("window", "JSON", "WeakRef", chunk.code)(window, json, ExpiredWeakRef);
    // V270 compressed these two already-eager metadata profiles (1,593 and
    // 3,170 bytes). Construction maps must still remain unparsed at startup.
    expect(parsedPayloads.slice().sort()).toEqual([
      JSON.stringify(expected[2].profile), JSON.stringify(expected[4].profile),
    ].sort());
    expect(parsedPayloads.map(text => text.length).sort((a, b) => a - b)).toEqual([1593, 3170]);
    for (let i = 0; i < sources.length; i++) {
      const field = sources[i][1], model = window.models![i];
      expect(Object.keys(model)).toEqual(Object.keys(expected[i]));
      expect(model.keys).toEqual(expected[i].keys);
      const before = parses;
      const retained = model[field];
      expect(hash(retained)).toBe(hash(expected[i][field]));
      expect(parses).toBe(before + 1);
      const rebuilt = model[field];
      expect(rebuilt).not.toBe(retained);
      expect(hash(rebuilt)).toBe(hash(retained));
      expect(parses).toBe(before + 2);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 60000);

import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { losslessJsonData } from "../losslessJsonData";

const root = fileURLToPath(new URL("../", import.meta.url));
const data = fileURLToPath(new URL("../src/data/", import.meta.url));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const source = (name: string) => JSON.parse(readFileSync(`${data}${name}`, "utf8"));
const constructorOnly = new Set([
  "roofHouseV233.json", "houseCurbsV233.json", "houseDoorsV233.json",
  "citywestStreetsV235.json", "cityStreetsV249.json", "mainStreetEdgesV254.json",
  "westShopfrontsV254.json", "boulevardArchitectureV235.json", "tierparkV255.json",
]);

test("the actual progressive worker excludes unused packet constructors and complete Alt-Mitte families", async () => {
  const result = await build({
    configFile: false, root, publicDir: false, logLevel: "silent",
    plugins: [losslessJsonData()],
    build: { write: false, minify: true, rolldownOptions: { input: `${root}src/progressiveWorld.worker.ts` } },
  });
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one worker build");
  const chunks = result.output.filter(item => item.type === "chunk");
  expect(chunks.reduce((sum, chunk) => sum + chunk.code.length, 0)).toBeLessThan(16 * 1024 * 1024);
  const retained = chunks.flatMap(chunk => Object.entries(chunk.modules))
    .filter(([, module]) => module.renderedLength > 0).map(([id]) => id.replaceAll("\\", "/"));
  expect(retained.some(id => id.endsWith("/IsometricCityWorld.ts"))).toBe(true);
  expect(retained.some(id => id.endsWith("/data/drawnWaterBoundary.json"))).toBe(true);
  expect(retained.filter(id =>
    /\/data\/altMitteV169(?:Drawn|Native)\/packet-\d+\.json$/.test(id) ||
    constructorOnly.has(id.split("/").at(-1)!),
  )).toEqual([]);
}, 60_000);

test("used drawn and native wrappers preserve every original packet and metadata value", async () => {
  const entry = "virtual:alt-mitte-v255-source-equality";
  const result = await build({
    configFile: false, root, publicDir: false, logLevel: "silent",
    plugins: [losslessJsonData(), {
      name: "alt-mitte-v255-source-equality",
      resolveId(id) { if (id === entry) return entry; },
      load(id) {
        if (id === entry) return `
          import drawn from ${JSON.stringify(`${data}altMitteDrawnV169Data.ts`)};
          import native from ${JSON.stringify(`${data}altMitteNativeV169Data.ts`)};
          globalThis.sources = [drawn, native];
        `;
      },
    }],
    build: { write: false, minify: true, rolldownOptions: { input: entry } },
  });
  if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one source build");
  const chunks = result.output.filter(item => item.type === "chunk");
  expect(chunks).toHaveLength(1);
  const scope = { sources: [] as Record<string, unknown>[] };
  new Function("globalThis", chunks[0].code)(scope);
  for (const [index, [label, mode]] of [["Drawn", "drawn"], ["Native", "minecraft"]].entries()) {
    const manifest = source(`altMitte${label}V169Source.json`);
    const expected = {
      ...manifest,
      [`${mode}Chunks`]: manifest.chunkFiles.map((entry: { id: string; file: string }) =>
        ({ id: entry.id, packet: source(entry.file) })),
    };
    expect(digest(scope.sources[index])).toBe(digest(expected));
  }
}, 60_000);

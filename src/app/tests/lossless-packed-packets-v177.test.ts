import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";

function evaluate(code: string) {
  return new Function(code.replace(/export \{[^\n]*\};/, "").replace("export default", "return"))();
}

test("every real packed resident packet keeps all exact data without an extra parsed string copy", async () => {
  const root = fileURLToPath(new URL("../src/data/", import.meta.url));
  let packets = 0, directBytes = 0;
  for (const family of ["Drawn", "Native"]) {
    for await (const file of new Bun.Glob(`altMitteV169${family}/packet-*.json`).scan(root)) {
      const path = join(root, file), source = await readFile(path, "utf8");
      const transformed = transformLosslessJsonData(source, path);
      if (!transformed) continue; // Small packets were direct literals already.
      expect(transformed.code).not.toContain("JSON.parse");
      const actual = evaluate(transformed.code);
      expect(new Bun.CryptoHasher("sha256").update(JSON.stringify(actual)).digest("hex"), file)
        .toBe(new Bun.CryptoHasher("sha256").update(JSON.stringify(JSON.parse(source))).digest("hex"));
      directBytes += JSON.stringify(actual.meshes).length;
      packets++;
    }
  }
  expect(packets).toBeGreaterThan(140);
  expect(directBytes).toBeGreaterThan(65 * 1024 * 1024);
});

test("the production bundler leaves base64 strings direct while retaining shared export identities", async () => {
  const directory = await mkdtemp(join(tmpdir(), "isometric-packed-json-"));
  const dataDir = join(directory, "src/app/src/data/altMitteV169Native");
  await mkdir(dataDir, { recursive: true });
  const source = { schemaVersion: 1, origin: [-0, -10, 0], meshes: [
    { kind: "building", positionType: "u16cm", positions: "ABCD".repeat(24_000), colors: "////".repeat(8_000), indices: "AA==" },
  ], nav: { groundY: 3, ground: [], buildings: [], water: [] } };
  const path = join(dataDir, "packet-000.json"), entry = join(directory, "entry.js");
  await writeFile(path, JSON.stringify(source).replace('"origin":[0', '"origin":[-0'));
  await writeFile(entry, `import source,{meshes} from ${JSON.stringify(path)};window.fixture=[source,meshes];`);
  try {
    const result = await build({ configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()], build: { write: false, minify: true, rolldownOptions: { input: entry } } });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected a bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Expected an entry");
    expect(chunk.code).not.toContain("JSON.parse");
    const window: { fixture?: [typeof source, typeof source.meshes] } = {};
    new Function("window", "JSON", chunk.code)(window, { parse() { throw new Error("Unexpected extra packet parse"); } });
    expect(window.fixture![0]).toEqual(source);
    expect(window.fixture![1]).toBe(window.fixture![0].meshes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

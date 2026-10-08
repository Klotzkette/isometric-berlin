import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipJson";

const ID = "/project/src/app/src/data/example.json";

function evaluateModule(source: string, threshold = 64 * 1024, id = ID) {
  const result = transformLosslessJsonData(source, id, threshold);
  if (!result) throw new Error("Expected transformed source");
  const script = result.code.replace(/^import \{ decodeLosslessGzipJson as __decodeLosslessGzip \} from [^\n]+;\n/, "").replace(/export \{ ([^\n]*) \};/, (_match, aliases: string) => {
    const properties = aliases.split(", ").filter(Boolean).map((alias) => {
      const [variable, name] = alias.split(" as ");
      return `[${JSON.stringify(name)}]: ${variable}`;
    });
    return `const named = {${properties.join(",")}};`;
  }).replace("export default", "const data =");
  return new Function("__decodeLosslessGzip", `${result.code.includes("export {") ? "" : "const named = {};"}${script}\nreturn { data, named };`)(decodeLosslessGzipJson) as {
    data: Record<string, unknown>; named: Record<string, unknown>;
  };
}

describe("lossless lazy source JSON", () => {
  test("preserves numbers, Unicode, escaping, own __proto__ and export identity", () => {
    const input = '{"rows":[[-0,1e400,-1e400,1.7976931348623157e308,5e-324],"\\u0000isometric-json-number\\u00000","ä\\n\\\\\\\"  "],"nested":{"__proto__":{"safe":true}},"__proto__":[1,2,3],"class":[4,5,6],"with-hyphen":[7,8,9],"default":[10,11,12]}';
    const expected = JSON.parse(input);
    const { data, named } = evaluateModule(input, 4);
    expect(data).toEqual(expected);
    expect(Object.keys(data)).toEqual(Object.keys(expected));
    expect(Object.is((data.rows as unknown[][])[0][0], -0)).toBeTrue();
    expect(Object.hasOwn(data, "__proto__")).toBeTrue();
    expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
    expect(Object.hasOwn(data.nested, "__proto__")).toBeTrue();
    expect(named.rows).toBe(data.rows);
    expect(named.__proto__).toBe(data.__proto__);
    expect(named.class).toBe(data.class);
    expect(Object.hasOwn(named, "default")).toBeFalse();
    const original = named.rows;
    data.rows = ["replacement"];
    expect(data.rows).toEqual(["replacement"]);
    expect(named.rows).toBe(original);
    Object.seal(data);
    data.rows = ["sealed assignment"];
    expect(data.rows).toEqual(["sealed assignment"]);
    Object.freeze(data);
    expect(() => { data.rows = []; }).toThrow(TypeError);
    expect(data.rows).toEqual(["sealed assignment"]);
  });

  test("leaves small, raw/url and external JSON untouched and keeps root arrays exact", () => {
    const large = JSON.stringify({ rows: Array.from({ length: 20000 }, (_, i) => [i, i / 9]) });
    for (const id of [ID + "?raw", ID + "?url", "/node_modules/library/data/source.json", "/project/src/app/public/source.json"]) {
      expect(transformLosslessJsonData(large, id)).toBeUndefined();
    }
    expect(transformLosslessJsonData('{"rows":[1,2]}', ID)).toBeUndefined();
    const array = Array(20000).fill([1, 2, 3]);
    expect(evaluateModule(JSON.stringify(array)).data).toEqual(array);
    expect(transformLosslessJsonData(large, ID.replaceAll("/", "\\"))).toBeDefined();
  });

  test("gzip retains exact JSON semantics without changing field ownership", () => {
    const rows = '[-0,1e400,-1e400,"Drachen ä 🪁",{"__proto__":42}]';
    const input = `{"profiles":[${Array(2000).fill(rows).join(",")}],"other":[${Array(2000).fill(rows).join(",")}]}`;
    const id = ID.replace("example.json", "teufelsbergTerrainV195.json");
    const result = transformLosslessJsonData(input, id)!;
    expect(result.code).toContain("__decodeLosslessGzip(");
    const { data, named } = evaluateModule(input, 64 * 1024, id);
    expect(data).toEqual(JSON.parse(input));
    expect(named.profiles).toBe(data.profiles);
    expect(Object.is((data.profiles as number[][])[0][0], -0)).toBeTrue();
    const ordinary = evaluateModule(input, 64 * 1024, ID);
    expect(ordinary.data).toEqual(JSON.parse(input));
    const mutable = ordinary.data.other as number[][];
    mutable[0][0] = 196;
    expect((ordinary.data.other as number[][])[0][0]).toBe(196);
    expect(ordinary.data.other).toBe(mutable);
  });

  test("round-trips every transformed committed source payload without a changed value", async () => {
    const root = fileURLToPath(new URL("../src/data/", import.meta.url));
    let transformed = 0;
    for await (const relative of new Bun.Glob("**/*.json").scan(root)) {
      const path = join(root, relative);
      const source = await readFile(path, "utf8");
      if (!transformLosslessJsonData(source, path)) continue;
      const { data } = evaluateModule(source, 64 * 1024, path);
      const actual = new Bun.CryptoHasher("sha256").update(JSON.stringify(data)).digest("hex");
      const expected = new Bun.CryptoHasher("sha256").update(JSON.stringify(JSON.parse(source))).digest("hex");
      expect(actual, relative).toBe(expected);
      transformed += 1;
    }
    expect(transformed).toBeGreaterThan(20);
  }, 60000);

  test("the installed production bundler keeps default arrays lazy and shakes unused named exports", async () => {
    const directory = await mkdtemp(join(tmpdir(), "isometric-lazy-json-"));
    const dataDir = join(directory, "src/app/src/data");
    await mkdir(dataDir, { recursive: true });
    // Exercise the real browser codec, production tree shaking and strong cache.
    const source = { version: 7, profiles: Array.from({ length: 24000 }, (_, i) => [i, i / 11]) };
    const dataPath = join(dataDir, "teufelsbergTerrainV195.json");
    await writeFile(dataPath, JSON.stringify(source));
    const compile = async (entry: string) => {
      const entryPath = join(directory, "entry.js");
      await writeFile(entryPath, entry);
      const result = await build({
        configFile: false, root: directory, publicDir: false, logLevel: "silent",
        plugins: [losslessJsonData()],
        build: { write: false, minify: true, rolldownOptions: { input: entryPath } },
      });
      if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
      const chunk = result.output.find((item) => item.type === "chunk" && item.isEntry);
      if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture chunk");
      return chunk.code;
    };
    try {
      const code = await compile(`import data from ${JSON.stringify(dataPath)}; window.fixture = data;`);
      let parses = 0;
      const json = { parse(text: string) { parses += 1; return JSON.parse(text); } };
      const window: { fixture?: typeof source } = {};
      new Function("window", "JSON", code)(window, json);
      expect(parses).toBe(0);
      expect(Object.keys(window.fixture!)).toEqual(["version", "profiles"]);
      expect(parses).toBe(0);
      Object.freeze(window.fixture!);
      const rows = window.fixture!.profiles;
      expect(rows).toEqual(source.profiles);
      rows[0][0] = 734;
      expect(window.fixture!.profiles).toBe(rows);
      expect(window.fixture!.profiles[0][0]).toBe(734);
      expect(parses).toBe(1);

      const named = await compile(`import data, { profiles } from ${JSON.stringify(dataPath)}; window.fixture = [data, profiles];`);
      const shared: { fixture?: [typeof source, number[][]] } = {};
      parses = 0;
      new Function("window", "JSON", named)(shared, json);
      expect(parses).toBe(1);
      expect(shared.fixture![0].profiles).toBe(shared.fixture![1]);

      const metadata = await compile(`import { version } from ${JSON.stringify(dataPath)}; window.fixture = version;`);
      expect(metadata.length).toBeLessThan(100);
      expect(metadata).not.toContain("JSON.parse");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 60000);
});

import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { losslessJsonData } from "../losslessJsonData";

type Payload = { boxes: number[][]; mutable: number[][]; surfaces?: unknown[] };

/** A deterministic stand-in tests the cache-miss path without depending on GC.
 * Actual browser reclamation is measured separately by the startup probe. */
class CollectableReference {
  static entries: CollectableReference[] = [];
  private value: object | undefined;
  constructor(value: object) {
    this.value = value;
    CollectableReference.entries.push(this);
  }
  deref(): object | undefined { return this.value; }
  static collect(): void {
    for (const entry of this.entries) entry.value = undefined;
    this.entries.length = 0;
  }
}

async function compilePayload(name: string, payload: unknown, named = false): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "isometric-source-cache-"));
  const dataDirectory = join(directory, "src/app/src/data");
  await mkdir(dataDirectory, { recursive: true });
  const dataPath = join(dataDirectory, name);
  const entryPath = join(directory, "entry.js");
  await writeFile(dataPath, JSON.stringify(payload));
  await writeFile(entryPath, `import data${named ? ", { boxes }" : ""} from ${JSON.stringify(dataPath)}; window.fixture = data;${named ? " window.named = boxes;" : ""}`);
  try {
    const result = await build({
      configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()],
      build: { write: false, minify: true, rolldownOptions: { input: entryPath } },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture chunk");
    return chunk.code;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function execute(code: string, weakReference: typeof CollectableReference | null = CollectableReference) {
  let parses = 0;
  const window: { fixture?: Payload; named?: number[][] } = {};
  const json = { parse(text: string) { parses++; return JSON.parse(text); } };
  new Function("window", "JSON", "WeakRef", code)(window, json, weakReference ?? undefined);
  return { window, get parses() { return parses; } };
}

const payload: Payload = {
  boxes: Array.from({ length: 12000 }, (_, i) => [i, i / 11, (i + 1) * -.25]),
  mutable: Array.from({ length: 12000 }, (_, i) => [i, i / 13]),
};

describe("audited constructor source cache ownership", () => {
  test("production default import stays lazy and collected constructor fields reparse exactly", async () => {
    const code = await compilePayload("bndHeadquartersV174Source.json", payload);
    const result = execute(code);
    expect(result.parses).toBe(0);
    const source = result.window.fixture!;
    const original = source.boxes;
    expect(source.boxes).toBe(original);
    expect(original).toEqual(payload.boxes);
    const mutable = source.mutable;
    mutable[0][0] = 734;
    CollectableReference.collect();
    expect(source.boxes).toEqual(payload.boxes);
    expect(source.boxes).not.toBe(original);
    expect(source.mutable).toBe(mutable);
    expect(source.mutable[0][0]).toBe(734);
    expect(result.parses).toBe(3);
    source.boxes = [[-1, 2, 3]];
    CollectableReference.collect();
    expect(source.boxes).toEqual([[-1, 2, 3]]);
    expect(result.parses).toBe(3);
    Object.freeze(source);
    expect(() => { source.boxes = []; }).toThrow(TypeError);
  });

  test("named exports retain identity and unsupported WeakRef retains the original strong semantics", async () => {
    const namedCode = await compilePayload("bndHeadquartersV174Source.json", payload, true);
    const named = execute(namedCode);
    expect(named.parses).toBe(1);
    expect(named.window.fixture!.boxes).toBe(named.window.named!);
    named.window.named![0][0] = 198;
    expect(named.window.fixture!.boxes[0][0]).toBe(198);

    const fallback = execute(namedCode, null);
    const rows = fallback.window.fixture!.boxes;
    rows[0][0] = 351;
    expect(fallback.window.fixture!.boxes).toBe(rows);
    expect(fallback.window.fixture!.boxes[0][0]).toBe(351);
    expect(fallback.parses).toBe(1);
  });

  test("an unaudited filename keeps even similarly named fields strongly cached", async () => {
    const code = await compilePayload("otherSource.json", payload);
    const result = execute(code);
    const rows = result.window.fixture!.boxes;
    rows[0][0] = 905;
    CollectableReference.collect();
    expect(result.window.fixture!.boxes).toBe(rows);
    expect(result.window.fixture!.boxes[0][0]).toBe(905);
    expect(result.parses).toBe(1);
  });

  test("packed street surface strings use direct literals without parsing or changing their bytes", async () => {
    const source = { surfaces: [{ positions_cm_b64: "AAAb".repeat(20000), indices_b64: "CAAD".repeat(20000) }] };
    for (const name of ["districtStreets.json", "schlossEastStreets.json"]) {
      const code = await compilePayload(name, source);
      const result = execute(code);
      expect(result.window.fixture!.surfaces).toEqual(source.surfaces);
      expect(result.parses).toBe(0);
      expect(code).not.toContain("JSON.parse");
    }
  });

  test("packed Alt-Mitte complements retain one literal per field without a second JSON copy", async () => {
    const source = { cells_u32: "AbCD".repeat(20000), triangles_f32: "EfGH".repeat(20000) };
    const code = await compilePayload("altMitteGroundSeamsV206.json", source);
    const result = execute(code);
    expect(result.window.fixture).toEqual(source);
    expect(result.parses).toBe(0);
    expect(code).not.toContain("JSON.parse");
    expect(code.split(source.cells_u32)).toHaveLength(2);
    expect(code.split(source.triangles_f32)).toHaveLength(2);
  });
});

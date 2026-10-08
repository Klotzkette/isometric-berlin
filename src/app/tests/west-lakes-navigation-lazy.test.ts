import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { losslessJsonData } from "../losslessJsonData";
import source from "../src/data/westLakesV194Native.json";
import navigation from "../src/data/westLakesV194Navigation.json";

type Fixture = {
  solid: (x: number, y: number, z: number, radius?: number, native?: boolean) => boolean;
  water: (x: number, z: number, native?: boolean) => number | null;
  nativeSource: typeof source;
};

async function productionFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "west-lakes-navigation-lazy-"));
  const entry = join(directory, "entry.js");
  const module = fileURLToPath(new URL("../src/westLakesV194Navigation.ts", import.meta.url));
  const payload = fileURLToPath(new URL("../src/data/westLakesV194Native.json", import.meta.url));
  await writeFile(entry, `import {westLakesV194SolidAt as solid,westLakesV194WaterAt as water} from ${JSON.stringify(module)};
import nativeSource from ${JSON.stringify(payload)};
window.fixture={solid,water,nativeSource};`);
  try {
    const result = await build({
      configFile: false, root: directory, publicDir: false, logLevel: "silent",
      plugins: [losslessJsonData()],
      build: { write: false, minify: true, rolldownOptions: { input: entry } },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one bundle");
    const chunk = result.output.find(item => item.type === "chunk" && item.isEntry);
    if (!chunk || chunk.type !== "chunk") throw new Error("Missing fixture entry");
    return chunk.code;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("production Day/navigation reads never materialize native sites; native collision retains all exact boxes", async () => {
  const code = await productionFixture();
  const window: { fixture?: Fixture } = {};
  let nativeParses = 0;
  const json = {
    parse(text: string) {
      const value = JSON.parse(text);
      if (Array.isArray(value) && value.some(site => site?.key && Array.isArray(site.positions) && Array.isArray(site.boxes))) nativeParses++;
      return value;
    },
  };
  new Function("window", "JSON", code)(window, json);
  const { solid, water, nativeSource } = window.fixture!;
  expect(nativeParses).toBe(0);
  const descriptor = Object.getOwnPropertyDescriptor(nativeSource, "sites")!;
  expect(typeof descriptor.get).toBe("function");
  let reads = 0;
  Object.defineProperty(nativeSource, "sites", {
    ...descriptor,
    get() { reads++; return descriptor.get!.call(nativeSource); },
  });

  for (const [x, z] of [[-6250.0496, -8624.3442], [-7371.9702, -7782.8816], [-17322.0812, 9370.2205]]) {
    expect(solid(x, 5, z, .25)).toBe(true);
    expect(solid(x, 1000, z, .25)).toBe(false);
  }
  expect(solid(-7366.9814, 5, -7794.2505, .20)).toBe(false);
  expect(water(-8000, -6500)).toBe(-1.15);
  expect(water(-6251, -8624)).toBeNull();
  expect(water(-8000, -6500, true)).toBe(-1.15);
  expect(solid(0, 5, 0, .20, true)).toBe(false);
  expect(reads).toBe(0);
  expect(nativeParses).toBe(0);

  // Every represented block centre was collidable before this lazy-cache change.
  // Source coordinates are independent of the transformed module under test.
  let checked = 0;
  for (const building of navigation.buildings) {
    const rows = source.sites.find(site => site.key === building.key)!.boxes;
    for (const row of rows) {
      expect(solid(row[0], row[1], row[2], 0, true)).toBe(true);
      checked++;
    }
  }
  expect(checked).toBe(1793);
  expect(reads).toBe(navigation.buildings.length);
  expect(nativeParses).toBe(1);
  for (const native of [false, true]) {
    expect(solid(-7366.9814, 5, -7794.2505, .20, native)).toBe(false);
    expect(solid(-6250, 30, -8624, .20, native)).toBe(false);
    expect(solid(0, 5, 0, .20, native)).toBe(false);
  }
  expect(reads).toBe(navigation.buildings.length);
  expect(nativeParses).toBe(1);
  expect(nativeSource.sites).toEqual(source.sites);
});

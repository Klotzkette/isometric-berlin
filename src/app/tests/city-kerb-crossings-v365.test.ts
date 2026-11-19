import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { synchronousPrimaryColourBankV362 } from "../src/primaryColoursV273";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { Mesh } from "three";
import { buildCityChunkWithPaletteV362 } from "../src/SurroundingCityGeometry";
import { crossingKerbPart } from "../src/cityKerbCrossingsV365";
import catalogue from "../src/cityKerbCrossingSourceV365";
import owners from "../src/data/cityKerbCrossingOwnersV365.json";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const root = join(import.meta.dir, "../../..");
const receipts = JSON.parse(gunzipSync(readFileSync(join(root, "geo_data/regierungsviertel/city-kerb-crossings-v365.json.gz"))).toString());
const folder = join(root, "src/app/public/mesh/surrounding-berlin-v159");

const manifest: {chunks: {id: string; drawn: {url: string}; minecraft: {url: string}}[]} =
  JSON.parse(readFileSync(join(folder, "manifest.json"), "utf8"));
const descriptors = new Map(manifest.chunks.map(entry => [entry.id, entry]));

function original(owner: string, mode: string): SurroundingCityChunk {
  const bytes = readFileSync(join(folder, descriptors.get(owner)![mode === "minecraft" ? "minecraft" : "drawn"].url));
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(receipts.owners[owner][mode]);
  return JSON.parse(gunzipSync(bytes).toString());
}

describe("Berlin mapped flush and lowered kerb courses", () => {
  test("the small streaming index and both ordinary render families match all admitted owners", () => {
    expect(owners).toEqual(Object.keys(receipts.owners).sort());
    expect(Object.keys(catalogue)).toHaveLength(owners.length * 2);
    for (const id of owners) {
      const drawn = catalogue[`drawn:${id}`], native = catalogue[`minecraft:${id}`];
      expect(drawn.mesh.positions).not.toBe(native.mesh.positions);
      for (const [family, plan] of [["drawn", drawn], ["minecraft", native]] as const) {
        const source = original(id, family);
        expect(crossingKerbPart(source, plan)).toBe(plan.mesh);
        expect(plan.mesh.kind).toBe("crossing-kerb-stones-v365");
        const positions = Buffer.from(plan.mesh.positions, "base64");
        const indices = Buffer.from(plan.mesh.indices, "base64");
        expect(indices.length % 12).toBe(0);
        expect(positions.length % 6).toBe(0);
        for (let i = 0; i < indices.length; i += 4) expect(indices.readUInt32LE(i)).toBeLessThan(positions.length / 6);
        for (let i = 0; i < positions.length; i += 6) {
          // Water, roofs and elevated roads never qualify. Geometry adds just
          // 1 cm of depth separation, even where the road changes base level.
          expect(positions.readUInt16LE(i + 2)).toBeGreaterThanOrEqual(1300);
          expect(positions.readUInt16LE(i + 2)).toBeLessThanOrEqual(1317);
          if (family === "minecraft") {
            expect(positions.readUInt16LE(i) % 25).toBe(0);
            expect(positions.readUInt16LE(i + 4) % 25).toBe(0);
          }
        }
      }
    }
  });

  test("unselected, shifted and changed street packets never acquire old stones", () => {
    const owner = owners[0], plan = catalogue[`drawn:${owner}`];
    const source = original(owner, "drawn");
    expect(crossingKerbPart(source, undefined)).toBeUndefined();
    expect(crossingKerbPart({...source, origin: [source.origin[0] + 1, -10, source.origin[2]]}, plan)).toBeUndefined();
    expect(crossingKerbPart({...source, nav: {...source.nav, roads: []}}, plan)).toBeUndefined();
  });
});

test("two actual mode-specific street batches append behind all old indices without an extra draw call", () => {
  const owner = "east200-20_19";
  for (const family of ["drawn", "minecraft"] as const) {
    const native = family === "minecraft", plan = catalogue[`${family}:${owner}`];
    const chunk = original(owner, family);
    const primaryColours = synchronousPrimaryColourBankV362(owner, native);
    function build(withKerb: boolean) {
      const it = buildCityChunkWithPaletteV362(chunk, owner, native, false, {}, { primaryColours, crossingKerbs: withKerb ? plan : undefined });
      let next = it.next();
      while (!next.done) next = it.next();
      return next.value;
    }
    const before = build(false), after = build(true);
    try {
      expect(after.root.userData.sourceKinds).toContain("crossing-kerb-stones-v365");
      expect(after.root.children.length).toBe(before.root.children.length);
      expect(after.bufferCount).toBe(before.bufferCount);
      expect(after.nav).toEqual(before.nav);
      const a = before.root.children.find(child => child instanceof Mesh) as Mesh;
      const b = after.root.children.find(child => child instanceof Mesh) as Mesh;
      const old = a.geometry.getIndex()!.array, next = b.geometry.getIndex()!.array;
      expect(next.length - old.length).toBe(Buffer.from(plan.mesh.indices, "base64").byteLength / 4);
      expect(next.subarray(0, old.length)).toEqual(old);
    } finally {
      disposeSurroundingCityRoot(before.root);
      disposeSurroundingCityRoot(after.root);
    }
  }
});

test("the full Kreuzberg packet keeps its sixteen older source parts and the authenticated kerb tail", async () => {
  const owner = "6_4";
  const recipes = await loadSourceQuarterRecipesV309(owner, false);
  const entry = await createStreamedSurroundingCityChunkV255(original(owner, "drawn"), owner, false,
    { budgetMs: 1000, yield: () => Promise.resolve() },
    { neighbourhoodV300: true, sourceQuartersV303: true, sourceQuarterSourcesV303: recipes,
      groundOverlaysV329: false, transportDetailsV334: true });
  try {
    const kinds = entry.root.userData.sourceKinds;
    expect(kinds).toContain("street-curves-v276");
    expect(kinds).toContain("ost-housing-v301");
    expect(kinds).toContain("venue-fronts-v357");
    expect(kinds).toContain("crossing-kerb-stones-v365");
    expect(kinds).toHaveLength(17);
  } finally {
    disposeSurroundingCityRoot(entry.root);
  }
});

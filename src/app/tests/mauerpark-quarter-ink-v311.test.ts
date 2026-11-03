import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { InterleavedBufferAttribute, LineSegments } from "three";
import sourceData from "../src/data/northernFidelityV309Packets.json";
import { createSurroundingCityChunk, type SurroundingCityChunk, type SurroundingOwnershipOptions } from "../src/SurroundingCityGeometry";
import { type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const id = "3_-6", source = sourceData as unknown as SourceQuarterSourceV303;
const ownership: SurroundingOwnershipOptions = {
  schlossplatzV239: true, staatsoperV240: true, architectureV241: true,
  mitteEnsembleV281: true, prenzlbergV264: true, chariteBridgesV265: true,
  operaTheatresV274: true, northernSitesV266: true, golgathaV270: true,
  tachelesFrontsV270: true, southFidelityV294: true, littenStadthausV297: true,
  wallGalleryV298: true, stralauSisyphosV299: true, neighbourhoodV300: true,
  westKiezV302: true, northFidelityV309: true,
};
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function raw(native = false): SurroundingCityChunk {
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${native ? "minecraft" : "drawn"}.json.gz`, import.meta.url))).toString());
}
const bytes = (words: Uint16Array) => Buffer.from(words.buffer, words.byteOffset, words.byteLength);
function lineWords(root: ReturnType<typeof createSurroundingCityChunk>["root"]): Uint16Array {
  const lines = root.children.filter(child => child instanceof LineSegments);
  expect(lines).toHaveLength(1);
  const position = (lines[0] as LineSegments).geometry.getAttribute("position");
  expect(position).toBeInstanceOf(InterleavedBufferAttribute);
  const attribute = position as InterleavedBufferAttribute;
  expect(attribute.data.stride).toBe(6); expect(attribute.offset).toBe(0);
  expect(attribute.data.array).toBeInstanceOf(Uint16Array);
  return new Uint16Array(attribute.data.array as Uint16Array);
}

// Complete real tile and lazy production catalogue, including the V303 suffix.
test("actual Mauerpark decoder preserves its full prefix and complete northern ink through native mode and reload", async () => {
  const drawn = raw(), native = raw(true), before = [sha(drawn), sha(native), sha(source)];
  const recipes = await loadSourceQuarterRecipesV309(id, false);
  expect(recipes.find(entry => entry.admission === "north-v309")?.source).toBe(sourceData);
  const plan = source.packets[`drawn:${id}`], append = plan.appendLines!;
  expect(append).toBeDefined(); expect(plan.retireLines.length).toBeGreaterThan(0);
  const closed = createSurroundingCityChunk(drawn, id, false, ownership);
  let old: Uint16Array;
  try {
    expect(closed.root.userData.mauerparkTerrainV298).toBe(true);
    expect(closed.root.userData.sourceQuarterOwnersV303).toEqual([]);
    old = lineWords(closed.root);
  } finally { disposeSurroundingCityRoot(closed.root); }
  expect(old!.length).toBe(69_228);
  const appendedPositions = Buffer.from(append.positions, "base64"), appendedColors = Buffer.from(append.colors!, "base64");
  const appendVertices = appendedPositions.byteLength / 6;
  expect(appendVertices).toBe(390); expect(appendedColors.byteLength).toBe(appendVertices * 3);
  const expectedPrefix = old!.slice();
  for (const segment of plan.retireLines) for (let axis = 0; axis < 3; axis++) expectedPrefix[segment * 12 + 6 + axis] = expectedPrefix[segment * 12 + axis];
  const expectedSuffix = new Uint16Array(appendVertices * 6);
  for (let vertex = 0; vertex < appendVertices; vertex++) for (let axis = 0; axis < 3; axis++) {
    expectedSuffix[vertex * 6 + axis] = appendedPositions.readUInt16LE(vertex * 6 + axis * 2);
    expectedSuffix[vertex * 6 + 3 + axis] = appendedColors[vertex * 3 + axis] * 257;
  }
  let first: Uint16Array | undefined;
  for (const mode of [false, true, false]) {
    const packet = mode ? native : drawn, loaded = await loadSourceQuarterRecipesV309(id, mode);
    const decoded = createSurroundingCityChunk(packet, id, mode, { ...ownership, sourceQuartersV303: true, sourceQuarterSourcesV303: loaded });
    try {
      expect(decoded.root.userData.mauerparkTerrainV298).toBe(true);
      expect(decoded.root.userData.sourceQuarterOwnersV303).toEqual(source.packets[`${mode ? "minecraft" : "drawn"}:${id}`].owners);
      if (mode) {
        expect(decoded.root.children.some(child => child instanceof LineSegments)).toBe(false);
      } else {
        const words = lineWords(decoded.root);
        expect(words.length).toBe(71_568);
        // Every old position/RGB word survives except the precise endpoints
        // retired by the complete northern plan; the suffix is word-exact.
        expect(bytes(words.subarray(0, old!.length)).equals(bytes(expectedPrefix))).toBe(true);
        expect(bytes(words.subarray(old!.length)).equals(bytes(expectedSuffix))).toBe(true);
        if (first) expect(bytes(words).equals(bytes(first))).toBe(true); else first = words;
      }
    } finally { disposeSurroundingCityRoot(decoded.root); }
    expect([sha(drawn), sha(native), sha(source)]).toEqual(before);
  }
});

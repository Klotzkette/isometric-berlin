import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { berlinSenateSourceV321, berlinSenatePacketCandidateV321,
  captureBerlinSenateV321, prepareBerlinSenateV321 } from "../src/BerlinSenateV321";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { neighbourhoodPacketAdmittedV300, captureNeighbourhoodPacketV300,
  prepareNeighbourhoodPacketV300 } from "../src/NeighbourhoodPacketV300";

const repo = path.resolve(import.meta.dir, "../../..");
const publicDir = path.join(repo, "src/app/public/mesh/surrounding-berlin-v159");
function drain<T>(steps: Generator<void, T>): T { for (;;) { const r = steps.next(); if (r.done) return r.value; } }
function packet(key: string): SurroundingCityChunk {
  const colon = key.indexOf(":"), mode = key.slice(0, colon), id = key.slice(colon + 1);
  return JSON.parse(gunzipSync(readFileSync(path.join(publicDir, `${id}.${mode}.json.gz`))).toString());
}
function prepared(raw: SurroundingCityChunk, id: string, native: boolean) {
  return drain(prepareSurroundingQuarterPredecessorV303(raw, id, native, {
    neighbourhoodV300: true, westKiezV302: true, stralauSisyphosV299: true,
    southFidelityV294: true, tachelesFrontsV270: true, littenStadthausV297: true,
    wallGalleryV298: true,
  }));
}

describe("three finite Berlin Senate public fronts", () => {
  test("actual drawn/native predecessors admit one append and preserve every older part, line and navigation", () => {
    for (const key of berlinSenateSourceV321.keys) {
      const colon = key.indexOf(":"), native = key.startsWith("minecraft:"), id = key.slice(colon + 1);
      const raw = packet(key), sourceBefore = JSON.stringify(raw);
      expect(berlinSenatePacketCandidateV321(id, native)).toBe(true);
      const ticket = drain(captureBerlinSenateV321(raw, id, native, true));
      expect(ticket).toBeDefined();
      const old = prepared(raw, id, native), before = JSON.stringify(old);
      const result = drain(prepareBerlinSenateV321(old, ticket));
      expect(neighbourhoodPacketAdmittedV300(result)).toBe(true);
      expect(result.meshes.length).toBe(old.meshes.length + 1);
      expect(result.meshes.slice(0, old.meshes.length)).toEqual(old.meshes);
      expect(result.nav).toBe(old.nav);
      expect(result.lines).toBe(old.lines);
      expect(JSON.stringify(raw)).toBe(sourceBefore);
      expect(JSON.stringify(old)).toBe(before);
      expect(berlinSenateSourceV321.packets[key].retire).toEqual([]);
    }
  }, 60000);

  test("closed default, wrong family, changed source and cancelled staging leave exact originals", () => {
    const key = "drawn:-4_7", id = "-4_7", raw = packet(key);
    const before = JSON.stringify(raw);
    expect(drain(captureBerlinSenateV321(raw, id))).toBeUndefined();
    expect(drain(captureBerlinSenateV321(raw, id, true, true))).toBeUndefined();
    expect(drain(captureBerlinSenateV321(raw, "0_0", false, true))).toBeUndefined();
    const changed = structuredClone(raw);
    changed.meshes[0].positions = (changed.meshes[0].positions[0] === "A" ? "B" : "A") + changed.meshes[0].positions.slice(1);
    expect(drain(captureBerlinSenateV321(changed, id, false, true))).toBeUndefined();
    const generator = captureBerlinSenateV321(raw, id, false, true);
    expect(generator.next().done).toBe(false);
    generator.return(undefined);
    expect(JSON.stringify(raw)).toBe(before);
    const ticket = drain(captureBerlinSenateV321(raw, id, false, true));
    const old = prepared(raw, id, false);
    old.origin = old.origin.slice();
    old.origin[0] += 1;
    expect(drain(prepareBerlinSenateV321(old, ticket))).toBe(old);
    expect(JSON.stringify(raw)).toBe(before);
  }, 60000);

  test("corrupt complete append is rejected and a copied public label grants no private admission", () => {
    const key = "drawn:-4_7", raw = packet(key);
    const broken = structuredClone(berlinSenateSourceV321);
    broken.packets[key].append.indices = "/////wAAAAABAAAA";
    expect(drain(captureNeighbourhoodPacketV300(raw, "-4_7", false, true, broken, "berlin-senate-v321"))).toBeUndefined();
    const forged = { ...raw, berlinSenateV321: true };
    expect(neighbourhoodPacketAdmittedV300(forged)).toBe(false);
    expect(drain(prepareNeighbourhoodPacketV300(forged))).toBe(forged);
    expect(berlinSenatePacketCandidateV321("unrelated")).toBe(false);
  }, 60000);
});

import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { prepareSurroundingQuarterPredecessorV303 as predecessor, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303, applySourceQuarterTrianglesV303, sourceQuarterNavigationV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { captureNeighbourhoodPacketV300 } from "../src/NeighbourhoodPacketV300";
import source from "../src/data/airfieldSurfacesV346.json";

const done = <T>(g: Generator<void, T>): T => { let value = g.next(); while (!value.done) value = g.next(); return value.value; };
const own = source as unknown as SourceQuarterSourceV303;
const flags = { schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true };
const omitted = new Set(["airfield-surfaces-v346", "public-green-v329", "park-paths-v329", "zebra-crossings-v329"]);

describe("v346 exact airport ground transactions", () => {
  for (const key of own.keys) test(key + " preserves every outside index and navigation", async () => {
    const [family, id] = key.split(":"), native = family === "minecraft";
    const bytes = await Bun.file(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${family}.json.gz`, import.meta.url)).bytes();
    const raw = JSON.parse(gunzipSync(bytes).toString()) as SurroundingCityChunk;
    const tickets = [];
    for (const e of await loadSourceQuarterRecipesV309(id, native)) {
      if (omitted.has(e.kind)) continue;
      const p = e.source.packets[key];
      const t = done(p.preparedRecords ? captureSourceQuarterPacketV303(raw, id, native, true, e.source, e.kind, e.requiredReplacement) : captureNeighbourhoodPacketV300(raw, id, native, true, e.source as never, e.kind));
      if (t) tickets.push(t);
    }
    let prior = done(predecessor(raw, id, native, flags));
    for (const ticket of tickets) prior = done(prepareSourceQuarterPacketV303(prior, ticket));
    const ticket = done(captureSourceQuarterPacketV303(raw, id, native, true, own, "airfield-surfaces-v346"));
    expect(ticket).toBeDefined();
    const changed = done(prepareSourceQuarterPacketV303(prior, ticket));
    expect(changed.meshes.length).toBe(prior.meshes.length + 1);
    expect(changed.meshes.at(-1)?.kind).toBe("airfield-surfaces-v346");
    expect(sourceQuarterNavigationV303(changed, changed.nav)).toEqual(sourceQuarterNavigationV303(prior, prior.nav));
    for (let i = 0; i < prior.meshes.length; i++) {
      const input = Buffer.from(prior.meshes[i].indices, "base64");
      const before = new Uint32Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength));
      const after = before.slice();
      done(applySourceQuarterTrianglesV303(prior, i, before, 0));
      done(applySourceQuarterTrianglesV303(changed, i, after, 0));
      const retired = new Set(own.packets[key].retire.find(r => r.mesh === i)?.triangles ?? []);
      for (let at = 0; at < after.length; at += 3) {
        if (retired.has(at / 3)) expect([after[at], after[at + 1], after[at + 2]]).toEqual([after[at], after[at], after[at]]);
        else expect([after[at], after[at + 1], after[at + 2]]).toEqual([before[at], before[at + 1], before[at + 2]]);
      }
    }
    const broken = {...raw, meshes: raw.meshes.map((m, i) => i ? m : {...m, kind:"different-owner"})};
    expect(done(captureSourceQuarterPacketV303(broken, id, native, true, own, "airfield-surfaces-v346"))).toBeUndefined();
  });
});

import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { captureNeighbourhoodPacketV300 as capture, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { captureSourceQuarterPacketV303 } from "../src/SourceQuarterPacketV303";
import { prepareSurroundingQuarterPredecessorV303, groundOverlayKindsV329, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import index from "../src/data/sacredPlacesV347Index.json";

const done = <T>(work: Generator<void, T>): T => { for (;;) { const r = work.next(); if (r.done) return r.value; } };
const flags = { schlossplatzV239:true, staatsoperV240:true, architectureV241:true, mitteEnsembleV281:true, prenzlbergV264:true, chariteBridgesV265:true, operaTheatresV274:true, northernSitesV266:true, golgathaV270:true, tachelesFrontsV270:true, southFidelityV294:true, littenStadthausV297:true, wallGalleryV298:true, stralauSisyphosV299:true, neighbourhoodV300:true, westKiezV302:true };
const words = (s: string, size: 2 | 4) => { const b = Buffer.from(s, "base64"); const a = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return size === 2 ? new Uint16Array(a) : new Uint32Array(a); };
const manifest = await Bun.file(new URL("../public/mesh/surrounding-berlin-v159/manifest.json", import.meta.url)).json();

describe("V347 mapped cemetery routes on retained ground", () => {
  for (const { file, keys } of index.sources) test(file + " admits every exact host and keeps old geometry/navigation", async () => {
    const source = await Bun.file(new URL("../src/data/" + file, import.meta.url)).json() as NeighbourhoodSourceV300;
    for (const key of keys) {
      const [mode, id] = key.split(":"), native = mode === "minecraft";
      const descriptor = manifest.chunks.find((c: { id: string }) => c.id === id);
      const raw = JSON.parse(gunzipSync(await Bun.file(new URL(`../public/mesh/surrounding-berlin-v159/${descriptor[mode].url}`, import.meta.url)).bytes()).toString()) as SurroundingCityChunk;
      let prior = done(prepareSurroundingQuarterPredecessorV303(structuredClone(raw), id, native, flags));
      for (const entry of await loadSourceQuarterRecipesV309(id, native)) {
        if (entry.kind === "sacred-places-v347") break;
        if (groundOverlayKindsV329.has(entry.kind)) continue;
        const ticket = entry.source.packets[key].preparedRecords
          ? done(captureSourceQuarterPacketV303(raw, id, native, true, entry.source, entry.kind, entry.requiredReplacement))
          : done(capture(raw, id, native, true, entry.source as unknown as NeighbourhoodSourceV300, entry.kind));
        if (ticket) prior = done(ticket(prior));
      }
      const ticket = done(capture(raw, id, native, true, source, "sacred-places-v347"));
      expect(ticket, key + " raw admission").toBeDefined();
      const after = done(ticket!(prior));
      expect(after.meshes.length, key + " prepared admission").toBe(prior.meshes.length + 1);
      expect(after.meshes.slice(0, -1)).toEqual(prior.meshes);
      expect(after.nav).toBe(prior.nav);
      expect(after.lines).toBe(prior.lines);
      expect(done(ticket!(after))).toBe(after);
      expect(source.packets[key].retire).toEqual([]);
      const changed = { ...raw, origin: [raw.origin[0] + 1, ...raw.origin.slice(1)] };
      expect(done(capture(changed, id, native, true, source, "sacred-places-v347"))).toBeUndefined();
      const p = source.packets[key].append, positions = words(p.positions, 2), indices = words(p.indices, 4);
      expect(positions.length / 3).toBeLessThanOrEqual(45000);
      expect(indices.length).toBeLessThanOrEqual(240000);
      let horizontal = true;
      for (let i = 0; i < indices.length; i += 3) {
        const a = positions[indices[i] * 3 + 1], b = positions[indices[i+1] * 3 + 1], c = positions[indices[i+2] * 3 + 1];
        horizontal &&= a === b && a === c;
      }
      expect(horizontal, key + " ground-conforming horizontal patches").toBe(true);
      expect(after.meshes.length).toBeLessThanOrEqual(16);
      expect(after.meshes.reduce((n, m) => n + words(m.positions, 2).length / 3, 0)).toBeLessThanOrEqual(400000);
    }
  }, 60000);
});

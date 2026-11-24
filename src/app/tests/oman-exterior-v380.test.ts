import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {loadSourceQuarterRecipesV309} from "../src/SourceQuarterCatalogueV309";
import {createSurroundingCityChunk, type SurroundingCityChunk} from "../src/SurroundingCityGeometry";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";

const id = "outer187--13_12", owner = "DEBE06YYB0000mXS", old = "OSM-way-56414652";
for (const mode of ["drawn", "minecraft"] as const) test("Oman replaces its complete original tile owner in " + mode, async () => {
  const native = mode === "minecraft";
  const url = new URL("../public/mesh/surrounding-berlin-v159/"+id+"."+mode+".json.gz", import.meta.url);
  const packet: SurroundingCityChunk = JSON.parse(gunzipSync(readFileSync(url)).toString());
  const sourceQuarterSourcesV303 = await loadSourceQuarterRecipesV309(id, native);
  const build = (source: SurroundingCityChunk) => createSurroundingCityChunk(source, id, native, {
    sourceQuartersV303: true, sourceQuarterSourcesV303, groundOverlaysV329: false,
  });
  const exact = build(packet);
  try {
    expect(exact.root.userData.sourceQuarterOwnersV303).toContain(owner);
    expect(exact.root.userData.sourceQuarterTrianglesV303).toBe(native ? 97 : 10);
    expect(exact.nav.buildings.find(b=>b.sourceId===old)).toBeUndefined();
    const parts=exact.nav.buildings.filter(b=>b.sourceId.startsWith(owner+":"));
    expect(new Set(parts.map(p=>p.sourceId)).size).toBe(7);
    expect(parts.every(p=>native ? p.nativeRoofCaps?.length : p.roofTriangles?.length)).toBe(true);
    expect(parts.every(p=>p.groundOffset===8.6)).toBe(true);
    for (const neighbour of packet.nav.buildings.filter(b=>b.sourceId!==old)) {
      expect(exact.nav.buildings.some(b=>b.sourceId===neighbour.sourceId)).toBe(true);
    }
  } finally {
    disposeSurroundingCityRoot(exact.root);
  }
  const changed = {...packet, nav:{...packet.nav, groundY:3.01}};
  const fallback = build(changed);
  try {
    expect(fallback.nav.buildings.some(b=>b.sourceId===old)).toBe(true);
    expect(fallback.root.userData.sourceQuarterOwnersV303).not.toContain(owner);
  } finally {
    disposeSurroundingCityRoot(fallback.root);
  }
});

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, Mesh } from "three";
import { createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";
import { attachSchoenebergPlaetzeV383 } from "../src/schoenebergPlaetzeV383";
import { schoenebergPlaetzeViewsV383, schoenebergPlaetzeOpeningHostV383 } from "../src/schoenebergPlaetzeViewsV383";
import winter from "../src/data/schoenebergPlaetzeV383/winter.json";
import noll from "../src/data/schoenebergPlaetzeV383/noll.json";

test("St. Matthias replaces its own prism on both sides of the stream seam and retains its historic neighbour", async () => {
  for (const native of [false,true]) {
    for (const tile of ["-3_4","-3_5"]) {
      const file = new URL("../public/mesh/surrounding-berlin-v159/"+tile+"."+(native?"minecraft":"drawn")+".json.gz",import.meta.url);
      const input = JSON.parse(gunzipSync(readFileSync(file)).toString());
      const entry = await createStreamedSurroundingCityChunkV255(input,tile,native,{yield:async()=>{}});
      try {
        expect(entry.root.userData.surveyedShellOwnersV377).toContain("DEBE07YY900000CC");
        if (tile === "-3_5") {
          expect(entry.root.userData.surveyedShellOwnersV377).toContain("DEBE07YY900007c4");
          const church = entry.nav.buildings.filter(b=>b.sourceId==="DEBE07YY900000CC");
          expect(Math.max(...church.map(b=>b.height))).toBeCloseTo(60,1);
        }
      } finally { disposeSurroundingCityRoot(entry.root); }
    }
  }
}, 60000);

test("both detailed plazas adopt trees and measured material surfaces once in either city style", async () => {
  expect(winter.trees).toHaveLength(110);
  expect(noll.trees).toHaveLength(47);
  expect(Object.keys(schoenebergPlaetzeViewsV383)).toHaveLength(4);
  for (const native of [false,true]) {
    for (const name of ["Nollendorfplatz","Winterfeldtplatz"]) {
      const id=schoenebergPlaetzeOpeningHostV383(name)!;
      const entry={root:new Group(), origin:[0,0,0],geometryBytes:0,bufferCount:0} as unknown as SurroundingChunkGeometry;
      await attachSchoenebergPlaetzeV383(entry,id,native);
      const first=entry.geometryBytes;
      expect(first).toBeGreaterThan(0);
      await attachSchoenebergPlaetzeV383(entry,id,native);
      expect(entry.geometryBytes).toBe(first);
      let triangles=0;
      entry.root.traverse(o=>{if (o instanceof Mesh) triangles+=(o.geometry.index?.count??0)/3});
      expect(triangles).toBeGreaterThan(10000);
      disposeSurroundingCityRoot(entry.root);
    }
  }
});

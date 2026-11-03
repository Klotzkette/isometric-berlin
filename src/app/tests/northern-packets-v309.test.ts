import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import sourceData from "../src/data/northernFidelityV309Packets.json";
import index from "../src/data/northernFidelityV309Index.json";
import { captureSourceQuarterPacketV303, prepareSourceQuarterPacketV303, sourceQuarterOwnersV303, sourceQuarterNavigationV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { prepareSurroundingQuarterPredecessorV303, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { loadSourceQuarterRecipesV309, SOURCE_QUARTER_CATALOGUE_V309 } from "../src/SourceQuarterCatalogueV309";
const source = sourceData as unknown as SourceQuarterSourceV303;
function finish<T>(g: Generator<void,T>): T { let r=g.next();while(!r.done)r=g.next();return r.value; }
const ownership = { neighbourhoodV300:true,westKiezV302:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,tachelesFrontsV270:true };

// Full actual raw and prepared predecessors, not miniature mirrors of a recipe.
for (const key of source.keys) test(`complete northern tile admission and unchanged limits: ${key}`, async () => {
  const [mode,id]=key.split(":"), native=mode==="minecraft";
  const raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
  const entry=(await loadSourceQuarterRecipesV309(id,native)).find(e=>e.admission==="north-v309");
  expect(entry?.source).toBe(sourceData);expect(entry?.requiredReplacement).toBeTrue();
  const ticket=finish(captureSourceQuarterPacketV303(raw,id,native,true,source,"northern-fidelity-v309",true));expect(ticket).toBeDefined();
  const prepared=finish(prepareSurroundingQuarterPredecessorV303(raw,id,native,ownership));
  const admitted=finish(prepareSourceQuarterPacketV303(prepared,ticket));
  expect(sourceQuarterOwnersV303(admitted).length).toBe(source.packets[key].owners.length);
  expect(admitted).not.toBe(prepared);
  expect(admitted.meshes.length).toBeLessThanOrEqual(16);
  const vertices=admitted.meshes.reduce((n,p)=>n+Buffer.from(p.positions,"base64").length/6,0);
  const indices=admitted.meshes.reduce((n,p)=>n+Buffer.from(p.indices,"base64").length/4,0);
  expect(vertices).toBeLessThanOrEqual(400_000);expect(indices).toBeLessThanOrEqual(2_400_000);
  const navigation=sourceQuarterNavigationV303(admitted,admitted.nav);
  expect(navigation.buildings.length).toBe(prepared.nav.buildings.length-source.packets[key].retireNav.length+source.packets[key].appendNav.length);
  for (const old of raw.meshes) expect(admitted.meshes.includes(old)).toBeTrue();
});

test("finite visibility and recipes name the same complete source tiles",()=>{
  const catalogue=SOURCE_QUARTER_CATALOGUE_V309.find(e=>e.admission==="north-v309")!;
  expect([...catalogue.keys].sort()).toEqual([...source.keys].sort());
  expect([...index.keys].sort()).toEqual([...source.keys].sort());
  const ids=["10_-2","10_-3","11_-2","11_-3","2_-6","2_-7","3_-6","3_-7","7_-2","7_-5","8_-2","8_-3","8_-4","8_-5","9_-2","9_-3","outer187--7_16","outer187--8_16"];
  expect([...source.keys].sort()).toEqual(["drawn","minecraft"].flatMap(mode=>ids.map(id=>`${mode}:${id}`)).sort());
  expect(source.keys.length).toBe(36);expect(index.regions.length).toBeGreaterThan(16);
  expect(index.regions.every(b=>b.length===4&&b.every(Number.isFinite)&&b[0]<b[2]&&b[1]<b[3])).toBeTrue();
});

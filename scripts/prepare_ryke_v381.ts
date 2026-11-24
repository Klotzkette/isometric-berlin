import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {resolve} from "node:path";
import {SOURCE_QUARTER_CATALOGUE_V309,createSourceQuarterRecipeLoaderV309} from "../src/app/src/SourceQuarterCatalogueV309";
import {prepareSurroundingQuarterFromSourcesV362,groundOverlayKindsV329} from "../src/app/src/SurroundingCityGeometry";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303} from "../src/app/src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300} from "../src/app/src/NeighbourhoodPacketV300";
import {surroundingPacketFingerprint} from "../src/app/src/surroundingPacketFingerprint";
const id="6_-4";
const catalogue=createSourceQuarterRecipeLoaderV309(SOURCE_QUARTER_CATALOGUE_V309.filter(e=>e.kind!=="ryke-street-house-v381"));
function done(g) {let v=g.next();while(!v.done)v=g.next();return v.value}
const hash=(text)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h;};
const guards={};
for(const mode of ["drawn","minecraft"]){
  const native=mode==="minecraft",raw=JSON.parse(gunzipSync(readFileSync(resolve("public/mesh/surrounding-berlin-v159",id+"."+mode+".json.gz"))).toString());
  const tickets=[];
  for (const e of await catalogue(id,native)) {
    if (groundOverlayKindsV329.has(e.kind))continue;
    const plan=e.source.packets[mode+":"+id];
    const ticket=plan.preparedRecords?done(captureSourceQuarterPacketV303(raw,id,native,true,e.source,e.kind,e.requiredReplacement)):done(captureNeighbourhoodPacketV300(raw,id,native,true,e.source,e.kind));
    if(ticket)tickets.push(ticket);
  }
  let p=done(prepareSurroundingQuarterFromSourcesV362(raw,id,native,{}));
  for(const t of tickets)p=done(prepareSourceQuarterPacketV303(p,t));
  const pins=c=>c.meshes.map((m,i)=>({mesh:i,kind:m.kind,fingerprint:done(surroundingPacketFingerprint(m))}));
  const ink=c=>c.lines?hash(c.lines.positions+(c.lines.colors??"")):null;
  guards[mode]={records:pins(raw),preparedRecords:pins(p),navGuard:hash(JSON.stringify(raw.nav)),lineGuard:ink(raw),preparedNavGuard:hash(JSON.stringify(p.nav)),preparedLineGuard:ink(p)};
}
process.stdout.write(JSON.stringify(guards));

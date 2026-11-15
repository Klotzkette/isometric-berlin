import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import recipe from "../src/data/huxleysEntranceV346.json";
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303,type SourceQuarterSourceV303} from "../src/SourceQuarterPacketV303";
import {captureNeighbourhoodPacketV300,type NeighbourhoodSourceV300} from "../src/NeighbourhoodPacketV300";
import {prepareSurroundingQuarterPredecessorV303,groundOverlayKindsV329} from "../src/SurroundingCityGeometry";
import {doneV342,optionsV342} from "./helpers/neukoellnPredecessorV342";
const id="ring182-6_7",kind="huxleys-entrance-v346";
async function prepare(raw:any,native:boolean){
 const options=await optionsV342(id,native),tickets=[];
 for(const entry of options.sourceQuarterSourcesV303??[]){if(entry.kind===kind)break; if(groundOverlayKindsV329.has(entry.kind))continue;const p=entry.source.packets[`${native?"minecraft":"drawn"}:${id}`];if(!p)continue;const t=p.preparedRecords?doneV342(captureSourceQuarterPacketV303(raw,id,native,true,entry.source,entry.kind,entry.requiredReplacement)):doneV342(captureNeighbourhoodPacketV300(raw,id,native,true,entry.source as unknown as NeighbourhoodSourceV300,entry.kind));if(t)tickets.push(t);}
 let p=doneV342(prepareSurroundingQuarterPredecessorV303(raw,id,native,options));for(const t of tickets)p=doneV342(prepareSourceQuarterPacketV303(p,t));return p;
}
for(const native of[false,true])test(`Huxleys ${native?"native":"drawn"}: complete host required, old source and navigation unchanged`,async()=>{
 const mode=native?"minecraft":"drawn",raw=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
 const p=await prepare(raw,native),ticket=doneV342(captureSourceQuarterPacketV303(raw,id,native,true,recipe as SourceQuarterSourceV303,kind));expect(ticket).toBeDefined();
 const after=doneV342(prepareSourceQuarterPacketV303(p,ticket));expect(after.meshes.length).toBe(p.meshes.length+1);expect(after.meshes.slice(0,-1)).toEqual(p.meshes);expect(after.nav).toEqual(p.nav);expect(after.lines).toEqual(p.lines);
 const withoutVenue={...p,meshes:p.meshes.filter(m=>m.kind!=="elevated-station-v238")};expect(doneV342(prepareSourceQuarterPacketV303(withoutVenue,ticket))).toBe(withoutVenue);
 const changed=structuredClone(p);changed.meshes.find(m=>m.kind==="elevated-station-v238")!.positions="AAAA";expect(doneV342(prepareSourceQuarterPacketV303(changed,ticket))).toBe(changed);
 const wrong=structuredClone(raw);wrong.nav.groundY+=.1;expect(doneV342(captureSourceQuarterPacketV303(wrong,id,native,true,recipe as SourceQuarterSourceV303,kind))).toBeUndefined();
 expect(doneV342(captureSourceQuarterPacketV303(raw,"venues238-6_7",native,true,recipe as SourceQuarterSourceV303,kind))).toBeUndefined();
 const mesh=after.meshes.at(-1)!,b=Buffer.from(mesh.positions,"base64"),ix=Buffer.from(mesh.indices,"base64"),points:number[][]=[];
 for(let i=0;i<b.length;i+=6)points.push([0,1,2].map(a=>b.readUInt16LE(i+a*2)/100+raw.origin[a]));
 expect(points.every(p=>p[0]>3341&&p[0]<3345&&p[1]>2.95&&p[1]<7.85&&p[2]>3652&&p[2]<3656)).toBeTrue();
 if(native)for(let i=0;i<ix.length;i+=12){const ps=[0,1,2].map(j=>points[ix.readUInt32LE(i+j*4)]);expect([0,1,2].some(a=>ps[0][a]===ps[1][a]&&ps[1][a]===ps[2][a])).toBeTrue();}
 // No canopy supports or solid box fill the approach under the raised glass.
 const canopyVertices=points.filter(p=>p[0]>3342.5);expect(canopyVertices.length).toBeGreaterThan(0);expect(Math.min(...canopyVertices.map(p=>p[1]))).toBeGreaterThan(6.85);
});

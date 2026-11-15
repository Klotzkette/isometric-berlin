import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { prepareSurroundingQuarterPredecessorV303 as predecessor, groundOverlayKindsV329, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { loadSourceQuarterRecipesV309 } from "../src/SourceQuarterCatalogueV309";
import { captureSourceQuarterPacketV303 as capture, prepareSourceQuarterPacketV303 as apply, applySourceQuarterTrianglesV303, sourceQuarterNavigationV303, type SourceQuarterSourceV303 } from "../src/SourceQuarterPacketV303";
import { captureNeighbourhoodPacketV300 } from "../src/NeighbourhoodPacketV300";
import data from "../src/data/clayDahlemV347.json";
import proof from "../../../geo_data/regierungsviertel/clay-dahlem-v347-evidence.json";

const done = <T>(g: Generator<void,T>):T => { let r=g.next(); while(!r.done)r=g.next(); return r.value; };
const source=data as unknown as SourceQuarterSourceV303,kind="clay-dahlem-v347";
const flags={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};
const typed=(text:string,size:2|4)=>{const b=Buffer.from(text,"base64");return size===2?new Uint16Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)):new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};

describe("V347 finite Clayallee/Dahlem source transactions",()=>{
  for(const key of source.keys)test(key+" admits both complete generations and preserves unrelated geometry",async()=>{
    const [mode,id]=key.split(":"),native=mode==="minecraft";
    const raw=JSON.parse(gunzipSync(await Bun.file(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url)).bytes()).toString()) as SurroundingCityChunk;
    const tickets=[];
    for(const e of await loadSourceQuarterRecipesV309(id,native)){
      if(e.kind===kind)break;
      if(groundOverlayKindsV329.has(e.kind))continue;
      const plan=e.source.packets[key];
      const t=done(plan.preparedRecords?capture(raw,id,native,true,e.source,e.kind,e.requiredReplacement):captureNeighbourhoodPacketV300(raw,id,native,true,e.source as never,e.kind));
      if(t)tickets.push(t);
    }
    let prior=done(predecessor(raw,id,native,flags));
    for(const ticket of tickets)prior=done(apply(prior,ticket));
    const ticket=done(capture(raw,id,native,true,source,kind));expect(ticket).toBeDefined();
    const after=done(apply(prior,ticket)),plan=source.packets[key];
    expect(after.meshes.length).toBe(prior.meshes.length+1);
    expect(after.meshes.at(-1)?.kind).toBe(kind);
    expect(done(apply(after,ticket))).toBe(after);
    expect(after.lines).toEqual(prior.lines);
    for(let i=0;i<prior.meshes.length;i++){
      expect(after.meshes[i]).toEqual(prior.meshes[i]);
      const before=typed(prior.meshes[i].indices,4) as Uint32Array,actual=before.slice();
      done(applySourceQuarterTrianglesV303(prior,i,before,0));
      done(applySourceQuarterTrianglesV303(after,i,actual,0));
      const removed=new Set(plan.retire.find(r=>r.mesh===i)?.triangles??[]);
      for(let j=0;j<actual.length;j+=3){
        if(removed.has(j/3))expect([actual[j+1],actual[j+2]]).toEqual([actual[j],actual[j]]);
        else expect([...actual.slice(j,j+3)]).toEqual([...before.slice(j,j+3)]);
      }
    }
    const navBefore=sourceQuarterNavigationV303(prior,prior.nav),navAfter=sourceQuarterNavigationV303(after,after.nav),removed=new Set(plan.retireNav.map(r=>JSON.stringify(r)));
    expect(navAfter.ground).toEqual(navBefore.ground);expect(navAfter.roads).toEqual(navBefore.roads);expect(navAfter.water).toEqual(navBefore.water);
    expect(navAfter.buildings).toEqual([...navBefore.buildings.filter(r=>!removed.has(JSON.stringify(r))),...plan.appendNav]);
    for(const p of plan.appendNav){expect(navAfter.buildings).toContainEqual(p);expect(p.height).toBeGreaterThanOrEqual(p.minHeight);}
    const broken={...raw,meshes:raw.meshes.map((m,i)=>i?m:{...m,kind:"wrong-host"})};
    expect(done(capture(broken,id,native,true,source,kind))).toBeUndefined();
    const incomplete={...prior,meshes:prior.meshes.slice(1)};
    expect(done(apply(incomplete,ticket))).toBe(incomplete);
    if(native){
      const m=after.meshes.at(-1)!,p=typed(m.positions,2),ix=typed(m.indices,4);
      // Every independent Native face lies on a cardinal plane. A rotated
      // Drawn sheet cannot leak through even in the aircraft/field details.
      for(let i=0;i<ix.length;i+=3)expect([0,1,2].some(a=>p[ix[i]*3+a]===p[ix[i+1]*3+a]&&p[ix[i]*3+a]===p[ix[i+2]*3+a])).toBe(true);
    }
    expect(after.meshes.length).toBeLessThanOrEqual(16);
    expect(after.meshes.reduce((n,m)=>n+typed(m.positions,2).length/3,0)).toBeLessThanOrEqual(400000);
  });
  test("bounded coverage, one actually exhibited aircraft and distinct bee sites",()=>{
    expect(proof.completeSourceFamilies).toBe(11);expect(proof.completeSourceParts).toBe(36);
    expect(proof.coverage.length).toBe(7);
    expect(proof.coverage.every(r=>r.footprintIoU>.91)).toBe(true);
    expect(proof.details.drawn.aircraft.aircraftCount).toBe(1);
    expect(proof.details.drawn.aircraft.engines.length).toBe(4);
    expect(proof.details.drawn.aircraft.spanM).toBe(34.44);
    expect(proof.details.drawn.apiarySource).toBe("way/108631421");
    expect(proof.details.drawn.cropRows).toBeGreaterThan(50);
    expect(proof.details.drawn.pathExclusionCount).toBeGreaterThan(10);
    expect(proof.packets.every(p=>p.vertices<=400000&&p.indices<=2400000)).toBe(true);
  });
  test("connected consulate canopy retains its raised source datum",()=>{
    for(const mode of ["drawn","minecraft"]){
      const plan=source.packets[`${mode}:outer187--14_14`];
      const canopy=plan.appendNav.find(p=>p.sourceId.endsWith("DEBE06YYB0004vEY"));
      expect(canopy).toBeDefined();
      expect(canopy!.minHeight).toBeGreaterThanOrEqual(2);
      expect(canopy!.height).toBeGreaterThan(canopy!.minHeight);
    }
  });
});

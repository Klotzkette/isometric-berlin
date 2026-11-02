import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/ostHousingV301.json";
import { captureNeighbourhoodPacketV300, prepareNeighbourhoodPacketV300, applyNeighbourhoodTrianglesV300, neighbourhoodPacketAdmittedV300, type NeighbourhoodSourceV300 } from "../src/NeighbourhoodPacketV300";
import { prepareStreetCurvesV276 } from "../src/streetCurvesV276";
import { prepareEastStadtbahnV288 } from "../src/EastStadtbahnV288";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const source=data as unknown as NeighbourhoodSourceV300;
const directory=new URL("../public/mesh/surrounding-berlin-v159/",import.meta.url);
function done<T>(g:Generator<void,T>):T { let n=g.next();while(!n.done)n=g.next();return n.value; }
function packet(key:string):SurroundingCityChunk { const [family,id]=key.split(":");return JSON.parse(gunzipSync(readFileSync(new URL(`${id}.${family}.json.gz`,directory))).toString()); }
const options={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,westKiezV302:true,neighbourhoodV300:true};

test("all 32 exact eastern source guards admit the complete fronts after their real older nav preparers",()=>{
  expect(source.keys.length).toBe(32);
  let changed=0,retired=0;
  for(const key of source.keys){
    const [mode,id]=key.split(":"),native=mode==="minecraft",raw=packet(key),before=JSON.stringify(raw);
    expect(done(captureNeighbourhoodPacketV300(raw,id,native,false,source,"ost-housing-v301"))).toBeUndefined();
    const ticket=done(captureNeighbourhoodPacketV300(raw,id,native,true,source,"ost-housing-v301"));
    expect(typeof ticket).toBe("function");
    const older=done(prepareEastStadtbahnV288(done(prepareStreetCurvesV276(raw,id,native)),id,native));
    if(older.nav!==raw.nav)changed++;
    const ready=done(prepareNeighbourhoodPacketV300(older,ticket));
    expect(neighbourhoodPacketAdmittedV300(ready)).toBeTrue();
    expect(neighbourhoodPacketAdmittedV300({...ready})).toBeTrue();
    expect(ready.nav).toBe(older.nav);expect(ready.lines).toBe(older.lines);
    for(let i=0;i<raw.meshes.length;i++)expect(ready.meshes[i]).toBe(raw.meshes[i]);
    expect(ready.meshes.at(-1)?.kind).toBe("ost-housing-v301");
    for(const r of source.packets[key].retire){
      // Independent typed view preserves the exact full old index complement.
      const bytes=Buffer.from(raw.meshes[r.mesh].indices,"base64");
      const a=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4).slice();
      const original=a.slice(),selected=new Set(r.triangles);
      expect(done(applyNeighbourhoodTrianglesV300(ready,r.mesh,a,0))).toBe(r.triangles.length);
      for(let i=0;i<a.length/3;i++){
        if(selected.has(i)){expect(a[i*3+1]).toBe(a[i*3]);expect(a[i*3+2]).toBe(a[i*3]);}
        else for(let k=0;k<3;k++)expect(a[i*3+k]).toBe(original[i*3+k]);
      }
      retired+=r.triangles.length;
    }
    const foreign={...ready,nav:{...ready.nav,groundY:ready.nav.groundY+.01}};
    expect(neighbourhoodPacketAdmittedV300(foreign)).toBeFalse();
    expect(JSON.stringify(raw)).toBe(before);
  }
  expect(changed).toBe(10);expect(retired).toBe(524);
});

test("the actual complete decoder admits every final eastern primary and companion in both families",()=>{
  for(const key of source.keys){
    const [mode,id]=key.split(":"),raw=packet(key);
    const result=done(buildSurroundingCityChunk(raw,id,mode==="minecraft",false,options));
    try{
      expect(result.root.userData.neighbourhoodV300).toBeTrue();
      expect(result.root.userData.neighbourhoodTrianglesV300??0).toBe(source.packets[key].retire.reduce((n,r)=>n+r.triangles.length,0));
    }finally{
      const geometries=new Set<any>(),materials=new Set<any>();
      result.root.traverse((o:any)=>{if(o.geometry)geometries.add(o.geometry);for(const v of [o.material,o.userData.dayMaterial,o.userData.nightMaterial])if(v){if(Array.isArray(v))v.forEach(m=>materials.add(m));else materials.add(v);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    }
  }
},120000);

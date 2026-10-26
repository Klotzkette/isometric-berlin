import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import data from "../src/data/tierparkV276.json";
import { prepareTierparkV276, type TierparkSourceV276 } from "../src/TierparkV276";
import { prepareTierparkV255 } from "../src/TierparkV255";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot, createStreamedSurroundingCityChunkV255 } from "../src/SurroundingCity";

const source=data as TierparkSourceV276;
const dir=path.resolve(import.meta.dir,"../public/mesh/surrounding-berlin-v159");
const fixture=(key:string):SurroundingCityChunk=>{
  const [family,id]=key.split(":");
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,`${id}.${family}.json.gz`))).toString());
};
const finish=<T>(it:Generator<void,T>):T=>{let r=it.next();while(!r.done)r=it.next();return r.value;};

describe("Tierpark v276 source-bound complete companion",()=>{
  test("all six real packets keep every prior mesh, path, water and building; both modes decode",()=>{
    for(const key of source.ids){
      const [family,id]=key.split(":"),native=family==="minecraft";
      const original=fixture(key),snapshot=JSON.stringify(original);
      const v255=finish(prepareTierparkV255(original,id,native));
      const next=finish(prepareTierparkV276(v255,id,native));
      expect(next.meshes.slice(0,-1)).toEqual(v255.meshes);
      expect(next.meshes.at(-1)).toBe(source.packets[key].mesh);
      expect(next.lines).toBe(original.lines);
      expect(next.nav.ground).toBe(original.nav.ground);
      expect(next.nav.roads).toBe(original.nav.roads);
      expect(next.nav.water).toBe(original.nav.water);
      expect(next.nav.buildings.slice(0,v255.nav.buildings.length)).toEqual(v255.nav.buildings);
      expect(next.nav.buildings.length).toBe(v255.nav.buildings.length+source.packets[key].solids.length);
      expect(JSON.stringify(original)).toBe(snapshot);
      expect(finish(prepareTierparkV276(next,id,native))).toBe(next);
      const built=finish(buildSurroundingCityChunk(next,id,native));
      expect(built.geometryBytes).toBeLessThan(16*1024*1024);
      expect(built.root.userData.sourceKinds).toContain("tierpark-v276");
      expect(built.root.userData.nativeMinecraft).toBe(native);
      disposeSurroundingCityRoot(built.root);
    }
  },60_000);

  test("actual wall mutation, ground drift, wrong family and cancellation fail closed",()=>{
    for(const key of source.ids){
      const [family,id]=key.split(":"),native=family==="minecraft",old=fixture(key);
      for(const change of ["wall","ground","height","origin"]){
        const changed=structuredClone(old);
        if(change==="wall")changed.meshes[0].positions="AAAA"+changed.meshes[0].positions.slice(4);
        else if(change==="ground")changed.nav.ground[0].ring[0][0]+=.01;
        else if(change==="height")changed.nav.groundY+=.01;
        else changed.origin[0]+=.01;
        expect(finish(prepareTierparkV276(changed,id,native))).toBe(changed);
      }
      expect(finish(prepareTierparkV276(old,id,!native,{...source,packets:{[key]:source.packets[key]}}))).toBe(old);
      const snapshot=JSON.stringify(old),it=prepareTierparkV276(old,id,native);
      expect(it.next().done).toBe(false);it.return(old);expect(JSON.stringify(old)).toBe(snapshot);
    }
  });

  test("production streaming path publishes the full companion and aborts before upload",async()=>{
    for(const key of source.ids){
      const [family,id]=key.split(":"),native=family==="minecraft";
      const built=await createStreamedSurroundingCityChunkV255(fixture(key),id,native,{yield:async()=>{}});
      expect(built.root.userData.sourceKinds).toContain("tierpark-v276");
      disposeSurroundingCityRoot(built.root);
      const controller=new AbortController();controller.abort();
      await expect(createStreamedSurroundingCityChunkV255(fixture(key),id,native,{signal:controller.signal})).rejects.toThrow("Aborted");
    }
  },60_000);
});

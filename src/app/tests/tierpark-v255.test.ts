import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { build } from "vite";
import { losslessJsonData } from "../losslessJsonData";
import data from "../src/data/tierparkV255.json";
import { prepareTierparkV255, type TierparkSourceV255 } from "../src/TierparkV255";
import { buildSurroundingCityChunk, type SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";

const source = data as TierparkSourceV255;
const dir = path.resolve(import.meta.dir, "../public/mesh/surrounding-berlin-v159");
const fixture = (key: string): SurroundingCityChunk => {
  const [family,id]=key.split(":");
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,`${id}.${family}.json.gz`))).toString());
};
const finish = <T>(it: Generator<void,T>): T => {
  let step=it.next();while(!step.done)step=it.next();return step.value;
};

describe("Tierpark source-bound streamed companion v255",()=>{
  test("all packets retain existing geometry/navigation and decode inside current bounds",()=>{
    expect(source.ids).toHaveLength(10);
    for(const key of source.ids){
      const [family,id]=key.split(":"),native=family==="minecraft";
      const old=fixture(key),snapshot=JSON.stringify(old);
      const next=finish(prepareTierparkV255(old,id,native));
      expect(next.meshes.slice(0,-1)).toEqual(old.meshes);
      expect(next.meshes.at(-1)).toBe(source.packets[key].mesh);
      expect(next.nav.ground).toBe(old.nav.ground);
      expect(next.nav.water).toBe(old.nav.water);
      expect(next.nav.roads).toBe(old.nav.roads);
      expect(next.nav.buildings.slice(0,old.nav.buildings.length)).toEqual(old.nav.buildings);
      expect(next.nav.buildings.length).toBe(old.nav.buildings.length+source.packets[key].solids.length);
      expect(next.lines).toBe(old.lines);
      expect(JSON.stringify(old)).toBe(snapshot);
      expect(finish(prepareTierparkV255(next,id,native))).toBe(next);
      const built=finish(buildSurroundingCityChunk(next,id,native));
      expect(built.geometryBytes).toBeLessThan(16*1024*1024);
      expect(built.root.userData.sourceKinds).toContain("tierpark-v255");
      expect(built.root.userData.nativeMinecraft).toBe(native);
      disposeSurroundingCityRoot(built.root);
    }
  },60_000);

  test("different source rings/datum/origin and wrong family fail closed; preparation cancels",()=>{
    const key=source.ids[0],[family,id]=key.split(":"),native=family==="minecraft";
    const old=fixture(key);
    for(const kind of ["origin","ground","height"]){
      const changed=structuredClone(old);
      if(kind==="origin")changed.origin[0]+=.01;
      else if(kind==="ground")changed.nav.ground[0].ring[0][0]+=.01;
      else changed.nav.groundY+=.01;
      expect(finish(prepareTierparkV255(changed,id,native))).toBe(changed);
    }
    expect(finish(prepareTierparkV255(old,"unrelated",native))).toBe(old);
    expect(finish(prepareTierparkV255(old,id,!native,{...source,packets:{[key]:source.packets[key]}}))).toBe(old);
    const snapshot=JSON.stringify(old),it=prepareTierparkV255(old,id,native);
    expect(it.next().done).toBe(false);it.return(old);
    expect(JSON.stringify(old)).toBe(snapshot);
  });

  test("native remains fully orthogonal and packet data contain no imagery",()=>{
    for(const key of source.ids.filter(k=>k.startsWith("minecraft:"))){
      const mesh=source.packets[key].mesh,p=Buffer.from(mesh.positions,"base64"),i=Buffer.from(mesh.indices,"base64");
      for(let start=0;start<i.length;start+=12){
        const ids=[0,4,8].map(o=>i.readUInt32LE(start+o));
        expect([0,1,2].some(axis=>ids.every(v=>p.readUInt16LE(v*6+axis*2)===p.readUInt16LE(ids[0]*6+axis*2)))).toBe(true);
      }
      expect(Object.keys(mesh).sort()).toEqual(["colors","indices","kind","positionType","positions"]);
    }
  });

  test("unused construction path does not retain Tierpark packed data in another bundle",async()=>{
    const directory=await fs.promises.mkdtemp(path.join(tmpdir(),"tierpark-shaking-v255-"));
    const entry=path.join(directory,"entry.js");
    try {
      // A static unused constructor import must remain safe: navigation reaches
      // this module through SurroundingCityGeometry without invoking preparation.
      await fs.promises.writeFile(entry,
        `import { prepareTierparkV255 } from ${JSON.stringify(path.resolve(import.meta.dir,"../src/TierparkV255.ts"))};\nwindow.keepEntry = true;`);
      const result=await build({configFile:false,root:directory,publicDir:false,logLevel:"silent",
        plugins:[losslessJsonData()],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
      if(Array.isArray(result)||!("output" in result))throw new Error("Expected one bundle");
      const chunks=result.output.filter(item=>item.type==="chunk");
      const retained=chunks.flatMap(chunk=>Object.entries(chunk.modules))
        .filter(([id])=>id.endsWith("/TierparkV255.ts")||id.endsWith("/data/tierparkV255.json"));
      expect(retained.every(([,module])=>module.renderedLength===0)).toBe(true);
      expect(chunks.some(chunk=>chunk.code.includes("tierpark-v255"))).toBe(false);
    } finally {await fs.promises.rm(directory,{recursive:true,force:true});}
  },60_000);
});

import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { losslessJsonData, READONLY_CONSTRUCTION_JSON_FIELDS } from "../losslessJsonData";
import { applyGreyClusterColoursV263, type GreyClusterColourSourceV263 } from "../src/greyClusterColoursV263";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
class CollectableReference {
  static entries: CollectableReference[]=[];
  private value:object|undefined;
  constructor(value:object){this.value=value;CollectableReference.entries.push(this);}
  deref(){return this.value;}
  static collect(){for(const ref of this.entries)ref.value=undefined;this.entries=[];}
}
function finish<T>(it:Generator<void,T>):T{let s=it.next();while(!s.done)s=it.next();return s.value;}

test("real colour receipts remain byte-exact, lazy, collectible and safe across yielded decoding",async()=>{
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["greyClusterColoursV263.json"]).toEqual(["packets"]);
  const original=await readFile(new URL("../src/data/greyClusterColoursV263.json",import.meta.url),"utf8");
  const expected=JSON.parse(original), dir=await mkdtemp(join(tmpdir(),"isometric-grey-cache-"));
  let code="";
  try{
    const folder=join(dir,"src/app/src/data");await mkdir(folder,{recursive:true});
    const path=join(folder,"greyClusterColoursV263.json"),entry=join(dir,"entry.js");
    await writeFile(path,original);await writeFile(entry,`import data from ${JSON.stringify(path)};window.fixture=data;`);
    const result=await build({configFile:false,root:dir,publicDir:false,logLevel:"silent",plugins:[losslessJsonData()],
      build:{write:false,minify:true,rolldownOptions:{input:entry}}});
    if(Array.isArray(result)||!("output"in result))throw Error("Expected single cache fixture");
    const chunk=result.output.find(item=>item.type==="chunk"&&item.isEntry);
    if(!chunk||chunk.type!=="chunk")throw Error("Missing fixture entry");code=chunk.code;
  }finally{await rm(dir,{recursive:true,force:true});}
  expect(code.length).toBeLessThan(110_000);
  const window:{fixture?:GreyClusterColourSourceV263}={};let parses=0;
  new Function("window","JSON","WeakRef",code)(window,{parse(s:string){parses++;return JSON.parse(s);}},CollectableReference);
  const source=window.fixture!;expect(parses).toBe(0);
  const unrelated={meshes:[{kind:"city"}]} as unknown as SurroundingCityChunk;
  expect(finish(applyGreyClusterColoursV263(unrelated,"unrelated",false,0,new Uint16Array(0),0,0,source))).toBe(0);
  expect(parses).toBe(0);
  const targetKey=source.keys![0],targetId=targetKey.split(":")[1];
  expect(finish(applyGreyClusterColoursV263({meshes:[{kind:"authored"}]} as unknown as SurroundingCityChunk,targetId,false,0,new Uint16Array(0),0,0,source))).toBe(0);
  expect(parses).toBe(0);
  const first=source.packets;expect(first).toEqual(expected.packets);expect(source.packets).toBe(first);expect(parses).toBe(1);
  const key=Object.keys(first)[0],[mode,id]=key.split(":"),native=mode==="minecraft";
  const p:SurroundingCityChunk=JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
  const part=p.meshes[0],positions=Buffer.from(part.positions,"base64"),values=new Uint16Array(positions.length);
  for(let i=0;i<positions.length/6;i++)for(let j=0;j<3;j++)values[i*6+j]=positions.readUInt16LE(i*6+j*2);
  const gen=applyGreyClusterColoursV263(p,id,native,0,values,0,values.length/6,source);
  expect(gen.next().done).toBeFalse();CollectableReference.collect();
  expect(finish(gen)).toBe(first[key].records[0].rows.length);
  expect(parses).toBe(1);
  const second=source.packets;expect(second).not.toBe(first);expect(second).toEqual(expected.packets);expect(parses).toBe(2);
  expect(JSON.stringify(source)).toBe(JSON.stringify(expected));
  const replacement={};source.packets=replacement;CollectableReference.collect();expect(source.packets).toBe(replacement);
  Object.freeze(source);expect(()=>{source.packets=first;}).toThrow(TypeError);
  const fallback:{fixture?:GreyClusterColourSourceV263}={};
  new Function("window","JSON","WeakRef",code)(fallback,JSON,undefined);
  const stable=fallback.fixture!.packets;expect(fallback.fixture!.packets).toBe(stable);expect(stable).toEqual(expected.packets);
});

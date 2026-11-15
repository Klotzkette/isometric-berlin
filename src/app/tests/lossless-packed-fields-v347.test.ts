import { expect, test } from "bun:test";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { build } from "vite";
import { losslessJsonData, transformLosslessJsonData } from "../losslessJsonData";
import { LOSSLESS_PACKED_PINS_V347 as pins, exactPackedFieldsV347, assertPackedFieldV347 } from "../losslessPackedFieldsV347";
const paths = Object.keys(pins);

test("only ten exact native mesh fields and the strong grave sites enter V347 encoding", async () => {
  expect(paths.length).toBe(11);
  expect(paths.filter(p=>p.includes("altMitteV169Native")).map(p=>Number(p.match(/packet-(\d+)/)![1])).sort((a,b)=>a-b)).toEqual([7,8,46,48,58,63,64,66,68,70]);
  expect(Object.isFrozen(pins)).toBe(true);
  for (const path of paths) {
    const raw=await readFile(new URL("../src/"+path,import.meta.url),"utf8");
    const names=Object.keys(pins[path].fields);
    expect(exactPackedFieldsV347(path,raw)).toEqual(names);
    expect(()=>exactPackedFieldsV347(path,raw+" ")).toThrow("Changed exact V347 strong source");
    expect(Object.isFrozen(pins[path].fields)).toBe(true);
    for(const key of names){
      expect(()=>assertPackedFieldV347(path,key,JSON.stringify(JSON.parse(raw)[key]))).not.toThrow();
      expect(()=>assertPackedFieldV347(path,key,"{}")).toThrow("Changed exact V347 strong field");
    }
    expect(()=>assertPackedFieldV347(path,"foreign","{}")).toThrow();
    expect(transformLosslessJsonData(raw,"/project/src/app/public/"+path)).toBeUndefined();
    const code=transformLosslessJsonData(raw,"/project/src/app/src/"+path)!.code;
    expect(code).toContain("losslessGzipBase85");expect(code).not.toContain("WeakRef");expect(code).not.toContain("get [");
  }
  expect(exactPackedFieldsV347("data/foreign.json","{}")).toEqual([]);
  const sibling="data/altMitteV169Native/packet-009.json";
  const raw=await readFile(new URL("../src/"+sibling,import.meta.url),"utf8");
  expect(exactPackedFieldsV347(sibling,raw)).toEqual([]);
  expect(transformLosslessJsonData(raw,"/project/src/app/src/"+sibling)?.code ?? "").not.toContain("decodeLosslessGzip");
});

test("actual minified modules roundtrip every value and retain eager named/default identity", async () => {
  const folder=await mkdtemp(join(tmpdir(),"isometric-packed-v347-"));
  try {
    const originals: Record<string, any>[]=[];const fields:string[]=[];const imports:string[]=[];
    for(let i=0;i<paths.length;i++){
      const path=paths[i],key=Object.keys(pins[path].fields)[0];
      const raw=await readFile(new URL("../src/"+path,import.meta.url),"utf8");
      const file=join(folder,"src/app/src",path);
      await mkdir(dirname(file),{recursive:true});await writeFile(file,raw);
      originals.push(JSON.parse(raw));fields.push(key);imports.push(`import data${i},{${key} as named${i}} from ${JSON.stringify(file)};`);
    }
    const entry=join(folder,"entry.js");
    await writeFile(entry,imports.join("\n")+`\nwindow.result=[${paths.map((_,i)=>`{data:data${i},named:named${i}}`).join(",")}];`);
    async function compile(encoded:boolean){
      const result=await build({configFile:false,root:folder,publicDir:false,logLevel:"silent",plugins:encoded?[losslessJsonData([])]:[],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
      if(Array.isArray(result)||!("output"in result))throw Error("Expected one isolated build");
      const chunks=result.output.filter(x=>x.type==="chunk");expect(chunks.length).toBe(1);
      const chunk=chunks[0];if(chunk.type!=="chunk")throw Error("Missing entry");return chunk.code;
    }
    const before=await compile(false),after=await compile(true);
    const window:{result?:{data:any;named:any}[]}={};new Function("window",after)(window);
    for(let i=0;i<paths.length;i++){
      const result=window.result![i],key=fields[i];expect(result.data).toEqual(originals[i]);expect(result.data[key]).toBe(result.named);
      const held=result.data[key];expect(Object.getOwnPropertyDescriptor(result.data,key)).toEqual({value:held,writable:true,enumerable:true,configurable:true});
      held.probe={value:-0};expect(result.named.probe).toBe(held.probe);expect(Object.is(result.named.probe.value,-0)).toBe(true);
      result.data[key]={replacement:true};expect(result.named).toBe(held);
    }
    const proof={modules:paths.length,nativeMeshFields:10,uncompressedMinifiedBytes:Buffer.byteLength(before),encodedMinifiedBytes:Buffer.byteLength(after),savedBytes:Buffer.byteLength(before)-Buffer.byteLength(after)};
    console.log("V347 actual isolated Vite size proof",proof);expect(proof.savedBytes).toBeGreaterThan(5_000_000);
    if(process.env.V347_SIZE_PROOF)await writeFile(process.env.V347_SIZE_PROOF,JSON.stringify(proof,null,2)+"\n");
    await writeFile(entry,paths.map((path,i)=>`import {schemaVersion as v${i}} from ${JSON.stringify(join(folder,"src/app/src",path))};`).join("\n")+`\nwindow.result=[${paths.map((_,i)=>`v${i}`).join(",")}];`);
    const metadata=await compile(true);expect(metadata.length).toBeLessThan(300);expect(metadata).not.toContain("gunzip");
  } finally { await rm(folder,{recursive:true,force:true}); }
},60000);

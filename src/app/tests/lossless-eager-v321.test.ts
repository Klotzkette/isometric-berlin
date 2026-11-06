import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {build} from "vite";
import {minifySync} from "rolldown/experimental";
import {LOSSLESS_EAGER_FIELDS_V321 as fields,LOSSLESS_EAGER_PINS_V321 as pins,exactEagerFieldsV321,assertEagerFieldV321} from "../losslessEagerFieldsV321";
import {transformLosslessJsonData,losslessJsonData,READONLY_CONSTRUCTION_JSON_FIELDS} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";
import {decodeLosslessGzipJson as decodeBase85} from "../src/losslessGzipBase85";
import {published200SourceGraphV321} from "./helpers/sourceHistoryV321";
const namesFor=(path:string)=>fields[path]??[];
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
function exact(value:unknown):string{
 let token="\u0000isometric-json-number\u0000";while(JSON.stringify(value).includes(JSON.stringify(token).slice(1,-1)))token+="_";
 const items:[string,string][]=[];const raw=JSON.stringify(value,(_k,n)=>{if(typeof n!=="number"||Number.isFinite(n)&&!Object.is(n,-0))return n;const m=token+items.length;items.push([JSON.stringify(m),Object.is(n,-0)?"-0":n>0?"1e400":"-1e400"]);return m});
 return items.reduce((s,[m,n])=>s.replaceAll(m,n),raw);
}
function same(a:unknown,b:unknown):boolean{
 if(a===null||b===null||typeof a!=="object"||typeof b!=="object")return Object.is(a,b);
 const aa=a as Record<string,unknown>,bb=b as Record<string,unknown>;return Object.keys(aa).length===Object.keys(bb).length&&Object.keys(aa).every(k=>Object.hasOwn(bb,k)&&same(aa[k],bb[k]));
}
function evaluate(code:string){
 const script=code.replace(/^import[^\n]*\n/,"").replace(/export \{ ([^\n]*) \};/,(_m,aliases:string)=>`const named={${aliases.split(", ").filter(Boolean).map(a=>{const[v,k]=a.split(" as ");return `[${JSON.stringify(k)}]:${v}`;}).join(",")}};`).replace("export default","const data=");
 let decodes=0;const output=new Function("__decodeLosslessGzip",script+";return {data,named};")((s:string)=>{decodes++;return code.includes("losslessGzipBase85")?decodeBase85(s):decodeLosslessGzipJson(s)});return{...output,decodes};
}
test("twenty-one pinned ordinary fields retain exact values, eager strong properties, aliases and negative zero",()=>{
 expect(Object.values(fields).flat()).toHaveLength(21);let saved=0;
 const raws=[318,319,320].map(v=>readFileSync(new URL(`./fixtures/source-history-v${v}.json`,import.meta.url)));
 const graph=published200SourceGraphV321(raws[0],raws[1],raws[2]);
 for(const[path,names]of Object.entries(fields)){
  const raw=readFileSync(new URL("../src/"+path,import.meta.url),"utf8"),expected=JSON.parse(raw),code=transformLosslessJsonData(raw,"/project/src/app/src/"+path)!.code;
  expect(sha(raw)).toBe(pins[path].sourceSha256);expect(graph["src/app/src/"+path]).toBe(pins[path].sourceSha256);let literal=code;
  for(const name of names){const i=Object.keys(expected).indexOf(name),line=code.match(new RegExp(`^const __field${i} =.*;$`,"m"))?.[0];expect(line).toContain("__decodeLosslessGzip");expect(sha(exact(expected[name]))).toBe(pins[path].fields[name]);expect(READONLY_CONSTRUCTION_JSON_FIELDS[path.slice(5)]??[]).not.toContain(name);literal=literal.replace(line!,`const __field${i} = ${exact(expected[name])};`)}
  const result=evaluate(code),before=evaluate(literal);expect(same(result.data,expected)).toBeTrue();expect(same(before.data,expected)).toBeTrue();expect(result.decodes-before.decodes).toBe(names.length);
  for(const name of names){expect(Object.getOwnPropertyDescriptor(result.data,name)).toEqual({value:result.data[name],writable:true,enumerable:true,configurable:true});expect(result.named[name]).toBe(result.data[name]);const held=result.data[name];held.probe={exact:true,negativeZero:-0};expect(result.named[name].probe).toBe(held.probe);expect(Object.is(result.named[name].probe.negativeZero,-0)).toBeTrue();result.data[name]={other:true};expect(result.named[name]).toBe(held)}
  saved+=minifySync("before.js",literal,{}).code.length-minifySync("after.js",code,{}).code.length;
 }
 console.log({eagerLiteralBytesSavedV321:saved});expect(saved).toBeGreaterThan(790000);
});
test("source and field mutations, foreign fields and public paths cannot acquire the exact encoding",()=>{
 for(const[path,names]of Object.entries(fields)){const raw=readFileSync(new URL("../src/"+path,import.meta.url),"utf8");expect(()=>transformLosslessJsonData(raw+" ","/project/src/app/src/"+path)).toThrow("Changed exact v321 eager source");expect(()=>assertEagerFieldV321(path,names[0],"{}")).toThrow("Changed exact v321 eager field");expect(()=>assertEagerFieldV321(path,"other","{}")).toThrow("Changed exact v321 eager field");expect(transformLosslessJsonData(raw,"/project/src/app/public/"+path)).toBeUndefined();expect(Object.isFrozen(pins[path].fields)).toBeTrue();expect(Object.isFrozen(fields[path])).toBeTrue()}
 expect(exactEagerFieldsV321("data/foreign.json","{}")).toEqual([]);
});
test("metadata-only imports eliminate encoded values and their decoder while the catalogue stays unchanged",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"isometric-eager-v321-"));
 try{
  await mkdir(join(directory,"src/app/src/data"),{recursive:true});
  for(const path of Object.keys(fields)){
   const file=join(directory,"src/app/src",path),entry=join(directory,"entry.js"),field=Object.keys(JSON.parse(readFileSync(new URL("../src/"+path,import.meta.url),"utf8"))).find(key=>!namesFor(path).includes(key));
   await writeFile(file,readFileSync(new URL("../src/"+path,import.meta.url)));await writeFile(entry,field?`import {${field}} from ${JSON.stringify(file)};window.fixture=${field};`:`import ${JSON.stringify(file)};window.fixture=1;`);
   const result=await build({configFile:false,root:directory,publicDir:false,logLevel:"silent",plugins:[losslessJsonData([])],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
   if(Array.isArray(result)||!("output"in result))throw Error("Expected fixture output");const chunk=result.output.find(c=>c.type==="chunk"&&c.isEntry);if(!chunk||chunk.type!=="chunk")throw Error("Missing metadata entry");
   if(path==="data/neukoellnLandmarksV305Profile.json"){
    // The existing Base85 module already retains its small alphabet lookup.
    // Require exactly the same production output as the original eager literal;
    // no new decoder or scaffold may enter this metadata-only import.
    const raw=readFileSync(file,"utf8"),data=JSON.parse(raw),original=join(directory,"original.js");let literal=transformLosslessJsonData(raw,"/project/src/app/src/"+path)!.code;
    for(const name of namesFor(path)){const i=Object.keys(data).indexOf(name);literal=literal.replace(new RegExp(`^const __field${i} =.*;$`,"m"),`const __field${i} = ${exact(data[name])};`)}
    await writeFile(original,literal);await writeFile(entry,`import {${field}} from ${JSON.stringify(original)};window.fixture=${field};`);
    const before=await build({configFile:false,root:directory,publicDir:false,logLevel:"silent",plugins:[losslessJsonData([])],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
    if(Array.isArray(before)||!("output"in before))throw Error("Expected original metadata output");const oldChunk=before.output.find(c=>c.type==="chunk"&&c.isEntry);if(!oldChunk||oldChunk.type!=="chunk")throw Error("Missing original metadata entry");expect(chunk.code).toBe(oldChunk.code);
   }else expect(chunk.code.length).toBeLessThan((field?JSON.stringify(JSON.parse(readFileSync(file,"utf8"))[field]).length:1)+150);
   expect(chunk.code).not.toContain("decodeLossless");
  }
  expect(transformLosslessJsonData(readFileSync(new URL("../src/data/regierungsviertel-landmarks.json",import.meta.url),"utf8"),"/project/src/app/src/data/regierungsviertel-landmarks.json")).toBeUndefined();
 }finally{await rm(directory,{recursive:true,force:true})}
});

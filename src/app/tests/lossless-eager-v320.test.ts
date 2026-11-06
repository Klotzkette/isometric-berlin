import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {build} from "vite";
import {minifySync} from "rolldown/experimental";
import {LOSSLESS_EAGER_FIELDS_V320 as fields,LOSSLESS_EAGER_PINS_V320 as pins,exactEagerFieldsV320,assertEagerFieldV320} from "../losslessEagerFieldsV320";
import {transformLosslessJsonData,losslessJsonData,READONLY_CONSTRUCTION_JSON_FIELDS} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";
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
 let decodes=0;const output=new Function("__decodeLosslessGzip",script+";return {data,named};")((s:string)=>{decodes++;return decodeLosslessGzipJson(s)});return{...output,decodes};
}
test("seven pinned ordinary fields retain exact values, eager strong properties, aliases and negative zero",()=>{
 expect(Object.values(fields).flat()).toHaveLength(7);let saved=0;
 const checkpoint=JSON.parse(readFileSync(new URL("./fixtures/source-history-v318.json",import.meta.url),"utf8"));
 for(const[path,names]of Object.entries(fields)){
  const raw=readFileSync(new URL("../src/"+path,import.meta.url),"utf8"),expected=JSON.parse(raw),code=transformLosslessJsonData(raw,"/project/src/app/src/"+path)!.code;
  expect(sha(raw)).toBe(pins[path].sourceSha256);expect(checkpoint.currentGraph["src/app/src/"+path]).toBe(pins[path].sourceSha256);let literal=code;
  for(const name of names){const i=Object.keys(expected).indexOf(name),line=code.match(new RegExp(`^const __field${i} =.*;$`,"m"))?.[0];expect(line).toContain("__decodeLosslessGzip");expect(sha(exact(expected[name]))).toBe(pins[path].fields[name]);expect(READONLY_CONSTRUCTION_JSON_FIELDS[path.slice(5)]??[]).not.toContain(name);literal=literal.replace(line!,`const __field${i} = ${exact(expected[name])};`)}
  const result=evaluate(code),before=evaluate(literal);expect(same(result.data,expected)).toBeTrue();expect(same(before.data,expected)).toBeTrue();expect(result.decodes-before.decodes).toBe(names.length);
  for(const name of names){expect(Object.getOwnPropertyDescriptor(result.data,name)).toEqual({value:result.data[name],writable:true,enumerable:true,configurable:true});expect(result.named[name]).toBe(result.data[name]);const held=result.data[name];held.probe={exact:true};expect(result.named[name].probe).toBe(held.probe);result.data[name]={other:true};expect(result.named[name]).toBe(held)}
  saved+=minifySync("before.js",literal,{}).code.length-minifySync("after.js",code,{}).code.length;
 }
 console.log({eagerLiteralBytesSavedV320:saved});expect(saved).toBeGreaterThan(2700000);
});
test("source and field mutations, foreign fields and public paths cannot acquire the exact encoding",()=>{
 for(const[path,names]of Object.entries(fields)){const raw=readFileSync(new URL("../src/"+path,import.meta.url),"utf8");expect(()=>transformLosslessJsonData(raw+" ","/project/src/app/src/"+path)).toThrow("Changed exact v320 eager source");expect(()=>assertEagerFieldV320(path,names[0],"{}")).toThrow("Changed exact v320 eager field");expect(()=>assertEagerFieldV320(path,"other","{}")).toThrow("Changed exact v320 eager field");expect(transformLosslessJsonData(raw,"/project/src/app/public/"+path)).toBeUndefined();expect(Object.isFrozen(pins[path].fields)).toBeTrue();expect(Object.isFrozen(fields[path])).toBeTrue()}
 expect(exactEagerFieldsV320("data/foreign.json","{}")).toEqual([]);
});
test("metadata-only imports eliminate encoded values and their decoder while the catalogue stays unchanged",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"isometric-eager-v320-"));
 try{
  await mkdir(join(directory,"src/app/src/data"),{recursive:true});
  for(const path of Object.keys(fields)){
   const file=join(directory,"src/app/src",path),entry=join(directory,"entry.js"),field=path.endsWith("Streets.json")?"elevated_path_ids":"schemaVersion";
   await writeFile(file,readFileSync(new URL("../src/"+path,import.meta.url)));await writeFile(entry,`import {${field}} from ${JSON.stringify(file)};window.fixture=${field};`);
   const result=await build({configFile:false,root:directory,publicDir:false,logLevel:"silent",plugins:[losslessJsonData([])],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
   if(Array.isArray(result)||!("output"in result))throw Error("Expected fixture output");const chunk=result.output.find(c=>c.type==="chunk"&&c.isEntry);if(!chunk||chunk.type!=="chunk")throw Error("Missing metadata entry");expect(chunk.code.length).toBeLessThan(JSON.stringify(JSON.parse(readFileSync(file,"utf8"))[field]).length+150);expect(chunk.code).not.toContain("decodeLossless");
  }
  expect(transformLosslessJsonData(readFileSync(new URL("../src/data/regierungsviertel-landmarks.json",import.meta.url),"utf8"),"/project/src/app/src/data/regierungsviertel-landmarks.json")).toBeUndefined();
 }finally{await rm(directory,{recursive:true,force:true})}
});

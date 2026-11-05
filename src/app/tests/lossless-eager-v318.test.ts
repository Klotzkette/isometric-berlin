import {expect,test} from "bun:test";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {minifySync} from "rolldown/experimental";
import {LOSSLESS_EAGER_FIELDS_V318 as fields} from "../losslessEagerFieldsV318";
import {transformLosslessJsonData,READONLY_CONSTRUCTION_JSON_FIELDS} from "../losslessJsonData";
import {decodeLosslessGzipJson} from "../src/losslessGzipJson";
const pins={"data/courtsParkV293.json":"11084487f0d7ff4004a0926d131f4b431753198d46630333795f599e19b1d9d5","data/legacyFittingsV304.json":"869b90b422afedea30f1639643364b38cb851e199f0f193d08e77f937acf9de2","data/chancelleryCanopyLegacyV289.json":"26db44ba616ac4f37ad05fd1944a287afde9974e457b5f990446a6c3b665d811"};
function evaluate(source:string,path:string){
 const result=transformLosslessJsonData(source,"/project/src/app/src/"+path)!;
 expect(result).toBeDefined();
 const script=result.code.replace(/^import[^\n]*\n/,"").replace(/export \{ ([^\n]*) \};/,(_m,aliases:string)=>`const named={${aliases.split(", ").filter(Boolean).map(alias=>{const[v,k]=alias.split(" as ");return `[${JSON.stringify(k)}]:${v}`;}).join(",")}};`).replace("export default","const data=");
 let decodes=0;const output=new Function("__decodeLosslessGzip",script+";return {data,named};")((value:string)=>{decodes++;return decodeLosslessGzipJson(value)});
 return {...output,decodes,code:result.code};
}
test("six finite literals retain all published197 source bytes and ordinary eager/strong identities",()=>{
 expect(Object.values(fields).flat()).toHaveLength(6);let saved=0;
 for(const[path,names]of Object.entries(fields)){
  const source=readFileSync(new URL("../src/"+path,import.meta.url),"utf8"),expected=JSON.parse(source),result=evaluate(source,path);
  if(path in pins)expect(createHash("sha256").update(source).digest("hex")).toBe(pins[path as keyof typeof pins]);
  expect(result.data).toEqual(expected);expect(JSON.stringify(result.data)).toBe(JSON.stringify(expected));expect(Object.getOwnPropertyDescriptors(result.data)).toEqual(Object.getOwnPropertyDescriptors(expected));expect(result.decodes).toBe(names.length);
  expect(result.code).not.toContain("WeakRef");expect(result.code).not.toContain("get [");
  for(const key of names){expect(READONLY_CONSTRUCTION_JSON_FIELDS[path.slice(5)]??[]).not.toContain(key);expect(result.named[key]).toBe(result.data[key]);const held=result.data[key];held.exactMutation={same:true};expect(result.named[key].exactMutation).toBe(held.exactMutation);result.data[key]={other:true};expect(result.named[key]).toBe(held);}
  saved+=minifySync("before.js","export const value="+source+";",{}).code.length-minifySync("after.js",result.code,{}).code.length;
 }
 console.log({finiteEagerLiteralBytesSaved:saved});expect(saved).toBeGreaterThan(120000);
});
test("finite new eager paths preserve negative zero and do not expand into unknown paths",()=>{
 for(const[path,names]of Object.entries(fields))for(const key of names){const source=`{${JSON.stringify(key)}:[${Array(2000).fill("[-0,1e400,5e-324,{\"__proto__\":{\"own\":true}}]").join(",")}]}`;const result=evaluate(source,path);expect(Object.is(result.data[key][0][0],-0)).toBe(true);expect(result.data[key][0][1]).toBe(Infinity);expect(Object.hasOwn(result.data[key][0][3],"__proto__")).toBe(true);expect(result.named[key]).toBe(result.data[key]);expect(transformLosslessJsonData(source,"/project/src/app/public/"+path)).toBeUndefined();}
});

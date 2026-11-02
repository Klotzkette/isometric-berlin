import { expect, test } from "bun:test";
import { transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";

test("finite tile getters inflate only the requested plan and release read-only construction ownership",()=>{
  const input={schemaVersion:1,packets:{"minecraft:b":{rows:Array(4000).fill([4,5,6])},"drawn:a":{rows:Array(4000).fill([1,2,3]),name:"ä"}},keys:["drawn:a","minecraft:b"],counts:{value:2}};
  const compiled=transformLosslessJsonData(JSON.stringify(input),"/repo/src/app/src/data/ostHousingV301.json",4)!;
  const code=compiled.code.replace(/^import[^\n]+\n/,"").replace(/export \{[^\n]+\};/,"").replace("export default __source;","return __source;");
  const weak:{value:unknown}[]=[];let decoded=0;
  class Weak { value:unknown;constructor(value:unknown){this.value=value;weak.push(this);}deref(){return this.value;} }
  const source=new Function("__decodeLosslessGzip","WeakRef",code)((s:string)=>{decoded++;return decodeLosslessGzipJson(s);},Weak);
  expect(decoded).toBe(0);expect(source.keys).toEqual(input.keys);expect(Object.keys(source)).toEqual(Object.keys(input));expect(Object.keys(source.packets)).toEqual(Object.keys(input.packets));expect(decoded).toBe(0);
  const first=source.packets["drawn:a"];expect(first).toEqual(input.packets["drawn:a"]);expect(decoded).toBe(1);expect(source.packets["drawn:a"]).toBe(first);
  weak[0].value=undefined;expect(source.packets["drawn:a"]).toEqual(first);expect(decoded).toBe(2);
  expect(source.packets["minecraft:b"]).toEqual(input.packets["minecraft:b"]);expect(decoded).toBe(3);
  const replacement={owned:true};source.packets["drawn:a"]=replacement;for(const ref of weak)ref.value=undefined;
  expect(source.packets["drawn:a"]).toBe(replacement);expect(decoded).toBe(3);
  expect(Object.getOwnPropertyDescriptor(source,"keys")?.value).toBe(source.keys);
  expect(Object.getOwnPropertyDescriptor(source,"packets")?.value).toBe(source.packets);
  expect(transformLosslessJsonData(JSON.stringify(input),"/repo/src/app/src/data/unknownNeighbourhood.json",4)?.code.includes("Object.defineProperty(__packets")).toBeFalse();
});

test("the finite plan index rejects mismatched, duplicate and unsafe tile keys",()=>{
  for(const data of [
    {schemaVersion:1,keys:["drawn:a"],packets:{}},
    {schemaVersion:1,keys:["drawn:a","drawn:a"],packets:{"drawn:a":{a:1}}},
    {schemaVersion:1,keys:["__proto__"],packets:JSON.parse('{"__proto__":{}}')},
  ]) expect(()=>transformLosslessJsonData(JSON.stringify(data),"/repo/src/app/src/data/westKiezV302.json",4)).toThrow();
});

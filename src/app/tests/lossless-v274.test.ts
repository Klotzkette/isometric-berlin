import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transformLosslessJsonData } from "../losslessJsonData";
import { decodeLosslessGzipJson } from "../src/losslessGzipBase85";
import { LOSSLESS_EAGER_FIELDS_V274 } from "../losslessEagerFieldsV274";
const names = ["operaTheatresV274.json", "operaTheatresV274Navigation.json", "operaTheatresV274Ownership.json", "schoolsCourtsV274.json", "schoolsCourtsV274Navigation.json", "centralTheatresV274.json", "northCultureV274Source.json", "augustFrontsV274.json"];
test("new architectural sources compress without changing values or navigation ownership", () => {
  let before=0, after=0;
  for(const name of names){
    const path=fileURLToPath(new URL("../src/data/"+name,import.meta.url));
    const text=readFileSync(path,"utf8"), result=transformLosslessJsonData(text,path)!;
    expect(result).toBeDefined();
    const code=result.code.replace(/^import[^\n]+;\n/,"").replace(/export \{[^\n]+\};/,"").replace("export default","return");
    const data=new Function("__decodeLosslessGzip",code)(decodeLosslessGzipJson);
    expect(data,name).toEqual(JSON.parse(text));
    for(const key of LOSSLESS_EAGER_FIELDS_V274["data/"+name]??[]){
      expect(Object.getOwnPropertyDescriptor(data,key)?.get,name+":"+key).toBeUndefined();
      expect(data[key]).toBe(data[key]);
    }
    if(name==="schoolsCourtsV274.json"||name==="centralTheatresV274.json"||name==="augustFrontsV274.json") expect(result.code).toContain("new WeakRef(value)");
    before+=text.length;after+=result.code.length;
  }
  expect(after).toBeLessThan(before*.35);
});

import {expect,test} from "bun:test";
import {readFile,mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {build} from "vite";
import {losslessJsonData} from "../losslessJsonData";
import {exactEagerFieldsV325,assertEagerFieldV325} from "../losslessEagerFieldsV325";

for(const name of ["wilhelmHousingV324Sources.json","wilhelmStreetFrontsV325Sources.json"]){
const input=new URL("../src/data/"+name,import.meta.url);
test(name+": finite voxel object preserves full eager strong descriptors and aliases",async()=>{
  const source=await readFile(input,"utf8"),original=JSON.parse(source);
  const folder=await mkdtemp(join(tmpdir(),"wilhelm-eager-v325-"));
  try{
    const dataFolder=join(folder,"src/app/src/data");await mkdir(dataFolder,{recursive:true});
    const file=join(dataFolder,name);await writeFile(file,source);
    const entry=join(folder,"entry.js");await writeFile(entry,`import d,{nativeVoxels} from ${JSON.stringify(file)};window.result={d,nativeVoxels};`);
    async function compile(encoded:boolean){const result=await build({root:folder,configFile:false,publicDir:false,logLevel:"silent",plugins:encoded?[losslessJsonData()]:[],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
      if(Array.isArray(result)||!("output"in result))throw Error("One build required");
      const chunk=result.output.find(x=>x.type==="chunk"&&x.isEntry);if(!chunk||chunk.type!=="chunk")throw Error("Missing entry");return chunk.code;}
    const before=await compile(false),after=await compile(true),window:{result?:{d:any;nativeVoxels:any}}={};
    new Function("window",after)(window);const result=window.result!;
    expect(result.d).toEqual(original);expect(result.d.nativeVoxels).toBe(result.nativeVoxels);
    const descriptor=Object.getOwnPropertyDescriptor(result.d,"nativeVoxels")!;
    expect("value"in descriptor).toBeTrue();expect(descriptor).toMatchObject({writable:true,enumerable:true,configurable:true});
    const field=result.d.nativeVoxels;expect(result.d.nativeVoxels).toBe(field);
    field.cells[0].x+=1;expect(result.d.nativeVoxels.cells[0].x).toBe(original.nativeVoxels.cells[0].x+1);
    expect(after.length).toBeLessThan(before.length-75000);
    expect(exactEagerFieldsV325("data/"+name,source)).toEqual(["nativeVoxels"]);
    expect(()=>assertEagerFieldV325("data/"+name,"nativeVoxels",JSON.stringify(original.nativeVoxels))).not.toThrow();
  }finally{await rm(folder,{recursive:true,force:true});}
},30000);

test("the compact source offset cannot expand to an unreviewed source or field",async()=>{
  const source=await readFile(input,"utf8");
  expect(exactEagerFieldsV325("data/other.json",source)).toEqual([]);
  expect(()=>exactEagerFieldsV325("data/"+name,source+" ")).toThrow();
  expect(()=>assertEagerFieldV325("data/"+name,"nativeVoxels","{}")).toThrow();
  expect(()=>assertEagerFieldV325("data/"+name,"prisms","{}")).toThrow();
});

}

test("new exact run metadata saves source bytes with all negative zero words intact",async()=>{
  const source=await readFile(new URL("../src/data/wilhelmStreetFrontsV325.json",import.meta.url),"utf8");
  const original=JSON.parse(source).runs;
  const folder=await mkdtemp(join(tmpdir(),"wilhelm-runs-v325-"));
  try{
    const dataFolder=join(folder,"src/app/src/data");await mkdir(dataFolder,{recursive:true});
    const file=join(dataFolder,"wilhelmStreetFrontsV325.json");await writeFile(file,source);
    const entry=join(folder,"entry.js");await writeFile(entry,`import {runs} from ${JSON.stringify(file)};window.result=runs;`);
    async function compile(encoded:boolean){
      const result=await build({root:folder,configFile:false,publicDir:false,logLevel:"silent",plugins:encoded?[losslessJsonData()]:[],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
      if(Array.isArray(result)||!("output"in result))throw Error("One build required");
      const chunk=result.output.find(x=>x.type==="chunk"&&x.isEntry);if(!chunk||chunk.type!=="chunk")throw Error("Missing entry");return chunk.code;
    }
    const before=await compile(false),after=await compile(true),window:{result?:any}={};
    new Function("window",after)(window);
    expect(window.result).toEqual(original);expect(after.length).toBeLessThan(before.length-50000);
    let negativeZeros=0;
    function check(actual:any,expected:any):void{
      if(expected&&typeof expected==="object"){
        expect(Reflect.ownKeys(actual)).toEqual(Reflect.ownKeys(expected));
        for(const key of Object.keys(expected))check(actual[key],expected[key]);
      }else if(Object.is(expected,-0)){expect(Object.is(actual,-0)).toBeTrue();negativeZeros++;}
    }
    check(window.result,original);expect(negativeZeros).toBe(2);
    expect(exactEagerFieldsV325("data/wilhelmStreetFrontsV325.json",source)).toEqual(["runs"]);
  }finally{await rm(folder,{recursive:true,force:true});}
},30000);

test("one exact Native-only packed field preserves full strings, strong identity and metadata elimination",async()=>{
  const name="data/altMitteV169Native/packet-062.json";
  const source=await readFile(new URL("../src/"+name,import.meta.url),"utf8"),original=JSON.parse(source);
  const folder=await mkdtemp(join(tmpdir(),"wilhelm-native-offset-v325-"));
  try{
    const dataFolder=join(folder,"src/app/src/data/altMitteV169Native");await mkdir(dataFolder,{recursive:true});
    const file=join(dataFolder,"packet-062.json");await writeFile(file,source);
    const entry=join(folder,"entry.js");
    async function compile(text:string,encoded:boolean){
      await writeFile(entry,text);
      const result=await build({root:folder,configFile:false,publicDir:false,logLevel:"silent",plugins:encoded?[losslessJsonData()]:[],build:{write:false,minify:true,rolldownOptions:{input:entry}}});
      if(Array.isArray(result)||!("output"in result))throw Error("One build required");
      const chunk=result.output.find(x=>x.type==="chunk"&&x.isEntry);if(!chunk||chunk.type!=="chunk")throw Error("Missing entry");return chunk.code;
    }
    const text=`import d,{meshes} from ${JSON.stringify(file)};window.result={d,meshes};`;
    const before=await compile(text,false),after=await compile(text,true),window:{result?:any}={};
    new Function("window",after)(window);const result=window.result;
    expect(result.d).toEqual(original);expect(result.d.meshes).toBe(result.meshes);
    expect(after.length).toBeLessThan(before.length-400000);
    expect(Object.getOwnPropertyDescriptor(result.d,"meshes")).toMatchObject({value:result.meshes,writable:true,enumerable:true,configurable:true});
    expect(Object.getPrototypeOf(result.meshes)).toBe(Array.prototype);
    const held=result.d.meshes;expect(result.d.meshes).toBe(held);
    held[0].kind+="-mutation";expect(result.d.meshes[0].kind).toBe(original.meshes[0].kind+"-mutation");
    const metadata=await compile(`import {schemaVersion,id,origin} from ${JSON.stringify(file)};window.result={schemaVersion,id,origin};`,true);
    expect(metadata.length).toBeLessThan(500);expect(metadata).not.toContain("WeakRef");expect(metadata).not.toContain("JSON.parse");
    expect(exactEagerFieldsV325(name,source)).toEqual(["meshes"]);
    expect(()=>exactEagerFieldsV325(name,source+" ")).toThrow();
    expect(()=>assertEagerFieldV325(name,"meshes",JSON.stringify(original.meshes))).not.toThrow();
  }finally{await rm(folder,{recursive:true,force:true});}
},30000);

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/greyClusterColoursV263.json";
import { applyGreyClusterColoursV263, type GreyClusterColourSourceV263 } from "../src/greyClusterColoursV263";
import { outerHousePaletteV262 } from "../src/outerHousePaletteV262";
import { applyOuterMaterialsV232 } from "../src/outerMaterialsV232";
import { applyOuterMaterialsV254 } from "../src/outerMaterialsV254";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
function finish<T>(it: Generator<void,T>): T { let s=it.next(); while(!s.done)s=it.next(); return s.value; }
function packet(key:string):SurroundingCityChunk {
  const [mode,id]=key.split(":"); return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
}
function vertices(p:SurroundingPackedMesh):Uint16Array {
  const position=Buffer.from(p.positions,"base64"), colour=Buffer.from(p.colors,"base64"), out=new Uint16Array(position.length);
  for(let i=0;i<position.length/6;i++)for(let j=0;j<3;j++){out[i*6+j]=position.readUInt16LE(i*6+j*2);out[i*6+3+j]=colour[i*3+j]*257;}
  return out;
}
test("unrelated tiles and non-city meshes never read the packed receipt getter",()=>{
  expect(data.keys).toEqual(Object.keys(data.packets));
  const key=data.keys[0], [mode,id]=key.split(":"), p=packet(key);
  let reads=0;
  const evidence:GreyClusterColourSourceV263={schemaVersion:1,keys:data.keys,get packets(){reads++;throw Error("Unrelated receipt decode");}};
  const buffer=new Uint16Array(0), native=mode==="minecraft";
  expect(finish(applyGreyClusterColoursV263(p,"unrelated",native,0,buffer,0,0,evidence))).toBe(0);
  expect(finish(applyGreyClusterColoursV263(p,id,native,999,buffer,0,0,evidence))).toBe(0);
  const authored={...p,meshes:[{...p.meshes[0],kind:"authored"}]};
  expect(finish(applyGreyClusterColoursV263(authored,id,native,0,buffer,0,0,evidence))).toBe(0);
  expect(reads).toBe(0);
});
test("all eighteen source receipts change only exact colour cells using the retained palette and native flat style",()=>{
  const totals={drawn:0,minecraft:0};
  for(const [key,plan] of Object.entries(data.packets)){
    const [mode,id]=key.split(":"), native=mode==="minecraft", p=packet(key), before=JSON.stringify(p);
    for(const record of plan.records){
      const part=p.meshes[record.mesh], values=vertices(part), original=values.slice(), count=values.length/6;
      expect(finish(applyGreyClusterColoursV263(p,id,native,record.mesh,values,0,count))).toBe(record.rows.length);
      const expected=original.slice();
      for(const [vertex,owner,role,low,high] of record.rows){
        const palette=outerHousePaletteV262(record.owners[owner]), colour=role?palette.roof:palette.wall;
        const wash=!native&&!role&&low>=0&&high>low ? .88+.13*Math.max(0,Math.min(1,(values[vertex*6+1]-low)/(high-low))):1;
        for(let j=0;j<3;j++)expected[vertex*6+3+j]=Math.min(255,Math.round(colour[j]*wash))*257;
      }
      expect(values).toEqual(expected);
      expect(finish(applyGreyClusterColoursV263(p,id,native,record.mesh,values,0,count))).toBe(record.rows.length);
      expect(values).toEqual(expected);
      totals[mode as keyof typeof totals]+=record.rows.length;
      // Both source-material passes still write after this fallback pass.
      const baseline=original.slice(), refined=values.slice();
      for(const apply of [applyOuterMaterialsV232,applyOuterMaterialsV254]){
        finish(apply(id,native,part,record.mesh,baseline,0,count));
        finish(apply(id,native,part,record.mesh,refined,0,count));
      }
      for(let i=3;i<values.length;i+=6)for(let j=0;j<3;j++)if(baseline[i+j]!==original[i+j]&&refined[i+j]!==baseline[i+j])throw Error(`Material priority lost ${key}:${i}`);
    }
    expect(JSON.stringify(p)).toBe(before);
  }
  expect(totals).toEqual({drawn:6924,minecraft:11504});
});
test("changed source, navigation, origin, wrong family and authored kind fail closed before writing",()=>{
  const key=Object.keys(data.packets)[0], [mode,id]=key.split(":"), native=mode==="minecraft", p=packet(key), values=vertices(p.meshes[0]), original=values.slice();
  const changes: Array<(p:SurroundingCityChunk)=>void>=[(p:SurroundingCityChunk)=>p.origin[0]++, (p:SurroundingCityChunk)=>p.nav.buildings[0].height++, (p:SurroundingCityChunk)=>p.meshes[0].kind="authored"];
  for(const field of ["positions","colors","indices"] as const)changes.push(p=>{p.meshes[0][field]=(p.meshes[0][field][0]==="A"?"B":"A")+p.meshes[0][field].slice(1);});
  for(const change of changes){const p2=structuredClone(p);change(p2);expect(finish(applyGreyClusterColoursV263(p2,id,native,0,values,0,values.length/6))).toBe(0);expect(values).toEqual(original);}
  expect(finish(applyGreyClusterColoursV263(p,id,!native,0,values,0,values.length/6))).toBe(0);
  expect(finish(applyGreyClusterColoursV263(p,"unrelated",native,0,values,0,values.length/6))).toBe(0);
  const bad=structuredClone(data) as GreyClusterColourSourceV263;bad.packets[key].records[0].rows.at(-1)![0]=values.length;
  expect(()=>finish(applyGreyClusterColoursV263(p,id,native,0,values,0,values.length/6,bad))).toThrow();expect(values).toEqual(original);
});

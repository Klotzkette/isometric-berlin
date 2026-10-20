import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../src/data/westShopfrontsV254.json";
import { prepareWestShopfrontsV254, type WestShopfrontSourceV254 } from "../src/westShopfrontsV254";
import { prepareBoulevardArchitectureV235 } from "../src/boulevardArchitectureV235";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
function finish<T>(work: Generator<void,T>): T { let r=work.next();while(!r.done)r=work.next();return r.value; }
function original(key:string): SurroundingCityChunk {
  const [mode,id]=key.split(":");
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${id}.${mode}.json.gz`,import.meta.url))).toString());
}
function u16(s:string): number[] { const b=Buffer.from(s,"base64");return Array.from({length:b.length/2},(_,i)=>b.readUInt16LE(i*2)); }

test("every shopfront binds an existing packet and preserves all source and v235 geometry",()=>{
  let drawn=0,native=0,maxVertices=0,maxIndices=0;
  for(const [key,plan] of Object.entries(data.packets)){
    const [mode,id]=key.split(":"),isNative=mode==="minecraft",before=original(key);
    const previous=finish(prepareBoulevardArchitectureV235(before,id,isNative)),snapshot=JSON.stringify(previous);
    const result=finish(prepareWestShopfrontsV254(previous,id,isNative));
    expect(result).not.toBe(previous);expect(result.nav).toBe(previous.nav);expect(result.lines).toBe(previous.lines);
    expect(result.meshes.length).toBe(previous.meshes.length+1);
    for(let i=0;i<previous.meshes.length;i++)expect(result.meshes[i]).toBe(previous.meshes[i]);
    const part=result.meshes.at(-1)!,xyz=u16(part.positions);
    expect(xyz.length/3).toBe(plan.fields.reduce((n,p)=>n+(p[9]===1?32:48),0));
    if(isNative){
      native+=plan.fields.length;
      for(let at=0;at<xyz.length;at+=12){
        expect([0,1,2].some(axis=>[1,2,3].every(i=>xyz[at+axis]===xyz[at+i*3+axis]))).toBe(true);
      }
    }else drawn+=plan.fields.length;
    maxVertices=Math.max(maxVertices,result.meshes.reduce((n,p)=>n+Buffer.from(p.positions,"base64").length/6,0));
    maxIndices=Math.max(maxIndices,result.meshes.reduce((n,p)=>n+Buffer.from(p.indices,"base64").length/4,0));
    expect(result.meshes.length).toBeLessThanOrEqual(16);
    expect(JSON.stringify(previous)).toBe(snapshot);
    expect(finish(prepareWestShopfrontsV254(result,id,isNative))).toBe(result);
    // All details stay inside their old opening rather than adding a new row.
    let at=0;
    for(const field of plan.fields){
      const count=field[9]===1?32:48;
      for(let i=0;i<count;i++,at+=3){
        const dx=xyz[at]/100-field[0],dy=xyz[at+1]/100-field[1],dz=xyz[at+2]/100-field[2];
        expect(Math.abs(dx*field[3]+dz*field[4])).toBeLessThan(field[7]/2+.01);
        expect(Math.abs(dy)).toBeLessThan(field[8]/2+.01);
        expect(dx*field[5]+dz*field[6]).toBeGreaterThan(.055);
        expect(dx*field[5]+dz*field[6]).toBeLessThan(.105);
      }
    }
  }
  expect(drawn).toBeGreaterThan(1700);expect(native).toBeGreaterThan(2700);
  expect(maxVertices).toBeLessThan(400000);expect(maxIndices).toBeLessThan(2400000);
});

test("source corruption, invalid recipes and cancellation leave the original untouched",()=>{
  const key=data.ids[0],[mode,id]=key.split(":"),before=original(key);
  const plan=data.packets[key as keyof typeof data.packets];
  for(const field of ["positions","colors","indices"] as const){
    const changed=structuredClone(before),part=changed.meshes[plan.guards[0].mesh];
    part[field]=(part[field][0]==="A"?"B":"A")+part[field].slice(1);
    expect(finish(prepareWestShopfrontsV254(changed,id,mode==="minecraft"))).toBe(changed);
  }
  const moved={...before,origin:[before.origin[0]+1,before.origin[1],before.origin[2]] as [number,number,number]};
  expect(finish(prepareWestShopfrontsV254(moved,id,mode==="minecraft"))).toBe(moved);
  const invalid=structuredClone(data) as WestShopfrontSourceV254;invalid.packets[key].fields[0][7]=-1;
  expect(finish(prepareWestShopfrontsV254(before,id,mode==="minecraft",invalid))).toBe(before);
  const snapshot=JSON.stringify(before),task=prepareWestShopfrontsV254(before,id,mode==="minecraft");
  expect(task.next().done).toBe(false);task.return(before);expect(JSON.stringify(before)).toBe(snapshot);
  expect(finish(prepareWestShopfrontsV254(before,"unrelated"))).toBe(before);
});

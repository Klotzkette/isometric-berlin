import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {Group,Mesh,Raycaster,Vector3} from 'three';
import {prepareTempelhoferFieldV345,tempelhoferFieldGroundAtV345,bindTempelhoferFieldV345} from '../src/TempelhoferFieldV345';
import {createSurroundingCityChunk,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {disposeSurroundingCityRoot} from '../src/disposeSurroundingCityRootV323';
import data from '../src/data/tempelhoferFieldV345.json';
const finish=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const raw=(native=false):SurroundingCityChunk=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/ring182-2_9.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString());
test('complete receipts retain originals and fail closed on altered input',()=>{
 for(const native of [false,true]){const p=raw(native),snapshot=JSON.stringify(p),n=finish(prepareTempelhoferFieldV345(p,data.id,native));expect(n).not.toBe(p);expect(n.meshes[0]).toBe(p.meshes[0]);expect(n.nav).toBe(p.nav);expect(n.lines).toBe(p.lines);expect(JSON.stringify(p)).toBe(snapshot);expect(finish(prepareTempelhoferFieldV345(n,data.id,native))).toBe(n);
  for(const change of [(p:SurroundingCityChunk)=>{p.origin[0]++;},(p:SurroundingCityChunk)=>{p.nav.groundY++;},(p:SurroundingCityChunk)=>{p.meshes[0].colors='AAAA'+p.meshes[0].colors.slice(4);},(p:SurroundingCityChunk)=>{p.meshes.push(p.meshes[0]);}]){const bad=raw(native);change(bad);expect(finish(prepareTempelhoferFieldV345(bad,data.id,native))).toBe(bad);const root=new Group();bindTempelhoferFieldV345(root,bad,native);expect(tempelhoferFieldGroundAtV345(root,1250,4900)).toBeNull();}
 }
});
test('actual production decoder and walking agree over the original grass footprint',()=>{
 let checks=0,maxError=0;
 for(const native of [false,true]){const p=raw(native),snapshot=JSON.stringify(p),out=createSurroundingCityChunk(p,data.id,native);
  try{out.root.updateMatrixWorld(true);expect(JSON.stringify(p)).toBe(snapshot);expect(out.geometryBytes).toBeLessThan(700_000);
   for(let i=0;i<data.runs.length;i+=Math.max(1,Math.floor(data.runs.length/36))){const [z,left,right]=data.runs[i];for(const x of [left+2,(left+right)/2,right-2]){
    const zz=z+1.3,xx=x+.31;const y=tempelhoferFieldGroundAtV345(out.root,xx,zz);if(y===null)continue;
    const hits=new Raycaster(new Vector3(xx,50,zz),new Vector3(0,-1,0)).intersectObject(out.root,true).filter(h=>h.object instanceof Mesh);
    expect(hits.length).toBeGreaterThan(0);const error=Math.abs(hits[0].point.y-y);maxError=Math.max(maxError,error);expect(error).toBeLessThan(.021);checks++;
   }}
   expect(tempelhoferFieldGroundAtV345(out.root,1000,4900)).toBeNull();expect(tempelhoferFieldGroundAtV345(out.root,NaN,4900)).toBeNull();
  }finally{disposeSurroundingCityRoot(out.root);}
 }
 expect(checks).toBeGreaterThan(100);console.log({feldSamples:checks,maxErrorM:maxError});
},30000);

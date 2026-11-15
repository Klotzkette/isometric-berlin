import {describe,expect,it} from 'bun:test';
import {gzipSync} from 'node:zlib';
import {facilityPathMeshV350,facilityPathSourceV350} from '../src/FacilityPathsV350';

const sheets:any[]=[['r',1002,12,34,56,[[[0,0,400,0,0,400,-400,0],[100,100,0,200,200,0,0,-200]]]]];
function fixture(){
 const plan={origin:[0,-10,0],records:[],navGuard:1,lineGuard:null,preparedNavGuard:1,preparedLineGuard:null,retire:[],owners:['way/1'],sheets};
 const text=JSON.stringify({packets:{'drawn:test':plan}});
 return{schemaVersion:1 as const,keys:['drawn:test'],decodedBytes:Buffer.byteLength(text),compressed:new Uint8Array(gzipSync(text))};
}
describe('facility path compact surfaces',()=>{
 it('retains the exact hole and every boundary height/material',()=>{
  const mesh=facilityPathMeshV350(sheets);
  const bytes=Buffer.from(mesh.positions,'base64'),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const raw=Buffer.from(mesh.indices,'base64'),indices=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  let area=0;
  for(let at=0;at<raw.length;at+=12){
   const triangle=[0,4,8].map(offset=>{const n=indices.getUint32(at+offset,true)*6;expect(v.getUint16(n+2,true)).toBe(1002);return[v.getUint16(n,true),v.getUint16(n+4,true)];});
   const [a,b,c]=triangle;area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
   const x=(a[0]+b[0]+c[0])/3,z=(a[1]+b[1]+c[1])/3;expect(x>100&&x<300&&z>100&&z<300).toBe(false);
  }
  expect(area).toBe(120000);
 });
 it('a live plan retains its lazy mesh across a collection/yield',async()=>{
  const source=facilityPathSourceV350(fixture()),plan=source.packets['drawn:test'],original=new WeakRef(plan.append);
  await new Promise(resolve=>setTimeout(resolve,0));Bun.gc(true);
  expect(original.deref()).toBeDefined();expect(plan.append).toBe(original.deref());expect(plan.appendFingerprint).toBe(source.packets['drawn:test'].appendFingerprint);
 });
 it('rejects changed compressed length and unbounded coordinates',()=>{
  const wire=fixture();wire.decodedBytes++;
  expect(()=>facilityPathSourceV350(wire).packets['drawn:test']).toThrow('size changed');
  expect(()=>facilityPathMeshV350([['b',1002,12,34,56,[0,0,70000,50]]])).toThrow();
 });
});

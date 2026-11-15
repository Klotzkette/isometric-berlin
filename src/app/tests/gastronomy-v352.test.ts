import { expect, test } from 'bun:test';
import { gastronomySignMeshV352, gastronomySourceV352, GASTRONOMY_KIND_V352, type GastronomyCompactSourceV352, type GastronomySignV352 } from '../src/GastronomyV352';
import { captureNeighbourhoodPacketV300 } from '../src/NeighbourhoodPacketV300';
import { surroundingPacketFingerprint } from '../src/surroundingPacketFingerprint';
import { drain, mcdonaldsSignClearV351, supportMeshesV350 } from '../scripts/mcdonalds-support-v351';
import type { SurroundingCityChunk, SurroundingPackedMesh } from '../src/SurroundingCityGeometry';
const encode=(a:Uint8Array)=>btoa(String.fromCharCode(...a));
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
function wall(x=100,y0=0,y1=400,z0=100,z1=1000):SurroundingPackedMesh{
 const p=new Uint16Array([x,y0,z0,x,y0,z1,x,y1,z1,x,y1,z0]);
 return{kind:'city',positionType:'u16cm',positions:encode(new Uint8Array(p.buffer)),colors:encode(new Uint8Array(12).fill(100)),indices:encode(new Uint8Array(new Uint32Array([0,1,2,0,2,3]).buffer))};
}
const plate:GastronomySignV352=[100,210,550,0,1000000,1000000,0,280,70,0];
const raw=()=>({schemaVersion:1,origin:[0,0,0],meshes:[wall()],nav:{groundY:0,buildings:[]}} as unknown as SurroundingCityChunk);
function compact(p:SurroundingCityChunk):GastronomyCompactSourceV352{
 return{schemaVersion:1,keys:['drawn:test'],packets:{'drawn:test':{origin:p.origin,navGuard:hash(JSON.stringify(p.nav)),lineGuard:null,records:p.meshes.map((m,i)=>({mesh:i,kind:m.kind,fingerprint:drain(surroundingPacketFingerprint(m))})),owners:['verified-owner'],retire:[],plates:[plate],facilityIds:['school:test']}}};
}
test('compact typography is finite, texture-free and independently native cardinal',()=>{
 const drawn=gastronomySignMeshV352([plate]);
 expect(drawn.positionType).toBe('u16cm');expect(atob(drawn.positions).length%6).toBe(0);
 expect(atob(drawn.colors).length).toBe(atob(drawn.positions).length/2);
 expect(gastronomySignMeshV352([plate],true)).toEqual(drawn); // Same cardinal support can yield identical sign geometry.
 for(const normal of [1000000,-1000000]){
  const oriented=plate.slice() as GastronomySignV352;oriented[5]=normal;
  const mesh=gastronomySignMeshV352([oriented]);
  const vertices=new Uint16Array(Uint8Array.from(atob(mesh.positions),c=>c.charCodeAt(0)).buffer),indices=new Uint32Array(Uint8Array.from(atob(mesh.indices),c=>c.charCodeAt(0)).buffer);
  const [a,b,c]=[indices[0]*3,indices[1]*3,indices[2]*3];
  const normalX=(vertices[b+1]-vertices[a+1])*(vertices[c+2]-vertices[a+2])-(vertices[b+2]-vertices[a+2])*(vertices[c+1]-vertices[a+1]);
  expect(normalX*normal).toBeGreaterThan(0);
 }
 expect(()=>gastronomySignMeshV352([[...plate.slice(0,3),707107,707107,-707107,707107,...plate.slice(7)] as GastronomySignV352],true)).toThrow();
 expect(()=>gastronomySignMeshV352(Array(65).fill(plate))).toThrow();
 const malformed=plate.slice() as GastronomySignV352;malformed[0]=NaN;expect(()=>gastronomySignMeshV352([malformed])).toThrow();
});
test('a full 70cm sign needs all retained wall samples and may not cover an older fitting',()=>{
 const p=raw();expect(mcdonaldsSignClearV351(supportMeshesV350(p),plate)).toBeTrue();
 p.meshes.push(wall(106,180,230,450,650));expect(mcdonaldsSignClearV351(supportMeshesV350(p),plate)).toBeFalse();
 const noWall=raw();noWall.meshes=[];expect(mcdonaldsSignClearV351(supportMeshesV350(noWall),plate)).toBeFalse();
});
test('exact raw/nav guards append only, preserve the old body, and refuse another host',()=>{
 const p=raw(),source=gastronomySourceV352(compact(p));
 expect(Object.getOwnPropertyDescriptor(source.packets,'drawn:test')?.get).toBeDefined();
 const before=JSON.stringify(p),ticket=drain(captureNeighbourhoodPacketV300(p,'test',false,true,source,GASTRONOMY_KIND_V352));
 expect(ticket).toBeDefined();const result=drain(ticket!(p));
 expect(JSON.stringify(p)).toBe(before);expect(result.nav).toBe(p.nav);expect(result.meshes[0]).toBe(p.meshes[0]);expect(result.meshes).toHaveLength(2);
 expect(drain(captureNeighbourhoodPacketV300(p,'other',false,true,source,GASTRONOMY_KIND_V352))).toBeUndefined();
 const stale=raw();stale.nav.groundY=1;expect(drain(captureNeighbourhoodPacketV300(stale,'test',false,true,source,GASTRONOMY_KIND_V352))).toBeUndefined();
 const full=raw();full.meshes=Array(16).fill(wall());const fsource=gastronomySourceV352(compact(full)),ft=drain(captureNeighbourhoodPacketV300(full,'test',false,true,fsource,GASTRONOMY_KIND_V352));
 expect(ft).toBeDefined();expect(drain(ft!(full))).toBe(full);
});

test('malformed recipes and out-of-bounds centimetres fail closed',()=>{
 const p=raw(),valid=compact(p);
 expect(()=>gastronomySourceV352({...valid,keys:['drawn:other']})).toThrow();
 expect(()=>gastronomySourceV352({...valid,keys:['drawn:test','drawn:test']})).toThrow();
 const moved=plate.slice() as GastronomySignV352;moved[0]=65535;
 expect(()=>gastronomySignMeshV352([moved])).toThrow();
 const badstyle=plate.slice() as GastronomySignV352;badstyle[9]=11;
 expect(()=>gastronomySignMeshV352([badstyle])).toThrow();
});

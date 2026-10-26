import { describe,expect,test } from 'bun:test';
import { createHash } from 'node:crypto';
import { InstancedMesh,Mesh } from 'three';
import { createZooGroundsV165,createMinecraftZooGroundsV165 } from '../src/ZooGroundsV165';
import { compactZooWestV276Rows,appendZooWestV276 } from '../src/zooWestV276';
import { zooWestSolidsV276 } from '../src/zooWestV276Profile';
import { createZooWestColumnTesterV276,isZooWestSourceV276 } from '../src/zooWestV276Ownership';
import data from '../src/data/zooWestV276.json';
import ownership from '../src/data/zooWestV276Ownership.json';
import { expectCompleteNativeZooVolumeV276,oldNativeZooRowsV276 } from './helpers/zooWestV276Retention';
import { compilePedestrianObstacles, pedestrianPointIsBlocked, type PedestrianPolygonObstacle } from '../src/pedestrianNavigation';
import type { PrismPayload } from '../src/IsometricCityWorld';
import type { VisualMode } from '../src/visualMode';

function metrics(root:ReturnType<typeof createZooGroundsV165>):{calls:number;bytes:number;instances:number}{
 let calls=0,bytes=0,instances=0;root.traverse(o=>{if(!(o instanceof Mesh))return;calls++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;}});return{calls,bytes,instances};
}
function geometryHash(root:ReturnType<typeof createZooGroundsV165>):string {
 const hash=createHash('sha256');
 root.traverse(o=>{
  if(!(o instanceof Mesh))return;
  hash.update(o.name);
  for(const [key,attribute] of Object.entries(o.geometry.attributes)){
   hash.update(key);const a=attribute.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
  }
  if(o.geometry.index){const a=o.geometry.index.array;hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
  if(o instanceof InstancedMesh)for(const a of[o.instanceMatrix.array,o.instanceColor!.array])hash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
 });
 return hash.digest('hex');
}
function disposeZoo(root:ReturnType<typeof createZooGroundsV165>):void {
 root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();o.userData.dayMaterial?.dispose();o.userData.nightMaterial?.dispose();}});
}
describe('Zoo West complete retained sources with finite corrected restaurants',()=>{
 test('all three complete native wolves stay connected in actual Float32 matrices on pointer and touch',()=>{
  const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const originalMatchMedia=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
  const hashes=new Map<boolean,string>();
  try {
   for(const touch of[false,true]){
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{maxTouchPoints:touch?5:0}});
    Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:(query:string)=>({matches:touch&&query.includes('coarse')})});
    for(const native of[false,true]){
     const root=native?createMinecraftZooGroundsV165():createZooGroundsV165();
     try {
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      const hash=geometryHash(root);
      if(!touch)hashes.set(native,hash);else expect(hash).toBe(hashes.get(native)!);
      expect(metrics(root)).toEqual(native?{calls:3,bytes:7_348_608,instances:96_678}:{calls:6,bytes:2_491_692,instances:10_527});
      if(!native){
       // Actual pre-fix complete drawn geometry and colours, not a rebuilt fixture.
       expect(hash).toBe('46a6a56e2697af6a57c1a1a02682d8d7f1a2f481634c5a167ec197223d20e4cd');
       continue;
      }
      const mesh=root.getObjectByName('Zoo native aviaries climbing rocks and furniture') as InstancedMesh;
      for(const [x,z]of data.wolves){
       const members:number[][]=[];
       for(let i=0;i<mesh.count;i++){
        const matrix=mesh.instanceMatrix.array.subarray(i*16,i*16+16);
        if(Math.abs(matrix[12]-x)>=1.4||Math.abs(matrix[14]-z)>=1.4||matrix[13]<5.3||matrix[13]>6.7)continue;
        for(const k of[1,2,4,6,8,9])expect(Math.abs(matrix[k])).toBe(0);
        members.push([matrix[12],matrix[13],matrix[14],matrix[0],matrix[5],matrix[10]]);
       }
       expect(members).toHaveLength(21);
       // At world X≈−2280 Float32 has a 0.244 mm ULP. Permit only
       // 0.3 mm roundoff, much smaller than the former 38 mm detached leg.
       const touches=(a:number[],b:number[])=>[0,1,2].every(axis=>Math.abs(a[axis]-b[axis])<=(a[axis+3]+b[axis+3])/2+.0003);
       const connected=new Set([0]);
       for(let pass=0;pass<members.length;pass++)for(let i=0;i<members.length;i++)if(!connected.has(i)&&[...connected].some(j=>touches(members[i],members[j])))connected.add(i);
       expect(connected.size).toBe(21);
       // Existing source placement was cleared with a 1.4 m radius. Every
       // full native member, including feet and ears, must remain inside it.
       for(const [cx,,cz,w,,d]of members)for(const sx of[-1,1])for(const sz of[-1,1])expect(Math.hypot(cx+sx*w/2-x,cz+sz*d/2-z)).toBeLessThan(1.4);
      }
     } finally {disposeZoo(root);}
    }
   }
  } finally {
   if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else Reflect.deleteProperty(globalThis,'navigator');
   if(originalMatchMedia)Object.defineProperty(globalThis,'matchMedia',originalMatchMedia);else Reflect.deleteProperty(globalThis,'matchMedia');
  }
 });
 test('lossless row joining preserves every actual rendered original native volume and colour',()=>{
  const root=createMinecraftZooGroundsV165(),mesh=root.getObjectByName('Zoo retained native house shells and ground rows') as InstancedMesh;
  expect(mesh.count).toBe(17053);expect(oldNativeZooRowsV276().length).toBe(22439);expectCompleteNativeZooVolumeV276(mesh);
  const rows=[[0,1,0,1,1,1,0,1],[0,1,1,1,1,1,0,1],[0,1,3,1,1,1,0,1],[0,1,4,1,1,1,0,2]];
  const original=JSON.stringify(rows);expect(compactZooWestV276Rows(rows).length).toBe(3);expect(JSON.stringify(rows)).toBe(original);
  expect(()=>compactZooWestV276Rows([[0,1,0,1,1,1,.5,1]])).toThrow();
 });
 test('full drawn and independent orthogonal native remain in all old batches and fixed budgets',()=>{
  for(const native of[false,true]){
   const root=native?createMinecraftZooGroundsV165():createZooGroundsV165(),m=metrics(root);
   console.log('Zoo West v276 submitted geometry',native?'native':'drawn',m);
   expect(m.calls).toBe(native?3:6);expect(m.bytes).toBeLessThan(native?7_500_000:3_300_000);
   expect(root.userData.zooWestV276).toBe(true);expect(root.userData.fullStaticDetailOnTouch).toBe(true);
   root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(o instanceof Mesh){expect(o.userData.dayMaterial.map).toBeNull();if(native){expect(o instanceof InstancedMesh).toBe(true);const mesh=o as InstancedMesh;for(let i=0;i<mesh.count;i++)for(const k of[1,2,4,6,8,9])expect(Math.abs(mesh.instanceMatrix.array[i*16+k])).toBe(0);}}});
  }
 });
 test('actual core navigation replaces the tall restaurant proxies and preserves open canopy clearance',()=>{
  const source={schema_version:1,classes:['concrete','glass'],buildings:ownership.previousPrisms} as PrismPayload;
  let mode:VisualMode='day';
  const before=compilePedestrianObstacles(source),after=compilePedestrianObstacles(source,()=>mode,{zooWestV276:true});
  const ids=new Set(ownership.previousPrisms.map(p=>p.id));
  const own=(index:ReturnType<typeof compilePedestrianObstacles>)=>[...new Set([...index.cells.values()].flat())].filter(o=>o.kind==='polygon'&&ids.has(o.sourceId!)) as PedestrianPolygonObstacle[];
  expect(new Set(own(after).map(p=>p.sourceId))).toEqual(ids);
  // Fixed interior witnesses in two corrected Waldschänke roofs and Zoo-Talia.
  // Original high coarse prisms blocked the air above their real low roofs.
  const houses=[[-2220.902,983.893667],[-2203.585667,1011.772667],[-2025.215333,1303.097]];
  for(const[x,z]of houses)expect(pedestrianPointIsBlocked(x,z,14,before)).toBe(true);
  for(mode of['day','minecraft','night','day']){
   for(const[x,z]of houses){expect(pedestrianPointIsBlocked(x,z,14,after)).toBe(false);expect(pedestrianPointIsBlocked(x,z,5.2,after)).toBe(true);}
   expect(pedestrianPointIsBlocked(-2206.987,991.155667,5.2,after)).toBe(false);
   const native=mode==='minecraft';
   for(const part of data.parts.filter(p=>p.openCanopy)){
    const roof=zooWestSolidsV276(native).find(p=>p.sourceId===part.sourceId)!;
    for(const tri of part.roofTriangles){
     const[x,z]=tri.reduce((a,v)=>[a[0]+v[0]/3,a[1]+v[2]/3],[0,0]),top=roof.topAt(x,z);
     if(top===null)continue;
     const ceilings=own(after).filter(o=>o.sourceId===part.sourceId&&o.topAt?.(x,z)===top);
     expect(ceilings.length).toBeGreaterThan(0);
     for(const ceiling of ceilings)expect(ceiling.bottomAt!(x,z)).toBeCloseTo(top-.2,8);
    }
   }
  }
  const old=ownership.previousPrisms.find(p=>p.id==='p4td5FVH')!,changed={...old,h_dm:old.h_dm+1};
  const mismatch=compilePedestrianObstacles({...source,buildings:[changed]},()=>mode,{zooWestV276:true});
  expect(own(mismatch)).toHaveLength(1);expect(pedestrianPointIsBlocked(-2220.902,983.893667,14,mismatch)).toBe(true);
  expect(own(compilePedestrianObstacles({...source,buildings:[]},()=>mode,{zooWestV276:true}))).toHaveLength(0);
 });
 test('every restaurant solid uses independent native cells and canopy air stays clear',()=>{
  const native=zooWestSolidsV276(true),drawn=zooWestSolidsV276(false);
  for(const p of data.parts){
   const n=native.find(s=>s.sourceId===p.sourceId)!,d=drawn.find(s=>s.sourceId===p.sourceId)!;
   for(const[x,z,y]of p.nativeCells){expect(n.topAt(x+.5,z+.5)).toBe(y);if(p.openCanopy)expect(n.bottomAt!(x+.5,z+.5)).toBe(y-.2);}
   expect(n.topAt(0,0)).toBeNull();expect(d.topAt(0,0)).toBeNull();
   expect(n.holes).toEqual(p.nativeHoles);expect(d.ring).toEqual(p.ring);
   if(p.openCanopy){expect(n.minY).toBeGreaterThan(5.2);expect(native.filter(s=>s.sourceId===p.sourceId).length).toBe(p.posts.length+1);}
  }
 });
 test('the real append path emits complete shells, visible wolves and condor recognition',()=>{
  for(const native of[false,true]){
   const rows:number[][]=[],surfaces:number[][][]=[];
   const sink={native,box(c:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0){rows.push([x,y,z,w,h,d,yaw,c]);},line(_c:number,a:[number,number,number],b:[number,number,number]){surfaces.push([a,b]);},face(_c:number,r:[number,number,number][]){surfaces.push(r);}};
   appendZooWestV276(sink);
   for(const[x,z]of data.wolves)expect(rows.filter(r=>Math.abs(r[0]-x)<1.5&&Math.abs(r[2]-z)<1.5).length).toBeGreaterThan(20);
   expect(rows.some(r=>r[7]===0xCABFA2)).toBe(true);expect(rows.some(r=>r[7]===0xB6AC91)).toBe(true);
   if(!native)expect(surfaces.length).toBeGreaterThan(data.surfaces.reduce((n,s)=>n+s.triangles.length,0));
  }
 });
 test('retirement is exact and changed/missing/duplicated owners fail closed',()=>{
  const all=[...ownership.previousPrisms,...ownership.neighbours];
  for(const p of ownership.previousPrisms){expect(isZooWestSourceV276(p)).toBe(true);expect(isZooWestSourceV276({...p,h_dm:p.h_dm+1})).toBe(false);}
  const yes=createZooWestColumnTesterV276(all,4);for(const[x,z,lo,hi,k]of ownership.columns){expect(yes(x,z,lo,hi,k)).toBe(true);expect(yes(x,z,lo,hi+1,k)).toBe(false);}
  for(const records of[all.slice(1),[...all,ownership.previousPrisms[0]],all.map((p,i)=>i? p:{...p,h_dm:p.h_dm+1})]){
   const no=createZooWestColumnTesterV276(records,4);for(const[x,z,lo,hi,k]of ownership.columns)expect(no(x,z,lo,hi,k)).toBe(false);
  }
  for(const[x,z,lo,hi,k]of ownership.retainedSharedColumns)expect(yes(x,z,lo,hi,k)).toBe(false);
 });
});

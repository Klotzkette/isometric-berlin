import {expect,test} from 'bun:test';
import {InstancedMesh,Material,Mesh} from 'three';
import {createEastParksV198} from '../src/EastParksV198';
import {eastParksV198GroundAt,EAST_PARKS_V198_MOUND as M} from '../src/eastParksV198Ground';
import source from '../src/data/eastParksV198.json';

function ringArea(r:number[][]):number {let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a)/2;}
const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

test('exact park paving retains holes and the five green symbolic grave-fields',()=>{
 const root=createEastParksV198(false);let area=0;const probes=[[6587.614,3673.955],[6638.402,3713.014],[6613.007,3693.493],[6689.427,3752.244],[6664.058,3732.729]];
 const hits=probes.map(()=>0);
 for(const item of root.children){const m=item as Mesh;if(m instanceof InstancedMesh)continue;
  const pos=m.geometry.getAttribute('position'),index=m.geometry.getIndex()!;
  for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],ys=ids.map(j=>pos.getY(j));
   if(!ys.every(y=>Math.abs(y-3.01)<.0001||Math.abs(y-3.05)<.0001||Math.abs(y+1.15)<.0001))continue;
   const p=ids.map(j=>[pos.getX(j),pos.getZ(j)]);area+=Math.abs(cross(p[0],p[1],p[2]))/2;
   if(Math.abs(ys[0]-3.05)<.0001)for(let k=0;k<probes.length;k++){const signs=p.map((a,j)=>cross(a,p[(j+1)%3],probes[k]));if(signs.every(v=>v>1e-4)||signs.every(v=>v< -1e-4))hits[k]++;}
  }
 }
 const expected=source.grounds.reduce((a,g)=>a+ringArea(g.rings[0])-g.rings.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
 expect(Math.abs(area-expected)).toBeLessThan(3);
 expect(hits).toEqual([0,0,0,0,0]);
});

test('same full detail is finite, frozen, texture-free and spatially bounded in either style',()=>{
 for(const native of [false,true]){const root=createEastParksV198(native);let bytes=0;
  expect(root.userData.noSourceReplacement).toBe(true);expect(root.userData.fullStaticDetailOnTouch).toBe(true);expect(root.children.length).toBeLessThanOrEqual(36);
  for(const item of root.children){const m=item as Mesh;expect(m.matrixAutoUpdate).toBe(false);expect(m.frustumCulled).toBe(true);expect(m.geometry.getAttribute('uv')).toBeUndefined();
   for(const a of Object.values(m.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBe(true);}bytes+=m.geometry.getIndex()?.array.byteLength??0;
   if(m instanceof InstancedMesh){bytes+=m.instanceMatrix.array.byteLength+m.instanceColor!.array.byteLength;expect(m.instanceMatrix.count).toBe(m.count);expect(m.boundingSphere!.radius).toBeLessThan(900);
    if(native)for(let i=0;i<m.count;i++)for(const j of [1,2,4,6,8,9])expect(m.instanceMatrix.array[i*16+j]).toBe(0);
    m.dispose();
   }else expect(native).toBe(false);
   for(const material of new Set([m.material,m.userData.dayMaterial,m.userData.nightMaterial]))if(material instanceof Material)material.dispose();m.geometry.dispose();
  }
  expect(bytes).toBeLessThan(native?1_900_000:1_050_000);
 }
});

test('independent tiny ground API matches the anchored mound and stair treads',()=>{
 expect(source.anchors.find(a=>a.id==='node/9255913447')!.point).toEqual([M.x,M.z]);
 expect(eastParksV198GroundAt(M.x,M.z)).toBe(11);expect(eastParksV198GroundAt(M.x+30,M.z)).toBeNull();
 for(let i=0;i<36;i++){const v=5+(i+.5)*24/36,x=M.x+M.frontX*v,z=M.z+M.frontZ*v;
  expect(eastParksV198GroundAt(x,z)!).toBeGreaterThanOrEqual(11-(i+.5)*8/36+.1999);
 }
});

import {eastParksV198SolidAt,eastParksV198WaterAt} from '../src/eastParksV198Navigation';
import water from '../src/data/eastParksV198Water.json';
test('small navigation recognizes memorial bodies, open gate passages and visible pond surfaces',()=>{
 for(const native of [false,true]){
  expect(eastParksV198SolidAt(M.x,15,M.z,0,native)).toBe(true);
  expect(eastParksV198SolidAt(M.x,21,M.z,0,native)).toBe(false);
  for(const g of source.buildings.filter(b=>['way/44387292','way/142701801'].includes(b.id)))expect(eastParksV198SolidAt(g.center[0],5,g.center[1],0,native)).toBe(false);
  for(const c of source.cenotaphs){const r=c.rings[0].slice(0,-1),x=r.reduce((s,p)=>s+p[0],0)/r.length,z=r.reduce((s,p)=>s+p[1],0)/r.length;
   expect(eastParksV198SolidAt(x,4,z,.15,native)).toBe(true);expect(eastParksV198SolidAt(x,6,z,0,native)).toBe(false);}
  for(const w of water)for(const [x,z] of w.nativeRuns)expect(eastParksV198WaterAt(x,z,native)).toBe(w.y);
  expect(eastParksV198WaterAt(M.x,M.z,native)).toBeNull();
 }
 expect(eastParksV198SolidAt(NaN,4,0)).toBe(false);expect(eastParksV198WaterAt(Infinity,0)).toBeNull();
});

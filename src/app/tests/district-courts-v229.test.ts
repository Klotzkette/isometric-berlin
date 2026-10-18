import { expect,test } from 'bun:test';
import { InstancedMesh,Mesh,Matrix4 } from 'three';
import { createDistrictCourtsV229 } from '../src/DistrictCourtsV229';
import { createDistrictCourtEnvelopesV229 } from '../src/DistrictCourtEnvelopesV229';
import { districtCourtsV229GroundAt,districtCourtsV229SolidAt,districtCourtsV229RoofAt } from '../src/districtCourtsV229Navigation';
import navigation from '../src/data/districtCourtsV229Navigation.json';
import nativeData from '../src/data/districtCourtsV229Native.json';
import drawnData from '../src/data/districtCourtsV229Envelopes.json';
import { disposeStaticAudit } from './helpers/staticGeometryAudit';

test('measured Wedding roof slopes remain visible through static facing tones without changing source geometry',()=>{
 const root=createDistrictCourtEnvelopesV229();
 try{
  for(const key of ['wedding','charlottenburg']){
   const source=drawnData.sites.find(s=>s.key===key)!;
   const mesh=root.children.find(o=>o.userData.siteKey===key) as Mesh;
   const positions=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');
   const roofTones=new Set<string>();let vertex=0;
   for(const surface of source.surfaces)for(const triangle of surface.triangles){
    if(surface.color===0x7f7970)roofTones.add(colors.getX(vertex).toFixed(5));
    for(const p of triangle){
     expect(positions.getX(vertex)).toBe(Math.fround(p[0]));
     expect(positions.getY(vertex)).toBe(Math.fround(p[1]));
     expect(positions.getZ(vertex)).toBe(Math.fround(p[2]));vertex++;
    }
   }
   if(key==='wedding')expect(roofTones.size).toBeGreaterThan(3);
   else expect(roofTones.size).toBe(1); // The official Charlottenburg source really is a flat roof.
  }
 }finally{disposeStaticAudit(root);}
});

test('all current court groups have frozen exact-size independently culled geometry in both families',()=>{
 for(const native of [false,true])for(const [root,count] of [[createDistrictCourtsV229(native),21],[createDistrictCourtEnvelopesV229(native),6]] as const){
  try{
   expect(root.children.length).toBe(count);let instances=0;
   root.traverse(o=>{
    expect(o.matrixAutoUpdate).toBe(false);
    if(!(o instanceof Mesh))return;
    expect(o.frustumCulled).toBe(true);expect(o.userData.siteKey).toBeTruthy();
    expect(o.userData.requiredBeforeNavigation).toBe(true);expect(o.geometry.getAttribute('uv')).toBeUndefined();
    if(o instanceof InstancedMesh){
     expect(o.instanceMatrix.array.length).toBe(o.count*16);instances+=o.count;
     const m=new Matrix4();for(let i=0;i<o.count;i+=23){o.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);if(native)for(const j of [1,2,4,6,8,9])expect(Math.abs(m.elements[j])).toBeLessThan(1e-7);}
    }
   });
   expect(instances).toBeLessThan(40000);
  }finally{disposeStaticAudit(root);}
 }
});

test('required court body roof support never lifts a pedestrian from the entrance ground',()=>{
 for(const site of navigation.sites){
  for(const tri of site.roofTriangles.filter((_,i)=>i%7===0)){
   const x=tri.reduce((n,p)=>n+p[0],0)/3,z=tri.reduce((n,p)=>n+p[2],0)/3;
   const roof=districtCourtsV229RoofAt(x,z);if(roof===null||roof<7)continue;
   const ground=districtCourtsV229GroundAt(x,z,3);if(ground!==null)expect(ground).toBeLessThanOrEqual(5.2);
   expect(districtCourtsV229SolidAt(x,roof-.5,z)).toBe(true);
  }
 }
 for(const site of nativeData.sites)for(const r of site.blocks.filter((_,i)=>i%151===0)){
  const x=r[0],z=r[2];
  const top=Math.max(...nativeData.sites.flatMap(s=>s.blocks).filter(q=>Math.abs(q[0]-x)<=q[3]/2+.00001&&Math.abs(q[2]-z)<=q[5]/2+.00001).map(q=>q[1]+q[4]/2));
  expect(districtCourtsV229RoofAt(x,z,true)).toBeCloseTo(top,2);
 }
 expect(districtCourtsV229RoofAt(0,0)).toBeNull();
});

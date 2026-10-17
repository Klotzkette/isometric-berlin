import { expect, test } from 'bun:test';
import { InstancedMesh, Matrix4, Mesh } from 'three';
import { createSchoolCultureV228 } from '../src/SchoolCultureV228';

test('all five sites retain complete frozen small texture-free batches',()=>{
  for(const native of [false,true]){
    const root=createSchoolCultureV228(native);
    expect(root.children).toHaveLength(5);
    let count=0;let meshes=0;
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBe(false);
      if(!(o instanceof Mesh))return;
      meshes++;
      expect(o.userData.textureFree).toBe(true);
      expect(o.userData.sourceGeometryRetained).toBe(true);
      expect(o.geometry.getAttribute('uv')).toBeUndefined();
      if(o instanceof InstancedMesh){
        count+=o.count;
        expect(o.instanceMatrix.array.length).toBe(o.count*16);
        const m=new Matrix4();
        for(let i=0;i<o.count;i++){
          o.getMatrixAt(i,m);
          expect(m.elements.every(Number.isFinite)).toBe(true);
          if(native)for(const j of [1,2,4,6,8,9])expect(Math.abs(m.elements[j])).toBeLessThan(1e-7);
        }
      }else expect(native).toBe(false);
    });
    expect(meshes).toBe(native?5:6);
    expect(count).toBeLessThan(native?6000:1400);
  }
});

import { schoolCultureV228GroundAt, schoolCultureV228RoofAt, schoolCultureV228SolidAt, SCHOOL_CULTURE_V228_TOWER } from '../src/schoolCultureV228Profile';
test('new roof navigation follows church volume and leaves approach open',()=>{
  const ring=SCHOOL_CULTURE_V228_TOWER.ring;
  const x=ring.reduce((a,p)=>a+p[0],0)/4,z=ring.reduce((a,p)=>a+p[1],0)/4;
  expect(schoolCultureV228RoofAt(x,z)).toBeCloseTo(72.6,3);
  expect(schoolCultureV228SolidAt(x,40,z)).toBe(true);
  expect(schoolCultureV228SolidAt(x,75,z)).toBe(false);
  expect(schoolCultureV228SolidAt(x,5.2,z)).toBe(false);
  expect(schoolCultureV228RoofAt(1920,-690)).toBeNull();
  expect(schoolCultureV228SolidAt(1920,20,-690,.35)).toBe(false);
  expect(schoolCultureV228RoofAt(1970,-699)).toBeGreaterThan(27);
});

import source from '../src/data/schoolCultureV228.json';
test('native support matches actual rendered block tops and cannot lift ground walkers',()=>{
  const church=source.sites.find(s=>s.key==='sophienkirche')!;
  for(const r of church.nativeRows.filter((_,i)=>i%97===0)){
    const x=r[0],z=r[2];
    const top=Math.max(...church.nativeRows.filter(q=>Math.abs(q[0]-x)<=q[3]/2+.0001&&Math.abs(q[2]-z)<=q[5]/2+.0001).map(q=>q[1]+q[4]/2));
    expect(schoolCultureV228RoofAt(x,z,true)).toBeCloseTo(top,2);
    expect(schoolCultureV228GroundAt(x,z,5.2,true)).toBeNull();
    expect(schoolCultureV228GroundAt(x,z,5.2,false)).toBeNull();
  }
  expect(schoolCultureV228GroundAt(1970,-699,5.2)).toBeNull();
});

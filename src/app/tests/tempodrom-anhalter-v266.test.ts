import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Mesh } from 'three';
import source from '../src/data/tempodromAnhalterV266.json';
import { createTempodromAnhalterV266, tempodromAnhalterGeometryV266 } from '../src/TempodromAnhalterV266';
import { anhalterPointV266, anhalterSolidsForV266, containsAnhalterRingV266, createAnhalterColumnTesterV266, isAnhalterSourceV266, isTempodromSourceV266, tempodromRoofAtV266 } from '../src/TempodromAnhalterV266Profile';

describe('bounded Anhalter and Tempodrom v266',()=>{
  test('exact source/column fingerprints retain changed sources and new neighbours',()=>{
    const p=source.portico.previousPrism;
    expect(isAnhalterSourceV266(p)).toBe(true);
    expect(isAnhalterSourceV266({...p,h_dm:p.h_dm+1})).toBe(false);
    expect(isTempodromSourceV266(source.tempodrom.retainedPrism)).toBe(true);
    const actual=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8')).buildings;
    const tester=createAnhalterColumnTesterV266(actual,source.cellM);
    for(const c of source.columns)expect(tester(c[0],c[1],c[2],c[3],c[4])).toBe(true);
    expect(tester(...[source.columns[0][0],source.columns[0][1],52,999,3] as [number,number,number,number,number])).toBe(false);
    const first=source.columns[0],x=first[0]*source.cellM*10,z=first[1]*source.cellM*10;
    const blocked=createAnhalterColumnTesterV266([...actual,{id:'new-owner',ring:[[x,z],[x+40,z],[x+40,z+40],[x,z+40]]}],source.cellM);
    expect(blocked(first[0],first[1],first[2],first[3],first[4])).toBe(false);
  });
  test('three open arches stay passable in both independently built families',()=>{
    for(const native of [false,true]){
      const solids=anhalterSolidsForV266(native);
      for(const u of [-5.45,0,5.45])for(let v=-5;v<=5;v+=.25){
        const [x,,z]=anhalterPointV266(u,5.2,v);
        expect(solids.some(s=>s.minY<7.1&&s.maxY>5.35&&containsAnhalterRingV266(s.ring,x,z))).toBe(false);
      }
      const [x,,z]=anhalterPointV266(2.75,5.2,-3.02);
      expect(solids.some(s=>s.minY<7.1&&s.maxY>5.35&&containsAnhalterRingV266(s.ring,x,z))).toBe(true);
    }
  });
  test('twelve curved roof folds, glazed crown and complete measured roof survive',()=>{
    const p=source.tempodrom;
    for(let i=0;i<12;i++){
      const a=.18+(i+.5)*Math.PI*2/12,b=.18+i*Math.PI*2/12;
      expect(tempodromRoofAtV266(p.centre[0]+5.5*Math.cos(a),p.centre[1]+5.5*Math.sin(a))).toBeCloseTo(42.2,5);
      expect(tempodromRoofAtV266(p.centre[0]+5.5*Math.cos(b),p.centre[1]+5.5*Math.sin(b))).toBeCloseTo(35.75,5);
    }
    expect(tempodromRoofAtV266(...p.centre as [number,number])).toBe(35.75);
    expect(tempodromRoofAtV266(p.centre[0]+40,p.centre[1])).toBeNull();
    const g=tempodromAnhalterGeometryV266(),roof=g.triangles.filter(t=>t.role==='complete-measured-portico-roof');
    const points=new Set(roof.flatMap(t=>t.points.map(p=>p.join('/'))));
    for(const p of source.portico.roof[0].rings[0])expect(points.has(p.join('/'))).toBe(true);
    const ring=source.tempodrom.retainedPrism.ring.map(p=>p.map(v=>v/10));
    for(const triangle of g.triangles.filter(t=>t.role==='twelve-fold-white-roof'))for(const [x,,z] of triangle.points)expect(containsAnhalterRingV266(ring,x,z)).toBe(true);
  });
  test('full mobile geometry, finite bounded buffers and orthogonal native construction',()=>{
    for(const native of [false,true]){
      const a=createTempodromAnhalterV266(native,{diagnostics:true}),b=createTempodromAnhalterV266(native,{mobileLike:true,diagnostics:true});
      expect(a.userData.records).toEqual(b.userData.records);
      const {rows,triangles}=a.userData.records as ReturnType<typeof tempodromAnhalterGeometryV266>;
      expect(rows.length).toBeLessThan(16000);
      expect(triangles.length).toBeLessThan(1000);
      for(const row of rows){expect([...row.position,...row.size,row.angle].every(Number.isFinite)).toBe(true);expect(row.size.every(v=>v>0)).toBe(true);if(native)expect(row.angle).toBe(0);}
      if(native)expect(triangles.length).toBe(0);
      a.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(o instanceof Mesh)expect(o.geometry.getAttribute('uv')).toBeUndefined();});
      for(const root of [a,b])root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();const mats=[o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat();for(const m of mats)m?.dispose();}});
    }
  });
});

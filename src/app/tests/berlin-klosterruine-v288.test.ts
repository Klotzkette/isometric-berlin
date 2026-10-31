import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import profile from '../src/data/berlinHistoricCoreV288.json';
import source from '../src/data/berlinKlosterruineV288.json';
import { BERLIN_KLOSTERRUINE_V288_WALLS as walls, berlinKlosterruineRowsV288 as rows, berlinKlosterruineSolidsV288 as rawSolids } from '../src/BerlinKlosterruineV288';
import { berlinKlosterruineSolidsV288 as solids } from '../src/BerlinKlosterruineV288Navigation';

function inside(x: number, z: number, ring: number[][]) {
  let result = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}
  return result;
}
function blocked(x: number,y: number,z: number,native=false) {return solids(native).some(s=>y>s.minY&&y<s.maxY&&inside(x,z,s.ring));}

test('ruin recognition uses only exact retained plan vertices and keeps all 116 source sheets',()=>{
  const p=profile.profiles.find(p=>p.id==='ruin')!;
  expect(p.parts.reduce((n,p)=>n+p.surfaces.length,0)).toBe(116);
  const vertices=new Set(p.parts.flatMap(p=>p.ring.map(v=>v.join('/'))));
  for(const w of walls){expect(vertices.has(w.a.join('/'))).toBe(true);expect(vertices.has(w.b.join('/'))).toBe(true);}
  expect(walls.length).toBe(13);
  expect(walls[0].holes.length).toBe(8);expect(walls[1].broken).toBe(true);
  expect(walls.some(w=>w.id.includes('south-nave'))).toBe(false);
});

test('open west portal, four nave arcades, clerestory and choir windows are actual geometry holes',()=>{
  expect(blocked(2768.39990448,7.7,120.60333824)).toBe(false);
  expect(blocked(2766.38761998,7.7,115.80977877)).toBe(true);
  for(const w of walls){
    const l=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),ux=(w.b[0]-w.a[0])/l,uz=(w.b[1]-w.a[1])/l,off=w.id==='north-nave-arcade'?.58:w.broken?-.38:.38;
    for(const h of w.holes){const x=w.a[0]+ux*(h.centre+h.width*.22)-uz*off,z=w.a[1]+uz*(h.centre+h.width*.22)+ux*off;
      expect(blocked(x,(h.low+h.spring)/2,z)).toBe(false);
    }
  }
  expect(blocked(2786,10,120)).toBe(false); // open roofless nave, no reconstructed south wall
});

test('native masonry is cardinal and its entire bounds clear all frozen retained source solids',()=>{
  const path=new URL('../../../'+source.sourcePath,import.meta.url);
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(source.sourceSha256);
  expect(source.sourceTops.length).toBe(330);
  for(const r of rows(true)) {
    expect(r.length).toBe(7);expect(r.every(Number.isFinite)).toBe(true);
    const low=r[1]-r[4]/2;
    expect(low).toBeGreaterThanOrEqual(7.025-1e-8);
    for(const [x,z,top]of source.sourceTops)if(r[0]-r[3]/2<x+2-1e-6&&r[0]+r[3]/2>x+1e-6&&r[2]-r[5]/2<z+2-1e-6&&r[2]+r[5]/2>z+1e-6)expect(low-top).toBeGreaterThanOrEqual(.025-1e-8);
  }
  expect(rows(true).length).toBe(195);expect(rows().length).toBe(1912);
  expect(rows(true).length*76).toBe(14_820);expect(rows().length*76).toBe(145_312);
});

test('lightweight navigation equals opaque pieces with only tiny mortar gaps conservatively merged',()=>{
  expect(solids().length).toBe(621);expect(solids(true)).toEqual(rawSolids(true));
  for(const n of [false,true])for(const r of rawSolids(n)){
    const x=r.ring.reduce((s,v)=>s+v[0],0)/4,z=r.ring.reduce((s,v)=>s+v[1],0)/4;
    expect(blocked(x,(r.minY+r.maxY)/2,z,n)).toBe(true);
  }
  const navSource=readFileSync(new URL('../src/BerlinKlosterruineV288Navigation.ts',import.meta.url),'utf8');
  expect(navSource).not.toContain('BerlinHistoricCoreV288');expect(navSource).not.toContain('BerlinKlosterruineV288\'');
});

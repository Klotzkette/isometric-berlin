import { expect, test } from 'bun:test';
import { Mesh, InstancedMesh } from 'three';
import { createWaldbuehneV201 } from '../src/WaldbuehneV201';
import { waldbuehneGroundAt, waldbuehneSolidAt } from '../src/waldbuehneV201Navigation';
import nav from '../src/data/waldbuehneV201Navigation.json';
import drawn from '../src/data/waldbuehneV201.json';
import native from '../src/data/waldbuehneV201Native.json';

test('Waldbühne constructors retain finite drawn detail and independently orthogonal native skin',()=>{
  for(const minecraft of [false,true]){
    const root=createWaldbuehneV201(minecraft);let bytes=0,calls=0;
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBe(false);
      if(!(o instanceof Mesh))return;
      calls++;
      for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBe(true);}
      expect(o.geometry.boundingSphere).not.toBeNull();
      if(o instanceof InstancedMesh){
        bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);
        expect(o.boundingSphere).not.toBeNull();
        for(let i=0;i<o.count;i++){
          const m=o.instanceMatrix.array.slice(i*16,i*16+16);
          expect(Array.from(m).every(Number.isFinite)).toBe(true);
          if(minecraft)for(const j of [1,2,4,6,8,9])expect(m[j]).toBe(0);
        }
      }
    });
    expect(calls).toBe(minecraft?1:2);expect(bytes).toBeLessThan(1024*1024);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
  }
  expect(drawn.sites[0].owners.length).toBe(23);
  expect(native.sites[0].positions).toEqual([]);
});

test('all source sloping seat triangles are traversable and never whole-height building solids',()=>{
  for(const t of nav.floorTriangles){
    const p=t.reduce((a,b)=>a.map((v,i)=>v+b[i]/3),[0,0,0]);
    expect(waldbuehneGroundAt(p[0],p[2])).toBeCloseTo(p[1],4);
    expect(waldbuehneSolidAt(p[0],p[1]+1.7,p[2],.25)).toBe(false);
  }
  for(const [x,z,y] of nav.nativeFloors){
    expect(waldbuehneGroundAt(x+.5,z+.5,true)).toBe(y);
    expect(native.sites[0].boxes.some(r=>r[0]===x+.5&&r[2]===z+.5&&Math.abs(r[1]+r[4]/2-y)<1e-7)).toBe(true);
  }
});

test('tent collision is limited to membrane and support, leaving its undercroft open',()=>{
  const t=nav.roofTriangles[Math.floor(nav.roofTriangles.length/2)];
  const p=t.reduce((a,b)=>a.map((v,i)=>v+b[i]/3),[0,0,0]);
  expect(waldbuehneSolidAt(p[0],p[1],p[2],.1)).toBe(true);
  expect(waldbuehneSolidAt(p[0],p[1]-3,p[2],.1)).toBe(false);
  for(const q of [NaN,Infinity,-Infinity]){
    expect(waldbuehneGroundAt(q,150)).toBeNull();expect(waldbuehneSolidAt(-9660,q,150)).toBe(false);
  }
  expect(waldbuehneGroundAt(0,0)).toBeNull();expect(waldbuehneSolidAt(0,10,0)).toBe(false);
});

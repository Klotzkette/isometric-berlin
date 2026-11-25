import { expect, test } from 'bun:test';
import { Mesh, Raycaster, Vector3 } from 'three';
import { createPotsdamerForecourtsV385 } from '../src/potsdamerForecourtsV385';
import source from '../src/data/potsdamerForecourtsV385.json';

test('both styles pave the three verified grass points and keep the adjoining asphalt at the embassy',()=>{
  for (const native of [false,true]) {
    const group=createPotsdamerForecourtsV385(native);
    group.updateMatrixWorld(true);
    expect(group.children).toHaveLength(1);
    const hit=(x:number,z:number)=>new Raycaster(new Vector3(x,8,z),new Vector3(0,-1,0)).intersectObjects(group.children)[0];
    for(const [x,z,old] of [[246.33,981.02,5.4],[246.63,984.02,5.4],[398.55,977.45,5.3]]) {
      expect(hit(x,z)?.point.y).toBeGreaterThan(old+.015);
      expect(hit(x,z)?.point.y).toBeLessThan(old+.25);
    }
    expect(hit(401.15,980.45)).toBeUndefined();
    expect(hit(247.03,988.02)).toBeUndefined();
  }
});

for(const native of [false,true]) test('the outside paving edges extend into the old ground in '+(native?'native':'drawn')+' mode',()=>{
  const group=createPotsdamerForecourtsV385(native);
  group.updateMatrixWorld(true);
  const floor=group.children[0] as Mesh;
  const rims=native ? source.nativeSides.map(([ax,az,bx,bz,h,base])=>
    [320+ax/4,980+az/4,320+bx/4,980+bz/4,h/1000,base/1000]) :
    source.sides.map(([ai,bi,base])=>{
      const [ax,az,ah]=source.vertices[ai], [bx,bz,bh]=source.vertices[bi];
      return [320+ax/1000,980+az/1000,320+bx/1000,980+bz/1000,(ah+bh)/2000,base/1000];
    });
  let ritz=0,embassy=0;
  for(const [ax,az,bx,bz,h,base] of rims) {
    const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz);
    if(len<.16)continue;
    const n=new Vector3(-dz/len,0,dx/len);
    // From the courtyard outside each free edge, hit its side below the
    // top course and above the old ground. Both ends connect to the terrain.
    const target=new Vector3((ax+bx)/2,h-.015,(az+bz)/2);
    const ray=new Raycaster(target.clone().addScaledVector(n,.035),n.negate(),0,.07);
    expect(ray.intersectObject(floor)[0]?.distance).toBeCloseTo(.035,3);
    expect(base).toBeLessThan(h-.025);
    if(ax<320)ritz++;else embassy++;
  }
  expect(ritz).toBeGreaterThan(5);
  expect(embassy).toBeGreaterThan(5);
});

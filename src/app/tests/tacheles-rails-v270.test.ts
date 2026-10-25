import {test,expect} from 'bun:test';
import {Mesh} from 'three';
import {createTachelesRailsV270} from '../src/TachelesRailsV270';
import {altMittePaintHeightV206} from '../src/AltMitteTransportV206';
import {disposeSurroundingCityRoot} from '../src/SurroundingCity';

test('railheads follow the real road skin with independent orthogonal native steps',()=>{
  for(const native of [false,true]){
    const root=createTachelesRailsV270(native);
    expect(root.children.length).toBe(1);
    const mesh=root.children[0] as Mesh, p=mesh.geometry.getAttribute('position');
    expect(p.count).toBeGreaterThan(600);
    expect(p.array.byteLength).toBeLessThan(600_000);
    for(let i=0;i<p.count;i+=4){
      const ax=(p.getX(i)+p.getX(i+3))/2,az=(p.getZ(i)+p.getZ(i+3))/2;
      expect(Math.abs(p.getY(i)-altMittePaintHeightV206(ax,az,native)-.01)).toBeLessThan(.001);
      if(native)expect(Math.min(Math.abs(p.getX(i+1)-p.getX(i)),Math.abs(p.getZ(i+1)-p.getZ(i)))).toBeLessThan(.001);
    }
    expect(mesh.userData.textureFree).toBe(true);disposeSurroundingCityRoot(root);
  }
});

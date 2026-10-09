import {expect,test} from 'bun:test';
import {InstancedMesh, Mesh} from 'three';
import {createWuhlheideV201} from '../src/WuhlheideV201';
import {wuhlheideTerrainOffsetV201 as terrain} from '../src/wuhlheideTerrainV201';
import {wuhlheideGroundAt,wuhlheideSolidAt} from '../src/wuhlheideV201Navigation';

for(const native of [false,true])test(`Wuhlheide ${native?'native':'drawn'} keeps source detail in two bounded batches`,()=>{
  const group=createWuhlheideV201(native);let bytes=0,draws=0;
  group.traverse(o=>{
    if(!(o instanceof Mesh))return;
    draws++;expect(o.matrixAutoUpdate).toBe(false);
    for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
    bytes+=o.geometry.index?.array.byteLength??0;
    if(o instanceof InstancedMesh){
      bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
      expect(o.boundingSphere!.radius).toBeLessThan(250);
      if(native)for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(o.instanceMatrix.array[i*16+j]).toBe(0);
    }
    expect(o.geometry.getAttribute('uv')).toBeUndefined();
    expect(o.userData.dayMaterial).toBeDefined();expect(o.userData.nightMaterial).toBeDefined();
  });
  expect(draws).toBe(2);expect(bytes).toBeLessThan(1.2*1024*1024);
});
test('Wuhlheide retains the measured low arena and twelve-metre earthwork',()=>{
  for(const native of [false,true]){
    expect(3+terrain(11674,6568,native)!).toBeLessThan(4.1);
    expect(terrain(11730,6560,native)!-terrain(11674,6568,native)!).toBeGreaterThan(11);
    expect(terrain(11400,6600,native)).toBeNull();
  }
  expect(terrain(11536.001,6500)!).toBeLessThan(.001);
});
test('Open arena, radial paths and stage underside stay passable',()=>{
  expect(wuhlheideGroundAt(11662,6600)).toBe(6.4);
  expect(wuhlheideGroundAt(11674,6568)).toBeNull();
  expect(wuhlheideSolidAt(11662,8,6600,.35)).toBe(false);
  expect(wuhlheideSolidAt(11662,17,6600,.35)).toBe(true);
  expect(wuhlheideSolidAt(11680,10,6529,.35)).toBe(false);
  expect(wuhlheideSolidAt(11674,5.5,6568,.35)).toBe(false);
  expect(wuhlheideSolidAt(NaN,8,6600)).toBe(false);
});

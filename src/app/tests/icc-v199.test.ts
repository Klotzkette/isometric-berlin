import {expect,test} from "bun:test";
import {InstancedMesh,Mesh} from "three";
import {createIccV199} from "../src/IccV199";
import {iccV199SolidAt} from "../src/iccV199Navigation";

for(const native of [false,true])test(`ICC ${native?'native':'drawn'} batches retain full static geometry`,()=>{
 const root=createIccV199(native);expect(root.children.length).toBe(3);let bytes=0,draws=0;
 root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;expect(o.matrixAutoUpdate).toBe(false);
 for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
 bytes+=o.geometry.index?.array.byteLength??0;
 if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;expect(o.boundingSphere!.radius).toBeGreaterThan(0);
  if(native)for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(o.instanceMatrix.array[i*16+j]).toBe(0);
 }
 expect(o.userData.dayMaterial).not.toBe(o.userData.nightMaterial);
 });
 expect(draws).toBe(native?3:6);expect(bytes).toBeLessThan(3*1024*1024);
});
test('ICC transferred main and garage retain collision but not nearby streets',()=>{
 expect(iccV199SolidAt(-6200,15,1410)).toBe(true);
 expect(iccV199SolidAt(-6240,15,1590)).toBe(true);
 expect(iccV199SolidAt(-6270,15,1380)).toBe(false);
 expect(iccV199SolidAt(-6200,150,1410)).toBe(false);
 expect(iccV199SolidAt(-6278,5.2,1447)).toBe(false);
 expect(iccV199SolidAt(-6278,12,1447)).toBe(true);
});

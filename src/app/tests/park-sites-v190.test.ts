import { test, expect } from 'bun:test';
import { Box3, InstancedMesh, Mesh } from 'three';
import { createParkSitesV190 } from '../src/ParkSitesV190';
import data from '../src/data/parkSitesV190.json';

test('both parks retain source-identified furniture and actual basin rings',()=>{
 expect(data.parks).toHaveLength(2); expect(data.benches.length).toBeGreaterThan(200);
 expect(data.edges.filter(e=>['way/439035491','way/439035493'].includes(e.id))).toHaveLength(2);
 expect(data.basins).toHaveLength(7);
});
for(const native of [false,true])test(`park detail has finite bounded exact-count buffers native=${native}`,()=>{
 const root=createParkSitesV190(native);let bytes=0,count=0;
 root.traverse(o=>{const m=o as Mesh; if(!m.geometry)return;count++;
   for(const a of Object.values(m.geometry.attributes))bytes+=a.array.byteLength;
   if(m instanceof InstancedMesh){expect(m.instanceMatrix.count).toBe(m.count);bytes+=m.instanceMatrix.array.byteLength+(m.instanceColor?.array.byteLength??0);}
   expect(new Box3().setFromObject(m).isEmpty()).toBe(false);
   m.geometry.dispose();
 });
 expect(count).toBeLessThanOrEqual(5);expect(bytes).toBeLessThan(6*1024*1024);
});

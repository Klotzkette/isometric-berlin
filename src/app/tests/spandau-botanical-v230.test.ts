import {describe,expect,test} from 'bun:test';
import {InstancedMesh,Mesh,Raycaster,Vector3} from 'three';
import {createSpandauBotanicalV230} from '../src/SpandauBotanicalV230';
import {createWesternLandmarksV187,createMinecraftWesternLandmarksV187} from '../src/WesternLandmarksV187';
import {applyCitadelCrownV230} from '../src/citadelCrownV230';
import {botanicalV230GroundAt,botanicalV230WaterAt,botanicalV230SolidAt,botanicalV230FloorAt} from '../src/botanicalV230Navigation';
import nav from '../src/data/botanicalV230Navigation.json';
import receipt from '../src/data/citadelCrownV230Previous.json';
function dispose(root:any){root.traverse((o:any)=>{o.geometry?.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))(m as any)?.dispose?.();});}
describe('source-bound Spandau/botanical v230',()=>{
 for(const native of [false,true])test(`measured roofs, ponds, actual native collision and finite buffers ${native}`,()=>{
  const root=createSpandauBotanicalV230(native);root.updateMatrixWorld(true);let bytes=0,orthogonal=true,finite=true;
  root.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;expect(o.frustumCulled).toBe(true);}if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);for(let i=0;i<o.count;i++)for(const k of [1,2,4,6,8,9])if(o.instanceMatrix.array[i*16+k]!==0)orthogonal=false;for(const n of o.instanceMatrix.array)if(!Number.isFinite(n))finite=false;}});
  expect(finite).toBe(true);if(native)expect(orthogonal).toBe(true);expect(bytes).toBeLessThan(2_000_000);
  const buildings=root.children.find(g=>g.name==='Botanical measured buildings')!,grounds=root.children.filter(g=>g.name.startsWith('Botanical park:'));
  const ray=new Raycaster();let roofChecks=0,waterChecks=0,groundChecks=0;
  for(const s of nav.solids){const samples=native?s.nativeRoof.slice(0,8).map(r=>[r[0],r[2]]):s.roof.slice(0,8).map(t=>[(t[0]+t[3]+t[6])/3,(t[2]+t[5]+t[8])/3]);
   for(const[x,z]of samples){ray.set(new Vector3(x,80,z),new Vector3(0,-1,0));const h=ray.intersectObject(buildings,true)[0];if(!h)continue;expect(botanicalV230FloorAt(x,z,80,native)).toBeCloseTo(h.point.y,2);expect(botanicalV230FloorAt(x,z,3,native)).toBeNull();roofChecks++;}
   if(native)for(const r of s.native.slice(0,10)){expect(botanicalV230SolidAt(r[0],r[1],r[2],0,true)).toBe(true);expect(botanicalV230SolidAt(r[0],s.top+3,r[2],0,true)).toBe(false);}
  }
  for(let x=1362;x<2240;x+=40)for(let z=-9838;z< -9250;z+=40){const water=botanicalV230WaterAt(x,z,native),ground=botanicalV230GroundAt(x,z,native);ray.set(new Vector3(x,4,z),new Vector3(0,-1,0));const hit=ray.intersectObjects(grounds,true)[0];if(water!==null){expect(ground).toBeNull();expect(hit?.point.y).toBeCloseTo(water,2);waterChecks++;}else if(ground!==null){expect(hit?.point.y).toBeCloseTo(ground,2);groundChecks++;}}
  expect(roofChecks).toBeGreaterThan(60);expect(waterChecks).toBeGreaterThan(2);expect(groundChecks).toBeGreaterThan(100);expect(botanicalV230GroundAt(0,0,native)).toBeNull();
  console.log({native,bytes,roofChecks,groundChecks,waterChecks});dispose(root);
 });
 for(const native of [false,true])test(`exact crown owner correction preserves every unrelated byte ${native}`,()=>{
  const root=native?createMinecraftWesternLandmarksV187():createWesternLandmarksV187();const snapshots=new Map<any,Float32Array>();
  root.traverse(o=>{if(o instanceof InstancedMesh)snapshots.set(o,new Float32Array(o.instanceMatrix.array));else if(o instanceof Mesh)snapshots.set(o,new Float32Array(o.geometry.getAttribute('position').array));});
  const n=applyCitadelCrownV230(root,native);expect(n).toBe(native?21:294);expect(applyCitadelCrownV230(root,native)).toBe(0);
  const changed=new Set(native?receipt.nativeRows.flatMap(r=>[r[0]*16+5,r[0]*16+13]):receipt.drawnVertices.map(r=>r[0]*3+1));let difference=0;
  for(const[o,old]of snapshots){const now=o instanceof InstancedMesh?o.instanceMatrix.array:o.geometry.getAttribute('position').array;for(let i=0;i<old.length;i++)if(old[i]!==now[i]){expect(o.name.startsWith('Zitadelle:')).toBe(true);expect(changed.has(i)).toBe(true);difference++;}if(native&&o instanceof InstancedMesh)for(let i=0;i<o.count;i++)expect(now[i*16+5]).toBeGreaterThan(0);}
  expect(difference).toBeGreaterThan(20);dispose(root);
 });
 test('changed prior owner fails closed',()=>{const root=createWesternLandmarksV187(),mesh=root.getObjectByName('Zitadelle: retained source sheets and mapped grounds')as Mesh;mesh.geometry.getAttribute('position').setY(receipt.drawnVertices[0][0],100);expect(applyCitadelCrownV230(root)).toBe(0);dispose(root);});
});

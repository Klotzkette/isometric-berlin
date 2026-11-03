import {describe,expect,test}from'bun:test';
import {BufferAttribute,Group,InstancedMesh,Mesh}from'three';
import {createRailTerrainContactV307,hasCompleteRailTerrainContactV307}from'../src/RailTerrainContactV307';
import {createRailSseArchitectureV307,hasCompleteRailSseArchitectureV307}from'../src/RailSseArchitectureV307';
import {applyRailSseLegacyV307}from'../src/RailSseLegacyV307';
import {createRailStationsV190}from'../src/RailStationsV190';
import {railSseArchitectureV307Solids,railSseGroundAtV307,quantizeNativeTerrainHeightV307}from'../src/railSseNavigationV307';
import {parkStaticGeometrySteps}from'../src/losslessStaticStorage';
import {compactStaticGeometrySteps}from'../src/compactStaticGeometry';
import {decodeBase64Bytes}from'../src/decodeBase64Bytes';
import {readRequiredPackedWordsV307,type RequiredPackedV307}from'../src/requiredPackedRootV307';
import terrain from'../src/data/railTerrainContactV307.json';
import architecture from'../src/data/railSseArchitectureV307.json';
import core from'../src/data/coreTerrainContactV307.json';
function dispose(root:Group){const done=new Set<object>();root.traverse(q=>{if(q instanceof Mesh){if(!done.has(q.geometry)){done.add(q.geometry);q.geometry.dispose();}for(const m of[q.userData.dayMaterial,q.userData.nightMaterial,q.userData.schwellenraumMaterial])if(m&&!done.has(m)){done.add(m);m.dispose();}if(q instanceof InstancedMesh)q.dispose();}});root.clear();}
function finish(g:Generator){let r=g.next();while(!r.done)r=g.next();return r.value;}
function owns(root:Group){const result:Mesh[]=[];root.traverse(q=>{if(q instanceof Mesh&&['Gesundbrunnen','Landsberger Allee'].includes(q.parent?.userData.stationName))result.push(q);});return result;}
describe('Rail and measured contact v307',()=>{
 for(const native of[false,true])test(`complete actual contact attributes and UInt16 paint survive (${native})`,()=>{
  const root=createRailTerrainContactV307(native,{mobileLike:true});try{
   expect(hasCompleteRailTerrainContactV307(root,native)).toBe(true);const rows=[...terrain.meshes,...core.meshes].filter(q=>q.native===native);expect(root.children.length).toBe(rows.length);expect(new Set(rows.map(q=>q.field)).size).toBe(4);
   rows.forEach((p,i)=>{const mesh=root.children[i]as Mesh;expect(mesh.position.toArray()).toEqual(p.origin);expect(mesh.scale.toArray()).toEqual(p.positionType==='u16cm'?[.01,.01,.01]:[1,1,1]);for(const[key,value]of[['position',p.positions],['color',p.colors]]as const){const actual=mesh.geometry.getAttribute(key).array,bytes=key==='position'&&p.positionType==='f32'?new Uint8Array(readRequiredPackedWordsV307(value,p.vertices*3,3,(p as RequiredPackedV307).positionsCodec).buffer):decodeBase64Bytes(value);expect(new Uint8Array(actual.buffer,actual.byteOffset,actual.byteLength)).toEqual(bytes);}expect(mesh.geometry.index!.count).toBe(p.triangles*3);if(native){const xyz=mesh.geometry.getAttribute('position').array,ix=mesh.geometry.index!.array;let diagonal=0;for(let j=0;j<ix.length;j+=3){const a=ix[j]*3,b=ix[j+1]*3,c=ix[j+2]*3;if(!([0,1,2].some(k=>xyz[a+k]===xyz[b+k]&&xyz[a+k]===xyz[c+k])))diagonal++;}expect(diagonal).toBe(0);}});
   finish(compactStaticGeometrySteps(root));expect(hasCompleteRailTerrainContactV307(root,native)).toBe(true);finish(parkStaticGeometrySteps(root,true));root.traverse(q=>{if(q instanceof Mesh){for(const a of Object.values(q.geometry.attributes))if(a instanceof BufferAttribute)a.onUploadCallback();q.geometry.index?.onUploadCallback();}});expect(hasCompleteRailTerrainContactV307(root,native)).toBe(true);
  }finally{dispose(root);}
 });
 for(const native of[false,true])test(`spatial architecture keeps all source triangles and actual navigation (${native})`,()=>{
  const root=createRailSseArchitectureV307(native,{mobileLike:true});try{
   expect(hasCompleteRailSseArchitectureV307(root,native)).toBe(true);const models=architecture.models.filter(q=>q.native===native);expect(root.children.length).toBe(models.length);expect(root.children.length).toBeGreaterThan(3);
   models.forEach((p,i)=>{const mesh=root.children[i]as Mesh;expect(mesh.geometry.index!.count).toBe(p.triangles*3);const a=mesh.geometry.getAttribute('position').array,expected=new Uint8Array(readRequiredPackedWordsV307(p.positions,p.vertices*3,3,(p as RequiredPackedV307).positionsCodec).buffer);expect(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).toEqual(expected);if(native){const position=mesh.geometry.getAttribute('position'),ix=mesh.geometry.index!;let diagonal=0;for(let j=0;j<ix.count;j+=3){const ids=[ix.getX(j),ix.getX(j+1),ix.getX(j+2)],xs=ids.map(k=>position.getX(k)),ys=ids.map(k=>position.getY(k)),zs=ids.map(k=>position.getZ(k));if(!(xs.every(x=>x===xs[0])||ys.every(y=>y===ys[0])||zs.every(z=>z===zs[0])))diagonal++;}expect(diagonal).toBe(0);}});
   const solids=railSseArchitectureV307Solids(native);expect(solids.length).toBeGreaterThan(100);expect(solids.every(s=>s.low<=s.high&&s.ring.length>=3)).toBe(true);
  }finally{dispose(root);}
 });
 test('measured track cutting is lower than its real streets, above the scene datum',()=>{
  const track=railSseGroundAtV307(1339,-3339);expect(track).not.toBeNull();expect(track!).toBeGreaterThan(8);expect(railSseGroundAtV307(0,0)).toBeNull();expect(railSseGroundAtV307(5430,-1180)).toBeGreaterThan(15);
 });
 test('private admission rejects public labels, altered transforms, cloned paint and disposed geometry',()=>{
  const root=createRailSseArchitectureV307();try{const fake=new Group();fake.userData={...root.userData};expect(hasCompleteRailSseArchitectureV307(fake)).toBe(false);const mesh=root.children[0]as Mesh;mesh.position.y+=1;mesh.updateMatrix();expect(hasCompleteRailSseArchitectureV307(root)).toBe(false);mesh.position.y-=1;mesh.updateMatrix();expect(hasCompleteRailSseArchitectureV307(root)).toBe(true);const day=mesh.material;mesh.material=(day as any).clone();expect(hasCompleteRailSseArchitectureV307(root)).toBe(false);(mesh.material as any).dispose();mesh.material=day;expect(hasCompleteRailSseArchitectureV307(root)).toBe(true);mesh.geometry.dispose();expect(hasCompleteRailSseArchitectureV307(root)).toBe(false);}finally{dispose(root);}
 });
 for(const native of[false,true])test(`only both complete roots replace exact two legacy stations; revocation restores (${native})`,()=>{
  const old=createRailStationsV190(native),model=createRailSseArchitectureV307(native),ground=createRailTerrainContactV307(native),host=new Group();host.add(old,model,ground);try{
   const own=owns(old),wedding=old.children.find(q=>q.userData.stationName==='Wedding')!;expect(own.length).toBeGreaterThan(1);expect(applyRailSseLegacyV307(old,native,false,model,ground)).toBe(false);expect(applyRailSseLegacyV307(old,native,true,model,new Group())).toBe(false);expect(own.every(q=>q.visible)).toBe(true);expect(applyRailSseLegacyV307(old,native,true,model,ground)).toBe(true);expect(own.every(q=>!q.visible)).toBe(true);expect(wedding.visible).toBe(true);host.remove(ground);expect(applyRailSseLegacyV307(old,native,true,model,ground)).toBe(false);expect(own.every(q=>q.visible)).toBe(true);host.add(ground);expect(applyRailSseLegacyV307(old,native,true,model,ground)).toBe(true);expect(applyRailSseLegacyV307(old,native,false,model,ground)).toBe(false);expect(own.every(q=>q.visible)).toBe(true);
  }finally{dispose(host);}
 });
});

test('late real Schwellenraum and Minecraft grades plus GPU parking retain exact legacy admission',async()=>{
 const {setIsoNightPresentation}=await import('../src/IsometricCityWorld');
 const {createMinecraftMaterialState,setMinecraftMaterialPresentation,disposeMinecraftMaterialState}=await import('../src/visual-modes/minecraft/materialMode');
 const {parkStaticInstancesSteps}=await import('../src/losslessStaticStorage');
 const {interleaveStaticGeometry}=await import('../src/interleaveStaticGeometry');
 const state=createMinecraftMaterialState(),old=createRailStationsV190(true),model=createRailSseArchitectureV307(true),ground=createRailTerrainContactV307(true),host=new Group();host.add(old,model,ground);
 try{
  expect(interleaveStaticGeometry(old).geometries).toBeGreaterThan(0);
  finish(parkStaticInstancesSteps(old));old.traverse(q=>{if(q instanceof InstancedMesh){q.instanceMatrix.onUploadCallback();q.instanceColor?.onUploadCallback();}});
  for(const mode of['day','night','schwellenraum','minecraft','day']as const){setIsoNightPresentation(old,mode==='night',true,mode);setMinecraftMaterialPresentation(old,state,mode==='minecraft');setIsoNightPresentation(model,mode==='night',true,mode);setIsoNightPresentation(ground,mode==='night',true,mode);setMinecraftMaterialPresentation(model,state,mode==='minecraft');setMinecraftMaterialPresentation(ground,state,mode==='minecraft');expect(hasCompleteRailSseArchitectureV307(model,true)).toBe(true);expect(hasCompleteRailTerrainContactV307(ground,true)).toBe(true);expect(applyRailSseLegacyV307(old,true,true,model,ground)).toBe(true);expect(owns(old).every(q=>!q.visible)).toBe(true);expect(applyRailSseLegacyV307(old,true,false,model,ground)).toBe(false);expect(owns(old).every(q=>q.visible)).toBe(true);}
 }finally{disposeMinecraftMaterialState(state);dispose(host);}
});

test('core navigation references the actual render buffers and closes on their revocation',async()=>{
 const {createCoreHumboldtNavigationV307}=await import('../src/coreTerrainNavigationV307');const root=createRailTerrainContactV307(false);
 try{const sample=createCoreHumboldtNavigationV307(root,false);expect(sample(1059.92,-3200.14)).toBeGreaterThan(20);expect(sample(0,0)).toBeNull();const mesh=root.children.find(c=>c.name.includes('core:humboldthain:drawn-worker:')&&c.name.includes('smooth parkland lawns'))as Mesh;const old=mesh.geometry.getAttribute('position')as BufferAttribute;mesh.geometry.setAttribute('position',old.clone());expect(sample(1059.92,-3200.14)).toBeNull();mesh.geometry.setAttribute('position',old);expect(sample(1059.92,-3200.14)).toBeGreaterThan(20);}finally{dispose(root);}
});

test('native terrain navigation follows exact centimetre ties, architectural eighths stay independent',()=>{expect(quantizeNativeTerrainHeightV307(12.375)).toBe(12.38);expect(quantizeNativeTerrainHeightV307(12.125)).toBe(12.12);expect(quantizeNativeTerrainHeightV307(3.125)).toBe(3.12);expect(quantizeNativeTerrainHeightV307(3.25)).toBe(3.25);});


test('complete packed roots reject pending pose changes before the renderer updates matrices',()=>{
 const root=createRailSseArchitectureV307(false);try{
  const child=root.children[0] as Mesh, matrix=child.matrix.elements.slice();
  child.position.y+=1;expect(child.matrix.elements).toEqual(matrix);expect(hasCompleteRailSseArchitectureV307(root,false)).toBe(false);child.position.y-=1;
  expect(hasCompleteRailSseArchitectureV307(root,false)).toBe(true);
  child.matrixAutoUpdate=true;expect(hasCompleteRailSseArchitectureV307(root,false)).toBe(false);child.matrixAutoUpdate=false;
  root.quaternion.x=.1;expect(hasCompleteRailSseArchitectureV307(root,false)).toBe(false);root.quaternion.x=0;
  expect(hasCompleteRailSseArchitectureV307(root,false)).toBe(true);
 }finally{dispose(root);}
});

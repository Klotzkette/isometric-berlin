import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {Group,InstancedMesh,Mesh,MeshBasicMaterial,PerspectiveCamera,Vector3} from 'three';
import profile from '../src/data/southWestSitesV326.json';
import recipes from '../src/data/southWestSitesV326Packets.json';
import {createSouthWestSitesV326,createSouthWestSitesV326Steps,hasCompleteSouthWestSitesV326,hasSouthWestSitesRuntimeV326,disposeSouthWestSitesV326} from '../src/SouthWestSitesV326';
import {createPfaueninselPeacocksV326,createPfaueninselPeacockClockV326,PFAUENINSEL_PEACOCKS_V326} from '../src/PfaueninselPeacocksV326';
import {interleaveStaticGeometry} from '../src/interleaveStaticGeometry';
import {freezeStaticSceneTransforms} from '../src/staticSceneTransforms';
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from '../src/losslessStaticStorage';
import {retireSceneMaterialPrograms} from '../src/sceneMaterialPrograms';
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,restoreMinecraftMaterialPresentation,disposeMinecraftMaterialState} from '../src/visual-modes/minecraft/materialMode';
import {prepareSurroundingQuarterPredecessorV303,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {captureSourceQuarterPacketV303,prepareSourceQuarterPacketV303,applySourceQuarterTrianglesV303,sourceQuarterNavigationV303,type SourceQuarterSourceV303} from '../src/SourceQuarterPacketV303';

const repo=resolve(import.meta.dir,'../../..'),publicDir=resolve(repo,'src/app/public/mesh/surrounding-berlin-v159');
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const meshes=(root:Group)=>{const result:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)result.push(o);});return result;};
const fingerprint=(root:Group)=>{const h=createHash('sha256');for(const m of meshes(root)){for(const a of[...Object.values(m.geometry.attributes),m.geometry.index,...(m instanceof InstancedMesh?[m.instanceMatrix,m.instanceColor]:[])]){if(!a)continue;const v=('data'in a?a.data:a).array;h.update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));}}return h.digest('hex');};
const source=recipes as unknown as SourceQuarterSourceV303;
const ownership={schlossplatzV239:true,staatsoperV240:true,architectureV241:true,mitteEnsembleV281:true,prenzlbergV264:true,chariteBridgesV265:true,operaTheatresV274:true,northernSitesV266:true,golgathaV270:true,tachelesFrontsV270:true,southFidelityV294:true,littenStadthausV297:true,wallGalleryV298:true,stralauSisyphosV299:true,neighbourhoodV300:true,westKiezV302:true};

test('whole finite southwest family privately admits both independent representations and identical full touch detail',()=>{
 const snapshot=JSON.stringify(profile);for(const native of[false,true]){const a=createSouthWestSitesV326(native)!,b=createSouthWestSitesV326(native)!;try{
  expect(a).not.toBeNull();expect(a.children).toHaveLength(9);expect(hasCompleteSouthWestSitesV326(a,native)).toBe(true);expect(hasCompleteSouthWestSitesV326(a,!native)).toBe(false);expect(a.userData.fullStaticDetailOnTouch).toBe(true);expect(fingerprint(a)).toBe(fingerprint(b));
  const world=new Group(),hidden=new Group();world.add(hidden);hidden.visible=false;hidden.add(a);expect(hasSouthWestSitesRuntimeV326(world,a,native)).toBe(true);a.removeFromParent();expect(hasSouthWestSitesRuntimeV326(world,a,native)).toBe(false);
  if(native)for(const m of meshes(a))if(m instanceof InstancedMesh){const v=m.instanceMatrix.array;for(let i=0;i<v.length;i+=16)for(const k of[1,2,3,4,6,7,8,9,11])if(v[i+k]!==0)throw Error('Native contains a rotated cube');}
 }finally{disposeSouthWestSitesV326(a);disposeSouthWestSitesV326(b);}}
 expect(JSON.stringify(profile)).toBe(snapshot);expect(hasCompleteSouthWestSitesV326(new Group())).toBe(false);
});

test('real static interleave, material modes, program retirement and lossless postupload parking preserve complete admission',async()=>{
 const root=createSouthWestSitesV326(true)!;try{
  interleaveStaticGeometry(root);freezeStaticSceneTransforms(root);expect(hasCompleteSouthWestSitesV326(root,true)).toBe(true);
  for(const mode of['nightMaterial','schwellenraumMaterial','dayMaterial']){for(const m of meshes(root))m.material=m.userData[mode];expect(hasCompleteSouthWestSitesV326(root,true)).toBe(true);}
  const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);expect(hasCompleteSouthWestSitesV326(root,true)).toBe(true);restoreMinecraftMaterialPresentation(state);disposeMinecraftMaterialState(state);
  expect(retireSceneMaterialPrograms(root)).toBeGreaterThan(0);expect(hasCompleteSouthWestSitesV326(root,true)).toBe(true);
  drain(parkStaticGeometrySteps(root,true));drain(parkStaticInstancesSteps(root));for(const m of meshes(root))if(m instanceof InstancedMesh)m.instanceMatrix.onUploadCallback();await new Promise(r=>setTimeout(r,1));expect(hasCompleteSouthWestSitesV326(root,true)).toBe(true);
 }finally{disposeSouthWestSitesV326(root);}expect(hasCompleteSouthWestSitesV326(root,true)).toBe(false);
});

test('unversioned words, missing members, changed source, foreign material, transform and authored disposal close private gate',()=>{
 const root=createSouthWestSitesV326()!,m=meshes(root).find(q=>q instanceof InstancedMesh)as InstancedMesh;try{
  const v=m.instanceMatrix.array[0];m.instanceMatrix.array[0]=v+.01;expect(hasCompleteSouthWestSitesV326(root)).toBe(false);m.instanceMatrix.array[0]=v;
  const group=m.parent!;group.remove(m);expect(hasCompleteSouthWestSitesV326(root)).toBe(false);group.add(m);
  const name=profile.sites[0].name;profile.sites[0].name+=' forged';expect(hasCompleteSouthWestSitesV326(root)).toBe(false);expect(createSouthWestSitesV326()).toBeNull();profile.sites[0].name=name;
  root.position.y=.1;expect(hasCompleteSouthWestSitesV326(root)).toBe(false);root.position.y=0;
  const old=m.material,foreign=new MeshBasicMaterial();m.material=foreign;expect(hasCompleteSouthWestSitesV326(root)).toBe(false);m.material=old;foreign.dispose();
  expect(hasCompleteSouthWestSitesV326(root)).toBe(true);m.geometry.dispose();expect(hasCompleteSouthWestSitesV326(root)).toBe(false);
 }finally{disposeSouthWestSitesV326(root);}
 const second=createSouthWestSitesV326()!;meshes(second)[0].userData.dayMaterial.dispose();expect(hasCompleteSouthWestSitesV326(second)).toBe(false);disposeSouthWestSitesV326(second);
});

test('every unpublished construction checkpoint closes admission; cancellation removes and releases its partial new root only',()=>{
 for(const checkpoint of[1,3,8,15]){const world=new Group(),old=new Group();world.add(old);let partial:Group|undefined;
  const g=createSouthWestSitesV326Steps(false,q=>{partial=q;world.add(q);});let step=g.next();for(let i=1;i<checkpoint&&!step.done;i++){expect(hasCompleteSouthWestSitesV326(partial!)).toBe(false);step=g.next();}if(!step.done){let disposed=0;for(const m of meshes(partial!))m.geometry.addEventListener('dispose',()=>disposed++);g.return(null);expect(disposed).toBeGreaterThan(0);expect(world.children).toEqual([old]);expect(partial!.children).toHaveLength(0);expect(hasCompleteSouthWestSitesV326(partial!)).toBe(false);}else disposeSouthWestSitesV326(step.value!);
 }
});

test('all nine actual source packets retire exact old words and nav only after their complete current predecessor',()=>{
 const manifest=JSON.parse(readFileSync(resolve(publicDir,'manifest.json'),'utf8'));
 let retired=0,kept=0;for(const key of source.keys){const native=key.startsWith('minecraft:'),id=key.slice(key.indexOf(':')+1),descriptor=manifest.chunks.find((q:any)=>q.id===id),url=descriptor[native?'minecraft':'drawn'].url;
  const bytes=readFileSync(resolve(publicDir,url)),raw=JSON.parse(gunzipSync(bytes).toString())as SurroundingCityChunk,rawText=JSON.stringify(raw),plan=source.packets[key];
  expect(plan.append).toBeUndefined();expect(drain(captureSourceQuarterPacketV303(raw,id,native,false,source,'southwest-sites-v326',true))).toBeUndefined();
  expect(drain(captureSourceQuarterPacketV303(raw,id,native,true,source,'southwest-sites-v326'))).toBeUndefined();
  const ticket=drain(captureSourceQuarterPacketV303(raw,id,native,true,source,'southwest-sites-v326',true));expect(ticket).toBeFunction();
  const prepared=drain(prepareSurroundingQuarterPredecessorV303(raw,id,native,ownership)),preparedText=JSON.stringify(prepared),complete=drain(prepareSourceQuarterPacketV303(prepared,ticket));
  expect(complete).not.toBe(prepared);
  for(let mesh=0;mesh<prepared.meshes.length;mesh++){const packed=Buffer.from(prepared.meshes[mesh].indices,'base64'),before=new Uint32Array(packed.buffer,packed.byteOffset,packed.byteLength/4),after=before.slice(),selected=new Set(plan.retire.find(r=>r.mesh===mesh)?.triangles??[]);expect(drain(applySourceQuarterTrianglesV303(complete,mesh,after,0))).toBe(selected.size);
   for(let tri=0;tri<after.length/3;tri++){const at=tri*3;if(selected.has(tri)){if(after[at]!==before[at]||after[at+1]!==before[at]||after[at+2]!==before[at])throw Error('Incomplete source retirement');retired++;}else{if(after[at]!==before[at]||after[at+1]!==before[at+1]||after[at+2]!==before[at+2])throw Error('Outside primitive changed');kept++;}}
  }
  const nav=sourceQuarterNavigationV303(complete,prepared.nav),remaining=prepared.nav.buildings.slice();for(const r of plan.retireNav){const at=remaining.findIndex(v=>JSON.stringify(v)===JSON.stringify(r));expect(at).toBeGreaterThanOrEqual(0);remaining.splice(at,1);}expect(nav.buildings).toEqual([...remaining,...plan.appendNav]);expect(nav.buildings.length).toBeLessThanOrEqual(20000);
  expect(JSON.stringify(raw)).toBe(rawText);expect(JSON.stringify(prepared)).toBe(preparedText);
  const changed=structuredClone(raw);changed.meshes[0].positions='AAAA'+changed.meshes[0].positions.slice(4);expect(drain(captureSourceQuarterPacketV303(changed,id,native,true,source,'southwest-sites-v326',true))).toBeUndefined();
  expect(readFileSync(resolve(publicDir,url)).equals(bytes)).toBe(true);
 }
 expect(retired).toBe(569);expect(kept).toBeGreaterThan(10000);
});

test('six actual peacocks keep bounded shared-frame buffers, correct white population, cardinal native matrices and mode continuity',()=>{
 const route=profile.peacocks[0],a=route.routeXZ[0],b=route.routeXZ[1],at=new Vector3((a[0]+b[0])/2,4,(a[1]+b[1])/2),camera=new PerspectiveCamera(65,1,.1,2000);camera.position.copy(at).add(new Vector3(8,6,8));camera.lookAt(at);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const clock=createPfaueninselPeacockClockV326();for(const native of[false,true]){const root=createPfaueninselPeacocksV326(native,clock),mesh=root.children[0]as Mesh;try{
  expect(root.userData.geometryBytes).toBeLessThanOrEqual(PFAUENINSEL_PEACOCKS_V326.maxBytes);expect(root.userData.sourcePaths).toEqual(profile.peacocks.map(q=>q.sourcePath));expect(profile.peacocks.filter(q=>q.white)).toHaveLength(2);
  const buffer=mesh instanceof InstancedMesh?mesh.instanceMatrix.array:mesh.geometry.getAttribute('position').array,before=new Uint8Array(buffer.buffer).slice(),initial=clock.elapsedSeconds;
  expect(root.userData.update(1000,camera,false)).toBe(true);expect(root.userData.update(1050,camera,false)).toBe(false);expect(root.userData.update(1100,camera,false)).toBe(true);expect(clock.elapsedSeconds).toBeGreaterThan(initial);
  expect(mesh instanceof InstancedMesh?mesh.instanceMatrix.array:mesh.geometry.getAttribute('position').array).toBe(buffer);expect(new Uint8Array(buffer.buffer)).not.toEqual(before);
  if(mesh instanceof InstancedMesh)for(let i=0;i<mesh.instanceMatrix.array.length;i+=16)for(const k of[1,2,3,4,6,7,8,9,11])if(mesh.instanceMatrix.array[i+k]!==0)throw Error('Animated Native is not cardinal');
  const paused=clock.elapsedSeconds;expect(root.userData.update(99999,camera,true)).toBe(false);expect(clock.elapsedSeconds).toBe(paused);expect(root.userData.update(100000,camera,false)).toBe(true);expect(clock.elapsedSeconds).toBe(paused);
  const parent=new Group();parent.add(root);parent.visible=false;expect(root.userData.update(100200,camera,false)).toBe(false);parent.visible=true;
  camera.position.set(0,100,0);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);expect(root.userData.update(100400,camera,false)).toBe(false);camera.position.copy(at).add(new Vector3(8,6,8));camera.lookAt(at);camera.updateMatrixWorld(true);
  expect(retireSceneMaterialPrograms(root)).toBe(2);expect(root.userData.update(100600,camera,false)).toBe(true);
  root.userData.disposeZooAnimalsV282();expect(root.children).toHaveLength(1);expect(root.userData.update(100800,camera,false)).toBe(false);mesh.geometry.dispose();root.userData.dispose();expect(root.children).toHaveLength(0);expect(root.parent).toBeNull();expect(root.userData.update(101000,camera,false)).toBe(false);
 }finally{root.userData.dispose();}}
 const x=profile.peacocks[0].routeXZ[0][0];try{profile.peacocks[0].routeXZ[0][0]+=.01;expect(()=>createPfaueninselPeacocksV326()).toThrow('changed island routes');}finally{profile.peacocks[0].routeXZ[0][0]=x;}
});

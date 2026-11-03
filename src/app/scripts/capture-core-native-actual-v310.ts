/** Offline complete actual Native source capture. No production source or old receipt is written. */
import {readFileSync,writeFileSync,existsSync,lstatSync}from'node:fs';
import {resolve,dirname,isAbsolute,relative}from'node:path';
import {createHash}from'node:crypto';
import {Group,Mesh,InstancedMesh}from'three';
import {buildMinecraftVoxelWorldSteps,buildColumnToneLookup}from'../src/MinecraftVoxelWorld';
import {preloadAltMitteNativeV169Source}from'../src/AltMitteNativeCoreV169';
import {addRequiredSiteEnvelopesV209Steps}from'../src/RequiredSiteEnvelopesV209';
import {createRosengartenMinecraft}from'../src/Rosengarten';
import {parkStaticInstancesSteps,staticStorageInfo}from'../src/losslessStaticStorage';
import {createMinecraftMaterialState,setMinecraftMaterialPresentation,minecraftOriginalMaterialFor,disposeMinecraftMaterialState}from'../src/visual-modes/minecraft/materialMode';
import {runtimeConstructorOptionsV310,runtimeConstructorOptionsSourceV310}from'../tests/helpers/northRuntimeActualV310';
const repo=resolve(import.meta.dir,'../../..'),base=repo+'/src/app/public/mesh/regierungsviertel/',requested=process.argv[2];
if(!requested||!isAbsolute(requested)||requested.split('/').includes('..'))throw Error('Explicit absolute new external output required');
const out=resolve(requested),inside=relative(repo,out);if(!inside.startsWith('..')||existsSync(out))throw Error('Output must be new and outside the repository');
for(let part=dirname(out);;part=dirname(part)){if(lstatSync(part).isSymbolicLink())throw Error('Symlink output parent is forbidden');if(dirname(part)===part)break;}

const payload=JSON.parse(readFileSync(base+'minecraft-voxels.json','utf8')),prisms=JSON.parse(readFileSync(base+'lod2-prisms.json','utf8')),scene=JSON.parse(readFileSync(base+'scene.json','utf8')),tunnel=scene.tiergartentunnel;if(!tunnel)throw Error('Actual scene tunnel is required');
const options=runtimeConstructorOptionsV310(true,false,prisms),root=new Group(),stages:any[]=[];
const hash=(array:ArrayBufferView)=>{let h=2166136261;for(const byte of new Uint8Array(array.buffer,array.byteOffset,array.byteLength))h=Math.imul(h^byte,16777619)>>>0;return h;};
const b64=(array:ArrayBufferView)=>Buffer.from(array.buffer,array.byteOffset,array.byteLength).toString('base64');
const sha=(raw:string|Uint8Array)=>createHash('sha256').update(raw).digest('hex');
const ground=()=>{const all:InstancedMesh[]=[];root.traverse(o=>{if(o instanceof InstancedMesh&&o.name==='Voxel ground runs')all.push(o);});if(all.length!==1)throw Error('Expected one actual final native ground owner');return all[0];};
const material=(m:any)=>({color:m.color.toArray(),type:m.type,vertexColors:m.vertexColors,roughness:m.roughness,metalness:m.metalness,side:m.side});
const summary=(stage:string)=>{const m=ground();stages.push({stage,count:m.count,matrixHash:hash(m.instanceMatrix.array),colorHash:m.instanceColor?hash(m.instanceColor.array):null,attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([name,a]:any)=>[name,{type:a.array.constructor.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,hash:hash(a.array)}])),index:m.geometry.index?{type:m.geometry.index.array.constructor.name,count:m.geometry.index.count,hash:hash(m.geometry.index.array)}:null,visible:m.visible,fidelityGroundV296:m.userData.fidelityGroundV296??false,material:material(minecraftOriginalMaterialFor(m)??m.userData.dayMaterial??m.material)});console.log(JSON.stringify(stages[stages.length-1]));};
async function drain(steps:Generator<void,unknown>,firstGround=false){let count=0,seen=false;for(;;){const r=steps.next();if(firstGround&&!seen&&root.getObjectByName('Voxel ground runs')){seen=true;summary('first-ground-yield-only-diagnostic');}if(r.done)return r.value;if(++count%16===0)await new Promise(resolve=>setTimeout(resolve,0));}}
await preloadAltMitteNativeV169Source();
await drain(buildMinecraftVoxelWorldSteps(root,payload,buildColumnToneLookup(prisms),tunnel,options),true);summary('complete-native-constructor');
await drain(addRequiredSiteEnvelopesV209Steps(root,true));root.userData.prepareNeukoellnLegacyV305?.();root.add(createRosengartenMinecraft());summary('complete-required-sites-client-cuts');
await drain(parkStaticInstancesSteps(root));summary('after-actual-instance-parking-preparation');
const state=createMinecraftMaterialState();setMinecraftMaterialPresentation(root,state,true);summary('after-actual-native-toon-material-presentation');
// A source array getter may be parked only after a real upload callback. Exercise
// that exact storage callback without claiming this offline capture rendered GPU pixels.
const m=ground();m.instanceMatrix.onUploadCallback();m.instanceColor?.onUploadCallback();summary('after-source-instance-upload-callbacks');root.updateMatrixWorld(true);
const original=minecraftOriginalMaterialFor(m)??m.material,day=m.userData.dayMaterial??original,night=m.userData.nightMaterial??original;
const part={name:m.name,parentName:m.parent?.name,position:m.position.toArray(),scale:m.scale.toArray(),matrix:m.matrix.toArray(),attributes:Object.fromEntries(Object.entries(m.geometry.attributes).map(([name,a]:any)=>[name,{array:b64(a.array),type:a.array.constructor.name,itemSize:a.itemSize,count:a.count,normalized:a.normalized,hash:hash(a.array)}])),index:m.geometry.index?{array:b64(m.geometry.index.array),type:m.geometry.index.array.constructor.name,count:m.geometry.index.count,hash:hash(m.geometry.index.array)}:null,instances:{count:m.count,matrix:b64(m.instanceMatrix.array),matrixHash:hash(m.instanceMatrix.array),colors:m.instanceColor?b64(m.instanceColor.array):null,colorHash:m.instanceColor?hash(m.instanceColor.array):null},materials:{day:material(day),night:material(night)}};
const proof={key:'minecraft',parts:[part],production:'Complete actual ThreeViewer native constructor options evaluated from AST, actual sourcePrisms/tone lookup/tunnel, full generator, complete RequiredSites/clientcuts, later v296 ground mutation, exact instance parking and actual Toon binding. Offline source witness only; no GPU render claim.',stageOptions:{native:true,mobileLike:false,options,optionsSourceSha256:sha(runtimeConstructorOptionsSourceV310(true)),sceneSha256:sha(readFileSync(base+'scene.json')),tunnelSha256:sha(JSON.stringify(tunnel)),prismsSha256:sha(readFileSync(base+'lod2-prisms.json')),payloadSha256:sha(readFileSync(base+'minecraft-voxels.json')),constructorStages:stages,finalInstanceStorage:{matrix:staticStorageInfo(m.instanceMatrix),color:m.instanceColor?staticStorageInfo(m.instanceColor):null}}};
writeFileSync(out,JSON.stringify(proof),{flag:'wx',mode:0o600});console.log(JSON.stringify({out,sha256:sha(readFileSync(out)),count:m.count,matrixHash:part.instances.matrixHash,colorHash:part.instances.colorHash}));
disposeMinecraftMaterialState(state);const resources=new Set<any>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);for(const material of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(material?.dispose)resources.add(material);if(o instanceof InstancedMesh)resources.add(o);}});for(const resource of resources)resource.dispose();root.clear();

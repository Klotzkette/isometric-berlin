import {describe,expect,test} from 'bun:test';
import {BufferAttribute,Group,InstancedMesh,InterleavedBufferAttribute,Mesh,OrthographicCamera,Scene,type Material,type WebGLRenderer} from 'three';
import {createHospitalArchitectureV308,hasCompleteHospitalArchitectureV308} from '../src/HospitalArchitectureV308';
import {applyHospitalPreviousV308} from '../src/HospitalArchitectureV308Previous';
import {createHospitalRecognitionV228} from '../src/HospitalRecognitionV228';
import {createHospitalEnvelopesV228} from '../src/HospitalEnvelopesV228';
import {createBundeswehrHospitalV214} from '../src/BundeswehrHospitalV214';
import {createSceneGeometryGpuResidency} from '../src/sceneGeometryGpuResidency';
import {createSceneGpuResidency} from '../src/sceneGpuResidency';
import {interleaveStaticGeometry} from '../src/interleaveStaticGeometry';
import {parkStaticGeometrySteps,parkStaticInstancesSteps} from '../src/losslessStaticStorage';
function done<T>(g:Generator<unknown,T>){let q=g.next();while(!q.done)q=g.next();return q.value;}
function setup(native:boolean){const world=new Group(),legacy=new Group(),replacement=createHospitalArchitectureV308(native);legacy.add(createHospitalRecognitionV228(native),createHospitalEnvelopesV228(native),createBundeswehrHospitalV214(native));world.add(legacy,replacement);interleaveStaticGeometry(legacy);done(parkStaticGeometrySteps(legacy,true));done(parkStaticInstancesSteps(legacy));const seen=new Set<object>();legacy.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes)){const s=a instanceof InterleavedBufferAttribute?a.data:a;if(!seen.has(s)){seen.add(s);s.onUploadCallback();}}o.geometry.index?.onUploadCallback();if(o instanceof InstancedMesh){o.instanceMatrix.onUploadCallback();o.instanceColor?.onUploadCallback();}}});return{world,legacy,replacement};}
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m)resources.add(m);if(o instanceof InstancedMesh)resources.add(o);}});for(const r of resources)r.dispose();root.clear();}
describe('hospital actual GPU lifetime and metadata fastpath v309',()=>{
 for(const native of [false,true])test(`real eligible managers retire and reupload unchanged source without revoking ownership (${native})`,()=>{
  const {world,legacy,replacement}=setup(native),scene=new Scene(),camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.z=10;camera.lookAt(0,0,0);scene.add(world);scene.updateMatrixWorld(true);
  const renderer={info:{render:{frame:0}},domElement:new EventTarget(),getContext:()=>({isContextLost:()=>false})}as unknown as WebGLRenderer;
  const geometry=createSceneGeometryGpuResidency(renderer,camera,{budgetBuffers:0,budgetBytes:0,graceMs:0,now:()=>0}),instances=createSceneGpuResidency(renderer,camera,{budgetBytes:0,budgetBuffers:0,graceMs:0,now:()=>0});
  instances.enqueue(world);geometry.enqueue(world);
  const draw=()=>world.traverse(o=>{if(o instanceof Mesh){renderer.info.render.frame++;o.onAfterRender(renderer,scene,camera,o.geometry,(Array.isArray(o.material)?o.material[0]:o.material)as Material,null);}});
  draw();expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(true);
  world.visible=false;expect(instances.refresh(10,true)).toBeGreaterThan(0);expect(geometry.refresh(10,true)).toBeGreaterThan(0);world.visible=true;
  expect(hasCompleteHospitalArchitectureV308(replacement,native)).toBe(true);expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(true);
  draw();expect(instances.residentBuffers).toBeGreaterThan(0);expect(geometry.residentBuffers).toBeGreaterThan(0);expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(true);
  geometry.release(world);instances.release(world);geometry.dispose();instances.dispose();
  const source=legacy.children[0].children.find(o=>o instanceof Mesh&&!o.visible)!as Mesh;source.geometry.dispose();
  expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(false);expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(false);dispose(world);
 });
 for(const native of [false,true])test(`applied sync does not read the large parked instance matrix (${native})`,()=>{
  const {world,legacy,replacement}=setup(native);expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(true);
  done(parkStaticInstancesSteps(legacy));const ward=legacy.children[0].children.find(o=>o instanceof InstancedMesh&&!o.visible&&typeof Object.getOwnPropertyDescriptor(o.instanceMatrix,'array')?.get==='function')as InstancedMesh;expect(ward).toBeDefined();
  const descriptor=Object.getOwnPropertyDescriptor(ward.instanceMatrix,'array')!;expect(typeof descriptor.get).toBe('function');let reads=0;
  Object.defineProperty(ward.instanceMatrix,'array',{...descriptor,get(){reads++;return descriptor.get!.call(this);}});
  for(let i=0;i<8;i++)expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(true);
  expect(reads).toBe(0);Object.defineProperty(ward.instanceMatrix,'array',descriptor);
  ward.instanceMatrix.needsUpdate=true;expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(false);
  expect(legacy.children[0].children.every(o=>o.visible)).toBe(true);expect(applyHospitalPreviousV308(world,native,true,replacement)).toBe(true);dispose(world);
 });
 test('changed backing identity, local pose and authored replacement disposal close immediately',()=>{
  for(const kind of ['storage','pose','dispose']as const){const{world,legacy,replacement}=setup(false);expect(applyHospitalPreviousV308(world,false,true,replacement)).toBe(true);const source=legacy.children[0].children.find(o=>o instanceof InstancedMesh&&!o.visible)as InstancedMesh;
   if(kind==='storage'){const a=source.instanceColor!;source.instanceColor=new BufferAttribute(a.array.slice(),a.itemSize)as typeof source.instanceColor;}
   if(kind==='pose')source.position.x+=1;
   if(kind==='dispose')(replacement.children[0]as Mesh).geometry.dispose();
   expect(applyHospitalPreviousV308(world,false,true,replacement)).toBe(false);expect(legacy.children[0].children.every(o=>o.visible)).toBe(true);dispose(world);}
 });
});

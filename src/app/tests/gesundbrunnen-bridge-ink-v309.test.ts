import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Group,LineBasicMaterial,LineSegments,Material,Mesh,OrthographicCamera,Scene,type WebGLRenderer} from 'three';
import {createGesundbrunnenRoadBridgesStepsV309,createGesundbrunnenRoadBridgesV309,hasCompleteGesundbrunnenRoadBridgesV309} from '../src/GesundbrunnenRoadBridgesV309';
import {prepareGesundbrunnenBridgeInkV309Steps} from '../src/GesundbrunnenBridgeInkV309';
import {createSceneGeometryGpuResidency} from '../src/sceneGeometryGpuResidency';
import {parkStaticGeometrySteps} from '../src/losslessStaticStorage';
import {markArchitecturalInk,applyArchitecturalInkMode} from '../src/architecturalInk';
import data from '../src/data/gesundbrunnenBridgeInkV309.json';
import {assignStableInkRenderOrder,STABLE_INK_RENDER_ORDER_SPAN} from '../src/ThreeViewer';
import {hasAuthoredOrStableInkRenderOrderV310} from '../src/stableInkRenderOrderV310';
import {createRestoredRoadBatch} from '../src/restoredRoadSurfaces';
import {smoothGroundTopSampler} from '../src/terrainPayload';
import {spreebogenTerrainYAt} from '../src/spreebogenBankProfile';
import {serializeObject3DForTransfer,deserializeTransferredObject3D} from '../src/transferableObject3D';
import {cutRosenthalerPresentationV228} from '../src/RosenthalerSurfaceAperturesV228';
import {cutUbahnPresentationV261} from '../src/UbahnSurfaceAperturesV261';
import {cutUbahnPresentationV281} from '../src/UbahnSurfaceAperturesV281';
const retained=JSON.parse(gunzipSync(readFileSync(new URL('../../../geo_data/regierungsviertel/gesundbrunnen-bridge-ink-v309-source.json.gz',import.meta.url))).toString()).capture;
const done=<T>(steps:Generator<void,T>):T=>{for(;;){const next=steps.next();if(next.done)return next.value;}};
function fixture(native=false){
 const world=new Group(),family=new Group();family.name=retained.parentName;family.userData.progressiveWorldBatchId=retained.sourceBatchId;world.add(family);
 const g=new BufferGeometry();for(const[k,a]of Object.entries(retained.attributes)as [string,{array:string;type:string;itemSize:number;normalized:boolean}][]){const bytes=Buffer.from(a.array,'base64');if(a.type!=='Float32Array')throw Error('Unexpected retained source attribute');g.setAttribute(k,new BufferAttribute(new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),a.itemSize,a.normalized));}
 const bytes=Buffer.from(retained.index.array,'base64');g.setIndex(new BufferAttribute(new Uint16Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),1));g.computeBoundingBox();g.computeBoundingSphere();
 const line=new LineSegments(g,markArchitecturalInk(new LineBasicMaterial(),'detail'));line.name=retained.name;line.renderOrder=retained.renderOrder;if(!native)family.add(line);
 const replacement=createGesundbrunnenRoadBridgesV309(native);world.add(replacement);return{world,family,line,replacement,original:g};
}
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){resources.add(o.geometry);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m instanceof Material)resources.add(m);}});for(const resource of resources)resource.dispose();root.clear();}
async function realTransferredCoreFixture(){
 const base=new URL('../public/mesh/regierungsviertel/',import.meta.url),ground=await Bun.file(new URL('ground-context.json',base)).json();ground.ground_rows=[];
 const sample=smoothGroundTopSampler(ground),terrain=(x:number,z:number)=>spreebogenTerrainYAt(x,z,sample(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx));
 const lines=(await Bun.file(new URL('../src/data/restoredRoadSurfaces.ndjson.txt',import.meta.url)).text()).trim().split('\n'),batch=lines.slice(1).map(s=>JSON.parse(s)).find(q=>q.id===data.source.batchId);expect(batch).toBeDefined();
 const built=createRestoredRoadBatch(batch,terrain),family=deserializeTransferredObject3D(serializeObject3DForTransfer(built).object)as Group;
 cutRosenthalerPresentationV228(family,false);cutUbahnPresentationV261(family,false);cutUbahnPresentationV281(family,false);family.userData.progressiveWorldBatchId=batch.id;family.userData.progressiveWorldBatch=true;
 const world=new Group();world.name='Drawn isometric city (LoD2 prisms + ink lines)';world.add(family);const line=family.children.find(o=>o instanceof LineSegments)as LineSegments;
 const replacement=createGesundbrunnenRoadBridgesV309();world.add(replacement);dispose(built);return{world,family,line,replacement,original:line.geometry};
}
describe('source exact curb ink and atomic bridge ownership v309',()=>{
 test('the actual viewer assignment preserves exact ranks, private line identity and authored layers',()=>{
  const a=new LineSegments(new BufferGeometry(),new LineBasicMaterial()),b=new LineSegments(new BufferGeometry(),new LineBasicMaterial()),c=new LineSegments(new BufferGeometry(),new LineBasicMaterial());a.renderOrder=b.renderOrder=2;c.renderOrder=3;
  assignStableInkRenderOrder([c,b,a]);expect(a.renderOrder).toBe(2+STABLE_INK_RENDER_ORDER_SPAN/3);expect(b.renderOrder).toBe(2+2*STABLE_INK_RENDER_ORDER_SPAN/3);expect(c.renderOrder).toBe(3+STABLE_INK_RENDER_ORDER_SPAN/2);
  expect(hasAuthoredOrStableInkRenderOrderV310(a,2)).toBe(true);expect(hasAuthoredOrStableInkRenderOrderV310(a.clone(),2)).toBe(false);a.renderOrder=2;expect(hasAuthoredOrStableInkRenderOrderV310(a,2)).toBe(false);assignStableInkRenderOrder([a,b,c]);expect(hasAuthoredOrStableInkRenderOrderV310(a,2)).toBe(true);
  a.userData.stableInkBaseRenderOrder=9;assignStableInkRenderOrder([a,b,c]);expect(hasAuthoredOrStableInkRenderOrderV310(a,2)).toBe(false);for(const line of[a,b,c]){line.geometry.dispose();line.material.dispose();}
 });
 test('real transferred Core ink admits actual stable assignment and later legitimate reranking; manual rank changes restore source',async()=>{
  const f=await realTransferredCoreFixture();try{
   const all:LineSegments[]=[];f.world.traverse(o=>{if(o instanceof LineSegments)all.push(o);});assignStableInkRenderOrder(all as LineSegments<BufferGeometry,LineBasicMaterial>[]);expect(f.line.renderOrder).not.toBe(data.source.renderOrder);expect(hasAuthoredOrStableInkRenderOrderV310(f.line,data.source.renderOrder)).toBe(true);
   const tx=done(prepareGesundbrunnenBridgeInkV309Steps(f.world,false,true,f.replacement));expect(tx).not.toBeNull();expect(tx!.commit(true)).toBe(true);expect(tx!.complete()).toBe(true);
   const later=new LineSegments(new BufferGeometry(),new LineBasicMaterial());later.renderOrder=2;f.world.add(later);assignStableInkRenderOrder([...all,later]as LineSegments<BufferGeometry,LineBasicMaterial>[]);expect(tx!.complete()).toBe(true);
   f.line.renderOrder=2;expect(tx!.complete()).toBe(false);expect(tx!.commit(true)).toBe(false);expect(f.line.geometry).toBe(f.original);
  }finally{dispose(f.world);}
 });
 test('required replacement ink accepts real reranks and rejects a manually changed child order',()=>{
  const f=fixture();try{const all:LineSegments<BufferGeometry,LineBasicMaterial>[]=[];f.world.traverse(o=>{if(o instanceof LineSegments&&o.material instanceof LineBasicMaterial)all.push(o as LineSegments<BufferGeometry,LineBasicMaterial>);});assignStableInkRenderOrder(all);
   const tx=done(prepareGesundbrunnenBridgeInkV309Steps(f.world,false,true,f.replacement))!;expect(tx.commit(true)).toBe(true);expect(hasCompleteGesundbrunnenRoadBridgesV309(f.replacement)).toBe(true);
   const ink=f.replacement.children[1].children[0]as LineSegments;ink.renderOrder+=.001;expect(hasCompleteGesundbrunnenRoadBridgesV309(f.replacement)).toBe(false);expect(tx.complete()).toBe(false);expect(tx.commit(true)).toBe(false);expect(f.line.geometry).toBe(f.original);
  }finally{dispose(f.world);}
 });
 test('public stable-rank markers alone never admit unchanged source words',()=>{
  for(const rank of[2,2.00005]){const f=fixture();try{f.line.userData.stableInkBaseRenderOrder=2;f.line.renderOrder=rank;expect(done(prepareGesundbrunnenBridgeInkV309Steps(f.world,false,true,f.replacement))).toBeNull();expect(f.line.geometry).toBe(f.original);}finally{dispose(f.world);}}
 });
 test('the actual transferred line stays untouched during staging; only six source segments yield and rollback restores the exact reference',()=>{
  const f=fixture(),oldIndex=f.original.index!.array.slice();try{
   const tx=done(prepareGesundbrunnenBridgeInkV309Steps(f.world,false,true,f.replacement))!;expect(tx).not.toBeNull();expect(f.line.geometry).toBe(f.original);expect(tx.complete()).toBe(false);
   expect(tx.commit(true)).toBe(true);expect(tx.complete()).toBe(true);expect(f.line.geometry).not.toBe(f.original);const next=f.line.geometry.index!.array;
   const retired=new Set(data.retireSegments);for(let i=0;i<oldIndex.length;i++)expect(next[i]).toBe(i%2&&retired.has(Math.floor(i/2))?oldIndex[i-1]:oldIndex[i]);
   expect(f.original.index!.array).toEqual(oldIndex);expect(f.line.geometry.getAttribute('position').array).toEqual(f.original.getAttribute('position').array);
   applyArchitecturalInkMode(f.line.material as LineBasicMaterial,'night');expect(tx.complete()).toBe(true);tx.rollback();expect(f.line.geometry).toBe(f.original);expect(tx.complete()).toBe(false);expect(tx.commit(true)).toBe(false);
  }finally{dispose(f.world);}
 });
 test('full source words, live gates, poses, versions and authored lifetime all fail closed',()=>{
  for(const problem of['closed','bytes','clone','pose','version','disposed','missing']as const){const f=fixture();try{
   if(problem==='bytes')f.original.getAttribute('position').array[0]+=.125;
   if(problem==='clone'){f.replacement.removeFromParent();f.world.add(f.replacement.clone());}
   const tx=done(prepareGesundbrunnenBridgeInkV309Steps(f.world,false,problem!=='closed',problem==='clone'?f.world.children[1]as Group:f.replacement));
   if(problem==='closed'||problem==='bytes'||problem==='clone'){expect(tx).toBeNull();continue;}
   expect(tx).not.toBeNull();if(problem==='pose')f.line.position.x=.1;if(problem==='version')f.original.index!.needsUpdate=true;if(problem==='disposed')f.original.dispose();if(problem==='missing')f.replacement.removeFromParent();
   expect(tx!.commit(true)).toBe(false);expect(f.line.geometry).toBe(f.original);expect(tx!.complete()).toBe(false);
  }finally{dispose(f.world);if(!f.replacement.parent)dispose(f.replacement);}}
 });
 test('cancelling after the private clone is allocated disposes it without altering the source',()=>{
  const f=fixture(),clone=f.original.clone.bind(f.original);let staged:BufferGeometry|undefined,disposed=0;f.original.clone=()=>{staged=clone();staged.addEventListener('dispose',()=>disposed++);return staged;};
  try{const steps=prepareGesundbrunnenBridgeInkV309Steps(f.world,false,true,f.replacement);expect(steps.next().done).toBe(false);expect(steps.next().done).toBe(false);expect(staged).toBeDefined();expect(f.line.geometry).toBe(f.original);steps.return(null);expect(disposed).toBe(1);expect(f.line.geometry).toBe(f.original);}finally{dispose(f.world);}
 });
 test('real geometry manager rebind and offscreen retirement preserve the line transaction and parking',()=>{
  const f=fixture(),scene=new Scene(),camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.z=10;camera.lookAt(0,0,0);scene.add(f.world);scene.updateMatrixWorld(true);
  const renderer={info:{render:{frame:0}},domElement:new EventTarget(),getContext:()=>({isContextLost:()=>false})}as unknown as WebGLRenderer;
  const manager=createSceneGeometryGpuResidency(renderer,camera,{budgetBytes:0,budgetBuffers:0,graceMs:0,now:()=>0});let callbacks=0;
  const register=()=>manager.enqueue(f.world),draw=()=>{renderer.info.render.frame++;f.line.onAfterRender(renderer,scene,camera,f.line.geometry,f.line.material as Material,null);};
  try{register();draw();const tx=done(prepareGesundbrunnenBridgeInkV309Steps(f.world,false,true,f.replacement))!;
   expect(tx.commit(true,(object,kind)=>{callbacks++;expect(object).toBe(f.line);expect(kind).toBe('geometry');return manager.retireForRebind(object);})).toBe(true);register();draw();expect(tx.complete()).toBe(true);
   done(parkStaticGeometrySteps(f.line,true));for(const a of Object.values(f.line.geometry.attributes))if(a instanceof BufferAttribute)a.onUploadCallback();f.line.geometry.index?.onUploadCallback();expect(tx.complete()).toBe(true);
   f.world.visible=false;expect(manager.refresh(10,true)).toBeGreaterThan(0);f.world.visible=true;expect(tx.complete()).toBe(true);draw();expect(manager.residentBuffers).toBeGreaterThan(0);tx.rollback();expect(callbacks).toBe(2);expect(f.line.geometry).toBe(f.original);register();draw();expect(manager.residentBuffers).toBeGreaterThan(0);
  }finally{manager.release(f.world);manager.dispose();dispose(f.world);}
 });
 test('native admission has no borrowed smooth line; it requires the same complete attached replacement',()=>{
  const f=fixture(true);try{const tx=done(prepareGesundbrunnenBridgeInkV309Steps(f.world,true,true,f.replacement))!;expect(tx.commit(true)).toBe(true);expect(tx.complete()).toBe(true);f.replacement.removeFromParent();expect(tx.complete()).toBe(false);tx.rollback();f.world.add(f.replacement);f.family.add(f.line);expect(done(prepareGesundbrunnenBridgeInkV309Steps(f.world,true,true,f.replacement))).toBeNull();}finally{dispose(f.world);}
 });
 test('cooperative complete-model cancellation owns and disposes every allocated body, ink and approach material once',()=>{
  for(const phase of['body','approach']){let root:Group|undefined;const steps=createGesundbrunnenRoadBridgesStepsV309(false,{},next=>{root=next;});let turns=0;
   for(;;){const next=steps.next();expect(next.done).toBe(false);if(++turns>2000)throw Error('Missing cooperative bridge phase');if(phase==='body'?!!root?.children[0]?.children.length:!!root?.children[2]?.children.length)break;}
   const counts=new Map<{dispose():void},number>();root!.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){for(const r of[o.geometry,o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(r&&typeof r.dispose==='function'&&!counts.has(r)){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1));}}});
   expect(counts.size).toBeGreaterThan(0);expect(hasCompleteGesundbrunnenRoadBridgesV309(root!)).toBe(false);steps.return(undefined as never);expect(root!.children).toHaveLength(0);for(const count of counts.values())expect(count).toBe(1);
  }
 });
});

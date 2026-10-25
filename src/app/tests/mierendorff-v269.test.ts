import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Mesh,OrthographicCamera,Raycaster,Vector3} from 'three';
import data from '../src/data/mierendorffV269.json';
import {prepareMierendorffV269,applyMierendorffTrianglesV269,mierendorffNavigationV269,mierendorffFloorAtV269,MIERENDORFF_KIND_V269} from '../src/MierendorffV269';
import {createSurroundingCityChunk,surroundingBuildingSolidAt,type SurroundingCityChunk} from '../src/SurroundingCityGeometry';
import {createSurroundingCity,disposeSurroundingCityRoot} from '../src/SurroundingCity';
import {createPedestrianState,stepPedestrian,type PedestrianEnvironment} from '../src/pedestrianNavigation';
const complete=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const packet=(tile:string,native:boolean)=>JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${tile}.${native?'minecraft':'drawn'}.json.gz`,import.meta.url))).toString()) as SurroundingCityChunk;
const indices=(text:string)=>{const b=Uint8Array.fromBase64(text);return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);};

test('existing packets, earlier details and every unreceipted triangle stay unchanged',()=>{
 for(const [key,plan] of Object.entries(data.packets)){
  const [mode,tile]=key.split(':'),native=mode==='minecraft',raw=packet(tile,native),snapshot=JSON.stringify(raw);
  const extra={...raw.meshes[0],kind:'previous-additive-detail'},before={...raw,meshes:[...raw.meshes,extra]};
  const prepared=complete(prepareMierendorffV269(before,tile,native));
  expect(prepared).not.toBe(before);expect(prepared.nav).toBe(raw.nav);expect(prepared.lines).toBe(raw.lines);
  for(let i=0;i<before.meshes.length;i++)expect(prepared.meshes[i]).toBe(before.meshes[i]);
  expect(complete(prepareMierendorffV269(prepared,tile,native))).toBe(prepared);
  expect(complete(prepareMierendorffV269({...raw,nav:{...raw.nav,groundY:5.2}},tile,native)).meshes.length).toBe(raw.meshes.length);
  let retired=0;
  for(const [mi,mesh]of raw.meshes.entries()){
   const old=indices(mesh.indices),actual=old.slice();retired+=complete(applyMierendorffTrianglesV269(prepared,mi,actual,0));
   const selected=new Set(plan.transfers.filter(t=>t.mesh===mi).flatMap(t=>t.triangles));let kept=true;
   for(let t=0;t<old.length/3;t++)if(!selected.has(t))for(let j=0;j<3;j++)kept&&=actual[t*3+j]===old[t*3+j];
   expect(kept).toBe(true);
  }
  expect(retired).toBe(plan.transfers.reduce((n,r)=>n+r.triangles.length,0));
  expect(JSON.stringify(raw)).toBe(snapshot);
  const nav=mierendorffNavigationV269(prepared,raw.nav);
  expect(nav.buildings.slice(0,raw.nav.buildings.length)).toEqual(raw.nav.buildings);
  expect(nav.ground).toBe(raw.nav.ground);expect(nav.water).toBe(raw.nav.water);
  expect(mierendorffNavigationV269(prepared,nav)).toBe(nav);
 }
});

test('both actual production decoders publish open mouths with rendered support at every tread',()=>{
 for(const native of [false,true]){
  const raw=packet('-9_-2',native),result=createSurroundingCityChunk(raw,'-9_-2',native);
  expect(result.root.userData.sourceKinds).toContain(MIERENDORFF_KIND_V269);
  expect(result.root.userData.mierendorffTransferredTrianglesV269).toBe(data.packets[native?'minecraft:-9_-2':'drawn:-9_-2'].transfers.reduce((n,r)=>n+r.triangles.length,0));
  result.root.updateMatrixWorld(true);const meshes:Mesh[]=[];result.root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
  const ray=new Raycaster();
  for(const run of data.profile.runs){
   for(let i=0;i<=run.stepCount;i++){
    const u=i<run.stepCount?(i+.5)*(run.length-run.landing)/run.stepCount:run.length-run.landing/2;
    const x=run.top[0]+run.d[0]*u,z=run.top[1]+run.d[1]*u;
    const floor=mierendorffFloorAtV269(result.nav,x-result.origin[0],z-result.origin[2]);
    expect(floor).not.toBeNull();
    ray.set(new Vector3(x,12,z),new Vector3(0,-1,0));
    const hit=ray.intersectObjects(meshes,false)[0];
    expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(floor!,2);
    expect(surroundingBuildingSolidAt(result.nav,x-result.origin[0],floor!+1,z-result.origin[2],.42),`${native} ${run.id} step ${i}`).toBe(false);
   }
  }
  expect(mierendorffFloorAtV269(raw.nav,100,100)).toBeNull();
  disposeSurroundingCityRoot(result.root);
 }
});

test('real streamed city retains all four stair return paths in both packet orders and modes',async()=>{
 const assetRoot=new URL('../public/mesh/surrounding-berlin-v159/',import.meta.url);
 const originalManifest=JSON.parse(readFileSync(new URL('manifest.json',assetRoot),'utf8'));
 for(const reverse of [false,true])for(const native of [false,true]){
  const selected=originalManifest.chunks.filter((d:{id:string})=>['-9_-2','district188--9_-2'].includes(d.id));
  if(reverse)selected.reverse();
  const manifest={...originalManifest,chunks:selected};
  const camera=new OrthographicCamera(-300,300,300,-300,1,3000);camera.position.set(-4500,450,-900);camera.up.set(0,0,-1);camera.lookAt(-4500,0,-900);camera.updateMatrixWorld();
  const errors:string[]=[];
  const city=createSurroundingCity({camera,mode:native?'minecraft':'day',manifestUrl:new URL('https://mierendorff.test/manifest.json'),onError:e=>errors.push(e),
   fetch:(async(input:URL|RequestInfo)=>{const name=new URL(String(input)).pathname.slice(1);return name==='manifest.json'?Response.json(manifest):new Response(readFileSync(new URL(name,assetRoot)));}) as typeof fetch});
  try{
   await city.ready;for(let i=0;i<400&&city.pending;i++)await new Promise(r=>setTimeout(r,2));
   expect(errors).toEqual([]);expect(city.residentChunkCount).toBe(2);
   const e:PedestrianEnvironment={bounds:{minX:-4770,maxX:-4260,minZ:-1060,maxZ:-620},water:[],groundAt:city.groundAt,interiorSolidAt:city.solidAt};
   for(const dt of [.016,.05,.1])for(const run of data.profile.runs){
    const at=(u:number)=>[run.top[0]+run.d[0]*u,run.top[1]+run.d[1]*u];const start=at(-1.1),bottom=at(run.length-run.landing/2);
    let state=createPedestrianState(e,{x:start[0],z:start[1],yaw:0,groundYHint:city.groundAt(start[0],start[1])!});
    for(const target of [bottom,start]){
     let frames=0;
     while(Math.hypot(state.x-target[0],state.z-target[1])>.07&&frames++<300){
      const distance=Math.hypot(state.x-target[0],state.z-target[1]);state.yaw=Math.atan2(target[0]-state.x,-(target[1]-state.z));
      const step=stepPedestrian(state,{forward:Math.min(1,distance/(13*dt)),strafe:0,turn:0,look:0,sprint:false},dt,e);expect(step.respawned).toBe(false);state=step.state;
     }
     expect(frames,`${native} ${run.id} dt${dt}`).toBeLessThan(300);
     expect(state.groundY).toBeCloseTo(target===bottom?3.12-run.descent:city.groundAt(start[0],start[1])!,2);
    }
   }
  }finally{city.dispose();}
  expect(city.residentGeometryBytes).toBe(0);expect(city.navigationTiles.length).toBe(0);
 }
});

test('actual oblique QA view sees descending treads through both real overlapping packets',()=>{
 for(const native of [false,true]){
  const entries=['-9_-2','district188--9_-2'].map(id=>createSurroundingCityChunk(packet(id,native),id,native));
  try{
   const meshes:Mesh[]=[];for(const e of entries){e.root.updateMatrixWorld(true);e.root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});}
   const run=data.profile.runs.find(r=>r.id==='way/516635754')!;
   const eye=new Vector3(-4425,18,-879.36),ray=new Raycaster();let visible=0;
   for(let i=0;i<=run.stepCount;i++){
    const u=i<run.stepCount?(i+.5)*(run.length-run.landing)/run.stepCount:run.length-run.landing/2;
    const target=new Vector3(run.top[0]+run.d[0]*u,3.12-i*run.descent/run.stepCount,run.top[1]+run.d[1]*u);
    ray.set(eye,target.clone().sub(eye).normalize());const hit=ray.intersectObjects(meshes,false)[0];
    if(hit&&hit.point.distanceTo(target)<.02)visible++;
   }
   expect(visible).toBeGreaterThanOrEqual(24);
   // Rendering cannot rely on directional light: the drawn material is unlit.
   // Each real tread level therefore has both pale support and dark coplanar
   // edge triangles in the production geometry, without changing floor height.
   const plan=data.packets[native?'minecraft:-9_-2':'drawn:-9_-2'];
   const body=meshes[0],positions=body.geometry.getAttribute('position'),colours=body.geometry.getAttribute('color'),ix=body.geometry.index!;
   for(const floor of plan.floors.filter(f=>f.sourceId===run.id)){
    const tones=new Set<number>();
    for(let i=0;i<ix.count;i+=3){
     const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
     if(!ids.every(v=>Math.abs(positions.getY(v)*.01+entries[0].origin[1]-floor.y)<.001))continue;
     const x=ids.reduce((n,v)=>n+positions.getX(v),0)/300+entries[0].origin[0],z=ids.reduce((n,v)=>n+positions.getZ(v),0)/300+entries[0].origin[2];
     const dx=x-run.top[0],dz=z-run.top[1],u=dx*run.d[0]+dz*run.d[1],v=dx*run.n[0]+dz*run.n[1];
     if(u>=0&&u<=run.length&&Math.abs(v)<run.width/2)tones.add(Math.round(colours.getX(ids[0])*255));
    }
    expect(tones.size).toBeGreaterThanOrEqual(2);
   }
  }finally{for(const e of entries)disposeSurroundingCityRoot(e.root);}
 }
});

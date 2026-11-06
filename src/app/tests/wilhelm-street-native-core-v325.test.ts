/** Original real Full/Touch captured rows, not a fabricated constructor or
 * synthetic prism approximation. The bounded fixture leaves every outside row. */
import{expect,test}from"bun:test";
import{readFileSync}from"node:fs";
import{gunzipSync}from"node:zlib";
import{BufferAttribute,BufferGeometry,Group,InstancedBufferAttribute,InstancedMesh,MeshStandardMaterial}from"three";
import sources from"../src/data/wilhelmStreetFrontsV325Sources.json";
import{wilhelmStreetFrontsCorePlanV325}from"../src/WilhelmStreetFrontsV325Core";
import{createExactOwnersSourceV321,stageExactOwnersV321Steps}from"../src/ExactOwnersV321";
import{bindWilhelmStreetFrontsV325SourcesSteps}from"../src/WilhelmStreetFrontsV325Sources";
import{createWilhelmStreetFrontsV325Steps,hasCompleteWilhelmStreetFrontsV325,disposeWilhelmStreetFrontsV325}from"../src/WilhelmStreetFrontsV325";
const repo=new URL("../../../",import.meta.url),read=(p:string)=>JSON.parse(readFileSync(new URL(p,repo),"utf8")),prisms=read("src/app/public/mesh/regierungsviertel/lod2-prisms.json").buildings,voxels=read("src/app/public/mesh/regierungsviertel/minecraft-voxels.json");
const evidence=JSON.parse(gunzipSync(readFileSync(new URL("geo_data/regierungsviertel/wilhelm-street-v325-evidence.json.gz",repo))).toString()),core={schemaVersion:1 as const,sourceParents:[],drawnChunks:[],minecraftChunks:sources.nativePackets.map(p=>({id:p.id,packet:read(p.file)}))};
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
const bytes=(s:string)=>Uint8Array.from(Buffer.from(s,"base64"));
const hash=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString("base64");
function captured(part:any){const g=new BufferGeometry();for(const[k,a]of Object.entries(part.attributes)as any){const b=bytes(a.bytes);if(a.type!=="Float32Array")throw Error("Unexpected actual native unit attribute");g.setAttribute(k,new BufferAttribute(new Float32Array(b.buffer),a.itemSize,a.normalized));}if(part.index){const b=bytes(part.index.bytes);g.setIndex(new BufferAttribute(part.index.type==="Uint16Array"?new Uint16Array(b.buffer):new Uint32Array(b.buffer),1));}const day=new MeshStandardMaterial({vertexColors:false}),night=day.clone(),m=new InstancedMesh(g,day,part.rows.length);m.name=part.name;m.userData={dayMaterial:day,nightMaterial:night};m.instanceColor=new InstancedBufferAttribute(new Float32Array(part.rows.length*3),3);for(let i=0;i<part.rows.length;i++){const row=part.rows[i];m.instanceMatrix.array.set(new Float32Array(bytes(row.matrix).buffer),i*16);m.instanceColor.array.set(new Float32Array(bytes(row.color).buffer),i*3);}return m;}
test("actual Full and Touch source tuples admit together, only741 proven Full panes retire and all outside words/refs restore",()=>{
 for(const mobile of[false,true]){const world=new Group(),capture=evidence.actualNative[mobile?"mobile":"full"],hosts=capture.parts.map(captured);world.add(...hosts);const before=hosts.map(m=>({m,matrix:m.instanceMatrix,matrixBytes:hash(m.instanceMatrix.array),color:hash(m.instanceColor!.array),geometry:m.geometry,index:m.geometry.index}));
  const source=drain(bindWilhelmStreetFrontsV325SourcesSteps(prisms,{core,voxels},true));expect(source).not.toBeNull();const model=drain(createWilhelmStreetFrontsV325Steps({native:true,mobileLike:mobile,sourceReceipt:source!}));expect(model).not.toBeNull();world.add(model!);const gate=()=>model!.parent===world&&hasCompleteWilhelmStreetFrontsV325(model!,true),entry=wilhelmStreetFrontsCorePlanV325(true,mobile),bound=createExactOwnersSourceV321(entry.plan,prisms,entry.control,voxels);expect(bound).not.toBeNull();const tx=drain(stageExactOwnersV321Steps(world,bound!,gate));
  try{expect(tx).not.toBeNull();expect(tx!.commit(gate)).toBeTrue();expect(tx!.complete()).toBeTrue();let changed=0;for(const b of before){expect(b.m.geometry).toBe(b.geometry);expect(b.m.geometry.index).toBe(b.index);expect(hash(b.m.instanceColor!.array)).toBe(b.color);const old=new Float32Array(bytes(b.matrixBytes).buffer),live=b.m.instanceMatrix.array;for(let i=0;i<old.length/16;i++){if(old.subarray(i*16,i*16+16).every((v,j)=>Object.is(v,live[i*16+j])))continue;changed++;for(let j=0;j<16;j++)expect(live[i*16+j]).toBe([0,1,2,4,5,6,8,9,10].includes(j)?0:old[i*16+j]);}}expect(changed).toBe(mobile?0:741);tx!.rollback();for(const b of before){expect(b.m.instanceMatrix).toBe(b.matrix);expect(hash(b.m.instanceMatrix.array)).toBe(b.matrixBytes);}}
  finally{tx?.rollback();if(model)disposeWilhelmStreetFrontsV325(model);for(const m of hosts){m.geometry.dispose();m.userData.dayMaterial.dispose();m.userData.nightMaterial.dispose();m.dispose();}world.clear();}
 }
},30000);

/** Exact real Worker/transfer curb lines, bound to its already verified mesh. */
import {readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {Group,LineSegments,Mesh}from'three';
import {createRestoredRoadBatch}from'../src/restoredRoadSurfaces';
import {smoothGroundTopSampler,type VoxelPayload}from'../src/terrainPayload';
import {serializeObject3DForTransfer,deserializeTransferredObject3D}from'../src/transferableObject3D';
import {compactStaticGeometrySteps}from'../src/compactStaticGeometry';
import {cutRosenthalerPresentationV228}from'../src/RosenthalerSurfaceAperturesV228';
import {cutUbahnPresentationV261}from'../src/UbahnSurfaceAperturesV261';
import {cutUbahnPresentationV281}from'../src/UbahnSurfaceAperturesV281';
const dir=process.argv[2];if(!dir)throw Error('Explicit external evidence directory required');mkdirSync(dir,{recursive:true});
const base=import.meta.dir+'/../public/mesh/regierungsviertel/',ground=JSON.parse(readFileSync(base+'ground-context.json','utf8'))as VoxelPayload;ground.ground_rows=[];
const sample=smoothGroundTopSampler(ground),terrainAt=(x:number,z:number)=>sample(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx);
const data=readFileSync(import.meta.dir+'/../src/data/restoredRoadSurfaces.ndjson.txt','utf8').trim().split('\n').slice(1).map(s=>JSON.parse(s)),batch=data.find(q=>q.id==='restored-kerbs-2--7');if(!batch)throw Error('Missing exact source kerb batch');
const work=(root:Group)=>{root.traverse(q=>{const g=compactStaticGeometrySteps(q);while(!g.next().done){}});};
const original=createRestoredRoadBatch(batch,terrainAt);work(original);const root=deserializeTransferredObject3D(serializeObject3DForTransfer(original).object)as Group;cutRosenthalerPresentationV228(root,false);cutUbahnPresentationV261(root,false);cutUbahnPresentationV281(root,false);work(root);root.updateMatrixWorld(true);
const hash=(a:ArrayBufferView)=>{let h=2166136261;for(const v of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^v,16777619)>>>0;return h;},b64=(a:ArrayBufferView)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const mesh=root.children.find(q=>q instanceof Mesh)as Mesh,line=root.children.find(q=>q instanceof LineSegments)as LineSegments;
if(!mesh||!line)throw Error('Actual transferred source pair missing');
const capture=JSON.parse(readFileSync(dir+'/../rail-v307/core-predecessor/drawn-worker.json','utf8')),prior=capture.parts.find((p:any)=>p.batchId===batch.id&&p.name===mesh.name);
if(!prior||Object.keys(mesh.geometry.attributes).length!==Object.keys(prior.attributes).length)throw Error('Complete source mesh mismatch');
for(const[k,a]of Object.entries(mesh.geometry.attributes)){const p=prior.attributes[k];if(!p||hash(a.array)!==p.hash||a.count!==p.count||a.itemSize!==p.itemSize||a.normalized!==p.normalized)throw Error('Actual source word mismatch '+k);}
if(!mesh.geometry.index||hash(mesh.geometry.index.array)!==prior.index.hash)throw Error('Actual source index mismatch');
const attrs=Object.fromEntries(Object.entries(line.geometry.attributes).map(([key,a])=>[key,{array:b64(a.array),type:a.array.constructor.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,hash:hash(a.array)}])),index=line.geometry.index;
const result={schemaVersion:1,sourceBatchId:batch.id,name:line.name,parentName:line.parent?.name,matrix:line.matrix.elements,renderOrder:line.renderOrder,attributes:attrs,index:index?{array:b64(index.array),type:index.array.constructor.name,count:index.count,hash:hash(index.array)}:null,material:Array.isArray(line.material)?line.material[0].toJSON():line.material.toJSON(),verifiedMesh:{name:mesh.name,positionHash:prior.attributes.position.hash,indexHash:prior.index.hash},policy:'Actual unchanged factory, exact indexing, real serializer/deserializer, actual client cuts. Complete associated mesh words match the earlier full production capture before this line can be trusted.'};
writeFileSync(dir+'/gesundbrunnen-curb-ink-actual-v309.json',JSON.stringify(result));console.log({name:line.name,vertices:line.geometry.getAttribute('position').count,indices:index?.count,verifiedMesh:result.verifiedMesh});

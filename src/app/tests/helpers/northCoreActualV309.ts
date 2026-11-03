/** Regression of the actual retained main raster + separately transferred
 * worker surface lanes, including all real client aperture and mobile passes. */
import {expect}from"bun:test";
import {BufferGeometry,Group,InstancedMesh,InterleavedBufferAttribute,Material,Mesh,Line,Points,type Object3D}from"three";
import {createIsometricCityCore,createSmoothSurfaces,type PrismPayload,type SurfacePayload}from"../../src/IsometricCityWorld";
import {buildMinecraftVoxelWorldSteps,type VoxelPayload}from"../../src/MinecraftVoxelWorld";
import {preloadAltMitteNativeV169Source}from"../../src/AltMitteNativeCoreV169";
import {splitParkSurfaceFamily,surfaceFamilyPayload}from"../../src/progressiveWorld";
import {smoothGroundTopSampler,WATER_TOP_Y}from"../../src/terrainPayload";
import {spreebogenTerrainYAt}from"../../src/spreebogenBankProfile";
import {createRestoredRoadBatch}from"../../src/restoredRoadSurfaces";
import {serializeObject3DForTransfer,deserializeTransferredObject3D}from"../../src/transferableObject3D";
import {compactStaticGeometry}from"../../src/compactStaticGeometry";
import {interleaveStaticGeometry}from"../../src/interleaveStaticGeometry";
import {freezeStaticSceneTransforms}from"../../src/staticSceneTransforms";
import {cutRosenthalerPresentationV228}from"../../src/RosenthalerSurfaceAperturesV228";
import {cutUbahnPresentationV261}from"../../src/UbahnSurfaceAperturesV261";
import {cutUbahnPresentationV281}from"../../src/UbahnSurfaceAperturesV281";
import type {TunnelPortalCourseInput}from"../../src/TunnelPortals";
import type {NorthCoreTerrainRecipesV309}from"../../src/NorthCoreTerrainV309";
const base=new URL("../../public/mesh/regierungsviertel/",import.meta.url);
export const json=async<T>(name:string):Promise<T>=>Bun.file(new URL(name,base)).json();
export const done=<T>(g:Generator<void,T>):T=>{let r=g.next();while(!r.done)r=g.next();return r.value;};
export function dispose(root:Object3D){const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();root.traverse(o=>{if(o instanceof Mesh||o instanceof Line||o instanceof Points){geometries.add(o.geometry);for(const m of[...(Array.isArray(o.material)?o.material:[o.material]),o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial])if(m instanceof Material)materials.add(m);if(o instanceof InstancedMesh)o.dispose();}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();root.clear();}
export function upload(root:Group){const seen=new Set<object>();root.traverse(o=>{if(o instanceof Mesh||o instanceof Line||o instanceof Points){for(const a of Object.values(o.geometry.attributes)){const storage=a instanceof InterleavedBufferAttribute?a.data:a;if(!seen.has(storage)){seen.add(storage);storage.onUploadCallback();}}o.geometry.index?.onUploadCallback();if(o instanceof InstancedMesh){o.instanceMatrix.onUploadCallback();o.instanceColor?.onUploadCallback();}}});}
export function oldReferences(root:Group){const refs:{mesh:Mesh|Line|Points;geometry:BufferGeometry;attributes:BufferGeometry["attributes"];index:BufferGeometry["index"];pose:number[];matrix:object|null;color:object|null}[]=[];root.traverse(o=>{if((o instanceof Mesh||o instanceof Line||o instanceof Points)&&!o.userData.northCoreOutsideV309)refs.push({mesh:o,geometry:o.geometry,attributes:{...o.geometry.attributes},index:o.geometry.index,pose:[...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),...o.matrix.elements,Number(o.matrixAutoUpdate),Number(o.matrixWorldAutoUpdate)],matrix:o instanceof InstancedMesh?o.instanceMatrix:null,color:o instanceof InstancedMesh?o.instanceColor:null});});return refs;}
export function expectUnchanged(refs:ReturnType<typeof oldReferences>){for(const r of refs){expect(r.mesh.geometry).toBe(r.geometry);expect(r.mesh.geometry.index).toBe(r.index);expect(Object.keys(r.mesh.geometry.attributes)).toEqual(Object.keys(r.attributes));for(const[k,a]of Object.entries(r.attributes))expect(r.mesh.geometry.getAttribute(k)).toBe(a);expect([...r.mesh.position.toArray(),...r.mesh.quaternion.toArray(),...r.mesh.scale.toArray(),...r.mesh.matrix.elements,Number(r.mesh.matrixAutoUpdate),Number(r.mesh.matrixWorldAutoUpdate)]).toEqual(r.pose);if(r.mesh instanceof InstancedMesh){expect(r.mesh.instanceMatrix).toBe(r.matrix);expect(r.mesh.instanceColor).toBe(r.color);}}}
export async function actualDrawn(source:NorthCoreTerrainRecipesV309,initial?:{tunnel:TunnelPortalCourseInput;options:Parameters<typeof createIsometricCityCore>[4]}){
 const ground=await json<VoxelPayload>("ground-context.json"),surfaces=await json<SurfacePayload>("surface-polygons.json"),prisms=await json<PrismPayload>("lod2-prisms.json");prisms.buildings=[];
 const root=createIsometricCityCore(prisms,ground,initial?.tunnel??null,surfaces,initial?.options??{buildings:[],includeContext:false,retainRasterAsphalt:true,retainRasterWater:true,smoothSurfaces:null,bridgeStructures:false,parliamentaryDiningV296:true,waterfrontV296:true});
 // RequiredSiteEnvelopesV209's actual initial main-thread aperture order.
 cutUbahnPresentationV261(root,false);cutUbahnPresentationV281(root,false);cutRosenthalerPresentationV228(root,false);root.traverse(compactStaticGeometry);
 const wanted=new Set(source.variants["drawn-worker"].parts.map(p=>p.batchId).filter((id):id is string=>!!id));
 const workerGround={...ground,ground_rows:[]},sample=smoothGroundTopSampler(workerGround),terrainAt=(x:number,z:number)=>sample(x/ground.cell_m-ground.grid.min_x_idx,z/ground.cell_m-ground.grid.min_z_idx),waterTop=ground.water_top_y_m??WATER_TOP_Y,bankY=waterTop+5.35;
 const publish=(batch:Group,id:string)=>{batch.traverse(compactStaticGeometry);const packed=serializeObject3DForTransfer(batch);const copy=deserializeTransferredObject3D(structuredClone(packed.object))as Group;dispose(batch);cutRosenthalerPresentationV228(copy,false);cutUbahnPresentationV261(copy,false);cutUbahnPresentationV281(copy,false);copy.traverse(compactStaticGeometry);copy.userData.progressiveWorldBatchId=id;copy.userData.progressiveWorldBatch=true;freezeStaticSceneTransforms(copy);root.add(copy);};
 const roads=new Map<string,NonNullable<SurfacePayload["roads"]>>();for(const r of surfaces.roads??[])if(["sand","earth","wood","metal"].includes(r.kind??"")){const rows=roads.get(r.kind!)??[];rows.push(r);roads.set(r.kind!,rows);}surfaces.roads=[];surfaces.water=[];surfaces.sunken_walls=[];
 // Source order and source polygons are untouched. Only nonintersecting batches
 // are omitted from this finite test world; the full worker uses the same loop.
 const parks=splitParkSurfaceFamily(surfaces);for(let i=0;i<parks.length;i++){const id=`surface-parks-${i+1}`;if(wanted.has(id))publish(createSmoothSurfaces(parks[i],waterTop,bankY,terrainAt,{excludeDistrictMarkings:true,parliamentaryDiningV296:true,waterfrontV296:true}),id);}
 surfaces.parks=[];surfaces.scrub_points=[];
 for(const family of["sand","earth","wood","metal"]as const){const id=`surface-${family}`;if(!wanted.has(id))continue;const payload=surfaceFamilyPayload(surfaces,family);payload.roads=roads.get(family)??[];publish(createSmoothSurfaces(payload,waterTop,bankY,terrainAt,{excludeDistrictMarkings:true,parliamentaryDiningV296:true,waterfrontV296:true}),id);}
 const lines=(await Bun.file(new URL("../../src/data/restoredRoadSurfaces.ndjson.txt",import.meta.url)).text()).trim().split("\n");for(let i=1;i<lines.length;i++){const b=JSON.parse(lines[i]);if(wanted.has(b.id))publish(createRestoredRoadBatch(b,(x,z)=>spreebogenTerrainYAt(x,z,terrainAt(x,z))),b.id);}
 freezeStaticSceneTransforms(root);return root;
}
export async function stage<T>(g:Generator<void,T>,checkpoint?:()=>void):Promise<T>{let r=g.next(),n=0;checkpoint?.();while(!r.done){if(++n%32===0)await new Promise(v=>setTimeout(v,0));r=g.next();checkpoint?.();}return r.value;}

export async function actualNative(){
 await preloadAltMitteNativeV169Source();const payload=await json<VoxelPayload>("minecraft-voxels.json"),root=new Group(),steps=buildMinecraftVoxelWorldSteps(root,payload,null,null,{includeLegacyMonbijou:false});for(let i=0;i<10000&&!root.getObjectByName("Voxel ground runs");i++)steps.next();steps.return(undefined as never);
 cutUbahnPresentationV261(root,true);cutUbahnPresentationV281(root,true);cutRosenthalerPresentationV228(root,true);root.traverse(compactStaticGeometry);freezeStaticSceneTransforms(root);return root;
}

/** Exact finite source-tree members; no nearest-anchor or facade inference. */
import {createHash} from "node:crypto";
import {InstancedMesh,Matrix4,Mesh,Vector3} from "three";
import {createParkDetails,decodeTrees} from "../src/ParkDetails";
import type {ParkDetailsPayload} from "../src/ParkDetails";
import {forEachVoxelTreeBlock} from "../src/terrainPayload";
import {northParkTerrainOffsetV306 as park} from "../src/northParkTerrainV306";
import {railSseGroundAtV307 as rail} from "../src/railSseNavigationV307";
import approach from "../src/data/railBridgeApproachV307Profile.json";
function inside(ring:readonly number[][],x:number,z:number){let ok=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])ok=!ok;}return ok;}
function inApproach(x:number,z:number){const geometry=approach.domain as unknown as{type:string;coordinates:number[][][]|number[][][][]};const polygons=geometry.type==="Polygon"?[geometry.coordinates as number[][][]]:geometry.coordinates as number[][][][];return polygons.some(p=>inside(p[0],x,z)&&!p.slice(1).some(h=>inside(h,x,z)));}
const affected=(x:number,z:number)=>park(x,z)!==0||rail(x,z)!==null||inApproach(x,z);
function key(row:Float32Array){let a=2166136261,b=0x9e3779b9;for(const byte of new Uint8Array(row.buffer,row.byteOffset,row.byteLength)){a=Math.imul(a^byte,16777619)>>>0;b=Math.imul(b^byte,2246822519)>>>0;}return `${a}:${b}`;}
const sourcePath="public/mesh/regierungsviertel/park-details.json",voxelPath="public/mesh/regierungsviertel/minecraft-voxels.json",
 payload=await Bun.file(sourcePath).json()as ParkDetailsPayload,voxel=await Bun.file(voxelPath).json(),
 trees=decodeTrees(payload.trees,payload.tree_vocabulary),selected=trees.filter(t=>affected(t.position[0],t.position[2]));
const rows:Record<string,Record<string,number[]>>={},collisions:unknown[]=[];
function record(name:string,row:Float32Array,anchor:number[]){
 const bank=rows[name]??={},hash=key(row),old=bank[hash];
 if(old&&old.some((v,i)=>v!==anchor[i])){collisions.push({name,hash,old,anchor});delete bank[hash];}
 else bank[hash]=anchor;
 rows[name]=bank;
}
function treeName(name:string){return name.includes("tree")||name.includes("crowns")||name.includes("microcrowns");}
for(const tree of selected){
 const part={...payload,trees:[tree],tree_vocabulary:undefined,paths:[],playgrounds:[],street_lights:[],wall_traces:[],shrubs:[],hedges:[],shrub_patches:[]}as ParkDetailsPayload;
 const root=createParkDetails(part,{detailProfile:"full",settledDetail:true,exactPrimitiveIndex:false});
 root.traverse(o=>{if(o instanceof InstancedMesh&&treeName(o.name))for(let i=0;i<o.count;i++)record(o.name,new Float32Array(o.instanceMatrix.array.slice(i*16,i*16+16)),tree.position);});
 const disposed=new Set<object>();root.traverse(o=>{if(o instanceof Mesh){for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(!disposed.has(resource)){disposed.add(resource);resource.dispose();}if(o instanceof InstancedMesh)o.dispose();}});
 root.clear();
}
const matrix=new Matrix4(),size=new Vector3(),cell=voxel.cell_m;
let nativeTrees=0,nativeApproachTrees=0;
forEachVoxelTreeBlock(voxel,(ix,iz,y0dm,hdm)=>{
 const x=(ix+.5)*cell,z=(iz+.5)*cell;if(inApproach(x,z))nativeApproachTrees++;if(!affected(x,z))return;nativeTrees++;
 const y0=y0dm/10,height=Math.max(cell,hdm/10),trunk=Math.max(cell/2,height-cell*1.5),species=Math.abs(ix*7+iz*13)%5,anchor=[x,y0,z];
 const add=(name:string,y:number,w:number,h:number,d:number)=>{matrix.makeScale(w,h,d).setPosition(x,y,z);record(name,new Float32Array(matrix.elements),anchor);};
 add("Voxel tree trunks",y0+trunk/2,cell*.45,trunk,cell*.45);
 add("Voxel tree crowns",y0+trunk+cell*1.9/2,cell*2.2,cell*1.9,cell*2.2);
 if(species===1||species===3)add("Voxel tree crowns",y0+trunk+cell*1.9+cell*.55,cell*1.3,cell*1.1,cell*1.3);
});
if(collisions.length)throw Error("Ambiguous exact north source-tree membership");
const sources=[];for(const path of [sourcePath,voxelPath])sources.push({path,sha256:createHash("sha256").update(await Bun.file(path).bytes()).digest("hex")});
const lights=(payload.street_lights??[]).filter(p=>affected(p.position[0],p.position[2])).length;
const result={schemaVersion:1,sources,sourceTrees:trees.length,affectedDrawnTrees:selected.length,affectedNativeTrees:nativeTrees,affectedLightingPoints:lights,treeIds:selected.map(t=>t.id),rows,
 policy:"Exact actual single-source ParkDetails factory and original voxel-tree formula members only, keyed by two independent full Float32-matrix byte hashes. All members of one tree share its original source anchor. No nearest-tree guess and no runtime geometry regeneration. Original source files remain unchanged."};
await Bun.write("src/data/northTerrainPropsV309.json",JSON.stringify(result));
console.log({trees:selected.length,nativeTrees,lights,approachDrawnTrees:trees.filter(t=>inApproach(t.position[0],t.position[2])).length,approachNativeTrees:nativeApproachTrees,approachLightingPoints:(payload.street_lights??[]).filter(t=>inApproach(t.position[0],t.position[2])).length,batches:Object.keys(rows).length,rows:Object.values(rows).reduce((n,bank)=>n+Object.keys(bank).length,0)});

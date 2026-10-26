import { expect, test } from 'bun:test';
import { Group, InstancedMesh, Mesh } from 'three';
import { createLehrterV277 } from '../src/LehrterV277';
import data from '../src/data/lehrterV277.json';
import nav from '../src/data/lehrterV277Navigation.json';
import ownership from '../src/data/lehrterV277Ownership.json';
import { lehrterSolidsV277 } from '../src/lehrterV277Profile';
import { compilePedestrianObstacles, pedestrianPointIsBlocked, type PedestrianPolygonObstacle } from '../src/pedestrianNavigation';
import { createMinecraftVoxelWorld, type VoxelPayload } from '../src/MinecraftVoxelWorld';
import { preloadAltMitteNativeV169Source } from '../src/AltMitteNativeCoreV169';
import type { PrismPayload } from '../src/IsometricCityWorld';
import type { VisualMode } from '../src/visualMode';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import { staticGeometryAudit } from './helpers/staticGeometryAudit';
import { addRequiredSiteEnvelopesV209Steps } from '../src/RequiredSiteEnvelopesV209';
const ids=new Set(ownership.previousPrisms.map(p=>p.id));
const source={schema_version:1,classes:['concrete','glass'],buildings:ownership.previousPrisms} as PrismPayload;
const scope=(index:ReturnType<typeof compilePedestrianObstacles>)=>[...new Set([...index.cells.values()].flat())].filter(o=>o.kind==='polygon'&&ids.has(o.sourceId!)) as PedestrianPolygonObstacle[];
function inspect(native:boolean,mobileLike=false){
  const root=createLehrterV277(native,{mobileLike});
  try{const audit=staticGeometryAudit(root);root.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(!(o instanceof Mesh))return;expect(o.userData.textureFree).toBe(true);if(native&&o instanceof InstancedMesh)for(let i=0;i<o.count;i++)for(const j of [1,2,4,6,8,9])expect(Math.abs(o.instanceMatrix.array[i*16+j])).toBe(0);});return audit;}finally{disposeSurroundingCityRoot(root);}
}
test('eight complete parts have full mobile detail and independent orthogonal native geometry',()=>{
 const drawn=inspect(false),native=inspect(true);expect(inspect(false,true)).toEqual(drawn);expect(inspect(true,true)).toEqual(native);expect(drawn.budget.draws).toBe(2);expect(native.budget.draws).toBe(1);expect(data.sourcePartIds).toHaveLength(8);expect(data.counts.sourceSurfaces).toBe(83);console.log('Lehrter v277 submitted geometry',{drawn,native});
});
test('required construction emits the complete group in both modes',()=>{
 for(const native of [false,true]){const root=new Group(),steps=addRequiredSiteEnvelopesV209Steps(root,native);try{let found=false;for(let i=0;i<60;i++){const result=steps.next();if(root.children.some(c=>c.name===`Lehrter v277 ${native?'independent native architecture':'complete measured architecture'}`)){found=true;break;}if(result.done)break;}expect(found).toBe(true);}finally{steps.return();disposeSurroundingCityRoot(root);}}
},30_000);
test('actual navigation binds every drawn and native roof to an exact owner and keeps both courts open',()=>{
 let mode:VisualMode='day';const index=compilePedestrianObstacles(source,()=>mode,{lehrterV277:true});const obstacles=scope(index);expect(obstacles.length).toBe(lehrterSolidsV277(false).length+lehrterSolidsV277(true).length);
 for(const native of [false,true,false]){mode=native?'minecraft':'day';const solids=lehrterSolidsV277(native);expect(solids.every(s=>ids.has(s.sourceId))).toBe(true);
 const witnesses:number[][]=native?nav.nativeRoofs:nav.parts.flatMap(p=>p.roofTriangles.map(t=>[t.reduce((s,v)=>s+v[0]/3,0),t.reduce((s,v)=>s+v[2]/3,0)]));
 for(const [x,z] of witnesses){const tops=solids.map(p=>p.topAt(x,z)).filter(y=>y!==null) as number[];if(!tops.length)continue;const actual=obstacles.map(o=>o.topAt?.(x,z)).filter(y=>y!==undefined&&y!==Number.NEGATIVE_INFINITY) as number[];expect(actual).toContain(Math.max(...tops));}
 for(const [x,z] of [[-773.55,-1736.265],[-889.127,-1619.033]])expect(pedestrianPointIsBlocked(x,z,7,index)).toBe(false);}
 const old=source.buildings[3],changed={...old,h_dm:old.h_dm+1};const preserved=compilePedestrianObstacles({...source,buildings:[changed]},()=>mode,{lehrterV277:true});expect(scope(preserved)).toHaveLength(1);expect(scope(compilePedestrianObstacles({...source,buildings:[]},()=>mode,{lehrterV277:true}))).toHaveLength(0);
});
test('actual native constructor removes only exclusive old columns and their exact generic windows',async()=>{
 await preloadAltMitteNativeV169Source();const columns=[...ownership.columns,...ownership.retainedSharedColumns] as [number,number,number,number,number][];
 const xs=columns.map(c=>c[0]),zs=columns.map(c=>c[1]);const minX=Math.min(...xs),minZ=Math.min(...zs);const cols=Math.max(...xs)-minX+1,rows=Math.max(...zs)-minZ+1;
 const fixture:VoxelPayload={schema_version:1,cell_m:4,classes:['grass','asphalt','water','concrete','glass','plazaBrick','bridge','basin','wall','pond'],grid:{cols,rows,min_x_idx:minX,min_z_idx:minZ},ground_height:{cols,rows,stride_cells:1,y_dm:Array(cols*rows).fill(32)},ground_rows:[],buildings:columns,trees:[],water_top_y_m:-1.15};
 const scenePrisms=[...source.buildings,...ownership.neighbours];
 const capture=(enabled:boolean,prisms=scenePrisms)=>{const root=createMinecraftVoxelWorld(fixture,null,null,{sourcePrisms:prisms,lehrterV277:enabled});try{const bodies=root.getObjectByName('Voxel building columns') as InstancedMesh;const windows=root.getObjectByName('Voxel facade windows') as InstancedMesh|undefined;const matrices=(m:InstancedMesh|undefined)=>m?Array.from({length:m.count},(_,i)=>Array.from(m.instanceMatrix.array.slice(i*16,(i+1)*16)).join('/')):[];return{bodies:matrices(bodies),windows:matrices(windows),columns:[...new Set(Array.from({length:bodies.count},(_,i)=>`${Math.floor(bodies.instanceMatrix.array[i*16+12]/4)}/${Math.floor(bodies.instanceMatrix.array[i*16+14]/4)}`))]};}finally{disposeSurroundingCityRoot(root);}};
 const before=capture(false),after=capture(true);expect(new Set(before.columns)).toEqual(new Set(columns.map(c=>`${c[0]}/${c[1]}`)));expect(after.columns).toHaveLength(14);expect(new Set(after.columns)).toEqual(new Set(ownership.retainedSharedColumns.map(c=>`${c[0]}/${c[1]}`)));console.log("Lehrter old/native retirement",{beforeBodies:before.bodies.length,afterBodies:after.bodies.length,beforeWindows:before.windows.length,afterWindows:after.windows.length});expect(after.bodies.every(m=>before.bodies.includes(m))).toBe(true);expect(after.windows.length).toBeLessThan(before.windows.length);const shared=new Set(ownership.retainedSharedColumns.map(c=>`${c[0]}/${c[1]}`));
 const windowOwner=(text:string)=>{const m=text.split('/').map(Number);return `${Math.floor((m[12]-m[8]*2.08)/4)}/${Math.floor((m[14]-m[10]*2.08)/4)}`;};
 expect(after.windows.every(m=>shared.has(windowOwner(m)))).toBe(true);
 expect(before.windows.filter(m=>shared.has(windowOwner(m))).every(m=>after.windows.includes(m))).toBe(true);
 expect(before.windows.filter(m=>!shared.has(windowOwner(m))).every(m=>!after.windows.includes(m))).toBe(true);const changed=scenePrisms.map(p=>p.id===source.buildings[0].id?{...p,h_dm:p.h_dm+1}:p);expect(capture(true,changed).bodies).toEqual(before.bodies);
},30_000);

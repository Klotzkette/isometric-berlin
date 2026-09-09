import {describe,expect,test} from 'bun:test';
import {BoxGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createFriedrichstrasseArchitecture,type FriedrichstrasseBlock,friedrichstrassePrismContains} from '../src/FriedrichstrasseArchitecture';
import {FRIEDRICHSTRASSE_ARCHITECTURE_SOURCE as S,FRIEDRICHSTRASSE_ARCHITECTURE_IDS,ADMIRALSPALAST_IDS,admiralspalastRoofAt,admiralspalastSourceColumnAt} from '../src/friedrichstrasseArchitectureProfile';
import {createIsometricCity,type PrismPayload} from '../src/IsometricCityWorld';
import prismJson from '../public/mesh/regierungsviertel/lod2-prisms.json';
import voxels from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import {buildColumnToneLookup,createMinecraftVoxelWorld,decodeVoxelBuildingColumns,voxelRecognitionAreaAt,type VoxelPayload} from '../src/MinecraftVoxelWorld';
const source=prismJson as unknown as PrismPayload;
const nearby=source.buildings.filter(p=>p.ring.some(a=>a[0]>8000&&a[0]<12800&&a[1]>-4600&&a[1]<-1500));
function detail(minecraft=false,mobileLike=false):Group{return createFriedrichstrasseArchitecture({minecraft,mobileLike,sourcePrisms:source.buildings,voxels,diagnostics:true});}
function sourceCells():InstancedMesh{
 const columns:number[][]=[];voxels.building_rows.forEach((row,zi)=>{const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z< -460||z> -150)return;for(const[x,n,lo,hi]of row)for(let i=0;i<n;i++){const cx=(voxels.grid.min_x_idx+x+i+.5)*voxels.cell_m;if(cx>800&&cx<1280&&hi>lo&&!admiralspalastSourceColumnAt(cx,z,lo/10,hi/10))columns.push([cx,z,lo/10,hi/10]);}});
 const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),columns.length),matrix=new Matrix4();columns.forEach(([x,z,lo,hi],i)=>mesh.setMatrixAt(i,matrix.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(lo+hi)/2,z)));mesh.computeBoundingSphere();return mesh;
}
describe('Friedrichstrasse source-bound architecture',()=>{
 test('preserves all 52 source parts and exactly three Admiral replacements',()=>{
  expect(S.prisms).toHaveLength(52);expect(S.profiles).toHaveLength(9);expect(FRIEDRICHSTRASSE_ARCHITECTURE_IDS.size).toBe(52);expect([...ADMIRALSPALAST_IDS].sort()).toEqual(['K00002ap','K00002uV','K00006mJ']);
  for(const p of S.prisms)expect(p).toEqual(source.buildings.find(q=>q.id===p.id));
  expect(FRIEDRICHSTRASSE_ARCHITECTURE_IDS.has('K00004vY')).toBeFalse();
  for(const p of S.admiralParts){const sourcePart=S.prisms.find(q=>q.id===p.id.slice(-8))!;const max=Math.max(...p.surfaces.flatMap(s=>s.rings.flatMap(r=>r.map(a=>a[1]+p.offset_y_m))));expect(max).toBeCloseTo((sourcePart.y0_dm+sourcePart.h_dm)/10,1);}
 });
 test('front Doric structure and permanent identity survive every profile',()=>{
  for(const minecraft of [false,true])for(const mobileLike of [false,true]){
   const root=detail(minecraft,mobileLike),plan=root.userData.blocks as FriedrichstrasseBlock[];
   for(const role of ['giant granite Doric half-column','Doric base and capital','Istrian limestone relief panel','segmental limestone arch','Admiral balcony handrail','terracotta court surround','continuous aluminium double-facade fin','Juliet balcony rail','lettering ADMIRALSPALAST'])expect(plan.some(b=>b.role===role),role).toBeTrue();
   for(const profile of S.profiles)expect(plan.some(b=>b.glass&&profile.ids.includes(b.sourceId)),profile.name).toBeTrue();
   expect(root.userData.runtimeAssets).toEqual([]);const arrays=new Set<ArrayBufferView>();let count=0;root.traverse(o=>{if(!(o instanceof Mesh))return;expect(o.geometry.getAttribute('uv')).toBeUndefined();expect(o.userData.dayMaterial).toBeDefined();expect(o.userData.nightMaterial).toBeDefined();expect(o.userData.moonlitMaterial).toBeDefined();for(const a of Object.values(o.geometry.attributes))arrays.add(a.array);if(o.geometry.index)arrays.add(o.geometry.index.array);if(o instanceof InstancedMesh){count+=o.count;arrays.add(o.instanceMatrix.array);arrays.add(o.instanceColor!.array);expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();}});
   expect(root.children.length).toBe(minecraft?2:3);expect(count).toBeLessThan(minecraft?26000:23000);expect([...arrays].reduce((a,b)=>a+b.byteLength,0)).toBeLessThan(minecraft?2_000_000:1_800_000);
  }
 });
 for(const minecraft of [false,true])for(const mobileLike of [false,true])test(`${minecraft?'Minecraft':'smooth'} ${mobileLike?'mobile':'full'} real source shells do not hide facade panes`,()=>{
  const root=new Group(),d=detail(minecraft,mobileLike);root.add(minecraft?sourceCells():createIsometricCity({...source,buildings:nearby.filter(p=>!ADMIRALSPALAST_IDS.has(p.id))},null,null,null,{includeContext:false}));root.add(d);root.updateMatrixWorld(true);
  const meshes:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});const panes=(d.userData.blocks as FriedrichstrasseBlock[]).filter(b=>b.glass);
  for(const profile of [...S.profiles, {name:"Admiral street", ids:["K00002ap"]}])for(const fraction of [.23,.61,.89]){
   const candidates=panes.filter(b=>profile.ids.includes(b.sourceId)),b=candidates[Math.floor(candidates.length*fraction)],normal=new Vector3(b.normal[0],0,b.normal[1]);let visible=false;
   for(const[fx,fy]of [[.25,.2],[-.25,.25],[.3,-.2],[-.3,-.2]]){const target=new Vector3(...b.position).add(new Vector3(Math.cos(b.yaw),0,-Math.sin(b.yaw)).multiplyScalar(b.size[0]*fx));target.y+=b.size[1]*fy;const hits=new Raycaster(target.addScaledVector(normal,.40),normal.clone().negate(),0,.7).intersectObjects(meshes,false);if(hits[0]?.object.name==='Friedrichstrasse facade glazing'){visible=true;break;}}
   expect(visible,`${profile.name} ${b.sourceId} ${b.position}`).toBeTrue();
  }
 });
 test('roof support rays follow official planes and leave source courtyards free',()=>{
  const root=detail();root.updateMatrixWorld(true);const shell=root.getObjectByName('Admiralspalast official wall and roof planes')!;let samples=0;
  for(let x=1154;x<1240;x+=4.3)for(let z=-233;z< -168;z+=5.1){const top=admiralspalastRoofAt(x,z);if(top===null)continue;const hit=new Raycaster(new Vector3(x,60,z),new Vector3(0,-1,0),0,60).intersectObject(shell,false)[0];expect(hit?.point.y).toBeCloseTo(top,2);samples++;}
  expect(samples).toBeGreaterThan(75);expect(admiralspalastRoofAt(1180,-183)).toBeNull();expect(admiralspalastSourceColumnAt(1180,-183)).toBeFalse();
  expect(admiralspalastSourceColumnAt(1140,-182)).toBeFalse();expect(admiralspalastSourceColumnAt(1160,-181,50,80)).toBeFalse();
  for(const p of S.prisms.filter(p=>ADMIRALSPALAST_IDS.has(p.id)))expect(friedrichstrassePrismContains(p as any,1180,-183)).toBeFalse();
 });
 test('real source ownership suppresses only the dedicated Minecraft generic window grid',()=>{
  const lookup=buildColumnToneLookup(source),columns=decodeVoxelBuildingColumns(voxels as unknown as VoxelPayload);
  const owned=columns.find(([x,z,lo,hi])=>{const xx=(x+.5)*4,zz=(z+.5)*4,id=lookup.sourceIdAt?.(xx,zz);return id&&FRIEDRICHSTRASSE_ARCHITECTURE_IDS.has(id)&&!ADMIRALSPALAST_IDS.has(id)&&!voxelRecognitionAreaAt(xx,zz)&&hi-lo>100;})!;
  const control=columns.find(([x,z,lo,hi])=>{const xx=(x+.5)*4,zz=(z+.5)*4,id=lookup.sourceIdAt?.(xx,zz);return xx>800&&xx<1280&&zz> -460&&zz< -150&&id&&!FRIEDRICHSTRASSE_ARCHITECTURE_IDS.has(id)&&!voxelRecognitionAreaAt(xx,zz)&&hi-lo>100;})!;
  expect(owned).toBeDefined();expect(control).toBeDefined();expect(lookup.sourceIdAt?.((owned[0]+.5)*4,(owned[1]+.5)*4)).toBe('YCHo1QS2');
  const fixture={...voxels,building_rows:undefined,buildings:[owned,control],ground_rows:[],tree_rows:[],trees:[]} as unknown as VoxelPayload;
  const baseline=createMinecraftVoxelWorld(fixture),refined=createMinecraftVoxelWorld(fixture,lookup),before=baseline.getObjectByName('Voxel facade windows') as InstancedMesh,after=refined.getObjectByName('Voxel facade windows') as InstancedMesh;
  expect(before.count).toBeGreaterThan(after.count);expect(after.count).toBeGreaterThan(0);
  const m=new Matrix4();for(let i=0;i<after.count;i++){after.getMatrixAt(i,m);const p=new Vector3().setFromMatrixPosition(m);expect(Math.abs(p.x-(owned[0]+.5)*4)>2.3||Math.abs(p.z-(owned[1]+.5)*4)>2.3).toBeTrue();}
 });

});

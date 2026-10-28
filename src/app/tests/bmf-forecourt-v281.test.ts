import { describe,expect,test } from 'bun:test';
import { BoxGeometry,Group,InstancedMesh,Mesh,MeshBasicMaterial,Raycaster,Vector3,Matrix4 } from 'three';
import { createBmfForecourtV281,bmfForecourtFloorV281,BMF_FORECOURT_V281 as S,bmfGroundV281 } from '../src/BmfForecourtV281';
import { planRohwedderHaus } from '../src/RohwedderHausArchitecture';
import originalGround from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import { groundTopSampler,type VoxelPayload } from '../src/terrainPayload';
import { schwellenraumObjektmodus } from '../src/visual-modes/schwellenraum/presentation';

describe('v281 mapped 17 June glass memorial and retained BMF',()=>{
 test('keeps full mapped rings, ground and independent small native floor',()=>{
  expect(S.square.ring.length).toBe(6);expect(S.memorial.ring.length).toBe(5);
  expect(Math.hypot(S.memorial.ring[1][0]-S.memorial.ring[0][0],S.memorial.ring[1][1]-S.memorial.ring[0][1])).toBeGreaterThan(24);
  expect(bmfForecourtFloorV281(790,1020)).toBeNull();
  const root=createBmfForecourtV281(true),mesh=root.children[0] as InstancedMesh,m=new Matrix4(),p=new Vector3();
  expect(mesh.count).toBeLessThan(4000);
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m);
   for(const j of [1,2,4,6,8,9])expect(m.elements[j]).toBe(0);
   expect(bmfForecourtFloorV281(p.x,p.z,true)).toBeCloseTo(p.y+.025,3);
   expect(p.y).toBeGreaterThanOrEqual(bmfGroundV281(p.x,p.z));
  }
  const mobile=createBmfForecourtV281(true,{mobileLike:true}).children[0] as InstancedMesh;
  expect(mobile.instanceMatrix.array).toEqual(mesh.instanceMatrix.array);
 });
 test('drawn surface faces upward and stays inside mapped footprint bounds',()=>{
  const mesh=createBmfForecourtV281(false).children[0] as Mesh, pos=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  expect(pos.array.byteLength+n.array.byteLength+mesh.geometry.attributes.color.array.byteLength).toBeLessThan(800000);
  for(let i=0;i<pos.count;i++){
   expect(n.getY(i)).toBeGreaterThan(.99);expect(pos.getX(i)).toBeGreaterThanOrEqual(796.808);expect(pos.getX(i)).toBeLessThanOrEqual(838.991);
  }
 });
 test('native finish clears the actual unchanged source runs, not only its own height sampler',()=>{
  const g=originalGround as unknown as VoxelPayload,sample=groundTopSampler(g),runs:number[][]=[];
  // Replay the existing renderer's run-centre sampling from the original
  // payload. Only these twelve local obstacles are instantiated for the test.
  g.ground_rows.forEach((row,zi)=>{
   const z=(g.grid.min_z_idx+zi)*g.cell_m;if(z>=1049||z+g.cell_m<=1021)return;
   for(const[xi,n,cls]of row){
    const x=(g.grid.min_x_idx+xi)*g.cell_m;if(x>=840||x+n*g.cell_m<=796)continue;
    const y=g.classes[cls]==='water'?(g.water_top_y_m??-1.15):sample(xi+n/2,zi);
    runs.push([Math.max(x,796),Math.max(z,1021),Math.min(x+n*g.cell_m,840),Math.min(z+g.cell_m,1049),y,cls]);
   }
  });
  expect(S.retainedGroundRuns).toEqual(runs);
  const old=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),runs.length),m=new Matrix4(),p=new Vector3();
  runs.forEach(([x0,z0,x1,z1,y],i)=>old.setMatrixAt(i,m.makeScale(x1-x0,1,z1-z0).setPosition((x0+x1)/2,y-.5,(z0+z1)/2)));
  const detail=createBmfForecourtV281(true),mesh=detail.children[0] as InstancedMesh,scene=new Group().add(old,detail);scene.updateMatrixWorld(true);
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,m);p.setFromMatrixPosition(m);
   const r=runs.find(r=>p.x>=r[0]&&p.x<r[2]&&p.z>=r[1]&&p.z<r[3])!;
   expect(p.y+.025).toBeGreaterThan(r[4]+.004);
  }
  for(const[x,z]of[[812.5,1044.5],[813.5,1044.5],[814.5,1044.5],[815.5,1044.5],[820.125,1034.125]]){
   const hit=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0)).intersectObject(scene,true)[0];
   expect(hit.object).toBe(mesh);expect(hit.point.y).toBeCloseTo(bmfForecourtFloorV281(x,z,true)!,5);
  }
  expect(schwellenraumObjektmodus('schwellenraum',mesh)).toBe('day');
 });
 test('drawn walking matches actual inner plate and border triangles',()=>{
  const detail=createBmfForecourtV281();detail.updateMatrixWorld(true);
  for(let i=0;i<4;i++){
   const a=S.memorial.ring[i],b=S.memorial.ring[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   for(const t of [.15,.35,.55,.75,.95])for(const d of [-.04,.04,.16,.20]){
    const x=a[0]+(b[0]-a[0])*t+(b[1]-a[1])/len*d,z=a[1]+(b[1]-a[1])*t-(b[0]-a[0])/len*d;
    const hit=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0)).intersectObject(detail,true)[0];
    expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(bmfForecourtFloorV281(x,z)!,3);
   }
  }
  expect(schwellenraumObjektmodus('schwellenraum',detail.children[0])).toBe('day');
 });
 test('adds metallic edges and gold medallions without changing old screen',()=>{
  for(const minecraft of [false,true]){
   const plan=planRohwedderHaus(undefined,{minecraft});
   expect(plan.filter(b=>b.role==='mapped Ehrenhof screen rail')).toHaveLength(6);
   const edges=plan.filter(b=>b.role==='v281 screen metal edge');
   expect(edges.length).toBeGreaterThan(80);
   expect(plan.some(b=>b.role==='v281 lower gate medallion')).toBe(true);
   if(minecraft)for(const b of plan.filter(b=>b.role.startsWith('v281')))expect(b.yaw).toBe(0);
  }
 });
});

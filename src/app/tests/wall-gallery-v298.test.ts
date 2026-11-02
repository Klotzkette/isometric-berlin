import {describe,expect,spyOn,test} from 'bun:test';
import {BufferGeometry,InstancedMesh,Material,Matrix4,Mesh,Raycaster,Vector3} from 'three';
import {createWallGalleryV298,hasCompleteWallGalleryV298,wallGalleryGeometryV298} from '../src/WallGalleryV298';
import {parkReliefAt,coreParkReliefSupports} from '../src/parkReliefV182';
import {terrainGroundAt} from '../src/weinbergTerrainV176';
import {createCoreParkPathTerrainSampler,type ParkPath} from '../src/ParkDetails';
import {parkReliefGroundSlices} from '../src/parkReliefGroundRunsV182';
import groundSource from '../public/mesh/regierungsviertel/ground-context.json';
import nativeGroundSource from '../public/mesh/regierungsviertel/minecraft-voxels.json';
import {createGroundSlabs,groundTopSampler,smoothGroundTopSampler,type VoxelPayload} from '../src/terrainPayload';
import {wallArtDrawingV298} from '../src/WallGalleryArtV298';
import {WALL_GALLERY_HILL_BOUNDS_V298 as B,WALL_GALLERY_V298_DATA as D,wallGalleryDgmGroundAtV298,wallGalleryHillDeltaV298,wallGalleryHillGroundAtV298,wallGalleryHillWeightV298,wallGalleryHistoricSolidAtV298,wallPointInRingV298} from '../src/wallGalleryV298Profile';

describe('current retained wall locations and named artwork v298',()=>{
 test('keeps seven distinct current footprints and eight actual artwork anchors',()=>{
  expect(D.walls).toHaveLength(7);expect(new Set(D.walls.map(w=>w.id)).size).toBe(7);
  for(const art of D.artworks){expect(art.sourceDistanceM).toBeLessThan(.09);expect(D.walls.some(w=>w.id===art.wallId)).toBe(true);expect(art.title.length).toBeGreaterThan(3);const drawing=wallArtDrawingV298(art.kind);expect(drawing.shapes.length).toBeGreaterThan(5);}
  const model=wallGalleryGeometryV298(false);expect(new Set(model.triangles.filter(t=>t.role.startsWith('mural:')).map(t=>t.role.split(':')[1])).size).toBe(8);
  // The exact preserved source sheets, not a hypothetical rebuilt continuous
  // wall on the former red cartographic course, supply all concrete faces.
  expect(model.triangles.filter(t=>t.role==='east:source-exact-concrete-face').length).toBe(D.walls.reduce((n,w)=>n+(w.ring.length-1)*2,0));
 });
 test('individual kiss portraits retain detailed contours, ear, combed hair and spectacles',()=>{
  const d=wallArtDrawingV298('vrubel');expect(d.shapes.length).toBeGreaterThan(200);
  expect(new Set(d.shapes.map(s=>s.color)).size).toBeGreaterThan(35);
  const glasses=d.shapes.filter(s=>s.color===0x0c2022||s.color===0x112527);expect(glasses.length).toBe(2);
  const cheek=d.shapes.find(s=>s.color===0xe3ac92)!;expect(cheek.points.length).toBeGreaterThan(30);
  // Different faces, rather than two copies of an icon or a random colour wall.
  expect(d.shapes.some(s=>s.color===0xd3b68c&&s.points.length>20)).toBe(true);
  expect(wallArtDrawingV298('missing').shapes).toHaveLength(0);
 });
 test('real wall openings remain open and source-bound wall solids remain physical',()=>{
  const w=D.walls[0],a=w.ring[0],b=w.ring[1],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
  expect(wallGalleryHistoricSolidAtV298(x,4.6,z,.08)).toBe(true);
  expect(wallGalleryHistoricSolidAtV298(x,7,z,.08)).toBe(false);
  for(const y of[3,3.001,6.599])expect(wallGalleryHistoricSolidAtV298(x,y,z,.08)).toBe(true);
  for(const y of[2.999,6.6,8.8])expect(wallGalleryHistoricSolidAtV298(x,y,z,.08)).toBe(false);
  expect(wallGalleryHistoricSolidAtV298(0,4,0,0)).toBe(false);
  for(const art of D.artworks){expect(wallGalleryHistoricSolidAtV298(art.point[0],4.5,art.point[1],.14)).toBe(true);}
 });
 test('full drawn touch model is identical, compact and photograph-free',()=>{
  const a=createWallGalleryV298(false),b=createWallGalleryV298(false,{mobileLike:true});
  expect(hasCompleteWallGalleryV298(a)).toBe(true);expect(hasCompleteWallGalleryV298(b)).toBe(true);
  expect(a.children).toHaveLength(2);expect(a.userData.instances).toBeLessThan(5500);
  expect(a.userData.triangleCount).toBeLessThan(10000);
  for(let i=0;i<a.children.length;i++){const x=a.children[i] as Mesh,y=b.children[i] as Mesh;expect(x.geometry.getAttribute('position').array).toEqual(y.geometry.getAttribute('position').array);const mats=Array.isArray(x.material)?x.material:[x.material];for(const m of mats)expect((m as any).map??null).toBeNull();}
  expect((a.children[0] as InstancedMesh).instanceMatrix.array).toEqual((b.children[0] as InstancedMesh).instanceMatrix.array);
 });
 test('failed allocation-stage construction disposes every owned primitive and both materials',()=>{
  const geometry=spyOn(BufferGeometry.prototype,'dispose'),material=spyOn(Material.prototype,'dispose');
  const fail=spyOn(InstancedMesh.prototype,'computeBoundingSphere').mockImplementation(()=>{throw new Error('controlled construction failure');});
  try{expect(()=>createWallGalleryV298(true)).toThrow('controlled construction failure');expect(geometry).toHaveBeenCalledTimes(1);expect(material).toHaveBeenCalledTimes(2);}
  finally{fail.mockRestore();geometry.mockRestore();material.mockRestore();}
 });
 test('native construction is independent, cardinal and bounded',()=>{
  const p=wallGalleryGeometryV298(true);expect(p.triangles).toHaveLength(0);expect(p.rows.length).toBeLessThan(22000);expect(p.rows.length).toBeGreaterThan(10000);
  for(const r of p.rows){expect(r.yaw).toBe(0);expect([...r.p,...r.s].every(Number.isFinite)).toBe(true);expect(r.s.every(s=>s>0)).toBe(true);}
  const root=createWallGalleryV298(true);expect(root.children).toHaveLength(1);const m=root.children[0] as InstancedMesh,mat=new Matrix4();for(let i=0;i<m.count;i+=17){m.getMatrixAt(i,mat);for(const j of[1,2,4,6,8,9])expect(Math.abs(mat.elements[j])).toBe(0);}
  expect(p.rows.some(r=>r.role==='mural:vrubel:independent-cardinal-colour-run')).toBe(true);
  expect(hasCompleteWallGalleryV298(root,true)).toBe(true);expect(hasCompleteWallGalleryV298(root,false)).toBe(false);
  const child=root.children[0];root.remove(child);expect(hasCompleteWallGalleryV298(root,true)).toBe(false);root.add(child);expect(hasCompleteWallGalleryV298(root,true)).toBe(true);
  const forged=root.clone();expect(hasCompleteWallGalleryV298(forged,true)).toBe(false);
 });
});

describe('measured Sonnenhuegel, source seats and preserved Topography wall',()=>{
 test('retains exact DGM raster-centre samples with correct30mNHN datum',()=>{
  expect(wallGalleryDgmGroundAtV298(2248.5,-2696.5)).toBeCloseTo(28.78,8);
  expect(wallGalleryDgmGroundAtV298(2292.5,-2528.5)).toBeCloseTo(28.96,8);
  expect(wallGalleryDgmGroundAtV298(2228.5,-2620.5)).toBeCloseTo(19.25,8);
  // Render/navigation share the packet's four-metre triangular surface; raw
  // DGM samples above stay exact through the distinct measurement API.
  expect(Math.abs(wallGalleryHillGroundAtV298(2248.5,-2696.5)!-28.78)).toBeLessThan(.35);
  expect(wallGalleryHillWeightV298(2248.5,-2696.5)).toBe(1);
  expect(wallGalleryDgmGroundAtV298(0,0)).toBeNull();
 });
 test('field is baseline-aware and leaves its complete outside height complement unchanged',()=>{
  expect(D.hill.seamWidthM).toBe(160);expect(D.hill.heights.length*D.hill.heights[0].length).toBe(15142);
  for(const baseline of[3,5.2,7.75])for(const p of [[0,0],[2030,-2800],[2500,-2600],[2300,-2300]]){expect(wallGalleryHillDeltaV298(p[0],p[1],false,baseline)).toBe(0);expect(wallGalleryHillGroundAtV298(p[0],p[1],false,baseline)).toBeNull();}
  const x=B[0]+40,z=B[1]+240,w=wallGalleryHillWeightV298(x,z),raw=wallGalleryDgmGroundAtV298(x,z)!;
  for(const baseline of[3,5.2])expect(wallGalleryHillGroundAtV298(x,z,false,baseline)).toBeCloseTo(baseline+(raw-baseline)*w,8);
 });
 test('seats are individual source-contained members on represented hill and fence stays on old course',()=>{
  const p=wallGalleryGeometryV298(false),r=D.amphitheatre.geometry.coordinates[0][0];
  const seats=p.rows.filter(x=>x.role==='park:source-contained-individual-granite-seat');expect(seats.length).toBeGreaterThan(100);
  for(const s of seats){expect(wallPointInRingV298(r,s.p[0],s.p[2])).toBe(true);expect(s.p[1]-.12).toBeCloseTo(wallGalleryHillGroundAtV298(s.p[0],s.p[2])!,7);}
  const fence=p.rows.filter(x=>x.role==='topography:source-course-fine-protection-cable');expect(fence.length).toBeGreaterThan(650);expect(p.rows.some(r=>r.role.includes('damaged panel'))).toBe(false);
  // The new factory contains no second copy of the already authored damaged
  // Topography wall or protected exhibition. Its old source stays authoritative.
  const root=createWallGalleryV298(false);root.updateMatrixWorld(true);const solids=root.children[0] as InstancedMesh;const ray=new Raycaster(new Vector3(0,20,0),new Vector3(0,-1,0));expect(ray.intersectObject(solids)).toHaveLength(0);
 });
});

describe('bounded terrain routing and exact packet triangles',()=>{
 test('drawn sampler is planar on each NW-SE four-metre field triangle',()=>{
  const blend=(x:number,z:number,baseline:number)=>baseline+(wallGalleryDgmGroundAtV298(x,z)!-baseline)*wallGalleryHillWeightV298(x,z);
  for(const baseline of[3,5.2])for(let j=16;j<115;j+=7)for(let i=12;i<97;i+=5){
   const x=B[0]+i*4,z=B[1]+j*4;
   for(const[a,b]of[[.7,.2],[.15,.85],[.5,.5]]){
    const q=wallGalleryHillGroundAtV298(x+a*4,z+b*4,false,baseline);if(q===null)continue;
    const nw=blend(x,z,baseline),se=blend(x+4,z+4,baseline);
    const expected=a>=b?nw*(1-a)+blend(x+4,z,baseline)*(a-b)+se*b:nw*(1-b)+blend(x,z+4,baseline)*(b-a)+se*a;
    expect(q).toBeCloseTo(expected,9);
    expect(parkReliefAt(x+a*4,z+b*4,baseline)).toBeCloseTo(expected,9);
    expect(terrainGroundAt(x+a*4,z+b*4,baseline)).toBeCloseTo(expected,9);
   }
  }
 });
 test('native samples the global four-metre cell centre before mask and quantisation',()=>{
  for(const baseline of[3,5.2])for(let z=-2780;z<-2430;z+=28)for(let x=2070;x<2440;x+=28){
   const cx=Math.floor(x/4)*4+2,cz=Math.floor(z/4)*4+2;
   const a=wallGalleryHillGroundAtV298(x+.1,z+.3,true,baseline),b=wallGalleryHillGroundAtV298(cx,cz,true,baseline);
   expect(a).toBe(b);if(a===null)continue;
   expect(a/.125).toBe(Math.round(a/.125));
   expect(parkReliefAt(x+.1,z+.3,baseline,true)).toBe(a);
   expect(terrainGroundAt(x+.1,z+.3,baseline,true)).toBe(a);
  }
 });
 test('new source paths retain source clearance instead of subtracting the hill',()=>{
  const p:ParkPath={id:'hypothetical-source-route',kind:'steps',points:[[2220,5.245,-2660],[2260,5.245,-2660]]};
  const sampler=createCoreParkPathTerrainSampler((x,z)=>wallGalleryHillGroundAtV298(x,z)??5.2);
  for(let x=2220;x<=2260;x+=2)expect(sampler(p,x,-2660,5.245)).toBeCloseTo(wallGalleryHillGroundAtV298(x,-2660)!+.045,9);
  expect(sampler(p,0,0,5.245)).toBe(5.245);
 });
 test('finite synthetic raster slices keep their full old outside complement',()=>{
  for(const mode of['drawn','native']as const){
   const slices=parkReliefGroundSlices(0,130,0,{cell:4,minXIndex:490,minZIndex:-660,strideCells:4,mode,nearest:()=>5.2,smooth:()=>5.2})!;
   expect(slices[0].xStart).toBe(0);expect(slices.at(-1)!.xStart+slices.at(-1)!.run).toBe(130);
   for(const s of slices)for(let i=s.xStart;i<s.xStart+s.run;i++)expect(s.topY).toBeCloseTo(wallGalleryHillGroundAtV298((490+i+.5)*4,(-660+.5)*4,mode==='native',5.2)??5.2,9);
  }
 });
});

test('source Core runs near the new support all retain exact original transforms/count',()=>{
 const g=groundSource as VoxelPayload,nearest=groundTopSampler(g),smooth=smoothGroundTopSampler(g);
 let candidates=0;
 for(let z=0;z<g.ground_rows.length;z++){
  const wz=(g.grid.min_z_idx+z+.5)*g.cell_m;if(wz<B[1]-16||wz>B[3]+16)continue;
  for(const[x,run]of g.ground_rows[z]){
   const a=(g.grid.min_x_idx+x)*g.cell_m,b=a+run*g.cell_m;if(b<B[0]-16||a>B[2]+16)continue;candidates++;
   for(const mode of['drawn','native']as const)expect(parkReliefGroundSlices(x,run,z,{cell:g.cell_m,minXIndex:g.grid.min_x_idx,minZIndex:g.grid.min_z_idx,strideCells:g.ground_height.stride_cells,mode,nearest,smooth})).toBeNull();
  }
 }expect(candidates).toBe(0);
});

test('all high-rise fittings use the retained rendered three-metre datum',()=>{
 for(const native of[false,true])for(const building of D.buildings){
  const rows=wallGalleryGeometryV298(native).rows.filter(r=>r.role.includes(building.id));expect(rows.length).toBeGreaterThan(0);
  for(const r of rows){expect(r.p[1]-r.s[1]/2).toBeGreaterThanOrEqual(3);expect(r.p[1]+r.s[1]/2).toBeLessThanOrEqual(3+building.height+.001);}
 }
});

test('actual native Core ground buffers stay byte-identical with the new field enabled',()=>{
 const support=coreParkReliefSupports.pop()!;let before:InstancedMesh|undefined,after:InstancedMesh|undefined;
 try{
  before=createGroundSlabs(nativeGroundSource as VoxelPayload,'before',{}, {parkRelief:'native'});
  coreParkReliefSupports.push(support);
  after=createGroundSlabs(nativeGroundSource as VoxelPayload,'after',{}, {parkRelief:'native'});
  expect(after.count).toBe(before.count);
  for(const key of['instanceMatrix','instanceColor']as const){const a=before[key]!.array,b=after[key]!.array;expect(new Bun.CryptoHasher('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex')).toBe(new Bun.CryptoHasher('sha256').update(new Uint8Array(b.buffer,b.byteOffset,b.byteLength)).digest('hex'));}
 }finally{if(!coreParkReliefSupports.includes(support))coreParkReliefSupports.push(support);before?.geometry.dispose();after?.geometry.dispose();}
});

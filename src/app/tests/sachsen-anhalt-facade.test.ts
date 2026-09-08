import {describe,expect,test} from "bun:test";
import {Box3,BoxGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Raycaster,Vector3} from "three";
import {SACHSEN_ANHALT_FACADE_PROFILE as profile,SACHSEN_ANHALT_FACADE_IDS as ids,createSachsenAnhaltFacade,createMinecraftSachsenAnhaltFacade,type SachsenAnhaltFacadeBlock} from "../src/SachsenAnhaltFacade";
import {createIsometricCity,type PrismPayload} from "../src/IsometricCityWorld";
import {FEDERAL_STATE_REPRESENTATIONS} from "../src/FederalStateRepresentations";
import prismsJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelsJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import type {DeutschesTheaterVoxelPayload} from "../src/DeutschesTheater";
const prisms=prismsJson as unknown as PrismPayload,voxels=voxelsJson as unknown as DeutschesTheaterVoxelPayload;
function cubes(){const c:number[][]=[];voxels.building_rows!.forEach((row,zi)=>{const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z< -340||z> -302)return;for(const [xi,n,lo,hi]of row)for(let i=0;i<n;i++){const x=(voxels.grid.min_x_idx+xi+i+.5)*voxels.cell_m;if(x>530&&x<575)c.push([x,z,lo/10,hi/10]);}});const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),c.length),m=new Matrix4();c.forEach(([x,z,lo,hi],i)=>mesh.setMatrixAt(i,m.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(hi+lo)/2,z)));mesh.name="source cells";mesh.computeBoundingSphere();return mesh;}
const normal=new Vector3(profile.end[1]-profile.start[1],0,profile.start[0]-profile.end[0]).normalize(),along=new Vector3(-normal.z,0,normal.x);
function b(g:Group):SachsenAnhaltFacadeBlock[]{return g.userData.blocks;}
describe("Luisenstrasse 18 protected ochre facade",()=>{
  test("uses the eastern exact source edge and retains three floors without party-wall windows",()=>{
    const p=FEDERAL_STATE_REPRESENTATIONS.find(p=>p.id==="sachsen-anhalt")!;
    expect(p.facadeRuns).toHaveLength(1);expect(p.facadeRuns[0].startWorldM).toEqual(profile.start);expect(p.facadeRuns[0].endWorldM).toEqual(profile.end);expect(p.facadeRuns[0].sourcePartId).toBe("DEBE3DfrmIgrCTOY");expect(p.facadeRuns[0].storeys).toBe(3);expect(p.facadeRuns[0].bayCount).toBe(9);
    for(const id of ids)expect(prisms.buildings.some(p=>p.id===id)).toBeTrue();
    const g=createSachsenAnhaltFacade({diagnostics:true}),bounds=new Box3().setFromObject(g);
    expect(bounds.min.x).toBeGreaterThan(560.8);expect(bounds.min.z).toBeGreaterThan(-333.6);expect(bounds.max.z).toBeLessThan(-309.5);
    const parts=b(g);expect(parts.filter(p=>p.role==="ground-floor glazing")).toHaveLength(8);expect(parts.filter(p=>p.role==="principal-floor glazing")).toHaveLength(8);expect(parts.filter(p=>p.role==="upper-floor glazing")).toHaveLength(9);expect(parts.filter(p=>p.role==="central 1874 oriel body")).toHaveLength(1);
  });
  for(const minecraft of [false,true])for(const mobileLike of [false,true])test(`${minecraft?"Minecraft":"drawn"} ${mobileLike?"mobile":"full"} stays one bounded texture-free batch`,()=>{
    const g=(minecraft?createMinecraftSachsenAnhaltFacade:createSachsenAnhaltFacade)({mobileLike,voxels,diagnostics:true});expect(g.children).toHaveLength(1);const m=g.children[0]as InstancedMesh;expect(m).toBeInstanceOf(InstancedMesh);expect(m.count).toBeGreaterThan(220);expect(m.count).toBeLessThan(600);expect(m.geometry.getAttribute("uv")).toBeUndefined();expect(m.instanceMatrix.array.every(Number.isFinite)).toBeTrue();
    const bytes=m.instanceMatrix.array.byteLength+(m.instanceColor?.array.byteLength??0);expect(bytes).toBeLessThan(46_000);
    for(const mat of [m.material,m.userData.dayMaterial,m.userData.nightMaterial])expect(mat.map).toBeNull();
    const bounds=new Box3().setFromObject(g);expect(bounds.min.y).toBeGreaterThan(3.99);expect(bounds.max.y).toBeLessThan(profile.facadeTop+.01);expect(bounds.max.x).toBeLessThan(minecraft?572:565);
    expect(g.userData.detailCounts).toMatchObject({storeys:3,bays:9,oriels:1});
  });
  for(const minecraft of [false,true])test(`${minecraft?"Minecraft":"drawn"} real window and oriel glazing clear the retained metric body`,()=>{
    const d=(minecraft?createMinecraftSachsenAnhaltFacade:createSachsenAnhaltFacade)({voxels,diagnostics:true}),root=new Group();
    root.add(minecraft?cubes():createIsometricCity({...prisms,buildings:prisms.buildings.filter(p=>ids.has(p.id))},null,null,null,{includeContext:false}),d);root.updateMatrixWorld(true);
    const panes=b(d).filter(p=>p.role.endsWith("glazing"));expect(panes).toHaveLength(26);
    for(const p of panes){const point=new Vector3(...p.position).addScaledVector(along,p.size[0]*.27);point.y-=p.size[1]*.18;
      const hits=new Raycaster(point.addScaledVector(normal,4),normal.clone().negate(),0,4.5).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toBe(d.children[0].name);expect(b(d)[hits[0].instanceId!]?.role).toBe(p.role);
    }
  });
});

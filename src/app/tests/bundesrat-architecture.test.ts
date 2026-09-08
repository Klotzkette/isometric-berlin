import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createBundesratArchitecture, createMinecraftBundesratArchitecture, bundesratWalls, type BundesratBlock, type BundesratVoxelPayload } from "../src/BundesratArchitecture";
import { BUNDESRAT_IDS, BUNDESRAT_SOURCE_PRISMS, BUNDESRAT_MAIN_ID, BUNDESRAT_TOP, BUNDESRAT_PROFILE, bundesratContains, bundesratColumnTopAt, bundesratRoofTopAt } from "../src/bundesratProfile";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const prisms=prismJson as unknown as PrismPayload, voxels=voxelJson as unknown as BundesratVoxelPayload;
const subset={...prisms,buildings:prisms.buildings.filter(p=>BUNDESRAT_IDS.has(p.id))};
function sourceColumns():InstancedMesh {
  const cols:number[][]=[];voxels.building_rows!.forEach((row,zi)=>{const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z<1024||z>1155)return;for(const[xi,n,lo,hi]of row)for(let i=0;i<n;i++){const x=(voxels.grid.min_x_idx+xi+i+.5)*voxels.cell_m;if(x>575&&x<710)cols.push([x,z,lo/10,bundesratColumnTopAt(x,z,hi/10,voxels.cell_m)]);}});
  const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),cols.length),m=new Matrix4();cols.forEach(([x,z,lo,hi],i)=>mesh.setMatrixAt(i,m.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(lo+hi)/2,z)));mesh.name="retained source voxels";mesh.computeBoundingSphere();return mesh;
}
function stats(root:Group){let calls=0,instances=0,bytes=0;root.traverse(o=>{if(!(o instanceof Mesh))return;calls++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});return{calls,instances,bytes};}
describe("Bundesrat source-bound recognition",()=>{
  test("retains all four exact parts and the open concave Ehrenhof",()=>{
    expect(BUNDESRAT_IDS.size).toBe(4);for(const p of BUNDESRAT_SOURCE_PRISMS)expect(p).toEqual(prisms.buildings.find(b=>b.id===p.id));
    const p=BUNDESRAT_SOURCE_PRISMS.find(p=>p.id===BUNDESRAT_MAIN_ID)!;expect(p.ring).toHaveLength(45);expect(p.holes).toHaveLength(0);
    expect(bundesratContains(p,644,1052)).toBeFalse();expect(bundesratContains(p,646,1110)).toBeTrue();expect(BUNDESRAT_PROFILE.osm).toBe("way/11688785");
  });
  for(const mc of [false,true])for(const mobileLike of [false,true])test(`${mc?"Minecraft":"drawn"} ${mobileLike?"mobile":"full"} remains finite, image-free and bounded`,()=>{
    const before=JSON.stringify(subset),g=(mc?createMinecraftBundesratArchitecture:createBundesratArchitecture)(subset,{mobileLike,voxels,diagnostics:true}),s=stats(g);expect(s.calls).toBe(mc?1:4);expect(s.instances).toBeGreaterThan(3000);expect(s.instances).toBeLessThan(8500);expect(s.bytes).toBeLessThan(950000);expect(JSON.stringify(subset)).toBe(before);
    g.traverse(o=>{if(!(o instanceof Mesh))return;expect(o.geometry.getAttribute("uv")).toBeUndefined();for(const a of Object.values(o.geometry.attributes))expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();if(o instanceof InstancedMesh)expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();for(const mat of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(mat&&"map"in mat)expect(mat.map).toBeNull();});
    expect(g.userData.detailCounts.porticoColumns).toBe(6);expect(g.userData.detailCounts.porticoBays).toBe(5);expect(g.userData.detailCounts.bronzeWorks).toBe(8);const b=g.userData.blocks as BundesratBlock[];expect(b.filter(b=>b.role==="Kirkeby bronze relief")).toHaveLength(2);expect(b.filter(b=>b.role==="wing bronze pedestal")).toHaveLength(6);const bounds=new Box3().setFromObject(g);expect(bounds.min.x).toBeGreaterThan(578);expect(bounds.max.x).toBeLessThan(710);expect(bounds.min.z).toBeGreaterThan(1020);expect(bounds.max.z).toBeLessThan(1150);expect(bounds.max.y).toBeLessThan(34);
  });
  test("every street and courtyard arch faces outside the retained source body",()=>{
    const root=new Group(),detail=createBundesratArchitecture(subset);root.add(createIsometricCity(subset,null,null,null,{includeContext:false}),detail);root.updateMatrixWorld(true);
    for(const w of bundesratWalls(subset).filter(w=>w.part.id===BUNDESRAT_MAIN_ID&&[19,22,23,26,28,29,32].includes(w.index))){const n=({19:6,22:7,23:5,26:5,28:5,29:7,32:6} as Record<number,number>)[w.index];for(let i=0;i<n;i++){const u=w.index===26?w.length*.05+w.length*.9*(i+.5)/5:w.length*(i+.5)/n,point=new Vector3(w.x+w.dx*(u+.31)+w.nx*.24,16.3,w.z+w.dz*(u+.31)+w.nz*.24),normal=new Vector3(w.nx,0,w.nz),hits=new Raycaster(point.clone().addScaledVector(normal,4),normal.clone().negate(),0,4.3).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toContain("Bundesrat");expect(hits[0].distance).toBeLessThan(4.02);}}
  });
  for(const mobileLike of [false,true])test(`Minecraft ${mobileLike?"mobile":"full"} glazing clears real oblique four-metre source cells`,()=>{
    const detail=createMinecraftBundesratArchitecture(subset,{mobileLike,voxels,diagnostics:true}),root=new Group();root.add(sourceColumns(),detail);root.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as BundesratBlock[]).filter(b=>(b.role==="arched glazing"||b.role==="window glazing")&&b.sourceId===BUNDESRAT_MAIN_ID&&b.normal&&b.normal[1]<-.9&&b.position[1]>13);
    expect(panes.length).toBeGreaterThan(30);for(const b of panes){const normal=new Vector3(b.normal![0],0,b.normal![1]),point=new Vector3(...b.position).add(new Vector3(-b.normal![1]*.29,.31,b.normal![0]*.29)),hits=new Raycaster(point.clone().addScaledVector(normal,2),normal.clone().negate(),0,2.4).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toContain("Minecraft Bundesrat");}
  });
  test("roof clipping preserves taller neighbours and roof access follows the authored glazed pyramid",()=>{
    expect(bundesratColumnTopAt(646,1110,28.6)).toBe(BUNDESRAT_TOP);expect(bundesratColumnTopAt(646,1110,70)).toBe(70);expect(bundesratColumnTopAt(644,1052,28.6)).toBe(28.6);expect(bundesratRoofTopAt(644,1052)).toBeNull();expect(bundesratRoofTopAt(646.8,1110.5)).toBeCloseTo(32.65,5);
    const root=createBundesratArchitecture(),point=new Vector3(646.8,40,1110.5);root.updateMatrixWorld(true);const hit=new Raycaster(point,new Vector3(0,-1,0),0,15).intersectObject(root,true)[0];expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(32.65,1);
  });
});

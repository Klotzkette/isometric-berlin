import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createBellevueArchitecture, createMinecraftBellevueArchitecture, type BellevueBlock, type BellevueVoxels } from "../src/BellevueArchitecture";
import { BELLEVUE_IDS, BELLEVUE_SOURCE, BELLEVUE_SOURCE_PRISMS, BELLEVUE_MAIN_ID, BELLEVUE_OFFICE_ID, BELLEVUE_PROFILE, bellevueContains, bellevueColumnTopAt, bellevueRoofTopAt } from "../src/bellevueProfile";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const voxels=voxelJson as unknown as BellevueVoxels;
function sourceColumns(): InstancedMesh {
  const columns:number[][]=[];
  voxels.building_rows!.forEach((row,zi)=>{const z=(voxels.grid.min_z_idx+zi+.5)*4;if(z<68||z>300)return;for(const[xi,n,lo,hi]of row)for(let i=0;i<n;i++){const x=(voxels.grid.min_x_idx+xi+i+.5)*4;if(x<-1432||x>-1186)continue;const top=bellevueColumnTopAt(x,z,hi/10);if(top>lo/10)columns.push([x,z,lo/10,top]);}});
  const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),columns.length),m=new Matrix4();columns.forEach(([x,z,lo,hi],i)=>mesh.setMatrixAt(i,m.makeScale(4,hi-lo,4).setPosition(x,(lo+hi)/2,z)));mesh.name="retained source voxel columns";mesh.computeBoundingSphere();return mesh;
}
function stats(g:Group){let calls=0,instances=0,bytes=0;g.traverse(o=>{if(!(o instanceof Mesh))return;calls++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});return{calls,instances,bytes};}
describe("Bellevue source-bound palace and presidential office",()=>{
  test("preserves all 14 palace parts plus the distinct permanent office",()=>{
    expect(BELLEVUE_IDS.size).toBe(15);for(const p of BELLEVUE_SOURCE_PRISMS)expect(p).toEqual(prismJson.buildings.find(b=>b.id===p.id));expect(BELLEVUE_SOURCE.palace.parts).toHaveLength(14);expect(BELLEVUE_SOURCE.office.parts).toHaveLength(1);expect(BELLEVUE_SOURCE.source_created).toBe("2026-03-02");
    expect(BELLEVUE_PROFILE.palace.osm).toBe("way/1034456118");expect(BELLEVUE_PROFILE.office.osm).toBe("way/226371533");expect(BELLEVUE_SOURCE_PRISMS.some(p=>bellevueContains(p,-1245,143))).toBeFalse();expect(bellevueRoofTopAt(-1245,143)).toBeNull();
  });
  for(const mc of [false,true])for(const mobileLike of [false,true])test(`${mc?"Minecraft":"drawn"} ${mobileLike?"mobile":"full"} is bounded, image-free and complete on partial startup data`,()=>{
    const f=mc?createMinecraftBellevueArchitecture:createBellevueArchitecture,g=f({buildings:[]},{mobileLike,voxels,diagnostics:true}),s=stats(g);expect(s.calls).toBe(mc?1:3);expect(s.instances).toBeGreaterThan(2000);expect(s.instances).toBeLessThan(10000);expect(s.bytes).toBeLessThan(850000);expect(g.userData.detailCounts.sourcePrisms).toBe(15);expect(g.userData.detailCounts.mainFrontBays).toBe(19);expect(g.userData.detailCounts.officeFloors).toBe(3);const bounds=new Box3().setFromObject(g);expect(bounds.min.x).toBeGreaterThan(-1430);expect(bounds.max.x).toBeLessThan(-1190);expect(bounds.min.z).toBeGreaterThan(70);expect(bounds.max.z).toBeLessThan(295);expect(bounds.max.y).toBeLessThan(29);
    g.traverse(o=>{if(!(o instanceof Mesh))return;expect(o.geometry.getAttribute("uv")).toBeUndefined();for(const a of Object.values(o.geometry.attributes))expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();if(o instanceof InstancedMesh)expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();for(const mat of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(mat&&"map"in mat)expect(mat.map).toBeNull();});
    const blocks=g.userData.blocks as BellevueBlock[];expect(blocks.filter(b=>b.role==="pediment allegory plinth")).toHaveLength(3);expect(blocks.filter(b=>b.role==="palace ridge chimney")).toHaveLength(2);expect(blocks.some(b=>b.role.includes("dormer"))).toBeFalse();
  });
  for(const mc of [false,true])for(const mobileLike of [false,true])test(`${mc?"voxel":"exact source"} ${mobileLike?"mobile":"full"} retains visible palace and office panes`,()=>{
    const detail=(mc?createMinecraftBellevueArchitecture:createBellevueArchitecture)(undefined,{mobileLike,voxels,diagnostics:true}),g=new Group();if(mc)g.add(sourceColumns());g.add(detail);g.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as BellevueBlock[]).filter(b=>b.role==="window glazing"||b.role==="office window glazing");expect(panes.length).toBeGreaterThan(300);
    const failures:string[]=[];for(const b of panes){const normal=new Vector3(b.normal![0],0,b.normal![1]),q=new Vector3(...b.position).add(new Vector3(-b.normal![1]*b.size[0]*.21,b.size[1]*.17,b.normal![0]*b.size[0]*.21)),ray=new Raycaster(q.clone().addScaledVector(normal,1.2),normal.clone().negate(),0,1.4),hits=ray.intersectObject(g,true);if(!hits.length||!hits[0].object.name.includes("Bellevue")||hits[0].distance>1.24)failures.push(`${b.sourceId}:${b.position.map(v=>v.toFixed(2))}:${hits[0]?.object.name}`);}
    expect(failures).toEqual([]);
  });
  test("roof planes remain inside their original measured vertical envelopes",()=>{
    for(const p of BELLEVUE_SOURCE_PRISMS){const xs=p.ring.map(v=>v[0]/10),zs=p.ring.map(v=>v[1]/10);for(let x=Math.min(...xs);x<Math.max(...xs);x+=1.19)for(let z=Math.min(...zs);z<Math.max(...zs);z+=1.23){if(!bellevueContains(p,x,z))continue;const y=bellevueRoofTopAt(x,z,p.id);if(y===null)continue;expect(y).toBeGreaterThanOrEqual(p.y0_dm/10-.1);expect(y).toBeLessThanOrEqual((p.y0_dm+p.h_dm)/10+.06);}}
    expect(bellevueRoofTopAt(-1383.58,259.9,BELLEVUE_OFFICE_ID)).toBeCloseTo(26.287,3);expect(bellevueColumnTopAt(-1394,234,29.2)).toBeLessThan(23);expect(bellevueColumnTopAt(-1254,94,33.2)).toBeLessThan(28);expect(bellevueColumnTopAt(-1266,110,70)).toBe(70);expect(bellevueColumnTopAt(-1245,143,33.2)).toBe(33.2);
  });
  test("drawn hipped roof ray heights agree with source plane sampling",()=>{
    const g=createBellevueArchitecture();g.updateMatrixWorld(true);let checked=0;
    for(const [x,z]of [[-1264,116],[-1274,130],[-1225,104],[-1287,163]] as const){const y=bellevueRoofTopAt(x,z),hit=new Raycaster(new Vector3(x,45,z),new Vector3(0,-1,0),0,40).intersectObject(g,true)[0];expect(y).not.toBeNull();expect(hit).toBeDefined();expect(Math.abs(hit.point.y-y!)).toBeLessThan(.25);checked++;}expect(checked).toBe(4);
    expect(BELLEVUE_SOURCE_PRISMS.find(p=>p.id===BELLEVUE_MAIN_ID)!.h_dm).toBe(219);
  });
});

test("adjacent source buildings remain intact and do not acquire palace windows", () => {
  expect(BELLEVUE_SOURCE.neighbours).toHaveLength(13);
  for (const p of BELLEVUE_SOURCE.neighbours) expect(p).toEqual(prismJson.buildings.find(b => b.id === p.id));
  expect(bellevueColumnTopAt(-1194,122,13.2)).toBe(13.2);
  expect(bellevueColumnTopAt(-1194,126,13.2)).toBe(13.2);
  expect(bellevueColumnTopAt(-1190,126,13.2)).toBe(13.2);
});

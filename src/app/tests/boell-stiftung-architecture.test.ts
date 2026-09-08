import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createBoellStiftungArchitecture, createMinecraftBoellStiftungArchitecture, boellStiftungWalls, type BoellStiftungBlock, type BoellStiftungVoxelPayload } from "../src/BoellStiftungArchitecture";
import { BOELL_STIFTUNG_CORE_ID, BOELL_STIFTUNG_IDS, BOELL_STIFTUNG_LOW_ID, BOELL_STIFTUNG_PROFILE, BOELL_STIFTUNG_SOURCE_PRISMS, boellStiftungCoreColumnTopAt, boellStiftungLowColumnContains, boellStiftungLowSolidAt, boellStiftungLowTopAt, boellStiftungPrismContains } from "../src/boellStiftungProfile";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
const prisms=prismJson as unknown as PrismPayload, voxels=voxelJson as unknown as BoellStiftungVoxelPayload;
const subset={...prisms,buildings:prisms.buildings.filter(p=>BOELL_STIFTUNG_IDS.has(p.id))};
function sourceCells(clipCore = true): InstancedMesh {
  const cells:number[][]=[];
  voxels.building_rows!.forEach((row,zi)=>{const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z< -551||z> -491)return;
    for(const [xi,count,y0,y1] of row)for(let n=0;n<count;n++){const x=(voxels.grid.min_x_idx+xi+n+.5)*voxels.cell_m;if(x>766&&x<822&&!boellStiftungLowColumnContains(x,z))cells.push([x,z,y0/10,y1/10]);}
  });
  const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),cells.length), matrix=new Matrix4();
  cells.forEach(([x,z,lo,rawHi],i)=>{const hi=clipCore?boellStiftungCoreColumnTopAt(x,z,rawHi,voxels.cell_m):rawHi;matrix.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(lo+hi)/2,z);mesh.setMatrixAt(i,matrix);});mesh.name="retained source voxel cells";mesh.computeBoundingSphere();return mesh;
}
describe("Heinrich-Boell-Stiftung source-bound architecture",()=>{
  test("retains exact LoD2 records and institutional identity",()=>{
    expect(BOELL_STIFTUNG_SOURCE_PRISMS).toHaveLength(2);for(const p of BOELL_STIFTUNG_SOURCE_PRISMS)expect(p).toEqual(prisms.buildings.find(b=>b.id===p.id));
    expect(BOELL_STIFTUNG_PROFILE.parent).toBe("DEBE01YYK00003sO");expect(BOELL_STIFTUNG_PROFILE.osm).toBe("node/4597099723");expect(BOELL_STIFTUNG_PROFILE.aboveGroundFloors).toBe(5);expect(BOELL_STIFTUNG_PROFILE.officeRows).toBe(3);expect(BOELL_STIFTUNG_PROFILE.sourceStatus).toContain("display estimate");
  });
  test("facade normals point outward from every exact source edge",()=>{
    for(const w of boellStiftungWalls(subset)){
      for(const p of [w.a,w.b])expect(w.part.ring.some(v=>v[0]/10===p[0]&&v[1]/10===p[1])).toBeTrue();expect(Math.hypot(w.nx,w.nz)).toBeCloseTo(1,9);
      expect(boellStiftungPrismContains(w.part,(w.a[0]+w.b[0])/2+w.nx*.02,(w.a[1]+w.b[1])/2+w.nz*.02)).toBeFalse();
    }
  });
  for(const minecraft of [false,true])for(const mobileLike of [false,true])test(`${minecraft?"Minecraft":"drawn"} ${mobileLike?"mobile":"full"} is finite, bounded and texture-free`,()=>{
    const before=JSON.stringify(subset),root=(minecraft?createMinecraftBoellStiftungArchitecture:createBoellStiftungArchitecture)(subset,{mobileLike,voxels,diagnostics:true});let renderables=0,bytes=0;
    root.traverse(o=>{if(o instanceof Mesh){renderables++;for(const a of Object.values(o.geometry.attributes)){expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();bytes+=a.array.byteLength;}bytes+=o.geometry.index?.array.byteLength??0;expect(o.geometry.getAttribute("uv")).toBeUndefined();
      if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();expect((o.material as MeshBasicMaterial).vertexColors).toBeFalse();expect(o.userData.nightMaterial).toBeDefined();}
    }});expect(renderables).toBe(minecraft?1:2);expect(bytes).toBeLessThan(minecraft?190_000:155_000);
    for(const [role,n]of Object.entries({"three-bar green foundation mark":3,"entry door glass":4,"roof array row":4,"short roof array row":3,"closed seasonal atrium cover":1}))expect(root.userData.detailCounts[role]).toBe(n);
    expect(root.userData.detailCounts["aluminium projecting web"]).toBeGreaterThan(20);expect(JSON.stringify(subset)).toBe(before);
    const box=new Box3().setFromObject(root);expect(box.max.y).toBeLessThan(28.83);expect(box.min.y).toBeGreaterThanOrEqual(5.1);expect(box.max.x-box.min.x).toBeLessThan(51);
  });
  test("cantilever actual cap rays agree with underside and collision height",()=>{
    for(const make of [createBoellStiftungArchitecture,createMinecraftBoellStiftungArchitecture]){
      const root=make(subset,{diagnostics:true}),blocks=root.userData.blocks as BoellStiftungBlock[];root.updateMatrixWorld(true);
      const sample=blocks.find(b=>b.role==="beletage roof block"&&b.position[0]>787&&b.position[0]<794&&b.position[2]>-503)??{position:[790,15.8,-500]};const[x,,z]=sample.position;
      expect(boellStiftungLowColumnContains(x,z)).toBeTrue();expect(boellStiftungLowSolidAt(x,7,z)).toBeFalse();expect(boellStiftungLowSolidAt(x,12,z)).toBeTrue();expect(boellStiftungLowSolidAt(x,17,z)).toBeFalse();
      const top=new Raycaster(new Vector3(x,24,z),new Vector3(0,-1,0),0,20).intersectObject(root,true);expect(top.length).toBeGreaterThan(0);expect(top[0].point.y).toBeCloseTo(boellStiftungLowTopAt(x,z)!,4);
      const under=new Raycaster(new Vector3(x,6.4,z),new Vector3(0,1,0),0,4).intersectObject(root,true);expect(under.length).toBeGreaterThan(0);expect(under[0].point.y).toBeCloseTo(8.8,4);
    }expect(boellStiftungLowTopAt(794,-525)).toBeNull();expect(boellStiftungLowColumnContains(300,300)).toBeFalse();
  });
  test("Minecraft roof corners remain inside the exact source L",()=>{
    const root=createMinecraftBoellStiftungArchitecture(subset,{diagnostics:true}),low=BOELL_STIFTUNG_SOURCE_PRISMS.find(p=>p.id===BOELL_STIFTUNG_LOW_ID)!;
    for(const b of(root.userData.blocks as BoellStiftungBlock[]).filter(b=>b.role==="beletage roof block"))for(const dx of [-1,1])for(const dz of [-1,1])expect(boellStiftungPrismContains(low,b.position[0]+dx*b.size[0]/2,b.position[2]+dz*b.size[2]/2)).toBeTrue();
  });
  test("core voxel clipping owns only its exact footprint and source rounding band",()=>{
    expect(boellStiftungCoreColumnTopAt(794,-526,29.2,4)).toBe(28.8);
    expect(boellStiftungCoreColumnTopAt(794,-526,28.8,4)).toBe(28.8);
    expect(boellStiftungCoreColumnTopAt(794,-526,17.2,4)).toBe(17.2);
    expect(boellStiftungCoreColumnTopAt(794,-526,29.3,4)).toBe(29.3);
    expect(boellStiftungCoreColumnTopAt(790,-500,29.2,4)).toBe(29.2);
    expect(boellStiftungCoreColumnTopAt(790,-546,29.2,4)).toBe(29.2);
    expect(boellStiftungCoreColumnTopAt(794,-526,29.2,0)).toBe(29.2);
    const core=BOELL_STIFTUNG_SOURCE_PRISMS.find(p=>p.id===BOELL_STIFTUNG_CORE_ID)!;
    for(let x=766;x<822;x+=4)for(let z=-550;z< -490;z+=4){
      const clipped=boellStiftungCoreColumnTopAt(x,z,29.2,4);
      expect(clipped).toBe(boellStiftungPrismContains(core,x,z)?28.8:29.2);
    }
  });
  for(const mobileLike of [false,true])test(`Minecraft ${mobileLike?"mobile":"full"} core roof remains visible over retained voxel caps`,()=>{
    const detail=createMinecraftBoellStiftungArchitecture(subset,{mobileLike,voxels,diagnostics:true});
    const original=sourceCells(false),clipped=sourceCells(),root=new Group().add(clipped,detail);root.updateMatrixWorld(true);original.updateMatrixWorld(true);
    const roof=(detail.userData.blocks as BoellStiftungBlock[]).filter(b=>["roof array row","short roof array row","roof service enclosure","closed seasonal atrium cover"].includes(b.role));
    expect(roof).toHaveLength(10);
    for(const b of roof){const[x,,z]=b.position,ray=new Raycaster(new Vector3(x,35,z),new Vector3(0,-1,0),0,15);
      expect(ray.intersectObject(original,true)[0].point.y).toBeCloseTo(29.2,4);
      const hit=ray.intersectObject(root,true)[0];expect(hit.object.parent).toBe(detail);expect(hit.point.y).toBeGreaterThan(28.8);expect(hit.point.y).toBeLessThan(28.83);
    }
  });
  for(const minecraft of [false,true])for(const mobileLike of [false,true])test(`actual ${minecraft?"Minecraft":"drawn"} ${mobileLike?"mobile":"full"} panes remain outside retained source mass`,()=>{
    const detail=(minecraft?createMinecraftBoellStiftungArchitecture:createBoellStiftungArchitecture)(subset,{mobileLike,voxels,diagnostics:true});const root=new Group();root.add(detail);root.add(minecraft?sourceCells():createIsometricCity({...prisms,buildings:subset.buildings.filter(p=>p.id===BOELL_STIFTUNG_CORE_ID)},null,null,null,{includeContext:false}));root.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as BoellStiftungBlock[]).filter(b=>b.role==="office glazing"||b.role==="beletage green glazing");let tested=0;
    for(const[i,b]of panes.entries()){if(i%7!==0)continue;const[nx,nz]=b.normal!;const hits=new Raycaster(new Vector3(b.position[0]+nx*5,b.position[1],b.position[2]+nz*5),new Vector3(-nx,0,-nz),0,7).intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.parent).toBe(detail);tested++;}expect(tested).toBeGreaterThan(10);
  });
});

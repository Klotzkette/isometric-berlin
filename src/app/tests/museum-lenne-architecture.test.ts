import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  createMuseumLenneArchitecture, createMinecraftMuseumLenneArchitecture, museumLenneWalls,
  museumLennePrismContains, musicMuseumHallColumnContains, type MuseumLenneBlock, type MuseumLenneVoxelPayload,
} from "../src/MuseumLenneArchitecture";
import {
  LENNE_TOWERS, MUSEUM_LENNE_IDS, MUSEUM_LENNE_SOURCE_PRISMS, MUSIC_MUSEUM_HALL_ID,
  MUSIC_MUSEUM_IDS, musicMuseumBodyHeight, MUSIC_MUSEUM_ROOF_LIGHT_RUNS, musicMuseumRoofHeightAt,
  MUSIC_MUSEUM_SOURCE_ROOF_RISES, musicMuseumFacadeTop,
} from "../src/museumLenneProfile";
import { createIsometricCity, fitRectangle, roofRise, buildRoofGeometry, ROOF_MIN_RECTANGULARITY, type PrismBuilding, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const prisms = prismJson as unknown as PrismPayload, voxels = voxelJson as unknown as MuseumLenneVoxelPayload;
const subset = { ...prisms, buildings: prisms.buildings.filter(p => MUSEUM_LENNE_IDS.has(p.id)) };
function retainedVoxelSkin(): InstancedMesh {
  const columns: number[][] = [];
  voxels.building_rows!.forEach((row, zi) => {
    const z = (voxels.grid.min_z_idx + zi + .5) * voxels.cell_m;
    if (z < 775 || z > 1035) return;
    for (const [xi, count, y0, y1] of row) for (let n = 0; n < count; n++) {
      const x = (voxels.grid.min_x_idx + xi + n + .5) * voxels.cell_m;
      if (x > -100 && x < 325 && !musicMuseumHallColumnContains(x,z)) columns.push([x,z,y0/10,y1/10]);
    }
  });
  const mesh = new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),columns.length), matrix = new Matrix4();
  columns.forEach(([x,z,lo,hi],i) => { matrix.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(lo+hi)/2,z);mesh.setMatrixAt(i,matrix); });
  mesh.name = "retained coarse source cells";mesh.computeBoundingSphere();return mesh;
}
describe("museum and Tiergarten-facing Lenne architecture", () => {
  test("retains every exact source part, height, roof code and source identity", () => {
    expect(MUSEUM_LENNE_SOURCE_PRISMS).toHaveLength(36);
    expect(MUSIC_MUSEUM_IDS.size).toBe(14);
    for (const part of MUSEUM_LENNE_SOURCE_PRISMS) expect(part).toEqual(prisms.buildings.find(p => p.id === part.id));
    expect(LENNE_TOWERS.map(t => t.number)).toEqual([11,9,7,5,3]);
    expect(LENNE_TOWERS.find(t => t.number === 7)!.parent).toBe("DEBE01YYK0002N8w");
    expect(LENNE_TOWERS.find(t => t.number === 7)!.osm).toBe("way/13760721");
    expect(musicMuseumBodyHeight(MUSIC_MUSEUM_HALL_ID,15.1)).toBeCloseTo(12.7,8);
  });
  test("facades follow actual source edges with unit outward normals", () => {
    for (const wall of museumLenneWalls(subset)) {
      for (const point of [wall.a,wall.b]) expect([wall.part.ring,...(wall.part.holes??[])].some(r => r.some(p=>p[0]/10===point[0]&&p[1]/10===point[1]))).toBeTrue();
      expect(Math.hypot(wall.nx,wall.nz)).toBeCloseTo(1,8);
      const mid=[(wall.a[0]+wall.b[0])/2,(wall.a[1]+wall.b[1])/2];
      expect(museumLennePrismContains(wall.part,mid[0]+wall.nx*.03,mid[1]+wall.nz*.03)).toBeFalse();
    }
  });
  for (const minecraft of [false,true]) for (const mobileLike of [false,true]) test(`${minecraft ? "Minecraft" : "drawn"} ${mobileLike ? "mobile" : "full"} remains finite, bounded and source preserving`, () => {
    const before=JSON.stringify(subset), root=(minecraft?createMinecraftMuseumLenneArchitecture:createMuseumLenneArchitecture)(subset,{mobileLike,voxels,diagnostics:true});
    let bytes=0,renderables=0;
    root.traverse(o=>{if(o instanceof Mesh){renderables++;for(const a of Object.values(o.geometry.attributes)){expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();bytes+=a.array.byteLength;}bytes+=o.geometry.index?.array.byteLength??0;
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      if(o instanceof InstancedMesh){bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();}
    }});
    expect(renderables).toBe(minecraft?1:2);expect(bytes).toBeLessThan(minecraft?490_000:mobileLike?430_000:890_000);
    expect(root.userData.detailCounts["museum rooflight upright"]).toBe(8);
    expect(root.userData.detailCounts["museum triangular gold relief"]).toBeGreaterThan(40);
    expect(root.userData.detailCounts["Lenne 5 tapering structural pier"]).toBeGreaterThan(20);
    for(const n of [3,5,7,9,11])expect(root.userData.detailCounts[`Lenne ${n} glazing`]).toBeGreaterThan(60);
    expect(JSON.stringify(subset)).toBe(before);
    const bounds=new Box3().setFromObject(root);expect(bounds.min.x).toBeGreaterThan(-96);expect(bounds.max.x).toBeLessThan(323);expect(bounds.max.z).toBeLessThan(1031);
  });
  test("eight actual rooflight crests stay in the retained main hall height envelope", () => {
    for(const make of [createMuseumLenneArchitecture,createMinecraftMuseumLenneArchitecture]){
      const root=make(subset,{diagnostics:true}), blocks=root.userData.blocks as MuseumLenneBlock[];
      const uprights=blocks.filter(b=>b.role==="museum rooflight upright");
      for(const b of uprights)expect(b.position[1]+b.size[1]/2).toBeCloseTo(19.4,6);
      root.updateMatrixWorld(true);
      const ray=new Raycaster(new Vector3(-53,30,921),new Vector3(0,-1,0),0,20);
      const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeLessThanOrEqual(19.4);expect(hits[0].point.y).toBeGreaterThan(16.7);
    }
  });
  test("museum panels and cornices leave the retained pitched roof slopes exposed", () => {
    const variants=[createMuseumLenneArchitecture,createMinecraftMuseumLenneArchitecture]
      .map(make=>make(subset,{diagnostics:true}).userData.blocks as MuseumLenneBlock[]);
    let exposedPanels=0;
    for(const [id,rise] of Object.entries(MUSIC_MUSEUM_SOURCE_ROOF_RISES)){
      const part=prisms.buildings.find(p=>p.id===id)!, top=(part.y0_dm+part.h_dm)/10;
      const rect=fitRectangle(part.ring.map(([x,z])=>[x/10,z/10]))!;
      expect(rect.rectangularity).toBeGreaterThanOrEqual(ROOF_MIN_RECTANGULARITY);
      expect(roofRise(rect,part.h_dm/10)).toBeCloseTo(rise,8);
      expect(buildRoofGeometry(rect,top-rise,top,part.roof!)).not.toBeNull();
      for(const blocks of variants){
        const panels=blocks.filter(b=>b.sourceId===id&&(b.role==="museum staggered panel"||b.role==="museum roof edge"||b.role==="institute glazing"));
        exposedPanels+=panels.length;
        for(const b of panels)expect(b.position[1]+b.size[1]/2).toBeLessThanOrEqual(musicMuseumFacadeTop(id,top)+1e-7);
      }
    }
    expect(exposedPanels).toBeGreaterThan(200);
  });
  test("all five independent gaps and the museum canopy approach remain open", () => {
    for(const make of [createMuseumLenneArchitecture,createMinecraftMuseumLenneArchitecture]){
      const root=make(subset,{voxels});root.updateMatrixWorld(true);
      for(const [x,z] of [[203,814],[227,806],[260,794],[291,783],[-32,934]]){
        const ray=new Raycaster(new Vector3(x,3.9,z),new Vector3(0,1,0),0,3);
        expect(ray.intersectObject(root,true)).toHaveLength(0);
      }
    }
  });
  test("roof support equals actual roof slope and block-step raycast heights", () => {
    for(const minecraft of [false,true]){
      const root=(minecraft?createMinecraftMuseumLenneArchitecture:createMuseumLenneArchitecture)(subset);root.updateMatrixWorld(true);
      for(const run of MUSIC_MUSEUM_ROOF_LIGHT_RUNS){
        const length=Math.hypot(run.b[0]-run.a[0],run.b[1]-run.a[1]), dx=(run.b[0]-run.a[0])/length, dz=(run.b[1]-run.a[1])/length;
        const pitch=length/run.count;
        for(const phase of [.125,.375,.625,.875]){
          const u=.04+phase*(pitch-.08),x=run.a[0]+dx*u-dz*4,z=run.a[1]+dz*u+dx*4;
          const hits=new Raycaster(new Vector3(x,30,z),new Vector3(0,-1,0),0,15).intersectObject(root,true);
          expect(hits.length).toBeGreaterThan(0);expect(hits[0].point.y).toBeCloseTo(musicMuseumRoofHeightAt(x,z,minecraft)!,3);
        }
      }
    }
    expect(musicMuseumRoofHeightAt(-60,885)).toBeNull();
  });
  test("drawn museum and CMS glazing is visible in front of source walls", () => {
    const detail=createMuseumLenneArchitecture(subset,{diagnostics:true});
    const body=createIsometricCity(subset,null,null,null,{includeContext:false});
    const root=new Group();root.add(body,detail);root.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as MuseumLenneBlock[]).filter(b=>(b.role==="Lenne 7 glazing"||b.role==="institute glazing")&&b.normal&&b.normal[0]>.45);
    expect(panes.length).toBeGreaterThan(20);
    for(const b of panes.filter((_,i)=>i%17===0)){
      const n=new Vector3(b.normal![0],0,b.normal![1]);
      const ray=new Raycaster(new Vector3(...b.position).addScaledVector(n,6),n.clone().negate(),0,7);
      const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].object.name).toBe(detail.children[0].name);
    }
  });
  test("Minecraft panes reach the exposed skin of the actual retained source cubes", () => {
    const detail=createMinecraftMuseumLenneArchitecture(subset,{voxels,diagnostics:true}), root=new Group();
    root.add(retainedVoxelSkin(),detail);root.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as MuseumLenneBlock[]).filter(b=>b.role.startsWith("Lenne")&&b.role.endsWith("glazing"));
    for(const b of panes.filter((_,i)=>i%31===0)){
      const n=new Vector3(b.normal![0],0,b.normal![1]);
      const ray=new Raycaster(new Vector3(...b.position).addScaledVector(n,5),n.clone().negate(),0,6);
      const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toBe(detail.children[0].name);
    }
  });
  test("hall replacement membership exactly follows its delivered nonrectangular outline",()=>{
    const hall=prisms.buildings.find(p=>p.id===MUSIC_MUSEUM_HALL_ID)!;
    for(let x=-94;x<-32;x+=1.7)for(let z=893;z<974;z+=1.9)
      expect(musicMuseumHallColumnContains(x,z)).toBe(museumLennePrismContains(hall,x,z));
  });
});

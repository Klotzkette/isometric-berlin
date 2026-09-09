import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  createMuseumLenneArchitecture, createMinecraftMuseumLenneArchitecture, museumLenneWalls,
  museumLennePrismContains, musicMuseumHallColumnContains, type MuseumLenneBlock, type MuseumLenneVoxelPayload,
} from "../src/MuseumLenneArchitecture";
import {
  LENNE_TOWERS, MUSEUM_LENNE_IDS, MUSEUM_LENNE_SOURCE_PRISMS, MUSIC_MUSEUM_HALL_ID,
  MUSIC_MUSEUM_IDS, musicMuseumBodyHeight, musicMuseumRoofHeightAt, MUSIC_MUSEUM_ROOF_BANDS, MUSIC_MUSEUM_ROOF_BASE,
  MUSIC_MUSEUM_PARTS, musicMuseumPartRoofHeightAt, musicMuseumReplacementColumn, musicMuseumFacadeTop,
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
      if (x > -100 && x < 325 && !musicMuseumReplacementColumn(x,z,y0/10,y1/10,voxels.cell_m)) columns.push([x,z,y0/10,y1/10]);
    }
  });
  const mesh = new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),columns.length), matrix = new Matrix4();
  columns.forEach(([x,z,lo,hi],i) => { matrix.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(lo+hi)/2,z);mesh.setMatrixAt(i,matrix); });
  mesh.name = "retained coarse source cells";mesh.computeBoundingSphere();return mesh;
}
describe("museum and Tiergarten-facing Lenne architecture", () => {
  test("retains every exact source part, height, roof code and source identity", () => {
    expect(MUSEUM_LENNE_SOURCE_PRISMS).toHaveLength(37);
    expect(MUSIC_MUSEUM_IDS.size).toBe(15);
    for (const part of MUSEUM_LENNE_SOURCE_PRISMS) expect(part).toEqual(prisms.buildings.find(p => p.id === part.id));
    expect(LENNE_TOWERS.map(t => t.number)).toEqual([11,9,7,5,3]);
    expect(LENNE_TOWERS.find(t => t.number === 7)!.parent).toBe("DEBE01YYK0002N8w");
    expect(LENNE_TOWERS.find(t => t.number === 7)!.osm).toBe("way/13760721");
    expect(musicMuseumBodyHeight(MUSIC_MUSEUM_HALL_ID,15.1)).toBeCloseTo(7.214,8);
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
    expect(renderables).toBe(minecraft?1:2);expect(bytes).toBeLessThan(minecraft?1_050_000:mobileLike?480_000:900_000);
    expect(root.userData.profile.roofLightCount).toBe(14);
    expect(root.userData.detailCounts["museum entry glazing"]).toBeGreaterThan(0);
    expect(root.userData.detailCounts["museum triangular gold relief"]).toBeGreaterThan(40);
    expect(root.userData.detailCounts["Lenne 5 tapering structural pier"]).toBeGreaterThan(20);
    for(const n of [3,5,7,9,11])expect(root.userData.detailCounts[`Lenne ${n} glazing`]).toBeGreaterThan(60);
    expect(JSON.stringify(subset)).toBe(before);
    const bounds=new Box3().setFromObject(root);expect(bounds.min.x).toBeGreaterThan(-96);expect(bounds.max.x).toBeLessThan(323);expect(bounds.max.z).toBeLessThan(1031);
  });
  test("absolute roof datum corrects the basement-to-street extrusion on all fourteen parts",()=>{
    expect(MUSIC_MUSEUM_PARTS).toHaveLength(15);
    for(const part of MUSIC_MUSEUM_PARTS.filter(p=>p.prism_id!=="K0003U6g")){
      const old=prisms.buildings.find(p=>p.id===part.prism_id)!;
      const sourceGround=part.surfaces.filter(s=>s.kind==="GroundSurface").flatMap(s=>s.rings.flat().map(p=>p[1]));
      expect(new Set(sourceGround)).toEqual(new Set([-1.152]));
      const actualMax=Math.max(...part.surfaces.filter(s=>s.kind==="RoofSurface").flatMap(s=>s.rings.flat().map(p=>p[1])));
      expect(actualMax).toBe(part.roof_max_y_m);
      expect((old.y0_dm+old.h_dm)/10-actualMax).toBeGreaterThan(4.8);
      expect((old.y0_dm+old.h_dm)/10-actualMax).toBeLessThan(5.6);
      for(const source of part.surfaces.filter(s=>s.kind==="GroundSurface"))for(const [x,,z]of source.rings[0])
        expect(old.ring.some((a,i)=>{const b=old.ring[(i+1)%old.ring.length],dx=(b[0]-a[0])/10,dz=(b[1]-a[1])/10,t=Math.max(0,Math.min(1,((x-a[0]/10)*dx+(z-a[1]/10)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]/10-t*dx,z-a[1]/10-t*dz)<.16;})).toBeTrue();
    }
    expect(Math.max(...MUSIC_MUSEUM_PARTS.map(p=>p.roof_max_y_m))).toBe(18.393);
  });
  test("all fourteen full-width hall rooflights and all exact pitched parts agree with downward mesh rays",()=>{
    for(const minecraft of [false,true]){
      const root=(minecraft?createMinecraftMuseumLenneArchitecture:createMuseumLenneArchitecture)(subset);root.updateMatrixWorld(true);
      let rays=0;
      for(const part of MUSIC_MUSEUM_PARTS){
        const points=part.surfaces.filter(s=>s.kind==="RoofSurface").flatMap(s=>s.rings[0]),xs=points.map(p=>p[0]),zs=points.map(p=>p[2]);
        for(let x=Math.floor(Math.min(...xs))+.5;x<Math.max(...xs);x+=3)for(let z=Math.floor(Math.min(...zs))+.5;z<Math.max(...zs);z+=3){
          const expected=musicMuseumPartRoofHeightAt(part.prism_id,x,z,minecraft);if(expected===null)continue;
          if(MUSIC_MUSEUM_PARTS.some(p=>p!==part&&[[0,0],[.35,0],[-.35,0],[0,.35],[0,-.35]].some(([dx,dz])=>Math.max(musicMuseumPartRoofHeightAt(p.prism_id,x+dx,z+dz,minecraft)??-Infinity,musicMuseumPartRoofHeightAt(p.prism_id,x+dx,z+dz,false)??-Infinity)>expected)))continue;
          const hits=new Raycaster(new Vector3(x,30,z),new Vector3(0,-1,0),0,30).intersectObject(root,true);
          expect(hits.length).toBeGreaterThan(0);expect(Math.abs(hits[0].point.y-expected)).toBeLessThan(.025);rays++;
        }
      }
      expect(rays).toBeGreaterThan(280);
      for(let i=0;i<14;i++)for(const x of [-70.5,-60.5]){
        const z0=MUSIC_MUSEUM_ROOF_BANDS.start+(i+.55)*MUSIC_MUSEUM_ROOF_BANDS.pitch+MUSIC_MUSEUM_ROOF_BANDS.skew*(x+60),z=minecraft?Math.floor(z0)+.5:z0;
        if(musicMuseumRoofHeightAt(x,z,minecraft)===null)continue;
        const hits=new Raycaster(new Vector3(x,25,z),new Vector3(0,-1,0),0,20).intersectObject(root,true);
        expect(hits[0].point.y).toBeCloseTo(musicMuseumRoofHeightAt(x,z,minecraft)!,2);
      }
    }
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
  test("drawn museum and CMS glazing is visible in front of source walls", () => {
    const detail=createMuseumLenneArchitecture(subset,{diagnostics:true});
    const body=createIsometricCity(subset,null,null,null,{includeContext:false});
    const root=new Group();root.add(body,detail);root.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as MuseumLenneBlock[]).filter(b=>(b.role==="Lenne 7 glazing"||b.role==="institute glazing"||b.role==="museum entry glazing")&&b.normal&&b.normal[0]>.45);
    expect(panes.length).toBeGreaterThan(20);
    for(const b of panes.filter((_,i)=>i%17===0||panes[i].role==="museum entry glazing")){
      const n=new Vector3(b.normal![0],0,b.normal![1]);
      const ray=new Raycaster(new Vector3(...b.position).addScaledVector(n,6),n.clone().negate(),0,7);
      const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].object.name).toBe(detail.children[0].name);
    }
  });
  test("Minecraft panes reach the exposed skin of the actual retained source cubes", () => {
    const detail=createMinecraftMuseumLenneArchitecture(subset,{voxels,diagnostics:true}), root=new Group();
    root.add(retainedVoxelSkin(),detail);root.updateMatrixWorld(true);
    const panes=(detail.userData.blocks as MuseumLenneBlock[]).filter(b=>(b.role.startsWith("Lenne")&&b.role.endsWith("glazing"))||b.role==="museum entry glazing");
    for(const b of panes.filter((_,i)=>i%31===0||panes[i].role==="museum entry glazing")){
      const n=new Vector3(b.normal![0],0,b.normal![1]);
      const ray=new Raycaster(new Vector3(...b.position).addScaledVector(n,5),n.clone().negate(),0,6);
      const hits=ray.intersectObject(root,true);expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toBe(detail.children[0].name);
    }
  });
  test("source-height quantization never leaves the old inflated museum cells above the refined shell",()=>{
    let owned=0,retainedTall=0;
    voxels.building_rows!.forEach((row,zi)=>{
      const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z<890||z>1035)return;
      for(const [xi,count,lo,hi] of row)for(let n=0;n<count;n++){
        const x=(voxels.grid.min_x_idx+xi+n+.5)*voxels.cell_m;if(x< -99||x> -28)continue;
        const parts=MUSEUM_LENNE_SOURCE_PRISMS.filter(p=>MUSIC_MUSEUM_IDS.has(p.id)&&museumLennePrismContains(p as PrismBuilding,x,z));
        if(!parts.length)continue;
        if(parts.some(p=>Math.abs(hi/10-lo/10-Math.ceil(p.h_dm/10/4)*4)<=.11&&lo/10<=p.y0_dm/10+.51)){
          expect(musicMuseumReplacementColumn(x,z,lo/10,hi/10,voxels.cell_m)).toBeTrue();owned++;
        }else if(hi/10-lo/10>24){expect(musicMuseumReplacementColumn(x,z,lo/10,hi/10,voxels.cell_m)).toBeFalse();retainedTall++;}
      }
    });
    expect(owned).toBeGreaterThan(180);
    for(const [x,z]of[[-74,910],[-74,914],[-78,926],[-82,938],[-90,958]])expect(musicMuseumReplacementColumn(x,z,4.3,12.3,4)).toBeFalse();
    // A taller adjoining Philharmonie source column can never be claimed by the museum.
    expect(musicMuseumReplacementColumn(-75,942,4,45,4)).toBeFalse();
  });
  test("hall replacement membership exactly follows its delivered nonrectangular outline",()=>{
    const hall=prisms.buildings.find(p=>p.id===MUSIC_MUSEUM_HALL_ID)!;
    for(let x=-94;x<-32;x+=1.7)for(let z=893;z<974;z+=1.9)
      expect(musicMuseumHallColumnContains(x,z)).toBe(museumLennePrismContains(hall,x,z));
  });
});

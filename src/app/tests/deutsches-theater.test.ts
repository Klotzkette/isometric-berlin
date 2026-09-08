import { describe, expect, test } from "bun:test";
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import {
  DEUTSCHES_THEATER_CUSTOM_FACADE_IDS, DEUTSCHES_THEATER_IDS,
  DEUTSCHES_THEATER_KAMMERSPIELE_IDS, DEUTSCHES_THEATER_MAIN_IDS,
  DEUTSCHES_THEATER_PROFILE, DEUTSCHES_THEATER_SOURCE_PRISMS,
  DEUTSCHES_THEATER_TONES, createDeutschesTheater, createMinecraftDeutschesTheater,
  type DeutschesTheaterBlock, type DeutschesTheaterVoxelPayload,
} from "../src/DeutschesTheater";
import {
  HERO_PRISM_TONES, WINDOWS_SUPPRESSED_IDS, createIsometricCity, type PrismPayload,
} from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const prisms = prismJson as unknown as PrismPayload;
const voxels = voxelJson as unknown as DeutschesTheaterVoxelPayload;
const subset = {...prisms,buildings:prisms.buildings.filter(p=>DEUTSCHES_THEATER_IDS.has(p.id))};
function sourceColumns():InstancedMesh {
  const cols:number[][]=[];
  voxels.building_rows!.forEach((row,zi)=>{
    const z=(voxels.grid.min_z_idx+zi+.5)*voxels.cell_m;if(z< -645||z> -540)return;
    for(const [xi,count,y0,y1] of row)for(let n=0;n<count;n++){
      const x=(voxels.grid.min_x_idx+xi+n+.5)*voxels.cell_m;if(x>615&&x<815)cols.push([x,z,y0/10,y1/10]);
    }
  });
  const m=new Matrix4(),mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),cols.length);
  cols.forEach(([x,z,lo,hi],i)=>{m.makeScale(voxels.cell_m,hi-lo,voxels.cell_m).setPosition(x,(lo+hi)/2,z);mesh.setMatrixAt(i,m);});
  mesh.name="retained source cells";mesh.computeBoundingSphere();return mesh;
}
function blocks(g:Group):DeutschesTheaterBlock[]{return g.userData.blocks as DeutschesTheaterBlock[];}
function stats(g:Group){let calls=0,instances=0,bytes=0;g.traverse(o=>{if(!(o instanceof Mesh))return;calls++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;bytes+=o.geometry.index?.array.byteLength??0;if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);}});return{calls,instances,bytes};}

describe("Deutsches Theater and real Kammerspiele source correction",()=>{
  test("retains all 27 measured parts of the two distinct, correctly named parents",()=>{
    expect(DEUTSCHES_THEATER_IDS.size).toBe(27);
    expect(DEUTSCHES_THEATER_MAIN_IDS.size).toBe(15);
    expect(DEUTSCHES_THEATER_KAMMERSPIELE_IDS.size).toBe(12);
    expect(DEUTSCHES_THEATER_MAIN_IDS.has("TVjCvFcI")).toBeTrue();
    expect(DEUTSCHES_THEATER_MAIN_IDS.has("KeeAYa8r")).toBeTrue();
    expect(DEUTSCHES_THEATER_KAMMERSPIELE_IDS.has("yMkbzxqy")).toBeTrue();
    for(const {parent,...part} of DEUTSCHES_THEATER_SOURCE_PRISMS){
      expect(part).toEqual(prisms.buildings.find(p=>p.id===part.id));
      expect(parent).toBe(DEUTSCHES_THEATER_KAMMERSPIELE_IDS.has(part.id)?"DEBE01YYK000037b":"DEBE01YYK00002VR");
      expect(HERO_PRISM_TONES[part.id]).toBe(DEUTSCHES_THEATER_KAMMERSPIELE_IDS.has(part.id)?DEUTSCHES_THEATER_TONES.kammerspiele:DEUTSCHES_THEATER_TONES.facadeIvory);
      expect(WINDOWS_SUPPRESSED_IDS.has(part.id)).toBeTrue();
    }
    expect(DEUTSCHES_THEATER_CUSTOM_FACADE_IDS.size).toBe(27);
  });
  test("puts the real portico in the courtyard and removes the false street-wing identity",()=>{
    const g=createDeutschesTheater(subset,{diagnostics:true}),b=blocks(g);
    const labels=b.filter(b=>b.role.startsWith("inscription"));
    expect(labels.length).toBeGreaterThan(200);
    expect(labels.every(b=>b.sourceId==="KeeAYa8r"||b.sourceId==="yMkbzxqy")).toBeTrue();
    expect(labels.some(b=>b.sourceId==="wZRgel5C")).toBeFalse();
    expect(labels.filter(b=>b.sourceId==="KeeAYa8r").every(b=>b.position[2]< -576)).toBeTrue();
    expect(g.userData.detailCounts.mainPilasters).toBe(3);
    expect(g.userData.detailCounts.kammerspieleBays).toBe(8);
    expect(g.userData.facadeLabels).toEqual(["DEUTSCHES THEATER","KAMMERSPIELE","DES","DEUTSCHEN THEATERS"]);
    expect(DEUTSCHES_THEATER_PROFILE.mainFrontId).toBe("KeeAYa8r");
    expect(DEUTSCHES_THEATER_PROFILE.kammerspieleParent).toBe("DEBE01YYK000037b");
  });
  for(const minecraft of [false,true])for(const mobileLike of [false,true])test(`${minecraft?"Minecraft":"drawn"} ${mobileLike?"mobile":"full"} is bounded, image-free and leaves every source intact`,()=>{
    const before=JSON.stringify(subset),g=(minecraft?createMinecraftDeutschesTheater:createDeutschesTheater)(subset,{mobileLike,voxels,diagnostics:true});
    const s=stats(g);expect(s.calls).toBe(minecraft?1:4);expect(s.bytes).toBeLessThan(minecraft?600_000:mobileLike?290_000:380_000);
    expect(s.instances).toBeGreaterThan(2500);expect(s.instances).toBeLessThan(7000);
    g.traverse(o=>{if(!(o instanceof Mesh))return;expect(o.geometry.getAttribute("uv")).toBeUndefined();for(const a of Object.values(o.geometry.attributes))expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();if(o instanceof InstancedMesh)expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
      for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial].flat())if(m&&"map"in m)expect(m.map).toBeNull();
    });
    expect(JSON.stringify(subset)).toBe(before);const bounds=new Box3().setFromObject(g);
    expect(bounds.min.x).toBeGreaterThan(614);expect(bounds.max.x).toBeLessThan(814);expect(bounds.min.z).toBeGreaterThan(-640);expect(bounds.max.z).toBeLessThan(-544);expect(bounds.min.y).toBeGreaterThan(5.19);expect(bounds.max.y).toBeLessThan(30.51);
    expect(g.userData.rooftopMark).toBe("DT");expect(g.userData.detailCounts.sourcePrisms).toBe(27);expect(g.userData.geometryStatus).toContain("not facade survey");
  });
  test("the real front-facing D encloses its T on the left and uses a rectangular support",()=>{
    for(const make of [createDeutschesTheater,createMinecraftDeutschesTheater]){
      const b=blocks(make(subset,{diagnostics:true})),right=new Vector3(.972,0,-.236);
      const d=b.filter(b=>b.role==="roof D outline").map(b=>new Vector3(...b.position).dot(right));
      const t=b.filter(b=>b.role==="roof T stem").map(b=>new Vector3(...b.position).dot(right));
      expect(Math.min(...t)).toBeGreaterThan(Math.min(...d));expect(Math.max(...t)).toBeLessThan((Math.min(...d)+Math.max(...d))/2);
      expect(b.filter(b=>b.role==="roof logo rectangular support")).toHaveLength(2);
      expect(b.filter(b=>b.role==="roof logo diagonal brace").length).toBeGreaterThan(0);
      expect(b.filter(b=>b.role.startsWith("pediment DT")).length).toBeGreaterThan(15);
    }
  });
  test("all ten actual arched glazing fields face outwards and clear the retained source prisms",()=>{
    const detail=createDeutschesTheater(subset),root=new Group();root.add(createIsometricCity(subset,null,null,null,{includeContext:false}),detail);root.updateMatrixWorld(true);
    for(const [id,index,length,positions,y,out] of [
      ["KeeAYa8r",2,17.79446543029545,[.385,.615],11.25,1.11],
      ["yMkbzxqy",4,23.15,Array.from({length:8},(_,i)=>(i+.5)/8),17.2,1.18],
    ] as const){
      const ring=subset.buildings.find(b=>b.id===id)!.ring,a=ring[index],b=ring[(index+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,n=new Vector3(dz,0,-dx);
      for(const u of positions){const point=new Vector3(a[0]/10+dx*length*u+n.x*out,y,a[1]/10+dz*length*u+n.z*out);
        const hits=new Raycaster(point.clone().addScaledVector(n,3),n.clone().negate(),0,3.6).intersectObject(root,true);
        expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toContain("Deutsches Theater");expect(hits[0].object.name).not.toBe("LoD2 prism buildings");
      }
    }
  });
  test("Minecraft courtyard glazing remains outside the actual retained coarse source cubes",()=>{
    const detail=createMinecraftDeutschesTheater(subset,{voxels,diagnostics:true}),root=new Group();root.add(sourceColumns(),detail);root.updateMatrixWorld(true);
    const panes=blocks(detail).filter(b=>b.role==="window glazing"&&b.normal&&b.normal[1]>.9&&
      (b.sourceId==="KeeAYa8r"||(b.sourceId==="yMkbzxqy"&&b.position[0]>691)));
    expect(panes.length).toBe(12);
    for(const b of panes){
      const n=new Vector3(b.normal![0],0,b.normal![1]),point=new Vector3(...b.position);point.y+=b.size[1]*.08;
      point.addScaledVector(new Vector3(-n.z,0,n.x),b.size[0]*.23);
      const hits=new Raycaster(point.addScaledVector(n,4),n.clone().negate(),0,4.6).intersectObject(root,true);
      expect(hits.length).toBeGreaterThan(0);expect(hits[0].object.name).toContain("Minecraft Deutsches Theater");
      expect(blocks(detail)[hits[0].instanceId!].role).toBe("window glazing");
    }
    const arches=blocks(detail).filter(b=>b.role==="stepped arch field"&&b.color===DEUTSCHES_THEATER_TONES.glass);
    expect(arches).toHaveLength(10);
    for(const b of arches){
      const n=new Vector3(b.normal![0],0,b.normal![1]);
      const point=new Vector3(...b.position).addScaledVector(new Vector3(-n.z,0,n.x),b.size[0]*.24);
      point.y+=.15;
      const hits=new Raycaster(point.addScaledVector(n,4),n.clone().negate(),0,4.6).intersectObject(root,true);
      expect(hits.length).toBeGreaterThan(0);
      const hitBlock=blocks(detail)[hits[0].instanceId!];
      expect(hitBlock?.role).toBe("stepped arch field");expect(hitBlock?.color).toBe(DEUTSCHES_THEATER_TONES.glass);
    }
  });
  test("records official architecture, source-alignment evidence and inspected free facade references",()=>{
    expect(DEUTSCHES_THEATER_PROFILE.sourceUrls).toContain("https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011193");
    expect(DEUTSCHES_THEATER_PROFILE.sourceUrls).toContain("https://gdi.berlin.de/services/wms/dop_2025_fruehjahr");
    expect(DEUTSCHES_THEATER_PROFILE.sourceUrls.filter(u=>u.includes("2024-05-09"))).toHaveLength(2);
  });
});

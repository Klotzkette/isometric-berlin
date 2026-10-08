import {describe,expect,it} from "bun:test";
import {Box3,InstancedMesh,Mesh,MeshBasicMaterial,Matrix4,Vector3} from "three";
import {createZooStationV165,createMinecraftZooStationV165,ZOO_STATION_V165_PROFILE} from "../src/ZooStationV165";
import {ZOO_STATION_V165_PRISM_IDS,ZOO_STATION_V165_PARTS,zooStationV165FloorAt,zooStationV165PassageAt,zooStationV165RoofAt,zooStationV165SourceColumn} from "../src/zooStationV165Profile";
import source from "../src/data/zooStationV165Source.json";
import nav from "../src/data/zooStationV165Navigation.json";
import {ZOO_ENTRANCE_V192_PART} from "../src/stationDetailsV192Profile";
function digest(root:ReturnType<typeof createZooStationV165>){
  const result:any[]=[];root.traverse(o=>{if(o instanceof Mesh){result.push({name:o.name,position:Array.from(o.geometry.getAttribute("position").array),instances:o instanceof InstancedMesh?Array.from(o.instanceMatrix.array):[],colors:o instanceof InstancedMesh?Array.from(o.instanceColor!.array):o.geometry.getAttribute("color")?Array.from(o.geometry.getAttribute("color").array):[...(o.material as MeshBasicMaterial).color.toArray()]});}});return result;
}
function dispose(root:ReturnType<typeof createZooStationV165>){root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const m of new Set([o.material,o.userData.dayMaterial,o.userData.nightMaterial]))if(m&&!Array.isArray(m))m.dispose();}});}
describe("source-bound Zoo station and Amerika Haus",()=>{
 it("keeps the entire 21-part composition, six tracks and three mapped platforms",()=>{
   expect(ZOO_STATION_V165_PARTS).toEqual([...nav.parts,ZOO_ENTRANCE_V192_PART]);expect(new Set(source.tracks.map(t=>t.ref))).toEqual(new Set(["1","2","3","4","5","6"]));
   expect(source.platforms.map(p=>p.ref)).toEqual(["5;6","3;4","1;2"]);expect(source.platforms.every(p=>p.polygons[0].ring.length>10)).toBe(true);
   expect(ZOO_STATION_V165_PROFILE.trackCount).toBe(6);expect(source.parts.filter(p=>p.name==="Amerika Haus").length).toBe(7);
   expect(source.surfaces.filter(s=>s.kind==="RoofSurface").every(s=>s.material==="roof")).toBe(true);
 });
 it("uses low-alpha curtain walls with depth writes disabled and identical full mobile detail",()=>{
   const full=createZooStationV165(),mobile=createZooStationV165({detailProfile:"mobile"});
   expect(digest(full)).toEqual(digest(mobile));let count=0,glass=0,bytes=0;
   full.traverse(o=>{expect(o.matrixAutoUpdate).toBe(false);if(o instanceof Mesh){count++;for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;if(o instanceof InstancedMesh)bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
     if(o.userData.glass){glass++;const m=o.material as MeshBasicMaterial;expect(m.transparent).toBe(true);expect(m.depthWrite).toBe(false);expect(m.opacity).toBeLessThan(.2);}
   }});expect(count).toBe(5);expect(glass).toBe(2);expect(bytes).toBeLessThan(1500000);dispose(full);dispose(mobile);
 });
 it("has a bounded, surface-only, independent orthogonal native reading",()=>{
   const native=createMinecraftZooStationV165(),m=new Matrix4();let count=0,instances=0,bytes=0;
   native.traverse(o=>{if(o instanceof Mesh){count++;expect(o instanceof InstancedMesh).toBe(true);expect(o.userData.blockNative).toBe(true);if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;for(let i=0;i<o.count;i+=37){o.getMatrixAt(i,m);for(const k of [1,2,4,6,8,9])expect(Math.abs(m.elements[k])).toBe(0);}}}});
   expect(count).toBe(4);expect(instances).toBeLessThan(100000);expect(bytes).toBeLessThan(7600000);const bounds=new Box3().setFromObject(native);expect(bounds.getSize(new Vector3()).x).toBeLessThan(500);expect(bounds.max.y).toBeLessThan(40);dispose(native);
 });
 it("keeps public concourse below the elevated floors and source ownership exact",()=>{
   const p=source.platforms[2].furniturePoints[0];expect(p).toBeDefined();
   expect(zooStationV165FloorAt(p[0],p[1],14)).toBe(13.96);expect(zooStationV165FloorAt(p[0],p[1],5.2)).toBe(5.25);
   expect(zooStationV165PassageAt(p[0],15.5,p[1])).toBe(true);expect(zooStationV165PassageAt(-2798,7,1295)).toBe(false);
   expect(zooStationV165RoofAt(-2798,1297)).toBeGreaterThan(14);expect(zooStationV165RoofAt(0,0)).toBeNull();
   const prism=source.legacyPrisms.find(p=>p.id==="32493294")!;expect(ZOO_STATION_V165_PRISM_IDS.has(prism.id)).toBe(true);expect(ZOO_STATION_V165_PRISM_IDS.has("15777905")).toBe(false);
   // Exact source centre sample inside the America House wing.
   expect(zooStationV165SourceColumn(-2800,1305,prism.y0_dm/10,prism.y0_dm/10+Math.ceil(prism.h_dm/40)*4)).toBe(true);
   expect(zooStationV165SourceColumn(-2800,1305,prism.y0_dm/10,prism.y0_dm/10+80)).toBe(false);
 });
});

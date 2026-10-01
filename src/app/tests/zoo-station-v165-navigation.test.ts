import {describe,expect,it} from "bun:test";
import {compilePedestrianObstacles,createPedestrianEnvironment,pedestrianPointIsBlocked} from "../src/pedestrianNavigation";
import type {PrismPayload} from "../src/IsometricCityWorld";
import type {VoxelPayload} from "../src/MinecraftVoxelWorld";
import type {VisualMode} from "../src/visualMode";
import nav from "../src/data/zooStationV165Navigation.json";
import {zooStationV165FloorAt,zooStationV165PassageAt,zooStationV165SolidAt,zooStationV165RoofAt} from "../src/zooStationV165Profile";
const prisms={buildings:nav.legacyPrisms} as Pick<PrismPayload,"buildings">;
const ground=await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json",import.meta.url)).json() as VoxelPayload;
describe("Zoo station public circulation",()=>{
 it("replaces exact old source owners by complete parts and resolves both roof readings",()=>{
  let mode:VisualMode="day";const index=compilePedestrianObstacles(prisms,()=>mode),objects=[...new Set([...index.cells.values()].flat())];
  expect(index.buildingCount).toBe(nav.parts.reduce((n,p)=>n+p.rings.length,0));
  for(const p of nav.legacyPrisms)expect(objects.some(o=>o.sourceId===p.id)).toBe(false);
  const part=objects.find(o=>o.sourceId==="DEBE3Da0o45DZ0Ie")!;
  for(const m of ["day","minecraft"] as const){mode=m;if(part.kind==="polygon")expect(part.topAt?.(-2660,1190)).toBe(zooStationV165RoofAt(-2660,1190,m==="minecraft"));}
 });
 it("allows continued platform/concourse traversal while keeping its steel posts solid",()=>{
  const env=createPedestrianEnvironment(ground,{water:[]},null,prisms);
  env.walkableInteriorAt=zooStationV165PassageAt;env.interiorSolidAt=zooStationV165SolidAt;env.interiorGroundAt=zooStationV165FloorAt;
  for(const p of nav.platforms)for(const [x,z] of p.furniturePoints){
    expect(pedestrianPointIsBlocked(x,z,13.96,env.obstacles!,env)).toBe(false);
    expect(zooStationV165FloorAt(x,z,14)).toBe(13.96);
  }
  // Measured Hardenbergplatz-side approach reaches the public low concourse.
  for(const [x,z] of [[-2680,1260],[-2682,1257],[-2685,1254]]){
    expect(zooStationV165PassageAt(x,6.9,z)).toBe(true);
    expect(pedestrianPointIsBlocked(x,z,5.25,env.obstacles!,env)).toBe(false);
  }
  const p=nav.colliders.find(p=>p.low<6&&p.high>9)!;
  expect(zooStationV165SolidAt(p.x,7,p.z)).toBe(true);
  expect(zooStationV165SolidAt(0,7,0)).toBe(false);
 });
 it("follows source-aligned stair gradients without the old full-height blockers",()=>{
  const env=createPedestrianEnvironment(ground,{water:[]},null,prisms);env.walkableInteriorAt=zooStationV165PassageAt;env.interiorSolidAt=zooStationV165SolidAt;env.interiorGroundAt=zooStationV165FloorAt;
  let checked=0;
  for(const s of nav.stairs){
    for(const t of [.2,.5,.8]){
      const x=s.a[0]+(s.b[0]-s.a[0])*t,z=s.a[1]+(s.b[1]-s.a[1])*t,y=s.low+(s.high-s.low)*t;
      if(zooStationV165SolidAt(x,y+.9,z,.3))continue;
      expect(zooStationV165FloorAt(x,z,y)).not.toBeNull();
      expect(pedestrianPointIsBlocked(x,z,y,env.obstacles!,env)).toBe(false);checked++;
    }
  }
  expect(checked).toBeGreaterThan(65);
 });
});

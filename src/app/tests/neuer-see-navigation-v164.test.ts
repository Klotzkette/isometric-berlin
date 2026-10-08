import { describe, expect, test } from "bun:test";
import { compilePedestrianObstacles, createPedestrianEnvironment, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import type { VisualMode } from "../src/visualMode";
import cafe from "../src/data/cafeNeuerSeeV164Navigation.json";
import embassy from "../src/data/spanishEmbassyV164Navigation.json";
import gates from "../src/data/grosserSternGatehousesV164Source.json";
import { cafeNeuerSeeRoofAt } from "../src/cafeNeuerSeeV164Profile";
import { spanishEmbassyV164RoofAt } from "../src/spanishEmbassyV164Profile";
import { gatehouseV164World, grosserSternGatehouseFloorAt, grosserSternGatehouseSolidAt, grosserSternGatehousePassageAt } from "../src/grosserSternGatehousesV164Profile";

const prisms={buildings:[...cafe.legacyPrisms,...embassy.legacyPrisms,...gates.legacyPrisms]} as Pick<PrismPayload,"buildings">;
const ground=await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json",import.meta.url)).json() as VoxelPayload;

describe("v164 measured architecture pedestrian integration",()=>{
  test("replaces only exact source owners once, keeping courtyard holes and live native roofs",()=>{
    let mode:VisualMode="day";
    const index=compilePedestrianObstacles(prisms,()=>mode);
    const objects=[...new Set([...index.cells.values()].flat())];
    const context=compilePedestrianObstacles({buildings:[]},()=>mode);
    const contextIds=new Set([...context.cells.values()].flat().map(o=>o.sourceId));
    expect(index.buildingCount).toBe(18);
    expect(objects.filter(o=>!contextIds.has(o.sourceId))).toHaveLength(18);
    expect(objects.filter(o=>contextIds.has(o.sourceId))).toHaveLength(context.obstacleCount);
    for(const p of prisms.buildings)expect(objects.some(o=>o.sourceId===p.id)).toBe(false);
    for(const part of cafe.parts){const obstacle=objects.find(o=>o.sourceId===part.id);expect(obstacle?.kind).toBe("polygon");if(obstacle?.kind==='polygon')expect(obstacle.holes).toEqual(part.holes);}
    const ca=objects.find(o=>o.sourceId===cafe.parts[0].id)!;
    const sp=objects.find(o=>o.sourceId===embassy.parts[0].id)!;
    const [cx,cz]=cafe.nativeRoofCells[20], [sx,sz]=embassy.nativeRoofCells[20];
    for(const m of ["day","minecraft"] as const){mode=m;
      if(ca.kind==='polygon')expect(ca.topAt?.(cx,cz)).toBe(cafeNeuerSeeRoofAt(cx,cz,m==='minecraft'));
      if(sp.kind==='polygon')expect(sp.topAt?.(sx,sz)).toBe(spanishEmbassyV164RoofAt(sx,sz,m==='minecraft'));
    }
    const unrelated=compilePedestrianObstacles({buildings:[{id:"unrelated",ring:[[0,0],[20,0],[20,20],[0,20]],holes:[],y0_dm:52,h_dm:40,class:0}]});
    expect(unrelated.buildingCount).toBe(1);expect(unrelated.obstacleCount-context.obstacleCount).toBe(1);
  });
  test("each descending stair takes precedence over the former ground surface",()=>{
    const env=createPedestrianEnvironment(ground,{water:[]},null,prisms);
    env.walkableInteriorAt=grosserSternGatehousePassageAt;
    env.interiorSolidAt=grosserSternGatehouseSolidAt;
    for(const h of gates.houses){const d=h.bodyDepthM/2;
      let previous=Infinity;
      for(let step=0;step<16;step++){
        const p=gatehouseV164World(h,0,0,d-.12-step*.47), y=grosserSternGatehouseFloorAt(p[0],p[2])!;
        expect(env.groundAt(p[0],p[2])).toBeCloseTo(y,7);expect(y).toBeLessThanOrEqual(previous);previous=y;
        expect(pedestrianPointIsBlocked(p[0],p[2],y,env.obstacles!,env)).toBe(false);
      }
      expect(previous).toBeCloseTo(h.groundY-2.735,5);
      const wall=gatehouseV164World(h,h.widthM/2,1.5,0);
      expect(pedestrianPointIsBlocked(wall[0],wall[2],h.groundY,env.obstacles!,env)).toBe(true);
    }
  });
});

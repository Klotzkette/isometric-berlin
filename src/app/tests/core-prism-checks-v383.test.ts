import { expect, test } from "bun:test";
import { createStartupWorldRequests } from "../src/startupWorldRequests";
import { checkCorePrismsV383, fetchCityPrismsV383 } from "../src/corePrismChecksV383";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import { isCampusCanopySourceV266 } from "../src/CampusNordV266Profile";
import canopy from "../src/data/campusNordV266.json";

const readSource = () => Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json();

test("Only the exact immutable fetch shares the five source results across asynchronous work", async () => {
  const scene = new URL("../public/mesh/regierungsviertel/rail-lines.json", import.meta.url);
  const startup = createStartupWorldRequests();
  startup.prime(scene, "day");
  const source = await fetchCityPrismsV383(new URL("lod2-prisms.json",scene), {fetcher: startup.adopt()});
  startup.discard();
  const checks = checkCorePrismsV383(source, true);
  await Promise.resolve();
  expect(checks.forSource(source)).toEqual({
    historicDom:true, chancelleryCanopy:true, potsdamerCorridor:true, moabitMitte:true, westKiez:true,
  });
  expect(checks.forSource({buildings:source.buildings})).toBeUndefined();
  const building=source.buildings.find(b=>b.holes?.length)!;
  expect(Object.isFrozen(building)).toBeTrue();
  expect(Object.isFrozen(building.ring[0])).toBeTrue();
  expect(Object.isFrozen(building.holes![0][0])).toBeTrue();
  expect(Reflect.set(building.ring[0],0,-1)).toBeFalse();
  expect(Reflect.set(building.holes![0][0],1,-1)).toBeFalse();
  expect(Reflect.set(source, "buildings", [])).toBeFalse();
  expect(Reflect.set(checks.results, "historicDom", false)).toBeFalse();
  const mutable=await readSource();
  const custom=createStartupWorldRequests(async()=>({json:async()=>mutable,ok:true} as Response));
  const customPayload=await fetchCityPrismsV383(new URL("lod2-prisms.json",scene),{fetcher:custom.adopt()});
  expect(checkCorePrismsV383(customPayload,true).forSource(customPayload)).toBeUndefined();
  const mutableChecks=checkCorePrismsV383(mutable,true);
  mutable.buildings.reverse();
  mutable.buildings[0].ring[0][0]++;
  expect(mutableChecks.forSource(mutable)).toBeUndefined();
  expect(checks.forSource(mutable)).toBeUndefined();
  const options={historicDomV288:true,potsdamerCorridorV288:true,moabitMitteV300:true,westKiezV302:true,chancelleryCanopySourceV289:true,replaceCampusCanopy:true};
  const baseline=compilePedestrianObstacles(source,()=>"day",options);
  const reused=compilePedestrianObstacles(source,()=>"day",{...options,corePrismChecks:checks});
  expect([reused.obstacleCount,reused.buildingCount,reused.cells.size]).toEqual([baseline.obstacleCount,baseline.buildingCount,baseline.cells.size]);
  // Preserve cell membership, obstacle order, ownership, geometry, and all index bounds.
  const digest=(index:typeof baseline)=>{
    const hash=new Bun.SHA256();
    for(const [key,cell] of index.cells) hash.update(String(key)+" "+JSON.stringify(cell));
    return hash.digest("hex");
  };
  expect(digest(reused)).toBe(digest(baseline));
},60000);

test("The Charité canopy filter verifies the full matching source footprint",()=>{
  const source=canopy.canopy.previousPrism;
  expect(isCampusCanopySourceV266(source)).toBeTrue();
  expect(isCampusCanopySourceV266({...source,id:"unrelated"})).toBeFalse();
  expect(isCampusCanopySourceV266({...source,ring:source.ring.slice(1)})).toBeFalse();
});

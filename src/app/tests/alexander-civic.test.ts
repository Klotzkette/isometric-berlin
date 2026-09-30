import {describe,expect,test} from "bun:test";
import {Box3,Mesh,InstancedMesh,Raycaster,Vector3} from "three";
import source148 from "../src/schlossEastSource.json";
import {createAlexanderCivicArchitecture,createMinecraftAlexanderCivicArchitecture} from "../src/AlexanderCivicArchitecture";
import {ALEXANDER_CIVIC_SOURCE as source,ALEXANDER_CIVIC_PARTS,ALEXANDER_CIVIC_PRISM_IDS,MARIEN_TOWER as T,MARIEN_TOWER_PART_IDS,RATHAUS_TOWER_ID,RATHAUS_TOWER_PLATFORM,RATHAUS_TERMINAL,alexanderCivicTowerSolidAt,alexanderCivicPartRoofAt,alexanderCivicWalkableAt,isAlexanderCivicReplacementColumn,rathausTerminalSolidAt} from "../src/alexanderCivicProfile";
import {bebelplatzPartContains} from "../src/bebelplatzBuildingProfile";

describe("Rotes Rathaus and St. Marien complete recognition architecture",()=>{
 test("original Rathaus sheets/courts and all five church parts are retained",()=>{
  expect(source.profiles.rathaus.parts).toEqual(source148.profiles.rathaus.parts);
  expect(ALEXANDER_CIVIC_PARTS).toHaveLength(9);expect(MARIEN_TOWER_PART_IDS.size).toBe(2);
  expect(ALEXANDER_CIVIC_PRISM_IDS.has("474111581")).toBeTrue();
  expect(source.profiles.rathaus.parts.flatMap(p=>p.holes)).toHaveLength(3);
  expect(isAlexanderCivicReplacementColumn(T.x,T.z)).toBeTrue();
  for(const [x,z] of [[2380,-131],[2482,-125],[2460,48],[2530,-140],[2460,191]])expect(isAlexanderCivicReplacementColumn(x,z)).toBeFalse();
  const part=ALEXANDER_CIVIC_PARTS.find(p=>p.id===RATHAUS_TOWER_ID)!;
  expect(part.top_y_m).toBe(87.125);expect(alexanderCivicPartRoofAt(part,2495,100)).toBe(RATHAUS_TOWER_PLATFORM);
 });
 test("the open copper lantern and steel terminal have only represented collision solids",()=>{
  expect(alexanderCivicTowerSolidAt(T.x,T.z,30)).toBeTrue();
  expect(alexanderCivicTowerSolidAt(T.x,T.z,49)).toBeTrue();
  expect(alexanderCivicTowerSolidAt(T.x,T.z,60)).toBeFalse();
  expect(alexanderCivicWalkableAt(T.x,60,T.z,[...MARIEN_TOWER_PART_IDS][0])).toBeTrue();
  expect(alexanderCivicTowerSolidAt(T.x+T.lanternRadius*Math.cos(T.yaw),T.z-T.lanternRadius*Math.sin(T.yaw),60)).toBeTrue();
  expect(alexanderCivicTowerSolidAt(T.x,T.z,82)).toBeTrue();
  expect(rathausTerminalSolidAt(RATHAUS_TERMINAL.x,RATHAUS_TERMINAL.z,90)).toBeTrue();
  expect(rathausTerminalSolidAt(RATHAUS_TERMINAL.x+3,RATHAUS_TERMINAL.z,85)).toBeFalse();
 });
 for(const native of [false,true])test(`actual rendered courts/lantern remain open and every buffer is finite (${native})`,()=>{
  const prior=JSON.stringify(source),root=native?createMinecraftAlexanderCivicArchitecture():createAlexanderCivicArchitecture();root.updateMatrixWorld(true);
  let instances=0,bytes=0,draws=0;
  root.traverse(o=>{if(!(o instanceof Mesh))return;draws++;for(const a of Object.values(o.geometry.attributes)){bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();}bytes+=o.geometry.index?.array.byteLength??0;expect(o.matrixAutoUpdate).toBeFalse();for(const m of[o.userData.dayMaterial,o.userData.nightMaterial])expect(m.map).toBeNull();if(o instanceof InstancedMesh){instances+=o.count;bytes+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength??0);expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();if(native)expect(o.geometry.attributes.position.count).toBe(24);}});
  expect(draws).toBe(native?1:7);expect(instances).toBe(native?29175:32439);expect(bytes).toBe(native?2217948:2586204);
  const box=new Box3().setFromObject(root);expect(box.max.y).toBeCloseTo(97.46,2);expect(box.min.x).toBeGreaterThan(2388);expect(box.max.x).toBeLessThan(2585);
  const main=source.profiles.rathaus.parts.find(p=>p.holes.length===3)!;
  for(const court of main.holes){let x=court.reduce((n,p)=>n+p[0],0)/court.length,z=court.reduce((n,p)=>n+p[1],0)/court.length;expect(bebelplatzPartContains(main,x,z)).toBeFalse();const hits=new Raycaster(new Vector3(x,120,z),new Vector3(0,-1,0)).intersectObject(root,true);expect(hits).toHaveLength(0);}
  // A diagonal ray crosses the real lantern centre between the octagonal posts.
  const direction=new Vector3(Math.cos(Math.PI/8),0,Math.sin(Math.PI/8)),centre=new Vector3(T.x,60.5,T.z),origin=centre.clone().addScaledVector(direction,-12);
  const lanternHits=new Raycaster(origin,direction,0,24).intersectObject(root,true);expect(lanternHits).toHaveLength(0);
  // Standing in the Rathaus tower terminal sees the open sky away from its thin mast.
  expect(new Raycaster(new Vector3(2499,79,100),new Vector3(0,1,0)).intersectObject(root,true)).toHaveLength(0);
  expect(JSON.stringify(source)).toBe(prior);
  console.log({native,draws,instances,bytes});
 });
 test("touch draws retain exactly the full desktop static detail",()=>{
  const full=createAlexanderCivicArchitecture(false),mobile=createAlexanderCivicArchitecture(true);
  const positions=(root:typeof full)=>{const values:number[][]=[];root.traverse(o=>{if(o instanceof Mesh){values.push(Array.from(o.geometry.attributes.position.array));if(o instanceof InstancedMesh)values.push(Array.from(o.instanceMatrix.array));}});return values;};
  expect(positions(mobile)).toEqual(positions(full));
 });
});

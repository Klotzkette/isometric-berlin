/** Actual finite production constructors, not reconstructed recipe hosts. */
import {expect,test} from "bun:test";
import {readFileSync} from "node:fs";
import {Group,Mesh,LineSegments,InstancedMesh} from "three";
import {createIsometricCityCore,createDistantBuildingShells,setIsoNightPresentation} from "../src/IsometricCityWorld";
import {runtimeConstructorOptionsV310} from "./helpers/northRuntimeActualV310";
import {createGovernmentOfficesV321} from "../src/GovernmentOfficesV321";
import {federalMinistryPreviousPlanV321,federalMinistryPreviewPlanV321} from "../src/FederalMinistriesV321";
import {berlinSenatePreviousPlanV321,berlinSenatePreviewPlanV321} from "../src/BerlinSenateBuildingsV321";
import {uniExactPlansV322} from "../src/UniversitiesArchitectureV322";
import {prepareFederalMinistryPressQuarterSourceV321} from "../src/FederalMinistryPressQuarterV321";
import {createPressQuarterV272} from "../src/PressQuarterV272";
import {compactStaticGeometry} from "../src/compactStaticGeometry";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
import {retireSceneMaterialPrograms} from "../src/sceneMaterialPrograms";
const p=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8"));
const drain=<T>(g:Generator<void,T>):T=>{for(;;){const n=g.next();if(n.done)return n.value;}};
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse((o:any)=>{if(o.geometry)resources.add(o.geometry);if(o.isInstancedMesh)resources.add(o);for(const m of[o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m?.dispose)resources.add(m);});for(const r of resources)r.dispose();root.clear();}
function snapshot(root:Group){const result:any[]=[];root.traverse((o:any)=>{if(o instanceof Mesh||o instanceof LineSegments)result.push({o,geometry:o.geometry,matrix:o.instanceMatrix,color:o.instanceColor});});return result;}

test("real combined Government + university + ATZE Core, Press and preview admission and exact source rollback",async()=>{
 expect(await prepareFederalMinistryPressQuarterSourceV321(false)).toBeTrue();
 const coreEntries=[federalMinistryPreviousPlanV321(),berlinSenatePreviousPlanV321(),uniExactPlansV322()],previewEntries=[federalMinistryPreviewPlanV321(),berlinSenatePreviewPlanV321(),uniExactPlansV322(false,false,true)];
 const ids=new Set(coreEntries.flatMap(e=>e.plan.owners.map(o=>o.id))),previewIds=new Set(previewEntries.flatMap(e=>e.plan.owners.map(o=>o.id))),options=runtimeConstructorOptionsV310(false,true,p);
 const world=new Group(),core=createIsometricCityCore(p,null,null,null,{...options,buildings:p.buildings.filter((b:any)=>ids.has(b.id)),includeContext:false}),preview=createDistantBuildingShells(p,p.buildings.filter((b:any)=>previewIds.has(b.id)),options),press=createPressQuarterV272(false,{mobileLike:true});
 world.add(core,preview,press);core.traverse(compactStaticGeometry);interleaveStaticGeometry(core);interleaveStaticGeometry(preview);interleaveStaticGeometry(press);
 const originals=[...snapshot(core),...snapshot(preview),...snapshot(press)];
 const gov=createGovernmentOfficesV321({sourcePrisms:p.buildings,native:false,mobileLike:true,includeUniversitiesV322:true});
 expect(gov).not.toBeNull();if(!gov){dispose(world);return;}
 world.add(gov.root);
 try{
  expect(drain(gov.stagePreviousSteps(core))).toBeTrue();expect(drain(gov.stagePressQuarterSteps(press))).toBeTrue();expect(drain(gov.stagePreviewSteps(preview))).toBeTrue();
  expect(gov.complete()).toBeTrue();expect(gov.universitiesReadyV322?.()).toBeTrue();
  for(const night of[false,true,false]){setIsoNightPresentation(world,night,true,night?"night":"day");retireSceneMaterialPrograms(world);expect(gov.complete()).toBeTrue();expect(gov.universitiesReadyV322?.()).toBeTrue();}
  const start=performance.now();for(let i=0;i<100;i++)expect(gov.complete()).toBeTrue();console.log(JSON.stringify({combinedUniversityGovernmentV322:true,coreOwners:ids.size,previewOwners:previewIds.size,complete100Ms:performance.now()-start,children:gov.root.children.map(c=>c.name)}));
  gov.rollback();expect(gov.complete()).toBeFalse();for(const old of originals){expect(old.o.geometry).toBe(old.geometry);expect(old.o.instanceMatrix).toBe(old.matrix);expect(old.o.instanceColor).toBe(old.color);}
 }finally{gov.rollback();dispose(world);}
},30000);

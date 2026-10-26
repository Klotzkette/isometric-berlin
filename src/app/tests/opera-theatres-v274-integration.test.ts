import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createDistantBuildingShells, createIsometricCityCore, type PrismPayload } from '../src/IsometricCityWorld';
import { createProgressiveBuildingCoverage } from '../src/progressiveBuildingCoverage';
import { compilePedestrianObstacles } from '../src/pedestrianNavigation';
import { createSurroundingCityChunk } from '../src/SurroundingCityGeometry';
import { disposeSurroundingCityRoot } from '../src/SurroundingCity';
import { isOperaTheatrePreviousPrismV274 } from '../src/operaTheatresV274Ownership';
import { operaTheatresV274RoofAt } from '../src/operaTheatresV274Profile';
import nav from '../src/data/operaTheatresV274Navigation.json';
import ownership from '../src/data/operaTheatresV274Ownership.json';

test('initial, distant and worker core ownership is explicit and exact; complete navigation follows both modes',()=>{
 const original:PrismPayload=JSON.parse(readFileSync('public/mesh/regierungsviertel/lod2-prisms.json','utf8'));
 const source={...original,buildings:original.buildings.filter(p=>isOperaTheatrePreviousPrismV274(true,p))};
 expect(source.buildings.length).toBe(6);
 const before=createDistantBuildingShells(source,source.buildings),after=createDistantBuildingShells(source,source.buildings,{operaTheatresV274:true});
 expect(before.userData.visibleBuildingCount).toBe(6);expect(after.userData.visibleBuildingCount).toBe(0);
 const partition={initial:[],omitted:source.buildings.slice(0,2),remaining:[source.buildings.slice(2)]};
 for(const enabled of [false,true]){const coverage=createProgressiveBuildingCoverage(source,partition,{operaTheatresV274:enabled});expect(coverage.children.map(c=>c.userData.visibleBuildingCount)).toEqual(enabled?[0,0]:[2,4]);disposeSurroundingCityRoot(coverage);}
 const oldCore=createIsometricCityCore(source,null,null,null,{includeContext:false}),newCore=createIsometricCityCore(source,null,null,null,{includeContext:false,operaTheatresV274:true});
 expect(oldCore.children.length).toBeGreaterThan(0);expect(newCore.children.length).toBe(0);
 const changed={...source,buildings:[{...source.buildings[0],h_dm:source.buildings[0].h_dm+1}]};
 const retained=createDistantBuildingShells(changed,changed.buildings,{operaTheatresV274:true});expect(retained.userData.visibleBuildingCount).toBe(1);
 let native=false;
 const oldNav=compilePedestrianObstacles(source),newNav=compilePedestrianObstacles(source,()=>native?'minecraft':'day',{operaTheatresV274:true});
 expect(oldNav.buildingCount).toBe(6);expect(newNav.buildingCount).toBe(71);
 const obstacles=[...new Set([...newNav.cells.values()].flat())].filter(o=>o.kind==='polygon');
 const ids=new Set(obstacles.map(o=>o.sourceId));
 for(const p of nav.parts)expect(ids.has(p.id)).toBe(true);
 for(const p of nav.legacyPrisms)expect(ids.has(p.id)).toBe(false);
 const oldIds=new Set([...oldNav.cells.values()].flat().map(o=>o.sourceId));
 const newParts=new Set(nav.parts.map(p=>p.id)),oldPrisms=new Set(nav.legacyPrisms.map(p=>p.id));
 expect([...ids].filter(id=>!newParts.has(id!)).sort()).toEqual([...oldIds].filter(id=>!oldPrisms.has(id!)).sort());
 for(const mode of [false,true,false]){native=mode;const roof=operaTheatresV274RoofAt(-4268,650,native);const local=obstacles.filter(o=>o.minX<=-4268&&o.maxX>=-4268&&o.minZ<=650&&o.maxZ>=650);expect(local.length).toBeGreaterThan(0);expect(local[0].topAt?.(-4268,650)).toBe(roof);}
 for(const root of [before,after,oldCore,newCore,retained])disposeSurroundingCityRoot(root);
});

test('real streamed decoder publishes only receipted transfers and matching corrected collision',()=>{
 for(const native of [false,true]){
  const tile='-9_1',mode=native?'minecraft':'drawn';
  const packet=JSON.parse(gunzipSync(readFileSync(`public/mesh/surrounding-berlin-v159/${tile}.${mode}.json.gz`)).toString());
  const expected=ownership.records.filter(r=>r.tile===tile&&r.mode===mode).reduce((n,r)=>n+r.triangles.length,0);
  const before=createSurroundingCityChunk(packet,tile,native),after=createSurroundingCityChunk(packet,tile,native,{operaTheatresV274:true});
  expect(before.root.userData.operaTheatreTrianglesV274??0).toBe(0);expect(after.root.userData.operaTheatreTrianglesV274).toBe(expected);
  const ids=new Set(['DEBE04YY500002EM','DEBE04YY50002cf0']);
  expect(before.nav.buildings.filter(b=>ids.has(b.sourceId)).length).toBe(2);
  expect(after.nav.buildings.filter(b=>ids.has(b.sourceId)).length).toBe(0);
  expect(after.nav.buildings).toEqual(before.nav.buildings.filter(b=>!ids.has(b.sourceId)));
  disposeSurroundingCityRoot(before.root);disposeSurroundingCityRoot(after.root);
 }
});

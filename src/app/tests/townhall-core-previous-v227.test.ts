import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import receipt from "../src/data/townhallV227CorePrevious.json";
import { createTownhallCoreColumnTesterV227, isTownhallCorePrismV227 } from "../src/townhallCorePreviousV227";
import { createIsometricCityCore, createDistantBuildingShells, type PrismBuilding, type PrismPayload } from "../src/IsometricCityWorld";
import { decodeVoxelBuildingColumns } from "../src/MinecraftVoxelWorld";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")) as PrismPayload;
const original=receipt.owners.map(o=>o.prism) as PrismBuilding[];
const neighbour=prisms.buildings.find(b=>b.id==="30402049")!;
const hash=(rows:unknown)=>createHash("sha256").update(JSON.stringify(rows)).digest("hex");

test("core substitution requires every original property, with changed and unrelated owners retained",()=>{
  expect(prisms.buildings.filter(isTownhallCorePrismV227).length).toBe(4);
  for(const prism of original) {
    expect(isTownhallCorePrismV227(prism)).toBeTrue();
    for(const changed of [ {...prism,h_dm:prism.h_dm+1},{...prism,y0_dm:prism.y0_dm+1},
      {...prism,ring:[[prism.ring[0][0]+1,prism.ring[0][1]],...prism.ring.slice(1)]},
      {...prism,id:prism.id+"-neighbour"},{...prism,tone:[1,2,3]},{...prism,extra:true}])
      expect(isTownhallCorePrismV227(changed)).toBeFalse();
  }
  expect(isTownhallCorePrismV227(neighbour)).toBeFalse();
});

test("drawn constructor removes only the exact old core envelopes, preserving altered owners byte-for-byte",()=>{
  const altered={...original[0],h_dm:original[0].h_dm+1};
  const source=[...original,neighbour,altered];
  const audit=(buildings:PrismBuilding[],replace=false)=>{
    const root=createIsometricCityCore({...prisms,buildings},null,null,null,{includeContext:false,includeLegacyTownhallEnvelopes:!replace});
    try{return staticGeometryAudit(root);}finally{disposeStaticAudit(root);}
  };
  expect(audit(source,true)).toEqual(audit([neighbour,altered]));
  expect(audit(source)).not.toEqual(audit(source,true));
  const retained=source.filter(p=>!isTownhallCorePrismV227(p)),reverse=[...original,...retained];
  expect(audit(reverse)).toEqual(audit(source));
  const distant=createDistantBuildingShells(prisms,source,{includeLegacyTownhallEnvelopes:false});
  const control=createDistantBuildingShells(prisms,[neighbour,altered]);
  try { expect(staticGeometryAudit(distant)).toEqual(staticGeometryAudit(control)); }
  finally {disposeStaticAudit(distant);disposeStaticAudit(control);}
});

test("native receipt matches only 758 exact original columns and reconstruction preserves the entire native input",()=>{
  const raw=readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url));
  expect(createHash("sha256").update(raw).digest("hex")).toBe(receipt.voxelSha256);
  const payload=JSON.parse(raw.toString()),columns=decodeVoxelBuildingColumns(payload);
  const replace=createTownhallCoreColumnTesterV227(prisms.buildings,payload.cell_m);
  const retired=columns.flatMap((row,index)=>replace(...row)?[{index,row}]:[]);
  expect(retired.length).toBe(758);
  const remaining=columns.filter(row=>!replace(...row));
  const map=new Map(retired.map(item=>[item.index,item.row]));let offset=0;
  const reverse=columns.map((_row,i)=>map.get(i)??remaining[offset++]);
  expect(hash(reverse)).toBe(hash(columns));
  for(const {row} of retired) {
    expect(replace(row[0],row[1],row[2],row[3]+1,row[4])).toBeFalse();
    expect(replace(row[0],row[1],row[2],row[3],row[4]+1)).toBeFalse();
  }
  const first=retired[0].row, x=(first[0]+.5)*40,z=(first[1]+.5)*40;
  const newNeighbour:PrismBuilding={id:"new-overlapping-owner",class:0,y0_dm:52,h_dm:100,ring:[[x-10,z-10],[x+10,z-10],[x+10,z+10],[x-10,z+10]]};
  expect(createTownhallCoreColumnTesterV227([...prisms.buildings,newNeighbour],4)(...first)).toBeFalse();
  expect(createTownhallCoreColumnTesterV227(original.map(p=>({...p,h_dm:p.h_dm+1})),4)(...first)).toBeFalse();
  expect(createTownhallCoreColumnTesterV227(prisms.buildings,2)(...first)).toBeFalse();
  expect(createTownhallCoreColumnTesterV227([],4)(...first)).toBeFalse();
});

test("walking retires only original core obstacles and preserves changed source owners",()=>{
  const changed={...original[0],y0_dm:original[0].y0_dm+1};
  const payload={buildings:[...original,neighbour,changed]};
  const index=compilePedestrianObstacles(payload,()=>"day",{replaceTownhallPrisms:true});
  const ids=new Set([...index.cells.values()].flat().map(o=>o.sourceId));
  expect(ids.has(neighbour.id)).toBeTrue();
  expect(ids.has(changed.id)).toBeTrue();
  for(const owner of original.slice(1)) expect(ids.has(owner.id)).toBeFalse();
  const legacy=compilePedestrianObstacles(payload);
  const legacyIds=new Set([...legacy.cells.values()].flat().map(o=>o.sourceId));
  for(const owner of original) expect(legacyIds.has(owner.id)).toBeTrue();
});

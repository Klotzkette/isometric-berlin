import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import receipt from "../src/data/weddingStationCorePreviousV229.json";
import { createWeddingRoofCoreColumnTesterV229 } from "../src/weddingStationCorePreviousV229";
import { createIsometricCityCore, createDistantBuildingShells, type PrismBuilding, type PrismPayload } from "../src/IsometricCityWorld";
import { decodeVoxelBuildingColumns } from "../src/MinecraftVoxelWorld";
import { isWeddingRoofCoreV229 } from "../src/weddingMoabitV229Profile";
import { createProgressiveBuildingCoverage, hideReplacedBuildingPreview, restoreBuildingPreview } from "../src/progressiveBuildingCoverage";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const prisms=JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url),"utf8")) as PrismPayload;
const original=receipt.owners.map(o=>o.prism) as PrismBuilding[];
const neighbour=prisms.buildings.find(b=>b.id==="30402049")!;
const hash=(rows:unknown)=>createHash("sha256").update(JSON.stringify(rows)).digest("hex");

test("core substitution requires every original property, with changed and unrelated owners retained",()=>{
  expect(prisms.buildings.filter(isWeddingRoofCoreV229).length).toBe(3);
  for(const prism of original) {
    expect(isWeddingRoofCoreV229(prism)).toBeTrue();
    for(const changed of [ {...prism,h_dm:prism.h_dm+1},{...prism,y0_dm:prism.y0_dm+1},
      {...prism,ring:[[prism.ring[0][0]+1,prism.ring[0][1]],...prism.ring.slice(1)]},
      {...prism,id:prism.id+"-neighbour"},{...prism,tone:[1,2,3]},{...prism,extra:true}])
      expect(isWeddingRoofCoreV229(changed)).toBeFalse();
  }
  expect(isWeddingRoofCoreV229(neighbour)).toBeFalse();
});

test("drawn constructor removes only the exact old core envelopes, preserving altered owners byte-for-byte",()=>{
  const altered={...original[0],h_dm:original[0].h_dm+1};
  const source=[...original,neighbour,altered];
  const audit=(buildings:PrismBuilding[],replace=false)=>{
    const root=createIsometricCityCore({...prisms,buildings},null,null,null,{includeContext:false,includeLegacyWeddingStationRoof:!replace});
    try{return staticGeometryAudit(root);}finally{disposeStaticAudit(root);}
  };
  expect(audit(source,true)).toEqual(audit([neighbour,altered]));
  expect(audit(source)).not.toEqual(audit(source,true));
  const retained=source.filter(p=>!isWeddingRoofCoreV229(p)),reverse=[...original,...retained];
  expect(audit(reverse)).toEqual(audit(source));
  const distant=createDistantBuildingShells(prisms,source,{includeLegacyWeddingStationRoof:false});
  const control=createDistantBuildingShells(prisms,[neighbour,altered]);
  try { expect(staticGeometryAudit(distant)).toEqual(staticGeometryAudit(control)); }
  finally {disposeStaticAudit(distant);disposeStaticAudit(control);}
});

test("native receipt matches only receipted exact original columns and reconstruction preserves the entire native input",()=>{
  const raw=readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json",import.meta.url));
  expect(createHash("sha256").update(raw).digest("hex")).toBe(receipt.voxelSha256);
  const payload=JSON.parse(raw.toString()),columns=decodeVoxelBuildingColumns(payload);
  const replace=createWeddingRoofCoreColumnTesterV229(prisms.buildings,payload.cell_m);
  const retired=columns.flatMap((row,index)=>replace(...row)?[{index,row}]:[]);
  expect(retired.length).toBe(receipt.owners.reduce((n,o)=>n+o.columns.length,0));
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
  expect(createWeddingRoofCoreColumnTesterV229([...prisms.buildings,newNeighbour],4)(...first)).toBeFalse();
  expect(createWeddingRoofCoreColumnTesterV229(original.map(p=>({...p,h_dm:p.h_dm+1})),4)(...first)).toBeFalse();
  expect(createWeddingRoofCoreColumnTesterV229(prisms.buildings,2)(...first)).toBeFalse();
  expect(createWeddingRoofCoreColumnTesterV229([],4)(...first)).toBeFalse();
});

test("preview eviction restores only transferred Wedding roof coverage",()=>{
 const altered={...original[0],h_dm:original[0].h_dm+1};
 const rows=[...original,neighbour,altered];
 const root=createProgressiveBuildingCoverage(prisms,{immediate:[],remaining:[rows],omitted:[]} as any,{includeLegacyWeddingStationRoof:false});
 const control=createProgressiveBuildingCoverage(prisms,{immediate:[],remaining:[[neighbour,altered]],omitted:[]} as any);
 try{
  expect(staticGeometryAudit(root)).toEqual(staticGeometryAudit(control));
  const before=staticGeometryAudit(root);
  hideReplacedBuildingPreview(root,"buildings-preview-1");
  restoreBuildingPreview(root,"buildings-preview-1");
  expect(staticGeometryAudit(root)).toEqual(before);
 }finally{disposeStaticAudit(root);disposeStaticAudit(control);}
});

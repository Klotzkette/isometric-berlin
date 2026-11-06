import {expect,test} from "bun:test";
import {compilePedestrianObstacles,pedestrianPointIsBlocked} from "../src/pedestrianNavigation";
import type {PrismBuilding} from "../src/IsometricCityWorld";

const own:PrismBuilding={id:"gov-v321-audit-owned",ring:[[0,0],[30,0],[30,30],[0,30]],holes:[],y0_dm:0,h_dm:100,class:0};
const foreign:PrismBuilding={id:"gov-v321-audit-unrelated",ring:[[100,0],[130,0],[130,30],[100,30]],holes:[],y0_dm:0,h_dm:200,class:0};
const selected=(p:PrismBuilding)=>JSON.stringify(p)===JSON.stringify(own);

test("government navigation keeps exact old walls and restores them immediately when its model gate closes",()=>{
 const payload={buildings:[structuredClone(own),structuredClone(foreign)]},before=JSON.stringify(payload);let ready=false;
 const old=compilePedestrianObstacles(payload),index=compilePedestrianObstacles(payload,()=>"day",{governmentPreviousV321:selected,governmentReadyV321:()=>ready});
 expect(index.buildingCount).toBe(old.buildingCount);expect(pedestrianPointIsBlocked(1.5,1.5,0,index)).toBeTrue();expect(pedestrianPointIsBlocked(11.5,1.5,0,index)).toBeTrue();
 ready=true;expect(pedestrianPointIsBlocked(1.5,1.5,0,index)).toBeFalse();expect(pedestrianPointIsBlocked(11.5,1.5,0,index)).toBeTrue();
 ready=false;expect(pedestrianPointIsBlocked(1.5,1.5,0,index)).toBeTrue();expect(pedestrianPointIsBlocked(11.5,1.5,0,index)).toBeTrue();expect(JSON.stringify(payload)).toBe(before);
});

test("missing government readiness and a changed selected source preserve their complete original obstacles",()=>{
 const missing=compilePedestrianObstacles({buildings:[own,foreign]},()=>"day",{governmentPreviousV321:selected});
 expect(pedestrianPointIsBlocked(1.5,1.5,0,missing)).toBeTrue();
 const changed={...own,h_dm:110},index=compilePedestrianObstacles({buildings:[changed,foreign]},()=>"day",{governmentPreviousV321:selected,governmentReadyV321:()=>true});
 expect(pedestrianPointIsBlocked(1.5,1.5,0,index)).toBeTrue();expect(pedestrianPointIsBlocked(11.5,1.5,0,index)).toBeTrue();
});

import {describe,expect,test} from "bun:test";
import {SCHWELLENRAUM_ACCESSIBLE_VOLUMES,schwellenraumNavigationOverrideAt} from "../src/SchwellenraumInteriors";
import {visualModeWalkableInteriorAt} from "../src/visualModePedestrianAccess";
import {parliamentWalkableInteriorV295} from "../src/ParliamentInteriorsV295";
import {parliamentWorldPointV295 as world} from "../src/parliamentInteriorsV295Profile";
import {compilePedestrianObstacles,pedestrianPointIsBlocked} from "../src/pedestrianNavigation";
const source=await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json",import.meta.url)).json();

describe("Admitted public rooms replace only the old Reichstag navigation fallback",()=>{
 test("keeps every default and non-Reichstag source/unknown/foreign decision",()=>{
  for(const v of SCHWELLENRAUM_ACCESSIBLE_VOLUMES)for(const id of[v.sourceBuildingIds?.[0],"foreign-owner"]){
   const original=schwellenraumNavigationOverrideAt(...v.centerWorldM,id);
   expect(schwellenraumNavigationOverrideAt(...v.centerWorldM,id,false)).toBe(original);
   if(!v.id.startsWith("reichstag-"))expect(schwellenraumNavigationOverrideAt(...v.centerWorldM,id,true)).toBe(original);
   else expect(schwellenraumNavigationOverrideAt(...v.centerWorldM,id,true)).toBe(false);
  }
 });
 test("the retired wider room cannot punch through retained source volume beside the new room",()=>{
  const p=world("reichstag",[30,10,0]),obstacles=compilePedestrianObstacles(source),id="K0002MCN";
  expect(schwellenraumNavigationOverrideAt(...p,id)).toBe(true);
  expect(visualModeWalkableInteriorAt("schwellenraum",...p,id)).toBe(true);
  expect(visualModeWalkableInteriorAt("schwellenraum",...p,id,true)).toBe(false);
  expect(parliamentWalkableInteriorV295(...p,id)).toBe(false);
  const access=(enabled:boolean)=>({walkableInteriorAt:(x:number,y:number,z:number,owner?:string)=>parliamentWalkableInteriorV295(x,y,z,owner)||visualModeWalkableInteriorAt("schwellenraum",x,y,z,owner,enabled)});
  expect(pedestrianPointIsBlocked(p[0],p[2],p[1],obstacles,access(false))).toBe(false);
  expect(pedestrianPointIsBlocked(p[0],p[2],p[1],obstacles,access(true))).toBe(true);
  for(const foreign of["foreign-owner",undefined])expect(schwellenraumNavigationOverrideAt(...p,foreign,true)).toBe(false);
 });
 test("actual source-bound room air stays open while foreign owners remain solid",()=>{
  const p=world("reichstag",[0,10,0]);
  for(const id of["K0002MCN","UbQkgNZe","ycOYQRVL"])expect(parliamentWalkableInteriorV295(...p,id)||visualModeWalkableInteriorAt("schwellenraum",...p,id,true)).toBe(true);
  expect(parliamentWalkableInteriorV295(...p,"foreign-owner")||visualModeWalkableInteriorAt("schwellenraum",...p,"foreign-owner",true)).toBe(false);
  for(const mode of["day","night","snowstorm","minecraft"] as const)expect(visualModeWalkableInteriorAt(mode,...p,"K0002MCN",true)).toBe(visualModeWalkableInteriorAt(mode,...p,"K0002MCN"));
 });
});

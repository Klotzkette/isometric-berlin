import {expect,test} from "bun:test";
import {Group,Mesh,Raycaster,Vector3} from "three";
import {attachWasserturmParkV381} from "../src/wasserturmParkV381";
import {wasserturmParkGroundV381,wasserturmParkRoofV381,wasserturmParkSolidV381} from "../src/wasserturmParkNavigationV381";
import {towerCrownRoofV381} from "../src/wasserturmCrownProfileV381";
import {centralNamedV230GroundAt,centralNamedV230SolidAt} from "../src/centralNamedV230Navigation";
import {createCentralNamedV230} from "../src/CentralNamedV230";
import {createPrenzlbergV264} from "../src/PrenzlbergV264";
import {wasserturmParkViewsV381} from "../src/wasserturmParkViewsV381";
import type {SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";

function entry():SurroundingChunkGeometry{
  return {root:new Group(),origin:[0,0,0],nav:{ground:[],water:[],buildings:[],groundY:3},geometryBytes:0,bufferCount:0};
}
function top(mesh:Mesh,x:number,z:number){
  const hits=new Raycaster(new Vector3(x,75,z),new Vector3(0,-1,0)).intersectObject(mesh,false);
  return hits[0]?.point.y;
}
test("one opening host owns main tower, standpipe, plateau, stair floors and every registered park tree",async()=>{
  for(const native of [false,true]){
    const tile=entry();await attachWasserturmParkV381(tile,"wasserturm381-park",native);
    tile.root.updateMatrixWorld(true);
    const park=tile.root.getObjectByName("Wasserturmpark – Hochbehälter, Standrohrturm und Parkterrassen")!;
    expect(park.userData.inventoryTrees).toBe(132);
    const main=park.getObjectByName("Wasserturm – Wohnschaft, Kegeldach und Schornstein") as Mesh;
    const ground=park.getObjectByName("Wasserturmpark – vermessener Hang und Katasterwege") as Mesh;
    for(const [x,z] of [[3236.36,-1629.52],[3243.66,-1629.52],[3246.66,-1629.52]]){
      const measured=towerCrownRoofV381(x,z,native)!;
      expect(Math.abs(top(main,x,z)!-measured)).toBeLessThan(.035);
      expect(centralNamedV230GroundAt(x,z,measured+.1,native,true)).toBeCloseTo(measured,2);
      expect(centralNamedV230SolidAt(x,measured+.55,z,0,native,true)).toBe(false);
    }
    for(const [x,z] of [[3157.7,-1526.4],[3203.5,-1552.6],[3218,-1594]]){
      const s=wasserturmParkGroundV381(x,z,native);
      if(s!==undefined&&top(ground,x,z)!==undefined)expect(Math.abs(top(ground,x,z)!-s)).toBeLessThan(.04);
    }
    expect(wasserturmParkGroundV381(3157.7,-1526.4,native)!).toBeGreaterThan(9);
    expect(wasserturmParkGroundV381(3217,-1473,native)).toBeUndefined();
    expect(wasserturmParkRoofV381(3189.5,-1543.8,3,native)).toBeUndefined();
    expect(wasserturmParkRoofV381(3189.5,-1543.8,47,native)!).toBeGreaterThan(41);
    expect(wasserturmParkSolidV381(3189.5,31,-1543.8,.18,native)).toBe(true);
    expect(tile.root.userData.wasserturmParkFloorV381).toBeFunction();
    expect(tile.root.userData.wasserturmParkSolidV381).toBeFunction();
    expect(createCentralNamedV230(native,true).children.some(c=>c.userData.siteKey==="wasserturm")).toBe(false);
    expect(createPrenzlbergV264(native,true,true).children.some(c=>c.userData.siteKey==="wasserturm")).toBe(false);
    expect(tile.geometryBytes).toBeGreaterThan(10000);
  }
});
test("opening cancellation allocates no site and the survey has three distinct public views",async()=>{
  const tile=entry();await attachWasserturmParkV381(tile,"6_-4",false);
  const abort=new AbortController();abort.abort();
  await expect(attachWasserturmParkV381(tile,"wasserturm381-park",false,abort.signal)).rejects.toThrow();
  expect(tile.root.children).toHaveLength(0);
  expect(Object.keys(wasserturmParkViewsV381)).toHaveLength(3);
});

test("concurrent region loads and later retries preserve one park and one set of buffers",async()=>{
  for(const native of [false,true]){
    const tile=entry();
    await Promise.all([attachWasserturmParkV381(tile,"wasserturm381-park",native),
      attachWasserturmParkV381(tile,"wasserturm381-park",native)]);
    const bytes=tile.geometryBytes, buffers=tile.bufferCount;
    expect(tile.root.children).toHaveLength(1);
    expect(bytes).toBeGreaterThan(0);
    await attachWasserturmParkV381(tile,"wasserturm381-park",native);
    expect(tile.root.children).toHaveLength(1);
    expect(tile.geometryBytes).toBe(bytes);
    expect(tile.bufferCount).toBe(buffers);
  }
});

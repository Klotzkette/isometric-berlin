import { expect,test } from "bun:test";
import { ordinaryWindowExposureV288, createOrdinaryWindowsV288, ORDINARY_WINDOWS_V288_LIMIT } from "../src/ordinaryWindowsV288";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { buildingAttributes,mappedStoreyProfile } from "../src/buildingAttributes";
import { urbanFacadeScope } from "../src/urbanFacadePresentation";
import { createIsometricCityCore,WINDOWS_SUPPRESSED_IDS,HERO_WINDOW_FORMATS } from "../src/IsometricCityWorld";
test("covered party faces and courtyard holes are distinguished by height",()=>{
  const exposed=ordinaryWindowExposureV288([{id:'a',ring:[[0,0],[100,0],[100,100],[0,100]],y0_dm:30,h_dm:120},{id:'b',ring:[[100,0],[200,0],[200,100],[100,100]],holes:[[[130,30],[170,30],[170,70],[130,70]]],y0_dm:30,h_dm:90}]);
  expect(exposed('a',10.45,8,5)).toBe(false);expect(exposed('a',10.45,13,5)).toBe(true);expect(exposed('a',15,8,5)).toBe(true);expect(exposed('a',5,8,-.45)).toBe(true);
});
test("one shared full-detail window batch has a strict construction allowance",()=>{
  const mesh=createOrdinaryWindowsV288([{x:10,y:8,z:20,dx:1,dz:0,nx:0,nz:-1,width:1.2,height:1.8}]);
  expect(mesh.count).toBe(1);expect(mesh.userData.estimatedOpenings).toBe(true);expect(mesh.userData.fullStaticDetailOnTouch).toBe(true);expect(mesh.geometry.getAttribute('position').count).toBe(24);
  expect(()=>createOrdinaryWindowsV288(Array(ORDINARY_WINDOWS_V288_LIMIT+1).fill({}))).toThrow();mesh.geometry.dispose();
});
test("actual complete source windows are independent of progressive batch partition",()=>{
  const parts=prisms.buildings.filter(b=>urbanFacadeScope(b)&&!WINDOWS_SUPPRESSED_IDS.has(b.id)&&!HERO_WINDOW_FORMATS[b.id]&&mappedStoreyProfile(buildingAttributes(b.id),b.h_dm/10));
  const count=(buildings:typeof parts)=>{const r=createIsometricCityCore(prisms,null,null,null,{buildings,includeContext:false,smoothSurfaces:null});return r.userData.ordinaryWindowsV288.count as number;};
  const whole=count(parts),split=count(parts.slice(0,700))+count(parts.slice(700));
  expect(parts).toHaveLength(1563);expect(whole).toBe(56153);expect(split).toBe(whole);expect(whole).toBeLessThan(ORDINARY_WINDOWS_V288_LIMIT);
});

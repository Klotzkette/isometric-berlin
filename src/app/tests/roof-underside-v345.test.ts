import {expect,test} from "bun:test";
import {surroundingBuildingSolidAt,validNavigation,type SurroundingNavigation} from "../src/SurroundingCityGeometry";
import {validRoofUndersideV345,roofUndersideAtV345} from "../src/roofUndersideV345";
const top=[[[0,5,0],[10,8,0],[10,8,10]],[[0,5,0],[10,8,10],[0,5,10]]];
const base=():SurroundingNavigation=>({ground:[],water:[],roads:[],buildings:[{ring:[[0,0],[10,0],[10,10],[0,10]],holes:[],minHeight:4.82,height:8,sourceId:"paired-slope",roofTriangles:structuredClone(top),bottomRoofTriangles:top.map(t=>t.map(([x,y,z])=>[x,y-.18,z]))}],groundY:3});
test("sloped thin roofs remain passable below their local underside, solid in shell, clear above and outside",()=>{
 const nav=base();expect(validNavigation(nav)).toBeTrue();
 for(const x of[.2,2,5,8,9.8])for(const z of[.2,3,7,9.8]){
  const y=3+5+.3*x;
  expect(surroundingBuildingSolidAt(nav,x,y-.3,z)).toBeFalse();
  expect(surroundingBuildingSolidAt(nav,x,y-.09,z)).toBeTrue();
  expect(surroundingBuildingSolidAt(nav,x,y+.1,z)).toBeFalse();
  expect(surroundingBuildingSolidAt(nav,x,4.8,z)).toBeFalse();
 }
 expect(surroundingBuildingSolidAt(nav,-1,8,5)).toBeFalse();
 expect(surroundingBuildingSolidAt(nav,-1,8,5,.2)).toBeFalse();
 expect(roofUndersideAtV345(nav.buildings[0].bottomRoofTriangles!,11,5,0)).toBeNull();
 for(const value of[NaN,Infinity,-Infinity]){
  expect(surroundingBuildingSolidAt(nav,value,8,5)).toBeFalse();expect(surroundingBuildingSolidAt(nav,5,value,5)).toBeFalse();expect(surroundingBuildingSolidAt(nav,5,8,value)).toBeFalse();
 }
});
test("invalid optional undersides fail closed; historical roof-only and ordinary solids keep their prior semantics",()=>{
 const edits=[(n:SurroundingNavigation)=>n.buildings[0].bottomRoofTriangles=[],(n:SurroundingNavigation)=>n.buildings[0].bottomRoofTriangles![0][0][1]=NaN,(n:SurroundingNavigation)=>n.buildings[0].bottomRoofTriangles![0][0][0]=.1,(n:SurroundingNavigation)=>n.buildings[0].bottomRoofTriangles![0][0][1]=6,(n:SurroundingNavigation)=>{delete n.buildings[0].roofTriangles;},(n:SurroundingNavigation)=>{n.buildings[0].bottomRoofTriangles![0][2]=[0,4.82,0];}];
 for(const edit of edits){const nav=base();edit(nav);expect(validNavigation(nav)).toBeFalse();expect(validRoofUndersideV345(nav.buildings[0])).toBeFalse();expect(surroundingBuildingSolidAt(nav,5,9.4,5)).toBeFalse();}
 const roof=base();delete roof.buildings[0].bottomRoofTriangles;roof.buildings[0].minHeight=0;
 expect(validNavigation(roof)).toBeTrue();expect(surroundingBuildingSolidAt(roof,5,4.8,5)).toBeTrue();expect(surroundingBuildingSolidAt(roof,5,9.6,5)).toBeFalse();
 delete roof.buildings[0].roofTriangles;expect(surroundingBuildingSolidAt(roof,5,9.6,5)).toBeTrue();
 const native=base();native.buildings=[{ring:[[0,0],[2,0],[2,2],[0,2]],holes:[],minHeight:5.32,height:5.57,sourceId:"cardinal-cap"}];
 expect(validNavigation(native)).toBeTrue();expect(surroundingBuildingSolidAt(native,1,8.2,1)).toBeFalse();expect(surroundingBuildingSolidAt(native,1,8.4,1)).toBeTrue();expect(surroundingBuildingSolidAt(native,1,8.7,1)).toBeFalse();
});

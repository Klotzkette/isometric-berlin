import {expect,test} from "bun:test";
import {Group,Mesh,Raycaster,Vector3,InstancedMesh} from "three";
import {createWestLakesV194} from "../src/WestLakesV194";
import {attachPfaueninselDetailsV346,hasPfaueninselDetailsV346,pfaueninselDetailsGroundAtV346,pfaueninselDetailsSolidAtV346} from "../src/PfaueninselDetailsV346";
import {disposeSurroundingCityRoot} from "../src/disposeSurroundingCityRootV323";
import data from "../src/data/pfaueninselDetailsV346.json";
import {interleaveStaticGeometry} from "../src/interleaveStaticGeometry";
test("Pfauen clock turret admits only on intact real castle and shares source attachment and roof navigation",()=>{
 for(const native of[false,true]){
  const world=new Group(),host=createWestLakesV194(native);world.add(host);
  const castle=host.children.find(o=>o.userData.siteKey==="schloss-pfaueninsel")!,prior=castle.children.slice();
  const detail=attachPfaueninselDetailsV346(host,native);expect(detail).not.toBeNull();expect(hasPfaueninselDetailsV346(detail)).toBeTrue();
  expect(castle.children.slice(0,prior.length)).toEqual(prior);expect(attachPfaueninselDetailsV346(host,native)).toBeNull();
  expect(pfaueninselDetailsSolidAtV346(detail,data.centre[0],18,data.centre[1])).toBeTrue();
  expect(pfaueninselDetailsSolidAtV346(detail,data.centre[0]+5,18,data.centre[1])).toBeFalse();
  interleaveStaticGeometry(host);expect(hasPfaueninselDetailsV346(detail)).toBeTrue();host.updateMatrixWorld(true);
  for(const [dx,dz] of[[.3,.3],[-.5,.7],[.6,-.6]]){
   const x=data.centre[0]+dx,z=data.centre[1]+dz,y=pfaueninselDetailsGroundAtV346(detail,x,z);
   expect(y).not.toBeNull();const hit=new Raycaster(new Vector3(x,30,z),new Vector3(0,-1,0)).intersectObject(detail!,true).find(h=>h.object instanceof Mesh);
   expect(hit).toBeDefined();expect(Math.abs(hit!.point.y-y!)).toBeLessThan(.03);
  }
  if(native){const geometry=(detail!.children[0]as Mesh).geometry,a=geometry.getAttribute("position");for(let i=0;i<a.count;i+=3){const x=[a.getX(i),a.getX(i+1),a.getX(i+2)],y=[a.getY(i),a.getY(i+1),a.getY(i+2)],z=[a.getZ(i),a.getZ(i+1),a.getZ(i+2)];expect([x,y,z].some(r=>r[0]===r[1]&&r[1]===r[2])).toBeTrue();}}
  detail!.removeFromParent();expect(hasPfaueninselDetailsV346(detail)).toBeFalse();expect(pfaueninselDetailsGroundAtV346(detail,data.centre[0],data.centre[1])).toBeNull();castle.add(detail!);
  const old=castle.children.find(o=>o instanceof InstancedMesh)as InstancedMesh;old.count--;expect(hasPfaueninselDetailsV346(detail)).toBeFalse();old.count++;
  disposeSurroundingCityRoot(host);
 }
});
test("changed old castle body, missing old fittings or wrong family never attach decorative copies",()=>{
 for(const native of[false,true]){
  const host=createWestLakesV194(native),castle=host.children.find(o=>o.userData.siteKey==="schloss-pfaueninsel")!;
  expect(attachPfaueninselDetailsV346(host,!native)).toBeNull();
  const old=castle.children.find(o=>o instanceof InstancedMesh)as InstancedMesh;old.instanceMatrix.array[12]+=1;
  expect(attachPfaueninselDetailsV346(host,native)).toBeNull();disposeSurroundingCityRoot(host);
 }
});

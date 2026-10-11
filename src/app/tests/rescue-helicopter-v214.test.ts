import { expect, test } from "bun:test";
import { Mesh, PerspectiveCamera, Vector3 } from "three";
import { createRescueHelicopterV214, rescueHelicopterPoseV214, RESCUE_HELICOPTER_V214 } from "../src/RescueHelicopterV214";

const pad = { centre: [-184.229949,5.32,-1849.876396], approach: [-.8,.6] };
function camera() {
  const c = new PerspectiveCamera(55,1.4,.1,1000);
  c.position.set(-230,60,-1785); c.lookAt(...pad.centre as [number,number,number]); c.updateMatrixWorld(true); return c;
}
test("approach has a continuous closed path, ground dwell and no below-pad flight", () => {
  let previous = rescueHelicopterPoseV214(-.01);
  for (let t=0; t<=128; t+=.05) {
    const p=rescueHelicopterPoseV214(t);
    expect(p.height).toBeGreaterThanOrEqual(0); expect(p.height).toBeLessThanOrEqual(20);
    expect(p.distance).toBeGreaterThanOrEqual(0); expect(p.distance).toBeLessThanOrEqual(22);
    expect(Math.hypot(p.height-previous.height,p.distance-previous.distance)).toBeLessThan(.2);
    previous=p;
  }
  expect(rescueHelicopterPoseV214(27)).toEqual({height:0,distance:0});
  expect(rescueHelicopterPoseV214(64)).toEqual(rescueHelicopterPoseV214(0));
});
test("changing flood depth raises a paused landed aircraft without restarting its rotors", () => {
  const root=createRescueHelicopterV214(pad), c=camera();
  for(let t=0;t<=27000;t+=50) root.userData.update(t,c,false);
  expect(root.userData.heightAbovePad).toBe(0);
  const phase=root.userData.elapsedSeconds, attribute=(root.children[0] as Mesh).geometry.getAttribute("position");
  const x=attribute.getX(0), z=attribute.getZ(0);
  expect(root.userData.update(28000,c,true,25.2)).toBeTrue();
  expect(root.userData.heightAbovePad+pad.centre[1]).toBeGreaterThanOrEqual(29.2);
  expect(root.userData.elapsedSeconds).toBe(phase);
  expect(attribute.getX(0)).toBe(x); expect(attribute.getZ(0)).toBe(z);
  expect(root.userData.update(29000,c,true,25.2)).toBeFalse();
  expect(root.userData.update(30000,c,true)).toBeTrue(); expect(root.userData.heightAbovePad).toBe(0);
});
for(const native of [false,true]) test(`one bounded reusable aircraft and rotors, pause-safe (${native})`, () => {
  const root=createRescueHelicopterV214(pad,native), c=camera();
  expect(root.children).toHaveLength(1); expect(root.userData.bufferBytes).toBeLessThan(RESCUE_HELICOPTER_V214.maxBufferBytes);
  const mesh=root.children[0] as Mesh, geometry=mesh.geometry, attribute=geometry.getAttribute("position"), array=attribute.array;
  const point=new Vector3(), initial=array.slice();
  for(let t=0;t<=65000;t+=50) {
    expect(root.userData.update(t,c,false)).toBeTrue();
    if(t%1000===0) for(let i=0;i<attribute.count;i++) {
      point.fromBufferAttribute(attribute,i);
      expect(Number.isFinite(point.x+point.y+point.z)).toBeTrue();
      expect(point.y).toBeGreaterThanOrEqual(pad.centre[1]+.10);
      expect(geometry.boundingSphere!.containsPoint(point)).toBeTrue();
    }
  }
  expect(array).not.toEqual(initial); expect(geometry.getAttribute("position").array).toBe(array);
  const phase=root.userData.elapsedSeconds, before=array.slice();
  expect(root.userData.update(66000,c,true)).toBeFalse();
  expect(root.userData.update(90000,c,true)).toBeFalse(); expect(array).toEqual(before);
  expect(root.userData.update(90050,c,false)).toBeTrue(); expect(root.userData.elapsedSeconds).toBe(phase);
  c.lookAt(-500,200,-1400); c.updateMatrixWorld(true);
  expect(root.userData.update(100000,c,false)).toBeFalse();
  expect(root.userData.elapsedSeconds).toBe(phase);
  c.lookAt(...pad.centre as [number,number,number]); c.updateMatrixWorld(true);
  root.userData.update(100050,c,false,25.2);
  expect(root.userData.heightAbovePad+pad.centre[1]).toBeGreaterThanOrEqual(29.2);
  for(let i=0;i<attribute.count;i++) expect(geometry.boundingSphere!.containsPoint(point.fromBufferAttribute(attribute,i))).toBeTrue();
  expect(mesh.castShadow).toBeFalse(); expect(Object.keys(geometry.attributes).sort()).toEqual(["color","position"]);
});

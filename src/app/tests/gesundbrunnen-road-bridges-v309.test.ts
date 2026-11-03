import {describe,expect,test} from 'bun:test';
import {BufferAttribute,Group,LineSegments,Mesh,MeshBasicMaterial} from 'three';
import {createGesundbrunnenRoadBridgesV309,hasCompleteGesundbrunnenRoadBridgesV309} from '../src/GesundbrunnenRoadBridgesV309';
import {gesundbrunnenRoadBridgeSolidsV309,gesundbrunnenRoadBridgeAtV309,gesundbrunnenRoadGroundAtV309,gesundbrunnenRoadBridgeContainsV309} from '../src/gesundbrunnenRoadBridgeNavigationV309';
import {createNorthernNavigationV309} from '../src/NorthernNavigationV309';
import {parkStaticGeometrySteps} from '../src/losslessStaticStorage';
import data from '../src/data/gesundbrunnenRoadBridgesV309.json';
function dispose(root:Group){const resources=new Set<{dispose():void}>();root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){resources.add(o.geometry);for(const m of [o.material,o.userData.dayMaterial,o.userData.nightMaterial,o.userData.schwellenraumMaterial].flat())if(m)resources.add(m);}});for(const r of resources)r.dispose();root.clear();}
function hash(a:ArrayBufferView){let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;}
const signature=(root:Group)=>{const rows:unknown[]=[];root.traverse(m=>{if(m instanceof Mesh||m instanceof LineSegments)rows.push([m.name,hash(m.geometry.getAttribute('position').array),m.geometry.getAttribute('color')?hash(m.geometry.getAttribute('color').array):null,m.geometry.index?hash(m.geometry.index.array):null]);});return rows;};
describe('paired measured Gesundbrunnen road bridges v309',()=>{
 for(const native of [false,true])test(`same full detail on touch, private lifecycle (${native})`,()=>{
  const a=createGesundbrunnenRoadBridgesV309(native),b=createGesundbrunnenRoadBridgesV309(native,{mobileLike:true});
  expect(signature(a)).toEqual(signature(b));expect(hasCompleteGesundbrunnenRoadBridgesV309(a,native)).toBe(true);
  expect(hasCompleteGesundbrunnenRoadBridgesV309(a,!native)).toBe(false);expect(hasCompleteGesundbrunnenRoadBridgesV309(a.clone(),native)).toBe(false);
  const first=a.children[0].children[0]as Mesh;a.position.y=.1;expect(hasCompleteGesundbrunnenRoadBridgesV309(a)).toBe(false);a.position.y=0;
  const originalX=first.position.x;first.position.x+=.1;expect(hasCompleteGesundbrunnenRoadBridgesV309(a)).toBe(false);first.position.x=originalX;
  const day=first.material;first.material=first.userData.nightMaterial;expect(hasCompleteGesundbrunnenRoadBridgesV309(a)).toBe(true);first.material=first.userData.schwellenraumMaterial;expect(hasCompleteGesundbrunnenRoadBridgesV309(a)).toBe(true);first.material=new MeshBasicMaterial();expect(hasCompleteGesundbrunnenRoadBridgesV309(a)).toBe(false);first.material.dispose();first.material=day;
  first.geometry.dispose();expect(hasCompleteGesundbrunnenRoadBridgesV309(a)).toBe(false);dispose(a);dispose(b);
 });
 test('parking leaves complete admission valid; loss of any required lower floor revokes it',()=>{
  const root=createGesundbrunnenRoadBridgesV309(true),work=parkStaticGeometrySteps(root,true);let step=work.next();while(!step.done)step=work.next();
  root.traverse(o=>{if(o instanceof Mesh){for(const a of Object.values(o.geometry.attributes))if(a instanceof BufferAttribute)a.onUploadCallback();o.geometry.index?.onUploadCallback();}});
  expect(hasCompleteGesundbrunnenRoadBridgesV309(root,true)).toBe(true);const parent=root.children[0],floor=parent.children.find(o=>o.name.includes('underdeck'))!;expect(floor).toBeDefined();parent.remove(floor);expect(hasCompleteGesundbrunnenRoadBridgesV309(root,true)).toBe(false);parent.add(floor);expect(hasCompleteGesundbrunnenRoadBridgesV309(root,true)).toBe(false);dispose(root);
 });
 for(const native of [false,true])test(`actual floors and exact local undersides keep the rail underpass open (${native})`,()=>{
  const x=1510.25,z=-3327.75,deck=gesundbrunnenRoadBridgeAtV309(x,z,native),ground=gesundbrunnenRoadGroundAtV309(x,z,native);
  expect(deck).not.toBeNull();expect(ground).not.toBeNull();expect(deck!).toBeGreaterThan(20);expect(ground!).toBeLessThan(14);expect(deck!-ground!).toBeGreaterThan(7);
  const solids=gesundbrunnenRoadBridgeSolidsV309(native),nav=createNorthernNavigationV309(solids,()=>true);
  expect(nav.floorAt(x,z,deck!)).toBeCloseTo(deck!,4);expect(nav.solidAt(x,ground!+2,z)).toBe(false);
  expect(nav.floorAt(x,z,ground!)).toBeCloseTo(ground!,4);expect(gesundbrunnenRoadBridgeContainsV309(1400,-3328,native)).toBe(false);
  expect(gesundbrunnenRoadBridgeAtV309(1400,-3328,native)).toBeNull();expect(gesundbrunnenRoadGroundAtV309(1400,-3328,native)).toBeNull();
 });
 test('every new native deck face is cardinal and its horizontal caps use one real height',()=>{
  for(const q of data.models.filter(q=>q.native&&q.key.endsWith('-native-deck'))){
   const bytes=Buffer.from(q.positions,'base64'),positions=new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2),ib=Buffer.from(q.indices,'base64'),indices=new Uint32Array(ib.buffer,ib.byteOffset,ib.byteLength/4);
   expect(positions.length).toBeGreaterThan(0);
   for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;expect([0,1,2].some(axis=>positions[a+axis]===positions[b+axis]&&positions[b+axis]===positions[c+axis])).toBe(true);}
  }
 });
});

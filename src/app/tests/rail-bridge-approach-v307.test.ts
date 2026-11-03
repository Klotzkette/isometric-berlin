import{describe,test,expect}from'bun:test';
import{BufferAttribute,Group,Mesh,MeshBasicMaterial}from'three';
import{createRailBridgeApproachV307,createRailBridgeApproachStepsV309,hasCompleteRailBridgeApproachV307}from'../src/RailBridgeApproachV307';
import{createRailBridgeApproachNavigationV307,railBridgeApproachContainsV307}from'../src/railBridgeApproachNavigationV307';
import{parkStaticGeometrySteps}from'../src/losslessStaticStorage';
import profile from'../src/data/railBridgeApproachV307Profile.json';
function finish<T>(g:Generator<void,T>){for(;;){const r=g.next();if(r.done)return r.value;}}
function dispose(root:Group){const done=new Set<object>();root.traverse(q=>{if(q instanceof Mesh){if(!done.has(q.geometry)){done.add(q.geometry);q.geometry.dispose();}for(const m of[q.material,q.userData.dayMaterial,q.userData.nightMaterial,q.userData.schwellenraumMaterial].flat())if(m&&!done.has(m)){done.add(m);m.dispose();}}});root.clear();}
function point(s:number):[number,number]{let last=profile.line[0];for(const p of profile.line.slice(1)){const d=Math.hypot(p[0]-last[0],p[1]-last[1]);if(s<=d)return[last[0]+(p[0]-last[0])*s/d,last[1]+(p[1]-last[1])*s/d];s-=d;last=p;}return[last[0],last[1]];}
describe('complete measured landing and separately estimated datum reconciliation',()=>{
 for(const native of[false,true])test(`actual geometry and navigation, immutable private lifetime (${native})`,()=>{
  const root=createRailBridgeApproachV307(native);try{
   expect(hasCompleteRailBridgeApproachV307(root,native)).toBe(true);expect(hasCompleteRailBridgeApproachV307(root,!native)).toBe(false);expect(hasCompleteRailBridgeApproachV307(root.clone(),native)).toBe(false);
   const nav=createRailBridgeApproachNavigationV307(root,native);let last=Infinity;
   for(const s of[1,8,16,24,32,40,47,50,80,110,140,180,210]){const[x,z]=point(s),floor=nav.groundAt(x,z);expect(railBridgeApproachContainsV307(x,z,native)).toBe(true);expect(floor).not.toBeNull();expect(floor!).toBeLessThan(last+.3);last=floor!;}
   expect(nav.groundAt(...point(1))!).toBeGreaterThan(18.7);expect(nav.groundAt(...point(47))!).toBeGreaterThan(17.5);expect(nav.groundAt(...point(210))!).toBeLessThan(3.5);expect(nav.groundAt(0,0)).toBeNull();
   const mesh=root.children[0]as Mesh,position=mesh.geometry.getAttribute('position')as BufferAttribute;
   mesh.geometry.setAttribute('position',position.clone());expect(nav.groundAt(...point(8))).toBeNull();mesh.geometry.setAttribute('position',position);expect(nav.groundAt(...point(8))).not.toBeNull();
   const day=mesh.material;mesh.material=mesh.userData.nightMaterial;expect(hasCompleteRailBridgeApproachV307(root,native)).toBe(true);mesh.material=new MeshBasicMaterial();expect(hasCompleteRailBridgeApproachV307(root,native)).toBe(false);(mesh.material as MeshBasicMaterial).dispose();mesh.material=day;
   finish(parkStaticGeometrySteps(root,true));root.traverse(q=>{if(q instanceof Mesh){for(const a of Object.values(q.geometry.attributes))if(a instanceof BufferAttribute)a.onUploadCallback();q.geometry.index?.onUploadCallback();}});expect(hasCompleteRailBridgeApproachV307(root,native)).toBe(true);expect(nav.groundAt(...point(24))).not.toBeNull();
   mesh.geometry.dispose();expect(nav.groundAt(...point(24))).toBeNull();
  }finally{dispose(root);}
 });
 test('per-mesh cooperative construction preserves the same complete family',()=>{const root=finish(createRailBridgeApproachStepsV309(false));try{expect(hasCompleteRailBridgeApproachV307(root,false)).toBe(true);expect(root.children.length).toBeGreaterThan(8);}finally{dispose(root);}});
});

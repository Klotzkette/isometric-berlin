import {expect,test} from "bun:test";
import {BufferAttribute, InstancedMesh, LineSegments, Mesh, PerspectiveCamera, Vector3} from "three";
import {createDrachenbergKitesV195,DRACHENBERG_KITES_V195 as profile} from "../src/DrachenbergKitesV195";

function camera() {
 const c=new PerspectiveCamera(55,1.4,.1,10000);
 c.position.set(-8380,115,1730);c.lookAt(-8380,85,1620);c.updateMatrixWorld(true);return c;
}
function buffers(root:ReturnType<typeof createDrachenbergKitesV195>) {
 const arrays=new Set<ArrayBufferView>();
 root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){
  for(const a of Object.values(o.geometry.attributes))arrays.add(a.array);
  if(o.geometry.index)arrays.add(o.geometry.index.array);
  if(o instanceof InstancedMesh){arrays.add(o.instanceMatrix.array);if(o.instanceColor)arrays.add(o.instanceColor.array);}
 }});return arrays;
}
for(const native of [false,true])test(`four bounded, finite, tethered fliers (${native?'native':'drawn'})`,()=>{
 const root=createDrachenbergKitesV195(native),c=camera();
 const data=root.userData.kiteData as {anchor:number[];lines:number;length:number}[];
 expect(data).toHaveLength(4);expect(data.map(d=>d.lines)).toEqual([1,1,2,2]);
 const arrays=buffers(root),bytes=[...arrays].reduce((n,a)=>n+a.byteLength,0);
 expect(bytes).toBeLessThan(profile.maxBufferBytes);expect(root.children.length).toBeLessThanOrEqual(4);
 const lines=root.getObjectByName('Six continuously tethered kite lines') as LineSegments;
 const line=lines.geometry.getAttribute('position') as BufferAttribute;
 const sails=root.children.find(o=>o instanceof Mesh&&o.geometry.getAttribute('position').usage===35048) as Mesh;
 const positions=sails.geometry.getAttribute('position') as BufferAttribute;
 const before=positions.array.slice();
 for(let timestamp=1000;timestamp<=61000;timestamp+=500){
  expect(root.userData.update(timestamp,c,false)).toBeTrue();
  let strandIndex=0;
  data.forEach((d,i)=>{for(let strand=0;strand<d.lines;strand++){
   const side=d.lines===1?0:strand?1:-1,at=strandIndex++*40;
   expect(line.getX(at)).toBeCloseTo(d.anchor[0]+.6*side*.26+.8*.49,2);
   expect(line.getY(at)).toBeCloseTo(d.anchor[1]+1.37,3);
   expect(line.getZ(at)).toBeCloseTo(d.anchor[2]+.8*side*.26-.6*.49,2);
   const end=new Vector3().fromBufferAttribute(line,at+39);
   // All kites remain above/downwind of their own flier throughout the cycle.
   expect(end.y-d.anchor[1]).toBeGreaterThan(17);
   expect((end.x-d.anchor[0])*.8+(end.z-d.anchor[2])*(-.6)).toBeGreaterThan(15);
   expect(end.distanceTo(new Vector3(...d.anchor as [number,number,number]))).toBeLessThan(d.length+4);
  }});
 }
 expect(positions.array).not.toEqual(before);expect(buffers(root)).toEqual(arrays);
 for(const a of arrays)for(const v of a as unknown as number[])expect(Number.isFinite(v)).toBeTrue();
 for(let j=0;j<positions.count;j++)expect(sails.geometry.boundingSphere!.containsPoint(new Vector3().fromBufferAttribute(positions,j))).toBeTrue();
});

test('motion respects cadence, offscreen and reduced-motion without allocating/replacing buffers',()=>{
 const root=createDrachenbergKitesV195(),c=camera();
 expect(root.userData.update(1000,c,false)).toBeTrue();
 const arrays=buffers(root),versions=root.children.filter(o=>o instanceof Mesh||o instanceof LineSegments).map(o=>(o as Mesh).geometry.getAttribute('position').version);
 expect(root.userData.update(1020,c,false)).toBeFalse();
 expect(root.userData.update(1200,c,true)).toBeFalse();
 root.visible=false;expect(root.userData.update(1200,c,false)).toBeFalse();root.visible=true;
 c.lookAt(-8300,120,2200);c.updateMatrixWorld(true);expect(root.userData.update(2000,c,false)).toBeFalse();
 expect(root.children.filter(o=>o instanceof Mesh||o instanceof LineSegments).map(o=>(o as Mesh).geometry.getAttribute('position').version)).toEqual(versions);
 expect(buffers(root)).toEqual(arrays);
});

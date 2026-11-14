import {expect,test} from 'bun:test';
import {InstancedMesh,Mesh,Raycaster,Vector3} from 'three';
import {createAirportsV194} from '../src/AirportsV194';
import {addAirportExteriorsV345,AIRPORT_EXTERIORS_V345_PROFILE} from '../src/AirportExteriorsV345';
import data from '../src/data/airportExteriorsV345.json';
const size=(root:any)=>{let n=0;root.traverse((o:any)=>{if(o.geometry){for(const a of Object.values(o.geometry.attributes)as any[])n+=a.array.byteLength;n+=o.geometry.index?.array.byteLength??0;}n+=o.instanceMatrix?.array.byteLength??0;n+=o.instanceColor?.array.byteLength??0;});return n;};
test('both modes retain original complete geometry and fit existing airport budget',()=>{
 for(const native of [false,true]){const root=createAirportsV194(native),before=root.children.slice(),bytes=size(root);
  expect(addAirportExteriorsV345(root,native)).toBe(true);expect(root.children.slice(0,before.length)).toEqual(before);
  expect(size(root)-bytes).toBeLessThan(AIRPORT_EXTERIORS_V345_PROFILE.budgetBytes);expect(size(root)).toBeLessThan(AIRPORT_EXTERIORS_V345_PROFILE.combinedAirportBudgetBytes);
  const detail=root.children.at(-1)!;expect(detail.children).toHaveLength(2);
  for(const m of detail.children as InstancedMesh[]){expect(m.count).toBeGreaterThan(100);expect(m.matrixAutoUpdate).toBe(false);expect(m.geometry.getAttribute('uv')).toBeUndefined();
   if(native)for(let i=0;i<m.count;i++)for(const a of [1,2,4,6,8,9])expect(m.instanceMatrix.array[i*16+a]).toBe(0);
  }
  expect(addAirportExteriorsV345(root,native)).toBe(false);
 }
});
test('actual source, paint, transform or mode mismatch cannot acquire fittings',()=>{
 for(const native of [false,true])for(const change of [
  (r:any)=>{r.children.pop();},(r:any)=>{r.children[0].geometry.attributes.position.array[0]+=.1;},
  (r:any)=>{r.children.at(-1).instanceMatrix.array[12]+=.1;},(r:any)=>{r.children.at(-1).instanceColor.array[0]+=.1;},
  (r:any)=>{r.position.x=1;},(r:any)=>{r.children[0].matrix.elements[12]=1;},
 ]){const root=createAirportsV194(native);change(root);const count=root.children.length;expect(addAirportExteriorsV345(root,native)).toBe(false);expect(root.children.length).toBe(count);}
 expect(addAirportExteriorsV345(createAirportsV194(false),true)).toBe(false);
});
test('photo fittings are on visible source-pane outer faces, not buried in the old shell',()=>{
 const root=createAirportsV194();expect(addAirportExteriorsV345(root)).toBe(true);root.updateMatrixWorld(true);
 for(const site of ['tegel','tempelhof'])for(const h of data.hosts.filter(h=>h.site===site).filter((_,i)=>i%25===0)){
  const b=data.boxes[h.drawnRange[0]],n=new Vector3(h.normal[0],0,h.normal[1]);const c=new Vector3(b[0],b[1],b[2]);
  const hits=new Raycaster(c.clone().addScaledVector(n,2),n.clone().negate(),0,2.1).intersectObject(root,true);
  expect(hits.some(hit=>hit.object.parent===root.children.at(-1))).toBe(true);
 }
});

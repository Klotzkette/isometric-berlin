import { expect,test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { InstancedMesh,Matrix4,Mesh,Raycaster,Vector3 } from 'three';
import { createPekingerPlatzV281,PEKINGER_PLATZ_V281 as S,pekingerBushesV281,pekingerPlatzFloorV281At,pekingerTablesBlockedV281 } from '../src/PekingerPlatzV281';
import ledger from '../../../geo_data/regierungsviertel/pekinger-platz-v281-source.json';

test('keeps original source owners, all eleven path lines and actual flat ground',()=>{
 const data=(name:string,sha:string)=>{const b=readFileSync(new URL(`../public/mesh/regierungsviertel/${name}.json`,import.meta.url));expect(createHash('sha256').update(b).digest('hex')).toBe(sha);return JSON.parse(b.toString());};
 const p=data('park-details',ledger.retained.parkDetailsSha256),g=data('minecraft-voxels',ledger.retained.nativeGroundSha256);
 data('surface-polygons',ledger.retained.surfacePolygonsSha256);
 expect(S.paths).toHaveLength(11);
 for(const path of S.paths){const old=p.paths.find((e:any)=>e.id===`${path.id}:0`);expect(path.points).toEqual(old.points.map((p:number[])=>[p[0],p[2]]));expect(path.width).toBe(old.w/100);}
 let runs=0;
 g.ground_rows.forEach((r:number[][],zi:number)=>{const z=(g.grid.min_z_idx+zi)*4;if(z>=-2351||z+4<=-2405)return;
  for(const[xi,n]of r){const x=(g.grid.min_x_idx+xi)*4;if(x>=-1072||x+n*4<=-1170)continue;
   expect(g.ground_height.y_dm[Math.floor(zi/4)*g.ground_height.cols+Math.floor((xi+n/2)/4)]/10).toBe(S.groundY);runs++;
  }
 });expect(runs).toBe(36);
 expect(S.park.ring).toHaveLength(28);expect(S.playground.ring).toHaveLength(24);
 expect(S.tables.map(t=>t.id)).toEqual([556112181,8695211449]);
});
test('small full-mobile owners retain independent cardinal native construction',()=>{
 for(const native of [false,true]){
  const root=createPekingerPlatzV281(native),mobile=createPekingerPlatzV281(native,{mobileLike:true});let bytes=0;
  expect(root.children).toHaveLength(native?1:3);
  root.children.forEach((o,i)=>{const m=o as Mesh,other=mobile.children[i] as Mesh;
   for(const [key,a]of Object.entries(m.geometry.attributes)){bytes+=a.array.byteLength;expect(a.array).toEqual(other.geometry.attributes[key].array);}
   bytes+=m.geometry.index?.array.byteLength??0;
   if(m instanceof InstancedMesh){bytes+=m.instanceMatrix.array.byteLength+(m.instanceColor?.array.byteLength??0);expect(m.instanceMatrix.array).toEqual((other as InstancedMesh).instanceMatrix.array);
    if(native){const matrix=new Matrix4();for(let j=0;j<m.count;j++){m.getMatrixAt(j,matrix);for(const k of [1,2,4,6,8,9])expect(matrix.elements[k]).toBe(0);}}
   }
  });expect(bytes).toBeLessThan(23000);
  expect(pekingerBushesV281(native).length).toBe(native?78:43);
 }
});
test('source-shaped sand is above old footprint, below retained paths and matches walking',()=>{
 expect(S.drawnSandY).toBeGreaterThan(5.245+.11);expect(S.drawnSandY).toBeLessThan(5.245+.12);
 expect(pekingerPlatzFloorV281At(-1140,-2370)).toBeNull();
 for(const native of [false,true]){
  const root=createPekingerPlatzV281(native);root.updateMatrixWorld(true);
  for(const[x,z]of[[-1090.25,-2380.25],[-1092.25,-2373.25],[-1088.25,-2385.25]]){
   const hit=new Raycaster(new Vector3(x,10,z),new Vector3(0,-1,0)).intersectObject(root,true)[0];
   expect(hit).toBeDefined();expect(hit.point.y).toBeCloseTo(pekingerPlatzFloorV281At(x,z,native)!,5);
  }
  if(!native){const n=(root.children[1] as Mesh).geometry.attributes.normal;for(let i=0;i<n.count;i++)expect(n.getY(i)).toBe(1);}
 }
});
test('table collision follows the two mapped centres in both families',()=>{
 for(const native of [false,true])for(const t of S.tables){
  const[x,z]=t.point,y=native?S.nativeSandY:S.drawnSandY;
  expect(pekingerTablesBlockedV281(x,z,y,y+1.7,.3,native)).toBe(true);
  expect(pekingerTablesBlockedV281(x+3,z,y,y+1.7,.3,native)).toBe(false);
  expect(pekingerTablesBlockedV281(x,z,y+.92,y+2,.3,native)).toBe(false);
 }
});

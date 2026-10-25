import { expect, test } from 'bun:test';
import { InstancedMesh, Mesh } from 'three';
import data from '../src/data/dorotheenstadtV266.json';
import previous from '../src/data/dorotheenstadtV266Previous.json';
import { createDorotheenstadtV266, dorotheenstadtGraveRowsV266 } from '../src/DorotheenstadtV266';
import { transferDorotheenstadtTrianglesV266 } from '../src/dorotheenstadtV266Ownership';
import type { SurroundingPackedMesh } from '../src/SurroundingCityGeometry';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { worldGroundSampler, smoothGroundTopSampler, type VoxelPayload } from '../src/terrainPayload';

function cleanup(root: ReturnType<typeof createDorotheenstadtV266>):void {
  root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();o.userData.dayMaterial.dispose();o.userData.nightMaterial.dispose();}});
}
function complete<T>(steps:Generator<void,T>):T {for(;;){const n=steps.next();if(n.done)return n.value;}}

test('every grave group stands above the actual drawn and native production ground',()=>{
  const ground=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/ground-context.json',import.meta.url),'utf8')) as VoxelPayload;
  const nearest=worldGroundSampler(ground),smooth=smoothGroundTopSampler(ground);
  expect(data.profile.graveGroundY).toBe(5.2);
  for(const [x,z] of data.graves)for(const [dx,dz] of [[0,0],[-1.25,-1.55],[1.25,-1.55],[-1.25,1.55],[1.25,1.55]]){
    const px=x+dx,pz=z+dz,ix=Math.floor(px/ground.cell_m)-ground.grid.min_x_idx,iz=Math.floor(pz/ground.cell_m)-ground.grid.min_z_idx;
    expect(ground.ground_rows[iz].some(([a,n])=>ix>=a&&ix<a+n)).toBe(true);
    expect(nearest(px,pz)).toBeCloseTo(data.profile.graveGroundY,8);
    expect(smooth(px/ground.cell_m-ground.grid.min_x_idx,pz/ground.cell_m-ground.grid.min_z_idx)).toBeCloseTo(data.profile.graveGroundY,8);
  }
  for(const native of [false,true])for(const row of dorotheenstadtGraveRowsV266(native))expect(row[1]-row[4]/2).toBeGreaterThan(data.profile.graveGroundY);
});

test('full drawn detail equals mobile and final buffers remain bounded',()=>{
  const a=createDorotheenstadtV266(),b=createDorotheenstadtV266(false,{mobileLike:true});
  expect(a.children.length).toBe(2);expect(a.matrixAutoUpdate).toBe(false);
  expect(a.userData.fullStaticDetailOnTouch).toBe(true);
  let bytes=0;
  for(let i=0;i<a.children.length;i++) {
    const x=a.children[i] as Mesh,y=b.children[i] as Mesh;
    expect(x.geometry.getAttribute('position').array).toEqual(y.geometry.getAttribute('position').array);
    expect(x.geometry.getAttribute('uv')).toBeUndefined();expect(x.userData.dayMaterial.map).toBeNull();
    for(const attr of Object.values(x.geometry.attributes))bytes+=attr.array.byteLength;
    bytes+=x.geometry.index?.array.byteLength??0;
    if(x instanceof InstancedMesh)bytes+=x.instanceMatrix.array.byteLength+x.instanceColor!.array.byteLength;
  }
  expect(bytes).toBeLessThan(250_000);cleanup(a);cleanup(b);
});

test('native marker matrices and facade triangles are all orthogonal',()=>{
  const root=createDorotheenstadtV266(true);
  expect(root.userData.nativeMinecraft).toBe(true);expect(root.children.length).toBe(2);
  const facade=root.children[0] as Mesh, positions=facade.geometry.getAttribute('position').array,ix=facade.geometry.index!.array;
  for(let i=0;i<ix.length;i+=3){
    const points=[ix[i],ix[i+1],ix[i+2]].map(n=>[positions[n*3],positions[n*3+1],positions[n*3+2]]);
    expect([0,1,2].some(axis=>points.every(p=>p[axis]===points[0][axis]))).toBe(true);
  }
  const graves=root.children[1] as InstancedMesh;
  for(let i=0;i<graves.count;i++)for(const j of [1,2,4,6,8,9])expect(graves.instanceMatrix.array[i*16+j]).toBe(0);
  expect(dorotheenstadtGraveRowsV266(true).length).toBe(dorotheenstadtGraveRowsV266(false).length);
  expect(data.graves.length).toBe(90);cleanup(root);
});

test('aperture transfer is exact, required-gated and conservative on changed packets',()=>{
  const publicRoot=new URL('../public/mesh/surrounding-berlin-v159/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',publicRoot),'utf8'));
  let total=0;
  for(const r of previous.records){
    const descriptor=manifest.chunks.find((c:{id:string})=>c.id===r.tile);
    const packet=JSON.parse(gunzipSync(readFileSync(new URL(descriptor.drawn.url,publicRoot))).toString());
    const mesh=packet.meshes.find((m:SurroundingPackedMesh)=>m.kind===r.kind) as SurroundingPackedMesh;
    const original=new Uint32Array(Uint8Array.from(atob(mesh.indices),c=>c.charCodeAt(0)).buffer);
    const disabled=original.slice();expect(complete(transferDorotheenstadtTrianglesV266(false,r.tile,false,mesh,disabled,0))).toBe(0);expect(disabled).toEqual(original);
    expect(complete(transferDorotheenstadtTrianglesV266(true,r.tile,true,mesh,disabled,0))).toBe(0);
    expect(complete(transferDorotheenstadtTrianglesV266(true,r.tile,false,{...mesh,colors:mesh.colors+'A'},disabled,0))).toBe(0);
    const changed=original.slice();total+=complete(transferDorotheenstadtTrianglesV266(true,r.tile,false,mesh,changed,0));
    const chosen=new Set(r.triangles);
    for(let i=0;i<original.length/3;i++){
      if(chosen.has(i)){expect(changed[i*3+1]).toBe(changed[i*3]);expect(changed[i*3+2]).toBe(changed[i*3]);}
      else for(let j=0;j<3;j++)expect(changed[i*3+j]).toBe(original[i*3+j]);
    }
  }
  expect(total).toBe(800);
});

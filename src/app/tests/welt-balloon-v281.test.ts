import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Box3, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createMinecraftWeltBalloonV281, createWeltGondolaFloorV281, WELT_BALLOON_V281 as V, weltBalloonNativeRowsV281 } from '../src/WeltBalloonV281';
import { WELT_BALLOON_PROFILE as P } from '../src/expandedCityProfiles';
import { disposeStaticAudit, staticGeometryAudit } from './helpers/staticGeometryAudit';

test('ring-gondola deck has a real opening, retained diameter and correctly facing top',()=>{
  const g=createWeltGondolaFloorV281(),mesh=new Mesh(g,new MeshBasicMaterial());mesh.updateMatrixWorld(true);
  for(const x of [0,.75,1.5])expect(new Raycaster(new Vector3(x,2,0),new Vector3(0,-1,0)).intersectObject(mesh)).toHaveLength(0);
  for(const x of [1.8,2.3,2.8]){
    const hit=new Raycaster(new Vector3(x,2,0),new Vector3(0,-1,0)).intersectObject(mesh);
    expect(hit.length).toBeGreaterThan(0);expect(hit[0].point.y).toBeCloseTo(.14,5);
  }
  const bounds=new Box3().setFromObject(mesh);expect(bounds.max.x-bounds.min.x).toBeCloseTo(P.gondolaDiameterM,5);
  expect(bounds.max.z-bounds.min.z).toBeCloseTo(P.gondolaDiameterM,5);
  disposeStaticAudit(mesh);
});

test('native WELT keeps the full source anchor/profile and the annular opening',()=>{
  const scene=JSON.parse(readFileSync(new URL('../public/mesh/regierungsviertel/scene.json',import.meta.url),'utf8'));
  expect(scene.landmarks.find((p:{name:string})=>p.name==='WELT Balloon').world).toEqual(V.anchor);
  expect([P.envelopeDiameterM,P.totalHeightM,P.gondolaDiameterM,P.envelopeCenterAboveGroundM,P.gondolaPassengerCapacity]).toEqual([22.67,34,5.9,91,30]);
  const [x,g,z]=V.anchor,bottom=g+P.envelopeCenterAboveGroundM+P.envelopeDiameterM/2-P.totalHeightM;
  const rows=weltBalloonNativeRowsV281(),floor=rows.filter(b=>Math.abs(b[1]-(bottom+.2))<.00001);
  expect(floor.length).toBeGreaterThan(30);
  for(const [cx,,cz,w,,d]of floor){
    const near=Math.hypot(Math.max(0,Math.abs(cx-x)-w/2),Math.max(0,Math.abs(cz-z)-d/2));
    expect(near).toBeGreaterThanOrEqual(V.innerGondolaRadius-.000001);
  }
  expect(rows.every(row=>row.every(Number.isFinite)&&row.slice(3,6).every(v=>v>0))).toBe(true);
  expect(rows.some(row=>row[6]===P.envelopeBlueStripeColor)).toBe(true);
  expect(rows.filter(row=>row[6]===0x111416&&row[1]>g+88).length).toBeGreaterThan(200);
});

test('native WELT is cardinal, texture free, finite, full on mobile and bounded',()=>{
  const audits=[];
  for(const mobileLike of [false,true]){
    const root=createMinecraftWeltBalloonV281({mobileLike});
    try{
      const mesh=root.children[0] as InstancedMesh,matrix=new Matrix4();
      expect(mesh.userData.dayMaterial.vertexColors).toBe(false);
      expect(mesh.userData.nightMaterial.vertexColors).toBe(false);
      expect(mesh.instanceColor).not.toBeNull();
      expect(root.matrixAutoUpdate).toBe(false);expect(mesh.geometry.getAttribute('uv')).toBeUndefined();
      for(let i=0;i<mesh.count;i++){
        mesh.getMatrixAt(i,matrix);expect(matrix.determinant()).toBeGreaterThan(0);
        for(const j of [1,2,4,6,8,9])expect(matrix.elements[j]).toBe(0);
      }
      const bounds=new Box3().setFromObject(root);
      expect(bounds.max.y).toBeCloseTo(V.anchor[1]+P.envelopeCenterAboveGroundM+P.envelopeDiameterM/2,3);
      audits.push(staticGeometryAudit(root));
    }finally{disposeStaticAudit(root);}
  }
  expect(audits[0]).toEqual(audits[1]);expect(audits[0].budget.draws).toBe(1);expect(audits[0].budget.bytes).toBeLessThan(500_000);
  console.log('WELT native submitted geometry',audits[0].budget);
});

import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import source from "../src/data/arkonaplatzV193.json";
import { readFileSync } from "node:fs";
const sourceGeometry = JSON.parse(readFileSync(new URL("../../../geo_data/regierungsviertel/arkonaplatz-v193-source.geojson",import.meta.url),"utf8")) as { features: { properties: { tags: Record<string,string> }; geometry: { coordinates: number[][] } }[] };
import { ARKONAPLATZ_V193_PROFILE as profile, arkonaplatzV193Rows, arkonaplatzV193NativeRows, arkonaplatzV193PavingPositions, arkonaplatzV193NativePavingRows, createArkonaplatzV193 } from "../src/ArkonaplatzV193";
import { terrainGroundAt } from "../src/weinbergTerrainV176";

const paths = sourceGeometry.features.filter(f => ['footway','path','steps'].includes(f.properties.tags.highway ?? '')).map(f => f.geometry.coordinates as number[][]);
function distanceToPaths(x:number,z:number):number {
  let distance=Infinity;
  for(const path of paths)for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return distance;
}

test('exact source tree anchors follow the active ground sampler in both representations',()=>{
  const original=JSON.stringify(source);
  for(const native of [false,true]) {
    const rows=arkonaplatzV193Rows(native),trees=source.trees.filter((_,i)=>!native||i%2===0);
    expect(rows.trunks).toHaveLength(native?65:129);
    for(let i=0;i<trees.length;i++) {
      const [x,z]=trees[i].xz,r=rows.trunks[i];
      expect([r[0],r[2]]).toEqual([x,z]);
      expect(r[1]-r[4]/2).toBeCloseTo(terrainGroundAt(x,z,3,native),9);
    }
    expect(rows.crowns.every(r=>r[1]-r[4]/2>terrainGroundAt(r[0],r[2],3,native)+3.8)).toBe(true);
  }
  expect(JSON.stringify(source)).toBe(original);
});

test('market furniture stays clear of all mapped walkway centres, including native block extents',()=>{
  for(const native of [false,true]) {
    const rows=arkonaplatzV193Rows(native).market;
    const represented=native?arkonaplatzV193NativeRows(rows):rows;
    for(const r of represented) {
      const yaw=native?0:r[6],c=Math.cos(yaw),s=Math.sin(yaw);
      for(const u of [-r[3]/2,0,r[3]/2])for(const v of [-r[5]/2,0,r[5]/2]) {
        const x=r[0]+c*u+s*v,z=r[2]-s*u+c*v;
        expect(distanceToPaths(x,z)).toBeGreaterThan(native?1:1.25);
      }
      expect(r[1]-r[4]/2).toBeGreaterThanOrEqual(2.99);
    }
  }
});

test('all detail remains bounded, texture-free, static, finite and axis-aligned in native mode',()=>{
  for(const native of [false,true]) {
    const root=createArkonaplatzV193(native),matrix=new Matrix4();let bytes=0,draws=0;
    expect(root.userData.sourceGeometryRetained).toBe(true);
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBe(false);
      if(!(o instanceof Mesh))return;
      draws++;expect(o.frustumCulled).toBe(true);
      expect(o.geometry.getAttribute('uv')).toBeUndefined();
      expect(o.geometry.boundingBox).not.toBeNull();expect(o.geometry.boundingSphere).not.toBeNull();
      expect(o.userData.dayMaterial).toBeDefined();expect(o.userData.nightMaterial).toBeDefined();
      expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
      for(const a of Object.values(o.geometry.attributes))bytes+=a.array.byteLength;
      bytes+=o.geometry.index?.array.byteLength??0;
      if(!(o instanceof InstancedMesh))return;
      expect(o.boundingBox).not.toBeNull();expect(o.boundingSphere).not.toBeNull();
      bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
      expect(o.instanceMatrix.count).toBe(o.count);
      for(let i=0;i<o.count;i++) {
        o.getMatrixAt(i,matrix);expect(matrix.elements.every(Number.isFinite)).toBe(true);
        if(native)for(const k of [1,2,4,6,8,9])expect(matrix.elements[k]).toBe(0);
      }
    });
    expect(draws).toBe(4);expect(draws).toBeLessThanOrEqual(profile.maxDrawCalls);
    expect(bytes).toBeLessThan(profile.budgetBytes);
  }
});

test('central paving follows full local relief and source area while native rows stay on terraces',()=>{
  const positions=arkonaplatzV193PavingPositions();let area=0;
  for(let i=0;i<positions.length;i+=3) {
    const [x,y,z]=positions.slice(i,i+3);
    expect(y).toBeCloseTo(terrainGroundAt(x,z,3,false)+.07,6);
  }
  for(let i=0;i<positions.length;i+=9) {
    const [ax,,az,bx,,bz,cx,,cz]=positions.slice(i,i+9);
    area+=Math.abs((bx-ax)*(cz-az)-(cx-ax)*(bz-az))/2;
  }
  expect(area).toBeCloseTo(1884.1036740736458,5);
  const rows=arkonaplatzV193NativePavingRows();
  expect(rows.length).toBeLessThan(source.nativePavingCentres.length/5);
  expect(rows.reduce((sum,r)=>sum+r[3]*r[5],0)).toBeCloseTo(7111*.25,8);
  for(const r of rows)for(let u=-r[3]/2+.25;u<r[3]/2;u+=.5)
    expect(r[1]+r[4]/2).toBeCloseTo(terrainGroundAt(r[0]+u,r[2],3,true)+.08,7);
});

test('all table and canopy feet meet local paving despite sloping or terraced ground',()=>{
  for(const native of [false,true]) {
    const {supports}=arkonaplatzV193Rows(native);
    expect(supports).toHaveLength(100);
    for(const r of supports) {
      expect(r[1]-r[4]/2).toBeCloseTo(terrainGroundAt(r[0],r[2],3,native)+(native?.08:.07),9);
      expect(r[4]).toBeGreaterThan(.12);
    }
  }
});

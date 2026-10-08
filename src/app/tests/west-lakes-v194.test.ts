import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createWestLakesV194, westLakesV194WaterAt } from "../src/WestLakesV194";
import nav from "../src/data/westLakesV194Navigation.json";

test('both complete representations construct with bounded, finite, culled, final-count buffers',()=>{
  for(const native of [false,true]) {
    const root=createWestLakesV194(native);let bytes=0,draws=0;const m=new Matrix4();
    expect(root.children).toHaveLength(8);
    root.traverse(o=>{
      expect(o.matrixAutoUpdate).toBe(false);
      if(!(o instanceof Mesh))return;
      draws++;expect(o.frustumCulled).toBe(true);
      expect(o.geometry.boundingSphere).not.toBeNull();expect(o.geometry.boundingBox).not.toBeNull();
      expect(o.geometry.getAttribute('uv')).toBeUndefined();
      expect(o.userData.dayMaterial.map).toBeNull();expect(o.userData.nightMaterial.map).toBeNull();
      for(const a of Object.values(o.geometry.attributes)) {
        bytes+=a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
      }
      bytes+=o.geometry.index?.array.byteLength??0;
      if(o instanceof InstancedMesh) {
        expect(o.boundingBox).not.toBeNull();expect(o.boundingSphere).not.toBeNull();
        expect(o.instanceMatrix.count).toBe(o.count);bytes+=o.instanceMatrix.array.byteLength+o.instanceColor!.array.byteLength;
        if(native)for(let i=0;i<o.count;i++) {o.getMatrixAt(i,m);for(const k of [1,2,4,6,8,9])expect(m.elements[k]).toBe(0);}
      }
    });
    expect(draws).toBe(native?8:11);expect(bytes).toBeLessThan(2*1024*1024);
  }
});

test('water callback preserves all island holes and the old connected datum',()=>{
  for(const native of [false,true]) {
    expect(westLakesV194WaterAt(-8000,-6500,native)).toBe(-1.15);
    expect(westLakesV194WaterAt(-6251,-8624,native)).toBeNull();
    const area=(native?nav.native:nav.drawn)[0];
    expect(area.polygons.reduce((n,p)=>n+p.length-1,0)).toBe(7);
    for(const poly of area.polygons)for(const hole of poly.slice(1)) {
      // Find one actual dry interior sample by scanning its centre neighbourhood.
      const xs=hole.map(p=>p[0]),zs=hole.map(p=>p[1]);
      const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
      expect(westLakesV194WaterAt(x,z,native)).toBeNull();
    }
    expect(westLakesV194WaterAt(0,0,native)).toBeNull();
  }
});

test('new named buildings stop walking through their source envelope and native shell while courts stay open',async()=>{
  const { westLakesV194SolidAt } = await import('../src/westLakesV194Navigation');
  const blocks = (await import('../src/data/westLakesV194Native.json')).default;
  expect(westLakesV194SolidAt(-6250.0496,5,-8624.3442,.25)).toBe(true);
  expect(westLakesV194SolidAt(-7371.9702,5,-7782.8816,.25)).toBe(true);
  expect(westLakesV194SolidAt(-17322.0812,5,9370.2205,.25)).toBe(true);
  for(const native of [false,true]) {
    expect(westLakesV194SolidAt(-7366.9814,5,-7794.2505,.20,native)).toBe(false);
    expect(westLakesV194SolidAt(-6250,30,-8624,.20,native)).toBe(false);
    expect(westLakesV194SolidAt(0,5,0,.20,native)).toBe(false);
  }
  for(const site of blocks.sites.filter(s=>s.boxes.length))for(const r of site.boxes)
    expect(westLakesV194SolidAt(r[0],r[1],r[2],0,true)).toBe(true);
});

test('new horizontal lake water uses the exact retained packet colour and material convention',()=>{
  for(const native of [false,true]) {
    const root=createWestLakesV194(native),lake=root.children.find(c=>c.userData.siteKey==='kleiner-wannsee')!;
    const mesh=lake.children[0] as Mesh,positions=mesh.geometry.getAttribute('position'),color=mesh.geometry.getAttribute('color');
    for(let i=0;i<positions.count;i++)if(Math.abs(positions.getY(i)+1.15)<1e-5) {
      // build_surrounding_outlines.linear_rgb_bytes([105,148,157])
      expect(color.getX(i)).toBeCloseTo(36/255,6);
      expect(color.getY(i)).toBeCloseTo(76/255,6);
      expect(color.getZ(i)).toBeCloseTo(86/255,6);
    }
    if(native)expect(mesh.userData.dayMaterial.isMeshStandardMaterial).toBe(true);
  }
});

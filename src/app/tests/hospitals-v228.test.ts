import { expect, test } from "bun:test";
import { createHospitalRecognitionV228, hospitalFittingsV228 } from "../src/HospitalRecognitionV228";
import { createHospitalEnvelopesV228 } from "../src/HospitalEnvelopesV228";
import { hospitalV228GroundAt, hospitalV228RoofAt, hospitalV228SolidAt, hospitalV228TerrainAt } from "../src/hospitalV228Navigation";
import profile from "../src/data/hospitalV228Profile.json";
import nav from "../src/data/hospitalV228Navigation.json";
import nativeBodies from "../src/data/hospitalV228Native.json";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

test("all six hospital profiles have finite source-attached windows and separate native blocks",()=>{
  for(const site of profile.sites) {
    const drawn=hospitalFittingsV228(site),native=hospitalFittingsV228(site,true);
    expect(drawn.windowCount).toBeGreaterThan(100);
    expect(native.windowCount).toBe(drawn.windowCount);
    expect(native.windows.length).toBe(0);
    expect(native.rows.every(r=>r.length===7&&r.every(Number.isFinite)&&r.slice(3,6).every(n=>n>0))).toBeTrue();
    expect(drawn.rows.every(r=>r.length===8&&r.every(Number.isFinite))).toBeTrue();
    expect(drawn.windows.every(w=>Number.isFinite(w.x+w.y+w.z+w.yaw)&&w.height>0&&w.width>0)).toBeTrue();
  }
});

test("hospital geometry is frozen and partitioned by campus with no retained decoded arrays",()=>{
  for(const native of [false,true]) {
    const fits=createHospitalRecognitionV228(native),bodies=createHospitalEnvelopesV228(native);
    try {
      expect(bodies.children.length).toBe(3);
      expect(fits.children.length).toBe(native?6:12);
      expect(new Set(fits.children.map(p=>p.userData.siteKey)).size).toBe(6);
      for(const root of [fits,bodies]) {
        expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
        expect(root.userData.sourceSuppressionIds).toEqual([]);
        expect(JSON.stringify(root.userData).length).toBeLessThan(1000);
        root.traverse(o=>expect(o.matrixAutoUpdate).toBeFalse());
        const audit=staticGeometryAudit(root);expect(audit.budget.draws).toBeGreaterThan(0);
        expect(audit.budget.bytes).toBeLessThan(8*1024*1024);
      }
    } finally {disposeStaticAudit(fits);disposeStaticAudit(bodies);}
  }
});

test("new mapped roofs support walking without lifting a pedestrian through a building",()=>{
  for(const site of nav.sites) {
    const t=site.roofTriangles.find(t=>Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))>4)!;
    const x=(t[0][0]+t[1][0]+t[2][0])/3,z=(t[0][2]+t[1][2]+t[2][2])/3;
    const roof=hospitalV228RoofAt(x,z)!;
    expect(roof).toBeGreaterThan(5);
    expect(hospitalV228GroundAt(x,z,roof)).toBeCloseTo(roof);
    const low=hospitalV228GroundAt(x,z,3);expect(low===null||low<roof).toBeTrue();
    expect(hospitalV228SolidAt(x,roof-.2,z)).toBeTrue();
    expect(hospitalV228SolidAt(x,roof+2,z)).toBeFalse();
  }
  expect(hospitalV228RoofAt(100000,100000)).toBeNull();
  expect(hospitalV228SolidAt(100000,5,100000)).toBeFalse();
});

test("native hospital collision and support follow actual raster cells beyond the smooth outline",()=>{
  // This DRK wall cell projects outside the smooth ring. Its centre used to be
  // non-solid even with the normal .35m pedestrian radius.
  expect(hospitalV228SolidAt(263.5,14.5,-4327.5,.35,true)).toBeTrue();
  for(const site of nativeBodies.sites) {
    for(const [x,y,z] of site.blocks) expect(hospitalV228SolidAt(x,y,z,0,true)).toBeTrue();
    for(let i=0;i<site.blocks.length;i+=37) {
      const [x,,z]=site.blocks[i];
      const column=site.blocks.filter(r=>Math.abs(x-r[0])<=r[3]/2&&Math.abs(z-r[2])<=r[5]/2);
      const roof=Math.max(...column.map(r=>r[1]+r[4]/2));
      expect(hospitalV228RoofAt(x,z,true)).toBe(roof);
      expect(hospitalV228GroundAt(x,z,roof,true)).toBe(roof);
      const low=hospitalV228GroundAt(x,z,3,true);
      expect(low===null||low<=3.45).toBeTrue();
      // A hidden seam between stacked boxes must never become a stepping ledge.
      for(const r of column) {
        const top=r[1]+r[4]/2;
        if(column.some(q=>q[1]-q[4]/2<=top&&q[1]+q[4]/2>top))
          expect(hospitalV228GroundAt(x,z,top-.45,true)).not.toBe(top);
      }
    }
  }
  expect(hospitalV228RoofAt(100000,100000,true)).toBeNull();
  expect(hospitalV228TerrainAt(100000,100000,true)).toBeNull();
});

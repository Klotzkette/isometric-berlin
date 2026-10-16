import { describe, expect, it } from "bun:test";
import { Mesh, InstancedMesh } from "three";
import { createDistrictTownhallEnvelopesV227 } from "../src/DistrictTownhallEnvelopesV227";
import nav from "../src/data/townhallV227Navigation.json";
import drawn from "../src/data/townhallV227Envelopes.json";
import native from "../src/data/townhallV227Native.json";
import { districtTownhallV227GroundAt, districtTownhallV227RoofAt, districtTownhallV227SolidAt, districtTownhallV227TerrainAt } from "../src/districtTownhallV227Navigation";

function inside(ring: number[][], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
describe("district town-hall source envelopes v227", () => {
  it("keeps one independently culled full source mesh per affected site in both representations", () => {
    const smooth = createDistrictTownhallEnvelopesV227(), blocks = createDistrictTownhallEnvelopesV227(true);
    expect(smooth.children.length).toBe(16); expect(blocks.children.length).toBe(16);
    for (const [i, object] of smooth.children.entries()) {
      const mesh = object as Mesh;
      expect(mesh.geometry.getAttribute("position").count).toBe(drawn.sites[i].surfaces.reduce((n,s)=>n+s.triangles.length*3,0));
      expect(mesh.frustumCulled).toBe(true); expect(mesh.geometry.boundingSphere!.radius).toBeLessThan(400);
      expect(mesh.userData.surfaces).toBeUndefined(); expect(mesh.userData.blocks).toBeUndefined();
      expect(mesh.matrixAutoUpdate).toBe(false); mesh.geometry.dispose();
    }
    for (const [i, object] of blocks.children.entries()) {
      const mesh = object as InstancedMesh;
      expect(mesh.count).toBe(native.sites[i].blocks.length);
      expect(mesh.boundingSphere!.radius).toBeLessThan(400); expect(mesh.frustumCulled).toBe(true); mesh.geometry.dispose();
    }
  });
  it("provides a traversable support around each of six formerly absent peripheral halls", () => {
    let tested = 0;
    for (const site of nav.sites) if (site.pads.length) {
      const pad = site.pads[0], b=site.bounds; let point: number[] | undefined;
      for (let x=b[0]+.23; x<b[2] && !point; x+=.47) for (let z=b[1]+.21; z<b[3]; z+=.47) {
        if (!inside(pad.ring,x,z) || pad.holes.some(r=>inside(r,x,z))) continue;
        if (site.owners.some(p=>inside(p.ring,x,z) && !p.holes.some(r=>inside(r,x,z)))) continue;
        point=[x,z]; break;
      }
      expect(point).toBeDefined(); const [x,z]=point!;
      expect(districtTownhallV227TerrainAt(x,z)).toBe(3); expect(districtTownhallV227TerrainAt(x,z,true)).toBe(4);
      expect(districtTownhallV227GroundAt(x,z,3)).toBe(3); expect(districtTownhallV227SolidAt(x,4.7,z)).toBe(false);
      expect(districtTownhallV227RoofAt(x,z)).toBeNull(); tested++;
    }
    expect(tested).toBe(6);
  });
  it("does not lift visitors onto roofs from below or seal source courtyards", () => {
    for (const site of nav.sites) {
      const tri=site.roofTriangles.find(([a,b,c])=>Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))>.1)!;
      const x=tri.reduce((n,p)=>n+p[0],0)/3,z=tri.reduce((n,p)=>n+p[2],0)/3;
      const y=districtTownhallV227RoofAt(x,z)!; expect(y).toBeGreaterThan(3);
      expect(districtTownhallV227GroundAt(x,z,y+.1)).toBeCloseTo(y,5); expect(districtTownhallV227GroundAt(x,z,2)).toBeNull();
      for (const p of site.owners) for (const hole of p.holes) {
        const hx=hole.reduce((n,q)=>n+q[0],0)/hole.length,hz=hole.reduce((n,q)=>n+q[1],0)/hole.length;
        if (inside(hole,hx,hz) && !site.owners.some(q=>inside(q.ring,hx,hz)&&!q.holes.some(r=>inside(r,hx,hz))))
          expect(districtTownhallV227SolidAt(hx,10,hz)).toBe(false);
      }
    }
  });
  it("retains the complete measured wings inside navigation bounds", () => {
    for (const site of nav.sites) for (const p of site.owners) for (const [x,z] of p.ring) {
      expect(x).toBeGreaterThanOrEqual(site.bounds[0]); expect(x).toBeLessThanOrEqual(site.bounds[2]);
      expect(z).toBeGreaterThanOrEqual(site.bounds[1]); expect(z).toBeLessThanOrEqual(site.bounds[3]);
    }
  });
});

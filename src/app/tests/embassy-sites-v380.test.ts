import { expect, test } from "bun:test";
import { Box3, Group, Mesh, Vector3 } from "three";
import { readFileSync } from "node:fs";
import { createExpandedCityDetails, type ExpandedLandmark } from "../src/ExpandedCityDetails";
import { attachEmbassySitesV380 } from "../src/embassySitesV380";
import { embassyHostsV380 } from "../src/embassySitesIndexV380";
import type { SurroundingChunkGeometry } from "../src/SurroundingCityGeometry";

function entry(): SurroundingChunkGeometry {
  const root = new Group();
  const origin: [number, number, number] = [512, -10, 512];
  root.position.fromArray(origin);
  return { root, origin, bufferCount: 0, geometryBytes: 0,
    nav: {groundY: 3, buildings: [], ground: [], water: []} };
}

test("each site loads one local, centimetre-accurate finish in either style", async () => {
  for (const {id, bounds} of embassyHostsV380) for (const native of [false, true]) {
    const host = entry(), signal = new AbortController().signal;
    await Promise.all([attachEmbassySitesV380(host,id,native,signal), attachEmbassySitesV380(host,id,native,signal)]);
    expect(host.root.children).toHaveLength(1);
    const mesh = host.root.getObjectByName(id) as Mesh;
    expect(mesh.isMesh).toBe(true);
    const pos = mesh.geometry.getAttribute("position"), idx = mesh.geometry.index!;
    expect(pos.array).toBeInstanceOf(Int16Array);
    expect(idx.array).toBeInstanceOf(Uint16Array);
    expect(mesh.geometry.getAttribute("color").count).toBe(pos.count);
    const size = new Box3().setFromObject(mesh);
    expect(size.min.x).toBeGreaterThanOrEqual(bounds[0]); expect(size.max.x).toBeLessThanOrEqual(bounds[2]);
    expect(size.min.z).toBeGreaterThanOrEqual(bounds[1]); expect(size.max.z).toBeLessThanOrEqual(bounds[3]);
    expect(host.geometryBytes).toBe(pos.count*9+idx.count*2);
    expect(host.nav.buildings).toHaveLength(0);
    if (native) {
      const a = new Vector3(), b = new Vector3(), c = new Vector3();
      let diagonal = 0;
      for (let i=0; i<idx.count; i+=3) {
        a.fromBufferAttribute(pos,idx.getX(i)); b.fromBufferAttribute(pos,idx.getX(i+1)); c.fromBufferAttribute(pos,idx.getX(i+2));
        b.sub(a).cross(c.sub(a));
        if (Number(b.x!==0)+Number(b.y!==0)+Number(b.z!==0)>1) diagonal++;
      }
      expect(diagonal).toBe(0);
    }
  }
  const skipped = entry();
  await attachEmbassySitesV380(skipped,"embassy380-cn",false,AbortSignal.abort());
  await attachEmbassySitesV380(skipped,"neighbour",false,new AbortController().signal);
  expect(skipped.root.children).toHaveLength(0);
});

test("the eight-part Korean embassy owns the production location, standalone keeps its fallback", () => {
  const landmarks: ExpandedLandmark[] = [{name:"Mall of Berlin", world:[650,5,1012]}];
  const countEmbassyVertices = (surveyedDprkEmbassy?: boolean) => {
    const group = createExpandedCityDetails(landmarks, {surveyedDprkEmbassy});
    const proxy = group.getObjectByName("Expanded architecture and public-realm details bodies") as Mesh;
    const pos = proxy.geometry.getAttribute("position");
    let count = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i)-946.346)<21 && Math.abs(pos.getZ(i)-832.865)<16) count++;
    }
    return count;
  };
  expect(countEmbassyVertices()).toBeGreaterThan(0);
  expect(countEmbassyVertices(true)).toBe(0);
  const viewer = readFileSync(new URL("../src/ThreeViewer.tsx",import.meta.url),"utf8");
  expect(viewer).toContain("surveyedDprkEmbassy: true");
});

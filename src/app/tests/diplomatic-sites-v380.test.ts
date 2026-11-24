import {expect, test} from "bun:test";
import {Group, Mesh} from "three";
import {attachDiplomaticSitesV380} from "../src/diplomaticSitesV380";
import type {SurroundingChunkGeometry} from "../src/SurroundingCityGeometry";
import {berlinRegionsV380} from "../src/berlinRegionsV380";
import {berlinPlaceViewsV380} from "../src/berlinPlaceViewsV380";
import {openingSiteOwnerV379} from "../src/openingSiteOwnerV379";

const hosts=berlinRegionsV380.filter(h=>h.id.startsWith("diplomatic380-"));
function entry(): SurroundingChunkGeometry {
  return {root:new Group(), origin:[0,0,0], geometryBytes:0, bufferCount:0} as SurroundingChunkGeometry;
}

test("each diplomatic tile decodes from its real lazy path in both modes and owns one bounded mesh",async()=>{
  for(const h of hosts) for(const native of [false,true]) {
    const e=entry(), signal=new AbortController().signal;
    await attachDiplomaticSitesV380(e,h.id,native,signal);
    const mesh=e.root.getObjectByName("Diplomatische Standorte und Clayallee") as Mesh;
    expect(mesh).toBeInstanceOf(Mesh);
    const geom=mesh.geometry, xyz=geom.getAttribute("position");
    expect(geom.index!.count%3).toBe(0);
    expect(xyz.count).toBe(geom.getAttribute("color").count);
    expect(geom.index!.array.every(i=>i<xyz.count)).toBe(true);
    geom.computeBoundingBox();
    const {min,max}=geom.boundingBox!, [x0,z0,x1,z1]=h.bounds;
    expect(mesh.position.x+min.x*.01).toBeGreaterThanOrEqual(x0-4);
    expect(mesh.position.z+max.z*.01).toBeLessThanOrEqual(z1+4);
    expect(mesh.position.x+max.x*.01).toBeLessThanOrEqual(x1+4);
    expect(mesh.position.z+min.z*.01).toBeGreaterThanOrEqual(z0-4);
    await attachDiplomaticSitesV380(e,h.id,native,signal);
    expect(e.root.children.length).toBe(1);
    expect(e.geometryBytes).toBeGreaterThan(0);
    geom.dispose(); mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
  }
});

test("cancelled regional geometry stays detached; both Clayallee views wait for a real regional mesh",async()=>{
  const e=entry(),c=new AbortController();c.abort();
  await expect(attachDiplomaticSitesV380(e,hosts[0].id,false,c.signal)).rejects.toThrow();
  expect(e.root.children.length).toBe(0);
  for(const [name,view] of Object.entries(berlinPlaceViewsV380).filter(([name])=>name.startsWith("Clayallee"))) {
    const [x,,z]=view.target, {required}=openingSiteOwnerV379(name,x,z);
    expect(hosts.some(h=>required.includes(h.id))).toBe(true);
    if(name.includes("Sultanats Oman")) expect(required).toContain("outer187--13_12");
  }
});

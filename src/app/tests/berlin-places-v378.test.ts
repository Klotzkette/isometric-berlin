import { expect, test } from "bun:test";
import { Mesh, InstancedMesh } from "three";
import { berlinPlaceViewsV378 } from "../src/berlinPlaceViewsV378";
import { historicArchitectureViewsV378 } from "../src/historicArchitectureViewsV378";
import { transportViewsV378 } from "../src/transportViewsV378";
import { loadBerlinPlaceViewsV378, startupFlightView, startupViewSelection } from "../src/startupView";
import { sightSlug } from "../src/viewNavigation";
import { exteriorSitesV378 } from "../src/berlinDetailSitesV378";
import { createNeukoellnStreetV378 } from "../src/neukoellnStreetV378";

test("each searchable addition opens its own recorded camera from a shared link", async () => {
  await loadBerlinPlaceViewsV378();
  const places = Object.entries(berlinPlaceViewsV378);
  expect(Object.keys(historicArchitectureViewsV378)).toHaveLength(33);
  expect(Object.keys(transportViewsV378)).toHaveLength(18);
  expect(new Set(places.map(([name]) => sightSlug(name))).size).toBe(places.length);
  for (const [name, view] of places) {
    expect(startupViewSelection([], "#landmark="+sightSlug(name))).toEqual({ name, automatic:false });
    const found = startupFlightView(name);
    expect(found.pose).toEqual({position:view.position, target:view.target});
    expect(found.fov).toBe(view.fov);
    expect(view.position.every(Number.isFinite) && view.target.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...view.target.map((n,i) => n - view.position[i]))).toBeGreaterThan(2);
  }
});

test("new streamed place owners have unique, non-empty world bounds", () => {
  expect(new Set(exteriorSitesV378.map(s => s.id)).size).toBe(exteriorSitesV378.length);
  for (const {bounds:[x0,z0,x1,z1]} of exteriorSitesV378) {
    expect(x1).toBeGreaterThan(x0);
    expect(z1).toBeGreaterThan(z0);
  }
});

test("both pavement families draw the surveyed square upwards and batch the crossing furniture", async () => {
  const {default:tile} = await import("../src/data/neukoellnStreetV378-ring182-7_6.json");
  for (const native of [false,true]) {
    const root = createNeukoellnStreetV378(tile as Parameters<typeof createNeukoellnStreetV378>[0], native, 3);
    const paving = root.children.find(o => o instanceof Mesh && !(o instanceof InstancedMesh)) as Mesh;
    const normals = paving.geometry.getAttribute("normal");
    expect(normals.count).toBeGreaterThan(100);
    for (let i=0;i<normals.count;i++) expect(normals.getY(i)).toBeGreaterThan(.99);
    const furniture = root.children.filter(o => o instanceof InstancedMesh) as InstancedMesh[];
    expect(furniture.length).toBe(native ? 1 : 2);
    expect(furniture.reduce((n,part) => n+part.count,0)).toBeGreaterThan(100);
  }
});

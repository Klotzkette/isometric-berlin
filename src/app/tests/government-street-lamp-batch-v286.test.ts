import { expect, test } from "bun:test";
import { BackSide, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from "three";
import { createGovernmentStreetLampBatchV286, GOVERNMENT_STREET_LAMP_BATCH_V286 as name } from "../src/GovernmentStreetLampBatchV286";
import { SOURCE_LAMP_RECEIPTS_V286 as receipts } from "../src/governmentStreetFurnitureV286Ownership";
import { GOVERNMENT_STREET_LAMP_ANCHORS_V286 as anchors } from "../src/governmentStreetFurnitureV286Profile";
import { createParkDetails, createParkDetailsCooperative, type ParkDetailsPayload, type StreetLight } from "../src/ParkDetails";
import { applyLightingToRoot } from "../src/ThreeViewer";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";
const original = (): StreetLight[] => JSON.parse(JSON.stringify(receipts));
const foreign: StreetLight = { id: "unrelated-near-estimated-row", position: [-48.3,4.25,4.1], height_m: 5.7, light_type: "Elektrische Beleuchtung allgemein", rotation_degrees: 27, street: "Retained source" };
const payload = (lights: StreetLight[]): ParkDetailsPayload => ({ schema_version: 7, source: { attribution: "test retained data", geometry_status: "test", name: "test" }, paths: [], playgrounds: [], trees: [], street_lights: lights });
const genericNames = ["Geoportal Berlin official public-lighting masts", "Geoportal Berlin public-lighting lamp heads", "Geoportal Berlin night-only instanced street-light cones"];
const instances = (root: ReturnType<typeof createParkDetails>, node: string) => root.getObjectByName(node) as InstancedMesh;

test("all twenty complete lamps precede exact ten-owner retirement; original data and unrelated generic buffers stay intact", () => {
  expect(anchors).toHaveLength(20); expect(receipts).toHaveLength(10);
  const lights = [...original(), foreign], before = JSON.stringify(lights);
  const fallback = createParkDetails(payload(lights), { streetFurnitureTerrainAt: () => { throw new Error("test sampler unavailable"); } });
  expect(fallback.getObjectByName(name)).toBeUndefined();
  const accepted = createParkDetails(payload(lights));
  const detailed = accepted.getObjectByName(name)!;
  expect(detailed).toBeDefined();
  expect(detailed.userData).toMatchObject({ lampCount: 20, sourceLampCount: 10, estimatedLampCount: 10, memberCount: 1200 });
  expect(detailed.userData.replacementSourceIds).toEqual(receipts.map(light => light.id));
  expect(detailed.children).toHaveLength(3);
  for (const node of genericNames.slice(0, 2)) {
    expect(instances(accepted, node).count).toBe(1);
    expect(instances(fallback, node).count).toBe(receipts.length + 1);
    const foreignOnly = createParkDetails(payload([foreign]));
    expect(instances(accepted, node).instanceMatrix.array).toEqual(instances(foreignOnly, node).instanceMatrix.array);
    expect((instances(accepted,node).material as MeshStandardMaterial).color.getHex())
      .toBe((instances(foreignOnly,node).material as MeshStandardMaterial).color.getHex());
    disposeStaticAudit(foreignOnly);
  }
  const cones = genericNames[2];
  expect(instances(accepted,cones).count).toBe(receipts.length + 1);
  expect(instances(accepted,cones).instanceMatrix.array).toEqual(instances(fallback,cones).instanceMatrix.array);
  expect(JSON.stringify(lights)).toBe(before);
  disposeStaticAudit(fallback); disposeStaticAudit(accepted);
});

test("missing, changed, duplicated or extra-key source receipts retain all original generic lamps atomically", () => {
  const variants:StreetLight[][]=[];
  for(let i=0;i<receipts.length;i++) {
    variants.push(original().filter((_,index)=>index!==i));
    const changed=original(); changed[i].position[1]+=.001; variants.push(changed);
    variants.push([...original(),original()[i]]);
  }
  const installed = original(); installed[0].installation = "light_band";
  const extra = original(); (extra[1] as any).unknown = true;
  variants.push(installed,extra);
  for (const lights of variants) {
    expect(createGovernmentStreetLampBatchV286(lights)).toBeNull();
    const root = createParkDetails(payload([...lights, foreign]));
    expect(root.getObjectByName(name)).toBeUndefined();
    const expectedPoles = lights.filter(light => light.installation !== "light_band").length + 1;
    expect(instances(root,genericNames[0]).count).toBe(expectedPoles);
    expect(instances(root,genericNames[1]).count).toBe(expectedPoles);
    disposeStaticAudit(root);
  }
});

test("official XZ/Y never follow a terrain override; all ten estimates use the supplied sampler or source interpolation", () => {
  const calls: number[][] = [];
  const root = createGovernmentStreetLampBatchV286(original(), (x,z,y) => { calls.push([x,z,y]); return 6 + x * .001 + z * .002; })!;
  expect(calls).toHaveLength(10);
  const grounds = root.userData.groundAnchors as {id:string;x:number;z:number;groundY:number;source:boolean}[];
  for (const receipt of receipts) {
    const actual = grounds.find(ground => ground.id === receipt.id)!;
    expect([actual.x,actual.groundY,actual.z]).toEqual([...receipt.position]);
    expect(actual.source).toBeTrue();
  }
  for (const estimate of grounds.filter(ground => !ground.source)) expect(estimate.groundY).toBe(6 + estimate.x*.001 + estimate.z*.002);
  const fallback = createGovernmentStreetLampBatchV286(original())!;
  const nonfinite = createGovernmentStreetLampBatchV286(original(),()=>NaN)!;
  expect(nonfinite.userData.groundAnchors).toEqual(fallback.userData.groundAnchors);
  const lows = receipts.map(light => light.position[1]);
  for (const ground of fallback.userData.groundAnchors) {
    expect(ground.groundY).toBeGreaterThanOrEqual(Math.min(...lows));
    expect(ground.groundY).toBeLessThanOrEqual(Math.max(...lows));
  }
  expect(grounds.map(ground=>[ground.id,ground.x,ground.z])).toEqual(anchors.map(anchor=>[anchor.id,anchor.x,anchor.z]));
  disposeStaticAudit(root);disposeStaticAudit(fallback);disposeStaticAudit(nonfinite);
});

test("full and touch retain the same bounded texture-free immutable three-draw replacement", () => {
  const full = createParkDetails(payload(original()), {detailProfile:"full"});
  const touch = createParkDetails(payload(original()), {detailProfile:"mobile"});
  const a = full.getObjectByName(name)!, b = touch.getObjectByName(name)!;
  expect(staticGeometryAudit(a)).toEqual(staticGeometryAudit(b));
  const audit = staticGeometryAudit(a);
  expect(audit.budget).toMatchObject({draws:3,instances:1100});
  expect(audit.budget.bytes).toBeLessThan(190_000);
  a.traverse(object => {
    expect(object.matrixAutoUpdate).toBeFalse();
    if (!(object instanceof Mesh)) return;
    expect(object.geometry.getAttribute("uv")).toBeUndefined();
    expect((object.material as MeshStandardMaterial).map).toBeNull();
    for (const attr of Object.values(object.geometry.attributes)) expect(Array.from(attr.array).every(Number.isFinite)).toBeTrue();
    if (object instanceof InstancedMesh) expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
  });
  disposeStaticAudit(full);disposeStaticAudit(touch);
});

test("only downward dish faces glow, and the existing night light switch restores day and lights-off without new lights", () => {
  const root = createGovernmentStreetLampBatchV286(original())!;
  const underside = root.getObjectByName("Government street-lamp luminous undersides only") as Mesh;
  const material = underside.material as MeshStandardMaterial;
  expect(material.side).toBe(BackSide);
  expect(material.userData.nightEmissiveIntensity).toBe(4.2);
  const normals = underside.geometry.getAttribute("normal");
  for(let i=0;i<normals.count;i++) expect(normals.getY(i)).toBeGreaterThan(0);
  for(const [mode,on,expected] of [["day",true,0],["night",true,4.2],["night",false,0],["snowstorm",true,0],["flood",true,0],["day",true,0]] as const) {
    applyLightingToRoot(root,mode,on);
    expect(material.emissiveIntensity).toBe(mode === "night" ? (on ? 4.2 : 0) : material.userData.dayEmissiveIntensity);
    if(expected===0)expect(material.emissive.getHex()).toBe(0);
    for(const child of root.children) if(child!==underside)
      expect((child as Mesh).material instanceof MeshStandardMaterial && ((child as Mesh).material as MeshStandardMaterial).userData.nightEmissive === undefined).toBeTrue();
  }
  root.traverse(object=>expect((object as any).isLight ?? false).toBeFalse());
  disposeStaticAudit(root);
});


test("tunnel filtering runs before family admission and cannot revive a removed official lamp", () => {
  const root=createParkDetails(payload(original()), { tunnel: {
    clear_height_m:5,clear_width_each_direction_m:2,
    points:[[-31.99,0,-50],[-31.99,0,900]],
    portal_approaches:{minna_cauer:{geometry_status:"test isolated source owner",label:"test",structure:"open_cut",carriageways:[{
      id:"test",lane_count:1,osm_way_ids:["test"],points:[[-31.99,4.834,-49.36],[-31.99,4.834,-29.36]],widths_m:[2,2],
    }]}}
  }});
  expect(root.userData.suppressedTunnelApproachStreetLightCount).toBe(1);
  expect(root.getObjectByName(name)).toBeUndefined();
  expect(instances(root,genericNames[0]).count).toBe(receipts.length - 1);
  disposeStaticAudit(root);
});


test("cooperative yields never publish a partial family or both old and new official posts", async () => {
  let unpublished:ReturnType<typeof createParkDetails>|undefined,observed=0;
  const lights=[...original(),foreign];
  const root=await createParkDetailsCooperative(payload(lights),{}, {
    budgetMs:0,isCancelled:()=>false,onRoot:value=>{unpublished=value;},
    yieldTask:async()=>{
      const family=unpublished?.getObjectByName(name);
      if(!family)return;
      observed++;
      expect(family.userData.lampCount).toBe(20);
      expect(family.children).toHaveLength(3);
      expect(instances(unpublished!,genericNames[0]).count).toBe(1);
      expect(instances(unpublished!,genericNames[1]).count).toBe(1);
      expect(instances(unpublished!,genericNames[2]).count).toBe(receipts.length + 1);
    },
  });
  expect(observed).toBeGreaterThan(0);
  const reference=createParkDetails(payload(lights));
  expect(staticGeometryAudit(root)).toEqual(staticGeometryAudit(reference));
  disposeStaticAudit(root);disposeStaticAudit(reference);
});

import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createHumboldthafenBuildingColumnTester, createHumboldthafenBuildingDetails, HUMBOLDTHAFEN_BUILDING_IDS, HUMBOLDTHAFEN_EINS_IDS, harbourPrismContains, planHumboldthafenBuildingDetails } from "../src/HumboldthafenBuildings";
import { createIsometricCity, type PrismPayload } from "../src/IsometricCityWorld";
import exactSubset from "../src/humboldthafenBuildingProfile.json";
import sourceJson from "../public/mesh/regierungsviertel/lod2-prisms.json";

const source = sourceJson as unknown as PrismPayload;
const payload = {...source,buildings:source.buildings.filter(p => HUMBOLDTHAFEN_BUILDING_IDS.has(p.id))};

describe("Humboldthafen building architecture", () => {
  test("cold-start subset retains all 66 complete delivered records", () => {
    expect(exactSubset.length).toBe(66);
    expect(HUMBOLDTHAFEN_EINS_IDS.size).toBe(10);
    for (const record of exactSubset) expect(record).toEqual(source.buildings.find(p => p.id === record.id));
  });

  test("replacement preserves the water, H4 courtyard and independent service buildings", () => {
    const replace = createHumboldthafenBuildingColumnTester();
    expect(replace(80,-600)).toBeFalse();
    expect(replace(134,-946)).toBeFalse();
    expect(replace(66,-914)).toBeFalse();
    expect(replace(140,-885)).toBeFalse();
    expect(replace(110,-580)).toBeTrue();
    expect(replace(70,-865)).toBeTrue();
    expect(replace(125,-864)).toBeTrue();
  });

  test("completed H3 and H4 main faces both show seven rows", () => {
    const blocks = planHumboldthafenBuildingDetails(payload.buildings);
    for (const [id,rows] of [["ee9JgIcN",7],["3zV00024",7],["nOu64nI2",2],["FxtigPVE",2]] as const) {
      const rowHeights = new Set(blocks.filter(b => b.sourceId === id && (b.role === "window" || b.role === "commercial-glazing")).map(b => b.position[1]));
      expect(rowHeights.size).toBe(rows);
    }
    expect(blocks.filter(b => b.role === "vertical-gfb-fin").length).toBeGreaterThan(700);
    expect(blocks.filter(b => b.role === "balcony-rail").length).toBeGreaterThan(40);
  });

  test("real combined drawn shells show panes to exterior rays", () => {
    const root = createIsometricCity(payload,null,null,null,{includeContext:false});
    const details = createHumboldthafenBuildingDetails(payload);root.add(details);root.updateMatrixWorld(true);
    const blocks = planHumboldthafenBuildingDetails(payload.buildings).filter(b => b.role === "window");
    let checked = 0;
    for (const id of ["eGZXjFeA","flTWxifD","ee9JgIcN","3zV00024"]) {
      const p = payload.buildings.find(p => p.id === id)!;
      const candidates = blocks.filter(b => b.sourceId === id);
      let visible = 0;
      for (const b of candidates.filter((_,i) => i % 7 === 0)) {
        const normal = new Vector3(Math.sin(b.yaw),0,Math.cos(b.yaw));
        if (harbourPrismContains(p,b.position[0]+normal.x,b.position[2]+normal.z)) normal.negate();
        const centre = new Vector3(...b.position), ray = new Raycaster(centre.clone().addScaledVector(normal,1),normal.clone().negate(),0,1.3);
        const hit = ray.intersectObject(root,true)[0];
        if (hit && hit.distance < 1.08) visible++;
      }
      expect(visible).toBeGreaterThan(5);checked += visible;
    }
    expect(checked).toBeGreaterThan(40);
  });

  test("Minecraft exact caps close block-grid boundary strips with upward facing triangles", () => {
    const root = createHumboldthafenBuildingDetails(payload,{minecraft:true});root.updateMatrixWorld(true);
    const capRoot = root.getObjectByName("Minecraft exact harbour flat roof caps");expect(capRoot).toBeDefined();
    for (const [x,z] of [[106,-579],[141,-551],[122,-533],[45.7,-861]]) {
      const hits = new Raycaster(new Vector3(x,60,z),new Vector3(0,-1,0),0,70).intersectObject(root,true);
      expect(hits.length).toBeGreaterThan(0);
    }
    const hole = new Raycaster(new Vector3(140,60,-885),new Vector3(0,-1,0),0,65).intersectObject(root,true);
    expect(hole.length).toBe(0);
  });

  test("both detail profiles stay finite and bounded without mutating source data", () => {
    const before = JSON.stringify(payload);
    for (const minecraft of [false,true]) for (const mobileLike of [false,true]) {
      const root = createHumboldthafenBuildingDetails(payload,{minecraft,mobileLike});let bytes = 0, calls = 0;
      root.traverse(o => { if (!(o instanceof Mesh)) return;calls++;
        for (const a of Object.values(o.geometry.attributes)) { bytes += a.array.byteLength;expect(Array.from(a.array).every(Number.isFinite)).toBeTrue(); }
        bytes += o.geometry.index?.array.byteLength ?? 0;
        if (o instanceof InstancedMesh) {bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();}
      });
      expect(calls).toBeLessThanOrEqual(2);expect(bytes).toBeLessThan(minecraft ? 1_050_000 : 5_000_000);
    }
    expect(JSON.stringify(payload)).toBe(before);
  });
});

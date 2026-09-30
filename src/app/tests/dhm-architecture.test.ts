import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createDhmArchitecture } from "../src/DhmArchitecture";
import { DHM_SOURCE, DHM_PARTS, DHM_PROFILE as P, DHM_PRISM_IDS,
  dhmPartBaseAt, dhmPartRoofAt, dhmSpiralTread, dhmWalkableAt, isDhmReplacementColumn } from "../src/dhmProfile";
import { bebelplatzPartContains } from "../src/bebelplatzBuildingProfile";

describe("Zeughaus and transparent Pei-Bau", () => {
  test("all source sheets, courtyard and exact former prism identities remain", () => {
    expect(DHM_PARTS.length).toBe(11);
    expect([...DHM_PRISM_IDS]).toEqual(["15971186", "30840124"]);
    expect(DHM_SOURCE.profiles.zeughaus.parts[0].holes.length).toBe(1);
    expect(isDhmReplacementColumn(1730, 127)).toBeTrue(); // separate source glass roof
    expect(isDhmReplacementColumn(1670, 80)).toBeFalse();
    expect(isDhmReplacementColumn(1785, 140)).toBeFalse();
    const canopy = DHM_SOURCE.profiles.courtyardRoof.parts[0];
    expect(dhmPartBaseAt(canopy)).toBe(25.374);
    expect(dhmWalkableAt(1730, 7, 127, canopy.id)).toBeTrue();
    expect(dhmWalkableAt(1730, 28, 127, canopy.id)).toBeFalse();
    expect(dhmPartRoofAt(canopy, 1730, 127)!).toBeGreaterThan(29);
    expect(dhmPartRoofAt(canopy, 1780, 127)).toBeNull();
  });
  test("the 108 helical treads stay inside the source glass and rise continuously", () => {
    const part = DHM_SOURCE.profiles.pei.parts.find(p => p.id === "DEBE3De1XccDSz8G")!;
    let previous = -Infinity;
    for (let i = 0; i < P.spiralTreadCount; i++) {
      const p = dhmSpiralTread((i + .5) / P.spiralTreadCount);
      expect(bebelplatzPartContains(part, p.x, p.z)).toBeTrue();
      expect(p.y).toBeGreaterThan(previous); previous = p.y;
    }
    expect(previous).toBeLessThan(P.spiralTopSourceY);
  });
  for (const minecraft of [false, true]) test(`clear stairs and bounded texture-free surfaces (${minecraft})`, () => {
    const original = JSON.stringify(DHM_SOURCE), root = createDhmArchitecture(minecraft);
    let bytes = 0, instances = 0, glass = 0, renders = 0;
    root.traverse(o => {
      if (!(o instanceof Mesh)) return;
      renders++;
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof InstancedMesh) {
        instances += o.count; bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
        expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
        if (minecraft) expect(o.geometry.attributes.position.count).toBe(24);
      }
      expect(o.matrixAutoUpdate).toBeFalse();
      for (const m of [o.userData.dayMaterial, o.userData.nightMaterial]) {
        expect(m.map).toBeNull();
        if (o.userData.transparentArchitecture) {
          expect(m.transparent).toBeTrue(); expect(m.opacity).toBeLessThan(.2); expect(m.depthWrite).toBeFalse();
        }
      }
      if (o.userData.transparentArchitecture) glass++;
    });
    expect(glass).toBe(minecraft ? 1 : 3);
    expect(renders).toBe(minecraft ? 2 : 6);
    expect(instances).toBeLessThan(18000);
    expect(bytes).toBeLessThan(1600000);
    const bounds = new Box3().setFromObject(root);
    expect(bounds.max.y).toBeLessThan(29.5);
    expect(bounds.min.x).toBeGreaterThan(1675);
    expect(bounds.max.x).toBeLessThan(1781);
    expect(JSON.stringify(DHM_SOURCE)).toBe(original);
    // Looking into the glass from the west must reach stair solids, not an opaque cylinder.
    root.updateMatrixWorld(true);
    const tread = dhmSpiralTread(.5);
    const hits = new Raycaster(new Vector3(1672, tread.y, tread.z), new Vector3(1, 0, 0)).intersectObject(root, true);
    expect(hits.some(h => h.object.name.includes("helical stair"))).toBeTrue();
    expect(hits.find(h => !(h.object as Mesh).userData.transparentArchitecture)?.object.name).toContain("helical stair");
    console.log({ minecraft, instances, bytes, renders });
  });
});

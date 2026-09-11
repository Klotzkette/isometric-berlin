import { describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import source from "../src/gendarmenmarktSource.json";
import { createGendarmenmarktShells, createMinecraftGendarmenmarktShells } from "../src/GendarmenmarktShells";
import { createGendarmenmarktArchitecture, createMinecraftGendarmenmarktArchitecture } from "../src/GendarmenmarktArchitecture";
import { GENDARMENMARKT_PROFILE as P, GENDARMENMARKT_PRISM_IDS, gendarmenmarktPartRoofAt, isGendarmenmarktReplacementColumn } from "../src/gendarmenmarktProfile";

function measure(root: Group) {
  let draws = 0, bytes = 0, instances = 0;
  const seen = new Set<BufferGeometry>();
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    draws++;
    expect(o.matrixAutoUpdate).toBeFalse();
    expect(o.userData.dayMaterial.map).toBeNull();
    expect(o.userData.nightMaterial.map).toBeNull();
    if (!seen.has(o.geometry)) {
      seen.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) {
        bytes += a.array.byteLength;
        expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof InstancedMesh) {
      instances += o.count;
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
    }
  });
  return { draws, instances, bytes };
}

describe("Gendarmenmarkt source-bound recognition", () => {
  test("retains the five complete official parents and every prior display record", () => {
    expect(Object.values(source.profiles).flatMap(p => p.parts)).toHaveLength(17);
    expect(GENDARMENMARKT_PRISM_IDS.size).toBe(9);
    expect(GENDARMENMARKT_PRISM_IDS.has("43347270")).toBeTrue();
    expect(source.profiles.germanTower.previous_display_prisms[0].h_dm).toBe(60);
    expect(source.profiles.frenchChurch.previous_display_prisms[0].h_dm).toBe(30);
    for (const p of Object.values(source.profiles)) expect(p.parts[0].ground_y_m + p.display_y_translation_m).toBeCloseTo(5.2, 3);
    expect(source.square.osm_key).toBe("way/844740667");
    expect(source.schiller.position).toEqual([1425.438, 617.052]);
  });
  test("tower rooftops follow the curved displayed crown, not the former high extrusion", () => {
    const part = source.profiles.frenchTower.parts.find(p => p.id === "DEBE3DkEireAqk2H")!;
    const [x, z] = P.frenchTower.centre;
    expect(gendarmenmarktPartRoofAt(part, x, z)).toBeCloseTo(P.frenchTower.topY - 3.65, 4);
    expect(gendarmenmarktPartRoofAt(part, x + 7.5, z)).toBeLessThan(P.frenchTower.topY - 8);
    expect(gendarmenmarktPartRoofAt(part, x + 80, z)).toBeNull();
    expect(isGendarmenmarktReplacementColumn(x, z)).toBeTrue();
    expect(isGendarmenmarktReplacementColumn(1425.438, 617.052)).toBeFalse();
  });
  test("the theatre windows remain visible before the exact source walls in both readings", () => {
    for (const minecraft of [false, true]) {
      const root = new Group(), detail = minecraft ? createMinecraftGendarmenmarktArchitecture() : createGendarmenmarktArchitecture();
      root.add(minecraft ? createMinecraftGendarmenmarktShells() : createGendarmenmarktShells(), detail);
      root.updateMatrixWorld(true);
      const [x, z] = P.konzerthaus.frontCentre, normal = new Vector3(Math.cos(P.bearingRadians), 0, -Math.sin(P.bearingRadians));
      const ray = new Raycaster(new Vector3(x, 30.4, z).addScaledVector(normal, 20), normal.clone().negate());
      const hit = ray.intersectObject(root, true)[0];
      expect(hit).toBeDefined();
      expect(hit.object.parent).toBe(detail);
    }
  });
  test("shares fixed geometry and keeps the entire ensemble below 600 KB per style", () => {
    for (const minecraft of [false, true]) {
      const root = new Group();
      const detail = minecraft ? createMinecraftGendarmenmarktArchitecture() : createGendarmenmarktArchitecture();
      root.add(minecraft ? createMinecraftGendarmenmarktShells() : createGendarmenmarktShells(), detail);
      const b = measure(root);
      expect(b.bytes).toBeLessThan(600_000);
      expect(b.draws).toBe(minecraft ? 3 : 10);
      expect(b.instances).toBeLessThan(7500);
      expect(new Box3().setFromObject(root).max.y).toBeCloseTo(68.206, 3);
      expect(detail.userData.theatrePorticoColumns).toBe(6);
      expect(detail.userData.columnsPerTowerDrum).toBe(12);
      expect(detail.userData.porticosPerTower).toBe(3);
    }
  });
  test("Minecraft retains narrow rotated cornices and cube-only architectural instances", () => {
    const root = createMinecraftGendarmenmarktArchitecture(), m = new Matrix4(), scale = new Vector3();
    root.traverse(o => {
      if (!(o instanceof InstancedMesh)) return;
      expect(o.geometry.getAttribute("position").count).toBe(24);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); scale.setFromMatrixScale(m);
        if (Math.max(scale.x, scale.z) > 40) expect(Math.min(scale.x, scale.z)).toBeLessThan(1);
      }
    });
  });
});

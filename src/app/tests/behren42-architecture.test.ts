import { describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { createBehren42Architecture, behren42FacadeOffset } from "../src/Behren42Architecture";
import { BEHREN42_PROFILE as P, BEHREN42_SOURCE as source, BEHREN42_PRISM_IDS, behren42RoofAt, isBehren42ReplacementColumn } from "../src/Behren42Profile";

function budget(root: Group) {
  let bytes = 0, draws = 0, instances = 0;
  const seen = new Set<BufferGeometry>();
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    draws++;
    expect(o.matrixAutoUpdate).toBeFalse();
    expect(o.userData.dayMaterial.map).toBeNull(); expect(o.userData.nightMaterial.map).toBeNull();
    if (!seen.has(o.geometry)) {
      seen.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) {
        bytes += a.array.byteLength; expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof InstancedMesh) { instances += o.count; bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); }
  });
  return { bytes, draws, instances };
}
describe("Humboldt Carre / Hengeler Mueller source-bound architecture", () => {
  test("keeps eight source parts and documented identity conflict without discarding rear neighbours", () => {
    expect(source.parts).toHaveLength(8);
    expect(source.parent_id).toBe("DEBE01YYK00002wR");
    expect(source.source_name_retained).toBe("Botschaft Turkmenistan");
    expect(source.osm_identity).toBe("https://www.openstreetmap.org/way/24247494");
    expect([...BEHREN42_PRISM_IDS]).toEqual(["24247494", "tFwVfxeq", "sYh7HYMU"]);
    expect(BEHREN42_PRISM_IDS.has("56467771")).toBeFalse();
    expect(isBehren42ReplacementColumn(1342.58, 352.16)).toBeTrue();
    expect(isBehren42ReplacementColumn(1343, 300)).toBeFalse();
    expect(isBehren42ReplacementColumn(1430, 355)).toBeFalse();
    expect(behren42RoofAt(1342.58, 352.16)).toBeCloseTo(36.519, 3);
  });
  test("restores full source height and keeps the same envelope through native mode", () => {
    const before = JSON.stringify(source);
    for (const native of [false, true]) {
      const root = createBehren42Architecture(native), bounds = new Box3().setFromObject(root);
      expect(bounds.min.y).toBeCloseTo(P.groundY, 4); expect(bounds.max.y).toBeCloseTo(P.topY, 4);
      expect(bounds.min.x).toBeGreaterThan(1313); expect(bounds.max.x).toBeLessThan(1417);
      expect(bounds.min.z).toBeGreaterThan(299); expect(bounds.max.z).toBeLessThan(369);
    }
    expect(JSON.stringify(source)).toBe(before);
  });
  test("actual source risalit cannot obscure street-facing panes", () => {
    const a = P.south, dx = a.end[0] - a.start[0], dz = a.end[1] - a.start[1], l = Math.hypot(dx, dz);
    const normal = new Vector3(-dz / l, 0, dx / l);
    for (const native of [false, true]) {
      const root = createBehren42Architecture(native); root.updateMatrixWorld(true);
      for (const bay of [1, 9, 12, 18, 23]) {
        const u = (bay + .5) * l / P.southBays;
        const origin = new Vector3(a.start[0] + dx * u / l, 14, a.start[1] + dz * u / l).addScaledVector(normal, 15);
        const hit = new Raycaster(origin, normal.clone().negate()).intersectObject(root, true)[0];
        expect(hit).toBeDefined();
        expect(hit.object.name).toContain(native ? "native blocks" : "source-bound facade");
        expect(hit.distance).toBeLessThan(15 - behren42FacadeOffset(a, u));
      }
    }
  });
  test("shared texture-free batches stay bounded and all native details use a cube", () => {
    const drawn = budget(createBehren42Architecture()), nativeRoot = createBehren42Architecture(true), native = budget(nativeRoot);
    expect(drawn.draws).toBe(3); expect(drawn.bytes).toBeLessThan(210_000); expect(drawn.instances).toBeGreaterThan(2000);
    expect(native.draws).toBe(1); expect(native.bytes).toBeLessThan(400_000);
    expect(nativeRoot.userData.hiddenSolidInfill).toBeFalse();
    const matrix = new Matrix4(), scale = new Vector3();
    nativeRoot.traverse(o => {
      if (!(o instanceof InstancedMesh)) return;
      expect(o.geometry.getAttribute("position").count).toBe(24);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix);
        // Long source-oriented glass bands must not turn into broad world AABBs.
        if (Math.max(scale.x, scale.z) > 50) expect(Math.min(scale.x, scale.z)).toBeLessThan(1);
      }
    });
  });
});

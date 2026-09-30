import { describe, expect, test } from "bun:test";
import { Box3, Raycaster, Vector3, type InstancedMesh } from "three";
import { createMinecraftGedaechtniskirche } from "../src/MinecraftGedaechtniskirche";
import { GEDAECHTNISKIRCHE_RUIN_PROFILE as P } from "../src/gedaechtniskircheRuinProfile";

const root = createMinecraftGedaechtniskirche();
root.updateMatrixWorld(true);
const mesh = root.children[0] as InstancedMesh;
function point(u: number, h: number, v: number): Vector3 {
  const c = Math.cos(P.rotationY),
    s = Math.sin(P.rotationY);
  return new Vector3(
    P.centerWorldM[0] + u * c + v * s,
    5.2 + h,
    P.centerWorldM[1] - u * s + v * c,
  );
}
function hits(from: Vector3, to: Vector3): number {
  const direction = to.clone().sub(from);
  return new Raycaster(
    from,
    direction.normalize(),
    0,
    from.distanceTo(to),
  ).intersectObject(root, true).length;
}

describe("Gedächtniskirche native corrected architectural shell", () => {
  test("keeps the exact modern ensemble and source-wing buffers", () => {
    const start = root.userData.ruinInstanceCount;
    expect(mesh.count - start).toBe(6_099);
    const hash = new Bun.CryptoHasher("sha256");
    hash.update(mesh.instanceMatrix.array.subarray(start * 16));
    hash.update(mesh.instanceColor!.array.subarray(start * 3));
    // Recorded independently from the complete v1.0.53 instance tail.
    expect(hash.digest("hex")).toBe(
      "67f67c91d46a5aacbf451321d67594e01db3c19c060c66d6b9bb8fd49287a00f",
    );
  });

  test("one native batch has the complete 71m asymmetric ruin silhouette", () => {
    expect(root.children).toHaveLength(1);
    expect(mesh.count).toBe(16_295);
    expect(mesh.count).toBeLessThanOrEqual(root.userData.instanceBudget);
    expect(mesh.geometry.getAttribute("color")).toBeUndefined();
    expect(mesh.material).toHaveProperty("vertexColors", false);
    expect(new Box3().setFromObject(root).max.y - 5.2).toBeCloseTo(71, 3);
    expect(P.sideTurrets[0].crossTopM).toBeGreaterThan(
      P.sideTurrets[1].roofTopM,
    );
    const [u, v] = P.sideTurrets[0].centerLocalM;
    expect(hits(point(u, 40, v - 5), point(u, 40, v + 5))).toBeGreaterThan(0);
    const [shortU, shortV] = P.sideTurrets[1].centerLocalM;
    expect(
      hits(point(shortU, 40, shortV - 3), point(shortU, 40, shortV + 3)),
    ).toBe(0);
  });

  test("lower entrance and raised rose breach are two distinct true openings", () => {
    expect(hits(point(0, 2, -11), point(0, 2, 11))).toBe(0);
    expect(hits(point(0, 16.4, -11), point(0, 16.4, 11))).toBe(0);
    expect(hits(point(0, 9.2, -11), point(0, 9.2, 11))).toBeGreaterThan(0);
    expect(hits(point(4, 2, -11), point(4, 2, 11))).toBeGreaterThan(0);
    expect(hits(point(0, 10, 11), point(0, 10, 7))).toBe(0);
    expect(hits(point(0, 10, -11), point(0, 10, -7))).toBeGreaterThan(0);
    expect(hits(point(0, 25, -11), point(0, 25, -7))).toBe(0);
    expect(hits(point(2.8, 25, -11), point(2.8, 25, -7))).toBeGreaterThan(0);
  });

  test("each octagonal bell face contains an actual opening rather than a dark painted panel", () => {
    for (let side = 0; side < 8; side += 1) {
      const a = (side * Math.PI) / 4;
      const u = side % 2 === 0 ? 1.5 : 0;
      const facet = (r: number): Vector3 =>
        point(
          u * Math.cos(a) + r * Math.sin(a),
          49,
          r * Math.cos(a) - u * Math.sin(a),
        );
      expect(hits(facet(11), facet(7))).toBe(0);
    }
    expect(hits(point(0, 49, 11), point(0, 49, 7))).toBeGreaterThan(0);
  });

  test("the copper sheath has an open top and open dormer", () => {
    expect(hits(point(0, 72, 0), point(0, 59, 0))).toBe(0);
    expect(hits(point(0, 62.2, 9), point(0, 62.2, 6))).toBe(0);
    expect(hits(point(1.5, 62.2, 9), point(1.5, 62.2, 6))).toBeGreaterThan(0);
  });

  test("all eight tapered crown corners join without vertical gaps", () => {
    for (let side = 0; side < 8; side += 1) {
      const a = ((side + 0.5) * Math.PI) / 4;
      const at = (r: number): Vector3 =>
        point(Math.sin(a) * r, 60, Math.cos(a) * r);
      expect(hits(at(11), at(6))).toBeGreaterThan(0);
    }
  });
});

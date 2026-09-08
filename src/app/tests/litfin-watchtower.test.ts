import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import {
  createLitfinWatchtower,
  createMinecraftLitfinWatchtower,
  LITFIN_WATCHTOWER_PROFILE as P,
  litfinWatchtowerBoxes,
  litfinWatchtowerSolidAt,
} from "../src/LitfinWatchtower";
function world(x: number, y: number, z: number): [number, number, number] {
  const c = Math.cos(P.rotationY),
    s = Math.sin(P.rotationY);
  return [
    P.centerWorldM[0] + c * x + s * z,
    P.centerWorldM[1] + y,
    P.centerWorldM[2] - s * x + c * z,
  ];
}
describe("Günter Litfin current watchtower", () => {
  test("retains the source height and explicitly distinguishes incompatible published widths", () => {
    expect(P.bodyHeightM).toBe(8.946);
    expect(P.lod2BuildingPartFullId).toBe("DEBE01AL1pC0000R");
    expect(P.osmKey).toBe("way/31347999");
    expect(P.publishedFootprintConflict.monumentDatabaseM).toEqual([3, 3]);
    expect(P.publishedFootprintConflict.currentLdaAccountM).toEqual([4.2, 4.2]);
    expect(P.publishedFootprintConflict.choice).toContain("non-surveyed");
    const slab = litfinWatchtowerBoxes().find((b) => b.cue === "roof-slab")!;
    expect(slab.p[1] + slab.size[1] / 2).toBeCloseTo(P.bodyHeightM, 6);
    expect(slab.size[0]).toBe(P.roofFootprintM[0]);
    expect(slab.size[2]).toBe(P.roofFootprintM[1]);
  });
  test("every glass pane remains in front of concrete after close detail fades", () => {
    for (const mobileLike of [false, true]) {
      const root = createLitfinWatchtower({ mobileLike });
      root.getObjectByName("Günter Litfin watchtower fine detail")!.visible =
        false;
      root.updateMatrixWorld(true);
      const structure = root.children[0] as InstancedMesh;
      const boxes = litfinWatchtowerBoxes(mobileLike).filter((b) => !b.fine);
      let checked = 0;
      for (const box of boxes) {
        if (box.cue !== "upper-pane") continue;
        const normal = new Vector3(
          box.size[0] < box.size[2] ? Math.sign(box.p[0]) : 0,
          0,
          box.size[2] < box.size[0] ? Math.sign(box.p[2]) : 0,
        );
        const target = new Vector3(...box.p);
        const origin = root.localToWorld(
          target.clone().addScaledVector(normal, 2),
        );
        root.localToWorld(target);
        const hit = new Raycaster(
          origin,
          target.sub(origin).normalize(),
          0,
          3,
        ).intersectObject(structure, false)[0];
        expect(hit).toBeDefined();
        expect(boxes[hit.instanceId!].cue).toBe("upper-pane");
        checked += 1;
      }
      expect(checked).toBe(16);
      let calls = 0;
      root.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        calls += 1;
        expect(o.geometry.getAttribute("uv")).toBeUndefined();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          expect((m as any).map).toBeNull();
      });
      expect(calls).toBe(2);
      expect(root.userData.schwellenraumGeschuetzt).toBe(true);
    }
  });
  test("Minecraft retains continuous roof rails with bounded cubes in both profiles", () => {
    const matrix = new Matrix4();
    let fullCount = 0;
    for (const mobileLike of [false, true]) {
      const root = createMinecraftLitfinWatchtower({ mobileLike });
      expect(root.children).toHaveLength(1);
      const mesh = root.children[0] as InstancedMesh;
      expect(mesh.count).toBeLessThan(8000);
      expect(mesh.userData.cueCounts["upper-pane"]).toBeGreaterThan(60);
      expect(mesh.userData.cueCounts["small-pane"]).toBeGreaterThan(2);
      const step = mobileLike ? 0.24 : 0.18;
      const points: number[][] = [];
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        expect(matrix.elements[0]).toBeCloseTo(step, 5);
        expect(matrix.elements[5]).toBeCloseTo(step, 5);
        expect(matrix.elements[10]).toBeCloseTo(step, 5);
        points.push([
          matrix.elements[12],
          matrix.elements[13],
          matrix.elements[14],
        ]);
      }
      const y = Math.round(9.976 / step) * step;
      const z = Math.round(1.975 / step) * step;
      for (
        let x = -Math.floor(1.85 / step);
        x <= Math.floor(1.85 / step);
        x += 1
      )
        expect(
          points.some(
            (p) =>
              Math.abs(p[0] - x * step) < 0.001 &&
              Math.abs(p[1] - y) < 0.001 &&
              Math.abs(p[2] - z) < 0.001,
          ),
        ).toBe(true);
      if (!mobileLike) fullCount = mesh.count;
      else expect(mesh.count).toBeLessThan(fullCount);
    }
  });
  test("collision preserves the core and terrace without closing the surrounding public approaches", () => {
    expect(litfinWatchtowerSolidAt(...world(0, 1.3, 0), 0.2)).toBe(true);
    expect(litfinWatchtowerSolidAt(...world(2.94, 1.6, 0), 0.15)).toBe(true);
    expect(litfinWatchtowerSolidAt(...world(2.35, 1.6, -3.55), 0.15)).toBe(
      false,
    );
    for (const p of [
      [-3.7, 0],
      [3.7, 0],
      [0, -4.1],
      [0, 3.7],
    ])
      expect(litfinWatchtowerSolidAt(...world(p[0], 1.6, p[1]), 0.3)).toBe(
        false,
      );
  });
});

import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import {
  createInvalidenfriedhofDetails,
  createMinecraftInvalidenfriedhofDetails,
  invalidenfriedhofSolidAt,
} from "../src/InvalidenfriedhofDetails";

describe("Invalidenfriedhof source corrections v1.0.9", () => {
  test("round Renaissance arches and high plinth retain real open bays", () => {
    const root = createInvalidenfriedhofDetails();
    root.updateMatrixWorld(true);
    const grave = root.getObjectByName(
      "Invalidenfriedhof Witzleben canopy exact Day protected",
    )!;
    const arches = grave.getObjectByName(
      "Witzleben four Renaissance semicircular canopy arches",
    ) as InstancedMesh;
    expect(arches.count).toBe(4);
    expect(arches.geometry.type).toBe("TorusGeometry");
    const direction = new Vector3(0, 0, -1).transformDirection(
      grave.matrixWorld,
    );
    const open = grave.localToWorld(new Vector3(0.43, 2.85, 4));
    const ray = new Raycaster(open, direction, 0, 8);
    expect(ray.intersectObject(grave, true)).toHaveLength(0);
    const plinth = grave.localToWorld(new Vector3(0.43, 1.4, 4));
    expect(
      new Raycaster(plinth, direction, 0, 8).intersectObject(grave, true)
        .length,
    ).toBeGreaterThan(0);
    const plinthCentre = grave.localToWorld(new Vector3(0.43, 1.4, 0.43));
    expect(
      invalidenfriedhofSolidAt(
        ...(plinthCentre.toArray() as [number, number, number]),
      ),
    ).toBe(true);
    const openCentre = grave.localToWorld(new Vector3(0.43, 2.85, 0.43));
    expect(
      invalidenfriedhofSolidAt(
        ...(openCentre.toArray() as [number, number, number]),
      ),
    ).toBe(false);
  });
  test("twelve folded metal bell panels align with a square frame and open undercroft", () => {
    const root = createInvalidenfriedhofDetails();
    root.updateMatrixWorld(true);
    const bell = root.getObjectByName(
      "Invalidenfriedhof Auguste-Viktoria bell tower exact Day protected",
    )!;
    const panels = bell.getObjectByName(
      "Auguste-Viktoria twelve folded silver sheet panels",
    ) as Mesh;
    expect(panels.geometry.getAttribute("position").count).toBe(144);
    const direction = new Vector3(0, 0, -1).transformDirection(
      bell.matrixWorld,
    );
    const high = bell.localToWorld(new Vector3(0, 7, 5));
    const hit = new Raycaster(high, direction, 0, 8).intersectObject(
      bell,
      true,
    )[0];
    expect(hit.object).toBe(panels);
    expect(hit.distance).toBeGreaterThan(3.2);
    expect(hit.distance).toBeLessThan(3.6);
    const low = bell.localToWorld(new Vector3(0, 1, 5));
    expect(
      new Raycaster(low, direction, 0, 10).intersectObject(bell, true),
    ).toHaveLength(0);
    const body = bell.getObjectByName("Auguste-Viktoria visible 1.60 m bell")!;
    expect(body.parent).toBe(bell); // must remain visible when near-only detail fades
  });
  test("both Minecraft profiles use thin complete wall slabs and silver casing", () => {
    for (const mobileLike of [false, true]) {
      const root = createMinecraftInvalidenfriedhofDetails({ mobileLike });
      expect(
        root.getObjectByName("Minecraft Invalidenfriedhof sheet blocks"),
      ).toBeInstanceOf(InstancedMesh);
      let blocks = 0,
        calls = 0;
      root.traverse((o) => {
        if (o instanceof InstancedMesh) {
          blocks += o.count;
          calls++;
          expect(o.geometry.type).toBe("BoxGeometry");
        }
      });
      expect(root.userData.instanceCount).toBe(blocks);
      expect(root.userData.drawCallCount).toBe(calls);
      expect(blocks).toBeLessThan(10000);
      expect(calls).toBeLessThanOrEqual(11);
    }
  });
});

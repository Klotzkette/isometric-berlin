import { describe, expect, test } from "bun:test";
import {
  Box3,
  LineSegments,
  Material,
  Mesh,
  Texture,
  type Object3D,
} from "three";

import {
  BENDLERBLOCK_PROFILE,
  BENDLERBLOCK_RENDER_BUDGET,
  createBendlerblockDetails,
} from "../src/BendlerblockDetails";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";

function geometryStats(root: Object3D): {
  drawables: number;
  renderedVertices: number;
  storedVertices: number;
} {
  let drawables = 0;
  let renderedVertices = 0;
  let storedVertices = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    drawables += 1;
    const positions = object.geometry.getAttribute("position")?.count ?? 0;
    storedVertices += positions;
    renderedVertices += object.geometry.getIndex()?.count ?? positions;
  });
  return { drawables, renderedVertices, storedVertices };
}

describe("Bendlerblock recognition detail", () => {
  test("binds the facade and memorial court to committed source anchors", () => {
    expect(BENDLERBLOCK_PROFILE.osmBuildingRelationId).toBe("7903504");
    expect(BENDLERBLOCK_PROFILE.lod2ParentBuildingId).toBe(
      "DEBE00YY2Bq0001i",
    );
    expect(BENDLERBLOCK_PROFILE.eastWing.sourcePartId).toBe(
      "DEBE3DThmdWef52O",
    );
    expect(BENDLERBLOCK_PROFILE.eastWing.floorCount).toBe(5);
    expect(BENDLERBLOCK_PROFILE.eastWing.officialHeightM).toBeCloseTo(
      27.903,
      3,
    );
    expect(BENDLERBLOCK_PROFILE.eastWing.footprintRingWorldM).toHaveLength(11);
    expect(BENDLERBLOCK_PROFILE.memorialCourt.bronzeMemorialNodeId).toBe(
      "7197479254",
    );
    expect(BENDLERBLOCK_PROFILE.memorialCourt.memorialPlaqueNodeId).toBe(
      "595339119",
    );
    expect(BENDLERBLOCK_PROFILE.geometryStatus).toContain(
      "not a component survey",
    );
    expect(BENDLERBLOCK_PROFILE.sources).toHaveLength(7);
  });

  test("keeps the full and mobile readings bounded and image-free", () => {
    const full = createBendlerblockDetails("full");
    const mobile = createBendlerblockDetails("mobile");
    const fullBounds = new Box3().setFromObject(full);
    const mobileBounds = new Box3().setFromObject(mobile);

    expect(fullBounds.min.x).toBeGreaterThan(-655);
    expect(fullBounds.max.x).toBeLessThan(-580);
    expect(fullBounds.min.z).toBeGreaterThan(1198);
    expect(fullBounds.max.z).toBeLessThan(1252);
    expect(fullBounds.max.y).toBeCloseTo(27.82, 1);
    expect(mobileBounds.min.x).toBeCloseTo(fullBounds.min.x, 2);
    expect(mobileBounds.max.z).toBeCloseTo(fullBounds.max.z, 2);

    const fullStats = geometryStats(full);
    const mobileStats = geometryStats(mobile);
    expect(fullStats.drawables).toBeLessThanOrEqual(
      BENDLERBLOCK_RENDER_BUDGET.maxDrawables,
    );
    expect(fullStats.storedVertices).toBeLessThanOrEqual(
      BENDLERBLOCK_RENDER_BUDGET.maxStoredVertices,
    );
    expect(fullStats.renderedVertices).toBeLessThanOrEqual(
      BENDLERBLOCK_RENDER_BUDGET.maxRenderedVertices,
    );
    expect(mobileStats.storedVertices).toBeLessThan(fullStats.storedVertices);

    full.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials as Material[]) {
        for (const value of Object.values(material)) {
          expect(value).not.toBeInstanceOf(Texture);
        }
      }
    });
  });

  test("ships inside the existing expanded-city batch", () => {
    const details = createExpandedCityDetails([], { detailProfile: "mobile" });
    expect(details.userData.bendlerblock).toEqual(BENDLERBLOCK_PROFILE);
    expect(details.userData.bendlerblockRenderBudget).toEqual(
      BENDLERBLOCK_RENDER_BUDGET,
    );
    expect(details.getObjectByName(BENDLERBLOCK_PROFILE.name)).toBeDefined();
  });
});

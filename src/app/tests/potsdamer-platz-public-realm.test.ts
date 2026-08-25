import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh, Object3D } from "three";

import {
  createPotsdamerPlatzPublicRealm,
  POTSDAMER_PUBLIC_REALM_PROFILE,
  POTSDAMER_PUBLIC_REALM_RENDER_BUDGET,
} from "../src/PotsdamerPlatzPublicRealm";

function renderStats(root: Object3D): {
  drawables: number;
  vertices: number;
} {
  let drawables = 0;
  let vertices = 0;
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      drawables += 1;
      vertices += object.geometry.getAttribute("position")?.count ?? 0;
    }
  });
  return { drawables, vertices };
}

describe("Potsdamer Platz public realm", () => {
  test("anchors the rebuilt pedestrian corridor to official Berlin lights", () => {
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.officialLightIds).toHaveLength(28);
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.officialLightIds[0]).toBe(92334);
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.officialLightIds.at(-1)).toBe(92361);
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.corridorCentreWorldM).toHaveLength(
      14,
    );
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.corridorSegmentCount).toBe(13);
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.geometryStatus).toContain(
      "not duplicated",
    );
    expect(POTSDAMER_PUBLIC_REALM_PROFILE.sourceUrls).toContain(
      "https://gdi.berlin.de/services/wfs/beleuchtung",
    );
  });

  test("draws a bounded, texture-free corridor in full and mobile detail", () => {
    const full = createPotsdamerPlatzPublicRealm("full");
    const mobile = createPotsdamerPlatzPublicRealm("mobile");
    expect(full.userData.keepInMinecraft).toBe(true);
    expect(full.userData.detailProfile).toBe("full");
    expect(mobile.userData.detailProfile).toBe("mobile");
    expect(
      full.getObjectByName("Potsdamer Platz public realm bodies"),
    ).toBeInstanceOf(Mesh);
    expect(
      full.getObjectByName("Potsdamer Platz public realm ink lines"),
    ).toBeInstanceOf(LineSegments);

    const bounds = new Box3().setFromObject(full);
    expect(bounds.min.x).toBeGreaterThan(60);
    expect(bounds.max.x).toBeLessThan(315);
    expect(bounds.min.z).toBeGreaterThan(1_065);
    expect(bounds.max.z).toBeLessThan(1_250);
    expect(bounds.max.y - bounds.min.y).toBeLessThan(2);

    const fullStats = renderStats(full);
    const mobileStats = renderStats(mobile);
    expect(fullStats.drawables).toBeLessThanOrEqual(
      POTSDAMER_PUBLIC_REALM_RENDER_BUDGET.maximumDrawables,
    );
    expect(fullStats.vertices).toBeGreaterThan(2_000);
    expect(fullStats.vertices).toBeLessThanOrEqual(
      POTSDAMER_PUBLIC_REALM_RENDER_BUDGET.maximumVertices,
    );
    expect(mobileStats.vertices).toBeLessThan(fullStats.vertices);
  });
});

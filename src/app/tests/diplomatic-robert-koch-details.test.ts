import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh } from "three";

import {
  createDiplomaticAndRobertKochDetails,
  DIPLOMATIC_AND_ROBERT_KOCH_PROFILE,
} from "../src/DiplomaticAndRobertKochDetails";
import { createExpandedCityDetails } from "../src/ExpandedCityDetails";

describe("diplomatic quarter and Robert-Koch-Platz", () => {
  test("keeps every recognition overlay tied to a public source anchor", () => {
    expect(DIPLOMATIC_AND_ROBERT_KOCH_PROFILE.sites.austria.osmWayId).toBe("24034597");
    expect(DIPLOMATIC_AND_ROBERT_KOCH_PROFILE.sites.greenHeadquarters.osmWayId).toBe("54672713");
    expect(DIPLOMATIC_AND_ROBERT_KOCH_PROFILE.sites.kaiserinFriedrichHaus.osmRelationId).toBe("15931988");
    expect(DIPLOMATIC_AND_ROBERT_KOCH_PROFILE.sources.length).toBeGreaterThanOrEqual(7);
  });

  test("uses one merged solid and one merged ink drawable", () => {
    const details = createDiplomaticAndRobertKochDetails("full");
    const drawables: (Mesh | LineSegments)[] = [];
    details.traverse((object) => {
      if (object instanceof Mesh || object instanceof LineSegments) drawables.push(object);
    });
    expect(drawables).toHaveLength(2);
    const bounds = new Box3().setFromObject(details);
    expect(bounds.min.x).toBeLessThan(-1490);
    expect(bounds.max.x).toBeGreaterThan(470);
    expect(bounds.min.z).toBeLessThan(-1090);
    expect(bounds.max.z).toBeGreaterThan(1165);
  });

  test("ships in the expanded city layer", () => {
    const details = createExpandedCityDetails([], { detailProfile: "mobile" });
    expect(details.userData.diplomaticAndRobertKoch).toEqual(DIPLOMATIC_AND_ROBERT_KOCH_PROFILE);
    expect(details.getObjectByName(DIPLOMATIC_AND_ROBERT_KOCH_PROFILE.name)).toBeDefined();
  });
});

import { describe, expect, test } from "bun:test";

import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import {
  SCHILLER_MONUMENT_PROFILE as P,
  SCHILLER_STEP_COURSES,
  schillerMonumentSolidAt,
  schillerMonumentWorld,
  schillerOctagonPoints,
} from "../src/schillerMonumentProfile";
import {
  PEDESTRIAN_BODY_RADIUS_M,
  pedestrianPointIsBlocked,
} from "../src/pedestrianNavigation";
import {
  createSchwellenraumMemorialProtectionIndex,
  schwellenraumProtectedMemorialAt,
  schwellenraumProtectedMemorialClearanceM,
} from "../src/schwellenraumMemorialProtection";
import type { StreetDetailsPayload } from "../src/TrafficSignals";

const street = streetDetails as unknown as StreetDetailsPayload;
const sourceEntry = street.monuments!.find((entry) => entry.osm_key === P.osmKey)!;
const index = createSchwellenraumMemorialProtectionIndex([sourceEntry]);

function solid(u: number, localY: number, v: number): boolean {
  const [x, z] = schillerMonumentWorld(u, v);
  return schillerMonumentSolidAt(x, P.worldM[1] + localY, z);
}

describe("Schiller source protection and represented pedestrian solids", () => {
  test("keeps the exact source identity and a separate quiet prop envelope", () => {
    expect(sourceEntry.schwellenraum_protected).toBeTrue();
    expect(P.worldM).toEqual([1425.438, 5.23, 617.052]);
    expect(index.sourceKeys.has(P.osmKey)).toBeTrue();
    expect(index.shapes).toHaveLength(1);
    expect(index.shapes[0].kind).toBe("schiller");
    expect(index.shapes[0].radiusM).toBe(P.protectionRadiusM);
    expect(schwellenraumProtectedMemorialClearanceM(index, P.worldM[0], P.worldM[2])).toBe(0);
    expect(schwellenraumProtectedMemorialAt(index, P.worldM[0], P.worldM[1] + 0.5, P.worldM[2])).toBeTrue();
  });

  test("follows the six finite octagonal steps instead of a filled cylinder", () => {
    expect(SCHILLER_STEP_COURSES).toHaveLength(6);
    for (const step of SCHILLER_STEP_COURSES) {
      const height = (step.bottomYLocal + step.topYLocal) / 2;
      const sideDistance = step.radiusM * Math.cos(Math.PI / 8);
      expect(solid(sideDistance - 0.02, height, 0)).toBeTrue();
      expect(solid(sideDistance + 0.02, height, 0)).toBeFalse();
    }
    expect(solid(3.65, 0.1, 0)).toBeTrue();
    expect(solid(3.8, 0.1, 0)).toBeFalse();
    expect(solid(3.65, 1.5, 0)).toBeFalse();
    expect(solid(0, -0.1, 0)).toBeFalse();
    expect(solid(0, P.totalHeightM + 0.1, 0)).toBeFalse();
  });

  test("blocks all eight authored fence sides but leaves the air above them open", () => {
    const vertices = schillerOctagonPoints(P.fenceRadiusM);
    vertices.forEach((a, side) => {
      const b = vertices[(side + 1) % vertices.length];
      const u = (a[0] + b[0]) / 2;
      const v = (a[1] + b[1]) / 2;
      const [x, z] = schillerMonumentWorld(u, v);
      expect(solid(u, 0.55, v)).toBeTrue();
      expect(schwellenraumProtectedMemorialAt(index, x, P.worldM[1] + 0.55, z)).toBeTrue();
      expect(solid(u, P.fenceHeightM + 0.05, v)).toBeFalse();
      expect(schwellenraumProtectedMemorialAt(index, x, P.worldM[1] + P.fenceHeightM + 0.05, z)).toBeFalse();
    });
  });

  test("keeps a complete walking body outside every fence side in every mode", () => {
    const sideRadius = P.fenceRadiusM * Math.cos(Math.PI / 8) +
      P.fenceHalfThicknessM + PEDESTRIAN_BODY_RADIUS_M + 0.06;
    for (const mode of ["day", "night", "snowstorm", "minecraft", "schwellenraum"]) {
      for (let side = 0; side < 8; side += 1) {
        const angle = side * Math.PI / 4;
        const [x, z] = schillerMonumentWorld(Math.cos(angle) * sideRadius, Math.sin(angle) * sideRadius);
        // These points remain inside the quiet prop envelope, but are beyond
        // the actual fence including the visitor's complete body radius.
        expect(schwellenraumProtectedMemorialClearanceM(index, x, z)).toBe(0);
        expect(pedestrianPointIsBlocked(x, z, P.worldM[1], undefined, {
          interiorSolidAt: schillerMonumentSolidAt,
          protectedVolumeAt: mode === "schwellenraum"
            ? (px, py, pz) => schwellenraumProtectedMemorialAt(index, px, py, pz)
            : undefined,
        }), `${mode}, side ${side}`).toBeFalse();
      }
    }
  });

  test("keeps the complete surrounding approach ring free", () => {
    const radius = P.fenceRadiusM + P.fenceHalfThicknessM + PEDESTRIAN_BODY_RADIUS_M + 0.1;
    for (let sample = 0; sample < 96; sample += 1) {
      const angle = sample * Math.PI / 48;
      const [x, z] = schillerMonumentWorld(Math.cos(angle) * radius, Math.sin(angle) * radius);
      expect(pedestrianPointIsBlocked(x, z, P.worldM[1], undefined, {
        interiorSolidAt: schillerMonumentSolidAt,
        protectedVolumeAt: (px, py, pz) => schwellenraumProtectedMemorialAt(index, px, py, pz),
      }), `approach sample ${sample}`).toBeFalse();
    }
  });
});

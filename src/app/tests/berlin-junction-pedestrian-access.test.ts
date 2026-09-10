import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Vector3 } from "three";

import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import {
  BERLIN_JUNCTION_PROFILE as P,
  berlinJunctionPlatePoint,
  berlinJunctionSolidAt,
  createBerlinJunction,
} from "../src/BerlinJunction";
import {
  PEDESTRIAN_BODY_RADIUS_M,
  PEDESTRIAN_EYE_HEIGHT_M,
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
const completeIndex = createSchwellenraumMemorialProtectionIndex(street.monuments);
const junctionIndex = createSchwellenraumMemorialProtectionIndex([sourceEntry]);
const halfAngle = P.plateLengthM / (2 * (P.middleRadiusM + P.topInwardDisplacementM / 2));

function worldPoint(point: Vector3): Vector3 {
  return point.applyAxisAngle(new Vector3(0, 1, 0), P.rotationY)
    .add(new Vector3(P.modelWorldM[0], P.groundYM, P.modelWorldM[1]));
}

function passagePoint(angle: number): Vector3 {
  return worldPoint(berlinJunctionPlatePoint(-1, angle, 0)
    .add(berlinJunctionPlatePoint(1, angle, 0)).multiplyScalar(0.5));
}

describe("Berlin Junction open passage in the source memorial environment", () => {
  test("retains the protected source identity without filling its intended passage", () => {
    expect(sourceEntry.schwellenraum_protected).toBeTrue();
    expect(junctionIndex.sourceKeys.has(P.osmKey)).toBeTrue();
    expect(junctionIndex.shapes[0].kind).toBe("berlin-junction");
    expect(schwellenraumProtectedMemorialAt(junctionIndex, P.modelWorldM[0], P.groundYM + 1, P.modelWorldM[1]))
      .toBeFalse();
    // Additive decorative props still keep clear of the entire artwork area,
    // so opening visitor access cannot populate the narrow passage with props.
    expect(schwellenraumProtectedMemorialClearanceM(junctionIndex, ...P.worldM)).toBe(0);
  });

  test("sweeps a complete standing body through both open ends in normal and protected modes", () => {
    // 111 samples span the full curved walk plus about 0.6 m at either end.
    // Spacing is below the runtime's 0.22 m movement collision step.
    for (const protectedMode of [false, true]) {
      for (let step = 0; step <= 110; step += 1) {
        const angle = (-halfAngle - 0.035) +
          (2 * halfAngle + 0.07) * step / 110;
        const point = passagePoint(angle);
        expect(pedestrianPointIsBlocked(point.x, point.z, point.y, undefined, {
          interiorSolidAt: berlinJunctionSolidAt,
          protectedVolumeAt: protectedMode
            ? (x, y, z) => schwellenraumProtectedMemorialAt(completeIndex, x, y, z)
            : undefined,
        }), `protected=${protectedMode}, passage step=${step}`).toBeFalse();
      }
    }
  });

  test("protects and collides with both steel plates at multiple arc positions", () => {
    for (const side of [-1, 1]) {
      for (const angle of [-halfAngle * 0.8, 0, halfAngle * 0.8]) {
        const point = worldPoint(berlinJunctionPlatePoint(side, angle, 0.9));
        expect(schwellenraumProtectedMemorialAt(junctionIndex, point.x, point.y, point.z))
          .toBeTrue();
        expect(pedestrianPointIsBlocked(point.x, point.z, P.groundYM, undefined, {
          interiorSolidAt: berlinJunctionSolidAt,
        })).toBeTrue();
      }
    }
    expect(berlinJunctionSolidAt(P.modelWorldM[0], P.groundYM + P.plateHeightM + 1, P.modelWorldM[1], PEDESTRIAN_BODY_RADIUS_M))
      .toBeFalse();
  });

  test("keeps the actual Minecraft blocks outside the complete standing passage", () => {
    const model = createBerlinJunction();
    const blocks = model.getObjectByName("Berlin Junction Minecraft steel") as InstancedMesh;
    expect(blocks).toBeInstanceOf(InstancedMesh);
    expect(blocks.count).toBeGreaterThan(0);
    blocks.geometry.computeBoundingBox();
    const transform = new Matrix4();
    const bodyHeightBoxes: Box3[] = [];
    for (let instance = 0; instance < blocks.count; instance += 1) {
      blocks.getMatrixAt(instance, transform);
      const bounds = blocks.geometry.boundingBox!.clone().applyMatrix4(transform);
      if (bounds.min.y < PEDESTRIAN_EYE_HEIGHT_M - 1e-5 && bounds.max.y > 0) {
        bodyHeightBoxes.push(bounds);
      }
    }
    expect(bodyHeightBoxes.length).toBeGreaterThan(0);
    let minimumClearanceM = Number.POSITIVE_INFINITY;
    for (let step = 0; step <= 110; step += 1) {
      const angle = (-halfAngle - 0.035) +
        (2 * halfAngle + 0.07) * step / 110;
      const local = berlinJunctionPlatePoint(-1, angle, 0)
        .add(berlinJunctionPlatePoint(1, angle, 0)).multiplyScalar(0.5);
      for (const bounds of bodyHeightBoxes) {
        const dx = Math.max(0, bounds.min.x - local.x, local.x - bounds.max.x);
        const dz = Math.max(0, bounds.min.z - local.z, local.z - bounds.max.z);
        minimumClearanceM = Math.min(minimumClearanceM, Math.hypot(dx, dz));
      }
    }
    // Independent rendered-instance bounds catch inward voxel rounding that
    // an analytic smooth-surface collision test would otherwise miss.
    expect(minimumClearanceM).toBeGreaterThan(PEDESTRIAN_BODY_RADIUS_M);
  });

  test("preserves the entire neighbouring T4 protection without closing Serra's approaches", () => {
    const southEnd = passagePoint(-halfAngle);
    expect(southEnd.x).toBeLessThan(-199.65 - PEDESTRIAN_BODY_RADIUS_M);
    expect(schwellenraumProtectedMemorialAt(completeIndex, southEnd.x, P.groundYM + 1, southEnd.z))
      .toBeFalse();
    // The correctly aligned sculpture no longer needs any exception in the
    // neighbouring T4 source rectangle, including the earlier wrong entrance.
    expect(schwellenraumProtectedMemorialAt(completeIndex, -198.104, P.groundYM + 1, 926.060))
      .toBeTrue();
    expect(schwellenraumProtectedMemorialAt(completeIndex, -190, P.groundYM + 1, 925))
      .toBeTrue();
    const t4 = street.monuments!.find((entry) => entry.osm_key === "way/303577518")!;
    expect(schwellenraumProtectedMemorialAt(completeIndex, t4.x_dm / 10, 5, t4.z_dm / 10))
      .toBeTrue();
  });
});

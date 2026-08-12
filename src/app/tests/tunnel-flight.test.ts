import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";

import scenePayload from "../public/mesh/regierungsviertel/scene.json";
import {
  RAMP_LENGTH_M,
  TUNNEL_SURFACE_Y,
  tunnelPortalDeckY,
} from "../src/TunnelPortals";
import {
  createTunnelFlightPlan,
  TUNNEL_EXTERIOR_EYE_Y,
  tunnelFlightPose,
  type TunnelFlightPlan,
} from "../src/tunnelFlight";

const TUBE_OFFSET_M = 6.1;
const ROUTE: Array<[number, number, number]> = [
  [0, -8.5, 0],
  [0, -8.5, 400],
  [0, -8.5, 1_000],
];

function planPointAt(plan: TunnelFlightPlan, distanceM: number): Vector3 {
  const distance = Math.min(plan.totalM, Math.max(0, distanceM));
  let upper = 1;
  while (
    upper < plan.cumulativeM.length &&
    plan.cumulativeM[upper] < distance
  ) {
    upper += 1;
  }
  upper = Math.min(upper, plan.cumulativeM.length - 1);
  const lower = upper - 1;
  const span = plan.cumulativeM[upper] - plan.cumulativeM[lower];
  return plan.points[lower]
    .clone()
    .lerp(
      plan.points[upper],
      span > 0 ? (distance - plan.cumulativeM[lower]) / span : 0,
    );
}

describe("guided Tiergarten tunnel flight", () => {
  test("profiles both 260 m ramps and takes the correct right-hand tube", () => {
    const southbound = createTunnelFlightPlan(
      ROUTE,
      "north-to-south",
      TUBE_OFFSET_M,
    );
    const northbound = createTunnelFlightPlan(
      ROUTE,
      "south-to-north",
      TUBE_OFFSET_M,
    );
    const rampEyeY = TUNNEL_SURFACE_Y + 1.55;
    const portalEyeY = tunnelPortalDeckY(5) + 1.55;
    const boreEyeY = ROUTE[0][1] - 0.8;

    expect(southbound.points[0].z).toBeCloseTo(-46, 6);
    expect(southbound.points.at(-1)?.z).toBeCloseTo(1_046, 6);
    expect(northbound.points[0].z).toBeCloseTo(1_046, 6);
    expect(northbound.points.at(-1)?.z).toBeCloseTo(-46, 6);
    expect(southbound.points[0].y).toBeCloseTo(TUNNEL_EXTERIOR_EYE_Y, 6);
    expect(southbound.points.at(-1)?.y).toBeCloseTo(TUNNEL_EXTERIOR_EYE_Y, 6);
    expect(southbound.points[1].y).toBeCloseTo(rampEyeY, 6);
    expect(southbound.points.at(-2)?.y).toBeCloseTo(rampEyeY, 6);

    const southEntry = planPointAt(southbound, southbound.entryPortalM);
    const southExit = planPointAt(southbound, southbound.exitPortalM);
    const northEntry = planPointAt(northbound, northbound.entryPortalM);
    const northExit = planPointAt(northbound, northbound.exitPortalM);
    expect(southEntry.x).toBeCloseTo(-TUBE_OFFSET_M, 8);
    expect(southEntry.y).toBeCloseTo(portalEyeY, 8);
    expect(southEntry.z).toBeCloseTo(RAMP_LENGTH_M, 8);
    expect(southExit.x).toBeCloseTo(-TUBE_OFFSET_M, 8);
    expect(southExit.y).toBeCloseTo(portalEyeY, 8);
    expect(southExit.z).toBeCloseTo(1_000 - RAMP_LENGTH_M, 8);
    expect(northEntry.x).toBeCloseTo(TUBE_OFFSET_M, 8);
    expect(northEntry.y).toBeCloseTo(portalEyeY, 8);
    expect(northEntry.z).toBeCloseTo(1_000 - RAMP_LENGTH_M, 8);
    expect(northExit.x).toBeCloseTo(TUBE_OFFSET_M, 8);
    expect(northExit.y).toBeCloseTo(portalEyeY, 8);
    expect(northExit.z).toBeCloseTo(RAMP_LENGTH_M, 8);
    // The 46 m transition behind each portal now contributes its real vertical
    // fall to travelled distance, so the 3D bore run is slightly longer than
    // its 480 m plan projection.
    expect(southbound.exitPortalM - southbound.entryPortalM).toBeGreaterThan(
      1_000 - RAMP_LENGTH_M * 2,
    );
    expect(southbound.exitPortalM - southbound.entryPortalM).toBeLessThan(482);
    expect(southbound.totalM).toBeCloseTo(northbound.totalM, 8);
  });

  test("matches the committed approximate route and keeps its full bore run", () => {
    const source = scenePayload.tiergartentunnel.points as Array<
      [number, number, number]
    >;
    const plan = createTunnelFlightPlan(
      source,
      "north-to-south",
      scenePayload.tiergartentunnel.clear_width_each_direction_m / 2 + 0.85,
    );
    const start = plan.points[0];
    const end = plan.points.at(-1)!;
    expect(
      Math.hypot(start.x - plan.points[1].x, start.z - plan.points[1].z),
    ).toBeCloseTo(46, 6);
    expect(
      Math.hypot(end.x - plan.points.at(-2)!.x, end.z - plan.points.at(-2)!.z),
    ).toBeCloseTo(46, 6);
    expect(start.y).toBeCloseTo(TUNNEL_EXTERIOR_EYE_Y, 6);
    expect(end.y).toBeCloseTo(TUNNEL_EXTERIOR_EYE_Y, 6);
    expect(plan.entryPortalM).toBeGreaterThan(300);
    expect(plan.entryPortalM).toBeLessThan(315);
    expect(plan.exitPortalM - plan.entryPortalM).toBeGreaterThan(1_750);
    expect(plan.totalM).toBeGreaterThan(2_390);
    expect(plan.totalM).toBeLessThan(2_405);
    expect(plan.durationMs).toBeGreaterThan(56_000);
    expect(plan.durationMs).toBeLessThan(58_000);

    const borePoints = plan.points.filter((_, index) => {
      const distance = plan.cumulativeM[index];
      return (
        distance >= plan.entryPortalM + 46 && distance <= plan.exitPortalM - 46
      );
    });
    expect(borePoints.length).toBeGreaterThan(8);
    for (const point of borePoints) {
      expect(point.y).toBeCloseTo(-9.3, 6);
    }
  });

  test("moves continuously and preserves a forward view after emergence", () => {
    const plan = createTunnelFlightPlan(ROUTE, "north-to-south");
    const frameMs = 1_000 / 60;
    let previous = tunnelFlightPose(plan, 0);
    expect(previous.target.z).toBeGreaterThan(ROUTE[0][2]);
    expect(previous.target.distanceTo(previous.position)).toBeGreaterThan(60);
    let greatestStepM = 0;
    for (
      let elapsedMs = frameMs;
      elapsedMs <= plan.durationMs;
      elapsedMs += frameMs
    ) {
      const pose = tunnelFlightPose(plan, elapsedMs);
      const stepM = pose.position.distanceTo(previous.position);
      greatestStepM = Math.max(greatestStepM, stepM);
      expect(pose.position.z).toBeGreaterThanOrEqual(previous.position.z);
      expect(pose.target.z).toBeGreaterThan(pose.position.z);
      expect(pose.progress).toBeGreaterThanOrEqual(previous.progress);
      previous = pose;
    }
    const finish = tunnelFlightPose(plan, plan.durationMs);
    expect(greatestStepM).toBeLessThan(1);
    expect(finish.done).toBe(true);
    expect(finish.target.distanceTo(finish.position)).toBeCloseTo(34, 6);
    expect(finish.target.z).toBeGreaterThan(finish.position.z);
  });

  test("rejects non-finite, coincident, and invalid-offset routes", () => {
    expect(() =>
      createTunnelFlightPlan([[0, 0, 0]], "north-to-south"),
    ).toThrow();
    expect(() =>
      createTunnelFlightPlan(
        [
          [0, 0, 0],
          [0, 1, 0],
        ],
        "north-to-south",
      ),
    ).toThrow();
    expect(() =>
      createTunnelFlightPlan(
        [
          [0, 0, 0],
          [0, 0, Number.NaN],
        ],
        "north-to-south",
      ),
    ).toThrow();
    expect(() => createTunnelFlightPlan(ROUTE, "north-to-south", 0)).toThrow();
  });
});

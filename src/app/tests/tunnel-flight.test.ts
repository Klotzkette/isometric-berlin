import { describe, expect, test } from "bun:test";

import { createTunnelFlightPlan, tunnelFlightPose } from "../src/tunnelFlight";

const ROUTE: Array<[number, number, number]> = [
  [-40, -8.5, -100],
  [-20, -8.5, 0],
  [10, -8.5, 100],
];

describe("guided Tiergarten tunnel flight", () => {
  test("extends both portals and supports both directions", () => {
    const southbound = createTunnelFlightPlan(ROUTE, "north-to-south");
    const northbound = createTunnelFlightPlan(ROUTE, "south-to-north");
    expect(southbound.points).toHaveLength(ROUTE.length + 2);
    expect(southbound.points[0].z).toBeLessThan(ROUTE[0][2]);
    expect(southbound.points.at(-1)?.z).toBeGreaterThan(ROUTE.at(-1)?.[2] ?? 0);
    expect(northbound.points[0].z).toBeGreaterThan(
      northbound.points.at(-1)?.z ?? 0,
    );
    expect(southbound.points[1].x).toBeLessThan(ROUTE[0][0]);
    expect(northbound.points[1].x).toBeGreaterThan(ROUTE.at(-1)?.[0] ?? 0);
    expect(
      Math.abs(southbound.totalM - northbound.totalM) / southbound.totalM,
    ).toBeLessThan(0.01);
  });

  test("moves a camera continuously through the bore", () => {
    const plan = createTunnelFlightPlan(ROUTE, "north-to-south");
    const start = tunnelFlightPose(plan, 0);
    const middle = tunnelFlightPose(plan, plan.durationMs / 2);
    const finish = tunnelFlightPose(plan, plan.durationMs);
    expect(start.done).toBe(false);
    expect(middle.position.z).toBeGreaterThan(start.position.z);
    expect(finish.position.z).toBeGreaterThan(middle.position.z);
    expect(finish.done).toBe(true);
    expect(middle.target.z).toBeGreaterThan(middle.position.z);
    expect(middle.position.y).toBeLessThan(ROUTE[1][1]);
  });

  test("rejects an unusable route", () => {
    expect(() =>
      createTunnelFlightPlan([[0, 0, 0]], "north-to-south"),
    ).toThrow();
  });
});

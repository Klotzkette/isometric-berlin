import { describe, expect, test } from "bun:test";

import {
  BANK_SEGMENT_M,
  densifyRing,
  sharpestTurnDeg,
  type RingPoint,
} from "../src/bankCurves";

/** A quarter of a 60 m circle, sampled as sparsely as OSM traces a bank. */
function coarseArc(steps = 12): RingPoint[] {
  const points: RingPoint[] = [];
  for (let step = 0; step < steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    points.push([60 * Math.cos(angle), 60 * Math.sin(angle)]);
  }
  return points;
}

describe("bank curve subdivision", () => {
  test("turns a faceted arc into a line the eye reads as curved", () => {
    const raw = coarseArc();
    const smooth = densifyRing(raw);
    expect(sharpestTurnDeg(raw)).toBeGreaterThan(25);
    expect(sharpestTurnDeg(smooth)).toBeLessThan(8);
    for (let index = 0; index < smooth.length; index += 1) {
      const [ax, az] = smooth[index];
      const [bx, bz] = smooth[(index + 1) % smooth.length];
      expect(Math.hypot(bx - ax, bz - az)).toBeLessThanOrEqual(
        BANK_SEGMENT_M + 1e-6,
      );
    }
  });

  test("keeps every surveyed vertex, so the water body does not move", () => {
    const raw = coarseArc();
    const smooth = densifyRing(raw);
    for (const [x, z] of raw) {
      const hit = smooth.some(
        ([sx, sz]) => Math.hypot(sx - x, sz - z) < 1e-9,
      );
      expect(hit).toBe(true);
    }
    // Radius is preserved to well under a drawn line width.
    for (const [x, z] of smooth) {
      expect(Math.abs(Math.hypot(x, z) - 60)).toBeLessThan(0.3);
    }
  });

  test("rounds sparse 45-degree natural bends but retains engineered corners", () => {
    const raw = coarseArc(8);
    const smooth = densifyRing(raw);
    expect(smooth.length).toBeGreaterThan(raw.length * 2);
    expect(sharpestTurnDeg(smooth)).toBeLessThan(15);
  });

  test("clamps tangents beside short survey edges to prevent bank overshoot", () => {
    const uneven: RingPoint[] = [
      [0, 0],
      [70, 0],
      [73, 2],
      [74, 50],
      [0, 50],
    ];
    const smooth = densifyRing(uneven);
    for (const [x, z] of smooth) {
      expect(x).toBeGreaterThanOrEqual(-0.1);
      expect(x).toBeLessThanOrEqual(74.1);
      expect(z).toBeGreaterThanOrEqual(-0.1);
      expect(z).toBeLessThanOrEqual(50.1);
    }
  });

  test("leaves built corners sharp instead of rounding a basin off", () => {
    const basin: RingPoint[] = [
      [0, 0],
      [80, 0],
      [80, 50],
      [0, 50],
    ];
    const smooth = densifyRing(basin);
    expect(smooth).toHaveLength(4);
    expect(sharpestTurnDeg(smooth)).toBeGreaterThan(80);
  });

  test("survives degenerate rings without inventing geometry", () => {
    expect(densifyRing([])).toHaveLength(0);
    expect(densifyRing([[5, 5], [5, 5], [5, 5]])).toHaveLength(1);
  });
});

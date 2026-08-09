import { describe, expect, test } from "bun:test";

import {
  HOLOCAUST_FIELD,
  HOLOCAUST_GEOMETRY_STATUS,
  HOLOCAUST_PALETTES,
  PITCH_ACROSS,
  PITCH_ALONG,
  fieldGround,
  holocaustStelePlacements,
  steleHeight,
} from "../src/holocaustField";

describe("Holocaust memorial stele field", () => {
  const placements = holocaustStelePlacements();

  test("has exactly the documented 2711 stelae", () => {
    // The field that shipped had 2710. It is the one number about this
    // memorial that everybody knows.
    expect(HOLOCAUST_FIELD.steleCount).toBe(2711);
    expect(placements).toHaveLength(2711);
  });

  test("keeps 0.95 m single-file alleys in BOTH directions", () => {
    // This is the memorial. Wide enough for one person, too narrow for
    // two — the same either way you turn. The field that shipped had
    // 1.50 m across (58 % too wide) and 0.52 m along (45 % too narrow),
    // which turns a lattice of equal corridors into rows of blocks.
    expect(PITCH_ACROSS - HOLOCAUST_FIELD.steleWidth).toBeCloseTo(0.95, 10);
    expect(PITCH_ALONG - HOLOCAUST_FIELD.steleLength).toBeCloseTo(0.95, 10);
    expect(PITCH_ACROSS).toBeCloseTo(1.9, 10);
    expect(PITCH_ALONG).toBeCloseTo(3.33, 10);
  });

  test("the lattice really sits on that pitch", () => {
    const xs = [...new Set(placements.map((stele) => stele.x))].sort(
      (left, right) => left - right,
    );
    const zs = [...new Set(placements.map((stele) => stele.z))].sort(
      (left, right) => left - right,
    );
    expect(xs.length).toBeGreaterThan(80);
    expect(zs.length).toBeGreaterThan(20);
    for (let index = 1; index < xs.length; index += 1) {
      expect(xs[index] - xs[index - 1]).toBeCloseTo(PITCH_ACROSS, 9);
    }
    for (let index = 1; index < zs.length; index += 1) {
      expect(zs[index] - zs[index - 1]).toBeCloseTo(PITCH_ALONG, 9);
    }
  });

  test("no two stelae overlap, and the gap is never walkable-wide", () => {
    // A grid this regular is easy to get subtly wrong; check the actual
    // clear gap between neighbouring bodies, not just the pitch.
    const clearAcross = PITCH_ACROSS - HOLOCAUST_FIELD.steleWidth;
    const clearAlong = PITCH_ALONG - HOLOCAUST_FIELD.steleLength;
    expect(clearAcross).toBeGreaterThan(0);
    expect(clearAlong).toBeGreaterThan(0);
    // Single file: a shoulder-width pair needs about 1.2 m.
    expect(clearAcross).toBeLessThan(1.2);
    expect(clearAlong).toBeLessThan(1.2);
  });

  test("heights stay inside the documented range and rise inward", () => {
    for (const stele of placements) {
      expect(stele.height).toBeGreaterThanOrEqual(HOLOCAUST_FIELD.minHeight);
      expect(stele.height).toBeLessThanOrEqual(HOLOCAUST_FIELD.maxHeight);
    }
    // Low at the rim, tall in the middle: that is why the memorial looks
    // almost flat from the street and closes over you once you walk in.
    const rim = placements.filter(
      (stele) => Math.abs(stele.x) > HOLOCAUST_FIELD.siteWidth * 0.44,
    );
    const middle = placements.filter(
      (stele) =>
        Math.abs(stele.x) < HOLOCAUST_FIELD.siteWidth * 0.12 &&
        Math.abs(stele.z) < HOLOCAUST_FIELD.siteDepth * 0.2,
    );
    const mean = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(rim.length).toBeGreaterThan(20);
    expect(middle.length).toBeGreaterThan(20);
    expect(mean(middle.map((stele) => stele.height))).toBeGreaterThan(
      mean(rim.map((stele) => stele.height)) + 1.5,
    );
  });

  test("every stele leans, and none leans more than two degrees", () => {
    const maxTilt = (HOLOCAUST_FIELD.maxTiltDegrees * Math.PI) / 180;
    let leaning = 0;
    for (const stele of placements) {
      expect(Math.abs(stele.tiltX)).toBeLessThanOrEqual(maxTilt);
      expect(Math.abs(stele.tiltZ)).toBeLessThanOrEqual(maxTilt);
      if (Math.abs(stele.tiltX) > 1e-4 || Math.abs(stele.tiltZ) > 1e-4) {
        leaning += 1;
      }
    }
    expect(leaning).toBeGreaterThan(placements.length * 0.98);
  });

  test("the ground rolls in waves and dips toward the middle", () => {
    expect(fieldGround(0, 0)).toBeLessThan(-1);
    const samples = [];
    for (let x = -90; x <= 90; x += 10) {
      samples.push(fieldGround(x, 0));
    }
    // It is not one funnel: walking a line across it goes down AND up.
    let ups = 0;
    let downs = 0;
    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index] > samples[index - 1]) ups += 1;
      else downs += 1;
    }
    expect(ups).toBeGreaterThan(2);
    expect(downs).toBeGreaterThan(2);
  });

  test("is deterministic — the memorial never reshuffles itself", () => {
    const again = holocaustStelePlacements();
    expect(again).toHaveLength(placements.length);
    for (let index = 0; index < placements.length; index += 1) {
      expect(again[index]).toEqual(placements[index]);
    }
    expect(steleHeight(0, 0, 5)).toBe(steleHeight(0, 0, 5));
  });

  test("says which figures are documented and which are not", () => {
    expect(HOLOCAUST_GEOMETRY_STATUS).toContain("2711");
    expect(HOLOCAUST_GEOMETRY_STATUS).toContain("0.95 m single-file alleys");
    expect(HOLOCAUST_GEOMETRY_STATUS).toContain("not published");
  });

  test("carries a palette for every mode", () => {
    for (const mode of ["day", "night", "winter"] as const) {
      const palette = HOLOCAUST_PALETTES[mode];
      for (const value of Object.values(palette)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeLessThanOrEqual(0xffffff);
      }
    }
    // The field is a grey mass: never warm, in any mode.
    for (const mode of ["day", "winter"] as const) {
      const concrete = HOLOCAUST_PALETTES[mode].concrete;
      expect((concrete >> 16) & 255).toBeLessThan(concrete & 255);
    }
  });
});

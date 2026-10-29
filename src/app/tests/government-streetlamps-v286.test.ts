import { describe, expect, test } from "bun:test";
import {
  appendGovernmentStreetLampsV286,
  GOVERNMENT_STREET_LAMP_UNDERSIDE_V286,
  GOVERNMENT_STREET_LAMPS_V286,
  type GovernmentStreetLampAnchorV286,
  type GovernmentStreetLampPartsV286,
} from "../src/GovernmentStreetLampsV286";

type Vec = [number, number, number];
type Box = { p: Vec; size: Vec; tint: number; yaw: number };
type Beam = { a: Vec; b: Vec; width: number; height: number; tint: number };
type Plate = { ring: readonly number[][]; holes: readonly number[][][]; y: (x: number, z: number) => number; tint: number };
function capture(native: boolean) {
  const boxes: Box[] = [], beams: Beam[] = [], plates: Plate[] = [];
  const parts: GovernmentStreetLampPartsV286 = {
    native,
    box(p, size, tint, yaw = 0) { boxes.push({ p, size, tint, yaw }); },
    beam(a, b, width, height, tint) { beams.push({ a, b, width, height, tint }); },
    polygon(ring, holes, y, tint) { plates.push({ ring, holes, y, tint }); },
  };
  return { parts, boxes, beams, plates };
}
const fixture: GovernmentStreetLampAnchorV286 = { id: "official-fixture", x: 27.3, z: -8.7, yawRadians: .37, heightM: 6.5 };

describe("Government-district owner-photo streetlamps", () => {
  test("retains supplied source anchors/heights, samples pole ground once and changes no caller data", () => {
    for (const native of [false, true]) {
      const out = capture(native), anchors = [Object.freeze({ ...fixture })], before = JSON.stringify(anchors), sampled: number[][] = [];
      const count = appendGovernmentStreetLampsV286(out.parts, (x, z) => { sampled.push([x, z]); return 4.37; }, anchors);
      expect(JSON.stringify(anchors)).toBe(before); expect(sampled).toEqual([[fixture.x, fixture.z]]);
      expect(count).toBe(out.boxes.length + out.beams.length + out.plates.length);
      for (const box of out.boxes) { expect(box.size.every(s => s > 0 && Number.isFinite(s))).toBeTrue(); expect(box.p.every(Number.isFinite)).toBeTrue(); }
      // The pole remains on the exact source point instead of snapping to the
      // native head lattice, with a tiny intentional buried footing overlap.
      const footing = out.boxes[0]; expect(footing.p[0]).toBe(fixture.x); expect(footing.p[2]).toBe(fixture.z);
      expect(footing.p[1] - footing.size[1] / 2).toBeCloseTo(4.37, 2);
      let top = 0;
      for (const box of out.boxes) top = Math.max(top, box.p[1] + box.size[1] / 2);
      for (const beam of out.beams) top = Math.max(top, beam.a[1] + Math.hypot(beam.width, beam.height) / 2, beam.b[1] + Math.hypot(beam.width, beam.height) / 2);
      for (const plate of out.plates) for (const p of plate.ring) top = Math.max(top, plate.y(p[0], p[1]));
      expect(top).toBeLessThanOrEqual(4.37 + fixture.heightM! + .01);
      expect(top).toBeGreaterThan(4.37 + fixture.heightM! - .08);
    }
  });

  test("the drawn dish has a thin distinct underside, a real shallow dish and a joined curved S-neck", () => {
    const out = capture(false); appendGovernmentStreetLampsV286(out.parts, () => 0, [{ id: "front-back", x: 0, z: 0, yawRadians: 0 }]);
    expect(out.boxes).toHaveLength(7); expect(out.beams).toHaveLength(48); expect(out.plates).toHaveLength(5);
    const undersides = out.plates.filter(p => p.tint === GOVERNMENT_STREET_LAMP_UNDERSIDE_V286);
    expect(undersides).toHaveLength(2); expect(out.boxes.some(b => b.tint === GOVERNMENT_STREET_LAMP_UNDERSIDE_V286)).toBeFalse();
    const annulus = out.plates.find(p => p.holes.length === 1 && p.tint !== GOVERNMENT_STREET_LAMP_UNDERSIDE_V286)!;
    const underside = undersides.find(p => p.holes.length === 1)!;
    expect(annulus.ring).toEqual(underside.ring); expect(annulus.holes).toEqual(underside.holes);
    for (const p of [...annulus.ring, ...annulus.holes[0]]) expect(annulus.y(p[0], p[1]) - underside.y(p[0], p[1])).toBeCloseTo(GOVERNMENT_STREET_LAMPS_V286.sheetThicknessM, 10);
    const p = GOVERNMENT_STREET_LAMPS_V286, left = p.headCentreXM - p.headRadiusXM, right = p.headCentreXM + p.headRadiusXM;
    const planeAtCentre = (annulus.y(left, 0) + annulus.y(right, 0)) / 2;
    expect(annulus.y(p.headCentreXM, 0) - planeAtCentre).toBeCloseTo(p.dishDepthM, 8);
    expect(annulus.y(left, 0) - annulus.y(right, 0)).toBeGreaterThan(.9);
    // Twelve collar segments precede the twelve S-neck beams. At least one
    // neck tangent bends back, while all twelve join without a floating cap.
    const neck = out.beams.slice(12, 24);
    for (let i = 1; i < neck.length; i++) expect(neck[i].a).toEqual(neck[i - 1].b);
    expect(neck.some(b => b.b[0] - b.a[0] > .01)).toBeTrue(); expect(neck.some(b => b.b[0] - b.a[0] < -.005)).toBeTrue();
    expect(neck.every(b => b.b[1] > b.a[1])).toBeTrue();
    const end = neck.at(-1)!.b; expect(end[1]).toBeCloseTo(annulus.y(end[0], end[2]), 10);
  });

  test("native forms are independently orthogonal, connected from pole to dish and contain no smooth double", () => {
    for (const yawRadians of [0, .37, 1.1, Math.PI / 2, 2.7, -1.4]) {
      const out = capture(true); appendGovernmentStreetLampsV286(out.parts, () => 0, [{ id: "native", x: 0, z: 0, yawRadians }]);
      expect(out.beams).toHaveLength(0); expect(out.plates).toHaveLength(0); expect(out.boxes.every(b => b.yaw === 0)).toBeTrue();
      expect(out.boxes.length).toBeLessThanOrEqual(80);
      const connected = new Set([0]); let changed = true;
      const touches = (a: Box, b: Box) => a.p.every((p, k) => Math.abs(p - b.p[k]) <= (a.size[k] + b.size[k]) / 2 + 1e-8);
      while (changed) { changed = false; for (let i = 0; i < out.boxes.length; i++) if (!connected.has(i) && [...connected].some(j => touches(out.boxes[i], out.boxes[j]))) { connected.add(i); changed = true; } }
      expect(connected.size).toBe(out.boxes.length);
      const undersides = out.boxes.filter(b => b.tint === GOVERNMENT_STREET_LAMP_UNDERSIDE_V286);
      expect(undersides.length).toBeGreaterThan(20);
      expect(undersides.every(b => b.p[1] > 5.5)).toBeTrue();
    }
  });

  test("invalid or excessive anchors fail before shared batches are changed; empty input has no effect", () => {
    const out = capture(false), terrain = () => 0;
    expect(appendGovernmentStreetLampsV286(out.parts, terrain, [])).toBe(0);
    for (const anchors of [[fixture, fixture], [{ ...fixture, heightM: -1 }], [{ ...fixture, x: NaN }], Array.from({ length: 65 }, (_, i) => ({ ...fixture, id: String(i) }))]) expect(() => appendGovernmentStreetLampsV286(out.parts, terrain, anchors)).toThrow();
    expect(() => appendGovernmentStreetLampsV286(out.parts, () => NaN, [fixture])).toThrow();
    expect(out.boxes).toHaveLength(0); expect(out.beams).toHaveLength(0); expect(out.plates).toHaveLength(0);
    expect(GOVERNMENT_STREET_LAMPS_V286.fullStaticDetailOnTouch).toBeTrue(); expect(GOVERNMENT_STREET_LAMPS_V286.textureFree).toBeTrue();
    expect(GOVERNMENT_STREET_LAMPS_V286.automaticOldLampRetirement).toBeFalse();
  });
});

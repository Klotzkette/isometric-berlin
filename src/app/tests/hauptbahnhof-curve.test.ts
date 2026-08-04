import { describe, expect, test } from "bun:test";
import { Box3, Group, Mesh } from "three";

import {
  createArchitecturalSignature,
  HAUPTBAHNHOF_ANCHOR_WORLD,
  HAUPTBAHNHOF_RAIL_CURVE_A,
  HAUPTBAHNHOF_RAIL_CURVE_B,
  HAUPTBAHNHOF_ROTATION_Y_DEGREES,
  type HauptbahnhofModelSignature,
} from "../src/ArchitecturalLandmarks";
import railLines from "../public/mesh/regierungsviertel/rail-lines.json";

type RailPayloadForCurve = {
  viaduct_tracks: number[][][];
};

const rail = railLines as unknown as RailPayloadForCurve;

/**
 * Converts a world-space (x, z) point into the Hauptbahnhof model's own
 * local (unrotated) frame -- the inverse of the transform `placeMetricGroup`
 * applies (translate by anchor_world, then rotate by rotation_y_degrees
 * around Y). This mirrors the exact derivation used to fit
 * HAUPTBAHNHOF_RAIL_CURVE_A/B from rail-lines.json in the first place, so
 * this test is a genuine round-trip check, not a restatement of the
 * production constants.
 */
function worldToStationLocal(x: number, z: number): { localX: number; localZ: number } {
  const [anchorX, anchorZ] = HAUPTBAHNHOF_ANCHOR_WORLD;
  const theta = (HAUPTBAHNHOF_ROTATION_Y_DEGREES * Math.PI) / 180;
  const dx = x - anchorX;
  const dz = z - anchorZ;
  const localX = dx * Math.cos(theta) - dz * Math.sin(theta);
  const localZ = dx * Math.sin(theta) + dz * Math.cos(theta);
  return { localX, localZ };
}

/** Quadratic least-squares fit z = a*x^2 + b*x + c over the given points. */
function fitQuadratic(points: Array<[number, number]>): { a: number; b: number; c: number } {
  let sx = 0;
  let sx2 = 0;
  let sx3 = 0;
  let sx4 = 0;
  let sy = 0;
  let sxy = 0;
  let sx2y = 0;
  const n = points.length;
  for (const [x, y] of points) {
    const x2 = x * x;
    sx += x;
    sx2 += x2;
    sx3 += x2 * x;
    sx4 += x2 * x2;
    sy += y;
    sxy += x * y;
    sx2y += x2 * y;
  }
  // Solve the 3x3 normal-equations system [sx4 sx3 sx2; sx3 sx2 sx; sx2 sx n] * [a;b;c] = [sx2y; sxy; sy]
  const m = [
    [sx4, sx3, sx2, sx2y],
    [sx3, sx2, sx, sxy],
    [sx2, sx, n, sy],
  ];
  for (let col = 0; col < 3; col += 1) {
    let pivotRow = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivotRow][col])) {
        pivotRow = row;
      }
    }
    [m[col], m[pivotRow]] = [m[pivotRow], m[col]];
    const pivot = m[col][col];
    for (let k = col; k < 4; k += 1) {
      m[col][k] /= pivot;
    }
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let k = col; k < 4; k += 1) {
        m[row][k] -= factor * m[col][k];
      }
    }
  }
  return { a: m[0][3], b: m[1][3], c: m[2][3] };
}

const base = {
  anchor_world: HAUPTBAHNHOF_ANCHOR_WORLD.concat([4.575]) as [number, number, number],
  focus_camera: {
    azimuth_degrees: 52,
    distance_m: 370,
    polar_degrees: 42,
    target_height_m: 21,
  },
  geometry_status: "metric test",
  landmark_name: "Berlin Hauptbahnhof",
  rotation_y_degrees: HAUPTBAHNHOF_ROTATION_Y_DEGREES,
  source_url: "https://www.deutschebahn.com/de/architektur_bahnhof-6878040",
};

const signature: HauptbahnhofModelSignature = {
  ...base,
  east_west_roof_length_m: 321,
  east_west_roof_width_m: 40,
  id: "hauptbahnhof-model",
  kind: "hauptbahnhof_model",
  north_south_hall_length_m: 180,
  north_south_hall_width_m: 42,
  office_bridge_height_m: 46,
};

describe("step-39: the east-west glass hall bends with the real rail curve", () => {
  test("HAUPTBAHNHOF_RAIL_CURVE_A/B reproduce a fresh fit from rail-lines.json", () => {
    // Re-derive the quadratic fit independently from the shipped rail
    // data and confirm it matches the frozen production constants -- if
    // rail-lines.json is ever refreshed with different real-world survey
    // data, this test will catch the drift instead of silently leaving
    // the roof curve stale.
    const track = rail.viaduct_tracks[0];
    const localPoints: Array<[number, number]> = [];
    for (const [px, pz] of track) {
      const { localX, localZ } = worldToStationLocal(px / 10, pz / 10);
      if (localX >= -280 && localX <= 220) {
        localPoints.push([localX, localZ]);
      }
    }
    expect(localPoints.length).toBeGreaterThan(6);
    const fit = fitQuadratic(localPoints);
    expect(fit.a).toBeCloseTo(HAUPTBAHNHOF_RAIL_CURVE_A, 3);
    expect(fit.b).toBeCloseTo(HAUPTBAHNHOF_RAIL_CURVE_B, 1);
    // Residual sanity: the real curve should be close to this quadratic,
    // not just coincidentally similar in its leading coefficients.
    let maxResidual = 0;
    for (const [x, z] of localPoints) {
      const predicted = fit.a * x * x + fit.b * x + fit.c;
      maxResidual = Math.max(maxResidual, Math.abs(predicted - z));
    }
    expect(maxResidual).toBeLessThan(3);
  });

  test("the built east-west roof centreline tracks the real rail curve shape within tolerance", () => {
    const station = createArchitecturalSignature(signature) as Group;
    expect(station).not.toBeNull();
    const roof = station.getObjectByName(
      "Hauptbahnhof 431 m east-west glass roof",
    ) as Mesh;
    expect(roof).toBeDefined();
    const geometry = roof.geometry;
    const position = geometry.getAttribute("position");
    expect(position).toBeDefined();

    // The barrel roof's cross-section apex (angle = pi/2, i.e. the top of
    // the arch) sits at local z = the lateral bow at that x, with y at
    // its maximum for that row. Rather than re-deriving row/column
    // layout, sample the mesh's actual vertices directly: for a set of
    // x-slices, take the mean z of vertices whose x is within a small
    // window -- this recovers the centreline offset at that x regardless
    // of the exact cross-section parameterisation.
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < position.count; i += 1) {
      xs.push(position.getX(i));
      zs.push(position.getZ(i));
    }
    const sampleXs = [-260, -200, -140, -70, 0, 70, 140];
    for (const targetLocalX of sampleXs) {
      // Roof mesh-local x is offset by trackCentreX from the group's own
      // local x (see addBarrelRoof's offsetLongitudinal). trackCentreX =
      // (trackWestX + trackEastX) / 2 for a 321 m shed + 110 m west
      // approach: trackWestX = -(321/2+110) = -270.5, trackEastX = 160.5,
      // so trackCentreX = -55.
      const trackCentreX = -55;
      const meshLocalX = targetLocalX - trackCentreX;
      let sumZ = 0;
      let count = 0;
      for (let i = 0; i < xs.length; i += 1) {
        if (Math.abs(xs[i] - meshLocalX) < 5) {
          sumZ += zs[i];
          count += 1;
        }
      }
      expect(count).toBeGreaterThan(0);
      const meanZAtCrossSection = sumZ / count;
      // The cross-section itself spans -width/2..width/2 in z around the
      // bow offset, so its mean across a full semicircle sample is not
      // exactly the bow (cos-weighted arc), but restricting to vertices
      // near the crown (largest |z| deviation only samples the two
      // extreme rim vertices) is unreliable for a coarse sample; instead
      // directly test the extremes: the minimum and maximum z at this
      // x-slice should straddle the expected bow offset symmetrically.
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < xs.length; i += 1) {
        if (Math.abs(xs[i] - meshLocalX) < 5) {
          minZ = Math.min(minZ, zs[i]);
          maxZ = Math.max(maxZ, zs[i]);
        }
      }
      const midpointZ = (minZ + maxZ) / 2;
      const expectedBow =
        HAUPTBAHNHOF_RAIL_CURVE_A * targetLocalX * targetLocalX +
        HAUPTBAHNHOF_RAIL_CURVE_B * targetLocalX -
        (HAUPTBAHNHOF_RAIL_CURVE_A * 0 + HAUPTBAHNHOF_RAIL_CURVE_B * 0);
      expect(Math.abs(midpointZ - expectedBow)).toBeLessThan(2);
      expect(meanZAtCrossSection).toBeDefined();
    }
  });

  test("the roof genuinely curves -- it is not a straight tube (regression guard)", () => {
    const station = createArchitecturalSignature(signature) as Group;
    const roof = station!.getObjectByName(
      "Hauptbahnhof 431 m east-west glass roof",
    ) as Mesh;
    const position = roof.geometry.getAttribute("position");
    const xs: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < position.count; i += 1) {
      xs.push(position.getX(i));
      zs.push(position.getZ(i));
    }
    const crownZAt = (meshLocalX: number): number => {
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < xs.length; i += 1) {
        if (Math.abs(xs[i] - meshLocalX) < 5) {
          minZ = Math.min(minZ, zs[i]);
          maxZ = Math.max(maxZ, zs[i]);
        }
      }
      return (minZ + maxZ) / 2;
    };
    const west = crownZAt(-270 - -55);
    const centre = crownZAt(0 - -55);
    const east = crownZAt(160 - -55);
    // A straight tube would have west === centre === east (all zero
    // offset). The real curve displaces the east end by tens of metres
    // relative to the centre -- assert a real, substantial bend exists.
    expect(Math.abs(east - centre)).toBeGreaterThan(20);
    expect(Math.abs(west - centre)).toBeGreaterThan(1);
  });

  test("the north-south hall stays straight, square across the curved east-west hall", () => {
    const station = createArchitecturalSignature(signature) as Group;
    const hall = station!.getObjectByName(
      "Hauptbahnhof 180 m north-south hall",
    ) as Mesh;
    expect(hall).toBeDefined();
    const position = hall.geometry.getAttribute("position");
    // For a straight barrel (alongX = false), every vertex's x should
    // equal its cross-section's cos(angle)*(width/2) term with zero bow
    // -- i.e. the vertex x range at any given z-slice should be
    // symmetric around 0, and the hall's overall bounding-box centre x
    // should be 0 (no lateral drift end to end).
    const bounds = new Box3().setFromObject(hall);
    const centreX = (bounds.max.x + bounds.min.x) / 2;
    expect(Math.abs(centreX)).toBeLessThan(0.5);
  });
});

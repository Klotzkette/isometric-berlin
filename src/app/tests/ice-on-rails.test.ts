import { describe, expect, test } from "bun:test";
import { Box3, Group } from "three";

import { createIceOnRails } from "../src/ArchitecturalLandmarks";
import railLines from "../public/mesh/regierungsviertel/rail-lines.json";

type RailPayloadForIce = {
  deck_top_y_m: number;
  rail_top_over_deck_m: number;
  viaduct_tracks: number[][][];
};

const rail = railLines as unknown as RailPayloadForIce;

/** Shortest distance from a world (x, z) point to a rail polyline, in metres. */
function distanceToNearestTrack(x: number, z: number, tracks: number[][][]): number {
  let best = Infinity;
  for (const track of tracks) {
    const points = track.map(([px, pz]) => [px / 10, pz / 10]);
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x0, z0] = points[index];
      const [x1, z1] = points[index + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const segLenSq = dx * dx + dz * dz;
      const t =
        segLenSq > 0
          ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / segLenSq))
          : 0;
      const cx = x0 + t * dx;
      const cz = z0 + t * dz;
      const distance = Math.hypot(x - cx, z - cz);
      if (distance < best) {
        best = distance;
      }
    }
  }
  return best;
}

/**
 * The tangent direction of the nearest point on the nearest rail polyline,
 * as a world-space heading in radians (atan2 form matching the ICE's own
 * rotationY convention: atan2(-dz, dx)).
 */
function nearestTrackHeading(x: number, z: number, tracks: number[][][]): number {
  let best = Infinity;
  let heading = 0;
  for (const track of tracks) {
    const points = track.map(([px, pz]) => [px / 10, pz / 10]);
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x0, z0] = points[index];
      const [x1, z1] = points[index + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const segLenSq = dx * dx + dz * dz;
      const t =
        segLenSq > 0
          ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / segLenSq))
          : 0;
      const cx = x0 + t * dx;
      const cz = z0 + t * dz;
      const distance = Math.hypot(x - cx, z - cz);
      if (distance < best) {
        best = distance;
        heading = Math.atan2(-dz, dx);
      }
    }
  }
  return heading;
}

function angleDeltaDegrees(a: number, b: number): number {
  let delta = ((a - b + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (delta < -Math.PI) {
    delta += 2 * Math.PI;
  }
  return Math.abs((delta * 180) / Math.PI);
}

describe("step-37: the stationary ICE rides a real rail centreline", () => {
  test("createIceOnRails returns a group placed on the OSM viaduct_tracks corridor", () => {
    const ice = createIceOnRails(rail);
    expect(ice).toBeInstanceOf(Group);
  });

  test("the ICE's position is within 2 m of a rail-lines.json polyline", () => {
    const ice = createIceOnRails(rail)!;
    const distance = distanceToNearestTrack(
      ice.position.x,
      ice.position.z,
      rail.viaduct_tracks,
    );
    expect(distance).toBeLessThan(2);
  });

  test("the ICE's yaw is tangential to the nearest rail polyline", () => {
    const ice = createIceOnRails(rail)!;
    const trackHeading = nearestTrackHeading(
      ice.position.x,
      ice.position.z,
      rail.viaduct_tracks,
    );
    // Tangential in either direction along the line counts (a train can
    // face either way along its track), so compare against both headings.
    const forward = angleDeltaDegrees(ice.rotation.y, trackHeading);
    const reverse = angleDeltaDegrees(ice.rotation.y, trackHeading + Math.PI);
    expect(Math.min(forward, reverse)).toBeLessThan(5);
  });

  test("the ICE sits at the real rail-top height, not the station's local deck", () => {
    const ice = createIceOnRails(rail)!;
    const expectedRailTop = rail.deck_top_y_m + rail.rail_top_over_deck_m;
    const bounds = new Box3().setFromObject(ice);
    // The wheel centreline (bottom of the drawn body) should sit close to
    // the corridor's rail top, not floating or buried.
    expect(bounds.min.y).toBeGreaterThan(expectedRailTop - 1);
    expect(bounds.min.y).toBeLessThan(expectedRailTop + 2);
  });

  test("the ICE is nowhere near open water (regression guard for the old stub track)", () => {
    // The old placement sat directly on a Humboldthafen/Spree water
    // polygon. There is no water payload wired into this test, but the
    // rail-corridor distance check above is the direct contract; this
    // test instead pins the ICE to the station's immediate neighbourhood
    // so a future regression that points it back out over open water
    // (far from the anchor) fails here even without loading the surface
    // payload.
    const ice = createIceOnRails(rail)!;
    const anchorWorld = { x: -119.936, z: -683.307 };
    const distanceFromAnchor = Math.hypot(
      ice.position.x - anchorWorld.x,
      ice.position.z - anchorWorld.z,
    );
    expect(distanceFromAnchor).toBeLessThan(120);
  });
});

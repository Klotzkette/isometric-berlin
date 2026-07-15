import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";

import {
  REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
  flyCameraInViewPlane,
  screenRelativeFlightDelta,
} from "../src/cameraNavigation";

describe("screen-relative 3D flight", () => {
  test("moves camera and target together without changing the view orbit", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(120, 90, 150);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const beforeOffset = camera.position.clone().sub(target);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);

    const applied = flyCameraInViewPlane(camera, target, 1, 0);

    expect(applied.length()).toBeGreaterThan(3);
    expect(applied.dot(right)).toBeGreaterThan(0);
    expect(camera.position.clone().sub(target).distanceTo(beforeOffset)).toBeLessThan(
      1e-8,
    );
  });

  test("keeps underside flight aligned to the visible screen plane", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(80, -90, 140);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const delta = screenRelativeFlightDelta(camera, target, 0, 1);

    expect(delta.dot(up)).toBeGreaterThan(0);
  });

  test("clamps repeated flight to the Regierungsviertel working volume", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.clone();
    camera.position.copy(target).add(new Vector3(100, 100, 100));
    camera.lookAt(target);
    camera.updateMatrixWorld();

    flyCameraInViewPlane(camera, target, 1, 1);

    expect(target.x).toBeLessThanOrEqual(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.x);
    expect(target.y).toBeLessThanOrEqual(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.y);
    expect(target.z).toBeLessThanOrEqual(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.z);
  });
});

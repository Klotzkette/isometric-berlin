import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";

import {
  REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
  captureCameraPose,
  flyCameraAlongViewHeading,
  flyCameraInViewPlane,
  screenRelativeFlightDelta,
  stabilizeCameraRig,
  viewHeadingFlightDelta,
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

describe("view-heading 3D flight", () => {
  test("flies forward on the horizontal camera heading without zooming", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(0, 100, 200);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const beforeOffset = camera.position.clone().sub(target);

    const applied = flyCameraAlongViewHeading(camera, target, 0, 1);

    expect(applied.z).toBeLessThan(0);
    expect(Math.abs(applied.y)).toBeLessThan(1e-8);
    expect(camera.position.clone().sub(target).distanceTo(beforeOffset)).toBeLessThan(
      1e-8,
    );
  });

  test("keeps strafe perpendicular to forward travel", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(80, 60, 140);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const forward = viewHeadingFlightDelta(camera, target, 0, 1);
    const strafe = viewHeadingFlightDelta(camera, target, 1, 0);

    expect(Math.abs(forward.dot(strafe))).toBeLessThan(1e-8);
    expect(strafe.y).toBe(0);
  });
});

describe("two-finger swipe moves the avatar (view-relative)", () => {
  // v0.5.4: a two-finger swipe on the 3D view must MOVE the camera/avatar in
  // the swiped, view-relative direction — never rotate or tilt. The pointer
  // handler feeds the swipe center delta into flyCameraAlongViewHeading as
  // (deltaX / 72, -deltaY / 72). These tests pin that mapping: swipe right
  // strafes right, swipe up travels forward, and the orbit is untouched.
  const swipeMove = (
    camera: PerspectiveCamera,
    target: Vector3,
    deltaX: number,
    deltaY: number,
  ) => flyCameraAlongViewHeading(camera, target, deltaX / 72, -deltaY / 72);

  test("swipe right strafes right without rotating the view", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(0, 100, 200);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const beforeOffset = camera.position.clone().sub(target);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);

    const applied = swipeMove(camera, target, 120, 0);

    expect(applied.dot(right)).toBeGreaterThan(0);
    expect(camera.position.clone().sub(target).distanceTo(beforeOffset)).toBeLessThan(
      1e-8,
    );
  });

  test("swipe up travels forward along the heading, not vertically", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(0, 100, 200);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    const applied = swipeMove(camera, target, 0, -120);

    expect(applied.z).toBeLessThan(0);
    expect(Math.abs(applied.y)).toBeLessThan(1e-8);
  });
});

describe("forgiving 3D camera bounds", () => {
  test("restores the last safe pose after invalid camera input", () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3(1, 2, 3);
    camera.position.set(30, 40, 50);
    const safe = captureCameraPose(camera, target);
    camera.position.x = Number.NaN;

    const result = stabilizeCameraRig(camera, target, safe, 20, 2000);

    expect(result.recovered).toBe(true);
    expect(camera.position.toArray()).toEqual([30, 40, 50]);
    expect(target.toArray()).toEqual([1, 2, 3]);
  });

  test("clamps a lost pan target without changing the view offset", () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3(5000, 1000, -5000);
    camera.position.copy(target).add(new Vector3(100, 80, 120));
    const offset = camera.position.clone().sub(target);
    const safe = captureCameraPose(camera, target);

    const result = stabilizeCameraRig(camera, target, safe, 20, 2000);

    expect(result.changed).toBe(true);
    expect(target.x).toBeLessThanOrEqual(850);
    expect(target.y).toBeLessThanOrEqual(280);
    expect(target.z).toBeGreaterThanOrEqual(-1100);
    expect(camera.position.clone().sub(target).toArray()).toEqual(offset.toArray());
  });
});

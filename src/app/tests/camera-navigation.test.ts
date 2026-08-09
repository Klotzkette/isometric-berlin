import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";

import {
  REGIERUNGSVIERTEL_FLIGHT_BOUNDS,
  TWO_FINGER_DECISION_TRAVEL_PX,
  cameraPoseDeltaM,
  captureCameraPose,
  classifyTwoFingerGesture,
  flyCameraAlongViewHeading,
  flyCameraInViewPlane,
  screenRelativeFlightDelta,
  stabilizeCameraRig,
  twoFingerPanFlight,
  viewHeadingFlightDelta,
  zoomCameraAtScreenPoint,
} from "../src/cameraNavigation";

describe("screen-relative 3D flight", () => {
  test("measures the larger camera or target drift for damping rest detection", () => {
    const camera = new PerspectiveCamera();
    const target = new Vector3(1, 2, 3);
    camera.position.set(10, 20, 30);
    const before = captureCameraPose(camera, target);
    camera.position.x += 0.0004;
    target.z += 0.0008;

    expect(cameraPoseDeltaM(before, captureCameraPose(camera, target))).toBeCloseTo(
      0.0008,
      9,
    );
  });

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

describe("two-finger swipe pans with direct manipulation", () => {
  // Post-v0.5.6 fix: a two-finger swipe must make the content follow the
  // fingers (finger right → content right, finger down → content down), like
  // Google Maps. Since translating the rig by D moves the content by −D, the
  // rig has to travel OPPOSITE the finger delta. twoFingerPanFlight owns the
  // sign contract; the pointer handler feeds its output into
  // flyCameraAlongViewHeading. Previously the mapping was (deltaX/72,
  // −deltaY/72), which moved the rig WITH the fingers and inverted the
  // content — the "immer noch konträr" report.
  const swipeMove = (
    camera: PerspectiveCamera,
    target: Vector3,
    deltaX: number,
    deltaY: number,
  ) => {
    const { strafe, forward } = twoFingerPanFlight(deltaX, deltaY);
    return flyCameraAlongViewHeading(camera, target, strafe, forward);
  };

  test("sign contract: rig travels opposite the finger delta", () => {
    // Finger +x ⇒ strafe negative (rig left ⇒ content right).
    expect(twoFingerPanFlight(120, 0).strafe).toBeLessThan(0);
    // Finger +y (downward) ⇒ forward positive (rig into scene ⇒ content down).
    expect(twoFingerPanFlight(0, 120).forward).toBeGreaterThan(0);
    // Opposite finger directions flip the signs symmetrically.
    expect(twoFingerPanFlight(-120, 0).strafe).toBeGreaterThan(0);
    expect(twoFingerPanFlight(0, -120).forward).toBeLessThan(0);
    const idle = twoFingerPanFlight(0, 0);
    expect(idle.forward).toBe(0);
    expect(Math.abs(idle.strafe)).toBe(0);
  });

  test("swipe right moves the content right (rig strafes left)", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(0, 100, 200);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const beforeOffset = camera.position.clone().sub(target);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);

    const applied = swipeMove(camera, target, 120, 0);

    // Content follows the finger ⇒ rig moves the other way along screen right.
    expect(applied.dot(right)).toBeLessThan(0);
    expect(camera.position.clone().sub(target).distanceTo(beforeOffset)).toBeLessThan(
      1e-8,
    );
  });

  test("swipe down moves the content down (rig travels into the scene)", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(0, 100, 200);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    // heading here is (0,0,-1); into-scene travel has negative z.
    const applied = swipeMove(camera, target, 0, 120);

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
    expect(target.x).toBeLessThanOrEqual(
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.x,
    );
    expect(target.y).toBeLessThanOrEqual(
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.y,
    );
    expect(target.z).toBeGreaterThanOrEqual(
      REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.z,
    );
    expect(camera.position.clone().sub(target).toArray()).toEqual(offset.toArray());
  });
});

describe("cursor-anchored zoom", () => {
  const pointOnTargetPlane = (
    camera: PerspectiveCamera,
    target: Vector3,
    ndcX: number,
    ndcY: number,
  ): Vector3 => {
    camera.updateMatrixWorld();
    const direction = new Vector3(ndcX, ndcY, 0.5)
      .unproject(camera)
      .sub(camera.position);
    const scale = (target.y - camera.position.y) / direction.y;
    return camera.position.clone().add(direction.multiplyScalar(scale));
  };

  test("pinch keeps the world point below the finger midpoint fixed", () => {
    const camera = new PerspectiveCamera(39, 16 / 9, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(160, 140, 260);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const ndcX = 0.42;
    const ndcY = -0.24;
    const before = pointOnTargetPlane(camera, target, ndcX, ndcY);
    const distanceBefore = camera.position.distanceTo(target);

    const result = zoomCameraAtScreenPoint(
      camera,
      target,
      ndcX,
      ndcY,
      1.35,
      30,
      2600,
    );

    const after = pointOnTargetPlane(camera, target, ndcX, ndcY);
    expect(result.anchored).toBe(true);
    expect(result.distance).toBeLessThan(distanceBefore);
    expect(after.distanceTo(before)).toBeLessThan(1e-6);
  });

  test("rejects an invalid zoom factor without moving the rig", () => {
    const camera = new PerspectiveCamera(39, 1, 0.25, 6_000);
    const target = new Vector3(0, 0, 0);
    camera.position.set(0, 100, 200);
    camera.lookAt(target);
    const before = camera.position.clone();

    const result = zoomCameraAtScreenPoint(
      camera,
      target,
      0,
      0,
      0,
      30,
      2600,
    );

    expect(result.anchored).toBe(false);
    expect(camera.position.toArray()).toEqual(before.toArray());
  });

  // v0.39.0: "Wenn man pincht, geht es nach vorne statt näher ran." A pinch
  // must be a pure distance change anchored under the fingers — never a
  // ground dolly along the view heading, and never a tilt.
  test("pinch changes distance without rotating or tilting the rig", () => {
    const camera = new PerspectiveCamera(39, 16 / 9, 0.25, 6_000);
    const target = new Vector3(-110, 12, -165);
    camera.position.set(430, 442, 485);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const directionBefore = camera.position.clone().sub(target).normalize();
    const distanceBefore = camera.position.distanceTo(target);

    // Fingers spreading apart (factor > 1) must come CLOSER, not further.
    const zoomIn = zoomCameraAtScreenPoint(
      camera,
      target,
      0.18,
      -0.1,
      1.25,
      30,
      2_600,
    );
    expect(zoomIn.distance).toBeLessThan(distanceBefore);
    // The orbit direction is untouched: same azimuth, same polar angle.
    const directionAfter = camera.position.clone().sub(target).normalize();
    expect(directionAfter.distanceTo(directionBefore)).toBeLessThan(1e-6);

    // Fingers pinching together (factor < 1) must pull back out again.
    const zoomOut = zoomCameraAtScreenPoint(
      camera,
      target,
      0.18,
      -0.1,
      0.8,
      30,
      2_600,
    );
    expect(zoomOut.distance).toBeGreaterThan(zoomIn.distance);
    expect(
      camera.position
        .clone()
        .sub(target)
        .normalize()
        .distanceTo(directionBefore),
    ).toBeLessThan(1e-6);
  });
});

describe("two-finger gesture classification", () => {
  // v0.39.0 fix for "wenn man pincht, geht es nach vorne statt näher ran":
  // the old hysteresis let pan claim the gesture after 10 px of midpoint
  // drift while a pinch needed 18 px of spread change plus 1.1× dominance,
  // so an asymmetric phone pinch locked to "pan" and the pan branch flew the
  // rig along the ground heading instead of zooming.
  test("nothing is decided inside the dead zone", () => {
    expect(classifyTwoFingerGesture({ panTravel: 0, pinchTravel: 0 })).toBe(
      "undecided",
    );
    expect(
      classifyTwoFingerGesture({
        panTravel: TWO_FINGER_DECISION_TRAVEL_PX - 0.5,
        pinchTravel: TWO_FINGER_DECISION_TRAVEL_PX - 0.5,
      }),
    ).toBe("undecided");
  });

  test("an asymmetric pinch classifies as zoom, never as pan", () => {
    // The characteristic phone pinch: fingers converge 40 px while the
    // midpoint drifts 30 px because one finger carries more of the motion.
    // The old thresholds returned "pan" for exactly this input.
    expect(classifyTwoFingerGesture({ panTravel: 30, pinchTravel: 40 })).toBe(
      "zoom",
    );
    // Even a heavily drifting pinch stays a zoom.
    expect(classifyTwoFingerGesture({ panTravel: 60, pinchTravel: 34 })).toBe(
      "zoom",
    );
    // A pinch that only just clears the dead zone still wins.
    expect(
      classifyTwoFingerGesture({
        panTravel: 4,
        pinchTravel: TWO_FINGER_DECISION_TRAVEL_PX,
      }),
    ).toBe("zoom");
  });

  test("a flat two-finger swipe still classifies as pan", () => {
    // A deliberate swipe holds the finger spread nearly constant.
    expect(classifyTwoFingerGesture({ panTravel: 40, pinchTravel: 2 })).toBe(
      "pan",
    );
    expect(classifyTwoFingerGesture({ panTravel: 120, pinchTravel: 12 })).toBe(
      "pan",
    );
  });

  test("survives non-finite travel without claiming a gesture", () => {
    expect(
      classifyTwoFingerGesture({ panTravel: Number.NaN, pinchTravel: 0 }),
    ).toBe("undecided");
    expect(
      classifyTwoFingerGesture({
        panTravel: Number.NaN,
        pinchTravel: Number.NaN,
      }),
    ).toBe("undecided");
  });
});

describe("pan momentum glide", () => {
  test("decays exponentially and snaps to rest below the threshold", async () => {
    const { decayPanMomentum, PAN_MOMENTUM_REST_PX_PER_S } = await import(
      "../src/cameraNavigation"
    );
    let velocity = { x: 900, y: -600 };
    const speeds: number[] = [Math.hypot(velocity.x, velocity.y)];
    for (let step = 0; step < 60; step += 1) {
      velocity = decayPanMomentum(velocity, 1 / 60);
      speeds.push(Math.hypot(velocity.x, velocity.y));
    }
    // Monotonically easing out…
    for (let index = 1; index < speeds.length; index += 1) {
      expect(speeds[index]).toBeLessThanOrEqual(speeds[index - 1]);
    }
    // …and fully at rest within a second, never creeping forever.
    expect(speeds[speeds.length - 1]).toBe(0);
    expect(PAN_MOMENTUM_REST_PX_PER_S).toBeGreaterThan(0);
    // Direction is preserved while gliding.
    const one = decayPanMomentum({ x: 900, y: -600 }, 1 / 60);
    expect(one.x).toBeGreaterThan(0);
    expect(one.y).toBeLessThan(0);
    expect(one.x / -one.y).toBeCloseTo(1.5, 5);
  });
});

describe("visible-radius contract (+100 m per areal run)", () => {
  test("flight bounds are exactly the published envelope", async () => {
    const { VISIBLE_RADIUS_M, extrapolatedEnvelopeBounds } = await import(
      "../src/worldEnvelope"
    );
    const { REGIERUNGSVIERTEL_FLIGHT_BOUNDS } = await import(
      "../src/cameraNavigation"
    );
    expect(VISIBLE_RADIUS_M).toBe(5230);
    // The camera may travel to the paper edge but not past it, so the two
    // constants can never drift apart in a later areal run.
    const envelope = extrapolatedEnvelopeBounds();
    expect(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.x).toBe(envelope.minX);
    expect(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.x).toBe(envelope.maxX);
    expect(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.min.z).toBe(envelope.minZ);
    expect(REGIERUNGSVIERTEL_FLIGHT_BOUNDS.max.z).toBe(envelope.maxZ);
  });
});

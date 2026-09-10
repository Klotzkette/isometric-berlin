import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Scene, Vector3 } from "three";

import {
  captureNavigationSnapshot,
  restoreNavigationSnapshot,
  type NavigationSnapshot,
} from "../src/navigationContinuity";
import type { PedestrianState } from "../src/pedestrianNavigation";

type NavigationRuntime = Parameters<typeof captureNavigationSnapshot>[0];

function runtimeFixture(): NavigationRuntime {
  const camera = new PerspectiveCamera(37.25, 1.6, 0.125, 14_321.75);
  camera.position.set(-945.125, 82.625, 1337.875);
  const target = new Vector3(-899.375, 5.875, 1189.625);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return {
    camera,
    controls: {
      target,
      minDistance: 0.625,
      maxDistance: 12_456.75,
      enabled: true,
    },
    focusedCameraFov: 37.25,
    underside: true,
    pedestrian: {
      enabled: false,
      requested: false,
      state: null,
      savedPose: null,
      savedFov: 16,
      savedNear: 0.25,
      savedUnderside: false,
      recoveryHistory: { checkpoints: [], lastRecorded: null },
      cameraDirty: false,
    },
  };
}

function walkingState(overrides: Partial<PedestrianState> = {}): PedestrianState {
  return {
    grounded: true,
    groundLayer: "surface",
    groundY: 5.1875,
    insideTunnel: false,
    jumpOffset: 0,
    pitch: -0.1375,
    verticalVelocity: 0,
    x: -672.03125,
    yaw: 1.3125,
    z: 967.09375,
    ...overrides,
  };
}

function walkingRuntime(state: PedestrianState): NavigationRuntime {
  const runtime = runtimeFixture();
  const earlier = walkingState({ x: state.x - 8, z: state.z - 3 });
  const latest = walkingState({ x: state.x - 4, z: state.z - 1 });
  runtime.pedestrian = {
    enabled: true,
    requested: true,
    state,
    savedPose: {
      position: new Vector3(-702.75, 95.125, 1051.375),
      target: new Vector3(-685.625, 4.25, 934.5),
    },
    savedFov: 39.125,
    savedNear: 0.0625,
    savedUnderside: true,
    recoveryHistory: { checkpoints: [earlier, latest], lastRecorded: latest },
    cameraDirty: false,
  };
  runtime.camera.fov = 66;
  runtime.camera.near = 0.045;
  runtime.camera.position.set(state.x, state.groundY + state.jumpOffset + 1.8, state.z);
  runtime.controls.target.copy(runtime.camera.position).addScaledVector(
    new Vector3(
      Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * Math.cos(state.pitch),
    ),
    7,
  );
  runtime.controls.enabled = false;
  runtime.camera.lookAt(runtime.controls.target);
  runtime.camera.updateProjectionMatrix();
  runtime.camera.updateMatrixWorld();
  return runtime;
}

function serializedCopy(snapshot: NavigationSnapshot): NavigationSnapshot {
  return JSON.parse(JSON.stringify(snapshot));
}

function assertOnlyPlainData(value: unknown): void {
  if (value === null) return;
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (typeof value === "boolean" || typeof value === "string") return;
  if (Array.isArray(value)) {
    for (const entry of value) assertOnlyPlainData(entry);
    return;
  }
  expect(typeof value).toBe("object");
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  for (const entry of Object.values(value as Record<string, unknown>)) {
    assertOnlyPlainData(entry);
  }
}

describe("navigation continuity across renderer replacement", () => {
  test("restores the complete free camera without changing the new viewport aspect", () => {
    const source = runtimeFixture();
    const snapshot = captureNavigationSnapshot(source);
    expect(snapshot.pose).toEqual({
      position: [-945.125, 82.625, 1337.875],
      target: [-899.375, 5.875, 1189.625],
    });
    const destination = walkingRuntime(walkingState());
    destination.camera.aspect = 390 / 844;
    destination.camera.position.set(0, 0, 0);
    destination.controls.target.set(1, 2, 3);
    destination.controls.minDistance = 12;
    destination.controls.maxDistance = 500;
    destination.focusedCameraFov = null;
    destination.underside = false;

    restoreNavigationSnapshot(destination, serializedCopy(snapshot));

    expect(captureNavigationSnapshot(destination)).toEqual(snapshot);
    expect(destination.camera.fov).toBe(37.25);
    expect(destination.camera.near).toBe(0.125);
    expect(destination.camera.far).toBe(14_321.75);
    expect(destination.camera.aspect).toBe(390 / 844);
    expect(destination.controls.minDistance).toBe(0.625);
    expect(destination.controls.maxDistance).toBe(12_456.75);
    expect(destination.focusedCameraFov).toBe(37.25);
    expect(destination.underside).toBe(true);
    expect(destination.controls.enabled).toBe(true);
    expect(destination.pedestrian.cameraDirty).toBe(false);
    expect(destination.pedestrian.state).toBeNull();
    expect(destination.pedestrian.savedPose).toBeNull();

    const expectedProjection = new PerspectiveCamera(37.25, 390 / 844, 0.125, 14_321.75);
    expect(destination.camera.projectionMatrix.elements).toEqual(expectedProjection.projectionMatrix.elements);
    expect(destination.camera.projectionMatrixInverse.elements).toEqual(expectedProjection.projectionMatrixInverse.elements);
    expect(destination.camera.getWorldPosition(new Vector3()).toArray()).toEqual(snapshot.pose.position);
    const direction = new Vector3().fromArray(snapshot.pose.target)
      .sub(new Vector3().fromArray(snapshot.pose.position)).normalize();
    expect(destination.camera.getWorldDirection(new Vector3()).distanceTo(direction)).toBeLessThan(1e-12);
  });

  for (const [name, state] of [
    ["walking on the surface", walkingState()],
    ["ascending in a jump", walkingState({ grounded: false, jumpOffset: 3.8125, verticalVelocity: 11.4375 })],
    ["descending inside a tunnel", walkingState({
      grounded: false, groundLayer: "tunnel", groundY: -13.625,
      insideTunnel: true, jumpOffset: 0.8125, verticalVelocity: -4.5625,
    })],
  ] as const) {
    test(`keeps every pedestrian value while ${name}, including its return flight and escape trail`, () => {
      const source = walkingRuntime(state);
      const snapshot = captureNavigationSnapshot(source);
      const destination = runtimeFixture();
      restoreNavigationSnapshot(destination, serializedCopy(snapshot));

      expect(destination.pedestrian.state).toEqual(state);
      expect(destination.pedestrian.state).not.toBe(source.pedestrian.state);
      expect(destination.pedestrian.enabled).toBe(true);
      expect(destination.pedestrian.requested).toBe(true);
      expect(destination.pedestrian.cameraDirty).toBe(true);
      expect(destination.controls.enabled).toBe(false);
      expect(destination.pedestrian.savedFov).toBe(39.125);
      expect(destination.pedestrian.savedNear).toBe(0.0625);
      expect(destination.pedestrian.savedUnderside).toBe(true);
      expect(destination.pedestrian.savedPose?.position).toBeInstanceOf(Vector3);
      expect(destination.pedestrian.savedPose?.target).toBeInstanceOf(Vector3);
      expect(destination.pedestrian.savedPose?.position.toArray()).toEqual([-702.75, 95.125, 1051.375]);
      expect(destination.pedestrian.savedPose?.target.toArray()).toEqual([-685.625, 4.25, 934.5]);
      expect(destination.pedestrian.recoveryHistory).toEqual(source.pedestrian.recoveryHistory);
      expect(destination.pedestrian.recoveryHistory.checkpoints).toHaveLength(2);
      expect(captureNavigationSnapshot(destination)).toEqual(snapshot);
    });
  }

  test("preserves a requested walk that is still waiting for its environment", () => {
    const source = runtimeFixture();
    source.pedestrian.requested = true;
    const destination = walkingRuntime(walkingState());
    restoreNavigationSnapshot(destination, captureNavigationSnapshot(source));
    expect(destination.pedestrian.requested).toBe(true);
    expect(destination.pedestrian.enabled).toBe(false);
    expect(destination.pedestrian.state).toBeNull();
    expect(destination.pedestrian.savedPose).toBeNull();
    expect(destination.pedestrian.recoveryHistory).toEqual({ checkpoints: [], lastRecorded: null });
    expect(destination.controls.enabled).toBe(true);
  });

  test("does not share mutable positions, pedestrian state or trail entries between any lifecycle", () => {
    const source = walkingRuntime(walkingState());
    const snapshot = captureNavigationSnapshot(source);
    const original = serializedCopy(snapshot);
    source.camera.position.x += 20;
    source.controls.target.z += 40;
    source.pedestrian.state!.x += 60;
    source.pedestrian.savedPose!.position.y += 80;
    source.pedestrian.savedPose!.target.z += 100;
    source.pedestrian.recoveryHistory.checkpoints[0]!.x += 120;
    source.pedestrian.recoveryHistory.lastRecorded!.z += 140;
    source.pedestrian.recoveryHistory.checkpoints.push(walkingState({ x: 900 }));
    expect(snapshot).toEqual(original);

    const destination = runtimeFixture();
    const otherDestination = runtimeFixture();
    restoreNavigationSnapshot(destination, snapshot);
    restoreNavigationSnapshot(otherDestination, snapshot);
    snapshot.pose.position[0] += 1;
    snapshot.pose.target[1] += 2;
    snapshot.pedestrian.state!.pitch += 3;
    snapshot.pedestrian.savedPose!.position[2] += 4;
    snapshot.pedestrian.savedPose!.target[0] += 5;
    snapshot.pedestrian.recoveryHistory.checkpoints[0]!.z += 6;
    snapshot.pedestrian.recoveryHistory.lastRecorded!.x += 7;
    expect(captureNavigationSnapshot(destination)).toEqual(original);
    expect(captureNavigationSnapshot(otherDestination)).toEqual(original);

    destination.camera.position.y -= 20;
    destination.controls.target.x -= 40;
    destination.pedestrian.state!.jumpOffset += 2;
    destination.pedestrian.savedPose!.position.z -= 60;
    destination.pedestrian.savedPose!.target.x -= 80;
    destination.pedestrian.recoveryHistory.checkpoints[0]!.yaw += 1;
    destination.pedestrian.recoveryHistory.lastRecorded!.groundY += 2;
    destination.pedestrian.recoveryHistory.checkpoints.length = 0;
    expect(captureNavigationSnapshot(otherDestination)).toEqual(original);
  });

  test("captures only plain data and never carries a disposed scene or collision environment into its replacement", () => {
    const source = Object.assign(walkingRuntime(walkingState()), {
      scene: new Scene(),
      world: { geometry: new Float32Array(4096), dispose: () => {} },
    });
    const sourceEnvironment = { groundAt: () => 4.25, obstacles: new Map() };
    Object.assign(source.pedestrian, { environment: sourceEnvironment });
    source.scene.userData.runtime = source;
    const snapshot = captureNavigationSnapshot(source);
    assertOnlyPlainData(snapshot);
    expect(serializedCopy(snapshot)).toEqual(snapshot);
    expect(snapshot).not.toHaveProperty("scene");
    expect(snapshot).not.toHaveProperty("world");
    expect(snapshot.pedestrian).not.toHaveProperty("environment");

    const scene = new Scene();
    const environment = { groundAt: () => 8.5, obstacles: new Map() };
    const destination = Object.assign(runtimeFixture(), { scene });
    const pedestrian = Object.assign(destination.pedestrian, { environment });
    restoreNavigationSnapshot(destination, snapshot);
    expect(destination.scene).toBe(scene);
    expect(destination.pedestrian).toBe(pedestrian);
    expect(pedestrian.environment).toBe(environment);
    expect(pedestrian.environment).not.toBe(sourceEnvironment);
    expect(captureNavigationSnapshot(destination)).toEqual(snapshot);
  });

  test("repeated renderer replacements cannot accumulate movement or cancel a jump", () => {
    const original = captureNavigationSnapshot(walkingRuntime(walkingState({
      grounded: false, jumpOffset: 2.1875, verticalVelocity: 17.3125,
    })));
    let snapshot = original;
    for (let recreation = 0; recreation < 20; recreation += 1) {
      const destination = runtimeFixture();
      restoreNavigationSnapshot(destination, snapshot);
      snapshot = captureNavigationSnapshot(destination);
      expect(snapshot).toEqual(original);
    }
  });
});

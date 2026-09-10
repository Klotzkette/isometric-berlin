import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import {
  constrainSurfaceCameraRig, surfaceOrbitMaxPolar, SURFACE_MAX_POLAR,
} from "../src/surfaceCameraNavigation";

describe("surface flight camera", () => {
  test("looking past the horizon cannot flip a close orbit under the city", () => {
    const camera = new PerspectiveCamera(16);
    const target = new Vector3(15, 12, -100);
    camera.position.set(15, -15, 80);
    const distance = camera.position.distanceTo(target);
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeTrue();
    expect(camera.position.distanceTo(target)).toBeCloseTo(distance, 9);
    expect(camera.position.y).toBeGreaterThan(target.y);
    const direction = new Vector3(); camera.getWorldDirection(direction);
    expect(direction.y).toBeLessThan(0);
    expect(surfaceOrbitMaxPolar(camera, target)).toBe(SURFACE_MAX_POLAR);
  });

  test("downward flight and changing terrain preserve the view and full horizontal movement", () => {
    const camera = new PerspectiveCamera(16);
    const target = new Vector3(0, 3, -30);
    camera.position.set(0, 12, 0);
    const offset = camera.position.clone().sub(target);
    for (let frame = 0; frame < 180; frame++) {
      const movement = new Vector3(2, -2, -5);
      target.add(movement); camera.position.add(movement);
      const ground = camera.position.x < 180 ? 4 : 12;
      constrainSurfaceCameraRig(camera, target, () => ground);
      expect(camera.position.y).toBeGreaterThanOrEqual(ground + 1.2 - 1e-9);
      expect(camera.position.clone().sub(target).distanceTo(offset)).toBeLessThan(1e-9);
    }
    expect(camera.position.x).toBe(360);
    expect(camera.position.z).toBe(-900);
  });

  test("normal framing is exactly unchanged and does not allocate replacement poses", () => {
    const camera = new PerspectiveCamera(16);
    camera.position.set(40, 80, 130);
    const target = new Vector3(0, 8, 0);
    const before = camera.position.clone();
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeFalse();
    expect(camera.position.equals(before)).toBeTrue();
  });

  test("a wide side inspection and actual tunnel travel retain their below-ground poses", () => {
    const camera = new PerspectiveCamera(16);
    const target = new Vector3(0, -8, 0);
    camera.position.set(0, -1400, 1700);
    const overview = camera.position.clone();
    expect(surfaceOrbitMaxPolar(camera, target)).toBeGreaterThan(Math.PI / 2);
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeFalse();
    expect(camera.position.equals(overview)).toBeTrue();
    camera.position.set(0, -5, 20);
    const tunnelPose = camera.position.clone();
    expect(constrainSurfaceCameraRig(camera, target, () => 4, true)).toBeFalse();
    expect(camera.position.equals(tunnelPose)).toBeTrue();
    // Zooming back into the ordinary city restores the surface guard.
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeTrue();
    expect(camera.position.y).toBeGreaterThanOrEqual(5.2);
  });

  test("missing terrain never permits a close camera below the model plane", () => {
    const camera = new PerspectiveCamera(39);
    camera.position.set(0, -4, 20);
    const target = new Vector3(0, -12, 0);
    constrainSurfaceCameraRig(camera, target, () => null);
    expect(camera.position.y).toBeCloseTo(1.2);
  });

  test("floating-point noise at a stopped boundary does not request endless new frames", () => {
    const camera = new PerspectiveCamera(16);
    const target = new Vector3(0, -15, 0);
    camera.position.set(0, -20, 100);
    constrainSurfaceCameraRig(camera, target, () => 4);
    // OrbitControls' spherical round-trip can land a few ulps below a limit.
    camera.position.y -= 1e-12;
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeFalse();
  });
});

import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import {
  constrainSurfaceCameraRig, surfaceOrbitMaxPolar, surfaceUndersideView, SURFACE_MAX_POLAR,
} from "../src/surfaceCameraNavigation";

describe("surface flight camera", () => {
  test("wide downward flight stays above terrain without slowing horizontal travel", () => {
    const camera = new PerspectiveCamera(39);
    camera.position.set(400, 20, 500);
    const target = new Vector3(400, -85, -1500);
    const offset = camera.position.clone().sub(target);
    for (let frame = 0; frame < 240; frame++) {
      const delta = new Vector3(4, -3, -6);
      camera.position.add(delta); target.add(delta);
      constrainSurfaceCameraRig(camera, target, () => 4);
      expect(camera.position.y).toBeGreaterThanOrEqual(5.2 - 1e-9);
      expect(camera.position.clone().sub(target).distanceTo(offset)).toBeLessThan(1e-8);
      expect(surfaceUndersideView(camera, target, () => 4)).toBeFalse();
    }
    expect(camera.position.x).toBe(1360);
    expect(camera.position.z).toBe(-940);
  });

  test("looking up above ground never hides the city, including wide views", () => {
    const camera = new PerspectiveCamera(39);
    const target = new Vector3(400, 180, -1500);
    camera.position.set(400, 100, 500);
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeFalse();
    expect(surfaceUndersideView(camera, target, () => 4)).toBeFalse();
    camera.position.y = -100;
    expect(surfaceUndersideView(camera, target, () => 4)).toBeTrue();
    expect(constrainSurfaceCameraRig(camera, target, () => 4)).toBeTrue();
    expect(camera.position.y).toBeCloseTo(5.2);
    expect(surfaceUndersideView(camera, target, () => 4)).toBeFalse();
  });

  test("ground-plane noise does not alternate the whole city and cutaway", () => {
    const camera = new PerspectiveCamera(39);
    const target = new Vector3(0, 10, -2000);
    camera.position.set(0, -1, 0);
    let underneath = surfaceUndersideView(camera, target, () => 0);
    expect(underneath).toBeTrue();
    for (const y of [-0.1, 0.1, -0.05, 0.05]) {
      camera.position.y = y;
      underneath = surfaceUndersideView(camera, target, () => 0, underneath);
      expect(underneath).toBeTrue();
    }
    camera.position.y = 0.2;
    underneath = surfaceUndersideView(camera, target, () => 0, underneath);
    expect(underneath).toBeFalse();
    camera.position.y = -0.2;
    expect(surfaceUndersideView(camera, target, () => 0, underneath)).toBeFalse();
  });

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
    expect(constrainSurfaceCameraRig(camera, target, () => 4, false, new Vector3(), true)).toBeFalse();
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

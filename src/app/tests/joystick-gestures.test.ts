import { describe, expect, test } from "bun:test";

import {
  JOYSTICK_DOUBLE_TAP_MS,
  JOYSTICK_DOUBLE_TAP_RADIUS_PX,
  JOYSTICK_TAP_MAX_DURATION_MS,
  JOYSTICK_TAP_MAX_TRAVEL_PX,
  beginJoystickTap,
  cancelJoystickTap,
  createJoystickTapState,
  endJoystickTap,
  moveJoystickTap,
  type JoystickPointerSample,
  type JoystickTapState,
} from "../src/joystickGestures";
import {
  PEDESTRIAN_GRAVITY_MPS2,
  PEDESTRIAN_IDLE_INPUT,
  PEDESTRIAN_JUMP_APEX_M,
  createPedestrianState,
  jumpPedestrian,
  stepPedestrian,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";

const appSource = await Bun.file(new URL("../src/App.tsx", import.meta.url)).text();

function pointer(
  at: number,
  overrides: Partial<JoystickPointerSample> = {},
): JoystickPointerSample {
  return {
    at, button: 0, isPrimary: true, pointerId: 1,
    pointerType: "touch", x: 80, y: 660, ...overrides,
  };
}

function tap(
  state: JoystickTapState,
  start: number,
  overrides: Partial<JoystickPointerSample> = {},
  duration = 70,
): boolean {
  beginJoystickTap(state, pointer(start, overrides));
  return endJoystickTap(state, pointer(start + duration, overrides));
}

describe("orange walking joystick double tap", () => {
  test("App relinquishes the pointer before normal capture loss and preserves completed taps", () => {
    const joystick = appSource.slice(
      appSource.indexOf("function FlightJoystick("),
      appSource.indexOf("function HoldControlButton("),
    );
    const release = joystick.slice(
      joystick.indexOf("const release = useCallback("),
      joystick.indexOf("useEffect(", joystick.indexOf("const release = useCallback(")),
    );
    expect(release).toContain("pointerIdRef.current = null");
    expect(release).not.toContain("cancelJoystickTap");
    const pointerUp = joystick.slice(
      joystick.indexOf("onPointerUp="), joystick.indexOf("onPointerCancel="),
    );
    expect(pointerUp.indexOf("endJoystickTap(")).toBeLessThan(pointerUp.indexOf("release();"));
    expect(pointerUp.indexOf("release();")).toBeLessThan(pointerUp.indexOf("releasePointerCapture("));
    expect(pointerUp).toContain("if (doubleTap) onTouchDoubleTap?.()");
    const lostCapture = joystick.slice(joystick.indexOf("onLostPointerCapture="));
    expect(lostCapture).toContain("if (pointerIdRef.current === event.pointerId)");
    expect(lostCapture).toContain("cancelJoystickTap(tapStateRef.current)");
  });

  test("recognises touch and pen only after the second completed nearby tap", () => {
    for (const pointerType of ["touch", "pen"]) {
      const state = createJoystickTapState();
      expect(tap(state, 1000, { pointerType })).toBeFalse();
      beginJoystickTap(state, pointer(1200, { pointerType, pointerId: 2, x: 85 }));
      expect(state.previous).not.toBeNull();
      expect(endJoystickTap(state, pointer(1280, { pointerType, pointerId: 2, x: 89 }))).toBeTrue();
      expect(state.previous).toBeNull();
      // A third tap must start a fresh pair, rather than jump twice.
      expect(tap(state, 1370, { pointerType, pointerId: 3 })).toBeFalse();
    }
  });

  test("allows modest thumb wobble at the inclusive duration/distance boundaries", () => {
    const state = createJoystickTapState();
    expect(tap(state, 1000, {}, JOYSTICK_TAP_MAX_DURATION_MS)).toBeFalse();
    const endAt = 1000 + JOYSTICK_TAP_MAX_DURATION_MS + JOYSTICK_DOUBLE_TAP_MS;
    beginJoystickTap(state, pointer(endAt - 100, { x: 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX }));
    moveJoystickTap(state, pointer(endAt - 50, {
      x: 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX + JOYSTICK_TAP_MAX_TRAVEL_PX,
    }));
    expect(endJoystickTap(state, pointer(endAt, { x: 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX }))).toBeTrue();
  });

  test("does not jump for a drag, even if the knob returns to its starting point", () => {
    const state = createJoystickTapState();
    tap(state, 1000);
    beginJoystickTap(state, pointer(1200));
    moveJoystickTap(state, pointer(1240, { x: 125 }));
    moveJoystickTap(state, pointer(1280));
    expect(endJoystickTap(state, pointer(1300))).toBeFalse();
    expect(tap(state, 1430)).toBeFalse();
    // A displacement seen only on pointer-up must also count as dragging.
    beginJoystickTap(state, pointer(1580));
    expect(endJoystickTap(state, pointer(1650, { x: 80 + JOYSTICK_TAP_MAX_TRAVEL_PX + 1 }))).toBeFalse();
  });

  test("rejects stale, distant, held, non-primary and unsupported pointer gestures", () => {
    const cases: Array<Partial<JoystickPointerSample>> = [
      { pointerType: "mouse" }, { pointerType: "" }, { pointerType: "pen", button: 2 },
      { isPrimary: false }, { x: Number.NaN },
    ];
    for (const sample of cases) {
      const state = createJoystickTapState();
      expect(tap(state, 1000, sample)).toBeFalse();
      expect(tap(state, 1200, sample)).toBeFalse();
    }
    for (const [start, x, duration] of [
      [1000 + JOYSTICK_DOUBLE_TAP_MS + 1, 80, 70],
      [1200, 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX + 1, 70],
      [1200, 80, JOYSTICK_TAP_MAX_DURATION_MS + 1],
    ]) {
      const state = createJoystickTapState();
      tap(state, 1000);
      expect(tap(state, start, { x }, duration)).toBeFalse();
    }
  });

  test("cancellation, lost capture, mode reset and extra fingers cannot complete an old pair", () => {
    const state = createJoystickTapState();
    tap(state, 1000);
    beginJoystickTap(state, pointer(1200));
    beginJoystickTap(state, pointer(1220, { pointerId: 2, isPrimary: false }));
    expect(endJoystickTap(state, pointer(1280))).toBeFalse();
    expect(tap(state, 1350)).toBeFalse();
    // The component shares this reset for cancel, lost capture, blur, hidden
    // document, an outside touch, disabled state and leaving walking mode.
    cancelJoystickTap(state);
    expect(tap(state, 1510)).toBeFalse();
    expect(tap(state, 1690)).toBeTrue();
  });

  test("uses the real normal jump and cannot boost an airborne pedestrian", () => {
    const environment: PedestrianEnvironment = {
      bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
      groundAt: () => 4,
      water: [],
    };
    let pedestrian = createPedestrianState(environment, { x: 0, z: 0, yaw: 0 });
    const gesture = createJoystickTapState();
    expect(tap(gesture, 1000)).toBeFalse();
    if (tap(gesture, 1200)) pedestrian = jumpPedestrian(pedestrian);
    expect(pedestrian.grounded).toBeFalse();
    expect(pedestrian.verticalVelocity).toBeCloseTo(
      Math.sqrt(2 * PEDESTRIAN_GRAVITY_MPS2 * PEDESTRIAN_JUMP_APEX_M),
    );
    pedestrian = stepPedestrian(pedestrian, PEDESTRIAN_IDLE_INPUT, 0.025, environment).state;
    const airborne = pedestrian;
    expect(tap(gesture, 1400)).toBeFalse();
    if (tap(gesture, 1600)) pedestrian = jumpPedestrian(pedestrian);
    expect(pedestrian).toBe(airborne);
    let apex = pedestrian.jumpOffset;
    for (let frame = 0; frame < 100; frame += 1) {
      pedestrian = stepPedestrian(pedestrian, PEDESTRIAN_IDLE_INPUT, 0.025, environment).state;
      apex = Math.max(apex, pedestrian.jumpOffset);
    }
    expect(apex).toBeGreaterThan(5.8);
    expect(apex).toBeLessThanOrEqual(PEDESTRIAN_JUMP_APEX_M + 0.01);
    expect(pedestrian.grounded).toBeTrue();
  });
});

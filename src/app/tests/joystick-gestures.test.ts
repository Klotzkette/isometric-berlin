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
  type JoystickJumpActivation,
} from "../src/joystickGestures";
import {
  PEDESTRIAN_GRAVITY_MPS2,
  PEDESTRIAN_IDLE_INPUT,
  PEDESTRIAN_JUMP_APEX_M,
  PEDESTRIAN_HIGH_JUMP_APEX_M,
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
): JoystickJumpActivation {
  beginJoystickTap(state, pointer(start, overrides));
  return endJoystickTap(state, pointer(start + duration, overrides));
}

describe("orange walking joystick double and triple tap", () => {
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
    expect(pointerUp).toContain('if (jump !== null) onJump?.(jump === "high")');
    const lostCapture = joystick.slice(joystick.indexOf("onLostPointerCapture="));
    expect(lostCapture).toContain("if (pointerIdRef.current === event.pointerId)");
    expect(lostCapture).toContain("cancelJoystickTap(tapStateRef.current)");
  });

  test("launches on completed tap two and upgrades on tap three for touch, pen and mouse", () => {
    for (const pointerType of ["touch", "pen", "mouse"]) {
      const state = createJoystickTapState();
      expect(tap(state, 1000, { pointerType })).toBeNull();
      beginJoystickTap(state, pointer(1200, { pointerType, pointerId: 2, x: 85 }));
      expect(state.previous).not.toBeNull();
      expect(endJoystickTap(state, pointer(1280, { pointerType, pointerId: 2, x: 89 }))).toBe("normal");
      expect(state.previous?.count).toBe(2);
      expect(tap(state, 1370, { pointerType, pointerId: 3 })).toBe("high");
      expect(state.previous).toBeNull();
      expect(tap(state, 1550, { pointerType, pointerId: 4 })).toBeNull();
    }
  });

  test("allows modest thumb wobble at the inclusive duration/distance boundaries", () => {
    const state = createJoystickTapState();
    expect(tap(state, 1000, {}, JOYSTICK_TAP_MAX_DURATION_MS)).toBeNull();
    const endAt = 1000 + JOYSTICK_TAP_MAX_DURATION_MS + JOYSTICK_DOUBLE_TAP_MS;
    beginJoystickTap(state, pointer(endAt - 100, { x: 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX }));
    moveJoystickTap(state, pointer(endAt - 50, {
      x: 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX + JOYSTICK_TAP_MAX_TRAVEL_PX,
    }));
    expect(endJoystickTap(state, pointer(endAt, { x: 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX }))).toBe("normal");
  });

  test("does not jump for a drag, even if the knob returns to its starting point", () => {
    const state = createJoystickTapState();
    tap(state, 1000);
    beginJoystickTap(state, pointer(1200));
    moveJoystickTap(state, pointer(1240, { x: 125 }));
    moveJoystickTap(state, pointer(1280));
    expect(endJoystickTap(state, pointer(1300))).toBeNull();
    expect(tap(state, 1430)).toBeNull();
    // A displacement seen only on pointer-up must also count as dragging.
    beginJoystickTap(state, pointer(1580));
    expect(endJoystickTap(state, pointer(1650, { x: 80 + JOYSTICK_TAP_MAX_TRAVEL_PX + 1 }))).toBeNull();
  });

  test("rejects stale, distant, held, non-primary and unsupported pointer gestures", () => {
    const cases: Array<Partial<JoystickPointerSample>> = [
      { pointerType: "mouse", button: 2 }, { pointerType: "" }, { pointerType: "pen", button: 2 },
      { isPrimary: false }, { x: Number.NaN },
    ];
    for (const sample of cases) {
      const state = createJoystickTapState();
      expect(tap(state, 1000, sample)).toBeNull();
      expect(tap(state, 1200, sample)).toBeNull();
    }
    for (const [start, x, duration] of [
      [1000 + JOYSTICK_DOUBLE_TAP_MS + 1, 80, 70],
      [1200, 80 + JOYSTICK_DOUBLE_TAP_RADIUS_PX + 1, 70],
      [1200, 80, JOYSTICK_TAP_MAX_DURATION_MS + 1],
    ]) {
      const state = createJoystickTapState();
      tap(state, 1000);
      expect(tap(state, start, { x }, duration)).toBeNull();
    }
  });

  test("cancellation, lost capture, mode reset and extra fingers cannot complete an old pair", () => {
    const state = createJoystickTapState();
    tap(state, 1000);
    beginJoystickTap(state, pointer(1200));
    beginJoystickTap(state, pointer(1220, { pointerId: 2, isPrimary: false }));
    expect(endJoystickTap(state, pointer(1280))).toBeNull();
    expect(tap(state, 1350)).toBeNull();
    // The component shares this reset for cancel, lost capture, blur, hidden
    // document, an outside touch, disabled state and leaving walking mode.
    cancelJoystickTap(state);
    expect(tap(state, 1510)).toBeNull();
    expect(tap(state, 1690)).toBe("normal");
  });

  test("a delayed third tap or a different pointer type starts a new sequence", () => {
    const state = createJoystickTapState();
    expect(tap(state, 1000)).toBeNull();
    expect(tap(state, 1200)).toBe("normal");
    expect(tap(state, 1200 + JOYSTICK_DOUBLE_TAP_MS + 1)).toBeNull();
    expect(tap(state, 1800, { pointerType: "mouse" })).toBeNull();
    expect(tap(state, 2000, { pointerType: "mouse" })).toBe("normal");
    expect(tap(state, 2200, { pointerType: "pen" })).toBeNull();
  });

  test("the third completed tap upgrades the real ascending jump once", () => {
    const environment: PedestrianEnvironment = {
      bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
      groundAt: () => 4, water: [],
    };
    let pedestrian = createPedestrianState(environment, { x: 0, z: 0, yaw: 0 });
    const state = createJoystickTapState();
    expect(tap(state, 1000)).toBeNull();
    const launch = tap(state, 1200);
    expect(launch).toBe("normal");
    pedestrian = jumpPedestrian(pedestrian, launch === "high");
    for (let frame = 0; frame < 8; frame++)
      pedestrian = stepPedestrian(pedestrian, PEDESTRIAN_IDLE_INPUT, .025, environment).state;
    const upgrade = tap(state, 1400);
    expect(upgrade).toBe("high");
    pedestrian = jumpPedestrian(pedestrian, upgrade === "high");
    const boosted = pedestrian;
    expect(jumpPedestrian(pedestrian, true)).toBe(boosted);
    expect(tap(state, 1600)).toBeNull();
    let apex = pedestrian.jumpOffset;
    for (let frame = 0; frame < 160; frame++) {
      pedestrian = stepPedestrian(pedestrian, PEDESTRIAN_IDLE_INPUT, .025, environment).state;
      apex = Math.max(apex, pedestrian.jumpOffset);
    }
    expect(apex).toBeGreaterThan(PEDESTRIAN_JUMP_APEX_M + 3);
    expect(apex).toBeLessThanOrEqual(PEDESTRIAN_HIGH_JUMP_APEX_M + .01);
    expect(pedestrian.grounded).toBe(true);
  });

  test("a separate normal double tap cannot boost an airborne pedestrian", () => {
    const environment: PedestrianEnvironment = {
      bounds: { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 },
      groundAt: () => 4,
      water: [],
    };
    let pedestrian = createPedestrianState(environment, { x: 0, z: 0, yaw: 0 });
    const gesture = createJoystickTapState();
    expect(tap(gesture, 1000)).toBeNull();
    if (tap(gesture, 1200) === "normal") pedestrian = jumpPedestrian(pedestrian);
    expect(pedestrian.grounded).toBeFalse();
    expect(pedestrian.verticalVelocity).toBeCloseTo(
      Math.sqrt(2 * PEDESTRIAN_GRAVITY_MPS2 * PEDESTRIAN_JUMP_APEX_M),
    );
    pedestrian = stepPedestrian(pedestrian, PEDESTRIAN_IDLE_INPUT, 0.025, environment).state;
    const airborne = pedestrian;
    cancelJoystickTap(gesture);
    expect(tap(gesture, 1400)).toBeNull();
    if (tap(gesture, 1600) === "normal") pedestrian = jumpPedestrian(pedestrian);
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

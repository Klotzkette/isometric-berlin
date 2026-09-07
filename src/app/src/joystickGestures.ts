export const JOYSTICK_TAP_MAX_DURATION_MS = 320;
export const JOYSTICK_TAP_MAX_TRAVEL_PX = 14;
export const JOYSTICK_DOUBLE_TAP_MS = 480;
export const JOYSTICK_DOUBLE_TAP_RADIUS_PX = 32;

export type JoystickPointerSample = {
  at: number;
  button: number;
  isPrimary: boolean;
  pointerId: number;
  pointerType: string;
  x: number;
  y: number;
};

type JoystickTap = {
  at: number;
  pointerType: string;
  x: number;
  y: number;
};

export type JoystickTapState = {
  active: (JoystickPointerSample & { maxTravelPx: number }) | null;
  previous: JoystickTap | null;
};

export function createJoystickTapState(): JoystickTapState {
  return { active: null, previous: null };
}

export function cancelJoystickTap(state: JoystickTapState): void {
  state.active = null;
  state.previous = null;
}

function validPointerSample(sample: JoystickPointerSample): boolean {
  return (
    ["touch", "pen", "mouse"].includes(sample.pointerType) &&
    sample.isPrimary &&
    [sample.at, sample.x, sample.y, sample.pointerId].every(Number.isFinite)
  );
}

/** A second pointer cancels the sequence without taking over the drag. */
export function beginJoystickTap(
  state: JoystickTapState,
  sample: JoystickPointerSample,
): void {
  if (state.active || !validPointerSample(sample) || sample.button !== 0) {
    cancelJoystickTap(state);
    return;
  }
  state.active = { ...sample, maxTravelPx: 0 };
}

/** Remember the largest excursion, including a drag that returns to centre. */
export function moveJoystickTap(
  state: JoystickTapState,
  sample: JoystickPointerSample,
): void {
  const active = state.active;
  if (!active || active.pointerId !== sample.pointerId) return;
  if (!validPointerSample(sample) || sample.pointerType !== active.pointerType) {
    cancelJoystickTap(state);
    return;
  }
  active.maxTravelPx = Math.max(
    active.maxTravelPx,
    Math.hypot(sample.x - active.x, sample.y - active.y),
  );
}

/** Activate on release only: one touch tap or two completed mouse clicks. */
export function endJoystickTap(
  state: JoystickTapState,
  sample: JoystickPointerSample,
  activation: "single" | "double" = "double",
): boolean {
  const active = state.active;
  if (!active || active.pointerId !== sample.pointerId) return false;
  moveJoystickTap(state, sample);
  if (!state.active) return false;
  state.active = null;
  const duration = sample.at - active.at;
  if (
    duration < 0 ||
    duration > JOYSTICK_TAP_MAX_DURATION_MS ||
    active.maxTravelPx > JOYSTICK_TAP_MAX_TRAVEL_PX
  ) {
    state.previous = null;
    return false;
  }
  if (activation === "single") {
    state.previous = null;
    return true;
  }
  const completed: JoystickTap = {
    at: sample.at,
    pointerType: sample.pointerType,
    x: sample.x,
    y: sample.y,
  };
  const previous = state.previous;
  const elapsed = previous ? completed.at - previous.at : -1;
  const doubleTap = previous !== null &&
    previous.pointerType === completed.pointerType &&
    elapsed >= 0 && elapsed <= JOYSTICK_DOUBLE_TAP_MS &&
    Math.hypot(completed.x - previous.x, completed.y - previous.y) <=
      JOYSTICK_DOUBLE_TAP_RADIUS_PX;
  state.previous = doubleTap ? null : completed;
  return doubleTap;
}

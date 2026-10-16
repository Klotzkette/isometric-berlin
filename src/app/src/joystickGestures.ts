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
  count: 1 | 2;
};

export type JoystickJumpActivation = "normal" | "high" | null;

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

/** Two completed taps launch; a third upgrades the same jump. Drags never count. */
export function endJoystickTap(
  state: JoystickTapState,
  sample: JoystickPointerSample,
): JoystickJumpActivation {
  const active = state.active;
  if (!active || active.pointerId !== sample.pointerId) return null;
  moveJoystickTap(state, sample);
  if (!state.active) return null;
  state.active = null;
  const duration = sample.at - active.at;
  if (
    sample.button !== 0 || duration < 0 ||
    duration > JOYSTICK_TAP_MAX_DURATION_MS ||
    active.maxTravelPx > JOYSTICK_TAP_MAX_TRAVEL_PX
  ) {
    state.previous = null;
    return null;
  }
  const completed: JoystickTap = {
    at: sample.at,
    pointerType: sample.pointerType,
    x: sample.x,
    y: sample.y,
    count: 1,
  };
  const previous = state.previous;
  const elapsed = previous ? completed.at - previous.at : -1;
  const continuesSequence = previous !== null &&
    previous.pointerType === completed.pointerType &&
    elapsed >= 0 && elapsed <= JOYSTICK_DOUBLE_TAP_MS &&
    Math.hypot(completed.x - previous.x, completed.y - previous.y) <=
      JOYSTICK_DOUBLE_TAP_RADIUS_PX;
  if (!continuesSequence) {
    state.previous = completed;
    return null;
  }
  if (previous.count === 2) {
    state.previous = null;
    return "high";
  }
  state.previous = { ...completed, count: 2 };
  return "normal";
}

export type HeldNavigationInput = {
  flight: { forward: number; strafe: number };
  orbit: { horizontal: number; vertical: number };
  pan: { horizontal: number; vertical: number };
};

export type PedestrianInput = {
  forward: number;
  look: number;
  sprint: boolean;
  strafe: number;
  turn: number;
};

export const PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS = 340;

/** Route held desktop arrows to exactly one camera channel. */
export function heldNavigationInput(
  keys: ReadonlySet<string>,
): HeldNavigationInput {
  const shift = keys.has("Shift");
  const alt = keys.has("Alt");
  const horizontal =
    (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
  const vertical =
    (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
  return {
    flight: {
      forward: shift && !alt ? vertical : 0,
      strafe: shift && !alt ? horizontal : 0,
    },
    orbit: {
      horizontal: alt ? horizontal : 0,
      vertical: alt ? vertical : 0,
    },
    pan: {
      horizontal: alt || shift ? 0 : horizontal,
      vertical: alt || shift ? 0 : vertical,
    },
  };
}

export function isPedestrianSprintDoubleActivation(
  previousActivationAt: number,
  activationAt: number,
): boolean {
  const elapsed = activationAt - previousActivationAt;
  return (
    previousActivationAt > 0 &&
    elapsed >= 0 &&
    elapsed <= PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS
  );
}

export function heldPedestrianInput(
  keys: ReadonlySet<string>,
): PedestrianInput {
  return {
    forward:
      (keys.has("ArrowUp") || keys.has("w") ? 1 : 0) -
      (keys.has("ArrowDown") || keys.has("s") ? 1 : 0),
    look: 0,
    sprint: keys.has("Shift"),
    strafe: (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0),
    turn:
      (keys.has("ArrowRight") || keys.has("e") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("q") ? 1 : 0),
  };
}

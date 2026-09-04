export type HeldNavigationInput = {
  flight: { forward: number; strafe: number; vertical: number };
  orbit: { horizontal: number; vertical: number };
  pan: { horizontal: number; vertical: number };
};

export type PedestrianInput = {
  fastRun?: boolean;
  forward: number;
  look: number;
  sprint: boolean;
  strafe: number;
  turn: number;
};

export const PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS = 340;
export const PEDESTRIAN_HIGH_JUMP_DOUBLE_ACTIVATION_MS = 320;

export type PedestrianMovementActivation = {
  count: number;
  key: string;
  lastActivationAt: number;
};

/** Return true only when a held-key set actually changed. */
export function holdNavigationKey(keys: Set<string>, key: string): boolean {
  const previousSize = keys.size;
  keys.add(key);
  return keys.size !== previousSize;
}

/** Route held desktop controls to camera-relative flight, pan, or orbit. */
export function heldNavigationInput(
  keys: ReadonlySet<string>,
): HeldNavigationInput {
  const shift = keys.has("Shift");
  const alt = keys.has("Alt");
  const arrowHorizontal =
    (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
  const arrowVertical =
    (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
  const wasdHorizontal =
    (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const shiftTurnActive =
    shift && !alt && (arrowHorizontal !== 0 || wasdHorizontal !== 0);
  const shiftTurn = shiftTurnActive
    // OrbitControls' positive azimuth moves the visible heading to the left.
    // Invert only this chord so Shift+D/Right turns the view right while
    // plain A/D strafing, Alt+arrows and pedestrian yaw keep their semantics.
    ? -Math.sign(arrowHorizontal + wasdHorizontal)
    : 0;
  return {
    flight: {
      forward: (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0),
      strafe: shiftTurnActive ? 0 : wasdHorizontal,
      vertical: alt || shiftTurnActive
        ? 0
        : (keys.has("Space") ? 1 : 0) - (shift ? 1 : 0),
    },
    orbit: {
      horizontal: alt ? arrowHorizontal : shiftTurn,
      vertical: alt ? arrowVertical : 0,
    },
    pan: {
      horizontal: alt || shiftTurnActive ? 0 : arrowHorizontal,
      vertical: alt ? 0 : arrowVertical,
    },
  };
}

function isDoubleActivation(
  previousActivationAt: number,
  activationAt: number,
  windowMs: number,
): boolean {
  const elapsed = activationAt - previousActivationAt;
  return (
    previousActivationAt > 0 && elapsed >= 0 && elapsed <= windowMs
  );
}

export function isPedestrianSprintDoubleActivation(
  previousActivationAt: number,
  activationAt: number,
): boolean {
  return isDoubleActivation(
    previousActivationAt,
    activationAt,
    PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS,
  );
}

export function isPedestrianHighJumpDoubleActivation(
  previousActivationAt: number,
  activationAt: number,
): boolean {
  return isDoubleActivation(
    previousActivationAt,
    activationAt,
    PEDESTRIAN_HIGH_JUMP_DOUBLE_ACTIVATION_MS,
  );
}

/** Count bounded repeated presses of one movement key without mixing chords. */
export function pedestrianMovementActivation(
  previous: Readonly<PedestrianMovementActivation>,
  key: string,
  activationAt: number,
): PedestrianMovementActivation {
  const activationKey =
    key === "ArrowUp" || key === "w"
      ? "forward"
      : key === "ArrowDown" || key === "s"
        ? "backward"
        : key === "ArrowLeft" || key === "a"
          ? "left"
          : key === "ArrowRight" || key === "d"
            ? "right"
            : key;
  const elapsed = activationAt - previous.lastActivationAt;
  const continuesSequence =
    previous.key === activationKey &&
    previous.count > 0 &&
    elapsed >= 0 &&
    elapsed <= PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS;
  return {
    count: continuesSequence ? Math.min(3, previous.count + 1) : 1,
    key: activationKey,
    lastActivationAt: activationAt,
  };
}

export function heldPedestrianInput(
  keys: ReadonlySet<string>,
): PedestrianInput {
  const shift = keys.has("Shift");
  const wasdHorizontal =
    (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const explicitTurn =
    (keys.has("ArrowRight") || keys.has("e") ? 1 : 0) -
    (keys.has("ArrowLeft") || keys.has("q") ? 1 : 0);
  return {
    forward:
      (keys.has("ArrowUp") || keys.has("w") ? 1 : 0) -
      (keys.has("ArrowDown") || keys.has("s") ? 1 : 0),
    look: 0,
    sprint: shift,
    strafe: shift ? 0 : wasdHorizontal,
    turn: Math.sign(explicitTurn + (shift ? wasdHorizontal : 0)),
  };
}

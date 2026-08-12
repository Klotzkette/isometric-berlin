import type { SurfacePayload } from "./IsometricCityWorld";
import {
  type VoxelPayload,
  smoothGroundTopSampler,
} from "./MinecraftVoxelWorld";

export const PEDESTRIAN_EYE_HEIGHT_M = 1.8;
export const PEDESTRIAN_JUMP_APEX_M = PEDESTRIAN_EYE_HEIGHT_M * 3;
export const PEDESTRIAN_WALK_SPEED_MPS = 3.2;
export const PEDESTRIAN_TURN_SPEED_RAD_S = Math.PI * 0.62;
export const PEDESTRIAN_LOOK_SPEED_RAD_S = Math.PI * 0.48;
export const PEDESTRIAN_GRAVITY_MPS2 = 18;
export const PEDESTRIAN_MAX_PITCH_RAD = (Math.PI * 80) / 180;
export const PEDESTRIAN_FOV_DEGREES = 66;
export const PEDESTRIAN_VIEW_DISTANCE_M = 7;

/** Pariser Platz, east of the Brandenburg Gate, in the viewer's metric frame. */
export const PEDESTRIAN_RESPAWN = {
  x: 497.0499028667109,
  z: 292.8503072652966,
  // West, toward the Brandenburg Gate.
  yaw: -Math.PI / 2,
} as const;

export type PedestrianInput = {
  forward: number;
  look: number;
  strafe: number;
  turn: number;
};

export type PedestrianState = {
  grounded: boolean;
  groundY: number;
  jumpOffset: number;
  pitch: number;
  verticalVelocity: number;
  x: number;
  yaw: number;
  z: number;
};

export type PedestrianBounds = {
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
};

export type PedestrianWaterRegion = {
  holes: Array<Array<readonly [number, number]>>;
  maxX: number;
  maxZ: number;
  minX: number;
  minZ: number;
  ring: Array<readonly [number, number]>;
};

export type PedestrianEnvironment = {
  bounds: PedestrianBounds;
  groundAt: (x: number, z: number) => number | null;
  water: PedestrianWaterRegion[];
};

export type PedestrianStep = {
  changed: boolean;
  respawned: boolean;
  state: PedestrianState;
};

export const PEDESTRIAN_IDLE_INPUT: Readonly<PedestrianInput> = {
  forward: 0,
  look: 0,
  strafe: 0,
  turn: 0,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrapRadians(value: number): number {
  const wrapped = ((value + Math.PI) % (Math.PI * 2)) - Math.PI;
  return wrapped < -Math.PI ? wrapped + Math.PI * 2 : wrapped;
}

function pointOnSegment(
  x: number,
  z: number,
  left: readonly [number, number],
  right: readonly [number, number],
): boolean {
  const lengthSquared =
    (right[0] - left[0]) ** 2 + (right[1] - left[1]) ** 2;
  if (lengthSquared < 1e-12) {
    return Math.hypot(x - left[0], z - left[1]) < 1e-7;
  }
  const cross =
    (x - left[0]) * (right[1] - left[1]) -
    (z - left[1]) * (right[0] - left[0]);
  if (Math.abs(cross) > 1e-7) {
    return false;
  }
  const dot =
    (x - left[0]) * (right[0] - left[0]) +
    (z - left[1]) * (right[1] - left[1]);
  if (dot < 0) {
    return false;
  }
  return dot <= lengthSquared;
}

export function pointInPedestrianRing(
  x: number,
  z: number,
  ring: ReadonlyArray<readonly [number, number]>,
): boolean {
  if (ring.length < 3) {
    return false;
  }
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; index += 1) {
    const left = ring[previous];
    const right = ring[index];
    if (pointOnSegment(x, z, left, right)) {
      return true;
    }
    if (
      (right[1] > z) !== (left[1] > z) &&
      x <
        ((left[0] - right[0]) * (z - right[1])) /
          (left[1] - right[1]) +
          right[0]
    ) {
      inside = !inside;
    }
    previous = index;
  }
  return inside;
}

function metricRing(ring: number[][]): Array<readonly [number, number]> {
  return ring
    .filter((point) => point.length >= 2)
    .map((point) => [point[0] / 10, point[1] / 10] as const);
}

export function compilePedestrianWater(
  payload: Pick<SurfacePayload, "water">,
): PedestrianWaterRegion[] {
  return payload.water.flatMap((surface) => {
    const ring = metricRing(surface.ring);
    if (ring.length < 3) {
      return [];
    }
    const xs = ring.map(([x]) => x);
    const zs = ring.map(([, z]) => z);
    return [
      {
        holes: surface.holes.map(metricRing).filter((hole) => hole.length >= 3),
        maxX: Math.max(...xs),
        maxZ: Math.max(...zs),
        minX: Math.min(...xs),
        minZ: Math.min(...zs),
        ring,
      },
    ];
  });
}

export function pedestrianPointIsWater(
  x: number,
  z: number,
  water: readonly PedestrianWaterRegion[],
): boolean {
  for (const region of water) {
    if (
      x < region.minX ||
      x > region.maxX ||
      z < region.minZ ||
      z > region.maxZ ||
      !pointInPedestrianRing(x, z, region.ring)
    ) {
      continue;
    }
    if (!region.holes.some((hole) => pointInPedestrianRing(x, z, hole))) {
      return true;
    }
  }
  return false;
}

export function createPedestrianEnvironment(
  ground: VoxelPayload,
  surfaces: Pick<SurfacePayload, "water">,
): PedestrianEnvironment {
  const smoothGround = smoothGroundTopSampler(ground);
  const cell = ground.cell_m;
  const { cols, min_x_idx: minXIndex, min_z_idx: minZIndex, rows } = ground.grid;
  const bounds = {
    maxX: (minXIndex + cols) * cell,
    maxZ: (minZIndex + rows) * cell,
    minX: minXIndex * cell,
    minZ: minZIndex * cell,
  };
  return {
    bounds,
    groundAt: (x, z) => {
      const xOffset = x / cell - minXIndex;
      const zOffset = z / cell - minZIndex;
      if (xOffset < 0 || zOffset < 0 || xOffset >= cols || zOffset >= rows) {
        return null;
      }
      return smoothGround(xOffset, zOffset);
    },
    water: compilePedestrianWater(surfaces),
  };
}

export function createPedestrianState(
  environment: Pick<PedestrianEnvironment, "groundAt">,
): PedestrianState {
  return {
    grounded: true,
    groundY:
      environment.groundAt(PEDESTRIAN_RESPAWN.x, PEDESTRIAN_RESPAWN.z) ?? 4,
    jumpOffset: 0,
    pitch: 0,
    verticalVelocity: 0,
    x: PEDESTRIAN_RESPAWN.x,
    yaw: PEDESTRIAN_RESPAWN.yaw,
    z: PEDESTRIAN_RESPAWN.z,
  };
}

export function pedestrianViewDirection(state: PedestrianState): {
  x: number;
  y: number;
  z: number;
} {
  const horizontal = Math.cos(state.pitch);
  return {
    x: Math.sin(state.yaw) * horizontal,
    y: Math.sin(state.pitch),
    z: -Math.cos(state.yaw) * horizontal,
  };
}

export function lookPedestrian(
  state: PedestrianState,
  yawDelta: number,
  pitchDelta: number,
): PedestrianState {
  if (yawDelta === 0 && pitchDelta === 0) {
    return state;
  }
  return {
    ...state,
    pitch: clamp(
      state.pitch + pitchDelta,
      -PEDESTRIAN_MAX_PITCH_RAD,
      PEDESTRIAN_MAX_PITCH_RAD,
    ),
    yaw: wrapRadians(state.yaw + yawDelta),
  };
}

export function setPedestrianYaw(
  state: PedestrianState,
  yaw: number,
): PedestrianState {
  return { ...state, yaw: wrapRadians(yaw) };
}

export function jumpPedestrian(state: PedestrianState): PedestrianState {
  if (!state.grounded) {
    return state;
  }
  return {
    ...state,
    grounded: false,
    verticalVelocity: Math.sqrt(
      2 * PEDESTRIAN_GRAVITY_MPS2 * PEDESTRIAN_JUMP_APEX_M,
    ),
  };
}

function inBounds(x: number, z: number, bounds: PedestrianBounds): boolean {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    z >= bounds.minZ &&
    z <= bounds.maxZ
  );
}

export function stepPedestrian(
  state: PedestrianState,
  input: PedestrianInput,
  deltaSeconds: number,
  environment: PedestrianEnvironment,
): PedestrianStep {
  const dt = clamp(deltaSeconds, 0, 0.05);
  if (dt === 0) {
    return { changed: false, respawned: false, state };
  }

  const nextYaw = wrapRadians(
    state.yaw + clamp(input.turn, -1, 1) * PEDESTRIAN_TURN_SPEED_RAD_S * dt,
  );
  const nextPitch = clamp(
    state.pitch + clamp(input.look, -1, 1) * PEDESTRIAN_LOOK_SPEED_RAD_S * dt,
    -PEDESTRIAN_MAX_PITCH_RAD,
    PEDESTRIAN_MAX_PITCH_RAD,
  );
  const rawForward = clamp(input.forward, -1, 1);
  const rawStrafe = clamp(input.strafe, -1, 1);
  const inputLength = Math.max(1, Math.hypot(rawForward, rawStrafe));
  const forward = rawForward / inputLength;
  const strafe = rawStrafe / inputLength;
  const distance = PEDESTRIAN_WALK_SPEED_MPS * dt;
  const nextCandidateX =
    state.x +
    (Math.sin(nextYaw) * forward + Math.cos(nextYaw) * strafe) * distance;
  const nextCandidateZ =
    state.z +
    (-Math.cos(nextYaw) * forward + Math.sin(nextYaw) * strafe) * distance;
  const canMove =
    inBounds(nextCandidateX, nextCandidateZ, environment.bounds) &&
    environment.groundAt(nextCandidateX, nextCandidateZ) !== null;
  const x = canMove ? nextCandidateX : state.x;
  const z = canMove ? nextCandidateZ : state.z;
  const groundY = environment.groundAt(x, z) ?? state.groundY;

  let jumpOffset = state.jumpOffset;
  let verticalVelocity = state.verticalVelocity;
  let grounded = state.grounded;
  if (!grounded) {
    jumpOffset +=
      verticalVelocity * dt - (PEDESTRIAN_GRAVITY_MPS2 * dt * dt) / 2;
    verticalVelocity -= PEDESTRIAN_GRAVITY_MPS2 * dt;
    if (jumpOffset <= 0 && verticalVelocity <= 0) {
      jumpOffset = 0;
      verticalVelocity = 0;
      grounded = true;
    }
  }

  if (grounded && pedestrianPointIsWater(x, z, environment.water)) {
    return {
      changed: true,
      respawned: true,
      state: createPedestrianState(environment),
    };
  }

  const changed =
    x !== state.x ||
    z !== state.z ||
    nextYaw !== state.yaw ||
    nextPitch !== state.pitch ||
    groundY !== state.groundY ||
    jumpOffset !== state.jumpOffset ||
    verticalVelocity !== state.verticalVelocity ||
    grounded !== state.grounded;
  if (!changed) {
    return { changed: false, respawned: false, state };
  }
  return {
    changed: true,
    respawned: false,
    state: {
      grounded,
      groundY,
      jumpOffset,
      pitch: nextPitch,
      verticalVelocity,
      x,
      yaw: nextYaw,
      z,
    },
  };
}

export function heldPedestrianInput(
  keys: ReadonlySet<string>,
): PedestrianInput {
  return {
    forward:
      (keys.has("ArrowUp") || keys.has("w") ? 1 : 0) -
      (keys.has("ArrowDown") || keys.has("s") ? 1 : 0),
    look: 0,
    strafe: (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0),
    turn:
      (keys.has("ArrowRight") || keys.has("e") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("q") ? 1 : 0),
  };
}

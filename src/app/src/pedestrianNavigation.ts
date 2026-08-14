import type { SurfacePayload } from "./IsometricCityWorld";
import {
  type VoxelPayload,
  smoothGroundTopSampler,
} from "./MinecraftVoxelWorld";
import {
  type TunnelPortalCourseInput,
  tunnelWalkCourses,
} from "./TunnelPortals";

export const PEDESTRIAN_EYE_HEIGHT_M = 1.8;
export const PEDESTRIAN_JUMP_APEX_M = PEDESTRIAN_EYE_HEIGHT_M * 3;
export const PEDESTRIAN_WALK_SPEED_MPS = 6.4;
export const PEDESTRIAN_SPRINT_MULTIPLIER = 4;
export const PEDESTRIAN_SPRINT_DOUBLE_ACTIVATION_MS = 340;
export const PEDESTRIAN_TURN_SPEED_RAD_S = Math.PI * 0.62;
export const PEDESTRIAN_LOOK_SPEED_RAD_S = Math.PI * 0.48;
export const PEDESTRIAN_GRAVITY_MPS2 = 32;
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
  sprint: boolean;
  strafe: number;
  turn: number;
};

export type PedestrianState = {
  grounded: boolean;
  groundLayer: "surface" | "tunnel";
  groundY: number;
  insideTunnel: boolean;
  jumpOffset: number;
  pitch: number;
  verticalVelocity: number;
  x: number;
  yaw: number;
  z: number;
};

export type PedestrianSpawn = {
  groundYHint?: number;
  pitch?: number;
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
  resolveGround?: (
    x: number,
    z: number,
    currentLayer: PedestrianState["groundLayer"],
    groundYHint?: number,
  ) => PedestrianGround | null;
  water: PedestrianWaterRegion[];
};

export type PedestrianGround = {
  insideTunnel: boolean;
  layer: PedestrianState["groundLayer"];
  y: number;
};

export type PedestrianStep = {
  changed: boolean;
  respawned: boolean;
  state: PedestrianState;
};

export const PEDESTRIAN_IDLE_INPUT: Readonly<PedestrianInput> = {
  forward: 0,
  look: 0,
  sprint: false,
  strafe: 0,
  turn: 0,
};

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
  tunnel?: TunnelPortalCourseInput | null,
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
  const surfaceGroundAt = (x: number, z: number): number | null => {
    const xOffset = x / cell - minXIndex;
    const zOffset = z / cell - minZIndex;
    if (xOffset < 0 || zOffset < 0 || xOffset >= cols || zOffset >= rows) {
      return null;
    }
    return smoothGround(xOffset, zOffset);
  };
  const tunnelSegments = tunnel
    ? tunnelWalkCourses(tunnel).flatMap((course) =>
        course.points.slice(0, -1).map((from, index) => {
          const to = course.points[index + 1];
          const dx = to[0] - from[0];
          const dz = to[2] - from[2];
          return {
            dx,
            dz,
            from,
            halfWidthM: course.halfWidthM,
            kind: course.kind,
            lengthSquared: dx * dx + dz * dz,
            to,
          };
        }),
      )
    : [];
  const tunnelGroundsAt = (x: number, z: number) =>
    tunnelSegments.flatMap((segment) => {
      const progress =
        segment.lengthSquared > 1e-8
          ? clamp(
              ((x - segment.from[0]) * segment.dx +
                (z - segment.from[2]) * segment.dz) /
                segment.lengthSquared,
              0,
              1,
            )
          : 0;
      const closestX = segment.from[0] + segment.dx * progress;
      const closestZ = segment.from[2] + segment.dz * progress;
      const distanceSquared = (x - closestX) ** 2 + (z - closestZ) ** 2;
      if (distanceSquared > (segment.halfWidthM + 0.35) ** 2) {
        return [];
      }
      return [
        {
          distanceSquared,
          kind: segment.kind,
          y: segment.from[1] + (segment.to[1] - segment.from[1]) * progress,
        },
      ];
    });
  const resolveGround: NonNullable<PedestrianEnvironment["resolveGround"]> = (
    x,
    z,
    currentLayer,
    groundYHint,
  ) => {
    const surfaceY = surfaceGroundAt(x, z);
    const tunnelGrounds = tunnelGroundsAt(x, z);
    const portalGrounds = tunnelGrounds.filter(
      (candidate) => candidate.kind === "portal",
    );
    const selectable =
      currentLayer === "tunnel" ? tunnelGrounds : portalGrounds;
    const nearestTunnel = selectable.reduce<
      (typeof selectable)[number] | null
    >((nearest, candidate) => {
      if (!nearest) return candidate;
      if (Number.isFinite(groundYHint)) {
        return Math.abs(candidate.y - groundYHint!) <
          Math.abs(nearest.y - groundYHint!)
          ? candidate
          : nearest;
      }
      return candidate.distanceSquared < nearest.distanceSquared
        ? candidate
        : nearest;
    }, null);
    if (nearestTunnel) {
      const useTunnel =
        currentLayer === "tunnel" ||
        surfaceY === null ||
        !Number.isFinite(groundYHint) ||
        Math.abs(nearestTunnel.y - groundYHint!) <=
          Math.abs(surfaceY - groundYHint!) + 0.35;
      if (useTunnel) {
        return {
          insideTunnel:
            nearestTunnel.kind === "tube" ||
            surfaceY === null ||
            nearestTunnel.y < surfaceY - 0.75,
          layer: "tunnel",
          y: nearestTunnel.y,
        };
      }
    }
    return surfaceY === null
      ? null
      : { insideTunnel: false, layer: "surface", y: surfaceY };
  };
  return {
    bounds,
    groundAt: surfaceGroundAt,
    resolveGround,
    water: compilePedestrianWater(surfaces),
  };
}

export function createPedestrianState(
  environment: Pick<PedestrianEnvironment, "groundAt" | "resolveGround">,
  requestedSpawn: PedestrianSpawn = PEDESTRIAN_RESPAWN,
): PedestrianState {
  const surfaceY = environment.groundAt(requestedSpawn.x, requestedSpawn.z);
  const requestedLayer =
    Number.isFinite(requestedSpawn.groundYHint) &&
    surfaceY !== null &&
    requestedSpawn.groundYHint! < surfaceY - 0.75
      ? "tunnel"
      : "surface";
  const requestedGround = environment.resolveGround?.(
    requestedSpawn.x,
    requestedSpawn.z,
    requestedLayer,
    requestedSpawn.groundYHint,
  ) ??
    (() => {
      const y = environment.groundAt(requestedSpawn.x, requestedSpawn.z);
      return y === null
        ? null
        : ({ insideTunnel: false, layer: "surface", y } as const);
    })();
  const spawn = requestedGround === null ? PEDESTRIAN_RESPAWN : requestedSpawn;
  const resolvedGround =
    spawn === requestedSpawn
      ? requestedGround
      : (environment.resolveGround?.(spawn.x, spawn.z, "surface") ??
        (() => {
          const y = environment.groundAt(spawn.x, spawn.z);
          return y === null
            ? null
            : ({ insideTunnel: false, layer: "surface", y } as const);
        })());
  return {
    grounded: true,
    groundLayer: resolvedGround?.layer ?? "surface",
    groundY: resolvedGround?.y ?? 4,
    insideTunnel: resolvedGround?.insideTunnel ?? false,
    jumpOffset: 0,
    pitch: clamp(
      "pitch" in spawn && typeof spawn.pitch === "number" ? spawn.pitch : 0,
      -PEDESTRIAN_MAX_PITCH_RAD,
      PEDESTRIAN_MAX_PITCH_RAD,
    ),
    verticalVelocity: 0,
    x: spawn.x,
    yaw: wrapRadians(spawn.yaw),
    z: spawn.z,
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
  const speed =
    PEDESTRIAN_WALK_SPEED_MPS *
    (input.sprint ? PEDESTRIAN_SPRINT_MULTIPLIER : 1);
  const distance = speed * dt;
  const nextCandidateX =
    state.x +
    (Math.sin(nextYaw) * forward + Math.cos(nextYaw) * strafe) * distance;
  const nextCandidateZ =
    state.z +
    (-Math.cos(nextYaw) * forward + Math.sin(nextYaw) * strafe) * distance;
  const requestedGround = inBounds(
    nextCandidateX,
    nextCandidateZ,
    environment.bounds,
  )
    ? (environment.resolveGround?.(
        nextCandidateX,
        nextCandidateZ,
        state.groundLayer,
        state.groundY,
      ) ??
      (() => {
        const y = environment.groundAt(nextCandidateX, nextCandidateZ);
        return y === null
          ? null
          : ({ insideTunnel: false, layer: "surface", y } as const);
      })())
    : null;
  const canMove = requestedGround !== null;
  const x = canMove ? nextCandidateX : state.x;
  const z = canMove ? nextCandidateZ : state.z;
  const currentGround = canMove
    ? requestedGround
    : (environment.resolveGround?.(
        x,
        z,
        state.groundLayer,
        state.groundY,
      ) ?? null);
  const groundY = currentGround?.y ?? state.groundY;
  const groundLayer = currentGround?.layer ?? state.groundLayer;
  const insideTunnel = currentGround?.insideTunnel ?? state.insideTunnel;

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

  if (
    grounded &&
    groundLayer === "surface" &&
    pedestrianPointIsWater(x, z, environment.water)
  ) {
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
    groundLayer !== state.groundLayer ||
    insideTunnel !== state.insideTunnel ||
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
      groundLayer,
      groundY,
      insideTunnel,
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
    sprint: keys.has("Shift"),
    strafe: (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0),
    turn:
      (keys.has("ArrowRight") || keys.has("e") ? 1 : 0) -
      (keys.has("ArrowLeft") || keys.has("q") ? 1 : 0),
  };
}

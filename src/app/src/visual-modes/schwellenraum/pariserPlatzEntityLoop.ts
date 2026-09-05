import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  type BufferGeometry,
  type Camera,
  CylinderGeometry,
  DynamicDrawUsage,
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { SchwellenraumDetailProfile } from "./presentation";

type LocalPoint = readonly [number, number];

export type PariserPlatzEntityKind =
  | "cargo-bike"
  | "car"
  | "cyclist"
  | "fountain"
  | "pedestrian"
  | "rickshaw"
  | "stroller";

type RouteRole =
  | "central-crossing"
  | "central-orbit"
  | "garden-promenade"
  | "outer-road"
  | "outer-promenade";

export type PariserPlatzEntityRoute = {
  id: string;
  points: readonly LocalPoint[];
  role: RouteRole;
};

type PreparedRoute = PariserPlatzEntityRoute & {
  cumulativeLengths: number[];
  lengthM: number;
};

type MoverSpec = {
  kind: Exclude<PariserPlatzEntityKind, "fountain">;
  lapsPerLoop: number;
  lateralOffsetM: number;
  pausePhase: number;
  pauseStrength: number;
  phase: number;
  routeId: string;
  scale: number;
};

type EntityBatch = {
  kind: PariserPlatzEntityKind;
  mesh: InstancedMesh;
  movers: readonly MoverSpec[];
};

export type PariserPlatzEntityLoop = {
  batches: readonly EntityBatch[];
  detailProfile: SchwellenraumDetailProfile;
  fountainInstanceCount: number;
  group: Group;
  movingInstanceCount: number;
};

export type PariserPlatzLoopScreenScratch = {
  frustum: Frustum;
  projection: Matrix4;
  sphere: Sphere;
};

const CENTRE_WORLD_M = [497.05, 5.03, 294.5] as const;
const ROTATION_Y = 0.087;
const LOOP_DURATION_SECONDS = 94.813;
const TWO_PI = Math.PI * 2;
const LOOP_FIELD_KEY = "pariserPlatzEntityLoop";

export const PARISER_PLATZ_ENTITY_INITIAL_TIME_SECONDS = 18.4;

function worldToLocal(world: readonly [number, number]): LocalPoint {
  const dx = world[0] - CENTRE_WORLD_M[0];
  const dz = world[1] - CENTRE_WORLD_M[2];
  const cosine = Math.cos(ROTATION_Y);
  const sine = Math.sin(ROTATION_Y);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

/**
 * The clip is evidence for motion character and traffic mix only. It is never
 * copied, decoded or requested by the shipped viewer.
 */
export const PARISER_PLATZ_ENTITY_LOOP_PROFILE = {
  centreWorldM: CENTRE_WORLD_M,
  rotationY: ROTATION_Y,
  loopDurationSeconds: LOOP_DURATION_SECONDS,
  boundsLocalM: {
    x: [-102, 102] as const,
    z: [-64, 64] as const,
  },
  gardens: [
    {
      centreLocalM: worldToLocal([500.7, 334.1]),
      centreWorldM: [500.7, 334.1] as const,
      sizeM: [74.3, 22.6] as const,
    },
    {
      centreLocalM: worldToLocal([494.2, 254.9]),
      centreWorldM: [494.2, 254.9] as const,
      sizeM: [75, 23] as const,
    },
  ],
  ownerMotionReference: {
    bundled: false,
    durationSeconds: LOOP_DURATION_SECONDS,
    fileLabel: "IMG_1184.MOV",
    frameTextureCount: 0,
    runtimeAsset: false,
    suppliedOn: "2026-09-04",
    use:
      "motion mix and path cadence only; no frame, photograph or video texture",
  },
  locality:
    "Pariser Platz only; no entity batch is shared with any other district",
  counts: {
    full: {
      "cargo-bike": 3,
      car: 4,
      cyclist: 8,
      fountain: 2,
      pedestrian: 28,
      rickshaw: 3,
      stroller: 4,
    },
    mobile: {
      "cargo-bike": 2,
      car: 2,
      cyclist: 5,
      fountain: 2,
      pedestrian: 16,
      rickshaw: 2,
      stroller: 2,
    },
  },
  budgets: {
    full: {
      drawCalls: 7,
      geometries: 7,
      materials: 7,
      movingInstances: 50,
      totalInstances: 52,
      renderedVertices: 42_000,
    },
    mobile: {
      drawCalls: 7,
      geometries: 7,
      materials: 7,
      movingInstances: 29,
      totalInstances: 31,
      renderedVertices: 25_000,
    },
  },
} as const;

export const PARISER_PLATZ_ENTITY_FRAME_INTERVAL_MS = {
  full: 1_000 / 30,
  mobile: 1_000 / 20,
} as const;

function ellipsePoints(radiusX: number, radiusZ: number, count: number): LocalPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * TWO_PI;
    return [Math.cos(angle) * radiusX, Math.sin(angle) * radiusZ] as const;
  });
}

function gardenPromenade(
  centre: LocalPoint,
  halfWidth: number,
  halfDepth: number,
): LocalPoint[] {
  const [x, z] = centre;
  return [
    [x - halfWidth + 5, z - halfDepth],
    [x + halfWidth - 5, z - halfDepth],
    [x + halfWidth, z - halfDepth + 5],
    [x + halfWidth, z + halfDepth - 5],
    [x + halfWidth - 5, z + halfDepth],
    [x - halfWidth + 5, z + halfDepth],
    [x - halfWidth, z + halfDepth - 5],
    [x - halfWidth, z - halfDepth + 5],
  ];
}

const NORTH_GARDEN = PARISER_PLATZ_ENTITY_LOOP_PROFILE.gardens[1];
const SOUTH_GARDEN = PARISER_PLATZ_ENTITY_LOOP_PROFILE.gardens[0];

export const PARISER_PLATZ_ENTITY_ROUTES: readonly PariserPlatzEntityRoute[] = [
  {
    id: "central-oval",
    points: ellipsePoints(63, 21.5, 32),
    role: "central-orbit",
  },
  {
    id: "central-crossing",
    points: [
      [-74, -2],
      [-47, -23],
      [0, -18],
      [47, -23],
      [74, 2],
      [47, 23],
      [0, 18],
      [-47, 23],
    ],
    role: "central-crossing",
  },
  {
    id: "north-garden-promenade",
    points: gardenPromenade(NORTH_GARDEN.centreLocalM, 44.5, 17),
    role: "garden-promenade",
  },
  {
    id: "south-garden-promenade",
    points: gardenPromenade(SOUTH_GARDEN.centreLocalM, 44.5, 17),
    role: "garden-promenade",
  },
  {
    id: "outer-promenade",
    points: [
      [-80, -57],
      [80, -57],
      [91, -46],
      [91, 46],
      [80, 57],
      [-80, 57],
      [-91, 46],
      [-91, -46],
    ],
    role: "outer-promenade",
  },
  {
    id: "outer-road",
    points: [
      [-84, -62],
      [84, -62],
      [99, -48],
      [99, 48],
      [84, 62],
      [-84, 62],
      [-99, 48],
      [-99, -48],
    ],
    role: "outer-road",
  },
] as const;

function prepareRoute(route: PariserPlatzEntityRoute): PreparedRoute {
  const cumulativeLengths = [0];
  let lengthM = 0;
  for (let index = 0; index < route.points.length; index += 1) {
    const from = route.points[index];
    const to = route.points[(index + 1) % route.points.length];
    lengthM += Math.hypot(to[0] - from[0], to[1] - from[1]);
    cumulativeLengths.push(lengthM);
  }
  return { ...route, cumulativeLengths, lengthM };
}

const PREPARED_ROUTES = new Map(
  PARISER_PLATZ_ENTITY_ROUTES.map((route) => [route.id, prepareRoute(route)]),
);

export type PariserPlatzRouteSample = {
  tangentX: number;
  tangentZ: number;
  x: number;
  z: number;
};

function wrap01(value: number): number {
  return value - Math.floor(value);
}

/** Allocation-free route sampler shared by animation and geometry tests. */
export function samplePariserPlatzEntityRoute(
  routeId: string,
  progress: number,
  output: PariserPlatzRouteSample = {
    tangentX: 0,
    tangentZ: 1,
    x: 0,
    z: 0,
  },
): PariserPlatzRouteSample {
  const route = PREPARED_ROUTES.get(routeId);
  if (!route) throw new Error(`Unknown Pariser Platz loop route: ${routeId}`);
  const targetLength = wrap01(progress) * route.lengthM;
  let segment = route.points.length - 1;
  for (let index = 0; index < route.points.length; index += 1) {
    if (targetLength <= route.cumulativeLengths[index + 1]) {
      segment = index;
      break;
    }
  }
  const from = route.points[segment];
  const to = route.points[(segment + 1) % route.points.length];
  const segmentStart = route.cumulativeLengths[segment];
  const segmentLength = route.cumulativeLengths[segment + 1] - segmentStart;
  const localProgress =
    segmentLength <= Number.EPSILON
      ? 0
      : (targetLength - segmentStart) / segmentLength;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const inverseLength = segmentLength <= Number.EPSILON ? 0 : 1 / segmentLength;
  output.x = from[0] + dx * localProgress;
  output.z = from[1] + dz * localProgress;
  output.tangentX = dx * inverseLength;
  output.tangentZ = dz * inverseLength;
  return output;
}

function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error("Unable to merge Pariser Platz entity geometry");
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function box(
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): BufferGeometry {
  const geometry = new BoxGeometry(...size);
  geometry.translate(...position);
  return geometry;
}

function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: readonly [number, number, number],
  segments = 6,
): BufferGeometry {
  const geometry = new CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    segments,
  );
  geometry.translate(...position);
  return geometry;
}

const ROD_UP = new Vector3(0, 1, 0);

function rod(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radius: number,
  segments = 5,
): BufferGeometry {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const geometry = new CylinderGeometry(
    radius,
    radius,
    direction.length(),
    segments,
  );
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(ROD_UP, direction.normalize()),
  );
  geometry.translate(
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  );
  return geometry;
}

function wheel(
  x: number,
  y: number,
  z: number,
  radius = 0.34,
): BufferGeometry {
  const geometry = new TorusGeometry(radius, 0.045, 4, 10);
  geometry.rotateY(Math.PI / 2);
  geometry.translate(x, y, z);
  return geometry;
}

function transformed(
  geometry: BufferGeometry,
  position: readonly [number, number, number],
  scale: readonly [number, number, number],
): BufferGeometry {
  geometry.scale(...scale);
  geometry.translate(...position);
  return geometry;
}

function createPedestrianGeometry(): BufferGeometry {
  return mergeParts([
    box([0.13, 0.62, 0.14], [-0.09, 0.31, 0]),
    box([0.13, 0.62, 0.14], [0.09, 0.31, 0]),
    cylinder(0.17, 0.23, 0.72, [0, 0.96, 0], 6),
    new SphereGeometry(0.2, 7, 5).translate(0, 1.5, 0),
  ]);
}

function createStrollerGeometry(): BufferGeometry {
  return mergeParts([
    transformed(createPedestrianGeometry(), [-0.32, 0, -0.28], [0.9, 0.9, 0.9]),
    box([0.66, 0.34, 0.64], [0, 0.5, 0.72]),
    box([0.68, 0.08, 0.45], [0, 0.76, 0.6]),
    rod([-0.29, 0.7, 0.38], [-0.29, 1.03, 0.02], 0.035),
    rod([0.29, 0.7, 0.38], [0.29, 1.03, 0.02], 0.035),
    wheel(-0.34, 0.25, 0.54, 0.22),
    wheel(0.34, 0.25, 0.54, 0.22),
    wheel(-0.34, 0.2, 0.94, 0.16),
    wheel(0.34, 0.2, 0.94, 0.16),
  ]);
}

function createBikeGeometry(cargo: boolean): BufferGeometry {
  const parts: BufferGeometry[] = [
    wheel(0, 0.35, -0.5),
    wheel(0, 0.35, 0.55),
    rod([0, 0.35, -0.5], [0, 0.78, 0.08], 0.035),
    rod([0, 0.35, -0.5], [0, 0.35, 0.55], 0.035),
    rod([0, 0.78, 0.08], [0, 0.35, 0.55], 0.035),
    rod([0, 0.78, 0.08], [0, 0.82, 0.48], 0.03),
    cylinder(0.12, 0.15, 0.48, [0, 1.12, 0.03], 6),
    new SphereGeometry(0.15, 6, 4).translate(0, 1.48, 0.05),
  ];
  if (cargo) {
    parts.push(
      box([0.72, 0.48, 0.8], [0, 0.62, 0.96]),
      rod([0, 0.35, 0.55], [0, 0.38, 1.32], 0.035),
      wheel(0, 0.29, 1.35, 0.28),
    );
  }
  return mergeParts(parts);
}

function createRickshawGeometry(): BufferGeometry {
  return mergeParts([
    wheel(-0.62, 0.43, -0.28, 0.42),
    wheel(0.62, 0.43, -0.28, 0.42),
    wheel(0, 0.34, 0.92, 0.31),
    box([1.18, 0.42, 0.86], [0, 0.66, -0.2]),
    box([1.25, 0.1, 0.92], [0, 1.58, -0.2]),
    rod([-0.55, 0.77, -0.56], [-0.55, 1.54, -0.56], 0.035),
    rod([0.55, 0.77, -0.56], [0.55, 1.54, -0.56], 0.035),
    rod([-0.55, 0.77, 0.16], [-0.55, 1.54, 0.16], 0.035),
    rod([0.55, 0.77, 0.16], [0.55, 1.54, 0.16], 0.035),
    cylinder(0.13, 0.16, 0.48, [0, 1.13, 0.48], 6),
    new SphereGeometry(0.15, 6, 4).translate(0, 1.49, 0.48),
  ]);
}

function createCarGeometry(): BufferGeometry {
  const leftWheel = new CylinderGeometry(0.21, 0.21, 0.12, 8);
  leftWheel.rotateZ(Math.PI / 2);
  leftWheel.translate(-0.49, 0.24, -0.52);
  const rightWheel = leftWheel.clone().translate(0.98, 0, 0);
  const frontLeftWheel = leftWheel.clone().translate(0, 0, 1.04);
  const frontRightWheel = rightWheel.clone().translate(0, 0, 1.04);
  return mergeParts([
    box([0.94, 0.46, 1.82], [0, 0.44, 0]),
    box([0.78, 0.42, 0.9], [0, 0.82, -0.08]),
    leftWheel,
    rightWheel,
    frontLeftWheel,
    frontRightWheel,
  ]);
}

function createFountainGeometry(): BufferGeometry {
  const ring = new TorusGeometry(0.52, 0.07, 5, 18);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, 0.08, 0);
  return mergeParts([
    ring,
    cylinder(0.025, 0.075, 2.5, [0, 1.25, 0], 6),
    rod([0.28, 0.08, 0], [0.55, 1.62, 0], 0.035),
    rod([-0.28, 0.08, 0], [-0.55, 1.62, 0], 0.035),
    rod([0, 0.08, 0.28], [0, 1.48, 0.55], 0.035),
    rod([0, 0.08, -0.28], [0, 1.48, -0.55], 0.035),
  ]);
}

const GEOMETRY_FACTORIES: Record<PariserPlatzEntityKind, () => BufferGeometry> = {
  "cargo-bike": () => createBikeGeometry(true),
  car: createCarGeometry,
  cyclist: () => createBikeGeometry(false),
  fountain: createFountainGeometry,
  pedestrian: createPedestrianGeometry,
  rickshaw: createRickshawGeometry,
  stroller: createStrollerGeometry,
};

const ENTITY_TONE: Record<PariserPlatzEntityKind, number> = {
  "cargo-bike": 0x8fcfb1,
  car: 0x93a9bd,
  cyclist: 0xb2d7cf,
  fountain: 0xa9e1dc,
  pedestrian: 0xc1a4ca,
  rickshaw: 0xe05b52,
  stroller: 0xd8b88e,
};

const ROUTES_BY_KIND: Record<Exclude<PariserPlatzEntityKind, "fountain">, readonly string[]> = {
  "cargo-bike": ["outer-promenade", "central-crossing"],
  car: ["outer-road"],
  cyclist: ["central-crossing", "outer-promenade", "central-oval"],
  pedestrian: [
    "central-crossing",
    "central-oval",
    "north-garden-promenade",
    "south-garden-promenade",
    "outer-promenade",
  ],
  rickshaw: ["central-oval", "outer-promenade"],
  stroller: [
    "north-garden-promenade",
    "south-garden-promenade",
    "outer-promenade",
  ],
};

const BASE_LAPS: Record<Exclude<PariserPlatzEntityKind, "fountain">, number> = {
  "cargo-bike": 3,
  car: 2,
  cyclist: 4,
  pedestrian: 1,
  rickshaw: 2,
  stroller: 1,
};

function createMoverSpecs(
  kind: Exclude<PariserPlatzEntityKind, "fountain">,
  count: number,
): MoverSpec[] {
  const routes = ROUTES_BY_KIND[kind];
  const kindSeed = Object.keys(ROUTES_BY_KIND).indexOf(kind) + 1;
  return Array.from({ length: count }, (_, index) => ({
    kind,
    lapsPerLoop: BASE_LAPS[kind] + ((index + kindSeed) % 2),
    lateralOffsetM: (((index * 5 + kindSeed) % 5) - 2) * 0.38,
    pausePhase: wrap01(index * 0.173 + kindSeed * 0.097),
    pauseStrength:
      kind === "pedestrian" || kind === "stroller"
        ? 0.68 + (index % 3) * 0.09
        : 0.18 + (index % 2) * 0.08,
    phase: wrap01(index * 0.61803398875 + kindSeed * 0.137),
    routeId: routes[(index * 3 + kindSeed) % routes.length],
    scale: 0.88 + ((index * 7 + kindSeed) % 5) * 0.055,
  }));
}

function entityMaterial(color: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    fog: false,
    toneMapped: false,
  });
}

function fountainMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: 0xd6f4f0,
    depthWrite: false,
    fog: false,
    opacity: 0.48,
    toneMapped: false,
    transparent: true,
  });
}

function createBatch(
  kind: PariserPlatzEntityKind,
  count: number,
  material: MeshBasicMaterial,
): EntityBatch {
  const movers = kind === "fountain" ? [] : createMoverSpecs(kind, count);
  const mesh = new InstancedMesh(GEOMETRY_FACTORIES[kind](), material, count);
  mesh.name = `Pariser Platz Schwellenraum ${kind} loop`;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.boundingBox = new Box3(
    new Vector3(-104, -0.5, -66),
    new Vector3(104, 4.5, 66),
  );
  mesh.boundingSphere = new Sphere(new Vector3(0, 2, 0), 124);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.pariserPlatzEntityKind = kind;
  mesh.userData.schwellenraumAnimated = true;
  mesh.userData.runtimeTexture = false;
  return { kind, mesh, movers };
}

const UPDATE_POSITION = new Vector3();
const UPDATE_ROTATION = new Quaternion();
const UPDATE_SCALE = new Vector3();
const UPDATE_MATRIX = new Matrix4();
const UPDATE_UP = new Vector3(0, 1, 0);

function normalizedLoopTime(elapsedSeconds: number): number {
  return wrap01(Math.max(0, elapsedSeconds) / LOOP_DURATION_SECONDS);
}

function updateMoverBatch(
  batch: EntityBatch,
  loopTime: number,
  sample: PariserPlatzRouteSample,
): void {
  for (const [index, mover] of batch.movers.entries()) {
    const startWave = Math.sin(TWO_PI * mover.pausePhase);
    const currentWave = Math.sin(TWO_PI * (loopTime + mover.pausePhase));
    const warpedTime =
      loopTime -
      (mover.pauseStrength * (currentWave - startWave)) / TWO_PI;
    const progress = mover.phase + mover.lapsPerLoop * warpedTime;
    samplePariserPlatzEntityRoute(mover.routeId, progress, sample);
    const lateralX = sample.tangentZ * mover.lateralOffsetM;
    const lateralZ = -sample.tangentX * mover.lateralOffsetM;
    const gait = Math.sin(TWO_PI * (progress * 2 + mover.pausePhase));
    const isWalking = mover.kind === "pedestrian" || mover.kind === "stroller";
    const bobM = isWalking ? 0.025 * gait : 0.012 * gait;
    const spectralStretch =
      mover.kind === "pedestrian" && index % 7 === 0
        ? 1 + 0.055 * Math.sin(TWO_PI * (loopTime * 3 + mover.phase))
        : 1;
    UPDATE_POSITION.set(
      sample.x + lateralX,
      bobM,
      sample.z + lateralZ,
    );
    UPDATE_ROTATION.setFromAxisAngle(
      UPDATE_UP,
      Math.atan2(sample.tangentX, sample.tangentZ) +
        (isWalking ? gait * 0.025 : 0),
    );
    UPDATE_SCALE.set(
      mover.scale,
      mover.scale * spectralStretch,
      mover.scale,
    );
    UPDATE_MATRIX.compose(UPDATE_POSITION, UPDATE_ROTATION, UPDATE_SCALE);
    batch.mesh.setMatrixAt(index, UPDATE_MATRIX);
  }
  batch.mesh.instanceMatrix.needsUpdate = true;
}

function updateFountains(batch: EntityBatch, loopTime: number): void {
  const gardens = PARISER_PLATZ_ENTITY_LOOP_PROFILE.gardens;
  for (let index = 0; index < batch.mesh.count; index += 1) {
    const garden = gardens[index % gardens.length];
    const pulse =
      0.91 +
      Math.sin(TWO_PI * (loopTime * 7 + index * 0.31)) * 0.12 +
      Math.sin(TWO_PI * (loopTime * 13 + index * 0.17)) * 0.035;
    UPDATE_POSITION.set(garden.centreLocalM[0], 0, garden.centreLocalM[1]);
    UPDATE_ROTATION.identity();
    UPDATE_SCALE.set(1, pulse, 1);
    UPDATE_MATRIX.compose(UPDATE_POSITION, UPDATE_ROTATION, UPDATE_SCALE);
    batch.mesh.setMatrixAt(index, UPDATE_MATRIX);
  }
  batch.mesh.instanceMatrix.needsUpdate = true;
}

/** Advance every batch from absolute time, keeping the 94.813 s seam exact. */
export function updatePariserPlatzEntityLoop(
  field: PariserPlatzEntityLoop,
  elapsedSeconds: number,
): void {
  const loopTime = normalizedLoopTime(elapsedSeconds);
  const sample: PariserPlatzRouteSample = {
    tangentX: 0,
    tangentZ: 1,
    x: 0,
    z: 0,
  };
  for (const batch of field.batches) {
    if (batch.kind === "fountain") updateFountains(batch, loopTime);
    else updateMoverBatch(batch, loopTime, sample);
  }
}

export function createPariserPlatzEntityLoop(
  detailProfile: SchwellenraumDetailProfile = "full",
): PariserPlatzEntityLoop {
  const group = new Group();
  group.name = "Pariser Platz uncanny public-life loop";
  group.position.set(...CENTRE_WORLD_M);
  group.rotation.y = ROTATION_Y;
  group.userData.onlyAt = "Pariser Platz";
  group.userData.onlyVisualMode = "schwellenraum";
  group.userData.ownerVideoBundled = false;
  group.userData.runtimeAssetCount = 0;
  group.userData.schwellenraumAnimated = true;
  group.userData.collision = false;

  const counts = PARISER_PLATZ_ENTITY_LOOP_PROFILE.counts[detailProfile];
  const sharedFountainMaterial = fountainMaterial();
  const batches = (
    [
      "pedestrian",
      "stroller",
      "cyclist",
      "cargo-bike",
      "rickshaw",
      "car",
      "fountain",
    ] as const
  ).map((kind) =>
    createBatch(
      kind,
      counts[kind],
      kind === "fountain"
        ? sharedFountainMaterial
        : entityMaterial(ENTITY_TONE[kind]),
    ),
  );
  for (const batch of batches) group.add(batch.mesh);

  const field: PariserPlatzEntityLoop = {
    batches,
    detailProfile,
    fountainInstanceCount: counts.fountain,
    group,
    movingInstanceCount:
      counts.pedestrian +
      counts.stroller +
      counts.cyclist +
      counts["cargo-bike"] +
      counts.rickshaw +
      counts.car,
  };
  group.userData[LOOP_FIELD_KEY] = field;
  updatePariserPlatzEntityLoop(
    field,
    PARISER_PLATZ_ENTITY_INITIAL_TIME_SECONDS,
  );
  return field;
}

export function attachPariserPlatzEntityLoop(
  root: Group,
  detailProfile: SchwellenraumDetailProfile,
): PariserPlatzEntityLoop {
  const field = createPariserPlatzEntityLoop(detailProfile);
  root.add(field.group);
  root.userData[LOOP_FIELD_KEY] = field;
  return field;
}

export function pariserPlatzEntityLoopFromRoot(
  root: Group,
): PariserPlatzEntityLoop | null {
  return (root.userData[LOOP_FIELD_KEY] as PariserPlatzEntityLoop | undefined) ?? null;
}

export function createPariserPlatzLoopScreenScratch(): PariserPlatzLoopScreenScratch {
  return {
    frustum: new Frustum(),
    projection: new Matrix4(),
    sphere: new Sphere(),
  };
}

function effectivelyVisible(object: Group): boolean {
  let current: Group["parent"] | Group = object;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

/** Frustum gate keeps the local loop at zero update cost elsewhere in Berlin. */
export function isPariserPlatzEntityLoopOnScreen(
  field: PariserPlatzEntityLoop | null,
  camera: Camera,
  scratch: PariserPlatzLoopScreenScratch,
): boolean {
  if (!field || !effectivelyVisible(field.group)) return false;
  camera.updateMatrixWorld();
  scratch.projection.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  scratch.frustum.setFromProjectionMatrix(scratch.projection);
  scratch.sphere.center.set(CENTRE_WORLD_M[0], CENTRE_WORLD_M[1] + 2, CENTRE_WORLD_M[2]);
  scratch.sphere.radius = 124;
  return scratch.frustum.intersectsSphere(scratch.sphere);
}

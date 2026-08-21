import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

/**
 * Task 07: the real traffic lights. Every OSM `highway=traffic_signals`
 * node inside the bounds becomes one instanced signal — pole, head and
 * three lamps — animated through the German phase sequence
 * red → red+amber → green → amber → red on a slow loop. Per-signal
 * phase offsets come from the surveyed position so junctions never
 * blink in unison; reduced motion pins every signal to green. The
 * lamps are unlit (MeshBasic), so the active one reads emissive at
 * night exactly like the street fixtures.
 */
export const STREET_DETAILS_FILE = "street-details.json?schema=7";

export type TrafficSignalPlacement = {
  offset_dm: number;
  osm_key: string;
  placement: "relocated_verge" | "surveyed_verge" | "verified_island";
  position_dm: [number, number];
  road_clearance_dm: number | null;
  source_dm: [number, number];
  source_on_carriageway?: boolean;
  source_requires_relocation?: boolean;
};

export type StreetDetailsPayload = {
  /** `amenity=biergarten` areas, with the outline the tables stand in. */
  beer_gardens?: Array<{
    area_m2: number;
    /** Unit vector of the outline's long side, in world [x, z]. */
    axis: [number, number];
    d_dm: number;
    name: string;
    /** Simplified exterior ring in world decimetres. */
    ring_dm: Array<[number, number]>;
    w_dm: number;
    x_dm: number;
    z_dm: number;
  }>;
  /** `amenity=fuel` forecourts: centre, axis and the extent to draw on. */
  fuel_stations?: Array<{
    /** Unit vector the canopy's long side follows, in world [x, z]. */
    axis: [number, number];
    d_dm: number;
    name: string;
    /** False when the axis and extent come from the frontage road. */
    surveyed_outline: boolean;
    w_dm: number;
    x_dm: number;
    z_dm: number;
  }>;
  /** OSM monuments/memorials with bbox size (0 for point features). */
  monuments?: Array<{
    d_dm: number;
    kind: string;
    /** OSM `memorial=*` subtype; empty only where the source has none. */
    memorial_type: string;
    name: string;
    /** Stable OSM primitive identity retained across regenerated payloads. */
    osm_element: "node" | "relation" | "way";
    osm_id: string;
    osm_key: string;
    /** True means Schwellenraum must render and collide as ordinary Day. */
    schwellenraum_protected: boolean;
    w_dm: number;
    x_dm: number;
    z_dm: number;
  }>;
  /** Node-only summer bars on the bank, with their surveyed bench rows. */
  riverside_bars?: Array<{
    /** Unit vector of the bank tangent, in world [x, z]. */
    axis: [number, number];
    name: string;
    /** OSM benches near the quay; `len_dm` 0 means a point bench. */
    seats: Array<{
      axis: [number, number];
      len_dm: number;
      x_dm: number;
      z_dm: number;
    }>;
    shore_dist_m: number;
    /** Always false: OSM maps these bars as a single node. */
    surveyed_outline: boolean;
    x_dm: number;
    z_dm: number;
  }>;
  schema_version: number;
  source: string;
  /** Physical display anchors; raw source coordinates remain below for audit. */
  traffic_signal_placements?: TrafficSignalPlacement[];
  /** [x_dm, z_dm] viewer world decimetres. */
  traffic_signals_dm: [number, number][];
};

export const SIGNAL_CYCLE = {
  amber: 4,
  green: 18,
  red: 20,
  redAmber: 2,
} as const;
export const SIGNAL_CYCLE_SECONDS =
  SIGNAL_CYCLE.red + SIGNAL_CYCLE.redAmber + SIGNAL_CYCLE.green + SIGNAL_CYCLE.amber;

const LAMP_ON = [0xff453a, 0xffb63b, 0x30d158] as const;
const LAMP_OFF = [0x381210, 0x33240e, 0x0e2e16] as const;
const POLE_HEIGHT_M = 3.6;
const LAMP_SPACING_M = 0.34;
// Lamp y-centres measured from the ground: red on top.
const LAMP_TOP_M = 3.28;

/** Phase bucket at a cycle time: 0 red, 1 red+amber, 2 green, 3 amber. */
export function signalPhase(cycleSeconds: number): 0 | 1 | 2 | 3 {
  const t =
    ((cycleSeconds % SIGNAL_CYCLE_SECONDS) + SIGNAL_CYCLE_SECONDS) %
    SIGNAL_CYCLE_SECONDS;
  if (t < SIGNAL_CYCLE.red) {
    return 0;
  }
  if (t < SIGNAL_CYCLE.red + SIGNAL_CYCLE.redAmber) {
    return 1;
  }
  if (t < SIGNAL_CYCLE.red + SIGNAL_CYCLE.redAmber + SIGNAL_CYCLE.green) {
    return 2;
  }
  return 3;
}

/** Which lamps burn in a phase: [red, amber, green]. */
export function lampsLit(phase: 0 | 1 | 2 | 3): [boolean, boolean, boolean] {
  if (phase === 0) {
    return [true, false, false];
  }
  if (phase === 1) {
    return [true, true, false];
  }
  if (phase === 2) {
    return [false, false, true];
  }
  return [false, true, false];
}

export function createTrafficSignals(
  street: StreetDetailsPayload,
  ground: VoxelPayload,
): Group | null {
  const sample = worldGroundSampler(ground);
  const placements =
    street.traffic_signal_placements?.length === street.traffic_signals_dm.length
      ? street.traffic_signal_placements
      : street.traffic_signals_dm.map(
          (sourceDm): TrafficSignalPlacement => ({
            offset_dm: 0,
            osm_key: `legacy/${sourceDm[0]}:${sourceDm[1]}`,
            placement: "surveyed_verge",
            position_dm: sourceDm,
            road_clearance_dm: null,
            source_dm: sourceDm,
          }),
        );
  const placed: Array<{
    island: boolean;
    phase: number;
    sourceDm: [number, number];
    x: number;
    y: number;
    yaw: number;
    z: number;
  }> = [];
  for (const placement of placements) {
    const [xDm, zDm] = placement.position_dm;
    const [sourceXDm, sourceZDm] = placement.source_dm;
    const x = xDm / 10;
    const z = zDm / 10;
    const sourceX = sourceXDm / 10;
    const sourceZ = sourceZDm / 10;
    const sampledTarget = sample(x, z);
    const y = sampledTarget ?? sample(sourceX, sourceZ);
    if (y === null) {
      continue;
    }
    // Phase stays tied to the surveyed OSM source, not the display offset.
    const phase =
      (Math.abs(Math.imul(sourceXDm, 2654435761) ^ Math.imul(sourceZDm, 40503)) %
        (SIGNAL_CYCLE_SECONDS * 10)) / 10;
    const towardRoadX = sourceX - x;
    const towardRoadZ = sourceZ - z;
    const yaw =
      Math.hypot(towardRoadX, towardRoadZ) > 0.05
        ? Math.atan2(towardRoadX, towardRoadZ)
        : 0;
    placed.push({
      island: placement.placement === "verified_island",
      phase,
      sourceDm: placement.source_dm,
      x,
      y,
      yaw,
      z,
    });
  }
  if (placed.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "OSM traffic signals";

  const matrix = new Matrix4();
  const poles = new InstancedMesh(
    new BoxGeometry(0.14, POLE_HEIGHT_M, 0.14),
    new MeshStandardMaterial({ color: 0x2f3335, roughness: 0.9 }),
    placed.length,
  );
  poles.name = "traffic signal poles";
  const heads = new InstancedMesh(
    new BoxGeometry(0.46, 3 * LAMP_SPACING_M + 0.28, 0.3),
    new MeshStandardMaterial({ color: 0x1c1e1f, roughness: 0.85 }),
    placed.length,
  );
  heads.name = "traffic signal heads";
  const lamps = new InstancedMesh(
    new BoxGeometry(0.2, 0.2, 0.34),
    new MeshBasicMaterial({ color: 0xffffff }),
    placed.length * 3,
  );
  lamps.name = "traffic signal lamps";
  const islandCount = placed.filter((signal) => signal.island).length;
  const islandBases = new InstancedMesh(
    new CylinderGeometry(0.72, 0.72, 0.12, 8),
    new MeshStandardMaterial({ color: 0xb8b7ae, roughness: 1 }),
    islandCount,
  );
  islandBases.name = "traffic signal verified island bases";
  const color = new Color();
  let islandIndex = 0;
  placed.forEach((signal, index) => {
    const lift = signal.island ? 0.12 : 0;
    matrix.identity();
    matrix.setPosition(signal.x, signal.y + lift + POLE_HEIGHT_M / 2, signal.z);
    poles.setMatrixAt(index, matrix);
    matrix.makeRotationY(signal.yaw);
    matrix.setPosition(
      signal.x,
      signal.y + lift + LAMP_TOP_M - LAMP_SPACING_M,
      signal.z,
    );
    heads.setMatrixAt(index, matrix);
    for (let lamp = 0; lamp < 3; lamp += 1) {
      matrix.makeRotationY(signal.yaw);
      matrix.setPosition(
        signal.x,
        signal.y + lift + LAMP_TOP_M - lamp * LAMP_SPACING_M,
        signal.z,
      );
      lamps.setMatrixAt(index * 3 + lamp, matrix);
      lamps.setColorAt(index * 3 + lamp, color.setHex(LAMP_OFF[lamp]));
    }
    if (signal.island) {
      matrix.identity();
      matrix.setPosition(signal.x, signal.y + 0.06, signal.z);
      islandBases.setMatrixAt(islandIndex, matrix);
      islandIndex += 1;
    }
  });
  for (const mesh of [poles, heads, lamps]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  if (islandCount > 0) {
    islandBases.instanceMatrix.needsUpdate = true;
    islandBases.frustumCulled = false;
    group.add(islandBases);
  } else {
    islandBases.geometry.dispose();
    islandBases.material.dispose();
  }
  if (lamps.instanceColor) {
    lamps.instanceColor.needsUpdate = true;
  }
  group.userData.phases = new Float32Array(placed.map((s) => s.phase));
  group.userData.lastBuckets = new Int8Array(placed.length).fill(-1);
  group.userData.sourceDm = placed.map((signal) => signal.sourceDm);
  return group;
}

/**
 * Advance the lamp colours; cheap because a lamp only rewrites its
 * instance colours when its signal crosses a phase boundary.
 */
export function updateTrafficSignals(
  group: Group,
  seconds: number,
  reducedMotion: boolean,
  lightsOn = true,
): void {
  const lamps = group.getObjectByName("traffic signal lamps");
  if (!(lamps instanceof InstancedMesh) || !lamps.instanceColor) {
    return;
  }
  const phases = group.userData.phases as Float32Array;
  const lastBuckets = group.userData.lastBuckets as Int8Array;
  const color = new Color();
  let dirty = false;
  for (let index = 0; index < phases.length; index += 1) {
    // "Ampeln gedimmt/aus": moonlight still runs the phase clock (so the
    // junction resumes exactly where it should the moment lights come back
    // on) but every lamp renders off regardless of phase, matching every
    // other artificial light in the scene.
    const bucket = reducedMotion ? 2 : signalPhase(seconds + phases[index]);
    const bucketKey = lightsOn ? bucket : -2;
    if (lastBuckets[index] === bucketKey) {
      continue;
    }
    lastBuckets[index] = bucketKey;
    const lit = lightsOn ? lampsLit(bucket) : [false, false, false];
    for (let lamp = 0; lamp < 3; lamp += 1) {
      color.setHex(lit[lamp] ? LAMP_ON[lamp] : LAMP_OFF[lamp]);
      lamps.setColorAt(index * 3 + lamp, color);
    }
    dirty = true;
  }
  if (dirty) {
    lamps.instanceColor.needsUpdate = true;
  }
}

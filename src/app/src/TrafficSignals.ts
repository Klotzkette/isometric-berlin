import {
  BoxGeometry,
  Color,
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
export const STREET_DETAILS_FILE = "street-details.json";

export type StreetDetailsPayload = {
  schema_version: number;
  source: string;
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
  const placed: Array<{ phase: number; x: number; y: number; z: number }> = [];
  for (const [xDm, zDm] of street.traffic_signals_dm) {
    const x = xDm / 10;
    const z = zDm / 10;
    const y = sample(x, z);
    if (y === null) {
      continue;
    }
    // Deterministic per-instance phase offset from the position.
    const phase =
      (Math.abs(Math.imul(xDm, 2654435761) ^ Math.imul(zDm, 40503)) %
        (SIGNAL_CYCLE_SECONDS * 10)) / 10;
    placed.push({ phase, x, y, z });
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
  const color = new Color();
  placed.forEach((signal, index) => {
    matrix.identity();
    matrix.setPosition(signal.x, signal.y + POLE_HEIGHT_M / 2, signal.z);
    poles.setMatrixAt(index, matrix);
    matrix.setPosition(signal.x, signal.y + LAMP_TOP_M - LAMP_SPACING_M, signal.z);
    heads.setMatrixAt(index, matrix);
    for (let lamp = 0; lamp < 3; lamp += 1) {
      matrix.setPosition(
        signal.x,
        signal.y + LAMP_TOP_M - lamp * LAMP_SPACING_M,
        signal.z,
      );
      lamps.setMatrixAt(index * 3 + lamp, matrix);
      lamps.setColorAt(index * 3 + lamp, color.setHex(LAMP_OFF[lamp]));
    }
  });
  for (const mesh of [poles, heads, lamps]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  if (lamps.instanceColor) {
    lamps.instanceColor.needsUpdate = true;
  }
  group.userData.phases = new Float32Array(placed.map((s) => s.phase));
  group.userData.lastBuckets = new Int8Array(placed.length).fill(-1);
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
    const bucket = reducedMotion ? 2 : signalPhase(seconds + phases[index]);
    if (lastBuckets[index] === bucket) {
      continue;
    }
    lastBuckets[index] = bucket;
    const lit = lampsLit(bucket);
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

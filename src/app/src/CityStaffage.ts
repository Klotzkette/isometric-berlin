import {
  Group,
  TorusGeometry,
} from "three";

import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import {
  type Builder,
  addBox,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

/**
 * Sparse illustrative city life. Positions are curated presentation staffage,
 * not mapped/surveyed traffic observations; that distinction is kept on the
 * group itself. Everything is static so distant figures cannot shimmer from
 * animation and the whole layer remains one batched body plus one ink draw.
 */

const BVG_YELLOW = 0xf1cf24;
const VEHICLE_GLASS = 0x436978;
const VEHICLE_DARK = 0x3b4245;
const TYRE = 0x303437;
const SKIN_TONES = [0x5d3828, 0x8b5a3c, 0xb77d59, 0xd7a77d, 0xf0c6a1];
const CLOTHING = [
  0x315d73, 0x8c3e4a, 0xb98f3f, 0x53764f, 0x6b557c, 0xd5c8ad,
];

type Pose = {
  child?: boolean;
  clothing: number;
  heading: number;
  skin: number;
  x: number;
  z: number;
};

const PEOPLE: Pose[] = [
  { x: 585, z: 299, heading: 0.3, skin: 3, clothing: 0 },
  { x: 587, z: 301, heading: 0.2, skin: 0, clothing: 5 },
  { x: 589, z: 301.5, heading: 0.2, skin: 2, clothing: 2, child: true },
  { x: 612, z: 276, heading: -0.7, skin: 4, clothing: 4 },
  { x: 616, z: 274, heading: 2.3, skin: 1, clothing: 1 },
  { x: 98, z: -168, heading: 1.1, skin: 2, clothing: 3 },
  { x: 102, z: -167, heading: 1.1, skin: 0, clothing: 2, child: true },
  { x: -82, z: -660, heading: 2.5, skin: 4, clothing: 1 },
  { x: -78, z: -662, heading: 2.5, skin: 1, clothing: 0 },
  { x: -73, z: -663, heading: 2.5, skin: 3, clothing: 3, child: true },
  { x: 232, z: 1_095, heading: -1.0, skin: 0, clothing: 4 },
  { x: 236, z: 1_092, heading: -1.0, skin: 4, clothing: 2 },
  { x: -720, z: 620, heading: 0.8, skin: 2, clothing: 0 },
  { x: -724, z: 618, heading: 0.8, skin: 1, clothing: 5, child: true },
  { x: -1_810, z: 720, heading: 1.7, skin: 3, clothing: 1 },
  { x: 625, z: 1_690, heading: -0.4, skin: 0, clothing: 3 },
  { x: 1_005, z: -110, heading: 2.6, skin: 4, clothing: 4 },
  { x: 1_009, z: -108, heading: 2.6, skin: 2, clothing: 5 },
];

function groundY(
  sample: (x: number, z: number) => number | null,
  x: number,
  z: number,
): number {
  return sample(x, z) ?? 5.2;
}

function addPerson(
  builder: Builder,
  pose: Pose,
  sample: (x: number, z: number) => number | null,
): void {
  const base = groundY(sample, pose.x, pose.z);
  const scale = pose.child ? 0.72 : 1;
  const height = 1.72 * scale;
  const shoulder = height * 0.67;
  const sin = Math.sin(pose.heading);
  const cos = Math.cos(pose.heading);
  for (const side of [-1, 1]) {
    addBox(
      builder,
      VEHICLE_DARK,
      pose.x + cos * side * 0.11 * scale,
      base + height * 0.2,
      pose.z - sin * side * 0.11 * scale,
      0.13 * scale,
      height * 0.4,
      0.13 * scale,
      pose.heading,
      false,
    );
  }
  addBox(
    builder,
    CLOTHING[pose.clothing % CLOTHING.length],
    pose.x,
    base + shoulder,
    pose.z,
    0.42 * scale,
    height * 0.45,
    0.25 * scale,
    pose.heading,
  );
  addCylinder(
    builder,
    SKIN_TONES[pose.skin % SKIN_TONES.length],
    pose.x,
    base + height - 0.12 * scale,
    pose.z,
    0.14 * scale,
    0.24 * scale,
    8,
  );
}

function addBus(
  builder: Builder,
  sample: (x: number, z: number) => number | null,
  x: number,
  z: number,
  heading: number,
): void {
  const base = groundY(sample, x, z);
  addBox(builder, BVG_YELLOW, x, base + 1.45, z, 11.8, 2.8, 2.55, heading);
  addBox(
    builder,
    VEHICLE_GLASS,
    x,
    base + 2.3,
    z,
    8.7,
    1.08,
    2.6,
    heading,
    false,
  );
  for (const along of [-4.2, 4.2]) {
    for (const across of [-1.28, 1.28]) {
      const wx = x + Math.cos(heading) * along - Math.sin(heading) * across;
      const wz = z + Math.sin(heading) * along + Math.cos(heading) * across;
      addCylinder(builder, TYRE, wx, base + 0.48, wz, 0.48, 0.28, 10);
    }
  }
}

function addCar(
  builder: Builder,
  sample: (x: number, z: number) => number | null,
  x: number,
  z: number,
  heading: number,
  color: number,
): void {
  const base = groundY(sample, x, z);
  addBox(builder, color, x, base + 0.65, z, 4.4, 1.1, 1.8, heading);
  addBox(
    builder,
    VEHICLE_GLASS,
    x - Math.cos(heading) * 0.2,
    base + 1.28,
    z - Math.sin(heading) * 0.2,
    2.2,
    0.66,
    1.55,
    heading,
    false,
  );
}

function addWheel(
  builder: Builder,
  x: number,
  y: number,
  z: number,
  heading: number,
  radius: number,
): void {
  const geometry = new TorusGeometry(radius, 0.035, 5, 10);
  geometry.rotateY(heading);
  geometry.translate(x, y, z);
  paintGeometry(geometry, TYRE);
  builder.parts.push(geometry);
}

function addBike(
  builder: Builder,
  sample: (x: number, z: number) => number | null,
  x: number,
  z: number,
  heading: number,
  scooter = false,
): void {
  const base = groundY(sample, x, z);
  const hx = Math.cos(heading);
  const hz = Math.sin(heading);
  const wheelRadius = scooter ? 0.18 : 0.34;
  const half = scooter ? 0.43 : 0.62;
  addWheel(builder, x - hx * half, base + wheelRadius, z - hz * half, heading, wheelRadius);
  addWheel(builder, x + hx * half, base + wheelRadius, z + hz * half, heading, wheelRadius);
  addBox(
    builder,
    scooter ? 0x5f9d82 : 0x9a5d43,
    x,
    base + (scooter ? 0.2 : 0.48),
    z,
    half * 1.8,
    0.08,
    0.08,
    heading,
    false,
  );
  const stemX = x + hx * half;
  const stemZ = z + hz * half;
  addBox(
    builder,
    VEHICLE_DARK,
    stemX,
    base + (scooter ? 0.65 : 0.8),
    stemZ,
    0.07,
    scooter ? 0.92 : 0.72,
    0.07,
    heading,
    false,
  );
}

function addStroller(
  builder: Builder,
  sample: (x: number, z: number) => number | null,
  x: number,
  z: number,
  heading: number,
): void {
  const base = groundY(sample, x, z);
  addBox(builder, 0x667b8c, x, base + 0.68, z, 0.85, 0.62, 0.58, heading);
  addBox(
    builder,
    0xe2d7c2,
    x - Math.cos(heading) * 0.18,
    base + 1.03,
    z - Math.sin(heading) * 0.18,
    0.52,
    0.32,
    0.62,
    heading,
  );
}

export function createCityStaffage(ground: VoxelPayload): Group | null {
  const sample = worldGroundSampler(ground);
  const builder = createBuilder();
  for (const pose of PEOPLE) addPerson(builder, pose, sample);

  addStroller(builder, sample, 590.5, 300.5, 0.2);
  addStroller(builder, sample, -76, -664, 2.5);
  addBus(builder, sample, -112, -625, 0.3);
  addBus(builder, sample, 555, 374, 0.18);
  addCar(builder, sample, 520, 408, 0.15, 0x516f89);
  addCar(builder, sample, 488, 421, 0.15, 0xc8c1b2);
  addCar(builder, sample, -1_020, 1_070, 1.2, 0x8f4d47);
  addBike(builder, sample, 570, 328, 0.45);
  addBike(builder, sample, -650, 602, 1.1);
  addBike(builder, sample, 252, 1_090, -0.8, true);
  addBike(builder, sample, -90, -650, 2.4, true);

  const group = finishDrawnGroup(builder, { name: "sparse city life" });
  if (!group) return null;
  group.userData.geometryStatus =
    "Illustrative static staffage on mapped surfaces; not observed traffic or survey positions";
  group.userData.peopleCount = PEOPLE.length;
  group.userData.bvgBusCount = 2;
  group.userData.carCount = 3;
  group.userData.bicycleCount = 2;
  group.userData.eScooterCount = 2;
  group.userData.strollerCount = 2;
  return group;
}

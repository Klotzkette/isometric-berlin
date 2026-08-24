import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { markArchitecturalAccentInk } from "./architecturalInk";

type Point3 = readonly [number, number, number];

export type LenneOakTree = {
  crown_radius_m: number;
  height_m: number;
  id: string;
  position: [number, number, number];
  source?: string;
  species?: string | null;
  trunk_radius_m?: number;
};

export type LenneOakDetailProfile = "full" | "mobile";

/**
 * One source fingerprint, one model. The official inventory fixes position,
 * species and measured dimensions; owner photographs only inform silhouette,
 * bark, branching, leaf colour and the small identification plate.
 */
export const LENNE_OAK_PROFILE = {
  catalogue: "strassenbaum",
  commonName: "Trauben-Eiche",
  crownRadiusM: 9.5,
  displayName: "Lenné-Eiche",
  forkHeightM: 11.2,
  heightM: 23,
  locationLabel:
    "Scheidemannstraße / Große Querallee, nahe Carillon und John-Foster-Dulles-Allee",
  longHorizontalBranchReachM: 8.1,
  position: [-274.82, 3.787, 154.97] as const,
  scientificName: "Quercus petraea Liebl.",
  sourceTreeId: "tree-21650",
  trunkRadiusM: 0.5,
} as const;

const UP = new Vector3(0, 1, 0);
const POSITION_TOLERANCE_M = 0.08;

const TRUNK_RINGS = [
  { center: [0, 0, 0] as Point3, radius: 0.74 },
  { center: [0.04, 2.8, 0.03] as Point3, radius: 0.61 },
  { center: [0.1, 6.2, -0.02] as Point3, radius: 0.54 },
  { center: [0.16, 9.4, 0.04] as Point3, radius: 0.49 },
  { center: [0.2, 11.65, 0.08] as Point3, radius: 0.45 },
] as const;

type BranchProfile = {
  baseRadius: number;
  points: readonly Point3[];
  tipRadius: number;
};

// The first two chains form the conspicuous high twin leaders. The next two
// preserve the long right-hand and left-hand limbs visible in the photographs;
// the remaining chains keep the crown open and expose several dead tips.
const BRANCH_PROFILES: readonly BranchProfile[] = [
  {
    baseRadius: 0.43,
    points: [
      [0.16, 10.7, 0.04],
      [-0.25, 13.8, 0.24],
      [-1.08, 17.15, 0.05],
      [-1.95, 20.75, 0.7],
      [-2.45, 22.15, 1.02],
      [-2.55, 22.9, 1.15],
    ],
    tipRadius: 0.055,
  },
  {
    baseRadius: 0.42,
    points: [
      [0.2, 10.95, 0.08],
      [0.95, 14.25, -0.28],
      [1.45, 17.65, -0.72],
      [2.35, 20.55, -1.28],
      [2.95, 21.65, -1.5],
    ],
    tipRadius: 0.06,
  },
  {
    baseRadius: 0.35,
    points: [
      [0.16, 11.8, 0.1],
      [2.4, 13.2, 0.16],
      [4.9, 13.25, 0.42],
      [6.9, 13.55, 0.7],
      [8.1, 14.05, 0.78],
    ],
    tipRadius: 0.055,
  },
  {
    baseRadius: 0.34,
    points: [
      [0.02, 11.45, -0.02],
      [-2.25, 12.85, -0.48],
      [-4.65, 13.25, -1.05],
      [-6.55, 13.9, -1.6],
      [-7.75, 14.55, -1.82],
    ],
    tipRadius: 0.05,
  },
  {
    baseRadius: 0.25,
    points: [
      [-0.7, 15.4, 0.15],
      [-3.05, 16.65, 1.5],
      [-5.2, 17.9, 2.45],
      [-6.75, 19.15, 2.8],
    ],
    tipRadius: 0.045,
  },
  {
    baseRadius: 0.24,
    points: [
      [1.15, 15.35, -0.45],
      [3.25, 16.25, -2.25],
      [5.45, 17.45, -3.65],
      [6.65, 18.1, -4.45],
    ],
    tipRadius: 0.045,
  },
  {
    baseRadius: 0.22,
    points: [
      [0.75, 14.0, -0.2],
      [1.25, 15.2, 2.35],
      [1.8, 16.25, 4.85],
      [2.45, 17.1, 6.25],
    ],
    tipRadius: 0.04,
  },
  {
    baseRadius: 0.21,
    points: [
      [-0.35, 14.25, 0.15],
      [-1.25, 15.45, -2.65],
      [-2.25, 16.55, -5.0],
      [-3.15, 17.45, -6.15],
    ],
    tipRadius: 0.04,
  },
  {
    baseRadius: 0.14,
    points: [
      [-1.1, 17.2, 0.05],
      [-3.25, 19.0, -0.45],
      [-4.65, 20.25, -0.85],
      [-5.25, 21.6, -0.72],
    ],
    tipRadius: 0.025,
  },
  {
    baseRadius: 0.13,
    points: [
      [1.5, 17.4, -0.75],
      [3.65, 18.9, 0.15],
      [5.2, 20.15, 0.72],
      [5.75, 21.05, 0.92],
    ],
    tipRadius: 0.024,
  },
  {
    baseRadius: 0.095,
    points: [
      [-1.9, 19.75, 0.58],
      [-2.85, 21.0, 2.25],
      [-3.15, 22.25, 3.05],
    ],
    tipRadius: 0.018,
  },
  {
    baseRadius: 0.085,
    points: [
      [2.15, 19.7, -1.15],
      [3.45, 20.9, -2.3],
      [3.85, 22.0, -2.8],
    ],
    tipRadius: 0.016,
  },
  {
    baseRadius: 0.1,
    points: [
      [4.85, 13.25, 0.4],
      [5.65, 14.95, 2.0],
      [6.2, 16.1, 2.65],
    ],
    tipRadius: 0.018,
  },
  {
    baseRadius: 0.095,
    points: [
      [6.85, 13.55, 0.7],
      [6.5, 15.55, -0.15],
      [6.75, 17.75, -0.1],
    ],
    tipRadius: 0.016,
  },
  {
    baseRadius: 0.1,
    points: [
      [-4.6, 13.25, -1.05],
      [-5.4, 15.45, -2.75],
      [-5.1, 16.55, -3.45],
    ],
    tipRadius: 0.016,
  },
  {
    baseRadius: 0.085,
    points: [
      [-3.0, 16.65, 1.5],
      [-3.95, 18.15, 3.1],
      [-4.45, 19.0, 4.05],
    ],
    tipRadius: 0.015,
  },
  {
    baseRadius: 0.08,
    points: [
      [1.25, 15.2, 2.35],
      [-0.35, 16.15, 3.15],
      [-1.8, 16.0, 3.55],
    ],
    tipRadius: 0.014,
  },
  {
    baseRadius: 0.075,
    points: [
      [-1.25, 15.45, -2.65],
      [-0.15, 17.15, -3.05],
      [0.45, 18.7, -2.4],
    ],
    tipRadius: 0.014,
  },
] as const;

type CrownCluster = readonly [
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
];

// Deliberately airy and asymmetric. These crowns follow the photographed
// limbs instead of filling the official 19 m crown envelope with one sphere.
const CROWN_CLUSTERS: readonly CrownCluster[] = [
  [-8.1, 15.3, -1.65, 1.55, 0.85, 1.15],
  [-6.3, 16.6, -2.15, 1.55, 1.0, 1.35],
  [-5.25, 18.05, 2.35, 1.45, 1.05, 1.3],
  [-4.4, 19.55, -0.8, 1.45, 1.0, 1.25],
  [-3.2, 17.0, -4.85, 1.5, 1.05, 1.4],
  [-2.55, 18.65, -5.9, 1.45, 1.0, 1.25],
  [-2.9, 20.75, 2.45, 1.35, 0.95, 1.25],
  [-1.75, 21.45, 0.55, 1.35, 1.1, 1.25],
  [-1.0, 18.95, 3.8, 1.55, 1.05, 1.45],
  [-0.55, 16.75, 5.65, 1.55, 0.95, 1.4],
  [0.05, 15.4, -3.25, 1.45, 0.9, 1.35],
  [0.35, 19.0, -2.35, 1.55, 1.1, 1.4],
  [0.7, 21.35, -1.05, 1.35, 1.05, 1.25],
  [1.45, 16.55, 4.75, 1.5, 0.95, 1.35],
  [2.15, 17.65, 6.0, 1.4, 0.9, 1.2],
  [2.5, 20.15, -3.1, 1.5, 1.05, 1.35],
  [3.35, 18.25, -5.0, 1.55, 1.05, 1.4],
  [3.7, 21.0, 0.35, 1.35, 0.95, 1.2],
  [4.8, 19.35, 1.0, 1.5, 1.0, 1.35],
  [5.45, 17.25, -3.4, 1.55, 0.95, 1.35],
  [6.15, 16.2, 2.55, 1.45, 0.9, 1.25],
  [6.75, 18.0, -0.1, 1.45, 0.95, 1.25],
  [8.05, 15.15, 0.75, 1.5, 0.8, 1.15],
  [5.95, 14.85, 2.0, 1.35, 0.8, 1.2],
  [-7.1, 17.15, 0.15, 1.25, 0.85, 1.2],
  [-6.05, 15.7, 1.6, 1.2, 0.78, 1.12],
  [-5.0, 16.4, -3.35, 1.22, 0.82, 1.16],
  [-4.35, 18.85, 4.0, 1.28, 0.9, 1.2],
  [-3.8, 20.35, -2.8, 1.2, 0.86, 1.15],
  [-2.0, 15.85, 3.3, 1.2, 0.8, 1.12],
  [-1.15, 18.0, -3.9, 1.22, 0.85, 1.16],
  [0.2, 17.75, 2.45, 1.25, 0.86, 1.18],
  [1.45, 19.8, 2.85, 1.2, 0.84, 1.1],
  [3.05, 16.05, -2.75, 1.28, 0.82, 1.2],
  [4.45, 16.2, 3.15, 1.24, 0.82, 1.16],
  [6.25, 17.15, 1.6, 1.22, 0.8, 1.12],
] as const;

const FOLIAGE_COLORS = [0x748b45, 0x879c51, 0x657d3d, 0x96a95d] as const;

function closeTo(left: number, right: number, tolerance = 0.02): boolean {
  return Math.abs(left - right) <= tolerance;
}

/** Match by source evidence, not by the compact payload's synthetic index. */
export function isLenneOakTree(tree: LenneOakTree): boolean {
  const [x, , z] = tree.position;
  return (
    tree.source === "berlin_official" &&
    tree.species?.toLowerCase() === "trauben-eiche" &&
    closeTo(x, LENNE_OAK_PROFILE.position[0], POSITION_TOLERANCE_M) &&
    closeTo(z, LENNE_OAK_PROFILE.position[2], POSITION_TOLERANCE_M) &&
    closeTo(tree.height_m, LENNE_OAK_PROFILE.heightM) &&
    closeTo(tree.crown_radius_m, LENNE_OAK_PROFILE.crownRadiusM) &&
    closeTo(
      tree.trunk_radius_m ?? -1,
      LENNE_OAK_PROFILE.trunkRadiusM,
      0.005,
    )
  );
}

function point(values: Point3): Vector3 {
  return new Vector3(values[0], values[1], values[2]);
}

function taperedSegment(
  from: Point3,
  to: Point3,
  bottomRadius: number,
  topRadius: number,
  radialSegments: number,
): BufferGeometry {
  const start = point(from);
  const end = point(to);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const geometry = new CylinderGeometry(
    topRadius,
    bottomRadius,
    length,
    radialSegments,
    1,
    false,
  );
  geometry.applyQuaternion(
    new Quaternion().setFromUnitVectors(UP, direction.normalize()),
  );
  geometry.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2,
  );
  return geometry;
}

function createVeteranTrunkGeometry(
  radialSegments: number,
  subdivisionsPerSpan: number,
): BufferGeometry {
  const levels: { center: Vector3; radius: number }[] = [];
  for (let span = 0; span < TRUNK_RINGS.length - 1; span += 1) {
    const lower = TRUNK_RINGS[span];
    const upper = TRUNK_RINGS[span + 1];
    for (
      let subdivision = span === 0 ? 0 : 1;
      subdivision <= subdivisionsPerSpan;
      subdivision += 1
    ) {
      const amount = subdivision / subdivisionsPerSpan;
      levels.push({
        center: point(lower.center).lerp(point(upper.center), amount),
        radius: lower.radius * (1 - amount) + upper.radius * amount,
      });
    }
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  levels.forEach(({ center, radius }, level) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const furrow =
        1 +
        Math.sin(angle * 5 + level * 0.13) * 0.035 +
        Math.sin(angle * 11 - level * 0.07) * 0.016;
      positions.push(
        center.x + Math.cos(angle) * radius * furrow,
        center.y,
        center.z + Math.sin(angle) * radius * furrow,
      );
      uvs.push(segment / radialSegments, center.y / 11.65);
    }
  });

  const indices: number[] = [];
  for (let level = 0; level < levels.length - 1; level += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      const lower = level * radialSegments + segment;
      const lowerNext = level * radialSegments + next;
      const upper = (level + 1) * radialSegments + segment;
      const upperNext = (level + 1) * radialSegments + next;
      indices.push(lower, upper, lowerNext, lowerNext, upper, upperNext);
    }
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);
  const topCenter = positions.length / 3;
  const top = levels.at(-1)!.center;
  positions.push(top.x, top.y, top.z);
  uvs.push(0.5, 0.5);
  const topRing = (levels.length - 1) * radialSegments;
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments;
    indices.push(bottomCenter, next, segment);
    indices.push(topCenter, topRing + segment, topRing + next);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBranchChain(
  target: BufferGeometry[],
  profile: BranchProfile,
  radialSegments: number,
): void {
  const segmentCount = profile.points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const progress = index / segmentCount;
    const nextProgress = (index + 1) / segmentCount;
    const bottomRadius =
      profile.baseRadius * (1 - progress) + profile.tipRadius * progress;
    const topRadius =
      profile.baseRadius * (1 - nextProgress) +
      profile.tipRadius * nextProgress;
    target.push(
      taperedSegment(
        profile.points[index],
        profile.points[index + 1],
        bottomRadius,
        topRadius,
        radialSegments,
      ),
    );
    if (index > 0 && index < segmentCount - 1) {
      const joint = new SphereGeometry(
        bottomRadius * 1.04,
        radialSegments,
        Math.max(4, Math.floor(radialSegments * 0.65)),
      );
      const [x, y, z] = profile.points[index];
      joint.translate(x, y, z);
      target.push(joint);
    }
  }
}

function mergedGeometry(parts: BufferGeometry[], label: string): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error(`Unable to merge ${label}`);
  }
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function colorizeGeometry(
  source: BufferGeometry,
  colorHex: number,
): BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  const color = new Color(colorHex);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

function oakLeafShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, -0.5);
  shape.lineTo(-0.08, -0.34);
  shape.lineTo(-0.24, -0.3);
  shape.lineTo(-0.13, -0.17);
  shape.lineTo(-0.3, -0.08);
  shape.lineTo(-0.13, 0.02);
  shape.lineTo(-0.29, 0.17);
  shape.lineTo(-0.1, 0.2);
  shape.lineTo(-0.18, 0.38);
  shape.lineTo(0, 0.5);
  shape.lineTo(0.18, 0.38);
  shape.lineTo(0.1, 0.2);
  shape.lineTo(0.29, 0.17);
  shape.lineTo(0.13, 0.02);
  shape.lineTo(0.3, -0.08);
  shape.lineTo(0.13, -0.17);
  shape.lineTo(0.24, -0.3);
  shape.lineTo(0.08, -0.34);
  shape.closePath();
  return shape;
}

function createFoliageGeometry(
  profile: LenneOakDetailProfile,
): BufferGeometry {
  const full = profile === "full";
  const clusters = full
    ? CROWN_CLUSTERS
    : CROWN_CLUSTERS.filter((_, index) => index % 3 === 0 || index === 22);
  const parts: BufferGeometry[] = [];
  clusters.forEach(([x, y, z, scaleX, scaleY, scaleZ], index) => {
    const lobeCount = full ? 5 : 3;
    const radiusScales = full
      ? [0.54, 0.46, 0.4, 0.35, 0.31]
      : [0.62, 0.48, 0.38];
    for (let lobe = 0; lobe < lobeCount; lobe += 1) {
      const angle = index * 1.91 + lobe * 2.18;
      const radiusScale = radiusScales[lobe];
      const geometry = new IcosahedronGeometry(1, 0);
      geometry.scale(
        scaleX * radiusScale,
        scaleY * radiusScale,
        scaleZ * radiusScale,
      );
      geometry.rotateY(angle * 0.37);
      geometry.translate(
        x + Math.cos(angle) * scaleX * 0.42,
        y + (lobe - (lobeCount - 1) / 2) * scaleY * 0.16,
        z + Math.sin(angle) * scaleZ * 0.42,
      );
      parts.push(
        colorizeGeometry(
          geometry,
          FOLIAGE_COLORS[(index + lobe) % FOLIAGE_COLORS.length],
        ),
      );
    }

    const leafCount = full ? 5 : 1;
    for (let leafIndex = 0; leafIndex < leafCount; leafIndex += 1) {
      const angle = index * 2.31 + leafIndex * 2.07;
      const leaf = new ShapeGeometry(oakLeafShape(), 2);
      const size = (full ? 0.4 : 0.34) + ((index + leafIndex) % 3) * 0.035;
      leaf.scale(size, size, size);
      leaf.rotateX(Math.PI / 2 + Math.sin(angle) * 0.42);
      leaf.rotateY(angle * 0.73);
      leaf.rotateZ(angle);
      leaf.translate(
        x + Math.cos(angle) * scaleX * 0.78,
        y + Math.sin(angle * 1.7) * scaleY * 0.54,
        z + Math.sin(angle) * scaleZ * 0.78,
      );
      parts.push(
        colorizeGeometry(
          leaf,
          FOLIAGE_COLORS[(index + leafIndex + 1) % FOLIAGE_COLORS.length],
        ),
      );
    }
  });
  return mergedGeometry(parts, "Lenné-Eiche foliage");
}

function trunkCenterAndRadiusAt(y: number): {
  center: Vector3;
  radius: number;
} {
  for (let index = 0; index < TRUNK_RINGS.length - 1; index += 1) {
    const lower = TRUNK_RINGS[index];
    const upper = TRUNK_RINGS[index + 1];
    if (y > upper.center[1]) {
      continue;
    }
    const amount =
      (y - lower.center[1]) / (upper.center[1] - lower.center[1]);
    return {
      center: point(lower.center).lerp(point(upper.center), amount),
      radius: lower.radius * (1 - amount) + upper.radius * amount,
    };
  }
  const last = TRUNK_RINGS.at(-1)!;
  return { center: point(last.center), radius: last.radius };
}

function createBarkGrooves(profile: LenneOakDetailProfile): LineSegments {
  const positions: number[] = [];
  const grooveCount = profile === "full" ? 22 : 12;
  const levelCount = profile === "full" ? 16 : 9;
  for (let groove = 0; groove < grooveCount; groove += 1) {
    const baseAngle = (groove / grooveCount) * Math.PI * 2;
    for (let level = 0; level < levelCount; level += 1) {
      if ((level + groove * 3) % 11 === 0) {
        continue;
      }
      const jitter = Math.sin(groove * 2.17 + level * 1.31) * 0.07;
      const y0 = 0.18 + (level / levelCount) * 11.25 + jitter;
      const y1 =
        0.18 + ((level + 0.72) / levelCount) * 11.25 + jitter * 0.45;
      for (const y of [y0, y1]) {
        const { center, radius } = trunkCenterAndRadiusAt(y);
        const angle =
          baseAngle +
          Math.sin(level * 1.73 + groove * 0.81) *
            (profile === "full" ? 0.075 : 0.04);
        positions.push(
          center.x + Math.cos(angle) * radius * 1.012,
          y,
          center.z + Math.sin(angle) * radius * 1.012,
        );
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = markArchitecturalAccentInk(
    new LineBasicMaterial({ color: 0x443a31 }),
    0x443a31,
    "micro",
  );
  const grooves = new LineSegments(geometry, material);
  grooves.name = "Lenné-Eiche deep longitudinal bark fissures";
  grooves.userData.vegetation = true;
  return grooves;
}

function createPlaque(): Group {
  const plaque = new Group();
  plaque.name = "Lenné-Eiche botanical identification plaque";
  plaque.position.set(0.1, 2.72, 0.59);

  const backing = new Mesh(
    new BoxGeometry(0.31, 0.225, 0.025),
    new MeshStandardMaterial({
      color: 0x335b3c,
      metalness: 0.04,
      roughness: 0.88,
    }),
  );
  backing.name = "Lenné-Eiche plaque green rim";
  plaque.add(backing);

  const face = new Mesh(
    new BoxGeometry(0.275, 0.19, 0.014),
    new MeshStandardMaterial({ color: 0xf0efe3, roughness: 0.92 }),
  );
  face.name = "Lenné-Eiche plaque pale face";
  face.position.z = 0.019;
  plaque.add(face);

  const textGeometry = new BufferGeometry();
  const lines = [0.055, 0.02, -0.015, -0.05];
  const positions: number[] = [];
  lines.forEach((y, index) => {
    const halfWidth = index === 0 ? 0.095 : index === 3 ? 0.06 : 0.105;
    positions.push(-halfWidth, y, 0.028, halfWidth, y, 0.028);
  });
  textGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  const text = new LineSegments(
    textGeometry,
    markArchitecturalAccentInk(
      new LineBasicMaterial({ color: 0x31563a }),
      0x31563a,
      "micro",
    ),
  );
  text.name = "Lenné-Eiche plaque compact botanical lines";
  plaque.add(text);
  return plaque;
}

function createSnowCaps(): Mesh {
  const parts: BufferGeometry[] = [];
  for (let index = 1; index < CROWN_CLUSTERS.length; index += 3) {
    const [x, y, z, scaleX, scaleY, scaleZ] = CROWN_CLUSTERS[index];
    const cap = new IcosahedronGeometry(1, 0);
    cap.scale(scaleX * 0.58, 0.14, scaleZ * 0.55);
    cap.translate(x, y + scaleY * 0.68, z);
    parts.push(cap);
  }
  const snow = new Mesh(
    mergedGeometry(parts, "Lenné-Eiche snow caps"),
    new MeshStandardMaterial({ color: 0xf3f6f3, roughness: 0.96 }),
  );
  snow.name = "Snowstorm-only Lenné-Eiche branch and crown snow";
  snow.visible = false;
  snow.userData.snowOnly = true;
  snow.userData.snowActive = false;
  return snow;
}

function createBarkGeometry(profile: LenneOakDetailProfile): BufferGeometry {
  const full = profile === "full";
  const radialSegments = full ? 12 : 8;
  const parts: BufferGeometry[] = [
    createVeteranTrunkGeometry(radialSegments, full ? 5 : 3),
  ];

  const roots = full ? 7 : 4;
  for (let index = 0; index < roots; index += 1) {
    const angle = (index / roots) * Math.PI * 2 + 0.24;
    parts.push(
      taperedSegment(
        [Math.cos(angle) * 0.18, 0.34, Math.sin(angle) * 0.18],
        [Math.cos(angle) * 1.55, 0.07, Math.sin(angle) * 1.15],
        0.31,
        0.075,
        radialSegments,
      ),
    );
  }

  const branchCount = full ? BRANCH_PROFILES.length : 6;
  for (let index = 0; index < branchCount; index += 1) {
    addBranchChain(parts, BRANCH_PROFILES[index], radialSegments);
  }

  for (const [x, y, z, radius] of [
    [0.1, 10.9, 0.04, 0.5],
    [-0.3, 13.75, 0.22, 0.34],
    [0.95, 14.2, -0.28, 0.33],
  ] as const) {
    const knot = new SphereGeometry(
      radius,
      radialSegments,
      Math.max(5, Math.floor(radialSegments * 0.7)),
    );
    knot.scale(1.15, 1.05, 1.1);
    knot.translate(x, y, z);
    parts.push(knot);
  }
  return mergedGeometry(parts, "Lenné-Eiche bark and branches");
}

export function createLenneOak(
  tree: LenneOakTree,
  detailProfile: LenneOakDetailProfile = "full",
): Group {
  if (!isLenneOakTree(tree)) {
    throw new Error("Lenné-Eiche model requires the exact official source tree");
  }

  const group = new Group();
  group.name = "Lenné-Eiche exact photo-informed Trauben-Eiche";
  group.position.set(...tree.position);
  group.userData = {
    catalogue: LENNE_OAK_PROFILE.catalogue,
    commonName: LENNE_OAK_PROFILE.commonName,
    crownRadiusM: tree.crown_radius_m,
    detailProfile,
    displayName: LENNE_OAK_PROFILE.displayName,
    forkHeightM: LENNE_OAK_PROFILE.forkHeightM,
    geometryStatus:
      "official Geoportal Berlin tree position, species and dimensions; owner-supplied photographs used as non-bundled visual reference for silhouette, bark, crown, leaves and plaque",
    heightM: tree.height_m,
    locationLabel: LENNE_OAK_PROFILE.locationLabel,
    longHorizontalBranchReachM:
      LENNE_OAK_PROFILE.longHorizontalBranchReachM,
    photoReferencesBundled: false,
    recognitionCues: [
      "deep longitudinal bark fissures and flared roots",
      "high twin leaders",
      "long low horizontal eastward limb",
      "airy asymmetric veteran crown with exposed dead tips",
      "olive-green lobed sessile-oak foliage",
      "small pale botanical identification plaque with green rim",
    ],
    scientificName: LENNE_OAK_PROFILE.scientificName,
    source: tree.source,
    sourceTreeId: tree.id,
    trunkRadiusM: tree.trunk_radius_m,
  };

  const bark = new Mesh(
    createBarkGeometry(detailProfile),
    new MeshStandardMaterial({
      color: 0x625644,
      metalness: 0,
      roughness: 1,
    }),
  );
  bark.name = "Lenné-Eiche furrowed trunk, root flare and exposed limbs";
  bark.castShadow = detailProfile === "full";
  bark.userData.vegetation = true;
  group.add(bark);
  group.add(createBarkGrooves(detailProfile));

  const foliage = new Mesh(
    createFoliageGeometry(detailProfile),
    new MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.96,
      side: DoubleSide,
      vertexColors: true,
    }),
  );
  foliage.name = "Lenné-Eiche airy asymmetric lobed oak foliage";
  foliage.castShadow = detailProfile === "full";
  foliage.userData.vegetation = true;
  group.add(foliage);
  group.add(createPlaque());

  if (detailProfile === "full") {
    group.add(createSnowCaps());
  }

  let vertexCount = 0;
  let renderableCount = 0;
  group.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) {
      renderableCount += 1;
      vertexCount += object.geometry.getAttribute("position")?.count ?? 0;
    }
  });
  group.userData.renderableCount = renderableCount;
  group.userData.vertexCount = vertexCount;
  return group;
}

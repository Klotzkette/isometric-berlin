import {
  BoxGeometry,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import {
  type VoxelPayload,
  smoothGroundTopSampler,
} from "./MinecraftVoxelWorld";

import {
  LUDWIG_ERHARD_UFER_WORLD_M,
  PANORAMAWEG_WORLD_M,
  SPREEBOGEN_SHORE_WORLD_M,
  SPREEBOGEN_BANK_SOURCES,
  SPREEBOGEN_PARK_RING_DM,
  spreebogenParkGradeAt,
  spreebogenPromenadeYAt,
  spreebogenLowerPathYAt,
  spreebogenPanoramaYAt,
  spreebogenMinecraftPathCells,
  spreebogenPathSections as sections,
  type SpreebogenPathSection as PathSection,
} from "./spreebogenBankProfile";

/**
 * OSM way 737280675 plus the landscape design documented by Berlin and
 * w+s Landschaftsarchitekten. The two circle-segment lawns rise toward the
 * Spree and leave the former Alsenstrasse axis open between Corten-steel walls.
 */
export const SPREEBOGEN_PARK_PROFILE = {
  name: "Spreebogenpark",
  osmWayId: "737280675",
  lawnRows: 28,
  southZ: -278,
  northZ: -414,
  centreX: 20,
  landscapeWindowWidthM: 17,
  maximumRiseM: 5,
  ludwigErhardUferWayIds: ["34834265", "1128036906"],
  panoramawegWayId: "4395332",
  panoramawegWidthM: 2.4,
  panoramawegSupportCount: 9,
  gartenspurSlabCount: 16,
  geometryStatus:
    "Exact path axes and OSM shore; continuous lower promenade, upper path up to 5m higher and source-bound lawns. Deck sections, garden edging and intermediate grades are display reconstruction, not a fixture survey",
  sourceUrls: [
    "https://www.openstreetmap.org/way/737280675",
    "https://www.berlin.de/sen/uvk/_assets/natur-gruen/landschaftsplanung/20-gruene-hauptwege/weg-1/flyer_flanieren_entlang_der_stadtspree.pdf",
    "https://www.german-architects.com/de/architecture-news/building-of-the-week/gelassene-weite",
    SPREEBOGEN_BANK_SOURCES.officialDescription,
  ],
} as const;

type Vertex = [number, number, number];

function addTriangle(
  positions: number[],
  first: Vertex,
  second: Vertex,
  third: Vertex,
): void {
  positions.push(...first, ...second, ...third);
}

function addQuad(
  positions: number[],
  first: Vertex,
  second: Vertex,
  third: Vertex,
  fourth: Vertex,
): void {
  addTriangle(positions, first, second, third);
  addTriangle(positions, first, third, fourth);
}

function addBox(
  positions: number[],
  centre: Vertex,
  axis: readonly [number, number],
  length: number,
  height: number,
  width: number,
): void {
  const [ax, az] = axis;
  const nx = -az;
  const nz = ax;
  const halfLength = length / 2;
  const halfHeight = height / 2;
  const halfWidth = width / 2;
  const corner = (u: number, y: number, v: number): Vertex => [
    centre[0] + ax * u + nx * v,
    centre[1] + y,
    centre[2] + az * u + nz * v,
  ];
  const b00 = corner(-halfLength, -halfHeight, -halfWidth);
  const b01 = corner(-halfLength, -halfHeight, halfWidth);
  const b10 = corner(halfLength, -halfHeight, -halfWidth);
  const b11 = corner(halfLength, -halfHeight, halfWidth);
  const t00 = corner(-halfLength, halfHeight, -halfWidth);
  const t01 = corner(-halfLength, halfHeight, halfWidth);
  const t10 = corner(halfLength, halfHeight, -halfWidth);
  const t11 = corner(halfLength, halfHeight, halfWidth);
  addQuad(positions, b00, b10, b11, b01);
  addQuad(positions, t00, t01, t11, t10);
  addQuad(positions, b00, t00, t10, b10);
  addQuad(positions, b01, b11, t11, t01);
  addQuad(positions, b00, b01, t01, t00);
  addQuad(positions, b10, t10, t11, b11);
}

function pathAxis(
  start: readonly [number, number],
  end: readonly [number, number],
): readonly [number, number, number] {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz) || 1;
  return [dx / length, dz / length, length];
}

function geometryFromPositions(positions: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function upperAtX(x: number): { z: number; y: number } {
  for (let i = 0; i < PANORAMAWEG_WORLD_M.length - 1; i++) {
    const a = PANORAMAWEG_WORLD_M[i],
      b = PANORAMAWEG_WORLD_M[i + 1];
    if (x >= a[0] && x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      return {
        z: a[1] + (b[1] - a[1]) * t + 1.28,
        y:
          spreebogenPanoramaYAt(i) * (1 - t) +
          spreebogenPanoramaYAt(i + 1) * t +
          0.1,
      };
    }
  }
  const i = x < PANORAMAWEG_WORLD_M[0][0] ? 0 : PANORAMAWEG_WORLD_M.length - 1;
  return {
    z: PANORAMAWEG_WORLD_M[i][1] + 1.28,
    y: spreebogenPanoramaYAt(i) + 0.1,
  };
}

function lawnPoint(
  side: -1 | 1,
  row: number,
  edge: "inner" | "outer",
  groundAt: (x: number, z: number) => number,
): Vertex {
  const t = row / SPREEBOGEN_PARK_PROFILE.lawnRows;
  const gap = SPREEBOGEN_PARK_PROFILE.landscapeWindowWidthM / 2;
  const distance =
    edge === "inner"
      ? gap
      : gap + 48 + Math.sin(t * Math.PI) * 34 + Math.sin((t * Math.PI) / 2) * 6;
  const x = SPREEBOGEN_PARK_PROFILE.centreX + side * distance;
  const upper = upperAtX(x),
    south = SPREEBOGEN_PARK_PROFILE.southZ;
  const z = south + (upper.z - south) * t;
  const southY = groundAt(x, south) + 0.1;
  // The source terrain already rises; never add the full height difference twice.
  return [x, southY + (upper.y - southY) * (t * t * (3 - 2 * t)), z];
}

function makeLawnGeometry(
  side: -1 | 1,
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row < SPREEBOGEN_PARK_PROFILE.lawnRows; row++) {
    const a = lawnPoint(side, row, "inner", groundAt),
      b = lawnPoint(side, row, "outer", groundAt);
    const c = lawnPoint(side, row + 1, "inner", groundAt),
      d = lawnPoint(side, row + 1, "outer", groundAt);
    const count = Math.ceil(
      Math.max(
        Math.hypot(a[0] - b[0], a[2] - b[2]),
        Math.hypot(c[0] - d[0], c[2] - d[2]),
      ) / 4,
    );
    const at = (p: Vertex, q: Vertex, t: number): Vertex => {
      const x = p[0] + (q[0] - p[0]) * t,
        z = p[2] + (q[2] - p[2]) * t;
      return [x, Math.max(p[1] + (q[1] - p[1]) * t, groundAt(x, z) + 0.18), z];
    };
    for (let i = 0; i < count; i++)
      addQuad(
        positions,
        at(a, b, i / count),
        at(a, b, (i + 1) / count),
        at(c, d, (i + 1) / count),
        at(c, d, i / count),
      );
    // Close the outside turf edge down to retained park terrain.
    const bb: Vertex = [b[0], groundAt(b[0], b[2]) + 0.04, b[2]],
      dd: Vertex = [d[0], groundAt(d[0], d[2]) + 0.04, d[2]];
    addQuad(positions, b, bb, dd, d);
  }
  return geometryFromPositions(positions);
}

function makeParkTerrainGeometry(
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const shape = new Shape(
    SPREEBOGEN_PARK_RING_DM.map(([x, z]) => new Vector2(x / 10, -z / 10)),
  );
  const raw = new ShapeGeometry(shape);
  const geometry = new TessellateModifier(4, 12).modify(raw);
  raw.dispose();
  geometry.rotateX(-Math.PI / 2);
  const a = geometry.getAttribute("position");
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i),
      z = a.getZ(i);
    // The precise lawn ribbon owns the visible river strip. Its independently
    // triangulated backing stays recessed, including at the source boundary.
    const offset = spreebogenPromenadeYAt(x, z) === null ? 0.025 : -0.16;
    a.setY(i, spreebogenParkGradeAt(x, z, groundAt(x, z)) + offset);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

type LawnTriangle = { x: number; z: number; y: number; dx: number; dz: number; dy: number; ex: number; ez: number; ey: number; den: number };
const LAWN_QUERY_CELL_M = 16;

function compileSpreebogenLawnTriangles(
  ground: VoxelPayload,
): Map<string, LawnTriangle[]> {
  const sample = smoothGroundTopSampler(ground);
  const sourceGroundAt = (x: number, z: number): number => sample(
    x / ground.cell_m - ground.grid.min_x_idx,
    z / ground.cell_m - ground.grid.min_z_idx,
  );
  const index = new Map<string, LawnTriangle[]>();
  const cell = LAWN_QUERY_CELL_M;
  for (const side of [-1, 1] as const) {
    const geometry = makeLawnGeometry(side, sourceGroundAt);
    const a = geometry.getAttribute("position");
    for (let i = 0; i < a.count; i += 3) {
      const x = a.getX(i), z = a.getZ(i), y = a.getY(i);
      const dx = a.getX(i + 1) - x, dz = a.getZ(i + 1) - z;
      const ex = a.getX(i + 2) - x, ez = a.getZ(i + 2) - z;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-8) continue;
      const triangle = { x, z, y, dx, dz, ex, ez, den, dy: a.getY(i + 1) - y, ey: a.getY(i + 2) - y };
      const minX = Math.floor(Math.min(x, x + dx, x + ex) / cell);
      const maxX = Math.floor(Math.max(x, x + dx, x + ex) / cell);
      const minZ = Math.floor(Math.min(z, z + dz, z + ez) / cell);
      const maxZ = Math.floor(Math.max(z, z + dz, z + ez) / cell);
      for (let ix = minX; ix <= maxX; ix++) for (let iz = minZ; iz <= maxZ; iz++) {
        const key = `${ix}:${iz}`;
        const bucket = index.get(key) ?? [];
        bucket.push(triangle);
        index.set(key, bucket);
      }
    }
    geometry.dispose();
  }
  return index;
}

/** Compile the actual turf triangles once per environment, never per frame. */
export function createSpreebogenLawnGroundAt(
  ground: VoxelPayload,
): (x: number, z: number) => number | null {
  // Keep source-sampling callbacks in a separate scope: this persistent query
  // must retain only its triangle index, not the decoded ground payload.
  const index = compileSpreebogenLawnTriangles(ground);
  const cell = LAWN_QUERY_CELL_M;
  return (x, z) => {
    let top: number | null = null;
    for (const t of index.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? []) {
      const px = x - t.x, pz = z - t.z;
      const u = (px * t.ez - pz * t.ex) / t.den;
      const v = (t.dx * pz - t.dz * px) / t.den;
      if (u < -1e-8 || v < -1e-8 || u + v > 1 + 1e-8) continue;
      const y = t.y + u * t.dy + v * t.ey;
      top = top === null ? y : Math.max(top, y);
    }
    return top;
  };
}

function makeCortenWallGeometry(
  side: -1 | 1,
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row < SPREEBOGEN_PARK_PROFILE.lawnRows; row += 1) {
    const top0 = lawnPoint(side, row, "inner", groundAt);
    const top1 = lawnPoint(side, row + 1, "inner", groundAt);
    const bottom0: Vertex = [
      top0[0],
      groundAt(top0[0], top0[2]) + 0.08,
      top0[2],
    ];
    const bottom1: Vertex = [
      top1[0],
      groundAt(top1[0], top1[2]) + 0.08,
      top1[2],
    ];
    if (side < 0) {
      addQuad(positions, bottom0, top0, top1, bottom1);
    } else {
      addQuad(positions, top0, bottom0, bottom1, top1);
    }
  }
  return geometryFromPositions(positions);
}

function ribbon(
  positions: number[],
  profile: PathSection[],
  thickness: number,
): void {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i],
      b = profile[i + 1];
    addQuad(positions, a.left, b.left, b.right, a.right);
    const down = (p: Vertex): Vertex => [p[0], p[1] - thickness, p[2]];
    if (thickness > 0) {
      addQuad(
        positions,
        down(a.right),
        down(b.right),
        down(b.left),
        down(a.left),
      );
      addQuad(positions, a.left, down(a.left), down(b.left), b.left);
      addQuad(positions, a.right, b.right, down(b.right), down(a.right));
      if (i === 0)
        addQuad(positions, a.right, down(a.right), down(a.left), a.left);
      if (i === profile.length - 2)
        addQuad(positions, b.left, down(b.left), down(b.right), b.right);
    }
  }
}
const lower2d = LUDWIG_ERHARD_UFER_WORLD_M.map((p) => [p[0], p[2]] as const);
function makeUferEdgeGeometry(): BufferGeometry {
  const positions: number[] = [];
  const profile = sections(
    lower2d,
    (i) => LUDWIG_ERHARD_UFER_WORLD_M[i][1] + 0.09,
    4,
  );
  ribbon(positions, profile, 0.12);
  // Shared corner sections close the entire surface, unlike separately averaged boxes.
  return geometryFromPositions(positions);
}
function closestLower(x: number, z: number): Vertex {
  let best = Infinity,
    result: Vertex = [0, 0, 0];
  for (let i = 0; i < lower2d.length - 1; i++) {
    const a = lower2d[i],
      b = lower2d[i + 1],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)),
    );
    const px = a[0] + dx * t,
      pz = a[1] + dz * t,
      d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      result = [px, spreebogenLowerPathYAt(px, pz) + 0.055, pz];
    }
  }
  return result;
}
function makeBankLawnGeometry(): BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < SPREEBOGEN_SHORE_WORLD_M.length - 1; i++) {
    const a = SPREEBOGEN_SHORE_WORLD_M[i],
      b = SPREEBOGEN_SHORE_WORLD_M[i + 1];
    const la = closestLower(...a),
      lb = closestLower(...b);
    const toward = (p: readonly [number, number], q: Vertex): Vertex => {
      const d = Math.hypot(q[0] - p[0], q[2] - p[1]) || 1;
      return [
        q[0] + ((p[0] - q[0]) * 2.08) / d,
        q[1],
        q[2] + ((p[1] - q[2]) * 2.08) / d,
      ];
    };
    addQuad(
      positions,
      [a[0], la[1], a[1]],
      [b[0], lb[1], b[1]],
      toward(b, lb),
      toward(a, la),
    );
  }
  return geometryFromPositions(positions);
}

function makePanoramawegGeometry(): BufferGeometry {
  const positions: number[] = [];
  const profile = sections(
    PANORAMAWEG_WORLD_M,
    (i) => spreebogenPanoramaYAt(i) + 0.11,
    SPREEBOGEN_PARK_PROFILE.panoramawegWidthM,
  );
  ribbon(positions, profile, 0.22);
  for (let side = 0; side < 2; side++) {
    const edge = profile.map((q) => (side === 0 ? q.left : q.right));
    for (const height of [0.43, 0.75, 1.04]) {
      const p = sections(
        edge.map((v) => [v[0], v[2]]),
        (i) => edge[i][1] + height,
        0.065,
      );
      ribbon(positions, p, 0.055);
    }
    for (let i = 0; i < edge.length - 1; i++) {
      const a = edge[i],
        b = edge[i + 1],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 3.2);
      for (let j = 0; j < n; j++) {
        const t = j / n;
        addBox(
          positions,
          [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t + 0.51,
            a[2] + (b[2] - a[2]) * t,
          ],
          [1, 0],
          0.075,
          1.02,
          0.075,
        );
      }
    }
  }
  for (let i = 0; i < PANORAMAWEG_WORLD_M.length; i += 2) {
    const [x, z] = PANORAMAWEG_WORLD_M[i];
    const top = spreebogenPanoramaYAt(i) - 0.11,
      bottom = spreebogenLowerPathYAt(x, z) + 0.04;
    const h = Math.max(0.18, top - bottom);
    const before = PANORAMAWEG_WORLD_M[Math.max(0, i - 1)],
      after =
        PANORAMAWEG_WORLD_M[Math.min(PANORAMAWEG_WORLD_M.length - 1, i + 1)];
    const [ax, az] = pathAxis(before, after);
    addBox(positions, [x, bottom + h / 2, z], [ax, az], 0.6, h, 2.1);
  }
  return geometryFromPositions(positions);
}
function makeGartenspurGeometry(): BufferGeometry {
  const positions: number[] = [];
  // The photographed low garden slabs are on the land strip between the
  // source footpath and shore, never placed on a repeated world-Z row.
  const first = 10,
    last = 28;
  for (let i = 0; i < SPREEBOGEN_PARK_PROFILE.gartenspurSlabCount; i++) {
    const t =
      ((i + 0.5) / SPREEBOGEN_PARK_PROFILE.gartenspurSlabCount) *
        (last - first) +
      first;
    const j = Math.floor(t),
      f = t - j,
      a = SPREEBOGEN_SHORE_WORLD_M[j],
      b = SPREEBOGEN_SHORE_WORLD_M[j + 1];
    const x = a[0] + (b[0] - a[0]) * f,
      z = a[1] + (b[1] - a[1]) * f,
      lower = closestLower(x, z);
    const fraction = i % 2 === 0 ? 0.4 : 0.66;
    const px = x + (lower[0] - x) * fraction,
      pz = z + (lower[2] - z) * fraction;
    const [ax, az] = pathAxis(a, b);
    addBox(
      positions,
      [px, spreebogenLowerPathYAt(px, pz) + 0.12, pz],
      [ax, az],
      6 + (i % 3) * 1.6,
      0.16,
      0.72,
    );
  }
  return geometryFromPositions(positions);
}
function makeRevetmentGeometry(): BufferGeometry {
  const positions: number[] = [];
  const upper = sections(
    PANORAMAWEG_WORLD_M,
    (i) => spreebogenPanoramaYAt(i) - 0.12,
    2.4,
  );
  for (let i = 0; i < upper.length - 1; i++) {
    const a = upper[i].right,
      b = upper[i + 1].right;
    const foot = (p: Vertex): Vertex => {
      const q = closestLower(p[0], p[2]),
        d = Math.hypot(p[0] - q[0], p[2] - q[2]) || 1;
      return [
        q[0] + ((p[0] - q[0]) * 2.2) / d,
        q[1] + 0.035,
        q[2] + ((p[2] - q[2]) * 2.2) / d,
      ];
    };
    const la = foot(a),
      lb = foot(b);
    // The central revetment is sloped stone. On the eastern gallery the
    // garden corridor remains in front of an inset retaining face.
    const inset = (p: Vertex, q: Vertex): Vertex =>
      i < 11
        ? q
        : [p[0] + (p[0] - q[0]) * 0.45, q[1], p[2] + (p[2] - q[2]) * 0.45];
    if (i < 11) addQuad(positions, la, lb, b, a);
    if (i >= 11) {
      // An open gallery still needs its rear ground closure; the lower
      // source promenade is untouched and remains outside this face.
      const backA = inset(a, la),
        backB = inset(b, lb);
      addQuad(
        positions,
        backA,
        backB,
        [backB[0], b[1], backB[2]],
        [backA[0], a[1], backA[2]],
      );
    }
  }
  return geometryFromPositions(positions);
}

function addModeMesh(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  dayMaterial: MeshBasicMaterial,
  nightMaterial: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(geometry, dayMaterial);
  mesh.name = name;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Build the terrain sculpture and its exact-OSM replacement lawn plate. */
export function createSpreebogenPark(
  ground: VoxelPayload,
  _options: { mobileLike?: boolean } = {},
): Group {
  const group = new Group();
  group.name = "Spreebogenpark landscape window";
  group.userData.keepInMinecraft = false;
  group.userData.sourceProfile = SPREEBOGEN_BANK_SOURCES;
  group.userData.profile = SPREEBOGEN_PARK_PROFILE;
  group.userData.geometryStatus = SPREEBOGEN_PARK_PROFILE.geometryStatus;
  const sample = smoothGroundTopSampler(ground);
  const groundAt = (x: number, z: number): number =>
    sample(
      x / ground.cell_m - ground.grid.min_x_idx,
      z / ground.cell_m - ground.grid.min_z_idx,
    );

  const lawnDay = new MeshBasicMaterial({
    color: 0x91c67a,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: DoubleSide,
  });
  const lawnNight = new MeshStandardMaterial({
    color: 0x213822,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.96,
    side: DoubleSide,
  });
  const cortenDay = new MeshBasicMaterial({
    color: 0x4b332d,
    side: DoubleSide,
  });
  const cortenNight = new MeshStandardMaterial({
    color: 0x201918,
    flatShading: true,
    roughness: 0.92,
    side: DoubleSide,
  });
  const concreteDay = new MeshBasicMaterial({ color: 0xbcb9ae });
  const concreteNight = new MeshStandardMaterial({
    color: 0x555550,
    flatShading: true,
    roughness: 0.93,
  });
  const pathDay = new MeshBasicMaterial({ color: 0xd1c9b8 });
  const pathNight = new MeshStandardMaterial({
    color: 0x65615a,
    flatShading: true,
    roughness: 0.94,
  });

  addModeMesh(
    group,
    "Spreebogenpark exact OSM park terrain",
    makeParkTerrainGeometry(groundAt),
    lawnDay,
    lawnNight,
  );
  for (const side of [-1, 1] as const) {
    const lawn = makeLawnGeometry(side, groundAt);
    addModeMesh(
      group,
      `Spreebogenpark ${side < 0 ? "west" : "east"} rising lawn`,
      lawn,
      lawnDay,
      lawnNight,
    );
    const wall = makeCortenWallGeometry(side, groundAt);
    addModeMesh(
      group,
      `Spreebogenpark ${side < 0 ? "west" : "east"} Corten wall`,
      wall,
      cortenDay,
      cortenNight,
    );
    const edges = new LineSegments(
      new EdgesGeometry(wall, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
      markArchitecturalInk(new LineBasicMaterial(), "silhouette"),
    );
    edges.name = `Spreebogenpark ${side < 0 ? "west" : "east"} wall ink`;
    edges.renderOrder = 2;
    group.add(edges);
  }

  addModeMesh(
    group,
    "Spreebogenpark maintained river lawn strip",
    makeBankLawnGeometry(),
    lawnDay,
    lawnNight,
  );
  addModeMesh(
    group,
    "Spreebogenpark stone-faced upper bank",
    makeRevetmentGeometry(),
    new MeshBasicMaterial({ color: 0xb3b0a3, side: DoubleSide }),
    new MeshStandardMaterial({
      color: 0x494b44,
      roughness: 0.96,
      side: DoubleSide,
    }),
  );
  const uferEdges = makeUferEdgeGeometry();
  addModeMesh(
    group,
    "Spreebogenpark Ludwig-Erhard-Ufer stone edge bands",
    uferEdges,
    pathDay,
    pathNight,
  );
  const panoramaweg = makePanoramawegGeometry();
  addModeMesh(
    group,
    "Spreebogenpark raised Panoramaweg",
    panoramaweg,
    concreteDay,
    concreteNight,
  );
  const panoramaInk = new LineSegments(
    new EdgesGeometry(panoramaweg, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    markArchitecturalInk(new LineBasicMaterial(), "detail"),
  );
  panoramaInk.name = "Spreebogenpark Panoramaweg ink";
  panoramaInk.renderOrder = 2;
  group.add(panoramaInk);
  const gartenspur = makeGartenspurGeometry();
  addModeMesh(
    group,
    "Spreebogenpark source-bound Gartenspur slabs",
    gartenspur,
    pathDay,
    pathNight,
  );

  // A restrained centre line makes the surviving Alsenstrasse axis legible
  // without inventing street furniture or duplicating the mapped paths.
  const axisGeometry = new BufferGeometry().setFromPoints([
    new Vector3(
      SPREEBOGEN_PARK_PROFILE.centreX,
      groundAt(
        SPREEBOGEN_PARK_PROFILE.centreX,
        SPREEBOGEN_PARK_PROFILE.southZ,
      ) + 0.16,
      SPREEBOGEN_PARK_PROFILE.southZ,
    ),
    new Vector3(
      SPREEBOGEN_PARK_PROFILE.centreX,
      groundAt(
        SPREEBOGEN_PARK_PROFILE.centreX,
        SPREEBOGEN_PARK_PROFILE.northZ,
      ) + 0.16,
      SPREEBOGEN_PARK_PROFILE.northZ,
    ),
  ]);
  const axis = new LineSegments(
    axisGeometry,
    markArchitecturalInk(new LineBasicMaterial({ color: 0x4d4b42 }), "detail"),
  );
  axis.name = "Spreebogenpark former Alsenstrasse axis";
  group.add(axis);
  return group;
}

/** Surface-only, world-axis block reading of the same authored landscape. */
export function createMinecraftSpreebogenPark(
  ground: VoxelPayload,
  options: { mobileLike?: boolean } = {},
): Group {
  const source = createSpreebogenPark(ground, options);
  const blocks = new Map<
    string,
    {
      x: number;
      y: number;
      z: number;
      sx: number;
      sy: number;
      sz: number;
      color: Color;
    }
  >();
  source.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    // Shared conservative cell coverage below owns both complete path decks.
    // Testing only triangle-centre samples left holes along diagonal joints.
    if (object.name === "Spreebogenpark raised Panoramaweg" ||
        object.name === "Spreebogenpark Ludwig-Erhard-Ufer stone edge bands") return;
    const material = object.material as MeshBasicMaterial;
    const a = object.geometry.getAttribute("position");
    const lawn =
      object.name.includes("lawn") || object.name.includes("park terrain");
    const step = lawn
      ? options.mobileLike
        ? 4
        : 2.8
      : options.mobileLike
        ? 2.0
        : 1.4;
    const put = (v: number[], axis: number): void => {
      const p = [...v],
        sizes = [step, step, step];
      if (axis === 1) {
        p[0] = (Math.floor(p[0] / step) + 0.5) * step;
        p[2] = (Math.floor(p[2] / step) + 0.5) * step;
        sizes[1] = 0.24;
        p[1] -= 0.12;
      } else {
        for (let d = 0; d < 3; d++)
          if (d !== axis) p[d] = (Math.floor(p[d] / step) + 0.5) * step;
        sizes[axis] = 0.28;
      }
      const key =
        axis === 1
          // Cell centres have fractional index .5. Rounding those ties makes
          // adjacent 2.8m cells collide when their float errors differ.
          ? `top:${step}:${Math.floor(p[0] / step)}:${Math.floor(p[2] / step)}`
          : `${axis}:${p.map((n) => Math.round(n * 20)).join(":")}`;
      if (axis === 1 && (blocks.get(key)?.y ?? -Infinity) > p[1]) return;
      blocks.set(key, {
        x: p[0],
        y: p[1],
        z: p[2],
        sx: sizes[0],
        sy: sizes[1],
        sz: sizes[2],
        color: material.color,
      });
    };
    for (let i = 0; i < a.count; i += 3) {
      const p = [0, 1, 2].map((j) => [
        a.getX(i + j),
        a.getY(i + j),
        a.getZ(i + j),
      ]);
      const u = p[1].map((n, j) => n - p[0][j]),
        v = p[2].map((n, j) => n - p[0][j]);
      const n = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      let axis = 0;
      for (let d = 1; d < 3; d++)
        if (Math.abs(n[d]) > Math.abs(n[axis])) axis = d;
      if (Math.abs(n[axis]) < 1e-7) continue;
      const dims = [0, 1, 2].filter((d) => d !== axis),
        [d0, d1] = dims;
      const min0 = Math.floor(Math.min(...p.map((q) => q[d0])) / step),
        max0 = Math.floor(Math.max(...p.map((q) => q[d0])) / step);
      const min1 = Math.floor(Math.min(...p.map((q) => q[d1])) / step),
        max1 = Math.floor(Math.max(...p.map((q) => q[d1])) / step);
      let hits = 0;
      for (let j = min0; j <= max0; j++)
        for (let k = min1; k <= max1; k++) {
          const b0 = (j + 0.5) * step,
            b1 = (k + 0.5) * step;
          const e0 = p[1][d0] - p[0][d0],
            e1 = p[1][d1] - p[0][d1],
            f0 = p[2][d0] - p[0][d0],
            f1 = p[2][d1] - p[0][d1];
          const den = e0 * f1 - e1 * f0,
            du = b0 - p[0][d0],
            dv = b1 - p[0][d1];
          const s = (du * f1 - dv * f0) / den,
            t = (e0 * dv - e1 * du) / den;
          if (s < 0 || t < 0 || s + t > 1) continue;
          const q = [0, 0, 0];
          q[d0] = b0;
          q[d1] = b1;
          q[axis] =
            p[0][axis] +
            s * (p[1][axis] - p[0][axis]) +
            t * (p[2][axis] - p[0][axis]);
          put(q, axis);
          hits++;
        }
      if (!hits && !lawn)
        put(
          p[0].map((_, d) => (p[0][d] + p[1][d] + p[2][d]) / 3),
          axis,
        );
    }
  });
  const railColor = new Color(0x858781),
    concrete = new Color(0xbcb9ae);
  const nativeBox = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Color,
    key: string,
  ): void => {
    blocks.set(key, { x, y, z, sx, sy, sz, color });
  };
  const pathCells = spreebogenMinecraftPathCells(options.mobileLike);
  const pathStep = options.mobileLike ? 2 : 1.4;
  const cellsByPosition = new Map<string, typeof pathCells[number][]>();
  for (const cell of pathCells) {
    const key = `${Math.floor(cell.x / pathStep)}:${Math.floor(cell.z / pathStep)}`;
    const at = cellsByPosition.get(key) ?? [];
    at.push(cell);
    cellsByPosition.set(key, at);
  }
  // Quantized lawn, stone and garden cells can straddle a path. Trim those
  // backing blocks below the shared deck, preserving its uninterrupted top.
  for (const [key, block] of blocks) {
    let cap = Infinity;
    const bottom = block.y - block.sy / 2;
    for (let x = Math.floor((block.x - block.sx / 2 + 1e-6) / pathStep);
      x <= Math.floor((block.x + block.sx / 2 - 1e-6) / pathStep); x++) {
      for (let z = Math.floor((block.z - block.sz / 2 + 1e-6) / pathStep);
        z <= Math.floor((block.z + block.sz / 2 - 1e-6) / pathStep); z++) {
        for (const deck of cellsByPosition.get(`${x}:${z}`) ?? []) {
          if (bottom < deck.y + 0.5) cap = Math.min(cap, deck.y - 0.02);
        }
      }
    }
    if (block.y + block.sy / 2 <= cap) continue;
    if (bottom >= cap) blocks.delete(key);
    else {
      block.sy = cap - bottom;
      block.y = (bottom + cap) / 2;
    }
  }
  for (const [i, cell] of pathCells.entries()) nativeBox(
    cell.x, cell.y - 0.12, cell.z, cell.size, 0.24, cell.size,
    cell.kind === "upper" ? concrete : new Color(0xd1c9b8), `path-deck:${i}`,
  );
  for (let i = 0; i < PANORAMAWEG_WORLD_M.length - 1; i++) {
    const a = PANORAMAWEG_WORLD_M[i],
      b = PANORAMAWEG_WORLD_M[i + 1];
    const [ax, az, length] = pathAxis(a, b),
      step = options.mobileLike ? 1.8 : 1.2,
      count = Math.ceil(length / step);
    for (let j = 0; j <= count; j++) {
      const t = j / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      const y =
        spreebogenPanoramaYAt(i) * (1 - t) +
        spreebogenPanoramaYAt(i + 1) * t +
        0.11;
      for (const side of [-1, 1]) {
        const px = x - az * 1.12 * side,
          pz = z + ax * 1.12 * side;
        nativeBox(
          px,
          y + 1.0,
          pz,
          Math.abs(ax) > Math.abs(az) ? step + 0.15 : 0.16,
          0.16,
          Math.abs(ax) > Math.abs(az) ? 0.16 : step + 0.15,
          railColor,
          `rail:${i}:${j}:${side}`,
        );
        if (j % 3 === 0)
          nativeBox(
            px,
            y + 0.5,
            pz,
            0.18,
            1,
            0.18,
            railColor,
            `post:${i}:${j}:${side}`,
          );
      }
    }
  }
  for (let i = 0; i < PANORAMAWEG_WORLD_M.length; i += 2) {
    const [x, z] = PANORAMAWEG_WORLD_M[i],
      bottom = spreebogenLowerPathYAt(x, z) + 0.04,
      top = spreebogenPanoramaYAt(i) - 0.11;
    nativeBox(
      x,
      (top + bottom) / 2,
      z,
      0.7,
      Math.max(0.2, top - bottom),
      2.2,
      concrete,
      `support:${i}`,
    );
  }
  const group = new Group();
  group.name = "Minecraft Spreebogenpark maintained bank";
  group.userData.sourceProfile = SPREEBOGEN_BANK_SOURCES;
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const mesh = new InstancedMesh(geometry, material, blocks.size),
    matrix = new Matrix4();
  let i = 0;
  for (const b of blocks.values()) {
    matrix.makeScale(b.sx, b.sy, b.sz);
    matrix.setPosition(b.x, b.y, b.z);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, b.color);
    i++;
  }
  mesh.name = "Minecraft Spreebogenpark surface blocks";
  mesh.frustumCulled = false;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  group.userData.blockCount = blocks.size;
  const materials = new Set<MeshBasicMaterial | MeshStandardMaterial>();
  source.traverse((o) => {
    if (o instanceof Mesh || o instanceof LineSegments) {
      o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) materials.add(m as MeshBasicMaterial);
      if (o.userData.nightMaterial) materials.add(o.userData.nightMaterial);
    }
  });
  for (const m of materials) m.dispose();
  return group;
}

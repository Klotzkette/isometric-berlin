import {
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

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
  maximumRiseM: 6.8,
  ludwigErhardUferWayIds: ["34834265", "1128036906"],
  panoramawegWayId: "4395332",
  panoramawegWidthM: 2.4,
  panoramawegSupportCount: 9,
  gartenspurSlabCount: 18,
  geometryStatus:
    "OSM-bounded rising lawns and exact path axes; Panoramaweg elevation, supports and Gartenspur slab rhythm are source-bounded presentation reconstruction rather than a fixture survey",
  sourceUrls: [
    "https://www.openstreetmap.org/way/737280675",
    "https://www.berlin.de/sen/uvk/_assets/natur-gruen/landschaftsplanung/20-gruene-hauptwege/weg-1/flyer_flanieren_entlang_der_stadtspree.pdf",
    "https://www.german-architects.com/de/architecture-news/building-of-the-week/gelassene-weite",
  ],
} as const;

const LUDWIG_ERHARD_UFER_WORLD_M = [
  [268.89, 1.692, -317.78],
  [240.53, 1.86, -345.51],
  [198.6, 2.086, -376.21],
  [154.86, 2.237, -397.92],
  [123.4, 1.982, -409.83],
  [106.26, 2.16, -414.97],
  [86.51, 2.164, -419.46],
  [75.63, 2.129, -420.57],
  [41.91, 2.308, -421.66],
  [23.85, 2.362, -421.39],
  [15.07, 2.353, -420.69],
  [-0.7, 2.382, -418.45],
  [-36.98, 2.35, -409.76],
  [-60.73, 2.101, -398.32],
  [-88.06, 1.867, -381.07],
  [-101.12, 1.864, -369.88],
  [-117.12, 1.927, -353.66],
  [-120.98, 2.005, -348.44],
  [-121.24, 2.031, -343.09],
  [-122.65, 2.081, -340.58],
  [-124.93, 2.139, -337.69],
  [-129.97, 2.066, -336.05],
  [-139.87, 2.214, -323.67],
] as const;

const PANORAMAWEG_WORLD_M = [
  [-124.22, -325.56],
  [-98.49, -360.63],
  [-84.53, -372.27],
  [-70.48, -381.67],
  [-55.74, -390.26],
  [-46.62, -394.77],
  [-38.07, -398.56],
  [-20.48, -405.16],
  [-7.26, -408.73],
  [8.02, -411.42],
  [22.26, -412.29],
  [51.8, -412.48],
  [78.25, -411.51],
  [94.85, -409.16],
  [121.64, -402.9],
  [137.36, -397.98],
  [154.08, -391.58],
] as const;

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

function lawnPoint(
  side: -1 | 1,
  row: number,
  edge: "inner" | "outer",
  groundAt: (x: number, z: number) => number,
): Vertex {
  const t = row / SPREEBOGEN_PARK_PROFILE.lawnRows;
  const eased = Math.sin((t * Math.PI) / 2);
  const circularBow = Math.sin(t * Math.PI);
  const z =
    SPREEBOGEN_PARK_PROFILE.southZ +
    (SPREEBOGEN_PARK_PROFILE.northZ - SPREEBOGEN_PARK_PROFILE.southZ) * t;
  // The paired lawns are circle segments, not wedges. Their outer edges bow
  // away from the former Alsenstrasse and taper again at the Spree promenade.
  const halfGap = SPREEBOGEN_PARK_PROFILE.landscapeWindowWidthM / 2;
  const distance =
    edge === "inner" ? halfGap : halfGap + 48 + circularBow * 34 + eased * 6;
  const x = SPREEBOGEN_PARK_PROFILE.centreX + side * distance;
  const ground = groundAt(x, z);
  const rise = SPREEBOGEN_PARK_PROFILE.maximumRiseM * eased * eased;
  return [x, ground + 0.1 + rise, z];
}

function makeLawnGeometry(
  side: -1 | 1,
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (let row = 0; row < SPREEBOGEN_PARK_PROFILE.lawnRows; row += 1) {
    const inner0 = lawnPoint(side, row, "inner", groundAt);
    const outer0 = lawnPoint(side, row, "outer", groundAt);
    const inner1 = lawnPoint(side, row + 1, "inner", groundAt);
    const outer1 = lawnPoint(side, row + 1, "outer", groundAt);
    if (side < 0) {
      addQuad(positions, outer0, inner0, inner1, outer1);
    } else {
      addQuad(positions, inner0, outer0, outer1, inner1);
    }
  }
  return geometryFromPositions(positions);
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

function makeUferEdgeGeometry(): BufferGeometry {
  const positions: number[] = [];
  for (
    let index = 0;
    index < LUDWIG_ERHARD_UFER_WORLD_M.length - 1;
    index += 1
  ) {
    const start = LUDWIG_ERHARD_UFER_WORLD_M[index];
    const end = LUDWIG_ERHARD_UFER_WORLD_M[index + 1];
    const [ax, az, length] = pathAxis([start[0], start[2]], [end[0], end[2]]);
    const nx = -az;
    const nz = ax;
    for (const side of [-1, 1]) {
      const offset = side * (2 - 0.11);
      addBox(
        positions,
        [
          (start[0] + end[0]) / 2 + nx * offset,
          (start[1] + end[1]) / 2 + 0.08,
          (start[2] + end[2]) / 2 + nz * offset,
        ],
        [ax, az],
        length + 0.08,
        0.16,
        0.22,
      );
    }
  }
  return geometryFromPositions(positions);
}

function panoramaDeckY(
  index: number,
  groundAt: (x: number, z: number) => number,
): number {
  const [x, z] = PANORAMAWEG_WORLD_M[index];
  const t = index / (PANORAMAWEG_WORLD_M.length - 1);
  return groundAt(x, z) + 0.22 + 4.55 * Math.sin(t * Math.PI) ** 1.35;
}

function makePanoramawegGeometry(
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (let index = 0; index < PANORAMAWEG_WORLD_M.length - 1; index += 1) {
    const start = PANORAMAWEG_WORLD_M[index];
    const end = PANORAMAWEG_WORLD_M[index + 1];
    const [ax, az, length] = pathAxis(start, end);
    const nx = -az;
    const nz = ax;
    const y =
      (panoramaDeckY(index, groundAt) + panoramaDeckY(index + 1, groundAt)) / 2;
    addBox(
      positions,
      [(start[0] + end[0]) / 2, y, (start[1] + end[1]) / 2],
      [ax, az],
      length + 0.08,
      0.22,
      SPREEBOGEN_PARK_PROFILE.panoramawegWidthM,
    );
    for (const side of [-1, 1]) {
      const offset =
        side * (SPREEBOGEN_PARK_PROFILE.panoramawegWidthM / 2 - 0.08);
      addBox(
        positions,
        [
          (start[0] + end[0]) / 2 + nx * offset,
          y + 0.78,
          (start[1] + end[1]) / 2 + nz * offset,
        ],
        [ax, az],
        length + 0.04,
        0.1,
        0.1,
      );
    }
  }
  for (let index = 0; index < PANORAMAWEG_WORLD_M.length; index += 2) {
    const [x, z] = PANORAMAWEG_WORLD_M[index];
    const topY = panoramaDeckY(index, groundAt) - 0.11;
    const bottomY = groundAt(x, z) + 0.08;
    const height = Math.max(0.18, topY - bottomY);
    addBox(positions, [x, bottomY + height / 2, z], [1, 0], 0.72, height, 1.7);
  }
  return geometryFromPositions(positions);
}

function makeGartenspurGeometry(
  groundAt: (x: number, z: number) => number,
): BufferGeometry {
  const positions: number[] = [];
  for (
    let index = 0;
    index < SPREEBOGEN_PARK_PROFILE.gartenspurSlabCount;
    index += 1
  ) {
    const row = index % 3;
    const column = Math.floor(index / 3);
    const x = -109 + column * 64 + row * 7;
    const z = -412.6 + row * 3.25 + (column % 2) * 0.7;
    const length = 24 + ((index * 7) % 13);
    addBox(positions, [x, groundAt(x, z) + 0.1, z], [1, 0], length, 0.18, 0.9);
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

/** Build the missing terrain sculpture without replacing the OSM lawn plate. */
export function createSpreebogenPark(ground: VoxelPayload): Group {
  const group = new Group();
  group.name = "Spreebogenpark landscape window";
  group.userData.keepInMinecraft = true;
  group.userData.profile = SPREEBOGEN_PARK_PROFILE;
  group.userData.geometryStatus = SPREEBOGEN_PARK_PROFILE.geometryStatus;
  const sample = worldGroundSampler(ground);
  const groundAt = (x: number, z: number): number => sample(x, z) ?? 4.8;

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

  const uferEdges = makeUferEdgeGeometry();
  addModeMesh(
    group,
    "Spreebogenpark Ludwig-Erhard-Ufer stone edge bands",
    uferEdges,
    pathDay,
    pathNight,
  );
  const panoramaweg = makePanoramawegGeometry(groundAt);
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
  const gartenspur = makeGartenspurGeometry(groundAt);
  addModeMesh(
    group,
    "Spreebogenpark Gartenspur slabs",
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

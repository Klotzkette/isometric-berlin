import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
} from "three";

import {
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import {
  WATER_TOP_Y,
  type VoxelPayload,
  worldGroundSampler,
} from "./MinecraftVoxelWorld";
import {
  HUMBOLDTHAFEN_NORTH_CREST_M,
  HUMBOLDTHAFEN_NORTH_WATERLINE_M,
  HUMBOLDTHAFEN_SOURCES,
  northernHumboldthafenCrestZAt,
} from "./HumboldthafenSources";

export {
  HUMBOLDTHAFEN_NORTH_CREST_M,
  HUMBOLDTHAFEN_NORTH_WATERLINE_M,
  HUMBOLDTHAFEN_ROAD_AXES,
  HUMBOLDTHAFEN_SOURCES,
  LEGACY_WRONG_SANDKRUG_AXIS,
  SANDKRUG_OSM_CARRIAGEWAYS,
  SANDKRUG_OSM_DECK,
  SANDKRUG_STRUCTURE_PROFILE,
  isNorthernHumboldthafenQuayEdge,
} from "./HumboldthafenSources";

/**
 * Source-bound correction for the northern Humboldthafen.
 *
 * Geometry is pinned to committed OSM ways in EPSG:25833, translated with
 * the project's documented world transform (x = E - 389500,
 * z = 5820000 - N). Heights come only from the committed DGM ground context.
 * The Berlin water-construction authority documents a restored Schrägufer
 * with a berm just above the water, but publishes no cross-section here; the
 * mesh therefore depicts only the bank face and never creates a walkable
 * shelf or a replacement collision surface.
 */
const PATHS = [
  {
    id: 237691534,
    kind: "paving_stones",
    points: HUMBOLDTHAFEN_NORTH_CREST_M,
  },
  {
    id: 1087036419,
    kind: "sett",
    points: [
      [-24.372, -869.188],
      [-27.055, -771.68],
    ] as const,
  },
  {
    id: 1087036421,
    kind: "sett",
    points: [
      [-14.651, -857.262],
      [-17.52, -767.737],
    ] as const,
  },
  {
    id: 1087036422,
    kind: "sett-ramp",
    points: [
      [-19.618, -821.52],
      [-19.082, -850.997],
    ] as const,
  },
  {
    id: 1087036423,
    kind: "sett-ramp",
    points: [
      [-21.515, -851.141],
      [-22.046, -821.598],
    ] as const,
  },
  {
    id: 896110818,
    kind: "steps-handrail",
    points: [
      [-23.133, -857.309],
      [-15.975, -857.225],
    ] as const,
  },
  {
    id: 1190534970,
    kind: "sett",
    points: [
      [-14.651, -857.262],
      [-9.508, -849.69],
    ] as const,
  },
  {
    id: 1190534971,
    kind: "steps-no-handrail",
    points: [
      [-9.508, -849.69],
      [-7.452, -847.263],
    ] as const,
  },
] as const;

function crestZAt(x: number): number {
  return northernHumboldthafenCrestZAt(x);
}

function addPathStroke(
  builder: ReturnType<typeof createBuilder>,
  sampleGround: (x: number, z: number) => number | null,
  points: readonly (readonly [number, number])[],
  color: number,
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    const [ax, az] = points[index];
    const [bx, bz] = points[index + 1];
    const run = Math.hypot(bx - ax, bz - az);
    if (run < 0.05) continue;
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    const y = sampleGround(mx, mz);
    if (y === null) continue;
    addBox(
      builder,
      color,
      mx,
      y + 0.055,
      mz,
      run,
      0.035,
      0.16,
      -Math.atan2(bz - az, bx - ax),
      false,
    );
  }
}

export function createNorthernHumboldthafenRefinements(
  ground: VoxelPayload,
): Group {
  const sampleGround = worldGroundSampler(ground);
  const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
  const builder = createBuilder();

  // One continuous visual bank face: water polygon at the toe, OSM crest at
  // the top, and the committed DGM for every top height. No horizontal face
  // is emitted, therefore this cannot become a false walkable berm.
  const positions: number[] = [];
  for (
    let index = 0;
    index < HUMBOLDTHAFEN_NORTH_WATERLINE_M.length - 1;
    index += 1
  ) {
    const [ax, az] = HUMBOLDTHAFEN_NORTH_WATERLINE_M[index];
    const [bx, bz] = HUMBOLDTHAFEN_NORTH_WATERLINE_M[index + 1];
    if (Math.hypot(bx - ax, bz - az) < 0.08) continue;
    const atz = crestZAt(ax);
    const btz = crestZAt(bx);
    const aty = sampleGround(ax, atz);
    const bty = sampleGround(bx, btz);
    if (aty === null || bty === null) continue;
    positions.push(
      ax,
      waterTop + 0.06,
      az,
      bx,
      waterTop + 0.06,
      bz,
      bx,
      bty + 0.025,
      btz,
      ax,
      waterTop + 0.06,
      az,
      bx,
      bty + 0.025,
      btz,
      ax,
      aty + 0.025,
      atz,
    );
  }
  if (positions.length > 0) {
    const slope = new BufferGeometry();
    slope.setAttribute("position", new Float32BufferAttribute(positions, 3));
    // drawnKit's boxes are indexed. A sequential index keeps this custom
    // triangle strip compatible with the one merged harbour mesh.
    slope.setIndex(
      Array.from({ length: positions.length / 3 }, (_, index) => index),
    );
    slope.computeVertexNormals();
    paintGeometry(slope, 0xb8b09b);
    builder.parts.push(slope);
  }

  // Existing Commons views establish the historic post + two-horizontal-rail
  // motif. A 4 m render station matches the source ground quantum; the 1 m
  // vertical quantum is schematic and explicitly not asserted as a fixture
  // survey. All pieces share the bank mesh draw call.
  const railHeight = 1;
  const railRun =
    HUMBOLDTHAFEN_NORTH_CREST_M[1][0] - HUMBOLDTHAFEN_NORTH_CREST_M[0][0];
  const railStations = Math.floor(railRun / ground.cell_m);
  for (let index = 0; index <= railStations; index += 1) {
    const t = index / railStations;
    const x = HUMBOLDTHAFEN_NORTH_CREST_M[0][0] + railRun * t;
    const z = crestZAt(x);
    const y = sampleGround(x, z);
    if (y === null) continue;
    addBox(
      builder,
      0x485154,
      x,
      y + railHeight / 2,
      z,
      0.1,
      railHeight,
      0.1,
      0,
      false,
    );
  }
  const railMidX =
    (HUMBOLDTHAFEN_NORTH_CREST_M[0][0] + HUMBOLDTHAFEN_NORTH_CREST_M[1][0]) / 2;
  const railMidZ = crestZAt(railMidX);
  const railMidY = sampleGround(railMidX, railMidZ);
  if (railMidY !== null) {
    const railRotation = -Math.atan2(
      HUMBOLDTHAFEN_NORTH_CREST_M[1][1] - HUMBOLDTHAFEN_NORTH_CREST_M[0][1],
      railRun,
    );
    for (const height of [0.48, 0.96]) {
      addBox(
        builder,
        0x485154,
        railMidX,
        railMidY + height,
        railMidZ,
        railRun,
        0.075,
        0.075,
        railRotation,
        false,
      );
    }
  }

  for (const path of PATHS) {
    addPathStroke(
      builder,
      sampleGround,
      path.points,
      path.kind.startsWith("steps") ? 0xe6dfce : 0xc7bdab,
    );
  }

  const group =
    finishDrawnGroup(builder, { name: "northern Humboldthafen refinements" }) ??
    new Group();
  group.name = "northern Humboldthafen source-bound refinements";
  group.userData.sources = HUMBOLDTHAFEN_SOURCES;
  group.userData.pathWays = PATHS.map(({ id, kind }) => ({ id, kind }));
  group.userData.waterlineWay = 52189421;
  group.userData.visualOnly = true;
  group.userData.collisionSource =
    "unchanged committed DGM ground context; no collision shelf or walkable berm added";
  group.userData.fixtureDimensionsStatus =
    "railing motif is photo-observed; dimensions are coarse rendering quanta, not surveyed fixture measurements";
  group.userData.staticAllModes = true;
  group.userData.staticAntiFlicker = true;
  group.traverse((object) => {
    object.userData.staticAllModes = true;
    object.userData.staticAntiFlicker = true;
  });
  return group;
}

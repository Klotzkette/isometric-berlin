import {
  BoxGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
import {
  type Builder,
  addBox,
  addCylinder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";

type FacadeWall = {
  dirX: number;
  dirZ: number;
  index: number;
  length: number;
  nx: number;
  nz: number;
  x1: number;
  z1: number;
};

/**
 * Exact Berlin LoD2 envelope plus current OSM semantics for the hotel.
 * Window and entrance details are bounded reconstructions from the two
 * owner-supplied August 2026 photographs, never copied image textures.
 */
export const MEININGER_HOTEL_PROFILE = {
  address: "Ella-Trebe-Strasse 9",
  bodyHeightM: 30.36,
  entranceCanopyDepthM: 2.35,
  entranceCanopyWidthM: 9.2,
  facadeWallBays: {
    0: 5,
    1: 12,
    2: 2,
    11: 6,
    12: 3,
  } as const,
  floorPitchM: 3,
  geometryStatus:
    "Berlin LoD2 footprint and measured height; OSM level count and hotel semantics; photo-bounded facade reconstruction with unsurveyed window and fixture positions",
  groundFloorHeightM: 3.6,
  groundYFallbackM: 4.8,
  levels: 10,
  lod2BuildingId: "DEBE01YYK0002MxA",
  measuredHeightM: 31.082,
  osmWayId: "38383464",
  payloadId: "K0002MxA",
  podiumHeightM: 6.6,
  rooms: 296,
  rotationY: -0.019017052,
  sourceEpsg25833Centroid: [389265.8726035, 5820595.9254495] as const,
  sourceUrls: [
    "https://www.openstreetmap.org/way/38383464",
    "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip",
    "https://www.meininger-hotels.com/de/hotels/berlin/hotel-berlin-hauptbahnhof/",
  ] as const,
  visualReference: "owner-supplied photographs, August 2026",
  world: [-234.1273965, -595.9254495] as const,
  // Decimetre-rounded LoD2 ring transformed into the building's local axis.
  // The stepped south-west side is deliberately retained rather than replaced
  // by the minimum rotated rectangle.
  footprintLocalM: [
    [20.572, -18.869],
    [20.509, 9.337],
    [-29.401, 9.286],
    [-29.472, 0.286],
    [-25.4, -1.192],
    [-23.6, -1.226],
    [-23.514, -1.928],
    [-20.139, -3.292],
    [-18.337, -3.226],
    [-18.352, -4.026],
    [-16.266, -4.766],
    [6.437, -4.798],
    [6.372, -13.498],
  ] as const,
} as const;

function polygonPrismGeometry(
  ring: readonly (readonly [number, number])[],
  bottomY: number,
  height: number,
): ExtrudeGeometry {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: height,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottomY, 0);
  geometry.computeVertexNormals();
  if (!geometry.index) {
    const count = geometry.getAttribute("position").count;
    geometry.setIndex(Array.from({ length: count }, (_, index) => index));
  }
  return geometry;
}

function addPolygonPrism(
  builder: Builder,
  color: number,
  bottomY: number,
  height: number,
): void {
  const geometry = polygonPrismGeometry(
    MEININGER_HOTEL_PROFILE.footprintLocalM,
    bottomY,
    height,
  );
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  builder.edges.push(
    new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
  );
}

function facadeWalls(): FacadeWall[] {
  const ring = MEININGER_HOTEL_PROFILE.footprintLocalM;
  return ring.map(([x1, z1], index) => {
    const [x2, z2] = ring[(index + 1) % ring.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const dirX = dx / length;
    const dirZ = dz / length;
    return {
      dirX,
      dirZ,
      index,
      length,
      nx: dirZ,
      nz: -dirX,
      x1,
      z1,
    };
  });
}

function addWallBox(
  builder: Builder,
  wall: FacadeWall,
  color: number,
  along: number,
  y: number,
  outward: number,
  width: number,
  height: number,
  depth: number,
  inked = false,
  lamp = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(-Math.atan2(wall.dirZ, wall.dirX));
  geometry.translate(
    wall.x1 + wall.dirX * along + wall.nx * outward,
    y,
    wall.z1 + wall.dirZ * along + wall.nz * outward,
  );
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addWindowGrid(
  builder: Builder,
  wall: FacadeWall,
  bays: number,
): { lit: number; total: number } {
  const profile = MEININGER_HOTEL_PROFILE;
  const margin = wall.length < 11 ? 1.25 : 1.8;
  const usable = wall.length - margin * 2;
  const pitch = usable / bays;
  let lit = 0;
  let total = 0;
  for (let floor = 1; floor < profile.levels; floor += 1) {
    const centreY =
      profile.groundFloorHeightM + (floor - 0.5) * profile.floorPitchM;
    const firstPodiumFloor = floor === 1;
    const frameHeight = firstPodiumFloor ? 2.46 : 2.18;
    const paneHeight = firstPodiumFloor ? 2.14 : 1.76;
    const frameWidth = Math.min(1.64, pitch * 0.53);
    const paneWidth = frameWidth - 0.34;
    for (let bay = 0; bay < bays; bay += 1) {
      const along = margin + pitch * (bay + 0.5);
      const litAtNight = (wall.index * 37 + floor * 13 + bay * 19) % 13 < 2;
      addWallBox(
        builder,
        wall,
        0x303b3e,
        along,
        centreY,
        0.13,
        frameWidth,
        frameHeight,
        0.18,
      );
      addWallBox(
        builder,
        wall,
        litAtNight ? 0x819594 : 0x61777c,
        along,
        centreY,
        0.245,
        paneWidth,
        paneHeight,
        0.055,
        false,
        litAtNight,
      );
      lit += Number(litAtNight);
      total += 1;
    }
  }
  return { lit, total };
}

function addPanelJoints(builder: Builder, wall: FacadeWall): void {
  if (wall.length < 8) return;
  addWallBox(
    builder,
    wall,
    0xb4b9b6,
    wall.length / 2,
    MEININGER_HOTEL_PROFILE.groundFloorHeightM,
    0.14,
    wall.length - 0.2,
    0.055,
    0.04,
  );
  addWallBox(
    builder,
    wall,
    0xb4b9b6,
    wall.length / 2,
    MEININGER_HOTEL_PROFILE.podiumHeightM,
    0.14,
    wall.length - 0.2,
    0.07,
    0.04,
  );
  const panelPitch = 3.15;
  for (let along = panelPitch; along < wall.length - 0.7; along += panelPitch) {
    addWallBox(
      builder,
      wall,
      0xbfc3bf,
      along,
      MEININGER_HOTEL_PROFILE.podiumHeightM / 2,
      0.145,
      0.045,
      MEININGER_HOTEL_PROFILE.podiumHeightM - 0.18,
      0.045,
    );
  }
}

function addGroundGlazing(
  builder: Builder,
  wall: FacadeWall,
  startAlong: number,
  width: number,
  panes: number,
): void {
  const pitch = width / panes;
  for (let pane = 0; pane < panes; pane += 1) {
    const along = startAlong + pitch * (pane + 0.5);
    const entrance = pane === Math.floor(panes / 2);
    addWallBox(
      builder,
      wall,
      entrance ? 0x526b70 : 0x789294,
      along,
      1.72,
      0.19,
      pitch - 0.16,
      3.02,
      0.11,
      true,
      pane % 3 !== 0,
    );
    addWallBox(
      builder,
      wall,
      0x2d393b,
      startAlong + pane * pitch,
      1.72,
      0.26,
      0.09,
      3.14,
      0.09,
    );
  }
  addWallBox(
    builder,
    wall,
    0x2d393b,
    startAlong + width,
    1.72,
    0.26,
    0.09,
    3.14,
    0.09,
  );
}

function addRoofFrame(builder: Builder): void {
  const profile = MEININGER_HOTEL_PROFILE;
  const frameBottom = profile.bodyHeightM;
  const frameTop = profile.measuredHeightM - 0.055;
  const frameHeight = frameTop - frameBottom;
  const x1 = -26.4;
  const x2 = -7.2;
  const z1 = 4.7;
  const z2 = 8.2;
  for (const x of [x1, x2]) {
    for (const z of [z1, z2]) {
      addBox(
        builder,
        0x4d5656,
        x,
        frameBottom + frameHeight / 2,
        z,
        0.14,
        frameHeight,
        0.14,
      );
    }
  }
  for (const z of [z1, z2]) {
    addBox(builder, 0x4d5656, (x1 + x2) / 2, frameTop, z, x2 - x1, 0.12, 0.12);
  }
  for (const x of [x1, x2]) {
    addBox(builder, 0x4d5656, x, frameTop, (z1 + z2) / 2, 0.12, 0.12, z2 - z1);
  }
}

function createFacadeSign(
  name: string,
  text: string,
  width: number,
  height: number,
  position: readonly [number, number, number],
  rotationY: number,
): Mesh {
  const texture = createLetteringTexture({
    bandHeightM: height,
    bandWidthM: width,
    capHeightM: height * 0.56,
    fieldColor: "#282a2b",
    letterColor: "#f15a36",
    text,
    texelsPerMetre: 240,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
    : new MeshBasicMaterial({ color: 0x282a2b, side: DoubleSide });
  const nightMaterial = texture
    ? new MeshBasicMaterial({
        color: 0xffc6ad,
        map: texture,
        side: DoubleSide,
      })
    : new MeshBasicMaterial({ color: 0xf15a36, side: DoubleSide });
  const sign = new Mesh(new PlaneGeometry(width, height), dayMaterial);
  sign.name = name;
  sign.position.set(...position);
  sign.rotation.y = rotationY;
  sign.renderOrder = 10;
  sign.userData = {
    dayMaterial,
    geometryStatus: MEININGER_HOTEL_PROFILE.geometryStatus,
    lettering: text,
    nightMaterial,
    visualReference: MEININGER_HOTEL_PROFILE.visualReference,
  };
  return sign;
}

/** Build the measured hotel shell and its photograph-bounded recognition skin. */
export function createMeiningerHotel(ground: VoxelPayload): Group {
  const profile = MEININGER_HOTEL_PROFILE;
  const sampleGround = worldGroundSampler(ground);
  const groundY =
    sampleGround(profile.world[0], profile.world[1]) ??
    profile.groundYFallbackM;
  const group = new Group();
  group.name = "Measured MEININGER Hotel Hauptbahnhof recognition model";
  group.position.set(profile.world[0], groundY, profile.world[1]);
  group.rotation.y = profile.rotationY;

  const shellBuilder = createBuilder();
  addPolygonPrism(shellBuilder, 0xd4d6d2, 0, profile.bodyHeightM);
  for (const wall of facadeWalls()) {
    if (wall.length < 1.2) continue;
    // One shallow panel skin over one closed shell avoids the coplanar caps
    // that two stacked prisms would create at podium height.
    addWallBox(
      shellBuilder,
      wall,
      0xe3e3dd,
      wall.length / 2,
      profile.podiumHeightM / 2,
      0.08,
      wall.length - 0.04,
      profile.podiumHeightM,
      0.12,
    );
    addWallBox(
      shellBuilder,
      wall,
      0xc5c9c6,
      wall.length / 2,
      profile.bodyHeightM - 0.22,
      0.14,
      wall.length,
      0.44,
      0.22,
      true,
    );
  }
  addRoofFrame(shellBuilder);
  const shell = finishDrawnGroup(shellBuilder, {
    name: "MEININGER Hotel surveyed shell",
  });
  if (shell) group.add(shell);

  const detailsBuilder = createBuilder();
  let litWindowCount = 0;
  let windowCount = 0;
  const walls = facadeWalls();
  for (const [key, bays] of Object.entries(profile.facadeWallBays)) {
    const wall = walls[Number(key)];
    if (!wall) continue;
    const counts = addWindowGrid(detailsBuilder, wall, bays);
    litWindowCount += counts.lit;
    windowCount += counts.total;
    addPanelJoints(detailsBuilder, wall);
  }

  // East-side hotel entrance on Ella-Trebe-Strasse.
  const entranceWall = walls[0];
  const entranceStart = 8.35;
  addGroundGlazing(detailsBuilder, entranceWall, entranceStart, 11.4, 6);
  const entranceAlong = entranceStart + 5.7;
  const entranceX =
    entranceWall.x1 + entranceWall.dirX * entranceAlong + entranceWall.nx * 1.3;
  const entranceZ =
    entranceWall.z1 + entranceWall.dirZ * entranceAlong + entranceWall.nz * 1.3;
  addBox(
    detailsBuilder,
    0x25292a,
    entranceX,
    3.18,
    entranceZ,
    profile.entranceCanopyDepthM,
    0.38,
    profile.entranceCanopyWidthM,
  );
  for (let panel = 0; panel < 4; panel += 1) {
    addBox(
      detailsBuilder,
      0xffd99a,
      entranceX + 0.02,
      2.965,
      entranceZ - 3.15 + panel * 2.1,
      profile.entranceCanopyDepthM - 0.28,
      0.045,
      1.42,
      0,
      false,
    );
  }

  // Ground-floor shop glazing wrapping the stepped south facade.
  const shopWall = walls[1];
  addGroundGlazing(detailsBuilder, shopWall, 1.1, 12.6, 6);

  // The photographed line of slim stainless-steel bollards along the entrance.
  for (let index = 0; index < 8; index += 1) {
    const along = 6.6 + index * 2.65;
    addCylinder(
      detailsBuilder,
      0x778181,
      entranceWall.x1 + entranceWall.dirX * along + entranceWall.nx * 3.05,
      0.47,
      entranceWall.z1 + entranceWall.dirZ * along + entranceWall.nz * 3.05,
      0.075,
      0.94,
      10,
    );
  }
  const details = finishDrawnGroup(detailsBuilder, {
    lampEmissive: 0xffbd6b,
    lampEmissiveIntensity: 0.92,
    name: "MEININGER Hotel facade details",
  });
  if (details) group.add(details);

  group.add(
    createFacadeSign(
      "MEININGER HOTELS entrance lettering",
      "MEININGER HOTELS",
      7.6,
      0.64,
      [entranceX + profile.entranceCanopyDepthM / 2 + 0.015, 3.3, entranceZ],
      Math.PI / 2,
    ),
  );
  const roofSignAlong = 9.2;
  group.add(
    createFacadeSign(
      "MEININGER Hotel rooftop lettering",
      "MEININGER",
      10.2,
      0.9,
      [
        shopWall.x1 + shopWall.dirX * roofSignAlong + shopWall.nx * 0.24,
        28.85,
        shopWall.z1 + shopWall.dirZ * roofSignAlong + shopWall.nz * 0.24,
      ],
      Math.atan2(shopWall.nx, shopWall.nz),
    ),
  );

  group.userData = {
    detailCounts: {
      bollards: 8,
      litWindowCount,
      windowCount,
    },
    geometryStatus: profile.geometryStatus,
    groundY,
    profile,
    sourceUrls: profile.sourceUrls,
    visualReference: profile.visualReference,
  };
  return group;
}

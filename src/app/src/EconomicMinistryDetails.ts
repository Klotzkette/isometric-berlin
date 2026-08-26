import {
  BoxGeometry,
  type BufferGeometry,
  EdgesGeometry,
  Group,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";

export const ECONOMIC_MINISTRY_MODERN_CANAL_ID = "yAAWS2KQ";
export const ECONOMIC_MINISTRY_CANAL_PODIUM_ID = "-3202585";
export const ECONOMIC_MINISTRY_SOUTH_WING_ID = "K0000EU2";
export const ECONOMIC_MINISTRY_NORTH_WING_ID = "K0000B4S";
export const ECONOMIC_MINISTRY_SOUTH_HEAD_ID = "K0000A7g";

export const ECONOMIC_MINISTRY_IDS = new Set([
  ECONOMIC_MINISTRY_MODERN_CANAL_ID,
  ECONOMIC_MINISTRY_CANAL_PODIUM_ID,
  ECONOMIC_MINISTRY_SOUTH_WING_ID,
  ECONOMIC_MINISTRY_NORTH_WING_ID,
  ECONOMIC_MINISTRY_SOUTH_HEAD_ID,
]);

export const ECONOMIC_MINISTRY_DETAIL_FACADE_IDS = new Set([
  ECONOMIC_MINISTRY_MODERN_CANAL_ID,
  ECONOMIC_MINISTRY_SOUTH_WING_ID,
  ECONOMIC_MINISTRY_NORTH_WING_ID,
]);

export const ECONOMIC_MINISTRY_HISTORIC_WING_IDS = new Set([
  ECONOMIC_MINISTRY_SOUTH_WING_ID,
  ECONOMIC_MINISTRY_NORTH_WING_ID,
]);

export const ECONOMIC_MINISTRY_PRISM_TONES: Record<string, number> = {
  [ECONOMIC_MINISTRY_MODERN_CANAL_ID]: 0xe1e4df,
  [ECONOMIC_MINISTRY_CANAL_PODIUM_ID]: 0xd9ddd8,
  [ECONOMIC_MINISTRY_SOUTH_WING_ID]: 0xe8e3d5,
  [ECONOMIC_MINISTRY_NORTH_WING_ID]: 0xe8e3d5,
  [ECONOMIC_MINISTRY_SOUTH_HEAD_ID]: 0xdfe2dd,
};

export const ECONOMIC_MINISTRY_PRISM_ROOF_TONES: Record<string, number> = {
  [ECONOMIC_MINISTRY_MODERN_CANAL_ID]: 0x7f8b8b,
  [ECONOMIC_MINISTRY_CANAL_PODIUM_ID]: 0xc9ceca,
  [ECONOMIC_MINISTRY_SOUTH_WING_ID]: 0x93483e,
  [ECONOMIC_MINISTRY_NORTH_WING_ID]: 0x93483e,
  [ECONOMIC_MINISTRY_SOUTH_HEAD_ID]: 0x7d8988,
};

export const ECONOMIC_MINISTRY_PROFILE = {
  address: "Scharnhorststrasse 34-37, Berlin",
  geometryStatus:
    "LoD2 envelopes remain authoritative; the added facade grids, entrance framing and roof-form correction are reference-bounded recognition detail",
  officialArchitecture:
    "https://www.bundeswirtschaftsministerium.de/Navigation/DE/Ministerium/Architektur/architektur.html",
  officialBuildingReference:
    "https://www.museum-der-1000-orte.de/bauwerke/bauwerk/gebaude-e-f-und-g-ehem-invalidenhaus",
  osmOfficeWay: 24911034,
  osmHistoricBuildingWays: [28880802, 28880803] as const,
  protectedBuildingRecord:
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011190",
  sourcePrismIds: [...ECONOMIC_MINISTRY_IDS],
  spatialReading:
    "long replacement wing parallel to the Berlin-Spandauer Schifffahrtskanal, joined to the two retained Invalidenhaus side wings around the garden courts",
} as const;

export const ECONOMIC_MINISTRY_MINECRAFT_FACADES = {
  modernCanal: {
    from: [148.2, -1157.2] as const,
    levels: 5,
    mullions: 36,
    to: [58.3, -1313.6] as const,
    y0: 5.2,
  },
  modernCourtyard: {
    from: [119.2, -1237.9] as const,
    levels: 4,
    mullions: 7,
    to: [161.4, -1164.7] as const,
    y0: 5.2,
  },
  northHistoricOuter: {
    from: [88, -1297.4] as const,
    levels: 3,
    mullions: 8,
    to: [162.2, -1339.5] as const,
    y0: 5.2,
  },
  southHistoricOuter: {
    from: [222, -1233.7] as const,
    levels: 3,
    mullions: 8,
    to: [149, -1191.2] as const,
    y0: 5.2,
  },
} as const;

const MODERN_GLASS = 0x5b777c;
const HISTORIC_GLASS = 0x4b666b;
const PALE_STONE = 0xe9ebe5;
const HISTORIC_STONE = 0xeee7d8;
const DARK_METAL = 0x4a5558;

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

function ringWalls(ring: number[][]): FacadeWall[] {
  let doubleArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[(index + 1) % ring.length];
    doubleArea += x1 * z2 - x2 * z1;
  }
  const flip = doubleArea >= 0 ? 1 : -1;
  const walls: FacadeWall[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const [x1dm, z1dm] = ring[index];
    const [x2dm, z2dm] = ring[(index + 1) % ring.length];
    const x1 = x1dm / 10;
    const z1 = z1dm / 10;
    const dx = x2dm / 10 - x1;
    const dz = z2dm / 10 - z1;
    const length = Math.hypot(dx, dz);
    if (length < 0.2) continue;
    const dirX = dx / length;
    const dirZ = dz / length;
    walls.push({
      dirX,
      dirZ,
      index,
      length,
      nx: dirZ * flip,
      nz: -dirX * flip,
      x1,
      z1,
    });
  }
  return walls;
}

function wallOf(building: PrismBuilding, index: number): FacadeWall {
  const wall = ringWalls(building.ring).find(
    (candidate) => candidate.index === index,
  );
  if (!wall) {
    throw new Error(
      `Missing wall ${index} on economic-ministry prism ${building.id}`,
    );
  }
  return wall;
}

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  lamp: boolean,
  inked: boolean,
): void {
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
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
  lamp = false,
  inked = false,
): void {
  const geometry = new BoxGeometry(width, height, depth);
  geometry.rotateY(-Math.atan2(wall.dirZ, wall.dirX));
  geometry.translate(
    wall.x1 + wall.dirX * along + wall.nx * outward,
    y,
    wall.z1 + wall.dirZ * along + wall.nz * outward,
  );
  addPaintedGeometry(builder, geometry, color, lamp, inked);
}

function addWindowGrid(
  builder: Builder,
  building: PrismBuilding,
  wallIndex: number,
  options: {
    bayPitchM: number;
    color: number;
    floorPitchM: number;
    firstCentreAboveGroundM: number;
    levels: number;
    marginM: number;
    majorPierEvery?: number;
    trimColor?: number;
    windowHeightM: number;
    windowWidthRatio: number;
  },
): { bays: number; windows: number } {
  const wall = wallOf(building, wallIndex);
  const y0 = building.y0_dm / 10;
  const available = Math.max(1, wall.length - options.marginM * 2);
  const bays = Math.max(1, Math.round(available / options.bayPitchM));
  const moduleWidth = available / bays;
  for (let level = 0; level < options.levels; level += 1) {
    const y =
      y0 + options.firstCentreAboveGroundM + level * options.floorPitchM;
    for (let bay = 0; bay < bays; bay += 1) {
      addWallBox(
        builder,
        wall,
        options.color,
        options.marginM + moduleWidth * (bay + 0.5),
        y,
        0.16,
        moduleWidth * options.windowWidthRatio,
        options.windowHeightM,
        0.16,
        true,
        true,
      );
    }
    addWallBox(
      builder,
      wall,
      options.trimColor ?? PALE_STONE,
      wall.length / 2,
      y + options.windowHeightM / 2 + 0.22,
      0.135,
      wall.length - 0.6,
      0.24,
      0.18,
    );
  }
  const pierEvery = options.majorPierEvery ?? 5;
  for (let boundary = 0; boundary <= bays; boundary += pierEvery) {
    addWallBox(
      builder,
      wall,
      options.trimColor ?? PALE_STONE,
      options.marginM + moduleWidth * Math.min(boundary, bays),
      y0 +
        options.firstCentreAboveGroundM +
        ((options.levels - 1) * options.floorPitchM) / 2,
      0.18,
      0.28,
      (options.levels - 1) * options.floorPitchM +
        options.windowHeightM +
        0.5,
      0.22,
      false,
      true,
    );
  }
  return { bays, windows: bays * options.levels };
}

function addRibbonGrid(
  builder: Builder,
  building: PrismBuilding,
  wallIndex: number,
  levels: number,
  floorPitchM: number,
  glass: number,
): number {
  const wall = wallOf(building, wallIndex);
  const y0 = building.y0_dm / 10;
  for (let level = 0; level < levels; level += 1) {
    addWallBox(
      builder,
      wall,
      glass,
      wall.length / 2,
      y0 + 2.25 + level * floorPitchM,
      0.15,
      wall.length - 1.4,
      2.05,
      0.15,
      true,
      true,
    );
  }
  const piers = Math.max(2, Math.round(wall.length / 8));
  for (let index = 0; index <= piers; index += 1) {
    addWallBox(
      builder,
      wall,
      PALE_STONE,
      0.7 + ((wall.length - 1.4) * index) / piers,
      y0 + 2.25 + ((levels - 1) * floorPitchM) / 2,
      0.175,
      0.22,
      (levels - 1) * floorPitchM + 2.45,
      0.2,
    );
  }
  return piers + 1;
}

function addHistoricEntrance(
  builder: Builder,
  building: PrismBuilding,
  wallIndex: number,
): void {
  const wall = wallOf(building, wallIndex);
  const y0 = building.y0_dm / 10;
  const centre = wall.length / 2;
  addWallBox(
    builder,
    wall,
    HISTORIC_GLASS,
    centre,
    y0 + 1.9,
    0.2,
    3.4,
    3.8,
    0.22,
    true,
    true,
  );
  for (const offset of [-1.9, 1.9]) {
    addWallBox(
      builder,
      wall,
      HISTORIC_STONE,
      centre + offset,
      y0 + 2,
      0.22,
      0.34,
      4.25,
      0.28,
      false,
      true,
    );
  }
  addWallBox(
    builder,
    wall,
    HISTORIC_STONE,
    centre,
    y0 + 4.05,
    0.22,
    4.25,
    0.34,
    0.28,
    false,
    true,
  );
}

function addHistoricWing(
  builder: Builder,
  building: PrismBuilding,
  outerWallIndex: number,
  courtyardWallIndex: number,
  entranceWallIndex: number,
): { courtyardPiers: number; windows: number } {
  const outer = addWindowGrid(builder, building, outerWallIndex, {
    bayPitchM: 4.35,
    color: HISTORIC_GLASS,
    firstCentreAboveGroundM: 2.35,
    floorPitchM: 3.75,
    levels: 3,
    majorPierEvery: 4,
    marginM: 1.2,
    trimColor: HISTORIC_STONE,
    windowHeightM: 2.25,
    windowWidthRatio: 0.5,
  });
  const courtyardPiers = addRibbonGrid(
    builder,
    building,
    courtyardWallIndex,
    3,
    3.75,
    HISTORIC_GLASS,
  );
  addHistoricEntrance(builder, building, entranceWallIndex);
  for (const wallIndex of [outerWallIndex, courtyardWallIndex]) {
    const wall = wallOf(building, wallIndex);
    addWallBox(
      builder,
      wall,
      HISTORIC_STONE,
      wall.length / 2,
      building.y0_dm / 10 + 11.75,
      0.2,
      wall.length - 0.35,
      0.46,
      0.34,
      false,
      true,
    );
  }
  return { courtyardPiers, windows: outer.windows };
}

/** Use the OSM hipped-roof identity instead of the undifferentiated LoD2 5000 code. */
export function economicMinistryRoofCode(
  buildingId: string,
  sourceRoofCode: number,
): number {
  return ECONOMIC_MINISTRY_HISTORIC_WING_IDS.has(buildingId)
    ? 3200
    : sourceRoofCode;
}

export function createEconomicMinistryDetails(prisms: PrismPayload): Group {
  const group = new Group();
  group.name = "Bundeswirtschaftsministerium details";
  const byId = new Map(
    prisms.buildings.map((building) => [building.id, building]),
  );
  const modern = byId.get(ECONOMIC_MINISTRY_MODERN_CANAL_ID);
  const southWing = byId.get(ECONOMIC_MINISTRY_SOUTH_WING_ID);
  const northWing = byId.get(ECONOMIC_MINISTRY_NORTH_WING_ID);
  if (!modern || !southWing || !northWing) {
    group.userData.geometryStatus = "required LoD2 parts missing";
    return group;
  }

  const builder = createBuilder();
  const canal = addWindowGrid(builder, modern, 5, {
    bayPitchM: 4.05,
    color: MODERN_GLASS,
    firstCentreAboveGroundM: 2.35,
    floorPitchM: 3.55,
    levels: 5,
    majorPierEvery: 5,
    marginM: 1.1,
    windowHeightM: 2.2,
    windowWidthRatio: 0.66,
  });
  const courtyardPiers =
    addRibbonGrid(builder, modern, 3, 5, 3.55, MODERN_GLASS) +
    addRibbonGrid(builder, modern, 7, 5, 3.55, MODERN_GLASS);
  const south = addHistoricWing(builder, southWing, 3, 1, 2);
  const north = addHistoricWing(builder, northWing, 0, 2, 1);

  const details = finishDrawnGroup(builder, {
    lampEmissive: 0x9fc8c3,
    lampEmissiveIntensity: 0.38,
    name: "Bundeswirtschaftsministerium architectural details",
  });
  if (details) group.add(details);
  group.userData.detailCounts = {
    canalFacadeBays: canal.bays,
    canalFacadeWindows: canal.windows,
    courtyardPiers:
      courtyardPiers + south.courtyardPiers + north.courtyardPiers,
    historicEntrances: 2,
    historicWindows: south.windows + north.windows,
    sourcePrisms: ECONOMIC_MINISTRY_IDS.size,
  };
  group.userData.geometryStatus = ECONOMIC_MINISTRY_PROFILE.geometryStatus;
  group.userData.hasOpaqueEnvelope = false;
  group.userData.maxFacadeProjectionM = 0.34;
  group.userData.profile = ECONOMIC_MINISTRY_PROFILE;
  group.userData.replacesLoD2 = false;
  group.userData.sourcePrismIds = [...ECONOMIC_MINISTRY_IDS];
  group.userData.staticAllModes = true;
  group.userData.staticAntiFlicker = true;
  group.traverse((object) => {
    object.userData.staticAllModes = true;
    object.userData.staticAntiFlicker = true;
  });
  return group;
}

import {
  BoxGeometry,
  CircleGeometry,
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

export const ECONOMIC_MINISTRY_MAIN_ID = "K00008CN";

export const ECONOMIC_MINISTRY_MODERN_CANAL_ID = "yAAWS2KQ";
export const ECONOMIC_MINISTRY_CANAL_PODIUM_ID = "-3202585";
export const ECONOMIC_MINISTRY_SOUTH_WING_ID = "K0000EU2";
export const ECONOMIC_MINISTRY_NORTH_WING_ID = "K0000B4S";
export const ECONOMIC_MINISTRY_SOUTH_HEAD_ID = "K0000A7g";

export const ECONOMIC_MINISTRY_IDS = new Set([
  ECONOMIC_MINISTRY_MAIN_ID,
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
  [ECONOMIC_MINISTRY_MAIN_ID]: 0xd6ccba,
  [ECONOMIC_MINISTRY_MODERN_CANAL_ID]: 0xe1e4df,
  [ECONOMIC_MINISTRY_CANAL_PODIUM_ID]: 0xd9ddd8,
  [ECONOMIC_MINISTRY_SOUTH_WING_ID]: 0xe8e3d5,
  [ECONOMIC_MINISTRY_NORTH_WING_ID]: 0xe8e3d5,
  [ECONOMIC_MINISTRY_SOUTH_HEAD_ID]: 0xdfe2dd,
};

export const ECONOMIC_MINISTRY_PRISM_ROOF_TONES: Record<string, number> = {
  [ECONOMIC_MINISTRY_MAIN_ID]: 0x955a42,
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
  mainHouseIdentity: "former Kaiser-Wilhelm-Akademie, Invalidenstrasse; separate from the older Invalidenhaus wings",
  mainHouseArchitecture: "https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Textsammlungen/Ministerium/architektur.html",
  mainHouseVisualReference: "https://commons.wikimedia.org/wiki/File:2022-10-10_Bundesministerium_Wirtschaft_Klimaschutz_06.jpg",
  spatialReading:
    "long replacement wing parallel to the Berlin-Spandauer Schifffahrtskanal, joined to the two retained Invalidenhaus side wings around the garden courts",
} as const;

export const ECONOMIC_MINISTRY_MINECRAFT_FACADES = {
  mainHistoricWest: {from:[237.2,-1037.3] as const,to:[206.3,-1023.2] as const,levels:2,mullions:10,y0:5.4},
  mainHistoricCentre: {from:[261.2,-1042.6] as const,to:[242.7,-1034.3] as const,levels:2,mullions:6,y0:5.4},
  mainHistoricEast: {from:[294.6,-1062.4] as const,to:[263.3,-1048.3] as const,levels:2,mullions:10,y0:5.4},
  northHistoricCourt: {from:[170,-1325.7] as const,to:[95.8,-1283.6] as const,levels:3,mullions:19,y0:5.2},
  southHistoricCourt: {from:[141.1,-1205.4] as const,to:[214.2,-1247.4] as const,levels:3,mullions:19,y0:5.2},
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
    mullions: 19,
    to: [162.2, -1339.5] as const,
    y0: 5.2,
  },
  southHistoricOuter: {
    from: [222, -1233.7] as const,
    levels: 3,
    mullions: 19,
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
    historicFrames?: boolean;
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
      if (options.historicFrames) {
        const centre = options.marginM + moduleWidth * (bay + 0.5);
        const width = moduleWidth * options.windowWidthRatio;
        // Straight, evenly repeated window rows are documented by the Berlin
        // monument inventory. The sill and four-light sash are non-surveyed
        // subdivisions fitted wholly to the retained source wall.
        for (const side of [-1, 1]) {
          addWallBox(builder, wall, HISTORIC_STONE, centre + side * (width / 2 + 0.1),
            y, 0.22, 0.16, options.windowHeightM + 0.26, 0.16);
        }
        for (const sign of [-1, 1]) {
          addWallBox(builder, wall, HISTORIC_STONE, centre,
            y + sign * (options.windowHeightM / 2 + 0.09), 0.23,
            width + 0.38, sign < 0 ? 0.18 : 0.13, 0.2);
        }
        addWallBox(builder, wall, HISTORIC_STONE, centre, y, 0.26,
          0.065, options.windowHeightM, 0.08);
        addWallBox(builder, wall, HISTORIC_STONE, centre, y + 0.28, 0.26,
          width, 0.065, 0.08);
      }
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
    historicFrames: true,
  });
  const court = addWindowGrid(builder, building, courtyardWallIndex, {
    bayPitchM: 4.35, color: HISTORIC_GLASS, firstCentreAboveGroundM: 2.35,
    floorPitchM: 3.75, levels: 3, majorPierEvery: 4, marginM: 1.2,
    trimColor: HISTORIC_STONE, windowHeightM: 2.25, windowWidthRatio: 0.5,
    historicFrames: true,
  });
  const courtyardPiers = 0;
  addHistoricEntrance(builder, building, entranceWallIndex);
  if (building.id === ECONOMIC_MINISTRY_NORTH_WING_ID) {
    const wall = wallOf(building, entranceWallIndex);
    for (const [radius, outward, color] of [[1.55, 0.24, HISTORIC_STONE], [1.28, 0.28, HISTORIC_GLASS]]) {
      const geometry = new CircleGeometry(radius, 24);
      geometry.rotateY(Math.atan2(wall.nx, wall.nz));
      geometry.translate(wall.x1 + wall.dirX * wall.length / 2 + wall.nx * outward,
        building.y0_dm / 10 + 5.65,
        wall.z1 + wall.dirZ * wall.length / 2 + wall.nz * outward);
      addPaintedGeometry(builder, geometry, color, color === HISTORIC_GLASS, true);
    }
    addWallBox(builder, wall, HISTORIC_STONE, wall.length / 2,
      building.y0_dm / 10 + 5.65, 0.3, 0.09, 2.5, 0.06);
    addWallBox(builder, wall, HISTORIC_STONE, wall.length / 2,
      building.y0_dm / 10 + 5.65, 0.3, 2.5, 0.09, 0.06);
  }
  // End elevations keep their documented regular openings as well; previously
  // the historic side wings had completely blank gables around one large door.
  const endWall = wallOf(building, entranceWallIndex);
  let endWindows = 0;
  for (const fraction of [0.19, 0.81]) {
    for (let level = 0; level < 3; level += 1) {
      const along = endWall.length * fraction;
      const y = building.y0_dm / 10 + 2.35 + level * 3.75;
      addWallBox(builder, endWall, HISTORIC_GLASS, along, y, 0.17,
        1.6, 2.25, 0.16, true, true);
      addWallBox(builder, endWall, HISTORIC_STONE, along, y - 1.2, 0.22,
        1.94, 0.16, 0.22);
      addWallBox(builder, endWall, HISTORIC_STONE, along, y, 0.26,
        0.075, 2.25, 0.08);
      endWindows += 1;
    }
  }
  for (const wall of ringWalls(building.ring)) {
    addWallBox(builder, wall, 0xc9c4b5, wall.length / 2,
      building.y0_dm / 10 + 0.42, 0.12, wall.length - 0.28, 0.74, 0.18);
  }
  for (const wallIndex of [outerWallIndex, courtyardWallIndex, entranceWallIndex]) {
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
  return { courtyardPiers, windows: outer.windows + court.windows + endWindows };
}

/** A facade-only reading of the distinct neo-Baroque Invalidenstrasse main house. */
function addMainHouseFacade(builder: Builder, building: PrismBuilding): number {
  let windows = 0;
  const y0 = building.y0_dm / 10;
  for (const wallIndex of [23, 27, 35, 42, 46]) {
    const wall = wallOf(building, wallIndex);
    const risalit = wallIndex === 35 || wallIndex === 23 || wallIndex === 46;
    const bays = Math.max(2, Math.round((wall.length - 2) / 3.2));
    const pitch = (wall.length - 1.6) / bays;
    // Source wall only: rusticated plinth and straight stone storey bands.
    for (let row = 0; row < 5; row += 1) addWallBox(builder, wall, 0xc2b5a0,
      wall.length / 2, y0 + 0.45 + row * 0.54, 0.12, wall.length - 0.15, 0.055, 0.18);
    for (const level of [3.3, 8.1, 13.5]) addWallBox(builder, wall, HISTORIC_STONE,
      wall.length / 2, y0 + level, 0.24, wall.length + 0.12, level > 13 ? 0.48 : 0.2, 0.4);
    for (let bay=0; bay<bays; bay+=1) {
      const along=0.8+pitch*(bay+0.5);
      for (let floor=0; floor<2; floor+=1) {
        const y=y0+5.55+floor*4.85, h=floor===0?3.05:2.75;
        addWallBox(builder,wall,0xf0e7d5,along,y,0.18,pitch*0.66,h+0.35,0.2);
        addWallBox(builder,wall,HISTORIC_GLASS,along,y,0.31,pitch*0.54,h,0.12,true,true);
        addWallBox(builder,wall,HISTORIC_STONE,along,y,0.4,0.085,h,0.08);
        addWallBox(builder,wall,HISTORIC_STONE,along,y+0.4,0.4,pitch*0.54,0.085,0.08);
        addWallBox(builder,wall,HISTORIC_STONE,along,y-h/2-0.14,0.28,pitch*0.74,0.18,0.34);
        if(floor===0) addWallBox(builder,wall,0xcfc2ac,along,y+h/2+0.32,0.32,pitch*0.83,0.2,0.34);
        windows+=1;
      }
      if(!risalit && bay%2===0) {
        addWallBox(builder,wall,0x84918a,along,y0+15.6,0.19,1.55,1.75,0.38);
        addWallBox(builder,wall,HISTORIC_GLASS,along,y0+15.55,0.43,1.1,1.25,0.12,true);
      }
    }
    if(risalit) {
      for(const side of [-1,1]) for(const paired of [0,0.82]) {
        const along=side<0?0.45+paired:wall.length-0.45-paired;
        addWallBox(builder,wall,HISTORIC_STONE,along,y0+8.3,0.32,0.42,10.15,0.38,true);
        addWallBox(builder,wall,0xe8ddc9,along,y0+13.2,0.38,0.65,0.35,0.44);
      }
      // Segmental pediment, sampled into static short stone chords.
      for(let step=0;step<12;step+=1) {
        const along=(step+0.5)*wall.length/12;
        const t=(along/wall.length-0.5)*2;
        addWallBox(builder,wall,HISTORIC_STONE,along,y0+14.0+1.45*(1-t*t),0.32,
          wall.length/12+0.025,0.22,0.4);
      }
    }
  }
  return windows;
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
  const mainHouse = byId.get(ECONOMIC_MINISTRY_MAIN_ID);
  const mainHouseWindows = mainHouse ? addMainHouseFacade(builder, mainHouse) : 0;
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
    northHistoricBullseyes: 1,
    mainHouseWindows,
    mainHouseRisalits: mainHouse ? 3 : 0,
    framedHistoricWindows: south.windows + north.windows,
    historicWindows: south.windows + north.windows,
    sourcePrisms: ECONOMIC_MINISTRY_IDS.size,
  };
  group.userData.geometryStatus = ECONOMIC_MINISTRY_PROFILE.geometryStatus;
  group.userData.hasOpaqueEnvelope = false;
  group.userData.maxFacadeProjectionM = 0.6;
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

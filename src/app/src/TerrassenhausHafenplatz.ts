import { BoxGeometry, Group } from "three";

import {
  type Builder,
  boxOutlineGeometry,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";

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

/** Every official LoD2 part of Helmut Ollk's Hafenplatz 6-10 ensemble. */
export const TERRASSENHAUS_HAFENPLATZ_IDS: ReadonlySet<string> = new Set([
  "99X7vml7",
  "PR2y14xd",
  "1dxnrHyv",
  "Ws9nRQlC",
  "frdCpDrj",
  "Sw9Dj7wF",
  "C50HiElV",
  "C9LUEurk",
  "TAMPApNO",
  "vRcIWWF6",
  "QB7XOF0B",
  "mp0g8qLq",
  "AoM5lYzk",
  "akQlKE5W",
  "GUO2XLb9",
  "rCPnBDrG",
  "kcsfJoW6",
  "tzFncEis",
  "LZJVp4eQ",
  "a37bXe31",
  "yZqUD8Ou",
  "UsETya0v",
  "Hu3nmQ74",
  "wShgGbkN",
  "vx35cQIx",
  "hAW5pOaN",
]);

/**
 * The two central LoD2 peaks feed four strictly descending terrace arms.
 * Keeping the chains explicit protects Ollk's cross-shaped pyramid silhouette
 * while leaving every footprint and height in the official payload untouched.
 */
export const TERRASSENHAUS_HAFENPLATZ_STEP_CHAINS = [
  ["C50HiElV", "QB7XOF0B", "vx35cQIx", "a37bXe31", "wShgGbkN", "C9LUEurk"],
  ["C50HiElV", "1dxnrHyv", "GUO2XLb9", "AoM5lYzk", "LZJVp4eQ"],
  ["kcsfJoW6", "Sw9Dj7wF", "yZqUD8Ou", "TAMPApNO", "tzFncEis"],
  [
    "kcsfJoW6",
    "hAW5pOaN",
    "rCPnBDrG",
    "PR2y14xd",
    "frdCpDrj",
    "Ws9nRQlC",
    "mp0g8qLq",
  ],
] as const;

/** Lower street/courtyard bars attached to, but not part of, the four arms. */
export const TERRASSENHAUS_HAFENPLATZ_PERIMETER_IDS: ReadonlySet<string> =
  new Set(["99X7vml7", "Hu3nmQ74", "akQlKE5W", "vRcIWWF6", "UsETya0v"]);

export const TERRASSENHAUS_HAFENPLATZ_PROFILE = {
  address: "Hafenplatz 6-10, 10963 Berlin",
  architect: "Helmut Ollk",
  built: "1971-1973",
  geometryStatus:
    "all 26 Berlin LoD2 footprints and measured heights retained; four monotonic terrace arms, window grids, aggregate-panel joints, loggias and stepped parapets are deterministic photo-bounded reconstructions, not surveyed facade geometry; no protected drawing or photo texture is bundled",
  lod2Parent: "DEBE02YY400003Qa",
  name: "Gebaeudekomplex Terrassenhaus am Hafenplatz",
  sourceUrls: [
    "https://architekturmuseum.ub.tu-berlin.de/index.php?O=388217&p=51",
    "https://doi.org/10.25645/24k5-8w4y",
    "https://fbinter.stadt-berlin.de/fb_daten/beschreibung/lod2_sensw.html",
    "https://commons.wikimedia.org/wiki/Category:Pyramide_am_Hafenplatz",
  ],
} as const;

export const TERRASSENHAUS_HAFENPLATZ_TONES = {
  aggregate: 0xaaa9a4,
  aggregateShade: 0x959792,
  balconyRail: 0x747b79,
  concrete: 0xc9c7c0,
  concreteShade: 0xb1b0aa,
  curtain: 0xb7b2a2,
  frameOchre: 0xaa9152,
  glass: 0x63787e,
  glassDark: 0x46595e,
  groundFrame: 0x4b6b70,
  nightGlass: 0xffc979,
  parapet: 0xbdbbb4,
  plaster: 0xcfcdc5,
  recess: 0x3f484a,
} as const;

type DetailCounts = {
  balconyRecesses: number;
  entrances: number;
  facadeBands: number;
  louvreSlats: number;
  mullions: number;
  spandrelPanels: number;
  terraceSegments: number;
  windows: number;
};

const NORTH_COURTYARD_BALCONIES = {
  buildingId: "C50HiElV",
  endFloor: 7,
  startFloor: 2,
  wallIndex: 1,
  width: 3.18,
} as const;

const NORTH_COURTYARD_LOUVRE = {
  buildingId: "C50HiElV",
  wallIndex: 1,
  width: 2.74,
} as const;

function emptyDetailCounts(): DetailCounts {
  return {
    balconyRecesses: 0,
    entrances: 0,
    facadeBands: 0,
    louvreSlats: 0,
    mullions: 0,
    spandrelPanels: 0,
    terraceSegments: 0,
    windows: 0,
  };
}

function mergeDetailCounts(target: DetailCounts, source: DetailCounts): void {
  for (const key of Object.keys(target) as (keyof DetailCounts)[]) {
    target[key] += source[key];
  }
}

function pointInRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [xi, zi] = ring[index];
    const [xj, zj] = ring[previous];
    const xMetres = xi / 10;
    const zMetres = zi / 10;
    const previousX = xj / 10;
    const previousZ = zj / 10;
    const crosses =
      zMetres > z !== previousZ > z &&
      x <
        ((previousX - xMetres) * (z - zMetres)) / (previousZ - zMetres) +
          xMetres;
    if (crosses) inside = !inside;
  }
  return inside;
}

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
    if (length < 1.4) continue;
    walls.push({
      dirX: dx / length,
      dirZ: dz / length,
      index,
      length,
      nx: (dz / length) * flip,
      nz: (-dx / length) * flip,
      x1,
      z1,
    });
  }
  return walls;
}

function wallPoint(
  wall: FacadeWall,
  along: number,
  y: number,
  outward: number,
): [number, number, number] {
  return [
    wall.x1 + wall.dirX * along + wall.nx * outward,
    y,
    wall.z1 + wall.dirZ * along + wall.nz * outward,
  ];
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
  const [x, resolvedY, z] = wallPoint(wall, along, y, outward);
  geometry.translate(x, resolvedY, z);
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(boxOutlineGeometry(geometry));
  }
}

function isExposedAt(
  sourceId: string,
  targets: PrismBuilding[],
  x: number,
  y: number,
  z: number,
): boolean {
  return !targets.some((candidate) => {
    if (candidate.id === sourceId) return false;
    const bottom = candidate.y0_dm / 10;
    const top = bottom + candidate.h_dm / 10;
    return (
      y > bottom + 0.15 && y < top - 0.15 && pointInRing(x, z, candidate.ring)
    );
  });
}

function facadeHash(
  buildingId: string,
  wallIndex: number,
  floor: number,
  bay: number,
): number {
  let value = wallIndex * 131 + floor * 53 + bay * 29;
  for (const character of buildingId) {
    value = (value * 33 + character.charCodeAt(0)) >>> 0;
  }
  return value;
}

function isBalconySlot(
  building: PrismBuilding,
  wall: FacadeWall,
  floor: number,
  along: number,
): boolean {
  if (
    building.id !== NORTH_COURTYARD_BALCONIES.buildingId ||
    wall.index !== NORTH_COURTYARD_BALCONIES.wallIndex ||
    floor < NORTH_COURTYARD_BALCONIES.startFloor ||
    floor > NORTH_COURTYARD_BALCONIES.endFloor
  ) {
    return false;
  }
  const stackAlong = wall.length * 0.73;
  return (
    Math.abs(along - stackAlong) < NORTH_COURTYARD_BALCONIES.width / 2
  );
}

function addFramedWindow(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  along: number,
  centreY: number,
  paneWidth: number,
  floor: number,
  bay: number,
  counts: DetailCounts,
): void {
  const hash = facadeHash(building.id, wall.index, floor, bay);
  const glassTone =
    hash % 7 === 0
      ? TERRASSENHAUS_HAFENPLATZ_TONES.curtain
      : hash % 5 === 0
        ? TERRASSENHAUS_HAFENPLATZ_TONES.glassDark
        : TERRASSENHAUS_HAFENPLATZ_TONES.glass;
  const lit = hash % 13 === 2;
  const frameWidth = paneWidth + 0.18;

  addWallBox(
    builder,
    wall,
    TERRASSENHAUS_HAFENPLATZ_TONES.frameOchre,
    along,
    centreY,
    0.12,
    frameWidth,
    1.68,
    0.14,
    false,
    true,
  );
  addWallBox(
    builder,
    wall,
    glassTone,
    along,
    centreY,
    0.205,
    paneWidth,
    1.48,
    0.075,
    lit,
  );
  addWallBox(
    builder,
    wall,
    TERRASSENHAUS_HAFENPLATZ_TONES.frameOchre,
    along,
    centreY,
    0.257,
    0.055,
    1.43,
    0.045,
  );
  addWallBox(
    builder,
    wall,
    TERRASSENHAUS_HAFENPLATZ_TONES.concreteShade,
    along,
    centreY - 0.88,
    0.18,
    frameWidth + 0.12,
    0.09,
    0.2,
    false,
    true,
  );
  counts.mullions += 1;
  counts.windows += 1;
}

function addSpandrelPanel(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  targets: PrismBuilding[],
  along: number,
  centreY: number,
  width: number,
  height: number,
  floor: number,
  bay: number,
  counts: DetailCounts,
): boolean {
  const [sampleX, , sampleZ] = wallPoint(wall, along, centreY, 0.34);
  if (!isExposedAt(building.id, targets, sampleX, centreY, sampleZ)) {
    return false;
  }
  const tone =
    facadeHash(building.id, wall.index, floor, bay) % 6 === 0
      ? TERRASSENHAUS_HAFENPLATZ_TONES.aggregateShade
      : TERRASSENHAUS_HAFENPLATZ_TONES.aggregate;
  addWallBox(
    builder,
    wall,
    tone,
    along,
    centreY,
    0.085,
    Math.max(0.42, width - 0.08),
    height,
    0.11,
    false,
    true,
  );
  counts.spandrelPanels += 1;
  return true;
}

function addGroundFloorGlazing(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  targets: PrismBuilding[],
  edgeInset: number,
  bays: number,
  pitch: number,
  paneWidth: number,
  floorHeight: number,
  counts: DetailCounts,
): void {
  const y0 = building.y0_dm / 10;
  let hasBand = false;
  for (let bay = 0; bay < bays; bay += 1) {
    const along = edgeInset + pitch * (bay + 0.5);
    const centreY = y0 + 1.22;
    const [sampleX, , sampleZ] = wallPoint(wall, along, centreY, 0.34);
    if (!isExposedAt(building.id, targets, sampleX, centreY, sampleZ)) {
      continue;
    }
    const entrance = bay === Math.floor(bays / 2);
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.groundFrame,
      along,
      centreY,
      0.12,
      paneWidth + 0.18,
      2.18,
      0.14,
      false,
      true,
    );
    addWallBox(
      builder,
      wall,
      entrance
        ? TERRASSENHAUS_HAFENPLATZ_TONES.glassDark
        : TERRASSENHAUS_HAFENPLATZ_TONES.glass,
      along,
      centreY,
      0.205,
      paneWidth,
      1.94,
      0.075,
      facadeHash(building.id, wall.index, 0, bay) % 17 === 4,
    );
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.groundFrame,
      along,
      centreY,
      0.257,
      0.06,
      1.9,
      0.045,
    );
    counts.mullions += 1;
    counts.windows += 1;
    if (entrance) counts.entrances += 1;

    hasBand =
      addSpandrelPanel(
        builder,
        building,
        wall,
        targets,
        along,
        y0 + floorHeight,
        pitch,
        Math.max(0.82, floorHeight - 1.82),
        0,
        bay,
        counts,
      ) || hasBand;
  }
  if (hasBand) counts.facadeBands += 1;
}

function addBalconyStack(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  targets: PrismBuilding[],
  floorBase: number,
  floorHeight: number,
  roofY: number,
  counts: DetailCounts,
): void {
  if (
    building.id !== NORTH_COURTYARD_BALCONIES.buildingId ||
    wall.index !== NORTH_COURTYARD_BALCONIES.wallIndex
  ) {
    return;
  }
  const along = wall.length * 0.73;
  for (
    let floor = NORTH_COURTYARD_BALCONIES.startFloor;
    floor <= NORTH_COURTYARD_BALCONIES.endFloor;
    floor += 1
  ) {
    const centreY = floorBase + floor * floorHeight;
    if (centreY + 0.96 >= roofY - 0.68) continue;
    const [sampleX, , sampleZ] = wallPoint(wall, along, centreY, 0.34);
    if (!isExposedAt(building.id, targets, sampleX, centreY, sampleZ)) {
      continue;
    }
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.recess,
      along,
      centreY,
      0.145,
      NORTH_COURTYARD_BALCONIES.width,
      1.82,
      0.1,
      false,
      true,
    );
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.concreteShade,
      along,
      centreY - 0.91,
      0.3,
      NORTH_COURTYARD_BALCONIES.width + 0.14,
      0.14,
      0.42,
      false,
      true,
    );
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.balconyRail,
      along,
      centreY - 0.18,
      0.47,
      NORTH_COURTYARD_BALCONIES.width - 0.24,
      0.075,
      0.07,
    );
    for (const side of [-1, 1]) {
      addWallBox(
        builder,
        wall,
        TERRASSENHAUS_HAFENPLATZ_TONES.balconyRail,
        along + side * (NORTH_COURTYARD_BALCONIES.width / 2 - 0.18),
        centreY + 0.18,
        0.47,
        0.065,
        0.72,
        0.07,
      );
    }
    counts.balconyRecesses += 1;
  }
}

function addCourtyardLouvre(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  targets: PrismBuilding[],
  roofY: number,
  counts: DetailCounts,
): void {
  if (
    building.id !== NORTH_COURTYARD_LOUVRE.buildingId ||
    wall.index !== NORTH_COURTYARD_LOUVRE.wallIndex
  ) {
    return;
  }
  const along = wall.length * 0.31;
  const centreY = roofY - 1.28;
  const [sampleX, , sampleZ] = wallPoint(wall, along, centreY, 0.34);
  if (!isExposedAt(building.id, targets, sampleX, centreY, sampleZ)) return;
  addWallBox(
    builder,
    wall,
    TERRASSENHAUS_HAFENPLATZ_TONES.recess,
    along,
    centreY,
    0.14,
    NORTH_COURTYARD_LOUVRE.width,
    0.86,
    0.1,
    false,
    true,
  );
  for (let slat = 0; slat < 5; slat += 1) {
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.balconyRail,
      along,
      centreY - 0.3 + slat * 0.15,
      0.225,
      NORTH_COURTYARD_LOUVRE.width - 0.22,
      0.052,
      0.055,
    );
    counts.louvreSlats += 1;
  }
}

function addTerraceRegister(
  builder: Builder,
  building: PrismBuilding,
  wall: FacadeWall,
  targets: PrismBuilding[],
  roofY: number,
  counts: DetailCounts,
): void {
  const inset = Math.min(0.12, wall.length * 0.04);
  const usable = wall.length - inset * 2;
  if (usable < 0.5) return;
  const segments = Math.max(1, Math.ceil(usable / 2.55));
  const pitch = usable / segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const along = inset + pitch * (segment + 0.5);
    const [sampleX, , sampleZ] = wallPoint(wall, along, roofY - 0.4, 0.31);
    if (
      !isExposedAt(building.id, targets, sampleX, roofY - 0.4, sampleZ)
    ) {
      continue;
    }
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.recess,
      along,
      roofY - 0.81,
      0.1,
      Math.max(0.36, pitch - 0.05),
      0.13,
      0.13,
    );
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.parapet,
      along,
      roofY - 0.39,
      0.08,
      Math.max(0.36, pitch - 0.035),
      0.62,
      0.16,
      false,
      true,
    );
    addWallBox(
      builder,
      wall,
      TERRASSENHAUS_HAFENPLATZ_TONES.plaster,
      along,
      roofY - 0.065,
      0.13,
      Math.max(0.38, pitch + 0.01),
      0.1,
      0.22,
      false,
      true,
    );
    counts.terraceSegments += 1;
  }
}

function addFacadeRhythm(
  builder: Builder,
  building: PrismBuilding,
  targets: PrismBuilding[],
): DetailCounts {
  const counts = emptyDetailCounts();
  const y0 = building.y0_dm / 10;
  const height = building.h_dm / 10;
  const roofY = y0 + height;
  const floorHeight = height >= 29 ? 3.08 : 3.12;
  const floors = Math.max(2, Math.floor((height - 1.15) / floorHeight));
  const floorBase = y0 + 1.5;
  const walls = ringWalls(building.ring);
  const longestWall = Math.max(...walls.map((wall) => wall.length));

  for (const wall of walls) {
    const endWall =
      longestWall > wall.length + 2.4 && wall.length < longestWall * 0.82;
    const edgeInset = Math.min(endWall ? 0.62 : 0.7, wall.length * 0.1);
    const usable = wall.length - edgeInset * 2;
    if (usable < 2.05) continue;
    const bays = endWall
      ? Math.min(2, Math.max(1, Math.round(usable / 2.8)))
      : Math.max(1, Math.round(usable / 2.45));
    const pitch = usable / bays;
    const paneWidth = endWall
      ? Math.min(1.72, pitch * 0.68)
      : Math.min(1.86, pitch * 0.76);
    const glazedGround =
      TERRASSENHAUS_HAFENPLATZ_PERIMETER_IDS.has(building.id) &&
      !endWall &&
      wall.length >= 11.5;

    if (glazedGround) {
      addGroundFloorGlazing(
        builder,
        building,
        wall,
        targets,
        edgeInset,
        bays,
        pitch,
        paneWidth,
        floorHeight,
        counts,
      );
    }

    for (let floor = glazedGround ? 1 : 0; floor < floors; floor += 1) {
      const centreY = floorBase + floor * floorHeight;
      if (centreY + 0.9 > roofY - 0.66) continue;
      let hasBand = false;
      for (let bay = 0; bay < bays; bay += 1) {
        const along = edgeInset + pitch * (bay + 0.5);
        if (isBalconySlot(building, wall, floor, along)) continue;
        const [sampleX, , sampleZ] = wallPoint(wall, along, centreY, 0.34);
        if (!isExposedAt(building.id, targets, sampleX, centreY, sampleZ)) {
          continue;
        }
        addFramedWindow(
          builder,
          building,
          wall,
          along,
          centreY,
          paneWidth,
          floor,
          bay,
          counts,
        );

        const panelHeight = Math.max(0.72, floorHeight - 1.84);
        const panelY = centreY + floorHeight / 2;
        if (panelY + panelHeight / 2 < roofY - 0.68) {
          hasBand =
            addSpandrelPanel(
              builder,
              building,
              wall,
              targets,
              along,
              panelY,
              pitch,
              panelHeight,
              floor,
              bay,
              counts,
            ) || hasBand;
        }
      }
      if (hasBand) counts.facadeBands += 1;
    }

    addBalconyStack(
      builder,
      building,
      wall,
      targets,
      floorBase,
      floorHeight,
      roofY,
      counts,
    );
    addCourtyardLouvre(builder, building, wall, targets, roofY, counts);
    addTerraceRegister(builder, building, wall, targets, roofY, counts);
  }
  return counts;
}

/**
 * Source-bounded facade layer for the listed Brutalist ensemble.
 * The official shells remain visible and authoritative; this group only adds
 * the photographed ochre window grid, pebbled spandrels, courtyard loggias
 * and stepped roof edge. TU plan scans are rights-restricted and are neither
 * traced nor bundled; their catalogue records only confirm project identity.
 */
export function createTerrassenhausHafenplatz(prisms: PrismPayload): Group {
  const group = new Group();
  group.name = "Terrassenhaus Hafenplatz details";
  const targets = prisms.buildings.filter((building) =>
    TERRASSENHAUS_HAFENPLATZ_IDS.has(building.id),
  );
  if (targets.length !== TERRASSENHAUS_HAFENPLATZ_IDS.size) {
    group.userData.geometryStatus = "required LoD2 parts missing";
    return group;
  }

  const builder = createBuilder();
  const detailCounts = emptyDetailCounts();
  for (const building of targets) {
    mergeDetailCounts(
      detailCounts,
      addFacadeRhythm(builder, building, targets),
    );
  }
  const details = finishDrawnGroup(builder, {
    lampEmissive: TERRASSENHAUS_HAFENPLATZ_TONES.nightGlass,
    lampEmissiveIntensity: 0.48,
    name: "Terrassenhaus Hafenplatz architectural details",
  });
  if (details) group.add(details);
  group.userData.architecturalProfile = TERRASSENHAUS_HAFENPLATZ_PROFILE;
  group.userData.detailCounts = {
    ...detailCounts,
    perimeterSlabs: TERRASSENHAUS_HAFENPLATZ_PERIMETER_IDS.size,
    sourcePrisms: targets.length,
    steppedArms: TERRASSENHAUS_HAFENPLATZ_STEP_CHAINS.length,
    steppedHeightTiers: new Set(targets.map((building) => building.h_dm)).size,
  };
  group.userData.geometryStatus =
    TERRASSENHAUS_HAFENPLATZ_PROFILE.geometryStatus;
  return group;
}

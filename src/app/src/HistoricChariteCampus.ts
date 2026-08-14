import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Shape,
  ShapeGeometry,
} from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  addCone,
  addCylinder,
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

/** Six measured LoD2 parts of the Edmund-Lesser-Haus at Rahel-Hirsch-Weg 3. */
export const CHARITE_VIROLOGY_IDS: ReadonlySet<string> = new Set([
  "nPSZAX1V",
  "bzFr0aOE",
  "mEGhfy5X",
  "XJYVhYs0",
  "qMBTtfSO",
  "M09vcMVr",
]);

/** Twenty measured parts of the former Pathological Institute and museum. */
export const CHARITE_MEDICAL_MUSEUM_IDS: ReadonlySet<string> = new Set([
  "WCl6Bw6x",
  "z6MeXghE",
  "kE14CQ1A",
  "JPKNLMoR",
  "GvVmBh7X",
  "8iaMbUbh",
  "L1huVZLC",
  "6tNuQDav",
  "NhasaEcN",
  "gwXjAt32",
  "KfoCv8uc",
  "S8FCLrDr",
  "nbLoon0z",
  "ipiWvMxH",
  "wPdkkr3q",
  "a1867w53",
  "g4TL0DRA",
  "KOCFirSU",
  "ypVJ6uiG",
  "FYv2Tjwz",
]);

/** Six measured parts of the 1901 Friedrich-Althoff-Haus entrance ensemble. */
export const CHARITE_FRIEDRICH_ALTHOFF_IDS: ReadonlySet<string> = new Set([
  "f4N7OZJI",
  "t76KCSEh",
  "KztaII44",
  "50yMshCk",
  "YxDLPnmj",
  "a8CyAsQj",
]);

export const CHARITE_ALTHOFF_TOWER_ID = "50yMshCk";
export const CHARITE_ALTHOFF_TOWER_HELM_BOTTOM_Y_M = 20.1;

export const HISTORIC_CHARITE_IDS: ReadonlySet<string> = new Set([
  ...CHARITE_VIROLOGY_IDS,
  ...CHARITE_MEDICAL_MUSEUM_IDS,
  ...CHARITE_FRIEDRICH_ALTHOFF_IDS,
]);

/**
 * Source-bounded architectural interpretation over exact official shells.
 * Detail positions are deterministic facade reconstructions, not survey data.
 */
export const HISTORIC_CHARITE_PROFILE = {
  althoff: {
    built: 1901,
    facade: "light red brick, pale rendered fields and sandstone dressings",
    geometryStatus:
      "exact Berlin LoD2 shells and height; source-bounded unsurveyed facade articulation and measured-envelope tower helm",
    lod2Parent: "DEBE01YYK000087H",
    name: "Friedrich-Althoff-Haus",
    sourceUrls: [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011080",
      "https://sammlungsportal.charite.de/viewer/historischerrundgang/",
    ],
  },
  museum: {
    built: [1899, 1905],
    facade: "light red brick, pale plaster fields, sandstone and slate",
    geometryStatus:
      "exact Berlin LoD2 shells and heights; source-bounded unsurveyed segmental-window, cornice and roof articulation",
    lod2Parent: "DEBE01YYK000012I",
    name: "Berliner Medizinhistorisches Museum and former Pathology",
    sourceUrls: [
      "https://bmm-charite.de/museum",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011080",
    ],
  },
  virology: {
    built: [1956, 1960],
    facade: "pale post-war render, white window frames and restrained ivy",
    geometryStatus:
      "exact Berlin LoD2 shells and heights; official-photo-bounded unsurveyed facade and vegetation articulation",
    lod2Parent: "DEBE01YYK00003IB",
    name: "Edmund-Lesser-Haus / Institute of Virology",
    sourceUrls: [
      "https://virologie-ccm.charite.de/",
      "https://gedenkort.charite.de/orte/dermatologie/",
    ],
  },
} as const;

export const HISTORIC_CHARITE_TONES = {
  althoffFacade: 0xb96f59,
  brickDark: 0x9c5749,
  brickLight: 0xbf7059,
  glass: 0x526d75,
  glassDark: 0x40575f,
  ivyDark: 0x3f704e,
  ivyLight: 0x69905f,
  museumFacade: 0xb56a54,
  nightGlass: 0xffc86d,
  plaster: 0xe6d8bc,
  slate: 0x58636a,
  stone: 0xd5c7aa,
  virologyFacade: 0xd9ddd3,
  virologyFrame: 0xf0f0e8,
} as const;

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
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addWallLine(
  builder: Builder,
  wall: FacadeWall,
  y: number,
  outward: number,
  inset = 0.12,
): void {
  if (wall.length <= inset * 2) return;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        wall.x1 + wall.dirX * inset + wall.nx * outward,
        y,
        wall.z1 + wall.dirZ * inset + wall.nz * outward,
        wall.x1 + wall.dirX * (wall.length - inset) + wall.nx * outward,
        y,
        wall.z1 + wall.dirZ * (wall.length - inset) + wall.nz * outward,
      ],
      3,
    ),
  );
  builder.edges.push(geometry);
}

function segmentalWindowShape(width: number, height: number): Shape {
  const shoulder = height - Math.min(width * 0.34, height * 0.2);
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, shoulder);
  shape.quadraticCurveTo(0, height, -width / 2, shoulder);
  shape.closePath();
  return shape;
}

function addWallShape(
  builder: Builder,
  wall: FacadeWall,
  shape: Shape,
  color: number,
  along: number,
  bottomY: number,
  outward: number,
  lamp = false,
  inked = false,
): void {
  const geometry = new ShapeGeometry(shape, 8);
  const matrix = new Matrix4();
  matrix.set(
    wall.dirX,
    0,
    wall.nx,
    wall.x1 + wall.dirX * along + wall.nx * outward,
    0,
    1,
    0,
    bottomY,
    wall.dirZ,
    0,
    wall.nz,
    wall.z1 + wall.dirZ * along + wall.nz * outward,
    0,
    0,
    0,
    1,
  );
  geometry.applyMatrix4(matrix);
  paintGeometry(geometry, color);
  (lamp ? builder.lamps : builder.parts).push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function deterministicLit(
  id: string,
  wall: number,
  floor: number,
  bay: number,
) {
  let value = wall * 31 + floor * 17 + bay * 13;
  for (const char of id) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value % 11 < 2;
}

function addHeritageFacade(
  builder: Builder,
  building: PrismBuilding,
  ornate: boolean,
): { brickCourses: number; windows: number } {
  const y0 = building.y0_dm / 10;
  const height = Math.max(2.5, building.h_dm / 10);
  const roofReserve = Math.min(4.2, Math.max(1.1, height * 0.17));
  const facadeTop = y0 + height - roofReserve;
  let windows = 0;
  let brickCourses = 0;

  for (const wall of ringWalls(building.ring)) {
    if (wall.length < 2.5) continue;
    const outward = 0.135;
    addWallBox(
      builder,
      wall,
      HISTORIC_CHARITE_TONES.stone,
      wall.length / 2,
      y0 + 0.48,
      outward,
      wall.length + 0.12,
      0.88,
      0.12,
    );
    addWallBox(
      builder,
      wall,
      HISTORIC_CHARITE_TONES.plaster,
      wall.length / 2,
      facadeTop - 0.28,
      outward + 0.01,
      wall.length + 0.16,
      0.48,
      0.14,
      false,
      true,
    );
    for (let y = y0 + 1.14; y < facadeTop - 0.55; y += 1.12) {
      addWallLine(builder, wall, y, outward + 0.085);
      brickCourses += 1;
    }

    const floorPitch = ornate ? 4.05 : 4.18;
    const floors = Math.max(
      1,
      Math.floor((facadeTop - y0 - 1.25) / floorPitch),
    );
    const bayPitch = ornate ? 3.05 : 3.25;
    const bays = Math.max(1, Math.floor((wall.length - 1.2) / bayPitch));
    const actualPitch = (wall.length - 1.2) / bays;
    for (let floor = 0; floor < floors; floor += 1) {
      const bottom = y0 + 1.32 + floor * floorPitch;
      const outerWidth = Math.min(1.74, actualPitch * 0.61);
      const outerHeight = ornate ? 2.65 : 2.52;
      if (bottom + outerHeight > facadeTop - 0.3) continue;
      for (let bay = 0; bay < bays; bay += 1) {
        const along = 0.6 + actualPitch * (bay + 0.5);
        addWallShape(
          builder,
          wall,
          segmentalWindowShape(outerWidth, outerHeight),
          HISTORIC_CHARITE_TONES.plaster,
          along,
          bottom,
          outward + 0.035,
          false,
          true,
        );
        const paneWidth = outerWidth - 0.32;
        const paneHeight = outerHeight - 0.36;
        addWallShape(
          builder,
          wall,
          segmentalWindowShape(paneWidth, paneHeight),
          deterministicLit(building.id, wall.index, floor, bay)
            ? HISTORIC_CHARITE_TONES.nightGlass
            : HISTORIC_CHARITE_TONES.glassDark,
          along,
          bottom + 0.16,
          outward + 0.065,
          deterministicLit(building.id, wall.index, floor, bay),
        );
        addWallBox(
          builder,
          wall,
          HISTORIC_CHARITE_TONES.stone,
          along,
          bottom - 0.055,
          outward + 0.075,
          outerWidth + 0.18,
          0.11,
          0.12,
        );
        addWallBox(
          builder,
          wall,
          HISTORIC_CHARITE_TONES.stone,
          along,
          bottom + paneHeight * 0.58,
          outward + 0.09,
          paneWidth,
          0.055,
          0.08,
        );
        addWallBox(
          builder,
          wall,
          HISTORIC_CHARITE_TONES.stone,
          along,
          bottom + paneHeight * 0.43,
          outward + 0.09,
          0.055,
          paneHeight * 0.72,
          0.08,
        );
        windows += 1;
      }
    }
    if (ornate && wall.length >= 7) {
      for (const along of [0.42, wall.length - 0.42]) {
        addWallBox(
          builder,
          wall,
          HISTORIC_CHARITE_TONES.stone,
          along,
          y0 + (facadeTop - y0) / 2,
          outward + 0.025,
          0.42,
          facadeTop - y0,
          0.16,
          false,
          true,
        );
      }
    }
  }
  return { brickCourses, windows };
}

function addVirologyFacade(
  builder: Builder,
  building: PrismBuilding,
): { ivyPatches: number; windows: number } {
  const y0 = building.y0_dm / 10;
  const height = Math.max(2.5, building.h_dm / 10);
  const facadeTop = y0 + height - 0.7;
  let ivyPatches = 0;
  let windows = 0;
  for (const wall of ringWalls(building.ring)) {
    if (wall.length < 2.2) continue;
    const outward = 0.14;
    addWallBox(
      builder,
      wall,
      0x87908a,
      wall.length / 2,
      y0 + 0.38,
      outward,
      wall.length,
      0.62,
      0.11,
    );
    const floorPitch = 2.92;
    const floors = Math.max(1, Math.floor((height - 1.15) / floorPitch));
    const bays = Math.max(1, Math.floor((wall.length - 0.8) / 2.15));
    const pitch = (wall.length - 0.8) / bays;
    for (let floor = 0; floor < floors; floor += 1) {
      const centreY = y0 + 1.58 + floor * floorPitch;
      if (centreY + 1.05 > facadeTop) continue;
      for (let bay = 0; bay < bays; bay += 1) {
        const along = 0.4 + pitch * (bay + 0.5);
        const frameWidth = Math.min(1.48, pitch * 0.72);
        const lit = deterministicLit(building.id, wall.index, floor, bay);
        addWallBox(
          builder,
          wall,
          HISTORIC_CHARITE_TONES.virologyFrame,
          along,
          centreY,
          outward + 0.02,
          frameWidth,
          2.08,
          0.09,
        );
        addWallBox(
          builder,
          wall,
          lit
            ? HISTORIC_CHARITE_TONES.nightGlass
            : HISTORIC_CHARITE_TONES.glass,
          along,
          centreY,
          outward + 0.07,
          frameWidth - 0.24,
          1.78,
          0.07,
          lit,
        );
        addWallBox(
          builder,
          wall,
          HISTORIC_CHARITE_TONES.virologyFrame,
          along,
          centreY,
          outward + 0.1,
          0.055,
          1.78,
          0.04,
        );
        windows += 1;
      }
    }
    if (building.id === "mEGhfy5X" && wall.length >= 18) {
      for (const [fraction, shade] of [
        [0.15, HISTORIC_CHARITE_TONES.ivyDark],
        [0.76, HISTORIC_CHARITE_TONES.ivyLight],
      ] as const) {
        const ivyHeight = Math.min(9.2, height * (0.48 + fraction * 0.12));
        addWallBox(
          builder,
          wall,
          shade,
          wall.length * fraction,
          y0 + ivyHeight / 2,
          outward + 0.14,
          1.05 + fraction * 0.75,
          ivyHeight,
          0.16,
        );
        ivyPatches += 1;
      }
    }
  }
  return { ivyPatches, windows };
}

function addAlthoffTowerHelm(builder: Builder): void {
  // Centre and total top are read from LoD2 part 50yMshCk. The cone and
  // finial end at the measured 27.345 m world elevation rather than adding
  // an invented height above the official shell.
  const x = 483.75;
  const z = -494.55;
  const roofBottom = CHARITE_ALTHOFF_TOWER_HELM_BOTTOM_Y_M;
  const roofTop = 27.345;
  const coneHeight = 6.82;
  addCone(
    builder,
    HISTORIC_CHARITE_TONES.slate,
    x,
    roofBottom + coneHeight / 2,
    z,
    5.25,
    coneHeight,
    24,
  );
  addCylinder(builder, 0x4a5358, x, roofTop - 0.18, z, 0.09, 0.36, 8);
  addCone(builder, 0x596166, x, roofTop - 0.08, z, 0.2, 0.16, 8);

  // Four small dormer faces make the stair tower legible at close range.
  for (let index = 0; index < 4; index += 1) {
    const angle = (Math.PI / 2) * index;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    addBox(
      builder,
      HISTORIC_CHARITE_TONES.glassDark,
      x + dx * 3.75,
      22.18,
      z + dz * 3.75,
      Math.abs(dz) > 0.5 ? 1.05 : 0.12,
      1.2,
      Math.abs(dx) > 0.5 ? 1.05 : 0.12,
      0,
      true,
    );
  }
}

/** Mixed-form historical roofs rendered as source-bounded hipped caps. */
export function historicChariteRoofCode(
  buildingId: string,
  sourceCode: number,
): number {
  if (sourceCode !== 5000 || buildingId === CHARITE_ALTHOFF_TOWER_ID) {
    return sourceCode;
  }
  if (
    CHARITE_MEDICAL_MUSEUM_IDS.has(buildingId) ||
    CHARITE_FRIEDRICH_ALTHOFF_IDS.has(buildingId)
  ) {
    return 3200;
  }
  return sourceCode;
}

/**
 * Fine facade layer for the three source-distinct Charite ensembles.
 * It never replaces or moves their official LoD2 footprint geometry.
 */
export function createHistoricChariteCampus(prisms: PrismPayload): Group {
  const group = new Group();
  group.name = "Historic Charite campus details";
  const heritageBuilder = createBuilder();
  const virologyBuilder = createBuilder();
  let museumWindows = 0;
  let althoffWindows = 0;
  let virologyWindows = 0;
  let brickCourses = 0;
  let ivyPatches = 0;

  for (const building of prisms.buildings) {
    if (CHARITE_MEDICAL_MUSEUM_IDS.has(building.id)) {
      const counts = addHeritageFacade(heritageBuilder, building, false);
      museumWindows += counts.windows;
      brickCourses += counts.brickCourses;
    } else if (CHARITE_FRIEDRICH_ALTHOFF_IDS.has(building.id)) {
      const counts = addHeritageFacade(heritageBuilder, building, true);
      althoffWindows += counts.windows;
      brickCourses += counts.brickCourses;
    } else if (CHARITE_VIROLOGY_IDS.has(building.id)) {
      const counts = addVirologyFacade(virologyBuilder, building);
      virologyWindows += counts.windows;
      ivyPatches += counts.ivyPatches;
    }
  }
  addAlthoffTowerHelm(heritageBuilder);

  const heritage = finishDrawnGroup(heritageBuilder, {
    lampEmissive: HISTORIC_CHARITE_TONES.nightGlass,
    lampEmissiveIntensity: 0.72,
    name: "Charite heritage facade details",
  });
  if (heritage) group.add(heritage);
  const virology = finishDrawnGroup(virologyBuilder, {
    lampEmissive: HISTORIC_CHARITE_TONES.nightGlass,
    lampEmissiveIntensity: 0.68,
    name: "Charite Virology post-war facade details",
  });
  if (virology) group.add(virology);

  group.userData.architecturalProfiles = HISTORIC_CHARITE_PROFILE;
  group.userData.detailCounts = {
    althoffWindows,
    brickCourses,
    ivyPatches,
    museumWindows,
    sourcePrisms: HISTORIC_CHARITE_IDS.size,
    virologyWindows,
  };
  group.userData.geometryStatus =
    "official LoD2 shells retained; all facade detail is source-bounded, deterministic and explicitly unsurveyed";
  return group;
}

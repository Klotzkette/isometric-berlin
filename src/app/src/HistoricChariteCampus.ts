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

export type ChariteSourcePrism = Pick<PrismBuilding, "id" | "ring" | "y0_dm" | "h_dm"> & { holes?: number[][][] };

export type ChariteFacadeWall = {
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
      "https://commons.wikimedia.org/wiki/File:Friedrich-Althoff-Haus_Charit%C3%A9_Campus_Mitte_2024-05-09_01.jpg",
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
      "https://www.charite.de/service/pressemitteilung/artikel/detail/wieder_geoeffnet_berliner_medizinhistorisches_museum",
      "https://www.charite.de/en/service/map/plan/map/ccm_virchowweg_16/",
      "https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Virchowweg_14,_2025.jpg",
      "https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Virchowweg_16,_2025.jpg",
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

export function chariteRingWalls(ring: number[][]): ChariteFacadeWall[] {
  let doubleArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[(index + 1) % ring.length];
    doubleArea += x1 * z2 - x2 * z1;
  }
  const flip = doubleArea >= 0 ? 1 : -1;
  const walls: ChariteFacadeWall[] = [];
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
  wall: ChariteFacadeWall,
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
  wall: ChariteFacadeWall,
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
  wall: ChariteFacadeWall,
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
  // ShapeGeometry's local +Z winding becomes inward on counter-clockwise
  // source rings. Repair the triangles rather than hiding it with DoubleSide.
  if (matrix.determinant() < 0 && geometry.index) {
    const indices = geometry.index;
    for (let i = 0; i < indices.count; i += 3) {
      const second = indices.getX(i + 1);
      indices.setX(i + 1, indices.getX(i + 2));
      indices.setX(i + 2, second);
    }
  }
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

/** Roof rises derived from the shipped LoD2 plans by the existing roof fitter.
 * Kept separate from measured heights; tests compare these against that fitter.
 */
const CHARITE_PRESENTATION_ROOF_RISE: Readonly<Record<string, number>> = {
  t76KCSEh: 4.526422, KztaII44: 2.890276, f4N7OZJI: 1.506490,
  YxDLPnmj: 1.2, a1867w53: 3.311571, "8iaMbUbh": 3.877433,
  GvVmBh7X: 3.335511, L1huVZLC: 1.2, FYv2Tjwz: 1.2,
  nbLoon0z: 4.052172, z6MeXghE: 1.2, KfoCv8uc: 1.2,
  g4TL0DRA: 3.669679, ipiWvMxH: 1.2, kE14CQ1A: 1.2,
  "6tNuQDav": 4.077240, S8FCLrDr: 1.2, wPdkkr3q: 3.196970,
};

export function historicChariteFacadeTop(building: ChariteSourcePrism): number {
  if (building.id === CHARITE_ALTHOFF_TOWER_ID) {
    return CHARITE_ALTHOFF_TOWER_HELM_BOTTOM_Y_M;
  }
  return (building.y0_dm + building.h_dm) / 10 -
    (CHARITE_PRESENTATION_ROOF_RISE[building.id] ?? 0);
}

export function chariteContainsRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i].map(v => v / 10);
    const [bx, bz] = ring[j].map(v => v / 10);
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

export function chariteFacadePointExposed(
  sourceId: string, wall: ChariteFacadeWall, along: number, y: number,
  buildings: readonly ChariteSourcePrism[], outward = 0.24,
): boolean {
  const x = wall.x1 + wall.dirX * along + wall.nx * outward;
  const z = wall.z1 + wall.dirZ * along + wall.nz * outward;
  return !buildings.some(other => other.id !== sourceId &&
    y >= other.y0_dm / 10 && y <= (other.y0_dm + other.h_dm) / 10 &&
    chariteContainsRing(other.ring, x, z) &&
    !(other.holes ?? []).some(hole => chariteContainsRing(hole, x, z)));
}

export type ChariteHeritageWindow = {
  sourceId: string;
  wall: ChariteFacadeWall;
  along: number;
  bottom: number;
  width: number;
  height: number;
  floor: number;
  bay: number;
  paired: boolean;
  blind: boolean;
  streetAlthoff: boolean;
  museumStreet?: boolean;
  towerWindow?: boolean;
};

export function historicChariteWindows(
  building: ChariteSourcePrism, buildings: readonly ChariteSourcePrism[],
): ChariteHeritageWindow[] {
  const windows: ChariteHeritageWindow[] = [];
  const y0 = building.y0_dm / 10;
  const top = historicChariteFacadeTop(building);
  const ornate = CHARITE_FRIEDRICH_ALTHOFF_IDS.has(building.id);
  for (const wall of chariteRingWalls(building.ring)) {
    const towerWindow = building.id === CHARITE_ALTHOFF_TOWER_ID && wall.index >= 2 && wall.index <= 8;
    if (wall.length < (towerWindow ? 0.8 : 2.5)) continue;
    const streetAlthoff = building.id === CHARITE_ALTHOFF_TOWER_ID && wall.index === 0;
    if (building.id === "gwXjAt32" && [14,16].includes(wall.index)) {
      // OSM museum POI 2033362563 is inside this exact part. The two
      // northeast-facing source edges read the photographed 2023 vitrine
      // entrance; the window-to-edge correspondence is a display inference.
      const rows = wall.index === 14
        ? [{floor:0,bays:3,bottom:y0+0.5,height:6.2,width:2.9,paired:false},
           {floor:1,bays:4,bottom:y0+13.5,height:4.8,width:2.55,paired:true}]
        : [{floor:0,bays:3,bottom:y0+0.5,height:6.2,width:2.7,paired:false},
           ...[0,1,2].map(floor=>({floor:floor+1,bays:3,bottom:y0+8.3+floor*3.5,height:2.85,width:2.35,paired:true}))];
      for (const row of rows) for(let bay=0;bay<row.bays;bay++) {
        const along=(bay+0.5)*wall.length/row.bays;
        if (![along-row.width/2,along+row.width/2].every(u=>
          [row.bottom+0.2,row.bottom+row.height-0.2].every(y=>
            chariteFacadePointExposed(building.id,wall,u,y,buildings)))) continue;
        windows.push({sourceId:building.id,wall,along,bottom:row.bottom,width:row.width,height:row.height,
          floor:row.floor,bay,paired:row.paired,blind:false,streetAlthoff:false,museumStreet:true});
      }
      continue;
    }
    const floorPitch = streetAlthoff || towerWindow ? 4.65 : ornate ? 4.05 : 4.18;
    const floors = streetAlthoff || towerWindow ? 3 : Math.max(1, Math.floor((top - y0 - 1.25) / floorPitch));
    const bays = towerWindow ? 1 : streetAlthoff ? 7 : Math.max(1, Math.floor((wall.length - 1.2) / (ornate ? 3.05 : 3.25)));
    const margin = towerWindow ? 0.08 : 0.6;
    const pitch = (wall.length - margin * 2) / bays;
    for (let floor = 0; floor < floors; floor++) {
      const bottom = y0 + 1.32 + floor * floorPitch;
      const width = Math.min(towerWindow ? 0.96 : streetAlthoff ? 1.88 : 1.74, pitch * (towerWindow ? 0.9 : 0.61));
      const height = streetAlthoff || towerWindow ? 3.0 : ornate ? 2.65 : 2.52;
      if (bottom + height > top - 0.3) continue;
      for (let bay = 0; bay < bays; bay++) {
        const along = margin + pitch * (bay + 0.5);
        // Neighboring LoD2 parts used to bury a large share of the windows.
        // Sample both jambs and heights so connecting wings stay blank inside.
        if (![along - width / 2, along, along + width / 2].every(u =>
          [bottom + 0.2, bottom + height - 0.2].every(y =>
            chariteFacadePointExposed(building.id, wall, u, y, buildings)))) continue;
        windows.push({sourceId: building.id, wall, along, bottom, width, height,
          floor, bay, paired: streetAlthoff && floor === 2,
          blind: streetAlthoff && floor === 0 && bay === 0, streetAlthoff, towerWindow});
      }
    }
  }
  return windows;
}

function addHeritageFacade(
  builder: Builder, building: ChariteSourcePrism, ornate: boolean,
  buildings: readonly ChariteSourcePrism[], detailProfile: "full" | "mobile",
): { brickCourses: number; windows: number; pairedWindows: number; blindWindows: number } {
  const y0 = building.y0_dm / 10;
  const facadeTop = historicChariteFacadeTop(building);
  let brickCourses = 0;
  const outward = 0.135;
  for (const wall of chariteRingWalls(building.ring)) {
    if (wall.length < 2.5) continue;
    const clearAt = (y: number) => [0.25, 0.5, 0.75].some(fraction =>
      chariteFacadePointExposed(building.id, wall, wall.length * fraction, y, buildings));
    if (clearAt(y0 + 0.48)) addWallBox(builder, wall, 0xaaa697, wall.length / 2,
      y0 + 0.48, outward, wall.length, 0.88, 0.12);
    if (clearAt(facadeTop - 0.28)) {
      addWallBox(builder, wall, HISTORIC_CHARITE_TONES.stone, wall.length / 2,
        facadeTop - 0.28, outward + 0.01, wall.length, 0.32, 0.2, false, true);
      addWallBox(builder, wall, 0x535956, wall.length / 2,
        facadeTop - 0.06, outward + 0.10, wall.length, 0.12, 0.16);
    }
    for (let y = y0 + 1.14; y < facadeTop - 0.55; y += detailProfile === "mobile" ? 1.28 : 0.64) {
      if (!clearAt(y)) continue;
      addWallLine(builder, wall, y, 0.09);
      brickCourses++;
    }
    if (wall.length >= 7 && clearAt((y0 + facadeTop) / 2)) {
      // Rainwater pipes are slim metal; historic corners are not giant columns.
      for (const along of [0.23, wall.length - 0.23]) {
        if (!chariteFacadePointExposed(building.id, wall, along, (y0 + facadeTop) / 2, buildings)) continue;
        addWallBox(builder, wall, 0x566059, along, (y0 + facadeTop) / 2,
          0.26, 0.11, facadeTop - y0, 0.12);
      }
    }
    if (ornate && clearAt(y0 + 5.05)) addWallBox(builder, wall,
      HISTORIC_CHARITE_TONES.stone, wall.length / 2, y0 + 5.05,
      0.19, wall.length, 0.16, 0.14);
  }
  const windows = historicChariteWindows(building, buildings);
  const upperStreet = windows.filter(window => window.streetAlthoff && window.floor === 2);
  if (upperStreet.length) {
    const wall = upperStreet[0].wall;
    // The retained Lenz photograph shows continuous pale plaster between
    // the paired heads and the eaves, interrupted by red-brick ogee crowns.
    // This belongs only to the verified Althoff street wall, not every
    // historic campus elevation. Keep all existing opening coordinates.
    addWallBox(builder, wall, HISTORIC_CHARITE_TONES.plaster, wall.length/2,
      facadeTop-.94, .125, wall.length-.4, 1.32, .04);
    for (const window of upperStreet) {
      for (const side of [-1, 1]) {
        const crown = new Shape();
        const shoulderDrop = Math.min((window.width-.15)*.17,window.height*.2);
        const points = [[0,.58],[.15,.29],[.42,.12],[.5,-shoulderDrop]];
        crown.moveTo(side*points[0][0]*window.width,points[0][1]);
        for (const [x,y] of points.slice(1)) crown.lineTo(side*x*window.width,y);
        for (const [x,y] of [...points].reverse()) crown.lineTo(side*x*window.width,y+.105);
        crown.closePath();
        addWallShape(builder,wall,crown,HISTORIC_CHARITE_TONES.brickDark,
          window.along,window.bottom+window.height,.185);
      }
    }
  }
  for (const window of windows) {
    const {wall, along, bottom, width, height, paired, blind, streetAlthoff, floor, bay} = window;
    if (window.museumStreet && floor === 1 && wall.index === 14) {
      addWallBox(builder,wall,HISTORIC_CHARITE_TONES.plaster,along,bottom-3.0,0.16,width,5.75,0.07);
    }
    if (window.towerWindow && floor < 2) {
      addWallBox(builder,wall,HISTORIC_CHARITE_TONES.plaster,along,bottom+height+0.6,0.145,width+0.16,1.18,0.045);
    }
    if (streetAlthoff && floor === 1) {
      addWallBox(builder, wall, HISTORIC_CHARITE_TONES.plaster, along,
        bottom + height + 0.63, 0.16, width - 0.05, 1.27, 0.07);
      addWallBox(builder, wall, HISTORIC_CHARITE_TONES.brickLight, along,
        bottom + height + 0.63, 0.205, 0.12, 1.27, 0.035);
    }
    const pieces = paired ? 2 : 1;
    for (let piece = 0; piece < pieces; piece++) {
      const w = paired ? (width - 0.15) / 2 : width;
      const u = along + (paired ? (piece - 0.5) * (width / 2 + 0.075) : 0);
      addWallShape(builder, wall, segmentalWindowShape(w, height),
        HISTORIC_CHARITE_TONES.brickDark, u, bottom, 0.17, false, true);
      const paneWidth = w - 0.25, paneHeight = height - 0.28;
      const lit = !blind && deterministicLit(building.id, wall.index, floor, bay);
      addWallShape(builder, wall, segmentalWindowShape(paneWidth, paneHeight),
        blind ? HISTORIC_CHARITE_TONES.plaster : lit ? HISTORIC_CHARITE_TONES.nightGlass : HISTORIC_CHARITE_TONES.glassDark,
        u, bottom + 0.12, 0.215, lit);
      if (!blind) {
        addWallBox(builder, wall, HISTORIC_CHARITE_TONES.stone, u, bottom + paneHeight * 0.64,
          0.265, paneWidth, 0.065, 0.06);
        if (!paired) addWallBox(builder, wall, HISTORIC_CHARITE_TONES.stone, u,
          bottom + paneHeight * 0.46, 0.265, 0.075, paneHeight * 0.84, 0.06);
      }
      if (detailProfile !== "mobile") {
        // Five lighter voussoir cues around each photographed brick arch;
        // subdivisions are deliberately not represented as a masonry survey.
        for (let brick = 0; brick < 5; brick++) {
          const dx = (brick - 2) * w / 5;
          const rise = height - Math.min(w * 0.34, height * 0.2) +
            Math.min(w * 0.17, height * 0.1) * (1 - (dx / (w / 2)) ** 2);
          const brickFace = new Shape();
          brickFace.moveTo(-w/12,0);brickFace.lineTo(w/12,0);
          brickFace.lineTo(w/12,0.10);brickFace.lineTo(-w/12,0.10);brickFace.closePath();
          addWallShape(builder,wall,brickFace,HISTORIC_CHARITE_TONES.brickLight,
            u+dx,bottom+rise-0.015,0.245);
        }
      }
    }
    addWallBox(builder, wall, HISTORIC_CHARITE_TONES.stone, along, bottom - 0.055,
      0.22, width + 0.18, 0.13, 0.25);
  }
  return {brickCourses, windows: windows.length,
    pairedWindows: windows.filter(w => w.paired).length,
    blindWindows: windows.filter(w => w.blind).length};
}

function addVirologyFacade(
  builder: Builder,
  building: ChariteSourcePrism,
): { ivyPatches: number; windows: number } {
  const y0 = building.y0_dm / 10;
  const height = Math.max(2.5, building.h_dm / 10);
  const facadeTop = y0 + height - 0.7;
  let ivyPatches = 0;
  let windows = 0;
  for (const wall of chariteRingWalls(building.ring)) {
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

export const ALTHOFF_STREET_ROOF = {
  streetStart: [510.4, -500.9] as const,
  streetEnd: [487.4, -495.1] as const,
  ridgeInwardM: 4.84,
  eaveY: 20.1,
  ridgeY: 26.75,
  dormerCount: 4,
  geometryStatus: "street axis and outline from LoD2; roof and dormer proportions from CC0 facade photograph, within original 27.3 m envelope",
} as const;

export function chariteAlthoffRoofY(x: number, z: number): number {
  const p = ALTHOFF_STREET_ROOF;
  const length = Math.hypot(p.streetEnd[0] - p.streetStart[0], p.streetEnd[1] - p.streetStart[1]);
  const ux = (p.streetEnd[0] - p.streetStart[0]) / length;
  const uz = (p.streetEnd[1] - p.streetStart[1]) / length;
  const inward = -(x - p.streetStart[0]) * uz + (z - p.streetStart[1]) * ux;
  return p.eaveY + (p.ridgeY - p.eaveY) * Math.max(0, 1 - Math.abs(inward - p.ridgeInwardM) / p.ridgeInwardM);
}

function addAlthoffStreetRoof(builder: Builder, building: ChariteSourcePrism): void {
  const wall = chariteRingWalls(building.ring).find(w => w.index === 0)!;
  const ring = building.ring.map(([x,z]) => [x / 10, z / 10]);
  const ridge = ALTHOFF_STREET_ROOF.ridgeInwardM;
  const distance = ([x,z]: number[]) => -(x-wall.x1)*wall.nx-(z-wall.z1)*wall.nz-ridge;
  // Split the exact footprint at the procedural ridge, so triangulation cannot
  // bridge across the ridge and accidentally flatten this photographed roof.
  for (const side of [-1, 1]) {
    const clipped: number[][] = [];
    for (let i=0;i<ring.length;i++) {
      const a=ring[i], b=ring[(i+1)%ring.length], da=distance(a)*side, db=distance(b)*side;
      if (da>=0) clipped.push(a);
      if ((da>=0)!==(db>=0)) {
        const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      }
    }
    if(clipped.length<3) continue;
    const shape=new Shape();clipped.forEach(([x,z],i)=>i===0?shape.moveTo(x,-z):shape.lineTo(x,-z));shape.closePath();
    const geometry=new ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
    const position=geometry.getAttribute("position");
    for(let i=0;i<position.count;i++) position.setY(i,chariteAlthoffRoofY(position.getX(i),position.getZ(i)));
    paintGeometry(geometry,HISTORIC_CHARITE_TONES.slate);builder.parts.push(geometry);
    builder.edges.push(new EdgesGeometry(geometry,25));
  }
  for (let index=0;index<ALTHOFF_STREET_ROOF.dormerCount;index++) {
    const along=wall.length*(index+0.5)/ALTHOFF_STREET_ROOF.dormerCount;
    addWallBox(builder,wall,HISTORIC_CHARITE_TONES.slate,along,22.28,-1.75,2.65,2.0,1.75);
    addWallBox(builder,wall,HISTORIC_CHARITE_TONES.stone,along,22.24,-0.83,2.35,1.65,0.12);
    addWallBox(builder,wall,HISTORIC_CHARITE_TONES.glassDark,along,22.24,-0.73,2.12,1.43,0.08);
    for(const offset of [-0.53,0,0.53]) addWallBox(builder,wall,HISTORIC_CHARITE_TONES.stone,along+offset,22.24,-0.66,0.065,1.43,0.055);
    for(const y of [21.98,22.48]) addWallBox(builder,wall,HISTORIC_CHARITE_TONES.stone,along,y,-0.66,2.12,0.065,0.055);
    addWallBox(builder,wall,HISTORIC_CHARITE_TONES.slate,along,23.33,-1.72,2.83,0.13,1.92);
  }
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
export function createHistoricChariteCampus(
  prisms: PrismPayload, detailProfile: "full" | "mobile" = "full", diagnostics = false,
): Group {
  const group = new Group();
  group.name = "Historic Charite campus details";
  const heritageBuilder = createBuilder();
  const virologyBuilder = createBuilder();
  let museumWindows = 0;
  let althoffWindows = 0;
  let virologyWindows = 0;
  let brickCourses = 0;
  let ivyPatches = 0;
  let pairedWindows = 0;
  let blindWindows = 0;
  const sourceBuildings = prisms.buildings.filter(b => HISTORIC_CHARITE_IDS.has(b.id));

  for (const building of sourceBuildings) {
    if (CHARITE_MEDICAL_MUSEUM_IDS.has(building.id)) {
      const counts = addHeritageFacade(heritageBuilder, building, false, sourceBuildings, detailProfile);
      museumWindows += counts.windows;
      pairedWindows += counts.pairedWindows;
      blindWindows += counts.blindWindows;
      brickCourses += counts.brickCourses;
    } else if (CHARITE_FRIEDRICH_ALTHOFF_IDS.has(building.id)) {
      const counts = addHeritageFacade(heritageBuilder, building, true, sourceBuildings, detailProfile);
      althoffWindows += counts.windows;
      pairedWindows += counts.pairedWindows;
      blindWindows += counts.blindWindows;
      brickCourses += counts.brickCourses;
    } else if (CHARITE_VIROLOGY_IDS.has(building.id)) {
      const counts = addVirologyFacade(virologyBuilder, building);
      virologyWindows += counts.windows;
      ivyPatches += counts.ivyPatches;
    }
  }
  if (sourceBuildings.some(b => b.id === CHARITE_ALTHOFF_TOWER_ID)) {
    addAlthoffStreetRoof(heritageBuilder, sourceBuildings.find(b => b.id === CHARITE_ALTHOFF_TOWER_ID)!);
    addAlthoffTowerHelm(heritageBuilder);
  }

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
    sourcePrisms: sourceBuildings.length,
    pairedWindows,
    blindWindows,
    althoffDormers: sourceBuildings.some(b => b.id === CHARITE_ALTHOFF_TOWER_ID) ? 4 : 0,
    althoffUpperCrowns: sourceBuildings.some(b => b.id === CHARITE_ALTHOFF_TOWER_ID) ? 7 : 0,
    virologyWindows,
  };
  group.userData.detailProfile = detailProfile;
  if (diagnostics) group.userData.facadeWindowRecords = sourceBuildings.flatMap(b =>
    CHARITE_VIROLOGY_IDS.has(b.id) ? [] : historicChariteWindows(b, sourceBuildings));
  group.userData.geometryStatus =
    "official LoD2 shells retained; all facade detail is source-bounded, deterministic and explicitly unsurveyed";
  return group;
}

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
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

/** The three official LoD2 parts whose parent is the named ARD studio. */
export const ARD_HAUPTSTADTSTUDIO_IDS: ReadonlySet<string> = new Set([
  "OClyQw96",
  "G5qBz21a",
  "BMJAhW6D",
]);

/**
 * Semantic near-hits which must not inherit ARD detail. The five FGL parts
 * are the separately organised residential/service building described in the
 * published plan; 3ZPjjunb belongs to Humboldt-Universitaet.
 */
export const ARD_HAUPTSTADTSTUDIO_EXCLUDED_NEIGHBOR_IDS: ReadonlySet<string> =
  new Set([
    "KjFyc25B",
    "u7DkeJws",
    "9jw0hPYl",
    "CPvsuszZ",
    "EIXcS4uf",
    "3ZPjjunb",
  ]);

export const ARD_HAUPTSTADTSTUDIO_MAIN_ID = "G5qBz21a";
export const ARD_HAUPTSTADTSTUDIO_ATRIUM_ID = "BMJAhW6D";
export const ARD_HAUPTSTADTSTUDIO_STUDIO_HEAD_ID = "OClyQw96";
export const ARD_HAUPTSTADTSTUDIO_FLOOR_COUNT = 6;
export const ARD_HAUPTSTADTSTUDIO_NORTH_WALL_INDICES = [0, 1, 2, 3, 4] as const;
export const ARD_HAUPTSTADTSTUDIO_WEST_WALL_INDICES = [14, 15] as const;
export const ARD_HAUPTSTADTSTUDIO_NORTH_MODULE_PITCH_M = 2.75;
export const ARD_HAUPTSTADTSTUDIO_RECESS_SIDE_FRACTION = 0.31;
export const ARD_HAUPTSTADTSTUDIO_WINDOW_WIDTH_M = 1.74;
export const ARD_HAUPTSTADTSTUDIO_WINDOW_HEIGHT_M = 2.28;
export const ARD_HAUPTSTADTSTUDIO_FACADE_PROJECTION_M = 0.29;
export const ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE = 0.38;

export const ARD_HAUPTSTADTSTUDIO_TONES = {
  ardBlue: 0x003480,
  concrete: 0xa45f50,
  concreteDark: 0x8e4e43,
  concreteLight: 0xb66f5e,
  fixedGlass: 0x34494f,
  fixedGlassLight: 0x50686d,
  nightGlass: 0xffc777,
  rearOchre: 0xd4b276,
  rearOchreLight: 0xe0c48f,
  roofDataTag: 0x8a8d7a,
  techLight: 0xd8d6ca,
  techScreen: 0x55736e,
  techScreenDark: 0x3e5c59,
  woodFrame: 0x6d493d,
} as const;

export const ARD_HAUPTSTADTSTUDIO_PROFILE = {
  address: "Wilhelmstraße 67a, 10117 Berlin",
  areaM2: 1673.704,
  built: 1999,
  centreWorldM: [648.747, 25.342] as const,
  dimensionsM: [73.88, 37.69] as const,
  entrance: {
    positionWorldMApprox: [614.5, 30] as const,
    status:
      "west/Wilhelmstraße glass field retained but portal hardware understated because security changes approved in 2025 make the current state uncertain",
  },
  floorCount: ARD_HAUPTSTADTSTUDIO_FLOOR_COUNT,
  facadeLogo: {
    alongM: 15,
    sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
    wallIndex: 15,
  },
  geometryStatus:
    "three official Berlin LoD2 parts and measured heights retained; the hall part keeps its measured side shell while its visual top cap is split into a plan-bounded glass strip and opaque rear roof; facade and roof-equipment recognition details are thin source-bounded overlays, with photo-derived dimensions explicitly approximate; visual references only, with no photograph, thumbnail or facade texture bundled; no replacement envelope or mesh collision, while separate Schwellenraum navigation solids conservatively match the displayed roof equipment",
  lod2Parent: "DEBE01YYK00009j0",
  lod2Function: 3035,
  name: "ARD-Hauptstadtstudio Berlin",
  northFacade: {
    modulePitchM: ARD_HAUPTSTADTSTUDIO_NORTH_MODULE_PITCH_M,
    paneHeightM: ARD_HAUPTSTADTSTUDIO_WINDOW_HEIGHT_M,
    paneWidthM: ARD_HAUPTSTADTSTUDIO_WINDOW_WIDTH_M,
    recessSide: "consistent trailing side",
    recessSideFraction: ARD_HAUPTSTADTSTUDIO_RECESS_SIDE_FRACTION,
    sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
    wallIndices: ARD_HAUPTSTADTSTUDIO_NORTH_WALL_INDICES,
  },
  osm: {
    buildingColourTag: "#dfb082",
    floors: 6,
    roofColourTag: "#8a8d7a",
    roofShape: "flat",
    siteBoundsWorldM: [612.286, 702.472, 2.406, 44.205] as const,
    startDate: "1999",
    wayId: "24246741",
  },
  sourceConflict: {
    decision:
      "official LoD2 name/function plus the published plan make parent DEBE01YYK00009j0 the metric and semantic ARD boundary; OSM remains the source for address, six storeys and colour tags",
    excludedLod2Parent: "DEBE01YYK0000FGL",
    excludedLod2Function: 1120,
    note: "OSM way/24246741 spans east to world x=702.472 across the separately organised residential/service building, so additive name fusion alone over-selects the site",
    visibleColourDecision:
      "current freely licensed photographs supersede the unusually pale OSM building-colour mapper tag for presentation; the tag remains recorded as evidence",
  },
  sourcePartRoles: {
    [ARD_HAUPTSTADTSTUDIO_ATRIUM_ID]:
      "hall plus rear room wing; only the plan-bounded northern 38-percent roof strip receives transparent atrium recognition detail",
    [ARD_HAUPTSTADTSTUDIO_MAIN_ID]:
      "long gently curved Spree wing and externally visible west/rear envelope, including the large studio louvre field",
    [ARD_HAUPTSTADTSTUDIO_STUDIO_HEAD_ID]:
      "raised west Studio-A roof head; only its upper outline projects above the retained main shell",
  },
  presentationColours: {
    ardBlue: "#003480",
    concrete: "#A45F50",
    rear: "warm light ochre",
    roofMapperTag: "#8a8d7a",
  },
  sourceUrls: [
    "https://ortner-ortner.com/de/baukunst/projekte/kultur/ard-hauptstadtstudio-berlin",
    "https://www.zwp.de/de/projekte/medienzentren-und-messen/ard-hauptstadtstudio-berlin/",
    "https://www.berlin.de/sehenswuerdigkeiten/3560201-3558930-ardhauptstadtstudio-presse-und-informati.html",
    "https://www.nextroom.at/building.php?_inc=press&id=1907&sid=4169",
    "https://www.ard.de/ard-hauptstadtstudio/dialog/adresse-und-kontakt-100.html",
    "https://www.openstreetmap.org/way/24246741",
  ],
  westFacade: {
    sourcePrismId: ARD_HAUPTSTADTSTUDIO_MAIN_ID,
    wallIndices: ARD_HAUPTSTADTSTUDIO_WEST_WALL_INDICES,
  },
  visualReferences: [
    {
      artist: "Bärbel Miemietz",
      geometryStatus: "reference-only; file not bundled or used as a texture",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:2024-12-01_ARD_Hauptstadtstudio_1080537.JPG",
      role: "2024 north view across the Spree: current concrete colour, north-facade rhythm and roof-equipment bounds",
      title: "2024-12-01 ARD Hauptstadtstudio 1080537.JPG",
    },
    {
      artist: "Standardizer",
      geometryStatus: "reference-only; file not bundled or used as a texture",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:ARD-Hauptstadtstudio_(aus_Nordwesten).jpg",
      role: "north-west overview: curved Spree wing, western entrance/head and roof silhouette",
      title: "ARD-Hauptstadtstudio (aus Nordwesten).jpg",
    },
    {
      artist: "Ansgar Koreng",
      geometryStatus: "reference-only; file not bundled or used as a texture",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0",
      pageUrl:
        "https://commons.wikimedia.org/wiki/File:ARD-Hauptstadtstudio,_Berlin-Mitte,_Fassade,_170117,_ako.jpg",
      role: "facade detail: flush fixed glazing, timber frames and relief-like red-brown precast rhythm",
      title: "ARD-Hauptstadtstudio, Berlin-Mitte, Fassade, 170117, ako.jpg",
    },
  ],
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

function wallOf(building: PrismBuilding, index: number): FacadeWall {
  const wall = ringWalls(building.ring).find(
    (candidate) => candidate.index === index,
  );
  if (!wall) {
    throw new Error(
      `Missing wall ${index} on ARD Hauptstadtstudio part ${building.id}`,
    );
  }
  return wall;
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

function addPaintedGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  lamp = false,
  inked = false,
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
  const [x, resolvedY, z] = wallPoint(wall, along, y, outward);
  geometry.translate(x, resolvedY, z);
  addPaintedGeometry(builder, geometry, color, lamp, inked);
}

function addSegmentBox(
  builder: Builder,
  color: number,
  from: readonly [number, number],
  to: readonly [number, number],
  y: number,
  width: number,
  height: number,
  inked = false,
): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return;
  addBox(
    builder,
    color,
    (from[0] + to[0]) / 2,
    y,
    (from[1] + to[1]) / 2,
    length,
    height,
    width,
    -Math.atan2(dz, dx),
    inked,
  );
}

type NorthFacadeCounts = {
  fixedGlazing: number;
  frames: number;
  modules: number;
  precastPanels: number;
};

function addNorthFacade(
  builder: Builder,
  building: PrismBuilding,
): NorthFacadeCounts {
  const y0 = building.y0_dm / 10;
  const floorPitch = 3.6;
  const counts: NorthFacadeCounts = {
    fixedGlazing: 0,
    frames: 0,
    modules: 0,
    precastPanels: 0,
  };
  for (const wallIndex of ARD_HAUPTSTADTSTUDIO_NORTH_WALL_INDICES) {
    const wall = wallOf(building, wallIndex);
    const modules = Math.max(
      1,
      Math.round(wall.length / ARD_HAUPTSTADTSTUDIO_NORTH_MODULE_PITCH_M),
    );
    const moduleWidth = wall.length / modules;
    counts.modules += modules;
    for (let boundary = 0; boundary <= modules; boundary += 1) {
      addWallBox(
        builder,
        wall,
        ARD_HAUPTSTADTSTUDIO_TONES.concreteDark,
        boundary * moduleWidth,
        y0 + 10.8,
        0.105,
        0.16,
        20.9,
        0.12,
        false,
        false,
      );
      counts.frames += 1;
    }
    for (let floor = 0; floor < ARD_HAUPTSTADTSTUDIO_FLOOR_COUNT; floor += 1) {
      const centreY = y0 + floorPitch * (floor + 0.5);
      const glassHeight =
        floor === 0 ? 2.72 : ARD_HAUPTSTADTSTUDIO_WINDOW_HEIGHT_M;
      for (let module = 0; module < modules; module += 1) {
        const centreAlong = (module + 0.5) * moduleWidth;
        // Every photographed bay keeps the fixed pane on the same side and
        // the deep free strip on the other. Alternating this by floor would
        // invent a checkerboard that the real double facade does not have.
        const reliefOffset = ARD_HAUPTSTADTSTUDIO_RECESS_SIDE_FRACTION;
        const glassWidth = Math.min(
          ARD_HAUPTSTADTSTUDIO_WINDOW_WIDTH_M,
          Math.max(0.72, moduleWidth - 0.78),
        );
        addWallBox(
          builder,
          wall,
          floor === 0
            ? ARD_HAUPTSTADTSTUDIO_TONES.fixedGlassLight
            : ARD_HAUPTSTADTSTUDIO_TONES.fixedGlass,
          centreAlong - reliefOffset * 0.12,
          centreY,
          0.145,
          glassWidth,
          glassHeight,
          0.075,
          true,
          false,
        );
        counts.fixedGlazing += 1;
        if (floor > 0) {
          addWallBox(
            builder,
            wall,
            ARD_HAUPTSTADTSTUDIO_TONES.woodFrame,
            centreAlong,
            centreY,
            0.19,
            0.08,
            glassHeight - 0.18,
            0.045,
          );
          counts.frames += 1;
        }
        const reliefWidth = Math.min(0.56, moduleWidth * 0.27);
        addWallBox(
          builder,
          wall,
          (module + floor) % 3 === 0
            ? ARD_HAUPTSTADTSTUDIO_TONES.concreteLight
            : ARD_HAUPTSTADTSTUDIO_TONES.concrete,
          centreAlong + reliefOffset * moduleWidth,
          centreY,
          0.205,
          reliefWidth,
          floor === 0 ? 2.94 : 2.45,
          0.115,
          false,
          true,
        );
        counts.precastPanels += 1;
      }
      addWallBox(
        builder,
        wall,
        floor % 2 === 0
          ? ARD_HAUPTSTADTSTUDIO_TONES.concrete
          : ARD_HAUPTSTADTSTUDIO_TONES.concreteDark,
        wall.length / 2,
        y0 + floorPitch * (floor + 1) - 0.3,
        0.115,
        wall.length - 0.08,
        0.48,
        0.1,
      );
      counts.precastPanels += 1;
    }
  }
  return counts;
}

function addRearFacade(
  builder: Builder,
  main: PrismBuilding,
  atrium: PrismBuilding,
): { bands: number; facadeSkins: number; windows: number } {
  const walls = [
    { building: atrium, needsOchreSkin: false, wall: wallOf(atrium, 1) },
    { building: main, needsOchreSkin: true, wall: wallOf(main, 13) },
  ];
  let bands = 0;
  let facadeSkins = 0;
  let windows = 0;
  for (const { building, needsOchreSkin, wall } of walls) {
    const y0 = building.y0_dm / 10;
    if (needsOchreSkin) {
      const skinHeight = building.h_dm / 10 - 0.2;
      addWallBox(
        builder,
        wall,
        ARD_HAUPTSTADTSTUDIO_TONES.rearOchre,
        wall.length / 2,
        y0 + skinHeight / 2 + 0.1,
        0.075,
        wall.length - 0.12,
        skinHeight,
        0.055,
      );
      facadeSkins += 1;
    }
    const modules = Math.max(2, Math.floor(wall.length / 4.3));
    const pitch = wall.length / modules;
    for (let floor = 0; floor < ARD_HAUPTSTADTSTUDIO_FLOOR_COUNT; floor += 1) {
      addWallBox(
        builder,
        wall,
        floor % 2 === 0
          ? ARD_HAUPTSTADTSTUDIO_TONES.rearOchre
          : ARD_HAUPTSTADTSTUDIO_TONES.rearOchreLight,
        wall.length / 2,
        y0 + 3.6 * (floor + 1) - 0.42,
        0.12,
        wall.length - 0.12,
        0.72,
        0.09,
      );
      bands += 1;
      if (floor === 0) continue;
      for (let module = floor % 2; module < modules; module += 2) {
        addWallBox(
          builder,
          wall,
          ARD_HAUPTSTADTSTUDIO_TONES.fixedGlass,
          (module + 0.5) * pitch,
          y0 + 3.6 * (floor + 0.5),
          0.15,
          Math.min(1.35, pitch * 0.42),
          1.72,
          0.075,
          true,
        );
        windows += 1;
      }
    }
  }
  return { bands, facadeSkins, windows };
}

function addWestFacade(
  builder: Builder,
  main: PrismBuilding,
): { entranceGlazing: number } {
  const west = wallOf(main, 14);
  const y0 = main.y0_dm / 10;
  const target: readonly [number, number] = [615, 30];
  const entranceAlong = Math.max(
    4,
    Math.min(
      west.length - 4,
      (target[0] - west.x1) * west.dirX + (target[1] - west.z1) * west.dirZ,
    ),
  );
  addWallBox(
    builder,
    west,
    ARD_HAUPTSTADTSTUDIO_TONES.fixedGlass,
    entranceAlong,
    y0 + 2.55,
    0.17,
    7.2,
    4.45,
    0.09,
    true,
    true,
  );
  for (let mullion = -2; mullion <= 2; mullion += 1) {
    addWallBox(
      builder,
      west,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      entranceAlong + mullion * 1.18,
      y0 + 2.55,
      0.225,
      0.09,
      4.24,
      0.045,
    );
  }
  // Security works approved in 2025 make the exact current portal uncertain;
  // retain the documented west glass field without inventing turnstiles.
  return { entranceGlazing: 1 };
}

function addWestStudioAndRaisedHeadDetail(
  builder: Builder,
  main: PrismBuilding,
  studioHead: PrismBuilding,
): {
  lamellaBars: number;
  roofEdgeBands: number;
  studioGlazingFields: number;
  upperCornerGlazing: number;
} {
  const topY = (studioHead.y0_dm + studioHead.h_dm) / 10;
  const mainY0 = main.y0_dm / 10;
  const west = wallOf(main, ARD_HAUPTSTADTSTUDIO_WEST_WALL_INDICES[0]);
  const north = wallOf(main, ARD_HAUPTSTADTSTUDIO_WEST_WALL_INDICES[1]);
  const westFieldAlong = west.length - 6.1;
  const westGlazingY = mainY0 + 10.25;
  const cornerGlazingY = mainY0 + 19.15;

  addWallBox(
    builder,
    west,
    ARD_HAUPTSTADTSTUDIO_TONES.fixedGlassLight,
    westFieldAlong,
    westGlazingY,
    0.16,
    10.4,
    12.25,
    0.08,
    true,
    true,
  );
  addWallBox(
    builder,
    north,
    ARD_HAUPTSTADTSTUDIO_TONES.fixedGlassLight,
    4.0,
    cornerGlazingY,
    0.16,
    6.8,
    4.45,
    0.08,
    true,
    true,
  );
  for (let mullion = 1; mullion <= 3; mullion += 1) {
    addWallBox(
      builder,
      west,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      westFieldAlong - 5.2 + (10.4 * mullion) / 4,
      westGlazingY,
      0.215,
      0.08,
      12.0,
      0.04,
    );
  }
  for (let mullion = 1; mullion <= 2; mullion += 1) {
    addWallBox(
      builder,
      north,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      4.0 - 3.4 + (6.8 * mullion) / 3,
      cornerGlazingY,
      0.215,
      0.08,
      4.2,
      0.04,
    );
  }
  let lamellaBars = 0;
  for (let lamella = 0; lamella < 9; lamella += 1) {
    addWallBox(
      builder,
      west,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      westFieldAlong,
      westGlazingY - 5.28 + lamella * 1.32,
      0.225,
      10.2,
      0.1,
      0.045,
    );
    lamellaBars += 1;
  }

  let roofEdgeBands = 0;
  for (const wall of ringWalls(studioHead.ring)) {
    addWallBox(
      builder,
      wall,
      ARD_HAUPTSTADTSTUDIO_TONES.concreteDark,
      wall.length / 2,
      topY - 0.32,
      0.11,
      wall.length - 0.04,
      0.46,
      0.08,
    );
    roofEdgeBands += 1;
  }

  // The large louvred field belongs on the externally visible G5 west face,
  // not on OCly's two shared seams, which are hidden below the G5 roof. OCly
  // remains the measured raised roof head and only receives its top edge.
  return {
    lamellaBars,
    roofEdgeBands,
    studioGlazingFields: 2,
    upperCornerGlazing: 1,
  };
}

function createFacadeTextPanel(
  main: PrismBuilding,
  options: {
    along: number;
    capHeight: number;
    height: number;
    name: string;
    text: string;
    wallIndex: number;
    width: number;
    y: number;
  },
): Mesh {
  const wall = wallOf(main, options.wallIndex);
  const texture = createLetteringTexture({
    bandHeightM: options.height,
    bandWidthM: options.width,
    capHeightM: options.capHeight,
    fieldColor: "rgba(0,0,0,0)",
    letterColor: "#003480",
    text: options.text,
    texelsPerMetre: 210,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({
        alphaTest: 0.08,
        depthWrite: false,
        map: texture,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshBasicMaterial({ opacity: 0, transparent: true });
  const nightMaterial = texture
    ? new MeshStandardMaterial({
        alphaTest: 0.08,
        depthWrite: false,
        emissive: ARD_HAUPTSTADTSTUDIO_TONES.ardBlue,
        emissiveIntensity: 0.48,
        map: texture,
        side: DoubleSide,
        transparent: true,
      })
    : new MeshStandardMaterial({ opacity: 0, transparent: true });
  const sign = new Mesh(
    new PlaneGeometry(options.width, options.height),
    dayMaterial,
  );
  const [x, y, z] = wallPoint(wall, options.along, options.y, 0.255);
  sign.position.set(x, y, z);
  // PlaneGeometry's authored front points along local +Z. Align that front
  // with the measured wall's outward normal so the code-generated lettering
  // reads correctly from the Spree instead of exposing a mirrored back face.
  sign.rotation.y = Math.atan2(wall.nx, wall.nz);
  sign.name = options.name;
  sign.renderOrder = 5;
  sign.userData.dayMaterial = dayMaterial;
  sign.userData.logoColour = "#003480";
  sign.userData.nightMaterial = nightMaterial;
  sign.userData.positionStatus = "upper western half of the Spree facade";
  sign.userData.sourceOutwardNormal = [wall.nx, wall.nz];
  sign.userData.sourceWallIndex = options.wallIndex;
  sign.userData.text = options.text;
  sign.userData.textureSource =
    "runtime code-generated lettering canvas; no reference photograph or thumbnail";
  return sign;
}

function createFacadeLabel(main: PrismBuilding): Group {
  const label = new Group();
  label.name = "ARD Hauptstadtstudio facade logo assembly";
  const y0 = main.y0_dm / 10;
  label.add(
    createFacadeTextPanel(main, {
      along: 15,
      capHeight: 1.45,
      height: 2.45,
      name: "ARD HAUPTSTADTSTUDIO facade lettering",
      text: "ARD  1",
      wallIndex: 15,
      width: 7.8,
      y: y0 + 18.75,
    }),
  );
  label.add(
    createFacadeTextPanel(main, {
      along: 15,
      capHeight: 0.43,
      height: 0.88,
      name: "ARD Hauptstadtstudio facade subtitle",
      text: "HAUPTSTADTSTUDIO",
      wallIndex: 15,
      width: 9.8,
      y: y0 + 16.95,
    }),
  );
  label.userData.layout =
    "large ARD/1 mark above smaller HAUPTSTADTSTUDIO line";
  label.userData.logoColour = "#003480";
  label.userData.positionStatus = "upper western half of the Spree facade";
  label.userData.textureSource =
    "runtime code-generated lettering canvas; no reference photograph or thumbnail";
  return label;
}

function atriumRoofPoints(
  atrium: PrismBuilding,
): readonly (readonly [number, number])[] {
  const footprint = atrium.ring.map(
    ([x, z]) => [x / 10, z / 10] as readonly [number, number],
  );
  const westInner = interpolate(
    footprint[3],
    footprint[2],
    ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE,
  );
  const eastInner = interpolate(
    footprint[0],
    footprint[1],
    ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE,
  );
  return [footprint[3], footprint[0], eastInner, westInner];
}

function rearRoofPoints(
  atrium: PrismBuilding,
): readonly (readonly [number, number])[] {
  const footprint = atrium.ring.map(
    ([x, z]) => [x / 10, z / 10] as readonly [number, number],
  );
  const glass = atriumRoofPoints(atrium);
  return [glass[3], glass[2], footprint[1], footprint[2]];
}

function horizontalQuadGeometry(
  points: readonly (readonly [number, number])[],
  y: number,
): BufferGeometry {
  const geometry = new BufferGeometry();
  // The source footprints are counter-clockwise in the x/z plane. Reverse
  // triangle winding in Three's x/y/z space so both faces point upward.
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        points[0][0],
        y,
        points[0][1],
        points[2][0],
        y,
        points[2][1],
        points[1][0],
        y,
        points[1][1],
        points[0][0],
        y,
        points[0][1],
        points[3][0],
        y,
        points[3][1],
        points[2][0],
        y,
        points[2][1],
      ],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function planarArea(points: readonly (readonly [number, number])[]): number {
  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, z1] = points[index];
    const [x2, z2] = points[(index + 1) % points.length];
    doubledArea += x1 * z2 - x2 * z1;
  }
  return Math.abs(doubledArea) / 2;
}

function createAtriumRoofGlazing(atrium: PrismBuilding): Mesh {
  const points = atriumRoofPoints(atrium);
  const topY = (atrium.y0_dm + atrium.h_dm) / 10 + 0.045;
  const geometry = horizontalQuadGeometry(points, topY);
  const dayMaterial = new MeshBasicMaterial({
    color: ARD_HAUPTSTADTSTUDIO_TONES.fixedGlassLight,
    depthWrite: false,
    opacity: 0.46,
    side: DoubleSide,
    transparent: true,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: ARD_HAUPTSTADTSTUDIO_TONES.fixedGlass,
    depthWrite: false,
    emissive: 0x24383d,
    emissiveIntensity: 0.58,
    opacity: 0.64,
    roughness: 0.28,
    side: DoubleSide,
    transparent: true,
  });
  const roof = new Mesh(geometry, dayMaterial);
  roof.name = "ARD Hauptstadtstudio atrium roof glazing";
  roof.renderOrder = 3;
  roof.userData.dayMaterial = dayMaterial;
  roof.userData.nightMaterial = nightMaterial;
  roof.userData.opaqueEnvelope = false;
  roof.userData.coverageFraction = ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE;
  roof.userData.geometryStatus =
    "plan-bounded northern hall strip over the retained LoD2 side shell; the original opaque visual cap is removed and the rear roof is restored separately";
  roof.userData.sourceRoofCapReplaced = true;
  roof.userData.sourcePrismId = atrium.id;
  roof.userData.planarAreaM2 = planarArea(points);
  return roof;
}

function createOpaqueRearRoof(atrium: PrismBuilding): Mesh {
  const points = rearRoofPoints(atrium);
  const topY = (atrium.y0_dm + atrium.h_dm) / 10 + 0.02;
  const dayMaterial = new MeshBasicMaterial({
    color: ARD_HAUPTSTADTSTUDIO_TONES.roofDataTag,
  });
  const nightMaterial = new MeshStandardMaterial({
    color: ARD_HAUPTSTADTSTUDIO_TONES.roofDataTag,
    metalness: 0,
    roughness: 0.92,
  });
  const roof = new Mesh(horizontalQuadGeometry(points, topY), dayMaterial);
  roof.name = "ARD Hauptstadtstudio opaque rear roof";
  roof.userData.dayMaterial = dayMaterial;
  roof.userData.geometryStatus =
    "opaque rear room-wing cap restored over the retained LoD2 side shell";
  roof.userData.nightMaterial = nightMaterial;
  roof.userData.opaqueEnvelope = false;
  roof.userData.planarAreaM2 = planarArea(points);
  roof.userData.sourcePrismId = atrium.id;
  roof.userData.sourceRoofCapReplaced = true;
  return roof;
}

function interpolate(
  from: readonly [number, number],
  to: readonly [number, number],
  t: number,
): [number, number] {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function addAtriumRoofGrid(builder: Builder, atrium: PrismBuilding): number {
  const points = atriumRoofPoints(atrium);
  const topY = (atrium.y0_dm + atrium.h_dm) / 10 + 0.11;
  let bars = 0;
  for (let index = 0; index <= 12; index += 1) {
    const t = index / 12;
    addSegmentBox(
      builder,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      interpolate(points[0], points[1], t),
      interpolate(points[3], points[2], t),
      topY,
      0.13,
      0.14,
    );
    bars += 1;
  }
  for (let index = 0; index <= 5; index += 1) {
    const t = index / 5;
    addSegmentBox(
      builder,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      interpolate(points[0], points[3], t),
      interpolate(points[1], points[2], t),
      topY + 0.015,
      0.13,
      0.14,
    );
    bars += 1;
  }
  return bars;
}

function addSatelliteDish(
  builder: Builder,
  x: number,
  baseY: number,
  z: number,
  diameter: number,
  azimuth: number,
  tilt: number,
): void {
  const stemHeight = Math.max(0.55, diameter * 0.34);
  addCylinder(
    builder,
    ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
    x,
    baseY + stemHeight / 2,
    z,
    Math.max(0.07, diameter * 0.028),
    stemHeight,
    10,
  );
  const dish = new CylinderGeometry(
    diameter * 0.08,
    diameter / 2,
    0.16,
    20,
    1,
    true,
  );
  dish.rotateX(tilt);
  dish.rotateY(azimuth);
  dish.translate(x, baseY + stemHeight + diameter * 0.18, z);
  addPaintedGeometry(
    builder,
    dish,
    ARD_HAUPTSTADTSTUDIO_TONES.techLight,
    false,
    true,
  );
}

function addRoofEquipment(
  builder: Builder,
  main: PrismBuilding,
): {
  dishDiametersM: readonly number[];
  mastHeightM: number;
  ventCount: number;
} {
  const roofY = (main.y0_dm + main.h_dm) / 10;
  const screenRotation = -0.18;
  addBox(
    builder,
    ARD_HAUPTSTADTSTUDIO_TONES.techScreen,
    650.2,
    roofY + 0.72,
    17.25,
    7.6,
    1.35,
    0.18,
    screenRotation,
    true,
  );
  for (let vent = 0; vent < 6; vent += 1) {
    const localX = -2.85 + vent * 1.14;
    const cosine = Math.cos(screenRotation);
    const sine = Math.sin(screenRotation);
    addBox(
      builder,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      650.2 + localX * cosine + 0.12 * sine,
      roofY + 0.72,
      17.25 - localX * sine + 0.12 * cosine,
      0.72,
      0.82,
      0.055,
      screenRotation,
      false,
    );
  }
  addBox(
    builder,
    ARD_HAUPTSTADTSTUDIO_TONES.techLight,
    660.0,
    roofY + 0.58,
    15.0,
    2.25,
    1.12,
    1.55,
    -0.09,
    true,
  );
  const dishDiametersM = [3.8, 1.35, 1.1] as const;
  addSatelliteDish(
    builder,
    621.5,
    roofY + 0.05,
    24.0,
    dishDiametersM[0],
    -0.55,
    0.9,
  );
  addSatelliteDish(
    builder,
    625.5,
    roofY + 0.05,
    27.2,
    dishDiametersM[1],
    0.35,
    0.82,
  );
  addSatelliteDish(
    builder,
    638.0,
    roofY + 0.05,
    19.0,
    dishDiametersM[2],
    -0.2,
    0.84,
  );
  const mastHeightM = 7.2;
  addCylinder(
    builder,
    ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
    628.0,
    roofY + mastHeightM / 2,
    19.8,
    0.1,
    mastHeightM,
    10,
  );
  for (const y of [roofY + 4.7, roofY + 6.15]) {
    addBox(
      builder,
      ARD_HAUPTSTADTSTUDIO_TONES.techScreenDark,
      628.0,
      y,
      19.8,
      1.28,
      0.07,
      0.07,
      0,
      false,
    );
  }
  return { dishDiametersM, mastHeightM, ventCount: 6 };
}

/**
 * Thin recognition detail over the three untouched official shells.
 * No element is registered as collision and no full-height volume is built.
 */
export function createArdHauptstadtstudio(prisms: PrismPayload): Group {
  const group = new Group();
  group.name = "ARD Hauptstadtstudio details";
  const byId = new Map(
    prisms.buildings.map((building) => [building.id, building]),
  );
  const main = byId.get(ARD_HAUPTSTADTSTUDIO_MAIN_ID);
  const atrium = byId.get(ARD_HAUPTSTADTSTUDIO_ATRIUM_ID);
  const studioHead = byId.get(ARD_HAUPTSTADTSTUDIO_STUDIO_HEAD_ID);
  if (!main || !atrium || !studioHead) {
    group.userData.geometryStatus = "required LoD2 parts missing";
    return group;
  }

  const builder = createBuilder();
  const north = addNorthFacade(builder, main);
  const rear = addRearFacade(builder, main, atrium);
  const west = addWestFacade(builder, main);
  const westStudioDetail = addWestStudioAndRaisedHeadDetail(
    builder,
    main,
    studioHead,
  );
  const roofGridBars = addAtriumRoofGrid(builder, atrium);
  const roofEquipment = addRoofEquipment(builder, main);
  const details = finishDrawnGroup(builder, {
    lampEmissive: ARD_HAUPTSTADTSTUDIO_TONES.nightGlass,
    lampEmissiveIntensity: 0.58,
    name: "ARD Hauptstadtstudio architectural details",
  });
  if (details) group.add(details);
  const opaqueRearRoof = createOpaqueRearRoof(atrium);
  const atriumRoofGlazing = createAtriumRoofGlazing(atrium);
  group.add(opaqueRearRoof);
  group.add(atriumRoofGlazing);
  group.add(createFacadeLabel(main));

  group.userData.architecturalProfile = ARD_HAUPTSTADTSTUDIO_PROFILE;
  group.userData.visualReferences =
    ARD_HAUPTSTADTSTUDIO_PROFILE.visualReferences;
  group.userData.detailCounts = {
    atriumRoofAreaM2Approx: atriumRoofGlazing.userData.planarAreaM2,
    atriumRoofCoverageFraction: ARD_HAUPTSTADTSTUDIO_ATRIUM_ROOF_COVERAGE,
    atriumRoofGridBars: roofGridBars,
    opaqueRearRoofAreaM2: opaqueRearRoof.userData.planarAreaM2,
    entranceGlazing: west.entranceGlazing,
    fixedGlazing: north.fixedGlazing,
    frameElements: north.frames,
    northCurveModules: north.modules,
    precastPanels: north.precastPanels,
    rearBands: rear.bands,
    rearFacadeSkins: rear.facadeSkins,
    rearWindows: rear.windows,
    roofDishes: roofEquipment.dishDiametersM.length,
    sourcePrisms: ARD_HAUPTSTADTSTUDIO_IDS.size,
    westStudioGlazingFields: westStudioDetail.studioGlazingFields,
    westStudioLamellaBars: westStudioDetail.lamellaBars,
    studioHeadRoofEdgeBands: westStudioDetail.roofEdgeBands,
    upperCornerGlazing: westStudioDetail.upperCornerGlazing,
    ventCount: roofEquipment.ventCount,
  };
  group.userData.excludedNeighborIds = [
    ...ARD_HAUPTSTADTSTUDIO_EXCLUDED_NEIGHBOR_IDS,
  ];
  group.userData.geometryStatus = ARD_HAUPTSTADTSTUDIO_PROFILE.geometryStatus;
  group.userData.hasOpaqueEnvelope = false;
  group.userData.maxFacadeProjectionM =
    ARD_HAUPTSTADTSTUDIO_FACADE_PROJECTION_M;
  group.userData.roofEquipment = {
    diameterStatus: "photo-bounded approximation",
    displayApproximation: true,
    dishDiametersM: roofEquipment.dishDiametersM,
    mastHeightM: roofEquipment.mastHeightM,
    positionStatus:
      "display approximation, photo-bounded within the measured studio roof profile",
  };
  group.userData.sourcePrismIds = [...ARD_HAUPTSTADTSTUDIO_IDS];
  return group;
}

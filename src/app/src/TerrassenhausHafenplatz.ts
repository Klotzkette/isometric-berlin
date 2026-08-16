import { BoxGeometry, EdgesGeometry, Group } from "three";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";

type FacadeWall = {
  dirX: number;
  dirZ: number;
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

export const TERRASSENHAUS_HAFENPLATZ_PROFILE = {
  address: "Hafenplatz 6-10, 10963 Berlin",
  architect: "Helmut Ollk",
  built: "1971-1973",
  geometryStatus:
    "all 26 Berlin LoD2 footprints and measured heights retained; window rhythm, stepped parapet registers and courtyard articulation are deterministic photo-bounded reconstructions, not surveyed facade geometry",
  lod2Parent: "DEBE02YY400003Qa",
  name: "Gebaeudekomplex Terrassenhaus am Hafenplatz",
  sourceUrls: [
    "https://architekturmuseum.ub.tu-berlin.de/index.php?O=388217&p=51",
    "https://www.deutsche-digitale-bibliothek.de/item/XTMUGMVDUUWMZTKKSRFPJREQEHJWPBO5",
    "https://de.wikipedia.org/wiki/Geb%C3%A4udekomplex_Terrassenhaus_am_Hafenplatz",
  ],
} as const;

export const TERRASSENHAUS_HAFENPLATZ_TONES = {
  concrete: 0xd8d6ce,
  concreteShade: 0xb8b8b3,
  frameOchre: 0xb99a56,
  glass: 0x6f8587,
  nightGlass: 0xffc979,
  parapet: 0xc8c7c0,
  recess: 0x5b6160,
} as const;

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
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
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

function addFacadeRhythm(
  builder: Builder,
  building: PrismBuilding,
  targets: PrismBuilding[],
): { bands: number; windows: number } {
  const y0 = building.y0_dm / 10;
  const height = building.h_dm / 10;
  const floorHeight = height >= 29 ? 3.08 : 3.12;
  const floors = Math.max(2, Math.floor((height - 1.15) / floorHeight));
  const floorBase = y0 + 1.5;
  let bands = 0;
  let windows = 0;

  for (const wall of ringWalls(building.ring)) {
    const edgeInset = Math.min(0.72, wall.length * 0.09);
    const usable = wall.length - edgeInset * 2;
    if (usable < 2.2) continue;
    const bays = Math.max(1, Math.floor(usable / 2.75));
    const pitch = usable / bays;
    const paneWidth = Math.min(1.8, pitch * 0.68);

    for (let floor = 0; floor < floors; floor += 1) {
      const centreY = floorBase + floor * floorHeight;
      if (centreY + 1.05 > y0 + height - 0.52) continue;
      for (let bay = 0; bay < bays; bay += 1) {
        const along = edgeInset + pitch * (bay + 0.5);
        const [sampleX, , sampleZ] = wallPoint(wall, along, centreY, 0.44);
        if (!isExposedAt(building.id, targets, sampleX, centreY, sampleZ)) {
          continue;
        }
        addWallBox(
          builder,
          wall,
          TERRASSENHAUS_HAFENPLATZ_TONES.frameOchre,
          along,
          centreY,
          0.12,
          paneWidth + 0.22,
          1.82,
          0.14,
          false,
          true,
        );
        addWallBox(
          builder,
          wall,
          TERRASSENHAUS_HAFENPLATZ_TONES.glass,
          along,
          centreY,
          0.205,
          paneWidth,
          1.57,
          0.08,
          (floor + bay) % 9 === 3,
        );
        windows += 1;
      }

      const [bandX, , bandZ] = wallPoint(
        wall,
        wall.length / 2,
        centreY - 1.2,
        0.42,
      );
      if (isExposedAt(building.id, targets, bandX, centreY - 1.2, bandZ)) {
        addWallBox(
          builder,
          wall,
          floor % 3 === 2
            ? TERRASSENHAUS_HAFENPLATZ_TONES.concreteShade
            : TERRASSENHAUS_HAFENPLATZ_TONES.parapet,
          wall.length / 2,
          centreY - 1.2,
          0.09,
          Math.max(0.5, wall.length - 0.22),
          0.3,
          0.12,
          false,
          floor % 3 === 2,
        );
        bands += 1;
      }
    }

    const roofY = y0 + height - 0.22;
    const [roofX, , roofZ] = wallPoint(wall, wall.length / 2, roofY, 0.42);
    if (isExposedAt(building.id, targets, roofX, roofY, roofZ)) {
      addWallBox(
        builder,
        wall,
        TERRASSENHAUS_HAFENPLATZ_TONES.parapet,
        wall.length / 2,
        roofY,
        0.08,
        Math.max(0.5, wall.length - 0.18),
        0.42,
        0.14,
        false,
        true,
      );
      bands += 1;
    }
  }
  return { bands, windows };
}

/**
 * Source-bounded facade layer for the listed Brutalist ensemble.
 * The official shells remain visible and authoritative; this group only adds
 * the photographed ochre window grid, pebbled spandrels and stepped roof edge.
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
  let bands = 0;
  let windows = 0;
  for (const building of targets) {
    const counts = addFacadeRhythm(builder, building, targets);
    bands += counts.bands;
    windows += counts.windows;
  }
  const details = finishDrawnGroup(builder, {
    lampEmissive: TERRASSENHAUS_HAFENPLATZ_TONES.nightGlass,
    lampEmissiveIntensity: 0.48,
    name: "Terrassenhaus Hafenplatz architectural details",
  });
  if (details) group.add(details);
  group.userData.architecturalProfile = TERRASSENHAUS_HAFENPLATZ_PROFILE;
  group.userData.detailCounts = {
    facadeBands: bands,
    sourcePrisms: targets.length,
    steppedHeightTiers: new Set(targets.map((building) => building.h_dm)).size,
    windows,
  };
  group.userData.geometryStatus =
    TERRASSENHAUS_HAFENPLATZ_PROFILE.geometryStatus;
  return group;
}

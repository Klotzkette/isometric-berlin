import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  Path,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Uint16BufferAttribute,
} from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import {
  INTERIM_OFFICE_FOOTPRINT_RING,
  INTERIM_OFFICE_SUPPRESSION_MARGIN_M,
  INTERIM_OFFICE_SUPPRESSION_OVERLAP_FRACTION,
} from "./SpreebogenOffice";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  ARCHITECTURAL_INK_PALETTE,
  applyArchitecturalInkMode,
  markArchitecturalAccentInk,
  markArchitecturalInk,
} from "./architecturalInk";
import { densifyRing, type DensifyOptions } from "./bankCurves";
import { pointInWorldRing } from "./chancelleryExtensionProfile";
import {
  KOLLHOFF_TOWER_PROFILE,
  KULTURFORUM_PROFILE,
  TILLA_DURIEUX_PROFILE,
} from "./expandedCityProfiles";
import { GOLDELSE_HEIGHT_M, createGoldelseFigure } from "./goldelse";
import { HOTEL_ADLON_PROFILE } from "./HotelAdlonProfile";
import { WAGNER_MEMORIAL_PRISM_IDS } from "./WagnerMemorial";
import {
  SIEGESSAEULE_BRONZE_TONES,
  SIEGESSAEULE_MOSAIC_TONES,
  SIEGESSAEULE_PROFILE,
} from "./SiegessaeuleProfile";
import {
  CHARITE_ALTHOFF_TOWER_HELM_BOTTOM_Y_M,
  CHARITE_ALTHOFF_TOWER_ID,
  CHARITE_FRIEDRICH_ALTHOFF_IDS,
  CHARITE_MEDICAL_MUSEUM_IDS,
  CHARITE_VIROLOGY_IDS,
  HISTORIC_CHARITE_IDS,
  HISTORIC_CHARITE_TONES,
  createHistoricChariteCampus,
  historicChariteRoofCode,
} from "./HistoricChariteCampus";
import {
  DEUTSCHES_THEATER_CUSTOM_FACADE_IDS,
  DEUTSCHES_THEATER_IDS,
  DEUTSCHES_THEATER_KAMMERSPIELE_IDS,
  DEUTSCHES_THEATER_MAIN_IDS,
  DEUTSCHES_THEATER_TONES,
  createDeutschesTheater,
} from "./DeutschesTheater";
import { LOEWEN_BRIDGE_PROFILE, createLoewenBridge } from "./LoewenBridge";
import { ADLER_BRIDGE_PROFILE, createAdlerBridge } from "./AdlerBridge";
import {
  TERRASSENHAUS_HAFENPLATZ_IDS,
  TERRASSENHAUS_HAFENPLATZ_TONES,
  createTerrassenhausHafenplatz,
} from "./TerrassenhausHafenplatz";
import {
  ARD_HAUPTSTADTSTUDIO_ATRIUM_ID,
  ARD_HAUPTSTADTSTUDIO_IDS,
  ARD_HAUPTSTADTSTUDIO_TONES,
  createArdHauptstadtstudio,
} from "./ArdHauptstadtstudio";
import {
  BERLINER_ENSEMBLE_IDS,
  BERLINER_ENSEMBLE_TONES,
  createBerlinerEnsemble,
} from "./BerlinerEnsemble";
import {
  REICHSTAGSPRAESIDENTENPALAIS_GENERIC_CHIMNEY_SUPPRESSED_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS,
  REICHSTAGSPRAESIDENTENPALAIS_TONES,
  createReichstagspraesidentenpalais,
} from "./Reichstagspraesidentenpalais";
import { createFederalStateRepresentations } from "./FederalStateRepresentations";
import {
  SANDKRUG_OSM_DECK,
  createNorthernHumboldthafenRefinements,
  isNorthernHumboldthafenQuayEdge,
} from "./HumboldthafenRefinements";
import {
  type VoxelPayload,
  WATER_TOP_Y,
  createGroundSlabs,
  groundTopSampler,
  smoothGroundTopSampler,
  worldGroundSampler,
} from "./MinecraftVoxelWorld";
import {
  AXIS_FROM,
  AXIS_TO,
  DATA_EAST_M,
  DATA_NORTH_M,
  DATA_SOUTH_M,
  DATA_WEST_M,
  EXTRAPOLATED_MARGIN_M,
  PRESENTATION_FLOOR_Y_M,
  VISIBLE_RADIUS_M,
  extrapolatedEnvelopeBounds,
  extrapolatedMarginBands,
} from "./worldEnvelope";
import type { VisualMode } from "./visualMode";
import { createSnowAccents, setModeOnlyDetails } from "./modeOnlyDetails";
import {
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";
import { schwellenraumObjektmodus } from "./visual-modes/schwellenraum/presentation";
import { schwellenraumMaterialFor } from "./visual-modes/schwellenraum/materialGrade";
import {
  createTunnelPortalApproachTester,
  type TunnelPortalCourseInput,
} from "./TunnelPortals";
import {
  WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
  WEIDENDAMMER_BRIDGE_PROFILE,
  WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
  WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT,
  createWeidendammerBridgeDetails,
  type WeidendammerBridgeDetailProfile,
} from "./WeidendammerBridgeDetails";

export {
  DATA_EAST_M,
  DATA_NORTH_M,
  DATA_SOUTH_M,
  DATA_WEST_M,
  EXTRAPOLATED_MARGIN_M,
  VISIBLE_RADIUS_M,
} from "./worldEnvelope";

/**
 * The drawn isometric city for Day mode: every building extruded from
 * its surveyed LoD2 footprint polygon (exact corners, planar walls,
 * courtyard holes) with hard black ink lines from edge geometry — a
 * true architectural drawing. This REPLACES the lumpy photogrammetry
 * buildings, which no amount of shading could make hard-edged. Ground,
 * water and roads reuse the surveyed run-length slabs with a soft day
 * palette; trees stay on the soft OSM/official park layer per the
 * owner's "nature may stay soft" rule.
 */
export type PrismBuilding = {
  class: number;
  h_dm: number;
  holes?: number[][][];
  id: string;
  ring: number[][];
  roof?: number;
  /** Sampled real median colour of this building (0-255 RGB). */
  tone?: [number, number, number];
  y0_dm: number;
};

export type PrismPayload = {
  buildings: PrismBuilding[];
  classes: string[];
  schema_version: number;
};

/**
 * Optional decomposition controls for the progressive viewer bootstrap.
 *
 * The default remains the historical one-shot city, so generators, tests and
 * callers outside the viewer retain byte-for-byte input semantics. The viewer
 * can render a bounded first building batch, then ask a Worker for the
 * remaining batches without copying or simplifying any source coordinate.
 */
export type IsometricCityBuildOptions = {
  /** Exact source buildings to include in this geometry batch. */
  buildings?: readonly PrismBuilding[];
  /** Add the one-off presentation/recognition models only to the base batch. */
  includeContext?: boolean;
  /**
   * Keep the 4 m raster asphalt in the preview instead of waiting for the
   * memory-heavy exact road plate. Used only by the coarse-pointer profile.
   */
  retainRasterAsphalt?: boolean;
  /**
   * Keep the static 4 m water, bed and quay fallback when the mobile Worker
   * deliberately omits every exact surface family.
   */
  retainRasterWater?: boolean;
  /**
   * Exact surface subset to build in this batch. `undefined` preserves the
   * legacy behaviour (`surfaces`); `null` builds no smooth surface geometry
   * while still using `surfaces` for ground masks and tunnel/lawn exclusions.
   */
  smoothSurfaces?: SurfacePayload | null;
};

/** Typed growth buffer for the city's largest transient line accumulator. */
class Float32Accumulator {
  private values: Float32Array;
  length = 0;

  constructor(initialCapacity: number) {
    this.values = new Float32Array(Math.max(1_024, initialCapacity));
  }

  push(...next: number[]): number {
    const required = this.length + next.length;
    if (required > this.values.length) {
      const grown = new Float32Array(
        Math.max(required, Math.ceil(this.values.length * 1.5)),
      );
      grown.set(this.values);
      this.values = grown;
    }
    this.values.set(next, this.length);
    this.length = required;
    return this.length;
  }

  toArray(): Float32Array {
    return this.values.length === this.length
      ? this.values
      : this.values.slice(0, this.length);
  }
}

/** Compact centimetre buffer for dashed facade-line distances. */
class Uint16Accumulator {
  private values: Uint16Array;
  length = 0;

  constructor(initialCapacity: number) {
    this.values = new Uint16Array(Math.max(1_024, initialCapacity));
  }

  push(...next: number[]): number {
    const required = this.length + next.length;
    if (required > this.values.length) {
      const grown = new Uint16Array(
        Math.max(required, Math.ceil(this.values.length * 1.5)),
      );
      grown.set(this.values);
      this.values = grown;
    }
    this.values.set(next, this.length);
    this.length = required;
    return this.length;
  }

  toArray(): Uint16Array {
    return this.values.length === this.length
      ? this.values
      : this.values.slice(0, this.length);
  }
}

export const PRISM_WORLD_FILE = "lod2-prisms.json";
export const SURFACE_WORLD_FILE = "surface-polygons.json";

/**
 * True OSM water and parkland polygons (decimetre rings). The voxel
 * grid rasterises everything onto 4 m cells, which made the Spree banks
 * and the Tiergarten lawns read as staircases; these smooth rings carry
 * the drawn shoreline and lawn edges instead.
 */
export type SurfacePolygon = {
  area_m2: number;
  holes: number[][][];
  /**
   * Drawn surface family: asphalt, paving or sand for carriageways; river,
   * pond, stream or basin for water. Rivers use the Spree table, natural
   * park water follows local terrain, and basins use their built rim.
   */
  kind?: string;
  name: string;
  ring: number[][];
};

/** OSM way/1313858079, the darker decorative basin on Otto-Weidt-Platz. */
export const OTTO_WEIDT_FOUNTAIN_WORLD = [-278.45, -1611.02] as const;

/** Dedicated recognition model replaces this otherwise generic OSM basin. */
export const SINTI_ROMA_POOL_WORLD = [307.7, 186.23] as const;

/** A marked carriageway centreline (decimetre points) for lane dashes. */
export type LaneMarking = {
  name: string;
  points: number[][];
  width_m: number;
};

/**
 * A wedge-shaped wall climbing out of the ground into a basin, as OSM maps
 * Christophe Girot's *Sinkende Mauer* (1997) in the Invalidenpark: the
 * mapper cut the wall's footprint out of the water ring, so this ring is
 * exactly that cut-out. `foot` is the end flush with the paving on the rim,
 * `crest` the high tip out in the basin where the wedge breaks off into the
 * water. Both are decimetre points.
 */
export type SunkenWall = {
  area_m2: number;
  crest: number[];
  foot: number[];
  name: string;
  ring: number[][];
  width_m: number;
};

/** [world x dm, world z dm, crown radius dm, crown height dm, colour family]. */
export type ScrubPoint = [number, number, number, number, number];

export type SurfacePayload = {
  lane_markings?: LaneMarking[];
  path_inventory?: {
    by_highway: Record<string, number>;
    by_resolved_material: Record<string, number>;
    by_surface: Record<string, number>;
    line_parts: number;
    mapped_surface_line_parts: number;
    mapped_width_line_parts: number;
    scope: string;
  };
  parks: SurfacePolygon[];
  roads?: SurfacePolygon[];
  schema_version: number;
  scrub_inventory?: {
    excluded_grosser_tiergarten_point_count?: number;
    feature_count: number;
    mapped_area_m2: number;
    point_count: number;
    pre_tiergarten_filter_point_count?: number;
    sampling_spacing_m: number;
    scope: string;
  };
  scrub_points?: ScrubPoint[];
  sunken_walls?: SunkenWall[];
  water: SurfacePolygon[];
};

export type PretriangulatedSurfaceKind = "asphalt" | "paving";

export type SmoothSurfaceBuildOptions = {
  /**
   * Lossless, source-hash-bound ShapeGeometry results for the two
   * hole-heavy road unions. Terrain tessellation and draping still happen at
   * runtime, so the committed elevation samples remain the sole height
   * authority; only Earcut's deterministic triangulation is moved offline.
   */
  pretriangulated?: Partial<Record<PretriangulatedSurfaceKind, BufferGeometry>>;
};

function surfaceCentroidM(surface: SurfacePolygon): [number, number] {
  return [
    surface.ring.reduce((sum, [x]) => sum + x, 0) /
      Math.max(1, surface.ring.length) /
      10,
    surface.ring.reduce((sum, [, z]) => sum + z, 0) /
      Math.max(1, surface.ring.length) /
      10,
  ];
}

/**
 * The two OSM lawns occupied by the authored Tilla-Durieux terrain sculpture.
 * They must not also enter the generic flat-lawn batch: drawing both surfaces
 * produced stacked green rectangles and nearly coplanar flicker.
 */
export function isTillaDurieuxLawn(surface: SurfacePolygon): boolean {
  if (surface.kind !== "lawn" || surface.ring.length < 4) {
    return false;
  }
  const expectedAreas = [
    TILLA_DURIEUX_PROFILE.northLawn.areaM2,
    TILLA_DURIEUX_PROFILE.southLawn.areaM2,
  ];
  if (!expectedAreas.some((area) => Math.abs(surface.area_m2 - area) <= 2)) {
    return false;
  }
  const [x, z] = surfaceCentroidM(surface);
  return x >= 130 && x <= 308 && z >= 1205 && z <= 1620;
}

/** Exact OSM footprint of the two authored Tilla-Durieux lawn lobes. */
export function createTillaDurieuxGroundTester(
  surfaces: SurfacePayload,
): (x: number, z: number) => boolean {
  const rings = surfaces.parks
    .filter(isTillaDurieuxLawn)
    .map((surface) =>
      surface.ring.map(
        ([xDecimetres, zDecimetres]) =>
          [xDecimetres / 10, zDecimetres / 10] as [number, number],
      ),
    );
  return (x, z) => rings.some((ring) => pointInWorldRing(x, z, ring));
}

/** Local water uses park terrain, not the much lower Spree table. */
export function isElevatedParkWater(surface: SurfacePolygon): boolean {
  // OSM tags Nordhafen as a pond, but hydraulically and visually it is the
  // canal basin at the end of the Berlin-Spandauer Schifffahrtskanal. Treating
  // it like a Tiergarten pond lifted the whole basin to park grade and made
  // its northern continuation look like a staircase.
  if (surface.name === "Nordhafen") {
    return false;
  }
  if (["basin", "pond", "stream"].includes(surface.kind ?? "")) {
    return true;
  }
  if (surface.kind === "river") {
    return false;
  }
  // Compatibility for pre-schema-9 payloads, which had no pond class.
  const [x, z] = surfaceCentroidM(surface);
  return x < 350 && z > 120 && z < 1_350;
}

/** Avoid drawing a second cyan basin under the exact memorial model. */
export function isDedicatedSintiRomaPool(surface: SurfacePolygon): boolean {
  if (
    surface.kind !== "basin" ||
    surface.area_m2 < 90 ||
    surface.area_m2 > 130
  ) {
    return false;
  }
  const [x, z] = surfaceCentroidM(surface);
  return (
    Math.hypot(x - SINTI_ROMA_POOL_WORLD[0], z - SINTI_ROMA_POOL_WORLD[1]) < 8
  );
}
// Fine grey pencil, not black marker ("feine, abgegrenzte Linien"):
// contours delineate the light panels without weighing them down.
export const ISO_INK_COLOR = ARCHITECTURAL_INK_PALETTE.day.silhouette;
// At night black ink vanishes on dark prisms; a cool moonlit line keeps
// the drawn contours readable.
export const ISO_NIGHT_INK_COLOR = ARCHITECTURAL_INK_PALETTE.night.silhouette;
export const ISO_EDGE_THRESHOLD_DEGREES = ARCHITECTURAL_EDGE_THRESHOLD_DEGREES;

/** Official LoD2 parts of the renovated Charite Bettenhochhaus tower. */
export const CHARITE_BETTENHOCHHAUS_IDS: ReadonlySet<string> = new Set([
  "7b3ZwNAB",
  "7zddOe6j",
  "979qTCbp",
  "CNtAYPkO",
  "DQZmfONt",
  "FurjqyeB",
  "NDxiQ2xg",
  "OVVpwBo2",
  "RE3bNP55",
  "SgItUCXH",
  "Sorg80ps",
  "X4o3aH3m",
  "ZSiiyE0H",
  "aOZAupOd",
  "jwLw3UEy",
  "zq8O5Jct",
]);
export const CHARITE_BETTENHOCHHAUS_PROFILE = {
  basePanelPitchM: 4.2,
  baseStoreys: 4,
  facadeElementHeightM: 1.8,
  floorPitchM: 3.7,
  footprintM: [78, 36] as const,
  publishedHeightM: 82,
  storeys: 21,
  upperPanelPitchM: 3.3,
  sources: [
    "https://www.dbz.de/artikel/dbz_Bettenhaus_Charite_Berlin-2883159.html",
    "https://www.charite.de/service/pressemitteilung/artikel/detail/neue_bruecke_am_campus_charite_mitte",
  ] as const,
} as const;
/** Two-storey steel-and-glass bridge across Luisenstrasse in the LoD2 set. */
export const CHARITE_CAMPUS_BRIDGE_ID = "L2e097lj";

/** Every LoD2 part belonging to parent building DEBE01YYK0002KM6. */
export const KOLLHOFF_TOWER_PRISM_IDS: ReadonlySet<string> = new Set(
  KOLLHOFF_TOWER_PROFILE.payloadIds,
);

/**
 * The 13 LoD2 parts forming the Chancellery's 36 m leadership cube.
 *
 * The recognition model reconstructs this complete central volume as an open
 * concrete frame with glass halls, semicircular windows and the two canopies.
 * Keeping these source prisms as well would turn the open Ehrenhof elevation
 * into one opaque pale wall. The measured 18 m office-band prisms deliberately
 * remain outside this set and continue to anchor the surrounding wings.
 */
export const CHANCELLERY_CENTRAL_PRISM_IDS: ReadonlySet<string> = new Set([
  "XCNI3jr6",
  "n02sJgK0",
  "3Gfqy8sI",
  "ttJFXdbg",
  "SDUXI5wB",
  "bP7AjElp",
  "kJtNoSnl",
  "MLwG4KW9",
  "X6sFDl1v",
  "xIEMuFtk",
  "JC1pzD9P",
  "DV754o6F",
  "wgTapoMe",
]);

// Hand-pinned facade tones for hero prisms (payload building ids, last 8
// chars of the LoD2 id), matching the owner's colour direction: the
// Reichstag reads as pale grey sandstone (not warm yellow or muddy),
// the Chancellery as its real light grey/white.
export const HERO_PRISM_TONES: Record<string, number> = {
  K0002MCN: 0xe0e3df,
  MLwG4KW9: 0xeeeeea,
  // Sozialgericht Berlin: warm ochre sandstone body matching the restored
  // Invalidenstrasse facade beneath its dedicated Neo-Renaissance detail.
  K0002Qys: 0xcbb18a,
  // Hotel Adlon: pale reconstructed stone body below its patinated roof.
  K00006ot: 0xeee5d4,
  // The Center / former Sony Center: cool glass-and-steel towers around the
  // authored Forum facades, instead of unrelated sampled beige prisms.
  ...Object.fromEntries(
    [
      "v5EOhsyE",
      "ad7uC6lp",
      "JHEPpGSY",
      "MYXaomfk",
      "iYueLH8X",
      "7uww4nv5",
    ].map((id) => [id, 0xc8d8d9]),
  ),
  // Embassy envelopes stay measured LoD2; the tones identify their real
  // cladding before the finer facade overlays are applied.
  ...Object.fromEntries(
    [
      "756zLY9B",
      "miuT9hux",
      "jI5jm0e2",
      "9u0FZVDT",
      "kEAecguY",
      "nb8WMtZj",
      "6R7d8GNX",
      "gIjfOIND",
      "9qerwgls",
      "ZKDCm9Z3",
      "kA70GMff",
      "buOu0gvz",
    ].map((id) => [id, 0xe4ddcf]),
  ),
  ...Object.fromEntries(
    ["ORqiW8aK", "yrDOCds1", "Vkos5eqV", "N5S9pjJi"].map((id) => [
      id,
      0xd9cfbd,
    ]),
  ),
  ...Object.fromEntries(
    [
      "cyb33NJD",
      "mN0gGHof",
      "YDxshLdM",
      "j66nu4dr",
      "dxdP8ZV2",
      "dVaNVYh5",
    ].map((id) => [id, 0xd8d0b7]),
  ),
  // One red ceramic tower, not neutral LoD2 parts plus floating brown slabs.
  ...Object.fromEntries(
    [...KOLLHOFF_TOWER_PRISM_IDS].map((id) => [
      id,
      KOLLHOFF_TOWER_PROFILE.clinkerTone,
    ]),
  ),
  // Renovated Charite tower: pale silver aluminium curtain-wall register.
  ...Object.fromEntries(
    [...CHARITE_BETTENHOCHHAUS_IDS].map((id) => [id, 0xdfe5e3]),
  ),
  // Source-distinct Charite ensembles: the 1899/1905 Pathology and 1901
  // Althoff entrance remain brick-and-sandstone, while the 1956-60
  // Edmund-Lesser-Haus is a pale rendered post-war clinic.
  ...Object.fromEntries(
    [...CHARITE_MEDICAL_MUSEUM_IDS].map((id) => [
      id,
      HISTORIC_CHARITE_TONES.museumFacade,
    ]),
  ),
  ...Object.fromEntries(
    [...CHARITE_FRIEDRICH_ALTHOFF_IDS].map((id) => [
      id,
      HISTORIC_CHARITE_TONES.althoffFacade,
    ]),
  ),
  ...Object.fromEntries(
    [...CHARITE_VIROLOGY_IDS].map((id) => [
      id,
      HISTORIC_CHARITE_TONES.virologyFacade,
    ]),
  ),
  // Deutsches Theater: measured shells remain the geometry anchor while the
  // real ivory main house and pale-sage Kammerspiele stay visually distinct.
  ...Object.fromEntries(
    [...DEUTSCHES_THEATER_MAIN_IDS].map((id) => [
      id,
      DEUTSCHES_THEATER_TONES.facadeIvory,
    ]),
  ),
  ...Object.fromEntries(
    [...DEUTSCHES_THEATER_KAMMERSPIELE_IDS].map((id) => [
      id,
      DEUTSCHES_THEATER_TONES.kammerspiele,
    ]),
  ),
  // Hafenplatz 6-10: the 26 measured stepped shells retain their official
  // massing while the source-specific layer supplies Ollk's grey Brutalist
  // facade grid and ochre window frames.
  ...Object.fromEntries(
    [...TERRASSENHAUS_HAFENPLATZ_IDS].map((id) => [
      id,
      TERRASSENHAUS_HAFENPLATZ_TONES.concrete,
    ]),
  ),
  // ARD Hauptstadtstudio: the official three-part LoD2 shell remains the
  // massing anchor. Current reference photographs support red-brown concrete
  // on the Spree wing/head and the published lighter ochre rear body; OSM's
  // pale #dfb082 mapper tag is retained in the profile only.
  ...Object.fromEntries(
    [...ARD_HAUPTSTADTSTUDIO_IDS].map((id) => [
      id,
      id === ARD_HAUPTSTADTSTUDIO_ATRIUM_ID
        ? ARD_HAUPTSTADTSTUDIO_TONES.rearOchre
        : ARD_HAUPTSTADTSTUDIO_TONES.concrete,
    ]),
  ),
  // Berliner Ensemble: retain all four measured shells while presenting the
  // current stripped warm-grey render. The dedicated module owns only thin
  // facade, entrance, roof and sign recognition detail.
  ...Object.fromEntries(
    [...BERLINER_ENSEMBLE_IDS].map((id) => [
      id,
      BERLINER_ENSEMBLE_TONES.facade,
    ]),
  ),
  // Reichstagspräsidentenpalais / Deutsche Parlamentarische Gesellschaft:
  // the ten-part, two-parent LoD2 union remains the measured envelope. The
  // dedicated layer restores Wallot's warm yellow sandstone articulation.
  ...Object.fromEntries(
    [...REICHSTAGSPRAESIDENTENPALAIS_IDS].map((id) => [
      id,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.sandstone,
    ]),
  ),
  // Gymnasium Tiergarten Neubau (1971, refurbished 2009-11). The overview
  // raster stops short of the Hansaviertel, so every prism of the school
  // fell back to the generic concrete shade and the white rendered slab
  // was indistinguishable from the brick Altbau behind it.
  ...Object.fromEntries(
    [
      "53jKTFyO",
      "DG5BSkf7",
      "N1k7CDwM",
      "Q5bFUgLl",
      "YBj4ULFf",
      "iJld3tAj",
      "lnB9I8b8",
      "neNfHjtD",
      "oZu0k3gG",
      "ruAxvlwz",
      "uS796u1d",
      "w3EeFZtR",
      "zAVU6kkn",
    ].map((id) => [id, 0xe9e7e1]),
  ),
};

// Pinned roof-plate tones: the Reichstag's huge cap (and its corner
// towers) read as the real light stone terrace instead of sun-warmed
// facade brown; the Chancellery roof stays light.
export const HERO_PRISM_ROOF_TONES: Record<string, number> = {
  K0002MCN: 0xe1e3dc,
  K0003Ty1: 0xe1e3dc,
  K0003VDk: 0xe1e3dc,
  MLwG4KW9: 0xeff1ec,
  K00006ot: 0x668574,
  ORqiW8aK: 0x729083,
  yrDOCds1: 0x729083,
  Vkos5eqV: 0x729083,
  N5S9pjJi: 0x729083,
  UbQkgNZe: 0xe1e3dc,
  ycOYQRVL: 0xe1e3dc,
  ...Object.fromEntries(
    [...KOLLHOFF_TOWER_PRISM_IDS].map((id) => [id, 0x74483e]),
  ),
  ...Object.fromEntries(
    [...CHARITE_BETTENHOCHHAUS_IDS].map((id) => [id, 0xd3d9d8]),
  ),
  ...Object.fromEntries(
    [...CHARITE_MEDICAL_MUSEUM_IDS].map((id) => [
      id,
      HISTORIC_CHARITE_TONES.slate,
    ]),
  ),
  ...Object.fromEntries(
    [...CHARITE_FRIEDRICH_ALTHOFF_IDS].map((id) => [
      id,
      HISTORIC_CHARITE_TONES.slate,
    ]),
  ),
  ...Object.fromEntries([...CHARITE_VIROLOGY_IDS].map((id) => [id, 0x77827d])),
  ...Object.fromEntries(
    [...DEUTSCHES_THEATER_IDS].map((id) => [id, DEUTSCHES_THEATER_TONES.slate]),
  ),
  ...Object.fromEntries(
    [...TERRASSENHAUS_HAFENPLATZ_IDS].map((id) => [
      id,
      TERRASSENHAUS_HAFENPLATZ_TONES.parapet,
    ]),
  ),
  ...Object.fromEntries(
    [...ARD_HAUPTSTADTSTUDIO_IDS].map((id) => [
      id,
      ARD_HAUPTSTADTSTUDIO_TONES.roofDataTag,
    ]),
  ),
  ...Object.fromEntries(
    [...BERLINER_ENSEMBLE_IDS].map((id) => [id, BERLINER_ENSEMBLE_TONES.slate]),
  ),
  ...Object.fromEntries(
    [...REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS].map((id) => [
      id,
      REICHSTAGSPRAESIDENTENPALAIS_TONES.slate,
    ]),
  ),
};

// Buildings whose recognition model draws the COMPLETE structure. Their
// LoD2 prism would swallow the model (the Brandenburg Gate rendered as a
// solid box burying its twelve columns), so these prisms are skipped and
// the model carries the building alone.
export const PRISM_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  // Richard-Wagner-Denkmal: SR00009n is the closed LoD2 envelope of the
  // later protective barrel-vault canopy. The source-bound model preserves
  // its open steel frame and the complete marble ensemble underneath.
  ...WAGNER_MEMORIAL_PRISM_IDS,
  // Bremen and Saxony have no matching official LoD2 object in the committed
  // source set. Their 9 m OSM context prisms are display fallbacks, not height
  // surveys; FederalStateRepresentations keeps the exact OSM outlines and
  // applies the source-described 8/4-storey and 4-storey organisations.
  "24045937",
  "23075521",
  // "Sprung ueber die Spree". LoD2 part DEBE01YYK0001zDa preserves the
  // bridge's correct 62.6 m plan envelope and 28.7 m top, but a footprint
  // prism necessarily fills everything below that top and therefore became
  // the false solid wall across the river. CentralCivicDetails rebuilds the
  // same OSM-anchored crossing as the two real, open pedestrian bridges.
  "K0001zDa",
  // Reichstag west portico. These two LoD2 parts are deliberately coarse,
  // closed envelopes (the full 35 m portico block and its narrow centre cap).
  // The metric recognition model reconstructs this exact volume as an open
  // six-column order with stair, glass entrance, inscription, reliefs and
  // pediment. Keeping the source boxes hid every one of those referenced
  // facade details behind a blank slab. The 101-point main Reichstag prism
  // K0002MCN remains authoritative and keeps all six courtyard holes.
  "UbQkgNZe",
  "ycOYQRVL",
  // Brandenburger Tor — the metric model carries the central colonnade and
  // both gatehouses. Keeping any of the three coarse source prisms would
  // bury its five passages or overlap the reconstructed pavilion porticoes.
  "K0001xqy",
  "QDYNK7dL",
  "VpZW4Luf",
  // Invalidenfriedhof memorial structures. Their LoD2 footprints are useful
  // metric anchors, but prism extrusion closes the Auguste-Viktoria bell
  // frame and turns the three-metre-base Litfin watchtower into one opaque
  // shaft. InvalidenfriedhofDetails reconstructs both complete, open forms.
  "K0001yqp",
  "1pC0000R",
  // Siegessäule at the Großer Stern. LoD2 stops at the socle and the
  // Säulenhalle (25.0 m / 18.2 m / 8.4 m); createSiegessaeule draws the whole
  // 67 m monument including the fluted drums and the gilded Viktoria, so the
  // three concentric prisms would stand inside the column.
  "3wUufHpn",
  "iHbVUwP0",
  "xzlowEa3",
  // Gymnasium Tiergarten Altbau. Its LoD2 roof code is 5000 (Mischform),
  // which the procedural roof fitter skips, so the 1902 brick school stood
  // as a flat 32 m box. createGymnasiumTiergarten draws the whole block
  // with its Steildach, stepped gables and rooftop observation platform.
  "jBXhIsDK",
  "EHKONVCW",
  // Futurium. CentralCivicDetails reconstructs its complete irregular LoD2
  // footprint, recessed glass foyer, cassette skin, panoramic end windows,
  // roof basin and Skywalk. Keeping the source prism would bury those parts.
  "20g0005J",
  // Cube Berlin. The recognition model keeps the measured 43.6 m LoD2
  // envelope but replaces these four overlapping parts with the building's
  // faceted double-skin glass wrapper.
  "FD4M9wox",
  "VoiEX357",
  "lXwHgFCt",
  "MwfoOvua",
  // Tränenpalast. Its low 1962 glass-and-steel pavilion is drawn from the
  // complete OSM outline; the three source prisms would make it opaque.
  "U4ubriIq",
  "3z4aOJds",
  "92ZtVVpI",
  // MEININGER Hotel Hauptbahnhof. Its exact LoD2 shell is rebuilt by the
  // recognition model with the current ten-storey facade, entrance and roof
  // frame; retaining this generic prism would double every edge and window.
  "K0002MxA",
  // Bundeskanzleramt leadership cube. The dedicated model retains the official
  // 36 m height and measured footprint while exposing its open frame, glass,
  // semicircular halls and Ehrenhof canopies. Only the central high-rise parts
  // are replaced; all measured 18 m office-band prisms remain authoritative.
  ...CHANCELLERY_CENTRAL_PRISM_IDS,
]);

// v0.56.1 ("beiger Kasten ueber den Gleisen"): the Hauptbahnhof used to be
// suppressed by a hand-picked LoD2 building-id list (PRISM_SUPPRESSED_IDS),
// one entry per part-prism. The user's screenshot showed a large opaque
// flat-roof box still rendering over/beside the glass hall at the east end
// (DEBE3Dbzrg8J0PRu, an ALKIS "Bauwerk im Gleisbereich" prism the earlier
// list never picked up) — proof that per-id lists silently miss part-
// prisms whenever the LoD2 source gets re-tiled or a footprint splits.
// isHauptbahnhofFootprintSuppressed replaces that list with a geometric
// test: ANY LoD2 prism whose footprint substantially overlaps the model's
// own hall+bridge envelope polygon (east-west curved roof, north-south
// hall, both office bridges, built from the exact same constants
// createHauptbahnhofModel uses) is suppressed, regardless of its id. The
// Buegel office-bridge towers are the deliberate exception: those stay as
// PRISM_GLASSED_IDS instead so the mullion grid keeps its glassy body.
const HAUPTBAHNHOF_ENVELOPE_ANCHOR_WORLD: readonly [number, number] = [
  -119.936, -683.307,
];
const HAUPTBAHNHOF_ENVELOPE_ROTATION_DEGREES = 21.82;
// Kept in sync with ArchitecturalLandmarks.ts HAUPTBAHNHOF_RAIL_CURVE_A/B —
// the real quadratic fit to the Stadtbahn viaduct, re-exported there and
// re-derived from rail-lines.json by tests/hauptbahnhof-curve.test.ts.
const HAUPTBAHNHOF_ENVELOPE_CURVE_A = 0.000_787;
const HAUPTBAHNHOF_ENVELOPE_CURVE_B = 0.223_3;
// The official 321 m glass roof (scene.json / Deutsche Bahn figures), NOT
// the old 431 m rendered deck length — the roof envelope only needs to
// cover the roof itself, not the western approach viaduct.
const HAUPTBAHNHOF_ENVELOPE_ROOF_LENGTH_M = 321;
const HAUPTBAHNHOF_ENVELOPE_ROOF_WIDTH_M = 40;
const HAUPTBAHNHOF_ENVELOPE_HALL_LENGTH_M = 180;
const HAUPTBAHNHOF_ENVELOPE_HALL_WIDTH_M = 42;
const HAUPTBAHNHOF_ENVELOPE_OFFICE_WIDTH_M = 19;
// Outward pad (metres) so a footprint whose real edge sits just outside
// the idealised rectangle still counts as part of the station rather than
// slipping through. The real ALKIS "Bauwerk im Gleisbereich" parts under
// the halls are not clean rectangles (they are the L-shaped, part-tiled
// remnants of platform canopies, signal buildings and access structures
// that the hand-built model does not reproduce individually) so a tight
// pad missed several of them, including the exact building the user's
// screenshot flagged (DEBE3Dbzrg8J0PRu, an ALKIS 51009_1610 "Bauwerk im
// Gleisbereich" prism whose own footprint runs diagonally along the
// tracks past the office bridge). 15 m was checked against the full
// payload: it still leaves every unrelated building more than ~100 m
// from the anchor untouched.
const HAUPTBAHNHOF_ENVELOPE_MARGIN_M = 15;
// A prism counts as "the station" once at least this fraction of its own
// footprint vertices sample inside the envelope polygon — high enough that
// an unrelated neighbouring building merely brushing the envelope edge
// survives, low enough that every part-prism actually under the halls
// (which can be split into many small ALKIS parts) is still caught.
const HAUPTBAHNHOF_ENVELOPE_OVERLAP_FRACTION = 0.3;

function hauptbahnhofRailCurveOffset(localX: number): number {
  return (
    HAUPTBAHNHOF_ENVELOPE_CURVE_A * localX * localX +
    HAUPTBAHNHOF_ENVELOPE_CURVE_B * localX
  );
}

/** World (x, z) metres -> the station model's own local (unrotated) frame. */
function worldToHauptbahnhofLocal(x: number, z: number): [number, number] {
  const [anchorX, anchorZ] = HAUPTBAHNHOF_ENVELOPE_ANCHOR_WORLD;
  const theta = (HAUPTBAHNHOF_ENVELOPE_ROTATION_DEGREES * Math.PI) / 180;
  const dx = x - anchorX;
  const dz = z - anchorZ;
  return [
    dx * Math.cos(theta) - dz * Math.sin(theta),
    dx * Math.sin(theta) + dz * Math.cos(theta),
  ];
}

/**
 * True once (localX, localZ) — the station model's own local frame — falls
 * inside the built envelope: the curved east-west roof band, the straight
 * north-south hall band, or either office-bridge band, each padded by
 * HAUPTBAHNHOF_ENVELOPE_MARGIN_M. This mirrors the exact rectangles
 * createHauptbahnhofModel builds (addBarrelRoof/addStationOfficeBridge),
 * so the envelope can never drift out of sync with what is actually drawn.
 */
function insideHauptbahnhofEnvelopeLocal(
  localX: number,
  localZ: number,
): boolean {
  const margin = HAUPTBAHNHOF_ENVELOPE_MARGIN_M;
  const roofHalfLength = HAUPTBAHNHOF_ENVELOPE_ROOF_LENGTH_M / 2;
  if (Math.abs(localX) <= roofHalfLength + margin) {
    const bow = hauptbahnhofRailCurveOffset(localX);
    if (
      Math.abs(localZ - bow) <=
      HAUPTBAHNHOF_ENVELOPE_ROOF_WIDTH_M / 2 + margin
    ) {
      return true;
    }
  }
  // The north-south hall runs ALONG local Z (addBarrelRoof's alongX =
  // false maps its own "longitudinal" extent to Z and its cross-section
  // "lateral" extent to X -- see barrelRoofGeometry), so the length
  // check is on |localZ| and the width check is on |localX|, the
  // opposite of the east-west roof band above. Getting this backwards
  // let large real station-adjacent slabs running mostly along Z slip
  // through the old (pre-fix) version of this function entirely.
  const hallHalfLength = HAUPTBAHNHOF_ENVELOPE_HALL_LENGTH_M / 2 + margin;
  if (Math.abs(localZ) <= hallHalfLength) {
    if (Math.abs(localX) <= HAUPTBAHNHOF_ENVELOPE_HALL_WIDTH_M / 2 + margin) {
      return true;
    }
    // The office bridges flank the hall, offset sideways along X (see
    // officeX = north_south_hall_width_m / 2 + 14 in
    // createHauptbahnhofModel), running the same length along Z.
    const officeHalfX = HAUPTBAHNHOF_ENVELOPE_HALL_WIDTH_M / 2 + 14;
    for (const side of [-1, 1]) {
      const officeCentre = side * officeHalfX;
      if (
        Math.abs(localX - officeCentre) <=
        HAUPTBAHNHOF_ENVELOPE_OFFICE_WIDTH_M / 2 + margin
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Footprint-overlap suppression test for LoD2 prisms near the Hauptbahnhof:
 * true when enough of the prism's own ring vertices fall inside the
 * station's hall+bridge envelope that it reads as part of the station
 * rather than a neighbour merely close to it. Unlike PRISM_SUPPRESSED_IDS,
 * this needs no per-id maintenance and catches every part-prism the LoD2
 * source ever splits the station footprint into, present or future.
 */
export function isHauptbahnhofFootprintSuppressed(
  building: PrismBuilding,
): boolean {
  if (building.ring.length < 3) {
    return false;
  }
  let inside = 0;
  for (const [xDm, zDm] of building.ring) {
    const [localX, localZ] = worldToHauptbahnhofLocal(xDm / 10, zDm / 10);
    if (insideHauptbahnhofEnvelopeLocal(localX, localZ)) {
      inside += 1;
    }
  }
  return (
    inside / building.ring.length >= HAUPTBAHNHOF_ENVELOPE_OVERLAP_FRACTION
  );
}

const FRIEDRICHSTRASSE_STATION_ANCHOR_WORLD = [1057.69, -118.71] as const;
const FRIEDRICHSTRASSE_STATION_ROTATION_RAD = -0.31;
const FRIEDRICHSTRASSE_STATION_HALF_LENGTH_M = 84.5;
const FRIEDRICHSTRASSE_STATION_HALF_WIDTH_M = 30;
const FRIEDRICHSTRASSE_STATION_CURVE_CENTRE_Z_M = -10;
const FRIEDRICHSTRASSE_STATION_CURVE_SAG_M = 6;
const FRIEDRICHSTRASSE_STATION_OVERLAP_FRACTION = 0.3;

/**
 * The dedicated Friedrichstraße model follows the broad curve documented by
 * the Landesdenkmalamt and the source LoD2 outline. Testing the same curved
 * 169 x 60 m envelope catches the station parts without swallowing the
 * separate Tränenpalast or the office slabs beyond the eastern gable.
 */
export function isFriedrichstrasseStationFootprintSuppressed(
  building: PrismBuilding,
): boolean {
  if (building.ring.length < 3) return false;
  const [anchorX, anchorZ] = FRIEDRICHSTRASSE_STATION_ANCHOR_WORLD;
  const cosine = Math.cos(FRIEDRICHSTRASSE_STATION_ROTATION_RAD);
  const sine = Math.sin(FRIEDRICHSTRASSE_STATION_ROTATION_RAD);
  let inside = 0;
  for (const [xDm, zDm] of building.ring) {
    const dx = xDm / 10 - anchorX;
    const dz = zDm / 10 - anchorZ;
    const localX = dx * cosine - dz * sine;
    const localZ = dx * sine + dz * cosine;
    const normalizedX = localX / FRIEDRICHSTRASSE_STATION_HALF_LENGTH_M;
    const centreZ =
      FRIEDRICHSTRASSE_STATION_CURVE_CENTRE_Z_M -
      FRIEDRICHSTRASSE_STATION_CURVE_SAG_M * normalizedX * normalizedX;
    if (
      Math.abs(localX) <= FRIEDRICHSTRASSE_STATION_HALF_LENGTH_M &&
      Math.abs(localZ - centreZ) <= FRIEDRICHSTRASSE_STATION_HALF_WIDTH_M + 1
    ) {
      inside += 1;
    }
  }
  return (
    inside / building.ring.length >= FRIEDRICHSTRASSE_STATION_OVERLAP_FRACTION
  );
}

function distanceToSegment(
  x: number,
  z: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 1e-9) {
    return Math.hypot(x - ax, z - az);
  }
  const t = Math.max(
    0,
    Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared),
  );
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

function insideInterimOfficeFootprint(x: number, z: number): boolean {
  let inside = false;
  for (
    let index = 0;
    index < INTERIM_OFFICE_FOOTPRINT_RING.length;
    index += 1
  ) {
    const [ax, az] = INTERIM_OFFICE_FOOTPRINT_RING[index];
    const [bx, bz] =
      INTERIM_OFFICE_FOOTPRINT_RING[
        (index + 1) % INTERIM_OFFICE_FOOTPRINT_RING.length
      ];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * True when a LoD2 footprint substantially overlaps the exact OSM outline of
 * the hand-built Amtssitz am Spreebogen. The 2026 building postdates the LoD2
 * release, whose retained former-site prism otherwise draws a rectangular box
 * around the new bent bar. Keep this geometric rather than naming the current
 * prism: source re-tiling must not bring that box back.
 */
export function isInterimOfficeFootprintSuppressed(
  building: PrismBuilding,
): boolean {
  if (building.ring.length < 3) {
    return false;
  }
  let inside = 0;
  for (const [xDm, zDm] of building.ring) {
    const x = xDm / 10;
    const z = zDm / 10;
    const nearOutline = INTERIM_OFFICE_FOOTPRINT_RING.some(
      ([ax, az], index) => {
        const [bx, bz] =
          INTERIM_OFFICE_FOOTPRINT_RING[
            (index + 1) % INTERIM_OFFICE_FOOTPRINT_RING.length
          ];
        return (
          distanceToSegment(x, z, ax, az, bx, bz) <=
          INTERIM_OFFICE_SUPPRESSION_MARGIN_M
        );
      },
    );
    if (insideInterimOfficeFootprint(x, z) || nearOutline) {
      inside += 1;
    }
  }
  return (
    inside / building.ring.length >= INTERIM_OFFICE_SUPPRESSION_OVERLAP_FRACTION
  );
}

// Prisms forced into the transparent glass mesh regardless of their
// LoD2 class: the Hauptbahnhof Bügel office-bridge towers, whose real
// facades are full curtain-wall glazing. The recognition model draws
// their mullion grid; these prisms give the grid its glassy body.
export const PRISM_GLASSED_IDS: ReadonlySet<string> = new Set([
  "3F1dLm24",
  "5gArGdou",
  "5v0mHg0p",
  "663NhxsM",
  "6ZJfG5j0",
  "D6fKsTRY",
  "Fk2OkM8n",
  "LAz51fdP",
  "M7I6Afam",
  "QaGDo8NZ",
  "SLLM5yNi",
  "X2oOtd6Z",
  "XpzUHc7R",
  "clykH08k",
  "gqQdZFTa",
  "hCFTFGrv",
  "hlYYwDX2",
  "iiRhAlr6",
  "ldYGmtbR",
  "m3AE8zAD",
  "o0aS4DvM",
  "v3sN8WzM",
  "zTSJJzrL",
  "zUU5olBa",
  CHARITE_CAMPUS_BRIDGE_ID,
]);

/**
 * Clean a sampled real building colour into a flat illustration paint
 * tone: mild desaturation kills photo chroma noise, the lightness is
 * clamped to a readable band (dark grey stays possible — the Reichstag
 * is grey — but never black) and quantised onto six shared paint levels
 * so neighbouring buildings cohere as one drawing.
 */
export function cleanedTone(tone: [number, number, number]): Color {
  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  let r = tone[0] / 255;
  let g = tone[1] / 255;
  let b = tone[2] / 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // v0.39.0: 0.55 was the main source of "alle Flächen der Gebäude sind noch
  // zu grau". Measured on the shipped v0.38.0 frame, 34 % of the building
  // surface pixels carried a chroma below 0.06 — light, but with no colour in
  // them at all, which is exactly what reads as grey. Pulling each sample only
  // a third of the way to its own luminance still kills JPEG chroma noise
  // while leaving the sandstone/brick/glass hue visible.
  const DESATURATION = 0.34;
  r += (luma - r) * DESATURATION;
  g += (luma - g) * DESATURATION;
  b += (luma - b) * DESATURATION;
  // Light-panel city: lightness lives in a bright band ("alles in
  // hellen Farben") — pale stone up to near-white, never murky.
  // The floor is chosen AFTER quantisation matters: with the old ten bands the
  // 0.75 floor snapped to 7/9 = 0.778 and the 0.93 ceiling to 8/9 = 0.889, so
  // the entire city owned just TWO paint levels — a large part of why it read
  // as one flat grey mass. Sixteen bands over a slightly wider window give
  // three usable levels (0.800 / 0.867 / 0.933) and lift both ends.
  const clamped = Math.min(0.96, Math.max(0.8, luma));
  const bands = 16;
  const quantised = Math.round(clamped * (bands - 1)) / (bands - 1);
  const scale = quantised / Math.max(luma, 1e-3);
  return new Color(clamp01(r * scale), clamp01(g * scale), clamp01(b * scale));
}

// Soft, flat illustration tones for the day ground (NOT the Minecraft
// palette): calm park green, light asphalt, Spree blue, plaza brick.
export const ISO_GROUND_SHADES: Record<string, readonly number[]> = {
  asphalt: [0xc3c8c3, 0xc6cbc5],
  // Closely spaced sage lawns avoid noisy stripes while retaining enough
  // separation to read the park as a drawn surface.
  grass: [0xb9d9aa, 0xbadaab, 0xb8d8a9],
  plazaBrick: [0xf0d6bb, 0xedcfb2],
  // Drawn bridge decks: light stone, clearly distinct from water below.
  bridge: [0xe7e4da, 0xe9e6dd],
  water: [0xa8d5e8, 0xa5d2e5],
};

// Flat drawn facade tones per building class, with deterministic
// per-building jitter between shades (quantised paint, no gradients).
const FACADE_SHADES: Record<string, readonly number[]> = {
  concrete: [0xf5efe3, 0xeee7d8, 0xf9f5ed, 0xe9dfcb],
  glass: [0xc5e3e8, 0xd9eff2, 0xb9d9e2],
};
const FALLBACK_FACADE: readonly number[] = FACADE_SHADES.concrete;

// The Reichstag's LoD2 body is split into many parts whose photo
// samples are muddy shadow tans; the whole ensemble is pinned to its
// real light sandstone by region.
function inReichstagRegion(building: PrismBuilding): boolean {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of building.ring) {
    cx += x / 10;
    cz += z / 10;
  }
  cx /= building.ring.length;
  cz /= building.ring.length;
  return cx >= 260 && cx <= 372 && cz >= -34 && cz <= 115;
}

function prismCentroidM(
  building: Pick<PrismBuilding, "ring">,
): [number, number] {
  let x = 0;
  let z = 0;
  for (const [ringX, ringZ] of building.ring) {
    x += ringX / 10;
    z += ringZ / 10;
  }
  return [x / building.ring.length, z / building.ring.length];
}

function centroidInsideProfile(
  building: Pick<PrismBuilding, "ring">,
  profile: {
    centerWorldM: readonly [number, number];
    lengthM: number;
    rotationY: number;
    widthM: number;
  },
): boolean {
  const [x, z] = prismCentroidM(building);
  const dx = x - profile.centerWorldM[0];
  const dz = z - profile.centerWorldM[1];
  const cosine = Math.cos(profile.rotationY);
  const sine = Math.sin(profile.rotationY);
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  return (
    Math.abs(localX) <= profile.lengthM / 2 + 1.5 &&
    Math.abs(localZ) <= profile.widthM / 2 + 1.5
  );
}

/** True for LoD2 parts of Scharoun's three gold Kulturforum ensembles. */
export function isScharounGoldPrism(
  building: Pick<PrismBuilding, "ring">,
): boolean {
  return [
    KULTURFORUM_PROFILE.philharmonie,
    KULTURFORUM_PROFILE.kammermusiksaal,
    KULTURFORUM_PROFILE.staatsbibliothek,
  ].some((profile) => centroidInsideProfile(building, profile));
}

export const SCHAROUN_ROOF_SEAM_IDS: ReadonlySet<string> = new Set([
  "XzEkeXsu", // Berliner Philharmonie main LoD2 part
  "aJ0e8oAr", // Kammermusiksaal main LoD2 part
]);

// The whole city leans toward one warm ivory register ("wie eine
// wunderbare Elfenbeinpalastdarstellung") while each building keeps
// enough of its own sampled hue to stay recognisably itself.
// v0.39.0 warms the anchor itself from #f8f3e6 to #fbf5e4: the ivory blend is
// what carries the cream cast onto neutral samples, so a warmer anchor is the
// most direct answer to "mehr Elfenbein/Creme/Warmweiß, weniger Grauanteil".
const IVORY = new Color(0xfbf5e4);
export const SOURCE_FACADE_IVORY_BLEND = 0.38;
export const ISO_GLASS_DAY_OPACITY = 0.62;
export const ISO_GLASS_MULLION_OPACITY = 0.44;
export const ISO_FACADE_AXIS_OPACITY = 0.34;
export const ISO_FACADE_DETAIL_FADE_M = [500, 780] as const;

function facadeColorFor(building: PrismBuilding, classes: string[]): Color {
  // Keep every official part inside the Reichstag footprint in the same
  // bright, cool limestone register. Checking the region before individual
  // pins prevents the large main prism from reverting to the older beige.
  if (inReichstagRegion(building)) {
    return new Color(0xdfe2df).lerp(IVORY, 0.1);
  }
  const pinned = HERO_PRISM_TONES[building.id];
  if (pinned !== undefined) {
    if (KOLLHOFF_TOWER_PRISM_IDS.has(building.id)) {
      // The clinker is the building's identity. Keep the shared ivory lift
      // restrained here so the red ceramic does not wash back to beige.
      return new Color(pinned).lerp(IVORY, 0.1);
    }
    if (TERRASSENHAUS_HAFENPLATZ_IDS.has(building.id)) {
      // The cool washed-concrete and ochre window register are this listed
      // ensemble's identity; a strong shared ivory wash erased both.
      return new Color(pinned).lerp(IVORY, 0.12);
    }
    if (REICHSTAGSPRAESIDENTENPALAIS_IDS.has(building.id)) {
      // Wallot's yellow sandstone is the Palais' identifying material. Keep
      // the shared paper lift subtle so the LoD2 envelope and the dedicated
      // stone articulation stay in one colour register.
      return new Color(pinned).lerp(IVORY, 0.08);
    }
    // The pins stay neutral light stone (the owner's earlier direction for the
    // Chancellery); the ivory blend is what stops them reading as grey paint.
    return new Color(pinned).lerp(IVORY, 0.34);
  }
  if (isScharounGoldPrism(building)) {
    return new Color(0xf0cf7d).lerp(IVORY, 0.08);
  }
  // Each building carries its sampled real colour ("den jeweiligen
  // Gebäudetyp angleichen"); the shared class shades are only the
  // fallback for footprints without a valid sample.
  if (building.tone) {
    return cleanedTone(building.tone).lerp(IVORY, SOURCE_FACADE_IVORY_BLEND);
  }
  const className = classes[building.class] ?? "concrete";
  const shades = FACADE_SHADES[className] ?? FALLBACK_FACADE;
  let hash = 0;
  for (const char of building.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return new Color(shades[hash % shades.length]);
}

// The drawn city's own "lights off" floor: replaces every warm
// artificial-light emissive/tint with a cool, dim, bluish-silver flat tone
// so the moonlit look stays authored colour (no film curve) while every
// window strip, lamp and lampion visibly goes dark. Kept close to the ink/paper
// register so the isometric drawing — not a light source — carries the
// read, per spec ("man sieht nur noch die Isometrie").
const MOONLIT_LAMP_OFF = 0x39424f;
const MOONLIT_WATER = 0x131f2c;

/**
 * Relight the drawn city for night: brighten the ink to a moonlit line
 * (black contours disappear on dark prisms) and give the prism bodies a
 * faint warm emissive floor so windowsill-height masses stay readable
 * under the dim night rig. Day restores warm-grey drawing ink and no emissive.
 *
 * `lightsOn` is only consulted while `night` is true (day and Minecraft
 * never call this with lightsOn === false); it swaps every warm
 * artificial-light source — lit window strips, lamp heads, lampions,
 * vessel lamps — for the cool moonlit-off tones above, and dims the water
 * further, while leaving ink, facade colour and isoFaceShade untouched so
 * the mode switch stays lossless in every direction (day ↔
 * night-lights-on ↔ night-lights-off ↔ minecraft ↔ snowstorm ↔
 * schwellenraum).
 */
function isometricDayMaterialForMode(
  object: Object3D,
  dayMaterial: Material,
  mode: VisualMode,
): Material {
  return schwellenraumObjektmodus(mode, object) === "schwellenraum"
    ? schwellenraumMaterialFor(object, dayMaterial)
    : dayMaterial;
}

export function setIsoNightPresentation(
  city: Group,
  night: boolean,
  lightsOn = true,
  requestedMode: VisualMode = night ? "night" : "day",
): void {
  const mode = night
    ? "night"
    : requestedMode === "night"
      ? "day"
      : requestedMode;
  const moonlit = night && !lightsOn;
  setModeOnlyDetails(city, mode);
  // Vessel wakes are source-neutral motion cues. Keep their authored static
  // geometry in ordinary modes, but remove it from Schwellenraum rather than
  // letting a frozen wake imply movement in that deliberately still world.
  city.traverse((object) => {
    if (object.userData.hiddenInSchwellenraum === true) {
      object.visible = mode !== "schwellenraum";
    }
  });
  // Every progressively transferred mesh carries its alternate materials in
  // userData. Switch by capability, not by a brittle name allow-list: repeated
  // building batches and newly added surface families must all materialise for
  // the mode active when they attach.
  city.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const dayMaterial = object.userData.dayMaterial;
    const nightMaterial = object.userData.nightMaterial;
    if (
      !(dayMaterial instanceof Material) ||
      !(nightMaterial instanceof Material)
    ) {
      return;
    }
    const objectMode = schwellenraumObjektmodus(mode, object);
    const moonlitMaterial = object.userData.moonlitMaterial;
    object.material =
      objectMode === "night"
        ? !lightsOn && moonlitMaterial instanceof Material
          ? moonlitMaterial
          : nightMaterial
        : isometricDayMaterialForMode(object, dayMaterial, objectMode);
  });
  // Three.js Object3D.clone() JSON-clones userData, so these two authored
  // facade layers can carry material JSON in legacy clones instead of live
  // Material instances. Keep their established contract while traversing all
  // progressive batches; Worker transfers still take the capability path
  // above with fully rehydrated materials.
  const facadeWindowMaterialNames = new Set([
    "Kollhoff recessed window panes",
    "Charite aluminium facade window panes",
  ]);
  city.traverse((windows) => {
    if (
      !(windows instanceof Mesh) ||
      !facadeWindowMaterialNames.has(windows.name) ||
      !windows.userData.dayMaterial ||
      !windows.userData.nightMaterial
    ) {
      return;
    }
    const objectMode = schwellenraumObjektmodus(mode, windows);
    const dayMaterial = windows.userData.dayMaterial;
    windows.material =
      objectMode === "night"
        ? (windows.userData.nightMaterial as Material)
        : dayMaterial instanceof Material
          ? isometricDayMaterialForMode(windows, dayMaterial, objectMode)
          : (dayMaterial as Material);
  });
  city.traverse((object) => {
    if (
      object instanceof LineSegments &&
      object.material instanceof LineBasicMaterial &&
      object.material.userData.modeInk === true
    ) {
      applyArchitecturalInkMode(
        object.material,
        schwellenraumObjektmodus(mode, object),
      );
    }
  });
  const backdrop = city.getObjectByName("presentation paper backdrop");
  if (backdrop instanceof Mesh) {
    backdrop.material = night
      ? (backdrop.userData.nightMaterial as MeshBasicMaterial)
      : isometricDayMaterialForMode(
          backdrop,
          backdrop.userData.dayMaterial as MeshBasicMaterial,
          mode,
        );
  }
  city.traverse((ink) => {
    if (ink.name !== "LoD2 prism ink lines" || !(ink instanceof LineSegments)) {
      return;
    }
    applyArchitecturalInkMode(
      ink.material as LineBasicMaterial,
      mode,
      "silhouette",
    );
  });
  city.traverse((bodies) => {
    if (bodies.name !== "LoD2 prism buildings" || !(bodies instanceof Mesh)) {
      return;
    }
    // Day = unlit exact paint; night = the lit moonlight material.
    bodies.material = night
      ? (bodies.userData.nightMaterial as MeshStandardMaterial)
      : isometricDayMaterialForMode(
          bodies,
          bodies.userData.dayMaterial as MeshBasicMaterial,
          mode,
        );
    const nightMaterial = bodies.userData.nightMaterial as MeshStandardMaterial;
    // A cool moonlight floor keeps pale masonry readable without making
    // the whole building self-luminous or warming it into muddy brown.
    // Moonlight keeps the same restrained floor — it is the building's own
    // visibility under the night rig, not an artificial light, so "Licht
    // aus" does not need to touch it.
    nightMaterial.emissive.setHex(night ? 0x252c39 : 0x000000);
    nightMaterial.emissiveIntensity = night ? 0.68 : 0;
    nightMaterial.needsUpdate = true;
  });
  city.traverse((glass) => {
    if (glass.name !== "LoD2 glass prisms" || !(glass instanceof Mesh)) {
      return;
    }
    glass.material = night
      ? (glass.userData.nightMaterial as MeshStandardMaterial)
      : isometricDayMaterialForMode(
          glass,
          glass.userData.dayMaterial as MeshBasicMaterial,
          mode,
        );
    const nightMaterial = glass.userData.nightMaterial as MeshStandardMaterial;
    nightMaterial.emissive.setHex(night ? 0x0e1a24 : 0x000000);
    nightMaterial.emissiveIntensity = night ? 0.7 : 0;
    nightMaterial.needsUpdate = true;
  });
  const surround = city.getObjectByName(
    "extrapolated west ground and Siegessäule",
  );
  if (surround instanceof Mesh) {
    surround.material = night
      ? (surround.userData.nightMaterial as MeshStandardMaterial)
      : isometricDayMaterialForMode(
          surround,
          surround.userData.dayMaterial as MeshBasicMaterial,
          mode,
        );
  }
  // Accessory meshes share the prism convention: exact flat paint by
  // day (unlit), the lit material only under the night rig. Any mesh
  // named "… lamps" (drawnKit.finishDrawnGroup's lamp bucket, including
  // the source-bound vessels' navigation lamps) additionally carries its own
  // authored nightEmissive/nightEmissiveIntensity in userData, which this
  // loop applies directly: isoWorld accessories never pass through
  // applyMaterialLighting, so this is their one choke point for both
  // turning the warm glow on at night and off again under moonlight.
  const accessoryNames = new Set([
    "Drawn ground slabs",
    "drawn quay walls",
    "bridge structure bodies",
    "bridge structure lamps",
    "Adlerbruecke bodies",
    "Löwenbrücke bodies",
    "Löwenbrücke modern safety handrails bodies",
    "Löwenbrücke modern safety posts bodies",
    "Moltkebrücke ornamental stone bodies",
    "Moltkebrücke ornamental stone lamps",
    "Adlon bodies",
    "Adlon lamps",
    "Paul-Löbe canopy bodies",
    "tunnel portal ramps",
    "monument bodies",
    "filling station bodies",
    "riverside venue bodies",
    "vessel bodies",
    "vessel lamps",
    "Amtssitz am Spreebogen bodies",
    "ARD Hauptstadtstudio architectural details bodies",
    "ARD Hauptstadtstudio architectural details lamps",
    "ARD Hauptstadtstudio atrium roof glazing",
    "ARD Hauptstadtstudio opaque rear roof",
    "ARD HAUPTSTADTSTUDIO facade lettering",
    "ARD Hauptstadtstudio facade subtitle",
    "Berliner Ensemble architectural details bodies",
    "Berliner Ensemble architectural details lamps",
    "Helene Weigel vitrine contents and plinth bodies",
    "Helene Weigel vitrine contents and plinth lamps",
  ]);
  city.traverse((accessory) => {
    if (
      !accessoryNames.has(accessory.name) &&
      accessory.userData.federalStateRepresentation !== true &&
      accessory.userData.reichstagspraesidentenpalaisDetail !== true
    ) {
      return;
    }
    if (accessory instanceof Mesh && accessory.userData.dayMaterial) {
      const accessoryMode = schwellenraumObjektmodus(mode, accessory);
      const accessoryNight = accessoryMode === "night";
      accessory.material = accessoryNight
        ? (accessory.userData.nightMaterial as MeshStandardMaterial)
        : isometricDayMaterialForMode(
            accessory,
            accessory.userData.dayMaterial as MeshBasicMaterial,
            accessoryMode,
          );
      const nightMaterial = accessory.userData
        .nightMaterial as MeshStandardMaterial;
      const lampEmissive = nightMaterial.userData.nightEmissive as
        number | undefined;
      if (accessoryNight && typeof lampEmissive === "number") {
        nightMaterial.emissive.setHex(
          lightsOn ? lampEmissive : MOONLIT_LAMP_OFF,
        );
        nightMaterial.emissiveIntensity = lightsOn
          ? ((nightMaterial.userData.nightEmissiveIntensity as
              number | undefined) ?? 1.1)
          : 0.12;
        nightMaterial.needsUpdate = true;
      }
    }
  });
  // The extrapolated west follows the same ink and lamp conventions.
  const adlonInk = city.getObjectByName("Adlon ink lines");
  if (adlonInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      adlonInk.material as LineBasicMaterial,
      mode,
      "silhouette",
    );
  }
  const canopyInk = city.getObjectByName("Paul-Löbe canopy ink lines");
  if (canopyInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      canopyInk.material as LineBasicMaterial,
      mode,
      "detail",
    );
  }
  const westInk = city.getObjectByName("extrapolated west ink lines");
  if (westInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      westInk.material as LineBasicMaterial,
      mode,
      "silhouette",
    );
  }
  // Note: the actual street lamps ("Geoportal Berlin public-lighting lamp
  // heads" + "… night-only instanced street-light cones" in ParkDetails.ts)
  // live in the parkDetails group, not here — they carry their own
  // nightEmissive/nightOnly userData and are relit centrally by
  // applyMaterialLighting/applyLightingToRoot in ThreeViewer.tsx, which
  // already takes the lightsOn parameter (see setSceneLighting). There is
  // no separate "extrapolated lamp heads" mesh in this drawn city group.
  city.traverse((mullions) => {
    if (
      mullions.name === "LoD2 glass mullions" &&
      mullions instanceof LineSegments
    ) {
      applyArchitecturalInkMode(
        mullions.material as LineBasicMaterial,
        mode,
        "detail",
      );
    }
  });
  // Facade axes: fine ink by day, dimmed to a whisper at night so the
  // warm light strips carry the reading instead.
  city.traverse((axes) => {
    if (axes.name !== "LoD2 facade axes" || !(axes instanceof LineSegments)) {
      return;
    }
    const material = axes.material as LineBasicMaterial;
    applyArchitecturalInkMode(material, mode, "micro");
    material.opacity = night
      ? 0.12
      : mode === "schwellenraum"
        ? 0.25
        : ISO_FACADE_AXIS_OPACITY;
    // The camera-distance fade multiplies this authored mode opacity. Record
    // the new base explicitly so an unlucky zoom level cannot make a Night
    // value look identical to the previous faded Day value and later restore
    // the wrong brightness when the camera moves again.
    material.userData.stableInkAuthoredOpacity = material.opacity;
    material.userData.stableInkAppliedOpacity = null;
  });
  city.traverse((clinkerJoints) => {
    if (
      clinkerJoints.name !== "Kollhoff clinker mortar joints" ||
      !(clinkerJoints instanceof LineSegments)
    ) {
      return;
    }
    const material = clinkerJoints.material as LineBasicMaterial;
    applyArchitecturalInkMode(material, mode, "micro");
    material.opacity = night ? 0.24 : 0.46;
    material.userData.stableInkAuthoredOpacity = material.opacity;
    material.userData.stableInkAppliedOpacity = null;
  });
  city.traverse((strips) => {
    if (strips.name !== "LoD2 facade night strips") return;
    // Lit window strips only ever show with the lights on — the entire
    // point of "Licht aus" is that every window goes dark.
    strips.visible = night && lightsOn;
  });
  const lightOnlyNames = new Set([
    "Kollhoff lit window panes",
    "Charite lit facade window panes",
  ]);
  city.traverse((lightOnly) => {
    if (lightOnlyNames.has(lightOnly.name)) {
      lightOnly.visible = night && lightsOn;
    }
  });
  // Painted markings stay white by day and dim to a cool moonlit line at
  // night — headlight-bright dashes would out-shout the whole night city.
  city.traverse((laneMarkings) => {
    if (
      laneMarkings.name !== "carriageway lane markings" ||
      !(laneMarkings instanceof LineSegments)
    ) {
      return;
    }
    (laneMarkings.material as LineBasicMaterial).color.setHex(
      night ? 0x4a5568 : 0xf2f0e8,
    );
  });
  const surfaceInkNames = new Set([
    "smooth shoreline ink",
    "smooth kerb ink",
    "basin and sunken wall ink",
  ]);
  city.traverse((inkLines) => {
    if (
      surfaceInkNames.has(inkLines.name) &&
      inkLines instanceof LineSegments
    ) {
      applyArchitecturalInkMode(
        inkLines.material as LineBasicMaterial,
        mode,
        "detail",
      );
    }
  });
  const waterSurface = city.getObjectByName("drawn water surface");
  if (waterSurface instanceof InstancedMesh) {
    // Moonlight keeps the water dark with a slightly cooler, slightly more
    // opaque tone — "Wasser dunkel mit dezenter Mondspiegelung erlaubt":
    // a subtle, authored-colour hint of a moonlit surface, not a light.
    (waterSurface.material as MeshBasicMaterial).color.setHex(
      moonlit ? MOONLIT_WATER : night ? 0x27435c : 0x9fc7d8,
    );
    (waterSurface.material as MeshBasicMaterial).opacity = moonlit
      ? 0.68
      : night
        ? 0.6
        : 0.45;
  }
  const kerbs = city.getObjectByName("drawn kerb lines");
  if (kerbs instanceof LineSegments) {
    applyArchitecturalInkMode(
      kerbs.material as LineBasicMaterial,
      mode,
      "detail",
    );
  }
  const monumentInk = city.getObjectByName("monument ink lines");
  if (monumentInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      monumentInk.material as LineBasicMaterial,
      schwellenraumObjektmodus(mode, monumentInk),
      "detail",
    );
  }
  const railingInk = city.getObjectByName("bridge structure ink lines");
  if (railingInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      railingInk.material as LineBasicMaterial,
      mode,
      "detail",
    );
  }
  const moltkeInk = city.getObjectByName(
    "Moltkebrücke ornamental stone ink lines",
  );
  if (moltkeInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      moltkeInk.material as LineBasicMaterial,
      mode,
      "detail",
    );
  }
  const quayInk = city.getObjectByName("quay ink lines");
  if (quayInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      quayInk.material as LineBasicMaterial,
      mode,
      "silhouette",
    );
  }
  const portalInk = city.getObjectByName("tunnel portal ink lines");
  if (portalInk instanceof LineSegments) {
    applyArchitecturalInkMode(
      portalInk.material as LineBasicMaterial,
      mode,
      "silhouette",
    );
  }
}

// ALKIS roof-form codes carried in the payload. 3100 Satteldach,
// 3200 Walmdach, 3500 Zeltdach, 2100 Pultdach; ambiguous mixed/unknown
// forms stay at the measured flat cap rather than receiving a guessed shape.
export const ROOF_GABLED = 3100;
export const ROOF_HIPPED = 3200;
export const ROOF_TENT = 3500;
export const ROOF_SHED = 2100;
// Only near-rectangular footprints get a fitted procedural roof.
export const ROOF_MIN_RECTANGULARITY = 0.72;

type FittedRect = {
  axis: [number, number];
  center: [number, number];
  halfLength: number;
  halfWidth: number;
  rectangularity: number;
};

function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (
    o: [number, number],
    a: [number, number],
    b: [number, number],
  ): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Array<[number, number]> = [];
  for (const p of [...sorted].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function ringArea(ring: Array<[number, number]>): number {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    area += x1 * z2 - x2 * z1;
  }
  return Math.abs(area) / 2;
}

/**
 * Oriented minimum-area bounding rectangle via rotating calipers over
 * the convex hull, plus how rectangular the footprint actually is.
 */
export function fitRectangle(ring: Array<[number, number]>): FittedRect | null {
  if (ring.length < 3) {
    return null;
  }
  const hull = convexHull(ring);
  if (hull.length < 3) {
    return null;
  }
  let best: FittedRect | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let i = 0; i < hull.length; i += 1) {
    const [x1, z1] = hull[i];
    const [x2, z2] = hull[(i + 1) % hull.length];
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 1e-6) {
      continue;
    }
    const ax = (x2 - x1) / length;
    const az = (z2 - z1) / length;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const [px, pz] of hull) {
      const u = px * ax + pz * az;
      const v = -px * az + pz * ax;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < bestArea) {
      bestArea = area;
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      best = {
        axis: maxU - minU >= maxV - minV ? [ax, az] : [-az, ax],
        center: [cu * ax - cv * az, cu * az + cv * ax],
        halfLength: Math.max(maxU - minU, maxV - minV) / 2,
        halfWidth: Math.min(maxU - minU, maxV - minV) / 2,
        rectangularity: 0,
      };
    }
  }
  if (!best || bestArea < 1e-6) {
    return null;
  }
  best.rectangularity = ringArea(ring) / bestArea;
  return best;
}

function shapeFromRings(building: PrismBuilding): Shape {
  const shape = new Shape();
  building.ring.forEach(([xDm, zDm], index) => {
    // Shape lives in XY; after rotateX(-90°) shape-Y becomes -world-Z,
    // so feed -z to land on the correct scene position.
    const x = xDm / 10;
    const y = -zDm / 10;
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  for (const hole of building.holes ?? []) {
    const path = new Path();
    hole.forEach(([xDm, zDm], index) => {
      const x = xDm / 10;
      const y = -zDm / 10;
      if (index === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    });
    shape.holes.push(path);
  }
  return shape;
}

/**
 * Procedural pitched roof (flat faces only) fitted to the footprint's
 * oriented rectangle, for the ALKIS roof codes carried in the payload.
 * Returns non-indexed triangles or null (flat cap stays). The roof rect
 * gets a small 0.35 m eave overhang; the exact ring walls run to the
 * eave and the flat cap underneath closes the body, so the building is
 * visually watertight without cutting the true footprint.
 */
export function buildRoofGeometry(
  rect: FittedRect,
  eaveY: number,
  ridgeY: number,
  roofCode: number,
): Float32Array | null {
  const overhang = 0.35;
  const [ax, az] = rect.axis;
  const nx = -az;
  const nz = ax;
  const hl = rect.halfLength + overhang;
  const hw = rect.halfWidth + overhang;
  const [cx, cz] = rect.center;
  const corner = (
    u: number,
    v: number,
    y: number,
  ): [number, number, number] => [
    cx + ax * u + nx * v,
    y,
    cz + az * u + nz * v,
  ];
  const triangles: number[] = [];
  const push = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): void => {
    triangles.push(...a, ...b, ...c);
  };
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ): void => {
    push(a, b, c);
    push(a, c, d);
  };
  if (roofCode === ROOF_GABLED) {
    const r1 = corner(-hl, 0, ridgeY);
    const r2 = corner(hl, 0, ridgeY);
    quad(corner(-hl, -hw, eaveY), corner(hl, -hw, eaveY), r2, r1);
    quad(r1, r2, corner(hl, hw, eaveY), corner(-hl, hw, eaveY));
    // Vertical gable-end triangles close the two open ends.
    push(corner(-hl, hw, eaveY), r1, corner(-hl, -hw, eaveY));
    push(corner(hl, -hw, eaveY), r2, corner(hl, hw, eaveY));
  } else if (roofCode === ROOF_HIPPED) {
    const inset = Math.min(hw, hl * 0.6);
    const r1 = corner(-hl + inset, 0, ridgeY);
    const r2 = corner(hl - inset, 0, ridgeY);
    quad(corner(-hl, -hw, eaveY), corner(hl, -hw, eaveY), r2, r1);
    quad(r1, r2, corner(hl, hw, eaveY), corner(-hl, hw, eaveY));
    push(corner(-hl, hw, eaveY), r1, corner(-hl, -hw, eaveY));
    push(corner(hl, -hw, eaveY), r2, corner(hl, hw, eaveY));
  } else if (roofCode === ROOF_SHED) {
    // Single slope across the short axis; deterministic high side.
    const high1 = corner(-hl, -hw, ridgeY);
    const high2 = corner(hl, -hw, ridgeY);
    const low1 = corner(hl, hw, eaveY);
    const low2 = corner(-hl, hw, eaveY);
    quad(high1, high2, low1, low2);
    // Vertical skirts close the slope: two side triangles + back face.
    push(corner(-hl, -hw, eaveY), high1, low2);
    push(low1, high2, corner(hl, -hw, eaveY));
    quad(corner(hl, -hw, eaveY), high2, high1, corner(-hl, -hw, eaveY));
  } else if (roofCode === ROOF_TENT) {
    const apex = corner(0, 0, ridgeY);
    push(corner(-hl, -hw, eaveY), corner(hl, -hw, eaveY), apex);
    push(corner(hl, -hw, eaveY), corner(hl, hw, eaveY), apex);
    push(corner(hl, hw, eaveY), corner(-hl, hw, eaveY), apex);
    push(corner(-hl, hw, eaveY), corner(-hl, -hw, eaveY), apex);
  } else {
    return null;
  }
  return new Float32Array(triangles);
}

/** The eave-to-ridge rise for a fitted roof, bounded to stay plausible. */
export function roofRise(rect: FittedRect, totalHeight: number): number {
  const rise = Math.min(5, Math.max(1.2, rect.halfWidth * 2 * 0.3));
  return rise < totalHeight * 0.6 ? rise : 0;
}

// Ligne-claire facade rhythm: floors come from measured LoD2 height and
// bays from each wall's true length. The open shell data supports those
// bounded proportions, not exact opening coordinates, so ordinary prisms
// receive only architectural axis/band strokes and never fabricated panes.
export const ISO_WINDOW_FLOOR_PITCH_M = 3.1;
export const ISO_WINDOW_BAY_PITCH_M = 3.6;
// Slim, elongated panes ("schlanker, länglicher"): tall portrait glass.
export const ISO_WINDOW_WIDTH_M = 1.05;
export const ISO_WINDOW_HEIGHT_M = 1.9;
export const ISO_FACADE_WINDOW_DASH_M = 2.35;
export const ISO_FACADE_WINDOW_GAP_M = 1.25;
const WINDOW_EAVE_CLEARANCE_M = 0.55;
const WINDOW_MIN_WALL_M = 2.6;
const WINDOW_MIN_BUILDING_M = 4;
const WINDOW_FACE_OFFSET_M = 0.07;
// Deterministic share of warm-lit windows after dark.
const WINDOW_LIT_FRACTION = 0.38;
const WINDOW_NIGHT_LIT_TONES = [0xffd28a, 0xffc36e, 0xf3dfa8] as const;

// Monumental civic buildings (large surveyed footprint AND height) get
// piano-nobile proportions instead of housing storeys: taller windows
// on a wider floor/bay pitch, the way the Reichstag's elevation reads.
export const CIVIC_FOOTPRINT_M2 = 2500;
export const CIVIC_HEIGHT_M = 16;
const CIVIC_WINDOW = {
  bayPitch: 4.6,
  floorPitch: 4.4,
  height: 3.0,
  sillStart: 1.05,
  width: 1.3,
};
const HOUSING_WINDOW = {
  bayPitch: ISO_WINDOW_BAY_PITCH_M,
  floorPitch: ISO_WINDOW_FLOOR_PITCH_M,
  height: ISO_WINDOW_HEIGHT_M,
  sillStart: 1.05,
  width: ISO_WINDOW_WIDTH_M,
};
type WindowFormat = typeof HOUSING_WINDOW;

// Hand-pinned facade formats where the generic grid would be wrong
// ("der Reichstag darf nicht falsche Fenster haben"): the Reichstag
// ensemble carries its real rhythm — a high rusticated base, then tall
// arched window rows on a stately pitch, on the towers too.
export const HERO_WINDOW_FORMATS: Record<string, WindowFormat> = {
  K0002MCN: {
    bayPitch: 5.4,
    floorPitch: 8.2,
    height: 4.8,
    sillStart: 5.2,
    width: 2.4,
  },
  K0003Ty1: {
    bayPitch: 5.2,
    floorPitch: 8.2,
    height: 4.4,
    sillStart: 6,
    width: 2.2,
  },
  K0003VDk: {
    bayPitch: 5.2,
    floorPitch: 8.2,
    height: 4.4,
    sillStart: 6,
    width: 2.2,
  },
  UbQkgNZe: {
    bayPitch: 5.2,
    floorPitch: 8.2,
    height: 4.4,
    sillStart: 6,
    width: 2.2,
  },
  ycOYQRVL: {
    bayPitch: 5.2,
    floorPitch: 8.2,
    height: 4.4,
    sillStart: 6,
    width: 2.2,
  },
  // The 25-storey Kollhoff-Tower carries a close, portrait office-window
  // register between its red ceramic piers. The shell remains the exact
  // 16-part LoD2 staircase; this only fixes the elevation rhythm.
  ...Object.fromEntries(
    [...KOLLHOFF_TOWER_PRISM_IDS].map((id) => [
      id,
      {
        bayPitch: KOLLHOFF_TOWER_PROFILE.windowBayPitchM,
        floorPitch: KOLLHOFF_TOWER_PROFILE.floorPitchM,
        height: KOLLHOFF_TOWER_PROFILE.windowHeightM,
        sillStart: 1.05,
        width: KOLLHOFF_TOWER_PROFILE.windowWidthM,
      },
    ]),
  ),
  // The 21-storey Charite tower's renewed curtain wall uses close, narrow
  // vertical modules and a regular 3.7 m floor rhythm, not civic piano-nobile
  // windows. All values are presentation rhythm over the exact LoD2 shells.
  ...Object.fromEntries(
    [...CHARITE_BETTENHOCHHAUS_IDS].map((id) => [
      id,
      {
        bayPitch: CHARITE_BETTENHOCHHAUS_PROFILE.upperPanelPitchM,
        floorPitch: CHARITE_BETTENHOCHHAUS_PROFILE.floorPitchM,
        height: CHARITE_BETTENHOCHHAUS_PROFILE.facadeElementHeightM,
        sillStart: 1.05,
        width: 1.05,
      },
    ]),
  ),
};

export function windowFormatForBuilding(
  buildingId: string,
  isCivic: boolean,
): WindowFormat {
  return (
    HERO_WINDOW_FORMATS[buildingId] ?? (isCivic ? CIVIC_WINDOW : HOUSING_WINDOW)
  );
}
// Recognition layers draw the complete source-specific fenestration for
// these buildings. Generic prism panes underneath would double the windows,
// create z-fighting and obscure the documented facade rhythm.
export const WINDOWS_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  "K0002MCN",
  "K0003Ty1",
  "K0003VDk",
  "UbQkgNZe",
  "ycOYQRVL",
  ...HISTORIC_CHARITE_IDS,
  ...DEUTSCHES_THEATER_CUSTOM_FACADE_IDS,
  ...TERRASSENHAUS_HAFENPLATZ_IDS,
  ...ARD_HAUPTSTADTSTUDIO_IDS,
  ...BERLINER_ENSEMBLE_IDS,
  ...REICHSTAGSPRAESIDENTENPALAIS_IDS,
]);

// Dedicated overlays already carry the documented base/cornice rhythm for
// these parts. Suppress only the generic trim pass; the measured LoD2 prism
// itself remains present and collision-authoritative.
export const GENERIC_FACADE_TRIM_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  ...ARD_HAUPTSTADTSTUDIO_IDS,
  ...BERLINER_ENSEMBLE_IDS,
  ...REICHSTAGSPRAESIDENTENPALAIS_IDS,
]);

// The generic pitched-roof pass invents ridge stacks for ordinary gables.
// Wallot's two affected Palais roof parts instead use source-bounded crest
// and fixture details in the dedicated recognition layer.
export const GENERIC_CHIMNEY_SUPPRESSED_IDS: ReadonlySet<string> = new Set([
  ...REICHSTAGSPRAESIDENTENPALAIS_GENERIC_CHIMNEY_SUPPRESSED_IDS,
]);

/**
 * Render-only top-cap openings restored by a dedicated recognition layer.
 * The footprint, measured side shell and pedestrian/flight collision remain
 * authoritative LoD2 geometry; only the opaque horizontal display cap is
 * omitted so transparent roof architecture can read as transparent.
 */
export const PRISM_VISUAL_TOP_CAP_SUPPRESSED_IDS: ReadonlySet<string> = new Set(
  [ARD_HAUPTSTADTSTUDIO_ATRIUM_ID],
);

function withoutVisualTopCap(
  sourceGeometry: BufferGeometry,
  topY: number,
): BufferGeometry {
  const source = sourceGeometry.index
    ? sourceGeometry.toNonIndexed()
    : sourceGeometry;
  const positions = source.getAttribute("position");
  const normals = source.getAttribute("normal");
  const retained: number[] = [];
  for (let index = 0; index < positions.count; index += 3) {
    let isTopCap = true;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = index + corner;
      if (
        normals.getY(vertex) <= 0.7 ||
        Math.abs(positions.getY(vertex) - topY) > 0.075
      ) {
        isTopCap = false;
        break;
      }
    }
    if (isTopCap) continue;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = index + corner;
      retained.push(
        positions.getX(vertex),
        positions.getY(vertex),
        positions.getZ(vertex),
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(retained, 3));
  geometry.computeVertexNormals();
  if (source !== sourceGeometry) source.dispose();
  sourceGeometry.dispose();
  return geometry;
}

/**
 * Isometric face shading ("mehr Shading, kompletter isometrischer
 * Realismus"): every face keeps ONE constant tone, but its brightness
 * depends on which way it faces — the classic axonometric drawing
 * convention. Tops stay full, the two visible wall directions step down
 * so volumes read plastically; still flat, still unlit, no gradients.
 */
export const ISO_FACE_SHADE = {
  east: 0.95,
  north: 0.98,
  south: 0.92,
  top: 1,
  west: 0.89,
} as const;

export function isoFaceShade(nx: number, ny: number, nz: number): number {
  if (ny > 0.55) {
    return ISO_FACE_SHADE.top;
  }
  if (ny < -0.55) {
    return ISO_FACE_SHADE.west;
  }
  if (Math.abs(nx) >= Math.abs(nz)) {
    return nx > 0 ? ISO_FACE_SHADE.east : ISO_FACE_SHADE.west;
  }
  return nz > 0 ? ISO_FACE_SHADE.south : ISO_FACE_SHADE.north;
}

// Cool slate tint mixed into flat roof caps so they read as drawn
// roof plates instead of sun-warmed facade paint. Lifted in v0.39.0: roofs are
// the single largest visible surface in an isometric view, so a neutral cool
// grey here greyed out the whole drawing. Still clearly cooler than the
// facades — the plate reads as a plate, just no longer as slate.
const ROOF_PLATE_TINT = new Color(0xe4e7df);
// How far a roof cap leans toward that tint. 0.45 buried the building's own
// colour under a neutral grey; 0.34 keeps the plate distinct while the paint
// underneath still shows through.
const ROOF_PLATE_TINT_BLEND = 0.24;
// Hyperdetail bands: a darker plinth (Sockel) at the base and a light
// protruding cornice (Gesims) under the roof edge of every drawn wall.
const SOCKEL_HEIGHT_M = 0.55;
const SOCKEL_DEPTH_M = 0.32;
const CORNICE_HEIGHT_M = 0.22;
const CORNICE_DEPTH_M = 0.48;
const DETAIL_MIN_WALL_M = 2.5;
const DETAIL_MIN_BUILDING_M = 5;
// Night light temperature: offices burn cool white, homes warm.
const WINDOW_NIGHT_CIVIC_TONES = [0xdfe8f2, 0xcfe0ee, 0xffd28a] as const;

/** Bay/floor grid for one wall; null when the wall carries no windows. */
export function windowGrid(
  wallLength: number,
  bodyHeight: number,
  format: WindowFormat = HOUSING_WINDOW,
): { bays: number; floors: number; firstOffset: number } | null {
  if (wallLength < WINDOW_MIN_WALL_M) {
    return null;
  }
  const bays = Math.floor(
    (wallLength - format.width - 0.9) / format.bayPitch + 1,
  );
  const floors = Math.floor(
    (bodyHeight - format.sillStart - format.height - WINDOW_EAVE_CLEARANCE_M) /
      format.floorPitch +
      1,
  );
  if (bays < 1 || floors < 1) {
    return null;
  }
  return {
    bays,
    floors,
    firstOffset: (wallLength - (bays - 1) * format.bayPitch) / 2,
  };
}

function hash32(seed: string, salt: number): number {
  let hash = salt >>> 0;
  for (const char of seed) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export type PrismWall = {
  dirX: number;
  dirZ: number;
  index: number;
  isCourtyard: boolean;
  length: number;
  nx: number;
  nz: number;
  x1: number;
  z1: number;
};

function wallsFromRing(
  ring: number[][],
  isCourtyard: boolean,
  startIndex: number,
): PrismWall[] {
  let doubleArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[(index + 1) % ring.length];
    doubleArea += (x1 / 10) * (z2 / 10) - (x2 / 10) * (z1 / 10);
  }
  // `flip` makes the normal independent of ring winding. An outer normal
  // points away from the footprint; a courtyard normal points into the void,
  // which is also outward from the built volume.
  const windingFlip = doubleArea >= 0 ? 1 : -1;
  const flip = windingFlip * (isCourtyard ? -1 : 1);
  const walls: PrismWall[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const [x1dm, z1dm] = ring[index];
    const [x2dm, z2dm] = ring[(index + 1) % ring.length];
    const x1 = x1dm / 10;
    const z1 = z1dm / 10;
    const wallX = x2dm / 10 - x1;
    const wallZ = z2dm / 10 - z1;
    const length = Math.hypot(wallX, wallZ);
    if (length < 1e-6) {
      continue;
    }
    const dirX = wallX / length;
    const dirZ = wallZ / length;
    walls.push({
      dirX,
      dirZ,
      index: startIndex + walls.length,
      isCourtyard,
      length,
      nx: dirZ * flip,
      nz: -dirX * flip,
      x1,
      z1,
    });
  }
  return walls;
}

/**
 * Every measured facade wall, including LoD2 courtyard rings, in metres.
 * Normals always point out of the built volume regardless of source winding.
 */
export function facadeWallsOf(building: PrismBuilding): PrismWall[] {
  const walls = wallsFromRing(building.ring, false, 0);
  for (const hole of building.holes ?? []) {
    walls.push(...wallsFromRing(hole, true, walls.length));
  }
  return walls;
}

const KOLLHOFF_CLINKER_FACE_OFFSET_M = 0.12;
const KOLLHOFF_WINDOW_FACE_OFFSET_M = 0.155;
const KOLLHOFF_CLINKER_EDGE_INSET_M = 0.06;
const KOLLHOFF_CLINKER_JOINT_GAP_M = 0.018;
const CHARITE_BASE_FACE_OFFSET_M = 0.13;
const CHARITE_WINDOW_FACE_OFFSET_M = 0.175;

/**
 * Append the close-view ceramic bond to the exact walls of one Kollhoff part.
 *
 * Horizontal bed joints use the inferred 32 cm facade module. Staggered head
 * joints use the inferred 64 cm bond and stop short of each bed joint. The
 * 12 cm face offset is deliberately larger than the generic facade-axis
 * offset: the two line layers cannot occupy the same depth plane and flicker.
 */
export function appendKollhoffClinkerJoints(
  building: PrismBuilding,
  target: number[],
  facadeHeightM = Math.max(2.5, building.h_dm / 10),
): number {
  if (!KOLLHOFF_TOWER_PRISM_IDS.has(building.id)) {
    return 0;
  }
  const before = target.length;
  const y0 = building.y0_dm / 10;
  const top = y0 + facadeHeightM;
  const courseM = KOLLHOFF_TOWER_PROFILE.clinkerCourseM;
  const moduleM = KOLLHOFF_TOWER_PROFILE.clinkerModuleM;
  const firstY = y0 + courseM;
  const lastY = top - courseM;
  for (const wall of facadeWallsOf(building)) {
    if (wall.length <= KOLLHOFF_CLINKER_EDGE_INSET_M * 2 + moduleM) {
      continue;
    }
    const ox = wall.nx * KOLLHOFF_CLINKER_FACE_OFFSET_M;
    const oz = wall.nz * KOLLHOFF_CLINKER_FACE_OFFSET_M;
    const startX = wall.x1 + wall.dirX * KOLLHOFF_CLINKER_EDGE_INSET_M + ox;
    const startZ = wall.z1 + wall.dirZ * KOLLHOFF_CLINKER_EDGE_INSET_M + oz;
    const endAlong = wall.length - KOLLHOFF_CLINKER_EDGE_INSET_M;
    const endX = wall.x1 + wall.dirX * endAlong + ox;
    const endZ = wall.z1 + wall.dirZ * endAlong + oz;
    let course = 0;
    for (let y = firstY; y <= lastY + 1e-6; y += courseM) {
      target.push(startX, y, startZ, endX, y, endZ);
      const phase = course % 2 === 0 ? moduleM * 0.5 : moduleM;
      const jointBottom = y - courseM + KOLLHOFF_CLINKER_JOINT_GAP_M;
      const jointTop = y - KOLLHOFF_CLINKER_JOINT_GAP_M;
      for (
        let along = phase;
        along < endAlong - KOLLHOFF_CLINKER_EDGE_INSET_M;
        along += moduleM
      ) {
        const x = wall.x1 + wall.dirX * along + ox;
        const z = wall.z1 + wall.dirZ * along + oz;
        target.push(x, jointBottom, z, x, jointTop, z);
      }
      course += 1;
    }
  }
  return (target.length - before) / 6;
}

/** Axis-aligned-to-`axis` box as non-indexed triangles (chimneys). */
function boxTriangles(
  cx: number,
  cy: number,
  cz: number,
  axis: [number, number],
  sizeAlong: number,
  sizeUp: number,
  sizeAcross: number,
): Float32Array {
  const [ax, az] = axis;
  const nx = -az;
  const nz = ax;
  const corner = (
    u: number,
    y: number,
    v: number,
  ): [number, number, number] => [
    cx + ax * u * sizeAlong * 0.5 + nx * v * sizeAcross * 0.5,
    cy + y * sizeUp * 0.5,
    cz + az * u * sizeAlong * 0.5 + nz * v * sizeAcross * 0.5,
  ];
  const quads: Array<[number, number, number][]> = [
    // Counter-clockwise from above. The previous order pointed the normal
    // downward, so Three.js back-face culling removed every top surface and
    // made segmented bridges look like open ladders.
    [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [
      corner(-1, -1, -1),
      corner(-1, 1, -1),
      corner(-1, 1, 1),
      corner(-1, -1, 1),
    ],
    [corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [
      corner(-1, -1, -1),
      corner(1, -1, -1),
      corner(1, 1, -1),
      corner(-1, 1, -1),
    ],
    [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)],
  ];
  const triangles: number[] = [];
  for (const [a, b, c, d] of quads) {
    triangles.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return new Float32Array(triangles);
}

/** Closed rectangular beam between arbitrary 3D endpoints. */
function beamBetweenTriangles(
  start: [number, number, number],
  end: [number, number, number],
  width: number,
  depth = width,
): Float32Array {
  const centre: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];
  const delta: [number, number, number] = [
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
  ];
  const length = Math.hypot(...delta);
  if (length < 1e-6) {
    return new Float32Array();
  }
  const w: [number, number, number] = delta.map((value) => value / length) as [
    number,
    number,
    number,
  ];
  const reference: [number, number, number] =
    Math.abs(w[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const rawU: [number, number, number] = [
    reference[1] * w[2] - reference[2] * w[1],
    reference[2] * w[0] - reference[0] * w[2],
    reference[0] * w[1] - reference[1] * w[0],
  ];
  const uLength = Math.hypot(...rawU) || 1;
  const u: [number, number, number] = rawU.map((value) => value / uLength) as [
    number,
    number,
    number,
  ];
  const v: [number, number, number] = [
    w[1] * u[2] - w[2] * u[1],
    w[2] * u[0] - w[0] * u[2],
    w[0] * u[1] - w[1] * u[0],
  ];
  const corner = (
    uSign: number,
    vSign: number,
    wSign: number,
  ): [number, number, number] => [
    centre[0] +
      u[0] * uSign * width * 0.5 +
      v[0] * vSign * depth * 0.5 +
      w[0] * wSign * length * 0.5,
    centre[1] +
      u[1] * uSign * width * 0.5 +
      v[1] * vSign * depth * 0.5 +
      w[1] * wSign * length * 0.5,
    centre[2] +
      u[2] * uSign * width * 0.5 +
      v[2] * vSign * depth * 0.5 +
      w[2] * wSign * length * 0.5,
  ];
  const faces: Array<[number, number, number][]> = [
    [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)],
    [
      corner(-1, -1, 1),
      corner(-1, 1, 1),
      corner(-1, 1, -1),
      corner(-1, -1, -1),
    ],
    [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [
      corner(-1, -1, 1),
      corner(-1, -1, -1),
      corner(1, -1, -1),
      corner(1, -1, 1),
    ],
    [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)],
    [
      corner(1, -1, -1),
      corner(-1, -1, -1),
      corner(-1, 1, -1),
      corner(1, 1, -1),
    ],
  ];
  const triangles: number[] = [];
  for (const [a, b, c, d] of faces) {
    triangles.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return new Float32Array(triangles);
}

// Ground-class pairs whose shared cell edge gets a drawn kerb line.
const KERB_PAIRS = new Set([
  "asphalt|grass",
  "asphalt|plazaBrick",
  "grass|plazaBrick",
  // Quay lines: wherever land meets the Spree/Humboldthafen.
  "asphalt|water",
  "grass|water",
  "plazaBrick|water",
]);

/**
 * Kerb ink: the surveyed run-length ground grid knows exactly where
 * roads meet lawns and plazas — draw those cell boundaries as thin ink
 * lines, the ligne-claire ground the buildings already live on.
 */
function createKerbLines(
  ground: VoxelPayload,
  skippedClasses: ReadonlySet<string> = new Set(),
  skipAtWorld?: (x: number, z: number) => boolean,
): LineSegments | null {
  const cell = ground.cell_m;
  const { cols, min_x_idx, min_z_idx, rows } = ground.grid;
  const classGrid = new Int16Array(cols * rows).fill(-1);
  ground.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      for (let step = 0; step < run; step += 1) {
        const x = xStart + step;
        if (x >= 0 && x < cols) {
          classGrid[zOffset * cols + x] = classId;
        }
      }
    }
  });
  const nameOf = (id: number): string | null =>
    id >= 0 ? (ground.classes[id] ?? null) : null;
  const kerbPair = (a: number, b: number): boolean => {
    if (a === b) {
      return false;
    }
    const nameA = nameOf(a);
    const nameB = nameOf(b);
    if (!nameA || !nameB) {
      return false;
    }
    // The high-resolution OSM surface layer owns these boundaries. Keeping
    // their old 4 m grid ink underneath made a smooth road or river look
    // square again wherever the coarse line protruded past the true curve.
    if (skippedClasses.has(nameA) || skippedClasses.has(nameB)) {
      return false;
    }
    return KERB_PAIRS.has(
      nameA < nameB ? `${nameA}|${nameB}` : `${nameB}|${nameA}`,
    );
  };
  const sample = groundTopSampler(ground);
  const positions: number[] = [];
  const edge = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    xOffset: number,
    zOffset: number,
  ): void => {
    const y = sample(xOffset, zOffset) + 0.22;
    positions.push(
      (min_x_idx + x1) * cell,
      y,
      (min_z_idx + z1) * cell,
      (min_x_idx + x2) * cell,
      y,
      (min_z_idx + z2) * cell,
    );
  };
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const worldX = (min_x_idx + x + 0.5) * cell;
      const worldZ = (min_z_idx + z + 0.5) * cell;
      if (skipAtWorld?.(worldX, worldZ)) {
        continue;
      }
      const here = classGrid[z * cols + x];
      if (
        x + 1 < cols &&
        !skipAtWorld?.(worldX + cell, worldZ) &&
        kerbPair(here, classGrid[z * cols + x + 1])
      ) {
        edge(x + 1, z, x + 1, z + 1, x, z);
      }
      if (
        z + 1 < rows &&
        !skipAtWorld?.(worldX, worldZ + cell) &&
        kerbPair(here, classGrid[(z + 1) * cols + x])
      ) {
        edge(x, z + 1, x + 1, z + 1, x, z);
      }
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const kerbs = new LineSegments(
    geometry,
    markArchitecturalInk(
      new LineBasicMaterial({
        opacity: 0.32,
        transparent: true,
      }),
      "detail",
    ),
  );
  kerbs.name = "drawn kerb lines";
  kerbs.renderOrder = 2;
  return kerbs;
}

// Embankment furniture: balustrade proportions and the shortest run
// that still earns a flight of steps down to the water.
const RAIL_HEIGHT_M = 1.05;
const RAIL_BAR_M = 0.12;
const RAIL_POST_SPACING_M = 3.2;
const RAIL_POST_W_M = 0.11;
export const STAIR_MIN_RUN_M = 26;
const STAIR_WIDTH_M = 4.2;

// Wall joints are drawn every ~14 m so a 200 m embankment reads as
// masonry courses rather than one endless grey band.
const QUAY_JOINT_SPACING_M = 14;

/**
 * Quay walls ("die Spree mit Vertiefung"): wherever the surveyed ground
 * grid puts land next to water, a vertical stone wall drops from the
 * bank down past the water line — the river reads as a real recessed
 * channel with drawn embankments instead of a flat blue sheet. The wall
 * carries its own ink: a top line along the bank edge, the water line
 * where the masonry enters the Spree, and vertical joints between them.
 */
function createQuayWalls(
  ground: VoxelPayload,
  detailProfile: "full" | "mobile" = "full",
): Group | null {
  const cell = ground.cell_m;
  const { cols, min_x_idx, min_z_idx, rows } = ground.grid;
  const classGrid = new Int16Array(cols * rows).fill(-1);
  ground.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      for (let step = 0; step < run; step += 1) {
        const x = xStart + step;
        if (x >= 0 && x < cols) {
          classGrid[zOffset * cols + x] = classId;
        }
      }
    }
  });
  const waterClass = ground.classes.indexOf("water");
  // Every surveyed land class earns a wall: with the water table down in
  // its cut, a concrete or brick bank without one would leave the ground
  // slab floating over open air.
  const landClasses = new Set(
    ["asphalt", "grass", "plazaBrick", "concrete", "glass"].map((name) =>
      ground.classes.indexOf(name),
    ),
  );
  if (waterClass < 0) {
    return null;
  }
  const sample = groundTopSampler(ground);
  const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
  const positions: number[] = [];
  const colors: number[] = [];
  const inkLines: number[] = [];
  const paint = new Color();
  const wall = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    xOffset: number,
    zOffset: number,
    towardWaterX: number,
    towardWaterZ: number,
  ): void => {
    const top = sample(xOffset, zOffset) + 0.22;
    const bottom = waterTop - 3.1;
    if (top <= bottom) {
      return;
    }
    const ax = (min_x_idx + x1) * cell;
    const az = (min_z_idx + z1) * cell;
    const bx = (min_x_idx + x2) * cell;
    const bz = (min_z_idx + z2) * cell;
    // The northern Humboldthafen is a documented restored Schrägufer. Its
    // source-bound face is built once by HumboldthafenRefinements; retaining
    // this raster wall/ledge/rail would create a coincident vertical double.
    if (isNorthernHumboldthafenQuayEdge(ax, az, bx, bz)) {
      return;
    }
    // Drawn masonry: the bank edge, the water line where the wall enters
    // the Spree, and vertical joints between the two.
    const nudgeX = towardWaterX * 0.05;
    const nudgeZ = towardWaterZ * 0.05;
    inkLines.push(
      ax + nudgeX,
      top,
      az + nudgeZ,
      bx + nudgeX,
      top,
      bz + nudgeZ,
      ax + nudgeX,
      waterTop,
      az + nudgeZ,
      bx + nudgeX,
      waterTop,
      bz + nudgeZ,
    );
    const wallRun = Math.hypot(bx - ax, bz - az);
    const joints = Math.floor(wallRun / QUAY_JOINT_SPACING_M);
    for (let joint = 1; joint <= joints; joint += 1) {
      const t = (joint / (joints + 1)) * wallRun;
      const jx = ax + ((bx - ax) / (wallRun || 1)) * t + nudgeX;
      const jz = az + ((bz - az) / (wallRun || 1)) * t + nudgeZ;
      inkLines.push(jx, top, jz, jx, waterTop, jz);
    }
    paint.setHex((xOffset * 31 + zOffset * 17) % 2 === 0 ? 0xa5a193 : 0xadaa9c);
    for (const [px, py, pz] of [
      [ax, bottom, az],
      [bx, bottom, bz],
      [bx, top, bz],
      [ax, bottom, az],
      [bx, top, bz],
      [ax, top, az],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
    if (detailProfile === "mobile") {
      // Phones need a closed bank face around the retained raster water, not
      // the memory-heavy promenade ledges, rail posts and repeated stair
      // flights owned by the full fallback. The top/water ink above keeps the
      // coarse embankment legible with a bounded vertex count.
      return;
    }
    // The riverside promenade: a light boardwalk ledge just above the
    // water, jutting from the quay wall — the "Weg zum Ufer".
    const ledgeY = waterTop + 0.55;
    const jut = 2.2;
    paint.setHex(0xe4ddcb);
    for (const [px, py, pz] of [
      [ax, ledgeY, az],
      [bx, ledgeY, bz],
      [bx + towardWaterX * jut, ledgeY, bz + towardWaterZ * jut],
      [ax, ledgeY, az],
      [bx + towardWaterX * jut, ledgeY, bz + towardWaterZ * jut],
      [ax + towardWaterX * jut, ledgeY, az + towardWaterZ * jut],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
    // Its thin front face down to the water keeps the ledge readable.
    paint.setHex(0xd0c9b7);
    for (const [px, py, pz] of [
      [ax + towardWaterX * jut, ledgeY, az + towardWaterZ * jut],
      [bx + towardWaterX * jut, ledgeY, bz + towardWaterZ * jut],
      [bx + towardWaterX * jut, waterTop - 0.3, bz + towardWaterZ * jut],
      [ax + towardWaterX * jut, ledgeY, az + towardWaterZ * jut],
      [bx + towardWaterX * jut, waterTop - 0.3, bz + towardWaterZ * jut],
      [ax + towardWaterX * jut, waterTop - 0.3, az + towardWaterZ * jut],
    ] as const) {
      positions.push(px, py, pz);
      colors.push(paint.r, paint.g, paint.b);
    }
    const runLength = Math.hypot(bx - ax, bz - az);
    if (runLength < 1e-3) {
      return;
    }
    const ux = (bx - ax) / runLength;
    const uz = (bz - az) / runLength;
    const quad = (
      x0: number,
      y0: number,
      z0: number,
      x1v: number,
      y1v: number,
      z1v: number,
      x2: number,
      y2: number,
      z2: number,
      x3: number,
      y3: number,
      z3: number,
    ): void => {
      for (const [px, py, pz] of [
        [x0, y0, z0],
        [x1v, y1v, z1v],
        [x2, y2, z2],
        [x0, y0, z0],
        [x2, y2, z2],
        [x3, y3, z3],
      ] as const) {
        positions.push(px, py, pz);
        colors.push(paint.r, paint.g, paint.b);
      }
    };
    // Promenade balustrade: slim drawn posts on the embankment edge with
    // a continuous top rail, so the quay is walkable instead of a bare
    // drop into the Spree.
    paint.setHex(0xada89a);
    const railTop = top + RAIL_HEIGHT_M;
    quad(
      ax,
      railTop,
      az,
      bx,
      railTop,
      bz,
      bx,
      railTop - RAIL_BAR_M,
      bz,
      ax,
      railTop - RAIL_BAR_M,
      az,
    );
    const postCount = Math.max(1, Math.round(runLength / RAIL_POST_SPACING_M));
    for (let index = 0; index <= postCount; index += 1) {
      const t = (index / postCount) * runLength;
      const sx = ax + ux * t;
      const sz = az + uz * t;
      const ex = sx + ux * RAIL_POST_W_M;
      const ez = sz + uz * RAIL_POST_W_M;
      quad(sx, top, sz, ex, top, ez, ex, railTop, ez, sx, railTop, sz);
    }
    // A drawn flight of steps down to the water wherever the embankment
    // runs long enough to carry one ("Treppen ans Wasser").
    if (runLength >= STAIR_MIN_RUN_M) {
      paint.setHex(0xd8d1bf);
      const mid = runLength / 2 - STAIR_WIDTH_M / 2;
      // ~0.42 m risers over the full drop, so a 5 m embankment gets a
      // real flight instead of five giant blocks.
      const steps = Math.max(5, Math.round((top - waterTop) / 0.42));
      for (let step = 0; step < steps; step += 1) {
        const y = top - ((top - waterTop) * (step + 1)) / steps;
        const outset = ((step + 1) / steps) * jut;
        const sx = ax + ux * mid;
        const sz = az + uz * mid;
        const ex = sx + ux * STAIR_WIDTH_M;
        const ez = sz + uz * STAIR_WIDTH_M;
        quad(
          sx + towardWaterX * outset,
          y,
          sz + towardWaterZ * outset,
          ex + towardWaterX * outset,
          y,
          ez + towardWaterZ * outset,
          ex + towardWaterX * (outset - jut / steps),
          y,
          ez + towardWaterZ * (outset - jut / steps),
          sx + towardWaterX * (outset - jut / steps),
          y,
          sz + towardWaterZ * (outset - jut / steps),
        );
      }
    }
  };
  // Merge consecutive boundary cells into RUNS before building, so the
  // quay reads as a continuous embankment line instead of a per-cell
  // staircase ("nicht ausgefranst und zackig, sondern normal").
  const isLand = (x: number, z: number): boolean =>
    x >= 0 &&
    z >= 0 &&
    x < cols &&
    z < rows &&
    landClasses.has(classGrid[z * cols + x]);
  const isWater = (x: number, z: number): boolean =>
    x >= 0 &&
    z >= 0 &&
    x < cols &&
    z < rows &&
    classGrid[z * cols + x] === waterClass;
  // Vertical faces (water east/west of land): merge along z.
  for (const dir of [1, -1] as const) {
    for (let x = 0; x < cols; x += 1) {
      let z = 0;
      while (z < rows) {
        if (!(isLand(x, z) && isWater(x + dir, z))) {
          z += 1;
          continue;
        }
        const start = z;
        while (z < rows && isLand(x, z) && isWater(x + dir, z)) {
          z += 1;
        }
        const edgeX = dir === 1 ? x + 1 : x;
        wall(edgeX, start, edgeX, z, x, start, dir, 0);
      }
    }
  }
  // Horizontal faces (water north/south of land): merge along x.
  for (const dir of [1, -1] as const) {
    for (let z = 0; z < rows; z += 1) {
      let x = 0;
      while (x < cols) {
        if (!(isLand(x, z) && isWater(x, z + dir))) {
          x += 1;
          continue;
        }
        const start = x;
        while (x < cols && isLand(x, z) && isWater(x, z + dir)) {
          x += 1;
        }
        const edgeZ = dir === 1 ? z + 1 : z;
        wall(start, edgeZ, x, edgeZ, start, z, 0, dir);
      }
    }
  }
  if (positions.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const quayDay = new MeshBasicMaterial({
    side: DoubleSide,
    vertexColors: true,
  });
  const quayNight = new MeshStandardMaterial({
    flatShading: true,
    metalness: 0,
    roughness: 0.95,
    side: DoubleSide,
    vertexColors: true,
  });
  const mesh = new Mesh(geometry, quayDay);
  mesh.userData.dayMaterial = quayDay;
  mesh.userData.nightMaterial = quayNight;
  mesh.name = "drawn quay walls";
  const group = new Group();
  group.name = "Spree embankment";
  group.add(mesh);
  const inkGeometry = new BufferGeometry();
  inkGeometry.setAttribute("position", new Float32BufferAttribute(inkLines, 3));
  const ink = new LineSegments(
    inkGeometry,
    markArchitecturalInk(new LineBasicMaterial(), "silhouette"),
  );
  ink.name = "quay ink lines";
  ink.renderOrder = 2;
  group.add(ink);
  return group;
}

/** N-gon prism (top fan + side quads) for round drawn structures. */
function prismTriangles(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  height: number,
  segments: number,
  rotationRad = 0,
): Float32Array {
  const triangles: number[] = [];
  const top = cy + height / 2;
  const bottom = cy - height / 2;
  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2 + rotationRad;
    const a1 = ((index + 1) / segments) * Math.PI * 2 + rotationRad;
    const x0 = cx + Math.cos(a0) * radius;
    const z0 = cz + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const z1 = cz + Math.sin(a1) * radius;
    triangles.push(cx, top, cz, x1, top, z1, x0, top, z0);
    triangles.push(x0, bottom, z0, x1, bottom, z1, x1, top, z1);
    triangles.push(x0, bottom, z0, x1, top, z1, x0, top, z0);
  }
  return new Float32Array(triangles);
}

/**
 * The western Großer Tiergarten, EXTRAPOLATED (owner-approved): the
 * shipped open data ends at the bounds polygon, but the park factually
 * continues west to the Großer Stern. This group extends the lawn, the
 * Straße des 17. Juni axis and a drawn Siegessäule (67 m column, gilded
 * Viktoria, published dimensions) so the west horizon stops being a
 * void. No buildings are invented — parkland and one documented
 * monument only. Marked via userData.extrapolated.
 */
/**
 * Bridge railings: wherever a bridge deck cell borders water, a slim
 * drawn parapet rises from the deck edge — the Gustav-Heinemann-Brücke
 * and its siblings stop being flat strips ironed over the Spree.
 */
/**
 * Real bridge structures ("müssen durch die Luft gehen"): the surveyed
 * bridge cells are clustered into individual bridges (Moltkebrücke,
 * Gustav-Heinemann-Brücke, Hugo-Preuß-Brücke …), each one fitted to an
 * oriented rectangle. Every bridge then gets drawn abutments at the
 * banks, stone piers standing in the riverbed, segmental arch webs
 * spanning between them and an elevated deck plate — so the bridge
 * carries itself through the air instead of being painted onto the
 * water. Positions and extents come from the ground grid; the drawing
 * is ours.
 */
function bridgeClusters(ground: VoxelPayload): Array<Array<[number, number]>> {
  const { cols, rows } = ground.grid;
  const bridgeClass = ground.classes.indexOf("bridge");
  if (bridgeClass < 0) {
    return [];
  }
  const grid = new Int16Array(cols * rows).fill(-1);
  ground.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      for (let step = 0; step < run; step += 1) {
        const x = xStart + step;
        if (x >= 0 && x < cols && zOffset < rows) {
          grid[zOffset * cols + x] = classId;
        }
      }
    }
  });
  const seen = new Uint8Array(cols * rows);
  const clusters: Array<Array<[number, number]>> = [];
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = z * cols + x;
      if (grid[index] !== bridgeClass || seen[index]) {
        continue;
      }
      const stack: Array<[number, number]> = [[x, z]];
      seen[index] = 1;
      const cluster: Array<[number, number]> = [];
      while (stack.length > 0) {
        const [cx, cz] = stack.pop() as [number, number];
        cluster.push([cx, cz]);
        // Radius 2: one carriageway interrupted by water cells must
        // still form a SINGLE bridge, otherwise each fragment builds
        // its own short deck and the span reads as zigzag steps.
        for (let dz = -2; dz <= 2; dz += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) {
              continue;
            }
            const nIndex = nz * cols + nx;
            if (grid[nIndex] === bridgeClass && !seen[nIndex]) {
              seen[nIndex] = 1;
              stack.push([nx, nz]);
            }
          }
        }
      }
      clusters.push(cluster);
    }
  }
  return clusters;
}

// A one-cell cluster can be a real narrow Tiergarten footbridge over a
// four-metre ditch. Cell CORNERS (below) provide a measurable rectangle even
// for that case, so no source bridge needs to be discarded by an area guess.
export const BRIDGE_MIN_CLUSTER_CELLS = 1;

export type BridgeKind =
  | "adler"
  | "beam"
  | "curvedBox"
  | "golda"
  | "ironArch"
  | "openFrame"
  | "parliament"
  | "slender"
  | "steelArch"
  | "stoneArch"
  | "suspension"
  | "vierendeel";

export type BridgePalette = {
  abutment: number;
  deck: number;
  metal: number;
  structure: number;
};

export type BridgeProfile = {
  /** Surveyed centreline direction, used where a coarse cluster skews it. */
  axis?: [number, number];
  /** Signed plan sagitta at mid-span; zero keeps a straight centreline. */
  curveSagittaM?: number;
  /** Deck half-width where the 4 m ground grid under-reports it. */
  halfWidthM: number;
  kind: BridgeKind;
  matchRadiusM: number;
  name: string;
  palette?: BridgePalette;
  /**
   * Deck extent where an official survey fixes it more precisely than the
   * 4 m ground grid, which clips a narrow deck at both ends.
   */
  surveyedDeck?: { halfLengthM: number; halfWidthM: number };
  /** Surveyed crossing centre in world metres. */
  world: [number, number];
};

/**
 * The Spree crossings are not interchangeable. OSM and the landmark
 * anchors put each one at a known place, so each surveyed bridge cluster
 * is matched to its real construction instead of every bridge getting
 * the same generic deck.
 */
export const BRIDGE_PROFILES: readonly BridgeProfile[] = [
  {
    // 1886–91, Otto Stahn: red sandstone, three segmental arches on
    // massive cutwater piers, balustrade with sculpted pedestals.
    // OSM centreline 389358.897/5820303.439 → 389292.703/5820367.718.
    // Pinning it prevents the 4 m bridge raster from rotating this broad
    // diagonal road crossing into a disconnected east-west slab.
    axis: [-0.7174, -0.6967],
    halfWidthM: 11.5,
    kind: "stoneArch",
    matchRadiusM: 80,
    name: "Moltkebrücke",
    palette: {
      // Landesdenkmalamt Berlin: red Main sandstone facing, bronze lamps
      // and sculpture on a warmer roadway slab.
      abutment: 0x8a4f45,
      deck: 0xc6a58f,
      metal: 0x725d48,
      structure: 0xb86c5a,
    },
    // Berlin's 2025 bridge inventory (BW 3446148) records the historic
    // Spree crossing at 77.58 x 25.70 m. Pinning both dimensions prevents
    // the coarse 4 m raster from turning the masonry road bridge into a
    // narrow ladder-like crossing.
    surveyedDeck: { halfLengthM: 38.79, halfWidthM: 12.85 },
    world: [-174.5, -336.5],
  },
  {
    // Max Dudler / Grassl, 2005: an olive-green Vierendeel steel girder
    // around a riveted timber deck. The 66 m clear central span rests on
    // two rectangular concrete blades near the banks. Berlin's bridge
    // inventory gives 87.76 x 4.00 m; the old model was a generic ivory
    // footbridge with round piers and therefore missed its whole identity.
    axis: [-0.018, 0.99984],
    halfWidthM: 2,
    kind: "vierendeel",
    matchRadiusM: 80,
    name: "Gustav-Heinemann-Brücke",
    palette: {
      abutment: 0xb8b6ae,
      deck: 0x715b45,
      metal: 0x315246,
      structure: 0x547766,
    },
    surveyedDeck: { halfLengthM: 43.88, halfWidthM: 2 },
    world: [-36.9, -445.17],
  },
  {
    // Oswald Mathias Ungers / Grassl, 2005. Official inventory dimensions:
    // 88.41 x 23.56 m. The one-field orthotropic steel box is curved in
    // plan (roughly 321-345 m radius), with a 3.3-4.1 m deep dark soffit,
    // pale framed fascias and limestone-clad abutments. OSM supplies the
    // surveyed centreline and its 2.98 m northward sagitta.
    axis: [0.99998, 0.00702],
    curveSagittaM: -2.98,
    halfWidthM: 11.78,
    kind: "curvedBox",
    matchRadiusM: 80,
    name: "Hugo-Preuß-Brücke",
    palette: {
      abutment: 0xc9c0ae,
      deck: 0xbfc1bc,
      metal: 0x444b4e,
      structure: 0x9ca4a4,
    },
    surveyedDeck: { halfLengthM: 44.205, halfWidthM: 11.78 },
    world: [57.3, -514.73],
  },
  {
    // Santiago Calatrava, 1996: surveyed OSM outline 74.98 x 23.58 m.
    // A 12.5 m carriageway is stepped up to cycle tracks and then again to
    // the outer footways. Berlin's 44 m main opening sits between two
    // prow-shaped intermediate piers; 15.5 m side fields close the span.
    axis: [0.87895, -0.47692],
    halfWidthM: 11.7915,
    kind: "steelArch",
    matchRadiusM: 80,
    name: "Kronprinzenbrücke",
    palette: {
      abutment: 0xb8b8b0,
      deck: 0xd4d2ca,
      metal: 0x7a8789,
      structure: 0xe2dfd5,
    },
    surveyedDeck: { halfLengthM: 37.492, halfWidthM: 11.7915 },
    world: [303.519, -323.32],
  },
  {
    // Otto Stahn, 1895–97: three-opening iron arch bridge with two narrow
    // granite-clad piers and its characteristic forged Prussian eagles.
    // Berlin's current 06/2025 inventory controls the 69.48 x 25.17 m deck;
    // exact OSM way 6228081 controls the centre and north-south bearing.
    axis: [...WEIDENDAMMER_BRIDGE_PROFILE.axis],
    halfWidthM: WEIDENDAMMER_BRIDGE_PROFILE.inventory.widthM / 2,
    kind: "ironArch",
    matchRadiusM: 82,
    name: WEIDENDAMMER_BRIDGE_PROFILE.name,
    palette: {
      abutment: 0x817c73,
      deck: 0xa7a49d,
      metal: 0x2f3637,
      structure: 0xb8b4aa,
    },
    surveyedDeck: {
      halfLengthM: WEIDENDAMMER_BRIDGE_PROFILE.inventory.lengthM / 2,
      halfWidthM: WEIDENDAMMER_BRIDGE_PROFILE.inventory.widthM / 2,
    },
    world: [...WEIDENDAMMER_BRIDGE_PROFILE.centreWorldM],
  },
  {
    // Deutscher Bundestag: the "Sprung über die Spree" is a two-storey
    // internal footbridge between Paul-Löbe-Haus and
    // Marie-Elisabeth-Lüders-Haus. The lower level is publicly accessible.
    axis: [1, 0],
    halfWidthM: 5.5,
    kind: "parliament",
    matchRadiusM: 60,
    name: "Sprung über die Spree",
    world: [342, -186],
  },
  {
    // Official Berlin dimensions: 76.86 m overall, 4.00 m clear width,
    // 58.70 m pier-free clear span. The gold-lacquered U-girder rises in
    // a shallow arch and carries laser-cut perforated side plates.
    // Pin the OSM centreline: the 4 m raster otherwise overweights its broad
    // approach cells and makes the 76.86 m yellow span visibly skewed.
    axis: [0.85749, -0.5145],
    halfWidthM: 2,
    kind: "golda",
    matchRadiusM: 48,
    name: "Golda-Meir-Steg",
    palette: {
      abutment: 0x3b3d3b,
      deck: 0xe9e2d2,
      metal: 0xffca20,
      structure: 0xf2b600,
    },
    surveyedDeck: { halfLengthM: 38.43, halfWidthM: 2 },
    world: [-170.5, -1647.1],
  },
  {
    // Berlin bridge inventory BW 3446035: open frame, built 1994,
    // 32.60 x 28.80 m. OSM ways 36260393 and 248010193 independently pin
    // the two carriageways; their averaged eastbound bearings replace the
    // old nearly perpendicular hand-tuned axis.
    axis: [...SANDKRUG_OSM_DECK.axis],
    halfWidthM: 14.4,
    kind: "openFrame",
    matchRadiusM: 60,
    name: "Sandkrugbrücke",
    palette: {
      abutment: 0xa6a8a5,
      deck: 0xd0d1cb,
      metal: 0xb9bfbd,
      structure: 0xb3b6b3,
    },
    surveyedDeck: { halfLengthM: 16.3, halfWidthM: 14.4 },
    world: [...SANDKRUG_OSM_DECK.centreWorldM],
  },
  {
    // Masterplan Bruecken Berlin, Appendix 1 (data status 06/2025),
    // BW 3446098: 7.30 x 3.35 m steel/light-metal plate-girder/grid bridge,
    // built 1873. OSM way 28872983 supplies the crossing bearing;
    // createAdlerBridge supplies the two central iron eagle reliefs, wavy
    // railings, yellow brick piers and shallow steel soffit.
    axis: [...ADLER_BRIDGE_PROFILE.axis],
    halfWidthM: ADLER_BRIDGE_PROFILE.inventory.widthM / 2,
    kind: "adler",
    matchRadiusM: 16,
    name: ADLER_BRIDGE_PROFILE.name,
    surveyedDeck: {
      halfLengthM: ADLER_BRIDGE_PROFILE.inventory.lengthM / 2,
      halfWidthM: ADLER_BRIDGE_PROFILE.inventory.widthM / 2,
    },
    world: [...ADLER_BRIDGE_PROFILE.centreWorldM],
  },
  {
    // Berlin's oldest suspension bridge: Masterplan Bruecken Berlin,
    // Appendix 1 (data status 06/2025), publishes an 18.30 x 1.88 m timber
    // envelope. OSM way 1411957328 fixes its centre and bearing;
    // createLoewenBridge supplies the four historic lions, timber lattice,
    // hangers and paired wire ropes.
    axis: [...LOEWEN_BRIDGE_PROFILE.axis],
    halfWidthM: LOEWEN_BRIDGE_PROFILE.surveyedDeck.halfWidthM,
    kind: "suspension",
    matchRadiusM: 18,
    name: LOEWEN_BRIDGE_PROFILE.name,
    surveyedDeck: { ...LOEWEN_BRIDGE_PROFILE.surveyedDeck },
    world: [...LOEWEN_BRIDGE_PROFILE.world],
  },
];

export function bridgeProfileAt(x: number, z: number): BridgeProfile | null {
  let best: BridgeProfile | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const profile of BRIDGE_PROFILES) {
    const distance = Math.hypot(x - profile.world[0], z - profile.world[1]);
    if (distance <= profile.matchRadiusM && distance < bestDistance) {
      best = profile;
      bestDistance = distance;
    }
  }
  return best;
}

// Minimum headroom under a Spree crossing. The shipping profile of the
// Spree in the government quarter is ~4.4 m, so the carriageway always
// clears the water even where the surveyed banks are low.
export const BRIDGE_MIN_CLEARANCE_M = 5.4;
export const GOLDA_PERFORATION_BAYS = 39;
export const KRONPRINZEN_SPAN_LAYOUT_M = [15.492, 44, 15.492] as const;
export const MOLTKE_ARCH_COUNT = 3;
export const MOLTKE_BALUSTRADE_BAY_COUNT = 12;
export const MOLTKE_BALUSTERS_PER_OPEN_BAY = 7;
export const MOLTKE_CANDELABRA_COUNT = 8;
export const MOLTKE_CANDELABRA_FIGURE_COUNT = 24;
export const MOLTKE_GRIFFIN_COUNT = 4;
export const MOLTKE_KEYSTONE_HEAD_COUNT = 6;
export const MOLTKE_TROPHY_COUNT = 4;
export const PARLIAMENT_BRIDGE_LEVELS = 2;

function usesDedicatedBridgeRecognitionModel(kind: BridgeKind): boolean {
  return kind === "adler" || kind === "suspension" || kind === "parliament";
}

/**
 * The current Weidendammer detail root exclusively owns its railing, eight
 * lamp standards and paired centre eagles. The raster bridge builder retains
 * only the measured deck, three arches and two piers there. Future iron-arch
 * profiles keep the established generic ornament unless they opt out by name.
 */
export function usesGenericBridgeDeckOrnament(
  profile: BridgeProfile | null,
): boolean {
  return profile?.name !== WEIDENDAMMER_BRIDGE_PROFILE.name;
}

function createBridgeStructures(
  ground: VoxelPayload,
  detailProfile: WeidendammerBridgeDetailProfile,
): Group | null {
  const clusters = bridgeClusters(ground).filter(
    (cluster) => cluster.length >= BRIDGE_MIN_CLUSTER_CELLS,
  );
  if (clusters.length === 0) {
    return null;
  }
  const cell = ground.cell_m;
  const { min_x_idx, min_z_idx } = ground.grid;
  const sample = groundTopSampler(ground);
  const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
  const BED_Y = waterTop - 2.45;
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const lampParts: BufferGeometry[] = [];
  const moltkeDetailParts: BufferGeometry[] = [];
  const moltkeDetailEdges: BufferGeometry[] = [];
  const moltkeDetailLampParts: BufferGeometry[] = [];
  let weidendammerBaseRendered = false;
  const DEFAULT_PALETTE: BridgePalette = {
    abutment: 0xcdc7b7,
    deck: 0xc4c5bd,
    metal: 0xb9bcbb,
    structure: 0xdedacd,
  };
  const addPart = (
    triangles: Float32Array,
    tone: Color,
    inked = true,
  ): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    if (inked) {
      edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
    }
  };
  const addLamp = (triangles: Float32Array, tone: Color): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    lampParts.push(geometry);
  };
  const addMoltkeDetail = (
    triangles: Float32Array,
    tone: Color,
    inked = true,
  ): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    moltkeDetailParts.push(geometry);
    if (inked) {
      moltkeDetailEdges.push(
        new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
    }
  };
  const addMoltkeDetailGeometry = (
    source: BufferGeometry,
    tone: Color,
    inked = true,
  ): void => {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    // This renderer is deliberately texture-free. Primitive geometries such
    // as the griffin's faceted body bring UVs by default; stripping them keeps
    // their attribute contract compatible with the hand-built bridge meshes.
    geometry.deleteAttribute("uv");
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    moltkeDetailParts.push(geometry);
    if (inked) {
      moltkeDetailEdges.push(
        new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
    }
    source.dispose();
  };
  const addMoltkeDetailLamp = (triangles: Float32Array, tone: Color): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    moltkeDetailLampParts.push(geometry);
  };
  for (const cluster of clusters) {
    // Fit the complete occupied cell envelope, not only cell centres. Besides
    // measuring the deck's full raster width, this gives one- and two-cell
    // stegs a real rectangle instead of an under-determined line that vanishes.
    const points = cluster.flatMap(([x, z]) => {
      const x0 = (min_x_idx + x) * cell;
      const z0 = (min_z_idx + z) * cell;
      return [
        [x0, z0],
        [x0 + cell, z0],
        [x0 + cell, z0 + cell],
        [x0, z0 + cell],
      ] as Array<[number, number]>;
    });
    const rect = fitRectangle(points);
    if (!rect) {
      continue;
    }
    const profile = bridgeProfileAt(rect.center[0], rect.center[1]);
    const [cx, cz] = profile?.surveyedDeck ? profile.world : rect.center;
    const kind: BridgeKind = profile?.kind ?? "beam";
    if (profile?.name === WEIDENDAMMER_BRIDGE_PROFILE.name) {
      weidendammerBaseRendered = true;
    }
    // Dedicated recognition models replace these coarse raster clusters.
    // Drawing a generic bridge as well would leave a grey slab under the
    // timber Löwenbrücke or duplicate the open Bundestag connection.
    if (usesDedicatedBridgeRecognitionModel(kind)) {
      continue;
    }
    const palette = profile?.palette ?? DEFAULT_PALETTE;
    const STONE = new Color(palette.structure);
    const STONE_DARK = new Color(palette.abutment);
    const DECK = new Color(palette.deck);
    const STEEL = new Color(palette.metal);
    const GOLD_SLOT = new Color(0x8d6509);
    const WARM_LIGHT = new Color(0xffd77b);
    const ROAD_SURFACE = new Color(0x77746f);
    const STONE_PAVING = new Color(0xd7b7a4);
    const ROAD_MARKING = new Color(0xe9e4d8);
    const TIMBER_LIGHT = new Color(0x80694f);
    const TIMBER_DARK = new Color(0x68523d);
    const GALVANISED = new Color(0xc9ceca);
    const HUGO_ASPHALT = new Color(0x626565);
    const HUGO_PAVING = new Color(0xb9b8b1);
    const HUGO_RECESS = new Color(0x697174);
    const DECK_JOINT = new Color(0x696762);
    const BEARING = new Color(0x4f5554);
    const PARLIAMENT_GLASS = new Color(0x9eb9bc);
    const MOLTKE_RELIEF = new Color(0x9b594c);
    const parliamentUpperDeckM = 4.2 * (PARLIAMENT_BRIDGE_LEVELS - 1);
    // The occupied cell envelope now carries the full generic dimensions.
    // Named profiles still replace both values with published survey figures.
    const halfLength =
      profile?.surveyedDeck?.halfLengthM ?? Math.max(rect.halfLength, cell / 2);
    const halfWidth =
      profile?.surveyedDeck?.halfWidthM ??
      Math.max(rect.halfWidth, profile?.halfWidthM ?? cell / 2);
    const genericSmall = profile === null && halfLength <= 20 && halfWidth <= 6;
    // Major river crossings preserve shipping clearance. Small park stegs sit
    // just above their sampled local banks instead of floating 5.4 m over a
    // shallow Tiergarten ditch.
    let sampledDeckY = Number.NEGATIVE_INFINITY;
    for (const [x, z] of cluster) {
      sampledDeckY = Math.max(sampledDeckY, sample(x, z) + 0.55);
    }
    let deckY = genericSmall
      ? sampledDeckY
      : waterTop +
        (kind === "golda"
          ? BRIDGE_MIN_CLEARANCE_M + 0.9
          : BRIDGE_MIN_CLEARANCE_M);
    deckY = Math.max(deckY, sampledDeckY);
    const bedY = genericSmall ? deckY - 2.2 : BED_Y;
    const rawAxis = profile?.axis ?? rect.axis;
    const axisLength = Math.hypot(rawAxis[0], rawAxis[1]) || 1;
    const ax = rawAxis[0] / axisLength;
    const az = rawAxis[1] / axisLength;
    const nx = -az;
    const nz = ax;
    const curveSagitta = profile?.curveSagittaM ?? 0;
    const curveOffsetAt = (u: number): number =>
      curveSagitta * Math.max(0, 1 - (u / halfLength) ** 2);
    const tangentAt = (u: number): [number, number] => {
      const derivative = (-2 * curveSagitta * u) / halfLength ** 2;
      const tx = ax + nx * derivative;
      const tz = az + nz * derivative;
      const length = Math.hypot(tx, tz) || 1;
      return [tx / length, tz / length];
    };
    const at = (u: number, v: number): [number, number] => {
      const centreX = cx + ax * u + nx * curveOffsetAt(u);
      const centreZ = cz + az * u + nz * curveOffsetAt(u);
      const [tx, tz] = tangentAt(u);
      return [centreX - tz * v, centreZ + tx * v];
    };
    // Every crossing rises slightly toward mid-span: the drawn camber is
    // what makes a bridge read as going OVER something.
    const camber = genericSmall
      ? 0.18
      : kind === "stoneArch"
        ? 0.42
        : kind === "ironArch"
          ? 0.34
          : kind === "steelArch"
            ? 1.2
            : kind === "golda"
              ? 0.82
              : kind === "curvedBox"
                ? 1.05
                : kind === "vierendeel"
                  ? 0.16
                  : kind === "parliament" || kind === "openFrame"
                    ? 0.12
                    : kind === "slender"
                      ? 0.9
                      : 0.5;
    const riseAt = (u: number): number =>
      camber * Math.cos((u / halfLength) * (Math.PI / 2)) ** 2;
    const deckThickness = genericSmall
      ? 0.28
      : kind === "golda"
        ? 0.22
        : kind === "vierendeel"
          ? 0.24
          : kind === "parliament"
            ? 0.32
            : kind === "openFrame"
              ? 0.55
              : kind === "ironArch"
                ? 0.52
                : kind === "curvedBox"
                  ? 0.28
                  : kind === "slender"
                    ? 0.5
                    : 0.7;
    const DECK_SEGMENTS = genericSmall
      ? Math.max(2, Math.min(8, Math.ceil((halfLength * 2) / cell)))
      : kind === "vierendeel"
        ? 40
        : kind === "parliament"
          ? 22
          : kind === "ironArch"
            ? 30
            : kind === "curvedBox"
              ? 32
              : kind === "golda"
                ? 28
                : kind === "openFrame"
                  ? 16
                  : 14;
    const segmentLength = (halfLength * 2) / DECK_SEGMENTS;
    for (let index = 0; index < DECK_SEGMENTS; index += 1) {
      const u = -halfLength + segmentLength * (index + 0.5);
      const y = deckY + riseAt(u);
      const [sx, sz] = at(u, 0);
      const localAxis = tangentAt(u);
      const deckTone =
        kind === "vierendeel"
          ? index % 2 === 0
            ? TIMBER_LIGHT
            : TIMBER_DARK
          : DECK;
      addPart(
        boxTriangles(
          sx,
          y - deckThickness / 2,
          sz,
          localAxis,
          segmentLength + 0.05,
          deckThickness,
          halfWidth * 2,
        ),
        deckTone,
        index === 0 || index === DECK_SEGMENTS - 1,
      );
      if (kind === "stoneArch") {
        // Moltkebrücke is red sandstone architecture carrying an ordinary
        // roadway, not a 25.7 m-wide red slab. Draw the asphalt carriageway
        // and separate sandstone pavements over the surveyed masonry deck.
        addPart(
          boxTriangles(
            sx,
            y + 0.035,
            sz,
            localAxis,
            segmentLength + 0.04,
            0.07,
            13.2,
          ),
          ROAD_SURFACE,
          false,
        );
        for (const side of [-1, 1]) {
          const [walkX, walkZ] = at(u, side * (halfWidth - 2.25));
          addPart(
            boxTriangles(
              walkX,
              y + 0.045,
              walkZ,
              localAxis,
              segmentLength + 0.04,
              0.09,
              4.0,
            ),
            STONE_PAVING,
            false,
          );
        }
        if (index % 2 === 0) {
          addPart(
            boxTriangles(
              sx,
              y + 0.078,
              sz,
              localAxis,
              Math.min(2.4, segmentLength * 0.58),
              0.025,
              0.14,
            ),
            ROAD_MARKING,
            false,
          );
        }
      } else if (kind === "curvedBox") {
        // Hugo-Preuß: broad road deck on one deep orthotropic steel box.
        // The road, cycle margins and pavements stay separate flat tones,
        // while the 3.3-4.1 m haunched box remains visible from the water.
        addPart(
          boxTriangles(
            sx,
            y + 0.035,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.07,
            8.5,
          ),
          HUGO_ASPHALT,
          false,
        );
        for (const side of [-1, 1]) {
          const [cycleX, cycleZ] = at(u, side * 5.4);
          addPart(
            boxTriangles(
              cycleX,
              y + 0.045,
              cycleZ,
              localAxis,
              segmentLength + 0.05,
              0.09,
              2.2,
            ),
            ROAD_SURFACE,
            false,
          );
          const [walkX, walkZ] = at(u, side * 9.05);
          addPart(
            boxTriangles(
              walkX,
              y + 0.05,
              walkZ,
              localAxis,
              segmentLength + 0.05,
              0.1,
              4.55,
            ),
            HUGO_PAVING,
            false,
          );
        }
        if (index % 3 === 1) {
          addPart(
            boxTriangles(
              sx,
              y + 0.08,
              sz,
              localAxis,
              segmentLength * 0.48,
              0.025,
              0.13,
            ),
            ROAD_MARKING,
            false,
          );
        }
        const boxDepth = 3.3 + 0.8 * Math.abs(u / halfLength) ** 1.35;
        addPart(
          boxTriangles(
            sx,
            y - deckThickness - boxDepth / 2,
            sz,
            localAxis,
            segmentLength + 0.08,
            boxDepth,
            15.2,
          ),
          STEEL,
          false,
        );
        for (const side of [-1, 1]) {
          const [fasciaX, fasciaZ] = at(u, side * (halfWidth - 0.24));
          addPart(
            boxTriangles(
              fasciaX,
              y - 0.58,
              fasciaZ,
              localAxis,
              segmentLength - 0.18,
              0.88,
              0.14,
            ),
            HUGO_RECESS,
            false,
          );
          for (const [level, height] of [
            [-0.08, 0.2],
            [-1.08, 0.18],
          ] as const) {
            addPart(
              boxTriangles(
                fasciaX,
                y + level,
                fasciaZ,
                localAxis,
                segmentLength + 0.06,
                height,
                0.34,
              ),
              STONE,
              false,
            );
          }
        }
      } else if (kind === "steelArch") {
        // Calatrava's deck section steps outward from traffic to cycle lanes
        // and then to the raised pedestrian paths on both edges.
        addPart(
          boxTriangles(
            sx,
            y + 0.035,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.07,
            12.5,
          ),
          ROAD_SURFACE,
          false,
        );
        for (const side of [-1, 1]) {
          const [cycleX, cycleZ] = at(u, side * 7.25);
          addPart(
            boxTriangles(
              cycleX,
              y + 0.095,
              cycleZ,
              localAxis,
              segmentLength + 0.05,
              0.12,
              2.0,
            ),
            HUGO_PAVING,
            false,
          );
          const [walkX, walkZ] = at(u, side * 9.9);
          addPart(
            boxTriangles(
              walkX,
              y + 0.17,
              walkZ,
              localAxis,
              segmentLength + 0.05,
              0.16,
              3.1,
            ),
            STONE,
            false,
          );
        }
      } else if (kind === "ironArch") {
        // Weidendammer Brücke keeps the carriageway and the broad stone
        // pavements visually separate above the dark iron arches.
        addPart(
          boxTriangles(
            sx,
            y + 0.035,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.07,
            13.0,
          ),
          ROAD_SURFACE,
          false,
        );
        for (const side of [-1, 1]) {
          const [walkX, walkZ] = at(u, side * 8.8);
          addPart(
            boxTriangles(
              walkX,
              y + 0.075,
              walkZ,
              localAxis,
              segmentLength + 0.05,
              0.11,
              4.0,
            ),
            HUGO_PAVING,
            false,
          );
        }
      } else if (kind === "beam" && halfWidth >= 6.5) {
        // Broad source-derived beam clusters are road bridges. Preserve the
        // measured outer envelope while separating carriageway and footways;
        // narrow rail and park crossings deliberately stay neutral.
        const roadWidth = halfWidth * 2 - 4.4;
        addPart(
          boxTriangles(
            sx,
            y + 0.035,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.07,
            roadWidth,
          ),
          ROAD_SURFACE,
          false,
        );
        for (const side of [-1, 1]) {
          const [walkX, walkZ] = at(u, side * (halfWidth - 1.1));
          addPart(
            boxTriangles(
              walkX,
              y + 0.065,
              walkZ,
              localAxis,
              segmentLength + 0.05,
              0.11,
              1.8,
            ),
            HUGO_PAVING,
            false,
          );
        }
        if (index % 2 === 0) {
          addPart(
            boxTriangles(
              sx,
              y + 0.078,
              sz,
              localAxis,
              Math.min(2.4, segmentLength * 0.58),
              0.025,
              0.13,
            ),
            ROAD_MARKING,
            false,
          );
        }
      } else if (kind === "openFrame") {
        // Sandkrugbrücke: a broad Invalidenstraße road plate carried by an
        // open concrete frame. Keep the asphalt, pale footways and outer
        // fascia distinct instead of drawing one 28.8 m grey slab.
        addPart(
          boxTriangles(
            sx,
            y + 0.035,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.07,
            16.4,
          ),
          ROAD_SURFACE,
          false,
        );
        for (const side of [-1, 1]) {
          const [walkX, walkZ] = at(u, side * 10.85);
          addPart(
            boxTriangles(
              walkX,
              y + 0.07,
              walkZ,
              localAxis,
              segmentLength + 0.05,
              0.12,
              5.0,
            ),
            HUGO_PAVING,
            false,
          );
          const [fasciaX, fasciaZ] = at(u, side * (halfWidth - 0.25));
          addPart(
            boxTriangles(
              fasciaX,
              y - 0.45,
              fasciaZ,
              localAxis,
              segmentLength + 0.05,
              0.9,
              0.42,
            ),
            STONE,
            false,
          );
        }
        if (index % 2 === 0) {
          addPart(
            boxTriangles(
              sx,
              y + 0.078,
              sz,
              localAxis,
              Math.min(2.5, segmentLength * 0.58),
              0.025,
              0.14,
            ),
            ROAD_MARKING,
            false,
          );
        }
      } else if (kind === "parliament") {
        // The Bundestag describes this as a two-storey footbridge. The
        // lower public passage and upper internal passage share one precise
        // structural grid rather than being collapsed into a single slab.
        addPart(
          boxTriangles(
            sx,
            y + 0.04,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.08,
            halfWidth * 2 - 0.7,
          ),
          HUGO_PAVING,
          false,
        );
        addPart(
          boxTriangles(
            sx,
            y + parliamentUpperDeckM,
            sz,
            localAxis,
            segmentLength + 0.05,
            0.3,
            halfWidth * 2,
          ),
          DECK,
          index === 0 || index === DECK_SEGMENTS - 1,
        );
        for (const side of [-1, 1]) {
          const [frameX, frameZ] = at(u, side * halfWidth);
          for (const level of [
            0.2,
            parliamentUpperDeckM / 2 - 0.02,
            parliamentUpperDeckM + 0.15,
          ]) {
            addPart(
              boxTriangles(
                frameX,
                y + level,
                frameZ,
                localAxis,
                segmentLength + 0.05,
                Math.abs(level - parliamentUpperDeckM / 2) < 0.1 ? 0.12 : 0.2,
                0.18,
              ),
              Math.abs(level - parliamentUpperDeckM / 2) < 0.1
                ? PARLIAMENT_GLASS
                : STEEL,
              false,
            );
          }
        }
      } else if (kind === "vierendeel") {
        // The footbridge has riveted timber boards with narrow galvanised
        // service strips along the inside of its structural side girders.
        for (const side of [-1, 1]) {
          const [stripX, stripZ] = at(u, side * 1.56);
          addPart(
            boxTriangles(
              stripX,
              y + 0.025,
              stripZ,
              localAxis,
              segmentLength + 0.04,
              0.05,
              0.3,
            ),
            GALVANISED,
            false,
          );
        }
      }
      // Edge beam and parapet ride the same camber on both sides.
      for (const side of [-1, 1]) {
        const [bx, bz] = at(u, side * (halfWidth - 0.35));
        if (kind !== "curvedBox" && kind !== "vierendeel") {
          addPart(
            boxTriangles(
              bx,
              y - deckThickness - (kind === "golda" ? 0.18 : 0.3),
              bz,
              localAxis,
              segmentLength + 0.05,
              kind === "golda" ? 0.36 : 0.6,
              kind === "golda" ? 0.42 : 0.7,
            ),
            kind === "golda" ? STEEL : STONE_DARK,
            false,
          );
        }
        const [rx, rz] = at(u, side * halfWidth);
        if (kind === "golda") {
          // The bridge is a structural U-girder: its high golden sides,
          // not generic handrail posts, carry the span. A rounded top lip
          // and warm inner light repeat the supplied day/night references.
          addPart(
            boxTriangles(
              rx,
              y + 0.72,
              rz,
              localAxis,
              segmentLength + 0.06,
              1.48,
              0.17,
            ),
            STONE,
            false,
          );
          addPart(
            boxTriangles(
              rx,
              y + 1.49,
              rz,
              localAxis,
              segmentLength + 0.08,
              0.14,
              0.3,
            ),
            STEEL,
            false,
          );
          const [lx, lz] = at(u, side * (halfWidth - 0.18));
          addLamp(
            boxTriangles(
              lx,
              y + 1.27,
              lz,
              localAxis,
              segmentLength + 0.04,
              0.055,
              0.065,
            ),
            WARM_LIGHT,
          );
        } else if (kind === "stoneArch") {
          // Otto Stahn's open sandstone balustrade has a low plinth,
          // individual turned balusters and a broad coping. A continuous
          // 1.2 m wall made the bridge read as one blunt red block.
          addPart(
            boxTriangles(
              rx,
              y + 0.18,
              rz,
              localAxis,
              segmentLength + 0.05,
              0.36,
              0.38,
            ),
            STONE_DARK,
            false,
          );
          addPart(
            boxTriangles(
              rx,
              y + 1.01,
              rz,
              localAxis,
              segmentLength + 0.05,
              0.17,
              0.5,
            ),
            STONE,
            false,
          );
        } else if (kind !== "curvedBox" && kind !== "vierendeel") {
          addPart(
            boxTriangles(
              rx,
              y + 0.62,
              rz,
              localAxis,
              segmentLength + 0.05,
              0.14,
              0.14,
            ),
            STONE,
            false,
          );
        }
      }
    }
    if (
      (profile || (kind === "beam" && halfWidth >= 6.5)) &&
      kind !== "golda" &&
      kind !== "parliament"
    ) {
      // Every measured road bridge terminates with a narrow expansion joint.
      // One unoutlined strip per end is stable at overview scale and prevents
      // the deck from visually melting into the approach surface.
      for (const end of [-1, 1]) {
        const u = end * (halfLength - 0.28);
        const [jointX, jointZ] = at(u, 0);
        addPart(
          boxTriangles(
            jointX,
            deckY + riseAt(u) + 0.07,
            jointZ,
            tangentAt(u),
            0.2,
            0.035,
            halfWidth * 2 - 0.45,
          ),
          DECK_JOINT,
          false,
        );
      }
    }
    if (kind === "curvedBox" || kind === "steelArch" || kind === "openFrame") {
      // Four compact bearing pads make the transfer from deck to abutment
      // legible from below without adding thin, flicker-prone linework.
      for (const end of [-1, 1]) {
        const u = end * (halfLength - 1.05);
        const y = deckY + riseAt(u) - deckThickness - 0.16;
        for (const side of [-1, 1]) {
          const [bearingX, bearingZ] = at(u, side * halfWidth * 0.56);
          addPart(
            boxTriangles(bearingX, y, bearingZ, tangentAt(u), 0.72, 0.32, 0.82),
            BEARING,
            false,
          );
        }
      }
    }
    // Railing uprights: sandstone pedestals on the Moltkebrücke, slim
    // steel posts everywhere else.
    const postSpacing = kind === "stoneArch" ? 5.5 : genericSmall ? 3.2 : 2.6;
    const postCount = Math.max(2, Math.round((halfLength * 2) / postSpacing));
    if (kind === "golda") {
      const slotCount = GOLDA_PERFORATION_BAYS;
      for (let index = 1; index < slotCount; index += 1) {
        const u = -halfLength + (index / slotCount) * halfLength * 2;
        const y = deckY + riseAt(u);
        const centreFactor = 1 - Math.abs(u / halfLength);
        const slotHeight = 0.34 + centreFactor * 0.38;
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * (halfWidth + 0.091));
          addPart(
            boxTriangles(
              px,
              y + 0.74,
              pz,
              tangentAt(u),
              0.13,
              slotHeight,
              0.035,
            ),
            GOLD_SLOT,
            false,
          );
        }
      }
      for (const end of [-1, 1]) {
        const u = end * (halfLength - 0.22);
        const y = deckY + riseAt(u);
        for (const side of [-1, 1]) {
          const [capX, capZ] = at(u, side * halfWidth);
          addPart(
            boxTriangles(capX, y + 0.76, capZ, tangentAt(u), 0.44, 1.52, 0.38),
            STEEL,
            false,
          );
        }
      }
    } else if (kind === "vierendeel") {
      const bayCount = 20;
      const bayLength = (halfLength * 2) / bayCount;
      for (let index = 0; index <= bayCount; index += 1) {
        const u = -halfLength + (index / bayCount) * halfLength * 2;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          addPart(
            boxTriangles(px, y + 0.72, pz, localAxis, 0.26, 1.44, 0.24),
            STONE,
            false,
          );
          const [rivetX, rivetZ] = at(u, side * (halfWidth + 0.13));
          for (const level of [0.22, 0.72, 1.22]) {
            addPart(
              boxTriangles(
                rivetX,
                y + level,
                rivetZ,
                localAxis,
                0.11,
                0.11,
                0.05,
              ),
              GALVANISED,
              false,
            );
          }
        }
      }
      for (let index = 0; index < bayCount; index += 1) {
        const u = -halfLength + bayLength * (index + 0.5);
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          for (const [level, height, width] of [
            [0.12, 0.24, 0.26],
            [0.48, 0.07, 0.09],
            [0.76, 0.07, 0.09],
            [1.04, 0.07, 0.09],
            [1.4, 0.24, 0.28],
          ] as const) {
            addPart(
              boxTriangles(
                px,
                y + level,
                pz,
                localAxis,
                bayLength + 0.04,
                height,
                width,
              ),
              index % 2 === 0 ? STONE : STEEL,
              false,
            );
          }
          if (index % 2 === 0) {
            const [lampX, lampZ] = at(u, side * (halfWidth - 0.13));
            addLamp(
              boxTriangles(lampX, y + 1.22, lampZ, localAxis, 0.42, 0.11, 0.1),
              WARM_LIGHT,
            );
          }
        }
      }
    } else if (kind === "parliament") {
      const bayCount = 12;
      const bayLength = (halfLength * 2) / bayCount;
      for (let index = 0; index <= bayCount; index += 1) {
        const u = -halfLength + (index / bayCount) * halfLength * 2;
        const y = deckY + riseAt(u);
        for (const side of [-1, 1]) {
          const [postX, postZ] = at(u, side * halfWidth);
          addPart(
            boxTriangles(postX, y + 2.2, postZ, tangentAt(u), 0.2, 4.4, 0.2),
            STEEL,
            false,
          );
        }
      }
      for (let index = 0; index < bayCount; index += 1) {
        const u0 = -halfLength + index * bayLength + 0.12;
        const u1 = u0 + bayLength - 0.24;
        for (const side of [-1, 1]) {
          const [x0, z0] = at(u0, side * halfWidth);
          const [x1, z1] = at(u1, side * halfWidth);
          const lowY = deckY + riseAt(u0) + 0.32;
          const midY = deckY + riseAt(u1) + 2.0;
          const upperY = deckY + riseAt(u0) + parliamentUpperDeckM - 0.1;
          addPart(
            beamBetweenTriangles([x0, lowY, z0], [x1, midY, z1], 0.12),
            index % 2 === 0 ? PARLIAMENT_GLASS : STEEL,
            false,
          );
          addPart(
            beamBetweenTriangles([x1, midY + 0.2, z1], [x0, upperY, z0], 0.12),
            index % 2 === 0 ? PARLIAMENT_GLASS : STEEL,
            false,
          );
        }
      }
    } else if (kind === "curvedBox") {
      const picketCount = 60;
      const railLength = (halfLength * 2) / picketCount;
      for (let index = 0; index <= picketCount; index += 1) {
        const u = -halfLength + (index / picketCount) * halfLength * 2;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          addPart(
            boxTriangles(px, y + 0.54, pz, localAxis, 0.11, 1.08, 0.1),
            STONE,
            false,
          );
          if (index < picketCount) {
            const railU = u + railLength / 2;
            const railY = deckY + riseAt(railU);
            const [railX, railZ] = at(railU, side * halfWidth);
            addPart(
              boxTriangles(
                railX,
                railY + 1.08,
                railZ,
                tangentAt(railU),
                railLength + 0.04,
                0.12,
                0.14,
              ),
              STONE,
              false,
            );
          }
        }
      }
      for (let index = 0; index <= DECK_SEGMENTS; index += 1) {
        const u = -halfLength + (index / DECK_SEGMENTS) * halfLength * 2;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [ribX, ribZ] = at(u, side * (halfWidth - 0.24));
          addPart(
            boxTriangles(ribX, y - 0.58, ribZ, localAxis, 0.2, 1.2, 0.36),
            STONE,
            false,
          );
        }
      }
    } else if (
      kind === "steelArch" ||
      (kind === "ironArch" && usesGenericBridgeDeckOrnament(profile))
    ) {
      const picketCount = kind === "ironArch" ? 52 : 38;
      const railLength = (halfLength * 2) / picketCount;
      for (let index = 0; index <= picketCount; index += 1) {
        const u = -halfLength + (index / picketCount) * halfLength * 2;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          addPart(
            boxTriangles(
              px,
              y + (kind === "ironArch" ? 0.57 : 0.62),
              pz,
              localAxis,
              kind === "ironArch" ? 0.1 : 0.12,
              kind === "ironArch" ? 1.14 : 1.24,
              0.1,
            ),
            STEEL,
            false,
          );
          if (index < picketCount) {
            const railU = u + railLength / 2;
            const [railX, railZ] = at(railU, side * halfWidth);
            const railY = deckY + riseAt(railU);
            for (const level of kind === "ironArch"
              ? [0.34, 0.74, 1.14]
              : [0.42, 1.24]) {
              addPart(
                boxTriangles(
                  railX,
                  railY + level,
                  railZ,
                  tangentAt(railU),
                  railLength + 0.04,
                  level > 1 ? 0.11 : 0.07,
                  0.11,
                ),
                STEEL,
                false,
              );
            }
          }
        }
      }
      const standards =
        kind === "ironArch" ? [-0.76, -0.25, 0.25, 0.76] : [-0.62, 0, 0.62];
      for (const fraction of standards) {
        const u = halfLength * fraction;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * (halfWidth - 0.08));
          addPart(
            boxTriangles(
              px,
              y + (kind === "ironArch" ? 2.0 : 1.45),
              pz,
              localAxis,
              0.15,
              kind === "ironArch" ? 3.0 : 2.0,
              0.15,
            ),
            STEEL,
            false,
          );
          addLamp(
            prismTriangles(
              px,
              y + (kind === "ironArch" ? 3.62 : 2.55),
              pz,
              kind === "ironArch" ? 0.24 : 0.18,
              0.38,
              10,
            ),
            WARM_LIGHT,
          );
        }
      }
      if (kind === "ironArch") {
        // The forged Prussian eagles at the arch crown are kept symbolic but
        // volumetric: body, spread wings, head and crown are all separate.
        for (const side of [-1, 1]) {
          const [ex, ez] = at(0, side * (halfWidth + 0.16));
          const eagleY = deckY + riseAt(0) + 1.45;
          addPart(prismTriangles(ex, eagleY, ez, 0.28, 0.82, 8), STEEL, false);
          for (const wing of [-1, 1]) {
            addPart(
              boxTriangles(
                ex + ax * wing * 0.38,
                eagleY + 0.1,
                ez + az * wing * 0.38,
                tangentAt(0),
                0.72,
                0.5,
                0.1,
              ),
              STEEL,
              false,
            );
          }
          addPart(
            prismTriangles(ex, eagleY + 0.62, ez, 0.16, 0.3, 7),
            STEEL,
            false,
          );
          addPart(
            prismTriangles(ex, eagleY + 0.87, ez, 0.19, 0.18, 5),
            STEEL,
            false,
          );
        }
      }
    } else if (kind === "stoneArch") {
      // Otto Stahn alternates recessed sandstone panels with genuinely open
      // baluster fields. The former all-post approximation made the historic
      // balustrade look like a cheap picket fence and lost its broad rhythm.
      const bayLength = (halfLength * 2) / MOLTKE_BALUSTRADE_BAY_COUNT;
      for (let bay = 0; bay < MOLTKE_BALUSTRADE_BAY_COUNT; bay += 1) {
        const u = -halfLength + bayLength * (bay + 0.5);
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          if (bay % 2 === 0) {
            const [panelX, panelZ] = at(u, side * halfWidth);
            addMoltkeDetail(
              boxTriangles(
                panelX,
                y + 0.65,
                panelZ,
                localAxis,
                bayLength - 0.48,
                0.58,
                0.36,
              ),
              STONE,
            );
            const [insetX, insetZ] = at(u, side * (halfWidth + 0.205));
            addMoltkeDetail(
              boxTriangles(
                insetX,
                y + 0.65,
                insetZ,
                localAxis,
                bayLength - 1.0,
                0.32,
                0.055,
              ),
              MOLTKE_RELIEF,
              false,
            );
          } else {
            for (
              let baluster = 0;
              baluster < MOLTKE_BALUSTERS_PER_OPEN_BAY;
              baluster += 1
            ) {
              const balusterU =
                u +
                ((baluster + 0.5) / MOLTKE_BALUSTERS_PER_OPEN_BAY - 0.5) *
                  (bayLength - 0.58);
              const balusterY = deckY + riseAt(balusterU);
              const [balusterX, balusterZ] = at(balusterU, side * halfWidth);
              addMoltkeDetail(
                prismTriangles(
                  balusterX,
                  balusterY + 0.43,
                  balusterZ,
                  0.17,
                  0.14,
                  8,
                ),
                STONE_DARK,
                false,
              );
              addMoltkeDetail(
                prismTriangles(
                  balusterX,
                  balusterY + 0.62,
                  balusterZ,
                  0.16,
                  0.28,
                  10,
                ),
                STONE,
                false,
              );
              addMoltkeDetail(
                prismTriangles(
                  balusterX,
                  balusterY + 0.85,
                  balusterZ,
                  0.1,
                  0.22,
                  8,
                ),
                STONE_DARK,
                false,
              );
            }
          }
        }
      }
      for (
        let boundary = 0;
        boundary <= MOLTKE_BALUSTRADE_BAY_COUNT;
        boundary += 1
      ) {
        const u = -halfLength + bayLength * boundary;
        const y = deckY + riseAt(u);
        for (const side of [-1, 1]) {
          const [postX, postZ] = at(u, side * halfWidth);
          addMoltkeDetail(
            boxTriangles(
              postX,
              y + 0.66,
              postZ,
              tangentAt(u),
              0.32,
              0.86,
              0.44,
            ),
            boundary % 2 === 0 ? STONE_DARK : STONE,
            false,
          );
        }
      }

      // Eight bronze candelabra are carried by sculpted red-sandstone
      // pedestals. Each base retains the documented group of three small
      // Roman-soldier figures; the pointed lantern crown follows the supplied
      // close-up instead of using a generic glowing globe.
      const candelabraFractions = [-0.84, -0.28, 0.28, 0.84];
      for (const fraction of candelabraFractions) {
        const u = halfLength * fraction;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          for (const [level, width, height, depth, tone] of [
            [0.32, 1.34, 0.28, 1.12, STONE_DARK],
            [0.83, 1.08, 0.82, 0.92, STONE],
            [1.3, 1.28, 0.14, 1.06, STONE_DARK],
            [1.43, 0.92, 0.12, 0.82, STONE],
          ] as const) {
            addMoltkeDetail(
              boxTriangles(px, y + level, pz, localAxis, width, height, depth),
              tone,
              level < 1.4,
            );
          }
          for (const reliefU of [-0.3, -0.15, 0, 0.15, 0.3]) {
            const [reliefX, reliefZ] = at(
              u + reliefU,
              side * (halfWidth + 0.49),
            );
            addMoltkeDetail(
              prismTriangles(
                reliefX,
                y + 0.85 + Math.cos(reliefU * 7) * 0.11,
                reliefZ,
                0.095,
                0.15,
                8,
              ),
              MOLTKE_RELIEF,
              false,
            );
          }
          for (let figure = 0; figure < 3; figure += 1) {
            const angle =
              figure * ((Math.PI * 2) / 3) + (side < 0 ? Math.PI / 3 : 0);
            const figureU = u + Math.cos(angle) * 0.34;
            const figureV = side * halfWidth + Math.sin(angle) * 0.34;
            const [figureX, figureZ] = at(figureU, figureV);
            addMoltkeDetail(
              prismTriangles(figureX, y + 1.87, figureZ, 0.15, 0.48, 8),
              STEEL,
              false,
            );
            addMoltkeDetail(
              prismTriangles(figureX, y + 2.18, figureZ, 0.13, 0.2, 9),
              STEEL,
              false,
            );
            for (const leg of [-1, 1]) {
              addMoltkeDetail(
                beamBetweenTriangles(
                  [
                    figureX + ax * leg * 0.06,
                    y + 1.68,
                    figureZ + az * leg * 0.06,
                  ],
                  [
                    figureX + ax * leg * 0.1,
                    y + 1.46,
                    figureZ + az * leg * 0.1,
                  ],
                  0.065,
                ),
                STEEL,
                false,
              );
            }
            const implementDirection = figure === 1 ? -1 : 1;
            addMoltkeDetail(
              beamBetweenTriangles(
                [figureX, y + 1.98, figureZ],
                [
                  figureX + ax * implementDirection * 0.22,
                  y + 2.2,
                  figureZ + az * implementDirection * 0.22,
                ],
                0.055,
              ),
              STEEL,
              false,
            );
          }
          for (const [level, radius, height] of [
            [2.3, 0.21, 0.15],
            [2.45, 0.12, 0.18],
            [3.25, 0.09, 1.6],
            [4.08, 0.17, 0.13],
          ] as const) {
            addMoltkeDetail(
              prismTriangles(px, y + level, pz, radius, height, 10),
              STEEL,
              false,
            );
          }
          addMoltkeDetailLamp(
            prismTriangles(px, y + 4.47, pz, 0.27, 0.58, 8),
            WARM_LIGHT,
          );
          for (let corner = 0; corner < 4; corner += 1) {
            const angle = Math.PI / 4 + corner * (Math.PI / 2);
            const dx = Math.cos(angle) * 0.28;
            const dz = Math.sin(angle) * 0.28;
            addMoltkeDetail(
              beamBetweenTriangles(
                [px + dx * 0.62, y + 4.15, pz + dz * 0.62],
                [px + dx, y + 4.78, pz + dz],
                0.045,
              ),
              STEEL,
              false,
            );
            addMoltkeDetail(
              beamBetweenTriangles(
                [px + dx, y + 4.78, pz + dz],
                [px + dx * 1.38, y + 4.98, pz + dz * 1.38],
                0.04,
              ),
              STEEL,
              false,
            );
          }
          addMoltkeDetail(
            prismTriangles(px, y + 4.85, pz, 0.34, 0.12, 8),
            STEEL,
            false,
          );
          addMoltkeDetail(
            prismTriangles(px, y + 5.04, pz, 0.1, 0.28, 8),
            STEEL,
            false,
          );
        }
      }

      // Carl Piper's four sandstone griffins sit at the outer corners. They
      // face into the bridge, spread feathered wings and hold a dark heraldic
      // shield above a garlanded pedestal.
      for (const fraction of [-0.975, 0.975]) {
        const u = halfLength * fraction;
        const facing = -Math.sign(fraction);
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          for (const [level, width, height, depth, tone] of [
            [0.28, 1.7, 0.3, 1.45, STONE_DARK],
            [0.82, 1.45, 0.78, 1.25, STONE],
            [1.3, 1.7, 0.18, 1.45, STONE_DARK],
            [1.48, 1.42, 0.18, 1.2, STONE],
          ] as const) {
            addMoltkeDetail(
              boxTriangles(px, y + level, pz, localAxis, width, height, depth),
              tone,
              level < 1.4,
            );
          }
          for (const garlandU of [-0.42, -0.21, 0, 0.21, 0.42]) {
            const [garlandX, garlandZ] = at(
              u + garlandU,
              side * (halfWidth + 0.65),
            );
            addMoltkeDetail(
              prismTriangles(
                garlandX,
                y + 0.82 + Math.cos(garlandU * 6) * 0.13,
                garlandZ,
                0.12,
                0.19,
                9,
              ),
              MOLTKE_RELIEF,
              false,
            );
          }
          const rear: [number, number, number] = [
            px - ax * facing * 0.45,
            y + 1.98,
            pz - az * facing * 0.45,
          ];
          const chest: [number, number, number] = [
            px + ax * facing * 0.42,
            y + 2.12,
            pz + az * facing * 0.42,
          ];
          const bridgeRotation = Math.atan2(-az, ax);
          const bodyGeometry = new IcosahedronGeometry(1, 1);
          bodyGeometry.scale(0.72, 0.5, 0.43);
          bodyGeometry.rotateY(bridgeRotation);
          bodyGeometry.translate(
            (rear[0] + chest[0]) / 2,
            (rear[1] + chest[1]) / 2,
            (rear[2] + chest[2]) / 2,
          );
          addMoltkeDetailGeometry(bodyGeometry, STONE, false);
          const haunchGeometry = new IcosahedronGeometry(1, 1);
          haunchGeometry.scale(0.45, 0.48, 0.4);
          haunchGeometry.rotateY(bridgeRotation);
          haunchGeometry.translate(rear[0], y + 1.94, rear[2]);
          addMoltkeDetailGeometry(haunchGeometry, STONE_DARK, false);
          const neck: [number, number, number] = [
            px + ax * facing * 0.66,
            y + 2.82,
            pz + az * facing * 0.66,
          ];
          addMoltkeDetail(
            beamBetweenTriangles(chest, neck, 0.3, 0.38),
            STONE,
            false,
          );
          const head: [number, number, number] = [
            px + ax * facing * 0.82,
            y + 2.95,
            pz + az * facing * 0.82,
          ];
          const headGeometry = new IcosahedronGeometry(1, 1);
          headGeometry.scale(0.3, 0.3, 0.26);
          headGeometry.rotateY(bridgeRotation);
          headGeometry.translate(head[0], head[1], head[2]);
          addMoltkeDetailGeometry(headGeometry, STONE, false);
          addMoltkeDetail(
            beamBetweenTriangles(
              head,
              [
                head[0] + ax * facing * 0.2,
                head[1] - 0.05,
                head[2] + az * facing * 0.2,
              ],
              0.16,
              0.2,
            ),
            MOLTKE_RELIEF,
            false,
          );
          for (const wingSide of [-1, 1]) {
            const wingRoot: [number, number, number] = [
              rear[0] + nx * wingSide * 0.1,
              rear[1] + 0.12,
              rear[2] + nz * wingSide * 0.1,
            ];
            const wingCrown: [number, number, number] = [
              rear[0] - ax * facing * 0.35 + nx * wingSide * 0.18,
              rear[1] + 0.9,
              rear[2] - az * facing * 0.35 + nz * wingSide * 0.18,
            ];
            addMoltkeDetail(
              beamBetweenTriangles(wingRoot, wingCrown, 0.24, 0.34),
              STONE,
              false,
            );
            for (let feather = 0; feather < 5; feather += 1) {
              const spread = 0.1 + feather * 0.035;
              const wingTip: [number, number, number] = [
                rear[0] -
                  ax * facing * (0.2 + feather * 0.085) +
                  nx * wingSide * spread,
                rear[1] + 0.48 + feather * 0.105,
                rear[2] -
                  az * facing * (0.2 + feather * 0.085) +
                  nz * wingSide * spread,
              ];
              addMoltkeDetail(
                beamBetweenTriangles(
                  wingRoot,
                  wingTip,
                  0.22 - feather * 0.018,
                  0.3,
                ),
                feather % 2 === 0 ? STONE : MOLTKE_RELIEF,
                false,
              );
            }
          }
          for (const legU of [-0.3, 0.3]) {
            for (const legV of [-0.18, 0.18]) {
              addMoltkeDetail(
                beamBetweenTriangles(
                  [
                    px + ax * legU + nx * legV,
                    y + 1.92,
                    pz + az * legU + nz * legV,
                  ],
                  [
                    px + ax * (legU + facing * 0.08) + nx * legV,
                    y + 1.55,
                    pz + az * (legU + facing * 0.08) + nz * legV,
                  ],
                  0.13,
                ),
                STONE_DARK,
                false,
              );
            }
          }
          const shieldU = u + facing * 0.5;
          const shieldV = side * (halfWidth + 0.48);
          const [shieldX, shieldZ] = at(shieldU, shieldV);
          const shieldGeometry = new IcosahedronGeometry(1, 1);
          shieldGeometry.scale(0.43, 0.55, 0.1);
          shieldGeometry.rotateY(bridgeRotation);
          shieldGeometry.translate(shieldX, y + 2.0, shieldZ);
          addMoltkeDetailGeometry(shieldGeometry, STEEL);
          addMoltkeDetail(
            boxTriangles(
              shieldX,
              y + 2.05,
              shieldZ,
              localAxis,
              0.16,
              0.62,
              0.13,
            ),
            MOLTKE_RELIEF,
            false,
          );
        }
      }

      // The two river piers carry a trophy on each water face; all three
      // arch crowns receive a portrait keystone on both elevations.
      for (const fraction of [-1 / 3, 1 / 3]) {
        const u = halfLength * fraction;
        const y = deckY + riseAt(u) - 1.72;
        for (const side of [-1, 1]) {
          const [trophyX, trophyZ] = at(u, side * (halfWidth + 0.48));
          const crossA: [number, number, number] = [
            trophyX - ax * 0.5,
            y - 0.48,
            trophyZ - az * 0.5,
          ];
          const crossB: [number, number, number] = [
            trophyX + ax * 0.5,
            y + 0.48,
            trophyZ + az * 0.5,
          ];
          addMoltkeDetail(
            beamBetweenTriangles(crossA, crossB, 0.11),
            MOLTKE_RELIEF,
            false,
          );
          addMoltkeDetail(
            beamBetweenTriangles(
              [crossA[0], crossB[1], crossA[2]],
              [crossB[0], crossA[1], crossB[2]],
              0.11,
            ),
            MOLTKE_RELIEF,
            false,
          );
          addMoltkeDetail(
            boxTriangles(trophyX, y, trophyZ, tangentAt(u), 0.58, 0.68, 0.12),
            STEEL,
            false,
          );
        }
      }
      const archSpacing = (halfLength * 2) / MOLTKE_ARCH_COUNT;
      for (let arch = 0; arch < MOLTKE_ARCH_COUNT; arch += 1) {
        const u = -halfLength + archSpacing * (arch + 0.5);
        const y = deckY + riseAt(u) - 1.52;
        for (const side of [-1, 1]) {
          const [headX, headZ] = at(u, side * (halfWidth + 0.49));
          addMoltkeDetail(
            prismTriangles(headX, y, headZ, 0.25, 0.46, 10),
            MOLTKE_RELIEF,
            false,
          );
          addMoltkeDetail(
            prismTriangles(headX, y - 0.3, headZ, 0.19, 0.22, 8),
            STONE_DARK,
            false,
          );
        }
      }
    } else {
      for (let index = 0; index <= postCount; index += 1) {
        const u = -halfLength + (index / postCount) * halfLength * 2;
        const y = deckY + riseAt(u);
        const localAxis = tangentAt(u);
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          addPart(
            boxTriangles(px, y + 0.55, pz, localAxis, 0.13, 1.1, 0.13),
            STEEL,
            false,
          );
        }
        // A second, lower rail turns the posts into a real balustrade.
        for (const side of [-1, 1]) {
          const [px, pz] = at(u, side * halfWidth);
          addPart(
            boxTriangles(px, y + 0.28, pz, localAxis, postSpacing, 0.09, 0.09),
            STEEL,
            false,
          );
        }
      }
    }
    // Abutments: both ends of the span sit on drawn blocks that reach
    // the riverbed, so the deck never floats free of its banks.
    for (const end of [-1, 1]) {
      const u = end * halfLength;
      const [px, pz] = at(u, 0);
      const height = deckY + riseAt(u) - 1.0 - bedY;
      const abutmentLength = genericSmall
        ? 1.4
        : kind === "vierendeel"
          ? 2.8
          : kind === "curvedBox"
            ? 7.0
            : 5.0;
      addPart(
        boxTriangles(
          px,
          bedY + height / 2,
          pz,
          tangentAt(u),
          kind === "slender" ? 3.0 : abutmentLength,
          height,
          halfWidth * 2 - 0.4,
        ),
        STONE_DARK,
      );
    }
    if (kind === "stoneArch") {
      // Three segmental arches on cutwater piers — the built
      // Moltkebrücke. Each arch ring is drawn on both outer faces with a
      // spandrel wall between them.
      const arches = MOLTKE_ARCH_COUNT;
      const pierSpacing = (halfLength * 2) / arches;
      const springY = waterTop + 1.2;
      for (let index = 1; index < arches; index += 1) {
        const u = -halfLength + pierSpacing * index;
        const [px, pz] = at(u, 0);
        const height = deckY + riseAt(u) - 1.2 - bedY;
        addPart(
          boxTriangles(
            px,
            bedY + height / 2,
            pz,
            tangentAt(u),
            4.6,
            height,
            halfWidth * 2 - 0.5,
          ),
          STONE_DARK,
        );
        // Pointed cutwaters upstream and down.
        for (const side of [-1, 1]) {
          const [wx, wz] = at(u, side * (halfWidth - 0.2));
          addPart(
            prismTriangles(wx, springY + 1.4, wz, 2.3, height * 0.62, 3),
            STONE_DARK,
            false,
          );
        }
      }
      for (let arch = 0; arch < arches; arch += 1) {
        const u0 = -halfLength + pierSpacing * arch;
        const clear = pierSpacing - 4.6;
        const steps = 18;
        for (let step = 0; step < steps; step += 1) {
          const t = (step + 0.5) / steps;
          const u = u0 + 2.3 + clear * t;
          const crown = deckY + riseAt(u) - 1.6;
          const rise = Math.sin(t * Math.PI) * (crown - springY);
          const ringY = springY + rise;
          const [wx, wz] = at(u, 0);
          for (const side of [-1, 1]) {
            addPart(
              boxTriangles(
                wx + nx * side * (halfWidth - 0.45),
                ringY - 0.55,
                wz + nz * side * (halfWidth - 0.45),
                tangentAt(u),
                clear / steps + 0.12,
                1.1,
                0.9,
              ),
              step % 3 === 0 ? MOLTKE_RELIEF : STONE,
              false,
            );
          }
          // Spandrels belong to the two outer sandstone faces. Filling the
          // whole bridge width here produced dark transverse slabs, which
          // read as a broken steel ladder instead of a masonry road bridge.
          const spandrel = crown - ringY;
          if (spandrel > 0.2) {
            for (const side of [-1, 1]) {
              const [sx, sz] = at(u, side * (halfWidth - 0.5));
              addPart(
                boxTriangles(
                  sx,
                  ringY + spandrel / 2,
                  sz,
                  tangentAt(u),
                  clear / steps + 0.12,
                  spandrel,
                  0.9,
                ),
                STONE_DARK,
                false,
              );
            }
          }
        }
      }
      // Three centred relief fields and a continuous string course repeat
      // the historic sandstone facade without using a photographic texture.
      for (let arch = 0; arch < arches; arch += 1) {
        const u = -halfLength + pierSpacing * (arch + 0.5);
        const y = deckY + riseAt(u) - 1.0;
        for (const side of [-1, 1]) {
          const [panelX, panelZ] = at(u, side * (halfWidth - 0.02));
          addPart(
            boxTriangles(panelX, y, panelZ, tangentAt(u), 3.2, 0.72, 0.12),
            MOLTKE_RELIEF,
            false,
          );
        }
      }
    } else if (kind === "ironArch") {
      // Weidendammer Brücke has two narrow granite-clad piers and three
      // iron arch openings. The historic 16.3 / 38.5 / 15.5 m support rhythm
      // is scaled uniformly into the current official 69.48 m envelope.
      const pierCentres = WEIDENDAMMER_BRIDGE_SUPPORT_LAYOUT.pierCentresLocalM;
      for (const u of pierCentres) {
        const [px, pz] = at(u, 0);
        const height = deckY + riseAt(u) - deckThickness - bedY;
        addPart(
          boxTriangles(
            px,
            bedY + height / 2,
            pz,
            tangentAt(u),
            2.6,
            height,
            halfWidth * 2 - 0.5,
          ),
          STONE_DARK,
        );
        for (const side of [-1, 1]) {
          const [wx, wz] = at(u, side * (halfWidth - 0.15));
          addPart(
            prismTriangles(wx, waterTop + 2.0, wz, 1.4, 3.0, 3),
            STONE,
            false,
          );
        }
      }
      const pierHalfLength = 1.3;
      const spans = [
        [-halfLength + 0.7, pierCentres[0] - pierHalfLength],
        [pierCentres[0] + pierHalfLength, pierCentres[1] - pierHalfLength],
        [pierCentres[1] + pierHalfLength, halfLength - 0.7],
      ] as const;
      // LDA records ten three-part arch girders. Full fidelity renders all
      // ten across the deck; the bounded phone profile retains four evenly
      // distributed silhouette girders without changing piers or span rhythm.
      const girderCount = detailProfile === "mobile" ? 4 : 10;
      const girderFractions = Array.from(
        { length: girderCount },
        (_, index) => -1 + (index / (girderCount - 1)) * 2,
      );
      for (const [start, end] of spans) {
        const steps = end - start > 25 ? 24 : 12;
        for (let step = 0; step < steps; step += 1) {
          const t = (step + 0.5) / steps;
          const u = start + (end - start) * t;
          const springY = waterTop + 1.1;
          const crownY = deckY + riseAt(u) - 1.05;
          const archY = springY + Math.sin(t * Math.PI) * (crownY - springY);
          for (const girderFraction of girderFractions) {
            const [rx, rz] = at(u, girderFraction * (halfWidth - 0.34));
            addPart(
              boxTriangles(
                rx,
                archY,
                rz,
                tangentAt(u),
                (end - start) / steps + 0.12,
                0.72,
                0.46,
              ),
              STEEL,
              false,
            );
            if (step % 3 === 1) {
              const hangerHeight = deckY + riseAt(u) - 0.8 - archY;
              if (hangerHeight > 0.25) {
                addPart(
                  boxTriangles(
                    rx,
                    archY + hangerHeight / 2,
                    rz,
                    tangentAt(u),
                    0.16,
                    hangerHeight,
                    0.16,
                  ),
                  STEEL,
                  false,
                );
              }
            }
          }
        }
      }
    } else if (kind === "steelArch") {
      // Calatrava's built bridge is a three-field system: 15.5 m side
      // openings frame a 44 m main opening. Two longitudinal pipe girders
      // receive sloping struts from shallow arches below the deck, all
      // landing on prow-shaped intermediate piers.
      const breakU = KRONPRINZEN_SPAN_LAYOUT_M[1] / 2;
      const spans = [
        [-halfLength, -breakU],
        [-breakU, breakU],
        [breakU, halfLength],
      ] as const;
      for (const side of [-1, 1]) {
        for (let segment = 0; segment < DECK_SEGMENTS; segment += 1) {
          const u0 = -halfLength + segmentLength * segment;
          const u1 = u0 + segmentLength;
          const [x0, z0] = at(u0, side * 6.35);
          const [x1, z1] = at(u1, side * 6.35);
          addPart(
            beamBetweenTriangles(
              [x0, deckY + riseAt(u0) - 0.92, z0],
              [x1, deckY + riseAt(u1) - 0.92, z1],
              0.86,
            ),
            STEEL,
            false,
          );
        }
      }
      for (const [spanStart, spanEnd] of spans) {
        const isMain = spanEnd - spanStart > 30;
        const steps = isMain ? 16 : 7;
        const drop = isMain ? 3.25 : 1.55;
        for (let step = 0; step < steps; step += 1) {
          const t = (step + 0.5) / steps;
          const u = spanStart + (spanEnd - spanStart) * t;
          const archY = deckY + riseAt(u) - 1.5 - Math.sin(t * Math.PI) * drop;
          for (const side of [-1, 1]) {
            const [ribX, ribZ] = at(u, side * (halfWidth - 1.15));
            addPart(
              boxTriangles(
                ribX,
                archY,
                ribZ,
                tangentAt(u),
                (spanEnd - spanStart) / steps + 0.12,
                0.68,
                0.5,
              ),
              STEEL,
              false,
            );
            if (step % 2 === 0) {
              const [deckX, deckZ] = at(
                u +
                  ((step % 4 === 0 ? 1 : -1) * (spanEnd - spanStart)) /
                    steps /
                    3,
                side * 6.35,
              );
              addPart(
                beamBetweenTriangles(
                  [ribX, archY + 0.22, ribZ],
                  [deckX, deckY + riseAt(u) - 0.82, deckZ],
                  0.2,
                ),
                STEEL,
                false,
              );
            }
          }
        }
      }
      const pierRotation = Math.atan2(az, ax);
      for (const u of [-breakU, breakU]) {
        const pierDeckY = deckY + riseAt(u) - 1.15;
        const height = pierDeckY - bedY;
        for (const side of [-1, 1]) {
          const [pierX, pierZ] = at(u, side * (halfWidth - 1.2));
          addPart(
            prismTriangles(
              pierX,
              bedY + height / 2,
              pierZ,
              1.75,
              height,
              3,
              pierRotation + (u < 0 ? Math.PI : 0),
            ),
            STONE_DARK,
          );
          addPart(
            boxTriangles(
              pierX,
              pierDeckY + 0.1,
              pierZ,
              tangentAt(u),
              2.2,
              0.35,
              2.4,
            ),
            BEARING,
            false,
          );
        }
      }
    } else if (kind === "vierendeel") {
      // The 66 m clear central span leaves two 10.88 m end fields. The
      // real supports are rectangular concrete blades close to the banks,
      // not round columns distributed through the river.
      for (const end of [-1, 1]) {
        const u = end * 33;
        const [px, pz] = at(u, 0);
        const height = deckY + riseAt(u) - deckThickness - bedY;
        addPart(
          boxTriangles(
            px,
            bedY + height / 2,
            pz,
            tangentAt(u),
            1.45,
            height,
            halfWidth * 2 - 0.45,
          ),
          STONE_DARK,
        );
        for (const side of [-1, 1]) {
          const [bearingX, bearingZ] = at(u, side * 1.25);
          addPart(
            boxTriangles(
              bearingX,
              deckY + riseAt(u) - deckThickness - 0.14,
              bearingZ,
              tangentAt(u),
              0.58,
              0.28,
              0.52,
            ),
            BEARING,
            false,
          );
        }
      }
    } else if (kind === "curvedBox") {
      // Hugo-Preuß is an 88 m one-field box girder. Its load reaches the
      // two massive abutments above; no invented pier may stand in the
      // mouth of the Humboldthafen.
    } else if (kind === "openFrame") {
      // Sandkrugbrücke: the open frame keeps the navigation opening clear.
      // Four inclined haunches transfer its wide deck into the bank frames.
      for (const end of [-1, 1]) {
        const deckU = end * (halfLength - 2.1);
        const baseU = end * (halfLength - 5.4);
        for (const side of [-1, 1]) {
          const [deckX, deckZ] = at(deckU, side * (halfWidth - 1.1));
          const [baseX, baseZ] = at(baseU, side * (halfWidth - 1.1));
          addPart(
            beamBetweenTriangles(
              [baseX, bedY + 0.25, baseZ],
              [deckX, deckY + riseAt(deckU) - deckThickness - 0.2, deckZ],
              0.9,
              1.15,
            ),
            STONE_DARK,
          );
        }
        const frameU = end * (halfLength - 3.1);
        const [frameX, frameZ] = at(frameU, 0);
        addPart(
          boxTriangles(
            frameX,
            deckY + riseAt(frameU) - 1.05,
            frameZ,
            tangentAt(frameU),
            1.0,
            1.1,
            halfWidth * 2 - 1.2,
          ),
          STONE,
        );
      }
    } else if (kind === "parliament") {
      // The two-storey Bundestag bridge spans directly between the two
      // parliamentary buildings; no invented support belongs in the Spree.
    } else if (kind === "slender") {
      // Two round columns in the stream, nothing else: the footbridge
      // must stay light.
      for (const end of [-1, 1]) {
        const u = end * halfLength * 0.42;
        const [px, pz] = at(u, 0);
        const height = deckY + riseAt(u) - 0.9 - bedY;
        addPart(
          prismTriangles(px, bedY + height / 2, pz, 1.1, height, 10),
          STONE_DARK,
        );
      }
    } else if (kind !== "golda") {
      // Generic crossings keep the plain pier-and-web beam bridge.
      const spanCount = Math.max(1, Math.round((halfLength * 2) / 22));
      const pierHeight = deckY - 1.25 - bedY;
      for (let index = 1; index < spanCount; index += 1) {
        const u = -halfLength + (index / spanCount) * halfLength * 2;
        const [px, pz] = at(u, 0);
        addPart(
          boxTriangles(
            px,
            bedY + pierHeight / 2,
            pz,
            tangentAt(u),
            2.6,
            pierHeight,
            halfWidth * 2 - 0.6,
          ),
          STONE,
        );
      }
    }
  }
  if (parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "drawn bridge structures";
  group.userData.bridgeProfiles = BRIDGE_PROFILES.map(
    ({ axis, curveSagittaM, kind, name, palette, surveyedDeck, world }) => ({
      axis,
      curveSagittaM,
      kind,
      name,
      palette,
      surveyedDeck,
      world,
    }),
  );
  group.userData.bridgeClusterCount = clusters.length;
  group.userData.smallBridgeClusterCount = clusters.filter(
    (cluster) => cluster.length < 12,
  ).length;
  group.userData.moltkeOrnamentCounts = {
    balustradeBays: MOLTKE_BALUSTRADE_BAY_COUNT,
    balusters:
      (MOLTKE_BALUSTRADE_BAY_COUNT / 2) * MOLTKE_BALUSTERS_PER_OPEN_BAY * 2,
    candelabra: MOLTKE_CANDELABRA_COUNT,
    candelabraFigures: MOLTKE_CANDELABRA_FIGURE_COUNT,
    griffins: MOLTKE_GRIFFIN_COUNT,
    keystoneHeads: MOLTKE_KEYSTONE_HEAD_COUNT,
    trophies: MOLTKE_TROPHY_COUNT,
  };
  group.userData.keepInMinecraft = true;
  if (weidendammerBaseRendered) {
    group.userData.weidendammerDetailOwnership = {
      authoredEagleCount: WEIDENDAMMER_BRIDGE_EAGLE_COUNT,
      authoredRailingSystemCount: WEIDENDAMMER_BRIDGE_RAILING_SYSTEM_COUNT,
      baseArchGirderCount: detailProfile === "mobile" ? 4 : 10,
      baseArchSystemCount: 1,
      genericEagleCount: 0,
      genericLampStandardCount: 0,
      genericRailingSystemCount: 0,
    };
  }

  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "bridge structure bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const inkMaterial = markArchitecturalInk(new LineBasicMaterial(), "detail");
    const lines = new LineSegments(ink, inkMaterial);
    lines.name = "bridge structure ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  const lampGeometry =
    lampParts.length > 0 ? mergeGeometries(lampParts, false) : null;
  if (lampGeometry) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.45,
      vertexColors: true,
    });
    nightMaterial.userData.nightEmissive = 0xffc75c;
    nightMaterial.userData.nightEmissiveIntensity = 1.35;
    const lamps = new Mesh(lampGeometry, dayMaterial);
    lamps.name = "bridge structure lamps";
    lamps.userData.dayMaterial = dayMaterial;
    lamps.userData.nightMaterial = nightMaterial;
    group.add(lamps);
    for (const geometry of lampParts) {
      geometry.dispose();
    }
  }
  const moltkeDetailGeometry =
    moltkeDetailParts.length > 0
      ? mergeGeometries(moltkeDetailParts, false)
      : null;
  if (moltkeDetailGeometry) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.88,
      vertexColors: true,
    });
    const details = new Mesh(moltkeDetailGeometry, dayMaterial);
    details.name = "Moltkebrücke ornamental stone bodies";
    details.userData.dayMaterial = dayMaterial;
    details.userData.nightMaterial = nightMaterial;
    group.add(details);
    for (const geometry of moltkeDetailParts) {
      geometry.dispose();
    }
  }
  const moltkeDetailInk =
    moltkeDetailEdges.length > 0
      ? mergeGeometries(moltkeDetailEdges, false)
      : null;
  if (moltkeDetailInk) {
    const lines = new LineSegments(
      moltkeDetailInk,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    lines.name = "Moltkebrücke ornamental stone ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of moltkeDetailEdges) {
      geometry.dispose();
    }
  }
  const moltkeDetailLampGeometry =
    moltkeDetailLampParts.length > 0
      ? mergeGeometries(moltkeDetailLampParts, false)
      : null;
  if (moltkeDetailLampGeometry) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.35,
      vertexColors: true,
    });
    nightMaterial.userData.nightEmissive = 0xffc75c;
    nightMaterial.userData.nightEmissiveIntensity = 1.45;
    const lamps = new Mesh(moltkeDetailLampGeometry, dayMaterial);
    lamps.name = "Moltkebrücke ornamental stone lamps";
    lamps.userData.dayMaterial = dayMaterial;
    lamps.userData.nightMaterial = nightMaterial;
    group.add(lamps);
    for (const geometry of moltkeDetailLampParts) {
      geometry.dispose();
    }
  }
  group.add(createAdlerBridge(ground));
  group.add(createLoewenBridge(ground));
  if (weidendammerBaseRendered) {
    group.add(
      createWeidendammerBridgeDetails(detailProfile, ground.water_top_y_m),
    );
  }
  return group;
}

function createBridgeRailings(ground: VoxelPayload): Group | null {
  const cell = ground.cell_m;
  const { cols, min_x_idx, min_z_idx, rows } = ground.grid;
  const classGrid = new Int16Array(cols * rows).fill(-1);
  ground.ground_rows.forEach((row, zOffset) => {
    for (const [xStart, run, classId] of row) {
      for (let step = 0; step < run; step += 1) {
        const x = xStart + step;
        if (x >= 0 && x < cols) {
          classGrid[zOffset * cols + x] = classId;
        }
      }
    }
  });
  const bridgeClass = ground.classes.indexOf("bridge");
  const waterClass = ground.classes.indexOf("water");
  if (bridgeClass < 0 || waterClass < 0) {
    return null;
  }
  const sample = groundTopSampler(ground);
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const tone = new Color(0xdfdaca);
  const rail = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    xOffset: number,
    zOffset: number,
  ): void => {
    const deckTop = sample(xOffset, zOffset);
    const midX = ((min_x_idx + x1) * cell + (min_x_idx + x2) * cell) / 2;
    const midZ = ((min_z_idx + z1) * cell + (min_z_idx + z2) * cell) / 2;
    const dirX =
      ((x2 - x1) * cell) / Math.hypot((x2 - x1) * cell, (z2 - z1) * cell);
    const dirZ =
      ((z2 - z1) * cell) / Math.hypot((x2 - x1) * cell, (z2 - z1) * cell);
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        boxTriangles(
          midX,
          deckTop + 0.55,
          midZ,
          [dirX, dirZ],
          cell,
          1.05,
          0.16,
        ),
        3,
      ),
    );
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
  };
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (classGrid[z * cols + x] !== bridgeClass) {
        continue;
      }
      if (x + 1 >= cols || classGrid[z * cols + x + 1] === waterClass) {
        rail(x + 1, z, x + 1, z + 1, x, z);
      }
      if (x === 0 || classGrid[z * cols + x - 1] === waterClass) {
        rail(x, z, x, z + 1, x, z);
      }
      if (z + 1 >= rows || classGrid[(z + 1) * cols + x] === waterClass) {
        rail(x, z + 1, x + 1, z + 1, x, z);
      }
      if (z === 0 || classGrid[(z - 1) * cols + x] === waterClass) {
        rail(x, z, x + 1, z, x, z);
      }
    }
  }
  if (parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "drawn bridge railings";
  const merged = mergeGeometries(parts, false);
  if (merged) {
    const railDay = new MeshBasicMaterial({ vertexColors: true });
    const railNight = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, railDay);
    mesh.userData.dayMaterial = railDay;
    mesh.userData.nightMaterial = railNight;
    mesh.name = "bridge railing bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    lines.name = "bridge railing ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

/**
 * Blank paper ring around the surveyed hull. Until v0.40.0 this function also
 * carried an invented west Tiergarten — lawn bands, a drawn Straße des 17.
 * Juni and ~1774 generated trees — because the shipped data stopped at world
 * x -658. The task-09 bounds now fetch real LoD2, OSM parkland and official
 * tree/lamp points out to x -2873, so all of that invented content has been
 * removed rather than drawn on top of measured geometry. What remains is
 * genuinely beyond the data: flat tone plates, cartographic ruling and the
 * Unter-den-Linden stub continuing east off the extract.
 */
export function createExtrapolatedMargin(): Group {
  const group = new Group();
  group.name = "extrapolated paper margin";
  group.userData.extrapolated = true;
  group.userData.visibleRadiusM = VISIBLE_RADIUS_M;
  const bodyGeometries: BufferGeometry[] = [];
  const edgeGeometries: BufferGeometry[] = [];
  const addPart = (
    triangles: Float32Array,
    tone: number,
    inked = true,
  ): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const paint = new Color(tone);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = paint.r;
      colors[index * 3 + 1] = paint.g;
      colors[index * 3 + 2] = paint.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    bodyGeometries.push(geometry);
    if (inked) {
      edgeGeometries.push(
        new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
    }
  };
  const GROUND_TOP = 2.1;
  // A recessed paper ground closes transparent gaps between the bounded
  // official grid and the margin bands. It sits below water and terrain, so
  // it cannot move or cover surveyed geometry; it only prevents the sky from
  // showing through at maximum flight.
  const envelope = extrapolatedEnvelopeBounds();
  addPart(
    boxTriangles(
      (envelope.minX + envelope.maxX) / 2,
      PRESENTATION_FLOOR_Y_M - 0.6,
      (envelope.minZ + envelope.maxZ) / 2,
      [1, 0],
      envelope.maxX - envelope.minX,
      1.2,
      envelope.maxZ - envelope.minZ,
    ),
    0xe9efe4,
    false,
  );
  // "Umkreis ausweiten": a calm paper-pale margin carries the map on every
  // side — the drawing fades into light ground instead of a void. No
  // buildings are invented; Unter den Linden continues east from the Gate as
  // a drawn axis.
  const MARGIN = EXTRAPOLATED_MARGIN_M;
  const marginBands = extrapolatedMarginBands();
  const MARGIN_TONES = [0xe6ece1, 0xebf0e6];
  marginBands.forEach(([cx, cz, sx, sz], index) => {
    addPart(
      boxTriangles(cx, GROUND_TOP - 1.6, cz, [1, 0], sx, 2.6, sz),
      MARGIN_TONES[index % 2],
      false,
    );
  });
  // NO cartographic ruling on the margin. v0.40.0 filled it with a 140 m
  // grid of hairlines to make the blank paper look "drawn"; at every zoom
  // it read as a black square lattice laid over the whole scene around the
  // model, which is the opposite of the calm paper the margin is for
  // ("drumherum … ist so ein schwarzes Quadratgitter. Das kann bitte weg").
  // The margin carries its two quiet paper tones and nothing else.
  // Unter den Linden, continuing east from Pariser Platz off the extract.
  addPart(
    boxTriangles(
      DATA_EAST_M + MARGIN / 2,
      GROUND_TOP - 1.35,
      292,
      [1, 0],
      MARGIN,
      3,
      40,
    ),
    ISO_GROUND_SHADES.asphalt[0],
    false,
  );
  const marginBody = mergeGeometries(bodyGeometries, false);
  if (marginBody) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(marginBody, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "extrapolated margin ground";
    group.add(mesh);
    for (const geometry of bodyGeometries) {
      geometry.dispose();
    }
  }
  // With the field grid gone every margin part is drawn uninked, so the
  // edge list can legitimately be empty — mergeGeometries throws on [].
  const marginInk =
    edgeGeometries.length > 0 ? mergeGeometries(edgeGeometries, false) : null;
  if (marginInk) {
    const lines = new LineSegments(
      marginInk,
      markArchitecturalInk(new LineBasicMaterial(), "silhouette"),
    );
    lines.name = "extrapolated margin ink lines";
    lines.renderOrder = 2;
    group.add(lines);
  }
  return group;
}

/**
 * Siegessäule (Strack, 1873) and the Bismarck-Nationaldenkmal (Begas, 1901)
 * at the Großer Stern. Recognition models after published dimensions: the
 * LoD2 extract carries only the 25 m socle block of the column, so the
 * 67 m fluted shaft with the gilded Viktoria has to be modelled and the
 * underlying prisms are suppressed (PRISM_SUPPRESSED_IDS).
 */
export function createSiegessaeule(): Group {
  const group = new Group();
  group.name = "Siegessäule and Bismarck-Nationaldenkmal";
  group.userData.recognitionModel = true;
  group.userData.sourceProfile = SIEGESSAEULE_PROFILE;
  const bodyGeometries: BufferGeometry[] = [];
  const goldelseGeometries: BufferGeometry[] = [];
  const bronzeReliefGeometries: BufferGeometry[] = [];
  const mosaicGeometries: BufferGeometry[] = [];
  const edgeGeometries: BufferGeometry[] = [];
  const colouredGeometry = (
    triangles: Float32Array,
    tone: number,
  ): BufferGeometry => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const paint = new Color(tone);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = paint.r;
      colors[index * 3 + 1] = paint.g;
      colors[index * 3 + 2] = paint.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return geometry;
  };
  const addPart = (
    triangles: Float32Array,
    tone: number,
    inked = true,
  ): void => {
    const geometry = colouredGeometry(triangles, tone);
    bodyGeometries.push(geometry);
    if (inked) {
      edgeGeometries.push(
        new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
    }
  };
  const addGoldelsePart = (
    triangles: Float32Array,
    tone: number,
    inked = true,
  ): void => {
    const geometry = colouredGeometry(triangles, tone);
    goldelseGeometries.push(geometry);
    if (inked) {
      edgeGeometries.push(
        new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
    }
  };
  const addDecorationPart = (
    target: BufferGeometry[],
    triangles: Float32Array,
    tone: number,
  ): BufferGeometry => {
    const geometry = colouredGeometry(triangles, tone);
    target.push(geometry);
    return geometry;
  };
  const GROUND_TOP = 2.1;
  const axisDx = AXIS_TO[0] - AXIS_FROM[0];
  const axisDz = AXIS_TO[1] - AXIS_FROM[1];
  const axisLength = Math.hypot(axisDx, axisDz);
  const axis: [number, number] = [axisDx / axisLength, axisDz / axisLength];
  // Großer Stern circle and the Siegessäule.
  const SX = AXIS_TO[0];
  const SZ = AXIS_TO[1];
  const BASE_PLATFORM_TOP_Y = GROUND_TOP + 1.4;
  const BASE_TOP_Y =
    BASE_PLATFORM_TOP_Y + SIEGESSAEULE_PROFILE.base.heightMApprox;
  const HALL_FLOOR_TOP_Y = BASE_TOP_Y + 0.62;
  const HALL_ROOF_BOTTOM_Y =
    HALL_FLOOR_TOP_Y + SIEGESSAEULE_PROFILE.colonnade.columnHeightM;
  const HALL_ROOF_THICKNESS_M = 0.7;
  const HALL_ROOF_TOP_Y = HALL_ROOF_BOTTOM_Y + HALL_ROOF_THICKNESS_M;
  const TARGET_TOP_Y = GROUND_TOP + SIEGESSAEULE_PROFILE.heightM;
  const DRUM_BAND_HEIGHT_M = 0.8;
  const COLUMN_CROWN_HEIGHT_M = 2.2;
  const DRUM_PROPORTIONS = [14, 13, 12, 11] as const;
  const DRUM_BODY_HEIGHT_M =
    TARGET_TOP_Y -
    HALL_ROOF_TOP_Y -
    DRUM_PROPORTIONS.length * DRUM_BAND_HEIGHT_M -
    COLUMN_CROWN_HEIGHT_M -
    GOLDELSE_HEIGHT_M;
  const drumProportionTotal = DRUM_PROPORTIONS.reduce(
    (total, proportion) => total + proportion,
    0,
  );
  group.userData.lowerRegisterMetrics = {
    baseTopY: BASE_TOP_Y,
    bronzeReliefCount: SIEGESSAEULE_PROFILE.reliefs.count,
    colonnadeColumnHeightM: HALL_ROOF_BOTTOM_Y - HALL_FLOOR_TOP_Y,
    colonnadeColumnCount: SIEGESSAEULE_PROFILE.colonnade.columnCount,
    groundTopY: GROUND_TOP,
    mosaicColourFieldCount: SIEGESSAEULE_PROFILE.mosaic.colourFieldCount,
    mosaicFigureCueCount: SIEGESSAEULE_PROFILE.mosaic.figureCueCount,
    mosaicMinY: HALL_FLOOR_TOP_Y + 0.25,
    mosaicMaxY: HALL_ROOF_BOTTOM_Y - 0.2,
    renderedHeightM: TARGET_TOP_Y - GROUND_TOP,
    renderedTopY: TARGET_TOP_Y,
  };
  addPart(
    prismTriangles(SX, GROUND_TOP - 1.3, SZ, 100, 3.2, 16),
    ISO_GROUND_SHADES.asphalt[1],
    false,
  );
  addPart(prismTriangles(SX, GROUND_TOP + 0.7, SZ, 22, 1.4, 12), 0xcbc8be);
  addPart(
    boxTriangles(
      SX,
      (BASE_PLATFORM_TOP_Y + BASE_TOP_Y) / 2,
      SZ,
      axis,
      SIEGESSAEULE_PROFILE.base.widthM,
      SIEGESSAEULE_PROFILE.base.heightMApprox,
      SIEGESSAEULE_PROFILE.base.widthM,
    ),
    0x855345,
  );
  // Four sandstone drums (the fourth was added when the column was moved in
  // 1938/39, taking it from 60.5 m to today's 67 m).
  const DRUMS = [4.4, 4.0, 3.6, 3.2].map(
    (radius, index) =>
      [
        radius,
        (DRUM_BODY_HEIGHT_M * DRUM_PROPORTIONS[index]) / drumProportionTotal,
      ] as const,
  );
  let columnBase = HALL_ROOF_TOP_Y;
  for (const [radius, height] of DRUMS) {
    addPart(
      prismTriangles(SX, columnBase + height / 2, SZ, radius, height, 12),
      0xc9b98f,
    );
    columnBase += height;
    addPart(
      prismTriangles(
        SX,
        columnBase + DRUM_BAND_HEIGHT_M / 2,
        SZ,
        radius + 0.5,
        DRUM_BAND_HEIGHT_M,
        12,
      ),
      0xd4af37,
    );
    columnBase += DRUM_BAND_HEIGHT_M;
  }
  addPart(
    prismTriangles(
      SX,
      columnBase + COLUMN_CROWN_HEIGHT_M / 2,
      SZ,
      4.6,
      COLUMN_CROWN_HEIGHT_M,
      12,
    ),
    0xcbc8be,
  );
  // Drake's gilded Viktoria. She faces west along the Straße des 17. Juni
  // axis towards Ernst-Reuter-Platz, as she has since the 1939 move from the
  // Königsplatz; `axis` runs Pariser Platz -> Großer Stern, so it already
  // points that way.
  const goldelse = createGoldelseFigure({
    base: [SX, columnBase + COLUMN_CROWN_HEIGHT_M, SZ],
    facing: axis,
  });
  for (const part of goldelse.parts) {
    addGoldelsePart(part.triangles, part.tone, part.inked !== false);
  }
  // Strack's documented apparatus: the gilded cannon barrels set into the
  // flutes, the four bronze reliefs inset into the lower square granite base,
  // and the circular colonnade with von Werner's glass mosaic one level
  // higher.  Keeping those registers separate is the key recognition cue.
  const monumentInk: number[] = [...goldelse.inkSegments];
  // Sixty captured gun barrels are gilded into the flutes of the lower three
  // drums; the fourth drum was added in 1938 and carries plain flutes.
  const BARRELS_PER_DRUM = 20;
  let fluteBase = HALL_ROOF_TOP_Y;
  DRUMS.forEach(([radius, height], drum) => {
    const gilded = drum < 3;
    const count = gilded ? BARRELS_PER_DRUM : 12;
    for (let flute = 0; flute < count; flute += 1) {
      const angle = (flute / count) * Math.PI * 2;
      const fx = SX + Math.cos(angle) * (radius + 0.04);
      const fz = SZ + Math.sin(angle) * (radius + 0.04);
      monumentInk.push(
        fx,
        fluteBase + 0.4,
        fz,
        fx,
        fluteBase + height - 0.4,
        fz,
      );
      if (gilded) {
        // The barrel itself, proud of the shaft: a slim gilded rod that reads
        // as a highlight in the flute rather than as a drawn line only.
        addPart(
          prismTriangles(
            SX + Math.cos(angle) * (radius + 0.12),
            fluteBase + height / 2,
            SZ + Math.sin(angle) * (radius + 0.12),
            0.17,
            height - 1.2,
            5,
          ),
          0xd4af37,
          false,
        );
      }
    }
    fluteBase += height + DRUM_BAND_HEIGHT_M;
  });
  const halfBase = SIEGESSAEULE_PROFILE.base.widthM / 2;
  const reliefY = BASE_PLATFORM_TOP_Y + 3.4;
  for (const y of [BASE_PLATFORM_TOP_Y + 0.75, BASE_TOP_Y - 0.75]) {
    for (const zSide of [-halfBase, halfBase]) {
      monumentInk.push(
        SX - halfBase,
        y,
        SZ + zSide,
        SX + halfBase,
        y,
        SZ + zSide,
      );
    }
    for (const xSide of [-halfBase, halfBase]) {
      monumentInk.push(
        SX + xSide,
        y,
        SZ - halfBase,
        SX + xSide,
        y,
        SZ + halfBase,
      );
    }
  }

  const acrossAxis: [number, number] = [-axis[1], axis[0]];
  // The square base follows the Straße-des-17.-Juni axis, so its reliefs
  // must use the same rotated face frame rather than world-cardinal planes.
  const reliefFaces = [
    { axis, normal: acrossAxis },
    { axis, normal: [-acrossAxis[0], -acrossAxis[1]] as [number, number] },
    { axis: acrossAxis, normal: axis },
    { axis: acrossAxis, normal: [-axis[0], -axis[1]] as [number, number] },
  ];
  for (const { axis: reliefAxis, normal } of reliefFaces) {
    const faceX = SX + normal[0] * (halfBase + 0.07);
    const faceZ = SZ + normal[1] * (halfBase + 0.07);
    const field = addDecorationPart(
      bronzeReliefGeometries,
      boxTriangles(
        faceX,
        reliefY,
        faceZ,
        reliefAxis,
        SIEGESSAEULE_PROFILE.reliefs.widthMApprox,
        SIEGESSAEULE_PROFILE.reliefs.heightMApprox,
        0.14,
      ),
      SIEGESSAEULE_BRONZE_TONES.field,
    );
    edgeGeometries.push(new EdgesGeometry(field, ISO_EDGE_THRESHOLD_DEGREES));
    // A shallow procession of alternating bodies and standards reads as
    // relief without reproducing, texturing or celebrating the battle scenes.
    for (let figure = 0; figure < 9; figure += 1) {
      const along = (figure - 4) * 1.12;
      const rise = ((figure * 5) % 3) * 0.18;
      const outward = halfBase + 0.16;
      const x = SX + reliefAxis[0] * along + normal[0] * outward;
      const z = SZ + reliefAxis[1] * along + normal[1] * outward;
      addDecorationPart(
        bronzeReliefGeometries,
        boxTriangles(
          x,
          reliefY - 0.18 + rise,
          z,
          reliefAxis,
          figure % 3 === 0 ? 0.72 : 0.5,
          0.72 + rise,
          0.12,
        ),
        SIEGESSAEULE_BRONZE_TONES.highlight,
      );
    }
  }

  // The square relief-bearing base finishes first.  The 15.7 m circular hall
  // then rises on it; its 16 columns are not a ground-level outer ring.
  const hallRadius = SIEGESSAEULE_PROFILE.colonnade.diameterM / 2;
  addPart(
    prismTriangles(
      SX,
      (BASE_TOP_Y + HALL_FLOOR_TOP_Y) / 2,
      SZ,
      hallRadius + 0.9,
      HALL_FLOOR_TOP_Y - BASE_TOP_Y,
      32,
    ),
    0xbcb8ae,
  );
  const shaftBottomY = HALL_FLOOR_TOP_Y;
  const shaftTopY = HALL_ROOF_BOTTOM_Y;
  const capitalHeight = 0.38;
  const baseHeight = 0.38;
  const columnShaftBottomY = HALL_FLOOR_TOP_Y + baseHeight;
  const columnShaftTopY = HALL_ROOF_BOTTOM_Y - capitalHeight;
  for (
    let column = 0;
    column < SIEGESSAEULE_PROFILE.colonnade.columnCount;
    column += 1
  ) {
    const angle =
      (column / SIEGESSAEULE_PROFILE.colonnade.columnCount) * Math.PI * 2;
    const cxx = SX + Math.cos(angle) * hallRadius;
    const czz = SZ + Math.sin(angle) * hallRadius;
    addPart(
      prismTriangles(
        cxx,
        (columnShaftBottomY + columnShaftTopY) / 2,
        czz,
        0.38,
        columnShaftTopY - columnShaftBottomY,
        8,
      ),
      0xcbc8be,
    );
    addPart(
      prismTriangles(
        cxx,
        HALL_FLOOR_TOP_Y + baseHeight / 2,
        czz,
        0.55,
        baseHeight,
        8,
      ),
      0xd6d2c7,
    );
    addPart(
      prismTriangles(
        cxx,
        HALL_ROOF_BOTTOM_Y - capitalHeight / 2,
        czz,
        0.58,
        capitalHeight,
        8,
      ),
      0xd6d2c7,
    );
  }
  addPart(
    prismTriangles(
      SX,
      (HALL_ROOF_BOTTOM_Y + HALL_ROOF_TOP_Y) / 2,
      SZ,
      hallRadius + 1.08,
      HALL_ROOF_TOP_Y - HALL_ROOF_BOTTOM_Y,
      32,
    ),
    0xbfbcb2,
  );

  // Antonio Salviati's glass mosaic (1873-76, after Anton von Werner's
  // cartoon) covers the outward face of the inner shaft, behind the columns.
  // It is one continuous narrative, so the cue uses irregular polychrome
  // fields and small figure silhouettes rather than false panel divisions.
  const mosaicRadius = 5.42;
  const mosaicMinY = HALL_FLOOR_TOP_Y + 0.25;
  const mosaicMaxY = HALL_ROOF_BOTTOM_Y - 0.2;
  addDecorationPart(
    mosaicGeometries,
    prismTriangles(
      SX,
      (shaftBottomY + shaftTopY) / 2,
      SZ,
      mosaicRadius,
      shaftTopY - shaftBottomY,
      48,
    ),
    SIEGESSAEULE_MOSAIC_TONES[0],
  );
  for (
    let field = 0;
    field < SIEGESSAEULE_PROFILE.mosaic.colourFieldCount;
    field += 1
  ) {
    const angle =
      ((field + 0.5) / SIEGESSAEULE_PROFILE.mosaic.colourFieldCount) *
      Math.PI *
      2;
    const tangent: [number, number] = [-Math.sin(angle), Math.cos(angle)];
    const radius = mosaicRadius + 0.065;
    const height = 0.42 + ((field * 7) % 4) * 0.1;
    const y = mosaicMinY + 0.38 + ((field * 5) % 4) * 0.58;
    addDecorationPart(
      mosaicGeometries,
      boxTriangles(
        SX + Math.cos(angle) * radius,
        Math.min(y, mosaicMaxY - height / 2),
        SZ + Math.sin(angle) * radius,
        tangent,
        0.66 + (field % 3) * 0.09,
        height,
        0.1,
      ),
      SIEGESSAEULE_MOSAIC_TONES[
        1 + (field % (SIEGESSAEULE_MOSAIC_TONES.length - 1))
      ],
    );
  }
  for (
    let figure = 0;
    figure < SIEGESSAEULE_PROFILE.mosaic.figureCueCount;
    figure += 1
  ) {
    const angle =
      ((figure + 0.35) / SIEGESSAEULE_PROFILE.mosaic.figureCueCount) *
      Math.PI *
      2;
    const tangent: [number, number] = [-Math.sin(angle), Math.cos(angle)];
    const radius = mosaicRadius + 0.13;
    const bodyHeight = 0.72 + (figure % 4) * 0.08;
    const bodyY = mosaicMinY + 0.55 + ((figure * 3) % 2) * 0.28;
    const tone =
      SIEGESSAEULE_MOSAIC_TONES[
        1 + ((figure + 2) % (SIEGESSAEULE_MOSAIC_TONES.length - 1))
      ];
    addDecorationPart(
      mosaicGeometries,
      boxTriangles(
        SX + Math.cos(angle) * radius,
        bodyY,
        SZ + Math.sin(angle) * radius,
        tangent,
        0.24,
        bodyHeight,
        0.1,
      ),
      tone,
    );
    addDecorationPart(
      mosaicGeometries,
      prismTriangles(
        SX + Math.cos(angle) * radius,
        bodyY + bodyHeight / 2 + 0.13,
        SZ + Math.sin(angle) * radius,
        0.13,
        0.24,
        6,
      ),
      tone,
    );
  }
  for (const y of [mosaicMinY, mosaicMaxY]) {
    for (let step = 0; step < 32; step += 1) {
      const a0 = (step / 32) * Math.PI * 2;
      const a1 = ((step + 1) / 32) * Math.PI * 2;
      monumentInk.push(
        SX + Math.cos(a0) * (mosaicRadius + 0.08),
        y,
        SZ + Math.sin(a0) * (mosaicRadius + 0.08),
        SX + Math.cos(a1) * (mosaicRadius + 0.08),
        y,
        SZ + Math.sin(a1) * (mosaicRadius + 0.08),
      );
    }
  }

  // Bismarck-Nationaldenkmal (Begas, 1901): granite pedestal, bronze
  // chancellor in his cuirassier's coat resting on the Reichsschwert,
  // four allegorical bronze groups at the corners (Kraft, Weisheit,
  // Staatengruendung/Gesetzgebung -- represented as figure-bearing
  // plinths rather than plain cubes). Reference:
  // https://de.wikipedia.org/wiki/Bismarck-Nationaldenkmal_(Berlin)
  const BX = SX + 24;
  const BZ = SZ - 118;
  addPart(
    boxTriangles(BX, GROUND_TOP + 1.1, BZ, [1, 0], 22, 2.2, 22),
    0xcbc8be,
  );
  addPart(
    boxTriangles(BX, GROUND_TOP + 6.2, BZ, [1, 0], 9.6, 8, 9.6),
    0x9a5f4c,
  );
  // Chancellor figure on the pedestal: long coat (wide at the hem,
  // narrowing toward the shoulders), shoulder block, head, and the
  // Reichsschwert he leans on at his side.
  addPart(
    boxTriangles(BX, GROUND_TOP + 11.2, BZ, [1, 0], 3.6, 4.6, 2.4),
    0x5d7264,
  ); // coat, hem-to-waist
  addPart(
    boxTriangles(BX, GROUND_TOP + 13.9, BZ, [1, 0], 2.7, 1.2, 2.1),
    0x5d7264,
  ); // chest/shoulders
  addPart(
    boxTriangles(BX, GROUND_TOP + 14.75, BZ, [1, 0], 1.0, 1.0, 1.0),
    0x5d7264,
  ); // head
  addPart(
    boxTriangles(
      BX + 1.5,
      GROUND_TOP + 10.6,
      BZ + 0.6,
      [1, 0],
      0.32,
      5.4,
      0.32,
    ),
    0x4a5b50,
  ); // Reichsschwert, point resting near the feet
  for (const cornerX of [-1, 1]) {
    for (const cornerZ of [-1, 1]) {
      const cx = BX + cornerX * 8.2;
      const cz = BZ + cornerZ * 8.2;
      addPart(
        boxTriangles(cx, GROUND_TOP + 2.9, cz, [1, 0], 3.6, 1.6, 3.6),
        0x5d7264,
      ); // plinth
      addPart(
        boxTriangles(cx, GROUND_TOP + 4.7, cz, [1, 0], 1.6, 2.0, 1.4),
        0x5d7264,
      ); // seated allegorical torso
      addPart(
        boxTriangles(cx, GROUND_TOP + 5.85, cz, [1, 0], 0.7, 0.7, 0.7),
        0x5d7264,
      ); // head
    }
  }
  const bismarckGeometry = new BufferGeometry();
  bismarckGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(monumentInk, 3),
  );
  edgeGeometries.push(bismarckGeometry);
  const addMergedDecoration = (
    name: string,
    geometries: BufferGeometry[],
    architecturalLevel: string,
    metalness: number,
    roughness: number,
  ): void => {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) return;
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness,
      roughness,
      vertexColors: true,
    });
    const mesh = new Mesh(geometry, dayMaterial);
    mesh.name = name;
    mesh.renderOrder = 1;
    mesh.userData.animated = false;
    mesh.userData.architecturalLevel = architecturalLevel;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.staticDecoration = true;
    mesh.userData.textureFree = true;
    group.add(mesh);
    for (const sourceGeometry of geometries) sourceGeometry.dispose();
  };
  addMergedDecoration(
    "Siegessäule lower bronze relief bodies",
    bronzeReliefGeometries,
    SIEGESSAEULE_PROFILE.reliefs.architecturalLevel,
    0.52,
    0.56,
  );
  addMergedDecoration(
    "Siegessäule Anton von Werner glass mosaic bodies",
    mosaicGeometries,
    SIEGESSAEULE_PROFILE.mosaic.architecturalLevel,
    0.08,
    0.48,
  );
  const mergedGoldelse = mergeGeometries(goldelseGeometries, false);
  if (mergedGoldelse) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshBasicMaterial({
      color: 0xffefc2,
      vertexColors: true,
    });
    const mesh = new Mesh(mergedGoldelse, dayMaterial);
    mesh.name = "Goldelse gilded Viktoria bodies";
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.schwellenraumGeschuetzt = true;
    mesh.userData.textureFree = true;
    group.add(mesh);
    for (const geometry of goldelseGeometries) geometry.dispose();
  }
  const merged = mergeGeometries(bodyGeometries, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "Siegessäule and Bismarck bodies";
    group.add(mesh);
    for (const geometry of bodyGeometries) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edgeGeometries, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    lines.name = "Siegessäule and Bismarck ink lines";
    lines.renderOrder = 2;
    group.add(lines);
  }
  return group;
}

/**
 * Non-geographic presentation floor below the complete metric model. Camera
 * targets are bounded to the published 2310 m data envelope, but a distant
 * oblique lens can still see beyond that envelope. This unlit paper stage
 * prevents the sky from showing through behind edge trees without pretending
 * that the stage contains surveyed roads, buildings or vegetation.
 */
function createPresentationBackdrop(): Mesh {
  const geometry = new PlaneGeometry(16_000, 16_000);
  geometry.rotateX(-Math.PI / 2);
  const dayMaterial = new MeshBasicMaterial({ color: 0xe9efe4 });
  const nightMaterial = new MeshBasicMaterial({ color: 0x07131f });
  const backdrop = new Mesh(geometry, dayMaterial);
  backdrop.name = "presentation paper backdrop";
  backdrop.position.set(-220, PRESENTATION_FLOOR_Y_M, 210);
  backdrop.receiveShadow = false;
  backdrop.userData.dayMaterial = dayMaterial;
  backdrop.userData.nightMaterial = nightMaterial;
  backdrop.userData.presentationOnly = true;
  return backdrop;
}

/** Source identifiers kept as compatibility exports for scene and tests. */
export const ADLON_LOD2_ID = HOTEL_ADLON_PROFILE.lod2BuildingId;
export const ADLON_WORLD: [number, number] = [
  ...HOTEL_ADLON_PROFILE.front.centerWorldM,
];

type AdlonFrame = {
  axis: readonly [number, number];
  center: readonly [number, number];
  inward: readonly [number, number];
  rotationY: number;
};

type AdlonPoint3 = readonly [number, number, number];

const ADLON_LETTER_PIXELS: Readonly<Record<string, readonly string[]>> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};

function adlonFramePoint(
  frame: AdlonFrame,
  alongM: number,
  inwardM: number,
): readonly [number, number] {
  return [
    frame.center[0] + frame.axis[0] * alongM + frame.inward[0] * inwardM,
    frame.center[1] + frame.axis[1] * alongM + frame.inward[1] * inwardM,
  ];
}

function adlonFrameFromSegment(
  start: readonly [number, number],
  end: readonly [number, number],
  centerDistanceM?: number,
): AdlonFrame {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthM = Math.hypot(dx, dz);
  const axis = [dx / lengthM, dz / lengthM] as const;
  const centerM = centerDistanceM ?? lengthM / 2;
  return {
    axis,
    center: [start[0] + axis[0] * centerM, start[1] + axis[1] * centerM],
    inward: [-axis[1], axis[0]],
    rotationY: Math.atan2(-axis[1], axis[0]),
  };
}

function adlonPointAlongSegment(
  start: readonly [number, number],
  end: readonly [number, number],
  distanceM: number,
): readonly [number, number] {
  return adlonFrameFromSegment(start, end, distanceM).center;
}

function addAdlonGeometry(
  builder: Builder,
  geometry: BufferGeometry,
  color: number,
  bucket: "lamps" | "parts" = "parts",
  inked = false,
): void {
  // BoxGeometry is indexed while ExtrudeGeometry and the faceted mansard are
  // not. drawnKit deliberately rejects mixed merge inputs, so normalize every
  // Adlon part to the same compact position/normal/color attribute contract.
  const mergeGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const attributeName of Object.keys(mergeGeometry.attributes)) {
    if (attributeName !== "position" && attributeName !== "normal") {
      mergeGeometry.deleteAttribute(attributeName);
    }
  }
  if (!mergeGeometry.getAttribute("normal")) {
    mergeGeometry.computeVertexNormals();
  }
  paintGeometry(mergeGeometry, color);
  builder[bucket].push(mergeGeometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(mergeGeometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
  if (mergeGeometry !== geometry) geometry.dispose();
}

function addAdlonFrameBox(
  builder: Builder,
  frame: AdlonFrame,
  color: number,
  alongM: number,
  y: number,
  inwardM: number,
  widthM: number,
  heightM: number,
  depthM: number,
  bucket: "lamps" | "parts" = "parts",
  inked = false,
): void {
  const [x, z] = adlonFramePoint(frame, alongM, inwardM);
  const geometry = new BoxGeometry(widthM, heightM, depthM);
  geometry.rotateY(frame.rotationY);
  geometry.translate(x, y, z);
  addAdlonGeometry(builder, geometry, color, bucket, inked);
}

function addAdlonArch(
  builder: Builder,
  frame: AdlonFrame,
  alongM: number,
  widthM: number,
  baseY: number,
  springY: number,
  inwardM: number,
): void {
  const radius = widthM / 2;
  const shape = new Shape();
  shape.moveTo(alongM - radius, baseY);
  shape.lineTo(alongM + radius, baseY);
  shape.lineTo(alongM + radius, springY);
  shape.absarc(alongM, springY, radius, 0, Math.PI, false);
  shape.lineTo(alongM - radius, baseY);
  const depthM = 0.22;
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: depthM,
  });
  geometry.translate(0, 0, inwardM - depthM / 2);
  geometry.rotateY(frame.rotationY);
  geometry.translate(frame.center[0], 0, frame.center[1]);
  addAdlonGeometry(builder, geometry, 0x314248, "lamps", true);
}

function adlonMansardGeometry(): BufferGeometry {
  const { eavesWorldY, ridgeWorldY } = HOTEL_ADLON_PROFILE.heights;
  const depthM = HOTEL_ADLON_PROFILE.publicFacade.frontHeadDepthM;
  const westBack = adlonPointAlongSegment(
    HOTEL_ADLON_PROFILE.returns.west.startWorldM,
    HOTEL_ADLON_PROFILE.returns.west.endWorldM,
    depthM,
  );
  const eastBack = adlonPointAlongSegment(
    HOTEL_ADLON_PROFILE.returns.east.startWorldM,
    HOTEL_ADLON_PROFILE.returns.east.endWorldM,
    depthM,
  );
  const outer: AdlonPoint3[] = [
    [
      HOTEL_ADLON_PROFILE.front.westWorldM[0],
      eavesWorldY,
      HOTEL_ADLON_PROFILE.front.westWorldM[1],
    ],
    [
      HOTEL_ADLON_PROFILE.front.eastWorldM[0],
      eavesWorldY,
      HOTEL_ADLON_PROFILE.front.eastWorldM[1],
    ],
    [eastBack[0], eavesWorldY, eastBack[1]],
    [westBack[0], eavesWorldY, westBack[1]],
  ];
  const shoulderY = 31.45;
  const centreX = outer.reduce((sum, point) => sum + point[0], 0) / 4;
  const centreZ = outer.reduce((sum, point) => sum + point[2], 0) / 4;
  const shoulder = outer.map((point): AdlonPoint3 => {
    const dx = centreX - point[0];
    const dz = centreZ - point[2];
    const lengthM = Math.hypot(dx, dz);
    return [
      point[0] + (dx / lengthM) * 3.1,
      shoulderY,
      point[2] + (dz / lengthM) * 3.1,
    ];
  });
  const leftMid = [
    (shoulder[0][0] + shoulder[3][0]) / 2,
    (shoulder[0][2] + shoulder[3][2]) / 2,
  ] as const;
  const rightMid = [
    (shoulder[1][0] + shoulder[2][0]) / 2,
    (shoulder[1][2] + shoulder[2][2]) / 2,
  ] as const;
  const ridgeDx = rightMid[0] - leftMid[0];
  const ridgeDz = rightMid[1] - leftMid[1];
  const ridgeLengthM = Math.hypot(ridgeDx, ridgeDz);
  const ridgeAxis = [ridgeDx / ridgeLengthM, ridgeDz / ridgeLengthM] as const;
  const ridge: [AdlonPoint3, AdlonPoint3] = [
    [
      leftMid[0] + ridgeAxis[0] * 5.7,
      ridgeWorldY,
      leftMid[1] + ridgeAxis[1] * 5.7,
    ],
    [
      rightMid[0] - ridgeAxis[0] * 5.7,
      ridgeWorldY,
      rightMid[1] - ridgeAxis[1] * 5.7,
    ],
  ];
  const positions: number[] = [];
  const addTriangle = (
    a: AdlonPoint3,
    b: AdlonPoint3,
    c: AdlonPoint3,
  ): void => {
    positions.push(...a, ...b, ...c);
  };
  const addQuad = (
    a: AdlonPoint3,
    b: AdlonPoint3,
    c: AdlonPoint3,
    d: AdlonPoint3,
  ): void => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  addQuad(outer[0], outer[1], shoulder[1], shoulder[0]);
  addQuad(outer[1], outer[2], shoulder[2], shoulder[1]);
  addQuad(outer[2], outer[3], shoulder[3], shoulder[2]);
  addQuad(outer[3], outer[0], shoulder[0], shoulder[3]);
  addQuad(shoulder[0], shoulder[1], ridge[1], ridge[0]);
  addQuad(shoulder[2], shoulder[3], ridge[0], ridge[1]);
  addTriangle(shoulder[3], shoulder[0], ridge[0]);
  addTriangle(shoulder[1], shoulder[2], ridge[1]);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function addAdlonOpenLettering(
  builder: Builder,
  frame: AdlonFrame,
  centerAlongM: number,
  baselineY: number,
  inwardM: number,
): void {
  const text = "HOTEL ADLON";
  const pixelWidthM = 0.13;
  const pixelHeightM = 0.16;
  const columnStepM = 0.17;
  const rowStepM = 0.18;
  const glyphAdvanceM = 1.02;
  const spaceAdvanceM = 0.62;
  const totalWidthM = [...text].reduce(
    (width, character) =>
      width + (character === " " ? spaceAdvanceM : glyphAdvanceM),
    0,
  );
  let cursorM = centerAlongM - totalWidthM / 2;
  for (const character of text) {
    if (character === " ") {
      cursorM += spaceAdvanceM;
      continue;
    }
    const rows = ADLON_LETTER_PIXELS[character];
    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < rows[row].length; column += 1) {
        if (rows[row][column] !== "1") continue;
        addAdlonFrameBox(
          builder,
          frame,
          0xc49a54,
          cursorM + column * columnStepM,
          baselineY + (6 - row) * rowStepM,
          inwardM,
          pixelWidthM,
          pixelHeightM,
          0.12,
          "lamps",
        );
      }
    }
    cursorM += glyphAdvanceM;
  }
}

function addAdlonMarker(
  group: Group,
  name: string,
  metadata: Record<string, unknown>,
): void {
  const marker = new Group();
  marker.name = name;
  marker.userData = metadata;
  group.add(marker);
}

/**
 * Source-bound Hotel Adlon recognition layer.
 *
 * The committed low LoD2 prism remains untouched. This model adds a thin
 * facade veneer on the exact OSM front bearing plus the missing roof volume;
 * it never builds a second courtyard block or suppresses source geometry.
 */
export function createHotelAdlon(): Group {
  const profile = HOTEL_ADLON_PROFILE;
  const front: AdlonFrame = {
    axis: profile.front.axisWorld,
    center: profile.front.centerWorldM,
    inward: [
      -profile.front.outwardNormalWorld[0],
      -profile.front.outwardNormalWorld[1],
    ],
    rotationY: profile.front.rotationY,
  };
  const builder = createBuilder();
  const facade = 0xf3e0c8;
  const stoneLight = 0xeadcc5;
  const rustica = 0xd9c8ad;
  const windowSurround = 0xded2bd;
  const wroughtIron = 0x303735;
  const roof = 0x668574;
  const roofDark = 0x4f6d61;
  const awning = 0x983c36;
  const groundY = profile.heights.groundWorldY;
  const eavesY = profile.heights.eavesWorldY;
  const facadeHeightM = eavesY - groundY;

  // A 28 cm facade skin follows the measured front axis. It is intentionally
  // too thin to act as a second building mass over the retained LoD2 shell.
  addAdlonFrameBox(
    builder,
    front,
    facade,
    0,
    groundY + facadeHeightM / 2,
    -0.12,
    profile.front.lengthM,
    facadeHeightM,
    0.28,
    "parts",
    true,
  );
  addAdlonFrameBox(
    builder,
    front,
    rustica,
    0,
    8.05,
    -0.31,
    profile.front.lengthM + 0.1,
    6.5,
    0.18,
  );

  // Five tall ground-floor arches. The centre bay carries the real entrance
  // hierarchy instead of the former opaque rectangular portico.
  const archCentresM = [-25.2, -12.6, 0, 12.6, 25.2] as const;
  archCentresM.forEach((alongM, index) => {
    addAdlonArch(
      builder,
      front,
      alongM,
      index === 2 ? 8.4 : 7.35,
      groundY + 0.35,
      groundY + 3.0,
      -0.47,
    );
  });
  // Entrance doors and brass centre stile remain visible under the canopy.
  for (const alongM of [-2.1, 0, 2.1]) {
    addAdlonFrameBox(
      builder,
      front,
      0x23363b,
      alongM,
      groundY + 2.35,
      -0.62,
      1.75,
      4.35,
      0.12,
      "lamps",
    );
  }
  addAdlonFrameBox(
    builder,
    front,
    0xb79052,
    0,
    groundY + 2.4,
    -0.72,
    0.16,
    4.4,
    0.12,
  );

  // Belt courses preserve the six-level reading without manufacturing a
  // duplicate deep shell.
  for (const [y, height, depth] of [
    [groundY + 6.55, 0.32, 0.38],
    [groundY + 9.55, 0.26, 0.32],
    [groundY + 12.55, 0.22, 0.3],
    [eavesY - 0.22, 0.5, 0.5],
  ] as const) {
    addAdlonFrameBox(
      builder,
      front,
      stoneLight,
      0,
      y,
      -depth / 2 - 0.23,
      profile.front.lengthM + 0.5,
      height,
      depth,
      "parts",
      true,
    );
  }

  const addWindow = (
    windowPlane: AdlonFrame,
    alongM: number,
    y: number,
    widthM: number,
    heightM: number,
  ): void => {
    addAdlonFrameBox(
      builder,
      windowPlane,
      0x536970,
      alongM,
      y,
      -0.49,
      widthM,
      heightM,
      0.12,
      "lamps",
    );
    const frameDepth = -0.58;
    for (const side of [-1, 1]) {
      addAdlonFrameBox(
        builder,
        windowPlane,
        windowSurround,
        alongM + (side * (widthM + 0.24)) / 2,
        y,
        frameDepth,
        0.24,
        heightM + 0.3,
        0.12,
      );
    }
    for (const vertical of [-1, 1]) {
      addAdlonFrameBox(
        builder,
        windowPlane,
        windowSurround,
        alongM,
        y + (vertical * (heightM + 0.24)) / 2,
        frameDepth,
        widthM + 0.48,
        0.24,
        0.12,
      );
    }
    addAdlonFrameBox(
      builder,
      windowPlane,
      0xc9c6b7,
      alongM,
      y,
      -0.64,
      0.08,
      heightM,
      0.08,
    );
  };

  // The compact mezzanine carries eleven smaller openings; the four upper
  // registers use nine alternating wide/narrow French-window axes.
  for (let index = 0; index < 11; index += 1) {
    addWindow(front, -29.5 + index * 5.9, 12.45, 2.45, 1.75);
  }
  const upperRows = [15.65, 18.85, 22.0, 25.05] as const;
  for (const y of upperRows) {
    profile.publicFacade.frontWindowAxesM.forEach((alongM, index) => {
      addWindow(front, alongM, y, index % 2 === 0 ? 3.25 : 2.25, 2.35);
    });
  }

  // Wrought-iron balconettes and the characteristic long upper gallery.
  for (const y of [17.0, 20.2]) {
    profile.publicFacade.frontWindowAxesM.forEach((alongM, index) => {
      if (index % 2 !== 0) return;
      addAdlonFrameBox(
        builder,
        front,
        wroughtIron,
        alongM,
        y,
        -0.82,
        3.8,
        0.12,
        0.12,
      );
      for (const offsetM of [-1.55, -0.78, 0, 0.78, 1.55]) {
        addAdlonFrameBox(
          builder,
          front,
          wroughtIron,
          alongM + offsetM,
          y + 0.42,
          -0.81,
          0.08,
          0.82,
          0.08,
        );
      }
    });
  }
  for (const y of [23.45, 24.05, 24.65]) {
    addAdlonFrameBox(
      builder,
      front,
      wroughtIron,
      0,
      y,
      -0.84,
      profile.front.lengthM - 1.8,
      0.08,
      0.08,
    );
  }
  for (let alongM = -32; alongM <= 32; alongM += 2.9) {
    addAdlonFrameBox(
      builder,
      front,
      wroughtIron,
      alongM,
      24.05,
      -0.84,
      0.07,
      1.25,
      0.07,
    );
  }

  // The July-2006 wine-red entrance canopy, Quarré awnings and a deliberately
  // compact current terrace reading remain one batched facade layer.
  addAdlonFrameBox(
    builder,
    front,
    awning,
    0,
    9.1,
    -2.45,
    11.8,
    0.34,
    4.5,
    "parts",
    true,
  );
  addAdlonFrameBox(builder, front, 0x7d302f, 0, 8.72, -4.66, 11.8, 0.72, 0.18);
  for (const alongM of [-25.2, -12.6, 12.6, 25.2]) {
    addAdlonFrameBox(
      builder,
      front,
      awning,
      alongM,
      8.0,
      -1.55,
      7.1,
      0.25,
      2.45,
    );
  }
  for (const alongM of [-22, -10.5, 10.5, 22]) {
    addAdlonFrameBox(
      builder,
      front,
      0x9f4740,
      alongM,
      7.65,
      -5.7,
      5.2,
      0.2,
      3.1,
    );
    addAdlonFrameBox(
      builder,
      front,
      wroughtIron,
      alongM,
      6.15,
      -5.7,
      0.12,
      3,
      0.12,
    );
  }
  addAdlonFrameBox(builder, front, 0x556146, 0, 5.55, -7.25, 55, 0.75, 0.65);

  // The retained LoD2 shell ends below the eaves. Three 28 cm skins close
  // only that missing upper head (both real OSM return bearings plus its rear
  // seam), keeping the supplement hollow instead of adding a massive second
  // building over the authoritative source footprint.
  const headDepthM = profile.publicFacade.frontHeadDepthM;
  const sourceTopY = groundY + profile.heights.lod2MeasuredHeightM;
  const upperHeadHeightM = eavesY - sourceTopY;
  const eastReturnFrame = adlonFrameFromSegment(
    profile.returns.east.startWorldM,
    profile.returns.east.endWorldM,
    headDepthM / 2,
  );
  const westReturnFrame = adlonFrameFromSegment(
    profile.returns.west.startWorldM,
    profile.returns.west.endWorldM,
    headDepthM / 2,
  );
  for (const returnFrame of [westReturnFrame, eastReturnFrame]) {
    addAdlonFrameBox(
      builder,
      returnFrame,
      facade,
      0,
      sourceTopY + upperHeadHeightM / 2,
      0,
      headDepthM,
      upperHeadHeightM,
      0.28,
      "parts",
      true,
    );
  }
  const westBack = adlonPointAlongSegment(
    profile.returns.west.startWorldM,
    profile.returns.west.endWorldM,
    headDepthM,
  );
  const eastBack = adlonPointAlongSegment(
    profile.returns.east.startWorldM,
    profile.returns.east.endWorldM,
    headDepthM,
  );
  const rearFrame = adlonFrameFromSegment(westBack, eastBack);
  addAdlonFrameBox(
    builder,
    rearFrame,
    facade,
    0,
    sourceTopY + upperHeadHeightM / 2,
    0,
    Math.hypot(eastBack[0] - westBack[0], eastBack[1] - westBack[1]),
    upperHeadHeightM,
    0.28,
    "parts",
    true,
  );

  // The freely licensed 2024 east-return view resolves the upper facade as
  // repeated French-window axes with belt courses, wrought balconettes and
  // dormers. Keep those cues in the existing batches; the west return remains
  // plain because the selected references do not establish the same detail.
  const eastUpperWindowAxesM = [-7.8, -2.6, 2.6, 7.8] as const;
  for (const y of [18.45, 21.65, 24.85]) {
    for (const alongM of eastUpperWindowAxesM) {
      addWindow(eastReturnFrame, alongM, y, 3.05, 2.2);
    }
  }
  for (const y of [19.95, 23.15, eavesY - 0.22]) {
    addAdlonFrameBox(
      builder,
      eastReturnFrame,
      stoneLight,
      0,
      y,
      -0.16,
      headDepthM + 0.3,
      0.22,
      0.34,
      "parts",
      true,
    );
  }
  for (const railY of [20.55, 23.75]) {
    for (const offsetY of [0, 0.58]) {
      addAdlonFrameBox(
        builder,
        eastReturnFrame,
        wroughtIron,
        0,
        railY + offsetY,
        -0.48,
        headDepthM - 1.2,
        0.08,
        0.08,
      );
    }
    for (let alongM = -9.6; alongM <= 9.6; alongM += 1.2) {
      addAdlonFrameBox(
        builder,
        eastReturnFrame,
        wroughtIron,
        alongM,
        railY + 0.29,
        -0.48,
        0.07,
        0.66,
        0.07,
      );
    }
  }

  // One closed, faceted mansard/hip surface replaces the previous green
  // boxes. Eight dormers, standing seams and rainwater goods remain legible.
  addAdlonGeometry(builder, adlonMansardGeometry(), roof, "parts", true);
  const dormerAxesM = [-29, -21, -13, -4.5, 4.5, 13, 21, 29] as const;
  for (const alongM of dormerAxesM) {
    addAdlonFrameBox(
      builder,
      front,
      roofDark,
      alongM,
      29.95,
      1.25,
      3.15,
      2.7,
      2.2,
      "parts",
      true,
    );
    addAdlonFrameBox(
      builder,
      front,
      0x526b73,
      alongM,
      29.75,
      0.1,
      1.95,
      1.55,
      0.12,
      "lamps",
    );
  }
  const eastDormerAxesM = [-6.8, 0, 6.8] as const;
  for (const alongM of eastDormerAxesM) {
    addAdlonFrameBox(
      builder,
      eastReturnFrame,
      roofDark,
      alongM,
      29.95,
      1.2,
      3.15,
      2.7,
      2.2,
      "parts",
      true,
    );
    addAdlonFrameBox(
      builder,
      eastReturnFrame,
      0x526b73,
      alongM,
      29.75,
      0.05,
      1.95,
      1.55,
      0.12,
      "lamps",
    );
  }
  for (let alongM = -32; alongM <= 32; alongM += 4) {
    addAdlonFrameBox(
      builder,
      front,
      roofDark,
      alongM,
      29.15,
      1.45,
      0.08,
      3.65,
      0.08,
    );
  }
  addAdlonFrameBox(
    builder,
    front,
    roofDark,
    0,
    eavesY + 0.08,
    -0.27,
    profile.front.lengthM + 0.25,
    0.18,
    0.22,
  );
  for (const alongM of [-27.8, -14, 0, 14, 27.8]) {
    addAdlonFrameBox(
      builder,
      front,
      roofDark,
      alongM,
      17.2,
      -0.72,
      0.13,
      19.9,
      0.13,
    );
  }

  // Three static roof flags and two open, code-native HOTEL ADLON signs are
  // merged into the existing body/lamp batches rather than adding draw calls.
  const flagColors = [0x1f2f5c, 0x272727, 0xffffff] as const;
  [-27, 0, 27].forEach((alongM, index) => {
    addAdlonFrameBox(
      builder,
      front,
      0x6f8278,
      alongM,
      36.8,
      11,
      0.12,
      5.6,
      0.12,
    );
    addAdlonFrameBox(
      builder,
      front,
      flagColors[index],
      alongM + 1.05,
      38.55,
      11,
      2,
      1.05,
      0.08,
    );
  });
  addAdlonOpenLettering(builder, front, 0, 34.45, 10.8);
  addAdlonOpenLettering(builder, eastReturnFrame, 0, 33.7, -3.2);

  const group =
    finishDrawnGroup(builder, {
      lampEmissive: 0xffd69a,
      lampEmissiveIntensity: 0.62,
      name: "Adlon",
    }) ?? new Group();
  group.name = "LoD2-anchored Hotel Adlon recognition layer";
  group.userData.extrapolated = false;
  group.userData.lod2BuildingId = ADLON_LOD2_ID;
  group.userData.geometryStatus =
    "retained Berlin LoD2 source shell with exact OSM-front facade veneer, photo-bounded mansard and no raster texture";
  group.userData.sourceProfile = HOTEL_ADLON_PROFILE;
  group.userData.drawCallBudget = 4;
  group.userData.facadeSkinDepthM = 0.28;
  group.userData.hasCornerRisalit = false;
  group.userData.frontBearingDegreesXZ = profile.front.bearingDegreesXZ;
  group.userData.upperHeadClosedWithHollowSkins = true;
  group.userData.eastLetteringFrame = {
    axisWorld: eastReturnFrame.axis,
    bearingDegreesXZ: profile.returns.east.bearingDegreesXZ,
    endWorldM: profile.returns.east.endWorldM,
    startWorldM: profile.returns.east.startWorldM,
  };
  group.userData.sourcePrismSuppressed = false;

  const body = group.getObjectByName("Adlon bodies");
  if (body instanceof Mesh) {
    const dayMaterial = body.userData.dayMaterial as MeshBasicMaterial;
    const nightMaterial = body.userData.nightMaterial as MeshStandardMaterial;
    dayMaterial.side = DoubleSide;
    nightMaterial.side = DoubleSide;
  }
  const ink = group.getObjectByName("Adlon ink lines");
  if (ink instanceof LineSegments) {
    markArchitecturalInk(ink.material as LineBasicMaterial, "silhouette");
  }

  for (let index = 0; index < 3; index += 1) {
    addAdlonMarker(group, `Adlon flagpole ${index + 1}`, {
      codeNative: true,
      staticInSchwellenraum: true,
    });
  }
  addAdlonMarker(group, "Adlon open HOTEL ADLON lettering front", {
    codeNative: true,
    facade: "Pariser Platz",
  });
  addAdlonMarker(group, "Adlon open HOTEL ADLON lettering east", {
    axisWorld: eastReturnFrame.axis,
    bearingDegreesXZ: profile.returns.east.bearingDegreesXZ,
    codeNative: true,
    endWorldM: profile.returns.east.endWorldM,
    facade: "east return",
    startWorldM: profile.returns.east.startWorldM,
  });
  dormerAxesM.forEach((alongM, index) => {
    addAdlonMarker(group, `Adlon front dormer ${index + 1}`, {
      alongM,
      codeNative: true,
    });
  });
  eastDormerAxesM.forEach((alongM, index) => {
    addAdlonMarker(group, `Adlon east dormer ${index + 1}`, {
      alongM,
      codeNative: true,
      source: profile.sources.visualReferences[1],
    });
  });
  eastUpperWindowAxesM.forEach((alongM, index) => {
    addAdlonMarker(group, `Adlon east upper window axis ${index + 1}`, {
      alongM,
      codeNative: true,
      source: profile.sources.visualReferences[1],
    });
  });
  archCentresM.forEach((alongM, index) => {
    addAdlonMarker(group, `Adlon ground arch ${index + 1}`, {
      alongM,
      codeNative: true,
    });
  });

  const frontSnowWest = adlonFramePoint(front, -34.2, -0.1);
  const frontSnowEast = adlonFramePoint(front, 34.2, -0.1);
  const ridgeWest = adlonFramePoint(front, -25.5, 11);
  const ridgeEast = adlonFramePoint(front, 25.5, 11);
  group.add(
    createSnowAccents({
      name: "Adlon snow accents",
      ridges: [
        {
          end: [frontSnowEast[0], eavesY + 0.31, frontSnowEast[1]],
          start: [frontSnowWest[0], eavesY + 0.31, frontSnowWest[1]],
          widthM: 0.22,
        },
        {
          end: [ridgeEast[0], profile.heights.ridgeWorldY + 0.12, ridgeEast[1]],
          start: [
            ridgeWest[0],
            profile.heights.ridgeWorldY + 0.12,
            ridgeWest[1],
          ],
          widthM: 0.2,
        },
      ],
    }),
  );
  return group;
}

/**
 * Paul-Löbe-Haus west front. The LoD2 extract carries the west wing as a
 * plain 102 m bar (prism HA7mKuzG, x 129.8…157.2, z −188.5…−86.0), so the
 * whole architecture of the Spreebogen-facing entrance is missing: the far
 * cantilevering roof plate over the full facade width, the free-standing
 * slender round columns in front of the glass, the recessed dark coffered
 * ceiling of the entrance hall, the fully glazed front with its fine
 * mullion grid and the stair runs behind it, and the forecourt with its
 * fountain rows and paving bands. Drawn here after the built architecture
 * (Stephan Braunfels, 2001) as flat inked elements.
 */
export const PAUL_LOEBE_WEST_FACE_X = 129.8;
const PAUL_LOEBE_CANOPY_Z = -137.25;
const PAUL_LOEBE_GROUND_Y = 5.1;
/** Full facade width plus the small overhang the roof plate carries. */
const PAUL_LOEBE_CANOPY_SPAN_Z = 106;
const PAUL_LOEBE_CANOPY_REACH_M = 13.5;
const PAUL_LOEBE_CANOPY_TOP_Y = 28.6;
/** The plate reads as a thin board in the photo, not as a slab. */
const PAUL_LOEBE_CANOPY_SLAB_M = 0.55;
const PAUL_LOEBE_COLUMN_COUNT = 13;
const PAUL_LOEBE_COLUMN_RADIUS = 0.42;
const PAUL_LOEBE_GLASS_TOP_Y = 27.4;
/** Mullion / transom pitch of the west glazing, measured off the photo. */
const PAUL_LOEBE_MULLION_M = 2.7;
const PAUL_LOEBE_TRANSOM_M = 4.35;
/** The two fountain rows that cross the lawn in front of the building. */
const PAUL_LOEBE_FOUNTAIN_ROWS = [15.5, 27.5] as const;

export function createPaulLoebeCanopy(): Group {
  const group = new Group();
  group.name = "Paul-Löbe-Haus west canopy";
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const inkLines: number[] = [];
  const SLAB = new Color(0xf1ece0);
  const FASCIA = new Color(0xe1dbcb);
  const COLUMN = new Color(0xe8e2d5);
  const COFFER = new Color(0x8d8578);
  const GLASS = new Color(0xd8e2e2);
  const STAIR = new Color(0xe4ded0);
  const PAVING = new Color(0xe6e0d1);
  const WATER = new Color(0xc6d6d8);
  const add = (triangles: Float32Array, tone: Color): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
  };

  const outerX = PAUL_LOEBE_WEST_FACE_X - PAUL_LOEBE_CANOPY_REACH_M;
  const slabCenterX = PAUL_LOEBE_WEST_FACE_X - PAUL_LOEBE_CANOPY_REACH_M / 2;
  const northZ = PAUL_LOEBE_CANOPY_Z - PAUL_LOEBE_CANOPY_SPAN_Z / 2;
  const southZ = PAUL_LOEBE_CANOPY_Z + PAUL_LOEBE_CANOPY_SPAN_Z / 2;

  // The roof plate: one thin board across the entire facade width.
  add(
    boxTriangles(
      slabCenterX,
      PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M / 2,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      PAUL_LOEBE_CANOPY_REACH_M,
      PAUL_LOEBE_CANOPY_SLAB_M,
      PAUL_LOEBE_CANOPY_SPAN_Z,
    ),
    SLAB,
  );
  // A slim fascia along the free edge: the drawn shadow line that makes the
  // cantilever legible from the isometric camera.
  add(
    boxTriangles(
      outerX + 0.18,
      PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M - 0.18,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      0.36,
      0.36,
      PAUL_LOEBE_CANOPY_SPAN_Z,
    ),
    FASCIA,
  );

  // Recessed dark coffered ceiling in the entrance zone: a panel set back
  // behind the fascia, with its coffer grid drawn as ink.
  const cofferY = PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M - 0.34;
  const cofferReach = PAUL_LOEBE_CANOPY_REACH_M - 1.4;
  const cofferCenterX = PAUL_LOEBE_WEST_FACE_X - cofferReach / 2 - 0.3;
  add(
    boxTriangles(
      cofferCenterX,
      cofferY,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      cofferReach,
      0.3,
      PAUL_LOEBE_CANOPY_SPAN_Z - 1.6,
    ),
    COFFER,
  );
  const cofferBottom = cofferY - 0.16;
  const cofferMinX = cofferCenterX - cofferReach / 2;
  const cofferMaxX = cofferCenterX + cofferReach / 2;
  const cofferMinZ = PAUL_LOEBE_CANOPY_Z - (PAUL_LOEBE_CANOPY_SPAN_Z - 1.6) / 2;
  const cofferMaxZ = PAUL_LOEBE_CANOPY_Z + (PAUL_LOEBE_CANOPY_SPAN_Z - 1.6) / 2;
  for (let z = cofferMinZ; z <= cofferMaxZ + 1e-6; z += 3.4) {
    inkLines.push(cofferMinX, cofferBottom, z, cofferMaxX, cofferBottom, z);
  }
  for (let x = cofferMinX; x <= cofferMaxX + 1e-6; x += 3.4) {
    inkLines.push(x, cofferBottom, cofferMinZ, x, cofferBottom, cofferMaxZ);
  }

  // Free-standing slender round columns in front of the glass front.
  const columnHeight =
    PAUL_LOEBE_CANOPY_TOP_Y - PAUL_LOEBE_CANOPY_SLAB_M - PAUL_LOEBE_GROUND_Y;
  const firstZ = northZ + 3.2;
  const stepZ =
    (PAUL_LOEBE_CANOPY_SPAN_Z - 6.4) / (PAUL_LOEBE_COLUMN_COUNT - 1);
  for (let index = 0; index < PAUL_LOEBE_COLUMN_COUNT; index += 1) {
    add(
      prismTriangles(
        outerX + 1.1,
        PAUL_LOEBE_GROUND_Y + columnHeight / 2,
        firstZ + stepZ * index,
        PAUL_LOEBE_COLUMN_RADIUS,
        columnHeight,
        10,
      ),
      COLUMN,
    );
  }

  // Fully glazed west front: one pane plane just in front of the LoD2 bar,
  // its mullion/transom grid drawn as ink so the facade reads as glass
  // rather than as a blank wall.
  const glassX = PAUL_LOEBE_WEST_FACE_X - 0.22;
  add(
    boxTriangles(
      glassX,
      (PAUL_LOEBE_GROUND_Y + PAUL_LOEBE_GLASS_TOP_Y) / 2,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      0.18,
      PAUL_LOEBE_GLASS_TOP_Y - PAUL_LOEBE_GROUND_Y,
      PAUL_LOEBE_CANOPY_SPAN_Z - 2.4,
    ),
    GLASS,
  );
  const glassMinZ = PAUL_LOEBE_CANOPY_Z - (PAUL_LOEBE_CANOPY_SPAN_Z - 2.4) / 2;
  const glassMaxZ = PAUL_LOEBE_CANOPY_Z + (PAUL_LOEBE_CANOPY_SPAN_Z - 2.4) / 2;
  const inkX = glassX - 0.14;
  for (let z = glassMinZ; z <= glassMaxZ + 1e-6; z += PAUL_LOEBE_MULLION_M) {
    inkLines.push(
      inkX,
      PAUL_LOEBE_GROUND_Y,
      z,
      inkX,
      PAUL_LOEBE_GLASS_TOP_Y,
      z,
    );
  }
  for (
    let y = PAUL_LOEBE_GROUND_Y + PAUL_LOEBE_TRANSOM_M;
    y <= PAUL_LOEBE_GLASS_TOP_Y + 1e-6;
    y += PAUL_LOEBE_TRANSOM_M
  ) {
    inkLines.push(inkX, y, glassMinZ, inkX, y, glassMaxZ);
  }

  // Stair runs hinted behind the glass: two flights climbing the hall, the
  // diagonal that gives the west front its depth in the photo.
  for (const [runZ, direction] of [
    [PAUL_LOEBE_CANOPY_Z - 21, 1],
    [PAUL_LOEBE_CANOPY_Z + 21, -1],
  ] as const) {
    const runLength = 26;
    const rise = PAUL_LOEBE_GLASS_TOP_Y - PAUL_LOEBE_GROUND_Y - 7;
    const flights = 14;
    for (let step = 0; step < flights; step += 1) {
      const t = step / (flights - 1);
      add(
        boxTriangles(
          PAUL_LOEBE_WEST_FACE_X + 1.9,
          PAUL_LOEBE_GROUND_Y + 1.4 + rise * t,
          runZ + direction * (t - 0.5) * runLength,
          [0, 1],
          runLength / flights + 0.4,
          0.3,
          3.1,
        ),
        STAIR,
      );
    }
  }

  // Entrance platform under the canopy, one drawn step above the forecourt.
  add(
    boxTriangles(
      slabCenterX,
      PAUL_LOEBE_GROUND_Y + 0.18,
      PAUL_LOEBE_CANOPY_Z,
      [1, 0],
      PAUL_LOEBE_CANOPY_REACH_M + 1.6,
      0.36,
      PAUL_LOEBE_CANOPY_SPAN_Z + 1.2,
    ),
    FASCIA,
  );

  // Forecourt: paving bands running out from the entrance and the two
  // fountain rows that cross the lawn.
  for (const offset of [2.6, 6.4, 10.2]) {
    add(
      boxTriangles(
        outerX - offset,
        PAUL_LOEBE_GROUND_Y + 0.08,
        PAUL_LOEBE_CANOPY_Z,
        [1, 0],
        1.9,
        0.16,
        PAUL_LOEBE_CANOPY_SPAN_Z,
      ),
      PAVING,
    );
  }
  for (const rowOffset of PAUL_LOEBE_FOUNTAIN_ROWS) {
    const rowX = outerX - rowOffset;
    add(
      boxTriangles(
        rowX,
        PAUL_LOEBE_GROUND_Y + 0.12,
        PAUL_LOEBE_CANOPY_Z,
        [1, 0],
        2.4,
        0.24,
        PAUL_LOEBE_CANOPY_SPAN_Z + 8,
      ),
      PAVING,
    );
    const jets = 26;
    for (let jet = 0; jet < jets; jet += 1) {
      const jetZ =
        northZ - 4 + ((PAUL_LOEBE_CANOPY_SPAN_Z + 8) * jet) / (jets - 1);
      add(
        prismTriangles(rowX, PAUL_LOEBE_GROUND_Y + 0.8, jetZ, 0.16, 1.3, 6),
        WATER,
      );
    }
  }

  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "Paul-Löbe canopy bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  if (inkLines.length > 0) {
    const detail = new BufferGeometry();
    detail.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(inkLines), 3),
    );
    edges.push(detail);
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    lines.name = "Paul-Löbe canopy ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

/**
 * Landmark refinements: three coarse LoD2 simplifications left on
 * prominent buildings after the Paul-Löbe-Haus west front. The extract
 * carries each of these as a plain extruded footprint, which drops the
 * single feature that makes the building recognisable:
 *
 * - Haus der Kulturen der Welt: LoD2 has only 7 m flat boxes, so the
 *   whole "Schwangere Auster" — the double-cantilever saddle shell roof
 *   (Hugh Stubbins, 1957) and its reflecting pool — is missing.
 * - Marie-Elisabeth-Lüders-Haus: one 116 × 105 m block without the
 *   cylindrical library rotunda and its landward quayside canopy.
 * - Jakob-Kaiser-Haus: flat bars without the west arcade colonnade that
 *   faces the Reichstag across Dorotheenstraße.
 * The Swiss Embassy moved to CivicLandmarks, which owns its complete metric
 * historic palace, Diener & Diener extension and roof flag in one layer.
 */
const HKW_CENTER: readonly [number, number] = [-449.5, -6.5];
const HKW_HALF_X = 44;
const HKW_HALF_Z = 48;
const HKW_SADDLE_BASE_Y = 15.5;
/** North/south tips lift, east/west edges dip: the hyperbolic paraboloid. */
const HKW_SADDLE_RISE_M = 10.5;
const HKW_SADDLE_DROP_M = 4.5;
const MELH_ROTUNDA: readonly [number, number] = [406, -139];
const MELH_ROTUNDA_RADIUS = 16.5;
const JKH_ARCADE_X = 403.2;
/**
 * Paul-Löbe-Haus: the LoD2 extract carries the comb as ten plain bars,
 * so the eight glazed committee rotundas that stand in the courtyards
 * (Stephan Braunfels, 2001) are missing entirely. The courtyard heads
 * are the spine faces at z = -117 (north side) and z = -153 (south).
 */
const PLH_ROTUNDA_RADIUS = 8.8;
const PLH_ROTUNDA_HEIGHT = 24;
const PLH_ROTUNDA_BASE_Y = 5.1;
const PLH_NORTH_COURTYARD_X = [179.5, 213.5, 251, 286] as const;
const PLH_SOUTH_COURTYARD_X = [180.5, 216, 252, 287.5] as const;
/** Spine hall of the Paul-Löbe-Haus, glazed over its full length. */
const PLH_SPINE_ROOF_Y = 33.2;
/** Marie-Elisabeth-Lüders-Haus block roof (LoD2 y0 3.7 + h 29.9). */
const MELH_ROOF_Y = 33.6;
/** Jakob-Kaiser-Haus west and north bars. */
const JKH_ROOF_BARS = [
  [406, 532, 20, 113, 30.8],
  [401, 571, 119, 191, 35.1],
] as const;
const BOTSCHAFT_MIN_X = -32.1;
const BOTSCHAFT_MAX_X = 19.9;
const BOTSCHAFT_MIN_Z = -256.4;
const BOTSCHAFT_MAX_Z = -233.7;
const BOTSCHAFT_GROUND_Y = 5.4;
const BOTSCHAFT_CORNICE_Y = 21.6;
// CivicLandmarks now owns the complete, metric embassy model. Retaining the
// older geometry below for provenance is useful, but rendering both layers
// produced coplanar cornices and the exact stationary shimmer users reported.
const LEGACY_SWISS_REFINEMENT_ENABLED = false;

/**
 * Gymnasium Tiergarten, Altonaer Straße 26 — the Altbau of 1901/02 by
 * Ludwig Hoffmann and Vinzent von Dylewski (13. Gemeindeschule, later
 * Menzelschule). Red Rathenow brick with sandstone banding over a stone
 * base in Netherlandish Renaissance manner, a high slate Steildach, and
 * on the ridge "ein rechteckiger Aufbau mit Plattform" built for
 * astronomical observation. The LoD2 extract calls the main block a
 * Mischform roof (code 5000), which the procedural roof fitter skips, so
 * the whole building rendered as a flat 32 m grey box — no roof, no
 * gables, no brick. Suppressed and drawn here after the LoD2 footprint
 * and the two Commons photographs of the river and Lessingstraße fronts.
 */
const GYMNASIUM_TIERGARTEN_WORLD: [number, number] = [-2141.81, -159.47];
/** Long axis of the LoD2 oriented rectangle (36.42 m × 18.62 m). */
const GYMNASIUM_TIERGARTEN_AXIS: [number, number] = [-0.3986, 0.9171];
const GYMNASIUM_TIERGARTEN_LENGTH_M = 36.42;
const GYMNASIUM_TIERGARTEN_DEPTH_M = 18.62;
const GYMNASIUM_TIERGARTEN_GROUND_Y = 5.2;
/** LoD2 heights: 32.33 m to the ridge, 34.75 m to the observation deck. */
const GYMNASIUM_TIERGARTEN_RIDGE_M = 32.33;
const GYMNASIUM_TIERGARTEN_PLATFORM_M = 34.75;
/** Four window storeys over the base carry the eaves (OSM building:levels). */
const GYMNASIUM_TIERGARTEN_STOREYS = 4;
const GYMNASIUM_TIERGARTEN_EAVES_M = 19;
const GYMNASIUM_TIERGARTEN_BASE_M = 2.6;
/** The rooftop observation structure, from LoD2 part DEBE3DhDEHKONVCW. */
const GYMNASIUM_TIERGARTEN_TOWER_ACROSS_M = 11.65;
const GYMNASIUM_TIERGARTEN_TOWER_ALONG_M = 5.76;

export function createGymnasiumTiergarten(): Group {
  const group = new Group();
  group.name = "Gymnasium Tiergarten Altbau";
  group.userData.recognitionModel = true;
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const BRICK = new Color(0xa8503a);
  const SANDSTONE = new Color(0xe0d6c1);
  const SLATE = new Color(0x4a5058);
  const FINIAL = new Color(0x6d6157);
  const WINDOW = new Color(0xe8e6de);
  const IRON = new Color(0x3c3f42);
  const add = (triangles: Float32Array, tone: Color, inked = true): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    if (inked) {
      edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
    }
  };
  const [cx, cz] = GYMNASIUM_TIERGARTEN_WORLD;
  const axis = GYMNASIUM_TIERGARTEN_AXIS;
  const [ax, az] = axis;
  const nx = -az;
  const nz = ax;
  /** Move off the block centre: `u` along the ridge, `v` across the depth. */
  const at = (u: number, v: number): [number, number] => [
    cx + ax * u + nx * v,
    cz + az * u + nz * v,
  ];
  const length = GYMNASIUM_TIERGARTEN_LENGTH_M;
  const depth = GYMNASIUM_TIERGARTEN_DEPTH_M;
  const ground = GYMNASIUM_TIERGARTEN_GROUND_Y;
  const base = ground + GYMNASIUM_TIERGARTEN_BASE_M;
  const eaves = ground + GYMNASIUM_TIERGARTEN_EAVES_M;
  const ridge = ground + GYMNASIUM_TIERGARTEN_RIDGE_M;

  add(
    boxTriangles(cx, (base + eaves) / 2, cz, axis, length, eaves - base, depth),
    BRICK,
  );
  add(
    boxTriangles(
      cx,
      (ground + base) / 2,
      cz,
      axis,
      length + 0.5,
      base - ground,
      depth + 0.5,
    ),
    SANDSTONE,
  );
  // The sandstone runs as one band per floor across the whole facade; in the
  // photographs they are the strongest horizontal accent on the brick.
  const storey = (eaves - base) / GYMNASIUM_TIERGARTEN_STOREYS;
  for (let index = 1; index <= GYMNASIUM_TIERGARTEN_STOREYS; index += 1) {
    add(
      boxTriangles(
        cx,
        base + index * storey - 0.3,
        cz,
        axis,
        length + 0.24,
        0.6,
        depth + 0.24,
      ),
      SANDSTONE,
      index === GYMNASIUM_TIERGARTEN_STOREYS,
    );
  }

  // Tall windows: eight bays on each long front, four on each gable end.
  const windowRise = storey * 0.56;
  for (let floor = 0; floor < GYMNASIUM_TIERGARTEN_STOREYS; floor += 1) {
    const y = base + floor * storey + storey * 0.52;
    for (let bay = 0; bay < 8; bay += 1) {
      const u = -length / 2 + length * ((bay + 0.5) / 8);
      for (const side of [-1, 1]) {
        const [wx, wz] = at(u, (side * depth) / 2);
        add(boxTriangles(wx, y, wz, axis, 1.9, windowRise, 0.3), WINDOW, false);
      }
    }
    for (let bay = 0; bay < 4; bay += 1) {
      const v = -depth / 2 + depth * ((bay + 0.5) / 4);
      for (const side of [-1, 1]) {
        const [wx, wz] = at((side * length) / 2, v);
        add(
          boxTriangles(wx, y, wz, [nx, nz], 1.9, windowRise, 0.3),
          WINDOW,
          false,
        );
      }
    }
  }
  // Sandstone portal on the river front, under the central gable.
  const [px, pz] = at(0, depth / 2);
  add(boxTriangles(px, base + 1.9, pz, axis, 4.6, 3.8, 0.7), SANDSTONE);

  // The Steildach: a gabled roof whose two slopes meet at the ridge.
  const roofTriangles: number[] = [];
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ): void => {
    roofTriangles.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  const halfLength = length / 2;
  const halfDepth = depth / 2;
  for (const side of [-1, 1]) {
    const [e0x, e0z] = at(-halfLength, (side * depth) / 2);
    const [e1x, e1z] = at(halfLength, (side * depth) / 2);
    const [r0x, r0z] = at(-halfLength, 0);
    const [r1x, r1z] = at(halfLength, 0);
    if (side < 0) {
      quad(
        [e0x, eaves, e0z],
        [e1x, eaves, e1z],
        [r1x, ridge, r1z],
        [r0x, ridge, r0z],
      );
    } else {
      quad(
        [e1x, eaves, e1z],
        [e0x, eaves, e0z],
        [r0x, ridge, r0z],
        [r1x, ridge, r1z],
      );
    }
  }
  add(new Float32Array(roofTriangles), SLATE);

  // Stepped Renaissance gables: both ends of the ridge, plus a wall dormer
  // in the middle of each long front. Each step is one brick block carrying a
  // dark stone finial, the way the photographs show them.
  const steps = 6;
  const addSteppedGable = (
    u: number,
    v: number,
    faceAxis: [number, number],
    width: number,
  ): void => {
    for (let index = 0; index < steps; index += 1) {
      const t = index / steps;
      const stepWidth = width * (1 - t * 0.82);
      const y0 = eaves + (ridge - eaves) * t;
      const y1 = eaves + (ridge - eaves) * ((index + 1) / steps);
      const [sx, sz] = at(u, v);
      add(
        boxTriangles(sx, (y0 + y1) / 2, sz, faceAxis, stepWidth, y1 - y0, 0.9),
        BRICK,
      );
      for (const edge of [-1, 1]) {
        const fx = sx + faceAxis[0] * edge * (stepWidth / 2 - 0.35);
        const fz = sz + faceAxis[1] * edge * (stepWidth / 2 - 0.35);
        add(
          boxTriangles(fx, y1 + 0.55, fz, faceAxis, 0.7, 1.1, 0.7),
          FINIAL,
          false,
        );
      }
    }
  };
  for (const side of [-1, 1]) {
    addSteppedGable((side * length) / 2, 0, [nx, nz], depth);
    addSteppedGable(0, (side * depth) / 2, axis, 13.4);
  }

  // The observation structure on the ridge, with its open iron balustrade.
  const platform = ground + GYMNASIUM_TIERGARTEN_PLATFORM_M;
  const towerAcross = GYMNASIUM_TIERGARTEN_TOWER_ACROSS_M;
  const towerAlong = GYMNASIUM_TIERGARTEN_TOWER_ALONG_M;
  add(
    boxTriangles(
      cx,
      (eaves + platform) / 2,
      cz,
      axis,
      towerAlong,
      platform - eaves,
      towerAcross,
    ),
    BRICK,
  );
  add(
    boxTriangles(
      cx,
      platform + 0.2,
      cz,
      axis,
      towerAlong + 0.7,
      0.4,
      towerAcross + 0.7,
    ),
    SANDSTONE,
  );
  for (const side of [-1, 1]) {
    const [bx, bz] = at((side * towerAlong) / 2, 0);
    add(
      boxTriangles(bx, platform + 1.2, bz, [nx, nz], towerAcross, 1.2, 0.2),
      IRON,
      false,
    );
    const [dx, dz] = at(0, (side * towerAcross) / 2);
    add(
      boxTriangles(dx, platform + 1.2, dz, axis, towerAlong, 1.2, 0.2),
      IRON,
      false,
    );
  }

  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.88,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "Gymnasium Tiergarten bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      markArchitecturalInk(new LineBasicMaterial(), "silhouette"),
    );
    lines.name = "Gymnasium Tiergarten ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

export function createLandmarkRefinements(): Group {
  const group = new Group();
  group.name = "Landmark detail refinements";
  const parts: BufferGeometry[] = [];
  const edges: BufferGeometry[] = [];
  const inkLines: number[] = [];
  const SHELL = new Color(0xf2ede1);
  const SHELL_EDGE = new Color(0xdfd8c7);
  const STONE_TONE = new Color(0xeae4d6);
  const COLUMN_TONE = new Color(0xf0ebde);
  const POOL = new Color(0xc6d6d8);
  const add = (triangles: Float32Array, tone: Color): void => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(triangles, 3));
    geometry.computeVertexNormals();
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(geometry);
    edges.push(new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES));
  };

  // --- Haus der Kulturen der Welt: the saddle shell roof ------------------
  const [hkwX, hkwZ] = HKW_CENTER;
  const saddleY = (u: number, v: number): number =>
    HKW_SADDLE_BASE_Y + HKW_SADDLE_RISE_M * v * v - HKW_SADDLE_DROP_M * u * u;
  const STEPS = 14;
  const shell: number[] = [];
  const shellPoint = (ui: number, vi: number): [number, number, number] => {
    const u = (ui / STEPS) * 2 - 1;
    const v = (vi / STEPS) * 2 - 1;
    return [hkwX + u * HKW_HALF_X, saddleY(u, v), hkwZ + v * HKW_HALF_Z];
  };
  for (let ui = 0; ui < STEPS; ui += 1) {
    for (let vi = 0; vi < STEPS; vi += 1) {
      const a = shellPoint(ui, vi);
      const b = shellPoint(ui + 1, vi);
      const c = shellPoint(ui + 1, vi + 1);
      const d = shellPoint(ui, vi + 1);
      shell.push(...a, ...b, ...c, ...a, ...c, ...d);
      // Underside, so the cantilever reads as a shell and not as a sheet.
      const lift = 0.6;
      shell.push(
        a[0],
        a[1] - lift,
        a[2],
        c[0],
        c[1] - lift,
        c[2],
        b[0],
        b[1] - lift,
        b[2],
        a[0],
        a[1] - lift,
        a[2],
        d[0],
        d[1] - lift,
        d[2],
        c[0],
        c[1] - lift,
        c[2],
      );
    }
  }
  add(new Float32Array(shell), SHELL);
  // The two free edges that give the oyster its silhouette.
  for (const vi of [0, STEPS]) {
    for (let ui = 0; ui < STEPS; ui += 1) {
      const a = shellPoint(ui, vi);
      const b = shellPoint(ui + 1, vi);
      inkLines.push(a[0], a[1] + 0.05, a[2], b[0], b[1] + 0.05, b[2]);
      inkLines.push(a[0], a[1] - 0.65, a[2], b[0], b[1] - 0.65, b[2]);
    }
  }
  for (let vi = 0; vi <= STEPS; vi += 2) {
    for (let ui = 0; ui < STEPS; ui += 1) {
      const a = shellPoint(ui, vi);
      const b = shellPoint(ui + 1, vi);
      inkLines.push(a[0], a[1] + 0.05, a[2], b[0], b[1] + 0.05, b[2]);
    }
  }
  // Abutments: the shell springs from two points on the east-west axis.
  for (const side of [-1, 1]) {
    const springX = hkwX + side * (HKW_HALF_X - 6);
    const springY = saddleY(side * ((HKW_HALF_X - 6) / HKW_HALF_X), 0);
    add(
      boxTriangles(
        springX,
        (7.1 + springY) / 2,
        hkwZ,
        [1, 0],
        7,
        springY - 7.1,
        13,
      ),
      STONE_TONE,
    );
  }
  // Auditorium drum under the crown of the shell.
  add(prismTriangles(hkwX, 11.4, hkwZ, 19, 8.6, 20), STONE_TONE);
  // Reflecting pool on the west forecourt with its low kerb.
  add(boxTriangles(hkwX - 82, 3.5, hkwZ, [1, 0], 54, 0.5, 66), POOL);
  add(boxTriangles(hkwX - 82, 3.95, hkwZ, [1, 0], 56, 0.4, 68), SHELL_EDGE);

  // --- Marie-Elisabeth-Lüders-Haus: library rotunda + quayside canopy -----
  const [melhX, melhZ] = MELH_ROTUNDA;
  add(
    prismTriangles(melhX, 21, melhZ, MELH_ROTUNDA_RADIUS, 34, 28),
    STONE_TONE,
  );
  add(
    prismTriangles(melhX, 38.6, melhZ, MELH_ROTUNDA_RADIUS + 1.1, 1.2, 28),
    SHELL_EDGE,
  );
  // Storey rings on the drum: the reading-room galleries.
  for (let ring = 1; ring <= 6; ring += 1) {
    const ringY = 6 + (32 / 7) * ring;
    for (let seg = 0; seg < 28; seg += 1) {
      const a = (seg / 28) * Math.PI * 2;
      const b = ((seg + 1) / 28) * Math.PI * 2;
      const r = MELH_ROTUNDA_RADIUS + 0.05;
      inkLines.push(
        melhX + Math.cos(a) * r,
        ringY,
        melhZ + Math.sin(a) * r,
        melhX + Math.cos(b) * r,
        ringY,
        melhZ + Math.sin(b) * r,
      );
    }
  }
  // --- Jakob-Kaiser-Haus: the west arcade facing the Reichstag ------------
  for (let z = 26; z <= 186; z += 5.6) {
    add(prismTriangles(JKH_ARCADE_X, 16.6, z, 0.5, 23, 10), COLUMN_TONE);
  }
  add(
    boxTriangles(JKH_ARCADE_X + 0.8, 28.8, 106, [0, 1], 164, 1.3, 3.4),
    STONE_TONE,
  );
  add(
    boxTriangles(JKH_ARCADE_X + 0.8, 5.3, 106, [0, 1], 164, 0.5, 4.4),
    SHELL_EDGE,
  );

  // --- Paul-Löbe-Haus: the eight glazed committee rotundas ----------------
  const plhRotundaY = PLH_ROTUNDA_BASE_Y + PLH_ROTUNDA_HEIGHT / 2;
  const plhDrums: [number, number][] = [
    ...PLH_NORTH_COURTYARD_X.map((x): [number, number] => [
      x,
      -117 + PLH_ROTUNDA_RADIUS,
    ]),
    ...PLH_SOUTH_COURTYARD_X.map((x): [number, number] => [
      x,
      -153 - PLH_ROTUNDA_RADIUS,
    ]),
  ];
  for (const [drumX, drumZ] of plhDrums) {
    add(
      prismTriangles(
        drumX,
        plhRotundaY,
        drumZ,
        PLH_ROTUNDA_RADIUS,
        PLH_ROTUNDA_HEIGHT,
        24,
      ),
      STONE_TONE,
    );
    // Cornice band, so the drum reads as a finished cylinder from above.
    add(
      prismTriangles(
        drumX,
        PLH_ROTUNDA_BASE_Y + PLH_ROTUNDA_HEIGHT + 0.5,
        drumZ,
        PLH_ROTUNDA_RADIUS + 0.9,
        1,
        24,
      ),
      SHELL_EDGE,
    );
    // Five gallery levels drawn as ink rings — the documented storeys.
    for (let ring = 1; ring <= 5; ring += 1) {
      const ringY = PLH_ROTUNDA_BASE_Y + (PLH_ROTUNDA_HEIGHT / 6) * ring;
      for (let seg = 0; seg < 24; seg += 1) {
        const a = (seg / 24) * Math.PI * 2;
        const b = ((seg + 1) / 24) * Math.PI * 2;
        const r = PLH_ROTUNDA_RADIUS + 0.05;
        inkLines.push(
          drumX + Math.cos(a) * r,
          ringY,
          drumZ + Math.sin(a) * r,
          drumX + Math.cos(b) * r,
          ringY,
          drumZ + Math.sin(b) * r,
        );
      }
    }
  }
  // Spine hall: the glazed barrel is carried on a longitudinal roof grid.
  for (let x = 158; x <= 310; x += 6) {
    inkLines.push(x, PLH_SPINE_ROOF_Y, -152, x, PLH_SPINE_ROOF_Y, -118);
  }
  for (const z of [-148, -135, -122]) {
    inkLines.push(158, PLH_SPINE_ROOF_Y, z, 310, PLH_SPINE_ROOF_Y, z);
  }

  // --- Roof light grids on the Lüders and Kaiser blocks -------------------
  for (let x = 378; x <= 486; x += 6.4) {
    inkLines.push(x, MELH_ROOF_Y, -179, x, MELH_ROOF_Y, -82);
  }
  for (let z = -179; z <= -82; z += 8) {
    inkLines.push(378, MELH_ROOF_Y, z, 486, MELH_ROOF_Y, z);
  }
  for (const [x0, x1, z0, z1, roofY] of JKH_ROOF_BARS) {
    for (let x = x0 + 4; x <= x1 - 4; x += 6.6) {
      inkLines.push(x, roofY, z0 + 3, x, roofY, z1 - 3);
    }
    for (let z = z0 + 3; z <= z1 - 3; z += 9) {
      inkLines.push(x0 + 4, roofY, z, x1 - 4, roofY, z);
    }
  }

  // --- Schweizerische Botschaft: legacy overlay, deliberately disabled ----
  if (LEGACY_SWISS_REFINEMENT_ENABLED) {
    const botX = (BOTSCHAFT_MIN_X + BOTSCHAFT_MAX_X) / 2;
    const botZ = (BOTSCHAFT_MIN_Z + BOTSCHAFT_MAX_Z) / 2;
    const botSpanX = BOTSCHAFT_MAX_X - BOTSCHAFT_MIN_X;
    const botSpanZ = BOTSCHAFT_MAX_Z - BOTSCHAFT_MIN_Z;
    add(
      boxTriangles(
        botX,
        BOTSCHAFT_GROUND_Y + 1.9,
        botZ,
        [1, 0],
        botSpanX + 1.1,
        3.8,
        botSpanZ + 1.1,
      ),
      STONE_TONE,
    );
    add(
      boxTriangles(
        botX,
        BOTSCHAFT_CORNICE_Y,
        botZ,
        [1, 0],
        botSpanX + 1.6,
        1,
        botSpanZ + 1.6,
      ),
      SHELL_EDGE,
    );
    for (let x = BOTSCHAFT_MIN_X + 1.4; x <= BOTSCHAFT_MAX_X - 1.4; x += 2.1) {
      for (const z of [BOTSCHAFT_MIN_Z - 0.5, BOTSCHAFT_MAX_Z + 0.5]) {
        add(
          prismTriangles(x, BOTSCHAFT_CORNICE_Y + 1.4, z, 0.22, 1.8, 8),
          STONE_TONE,
        );
      }
    }
    add(
      boxTriangles(
        botX,
        BOTSCHAFT_CORNICE_Y + 2.5,
        botZ,
        [1, 0],
        botSpanX + 1.6,
        0.4,
        botSpanZ + 1.6,
      ),
      SHELL_EDGE,
    );
    for (let index = 0; index < 4; index += 1) {
      add(
        prismTriangles(
          botX - 4.8 + index * 3.2,
          BOTSCHAFT_GROUND_Y + 7.4,
          BOTSCHAFT_MAX_Z + 2.2,
          0.5,
          11,
          10,
        ),
        COLUMN_TONE,
      );
    }
    add(
      boxTriangles(
        botX,
        BOTSCHAFT_GROUND_Y + 13.5,
        BOTSCHAFT_MAX_Z + 2.2,
        [0, 1],
        13.4,
        1.2,
        3.2,
      ),
      STONE_TONE,
    );
    // Portico pediment: a shallow triangular gable over the architrave.
    const pedY = BOTSCHAFT_GROUND_Y + 14.1;
    const pedZ = BOTSCHAFT_MAX_Z + 2.2;
    const pedHalfX = 6.7;
    const pedHalfZ = 1.6;
    const pedApex = pedY + 2.4;
    const gable: number[] = [];
    for (const zSide of [-pedHalfZ, pedHalfZ]) {
      gable.push(
        botX - pedHalfX,
        pedY,
        pedZ + zSide,
        botX + pedHalfX,
        pedY,
        pedZ + zSide,
        botX,
        pedApex,
        pedZ + zSide,
      );
    }
    for (const xSide of [-1, 1]) {
      const ex = botX + xSide * pedHalfX;
      gable.push(
        ex,
        pedY,
        pedZ - pedHalfZ,
        ex,
        pedY,
        pedZ + pedHalfZ,
        botX,
        pedApex,
        pedZ + pedHalfZ,
        ex,
        pedY,
        pedZ - pedHalfZ,
        botX,
        pedApex,
        pedZ + pedHalfZ,
        botX,
        pedApex,
        pedZ - pedHalfZ,
      );
    }
    add(new Float32Array(gable), STONE_TONE);
    // Rusticated base storey: deep beds with staggered vertical joints.
    const botBaseTop = BOTSCHAFT_GROUND_Y + 3.8;
    const rustX0 = BOTSCHAFT_MIN_X - 0.5;
    const rustX1 = BOTSCHAFT_MAX_X + 0.5;
    const rustZ0 = BOTSCHAFT_MIN_Z - 0.5;
    const rustZ1 = BOTSCHAFT_MAX_Z + 0.5;
    for (const y of [BOTSCHAFT_GROUND_Y + 1.25, BOTSCHAFT_GROUND_Y + 2.5]) {
      inkLines.push(
        rustX0,
        y,
        rustZ0,
        rustX1,
        y,
        rustZ0,
        rustX0,
        y,
        rustZ1,
        rustX1,
        y,
        rustZ1,
        rustX0,
        y,
        rustZ0,
        rustX0,
        y,
        rustZ1,
        rustX1,
        y,
        rustZ0,
        rustX1,
        y,
        rustZ1,
      );
    }
    for (let index = 0; index <= 20; index += 1) {
      const x = rustX0 + (index / 20) * (rustX1 - rustX0);
      const top = index % 2 === 0 ? BOTSCHAFT_GROUND_Y + 2.5 : botBaseTop;
      inkLines.push(
        x,
        BOTSCHAFT_GROUND_Y,
        rustZ0,
        x,
        top,
        rustZ0,
        x,
        BOTSCHAFT_GROUND_Y,
        rustZ1,
        x,
        top,
        rustZ1,
      );
    }
    // Cornice profile: a fascia and a drip course under the main slab.
    for (const [y, inset] of [
      [BOTSCHAFT_CORNICE_Y - 0.9, 0.4],
      [BOTSCHAFT_CORNICE_Y - 1.7, 0.9],
    ]) {
      add(
        boxTriangles(
          botX,
          y,
          botZ,
          [1, 0],
          botSpanX + 1.6 - inset,
          0.42,
          botSpanZ + 1.6 - inset,
        ),
        SHELL_EDGE,
      );
    }
    // Attica: the solid parapet dado carrying the balustrade on the two long
    // fronts. It stays on the cornice edge, so the hipped roof behind it is
    // untouched.
    for (const z of [BOTSCHAFT_MIN_Z - 0.3, BOTSCHAFT_MAX_Z + 0.3]) {
      add(
        boxTriangles(
          botX,
          BOTSCHAFT_CORNICE_Y + 1.35,
          z,
          [1, 0],
          botSpanX + 1.4,
          1.7,
          1.3,
        ),
        STONE_TONE,
      );
    }
  }

  const merged = mergeGeometries(parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "Landmark refinement bodies";
    group.add(mesh);
    for (const geometry of parts) {
      geometry.dispose();
    }
  }
  if (inkLines.length > 0) {
    const detail = new BufferGeometry();
    detail.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(inkLines), 3),
    );
    edges.push(detail);
  }
  const ink = mergeGeometries(edges, false);
  if (ink) {
    const lines = new LineSegments(
      ink,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    lines.name = "Landmark refinement ink lines";
    lines.renderOrder = 2;
    group.add(lines);
    for (const geometry of edges) {
      geometry.dispose();
    }
  }
  return group;
}

/** Maximum edge retained inside a terrain-following surface triangle. */
export const DRAPED_SURFACE_MAX_EDGE_M = 64;
export const DRAPED_SURFACE_MAX_ITERATIONS = 12;

const NATURAL_CURVE: DensifyOptions = {
  cornerDeg: 68,
  maxSegmentM: 2.5,
};
const ROAD_CURVE: DensifyOptions = {
  cornerDeg: 74,
  maxSegmentM: 2,
};
const BUILT_WATER_CURVE: DensifyOptions = {
  cornerDeg: 34,
  maxSegmentM: 2,
};

/** Natural banks bend freely; engineered basins retain their built corners. */
export function surfaceCurveOptions(surface: SurfacePolygon): DensifyOptions {
  if (surface.kind === "basin") {
    return BUILT_WATER_CURVE;
  }
  if (
    surface.kind === "asphalt" ||
    surface.kind === "paving" ||
    surface.kind === "sand" ||
    surface.kind === "earth" ||
    surface.kind === "wood" ||
    surface.kind === "metal"
  ) {
    return ROAD_CURVE;
  }
  return NATURAL_CURVE;
}

/**
 * A decimetre ring as a smooth metre-space outline in world XZ. Everything
 * that draws a bank goes through here, so the water plate, the quay wall and
 * the shoreline ink cannot drift apart.
 */
export function smoothSurfaceRing(
  ring: number[][],
  options: DensifyOptions = NATURAL_CURVE,
): [number, number][] {
  return densifyRing(
    ring.map(([xDm, zDm]) => [xDm / 10, zDm / 10] as const),
    options,
  );
}

/** Shape (with holes) from a smoothed polygon ring, in the XZ plane. */
function shapeFromSurface(surface: SurfacePolygon): Shape {
  const shape = new Shape();
  const curveOptions = surfaceCurveOptions(surface);
  smoothSurfaceRing(surface.ring, curveOptions).forEach(([x, z], index) => {
    if (index === 0) {
      shape.moveTo(x, -z);
    } else {
      shape.lineTo(x, -z);
    }
  });
  for (const hole of surface.holes ?? []) {
    const points = smoothSurfaceRing(hole, curveOptions);
    // A hole that collapses to a sliver crashes three's earcut
    // triangulator outright ("undefined is not an object (list.next)") and
    // takes the WHOLE drawn city down with it — the buffered road network
    // produces such slivers wherever two carriageways graze each other.
    // Anything without three points spanning a real area is not a hole.
    if (points.length < 3 || ringArea(points) < 0.05) {
      continue;
    }
    const path = new Path();
    points.forEach(([x, z], index) => {
      if (index === 0) {
        path.moveTo(x, -z);
      } else {
        path.lineTo(x, -z);
      }
    });
    shape.holes.push(path);
  }
  return shape;
}

/**
 * Run Three/Earcut's deterministic polygon triangulation without applying a
 * presentation lift or terrain height. The release generator stores this
 * lossless intermediate for the exceptionally hole-heavy asphalt and paving
 * unions; the browser still performs the exact tessellation and committed
 * terrain drape, just without a multi-second Earcut long task or its enormous
 * temporary linked-list allocation.
 */
export function createPretriangulatedSurfacePlate(
  polygons: readonly SurfacePolygon[],
): BufferGeometry | null {
  const shapes: Shape[] = [];
  for (const surface of polygons) {
    if (surface.ring.length < 4) {
      continue;
    }
    try {
      shapes.push(shapeFromSurface(surface));
    } catch {
      continue;
    }
  }
  if (shapes.length === 0) {
    return null;
  }
  try {
    return new ShapeGeometry(shapes);
  } catch {
    const parts: BufferGeometry[] = [];
    for (const shape of shapes) {
      try {
        parts.push(new ShapeGeometry(shape));
      } catch {
        continue;
      }
    }
    if (parts.length === 0) {
      return null;
    }
    const merged = mergeGeometries(parts, false);
    for (const part of parts) {
      part.dispose();
    }
    return merged;
  }
}

/**
 * Smooth water bodies and parkland from the true OSM polygons: a
 * transparent water plate over a sandy bed, a continuous drawn
 * shoreline, soft quay walls following the real bank line, and lawn
 * plates that cover the rasterised grass steps. This replaces the
 * per-cell water/quay staircases entirely.
 */
export function createSmoothSurfaces(
  surfaces: SurfacePayload,
  waterTopY: number,
  bankY: number,
  /**
   * Local terrain height in metres at a world XZ point. Surfaces that lie
   * ON the ground (lawns, carriageways, park paths) follow it; the water
   * plate and its bed keep the water table instead.
   *
   * Without this every plate sat at the single constant `bankY` = 4.2 m
   * while the surveyed terrain runs to a median of 5.2 m — the smooth
   * lawns and every road surface were a metre UNDERGROUND across most of
   * the map and simply never appeared.
   */
  terrainAt?: (x: number, z: number) => number,
  options: SmoothSurfaceBuildOptions = {},
): Group {
  const group = new Group();
  group.name = "smooth OSM water and parkland";
  const BED_DROP = 3.1;
  const terrainTessellator = terrainAt
    ? new TessellateModifier(
        DRAPED_SURFACE_MAX_EDGE_M,
        DRAPED_SURFACE_MAX_ITERATIONS,
      )
    : null;

  const buildPlate = (
    polygons: SurfacePolygon[],
    y: number,
    followTerrain = false,
    pretriangulated?: BufferGeometry,
  ): BufferGeometry | null => {
    const shapes: Shape[] = [];
    for (const surface of polygons) {
      if (surface.ring.length < 4) {
        continue;
      }
      try {
        shapes.push(shapeFromSurface(surface));
      } catch {
        continue;
      }
    }
    if (shapes.length === 0 && !pretriangulated) {
      return null;
    }
    const placeGeometry = (source: BufferGeometry): BufferGeometry => {
      source.deleteAttribute("uv");
      let geometry: BufferGeometry = source;
      if (followTerrain && terrainTessellator) {
        // Earcut is free to span a kilometre-long park or road union with one
        // triangle. Its three boundary heights then flatten every rise and
        // dip inside that triangle. Bounded tessellation adds only the
        // vertices needed for the 16 m sampled terrain; merge them back into
        // an indexed buffer before the height lookup to keep memory stable.
        const tessellated = terrainTessellator.modify(source);
        geometry = mergeVertices(tessellated, 1e-4);
        tessellated.dispose();
        source.dispose();
      }
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y, 0);
      if (followTerrain && terrainAt) {
        // `y` becomes the LIFT above the ground rather than an absolute
        // height, so a carriageway climbs with the street it lies in.
        const position = geometry.getAttribute("position");
        for (let index = 0; index < position.count; index += 1) {
          position.setY(
            index,
            terrainAt(position.getX(index), position.getZ(index)) + y,
          );
        }
        position.needsUpdate = true;
      }
      return geometry;
    };
    if (pretriangulated) {
      return placeGeometry(pretriangulated);
    }
    try {
      // ShapeGeometry accepts an array. Building one family in a single pass
      // avoids allocating and then copying hundreds of temporary geometries
      // during viewer startup (roads alone previously created 674 of them).
      return placeGeometry(new ShapeGeometry(shapes));
    } catch {
      // A malformed ring must never cost the viewer its entire drawn city.
      // Retry one shape at a time so only the broken plate is skipped.
      const parts: BufferGeometry[] = [];
      for (const shape of shapes) {
        try {
          parts.push(placeGeometry(new ShapeGeometry(shape)));
        } catch {
          continue;
        }
      }
      if (parts.length === 0) {
        return null;
      }
      const merged = mergeGeometries(parts, false);
      for (const part of parts) {
        part.dispose();
      }
      return merged;
    }
  };

  // Parkland lawns first: they sit just above the rasterised grass so
  // the 4 m steps disappear under a smooth sage plate.
  const lawns = buildPlate(
    surfaces.parks.filter(
      (entry) => entry.kind !== "garden" && !isTillaDurieuxLawn(entry),
    ),
    terrainAt ? 0.06 : bankY + 0.08,
    true,
  );
  if (lawns) {
    // Unlit plates ignore the night rig, so they carry explicit day and
    // night tones — otherwise the lawns glow through the dark.
    const dayMaterial = new MeshBasicMaterial({ color: 0xa9c592 });
    const nightMaterial = new MeshBasicMaterial({ color: 0x1c2a20 });
    const lawnMesh = new Mesh(lawns, dayMaterial);
    lawnMesh.userData.dayMaterial = dayMaterial;
    lawnMesh.userData.nightMaterial = nightMaterial;
    lawnMesh.name = "smooth parkland lawns";
    group.add(lawnMesh);
  }

  // Planted gardens over the lawn: the eleven beds of the Rosengarten, the
  // Englischer Garten, the Kanonenhof. A bed is denser and warmer than mown
  // grass, and it needs an outline — beds that touch each other along a
  // gravel walk are only readable as separate beds if their edges are drawn.
  const gardens = surfaces.parks.filter((entry) => entry.kind === "garden");
  const gardenPlate = buildPlate(gardens, terrainAt ? 0.08 : bankY + 0.1, true);
  if (gardenPlate) {
    const dayMaterial = new MeshBasicMaterial({ color: 0x8fae72 });
    const nightMaterial = new MeshBasicMaterial({ color: 0x1e2a1c });
    const gardenMesh = new Mesh(gardenPlate, dayMaterial);
    gardenMesh.userData.dayMaterial = dayMaterial;
    gardenMesh.userData.nightMaterial = nightMaterial;
    gardenMesh.name = "smooth garden beds";
    group.add(gardenMesh);

    const outline: number[] = [];
    for (const bed of gardens) {
      const ring = smoothSurfaceRing(bed.ring, surfaceCurveOptions(bed));
      for (let index = 0; index < ring.length; index += 1) {
        const [x0, z0] = ring[index];
        const [x1, z1] = ring[(index + 1) % ring.length];
        const lift = terrainAt ? 0.13 : 0;
        outline.push(
          x0,
          (terrainAt ? terrainAt(x0, z0) : bankY) + lift,
          z0,
          x1,
          (terrainAt ? terrainAt(x1, z1) : bankY) + lift,
          z1,
        );
      }
    }
    if (outline.length > 0) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(outline, 3));
      const edges = new LineSegments(
        geometry,
        markArchitecturalAccentInk(new LineBasicMaterial(), 0x6c7a58, "micro"),
      );
      edges.name = "garden bed outlines";
      edges.renderOrder = 3;
      group.add(edges);
    }
  }

  // Low mapped thickets are separate evidence from individual trees. Three
  // instanced families add the real OSM shrub masses with three draw calls,
  // without random scatter or per-bush browser objects.
  const scrubPoints = surfaces.scrub_points ?? [];
  const scrubDay = [0x4f7f4b, 0x648d50, 0x3d7045] as const;
  const scrubNight = [0x16261a, 0x1a2b1c, 0x132219] as const;
  for (let variant = 0; variant < scrubDay.length; variant += 1) {
    const entries = scrubPoints.filter((entry) => entry[4] === variant);
    if (entries.length === 0) {
      continue;
    }
    const geometry = new IcosahedronGeometry(1, 1);
    const dayMaterial = new MeshBasicMaterial({ color: scrubDay[variant] });
    const nightMaterial = new MeshBasicMaterial({
      color: scrubNight[variant],
    });
    const mesh = new InstancedMesh(geometry, dayMaterial, entries.length);
    const matrix = new Matrix4();
    entries.forEach(([xDm, zDm, radiusDm, heightDm], index) => {
      const x = xDm / 10;
      const z = zDm / 10;
      const radius = radiusDm / 10;
      const height = heightDm / 10;
      matrix.makeScale(radius, height / 2, radius * 0.86);
      matrix.setPosition(
        x,
        (terrainAt ? terrainAt(x, z) : bankY) + height / 2 + 0.08,
        z,
      );
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.name = `source-backed OSM scrub ${variant + 1}`;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.sourceGeometry = "OSM natural=scrub polygon samples";
    mesh.userData.staticAntiFlicker = true;
    group.add(mesh);
  }

  // Carriageways and park paths, drawn from the buffered OSM centrelines.
  // OSM ships streets as lines, so before this the Straße des 17. Juni and
  // the Großer Stern roundabout had no surface at all in the drawn city —
  // only the 4 m voxel raster, which does not reach into the surveyed
  // Tiergarten. Each family gets its own tone: asphalt grey for traffic,
  // pale paving for squares and footways, Tiergarten sand for compacted paths,
  // plus separately sourced earth, timber and metal path surfaces.
  const ROAD_SURFACES: ReadonlyArray<{
    day: number;
    kind: string;
    lift: number;
    name: string;
    night: number;
  }> = [
    // Paving first, sand next, asphalt last: where two families overlap at
    // a junction the more specific surface should win, and later plates
    // sit fractionally higher.
    {
      day: 0xdcd8cc,
      kind: "paving",
      lift: 0.1,
      name: "smooth paved paths",
      night: 0x1b222b,
    },
    {
      day: 0xd9c9a6,
      kind: "sand",
      lift: 0.12,
      name: "smooth park paths",
      night: 0x241f19,
    },
    {
      day: 0xbca780,
      kind: "earth",
      lift: 0.125,
      name: "smooth earth desire paths",
      night: 0x211b15,
    },
    {
      day: 0xc49c68,
      kind: "wood",
      lift: 0.13,
      name: "smooth timber paths",
      night: 0x241b14,
    },
    {
      day: 0xaeb8b8,
      kind: "metal",
      lift: 0.135,
      name: "smooth metal paths and steps",
      night: 0x1b2225,
    },
    {
      day: 0xc4c5c0,
      kind: "asphalt",
      lift: 0.14,
      name: "smooth carriageways",
      night: 0x171c24,
    },
  ];
  const roads = surfaces.roads ?? [];
  for (const surface of ROAD_SURFACES) {
    const plate = buildPlate(
      roads.filter((entry) => entry.kind === surface.kind),
      terrainAt ? surface.lift : bankY + surface.lift,
      true,
      surface.kind === "asphalt" || surface.kind === "paving"
        ? options.pretriangulated?.[surface.kind]
        : undefined,
    );
    if (!plate) {
      continue;
    }
    const dayMaterial = new MeshBasicMaterial({ color: surface.day });
    const nightMaterial = new MeshBasicMaterial({ color: surface.night });
    const mesh = new Mesh(plate, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = surface.name;
    group.add(mesh);
  }

  // Kerbstones ("alle Straßen, die Bordsteine haben, müssen diese
  // Bordsteine aufzeigen"): every asphalt carriageway gets a raised kerb
  // band walking its real polygon outline — a small upstand wall from the
  // asphalt top to kerb height plus a fine ink line along the arris. Park
  // paths and sand stay kerbless, as they are in the Tiergarten.
  {
    const kerbPositions: number[] = [];
    const kerbInk: number[] = [];
    const KERB_RISE = 0.14;
    const asphaltLift =
      ROAD_SURFACES.find((entry) => entry.kind === "asphalt")?.lift ?? 0.14;
    for (const road of roads.filter((entry) => entry.kind === "asphalt")) {
      for (const rawRing of [road.ring, ...(road.holes ?? [])]) {
        const points = smoothSurfaceRing(rawRing, surfaceCurveOptions(road));
        for (let index = 0; index < points.length; index += 1) {
          const [ax, az] = points[index];
          const [bx, bz] = points[(index + 1) % points.length];
          if (Math.hypot(bx - ax, bz - az) < 0.05) {
            continue;
          }
          const aBase = terrainAt
            ? terrainAt(ax, az) + asphaltLift
            : bankY + asphaltLift;
          const bBase = terrainAt
            ? terrainAt(bx, bz) + asphaltLift
            : bankY + asphaltLift;
          const aTop = aBase + KERB_RISE;
          const bTop = bBase + KERB_RISE;
          // Two triangles of upstand between road level and kerb top.
          kerbPositions.push(
            ax,
            aBase,
            az,
            bx,
            bBase,
            bz,
            bx,
            bTop,
            bz,
            ax,
            aBase,
            az,
            bx,
            bTop,
            bz,
            ax,
            aTop,
            az,
          );
          kerbInk.push(ax, aTop + 0.01, az, bx, bTop + 0.01, bz);
        }
      }
    }
    if (kerbPositions.length > 0) {
      const rawKerbGeometry = new BufferGeometry();
      rawKerbGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(kerbPositions, 3),
      );
      const kerbGeometry = mergeVertices(rawKerbGeometry, 1e-4);
      rawKerbGeometry.dispose();
      kerbGeometry.computeVertexNormals();
      const dayMaterial = new MeshBasicMaterial({
        color: 0xd7d4c8,
        side: DoubleSide,
      });
      const nightMaterial = new MeshBasicMaterial({
        color: 0x232a31,
        side: DoubleSide,
      });
      const kerbMesh = new Mesh(kerbGeometry, dayMaterial);
      kerbMesh.userData.dayMaterial = dayMaterial;
      kerbMesh.userData.nightMaterial = nightMaterial;
      kerbMesh.name = "smooth kerb upstands";
      group.add(kerbMesh);
      const rawInkGeometry = new BufferGeometry();
      rawInkGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(kerbInk, 3),
      );
      const inkGeometry = mergeVertices(rawInkGeometry, 1e-4);
      rawInkGeometry.dispose();
      const inkLines = new LineSegments(
        inkGeometry,
        markArchitecturalInk(new LineBasicMaterial(), "detail"),
      );
      inkLines.name = "smooth kerb ink";
      inkLines.renderOrder = 2;
      group.add(inkLines);
    }
  }

  // Painted lane markings on the classified carriageways: a broken white
  // centre line, dashed 4 m on / 6 m off, sitting just above the asphalt.
  const markings = surfaces.lane_markings ?? [];
  if (markings.length > 0) {
    const DASH_ON_M = 4;
    const DASH_OFF_M = 6;
    const points: number[] = [];
    const markingY = bankY + 0.2;
    const markingLift = 0.2;
    for (const marking of markings) {
      let carried = 0;
      for (let index = 0; index + 1 < marking.points.length; index += 1) {
        const [ax, az] = marking.points[index];
        const [bx, bz] = marking.points[index + 1];
        const x0 = ax / 10;
        const z0 = az / 10;
        const x1 = bx / 10;
        const z1 = bz / 10;
        const length = Math.hypot(x1 - x0, z1 - z0);
        if (length < 1e-3) {
          continue;
        }
        // Walk the segment in dash periods, carrying the phase across
        // vertices so the dashes stay evenly spaced around bends.
        let travelled = -carried;
        while (travelled < length) {
          const start = Math.max(0, travelled);
          const end = Math.min(length, travelled + DASH_ON_M);
          if (end > start) {
            const t0 = start / length;
            const t1 = end / length;
            const sx = x0 + (x1 - x0) * t0;
            const sz = z0 + (z1 - z0) * t0;
            const ex = x0 + (x1 - x0) * t1;
            const ez = z0 + (z1 - z0) * t1;
            points.push(
              sx,
              terrainAt ? terrainAt(sx, sz) + markingLift : markingY,
              sz,
              ex,
              terrainAt ? terrainAt(ex, ez) + markingLift : markingY,
              ez,
            );
          }
          travelled += DASH_ON_M + DASH_OFF_M;
        }
        carried = (carried + length) % (DASH_ON_M + DASH_OFF_M);
      }
    }
    if (points.length > 0) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
      const material = new LineBasicMaterial({ color: 0xf2f0e8 });
      const lines = new LineSegments(geometry, material);
      lines.name = "carriageway lane markings";
      lines.renderOrder = 2;
      lines.userData.laneMarking = true;
      group.add(lines);
    }
  }

  // Rivers/canals, natural park water and built basins are intentionally
  // separate. The first uses the Spree table, ponds follow local low-bank
  // terrain with soft slopes, and only built basins receive hard rims.
  const basins = surfaces.water.filter(
    (entry) => entry.kind === "basin" && !isDedicatedSintiRomaPool(entry),
  );
  const ponds = surfaces.water.filter(
    (entry) =>
      (entry.kind === "pond" && isElevatedParkWater(entry)) ||
      entry.kind === "stream" ||
      (!entry.kind && isElevatedParkWater(entry)),
  );
  const rivers = surfaces.water.filter(
    (entry) =>
      !isDedicatedSintiRomaPool(entry) &&
      !basins.includes(entry) &&
      !ponds.includes(entry),
  );

  // Sandy riverbed, then the transparent water plate above it.
  const bed = buildPlate(rivers, waterTopY - BED_DROP);
  if (bed) {
    const dayMaterial = new MeshBasicMaterial({ color: 0xd4cbb4 });
    const nightMaterial = new MeshBasicMaterial({ color: 0x1a232b });
    const bedMesh = new Mesh(bed, dayMaterial);
    bedMesh.userData.dayMaterial = dayMaterial;
    bedMesh.userData.nightMaterial = nightMaterial;
    bedMesh.name = "smooth river bed";
    group.add(bedMesh);
  }
  const water = buildPlate(rivers, waterTopY);
  if (water) {
    const dayMaterial = new MeshBasicMaterial({
      color: 0x9fc7d8,
      depthWrite: false,
      opacity: 0.46,
      transparent: true,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x27435c,
      depthWrite: false,
      opacity: 0.6,
      transparent: true,
    });
    // "Wasser dunkel mit dezenter Mondspiegelung erlaubt": under "Licht
    // aus" the real (surfaces-backed) water plate goes cooler and a touch
    // more opaque than ordinary lit night, mirroring the drawn-water
    // fallback's MOONLIT_WATER tone below.
    const moonlitMaterial = new MeshBasicMaterial({
      color: MOONLIT_WATER,
      depthWrite: false,
      opacity: 0.68,
      transparent: true,
    });
    const waterMesh = new Mesh(water, dayMaterial);
    waterMesh.userData.dayMaterial = dayMaterial;
    waterMesh.userData.nightMaterial = nightMaterial;
    waterMesh.userData.moonlitMaterial = moonlitMaterial;
    waterMesh.name = "smooth water surface";
    waterMesh.renderOrder = 1;
    group.add(waterMesh);
  }

  // Quay walls, coping and shoreline ink all walk the SAME smoothed bank
  // line, so the embankment is one continuous curve rather than a set of
  // facets that disagree with each other by a few centimetres.
  const wallPositions: number[] = [];
  const wallColors: number[] = [];
  const shorePositions: number[] = [];
  const copingPositions: number[] = [];
  const stone = new Color(0xcdc5b2);
  const stoneAlt = new Color(0xc2b9a5);
  const coping = new Color(0xe0d9c7);
  const COPING_WIDTH_M = 1.6;
  /** Masonry courses, in metres — tied to the bank, not to the subdivision. */
  const COURSE_M = 7;
  const bankTopAt = (x: number, z: number): number =>
    Math.max(bankY - 0.8, terrainAt ? terrainAt(x, z) : bankY) + 0.12;
  // OSM splits the Spree into separate riverbank polygons, and the cuts sit
  // at the bridges: polygon 0 stops at x −35, the next starts at x −61, both
  // at the Gustav-Heinemann-Brücke. Those shared edges are joins in the data,
  // not banks — walling them raised a full-height wall with a coping band
  // straight across the water, which read as a second bridge beside the real
  // one. An edge whose landward side is another river is skipped.
  const riverBounds = rivers.map((surface) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [x, z] of surface.ring) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    return { maxX, maxZ, minX, minZ };
  });
  const landwardIsWater = (self: number, xDm: number, zDm: number): boolean => {
    for (let index = 0; index < rivers.length; index += 1) {
      if (index === self) {
        continue;
      }
      const box = riverBounds[index];
      if (
        xDm < box.minX ||
        xDm > box.maxX ||
        zDm < box.minZ ||
        zDm > box.maxZ
      ) {
        continue;
      }
      if (ringContains(rivers[index].ring, xDm, zDm)) {
        return true;
      }
    }
    return false;
  };
  for (let riverIndex = 0; riverIndex < rivers.length; riverIndex += 1) {
    const surface = rivers[riverIndex];
    if (surface.area_m2 < 400) {
      continue;
    }
    const ring = smoothSurfaceRing(surface.ring, surfaceCurveOptions(surface));
    // Winding is whatever OSM and the clip left behind, so it is measured
    // rather than assumed: the coping has to land on the bank, not the water.
    let signedArea = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const [ax, az] = ring[index];
      const [bx, bz] = ring[(index + 1) % ring.length];
      signedArea += ax * bz - bx * az;
    }
    const outward = signedArea > 0 ? 1 : -1;
    let travelled = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const [ax, az] = ring[index];
      const [bx, bz] = ring[(index + 1) % ring.length];
      const run = Math.hypot(bx - ax, bz - az);
      if (run < 0.2) {
        continue;
      }
      // Replace only the OSM 52189421 north-bank run by its DGM-grounded
      // Schrägufer. This suppresses the old vertical wall and coping before
      // either geometry is emitted, so there is no deck/rail Z-fighting.
      if (isNorthernHumboldthafenQuayEdge(ax, az, bx, bz)) {
        continue;
      }
      // Coping band: the walkable lip on top of the wall, on the land side.
      const outX = ((bz - az) / run) * COPING_WIDTH_M * outward;
      const outZ = (-(bx - ax) / run) * COPING_WIDTH_M * outward;
      if (
        landwardIsWater(
          riverIndex,
          ((ax + bx) / 2 + outX * 0.75) * 10,
          ((az + bz) / 2 + outZ * 0.75) * 10,
        )
      ) {
        continue;
      }
      const tone =
        Math.floor(travelled / COURSE_M) % 2 === 0 ? stone : stoneAlt;
      travelled += run;
      // The coping follows the landward sampled grade. Sampling three
      // quarters across the lip avoids taking the water table from the river
      // side while keeping each 1.6 m coping cross-section level.
      const aTop = bankTopAt(ax + outX * 0.75, az + outZ * 0.75);
      const bTop = bankTopAt(bx + outX * 0.75, bz + outZ * 0.75);
      for (const [px, py, pz] of [
        [ax, waterTopY - BED_DROP, az],
        [bx, waterTopY - BED_DROP, bz],
        [bx, bTop, bz],
        [ax, waterTopY - BED_DROP, az],
        [bx, bTop, bz],
        [ax, aTop, az],
      ] as const) {
        wallPositions.push(px, py, pz);
        wallColors.push(tone.r, tone.g, tone.b);
      }
      for (const [px, py, pz] of [
        [ax, aTop, az],
        [bx, bTop, bz],
        [bx + outX, bTop, bz + outZ],
        [ax, aTop, az],
        [bx + outX, bTop, bz + outZ],
        [ax + outX, aTop, az + outZ],
      ] as const) {
        wallPositions.push(px, py, pz);
        wallColors.push(coping.r, coping.g, coping.b);
      }
      // The two inked lines stay in their own runs, so each reads as one
      // continuous chain rather than alternating water line and kerb.
      shorePositions.push(ax, aTop + 0.04, az, bx, bTop + 0.04, bz);
      copingPositions.push(
        ax + outX,
        aTop + 0.04,
        az + outZ,
        bx + outX,
        bTop + 0.04,
        bz + outZ,
      );
    }
  }
  const inkPositions = shorePositions.concat(copingPositions);
  if (wallPositions.length > 0) {
    const rawGeometry = new BufferGeometry();
    rawGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(wallPositions, 3),
    );
    rawGeometry.setAttribute(
      "color",
      new Float32BufferAttribute(wallColors, 3),
    );
    const geometry = mergeVertices(rawGeometry, 1e-4);
    rawGeometry.dispose();
    geometry.computeVertexNormals();
    const dayMaterial = new MeshBasicMaterial({
      side: DoubleSide,
      vertexColors: true,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x2a3138,
      side: DoubleSide,
    });
    const walls = new Mesh(geometry, dayMaterial);
    walls.userData.dayMaterial = dayMaterial;
    walls.userData.nightMaterial = nightMaterial;
    walls.name = "smooth quay walls";
    group.add(walls);
  }
  if (inkPositions.length > 0) {
    const rawGeometry = new BufferGeometry();
    rawGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(inkPositions, 3),
    );
    const geometry = mergeVertices(rawGeometry, 1e-4);
    rawGeometry.dispose();
    const shore = new LineSegments(
      geometry,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    shore.name = "smooth shoreline ink";
    shore.renderOrder = 2;
    group.add(shore);
  }

  const pondLevels = addNaturalPonds(group, ponds, bankY, terrainAt);
  const basinLevels = addBasinsAndSunkenWalls(
    group,
    surfaces,
    basins,
    bankY,
    terrainAt,
  );
  const localLevels = new Map([...pondLevels, ...basinLevels]);
  addStaticWaterRipples(
    group,
    rivers,
    [...ponds, ...basins],
    localLevels,
    waterTopY,
  );
  addBeaverEasterEggs(group, ponds, pondLevels);
  return group;
}

/** Highest surveyed ground touched by a ring, in metres. */
function ringTerrainCeiling(
  ring: number[][],
  fallback: number,
  terrainAt?: (x: number, z: number) => number,
): number {
  if (!terrainAt) {
    return fallback;
  }
  let ceiling = -Infinity;
  for (const [xDm, zDm] of ring) {
    ceiling = Math.max(ceiling, terrainAt(xDm / 10, zDm / 10));
  }
  return Number.isFinite(ceiling) ? ceiling : fallback;
}

/**
 * Stable local level for a natural pond.
 *
 * OSM fixes the shoreline but does not publish bathymetry. The lower-third
 * boundary quantile is robust against one path or bridge point lifting an
 * entire lake, while the 16 cm presentation lift keeps the flat plate clear
 * of the terrain-draped lawn. This is explicitly display geometry, not a
 * surveyed water gauge.
 */
export function naturalWaterLevel(
  surface: SurfacePolygon,
  fallback: number,
  terrainAt?: (x: number, z: number) => number,
): number {
  if (!terrainAt || surface.ring.length === 0) {
    return fallback + 0.16;
  }
  const samples = surface.ring
    .map(([x, z]) => terrainAt(x / 10, z / 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (samples.length === 0) {
    return fallback + 0.16;
  }
  return samples[Math.floor((samples.length - 1) * 0.33)] + 0.16;
}

function ringContains(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) {
      inside = !inside;
    }
  }
  return inside;
}

export const WATER_RIPPLE_SEGMENTS = 6;

/**
 * One static, gently bowed water stroke in world space.
 *
 * The returned triangles form a continuous ribbon with shared end positions;
 * there is no clock or screen-space phase, so the line cannot shimmer while
 * the camera moves. A curved centreline reads like an engraved map wave
 * instead of the former set of unrelated rectangular dashes.
 */
export function curvedWaterRipple(
  center: readonly [number, number],
  y: number,
  angle: number,
  lengthM: number,
  curvatureM: number,
  halfWidthM = 0.065,
  segments = WATER_RIPPLE_SEGMENTS,
): number[] {
  if (
    ![...center, y, angle, lengthM, curvatureM, halfWidthM, segments].every(
      Number.isFinite,
    ) ||
    lengthM <= 0 ||
    halfWidthM <= 0 ||
    segments < 1
  ) {
    return [];
  }
  const count = Math.max(1, Math.floor(segments));
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let index = 0; index <= count; index += 1) {
    const u = index / count;
    const centred = u - 0.5;
    const along = centred * lengthM;
    const bow = curvatureM * (1 - 4 * centred * centred);
    const x = center[0] + cos * along - sin * bow;
    const z = center[1] + sin * along + cos * bow;
    // Analytic tangent of the parabolic centreline. Keeping the width normal
    // continuous closes every join without mitre spikes or overlapping caps.
    const localTangentX = lengthM;
    const localTangentZ = -8 * curvatureM * centred;
    const tangentX = cos * localTangentX - sin * localTangentZ;
    const tangentZ = sin * localTangentX + cos * localTangentZ;
    const tangentLength = Math.max(1e-6, Math.hypot(tangentX, tangentZ));
    const normalX = -tangentZ / tangentLength;
    const normalZ = tangentX / tangentLength;
    left.push([x + normalX * halfWidthM, z + normalZ * halfWidthM]);
    right.push([x - normalX * halfWidthM, z - normalZ * halfWidthM]);
  }
  const positions: number[] = [];
  for (let index = 0; index < count; index += 1) {
    positions.push(
      left[index][0],
      y,
      left[index][1],
      right[index][0],
      y,
      right[index][1],
      right[index + 1][0],
      y,
      right[index + 1][1],
      left[index][0],
      y,
      left[index][1],
      right[index + 1][0],
      y,
      right[index + 1][1],
      left[index + 1][0],
      y,
      left[index + 1][1],
    );
  }
  return positions;
}

function addStaticWaterRipples(
  group: Group,
  rivers: SurfacePolygon[],
  basins: SurfacePolygon[],
  basinLevels: Map<SurfacePolygon, number>,
  waterTopY: number,
): void {
  const positions: number[] = [];
  const waters = [...rivers, ...basins];
  waters.forEach((surface, surfaceIndex) => {
    if (surface.area_m2 < 70 || surface.ring.length < 4) {
      return;
    }
    const [cx, cz] = surfaceCentroidM(surface);
    const level = basinLevels.get(surface) ?? waterTopY;
    const rippleCount = Math.min(
      9,
      Math.max(2, Math.round(Math.sqrt(surface.area_m2) / 18)),
    );
    for (let index = 0; index < rippleCount; index += 1) {
      const angle =
        ((surfaceIndex * 0.71 + index * 1.93) % (Math.PI * 2)) - Math.PI;
      const distance =
        1.5 + index * Math.min(4.5, Math.sqrt(surface.area_m2) / 20);
      const x = cx + Math.cos(angle * 1.7) * distance;
      const z = cz + Math.sin(angle * 1.3) * distance;
      if (!ringContains(surface.ring, x * 10, z * 10)) {
        continue;
      }
      const length = 2.4 + ((surfaceIndex + index) % 5) * 0.7;
      const y = level + 0.055 + (index % 2) * 0.012;
      const ribbon = curvedWaterRipple(
        [x, z],
        y,
        angle,
        length,
        (index % 2 === 0 ? 1 : -1) * (0.2 + (index % 3) * 0.08),
      );
      // Keep the whole decorative stroke within the mapped water polygon.
      // Testing every generated vertex is cheap at six segments and avoids a
      // glint crossing a quay or island edge.
      let inside = true;
      for (let vertex = 0; vertex < ribbon.length; vertex += 3) {
        if (
          !ringContains(
            surface.ring,
            ribbon[vertex] * 10,
            ribbon[vertex + 2] * 10,
          )
        ) {
          inside = false;
          break;
        }
      }
      if (inside) {
        positions.push(...ribbon);
      }
    }
  });
  if (positions.length === 0) {
    return;
  }
  const rawGeometry = new BufferGeometry();
  rawGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  const geometry = mergeVertices(rawGeometry, 1e-4);
  rawGeometry.dispose();
  const dayMaterial = new MeshBasicMaterial({
    color: 0xd9edf2,
    depthWrite: false,
    opacity: 0.42,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    transparent: true,
  });
  const nightMaterial = new MeshBasicMaterial({
    color: 0x80a9c2,
    depthWrite: false,
    opacity: 0.34,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    transparent: true,
  });
  const ripples = new Mesh(geometry, dayMaterial);
  ripples.name = "static water ripple ribbons";
  ripples.renderOrder = 3;
  ripples.userData.dayMaterial = dayMaterial;
  ripples.userData.nightMaterial = nightMaterial;
  ripples.userData.staticAntiFlicker = true;
  ripples.userData.presentation =
    "Static world-space curved engraving; no animation or screen-space phase";
  group.add(ripples);
}

export const BEAVER_EASTER_EGG_COUNT = 3;

const BEAVER_ANCHORS: ReadonlyArray<[number, number]> = [
  [-485, 869],
  [-67, 485],
  [-1_610, 912],
];

function addBeaverEasterEggs(
  group: Group,
  waters: SurfacePolygon[],
  levels: Map<SurfacePolygon, number>,
): void {
  const beavers = new Group();
  beavers.name = "three hidden Tiergarten beavers";
  beavers.userData.easterEgg = true;
  beavers.userData.geometryStatus =
    "Decorative Easter eggs on OSM-derived park water; positions are display approximations";
  const bodyMaterial = new MeshBasicMaterial({ color: 0x76523d });
  const darkMaterial = new MeshBasicMaterial({ color: 0x332a25 });
  const tailMaterial = new MeshBasicMaterial({ color: 0x4d382d });
  const toothMaterial = new MeshBasicMaterial({ color: 0xf0e5c7 });
  BEAVER_ANCHORS.forEach(([anchorX, anchorZ], index) => {
    const host = [...waters].sort((left, right) => {
      const [lx, lz] = surfaceCentroidM(left);
      const [rx, rz] = surfaceCentroidM(right);
      return (
        Math.hypot(lx - anchorX, lz - anchorZ) -
        Math.hypot(rx - anchorX, rz - anchorZ)
      );
    })[0];
    if (!host) {
      return;
    }
    const [hostX, hostZ] = surfaceCentroidM(host);
    const x = ringContains(host.ring, anchorX * 10, anchorZ * 10)
      ? anchorX
      : hostX;
    const z = ringContains(host.ring, anchorX * 10, anchorZ * 10)
      ? anchorZ
      : hostZ;
    const y = (levels.get(host) ?? 4.2) + 0.18;
    const yaw = 0.55 + index * 1.37;
    const individual = new Group();
    individual.name = `hidden beaver ${index + 1}`;
    individual.position.set(x, y, z);
    individual.rotation.y = yaw;

    const body = new Mesh(new IcosahedronGeometry(0.44, 1), bodyMaterial);
    body.name = "beaver body";
    body.scale.set(1.6, 0.72, 0.78);
    body.position.y = 0.12;
    individual.add(body);
    const head = new Mesh(new IcosahedronGeometry(0.29, 1), bodyMaterial);
    head.name = "beaver head";
    head.position.set(0.62, 0.2, 0);
    individual.add(head);
    const tail = new Mesh(new BoxGeometry(0.72, 0.08, 0.36), tailMaterial);
    tail.name = "beaver paddle tail";
    tail.position.set(-0.75, 0.03, 0);
    tail.rotation.y = 0.14;
    individual.add(tail);
    for (const side of [-1, 1]) {
      const eye = new Mesh(new IcosahedronGeometry(0.045, 1), darkMaterial);
      eye.name = "beaver eye";
      eye.position.set(0.84, 0.28, side * 0.14);
      individual.add(eye);
      const tooth = new Mesh(new BoxGeometry(0.12, 0.16, 0.055), toothMaterial);
      tooth.name = "beaver incisor";
      tooth.position.set(0.91, 0.08, side * 0.055);
      individual.add(tooth);
    }
    beavers.add(individual);
  });
  group.add(beavers);
}

/**
 * Natural ponds and their connecting streams.
 *
 * Shorelines and islands are the committed OSM rings. The visible bed depth
 * and short bank slope are restrained display approximations because no
 * public bathymetric survey is present in the repository. Unlike a built
 * fountain, a pond gets no vertical wall and no concrete rim.
 */
function addNaturalPonds(
  group: Group,
  ponds: SurfacePolygon[],
  bankY: number,
  terrainAt?: (x: number, z: number) => number,
): Map<SurfacePolygon, number> {
  const levels = new Map<SurfacePolygon, number>();
  const floorParts: BufferGeometry[] = [];
  const waterParts: BufferGeometry[] = [];
  const slopePositions: number[] = [];
  const shorelinePositions: number[] = [];

  for (const pond of ponds) {
    if (pond.ring.length < 4) {
      continue;
    }
    const level = naturalWaterLevel(pond, bankY, terrainAt);
    const depth =
      pond.kind === "stream"
        ? 0.35
        : Math.min(
            1.55,
            Math.max(0.8, 0.5 + Math.log10(Math.max(10, pond.area_m2)) * 0.24),
          );
    const floorY = level - depth;
    levels.set(pond, level);

    let shape: Shape;
    try {
      shape = shapeFromSurface(pond);
    } catch {
      continue;
    }
    for (const [y, parts] of [
      [floorY, floorParts],
      [level, waterParts],
    ] as const) {
      try {
        const geometry = new ShapeGeometry(shape);
        geometry.deleteAttribute("uv");
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, y, 0);
        parts.push(geometry);
      } catch {
        continue;
      }
    }

    const slopeRing = (source: number[][], isIsland: boolean): void => {
      const ring = smoothSurfaceRing(source, surfaceCurveOptions(pond));
      if (ring.length < 3) {
        return;
      }
      const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
      const cz = ring.reduce((sum, [, z]) => sum + z, 0) / ring.length;
      const inset =
        pond.kind === "stream" ? 0.22 : Math.min(1.6, 0.7 + depth * 0.45);
      const bottom = ring.map(([x, z]): [number, number] => {
        const dx = cx - x;
        const dz = cz - z;
        const distance = Math.max(1e-6, Math.hypot(dx, dz));
        const direction = isIsland ? -1 : 1;
        return [
          x + (dx / distance) * inset * direction,
          z + (dz / distance) * inset * direction,
        ];
      });
      for (let index = 0; index < ring.length; index += 1) {
        const [ax, az] = ring[index];
        const [bx, bz] = ring[(index + 1) % ring.length];
        const [aFloorX, aFloorZ] = bottom[index];
        const [bFloorX, bFloorZ] = bottom[(index + 1) % bottom.length];
        const topY = level - 0.018;
        const bottomY = floorY + 0.018;
        slopePositions.push(
          ax,
          topY,
          az,
          aFloorX,
          bottomY,
          aFloorZ,
          bFloorX,
          bottomY,
          bFloorZ,
          ax,
          topY,
          az,
          bFloorX,
          bottomY,
          bFloorZ,
          bx,
          topY,
          bz,
        );
        shorelinePositions.push(ax, level + 0.035, az, bx, level + 0.035, bz);
      }
    };
    slopeRing(pond.ring, false);
    for (const hole of pond.holes ?? []) {
      slopeRing(hole, true);
    }
  }

  const addMergedPlate = (
    parts: BufferGeometry[],
    name: string,
    dayMaterial: MeshBasicMaterial,
    nightMaterial: MeshBasicMaterial,
    renderOrder = 0,
  ): void => {
    if (parts.length === 0) {
      return;
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (!geometry) {
      return;
    }
    const mesh = new Mesh(geometry, dayMaterial);
    mesh.name = name;
    mesh.renderOrder = renderOrder;
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.userData.sourceGeometry = "OSM shoreline and island rings";
    mesh.userData.depthStatus =
      "0.35-1.55 m display depth scaled by area; not surveyed bathymetry";
    mesh.userData.levelStatus =
      "Lower-third local terrain rim plus 0.16 m presentation clearance";
    group.add(mesh);
  };

  addMergedPlate(
    floorParts,
    "natural pond floors",
    new MeshBasicMaterial({ color: 0x87998c }),
    new MeshBasicMaterial({ color: 0x15242a }),
  );
  if (slopePositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(slopePositions, 3),
    );
    const dayMaterial = new MeshBasicMaterial({
      color: 0x718a73,
      side: DoubleSide,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x162821,
      side: DoubleSide,
    });
    const slopes = new Mesh(geometry, dayMaterial);
    slopes.name = "natural pond bank slopes";
    slopes.userData.dayMaterial = dayMaterial;
    slopes.userData.nightMaterial = nightMaterial;
    slopes.userData.geometryStatus =
      "OSM shoreline with a restrained display-depth inward slope";
    group.add(slopes);
  }
  addMergedPlate(
    waterParts,
    "natural pond water",
    new MeshBasicMaterial({
      color: 0x85b9ca,
      depthWrite: false,
      opacity: 0.58,
      transparent: true,
    }),
    new MeshBasicMaterial({
      color: 0x24465a,
      depthWrite: false,
      opacity: 0.72,
      transparent: true,
    }),
    1,
  );
  if (shorelinePositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(shorelinePositions, 3),
    );
    const shoreline = new LineSegments(
      geometry,
      markArchitecturalAccentInk(new LineBasicMaterial(), 0x557467, "micro"),
    );
    shoreline.name = "natural pond shoreline ink";
    shoreline.renderOrder = 3;
    shoreline.userData.staticAntiFlicker = true;
    group.add(shoreline);
  }
  return levels;
}

/**
 * Constructed basins and the walls that sink into them.
 *
 * A basin is drawn as one FLAT plate per basin, set just above the lawn
 * that surrounds it: the lawn plate is opaque and covers the whole park
 * polygon, so a basin sunk to its true rim depth would simply not be
 * visible from above. The plate is nearly opaque over a pale bed so the
 * water reads blue rather than as a green lawn seen through a tint.
 *
 * A sunken wall keeps the OSM ring the mapper cut out of the water and
 * ramps its top face linearly along the foot→crest axis, from ground level
 * on the rim to a high point out in the basin where the slab breaks off in
 * a near-vertical face and drops through the water. The walkable crown and
 * its two parapet rails run the whole ramp, from the entrance to the break.
 */
function addBasinsAndSunkenWalls(
  group: Group,
  surfaces: SurfacePayload,
  basins: SurfacePolygon[],
  bankY: number,
  terrainAt?: (x: number, z: number) => number,
): Map<SurfacePolygon, number> {
  if (basins.length === 0) {
    return new Map();
  }
  /** Clear of the lawn plate (+0.06) and every park path (up to +0.14). */
  const BASIN_LIFT_M = 0.22;
  const DISPLAY_DEPTH_M = 0.9;
  /** Height of the wedge at its high point, from the photographs. */
  const WALL_RISE_M = 5.6;
  /** How far the plunge face carries on below the water line. */
  const PLUNGE_DROP_M = 1.1;
  const CROWN_WIDTH_FRACTION = 0.5;
  /** Waist-high parapet either side of the walkway, drawn as ink lines. */
  const RAIL_HEIGHT_M = 0.95;
  const RAIL_POST_SPACING_M = 2.6;

  const levelOf = new Map<SurfacePolygon, number>();
  const bedParts: BufferGeometry[] = [];
  const waterParts: BufferGeometry[] = [];
  const ottoBedParts: BufferGeometry[] = [];
  const ottoWaterParts: BufferGeometry[] = [];
  const depthWallPositions: number[] = [];
  const rimInk: number[] = [];
  for (const basin of basins) {
    if (basin.ring.length < 4) {
      continue;
    }
    const level =
      ringTerrainCeiling(basin.ring, bankY, terrainAt) + BASIN_LIFT_M;
    levelOf.set(basin, level);
    let shape: Shape;
    try {
      shape = shapeFromSurface(basin);
    } catch {
      continue;
    }
    const basinCx =
      basin.ring.reduce((sum, [x]) => sum + x / 10, 0) / basin.ring.length;
    const basinCz =
      basin.ring.reduce((sum, [, z]) => sum + z / 10, 0) / basin.ring.length;
    const isOttoWeidtFountain =
      basin.area_m2 > 150 &&
      basin.area_m2 < 220 &&
      Math.hypot(
        basinCx - OTTO_WEIDT_FOUNTAIN_WORLD[0],
        basinCz - OTTO_WEIDT_FOUNTAIN_WORLD[1],
      ) < 8;
    for (const [y, target] of [
      [level - DISPLAY_DEPTH_M, isOttoWeidtFountain ? ottoBedParts : bedParts],
      [level, isOttoWeidtFountain ? ottoWaterParts : waterParts],
    ] as const) {
      let geometry: ShapeGeometry;
      try {
        geometry = new ShapeGeometry(shape);
      } catch {
        continue;
      }
      geometry.deleteAttribute("uv");
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y, 0);
      target.push(geometry);
    }
    const ring = smoothSurfaceRing(basin.ring);
    for (let index = 0; index < ring.length; index += 1) {
      const [ax, az] = ring[index];
      const [bx, bz] = ring[(index + 1) % ring.length];
      rimInk.push(ax, level + 0.03, az, bx, level + 0.03, bz);
      depthWallPositions.push(
        ax,
        level - DISPLAY_DEPTH_M,
        az,
        bx,
        level - DISPLAY_DEPTH_M,
        bz,
        bx,
        level,
        bz,
        ax,
        level - DISPLAY_DEPTH_M,
        az,
        bx,
        level,
        bz,
        ax,
        level,
        az,
      );
    }
  }

  const addPlate = (
    parts: BufferGeometry[],
    name: string,
    day: MeshBasicMaterial,
    night: MeshBasicMaterial,
    renderOrder = 0,
  ): void => {
    if (parts.length === 0) {
      return;
    }
    const merged = mergeGeometries(parts, false);
    for (const part of parts) {
      part.dispose();
    }
    if (!merged) {
      return;
    }
    const mesh = new Mesh(merged, day);
    mesh.userData.dayMaterial = day;
    mesh.userData.nightMaterial = night;
    mesh.name = name;
    mesh.renderOrder = renderOrder;
    group.add(mesh);
  };

  addPlate(
    bedParts,
    "basin floors",
    new MeshBasicMaterial({ color: 0xcfd9d3 }),
    new MeshBasicMaterial({ color: 0x1a232b }),
  );
  addPlate(
    waterParts,
    "basin water",
    new MeshBasicMaterial({
      color: 0x9fc7d8,
      depthWrite: false,
      opacity: 0.68,
      transparent: true,
    }),
    new MeshBasicMaterial({
      color: 0x27435c,
      depthWrite: false,
      opacity: 0.78,
      transparent: true,
    }),
    1,
  );
  addPlate(
    ottoBedParts,
    "Otto-Weidt-Platz fountain floor",
    new MeshBasicMaterial({ color: 0x8c9692 }),
    new MeshBasicMaterial({ color: 0x14242d }),
  );
  addPlate(
    ottoWaterParts,
    "Otto-Weidt-Platz fountain water",
    new MeshBasicMaterial({
      color: 0x628da1,
      depthWrite: false,
      opacity: 0.91,
      transparent: true,
    }),
    new MeshBasicMaterial({
      color: 0x18384d,
      depthWrite: false,
      opacity: 0.94,
      transparent: true,
    }),
    1,
  );

  if (depthWallPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(depthWallPositions, 3),
    );
    geometry.computeVertexNormals();
    const dayMaterial = new MeshBasicMaterial({
      color: 0x9baaa1,
      side: DoubleSide,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x18242b,
      side: DoubleSide,
    });
    const walls = new Mesh(geometry, dayMaterial);
    walls.name = "basin display-depth walls";
    walls.userData.dayMaterial = dayMaterial;
    walls.userData.nightMaterial = nightMaterial;
    walls.userData.depthStatus =
      "0.9 m display approximation; not surveyed bathymetry";
    group.add(walls);
  }

  const walls = surfaces.sunken_walls ?? [];
  const slabPositions: number[] = [];
  const slabColors: number[] = [];
  const crownPositions: number[] = [];
  const wallInk: number[] = [];
  const slabTone = new Color(0xb7b3ab);
  const slabSide = new Color(0xa6a29a);
  for (const wall of walls) {
    if (wall.ring.length < 4) {
      continue;
    }
    const footX = wall.foot[0] / 10;
    const footZ = wall.foot[1] / 10;
    const crestX = wall.crest[0] / 10;
    const crestZ = wall.crest[1] / 10;
    const axisX = crestX - footX;
    const axisZ = crestZ - footZ;
    const axisLengthSq = axisX * axisX + axisZ * axisZ;
    if (axisLengthSq < 1) {
      continue;
    }
    // The basin the wedge climbs into decides the water line its plunge
    // face drops through; without one there is nothing for it to sink into.
    const host = basins.find((basin) =>
      ringContains(basin.ring, crestX * 10, crestZ * 10),
    );
    const level = host ? (levelOf.get(host) ?? bankY) : null;
    if (level === null) {
      continue;
    }
    // Flush with the paving where you step on, climbing to the high point.
    const footY = (terrainAt ? terrainAt(footX, footZ) : bankY) + 0.05;
    const crestY = footY + WALL_RISE_M;
    const floorY = Math.min(footY, level) - PLUNGE_DROP_M;
    const rampAt = (x: number, z: number): number => {
      const t = Math.min(
        1,
        Math.max(0, ((x - footX) * axisX + (z - footZ) * axisZ) / axisLengthSq),
      );
      return footY + (crestY - footY) * t;
    };

    let top: ShapeGeometry;
    try {
      top = new ShapeGeometry(
        shapeFromSurface({
          area_m2: wall.area_m2,
          holes: [],
          name: wall.name,
          ring: wall.ring,
        }),
      );
    } catch {
      continue;
    }
    top.deleteAttribute("uv");
    top.rotateX(-Math.PI / 2);
    const position = top.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      position.setY(index, rampAt(position.getX(index), position.getZ(index)));
    }
    position.needsUpdate = true;
    // ShapeGeometry is indexed; the slab is accumulated as raw triangles.
    const flat = top.toNonIndexed();
    const flatPosition = flat.getAttribute("position");
    for (let index = 0; index < flatPosition.count; index += 1) {
      slabPositions.push(
        flatPosition.getX(index),
        flatPosition.getY(index),
        flatPosition.getZ(index),
      );
      slabColors.push(slabTone.r, slabTone.g, slabTone.b);
    }
    flat.dispose();
    top.dispose();

    // Skirt: the visible flank of the slab, from the ramped crown down
    // past the water line so the wall reads as a solid scheibe standing
    // in the basin rather than a grey decal on the surface.
    const ring = smoothSurfaceRing(wall.ring);
    for (let index = 0; index < ring.length; index += 1) {
      const [ax, az] = ring[index];
      const [bx, bz] = ring[(index + 1) % ring.length];
      const ay = rampAt(ax, az);
      const by = rampAt(bx, bz);
      for (const [px, py, pz] of [
        [ax, floorY, az],
        [bx, floorY, bz],
        [bx, by, bz],
        [ax, floorY, az],
        [bx, by, bz],
        [ax, ay, az],
      ] as const) {
        slabPositions.push(px, py, pz);
        slabColors.push(slabSide.r, slabSide.g, slabSide.b);
      }
      wallInk.push(ax, ay + 0.03, az, bx, by + 0.03, bz);
    }

    // Walkable crown: the narrow stepped path you enter at the foot and
    // ride all the way up to the break, with a parapet either side.
    const axisLength = Math.sqrt(axisLengthSq);
    const halfWidth = (wall.width_m * CROWN_WIDTH_FRACTION) / 2;
    const sideX = (-axisZ / axisLength) * halfWidth;
    const sideZ = (axisX / axisLength) * halfWidth;
    const STEPS = 24;
    for (let step = 0; step < STEPS; step += 1) {
      const t0 = step / STEPS;
      const t1 = (step + 1) / STEPS;
      const p0x = footX + axisX * t0;
      const p0z = footZ + axisZ * t0;
      const p1x = footX + axisX * t1;
      const p1z = footZ + axisZ * t1;
      const y0 = rampAt(p0x, p0z) + 0.05;
      const y1 = rampAt(p1x, p1z) + 0.05;
      crownPositions.push(
        p0x - sideX,
        y0,
        p0z - sideZ,
        p1x - sideX,
        y1,
        p1z - sideZ,
        p1x + sideX,
        y1,
        p1z + sideZ,
        p0x - sideX,
        y0,
        p0z - sideZ,
        p1x + sideX,
        y1,
        p1z + sideZ,
        p0x + sideX,
        y0,
        p0z + sideZ,
      );
    }
    for (const side of [-1, 1] as const) {
      const railX = sideX * side;
      const railZ = sideZ * side;
      wallInk.push(
        footX + railX,
        footY + 0.05 + RAIL_HEIGHT_M,
        footZ + railZ,
        crestX + railX,
        crestY + 0.05 + RAIL_HEIGHT_M,
        crestZ + railZ,
      );
      const posts = Math.max(2, Math.round(axisLength / RAIL_POST_SPACING_M));
      for (let post = 0; post <= posts; post += 1) {
        const t = post / posts;
        const px = footX + axisX * t + railX;
        const pz = footZ + axisZ * t + railZ;
        const deck = rampAt(px, pz) + 0.05;
        wallInk.push(px, deck, pz, px, deck + RAIL_HEIGHT_M, pz);
      }
    }
  }

  if (slabPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(slabPositions, 3),
    );
    geometry.setAttribute("color", new Float32BufferAttribute(slabColors, 3));
    const dayMaterial = new MeshBasicMaterial({
      side: DoubleSide,
      vertexColors: true,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x39424a,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "sunken walls";
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  if (crownPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(crownPositions, 3),
    );
    const dayMaterial = new MeshBasicMaterial({
      color: 0xdcd8cc,
      side: DoubleSide,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x1b222b,
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "sunken wall crown path";
    mesh.renderOrder = 3;
    group.add(mesh);
  }
  const ink = rimInk.concat(wallInk);
  if (ink.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(ink, 3));
    const lines = new LineSegments(
      geometry,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    lines.name = "basin and sunken wall ink";
    lines.renderOrder = 4;
    group.add(lines);
  }
  return levelOf;
}

export function createIsometricCity(
  prisms: PrismPayload,
  ground: VoxelPayload | null,
  tunnel?: TunnelPortalCourseInput | null,
  surfaces?: SurfacePayload | null,
  options: IsometricCityBuildOptions = {},
): Group {
  const group = new Group();
  group.name = "Drawn isometric city (LoD2 prisms + ink lines)";

  const bodyGeometries = [];
  const glassGeometries = [];
  const edgeGeometries = [];
  const mullionPositions: number[] = [];
  // Slender facade glazing axes: ink lines by day, warm strips by night.
  const buildings = options.buildings ?? prisms.buildings;
  const facadeAxisPositions = new Float32Accumulator(buildings.length * 180);
  const facadeAxisDistances = new Uint16Accumulator(buildings.length * 60);
  const pushFacadeAxis = (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    dashLength = 0,
  ): void => {
    facadeAxisPositions.push(x1, y1, z1, x2, y2, z2);
    // A constant zero keeps bay axes solid in LineDashedMaterial. Measured
    // wall length on storey strokes adds a window-like dash rhythm without
    // duplicating geometry for fabricated pane heads.
    facadeAxisDistances.push(
      0,
      Math.min(65_535, Math.max(0, Math.round(dashLength * 100))),
    );
  };
  const kollhoffClinkerJointPositions: number[] = [];
  const kollhoffWindows: Array<{
    dirX: number;
    dirZ: number;
    lit: boolean;
    litTone: number;
    nx: number;
    nz: number;
    x: number;
    y: number;
    z: number;
  }> = [];
  const chariteWindows: Array<{
    dirX: number;
    dirZ: number;
    height: number;
    lit: boolean;
    litTone: number;
    nx: number;
    nz: number;
    width: number;
    x: number;
    y: number;
    z: number;
  }> = [];
  const windowAxes: Array<{
    dirX: number;
    dirZ: number;
    lit: boolean;
    litTone: number;
    nx: number;
    nz: number;
    x: number;
    yTop: number;
    yBottom: number;
    z: number;
  }> = [];
  const color = new Color();
  const bakeColor = (geometry: BufferGeometry, tone: Color): void => {
    const positions = geometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    for (let index = 0; index < positions.count; index += 1) {
      colors[index * 3] = tone.r;
      colors[index * 3 + 1] = tone.g;
      colors[index * 3 + 2] = tone.b;
    }
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  };
  for (const building of buildings) {
    if (
      building.ring.length < 3 ||
      PRISM_SUPPRESSED_IDS.has(building.id) ||
      isInterimOfficeFootprintSuppressed(building) ||
      isFriedrichstrasseStationFootprintSuppressed(building) ||
      (!PRISM_GLASSED_IDS.has(building.id) &&
        isHauptbahnhofFootprintSuppressed(building))
    ) {
      continue;
    }
    const y0 = building.y0_dm / 10;
    const totalHeight = Math.max(2.5, building.h_dm / 10);
    const isGlass =
      (prisms.classes[building.class] ?? "concrete") === "glass" ||
      PRISM_GLASSED_IDS.has(building.id);
    // Real roof forms from the ALKIS codes: gabled/hipped/shed roofs
    // rise from the eave as fitted flat facets; everything else keeps
    // the exact flat cap. Glass volumes stay clean transparent boxes.
    let bodyHeight = totalHeight;
    let roofTriangles: Float32Array | null = null;
    let roofRect: ReturnType<typeof fitRectangle> = null;
    const roofCode = historicChariteRoofCode(building.id, building.roof ?? 0);
    if (building.id === CHARITE_ALTHOFF_TOWER_ID) {
      bodyHeight = Math.max(
        2.5,
        Math.min(bodyHeight, CHARITE_ALTHOFF_TOWER_HELM_BOTTOM_Y_M - y0),
      );
    }
    if (
      !isGlass &&
      (roofCode === ROOF_GABLED ||
        roofCode === ROOF_HIPPED ||
        roofCode === ROOF_TENT ||
        roofCode === ROOF_SHED)
    ) {
      const ringMeters = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const rect = fitRectangle(ringMeters);
      if (rect && rect.rectangularity >= ROOF_MIN_RECTANGULARITY) {
        const rise = roofRise(rect, totalHeight);
        if (rise > 0) {
          roofTriangles = buildRoofGeometry(
            rect,
            y0 + totalHeight - rise,
            y0 + totalHeight,
            roofCode,
          );
          if (roofTriangles) {
            bodyHeight = totalHeight - rise;
            roofRect = rect;
          }
        }
      }
    }
    let geometry: BufferGeometry = new ExtrudeGeometry(
      shapeFromRings(building),
      {
        bevelEnabled: false,
        depth: bodyHeight,
      },
    );
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y0, 0);
    geometry.deleteAttribute("uv");
    if (PRISM_VISUAL_TOP_CAP_SUPPRESSED_IDS.has(building.id)) {
      geometry = withoutVisualTopCap(geometry, y0 + bodyHeight);
    }
    // Ink lines first (edges of the un-coloured prism)…
    const edges = new EdgesGeometry(geometry, ISO_EDGE_THRESHOLD_DEGREES);
    edgeGeometries.push(edges);
    if (SCHAROUN_ROOF_SEAM_IDS.has(building.id)) {
      const [centroidX, centroidZ] = prismCentroidM(building);
      const topY = y0 + totalHeight + 0.025;
      const positions: number[] = [];
      for (const [ringX, ringZ] of building.ring) {
        positions.push(
          centroidX,
          topY,
          centroidZ,
          ringX / 10,
          topY,
          ringZ / 10,
        );
      }
      const roofSeams = new BufferGeometry();
      roofSeams.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      edgeGeometries.push(roofSeams);
    }
    // …then bake the flat facade tone as vertex colour so every
    // building can share one material in one merged mesh. Glass-class
    // volumes go to their own transparent mesh in a cool glass family
    // (their photo-sampled tones are muddy reflections, not paint).
    if (isGlass) {
      const glassShades = FACADE_SHADES.glass;
      color.setHex(glassShades[hash32(building.id, 5) % glassShades.length]);
      bakeColor(geometry, color);
      glassGeometries.push(geometry);
      // Curtain-wall mullions: the transparent volume gets its drawn
      // glazing grid — verticals on the bay pitch, horizontals on the
      // storey pitch — as ink lines just outside each surveyed wall.
      for (const wall of facadeWallsOf(building)) {
        if (wall.length < WINDOW_MIN_WALL_M || totalHeight < 5) {
          continue;
        }
        const ox = wall.nx * WINDOW_FACE_OFFSET_M;
        const oz = wall.nz * WINDOW_FACE_OFFSET_M;
        const verticals = Math.floor(wall.length / ISO_WINDOW_BAY_PITCH_M);
        const vStart = (wall.length - verticals * ISO_WINDOW_BAY_PITCH_M) / 2;
        for (let step = 0; step <= verticals; step += 1) {
          const along = vStart + step * ISO_WINDOW_BAY_PITCH_M;
          const x = wall.x1 + wall.dirX * along + ox;
          const z = wall.z1 + wall.dirZ * along + oz;
          mullionPositions.push(x, y0 + 0.15, z, x, y0 + totalHeight - 0.15, z);
        }
        const storeys = Math.floor(
          (totalHeight - 1) / ISO_WINDOW_FLOOR_PITCH_M,
        );
        for (let step = 1; step <= storeys; step += 1) {
          const y = y0 + step * ISO_WINDOW_FLOOR_PITCH_M;
          mullionPositions.push(
            wall.x1 + ox,
            y,
            wall.z1 + oz,
            wall.x1 + wall.dirX * wall.length + ox,
            y,
            wall.z1 + wall.dirZ * wall.length + oz,
          );
        }
      }
      continue;
    }
    color.copy(facadeColorFor(building, prisms.classes));
    bakeColor(geometry, color);
    // Flat caps read as drawn roof plates, not sun-baked facade paint:
    // recolour up-facing cap vertices cooler and slightly darker (the
    // Reichstag's huge roof was one warm brown slab).
    const pinnedRoof =
      HERO_PRISM_ROOF_TONES[building.id] ??
      (inReichstagRegion(building)
        ? 0xe1e3dc
        : isScharounGoldPrism(building)
          ? 0xf6e0a7
          : undefined);
    const capTone =
      pinnedRoof !== undefined
        ? new Color(pinnedRoof)
        : color
            .clone()
            .multiplyScalar(0.97)
            .lerp(ROOF_PLATE_TINT, ROOF_PLATE_TINT_BLEND);
    const bodyNormals = geometry.getAttribute("normal");
    const bodyPositions = geometry.getAttribute("position");
    const bodyColors = geometry.getAttribute("color");
    const capY = y0 + bodyHeight - 0.05;
    for (let index = 0; index < bodyPositions.count; index += 1) {
      if (bodyNormals.getY(index) > 0.7 && bodyPositions.getY(index) > capY) {
        bodyColors.setXYZ(index, capTone.r, capTone.g, capTone.b);
      }
      // Constant per-face brightness from the facing direction.
      const shade = isoFaceShade(
        bodyNormals.getX(index),
        bodyNormals.getY(index),
        bodyNormals.getZ(index),
      );
      if (shade !== 1) {
        bodyColors.setXYZ(
          index,
          bodyColors.getX(index) * shade,
          bodyColors.getY(index) * shade,
          bodyColors.getZ(index) * shade,
        );
      }
    }
    bodyGeometries.push(geometry);
    if (CHARITE_BETTENHOCHHAUS_IDS.has(building.id)) {
      const baseHeight = Math.min(
        bodyHeight,
        CHARITE_BETTENHOCHHAUS_PROFILE.baseStoreys *
          CHARITE_BETTENHOCHHAUS_PROFILE.floorPitchM,
      );
      const baseTone = new Color(0x606a6d);
      for (const wall of facadeWallsOf(building)) {
        if (wall.length < 1.2) continue;
        const basePanel = new BufferGeometry();
        basePanel.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(
              wall.x1 +
                (wall.dirX * wall.length) / 2 +
                wall.nx * CHARITE_BASE_FACE_OFFSET_M,
              y0 + baseHeight / 2,
              wall.z1 +
                (wall.dirZ * wall.length) / 2 +
                wall.nz * CHARITE_BASE_FACE_OFFSET_M,
              [wall.dirX, wall.dirZ],
              wall.length,
              baseHeight,
              0.08,
            ),
            3,
          ),
        );
        basePanel.computeVertexNormals();
        bakeColor(basePanel, baseTone);
        bodyGeometries.push(basePanel);
      }
    }
    appendKollhoffClinkerJoints(
      building,
      kollhoffClinkerJointPositions,
      bodyHeight,
    );
    // Monumental flat roofs carry a drawn parapet rim (the Reichstag's
    // balustrade line), inked like every other edge.
    if (
      !roofTriangles &&
      totalHeight >= CIVIC_HEIGHT_M &&
      ringArea(
        building.ring.map(([x, z]) => [x / 10, z / 10] as [number, number]),
      ) >= CIVIC_FOOTPRINT_M2
    ) {
      for (const wall of facadeWallsOf(building)) {
        if (wall.length < 3) {
          continue;
        }
        const parapet = new BufferGeometry();
        parapet.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(
              wall.x1 + (wall.dirX * wall.length) / 2,
              y0 + totalHeight + 0.35,
              wall.z1 + (wall.dirZ * wall.length) / 2,
              [wall.dirX, wall.dirZ],
              wall.length,
              0.7,
              0.4,
            ),
            3,
          ),
        );
        parapet.computeVertexNormals();
        edgeGeometries.push(
          new EdgesGeometry(parapet, ISO_EDGE_THRESHOLD_DEGREES),
        );
        bakeColor(parapet, capTone.clone().multiplyScalar(0.94));
        bodyGeometries.push(parapet);
      }
    }
    // Every measured outer and courtyard wall carries slender
    // floor-to-cornice axes plus storey bands. Formats follow the building's
    // own kind: piano-nobile for civic monuments, housing proportions
    // elsewhere. At night a deterministic share of axes is lit. Hero
    // buildings (Reichstag) keep their separately referenced real windows.
    if (
      totalHeight >= WINDOW_MIN_BUILDING_M &&
      !WINDOWS_SUPPRESSED_IDS.has(building.id)
    ) {
      const ringMeters2 = building.ring.map(
        ([x, z]) => [x / 10, z / 10] as [number, number],
      );
      const isCivic =
        ringArea(ringMeters2) >= CIVIC_FOOTPRINT_M2 &&
        totalHeight >= CIVIC_HEIGHT_M;
      const format = windowFormatForBuilding(building.id, isCivic);
      const bayPitch = format.bayPitch;
      const axisTop = y0 + bodyHeight - 0.9;
      const axisBottom = y0 + 1.2;
      const nightStrip = isCivic
        ? WINDOW_NIGHT_CIVIC_TONES
        : WINDOW_NIGHT_LIT_TONES;
      const litLimit = Math.round(WINDOW_LIT_FRACTION * 1000);
      const walls = facadeWallsOf(building);
      if (axisTop > axisBottom + 1) {
        for (const wall of walls) {
          if (wall.length < WINDOW_MIN_WALL_M) {
            continue;
          }
          if (CHARITE_BETTENHOCHHAUS_IDS.has(building.id)) {
            const profile = CHARITE_BETTENHOCHHAUS_PROFILE;
            const floorCount = Math.min(
              profile.storeys,
              Math.max(
                0,
                Math.floor(
                  (bodyHeight - format.sillStart - format.height) /
                    profile.floorPitchM,
                ) + 1,
              ),
            );
            const paneOx = wall.nx * CHARITE_WINDOW_FACE_OFFSET_M;
            const paneOz = wall.nz * CHARITE_WINDOW_FACE_OFFSET_M;
            for (let floor = 0; floor < floorCount; floor += 1) {
              const baseFloor = floor < profile.baseStoreys;
              const pitch = baseFloor
                ? profile.basePanelPitchM
                : profile.upperPanelPitchM;
              const bays = Math.floor((wall.length - 0.8) / pitch);
              if (bays < 1) continue;
              const first = (wall.length - (bays - 1) * pitch) / 2;
              const paneHeight = baseFloor
                ? 1.42
                : profile.facadeElementHeightM;
              const paneWidth = baseFloor ? Math.min(2.85, pitch - 0.55) : 1.05;
              const paneY =
                y0 +
                format.sillStart +
                floor * profile.floorPitchM +
                paneHeight / 2;
              pushFacadeAxis(
                wall.x1 + paneOx,
                paneY - paneHeight / 2 - 0.28,
                wall.z1 + paneOz,
                wall.x1 + wall.dirX * wall.length + paneOx,
                paneY - paneHeight / 2 - 0.28,
                wall.z1 + wall.dirZ * wall.length + paneOz,
              );
              for (let bay = 0; bay < bays; bay += 1) {
                const along = first + bay * pitch;
                const roll =
                  hash32(
                    building.id,
                    wall.index * 2801 + floor * 173 + bay * 53,
                  ) % 1000;
                chariteWindows.push({
                  dirX: wall.dirX,
                  dirZ: wall.dirZ,
                  height: paneHeight,
                  lit: roll < litLimit,
                  litTone: nightStrip[roll % nightStrip.length],
                  nx: wall.nx,
                  nz: wall.nz,
                  width: paneWidth,
                  x: wall.x1 + wall.dirX * along + paneOx,
                  y: paneY,
                  z: wall.z1 + wall.dirZ * along + paneOz,
                });
              }
            }
            const baseTop =
              y0 + profile.baseStoreys * profile.floorPitchM - 0.15;
            for (const [pitch, bottom, top] of [
              [profile.basePanelPitchM, axisBottom, Math.min(baseTop, axisTop)],
              [
                profile.upperPanelPitchM,
                Math.max(baseTop, axisBottom),
                axisTop,
              ],
            ] as const) {
              if (top <= bottom) continue;
              const axes = Math.floor(wall.length / pitch);
              const first = (wall.length - axes * pitch) / 2;
              for (let axis = 0; axis <= axes; axis += 1) {
                const along = first + axis * pitch;
                pushFacadeAxis(
                  wall.x1 + wall.dirX * along + paneOx,
                  bottom,
                  wall.z1 + wall.dirZ * along + paneOz,
                  wall.x1 + wall.dirX * along + paneOx,
                  top,
                  wall.z1 + wall.dirZ * along + paneOz,
                );
              }
            }
            continue;
          }
          const axes = Math.floor((wall.length - 1.2) / bayPitch);
          if (axes < 1) {
            continue;
          }
          const first = (wall.length - (axes - 1) * bayPitch) / 2;
          const ox = wall.nx * WINDOW_FACE_OFFSET_M;
          const oz = wall.nz * WINDOW_FACE_OFFSET_M;
          const grid = windowGrid(wall.length, bodyHeight, format);
          const sillOf = (floor: number): number =>
            y0 + format.sillStart + floor * format.floorPitch;
          // One dashed sill rhythm crosses the measured wall at every
          // derived storey. Together with the solid bay axes it reads as
          // repeated openings, but stays honest about LoD2: individual pane
          // coordinates are not surveyed and no duplicate head geometry is
          // fabricated.
          if (grid) {
            for (let floor = 0; floor < grid.floors; floor += 1) {
              const bandY = sillOf(floor) - 0.28;
              pushFacadeAxis(
                wall.x1 + ox,
                bandY,
                wall.z1 + oz,
                wall.x1 + wall.dirX * wall.length + ox,
                bandY,
                wall.z1 + wall.dirZ * wall.length + oz,
                wall.length,
              );
            }
            if (KOLLHOFF_TOWER_PRISM_IDS.has(building.id)) {
              const paneOx = wall.nx * KOLLHOFF_WINDOW_FACE_OFFSET_M;
              const paneOz = wall.nz * KOLLHOFF_WINDOW_FACE_OFFSET_M;
              for (let floor = 0; floor < grid.floors; floor += 1) {
                const y = sillOf(floor) + format.height / 2;
                for (let bay = 0; bay < grid.bays; bay += 1) {
                  const along = grid.firstOffset + bay * format.bayPitch;
                  const roll =
                    hash32(
                      building.id,
                      wall.index * 2801 + floor * 173 + bay * 53,
                    ) % 1000;
                  kollhoffWindows.push({
                    dirX: wall.dirX,
                    dirZ: wall.dirZ,
                    lit: roll < litLimit,
                    litTone: nightStrip[roll % nightStrip.length],
                    nx: wall.nx,
                    nz: wall.nz,
                    x: wall.x1 + wall.dirX * along + paneOx,
                    y,
                    z: wall.z1 + wall.dirZ * along + paneOz,
                  });
                }
              }
            }
          }
          for (let axis = 0; axis < axes; axis += 1) {
            const along = first + axis * bayPitch;
            const x = wall.x1 + wall.dirX * along + ox;
            const z = wall.z1 + wall.dirZ * along + oz;
            // Slender glazing line as ink (the facade axis).
            pushFacadeAxis(x, axisBottom, z, x, axisTop, z);
            // NO invented panes: LoD2 carries no real window positions,
            // so a pane per bay/floor was fabrication ("keine
            // schwachsinnigen nichtexistierenden Quadratfenster"). The
            // facade rhythm is carried by the drawn axes and storey
            // bands above. Exact entrance coordinates are absent from
            // this payload, so ordinary prisms deliberately add no doors.
            // A warm-lit vertical strip on ~38% of axes at night.
            const roll =
              hash32(building.id, wall.index * 2801 + axis * 53) % 1000;
            if (!KOLLHOFF_TOWER_PRISM_IDS.has(building.id)) {
              windowAxes.push({
                dirX: wall.dirX,
                dirZ: wall.dirZ,
                lit: roll < litLimit,
                litTone: nightStrip[roll % nightStrip.length],
                nx: wall.nx,
                nz: wall.nz,
                x,
                yTop: axisTop,
                yBottom: axisBottom,
                z,
              });
            }
          }
        }
      }
    }
    // Hyperdetail bands: darker Sockel at the base of every wall and a
    // light protruding Gesims under the flat roof edge (pitched roofs
    // already carry their eaves).
    if (
      totalHeight >= DETAIL_MIN_BUILDING_M &&
      !GENERIC_FACADE_TRIM_SUPPRESSED_IDS.has(building.id)
    ) {
      const sockelTone = color.clone().multiplyScalar(0.92);
      const corniceTone = color
        .clone()
        .multiplyScalar(0.95)
        .lerp(ROOF_PLATE_TINT, 0.15);
      for (const wall of facadeWallsOf(building)) {
        if (wall.length < DETAIL_MIN_WALL_M) {
          continue;
        }
        const mx = wall.x1 + (wall.dirX * wall.length) / 2;
        const mz = wall.z1 + (wall.dirZ * wall.length) / 2;
        const sockel = new BufferGeometry();
        sockel.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(
              mx,
              y0 + SOCKEL_HEIGHT_M / 2,
              mz,
              [wall.dirX, wall.dirZ],
              wall.length + 0.08,
              SOCKEL_HEIGHT_M,
              SOCKEL_DEPTH_M,
            ),
            3,
          ),
        );
        sockel.computeVertexNormals();
        bakeColor(sockel, sockelTone);
        bodyGeometries.push(sockel);
        if (!roofTriangles) {
          const cornice = new BufferGeometry();
          cornice.setAttribute(
            "position",
            new Float32BufferAttribute(
              boxTriangles(
                mx,
                y0 + bodyHeight - CORNICE_HEIGHT_M / 2 - 0.04,
                mz,
                [wall.dirX, wall.dirZ],
                wall.length + 0.1,
                CORNICE_HEIGHT_M,
                CORNICE_DEPTH_M,
              ),
              3,
            ),
          );
          cornice.computeVertexNormals();
          edgeGeometries.push(
            new EdgesGeometry(cornice, ISO_EDGE_THRESHOLD_DEGREES),
          );
          bakeColor(cornice, corniceTone);
          bodyGeometries.push(cornice);
        }
      }
    }
    // Referenced Reichstag roof details are retained below. Ordinary LoD2
    // roofs deliberately stop at their measured envelope: the payload has no
    // coordinates for generic HVAC units, roof hatches or skylights.
    if (building.id === "K0002MCN") {
      // The Reichstag roof at drawing quality: the two glass skylight
      // bands flanking the dome over the plenary hall, and the
      // roof-garden restaurant block at the south-west corner.
      const domeX = 317.73;
      const domeZ = 40.48;
      const roofTop = y0 + totalHeight;
      for (const side of [-26, 26]) {
        const skylight = new BufferGeometry();
        skylight.setAttribute(
          "position",
          new Float32BufferAttribute(
            boxTriangles(
              domeX,
              roofTop + 0.35,
              domeZ + side,
              [1, 0],
              38,
              0.7,
              7,
            ),
            3,
          ),
        );
        skylight.computeVertexNormals();
        edgeGeometries.push(
          new EdgesGeometry(skylight, ISO_EDGE_THRESHOLD_DEGREES),
        );
        bakeColor(skylight, new Color(FACADE_SHADES.glass[0]));
        glassGeometries.push(skylight);
        // The two bands are glazed in 1.9 m panels between steel bars —
        // without the bars they read as blank blue-grey lids.
        const bars: number[] = [];
        const barY = roofTop + 0.72;
        for (let offset = -19; offset <= 19; offset += 1.9) {
          bars.push(
            domeX + offset,
            barY,
            domeZ + side - 3.5,
            domeX + offset,
            barY,
            domeZ + side + 3.5,
          );
        }
        bars.push(
          domeX - 19,
          barY,
          domeZ + side,
          domeX + 19,
          barY,
          domeZ + side,
        );
        const barGeometry = new BufferGeometry();
        barGeometry.setAttribute(
          "position",
          new Float32BufferAttribute(bars, 3),
        );
        edgeGeometries.push(barGeometry);
      }
      const restaurant = new BufferGeometry();
      restaurant.setAttribute(
        "position",
        new Float32BufferAttribute(
          boxTriangles(284, roofTop + 1.8, 86, [1, 0], 16, 3.6, 10),
          3,
        ),
      );
      restaurant.computeVertexNormals();
      edgeGeometries.push(
        new EdgesGeometry(restaurant, ISO_EDGE_THRESHOLD_DEGREES),
      );
      bakeColor(restaurant, new Color(0xc8ccc6).multiplyScalar(0.96));
      bodyGeometries.push(restaurant);
      const restaurantGlass = new BufferGeometry();
      restaurantGlass.setAttribute(
        "position",
        new Float32BufferAttribute(
          boxTriangles(284, roofTop + 2.4, 81.4, [1, 0], 15, 2, 0.4),
          3,
        ),
      );
      restaurantGlass.computeVertexNormals();
      bakeColor(restaurantGlass, new Color(FACADE_SHADES.glass[1]));
      glassGeometries.push(restaurantGlass);
    }
    if (roofTriangles) {
      const roofGeometry = new BufferGeometry();
      roofGeometry.setAttribute(
        "position",
        new Float32BufferAttribute(roofTriangles, 3),
      );
      roofGeometry.computeVertexNormals();
      edgeGeometries.push(
        new EdgesGeometry(roofGeometry, ISO_EDGE_THRESHOLD_DEGREES),
      );
      // Pinned heritage roofs keep their documented slate tone on slopes;
      // unpinned roofs retain the established darker-facade convention.
      const pitchedRoofTone =
        HISTORIC_CHARITE_IDS.has(building.id) ||
        BERLINER_ENSEMBLE_IDS.has(building.id) ||
        REICHSTAGSPRAESIDENTENPALAIS_ROOF_TONE_IDS.has(building.id)
          ? capTone.clone()
          : color.clone().multiplyScalar(0.9);
      bakeColor(roofGeometry, pitchedRoofTone);
      // Pitched roof slopes step by facing too, so gables read plastic.
      const roofNormals = roofGeometry.getAttribute("normal");
      const roofColors = roofGeometry.getAttribute("color");
      for (let index = 0; index < roofColors.count; index += 1) {
        const shade = isoFaceShade(
          roofNormals.getX(index),
          roofNormals.getY(index),
          roofNormals.getZ(index),
        );
        if (shade !== 1) {
          roofColors.setXYZ(
            index,
            roofColors.getX(index) * shade,
            roofColors.getY(index) * shade,
            roofColors.getZ(index) * shade,
          );
        }
      }
      bodyGeometries.push(roofGeometry);
      // Gabled houses get their chimneys back: small drawn stacks on
      // the ridge (one, or two on long roofs), inked like everything.
      if (
        roofCode === ROOF_GABLED &&
        roofRect &&
        roofRect.halfLength > 5 &&
        !GENERIC_CHIMNEY_SUPPRESSED_IDS.has(building.id)
      ) {
        const ridgeY = y0 + totalHeight;
        const stackOffsets = roofRect.halfLength > 10 ? [-0.45, 0.45] : [0.4];
        for (const offset of stackOffsets) {
          const chimney = new BufferGeometry();
          chimney.setAttribute(
            "position",
            new Float32BufferAttribute(
              boxTriangles(
                roofRect.center[0] +
                  roofRect.axis[0] * roofRect.halfLength * offset,
                ridgeY + 0.45,
                roofRect.center[1] +
                  roofRect.axis[1] * roofRect.halfLength * offset,
                roofRect.axis,
                0.9,
                1.5,
                0.9,
              ),
              3,
            ),
          );
          chimney.computeVertexNormals();
          edgeGeometries.push(
            new EdgesGeometry(chimney, ISO_EDGE_THRESHOLD_DEGREES),
          );
          bakeColor(chimney, color.clone().multiplyScalar(0.66));
          bodyGeometries.push(chimney);
        }
      }
    }
  }

  const bodies = mergeGeometries(bodyGeometries, false);
  if (bodies) {
    // Day is TRUE ligne claire: facades render their exact baked paint,
    // unlit (MeshBasic) — no sun-browning, no murky shadow sides;
    // colour and the fine ink separate the planes ("Leichtigkeit").
    // Night swaps to the lit material for the moonlit mood.
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.95,
      vertexColors: true,
    });
    const mesh = new Mesh(bodies, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "LoD2 prism buildings";
    group.add(mesh);
    for (const geometry of bodyGeometries) {
      geometry.dispose();
    }
  }

  const glass =
    glassGeometries.length > 0 ? mergeGeometries(glassGeometries, false) : null;
  if (glass) {
    const dayMaterial = new MeshBasicMaterial({
      opacity: ISO_GLASS_DAY_OPACITY,
      transparent: true,
      vertexColors: true,
    });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      opacity: ISO_GLASS_DAY_OPACITY,
      roughness: 0.35,
      transparent: true,
      vertexColors: true,
    });
    const mesh = new Mesh(glass, dayMaterial);
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    mesh.name = "LoD2 glass prisms";
    // Transparent glass draws after the opaque city; the ink lines
    // (renderOrder 2) still sit on top of it.
    mesh.renderOrder = 1;
    group.add(mesh);
    for (const geometry of glassGeometries) {
      geometry.dispose();
    }
  }

  if (mullionPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(mullionPositions, 3),
    );
    const mullions = new LineSegments(
      geometry,
      markArchitecturalInk(
        new LineBasicMaterial({
          opacity: ISO_GLASS_MULLION_OPACITY,
          transparent: true,
        }),
        "detail",
      ),
    );
    mullions.name = "LoD2 glass mullions";
    mullions.renderOrder = 2;
    group.add(mullions);
  }

  // Facade glazing axes: fine ink lines (day). A subtle grey so they
  // articulate without weighing the pale panels down.
  if (facadeAxisPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(facadeAxisPositions.toArray(), 3),
    );
    geometry.setAttribute(
      "lineDistance",
      new Uint16BufferAttribute(facadeAxisDistances.toArray(), 1),
    );
    const axes = new LineSegments(
      geometry,
      markArchitecturalInk(
        new LineDashedMaterial({
          dashSize: ISO_FACADE_WINDOW_DASH_M,
          gapSize: ISO_FACADE_WINDOW_GAP_M,
          opacity: ISO_FACADE_AXIS_OPACITY,
          scale: 0.01,
          transparent: true,
        }),
        "micro",
      ),
    );
    axes.name = "LoD2 facade axes";
    axes.renderOrder = 2;
    axes.userData.detailFadeM = ISO_FACADE_DETAIL_FADE_M;
    axes.userData.facadeRhythm = {
      basis: "measured LoD2 wall length and building height",
      lineKinds: ["bay-axis", "storey-sill", "window-dash"],
      openingCoordinates: "inferred rhythm; not surveyed individual panes",
    };
    group.add(axes);
  }
  if (kollhoffClinkerJointPositions.length > 0) {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(kollhoffClinkerJointPositions, 3),
    );
    const joints = new LineSegments(
      geometry,
      markArchitecturalAccentInk(
        new LineBasicMaterial({
          opacity: 0.46,
          transparent: true,
        }),
        KOLLHOFF_TOWER_PROFILE.mortarTone,
        "micro",
      ),
    );
    joints.name = "Kollhoff clinker mortar joints";
    joints.renderOrder = 2;
    joints.userData.detailStatus =
      "inferred close-view ceramic bond over exact LoD2 facade planes";
    group.add(joints);
  }
  if (kollhoffWindows.length > 0) {
    const dayMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      side: DoubleSide,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x59636b,
      side: DoubleSide,
    });
    const panes = new InstancedMesh(
      new PlaneGeometry(1, 1),
      dayMaterial,
      kollhoffWindows.length,
    );
    panes.name = "Kollhoff recessed window panes";
    panes.renderOrder = 3;
    panes.userData.dayMaterial = dayMaterial;
    panes.userData.nightMaterial = nightMaterial;
    panes.userData.architecturalProfile = KOLLHOFF_TOWER_PROFILE;
    const matrix = new Matrix4();
    const paneTone = new Color();
    const dayTones = [0x718189, 0x829399, 0x66777f] as const;
    kollhoffWindows.forEach((pane, index) => {
      matrix.set(
        pane.dirX * KOLLHOFF_TOWER_PROFILE.windowWidthM,
        0,
        pane.nx,
        pane.x,
        0,
        KOLLHOFF_TOWER_PROFILE.windowHeightM,
        0,
        pane.y,
        pane.dirZ * KOLLHOFF_TOWER_PROFILE.windowWidthM,
        0,
        pane.nz,
        pane.z,
        0,
        0,
        0,
        1,
      );
      panes.setMatrixAt(index, matrix);
      panes.setColorAt(index, paneTone.setHex(dayTones[index % 3]));
    });
    panes.instanceMatrix.needsUpdate = true;
    if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
    panes.frustumCulled = false;
    group.add(panes);

    const litWindows = kollhoffWindows.filter((pane) => pane.lit);
    if (litWindows.length > 0) {
      const litPanes = new InstancedMesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
        litWindows.length,
      );
      litPanes.name = "Kollhoff lit window panes";
      litPanes.visible = false;
      litPanes.renderOrder = 4;
      litPanes.userData.nightOnly = true;
      litWindows.forEach((pane, index) => {
        matrix.set(
          pane.dirX * KOLLHOFF_TOWER_PROFILE.windowWidthM,
          0,
          pane.nx,
          pane.x + pane.nx * 0.025,
          0,
          KOLLHOFF_TOWER_PROFILE.windowHeightM,
          0,
          pane.y,
          pane.dirZ * KOLLHOFF_TOWER_PROFILE.windowWidthM,
          0,
          pane.nz,
          pane.z + pane.nz * 0.025,
          0,
          0,
          0,
          1,
        );
        litPanes.setMatrixAt(index, matrix);
        litPanes.setColorAt(index, paneTone.setHex(pane.litTone));
      });
      litPanes.instanceMatrix.needsUpdate = true;
      if (litPanes.instanceColor) litPanes.instanceColor.needsUpdate = true;
      litPanes.frustumCulled = false;
      group.add(litPanes);
    }
  }
  if (chariteWindows.length > 0) {
    const dayMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      side: DoubleSide,
    });
    const nightMaterial = new MeshBasicMaterial({
      color: 0x3e4a50,
      side: DoubleSide,
    });
    const panes = new InstancedMesh(
      new PlaneGeometry(1, 1),
      dayMaterial,
      chariteWindows.length,
    );
    panes.name = "Charite aluminium facade window panes";
    panes.renderOrder = 3;
    panes.userData.dayMaterial = dayMaterial;
    panes.userData.nightMaterial = nightMaterial;
    panes.userData.architecturalProfile = CHARITE_BETTENHOCHHAUS_PROFILE;
    const matrix = new Matrix4();
    const paneTone = new Color();
    const upperTones = [0x718a94, 0x7f969e, 0x647e89] as const;
    const baseTones = [0x53666e, 0x60747c, 0x485b63] as const;
    chariteWindows.forEach((pane, index) => {
      matrix.set(
        pane.dirX * pane.width,
        0,
        pane.nx,
        pane.x,
        0,
        pane.height,
        0,
        pane.y,
        pane.dirZ * pane.width,
        0,
        pane.nz,
        pane.z,
        0,
        0,
        0,
        1,
      );
      panes.setMatrixAt(index, matrix);
      const tones = pane.width > 1.2 ? baseTones : upperTones;
      panes.setColorAt(index, paneTone.setHex(tones[index % tones.length]));
    });
    panes.instanceMatrix.needsUpdate = true;
    if (panes.instanceColor) panes.instanceColor.needsUpdate = true;
    panes.frustumCulled = false;
    group.add(panes);

    const litWindows = chariteWindows.filter((pane) => pane.lit);
    if (litWindows.length > 0) {
      const litPanes = new InstancedMesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
        litWindows.length,
      );
      litPanes.name = "Charite lit facade window panes";
      litPanes.visible = false;
      litPanes.renderOrder = 4;
      litPanes.userData.nightOnly = true;
      litWindows.forEach((pane, index) => {
        matrix.set(
          pane.dirX * pane.width,
          0,
          pane.nx,
          pane.x,
          0,
          pane.height,
          0,
          pane.y,
          pane.dirZ * pane.width,
          0,
          pane.nz,
          pane.z,
          0,
          0,
          0,
          1,
        );
        litPanes.setMatrixAt(index, matrix);
        litPanes.setColorAt(index, paneTone.setHex(pane.litTone));
      });
      litPanes.instanceMatrix.needsUpdate = true;
      if (litPanes.instanceColor) litPanes.instanceColor.needsUpdate = true;
      litPanes.frustumCulled = false;
      group.add(litPanes);
    }
  }
  // Night light strips: thin warm vertical bars on the lit axes only,
  // hidden by day. Instanced quads (0.28 m wide) facing outward.
  if (windowAxes.length > 0) {
    const lit = windowAxes.filter((axis) => axis.lit);
    if (lit.length > 0) {
      const strips = new InstancedMesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
        lit.length,
      );
      strips.name = "LoD2 facade night strips";
      strips.visible = false;
      const matrix = new Matrix4();
      const tone = new Color();
      lit.forEach((axis, index) => {
        const height = axis.yTop - axis.yBottom;
        matrix.set(
          axis.dirX * 0.28,
          0,
          axis.nx,
          axis.x,
          0,
          height,
          0,
          (axis.yTop + axis.yBottom) / 2,
          axis.dirZ * 0.28,
          0,
          axis.nz,
          axis.z,
          0,
          0,
          0,
          1,
        );
        strips.setMatrixAt(index, matrix);
        strips.setColorAt(index, tone.setHex(axis.litTone));
      });
      strips.instanceMatrix.needsUpdate = true;
      if (strips.instanceColor) {
        strips.instanceColor.needsUpdate = true;
      }
      strips.frustumCulled = false;
      group.add(strips);
    }
  }

  const edges = mergeGeometries(edgeGeometries, false);
  if (edges) {
    const ink = new LineSegments(
      edges,
      markArchitecturalInk(new LineBasicMaterial(), "silhouette"),
    );
    ink.name = "LoD2 prism ink lines";
    // Draw the ink after the bodies so lines sit on the surfaces.
    ink.renderOrder = 2;
    group.add(ink);
    for (const geometry of edgeGeometries) {
      geometry.dispose();
    }
  }

  if (ground) {
    const insideTunnelApproach = tunnel
      ? createTunnelPortalApproachTester(tunnel, ground.cell_m / Math.SQRT2)
      : null;
    const insideTillaDurieux = surfaces
      ? createTillaDurieuxGroundTester(surfaces)
      : null;
    const slabs = createGroundSlabs(
      ground,
      "Drawn ground slabs",
      ISO_GROUND_SHADES,
      {
        emissive: 0x000000,
        // Smooth OSM road polygons below replace this coarse class in the
        // drawn modes. Minecraft calls createGroundSlabs without this filter
        // and deliberately keeps its block-native road staircase.
        skipClasses:
          surfaces && !options.retainRasterAsphalt ? ["asphalt"] : undefined,
        skipBridge: true,
        skipAtWorld:
          insideTunnelApproach || insideTillaDurieux
            ? (x, z) =>
                Boolean(
                  insideTunnelApproach?.(x, z) || insideTillaDurieux?.(x, z),
                )
            : undefined,
        skipWater: true,
      },
    );
    // The ground joins the prism convention: exact flat paint by day
    // (unlit), the lit material only under the night rig. Until now the
    // drawn ground was the ONE lit surface in an unlit drawing, so the
    // authored sage lawn arrived on screen as whatever the day rig
    // happened to multiply it by — never as the tone in ISO_GROUND_SHADES.
    // The instance colours carry the paint; a white unlit base passes them
    // through untouched.
    slabs.userData.nightMaterial = slabs.material;
    slabs.userData.dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    slabs.material = slabs.userData.dayMaterial as MeshBasicMaterial;
    group.add(slabs);
    // Transparent rivers with a visible bed ("Flüsse müssen
    // durchsichtig sein mit Flussbett"): a pale glass-like surface
    // plate floats over a sandy riverbed ~2.2 m below.
    const waterClass = ground.classes.indexOf("water");
    // With the true OSM polygons available the smooth layers own the
    // river; the rasterised plates below stay as the fallback only.
    if (waterClass >= 0 && (!surfaces || options.retainRasterWater === true)) {
      const cell = ground.cell_m;
      const { min_x_idx, min_z_idx } = ground.grid;
      const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
      const waterRuns: Array<[number, number, number]> = [];
      ground.ground_rows.forEach((row, zOffset) => {
        for (const [xStart, run, classId] of row) {
          if (classId === waterClass) {
            waterRuns.push([xStart, zOffset, run]);
          }
        }
      });
      const bed = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({ vertexColors: false, color: 0xffffff }),
        Math.max(1, waterRuns.length),
      );
      bed.name = "drawn river bed";
      const surface = new InstancedMesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({
          color: 0x9fc7d8,
          opacity: 0.45,
          transparent: true,
          depthWrite: false,
        }),
        Math.max(1, waterRuns.length),
      );
      surface.name = "drawn water surface";
      surface.renderOrder = 1;
      const matrix = new Matrix4();
      const bedPaint = new Color();
      const BED_TONES = [0xd8cfb8, 0xcdc3ac] as const;
      waterRuns.forEach(([xStart, zOffset, run], index) => {
        const cx = (min_x_idx + xStart + run / 2) * cell;
        const cz = (min_z_idx + zOffset + 0.5) * cell;
        matrix.makeScale(run * cell, 0.5, cell);
        matrix.setPosition(cx, waterTop - 2.9 - 0.25, cz);
        bed.setMatrixAt(index, matrix);
        bed.setColorAt(
          index,
          bedPaint.setHex(BED_TONES[(xStart * 31 + zOffset * 17) % 2]),
        );
        matrix.makeScale(run * cell, 0.14, cell);
        matrix.setPosition(cx, waterTop - 0.07, cz);
        surface.setMatrixAt(index, matrix);
      });
      bed.instanceMatrix.needsUpdate = true;
      if (bed.instanceColor) {
        bed.instanceColor.needsUpdate = true;
      }
      surface.instanceMatrix.needsUpdate = true;
      bed.frustumCulled = false;
      surface.frustumCulled = false;
      group.add(bed);
      group.add(surface);
    }
    const kerbs = createKerbLines(
      ground,
      surfaces ? new Set(["asphalt", "water", "basin"]) : undefined,
      insideTunnelApproach ?? undefined,
    );
    if (kerbs) {
      group.add(kerbs);
    }
    const surfacesToBuild =
      options.smoothSurfaces === undefined ? surfaces : options.smoothSurfaces;
    if (surfacesToBuild) {
      // Smooth shoreline, bed, water plate and quay walls from the real
      // OSM rings ("weiche Flussufer", no more 4 m staircases), plus
      // lawn plates that cover the rasterised parkland steps.
      const bankY = (ground.water_top_y_m ?? WATER_TOP_Y) + 5.35;
      // Continuous terrain lookup in world metres for plates that lie ON the
      // ground. The payload retains its measured coarse samples; bilinear
      // interpolation removes their 16 m staircase without inventing a new
      // elevation or changing the blocky Minecraft ground.
      const terrainSample = smoothGroundTopSampler(ground);
      const terrainCell = ground.cell_m;
      const terrainAt = (x: number, z: number): number =>
        terrainSample(
          x / terrainCell - ground.grid.min_x_idx,
          z / terrainCell - ground.grid.min_z_idx,
        );
      group.add(
        createSmoothSurfaces(
          surfacesToBuild,
          ground.water_top_y_m ?? WATER_TOP_Y,
          bankY,
          terrainAt,
        ),
      );
    } else if (!surfaces || options.retainRasterWater === true) {
      // The true no-surface fallback and the bounded touch preview own raster
      // quay walls. A full progressive base deliberately defers its smooth
      // surfaces (`null`) to the Worker; drawing this fallback there as well
      // would duplicate the embankment once the exact water batch arrived.
      const quays = createQuayWalls(
        ground,
        options.retainRasterWater === true ? "mobile" : "full",
      );
      if (quays) {
        group.add(quays);
      }
    }
    const bridges = createBridgeStructures(
      ground,
      options.retainRasterAsphalt ? "mobile" : "full",
    );
    if (bridges) {
      group.add(bridges);
    }
    if (options.includeContext !== false) {
      group.add(createNorthernHumboldthafenRefinements(ground));
    }
  }
  if (options.includeContext !== false) {
    group.add(createPresentationBackdrop());
    group.add(createExtrapolatedMargin());
    group.add(createSiegessaeule());
    group.add(createHotelAdlon());
    group.add(createPaulLoebeCanopy());
    group.add(createLandmarkRefinements());
    group.add(createGymnasiumTiergarten());
    group.add(createHistoricChariteCampus(prisms));
    group.add(createDeutschesTheater(prisms));
    group.add(createTerrassenhausHafenplatz(prisms));
    group.add(createArdHauptstadtstudio(prisms));
    group.add(createBerlinerEnsemble(prisms));
    group.add(createReichstagspraesidentenpalais(prisms));
    group.add(createFederalStateRepresentations());
  }
  return group;
}

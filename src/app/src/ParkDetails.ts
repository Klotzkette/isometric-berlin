import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LinearFilter,
  LinearMipmapLinearFilter,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  RGBAFormat,
  ShapeUtils,
  SphereGeometry,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";
import { markArchitecturalAccentInk } from "./architecturalInk";
import { isChancelleryExtensionConstructionPoint } from "./chancelleryExtensionProfile";
import { createLenneOak, isLenneOakTree } from "./LenneOak";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  createTunnelPortalApproachTester,
  type TunnelPortalPayload,
} from "./TunnelPortals";

export type ParkPath = {
  id: string;
  kind: string;
  /** Source surface: asphalt/sett/earth/fine-gravel/compacted/metal/paving/sand/wood. */
  m?: "a" | "c" | "e" | "f" | "g" | "m" | "p" | "s" | "w";
  name?: string | null;
  points: [number, number, number][];
  /** Full path width: centimetres in schema 7, decimetres in schemas 4--6. */
  w?: number;
};

export type ParkTree = {
  catalogue?: string | null;
  crown_radius_m: number;
  height_m: number;
  id: string;
  leaf_type: string | null;
  position: [number, number, number];
  source?: "berlin_official" | "osm";
  species?: string | null;
  tree_group?: string | null;
  trunk_radius_m?: number;
  variant: number;
};

export type TreePresentationForm =
  | "airy"
  | "broadleaf"
  | "columnar"
  | "conifer"
  | "dense"
  | "fir"
  | "oak"
  | "orchard"
  | "pine"
  | "shrub"
  | "spreading"
  | "vase"
  | "willow";

/** Keep the official catalogue's botanical form visible in the 3D drawing. */
export function treePresentationForm(tree: ParkTree): TreePresentationForm {
  const leafType = tree.leaf_type?.toLowerCase() ?? "";
  const group = tree.tree_group?.toLowerCase() ?? "";
  const species = tree.species?.toLowerCase() ?? "";
  if (group.includes("strauch") || group.includes("sträuch")) {
    return "shrub";
  }
  if (group.includes("obst")) {
    return "orchard";
  }
  // Berlin's catalogue groups Ginkgo with gymnosperms, but its fan-leaved
  // crown must not be drawn as a tiered fir silhouette.
  if (species.includes("fächerblatt") || species.includes("ginkgo")) {
    return "vase";
  }
  if (species.includes("weide")) {
    return "willow";
  }
  if (
    [
      "apfel",
      "birne",
      "eberesche",
      "kirsche",
      "mehlbeere",
      "pflaume",
      "weißdorn",
      "weissdorn",
      "zwetschge",
    ].some((fruit) => species.includes(fruit))
  ) {
    return "orchard";
  }
  if (species.includes("eiche")) {
    return "oak";
  }
  if (species.includes("kiefer") || species.includes("lärche")) {
    return "pine";
  }
  if (
    [
      "fichte",
      "tanne",
      "douglas",
      "zeder",
      "mammut",
      "zypresse",
      "eibe",
      "hemlock",
      "lebensbaum",
    ].some((needle) => species.includes(needle))
  ) {
    return "fir";
  }
  if (species.includes("pappel")) {
    return "columnar";
  }
  if (
    species.includes("birke") ||
    species.includes("robinie") ||
    species.includes("esche") ||
    species.includes("erle")
  ) {
    return "airy";
  }
  if (species.includes("linde") || species.includes("ulme")) {
    return "vase";
  }
  if (species.includes("ahorn") || species.includes("platane")) {
    return "spreading";
  }
  if (species.includes("götterbaum") || species.includes("amberbaum")) {
    return "vase";
  }
  if (species.includes("buche") || species.includes("kastanie")) {
    return "dense";
  }
  if (leafType.includes("needle") || group.includes("nadel")) {
    return "conifer";
  }
  return "broadleaf";
}

const TREE_TRUNK_HEIGHT_RATIO: Record<TreePresentationForm, number> = {
  airy: 0.58,
  broadleaf: 0.5,
  columnar: 0.56,
  conifer: 0.54,
  dense: 0.48,
  fir: 0.54,
  oak: 0.45,
  orchard: 0.5,
  pine: 0.67,
  shrub: 0.24,
  spreading: 0.44,
  vase: 0.46,
  willow: 0.48,
};

const BRANCHING_TREE_FORMS = new Set<TreePresentationForm>([
  "airy",
  "broadleaf",
  "columnar",
  "dense",
  "oak",
  "orchard",
  "spreading",
  "vase",
  "willow",
]);

type LobedTreeForm =
  | "airy"
  | "broadleaf"
  | "columnar"
  | "dense"
  | "orchard"
  | "spreading"
  | "vase";

type LobedCrownProfile = {
  axisScale: readonly [number, number, number];
  offsets: readonly (readonly [number, number, number])[];
  radiusScales: readonly number[];
};

const LOBED_CROWN_PROFILES: Record<LobedTreeForm, LobedCrownProfile> = {
  airy: {
    axisScale: [0.9, 0.8, 0.88],
    offsets: [
      [-0.42, 0.04, 0.12],
      [0.36, 0.2, -0.22],
      [-0.14, 0.57, -0.3],
      [0.2, 0.78, 0.22],
    ],
    radiusScales: [0.64, 0.6, 0.55, 0.5],
  },
  broadleaf: {
    axisScale: [1, 0.75, 1],
    offsets: [
      [-0.3, -0.04, 0.13],
      [0.29, 0.12, -0.17],
      [-0.12, 0.34, -0.25],
      [0.16, 0.52, 0.22],
      [0.01, 0.72, 0.01],
    ],
    radiusScales: [0.84, 0.84, 0.72, 0.72, 0.56],
  },
  columnar: {
    axisScale: [0.72, 1.18, 0.72],
    offsets: [
      [-0.08, 0.02, 0.02],
      [0.08, 0.36, -0.04],
      [-0.04, 0.72, 0.03],
      [0.03, 1.02, 0],
    ],
    radiusScales: [0.56, 0.52, 0.48, 0.42],
  },
  dense: {
    axisScale: [1.04, 0.82, 1.02],
    offsets: [
      [-0.27, -0.02, 0.14],
      [0.28, 0.08, -0.14],
      [-0.12, 0.32, -0.22],
      [0.14, 0.42, 0.2],
      [0, 0.66, 0],
    ],
    radiusScales: [0.88, 0.84, 0.78, 0.7, 0.62],
  },
  orchard: {
    axisScale: [0.98, 0.68, 0.98],
    offsets: [
      [-0.32, -0.02, 0.16],
      [0.3, 0.1, -0.18],
      [-0.12, 0.34, -0.24],
      [0.14, 0.5, 0.2],
    ],
    radiusScales: [0.74, 0.74, 0.64, 0.58],
  },
  spreading: {
    axisScale: [1.22, 0.62, 1.16],
    offsets: [
      [-0.46, -0.05, 0.12],
      [0.46, 0.02, -0.1],
      [-0.24, 0.25, -0.34],
      [0.25, 0.28, 0.33],
      [0, 0.5, 0],
      [0.02, -0.16, 0.02],
    ],
    radiusScales: [0.8, 0.8, 0.72, 0.72, 0.64, 0.56],
  },
  vase: {
    axisScale: [1.08, 0.72, 1],
    offsets: [
      [-0.36, 0.18, 0.12],
      [0.36, 0.2, -0.12],
      [-0.18, 0.48, -0.24],
      [0.19, 0.54, 0.22],
      [0, 0.78, 0],
    ],
    radiusScales: [0.78, 0.78, 0.68, 0.62, 0.54],
  },
};

function isLobedTreeForm(form: TreePresentationForm): form is LobedTreeForm {
  return form in LOBED_CROWN_PROFILES;
}

const TREE_FORM_FOLIAGE_TONES: Record<
  TreePresentationForm,
  readonly [number, number, number]
> = {
  airy: [0xa8cf91, 0xb7dca0, 0x98c182],
  broadleaf: [0x97c98a, 0xaed8a0, 0x87ba7b],
  columnar: [0x6f9e65, 0x80ad73, 0x608f59],
  conifer: [0x6fa36b, 0x7eb175, 0x628f60],
  dense: [0x6f9f5e, 0x7fae6c, 0x638f54],
  fir: [0x567f5d, 0x638e67, 0x486f52],
  oak: [0x76a85e, 0x86b76c, 0x679653],
  orchard: [0x91bd75, 0xa2ca83, 0x7fac68],
  pine: [0x648a61, 0x73996b, 0x557b58],
  shrub: [0x8ebd74, 0x9bc984, 0x80ad68],
  spreading: [0x89b978, 0x9bc98a, 0x78a969],
  vase: [0x82b46d, 0x93c17d, 0x73a35f],
  willow: [0x8fb879, 0xa0c68a, 0x7ca76d],
};

/** Species-informed display tone; the catalogue does not measure leaf colour. */
export function treeFoliageTone(tree: ParkTree): number {
  const species = tree.species?.toLowerCase() ?? "";
  const variant = Math.abs(tree.variant) % 3;
  if (
    ["blut", "purpur", "rotblättr", "schwedleri", "atropurpurea"].some(
      (cue) => species.includes(cue),
    )
  ) {
    return [0x806354, 0x8f7060, 0x705746][variant];
  }
  if (
    ["silber-weide", "silber-ahorn", "silber-linde", "grau-pappel"].some(
      (cue) => species.includes(cue),
    )
  ) {
    return [0xa8bea0, 0xb7c9ad, 0x96ad90][variant];
  }
  return TREE_FORM_FOLIAGE_TONES[treePresentationForm(tree)][variant];
}

/** Species-informed bark tone, kept in one instanced trunk draw call. */
export function treeBarkTone(tree: ParkTree): number {
  const species = tree.species?.toLowerCase() ?? "";
  const variant = Math.abs(tree.variant) % 3;
  if (species.includes("birke")) {
    return [0xd5d1c3, 0xe0dccf, 0xc7c5ba][variant];
  }
  if (species.includes("buche") || species.includes("hainbuche")) {
    return [0x837f78, 0x8f8a82, 0x75726c][variant];
  }
  if (species.includes("platane")) {
    return [0x9b8a70, 0xaa9b80, 0x887a66][variant];
  }
  if (species.includes("kiefer") || species.includes("lärche")) {
    return [0x8f6549, 0x9d7253, 0x7e5943][variant];
  }
  if (species.includes("eiche")) {
    return [0x6f604b, 0x796953, 0x625642][variant];
  }
  return [0x7b6549, 0x836d50, 0x705b43][variant];
}

/**
 * Wire form of a tree since schema 3. The expanded bounds carry 25,305 official
 * catalogue points instead of 6,893, which pushed the verbose records past the
 * payload budget, so keys are shortened, repeated strings are interned into
 * `tree_vocabulary` and empty fields are omitted. `position` keeps its long
 * name because the Python ground samplers read it straight off the file.
 */
export type CompactParkTree = {
  c?: number;
  cm?: number;
  cr: number;
  e?: string[];
  g?: number;
  h: number;
  hm?: number;
  /** Omitted by the schema-5 viewer payload; retained by reversible audit exports. */
  i?: string;
  lt?: number;
  position: [number, number, number];
  s?: number;
  sp?: number;
  tr?: number;
  v: number;
};

export type TreeVocabulary = {
  catalogue?: string[];
  leaf_type?: string[];
  source?: string[];
  species?: string[];
  tree_group?: string[];
};

export type StreetLight = {
  height_m: number;
  id: string;
  /** "light_band" where the run is continuous balustrade lighting. */
  installation?: string | null;
  light_type: string | null;
  position: [number, number, number];
  rotation_degrees: number;
  street: string | null;
};

export type WallTrace = {
  id: string;
  points: [number, number, number][];
  wall_type: string | null;
};

/** [x, ground y, z, display height, display radius, deterministic variant]. */
export type ParkShrubCluster = [number, number, number, number, number, number];

export type ParkShrubPatch = {
  clusters: ParkShrubCluster[];
  id: string;
  leaf_type?: string | null;
  /** Exterior first, then any exact OSM polygon holes. */
  rings: [number, number, number][][];
  source_url: string;
};

export type ParkHedge = {
  area_m2?: number;
  clusters?: ParkShrubCluster[];
  dimensions_status: string;
  height_m: number;
  id: string;
  kind: "area" | "line";
  length_m?: number;
  points?: [number, number, number][];
  rings?: [number, number, number][][];
  source_url: string;
  width_m?: number;
};

export type PlaygroundEquipment = {
  id: string;
  kind: string;
  material: string | null;
  points: [number, number, number][];
  position: [number, number, number];
};

export type ParkPlayground = {
  equipment: PlaygroundEquipment[];
  id: string;
  name: string;
  outline: [number, number, number][];
  source_url: string;
  surface: string | null;
  wheelchair: string | null;
};

export type ParkDetailsPayload = {
  hedges?: ParkHedge[];
  paths: ParkPath[];
  playgrounds: ParkPlayground[];
  schema_version: number;
  source: {
    attribution: string;
    geometry_status: string;
    name: string;
  };
  street_lights?: StreetLight[];
  shrub_patches?: ParkShrubPatch[];
  tree_vocabulary?: TreeVocabulary;
  trees: (CompactParkTree | ParkTree)[];
  wall_traces?: WallTrace[];
};

function vocabularyEntry(
  table: string[] | undefined,
  index: number | undefined,
): string | null {
  if (index === undefined || table === undefined) {
    return null;
  }
  return table[index] ?? null;
}

/** Expand the schema-3 wire form; schema 1 and 2 records pass through. */
export function decodeTrees(
  trees: (CompactParkTree | ParkTree)[],
  vocabulary: TreeVocabulary = {},
): ParkTree[] {
  return trees.map((tree, index) => {
    if (!("h" in tree)) {
      return tree;
    }
    return {
      catalogue: vocabularyEntry(vocabulary.catalogue, tree.c),
      crown_radius_m: tree.cr,
      height_m: tree.h,
      id: tree.i ?? `tree-${index}`,
      leaf_type: vocabularyEntry(vocabulary.leaf_type, tree.lt),
      position: tree.position,
      source: (vocabularyEntry(vocabulary.source, tree.s) ?? undefined) as
        "berlin_official" | "osm" | undefined,
      species: vocabularyEntry(vocabulary.species, tree.sp),
      tree_group: vocabularyEntry(vocabulary.tree_group, tree.g),
      trunk_radius_m: tree.tr,
      variant: tree.v,
    };
  });
}

type Transform = {
  color?: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

type TreeCrownCutaway = {
  focusName: string;
  radiusM: number;
  x: number;
  z: number;
};

export type ParkDetailProfile = "full" | "mobile";

export type ParkDetailOptions = {
  detailProfile?: ParkDetailProfile;
  settledDetail?: boolean;
  tunnel?: TunnelPortalPayload | null;
};

const UP = new Vector3(0, 1, 0);
const PATH_STYLE: Record<string, { color: number; width: number }> = {
  bridleway: { color: 0x79684b, width: 1.7 },
  cycleway: { color: 0x77736c, width: 1.8 },
  footway: { color: 0x89785b, width: 1.45 },
  path: { color: 0x77684e, width: 1.35 },
  pedestrian: { color: 0x898174, width: 2.2 },
  steps: { color: 0x71706b, width: 1.65 },
  track: { color: 0x6f6046, width: 2.25 },
};
type PathMaterialStyle = {
  color: number;
  label: string;
  pattern: string;
  roughness: number;
  tileM: number;
};

const PATH_MATERIAL_STYLE: Record<
  NonNullable<ParkPath["m"]>,
  PathMaterialStyle
> = {
  // The broad plates below retain the six-family far-view palette. These
  // close ribbons add only source-selected grain/joints, so a path sharpens
  // on approach without changing route, width or terrain alignment.
  a: {
    color: 0xc4c5c0,
    label: "asphalt",
    pattern: "fine asphalt grain",
    roughness: 0.91,
    tileM: 1.4,
  },
  c: {
    color: 0xc5bba8,
    label: "granite sett",
    pattern: "staggered dressed-stone joints",
    roughness: 0.98,
    tileM: 1.1,
  },
  e: {
    color: 0xbca780,
    label: "earth desire",
    pattern: "irregular open-ground grain",
    roughness: 1,
    tileM: 1.7,
  },
  f: {
    color: 0xddd1b5,
    label: "fine gravel",
    pattern: "loose fine-gravel grain",
    roughness: 1,
    tileM: 0.72,
  },
  g: {
    color: 0xd9c9a6,
    label: "compacted aggregate",
    pattern: "water-bound compacted grain",
    roughness: 0.99,
    tileM: 1.5,
  },
  m: {
    color: 0xaeb8b8,
    label: "metal",
    pattern: "fine metal grid",
    roughness: 0.7,
    tileM: 0.52,
  },
  p: {
    color: 0xdcd8cc,
    label: "paving",
    pattern: "regular paving-stone joints",
    roughness: 0.94,
    tileM: 0.9,
  },
  s: {
    color: 0xe4ca94,
    label: "sand",
    pattern: "soft sand grain",
    roughness: 1,
    tileM: 1.2,
  },
  w: {
    color: 0xc49c68,
    label: "timber",
    pattern: "transverse timber boards",
    roughness: 0.92,
    tileM: 0.82,
  },
};

const SEMANTIC_PATH_MATERIAL: Record<string, NonNullable<ParkPath["m"]>> = {
  bridleway: "g",
  cycleway: "p",
  footway: "p",
  path: "g",
  pedestrian: "p",
  steps: "p",
  track: "g",
};

const PATH_TEXTURE_SIZE = 64;

function pathTextureNoise(x: number, y: number, seed: number): number {
  let value = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
  value = (value ^ (value >>> 13)) * 1274126177;
  return (value ^ (value >>> 16)) & 0xff;
}

/** Small deterministic, texture-free-at-build-time surface tile. */
export function createParkPathSurfaceTexture(
  code: NonNullable<ParkPath["m"]>,
): DataTexture {
  const style = PATH_MATERIAL_STYLE[code];
  const data = new Uint8Array(PATH_TEXTURE_SIZE * PATH_TEXTURE_SIZE * 4);
  for (let y = 0; y < PATH_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < PATH_TEXTURE_SIZE; x += 1) {
      const noise = pathTextureNoise(x, y, code.charCodeAt(0));
      let shade = 252;
      if (code === "a") {
        shade = 248 + (noise % 8);
      } else if (code === "c") {
        const row = Math.floor(y / 13);
        const shiftedX = (x + (row % 2) * 8) % 16;
        const joint = shiftedX <= 1 || y % 13 <= 1;
        shade = joint ? 202 : 244 + (noise % 12);
      } else if (code === "e") {
        shade = 235 + ((noise + Math.floor(8 * Math.sin((x + y) / 7))) % 20);
      } else if (code === "f") {
        shade = noise < 24 ? 211 + (noise % 18) : 247 + (noise % 9);
      } else if (code === "g") {
        const compactedBand = Math.abs(Math.sin((x + y * 0.36) / 8));
        shade = 242 + Math.round(compactedBand * 9) + (noise % 5);
      } else if (code === "m") {
        shade = x % 16 <= 1 || y % 16 <= 1 ? 210 : 249 + (noise % 7);
      } else if (code === "p") {
        const row = Math.floor(y / 16);
        const shiftedX = (x + (row % 2) * 16) % 32;
        shade = shiftedX <= 1 || y % 16 <= 1 ? 224 : 250 + (noise % 6);
      } else if (code === "s") {
        shade = 247 + ((noise + Math.round(5 * Math.sin((x - y) / 6))) % 9);
      } else if (code === "w") {
        shade = x % 32 <= 1 ? 211 : 240 + ((noise + y) % 16);
      }
      const offset = (y * PATH_TEXTURE_SIZE + x) * 4;
      data[offset] = shade;
      data[offset + 1] = shade;
      data[offset + 2] = shade;
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(
    data,
    PATH_TEXTURE_SIZE,
    PATH_TEXTURE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.name = `OSM park ${style.label} deterministic surface tile`;
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / style.tileM, 1 / style.tileM);
  texture.userData = {
    materialCode: code,
    pattern: style.pattern,
    sourceContract: "OSM surface tag selects presentation; no geometry inference",
  };
  texture.needsUpdate = true;
  return texture;
}

function parkPathMaterial(
  code: NonNullable<ParkPath["m"]>,
  includeTexture = true,
): MeshStandardMaterial {
  const style = PATH_MATERIAL_STYLE[code];
  const surface = material(style.color, style.roughness);
  surface.name = `OSM park ${style.label} source-surface material`;
  if (includeTexture) {
    surface.map = createParkPathSurfaceTexture(code);
  }
  surface.side = DoubleSide;
  surface.userData = {
    ...surface.userData,
    pathMaterialCode: code,
    pathSurfacePattern: style.pattern,
    sourceBackedPathSurface: true,
  };
  if (!includeTexture) {
    surface.userData.mobileTexturelessSurface = true;
  }
  surface.needsUpdate = true;
  return surface;
}

function material(color: number, roughness = 0.82): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    // Faceted flat shading: crowns read as drawn foliage lobes, not
    // smooth dark blobs, matching the ligne-claire city.
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness,
  });
}

function instanced(
  name: string,
  geometry: BufferGeometry,
  surface: MeshBasicMaterial | MeshStandardMaterial,
  transforms: Transform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, surface, transforms.length);
  mesh.name = name;
  const dummy = new Object3D();
  const instanceColor = new Color();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (transform.color !== undefined) {
      mesh.setColorAt(index, instanceColor.setHex(transform.color));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.receiveShadow = surface instanceof MeshStandardMaterial;
  return mesh;
}

function pathCategory(kind: string): string {
  return kind in PATH_STYLE ? kind : "path";
}

const CURVED_PARK_PATH_KINDS = new Set([
  "bridleway",
  "cycleway",
  "footway",
  "path",
]);

/**
 * Preserve every exported OSM control point while replacing visible chord
 * breaks with a centripetal curve. Sampling is capped per source segment, so
 * a long Tiergarten path gains rounded bends without turning the static mesh
 * into an unbounded vertex stream.
 */
export function smoothParkPathPoints(path: ParkPath): Vector3[] {
  const source = path.points.map(([x, y, z]) => new Vector3(x, y, z));
  if (source.length < 3 || !CURVED_PARK_PATH_KINDS.has(path.kind)) {
    return source;
  }
  const curve = new CatmullRomCurve3(source, false, "centripetal");
  const smoothed = [source[0].clone()];
  for (let segment = 0; segment < source.length - 1; segment += 1) {
    const segmentLength = source[segment].distanceTo(source[segment + 1]);
    const subdivisions = Math.min(
      6,
      Math.max(1, Math.ceil(segmentLength / 1.75)),
    );
    for (let step = 1; step <= subdivisions; step += 1) {
      if (step === subdivisions) {
        smoothed.push(source[segment + 1].clone());
        continue;
      }
      smoothed.push(
        curve.getPoint(
          (segment + step / subdivisions) / (source.length - 1),
        ),
      );
    }
  }
  return smoothed;
}

export function createPathGeometry(
  paths: ParkPath[],
  width: number | ((path: ParkPath) => number),
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const path of paths) {
    const resolvedWidth = typeof width === "number" ? width : width(path);
    const points = smoothParkPathPoints(path).filter(
      (point, index, entries) =>
        index === 0 ||
        Math.hypot(
          point.x - entries[index - 1].x,
          point.z - entries[index - 1].z,
        ) >= 0.05,
    );
    if (points.length < 2) continue;
    const offset = positions.length / 3;
    const halfWidth = resolvedWidth / 2;
    let distanceAlong = 0;
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      if (index > 0) {
        distanceAlong += Math.hypot(
          point.x - previous.x,
          point.z - previous.z,
        );
      }
      const previousLength =
        Math.hypot(point.x - previous.x, point.z - previous.z) || 1;
      const nextLength =
        Math.hypot(next.x - point.x, next.z - point.z) || 1;
      const previousNormal: [number, number] = [
        -(point.z - previous.z) / previousLength,
        (point.x - previous.x) / previousLength,
      ];
      const nextNormal: [number, number] = [
        -(next.z - point.z) / nextLength,
        (next.x - point.x) / nextLength,
      ];
      if (index === 0) previousNormal.splice(0, 2, ...nextNormal);
      if (index === points.length - 1)
        nextNormal.splice(0, 2, ...previousNormal);
      let mx = previousNormal[0] + nextNormal[0];
      let mz = previousNormal[1] + nextNormal[1];
      const miterLength = Math.hypot(mx, mz);
      if (miterLength < 0.01) {
        mx = nextNormal[0];
        mz = nextNormal[1];
      } else {
        mx /= miterLength;
        mz /= miterLength;
      }
      const denominator = Math.max(
        0.5,
        Math.abs(mx * nextNormal[0] + mz * nextNormal[1]),
      );
      const extension = Math.min(resolvedWidth, halfWidth / denominator);
      positions.push(
        point.x + mx * extension,
        point.y + 0.12,
        point.z + mz * extension,
        point.x - mx * extension,
        point.y + 0.12,
        point.z - mz * extension,
      );
      // Metre-space UVs keep grains and joints at one physical scale on every
      // path width. U follows the mapped route; V crosses the full ribbon.
      uvs.push(
        distanceAlong,
        -resolvedWidth / 2,
        distanceAlong,
        resolvedWidth / 2,
      );
    }
    for (let index = 0; index < points.length - 1; index += 1) {
      const left = offset + index * 2;
      const right = left + 1;
      const nextLeft = left + 2;
      const nextRight = left + 3;
      indices.push(left, right, nextRight, left, nextRight, nextLeft);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addPaths(
  group: Group,
  paths: ParkPath[],
  encodedWidthScaleM: number,
  includeTextures = true,
): void {
  const byKind = new Map<string, ParkPath[]>();
  for (const path of paths) {
    const kind = path.m ? `material:${path.m}` : pathCategory(path.kind);
    byKind.set(kind, [...(byKind.get(kind) ?? []), path]);
  }
  for (const [kind, entries] of byKind) {
    const materialCode = kind.startsWith("material:")
      ? (kind.slice(-1) as NonNullable<ParkPath["m"]>)
      : null;
    const resolvedCode =
      materialCode ?? SEMANTIC_PATH_MATERIAL[kind] ?? "g";
    const materialStyle = PATH_MATERIAL_STYLE[resolvedCode];
    const pathMaterial = parkPathMaterial(resolvedCode, includeTextures);
    const mesh = new Mesh(
      createPathGeometry(entries, (path) =>
        path.w
          ? path.w * encodedWidthScaleM
          : PATH_STYLE[pathCategory(path.kind)].width,
      ),
      pathMaterial,
    );
    mesh.name = `Berlin park ${materialStyle?.label ?? kind} batched path ribbons`;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function addTrees(
  group: Group,
  trees: ParkTree[],
  cutaway: TreeCrownCutaway | null,
  includeSettledDetail: boolean,
): number {
  const trunks: Transform[] = [];
  const branches: Transform[] = [];
  const airyCrowns: Transform[][] = [[], [], []];
  const cutawayAiryCrowns: Transform[][] = [[], [], []];
  const crowns: Transform[][] = [[], [], []];
  const cutawayCrowns: Transform[][] = [[], [], []];
  const columnarCrowns: Transform[][] = [[], [], []];
  const cutawayColumnarCrowns: Transform[][] = [[], [], []];
  const coniferCrowns: Transform[][] = [[], [], []];
  const cutawayConiferCrowns: Transform[][] = [[], [], []];
  const denseCrowns: Transform[][] = [[], [], []];
  const cutawayDenseCrowns: Transform[][] = [[], [], []];
  const firCrowns: Transform[][] = [[], [], []];
  const cutawayFirCrowns: Transform[][] = [[], [], []];
  const oakCrowns: Transform[][] = [[], [], []];
  const cutawayOakCrowns: Transform[][] = [[], [], []];
  const pineCrowns: Transform[][] = [[], [], []];
  const cutawayPineCrowns: Transform[][] = [[], [], []];
  const shrubCrowns: Transform[][] = [[], [], []];
  const cutawayShrubCrowns: Transform[][] = [[], [], []];
  const spreadingCrowns: Transform[][] = [[], [], []];
  const cutawaySpreadingCrowns: Transform[][] = [[], [], []];
  const vaseCrowns: Transform[][] = [[], [], []];
  const cutawayVaseCrowns: Transform[][] = [[], [], []];
  const willowCrowns: Transform[][] = [[], [], []];
  const cutawayWillowCrowns: Transform[][] = [[], [], []];
  const settledCrowns: Transform[][] = [[], [], []];
  const settledCutawayCrowns: Transform[][] = [[], [], []];
  const snowCaps: Transform[] = [];
  const cutawaySnowCaps: Transform[] = [];
  const lobedCrownTargets: Record<LobedTreeForm, Transform[][]> = {
    airy: airyCrowns,
    broadleaf: crowns,
    columnar: columnarCrowns,
    dense: denseCrowns,
    orchard: crowns,
    spreading: spreadingCrowns,
    vase: vaseCrowns,
  };
  const cutawayLobedCrownTargets: Record<LobedTreeForm, Transform[][]> = {
    airy: cutawayAiryCrowns,
    broadleaf: cutawayCrowns,
    columnar: cutawayColumnarCrowns,
    dense: cutawayDenseCrowns,
    orchard: cutawayCrowns,
    spreading: cutawaySpreadingCrowns,
    vase: cutawayVaseCrowns,
  };
  const formCounts: Record<TreePresentationForm, number> = {
    airy: 0,
    broadleaf: 0,
    columnar: 0,
    conifer: 0,
    dense: 0,
    fir: 0,
    oak: 0,
    orchard: 0,
    pine: 0,
    shrub: 0,
    spreading: 0,
    vase: 0,
    willow: 0,
  };
  for (const tree of trees) {
    const [x, y, z] = tree.position;
    const form = treePresentationForm(tree);
    const foliageColor = treeFoliageTone(tree);
    const barkColor = treeBarkTone(tree);
    formCounts[form] += 1;
    const trunkHeight = tree.height_m * TREE_TRUNK_HEIGHT_RATIO[form];
    const trunkRadius =
      tree.trunk_radius_m ??
      Math.max(
        form === "shrub" ? 0.1 : 0.18,
        tree.crown_radius_m * (form === "shrub" ? 0.055 : 0.095),
      );
    trunks.push({
      color: barkColor,
      position: [x, y + trunkHeight / 2, z],
      scale: [trunkRadius, trunkHeight, trunkRadius],
    });
    const branchYaw = ((tree.variant % 7) / 7) * Math.PI * 2;
    if (BRANCHING_TREE_FORMS.has(form)) {
      const branchLength = trunkHeight * 0.44;
      const branchRadius = Math.max(0.1, trunkRadius * 0.58);
      for (const direction of [-1, 1]) {
        branches.push({
          color: barkColor,
          position: [
            x + Math.cos(branchYaw) * direction * branchLength * 0.12,
            y + trunkHeight * 0.8,
            z + Math.sin(branchYaw) * direction * branchLength * 0.12,
          ],
          rotation: [0, branchYaw, direction * 0.72],
          scale: [branchRadius, branchLength, branchRadius],
        });
      }
    }
    const variant = Math.abs(tree.variant) % 3;
    const isInsideCutaway = cutaway
      ? Math.hypot(x - cutaway.x, z - cutaway.z) <= cutaway.radiusM
      : false;
    if (form === "conifer" || form === "fir") {
      const target =
        form === "fir"
          ? isInsideCutaway
            ? cutawayFirCrowns
            : firCrowns
          : isInsideCutaway
            ? cutawayConiferCrowns
            : coniferCrowns;
      const crownHeight = Math.max(
        2.4,
        tree.height_m * (form === "fir" ? 0.64 : 0.58),
      );
      for (let layer = 0; layer < 3; layer += 1) {
        const radius =
          tree.crown_radius_m *
          (form === "fir" ? 1.02 - layer * 0.22 : 0.98 - layer * 0.18);
        target[variant].push({
          color: foliageColor,
          position: [
            x,
            y + tree.height_m * (0.4 + layer * (form === "fir" ? 0.18 : 0.19)),
            z,
          ],
          rotation: [0, branchYaw + layer * 0.37, 0],
          scale: [radius, crownHeight * (0.64 - layer * 0.08), radius],
        });
      }
    } else if (form === "pine") {
      const target = isInsideCutaway ? cutawayPineCrowns : pineCrowns;
      const pineOffsets = [
        [-0.18, 0.02, 0.12],
        [0.2, 0.18, -0.08],
        [0, 0.38, 0],
      ];
      pineOffsets.forEach(([offsetX, offsetY, offsetZ], layer) => {
        const radius = tree.crown_radius_m * (0.72 - layer * 0.08);
        target[variant].push({
          color: foliageColor,
          position: [
            x + offsetX * tree.crown_radius_m,
            y + trunkHeight + radius * (0.28 + offsetY),
            z + offsetZ * tree.crown_radius_m,
          ],
          rotation: [0, branchYaw + layer * 0.83, 0],
          scale: [radius * 1.14, radius * 0.54, radius],
        });
      });
    } else if (form === "oak") {
      const target = isInsideCutaway ? cutawayOakCrowns : oakCrowns;
      const oakOffsets = [
        [-0.38, -0.04, 0.12],
        [0.38, 0.03, -0.1],
        [-0.16, 0.27, -0.3],
        [0.2, 0.31, 0.28],
        [0, 0.52, 0],
        [0.02, -0.18, 0.02],
      ];
      oakOffsets.forEach(([offsetX, offsetY, offsetZ], layer) => {
        const radius =
          tree.crown_radius_m * (layer === 5 ? 0.64 : layer >= 2 ? 0.76 : 0.86);
        target[variant].push({
          color: foliageColor,
          position: [
            x + offsetX * tree.crown_radius_m,
            y + trunkHeight + radius * (0.38 + offsetY),
            z + offsetZ * tree.crown_radius_m,
          ],
          rotation: [0, branchYaw + layer * 0.57, 0],
          scale: [radius * 1.12, radius * 0.62, radius],
        });
      });
    } else if (form === "willow") {
      const target = isInsideCutaway ? cutawayWillowCrowns : willowCrowns;
      const willowOffsets = [
        [-0.27, 0.02, 0.08],
        [0.28, 0.08, -0.1],
        [0, 0.24, 0.24],
        [0.02, 0.33, -0.22],
      ];
      willowOffsets.forEach(([offsetX, offsetY, offsetZ], layer) => {
        const radius = tree.crown_radius_m * (layer < 2 ? 0.78 : 0.66);
        target[variant].push({
          color: foliageColor,
          position: [
            x + offsetX * tree.crown_radius_m,
            y + trunkHeight + radius * (0.2 + offsetY),
            z + offsetZ * tree.crown_radius_m,
          ],
          rotation: [Math.PI, branchYaw + layer * 0.74, 0],
          scale: [radius, radius * (1.25 + layer * 0.08), radius],
        });
      });
    } else if (form === "shrub") {
      const target = isInsideCutaway ? cutawayShrubCrowns : shrubCrowns;
      const lobeCount = variant === 1 ? 3 : 2;
      for (let lobe = 0; lobe < lobeCount; lobe += 1) {
        const radius =
          tree.crown_radius_m * (lobe === 0 ? 0.9 : lobe === 1 ? 0.72 : 0.58);
        target[variant].push({
          color: foliageColor,
          position: [
            x + (lobe === 0 ? -0.16 : lobe === 1 ? 0.22 : 0.04) *
              tree.crown_radius_m,
            y + Math.max(0.45, tree.height_m * (0.38 + lobe * 0.12)),
            z + (lobe === 0 ? 0.12 : lobe === 1 ? -0.18 : 0.24) *
              tree.crown_radius_m,
          ],
          rotation: [0, branchYaw + lobe * 0.61, 0],
          scale: [
            radius * (variant === 2 ? 1.18 : 1),
            radius * (variant === 0 ? 0.48 : 0.64),
            radius,
          ],
        });
      }
    }
    if (Math.abs(tree.variant) % 3 === 0) {
      const snowTarget = isInsideCutaway ? cutawaySnowCaps : snowCaps;
      snowTarget.push({
        position: [x, y + trunkHeight + tree.crown_radius_m * 1.02, z],
        rotation: [0, branchYaw, 0],
        scale: [
          tree.crown_radius_m * 0.78,
          tree.crown_radius_m * 0.12,
          tree.crown_radius_m * 0.72,
        ],
      });
    }
    if (isLobedTreeForm(form)) {
      const profile = LOBED_CROWN_PROFILES[form];
      const target = isInsideCutaway
        ? cutawayLobedCrownTargets[form]
        : lobedCrownTargets[form];
      for (let layer = 0; layer < profile.offsets.length; layer += 1) {
        const [offsetX, offsetY, offsetZ] =
          profile.offsets[(layer + variant) % profile.offsets.length];
        const radius = tree.crown_radius_m * profile.radiusScales[layer];
        const [scaleX, scaleY, scaleZ] = profile.axisScale;
        target[variant].push({
          color: foliageColor,
          position: [
            x + offsetX * tree.crown_radius_m,
            y + trunkHeight + radius * (0.4 + offsetY),
            z + offsetZ * tree.crown_radius_m,
          ],
          rotation: [0, ((tree.variant + layer) * Math.PI) / 7, 0],
          scale: [
            radius * scaleX * (variant === 0 ? 1.06 : variant === 1 ? 0.94 : 1),
            radius *
              scaleY *
              (1 + layer * 0.035) *
              (variant === 1 ? 1.16 : variant === 2 ? 0.88 : 1),
            radius * scaleZ * (variant === 2 ? 1.08 : 1),
          ],
        });
      }
    }
    if (
      includeSettledDetail &&
      tree.source === "berlin_official" &&
      BRANCHING_TREE_FORMS.has(form)
    ) {
      const settledOffsets = [
        [-0.43, 0.45, -0.3],
        [0.42, 0.3, 0.34],
      ];
      const target = isInsideCutaway ? settledCutawayCrowns : settledCrowns;
      settledOffsets.forEach(([offsetX, offsetY, offsetZ], index) => {
        const radius = tree.crown_radius_m * (index === 0 ? 0.54 : 0.58);
        target[variant].push({
          color: foliageColor,
          position: [
            x + offsetX * tree.crown_radius_m,
            y + trunkHeight + radius * offsetY,
            z + offsetZ * tree.crown_radius_m,
          ],
          rotation: [0, ((tree.variant + index + 5) * Math.PI) / 7, 0],
          scale: [radius, radius * (index === 0 ? 0.74 : 0.79), radius],
        });
      });
    }
  }
  group.add(
    instanced(
      "OSM instanced granular tree trunks",
      new CylinderGeometry(1, 1.18, 1, 7),
      material(0xffffff),
      trunks,
    ),
  );
  group.add(
    instanced(
      "OSM instanced granular tree fork branches",
      new CylinderGeometry(1, 1.18, 1, 6),
      material(0xffffff),
      branches,
    ),
  );
  // Fresh but still light foliage separates individual source trees without
  // turning the Tiergarten into one heavy green mass around the ivory city.
  crowns.forEach((transforms, index) => {
    if (transforms.length > 0) {
      group.add(
        instanced(
          `OSM instanced five-lobed tree crowns variant ${index + 1}`,
          new IcosahedronGeometry(1, 1),
          material(0xffffff, 0.9),
          transforms,
        ),
      );
    }
  });
  cutawayCrowns.forEach((transforms, index) => {
    if (transforms.length > 0 && cutaway) {
      const mesh = instanced(
        `OSM instanced five-lobed tree crowns variant ${index + 1}`,
        new IcosahedronGeometry(1, 1),
        material(0xffffff, 0.9),
        transforms,
      );
      mesh.name += " focus cutaway";
      mesh.userData.focusCutawayFor = cutaway.focusName;
      group.add(mesh);
    }
  });
  const addSourceFormCrowns = (
    transforms: Transform[][],
    cutawayTransforms: Transform[][],
    family: string,
    formColors: readonly number[],
    geometry: () => BufferGeometry,
  ): void => {
    group.userData.treeFamilyPalettes ??= {};
    group.userData.treeFamilyPalettes[family] = [...formColors];
    transforms.forEach((entries, index) => {
      if (entries.length === 0) {
        return;
      }
      group.add(
        instanced(
          `Geoportal Berlin ${family} crowns variant ${index + 1}`,
          geometry(),
          material(0xffffff, 0.94),
          entries,
        ),
      );
    });
    cutawayTransforms.forEach((entries, index) => {
      if (entries.length === 0 || !cutaway) {
        return;
      }
      const mesh = instanced(
        `Geoportal Berlin ${family} crowns variant ${index + 1} focus cutaway`,
        geometry(),
        material(0xffffff, 0.94),
        entries,
      );
      mesh.userData.focusCutawayFor = cutaway.focusName;
      group.add(mesh);
    });
  };
  addSourceFormCrowns(
    airyCrowns,
    cutawayAiryCrowns,
    "airy birch and robinia",
    [0xa8cf91, 0xb7dca0, 0x98c182],
    () => new IcosahedronGeometry(1, 0),
  );
  addSourceFormCrowns(
    columnarCrowns,
    cutawayColumnarCrowns,
    "columnar poplar",
    [0x6f9e65, 0x80ad73, 0x608f59],
    () => new IcosahedronGeometry(1, 1),
  );
  addSourceFormCrowns(
    coniferCrowns,
    cutawayConiferCrowns,
    "tiered conifer",
    [0x6fa36b, 0x7eb175, 0x628f60],
    () => new ConeGeometry(1, 1, 8),
  );
  addSourceFormCrowns(
    denseCrowns,
    cutawayDenseCrowns,
    "dense beech and chestnut",
    [0x6f9f5e, 0x7fae6c, 0x638f54],
    () => new IcosahedronGeometry(1, 1),
  );
  addSourceFormCrowns(
    firCrowns,
    cutawayFirCrowns,
    "dense fir and spruce",
    [0x567f5d, 0x638e67, 0x486f52],
    () => new ConeGeometry(1, 1, 9),
  );
  addSourceFormCrowns(
    pineCrowns,
    cutawayPineCrowns,
    "high-trunk pine",
    [0x648a61, 0x73996b, 0x557b58],
    () => new IcosahedronGeometry(1, 1),
  );
  addSourceFormCrowns(
    oakCrowns,
    cutawayOakCrowns,
    "wide oak",
    [0x76a85e, 0x86b76c, 0x679653],
    () => new IcosahedronGeometry(1, 1),
  );
  addSourceFormCrowns(
    willowCrowns,
    cutawayWillowCrowns,
    "drooping willow",
    [0x8fb879, 0xa0c68a, 0x7ca76d],
    () => new ConeGeometry(1, 1, 10, 2),
  );
  addSourceFormCrowns(
    shrubCrowns,
    cutawayShrubCrowns,
    "low shrub",
    [0x8ebd74, 0x9bc984, 0x80ad68],
    () => new IcosahedronGeometry(1, 1),
  );
  addSourceFormCrowns(
    spreadingCrowns,
    cutawaySpreadingCrowns,
    "spreading maple and plane",
    [0x89b978, 0x9bc98a, 0x78a969],
    () => new IcosahedronGeometry(1, 1),
  );
  addSourceFormCrowns(
    vaseCrowns,
    cutawayVaseCrowns,
    "vase-shaped linden and elm",
    [0x82b46d, 0x93c17d, 0x73a35f],
    () => new IcosahedronGeometry(1, 1),
  );
  const addSnowCaps = (transforms: Transform[], focusCutaway: boolean) => {
    if (transforms.length === 0) {
      return;
    }
    const mesh = instanced(
      "Snowstorm-only tree crown snow caps",
      new IcosahedronGeometry(1, 0),
      material(0xf4f7f6, 0.98),
      transforms,
    );
    mesh.visible = false;
    mesh.userData.snowOnly = true;
    mesh.userData.snowActive = false;
    if (focusCutaway && cutaway) {
      mesh.userData.focusCutawayFor = cutaway.focusName;
    }
    group.add(mesh);
  };
  addSnowCaps(snowCaps, false);
  addSnowCaps(cutawaySnowCaps, true);
  let settledDetailFaces = 0;
  const addSettledCrownInstances = (
    transforms: Transform[],
    index: number,
    focusCutaway: boolean,
  ) => {
    if (transforms.length === 0) {
      return;
    }
    const geometry = new IcosahedronGeometry(1, 1);
    const faces = geometry.index
      ? geometry.index.count / 3
      : geometry.getAttribute("position").count / 3;
    const mesh = instanced(
      `Geoportal Berlin settled-only official tree microcrowns variant ${index + 1}`,
      geometry,
      material(0xffffff, 0.9),
      transforms,
    );
    mesh.visible = false;
    mesh.userData.settledOnly = true;
    mesh.userData.settledActive = false;
    if (focusCutaway && cutaway) {
      mesh.userData.focusCutawayFor = cutaway.focusName;
    }
    group.add(mesh);
    settledDetailFaces += faces * transforms.length;
  };
  settledCrowns.forEach((transforms, index) => {
    addSettledCrownInstances(transforms, index, false);
  });
  settledCutawayCrowns.forEach((transforms, index) => {
    addSettledCrownInstances(transforms, index, true);
  });
  group.userData.treePresentationForms = formCounts;
  return settledDetailFaces;
}

/**
 * Coarse-pointer tree presentation: one measured anchor, one trunk and one
 * crown per retained source tree. The full profile above remains the desktop
 * source-form presentation; this branch deliberately allocates no fork
 * branches, crown lobes, snow caps or settled microcrowns.
 */
function addMobileTrees(group: Group, trees: ParkTree[]): void {
  const trunks: Transform[] = [];
  const crowns: Transform[] = [];
  const formCounts: Record<TreePresentationForm, number> = {
    airy: 0,
    broadleaf: 0,
    columnar: 0,
    conifer: 0,
    dense: 0,
    fir: 0,
    oak: 0,
    orchard: 0,
    pine: 0,
    shrub: 0,
    spreading: 0,
    vase: 0,
    willow: 0,
  };
  for (const tree of trees) {
    const [x, y, z] = tree.position;
    const form = treePresentationForm(tree);
    const trunkHeight = Math.max(
      0.4,
      tree.height_m * TREE_TRUNK_HEIGHT_RATIO[form],
    );
    const trunkRadius =
      tree.trunk_radius_m ??
      Math.max(
        form === "shrub" ? 0.1 : 0.18,
        tree.crown_radius_m * (form === "shrub" ? 0.055 : 0.095),
      );
    const crownHeight = Math.max(0.8, tree.height_m - trunkHeight);
    formCounts[form] += 1;
    trunks.push({
      color: treeBarkTone(tree),
      position: [x, y + trunkHeight / 2, z],
      scale: [trunkRadius, trunkHeight, trunkRadius],
    });
    crowns.push({
      color: treeFoliageTone(tree),
      position: [x, y + trunkHeight + crownHeight / 2, z],
      rotation: [0, ((tree.variant % 12) / 12) * Math.PI * 2, 0],
      scale: [
        Math.max(0.35, tree.crown_radius_m),
        crownHeight / 2,
        Math.max(0.35, tree.crown_radius_m),
      ],
    });
  }
  const trunkMesh = instanced(
    "Mobile park instanced coarse tree trunks",
    new CylinderGeometry(1, 1.12, 1, 5),
    material(0xffffff, 0.96),
    trunks,
  );
  trunkMesh.castShadow = false;
  group.add(trunkMesh);
  const crownMesh = instanced(
    "Mobile park instanced one-crown tree anchors",
    new IcosahedronGeometry(1, 0),
    material(0xffffff, 0.98),
    crowns,
  );
  crownMesh.castShadow = false;
  group.add(crownMesh);
  group.userData.treePresentationForms = formCounts;
  group.userData.mobileTreeTrunkCount = trunks.length;
  group.userData.mobileTreeCrownCount = crowns.length;
}

export type ParkHedgeSegment = {
  from: [number, number, number];
  heightM: number;
  id: string;
  to: [number, number, number];
  widthM: number;
};

/** Finite source-course pieces used by both the renderer and walk collision. */
export function parkHedgeSegments(hedges: ParkHedge[]): ParkHedgeSegment[] {
  const segments: ParkHedgeSegment[] = [];
  for (const hedge of hedges) {
    if (hedge.kind !== "line" || !hedge.points || hedge.points.length < 2) {
      continue;
    }
    for (let point = 1; point < hedge.points.length; point += 1) {
      const from = hedge.points[point - 1];
      const to = hedge.points[point];
      const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
      const steps = Math.max(1, Math.ceil(length / 2));
      for (let step = 0; step < steps; step += 1) {
        const start = step / steps;
        const end = (step + 1) / steps;
        const interpolate = (fraction: number): [number, number, number] => [
          from[0] + (to[0] - from[0]) * fraction,
          from[1] + (to[1] - from[1]) * fraction,
          from[2] + (to[2] - from[2]) * fraction,
        ];
        segments.push({
          from: interpolate(start),
          heightM: hedge.height_m,
          id: hedge.id,
          to: interpolate(end),
          widthM: hedge.width_m ?? 1,
        });
      }
    }
  }
  return segments;
}

/** The exact derived shrub clumps that survive the renderer's tunnel clearing. */
export function parkShrubClusters(
  shrubPatches: ParkShrubPatch[],
  insideTunnelApproach: (
    (x: number, z: number, radius?: number) => boolean
  ) | null = null,
): ParkShrubCluster[] {
  return shrubPatches
    .flatMap((patch) => patch.clusters)
    .filter(
      ([x, , z, , radius]) =>
        !insideTunnelApproach || !insideTunnelApproach(x, z, radius + 0.5),
    );
}

function batchedVegetationFootprints(
  entries: Array<{ rings: [number, number, number][][] }>,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const entry of entries) {
    const normalizedRings = entry.rings
      .map((ring) => {
        const points = [...ring];
        if (
          points.length > 2 &&
          points[0][0] === points.at(-1)?.[0] &&
          points[0][2] === points.at(-1)?.[2]
        ) {
          points.pop();
        }
        return points;
      })
      .filter((ring) => ring.length >= 3);
    if (normalizedRings.length === 0) continue;
    const offset = positions.length / 3;
    const flat = normalizedRings.flat();
    flat.forEach(([x, y, z]) => positions.push(x, y + 0.065, z));
    const contour = normalizedRings[0].map(([x, , z]) => new Vector2(x, z));
    const holes = normalizedRings
      .slice(1)
      .map((ring) => ring.map(([x, , z]) => new Vector2(x, z)));
    ShapeUtils.triangulateShape(contour, holes).forEach((face) => {
      indices.push(offset + face[0], offset + face[1], offset + face[2]);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function addTiergartenVegetation(
  group: Group,
  shrubPatches: ParkShrubPatch[],
  hedges: ParkHedge[],
  insideTunnelApproach: ((x: number, z: number, radius?: number) => boolean) | null,
  includeDerivedDetail = true,
): void {
  const shrubClusters = includeDerivedDetail
    ? parkShrubClusters(shrubPatches, insideTunnelApproach)
    : [];
  const hedgeAreas = hedges.filter(
    (hedge): hedge is ParkHedge & { rings: [number, number, number][][] } =>
      hedge.kind === "area" && Boolean(hedge.rings),
  );
  const hedgeAreaClusters = includeDerivedDetail
    ? hedgeAreas
        .flatMap((hedge) => hedge.clusters ?? [])
        .filter(
          ([x, , z, , radius]) =>
            !insideTunnelApproach || !insideTunnelApproach(x, z, radius + 0.5),
        )
    : [];

  if (shrubPatches.length > 0) {
    const footprint = new Mesh(
      batchedVegetationFootprints(shrubPatches),
      material(0x769a67, 1),
    );
    footprint.name = "OSM exact Großer Tiergarten scrub-area footprints";
    footprint.receiveShadow = true;
    footprint.renderOrder = 1;
    footprint.userData.vegetation = true;
    footprint.userData.geometryStatus =
      "Exact OSM natural=scrub boundaries; derived clumps yield to paths, memorials and playgrounds";
    group.add(footprint);
  }
  if (hedgeAreas.length > 0) {
    const footprint = new Mesh(
      batchedVegetationFootprints(hedgeAreas),
      material(0x557f50, 0.98),
    );
    footprint.name = "OSM exact Großer Tiergarten hedge-area footprints";
    footprint.receiveShadow = true;
    footprint.userData.vegetation = true;
    group.add(footprint);
  }

  const shrubTones = [0x779f62, 0x8caf72, 0x688f58];
  const shrubTransforms: Transform[] = shrubClusters.map(
    ([x, y, z, height, radius, variant]) => ({
      color: shrubTones[Math.abs(variant) % shrubTones.length],
      position: [x, y + height * 0.48, z],
      rotation: [0, ((x * 0.17 + z * 0.11) % 1) * Math.PI, 0],
      scale: [radius, height * 0.58, radius * (variant === 1 ? 1.16 : 0.94)],
    }),
  );
  if (shrubTransforms.length > 0) {
    const shrubs = instanced(
      "OSM polygon-bounded diverse Tiergarten shrub clumps",
      new IcosahedronGeometry(1, 1),
      material(0xffffff, 0.96),
      shrubTransforms,
    );
    shrubs.userData.vegetation = true;
    shrubs.userData.positionStatus =
      "Deterministic display fill inside exact OSM natural=scrub polygons";
    group.add(shrubs);
  }

  const visibleSegments = parkHedgeSegments(hedges).filter((segment) => {
    const x = (segment.from[0] + segment.to[0]) / 2;
    const z = (segment.from[2] + segment.to[2]) / 2;
    return !insideTunnelApproach || !insideTunnelApproach(x, z, segment.widthM);
  });
  const hedgeBodies: Transform[] = [];
  const hedgeLobes: Transform[] = [];
  visibleSegments.forEach((segment, index) => {
    const dx = segment.to[0] - segment.from[0];
    const dz = segment.to[2] - segment.from[2];
    const length = Math.hypot(dx, dz);
    if (length < 0.02) return;
    const groundY = (segment.from[1] + segment.to[1]) / 2;
    const x = (segment.from[0] + segment.to[0]) / 2;
    const z = (segment.from[2] + segment.to[2]) / 2;
    const yaw = -Math.atan2(dz, dx);
    const tone = [0x4f7849, 0x5c8653, 0x466d43][index % 3];
    hedgeBodies.push({
      color: tone,
      position: [x, groundY + segment.heightM / 2, z],
      rotation: [0, yaw, 0],
      scale: [length + 0.08, segment.heightM, segment.widthM],
    });
    if (includeDerivedDetail) {
      hedgeLobes.push({
        color: tone,
        position: [x, groundY + segment.heightM * 0.82, z],
        rotation: [0, yaw + index * 0.37, 0],
        scale: [
          length * 0.62 + 0.24,
          segment.heightM * 0.35,
          segment.widthM * 0.72,
        ],
      });
    }
  });
  if (hedgeBodies.length > 0) {
    const bodies = instanced(
      "OSM finite Tiergarten hedge course bodies",
      new BoxGeometry(1, 1, 1),
      material(0xffffff, 0.98),
      hedgeBodies,
    );
    bodies.userData.vegetation = true;
    bodies.userData.geometryStatus =
      "Exact OSM barrier=hedge courses; untagged height and width are display approximations";
    group.add(bodies);
    if (includeDerivedDetail) {
      const lobes = instanced(
        "OSM finite Tiergarten hedge foliage lobes",
        new IcosahedronGeometry(1, 1),
        material(0xffffff, 0.96),
        hedgeLobes,
      );
      lobes.userData.vegetation = true;
      group.add(lobes);
    }
  }

  if (hedgeAreaClusters.length > 0) {
    const transforms = hedgeAreaClusters.map(
      ([x, y, z, height, radius, variant]): Transform => ({
        color: [0x4f7849, 0x5c8653, 0x466d43][Math.abs(variant) % 3],
        position: [x, y + height * 0.52, z],
        rotation: [0, variant * 0.83, 0],
        scale: [radius, height * 0.58, radius],
      }),
    );
    const areas = instanced(
      "OSM polygon-bounded Tiergarten hedge-area foliage",
      new IcosahedronGeometry(1, 1),
      material(0xffffff, 0.96),
      transforms,
    );
    areas.userData.vegetation = true;
    group.add(areas);
  }

  if (includeDerivedDetail) {
    const snowTransforms: Transform[] = [...shrubClusters, ...hedgeAreaClusters]
      .filter((_, index) => index % 4 === 0)
      .map(([x, y, z, height, radius, variant]) => ({
        position: [x, y + height * 0.92, z],
        rotation: [0, variant * 0.71, 0],
        scale: [radius * 0.72, Math.max(0.08, height * 0.08), radius * 0.66],
      }));
    if (snowTransforms.length > 0) {
      const snow = instanced(
        "Snowstorm-only Tiergarten shrub and hedge caps",
        new IcosahedronGeometry(1, 0),
        material(0xf4f7f6, 0.98),
        snowTransforms,
      );
      snow.visible = false;
      snow.userData.snowOnly = true;
      snow.userData.snowActive = false;
      group.add(snow);
    }
  }

  group.userData.shrubPatchCount = shrubPatches.length;
  group.userData.shrubClusterCount = shrubClusters.length;
  group.userData.hedgeCount = hedges.length;
  group.userData.hedgeSegmentCount = visibleSegments.length;
  group.userData.hedgeAreaClusterCount = hedgeAreaClusters.length;
  if (!includeDerivedDetail) {
    group.userData.mobileDerivedVegetationDetail = false;
  }
}

function lampHeadCount(lightType: string | null): number {
  if (lightType?.includes("Dreifach")) {
    return 3;
  }
  if (lightType?.includes("Doppel") || lightType?.includes("Zwillings")) {
    return 2;
  }
  return 1;
}

function addStreetLights(
  group: Group,
  lights: StreetLight[],
  includeLightCones = true,
): void {
  if (lights.length === 0) {
    return;
  }
  const poles: Transform[] = [];
  const heads: Transform[] = [];
  const cones: Transform[] = [];
  const bandLamps: Transform[] = [];
  for (const light of lights) {
    const [x, y, z] = light.position;
    const height = light.height_m;
    const yaw = MathUtils.degToRad(light.rotation_degrees);
    if (light.installation === "light_band") {
      // Continuous balustrade lighting: a low luminaire on the handrail,
      // no mast and no floodlight cone. Drawing a mast per point turned
      // the Gustav-Heinemann-Brücke handrails into a picket fence.
      bandLamps.push({
        position: [x, y + height, z],
        rotation: [0, yaw, 0],
        scale: [0.16, 0.2, 0.16],
      });
      continue;
    }
    poles.push({
      position: [x, y + height / 2, z],
      rotation: [0, yaw, 0],
      scale: [0.095, height, 0.095],
    });
    const headCount = lampHeadCount(light.light_type);
    for (let index = 0; index < headCount; index += 1) {
      const offset = (index - (headCount - 1) / 2) * 0.72;
      heads.push({
        position: [
          x + Math.cos(yaw) * offset,
          y + height,
          z - Math.sin(yaw) * offset,
        ],
        rotation: [0, yaw, 0],
        scale: [0.42, 0.22, 0.28],
      });
    }
    if (includeLightCones) {
      const coneHeight = Math.max(2.8, height * 0.86);
      cones.push({
        position: [x, y + height - coneHeight / 2, z],
        rotation: [0, yaw, 0],
        scale: [
          Math.min(4.6, height * 0.54),
          coneHeight,
          Math.min(4.6, height * 0.54),
        ],
      });
    }
  }

  const poleMaterial = material(0x4b5759, 0.46);
  const poleMesh = instanced(
    "Geoportal Berlin official public-lighting masts",
    new CylinderGeometry(1, 1.12, 1, 8),
    poleMaterial,
    poles,
  );
  poleMesh.castShadow = true;
  group.add(poleMesh);

  const headMaterial = material(0xf0dfae, 0.24);
  headMaterial.userData.nightEmissive = 0xffdf91;
  headMaterial.userData.nightEmissiveIntensity = 4.2;
  group.add(
    instanced(
      "Geoportal Berlin public-lighting lamp heads",
      new BoxGeometry(1, 1, 1),
      headMaterial,
      heads,
    ),
  );

  if (bandLamps.length > 0) {
    const bandMaterial = material(0xf0dfae, 0.24);
    bandMaterial.userData.nightEmissive = 0xffdf91;
    bandMaterial.userData.nightEmissiveIntensity = 4.2;
    group.add(
      instanced(
        "Geoportal Berlin balustrade light bands",
        new BoxGeometry(1, 1, 1),
        bandMaterial,
        bandLamps,
      ),
    );
  }

  if (includeLightCones) {
    const coneMaterial = new MeshStandardMaterial({
      blending: AdditiveBlending,
      color: 0xffd88a,
      depthWrite: false,
      emissive: 0xffc76a,
      emissiveIntensity: 0.42,
      opacity: 0.075,
      roughness: 1,
      transparent: true,
    });
    const coneMesh = instanced(
      "Geoportal Berlin night-only instanced street-light cones",
      new ConeGeometry(1, 1, 14, 1, false),
      coneMaterial,
      cones,
    );
    coneMesh.userData.nightOnly = true;
    coneMesh.castShadow = false;
    coneMesh.receiveShadow = false;
    group.add(coneMesh);
  }
}

export const WALL_TRACE_PROFILE = {
  /** Double row of granite setts, only 1 mm proud of the drawn road plate. */
  centreLiftM: 0.144,
  heightM: 0.006,
  lengthM: 0.26,
  rowOffsetM: 0.13,
  spacingM: 0.3,
  widthM: 0.16,
} as const;

function addWallTraces(group: Group, traces: WallTrace[]): number {
  const stones: Transform[] = [];
  for (const trace of traces) {
    for (let index = 1; index < trace.points.length; index += 1) {
      const start = trace.points[index - 1];
      const end = trace.points[index];
      const dx = end[0] - start[0];
      const dz = end[2] - start[2];
      const length = Math.hypot(dx, dz);
      if (length < 0.05) {
        continue;
      }
      const stepCount = Math.max(
        1,
        Math.ceil(length / WALL_TRACE_PROFILE.spacingM),
      );
      const nx = -dz / length;
      const nz = dx / length;
      const yaw = -Math.atan2(dz, dx);
      for (let step = 0; step < stepCount; step += 1) {
        const fraction = (step + 0.5) / stepCount;
        const centreX = start[0] + dx * fraction;
        // The official trace follows the terrain while drawn roads and plazas
        // sit up to 0.14 m above it. Keep the setts one millimetre proud: the
        // line remains readable without becoming a wall across the Gate.
        const centreY =
          start[1] +
          (end[1] - start[1]) * fraction +
          WALL_TRACE_PROFILE.centreLiftM;
        const centreZ = start[2] + dz * fraction;
        for (const rowOffset of [
          -WALL_TRACE_PROFILE.rowOffsetM,
          WALL_TRACE_PROFILE.rowOffsetM,
        ]) {
          stones.push({
            position: [
              centreX + nx * rowOffset,
              centreY,
              centreZ + nz * rowOffset,
            ],
            rotation: [0, yaw, 0],
          });
        }
      }
    }
  }
  if (stones.length === 0) {
    return 0;
  }
  // One unlit instanced draw call is both calmer and substantially cheaper
  // than running tens of thousands of tiny setts through PBR + shadow maps.
  // Individual flat colours keep the granite varied without a texture or a
  // time-dependent effect.
  const dayMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const nightMaterial = new MeshBasicMaterial({
    color: 0xc7b9b2,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const stoneMesh = instanced(
    "Official Vorderlandmauer double row of individual granite setts",
    new BoxGeometry(
      WALL_TRACE_PROFILE.lengthM,
      WALL_TRACE_PROFILE.heightM,
      WALL_TRACE_PROFILE.widthM,
    ),
    dayMaterial,
    stones,
  );
  const graniteTones = [0x79483d, 0x6f3f37, 0x845044];
  stones.forEach((_, index) => {
    stoneMesh.setColorAt(
      index,
      new Color(graniteTones[Math.floor(index / 2) % graniteTones.length]),
    );
  });
  if (stoneMesh.instanceColor) {
    stoneMesh.instanceColor.needsUpdate = true;
  }
  stoneMesh.castShadow = false;
  stoneMesh.receiveShadow = false;
  stoneMesh.renderOrder = 7;
  stoneMesh.userData.dayMaterial = dayMaterial;
  stoneMesh.userData.nightMaterial = nightMaterial;
  stoneMesh.userData.geometryStatus =
    "Official 1989 Vorderlandmauer centreline; double granite-sett presentation";
  stoneMesh.userData.sourceUrl =
    "https://www.berlin.de/mauer/geschichte/geschichtsmeile/geschichtsmeile-berliner-mauer-am-brandenburger-tor-148630.php";
  group.add(stoneMesh);
  return stones.length;
}

function addMobileWallTraces(group: Group, traces: WallTrace[]): number {
  const courses: Transform[] = [];
  for (const trace of traces) {
    for (let index = 1; index < trace.points.length; index += 1) {
      const start = trace.points[index - 1];
      const end = trace.points[index];
      const dx = end[0] - start[0];
      const dz = end[2] - start[2];
      const length = Math.hypot(dx, dz);
      if (length < 0.05) {
        continue;
      }
      courses.push({
        color: index % 2 === 0 ? 0x79483d : 0x845044,
        position: [
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2 + WALL_TRACE_PROFILE.centreLiftM,
          (start[2] + end[2]) / 2,
        ],
        rotation: [0, -Math.atan2(dz, dx), 0],
        scale: [
          length,
          WALL_TRACE_PROFILE.heightM,
          WALL_TRACE_PROFILE.rowOffsetM * 2 + WALL_TRACE_PROFILE.widthM,
        ],
      });
    }
  }
  if (courses.length === 0) {
    return 0;
  }
  const surface = new MeshBasicMaterial({ color: 0xffffff });
  const mesh = instanced(
    "Mobile official Vorderlandmauer coarse continuous courses",
    new BoxGeometry(1, 1, 1),
    surface,
    courses,
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 7;
  mesh.userData.geometryStatus =
    "Official 1989 Vorderlandmauer centreline; coarse mobile course presentation";
  mesh.userData.sourceUrl =
    "https://www.berlin.de/mauer/geschichte/geschichtsmeile/geschichtsmeile-berliner-mauer-am-brandenburger-tor-148630.php";
  group.add(mesh);
  return courses.length;
}

function addHiddenEasterEggs(group: Group, trees: ParkTree[]): number {
  const eggCount = Math.min(3, trees.length);
  if (eggCount === 0) {
    return 0;
  }
  const transforms: Transform[] = [];
  for (let index = 0; index < eggCount; index += 1) {
    const treeIndex = Math.min(
      trees.length - 1,
      Math.floor(((index + 0.5) / eggCount) * trees.length),
    );
    const tree = trees[treeIndex];
    const angle = ((tree.variant + index * 5) / 12) * Math.PI * 2;
    transforms.push({
      position: [
        tree.position[0] + Math.cos(angle) * 0.42,
        tree.position[1] + 0.034,
        tree.position[2] + Math.sin(angle) * 0.42,
      ],
      rotation: [0, angle, 0.08 * Math.sin(angle)],
      scale: [1, 1.46, 1],
    });
  }
  const eggs = instanced(
    "Tiergarten three hidden real-scale Easter eggs",
    new SphereGeometry(0.023, 12, 8),
    material(0xd64d5d, 0.42),
    transforms,
  );
  const colors = [0xe84d5b, 0xf2c84b, 0x55b8d2];
  transforms.forEach((_, index) => {
    eggs.setColorAt(index, new Color(colors[index % colors.length]));
  });
  if (eggs.instanceColor) {
    eggs.instanceColor.needsUpdate = true;
  }
  eggs.userData.eggHeightM = 0.067;
  eggs.userData.geometryStatus = "Owner-requested true-scale decorative detail";
  group.add(eggs);
  return eggCount;
}

function treeCrownCutaway(
  playgrounds: ParkPlayground[],
): TreeCrownCutaway | null {
  const focusName = "Spielplatz an der Luiseninsel";
  const playground = playgrounds.find((entry) => entry.name === focusName);
  if (!playground) {
    return null;
  }
  const points =
    playground.equipment.length > 0
      ? playground.equipment.map((item) => item.position)
      : playground.outline;
  if (points.length === 0) {
    return null;
  }
  return {
    focusName,
    radiusM: 46,
    x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
    z: points.reduce((sum, point) => sum + point[2], 0) / points.length,
  };
}

function addBox(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  surface: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), surface);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addCylinderBetween(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  surface: MeshStandardMaterial,
): Mesh {
  const direction = end.clone().sub(start);
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, direction.length(), 8),
    surface,
  );
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function footprintGeometry(
  outline: [number, number, number][],
): BufferGeometry {
  const unique = outline.filter(
    (point, index) =>
      index === 0 ||
      point[0] !== outline[index - 1][0] ||
      point[2] !== outline[index - 1][2],
  );
  if (
    unique.length > 2 &&
    unique[0][0] === unique.at(-1)?.[0] &&
    unique[0][2] === unique.at(-1)?.[2]
  ) {
    unique.pop();
  }
  const contour = unique.map((point) => new Vector2(point[0], point[2]));
  const faces = ShapeUtils.triangulateShape(contour, []);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      unique.flatMap((point) => [point[0], point[1] + 0.11, point[2]]),
      3,
    ),
  );
  geometry.setIndex(faces.flatMap((face) => face));
  geometry.computeVertexNormals();
  return geometry;
}

function addClimbingFrame(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  const steel = material(0x2e6f72, 0.52);
  const rope = markArchitecturalAccentInk(
    new LineBasicMaterial(),
    0xd7c394,
    "micro",
  );
  const posts = [
    new Vector3(x - 1.6, y, z - 1.25),
    new Vector3(x + 1.6, y, z - 1.25),
    new Vector3(x - 1.6, y, z + 1.25),
    new Vector3(x + 1.6, y, z + 1.25),
  ];
  posts.forEach((base, index) => {
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} upright ${index + 1}`,
      base,
      base.clone().add(new Vector3(0, 3.4, 0)),
      0.11,
      steel,
    );
  });
  addCylinderBetween(
    group,
    `${item.kind} ${item.id} ridge`,
    posts[0].clone().add(new Vector3(0, 3.4, 0)),
    posts[3].clone().add(new Vector3(0, 3.4, 0)),
    0.1,
    steel,
  );
  const positions: number[] = [];
  for (let index = 0; index <= 4; index += 1) {
    const fraction = index / 4;
    positions.push(
      x - 1.6 + fraction * 3.2,
      y + 0.25,
      z,
      x - 1.6 + fraction * 3.2,
      y + 3.25,
      z,
      x - 1.6,
      y + 0.25 + fraction * 3,
      z,
      x + 1.6,
      y + 0.25 + fraction * 3,
      z,
    );
  }
  const netGeometry = new BufferGeometry();
  netGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  const net = new LineSegments(netGeometry, rope);
  net.name = `${item.kind} ${item.id} climbing net`;
  group.add(net);
}

function addSlide(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  const direction =
    item.points.length >= 2
      ? new Vector3(
          item.points.at(-1)![0] - item.points[0][0],
          0,
          item.points.at(-1)![2] - item.points[0][2],
        ).normalize()
      : new Vector3(0, 0, 1);
  const chute = addBox(
    group,
    `slide ${item.id} chute`,
    [1.15, 0.18, 4.5],
    [x, y + 1.3, z],
    material(0xc84937, 0.42),
  );
  chute.rotation.y = Math.atan2(direction.x, direction.z);
  chute.rotation.x = -0.38;
  addBox(
    group,
    `slide ${item.id} platform`,
    [1.8, 0.2, 1.8],
    [x - direction.x * 1.8, y + 2.2, z - direction.z * 1.8],
    material(0x856641),
  );
}

function addSwing(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  const frame = material(0x345f66, 0.5);
  const seat = material(item.kind === "basketswing" ? 0xc7573f : 0xd8b447);
  for (const zOffset of [-1.25, 1.25]) {
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} frame left`,
      new Vector3(x - 1.5, y, z + zOffset),
      new Vector3(x, y + 3.1, z + zOffset),
      0.1,
      frame,
    );
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} frame right`,
      new Vector3(x + 1.5, y, z + zOffset),
      new Vector3(x, y + 3.1, z + zOffset),
      0.1,
      frame,
    );
  }
  addCylinderBetween(
    group,
    `${item.kind} ${item.id} top bar`,
    new Vector3(x, y + 3.1, z - 1.25),
    new Vector3(x, y + 3.1, z + 1.25),
    0.12,
    frame,
  );
  for (const offset of [-0.38, 0.38]) {
    addCylinderBetween(
      group,
      `${item.kind} ${item.id} suspension`,
      new Vector3(x, y + 3, z + offset),
      new Vector3(x, y + 1.1, z + offset),
      0.025,
      frame,
    );
  }
  addBox(
    group,
    `${item.kind} ${item.id} seat`,
    item.kind === "basketswing" ? [1.05, 0.22, 0.82] : [0.9, 0.12, 0.36],
    [x, y + 1.03, z],
    seat,
  );
}

function addPlaygroundEquipment(group: Group, item: PlaygroundEquipment): void {
  const [x, y, z] = item.position;
  if (item.kind === "climbingframe") {
    addClimbingFrame(group, item);
  } else if (item.kind === "slide") {
    addSlide(group, item);
  } else if (item.kind === "swing" || item.kind === "basketswing") {
    addSwing(group, item);
  } else if (item.kind === "sandpit") {
    addBox(
      group,
      `sandpit ${item.id}`,
      [5.2, 0.18, 3.8],
      [x, y + 0.1, z],
      material(0xd8bd79, 1),
    );
  } else if (item.kind === "water") {
    addCylinderBetween(
      group,
      `water play pump ${item.id}`,
      new Vector3(x, y, z),
      new Vector3(x, y + 1.25, z),
      0.18,
      material(0x477d91, 0.38),
    );
    addBox(
      group,
      `water play basin ${item.id}`,
      [2.2, 0.16, 1.25],
      [x + 0.8, y + 0.42, z],
      material(0x729ba4, 0.45),
    );
  } else if (item.kind === "excavator") {
    const metal = material(0xd5a434, 0.45);
    addCylinderBetween(
      group,
      `sand excavator ${item.id} pivot`,
      new Vector3(x, y, z),
      new Vector3(x, y + 1.05, z),
      0.14,
      metal,
    );
    addCylinderBetween(
      group,
      `sand excavator ${item.id} arm`,
      new Vector3(x, y + 0.9, z),
      new Vector3(x + 1.3, y + 1.25, z),
      0.1,
      metal,
    );
  } else if (item.kind === "structure") {
    const wood = material(0x8a643e);
    addBox(
      group,
      `play structure ${item.id} platform`,
      [2.4, 0.24, 2.4],
      [x, y + 1.65, z],
      wood,
    );
    for (const dx of [-0.9, 0.9]) {
      for (const dz of [-0.9, 0.9]) {
        addCylinderBetween(
          group,
          `play structure ${item.id} post`,
          new Vector3(x + dx, y, z + dz),
          new Vector3(x + dx, y + 2.9, z + dz),
          0.1,
          wood,
        );
      }
    }
  }
}

function addPlaygrounds(group: Group, playgrounds: ParkPlayground[]): void {
  for (const playground of playgrounds) {
    const playgroundGroup = new Group();
    playgroundGroup.name = `${playground.name} OSM playground details`;
    playgroundGroup.userData.focusRevealFor = playground.name;
    group.add(playgroundGroup);
    if (playground.outline.length >= 4) {
      const surface = material(
        playground.surface === "sand" ? 0xb99b5f : 0x6f865e,
        1,
      );
      surface.side = DoubleSide;
      const footprint = new Mesh(
        footprintGeometry(playground.outline),
        surface,
      );
      footprint.name = `${playground.name} OSM footprint`;
      footprint.receiveShadow = true;
      footprint.userData.sourceUrl = playground.source_url;
      playgroundGroup.add(footprint);
    }
    for (const item of playground.equipment) {
      addPlaygroundEquipment(playgroundGroup, item);
    }
  }
}

function batchedPlaygroundFootprintGeometry(
  playgrounds: ParkPlayground[],
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const playground of playgrounds) {
    const unique = playground.outline.filter(
      (point, index) =>
        index === 0 ||
        point[0] !== playground.outline[index - 1][0] ||
        point[2] !== playground.outline[index - 1][2],
    );
    if (
      unique.length > 2 &&
      unique[0][0] === unique.at(-1)?.[0] &&
      unique[0][2] === unique.at(-1)?.[2]
    ) {
      unique.pop();
    }
    if (unique.length < 3) {
      continue;
    }
    const offset = positions.length / 3;
    unique.forEach((point) =>
      positions.push(point[0], point[1] + 0.11, point[2]),
    );
    const contour = unique.map((point) => new Vector2(point[0], point[2]));
    ShapeUtils.triangulateShape(contour, []).forEach((face) => {
      indices.push(offset + face[0], offset + face[1], offset + face[2]);
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function playgroundSourceAnchor(
  playground: ParkPlayground,
): [number, number, number] {
  const outline = playground.outline.filter(
    (point, index) =>
      index === 0 ||
      point[0] !== playground.outline[index - 1][0] ||
      point[2] !== playground.outline[index - 1][2],
  );
  if (
    outline.length > 2 &&
    outline[0][0] === outline.at(-1)?.[0] &&
    outline[0][2] === outline.at(-1)?.[2]
  ) {
    outline.pop();
  }
  const points =
    outline.length > 0
      ? outline
      : playground.equipment.map((item) => item.position);
  if (points.length === 0) {
    return [0, 0, 0];
  }
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
    points.reduce((sum, point) => sum + point[2], 0) / points.length,
  ];
}

function addMobilePlaygrounds(
  group: Group,
  playgrounds: ParkPlayground[],
): void {
  const footprintGroups = new Map<"sand" | "other", ParkPlayground[]>();
  for (const playground of playgrounds) {
    if (playground.outline.length < 4) {
      continue;
    }
    const surface = playground.surface === "sand" ? "sand" : "other";
    const entries = footprintGroups.get(surface) ?? [];
    entries.push(playground);
    footprintGroups.set(surface, entries);
  }
  let footprintCount = 0;
  for (const [surfaceKind, entries] of footprintGroups) {
    const surface = material(
      surfaceKind === "sand" ? 0xb99b5f : 0x6f865e,
      1,
    );
    surface.side = DoubleSide;
    const footprint = new Mesh(
      batchedPlaygroundFootprintGeometry(entries),
      surface,
    );
    footprint.name = `Mobile batched ${surfaceKind} OSM playground footprints`;
    footprint.receiveShadow = false;
    footprint.userData.playgroundFootprintCount = entries.length;
    footprint.userData.playgroundIds = entries.map((entry) => entry.id);
    footprint.userData.sourceUrls = entries.map((entry) => entry.source_url);
    group.add(footprint);
    footprintCount += entries.length;
  }

  const anchors = playgrounds.map((playground): Transform => {
    const [x, y, z] = playgroundSourceAnchor(playground);
    return {
      color: playground.surface === "sand" ? 0xd6b96f : 0x719064,
      position: [x, y + 0.135, z],
      scale: [0.22, 0.05, 0.22],
    };
  });
  const anchorMesh = instanced(
    "Mobile mapped playground source anchors",
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: 0xffffff }),
    anchors,
  );
  anchorMesh.castShadow = false;
  anchorMesh.receiveShadow = false;
  anchorMesh.userData.playgroundIds = playgrounds.map((entry) => entry.id);
  anchorMesh.userData.sourceUrls = playgrounds.map(
    (entry) => entry.source_url,
  );
  group.add(anchorMesh);

  const signature = playgrounds.find(
    (entry) => entry.name === "Spielplatz an der Luiseninsel",
  );
  if (signature) {
    const signatureGroup = new Group();
    signatureGroup.name = `${signature.name} OSM playground details`;
    signatureGroup.userData.focusRevealFor = signature.name;
    signatureGroup.userData.mobileSignature = true;
    signature.equipment.forEach((item) =>
      addPlaygroundEquipment(signatureGroup, item),
    );
    group.add(signatureGroup);
  }
  group.userData.mobilePlaygroundFootprintCount = footprintCount;
  group.userData.mobilePlaygroundSourceAnchorCount = anchors.length;
}

export function createParkDetails(
  payload: ParkDetailsPayload,
  options: ParkDetailOptions = {},
): Group {
  if (payload.schema_version < 1 || payload.schema_version > 7) {
    throw new Error(`Unsupported park-detail schema ${payload.schema_version}`);
  }
  const group = new Group();
  group.name = "Additive open-data park and civic surface details";
  const detailProfile = options.detailProfile ?? "full";
  const insideTunnelApproach = options.tunnel
    ? createTunnelPortalApproachTester(options.tunnel)
    : null;
  const sourceTrees = decodeTrees(payload.trees, payload.tree_vocabulary);
  const constructionFilteredTrees = sourceTrees.filter(
    (tree) =>
      !isChancelleryExtensionConstructionPoint(
        tree.position[0],
        tree.position[2],
      ),
  );
  const trees = constructionFilteredTrees.filter(
    (tree) =>
      !insideTunnelApproach ||
      !insideTunnelApproach(
        tree.position[0],
        tree.position[2],
        tree.crown_radius_m + 1.5,
      ),
  );
  const lenneOak = trees.find(isLenneOakTree);
  const genericTrees = lenneOak
    ? trees.filter((tree) => tree !== lenneOak)
    : trees;
  const sourceStreetLights = payload.street_lights ?? [];
  const constructionFilteredStreetLights = sourceStreetLights.filter(
    (light) =>
      !isChancelleryExtensionConstructionPoint(
        light.position[0],
        light.position[2],
      ),
  );
  const streetLights = constructionFilteredStreetLights.filter(
    (light) =>
      !insideTunnelApproach ||
      !insideTunnelApproach(light.position[0], light.position[2], 0.8),
  );
  const wallTraces = payload.wall_traces ?? [];
  group.userData = {
    attribution: payload.source.attribution,
    geometryStatus: payload.source.geometry_status,
    pathCount: payload.paths.length,
    playgroundCount: payload.playgrounds.length,
    streetLightCount: streetLights.length,
    suppressedConstructionStreetLightCount:
      sourceStreetLights.length - constructionFilteredStreetLights.length,
    suppressedConstructionTreeCount:
      sourceTrees.length - constructionFilteredTrees.length,
    suppressedTunnelApproachStreetLightCount:
      constructionFilteredStreetLights.length - streetLights.length,
    suppressedTunnelApproachTreeCount:
      constructionFilteredTrees.length - trees.length,
    genericTreeCount: genericTrees.length,
    lenneOakSourceTreeId: lenneOak?.id ?? null,
    signatureTreeCount: lenneOak ? 1 : 0,
    treeCount: trees.length,
  };
  addPaths(
    group,
    payload.paths,
    payload.schema_version >= 7 ? 0.01 : 0.1,
    detailProfile === "full",
  );
  if (detailProfile === "mobile") {
    addMobileTrees(group, genericTrees);
    group.userData.detailProfile = "mobile";
    group.userData.settledOfficialTreeDetailFaces = 0;
  } else {
    group.userData.settledOfficialTreeDetailFaces = addTrees(
      group,
      genericTrees,
      treeCrownCutaway(payload.playgrounds),
      options.settledDetail ?? true,
    );
  }
  if (lenneOak) {
    group.add(createLenneOak(lenneOak, detailProfile));
    const formCounts = group.userData.treePresentationForms as
      | Record<string, number>
      | undefined;
    if (formCounts) {
      formCounts.oak = (formCounts.oak ?? 0) + 1;
    }
  }
  addTiergartenVegetation(
    group,
    payload.shrub_patches ?? [],
    payload.hedges ?? [],
    insideTunnelApproach,
    detailProfile === "full",
  );
  addStreetLights(group, streetLights, detailProfile === "full");
  group.userData.wallStoneCount =
    detailProfile === "mobile"
      ? addMobileWallTraces(group, wallTraces)
      : addWallTraces(group, wallTraces);
  group.userData.eggCount =
    detailProfile === "mobile" ? 0 : addHiddenEasterEggs(group, trees);
  if (detailProfile === "mobile") {
    addMobilePlaygrounds(group, payload.playgrounds);
  } else {
    addPlaygrounds(group, payload.playgrounds);
  }
  return freezeStaticSceneTransforms(group);
}

export function setParkDetailsFocus(group: Group, name: string): void {
  group.traverse((object) => {
    const focusCutawayFor = object.userData.focusCutawayFor;
    if (typeof focusCutawayFor === "string") {
      const focusSuppressed = focusCutawayFor === name;
      object.userData.focusSuppressed = focusSuppressed;
      object.visible =
        !focusSuppressed &&
        (object.userData.snowOnly !== true ||
          object.userData.snowActive === true) &&
        (object.userData.settledOnly !== true ||
          object.userData.settledActive === true);
    }
  });
  for (const child of group.children) {
    const focusRevealFor = child.userData.focusRevealFor;
    if (typeof focusRevealFor !== "string") {
      continue;
    }
    const focused = focusRevealFor === name;
    child.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) {
        return;
      }
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const isFootprint = object.name.endsWith("OSM footprint");
      for (const surface of materials) {
        surface.depthTest = isFootprint || !focused;
        surface.depthWrite = isFootprint || !focused;
        surface.needsUpdate = true;
      }
      object.renderOrder = focused
        ? isFootprint
          ? 0
          : object instanceof LineSegments
            ? 32
            : 31
        : 0;
    });
  }
}

export function setParkSnowPresentation(group: Group, enabled: boolean): void {
  group.traverse((object) => {
    if (object.userData.snowOnly !== true) {
      return;
    }
    object.userData.snowActive = enabled;
    object.visible = enabled && object.userData.focusSuppressed !== true;
  });
}

export function setParkSettledDetail(group: Group, enabled: boolean): void {
  if (group.userData.settledDetailEnabled === enabled) {
    return;
  }
  group.userData.settledDetailEnabled = enabled;
  group.traverse((object) => {
    if (object.userData.settledOnly !== true) {
      return;
    }
    object.userData.settledActive = enabled;
    object.visible = enabled && object.userData.focusSuppressed !== true;
  });
}

export function parkDetailFocusDistance(name: string): number | null {
  if (name === "Spielplatz an der Luiseninsel") {
    return 64;
  }
  if (name === "Großer Tiergarten") {
    return 310;
  }
  return null;
}

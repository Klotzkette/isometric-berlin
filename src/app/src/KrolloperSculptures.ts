import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  Shape,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
  type ArchitecturalInkRole,
} from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";

export type KrolloperDetailProfile = "full" | "mobile";

type SculptureMaterial =
  | "ettinger-tuff"
  | "franconian-limestone"
  | "jura-limestone"
  | "limestone"
  | "red-sandstone"
  | "steel"
  | "tengener-limestone";

type SculptureForm =
  | "contact"
  | "eloul-split"
  | "goeschl-steps"
  | "gross-mario-frame"
  | "grosse-knospe"
  | "himmelsschluessel"
  | "iida-fork"
  | "kampmann-gate"
  | "prantl-franconian"
  | "prantl-jura"
  | "reischke-stack"
  | "schultze-cantilever"
  | "schultze-split"
  | "schwarz-three-hole"
  | "schwarz-twin"
  | "schwarz-wedge"
  | "steiner-cross"
  | "todes-mauer-bruch"
  | "wyss-monolith"
  | "yasuo-second";

type KrolloperWork = {
  artist: string;
  form: SculptureForm;
  material: SculptureMaterial;
  name: string;
  osmNodeId: string;
  rotationY: number;
  sourceLatLon: readonly [number, number];
  startDate: string;
  worldM: readonly [number, number];
};

/**
 * Current OSM inventory of the former Krolloper sculpture lawn.
 *
 * The coordinates were converted through the same EPSG:25833 project frame
 * used by the city model. Photographs and linked collection views only bound
 * the procedural silhouettes; no source pixels ship with the viewer.
 */
export const KROLLOPER_SCULPTURE_PROFILE = {
  detailProfiles: ["full", "mobile"] as const,
  geometryStatus:
    "Twenty current OSM monument nodes at the former Krolloper site; exact source positions with photo-bounded procedural silhouettes and unsurveyed visual-reference rotations",
  groundY: 4.45,
  modelCount: 20,
  referencePolicy:
    "User photographs and freely licensed collection images are visual references only; no raster source is bundled or fetched at runtime",
  sources: [
    "https://www.openstreetmap.org/way/114217004",
    "https://www.dertiergarten.de/skulpturen-gegen-den-krieg/",
    "https://bildhauerei-in-berlin.de/bildwerk/contact-8321/",
    "https://bildhauerei-in-berlin.de/bildwerk/himmelsschluessel-8326/",
    "https://bildhauerei-in-berlin.de/bildwerk/grosse-knospe-iii-63-6271/",
    "https://bildhauerei-in-berlin.de/bildwerk/todes-mauer-bruch-5457/",
  ],
  works: [
    {
      artist: "Mosche Schwarz-Buky",
      form: "schwarz-three-hole",
      material: "ettinger-tuff",
      name: "Mosche Schwarz-Buky - Ettinger Tuff Nord",
      osmNodeId: "9775473611",
      rotationY: -0.18,
      sourceLatLon: [13.368404, 52.5179801],
      startDate: "1961",
      worldM: [-208.669, 96.925],
    },
    {
      artist: "Joachim Schultze Bansen",
      form: "schultze-split",
      material: "franconian-limestone",
      name: "Joachim Schultze Bansen - Fraenkischer Muschelkalk Nordwest",
      osmNodeId: "9775529266",
      rotationY: 0.37,
      sourceLatLon: [13.3680559, 52.518212],
      startDate: "1961",
      worldM: [-231.704, 70.621],
    },
    {
      artist: "Mosche Schwarz-Buky",
      form: "schwarz-wedge",
      material: "ettinger-tuff",
      name: "Mosche Schwarz-Buky - Ettinger Tuff Nordwest",
      osmNodeId: "9779616461",
      rotationY: -0.58,
      sourceLatLon: [13.3681283, 52.5182162],
      startDate: "1961",
      worldM: [-226.783, 70.265],
    },
    {
      artist: "Yasuo Mizui",
      form: "himmelsschluessel",
      material: "franconian-limestone",
      name: "Himmelsschluessel",
      osmNodeId: "9775538466",
      rotationY: -0.48,
      sourceLatLon: [13.3686804, 52.518273],
      startDate: "1961",
      worldM: [-189.2, 64.8],
    },
    {
      artist: "Yasuo Mizui",
      form: "yasuo-second",
      material: "tengener-limestone",
      name: "Yasuo Mizui - Tengener Muschelkalk",
      osmNodeId: "9775512189",
      rotationY: 0.22,
      sourceLatLon: [13.3688817, 52.5182766],
      startDate: "1961",
      worldM: [-175.539, 64.709],
    },
    {
      artist: "Karl Prantl",
      form: "prantl-franconian",
      material: "franconian-limestone",
      name: "Karl Prantl - Fraenkischer Muschelkalk",
      osmNodeId: "9775542858",
      rotationY: 0.72,
      sourceLatLon: [13.3682997, 52.5183249],
      startDate: "1961",
      worldM: [-214.891, 58.448],
    },
    {
      artist: "Pierre Szekely",
      form: "contact",
      material: "franconian-limestone",
      name: "Contact",
      osmNodeId: "2589577819",
      rotationY: -0.06,
      sourceLatLon: [13.3688189, 52.5183568],
      startDate: "1963",
      worldM: [-179.6, 55.7],
    },
    {
      artist: "Utz Kampmann",
      form: "kampmann-gate",
      material: "franconian-limestone",
      name: "Utz Kampmann - Fraenkischer Muschelkalk",
      osmNodeId: "2589577570",
      rotationY: 0.46,
      sourceLatLon: [13.3684643, 52.5183527],
      startDate: "1961",
      worldM: [-203.659, 55.612],
    },
    {
      artist: "Josef Wyss",
      form: "wyss-monolith",
      material: "franconian-limestone",
      name: "Josef Wyss - Fraenkischer Muschelkalk",
      osmNodeId: "9799370475",
      rotationY: -0.4,
      sourceLatLon: [13.3683849, 52.5184048],
      startDate: "1961",
      worldM: [-208.915, 49.7],
    },
    {
      artist: "Mosche Schwarz-Buky",
      form: "schwarz-twin",
      material: "ettinger-tuff",
      name: "Mosche Schwarz-Buky - Ettinger Tuff Mitte",
      osmNodeId: "9779616462",
      rotationY: 0.18,
      sourceLatLon: [13.3682061, 52.5184034],
      startDate: "1961",
      worldM: [-221.045, 49.581],
    },
    {
      artist: "Walter Steiner",
      form: "steiner-cross",
      material: "red-sandstone",
      name: "Walter Steiner - Roter Mainsandstein",
      osmNodeId: "9775528052",
      rotationY: -0.22,
      sourceLatLon: [13.3688689, 52.518512],
      startDate: "1961",
      worldM: [-175.826, 38.53],
    },
    {
      artist: "Kosso Eloul",
      form: "eloul-split",
      material: "franconian-limestone",
      name: "Kosso Eloul - Fraenkischer Muschelkalk",
      osmNodeId: "2589577821",
      rotationY: 0.3,
      sourceLatLon: [13.3680291, 52.5185045],
      startDate: "1961",
      worldM: [-232.799, 38.075],
    },
    {
      artist: "Ben Wagin",
      form: "todes-mauer-bruch",
      material: "steel",
      name: "Todes Mauer Bruch",
      osmNodeId: "9775536511",
      rotationY: -0.12,
      sourceLatLon: [13.3680511, 52.5185434],
      startDate: "2011",
      worldM: [-231.211, 33.786],
    },
    {
      artist: "Roland Goeschl",
      form: "goeschl-steps",
      material: "limestone",
      name: "Roland Goeschl - Kalkstein",
      osmNodeId: "2589577822",
      rotationY: 0.4,
      sourceLatLon: [13.3682869, 52.5185675],
      startDate: "1962",
      worldM: [-215.159, 31.469],
    },
    {
      artist: "Wolfgang Gross-Mario",
      form: "gross-mario-frame",
      material: "limestone",
      name: "Wolfgang Gross-Mario - Kalkstein",
      osmNodeId: "9775530331",
      rotationY: -0.52,
      sourceLatLon: [13.3690401, 52.5186229],
      startDate: "1962",
      worldM: [-163.941, 26.468],
    },
    {
      artist: "Gerson Fehrenbach",
      form: "grosse-knospe",
      material: "limestone",
      name: "Grosse Knospe III/63",
      osmNodeId: "9775503531",
      rotationY: 0.16,
      sourceLatLon: [13.3684742, 52.518631],
      startDate: "1963",
      worldM: [-202.3, 24.7],
    },
    {
      artist: "Joachim Schultze Bansen",
      form: "schultze-cantilever",
      material: "jura-limestone",
      name: "Joachim Schultze Bansen - Jura Kalkstein",
      osmNodeId: "2589577824",
      rotationY: -0.28,
      sourceLatLon: [13.3687106, 52.5186391],
      startDate: "1961",
      worldM: [-186.247, 24.163],
    },
    {
      artist: "Karl Prantl",
      form: "prantl-jura",
      material: "jura-limestone",
      name: "Karl Prantl - Jura Kalkstein",
      osmNodeId: "9775497704",
      rotationY: 0.58,
      sourceLatLon: [13.3684263, 52.5188522],
      startDate: "1961",
      worldM: [-205.002, 0.045],
    },
    {
      artist: "Erich Reischke",
      form: "reischke-stack",
      material: "jura-limestone",
      name: "Erich Reischke - Jura Kalkstein",
      osmNodeId: "9775501204",
      rotationY: -0.2,
      sourceLatLon: [13.3686881, 52.5190901],
      startDate: "1961",
      worldM: [-186.659, -25.99],
    },
    {
      artist: "Yoshikuni Iida",
      form: "iida-fork",
      material: "red-sandstone",
      name: "Yoshikuni Iida - Roter Mainsandstein",
      osmNodeId: "9775509753",
      rotationY: 0.35,
      sourceLatLon: [13.3688482, 52.5192116],
      startDate: "1961",
      worldM: [-175.501, -39.247],
    },
  ] satisfies readonly KrolloperWork[],
} as const;

export const KROLLOPER_SCULPTURE_OSM_KEYS: ReadonlySet<string> = new Set(
  KROLLOPER_SCULPTURE_PROFILE.works.map(
    (work) => `node/${work.osmNodeId}`,
  ),
);

type InstanceTransform = {
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale: readonly [number, number, number];
};

type Hole =
  | { kind: "circle"; radius: number; x: number; y: number }
  | { kind: "polygon"; points: readonly (readonly [number, number])[] };

type SculptureMaterials = Record<SculptureMaterial, MeshStandardMaterial> & {
  groove: MeshStandardMaterial;
  inscription: MeshStandardMaterial;
  plaque: MeshStandardMaterial;
};

const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_ROUGH_STONE = new DodecahedronGeometry(1, 0);

function material(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1.1,
    polygonOffsetUnits: -1.1,
    roughness: options.roughness ?? 0.94,
  });
}

function createMaterials(): SculptureMaterials {
  return {
    "ettinger-tuff": material(0xaaa69b),
    "franconian-limestone": material(0xbcb8ad),
    "jura-limestone": material(0xc8c5b9),
    limestone: material(0xb7b4aa),
    "red-sandstone": material(0x8b5947),
    steel: material(0x555957, { metalness: 0.38, roughness: 0.74 }),
    "tengener-limestone": material(0xc5c1b5),
    groove: material(0x686762, { roughness: 0.98 }),
    inscription: material(0x77756f, { roughness: 0.97 }),
    plaque: material(0xd7d6cf, { metalness: 0.06, roughness: 0.7 }),
  };
}

function addMesh<T extends BufferGeometry, M extends Material>(
  group: Group,
  name: string,
  geometry: T,
  meshMaterial: M,
  position: readonly [number, number, number],
  castsShadow = true,
): Mesh<T, M> {
  const mesh = new Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = castsShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(
  group: Group,
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  meshMaterial: Material,
  castsShadow = true,
): Mesh {
  const mesh = addMesh(
    group,
    name,
    UNIT_BOX,
    meshMaterial,
    position,
    castsShadow,
  );
  mesh.scale.set(...size);
  return mesh;
}

function addInstances(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  meshMaterial: Material,
  transforms: readonly InstanceTransform[],
  castsShadow = true,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, meshMaterial, transforms.length);
  mesh.name = name;
  mesh.castShadow = castsShadow;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...transform.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

function addEdges(
  group: Group,
  mesh: Mesh,
  detailProfile: KrolloperDetailProfile,
  role: ArchitecturalInkRole = "detail",
  opacity = 0.66,
): LineSegments | null {
  if (detailProfile === "mobile" && role !== "silhouette") return null;
  const lineMaterial = markArchitecturalInk(
    new LineBasicMaterial({
      opacity,
      transparent: opacity < 1,
    }),
    role,
  );
  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    lineMaterial,
  );
  edges.name = `${mesh.name} ink lines`;
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  edges.scale.copy(mesh.scale);
  edges.renderOrder = 8;
  group.add(edges);
  return edges;
}

function extrudedProfileGeometry(
  outline: readonly (readonly [number, number])[],
  depth: number,
  holes: readonly Hole[],
  detailProfile: KrolloperDetailProfile,
): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(outline[0][0], outline[0][1]);
  for (const [x, y] of outline.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  for (const hole of holes) {
    const path = new Path();
    if (hole.kind === "circle") {
      path.absellipse(
        hole.x,
        hole.y,
        hole.radius,
        hole.radius,
        0,
        Math.PI * 2,
        false,
      );
    } else {
      path.moveTo(hole.points[0][0], hole.points[0][1]);
      for (const [x, y] of hole.points.slice(1)) path.lineTo(x, y);
      path.closePath();
    }
    shape.holes.push(path);
  }
  const bevel = detailProfile === "full" ? 0.035 : 0.018;
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: detailProfile === "full" ? 12 : 5,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function addProfile(
  group: Group,
  name: string,
  outline: readonly (readonly [number, number])[],
  depth: number,
  holes: readonly Hole[],
  meshMaterial: Material,
  detailProfile: KrolloperDetailProfile,
  position: readonly [number, number, number] = [0, 0, 0],
): Mesh {
  const mesh = addMesh(
    group,
    name,
    extrudedProfileGeometry(outline, depth, holes, detailProfile),
    meshMaterial,
    position,
    detailProfile === "full",
  );
  addEdges(group, mesh, detailProfile, "silhouette", 0.76);
  return mesh;
}

function addGrooves(
  group: Group,
  name: string,
  transforms: readonly InstanceTransform[],
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): InstancedMesh | null {
  const selectedTransforms =
    detailProfile === "mobile" && transforms.length > 4
      ? [0, 1 / 3, 2 / 3, 1].map(
          (fraction) => transforms[Math.round((transforms.length - 1) * fraction)],
        )
      : transforms;
  return addInstances(
    group,
    name,
    UNIT_BOX,
    materials.groove,
    selectedTransforms,
    false,
  );
}

function addPlaque(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
  position: readonly [number, number, number] = [0.58, 0.72, -0.52],
): void {
  const plaque = addBox(
    group,
    `${group.name} small inventory plaque`,
    [0.3, 0.18, 0.025],
    position,
    materials.plaque,
    false,
  );
  addEdges(group, plaque, detailProfile, "micro", 0.52);
}

function buildThreeHoleStele(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Schwarz-Buky tall three-hole tuff stele",
    [
      [-0.58, 0],
      [0.54, 0],
      [0.62, 3.46],
      [0.38, 3.78],
      [-0.5, 3.72],
      [-0.64, 2.2],
    ],
    0.62,
    [
      { kind: "circle", radius: 0.2, x: 0.02, y: 0.82 },
      { kind: "circle", radius: 0.22, x: -0.05, y: 1.78 },
      { kind: "circle", radius: 0.2, x: 0.04, y: 2.82 },
    ],
    materials["ettinger-tuff"],
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.36, 0.62, -0.34]);
}

function buildSchultzeSplit(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const left = addProfile(
    group,
    "Schultze Bansen paired limestone west blade",
    [
      [-0.72, 0],
      [-0.08, 0],
      [-0.02, 2.9],
      [-0.28, 3.3],
      [-0.68, 3.18],
    ],
    0.78,
    [],
    materials["franconian-limestone"],
    detailProfile,
  );
  left.rotation.z = -0.035;
  const right = addProfile(
    group,
    "Schultze Bansen paired limestone east blade",
    [
      [0.1, 0],
      [0.72, 0],
      [0.66, 2.72],
      [0.42, 3.16],
      [0.16, 2.92],
    ],
    0.78,
    [],
    materials["franconian-limestone"],
    detailProfile,
  );
  right.rotation.z = 0.045;
  addGrooves(
    group,
    "Schultze Bansen split face chisel courses",
    Array.from({ length: 7 }, (_unused, index) => ({
      position: [index % 2 === 0 ? -0.37 : 0.39, 0.72 + index * 0.34, -0.41],
      rotation: [0, 0, (index % 2 === 0 ? -1 : 1) * 0.08],
      scale: [0.46, 0.045, 0.025],
    })),
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.4, 0.58, -0.42]);
}

function buildSchwarzWedge(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Schwarz-Buky shouldered tuff wedge",
    [
      [-0.82, 0],
      [0.7, 0],
      [0.82, 1.1],
      [0.44, 1.34],
      [0.65, 2.42],
      [0.05, 2.94],
      [-0.55, 2.68],
      [-0.7, 1.58],
    ],
    0.9,
    [{ kind: "circle", radius: 0.19, x: -0.08, y: 2.25 }],
    materials["ettinger-tuff"],
    detailProfile,
  );
  addGrooves(
    group,
    "Schwarz-Buky wedge wrapped cuts",
    [0, 1, 2, 3, 4].map((index) => ({
      position: [-0.03, 0.75 + index * 0.32, -0.47],
      rotation: [0, 0, -0.14 + index * 0.05],
      scale: [1.18 - index * 0.09, 0.055, 0.03],
    })),
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.42, 0.62, -0.47]);
}

function buildHimmelsschluessel(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Himmelsschluessel four metre pierced stele",
    [
      [-0.64, 0],
      [0.6, 0],
      [0.66, 3.43],
      [0.48, 3.94],
      [0.06, 4],
      [-0.46, 3.83],
      [-0.62, 3.2],
    ],
    0.72,
    [{ kind: "circle", radius: 0.25, x: 0.02, y: 3.48 }],
    materials["franconian-limestone"],
    detailProfile,
  );
  addGrooves(
    group,
    "Himmelsschluessel deep diagonal bindings",
    [
      { position: [0, 1.56, -0.43], rotation: [0, 0, 0.2], scale: [1.26, 0.11, 0.035] },
      { position: [0, 1.9, -0.43], rotation: [0, 0, -0.12], scale: [1.22, 0.1, 0.035] },
      { position: [0, 2.23, -0.43], rotation: [0, 0, 0.16], scale: [1.18, 0.09, 0.035] },
      { position: [0, 2.54, -0.43], rotation: [0, 0, -0.08], scale: [1.1, 0.085, 0.035] },
      { position: [0, 1.56, 0.43], rotation: [0, 0, -0.2], scale: [1.26, 0.11, 0.035] },
      { position: [0, 1.9, 0.43], rotation: [0, 0, 0.12], scale: [1.22, 0.1, 0.035] },
      { position: [0, 2.23, 0.43], rotation: [0, 0, -0.16], scale: [1.18, 0.09, 0.035] },
      { position: [0, 2.54, 0.43], rotation: [0, 0, 0.08], scale: [1.1, 0.085, 0.035] },
    ],
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.35, 0.64, -0.38]);
  group.userData.documentedHeightM = 4;
}

function buildYasuoSecond(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Yasuo Mizui second folded limestone stele",
    [
      [-0.72, 0],
      [0.62, 0],
      [0.7, 2.55],
      [0.35, 3.08],
      [-0.05, 2.87],
      [-0.42, 3.14],
      [-0.68, 2.72],
    ],
    0.74,
    [
      {
        kind: "polygon",
        points: [
          [-0.28, 1.3],
          [0.28, 1.38],
          [0.22, 1.78],
          [-0.2, 1.72],
        ],
      },
    ],
    materials["tengener-limestone"],
    detailProfile,
  );
  addGrooves(
    group,
    "Yasuo Mizui second stele folded courses",
    [
      { position: [0, 0.74, -0.39], rotation: [0, 0, -0.12], scale: [1.12, 0.07, 0.03] },
      { position: [0.02, 2.28, -0.39], rotation: [0, 0, 0.16], scale: [1.05, 0.07, 0.03] },
    ],
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.38, 0.6, -0.4]);
}

function buildPrantlFranconian(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const body = addMesh(
    group,
    "Karl Prantl broad rough limestone body",
    UNIT_ROUGH_STONE,
    materials["franconian-limestone"],
    [0, 1.03, 0],
    detailProfile === "full",
  );
  body.scale.set(1.22, 1.06, 0.65);
  body.rotation.set(0.03, 0.08, -0.06);
  addEdges(group, body, detailProfile, "silhouette", 0.68);
  addProfile(
    group,
    "Karl Prantl quiet cut-through",
    [
      [-0.32, 0],
      [0.32, 0],
      [0.34, 1.55],
      [-0.3, 1.48],
    ],
    0.22,
    [{ kind: "circle", radius: 0.15, x: 0, y: 0.9 }],
    materials.groove,
    detailProfile,
    [0, 0.28, -0.62],
  );
  addPlaque(group, materials, detailProfile, [0.62, 0.55, -0.52]);
}

function buildContact(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const stone = materials["franconian-limestone"];
  addProfile(
    group,
    "Contact pierced omega body",
    [
      [-0.62, 0.08],
      [-0.9, 0.2],
      [-0.72, 0.56],
      [-0.94, 0.92],
      [-1.02, 1.48],
      [-0.88, 2.05],
      [-0.52, 2.4],
      [0, 2.52],
      [0.52, 2.38],
      [0.88, 2.02],
      [1, 1.46],
      [0.91, 0.9],
      [0.7, 0.52],
      [0.88, 0.22],
      [0.58, 0.06],
      [0.22, 0.1],
      [0.12, 0.78],
      [-0.14, 0.78],
      [-0.22, 0.1],
    ],
    0.62,
    [
      {
        kind: "polygon",
        points: [
          [-0.58, 1.25],
          [-0.16, 1.3],
          [-0.12, 1.75],
          [-0.48, 1.78],
          [-0.66, 1.55],
        ],
      },
      {
        kind: "polygon",
        points: [
          [0.14, 1.3],
          [0.58, 1.24],
          [0.66, 1.55],
          [0.48, 1.8],
          [0.12, 1.74],
        ],
      },
    ],
    stone,
    detailProfile,
  );
  const spine = addBox(
    group,
    "Contact central descending tongue",
    [0.3, 1.3, 0.68],
    [0, 0.83, -0.015],
    stone,
    detailProfile === "full",
  );
  spine.rotation.z = -0.035;
  addEdges(group, spine, detailProfile, "detail", 0.62);
  const shadow = addMesh(
    group,
    "Contact partly embedded shadow stone",
    UNIT_ROUGH_STONE,
    stone,
    [-0.86, 0.18, 0.52],
    detailProfile === "full",
  );
  shadow.scale.set(0.82, 0.25, 0.62);
  shadow.rotation.set(0.06, -0.24, -0.08);
  addPlaque(group, materials, detailProfile, [0.56, 0.44, -0.34]);
  group.userData.documentedHeightM = 2.5;
}

function buildKampmann(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Utz Kampmann asymmetric limestone gate",
    [
      [-0.86, 0],
      [0.78, 0],
      [0.72, 3.05],
      [0.25, 3.28],
      [-0.28, 3.12],
      [-0.78, 2.72],
    ],
    0.72,
    [
      {
        kind: "polygon",
        points: [
          [-0.34, 0.78],
          [0.34, 0.74],
          [0.38, 1.66],
          [-0.27, 1.72],
        ],
      },
    ],
    materials["franconian-limestone"],
    detailProfile,
  );
  const lintel = addBox(
    group,
    "Utz Kampmann projecting gate lintel",
    [1.9, 0.4, 1.02],
    [0.08, 2.15, 0.04],
    materials["franconian-limestone"],
    detailProfile === "full",
  );
  lintel.rotation.z = -0.09;
  addEdges(group, lintel, detailProfile, "detail", 0.6);
  addPlaque(group, materials, detailProfile, [0.45, 0.57, -0.38]);
}

function buildWyss(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Josef Wyss rough shouldered monolith",
    [
      [-0.84, 0],
      [0.76, 0],
      [0.82, 1.72],
      [0.5, 2.12],
      [0.2, 2.02],
      [-0.16, 2.36],
      [-0.62, 2.08],
      [-0.78, 1.54],
    ],
    0.94,
    [{ kind: "circle", radius: 0.18, x: 0.2, y: 1.48 }],
    materials["franconian-limestone"],
    detailProfile,
  );
  addGrooves(
    group,
    "Josef Wyss hand-cut face marks",
    Array.from({ length: 6 }, (_unused, index) => ({
      position: [-0.42 + (index % 3) * 0.42, 0.55 + Math.floor(index / 3) * 0.45, -0.49],
      rotation: [0, 0, index % 2 === 0 ? 0.2 : -0.16],
      scale: [0.28, 0.05, 0.03],
    })),
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.44, 0.54, -0.49]);
}

function buildSchwarzTwin(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const bodies: readonly (readonly (readonly [number, number])[])[] = [
    [
      [-0.78, 0],
      [-0.08, 0],
      [-0.1, 2.64],
      [-0.4, 3.02],
      [-0.72, 2.82],
    ],
    [
      [0.08, 0],
      [0.76, 0],
      [0.68, 2.86],
      [0.36, 3.14],
      [0.12, 2.72],
    ],
  ];
  bodies.forEach((outline, index) =>
    addProfile(
      group,
      `Schwarz-Buky separated tuff blade ${index + 1}`,
      outline,
      0.72,
      [],
      materials["ettinger-tuff"],
      detailProfile,
      [0, 0, index === 0 ? -0.12 : 0.12],
    ),
  );
  addGrooves(
    group,
    "Schwarz-Buky twin blade incision ladder",
    Array.from({ length: 7 }, (_unused, index) => ({
      position: [index % 2 === 0 ? -0.4 : 0.39, 0.72 + index * 0.3, -0.5],
      rotation: [0, 0, index % 2 === 0 ? -0.1 : 0.1],
      scale: [0.48, 0.05, 0.026],
    })),
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.38, 0.58, -0.5]);
}

function buildSteiner(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const blocks: InstanceTransform[] = [
    { position: [-0.05, 0.18, 0], rotation: [0, 0.06, 0], scale: [0.82, 0.36, 0.72] },
    { position: [-0.25, 0.56, 0], rotation: [0, -0.05, -0.05], scale: [0.72, 0.42, 0.7] },
    { position: [0.05, 0.94, 0], rotation: [0, 0.04, 0.08], scale: [0.82, 0.48, 0.72] },
    { position: [-0.22, 1.38, 0], rotation: [0, -0.04, -0.05], scale: [0.78, 0.5, 0.72] },
    { position: [0.06, 1.83, 0], rotation: [0, 0.05, 0.08], scale: [0.82, 0.48, 0.72] },
    { position: [-0.1, 2.3, 0], rotation: [0, -0.05, -0.05], scale: [0.76, 0.52, 0.72] },
    { position: [0.05, 2.78, 0], rotation: [0, 0.04, 0.07], scale: [0.72, 0.52, 0.7] },
    { position: [-0.67, 0.82, 0], rotation: [0, 0.06, -0.03], scale: [0.78, 0.44, 0.68] },
    { position: [0.65, 1.58, 0], rotation: [0, -0.04, 0.04], scale: [0.82, 0.44, 0.68] },
    { position: [-0.62, 2.34, 0], rotation: [0, 0.05, -0.04], scale: [0.7, 0.42, 0.66] },
  ];
  addInstances(
    group,
    "Walter Steiner interlocked red sandstone cross blocks",
    UNIT_BOX,
    materials["red-sandstone"],
    blocks,
    detailProfile === "full",
  );
  addPlaque(group, materials, detailProfile, [0.58, 0.62, -0.38]);
}

function buildEloul(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Kosso Eloul west split limestone wing",
    [
      [-0.72, 0],
      [-0.08, 0],
      [-0.02, 3.06],
      [-0.25, 3.3],
      [-0.64, 3.18],
    ],
    0.66,
    [],
    materials["franconian-limestone"],
    detailProfile,
  );
  addProfile(
    group,
    "Kosso Eloul east split limestone wing",
    [
      [0.08, 0],
      [0.74, 0],
      [0.66, 3.22],
      [0.3, 3.36],
      [0.12, 2.94],
    ],
    0.66,
    [],
    materials["franconian-limestone"],
    detailProfile,
    [0, 0, 0.1],
  );
  addGrooves(
    group,
    "Kosso Eloul split limestone horizontal tooling",
    Array.from({ length: 5 }, (_unused, index) => ({
      position: [index % 2 === 0 ? -0.37 : 0.4, 0.72 + index * 0.38, -0.35],
      rotation: [0, 0, 0],
      scale: [0.5, 0.04, 0.025],
    })),
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.4, 0.57, -0.35]);
}

function addGroundInscription(
  group: Group,
  name: string,
  text: string,
  position: readonly [number, number, number],
  rotationY: number,
  materials: SculptureMaterials,
): void {
  const slab = addBox(
    group,
    `${name} granite slab`,
    [1.55, 0.09, 0.82],
    position,
    materials.inscription,
    false,
  );
  slab.rotation.y = rotationY;
  const texture = createLetteringTexture({
    bandHeightM: 0.7,
    bandWidthM: 1.42,
    capHeightM: 0.065,
    fieldColor: "#85847f",
    letterColor: "#45443f",
    text,
    texelsPerMetre: 190,
  });
  const panelMaterial = texture
    ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
    : new MeshBasicMaterial({ color: 0x85847f, side: DoubleSide });
  const panel = addMesh(
    group,
    name,
    new PlaneGeometry(1.42, 0.7),
    panelMaterial,
    [position[0], position[1] + 0.051, position[2]],
    false,
  );
  panel.rotation.set(-Math.PI / 2, 0, rotationY);
  panel.renderOrder = 5;
  panel.userData.fallbackWithoutCanvas = texture === null;
  panel.userData.lettering = text;
}

function buildTodesMauerBruch(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Todes Mauer Bruch tall jagged steel wall",
    [
      [-1.02, 0.36],
      [-0.18, 0.36],
      [-0.14, 2.86],
      [-0.38, 2.72],
      [-0.58, 3.02],
      [-0.82, 2.76],
      [-1.04, 3.28],
    ],
    0.2,
    [],
    materials.steel,
    detailProfile,
  );
  addProfile(
    group,
    "Todes Mauer Bruch short jagged steel wall",
    [
      [0.02, 0.34],
      [0.68, 0.34],
      [0.7, 2.16],
      [0.53, 2.06],
      [0.4, 2.38],
      [0.19, 2.2],
      [0.02, 2.5],
    ],
    0.2,
    [],
    materials.steel,
    detailProfile,
    [0, 0, 0.2],
  );
  const tallFoot = addBox(
    group,
    "Todes Mauer Bruch tall sloping steel foot",
    [1.02, 0.42, 0.62],
    [-0.58, 0.28, -0.02],
    materials.steel,
    detailProfile === "full",
  );
  tallFoot.rotation.z = -0.18;
  const shortFoot = addBox(
    group,
    "Todes Mauer Bruch short sloping steel foot",
    [0.72, 0.38, 0.62],
    [0.35, 0.26, 0.18],
    materials.steel,
    detailProfile === "full",
  );
  shortFoot.rotation.z = 0.17;
  const roundEnd = addMesh(
    group,
    "Todes Mauer Bruch round-ended side element",
    new CylinderGeometry(0.29, 0.29, 0.28, detailProfile === "full" ? 18 : 10),
    materials.steel,
    [0.75, 0.34, 0.15],
    detailProfile === "full",
  );
  roundEnd.rotation.z = Math.PI / 2;
  const inscriptions = [
    ["Todes Mauer Bruch death words", "TOD MIRS DODE TOTE", [-1.12, 0.055, -1.08], -0.06],
    ["Todes Mauer Bruch multilingual memorial", "MORT MUERTE MORD", [0.68, 0.055, -1.0], 0.08],
    ["Todes Mauer Bruch war words", "WAR KRIEG GUERRE", [-1.02, 0.055, 0.98], 0.08],
    ["Todes Mauer Bruch Krolloper chronology", "KROLL OPER 1933 1945", [0.72, 0.055, 1.05], -0.07],
  ] as const;
  inscriptions.forEach(([name, text, position, rotationY]) =>
    addGroundInscription(
      group,
      name,
      text,
      position,
      rotationY,
      materials,
    ),
  );
  group.userData.groundInscriptionCount = inscriptions.length;
}

function buildGoeschl(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const blocks: InstanceTransform[] = [
    { position: [0, 0.23, 0], scale: [0.9, 0.46, 0.78] },
    { position: [-0.16, 0.68, 0], rotation: [0, 0, -0.03], scale: [0.72, 0.48, 0.72] },
    { position: [0.14, 1.12, 0], rotation: [0, 0, 0.04], scale: [0.76, 0.5, 0.72] },
    { position: [-0.12, 1.58, 0], rotation: [0, 0, -0.04], scale: [0.74, 0.5, 0.72] },
    { position: [0.1, 2.04, 0], rotation: [0, 0, 0.05], scale: [0.7, 0.5, 0.7] },
    { position: [-0.06, 2.5, 0], rotation: [0, 0, -0.04], scale: [0.68, 0.5, 0.68] },
    { position: [-0.58, 1.08, 0], scale: [0.7, 0.38, 0.65] },
    { position: [0.58, 1.8, 0], scale: [0.7, 0.38, 0.65] },
  ];
  addInstances(
    group,
    "Roland Goeschl stepped limestone cross column",
    UNIT_BOX,
    materials.limestone,
    blocks,
    detailProfile === "full",
  );
  addPlaque(group, materials, detailProfile, [0.48, 0.56, -0.38]);
}

function buildGrossMario(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const frame = addProfile(
    group,
    "Gross-Mario square aperture limestone frame",
    [
      [-0.82, 0],
      [0.8, 0],
      [0.72, 2.8],
      [0.28, 3.06],
      [-0.25, 2.9],
      [-0.78, 3.12],
    ],
    0.74,
    [
      {
        kind: "polygon",
        points: [
          [-0.3, 1.1],
          [0.32, 1.12],
          [0.32, 1.75],
          [-0.3, 1.73],
        ],
      },
    ],
    materials.limestone,
    detailProfile,
  );
  frame.rotation.z = 0.025;
  const side = addBox(
    group,
    "Gross-Mario lateral limestone key",
    [0.74, 0.54, 0.98],
    [0.8, 1.22, 0.02],
    materials.limestone,
    detailProfile === "full",
  );
  side.rotation.z = -0.08;
  addEdges(group, side, detailProfile, "detail", 0.62);
  addPlaque(group, materials, detailProfile, [0.42, 0.6, -0.4]);
}

function buildGrosseKnospe(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const base = addBox(
    group,
    "Grosse Knospe documented half metre plinth",
    [1.72, 0.5, 1.36],
    [0, 0.25, 0],
    materials.limestone,
    detailProfile === "full",
  );
  addEdges(group, base, detailProfile, "silhouette", 0.66);
  const lobes: InstanceTransform[] = [
    { position: [-0.42, 1.14, -0.08], rotation: [0.08, 0.2, -0.22], scale: [0.72, 0.72, 0.58] },
    { position: [0.4, 1.15, -0.05], rotation: [-0.06, -0.24, 0.24], scale: [0.7, 0.75, 0.6] },
    { position: [-0.34, 1.7, 0.02], rotation: [0.12, -0.15, 0.2], scale: [0.58, 0.53, 0.53] },
    { position: [0.34, 1.73, 0], rotation: [-0.1, 0.18, -0.22], scale: [0.58, 0.52, 0.52] },
    { position: [0, 1.42, 0.18], rotation: [0.2, 0, 0], scale: [0.62, 0.6, 0.55] },
  ];
  addInstances(
    group,
    "Grosse Knospe rough cubist limestone lobes",
    UNIT_ROUGH_STONE,
    materials.limestone,
    detailProfile === "mobile" ? lobes.slice(0, 4) : lobes,
    detailProfile === "full",
  );
  addBox(
    group,
    "Grosse Knospe deep central cleft",
    [0.12, 1.02, 0.08],
    [0, 1.46, -0.57],
    materials.groove,
    false,
  );
  addPlaque(group, materials, detailProfile, [0.55, 0.64, -0.7]);
  group.userData.documentedBodyHeightM = 1.7;
  group.userData.documentedPlinthHeightM = 0.5;
}

function buildSchultzeCantilever(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const blocks: InstanceTransform[] = [
    { position: [0, 0.6, 0], scale: [0.72, 1.2, 0.72] },
    { position: [-0.18, 1.44, 0], rotation: [0, 0, -0.05], scale: [0.82, 0.5, 0.74] },
    { position: [0.1, 1.9, 0], rotation: [0, 0, 0.06], scale: [0.78, 0.5, 0.72] },
    { position: [-0.12, 2.36, 0], rotation: [0, 0, -0.05], scale: [0.74, 0.5, 0.7] },
    { position: [-0.64, 1.46, 0], scale: [0.7, 0.4, 0.68] },
    { position: [0.64, 2.15, 0], scale: [0.72, 0.4, 0.68] },
  ];
  addInstances(
    group,
    "Schultze Bansen Jura cantilever stack",
    UNIT_BOX,
    materials["jura-limestone"],
    blocks,
    detailProfile === "full",
  );
  addPlaque(group, materials, detailProfile, [0.42, 0.57, -0.38]);
}

function buildPrantlJura(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Karl Prantl tall Jura meditation stone",
    [
      [-0.66, 0],
      [0.64, 0],
      [0.72, 2.68],
      [0.4, 3.06],
      [-0.14, 3.18],
      [-0.58, 2.9],
    ],
    0.9,
    [{ kind: "circle", radius: 0.17, x: 0.04, y: 2.44 }],
    materials["jura-limestone"],
    detailProfile,
  );
  addGrooves(
    group,
    "Karl Prantl Jura quiet horizontal incisions",
    Array.from({ length: 8 }, (_unused, index) => ({
      position: [0, 0.55 + index * 0.25, -0.47],
      rotation: [0, 0, (index % 3 - 1) * 0.035],
      scale: [0.82 + (index % 2) * 0.16, 0.035, 0.026],
    })),
    materials,
    detailProfile,
  );
  addPlaque(group, materials, detailProfile, [0.38, 0.56, -0.47]);
}

function buildReischke(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  const count = detailProfile === "full" ? 12 : 8;
  const segments: InstanceTransform[] = Array.from(
    { length: count },
    (_unused, index) => {
      const t = index / (count - 1);
      return {
        position: [Math.sin(index * 1.7) * 0.05, 0.28 + t * 3.25, Math.cos(index * 1.3) * 0.035],
        rotation: [0.06 * Math.sin(index), index * 0.31, 0.05 * Math.cos(index * 0.8)],
        scale: [0.52 - t * 0.08, 0.25, 0.48 - t * 0.06],
      };
    },
  );
  addInstances(
    group,
    "Erich Reischke twelve rounded Jura stone courses",
    UNIT_ROUGH_STONE,
    materials["jura-limestone"],
    segments,
    detailProfile === "full",
  );
  addPlaque(group, materials, detailProfile, [0.34, 0.6, -0.38]);
}

function buildIida(
  group: Group,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  addProfile(
    group,
    "Yoshikuni Iida forked red sandstone body",
    [
      [-0.82, 0],
      [0.78, 0],
      [0.72, 2.54],
      [0.4, 2.94],
      [0.1, 2.56],
      [-0.16, 3.08],
      [-0.58, 2.82],
      [-0.74, 2.18],
    ],
    0.82,
    [
      {
        kind: "polygon",
        points: [
          [-0.32, 1.04],
          [0.34, 1.14],
          [0.28, 1.72],
          [-0.26, 1.62],
        ],
      },
    ],
    materials["red-sandstone"],
    detailProfile,
  );
  const wing = addBox(
    group,
    "Yoshikuni Iida red sandstone side wing",
    [0.72, 0.52, 1.08],
    [0.64, 0.82, 0.06],
    materials["red-sandstone"],
    detailProfile === "full",
  );
  wing.rotation.z = -0.14;
  addEdges(group, wing, detailProfile, "detail", 0.6);
  addPlaque(group, materials, detailProfile, [0.42, 0.56, -0.44]);
}

function buildWork(
  group: Group,
  form: SculptureForm,
  materials: SculptureMaterials,
  detailProfile: KrolloperDetailProfile,
): void {
  switch (form) {
    case "contact":
      buildContact(group, materials, detailProfile);
      break;
    case "eloul-split":
      buildEloul(group, materials, detailProfile);
      break;
    case "goeschl-steps":
      buildGoeschl(group, materials, detailProfile);
      break;
    case "gross-mario-frame":
      buildGrossMario(group, materials, detailProfile);
      break;
    case "grosse-knospe":
      buildGrosseKnospe(group, materials, detailProfile);
      break;
    case "himmelsschluessel":
      buildHimmelsschluessel(group, materials, detailProfile);
      break;
    case "iida-fork":
      buildIida(group, materials, detailProfile);
      break;
    case "kampmann-gate":
      buildKampmann(group, materials, detailProfile);
      break;
    case "prantl-franconian":
      buildPrantlFranconian(group, materials, detailProfile);
      break;
    case "prantl-jura":
      buildPrantlJura(group, materials, detailProfile);
      break;
    case "reischke-stack":
      buildReischke(group, materials, detailProfile);
      break;
    case "schultze-cantilever":
      buildSchultzeCantilever(group, materials, detailProfile);
      break;
    case "schultze-split":
      buildSchultzeSplit(group, materials, detailProfile);
      break;
    case "schwarz-three-hole":
      buildThreeHoleStele(group, materials, detailProfile);
      break;
    case "schwarz-twin":
      buildSchwarzTwin(group, materials, detailProfile);
      break;
    case "schwarz-wedge":
      buildSchwarzWedge(group, materials, detailProfile);
      break;
    case "steiner-cross":
      buildSteiner(group, materials, detailProfile);
      break;
    case "todes-mauer-bruch":
      buildTodesMauerBruch(group, materials, detailProfile);
      break;
    case "wyss-monolith":
      buildWyss(group, materials, detailProfile);
      break;
    case "yasuo-second":
      buildYasuoSecond(group, materials, detailProfile);
      break;
  }
}

function renderableCount(root: Group): number {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof LineSegments) count += 1;
  });
  return count;
}

/** Build the complete former Krolloper anti-war sculpture ensemble. */
export function createKrolloperSculptureEnsemble(
  detailProfile: KrolloperDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = "Skulpturen gegen Krieg und Gewalt am ehemaligen Krolloperplatz";
  root.userData.detailProfile = detailProfile;
  root.userData.profile = KROLLOPER_SCULPTURE_PROFILE;
  root.userData.referenceImagesBundled = false;
  const materials = createMaterials();

  for (const work of KROLLOPER_SCULPTURE_PROFILE.works) {
    const group = new Group();
    group.name = `Krolloper sculpture ${work.name}`;
    group.position.set(
      work.worldM[0],
      KROLLOPER_SCULPTURE_PROFILE.groundY,
      work.worldM[1],
    );
    group.rotation.y = work.rotationY;
    group.userData = {
      ...work,
      exactOsmPosition: true,
      referenceImagesBundled: false,
    };
    buildWork(group, work.form, materials, detailProfile);
    root.add(group);
  }

  root.userData.modelCount = root.children.length;
  root.userData.renderableCount = renderableCount(root);
  return root;
}

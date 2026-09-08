import {
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  Vector3,
  type Object3DEventMap,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ARCHITECTURAL_EDGE_THRESHOLD_DEGREES } from "./architecturalInk";
import {
  type Builder,
  addBox,
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
} from "./drawnKit";

import {
  createFriedrichstadtPalast, createMinecraftFriedrichstadtPalast,
  FRIEDRICHSTADT_PALAST_PROFILE, type PalaceDetailProfile,
} from "./FriedrichstadtPalastDetails";
export * from "./FriedrichstadtPalastDetails";

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

export const TEAR_PALACE_ROOT_NAME =
  "Tränenpalast source-bound steel-glass pavilion";
export const TEAR_PALACE_GLASS_LAYER_NAME =
  "Tränenpalast transparent perimeter glazing";
export const TEAR_PALACE_MULLION_LAYER_NAME =
  "Tränenpalast aluminium mullions";

export const TEAR_PALACE_FOOTPRINT_WORLD = [
  [1048.21, -183.39],
  [1050.44, -187.52],
  [1049.32, -188.34],
  [1063.04, -213.1],
  [1072.14, -210.04],
  [1073.54, -212.54],
  [1079.71, -208.2],
  [1077.7, -206.02],
  [1083.41, -198.58],
  [1064.82, -177.35],
  [1063.82, -178.14],
  [1060.67, -174.51],
] as const;

/** These three source prisms remain suppressed by IsometricCityWorld. */
export const TEAR_PALACE_PRISM_IDS = [
  "U4ubriIq",
  "3z4aOJds",
  "92ZtVVpI",
] as const;

/**
 * HdG and LDA identify the Tränenpalast as a small, flat-roofed, transparent
 * steel-and-glass pavilion at Bahnhof Friedrichstrasse's northern entrance,
 * historically joined to the station by a connecting passage.
 * The plan remains the already committed OSM way 43173495 and the station's
 * separate footprint filter remains untouched. The 7.35 m presentation
 * envelope is retained from the previous authored layer because neither
 * official text publishes a facade height; it remains visibly subordinate to
 * the station rather than silently claiming a surveyed dimension.
 */
export const TEAR_PALACE_PROFILE = Object.freeze({
  baseY: 2.85,
  envelopeHeightM: 7.35,
  footprintWorld: TEAR_PALACE_FOOTPRINT_WORLD,
  geometryStatus:
    "Exact projected OSM outline and existing authored low envelope; official steel-glass, aluminium-profile and flat-roof character; pane and mullion subdivision is procedural and non-surveyed",
  name: "Tränenpalast",
  osmWayId: "43173495",
  prismIds: TEAR_PALACE_PRISM_IDS,
  runtimeAssets: [] as const,
  sourceUrls: [
    "https://www.openstreetmap.org/way/43173495",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065041",
    "https://www.hdg.de/traenenpalast/organisation",
    "https://www.hdg.de/traenenpalast/ausstellung/",
  ] as const,
  texturePolicy:
    "No canvas, photograph, plan or runtime texture; panes and aluminium members are transparent procedural/instanced geometry",
});

export const PALACE_DETAIL_RENDER_BUDGETS = Object.freeze({
  full: Object.freeze({
    maxInstances: 17_600,
    maxRenderables: 9,
    maxRenderedVertices: 420_000,
    maxStoredVertices: 1_600,
  }),
  mobile: Object.freeze({
    maxInstances: 13_900,
    maxRenderables: 9,
    maxRenderedVertices: 335_000,
    maxStoredVertices: 1_300,
  }),
});

const TEAR_GLASS = 0x9fcbd1;
const ALUMINIUM = 0x8d9a9c;
const CERAMIC = 0xd8d7cf;
const Y_AXIS = new Vector3(0, 1, 0);

function addGeometry(
  builder: Builder,
  color: number,
  geometry: BufferGeometry,
  inked = true,
): void {
  geometry.deleteAttribute("uv");
  paintGeometry(geometry, color);
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function addExtrudedFootprint(
  builder: Builder,
  color: number,
  ring: readonly Point2[],
  y0: number,
  height: number,
  inked = true,
): void {
  const shape = new Shape();
  ring.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  const raw = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: height,
  });
  raw.rotateX(-Math.PI / 2);
  raw.translate(0, y0, 0);
  raw.deleteAttribute("uv");
  const geometry = mergeVertices(raw);
  raw.dispose();
  addGeometry(builder, color, geometry, inked);
}

function scaledRing(ring: readonly Point2[], scale: number): Point2[] {
  const centre = ring.reduce(
    (sum, [x, z]) => [sum[0] + x / ring.length, sum[1] + z / ring.length],
    [0, 0],
  );
  return ring.map(([x, z]) => [
    centre[0] + (x - centre[0]) * scale,
    centre[1] + (z - centre[1]) * scale,
  ]);
}

type BoxInstance = Readonly<{
  color?: number;
  position: Point3;
  rotationY?: number;
  scale: Point3;
}>;

function createInstancedBoxes(
  instances: readonly BoxInstance[],
  name: string,
  color: number,
  options: Readonly<{
    emissive?: number;
    metalness?: number;
    opacity?: number;
    roughness?: number;
  }> = {},
): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const transparent = (options.opacity ?? 1) < 1;
  const transparencyOptions = transparent
    ? { depthWrite: false, side: DoubleSide, transparent: true }
    : {};
  const dayMaterial = new MeshBasicMaterial({
    color,
    opacity: options.opacity ?? 1,
    ...transparencyOptions,
  });
  const nightMaterial = new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0,
    opacity: options.opacity ?? 1,
    roughness: options.roughness ?? 0.72,
    ...transparencyOptions,
  });
  if (options.emissive !== undefined) {
    nightMaterial.userData.nightEmissive = options.emissive;
    nightMaterial.userData.nightEmissiveIntensity = 0.92;
  }
  const mesh = new InstancedMesh(geometry, dayMaterial, instances.length);
  mesh.name = name;
  mesh.userData.dayMaterial = dayMaterial;
  mesh.userData.nightMaterial = nightMaterial;
  mesh.userData.textureFree = true;
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const matrix = new Matrix4();
  const shade = new Color();
  let hasInstanceColor = false;
  instances.forEach((instance, index) => {
    position.set(...instance.position);
    rotation.setFromAxisAngle(Y_AXIS, instance.rotationY ?? 0);
    scale.set(...instance.scale);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    if (instance.color !== undefined) {
      shade.setHex(instance.color);
      mesh.setColorAt(index, shade);
      hasInstanceColor = true;
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (hasInstanceColor && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function tearEdgeBoxes(
  ring: readonly Point2[],
  spacing: number,
  glassCentreY: number,
  glassHeight: number,
): { mullions: BoxInstance[]; panes: BoxInstance[] } {
  const mullions: BoxInstance[] = [];
  const panes: BoxInstance[] = [];
  const seenPosts = new Set<string>();
  ring.forEach(([x0, z0], edgeIndex) => {
    const [x1, z1] = ring[(edgeIndex + 1) % ring.length];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const segments = Math.max(1, Math.ceil(length / spacing));
    const rotationY = -Math.atan2(dz, dx);
    for (let segment = 0; segment < segments; segment += 1) {
      const t = (segment + 0.5) / segments;
      panes.push({
        position: [x0 + dx * t, glassCentreY, z0 + dz * t],
        rotationY,
        scale: [Math.max(0.42, length / segments - 0.16), glassHeight, 0.075],
      });
    }
    for (let segment = 0; segment <= segments; segment += 1) {
      const t = segment / segments;
      const x = x0 + dx * t;
      const z = z0 + dz * t;
      const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
      if (seenPosts.has(key)) continue;
      seenPosts.add(key);
      mullions.push({
        position: [x, glassCentreY, z],
        scale: [0.13, glassHeight + 0.12, 0.13],
      });
    }
  });
  return { mullions, panes };
}

function addTearPalaceStructure(
  builder: Builder,
  detailProfile: PalaceDetailProfile,
): void {
  const baseY = TEAR_PALACE_PROFILE.baseY;
  const roofY = baseY + TEAR_PALACE_PROFILE.envelopeHeightM;
  addExtrudedFootprint(
    builder,
    CERAMIC,
    TEAR_PALACE_FOOTPRINT_WORLD,
    baseY,
    0.34,
  );
  addExtrudedFootprint(
    builder,
    CERAMIC,
    scaledRing(TEAR_PALACE_FOOTPRINT_WORLD, 1.025),
    roofY - 0.24,
    0.32,
  );
  const transomFractions = detailProfile === "full" ? [0.34, 0.68] : [0.5];
  TEAR_PALACE_FOOTPRINT_WORLD.forEach(([x0, z0], edgeIndex) => {
    const [x1, z1] =
      TEAR_PALACE_FOOTPRINT_WORLD[
        (edgeIndex + 1) % TEAR_PALACE_FOOTPRINT_WORLD.length
      ];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const rotationY = -Math.atan2(dz, dx);
    for (const fraction of transomFractions) {
      addBox(
        builder,
        ALUMINIUM,
        (x0 + x1) / 2,
        baseY + 0.36 + (TEAR_PALACE_PROFILE.envelopeHeightM - 0.74) * fraction,
        (z0 + z1) / 2,
        length,
        0.11,
        0.13,
        rotationY,
        false,
      );
    }
    addBox(
      builder,
      ALUMINIUM,
      (x0 + x1) / 2,
      roofY - 0.35,
      (z0 + z1) / 2,
      length,
      0.42,
      0.16,
      rotationY,
      false,
    );
  });

  // The short solid strip marks the historically documented connection side
  // toward the station while leaving the hall itself transparently legible.
  const [connectorX, connectorZ] = [1054.8, -180.9];
  addBox(
    builder,
    CERAMIC,
    connectorX,
    baseY + 2.1,
    connectorZ,
    7.4,
    3.9,
    0.28,
    -0.62,
  );
}

export function createTearPalace(
  detailProfile: PalaceDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = TEAR_PALACE_ROOT_NAME;
  root.userData = {
    detailProfile,
    geometryStatus: TEAR_PALACE_PROFILE.geometryStatus,
    keepInMinecraft: true,
    objectProfile: TEAR_PALACE_PROFILE,
    osmWayId: TEAR_PALACE_PROFILE.osmWayId,
    prismIds: TEAR_PALACE_PROFILE.prismIds,
    runtimeAssets: TEAR_PALACE_PROFILE.runtimeAssets,
    sourceUrls: TEAR_PALACE_PROFILE.sourceUrls,
    sourceBound: true,
    textureFree: true,
  };
  const builder = createBuilder();
  addTearPalaceStructure(builder, detailProfile);
  const structure = finishDrawnGroup(builder, {
    name: "Tränenpalast flat roof and steel frame",
  });
  if (structure) root.add(structure);

  const baseY = TEAR_PALACE_PROFILE.baseY;
  const glassHeight = TEAR_PALACE_PROFILE.envelopeHeightM - 0.8;
  const glassCentreY = baseY + 0.38 + glassHeight / 2;
  const { mullions, panes } = tearEdgeBoxes(
    TEAR_PALACE_FOOTPRINT_WORLD,
    detailProfile === "full" ? 2.25 : 3.65,
    glassCentreY,
    glassHeight,
  );
  root.add(
    createInstancedBoxes(
      panes,
      TEAR_PALACE_GLASS_LAYER_NAME,
      TEAR_GLASS,
      { emissive: 0xaedee0, opacity: 0.36, roughness: 0.2 },
    ),
  );
  root.add(
    createInstancedBoxes(
      mullions,
      TEAR_PALACE_MULLION_LAYER_NAME,
      ALUMINIUM,
      { metalness: 0.68, roughness: 0.3 },
    ),
  );
  root.userData.paneCount = panes.length;
  root.userData.mullionCount = mullions.length;
  return root;
}

export function createFriedrichstadtAndTearPalaces(
  detailProfile: PalaceDetailProfile = "full",
): Group {
  const root = new Group();
  root.name = "Friedrichstadt-Palast and Tränenpalast recognition details";
  root.userData = {
    detailProfile,
    keepInMinecraft: true,
    performanceBudget: PALACE_DETAIL_RENDER_BUDGETS[detailProfile],
    runtimeAssets: [] as const,
    textureFree: true,
  };
  const minecraft = createMinecraftFriedrichstadtPalast(detailProfile);
  minecraft.visible = false;
  root.add(createFriedrichstadtPalast(detailProfile), createTearPalace(detailProfile), minecraft);
  return root;
}

export type PalaceRenderStats = {
  instanceCount: number;
  renderedVertices: number;
  renderables: number;
  storedVertices: number;
};

export function palaceRenderStats(
  root: Object3D<Object3DEventMap>,
): PalaceRenderStats {
  let instanceCount = 0;
  let renderedVertices = 0;
  let renderables = 0;
  let storedVertices = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof LineSegments)) return;
    const geometry = object.geometry as BufferGeometry;
    const vertices = geometry.getAttribute("position")?.count ?? 0;
    const instances = object instanceof InstancedMesh ? object.count : 1;
    renderables += 1;
    storedVertices += vertices;
    renderedVertices += vertices * instances;
    if (object instanceof InstancedMesh) instanceCount += object.count;
  });
  return { instanceCount, renderedVertices, renderables, storedVertices };
}

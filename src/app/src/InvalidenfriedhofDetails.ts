import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  DoubleSide,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from "three";

import {
  LITFIN_WATCHTOWER_PROFILE,
  createLitfinWatchtower,
  createMinecraftLitfinWatchtower,
  litfinWatchtowerSolidAt,
} from "./LitfinWatchtower";

import { NORTHERN_CITY_PROFILE } from "./expandedCityProfiles";

type Transform = {
  color?: number;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
};

type Segment = {
  end: readonly [number, number, number];
  start: readonly [number, number, number];
  thickness: number;
};

type WorldPoint2 = readonly [number, number];

const cemetery = NORTHERN_CITY_PROFILE.invalidenfriedhof;

/**
 * Source-bound contracts for the close Invalidenfriedhof reconstruction.
 *
 * OSM and Berlin LoD2 fix anchors, footprints and the two measured envelopes.
 * The supplied field photographs only bound unmeasured local articulation and
 * are never bundled, projected or converted into textures.
 */
export const INVALIDENFRIEDHOF_DETAIL_PROFILE = {
  coordinateFrame:
    "EPSG:25833; world_x=easting-389500; world_z=5820000-northing",
  geometryStatus:
    "OSM/LoD2 anchored procedural recognition geometry; uncited grave, railing, bell and facade subdivisions are field-view-bounded display estimates",
  modeContract:
    "Static exact-Day protected geometry in Day, Night, Snow and Schwellenraum; Minecraft uses separate block-native signatures for all five graves, both LoD2 structures and the historic walls",
  visualReferenceStatus:
    "Owner-supplied field photographs and attributed Wikimedia images are reference-only; no photograph, lettering, portrait or texture is redistributed",
  graves: {
    scharnhorst: {
      artists: {
        architecture: "Karl Friedrich Schinkel",
        bronzeCasting: "Königlich Preußische Eisengießerei Berlin",
        lionExecution: "Theodor Kalide",
        lionModel: "Christian Daniel Rauch",
        reliefs: "Friedrich Tieck",
      },
      centerWorldM: [38.597, 5.2, -1425.035] as const,
      conservationState:
        "the Schinkel portal identifies the present sarcophagus and relief frieze as conservation copies protecting the surviving originals",
      displayFootprintM: [5.8, 4.4] as const,
      focus: {
        azimuthDegrees: -28,
        distanceM: 18,
        fovDegrees: 39,
        markerY: 12,
        polarDegrees: 68,
        targetHeightM: 2.8,
        targetWorldM: [38.597, 5.2, -1425.035] as const,
      },
      id: "scharnhorst-lion-tomb",
      landmarkName: "Scharnhorst-Grabmal",
      publishedOverallHeightM: 5.6,
      materials: [
        "einheimischer Granit",
        "Carrara-Marmor",
        "Bronze",
        "schwarz gefasstes Eisen",
      ] as const,
      name: "Scharnhorst-Grabmal von Karl Friedrich Schinkel",
      osmKey: "node/273120316",
      recognitionCues: [
        "two-pier marble sarcophagus",
        "relief frieze",
        "green-patinated reclining bronze lion with raised head and forepaws",
        "black spearhead railing",
      ] as const,
      rotationY: -0.08,
      sourceUrls: [
        "https://www.openstreetmap.org/node/273120316",
        "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010206",
        "https://schinkel.smb.museum/image_orte.php?id=28",
        "https://digi.ub.uni-heidelberg.de/diglit/schinkel1858text/0013/text_ocr",
        "https://berlingeschichte.de/lexikon/mitte/i/invalidenfriedhof.htm",
      ] as const,
      sourcePointWorldM: cemetery.graveWorldM[7],
      texturePolicy:
        "linked source pages are reference-only; no image licence is relied on and procedural geometry carries no photograph, plan, lettering or texture",
    },
    witzleben: {
      centerWorldM: [30.23, 5.2, -1429.853] as const,
      displayFootprintM: [3.1, 3.1] as const,
      id: "witzleben-green-canopy-tomb",
      name: "Witzleben-Baldachingrab",
      osmKey: "node/279219447",
      recognitionCues: [
        "green patinated base",
        "four-column Renaissance round-arch cast-iron canopy",
        "female genius on a tall inscribed plinth",
        "four crowned Prussian eagles above the pediments",
      ] as const,
      sourcePointWorldM: cemetery.graveWorldM[10],
    },
    winterfeld: {
      centerWorldM: [15.239, 5.2, -1423.548] as const,
      displayFootprintM: [3.2, 2.5] as const,
      id: "hans-carl-von-winterfeld-pedestal",
      name: "Grabmal Hans Carl von Winterfeld",
      osmKey: "node/279219439",
      recognitionCues: [
        "brown granite rectangular pedestal",
        "portrait medallion with laurel wreath",
        "green bronze cuirass, drapery and trophy crown",
        "helmet with feather plume",
      ] as const,
      sourcePointWorldM: cemetery.graveWorldM[5],
    },
    vonKessel: {
      centerWorldM: [49.102, 5.2, -1453.619] as const,
      displayFootprintM: [3.8, 3.0] as const,
      id: "von-kessel-fenced-slab",
      name: "Grabstätte von Kessel",
      osmKey: "node/273120317",
      recognitionCues: [
        "low dark slab",
        "ivy bed",
        "small wrought railing",
      ] as const,
      sourcePointWorldM: cemetery.graveWorldM[24],
    },
    vonRauch: {
      absorbedGenericOsmKeys: ["node/281941700"] as const,
      absorbedGenericSourcePointsWorldM: [cemetery.graveWorldM[15]] as const,
      centerWorldM: [47.117806, 5.2, -1439.965711] as const,
      displayFootprintM: [4.6, 3.0] as const,
      id: "familie-von-rauch-yellow-arch",
      name: "Grabanlage Familie Friedrich Wilhelm von Rauch",
      osmKey: "node/281941696",
      recognitionCues: [
        "yellow arched aedicule",
        "white central cross",
        "low enclosure wall",
        "small crown figures",
      ] as const,
      nearbyGenericSourcePointWorldM: cemetery.graveWorldM[15],
      sourcePointWorldM: [47.117806, -1439.965711] as const,
    },
  },
  augusteViktoriaBell: {
    centerWorldM: [-14.703, 5.2, -1413.351] as const,
    displayBellDiameterM: 1.6,
    footprintM: [5.01, 5.0] as const,
    id: "auguste-viktoria-bell",
    lod2BuildingPartId: "K0001yqp",
    lod2BuildingPartFullId: "DEBE01YYK0001yqp",
    measuredHeightM: 10.044,
    name: "Auguste-Viktoria-Glocke",
    osmKey: "node/7430297888",
    osmNodeId: "7430297888",
    rotationY: 0.515,
    sourceUrl: "https://www.openstreetmap.org/node/7430297888",
    sourceUrls: [
      "https://www.openstreetmap.org/node/7430297888",
      "https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/augusta-viktoria-glocke",
      "https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af",
    ] as const,
  },
  litfinWatchtower: LITFIN_WATCHTOWER_PROFILE,
  walls: {
    canalBrickWallWorldM: cemetery.canalBrickWallWorldM,
    cemeteryOsmWayId: cemetery.cemeteryOsmWayId,
    // The current packaged continuous ground is 5.2 m here. The legacy 5.65 m
    // expanded-city batch predates that terrain correction and must not lift
    // these new source-bound overlays above the cemetery surface.
    groundY: 5.2,
    hinterlandWallOsmWayIds: cemetery.hinterlandWallOsmWayIds,
    hinterlandWallSegmentsWorldM: cemetery.hinterlandWallSegmentsWorldM,
    sourceUrls: cemetery.sources,
  },
  renderingStrategy:
    "texture-free instanced repeated parts with separately named near-camera fine-detail groups",
} as const;

const COLORS = {
  bronze: 0x365c55,
  bronzeDark: 0x243f3b,
  castSteel: 0x4a504e,
  concrete: 0x99978f,
  concreteDark: 0x77766f,
  glass: 0x33464a,
  green: 0x436f63,
  greenDark: 0x294c45,
  granite: 0x9b9386,
  ivy: 0x436c3f,
  lionPatina: 0x6b9f91,
  lionPatinaDark: 0x58877b,
  lionPatinaShadow: 0x294b45,
  marble: 0xd7d1c4,
  marbleDark: 0xb2aa9d,
  paintWhite: 0xdadbd6,
  rail: 0x272d2d,
  sandstone: 0xc9a765,
  sandstoneDark: 0xa98853,
  snow: 0xe8eef0,
  soil: 0x584b3b,
  wallBrick: 0x8c4d3c,
  wallBrickDark: 0x6f3b31,
  wallGrey: 0x96968f,
} as const;

function material(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    roughness: options.roughness ?? 0.82,
  });
}

function addMesh<T extends BufferGeometry, M extends Material>(
  parent: Group,
  name: string,
  geometry: T,
  meshMaterial: M,
  position: readonly [number, number, number] = [0, 0, 0],
): Mesh<T, M> {
  geometry.deleteAttribute("uv");
  const mesh = new Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addInstances(
  parent: Group,
  name: string,
  geometry: BufferGeometry,
  meshMaterial: Material,
  transforms: readonly Transform[],
): InstancedMesh {
  geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(geometry, meshMaterial, transforms.length);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  for (let index = 0; index < transforms.length; index += 1) {
    const transform = transforms[index];
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (transform.color !== undefined) {
      mesh.setColorAt(index, new Color(transform.color));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function addSegmentInstances(
  parent: Group,
  name: string,
  segments: readonly Segment[],
  meshMaterial: Material,
): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(geometry, meshMaterial, segments.length);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  const up = new Vector3(0, 1, 0);
  const start = new Vector3();
  const end = new Vector3();
  const delta = new Vector3();
  const quaternion = new Quaternion();
  segments.forEach((segment, index) => {
    start.set(...segment.start);
    end.set(...segment.end);
    delta.copy(end).sub(start);
    quaternion.setFromUnitVectors(up, delta.clone().normalize());
    dummy.position.copy(start).add(end).multiplyScalar(0.5);
    dummy.quaternion.copy(quaternion);
    dummy.scale.set(segment.thickness, delta.length(), segment.thickness);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}

function markProtected(group: Group, sourceKeys: readonly string[]): void {
  group.userData.schwellenraumGeschuetzt = true;
  group.userData.motionPolicy = "static in every visual mode";
  group.userData.presentationContract =
    "Exact ordinary Day material, ink and transform in Schwellenraum";
  group.userData.sourceKeys = [...sourceKeys];
}

function perimeterPosts(
  halfX: number,
  halfZ: number,
  spacing: number,
  height: number,
): Transform[] {
  const transforms: Transform[] = [];
  const xCount = Math.max(2, Math.round((halfX * 2) / spacing));
  const zCount = Math.max(2, Math.round((halfZ * 2) / spacing));
  for (let index = 0; index <= xCount; index += 1) {
    const x = -halfX + (index / xCount) * halfX * 2;
    transforms.push({ position: [x, height / 2, -halfZ] });
    transforms.push({ position: [x, height / 2, halfZ] });
  }
  for (let index = 1; index < zCount; index += 1) {
    const z = -halfZ + (index / zCount) * halfZ * 2;
    transforms.push({ position: [-halfX, height / 2, z] });
    transforms.push({ position: [halfX, height / 2, z] });
  }
  return transforms;
}

function addRectangularFence(
  parent: Group,
  prefix: string,
  halfX: number,
  halfZ: number,
  height: number,
): void {
  const railMaterial = material(COLORS.rail, {
    metalness: 0.5,
    roughness: 0.58,
  });
  const posts = perimeterPosts(halfX, halfZ, 0.44, height);
  addInstances(
    parent,
    `${prefix} railing uprights`,
    new CylinderGeometry(0.026, 0.032, height, 6),
    railMaterial,
    posts,
  );
  addInstances(
    parent,
    `${prefix} spearhead finials`,
    new CylinderGeometry(0, 0.065, 0.16, 4),
    railMaterial,
    posts.map((post) => ({
      position: [post.position[0], height + 0.08, post.position[2]],
    })),
  );
  addInstances(
    parent,
    `${prefix} horizontal rails`,
    new BoxGeometry(1, 1, 1),
    railMaterial,
    [
      { position: [0, 0.18, -halfZ], scale: [halfX * 2, 0.045, 0.05] },
      { position: [0, 0.18, halfZ], scale: [halfX * 2, 0.045, 0.05] },
      { position: [-halfX, 0.18, 0], scale: [0.05, 0.045, halfZ * 2] },
      { position: [halfX, 0.18, 0], scale: [0.05, 0.045, halfZ * 2] },
      { position: [0, height * 0.72, -halfZ], scale: [halfX * 2, 0.045, 0.05] },
      { position: [0, height * 0.72, halfZ], scale: [halfX * 2, 0.045, 0.05] },
      { position: [-halfX, height * 0.72, 0], scale: [0.05, 0.045, halfZ * 2] },
      { position: [halfX, height * 0.72, 0], scale: [0.05, 0.045, halfZ * 2] },
    ],
  );
}

function addScharnhorstFence(parent: Group): void {
  const halfX = 2.8;
  const halfZ = 2.1;
  const height = 1.14;
  const railMaterial = material(COLORS.rail, {
    metalness: 0.5,
    roughness: 0.58,
  });
  const posts = perimeterPosts(halfX, halfZ, 0.44, height);
  const bars = addInstances(
    parent,
    "Scharnhorst Schinkel railing uprights and horizontal courses",
    new BoxGeometry(1, 1, 1),
    railMaterial,
    [
      ...posts.map((post) => ({
        position: post.position,
        scale: [0.045, height, 0.045] as const,
      })),
      ...([0.2, 0.84] as const).flatMap((railY) => [
        {
          position: [0, railY, -halfZ] as const,
          scale: [halfX * 2, 0.045, 0.05] as const,
        },
        {
          position: [0, railY, halfZ] as const,
          scale: [halfX * 2, 0.045, 0.05] as const,
        },
        {
          position: [-halfX, railY, 0] as const,
          scale: [0.05, 0.045, halfZ * 2] as const,
        },
        {
          position: [halfX, railY, 0] as const,
          scale: [0.05, 0.045, halfZ * 2] as const,
        },
      ]),
    ],
  );
  bars.userData.uprightCount = posts.length;
  bars.userData.horizontalCourseCount = 2;
  addInstances(
    parent,
    "Scharnhorst black spearhead finials",
    new CylinderGeometry(0, 0.066, 0.2, 4),
    railMaterial,
    posts.map((post) => ({
      position: [post.position[0], height + 0.1, post.position[2]],
    })),
  );

  // Schinkel's surviving/reconstructed enclosure has the characteristic row
  // of open iron circles between the rails, not a generic picket-only fence.
  const circles: Transform[] = [];
  const xIntervals = Math.round((halfX * 2) / 0.44);
  for (let index = 0; index < xIntervals; index += 1) {
    const x = -halfX + ((index + 0.5) / xIntervals) * halfX * 2;
    circles.push(
      { position: [x, 0.55, -halfZ] },
      { position: [x, 0.55, halfZ] },
    );
  }
  const zIntervals = Math.round((halfZ * 2) / 0.44);
  for (let index = 0; index < zIntervals; index += 1) {
    const z = -halfZ + ((index + 0.5) / zIntervals) * halfZ * 2;
    circles.push(
      { position: [-halfX, 0.55, z], rotation: [0, Math.PI / 2, 0] },
      { position: [halfX, 0.55, z], rotation: [0, Math.PI / 2, 0] },
    );
  }
  const circleMesh = addInstances(
    parent,
    "Scharnhorst Schinkel railing circular ornaments",
    new TorusGeometry(0.105, 0.018, 4, 10),
    railMaterial,
    circles,
  );
  circleMesh.userData.circularOrnamentCount = circles.length;
}

function addScharnhorstTomb(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.scharnhorst;
  const grave = new Group();
  grave.name = "Invalidenfriedhof Scharnhorst lion tomb exact Day protected";
  grave.position.set(...profile.centerWorldM);
  grave.rotation.y = profile.rotationY;
  markProtected(grave, [profile.osmKey]);

  const stoneMaterial = material(COLORS.marble);
  const stone = addInstances(
    grave,
    "Scharnhorst two-pier marble sarcophagus",
    new BoxGeometry(1, 1, 1),
    stoneMaterial,
    [
      {
        color: COLORS.granite,
        position: [0, 0.1, 0],
        scale: [4.55, 0.2, 3.25],
      },
      {
        color: COLORS.granite,
        position: [0, 0.29, 0],
        scale: [4.18, 0.18, 2.9],
      },
      ...([-1.12, 1.12] as const).flatMap((pierX) => [
        {
          color: COLORS.granite,
          position: [pierX, 0.55, 0] as const,
          scale: [1.08, 0.34, 2.04] as const,
        },
        {
          color: COLORS.marble,
          position: [pierX, 1.55, 0] as const,
          scale: [0.9, 2, 1.84] as const,
        },
        {
          color: COLORS.marbleDark,
          position: [pierX, 2.66, 0] as const,
          scale: [1.12, 0.22, 2.06] as const,
        },
      ]),
      {
        color: COLORS.marble,
        position: [0, 2.88, 0],
        scale: [3.84, 0.22, 2.26],
      },
      {
        color: COLORS.marbleDark,
        position: [0, 3.37, 0],
        scale: [3.48, 0.76, 1.94],
      },
      {
        color: COLORS.marble,
        position: [0, 3.87, 0],
        scale: [3.7, 0.24, 2.1],
      },
      {
        color: COLORS.marble,
        position: [0, 4.02, 0],
        scale: [3.88, 0.12, 2.22],
      },
      {
        color: COLORS.lionPatinaDark,
        position: [0, 4.15, 0],
        scale: [3.5, 0.14, 1.38],
      },
    ],
  );
  stone.userData.materialSequence = ["einheimischer Granit", "Carrara-Marmor"];
  stone.userData.lionPlinthFinish = "weathered green bronze";

  const fine = new Group();
  fine.name = "Invalidenfriedhof Scharnhorst lion tomb fine detail";
  fine.userData.detailFadeM = [62, 155];
  const reliefTransforms: Transform[] = [];
  for (const sideZ of [-1, 1] as const) {
    for (let index = 0; index < 9; index += 1) {
      const figureX = -1.42 + index * 0.355;
      const figureY = 3.36 + (index % 2) * 0.035;
      reliefTransforms.push(
        {
          position: [figureX, figureY + 0.23, sideZ * 0.982],
          scale: [0.075, 0.09, 0.028],
        },
        {
          position: [figureX, figureY, sideZ * 0.984],
          rotation: [0, 0, ((index % 3) - 1) * 0.12],
          scale: [0.105, 0.2 + (index % 2) * 0.025, 0.032],
        },
        {
          position: [figureX - 0.065, figureY - 0.2, sideZ * 0.984],
          rotation: [0, 0, -0.2],
          scale: [0.04, 0.17, 0.025],
        },
        {
          position: [figureX + 0.065, figureY - 0.2, sideZ * 0.984],
          rotation: [0, 0, 0.2],
          scale: [0.04, 0.17, 0.025],
        },
      );
    }
  }
  for (const sideX of [-1, 1] as const) {
    for (let index = 0; index < 4; index += 1) {
      const figureZ = -0.62 + index * 0.415;
      reliefTransforms.push(
        {
          position: [sideX * 1.752, 3.59, figureZ],
          scale: [0.028, 0.09, 0.075],
        },
        {
          position: [sideX * 1.754, 3.36, figureZ],
          rotation: [0.14 * sideX, 0, 0],
          scale: [0.032, 0.2, 0.105],
        },
        {
          position: [sideX * 1.754, 3.16, figureZ - 0.06],
          rotation: [-0.2, 0, 0],
          scale: [0.025, 0.17, 0.04],
        },
        {
          position: [sideX * 1.754, 3.16, figureZ + 0.06],
          rotation: [0.2, 0, 0],
          scale: [0.025, 0.17, 0.04],
        },
      );
    }
  }
  const reliefs = addInstances(
    fine,
    "Scharnhorst marble relief frieze figures",
    new SphereGeometry(1, 8, 6),
    material(COLORS.marbleDark),
    reliefTransforms,
  );
  reliefs.userData.reliefFigureCount = 26;

  const lionMaterial = material(COLORS.lionPatina, {
    metalness: 0.25,
    roughness: 0.72,
  });
  const lionVolumes: Transform[] = [
    { position: [0.25, 4.66, 0], scale: [1.2, 0.38, 0.52] },
    { position: [1.2, 4.7, 0], scale: [0.62, 0.48, 0.56] },
    { position: [-0.58, 4.72, 0], scale: [0.56, 0.5, 0.5] },
    { position: [-0.88, 4.91, 0], scale: [0.43, 0.48, 0.44] },
    { position: [-1.19, 5.12, 0], scale: [0.4, 0.39, 0.4] },
    { position: [-1.54, 5.02, -0.14], scale: [0.34, 0.23, 0.21] },
    { position: [-1.54, 5.02, 0.14], scale: [0.34, 0.23, 0.21] },
    { position: [-1.48, 4.87, 0], scale: [0.27, 0.13, 0.24] },
    {
      position: [-1.29, 4.4, -0.29],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.14, 0.6, 0.15],
    },
    {
      position: [-1.29, 4.4, 0.29],
      rotation: [0, 0, Math.PI / 2],
      scale: [0.14, 0.6, 0.15],
    },
    { position: [-1.76, 4.37, -0.29], scale: [0.28, 0.14, 0.19] },
    { position: [-1.76, 4.37, 0.29], scale: [0.28, 0.14, 0.19] },
    { position: [1.02, 4.39, -0.32], scale: [0.46, 0.14, 0.17] },
    { position: [1.02, 4.39, 0.32], scale: [0.46, 0.14, 0.17] },
    { position: [1.38, 4.39, -0.32], scale: [0.23, 0.13, 0.18] },
    { position: [1.38, 4.39, 0.32], scale: [0.23, 0.13, 0.18] },
    {
      position: [1.53, 4.86, 0.24],
      rotation: [0, 0, 0.42],
      scale: [0.3, 0.13, 0.16],
    },
    {
      position: [1.7, 5.01, 0.08],
      rotation: [0, 0, 0.82],
      scale: [0.21, 0.11, 0.15],
    },
    { position: [1.67, 5.14, -0.08], scale: [0.13, 0.12, 0.15] },
  ];
  const lion = addInstances(
    grave,
    "Scharnhorst reclining bronze lion body head and paws",
    new SphereGeometry(1, 16, 10),
    lionMaterial,
    lionVolumes,
  );
  lion.userData.pose =
    "reclining lion aligned with the sarcophagus, raised monumental head and paired forepaws at one short end";
  lion.userData.finish = "light green weathered bronze patina";
  const mane = addMesh(
    grave,
    "Scharnhorst bronze lion mane",
    new IcosahedronGeometry(1, 1),
    material(COLORS.lionPatinaDark, { metalness: 0.3, roughness: 0.75 }),
    [-1.03, 5.04, 0],
  );
  mane.scale.set(0.58, 0.56, 0.54);

  const ears = addInstances(
    grave,
    "Scharnhorst green-patina lion pointed ears",
    new CylinderGeometry(0, 0.15, 0.28, 5),
    lionMaterial,
    [
      {
        position: [-1.24, 5.44, -0.27],
        rotation: [-0.08, 0, -0.15],
        scale: [1, 0.92, 0.82],
      },
      {
        position: [-1.24, 5.44, 0.27],
        rotation: [0.08, 0, -0.15],
        scale: [1, 0.92, 0.82],
      },
    ],
  );
  ears.userData.anatomy = "paired pointed ears above the mane";

  const lionDetails: Transform[] = [
    { position: [-1.84, 5.04, 0], scale: [0.1, 0.105, 0.15] },
    { position: [-1.42, 5.17, -0.365], scale: [0.045, 0.04, 0.022] },
    { position: [-1.42, 5.17, 0.365], scale: [0.045, 0.04, 0.022] },
    { position: [-1.64, 4.91, -0.22], scale: [0.12, 0.025, 0.018] },
    { position: [-1.64, 4.91, 0.22], scale: [0.12, 0.025, 0.018] },
  ];
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    lionDetails.push({
      position: [-1.02, 5.04 + Math.sin(angle) * 0.39, Math.cos(angle) * 0.4],
      rotation: [angle, 0, 0],
      scale: [0.1, 0.115, 0.13],
    });
  }
  for (const pawZ of [-0.29, 0.29] as const) {
    for (let claw = -1; claw <= 1; claw += 1) {
      lionDetails.push({
        position: [-1.94, 4.38, pawZ + claw * 0.06],
        scale: [0.08, 0.035, 0.02],
      });
    }
  }
  const detailMesh = addInstances(
    fine,
    "Scharnhorst bronze lion mane tufts face and claw detail",
    new SphereGeometry(1, 8, 6),
    material(COLORS.lionPatinaShadow, {
      metalness: 0.32,
      roughness: 0.68,
    }),
    lionDetails,
  );
  detailMesh.userData.detailCount = lionDetails.length;
  grave.add(fine);
  addScharnhorstFence(grave);
  grave.userData.profile = profile;
  grave.userData.detailCounts = {
    circularFenceOrnaments: 46,
    lionEarVolumes: ears.count,
    lionFineDetailVolumes: lionDetails.length,
    lionStructuralVolumes: lionVolumes.length,
    reliefFigures: 26,
    totalHeightM: profile.publishedOverallHeightM,
  };
  parent.add(grave);
}

function addWitzlebenCanopy(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.witzleben;
  const grave = new Group();
  grave.name = "Invalidenfriedhof Witzleben canopy exact Day protected";
  grave.position.set(...profile.centerWorldM);
  grave.rotation.y = 0.04;
  markProtected(grave, [profile.osmKey]);
  grave.userData.architecture =
    "Renaissance round arches, high cast-iron plinth, four crowned eagles; not Gothic";
  const green = material(0x698b7a, { metalness: 0.42, roughness: 0.63 });
  const columns: Transform[] = [];
  for (const x of [-0.83, 0.83])
    for (const z of [-0.83, 0.83]) {
      columns.push({ position: [x, 3.12, z], scale: [0.14, 2.18, 0.14] });
      for (const y of [2.05, 2.2, 2.9, 3.76, 3.92])
        columns.push({ position: [x, y, z], scale: [0.23, 0.075, 0.23] });
    }
  addInstances(
    grave,
    "Witzleben green patinated base and Renaissance columns",
    new BoxGeometry(1, 1, 1),
    green,
    [
      { position: [0, 0.1, 0], scale: [2.7, 0.2, 2.7] },
      { position: [0, 0.38, 0], scale: [2.25, 0.56, 2.25] },
      { position: [0, 1.23, 0], scale: [1.96, 1.3, 1.96] },
      { position: [0, 1.92, 0], scale: [2.26, 0.14, 2.26] },
      { position: [0, 2.04, 0], scale: [2.4, 0.1, 2.4] },
      { position: [0, 2.25, 0], scale: [0.65, 0.32, 0.65] },
      ...columns,
    ],
  );
  const archTransforms: Transform[] = [];
  for (const sign of [-1, 1]) {
    archTransforms.push({ position: [0, 3.92, sign * 0.83] });
    archTransforms.push({
      position: [sign * 0.83, 3.92, 0],
      rotation: [0, Math.PI / 2, 0],
    });
  }
  addInstances(
    grave,
    "Witzleben four Renaissance semicircular canopy arches",
    new TorusGeometry(0.83, 0.095, 6, 18, Math.PI),
    green,
    archTransforms,
  );
  const roof: Segment[] = [];
  for (const sign of [-1, 1]) {
    roof.push(
      {
        start: [-0.94, 4.64, sign * 0.83],
        end: [0, 5.0, sign * 0.83],
        thickness: 0.14,
      },
      {
        start: [0, 5.0, sign * 0.83],
        end: [0.94, 4.64, sign * 0.83],
        thickness: 0.14,
      },
    );
    roof.push(
      {
        start: [sign * 0.83, 4.64, -0.94],
        end: [sign * 0.83, 5.0, 0],
        thickness: 0.14,
      },
      {
        start: [sign * 0.83, 5.0, 0],
        end: [sign * 0.83, 4.64, 0.94],
        thickness: 0.14,
      },
    );
  }
  addSegmentInstances(
    grave,
    "Witzleben open pediment canopy crown",
    roof,
    green,
  );
  const figures: Transform[] = [
    { position: [0, 2.91, 0], scale: [0.26, 0.59, 0.2] },
    { position: [0, 3.46, 0], scale: [0.19, 0.28, 0.16] },
    { position: [0, 3.81, 0], scale: [0.14, 0.19, 0.14] },
    {
      position: [-0.21, 3.43, 0],
      rotation: [0, 0, -0.35],
      scale: [0.085, 0.28, 0.08],
    },
    {
      position: [0.22, 3.42, 0.09],
      rotation: [0, 0, 0.6],
      scale: [0.08, 0.3, 0.09],
    },
  ];
  // Four outward-facing birds, centred above the four pediments, not a spike.
  for (let side = 0; side < 4; side++) {
    const angle = (side * Math.PI) / 2,
      co = Math.cos(angle),
      si = Math.sin(angle);
    const place = (
      x: number,
      y: number,
      z: number,
      scale: readonly [number, number, number],
      tilt = 0,
    ): Transform => ({
      position: [x * co + z * si, y, -x * si + z * co],
      rotation: [0, angle, tilt],
      scale,
    });
    figures.push(
      place(0, 5.24, 0.83, [0.13, 0.22, 0.11]),
      place(0, 5.48, 0.83, [0.09, 0.13, 0.09]),
      place(-0.23, 5.35, 0.83, [0.12, 0.33, 0.06], -0.5),
      place(0.23, 5.35, 0.83, [0.12, 0.33, 0.06], 0.5),
    );
  }
  addInstances(
    grave,
    "Witzleben female genius and four crowned eagle silhouettes",
    new IcosahedronGeometry(1, 1),
    green,
    figures,
  );
  const fine = new Group();
  fine.name = "Invalidenfriedhof Witzleben canopy fine detail";
  fine.userData.detailFadeM = [60, 150];
  const rings: Transform[] = [];
  for (const t of archTransforms)
    for (const x of [-0.52, 0.52])
      rings.push({
        position: [
          t.position[0] + (t.rotation ? 0 : x),
          4.53,
          t.position[2] + (t.rotation ? x : 0),
        ],
        rotation: t.rotation,
        scale: [0.16, 0.16, 0.16],
      });
  addInstances(
    fine,
    "Witzleben pierced cast-iron scrollwork",
    new TorusGeometry(1, 0.18, 5, 12, Math.PI * 1.65),
    green,
    rings,
  );
  const ornaments: Transform[] = [];
  for (const x of [-0.83, 0.83])
    for (const z of [-0.83, 0.83])
      ornaments.push({ position: [x, 4.88, z], scale: [0.09, 0.32, 0.09] });
  for (const side of [-1, 1])
    for (let k = 0; k < 9; k++)
      ornaments.push({
        position: [(k - 4) * 0.18, 1.23, side * 0.99],
        scale: [0.05, 0.04, 0.025],
      });
  addInstances(
    fine,
    "Witzleben corner pinnacles and plinth relief marks",
    new BoxGeometry(1, 1, 1),
    green,
    ornaments,
  );
  grave.add(fine);
  parent.add(grave);
}

function addWinterfeldPedestal(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.winterfeld;
  const grave = new Group();
  grave.name = "Invalidenfriedhof Winterfeld pedestal exact Day protected";
  grave.position.set(...profile.centerWorldM);
  grave.rotation.y = -0.06;
  markProtected(grave, [profile.osmKey]);
  addInstances(
    grave,
    "Winterfeld light pedestal and trophy crown",
    new BoxGeometry(1, 1, 1),
    material(0x8d8274),
    [
      { position: [0, 0.11, 0], scale: [2.8, 0.22, 2.1] },
      { position: [0, 0.34, 0], scale: [2.35, 0.24, 1.75] },
      { position: [0, 1.63, 0], scale: [1.82, 2.34, 1.36] },
      { position: [0, 2.91, 0], scale: [2.04, 0.22, 1.55] },
      {
        position: [-0.5, 3.19, 0],
        rotation: [0, 0, -0.18],
        scale: [1.15, 0.3, 1.18],
      },
      {
        position: [0.5, 3.19, 0],
        rotation: [0, 0, 0.18],
        scale: [1.15, 0.3, 1.18],
      },
    ],
  );
  const fine = new Group();
  fine.name = "Invalidenfriedhof Winterfeld portrait and helmet fine detail";
  fine.userData.detailFadeM = [55, 140];
  addMesh(
    fine,
    "Winterfeld laurel portrait medallion",
    new TorusGeometry(0.43, 0.1, 6, 20),
    material(COLORS.bronzeDark),
    [0, 1.72, 0.705],
  );
  addMesh(
    fine,
    "Winterfeld unlettered portrait relief",
    new SphereGeometry(1, 10, 7),
    material(COLORS.concreteDark),
    [0, 1.72, 0.73],
  ).scale.set(0.25, 0.34, 0.05);
  addInstances(
    grave,
    "Winterfeld helmet and feather plume blocks",
    new IcosahedronGeometry(1, 1),
    material(COLORS.bronzeDark),
    [
      { position: [0, 3.64, 0], scale: [0.48, 0.64, 0.35] },
      {
        position: [-0.48, 3.54, 0],
        rotation: [0, 0, -0.4],
        scale: [0.24, 0.67, 0.3],
      },
      {
        position: [0.48, 3.5, 0],
        rotation: [0, 0, 0.4],
        scale: [0.24, 0.62, 0.3],
      },
      { position: [0.12, 3.95, 0], scale: [0.22, 0.5, 0.2] },
      {
        position: [0.25, 4.34, 0],
        rotation: [0, 0, -0.25],
        scale: [0.18, 0.48, 0.16],
      },
      {
        position: [0.42, 4.69, 0],
        rotation: [0, 0, -0.4],
        scale: [0.14, 0.4, 0.13],
      },
    ],
  );
  fine.userData.letteringPolicy = "no photographed inscription reproduced";
  // The source record specifies the same Schinkel enclosure family as Scharnhorst.
  addRectangularFence(fine, "Winterfeld Schinkel", 1.7, 1.45, 1.2);
  grave.add(fine);
  parent.add(grave);
}

function addVonKesselGrave(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.vonKessel;
  const grave = new Group();
  grave.name = "Invalidenfriedhof von Kessel grave exact Day protected";
  grave.position.set(...profile.centerWorldM);
  grave.rotation.y = -0.12;
  markProtected(grave, [profile.osmKey]);
  addInstances(
    grave,
    "von Kessel ivy bed and dark memorial slab",
    new BoxGeometry(1, 1, 1),
    material(COLORS.ivy),
    [
      { position: [0, 0.09, 0], scale: [3.15, 0.18, 2.35] },
      {
        position: [0, 0.28, -0.12],
        rotation: [-0.09, 0, 0],
        scale: [2.05, 0.18, 1.1],
        color: COLORS.concreteDark,
      },
      { position: [0, 0.62, 0.87], scale: [1.55, 0.82, 0.18] },
    ],
  );
  const fine = new Group();
  fine.name = "Invalidenfriedhof von Kessel fenced slab fine detail";
  fine.userData.detailFadeM = [45, 120];
  addRectangularFence(fine, "von Kessel low wrought", 1.75, 1.35, 0.62);
  grave.add(fine);
  parent.add(grave);
}

function addVonRauchGrave(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves.vonRauch;
  const grave = new Group();
  grave.name = "Invalidenfriedhof Familie von Rauch grave exact Day protected";
  grave.position.set(...profile.centerWorldM);
  grave.rotation.y = 0.16;
  markProtected(grave, [profile.osmKey, ...profile.absorbedGenericOsmKeys]);
  const yellow = material(COLORS.sandstone);
  addInstances(
    grave,
    "Familie von Rauch yellow aedicule walls and piers",
    new BoxGeometry(1, 1, 1),
    yellow,
    [
      { position: [0, 0.12, 0], scale: [4.1, 0.24, 2.55] },
      { position: [0, 0.82, 1.08], scale: [4.1, 1.42, 0.23] },
      { position: [-1.62, 2.15, 1.08], scale: [0.34, 2.68, 0.34] },
      { position: [1.62, 2.15, 1.08], scale: [0.34, 2.68, 0.34] },
      { position: [-0.62, 2.2, 1.08], scale: [0.27, 2.5, 0.27] },
      { position: [0.62, 2.2, 1.08], scale: [0.27, 2.5, 0.27] },
    ],
  );
  addMesh(
    grave,
    "Familie von Rauch yellow arch",
    new TorusGeometry(0.62, 0.14, 6, 22, Math.PI),
    yellow,
    [0, 3.42, 1.08],
  );
  const fine = new Group();
  fine.name = "Invalidenfriedhof Familie von Rauch arch fine detail";
  fine.userData.detailFadeM = [55, 135];
  addInstances(
    grave,
    "Familie von Rauch white memorial cross",
    new BoxGeometry(1, 1, 1),
    material(COLORS.marble),
    [
      { position: [0, 1.75, 0.9], scale: [0.18, 2.2, 0.18] },
      { position: [0, 2.05, 0.9], scale: [1.1, 0.18, 0.18] },
    ],
  );
  addInstances(
    fine,
    "Familie von Rauch small crown figures",
    new IcosahedronGeometry(1, 1),
    material(COLORS.sandstoneDark),
    [
      { position: [-1.48, 3.68, 1.08], scale: [0.22, 0.28, 0.2] },
      { position: [1.48, 3.68, 1.08], scale: [0.22, 0.28, 0.2] },
    ],
  );
  const familyCrosses: Transform[] = [];
  for (const x of [-1.3, 1.3]) {
    familyCrosses.push(
      { position: [x, 0.41, -0.45], scale: [0.58, 0.58, 0.52] },
      { position: [x, 1.48, -0.45], scale: [0.13, 1.55, 0.13] },
      { position: [x, 1.82, -0.45], scale: [0.82, 0.13, 0.13] },
    );
  }
  addInstances(
    grave,
    "Familie von Rauch neighbouring marble crosses",
    new BoxGeometry(1, 1, 1),
    material(COLORS.marble),
    familyCrosses,
  );
  addSegmentInstances(
    grave,
    "Familie von Rauch pediment and side coping",
    [
      { start: [-0.94, 3.96, 1.08], end: [0, 4.28, 1.08], thickness: 0.13 },
      { start: [0, 4.28, 1.08], end: [0.94, 3.96, 1.08], thickness: 0.13 },
    ],
    yellow,
  );
  grave.add(fine);
  parent.add(grave);
}

function bellHalfWidth(y: number): number {
  return 2.05 - (Math.max(0, Math.min(10.044, y)) / 10.044) * 0.64;
}

function addAugusteViktoriaBell(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
  const tower = new Group();
  tower.name =
    "Invalidenfriedhof Auguste-Viktoria bell tower exact Day protected";
  tower.position.set(...profile.centerWorldM);
  tower.rotation.y = profile.rotationY;
  markProtected(tower, [
    profile.osmKey,
    `LoD2/${profile.lod2BuildingPartFullId}`,
  ]);
  tower.userData.panelContract =
    "square tapered galvanised frame with three folded-sheet tiers, twelve panels; no diamond concrete shaft";
  const steel = material(0xaebbc0, { metalness: 0.65, roughness: 0.42 });
  const legs: Segment[] = [];
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      legs.push({
        start: [x * 2.05, 0.08, z * 2.05],
        end: [x * bellHalfWidth(10.044), 10.044, z * bellHalfWidth(10.044)],
        thickness: 0.17,
      });
  addSegmentInstances(
    tower,
    "Auguste-Viktoria bell open steel legs",
    legs,
    steel,
  );
  const rails: Transform[] = [];
  for (const y of [3.0, 4.65, 6.42, 8.19, 9.99]) {
    const h = bellHalfWidth(y);
    for (const sign of [-1, 1])
      rails.push(
        { position: [0, y, sign * h], scale: [h * 2, 0.1, 0.1] },
        { position: [sign * h, y, 0], scale: [0.1, 0.1, h * 2] },
      );
  }
  for (const x of [-1, 1])
    for (const z of [-1, 1])
      rails.push({
        position: [x * 2.05, 0.08, z * 2.05],
        scale: [0.55, 0.16, 0.55],
      });
  addInstances(
    tower,
    "Auguste-Viktoria bell lower frame rails",
    new BoxGeometry(1, 1, 1),
    steel,
    rails,
  );
  const braces: Segment[] = [];
  for (const side of [-1, 1])
    for (const x of [-1, 1])
      braces.push({
        start: [x * 1.73, 3.0, side * bellHalfWidth(3)],
        end: [x * 0.36, 4.56, side * bellHalfWidth(4.56)],
        thickness: 0.12,
      });
  addSegmentInstances(
    tower,
    "Auguste-Viktoria bell trapezoidal suspension braces",
    braces,
    steel,
  );
  // Twelve shallow folded quadrilateral sheets; the central fold is geometric.
  const vertices: number[] = [];
  const colors: number[] = [];
  for (let side = 0; side < 4; side++)
    for (let tier = 0; tier < 3; tier++) {
      const y0 = 4.76 + tier * 1.77,
        y1 = Math.min(9.94, y0 + 1.64),
        h0 = bellHalfWidth(y0) - 0.08,
        h1 = bellHalfWidth(y1) - 0.08;
      const rotate = (x: number, y: number, z: number): number[] => {
        const co = Math.cos((side * Math.PI) / 2),
          si = Math.sin((side * Math.PI) / 2);
        return [x * co + z * si, y, -x * si + z * co];
      };
      const q = [
        rotate(-h0, y0, h0),
        rotate(h0, y0, h0),
        rotate(h1, y1, h1),
        rotate(-h1, y1, h1),
      ];
      const mid = rotate(0, (y0 + y1) / 2, (h0 + h1) / 2 + 0.055);
      for (let face = 0; face < 4; face++) {
        vertices.push(...q[face], ...q[(face + 1) % 4], ...mid);
        const color = new Color([0x7c949f, 0x91a8b2, 0xa2b6bc, 0x879ea8][face]);
        for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
      }
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  addMesh(
    tower,
    "Auguste-Viktoria twelve folded silver sheet panels",
    geometry,
    new MeshStandardMaterial({
      vertexColors: true,
      side: DoubleSide,
      metalness: 0.55,
      roughness: 0.5,
    }),
  );
  const bellProfile = [
    new Vector2(0.18, 0.82),
    new Vector2(0.28, 0.66),
    new Vector2(0.43, 0.45),
    new Vector2(0.58, 0.1),
    new Vector2(0.72, -0.42),
    new Vector2(0.8, -0.67),
    new Vector2(0.74, -0.78),
    new Vector2(0.2, -0.82),
  ];
  addMesh(
    tower,
    "Auguste-Viktoria visible 1.60 m bell",
    new LatheGeometry(bellProfile, 24),
    material(COLORS.castSteel, { metalness: 0.66, roughness: 0.5 }),
    [0, 3.68, 0],
  );
  addInstances(
    tower,
    "Auguste-Viktoria bell yoke and clapper",
    new CylinderGeometry(0.1, 0.1, 1, 8),
    material(COLORS.bronzeDark),
    [
      {
        position: [0, 4.59, 0],
        rotation: [0, 0, Math.PI / 2],
        scale: [1, 2.7, 1],
      },
      { position: [0, 2.91, 0], scale: [0.72, 0.75, 0.72] },
    ],
  );
  parent.add(tower);
}

function segmentBoxes(
  points: readonly WorldPoint2[],
  spacing: number,
  y: number,
  height: number,
  depth: number,
  widthInset = 0,
): Transform[] {
  const transforms: Transform[] = [];
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    const start = points[pointIndex];
    const end = points[pointIndex + 1];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const count = Math.max(1, Math.ceil(length / spacing));
    const rotationY = -Math.atan2(dz, dx);
    for (let index = 0; index < count; index += 1) {
      const t = (index + 0.5) / count;
      transforms.push({
        position: [start[0] + dx * t, y, start[1] + dz * t],
        rotation: [0, rotationY, 0],
        scale: [Math.max(0.35, length / count - widthInset), height, depth],
      });
    }
  }
  return transforms;
}

const CANAL_PIER_POSITIONS = segmentBoxes(
  INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.canalBrickWallWorldM,
  5.2,
  0,
  1,
  1,
  0.78,
).map((field) => ({
  x: field.position[0] - Math.cos(field.rotation![1]) * field.scale![0] * 0.53,
  z: field.position[2] + Math.sin(field.rotation![1]) * field.scale![0] * 0.53,
  yaw: field.rotation![1],
}));

function addWallRefinements(parent: Group): void {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.walls;
  const walls = new Group();
  walls.name = "Invalidenfriedhof historic walls exact Day protected";
  markProtected(walls, [
    ...profile.hinterlandWallOsmWayIds.map((id) => `way/${id}`),
    `way/${profile.cemeteryOsmWayId}`,
  ]);
  const fine = new Group();
  fine.name = "Invalidenfriedhof historic wall fine detail";
  fine.userData.detailFadeM = [120, 300];

  addInstances(
    walls,
    "Invalidenfriedhof Hinterlandmauer continuous grey backing shell",
    new BoxGeometry(1, 1, 1),
    material(COLORS.wallGrey),
    profile.hinterlandWallSegmentsWorldM.flatMap((segment) =>
      segmentBoxes(segment, 10_000, profile.groundY + 1.7, 3.4, 0.34),
    ),
  );

  const hinterlandPanels = profile.hinterlandWallSegmentsWorldM.flatMap(
    (segment) =>
      segmentBoxes(segment, 6.3, profile.groundY + 1.78, 2.08, 0.035, 0.42),
  );
  addInstances(
    fine,
    "Invalidenfriedhof Hinterlandmauer long white paint fields",
    new BoxGeometry(1, 1, 1),
    material(COLORS.paintWhite),
    hinterlandPanels.map((panel) => ({
      ...panel,
      position: [
        panel.position[0] + Math.sin(panel.rotation![1]) * 0.193,
        panel.position[1],
        panel.position[2] + Math.cos(panel.rotation![1]) * 0.193,
      ],
    })),
  );
  addInstances(
    walls,
    "Invalidenfriedhof Hinterlandmauer visible panel joints",
    new BoxGeometry(1, 1, 1),
    material(COLORS.wallGrey),
    profile.hinterlandWallSegmentsWorldM.flatMap((segment) =>
      segmentBoxes(segment, 3.15, profile.groundY + 1.7, 3.4, 0.045, 3.03).map(
        (joint) => ({
          ...joint,
          position: [
            joint.position[0] + Math.sin(joint.rotation![1]) * 0.232,
            joint.position[1],
            joint.position[2] + Math.cos(joint.rotation![1]) * 0.232,
          ],
        }),
      ),
    ),
  );

  const canalFields = segmentBoxes(
    profile.canalBrickWallWorldM,
    5.2,
    profile.groundY + 1.38,
    1.55,
    0.045,
    0.78,
  ).map((field) => ({
    ...field,
    position: [
      field.position[0] + Math.sin(field.rotation![1]) * 0.265,
      field.position[1],
      field.position[2] + Math.cos(field.rotation![1]) * 0.265,
    ] as const,
  }));
  addInstances(
    fine,
    "Invalidenfriedhof canal wall white inset fields",
    new BoxGeometry(1, 1, 1),
    material(COLORS.paintWhite),
    canalFields,
  );
  addInstances(
    walls,
    "Invalidenfriedhof canal wall red brick piers and coping",
    new BoxGeometry(1, 1, 1),
    material(COLORS.wallBrick),
    [
      ...segmentBoxes(
        profile.canalBrickWallWorldM,
        5.2,
        profile.groundY + 2.28,
        0.18,
        0.5,
        0,
      ),
      ...canalFields.map((field) => ({
        position: [
          field.position[0] -
            Math.sin(field.rotation![1]) * 0.265 -
            Math.cos(field.rotation![1]) * field.scale![0] * 0.53,
          profile.groundY + 1.35,
          field.position[2] -
            Math.cos(field.rotation![1]) * 0.265 +
            Math.sin(field.rotation![1]) * field.scale![0] * 0.53,
        ] as const,
        rotation: field.rotation,
        scale: [0.32, 2.05, 0.52] as const,
      })),
    ],
  );
  addInstances(
    fine,
    "Invalidenfriedhof canal wall dark brick dentil course",
    new BoxGeometry(1, 1, 1),
    material(COLORS.wallBrickDark),
    canalFields.flatMap((field) =>
      Array.from({ length: 4 }, (_, index) => ({
        position: [
          field.position[0] +
            Math.cos(field.rotation![1]) *
              (index - 1.5) *
              (field.scale![0] / 4),
          profile.groundY + 2.12,
          field.position[2] -
            Math.sin(field.rotation![1]) *
              (index - 1.5) *
              (field.scale![0] / 4),
        ] as const,
        rotation: field.rotation,
        scale: [0.18, 0.18, 0.56] as const,
      })),
    ),
  );
  const pierCaps: Transform[] = [];
  const brickJoints: Transform[] = [];
  for (const field of canalFields) {
    const yaw = field.rotation![1],
      co = Math.cos(yaw),
      si = Math.sin(yaw);
    const x = field.position[0] - si * 0.265 - co * field.scale![0] * 0.53,
      z = field.position[2] - co * 0.265 + si * field.scale![0] * 0.53;
    pierCaps.push(
      {
        position: [x, profile.groundY + 2.42, z],
        rotation: field.rotation,
        scale: [0.56, 0.13, 0.64],
      },
      {
        position: [x, profile.groundY + 2.65, z],
        rotation: field.rotation,
        scale: [0.34, 0.33, 0.42],
      },
      {
        position: [x, profile.groundY + 2.88, z],
        rotation: field.rotation,
        scale: [0.48, 0.12, 0.56],
      },
    );
    for (let row = 0; row < 8; row++)
      brickJoints.push({
        position: [
          x + si * 0.275,
          profile.groundY + 0.3 + row * 0.26,
          z + co * 0.275,
        ],
        rotation: field.rotation,
        scale: [0.32, 0.023, 0.025],
      });
  }
  addInstances(
    walls,
    "Invalidenfriedhof historic brick pier capstones",
    new BoxGeometry(1, 1, 1),
    material(COLORS.wallBrickDark),
    pierCaps,
  );
  addInstances(
    fine,
    "Invalidenfriedhof historic pier masonry joints",
    new BoxGeometry(1, 1, 1),
    material(0xb9aa94),
    brickJoints,
  );
  walls.add(fine);
  parent.add(walls);
}

type VoxelPaletteKey =
  | "bellSteel"
  | "brick"
  | "concrete"
  | "dark"
  | "sheet"
  | "ivy"
  | "marble"
  | "patina"
  | "sandstone"
  | "white";

const VOXEL_COLORS: Readonly<Record<VoxelPaletteKey, number>> = {
  bellSteel: 0x4a504e,
  brick: 0x8c4d3c,
  concrete: 0xa19d92,
  dark: 0x2d3333,
  sheet: 0x91a8b2,
  ivy: 0x486d3f,
  marble: 0xded8c9,
  patina: 0x5f9184,
  sandstone: 0xc9a765,
  white: 0xe1e1d9,
};

type VoxelBatches = Record<VoxelPaletteKey, Transform[]>;

function createVoxelBatches(): VoxelBatches {
  return {
    bellSteel: [],
    brick: [],
    concrete: [],
    dark: [],
    sheet: [],
    ivy: [],
    marble: [],
    patina: [],
    sandstone: [],
    white: [],
  };
}

function pushVoxel(
  batches: VoxelBatches,
  palette: VoxelPaletteKey,
  position: readonly [number, number, number],
  size: number,
): void {
  batches[palette].push({ position, scale: [size, size, size] });
}

function localVoxelPosition(
  center: readonly [number, number, number],
  rotationY: number,
  x: number,
  y: number,
  z: number,
): readonly [number, number, number] {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    center[0] + cosine * x + sine * z,
    center[1] + y,
    center[2] - sine * x + cosine * z,
  ];
}

function pushLocalVoxel(
  batches: VoxelBatches,
  palette: VoxelPaletteKey,
  center: readonly [number, number, number],
  rotationY: number,
  x: number,
  y: number,
  z: number,
  size: number,
): void {
  pushVoxel(
    batches,
    palette,
    localVoxelPosition(center, rotationY, x, y, z),
    size,
  );
}

function addMinecraftGraves(batches: VoxelBatches): void {
  const graves = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves;
  const scharnhorst = graves.scharnhorst;
  const scharnhorstBlock = 0.4;
  for (let xIndex = -5; xIndex <= 5; xIndex += 1) {
    for (let zIndex = -3; zIndex <= 3; zIndex += 1) {
      pushLocalVoxel(
        batches,
        "concrete",
        scharnhorst.centerWorldM,
        scharnhorst.rotationY,
        xIndex * scharnhorstBlock,
        0.2,
        zIndex * scharnhorstBlock,
        scharnhorstBlock,
      );
    }
  }
  for (const x of [-1.2, 1.2]) {
    for (const y of [0.6, 1, 1.4, 1.8, 2.2, 2.6]) {
      for (const z of [-0.8, -0.4, 0, 0.4, 0.8]) {
        pushLocalVoxel(
          batches,
          "marble",
          scharnhorst.centerWorldM,
          scharnhorst.rotationY,
          x,
          y,
          z,
          scharnhorstBlock,
        );
      }
    }
  }
  for (const y of [3, 3.4, 3.8, 4]) {
    const halfX = y === 3.4 ? 4 : 5;
    const halfZ = y === 3.4 ? 2 : 3;
    for (let xIndex = -halfX; xIndex <= halfX; xIndex += 1) {
      for (let zIndex = -halfZ; zIndex <= halfZ; zIndex += 1) {
        pushLocalVoxel(
          batches,
          y === 3.4 ? "concrete" : "marble",
          scharnhorst.centerWorldM,
          scharnhorst.rotationY,
          xIndex * scharnhorstBlock,
          y,
          zIndex * scharnhorstBlock,
          scharnhorstBlock,
        );
      }
    }
  }
  // Block-native sleeping lion: long body, low paws, a dominant mane/head at
  // the short end and a curled tail. Its top block reaches the sourced 5.60 m
  // total height rather than retaining the former half-height marker.
  for (const [x, y, z] of [
    [-0.4, 4.4, -0.4],
    [-0.4, 4.4, 0],
    [-0.4, 4.4, 0.4],
    [0, 4.4, -0.4],
    [0, 4.4, 0],
    [0, 4.4, 0.4],
    [0.4, 4.4, -0.4],
    [0.4, 4.4, 0],
    [0.4, 4.4, 0.4],
    [0.8, 4.4, -0.4],
    [0.8, 4.4, 0],
    [0.8, 4.4, 0.4],
    [1.2, 4.4, -0.4],
    [1.2, 4.4, 0],
    [1.2, 4.4, 0.4],
    [-1.6, 4.4, -0.4],
    [-1.6, 4.4, 0.4],
    [1.2, 4.8, 0],
    [1.6, 4.8, 0],
    [-1.2, 4.8, -0.4],
    [-1.2, 4.8, 0],
    [-1.2, 4.8, 0.4],
    [-1.6, 4.8, 0],
    [-1.2, 5.2, -0.4],
    [-1.2, 5.2, 0],
    [-1.2, 5.2, 0.4],
    [-1.2, 5.4, 0],
  ] as const) {
    pushLocalVoxel(
      batches,
      "patina",
      scharnhorst.centerWorldM,
      scharnhorst.rotationY,
      x,
      y,
      z,
      scharnhorstBlock,
    );
  }
  for (const [x, y, z, size] of [
    [-1.42, 5.4, -0.3, 0.2],
    [-1.42, 5.4, 0.3, 0.2],
    [-1.78, 5, 0, 0.2],
  ] as const) {
    pushLocalVoxel(
      batches,
      "patina",
      scharnhorst.centerWorldM,
      scharnhorst.rotationY,
      x,
      y,
      z,
      size,
    );
  }
  for (const [x, y, z] of [
    [-1.82, 5.02, 0],
    [-1.43, 5.17, -0.42],
    [-1.43, 5.17, 0.42],
  ] as const) {
    pushLocalVoxel(
      batches,
      "dark",
      scharnhorst.centerWorldM,
      scharnhorst.rotationY,
      x,
      y,
      z,
      0.12,
    );
  }
  for (let index = 0; index <= 12; index += 1) {
    const x = -2.7 + index * 0.45;
    for (const z of [-2.02, 2.02]) {
      for (const y of [0.24, 0.68, 1.12]) {
        pushLocalVoxel(
          batches,
          "dark",
          scharnhorst.centerWorldM,
          scharnhorst.rotationY,
          x,
          y,
          z,
          0.18,
        );
      }
    }
  }
  for (let index = 1; index < 9; index += 1) {
    const z = -2.02 + index * 0.45;
    for (const x of [-2.7, 2.7]) {
      for (const y of [0.24, 0.68, 1.12]) {
        pushLocalVoxel(
          batches,
          "dark",
          scharnhorst.centerWorldM,
          scharnhorst.rotationY,
          x,
          y,
          z,
          0.18,
        );
      }
    }
  }

  const witzleben = graves.witzleben;
  const wv = (
    x: number,
    y: number,
    z: number,
    size: number,
    palette: VoxelPaletteKey = "patina",
  ) =>
    pushLocalVoxel(
      batches,
      palette,
      witzleben.centerWorldM,
      0.04,
      x,
      y,
      z,
      size,
    );
  for (let xi = -2; xi <= 2; xi++)
    for (let zi = -2; zi <= 2; zi++)
      for (let yi = 0; yi < 5; yi++)
        wv(xi * 0.4, 0.2 + yi * 0.4, zi * 0.4, 0.4);
  for (const x of [-0.84, 0.84])
    for (const z of [-0.84, 0.84])
      for (let yi = 0; yi < 11; yi++) wv(x, 2.1 + yi * 0.2, z, 0.2);
  for (const side of [-1, 1])
    for (let step = 0; step <= 12; step++) {
      const angle = (step * Math.PI) / 12,
        x = Math.cos(angle) * 0.83,
        y = 3.92 + Math.sin(angle) * 0.83;
      wv(x, y, side * 0.83, 0.2);
      wv(side * 0.83, y, x, 0.2);
    }
  for (let yi = 0; yi < 7; yi++)
    wv(0, 2.3 + yi * 0.24, 0, yi < 4 ? 0.38 : 0.27);
  for (let side = 0; side < 4; side++) {
    const angle = (side * Math.PI) / 2,
      co = Math.cos(angle),
      si = Math.sin(angle);
    const bird = (x: number, y: number) =>
      wv(x * co + 0.83 * si, y, -x * si + 0.83 * co, 0.16);
    bird(0, 5.15);
    bird(0, 5.31);
    bird(0, 5.47);
    for (const x of [-1, 1])
      for (let k = 0; k < 3; k++) bird(x * (0.15 + k * 0.1), 5.22 + k * 0.13);
    for (let k = -4; k <= 4; k++) {
      const x = k * 0.21;
      wv(x * co + 0.83 * si, 5 - Math.abs(x) * 0.38, -x * si + 0.83 * co, 0.2);
    }
  }

  const winterfeld = graves.winterfeld;
  for (const x of [-0.9, -0.3, 0.3, 0.9]) {
    for (const z of [-0.6, 0, 0.6]) {
      pushLocalVoxel(
        batches,
        "concrete",
        winterfeld.centerWorldM,
        -0.06,
        x,
        0.3,
        z,
        0.6,
      );
    }
  }
  for (const y of [0.9, 1.5, 2.1, 2.7]) {
    for (const x of [-0.3, 0.3]) {
      for (const z of [-0.3, 0.3]) {
        pushLocalVoxel(
          batches,
          "concrete",
          winterfeld.centerWorldM,
          -0.06,
          x,
          y,
          z,
          0.6,
        );
      }
    }
  }
  for (const x of [-0.6, 0, 0.6]) {
    pushLocalVoxel(
      batches,
      "concrete",
      winterfeld.centerWorldM,
      -0.06,
      x,
      3.3,
      0,
      0.6,
    );
  }
  for (const [x, y, z, palette] of [
    [0, 1.8, 0.6, "dark"],
    [0, 3.9, 0, "patina"],
    [-0.45, 3.6, 0, "patina"],
    [0.45, 3.6, 0, "patina"],
    [0.3, 4.5, 0, "patina"],
  ] as const) {
    pushLocalVoxel(
      batches,
      palette,
      winterfeld.centerWorldM,
      -0.06,
      x,
      y,
      z,
      0.6,
    );
  }

  for (const sign of [-1, 1])
    for (let k = -5; k <= 5; k++)
      for (const y of [0.25, 0.75, 1.25]) {
        pushLocalVoxel(
          batches,
          "dark",
          winterfeld.centerWorldM,
          -0.06,
          k * 0.3,
          y,
          sign * 1.45,
          0.14,
        );
        pushLocalVoxel(
          batches,
          "dark",
          winterfeld.centerWorldM,
          -0.06,
          sign * 1.7,
          y,
          k * 0.26,
          0.14,
        );
      }
  const kessel = graves.vonKessel;
  for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) {
    for (const z of [-0.6, 0, 0.6]) {
      pushLocalVoxel(
        batches,
        z === 0 && Math.abs(x) <= 0.6 ? "dark" : "ivy",
        kessel.centerWorldM,
        -0.12,
        x,
        0.3,
        z,
        0.6,
      );
    }
  }
  for (const x of [-1.5, 1.5]) {
    for (const z of [-0.9, 0, 0.9]) {
      pushLocalVoxel(
        batches,
        "dark",
        kessel.centerWorldM,
        -0.12,
        x,
        0.6,
        z,
        0.3,
      );
    }
  }

  const rauch = graves.vonRauch;
  for (const x of [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]) {
    for (const y of [0.3, 0.9]) {
      pushLocalVoxel(
        batches,
        "sandstone",
        rauch.centerWorldM,
        0.16,
        x,
        y,
        0.9,
        0.6,
      );
    }
  }
  for (const x of [-1.5, -0.6, 0.6, 1.5]) {
    for (const y of [1.5, 2.1, 2.7, 3.3]) {
      pushLocalVoxel(
        batches,
        "sandstone",
        rauch.centerWorldM,
        0.16,
        x,
        y,
        0.9,
        0.6,
      );
    }
  }
  for (const [x, y] of [
    [-0.9, 3.6],
    [-0.6, 3.9],
    [0, 4.1],
    [0.6, 3.9],
    [0.9, 3.6],
  ] as const) {
    pushLocalVoxel(
      batches,
      "sandstone",
      rauch.centerWorldM,
      0.16,
      x,
      y,
      0.9,
      0.6,
    );
  }
  for (const [x, y] of [
    [0, 1.5],
    [0, 2.1],
    [0, 2.7],
    [-0.6, 2.1],
    [0.6, 2.1],
  ] as const) {
    pushLocalVoxel(batches, "white", rauch.centerWorldM, 0.16, x, y, 0.3, 0.6);
  }
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++)
      pushLocalVoxel(
        batches,
        "white",
        rauch.centerWorldM,
        0.16,
        side * 1.3,
        0.4 + k * 0.3,
        -0.45,
        0.22,
      );
    for (let k = -1; k <= 1; k++)
      pushLocalVoxel(
        batches,
        "white",
        rauch.centerWorldM,
        0.16,
        side * 1.3 + k * 0.28,
        1.82,
        -0.45,
        0.22,
      );
  }
}

function addMinecraftBell(batches: VoxelBatches): void {
  const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
  const place = (
    palette: VoxelPaletteKey,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) =>
    batches[palette].push({
      position: localVoxelPosition(bell.centerWorldM, bell.rotationY, x, y, z),
      rotation: [0, bell.rotationY, 0],
      scale: [sx, sy, sz],
    });
  for (const xs of [-1, 1])
    for (const zs of [-1, 1])
      for (let i = 0; i < 40; i++) {
        const y = 0.125 + i * 0.25,
          h = bellHalfWidth(y);
        place("white", xs * h, y, zs * h, 0.22, 0.25, 0.22);
      }
  for (const y of [3, 4.65, 6.42, 8.19, 9.99]) {
    const h = bellHalfWidth(y);
    for (const sign of [-1, 1]) {
      place("white", 0, y, sign * h, h * 2, 0.12, 0.14);
      place("white", sign * h, y, 0, 0.14, 0.12, h * 2);
    }
  }
  for (let level = 0; level < 21; level++) {
    const y = 4.85 + level * 0.24,
      h = bellHalfWidth(y) - 0.08;
    for (const sign of [-1, 1]) {
      place("sheet", 0, y, sign * h, h * 2, 0.24, 0.1);
      place("sheet", sign * h, y, 0, 0.1, 0.24, h * 2);
    }
  }
  for (let level = 0; level < 6; level++) {
    const y = 2.98 + level * 0.25,
      r = 0.76 - level * 0.105;
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        if (Math.hypot(x * 0.3, z * 0.3) < r)
          place("bellSteel", x * 0.3, y, z * 0.3, 0.3, 0.25, 0.3);
  }
  place("dark", 0, 2.89, 0, 0.12, 0.56, 0.12);
  place("dark", 0, 4.59, 0, 2.7, 0.18, 0.18);
}

function addMinecraftWalls(batches: VoxelBatches): void {
  const walls = INVALIDENFRIEDHOF_DETAIL_PROFILE.walls;
  // Thin rectangular block walls follow the exact OSM segments. The old 1.1 m
  // cubes widened the wall beyond its physical collision and left sample gaps.
  const put = (t: Transform, palette: VoxelPaletteKey) =>
    batches[palette].push(t);
  for (const t of segmentBoxes(
    walls.canalBrickWallWorldM,
    1.1,
    walls.groundY + 1.08,
    2.16,
    0.46,
  ))
    put(t, "brick");
  for (const t of segmentBoxes(
    walls.canalBrickWallWorldM,
    5.2,
    walls.groundY + 1.38,
    1.55,
    0.05,
    0.78,
  )) {
    const y = t.rotation![1],
      co = Math.cos(y),
      si = Math.sin(y);
    put(
      {
        ...t,
        position: [
          t.position[0] + si * 0.26,
          t.position[1],
          t.position[2] + co * 0.26,
        ],
      },
      "white",
    );
    put(
      {
        position: [
          t.position[0] - co * t.scale![0] * 0.53,
          walls.groundY + 1.47,
          t.position[2] + si * t.scale![0] * 0.53,
        ],
        rotation: t.rotation,
        scale: [0.4, 2.94, 0.54],
      },
      "brick",
    );
  }
  for (const t of segmentBoxes(
    walls.canalBrickWallWorldM,
    1.1,
    walls.groundY + 2.28,
    0.18,
    0.5,
  ))
    put(t, "brick");
  for (const segment of walls.hinterlandWallSegmentsWorldM) {
    for (const t of segmentBoxes(segment, 1.05, walls.groundY + 1.7, 3.4, 0.34))
      put(t, "concrete");
    for (const t of segmentBoxes(
      segment,
      6.3,
      walls.groundY + 1.78,
      2.08,
      0.035,
      0.42,
    ))
      put(
        {
          ...t,
          position: [
            t.position[0] + Math.sin(t.rotation![1]) * 0.193,
            t.position[1],
            t.position[2] + Math.cos(t.rotation![1]) * 0.193,
          ],
        },
        "white",
      );
  }
}

/**
 * Block-native Minecraft signatures for every authored ensemble. The shared
 * cube geometry and ten opaque palette batches replace all smooth primitives.
 */
export function createMinecraftInvalidenfriedhofDetails(
  options: { mobileLike?: boolean } = {},
): Group {
  const root = new Group();
  root.name = "Minecraft Invalidenfriedhof block-native details";
  root.userData = {
    blockNative: true,
    geometryStatus:
      "source-bound stepped voxel signatures; exact LoD2/OSM anchors retained",
    motionPolicy: "static in Minecraft",
    sourceFootprintOwnership: ["litfin-watchtower", "auguste-viktoria-bell"],
    signatureIds: [
      "scharnhorst-lion-tomb",
      "witzleben-green-canopy-tomb",
      "hans-carl-von-winterfeld-pedestal",
      "von-kessel-fenced-slab",
      "familie-von-rauch-yellow-arch",
      "auguste-viktoria-bell",
      "litfin-watchtower",
      "invalidenfriedhof-historic-walls",
    ],
    texturePolicy: "opaque palette materials and one shared cube geometry",
  };
  const batches = createVoxelBatches();
  addMinecraftGraves(batches);
  addMinecraftBell(batches);
  addMinecraftWalls(batches);
  const sharedCube = new BoxGeometry(1, 1, 1);
  sharedCube.deleteAttribute("uv");
  for (const palette of Object.keys(batches) as VoxelPaletteKey[]) {
    const transforms = batches[palette];
    if (transforms.length === 0) continue;
    const mesh = addInstances(
      root,
      `Minecraft Invalidenfriedhof ${palette} blocks`,
      sharedCube,
      material(VOXEL_COLORS[palette], {
        metalness: palette === "bellSteel" || palette === "patina" ? 0.22 : 0,
        roughness: 0.86,
      }),
      transforms,
    );
    mesh.userData.blockPalette = palette;
    mesh.userData.blockNative = true;
  }
  const litfin = createMinecraftLitfinWatchtower(options);
  root.add(litfin);
  root.userData.instanceCount =
    litfin.userData.instanceCount +
    Object.values(batches).reduce(
      (total, transforms) => total + transforms.length,
      0,
    );
  root.userData.drawCallCount = root.children.length;
  return root;
}

function addSnow(parent: Group): void {
  const snow = new Group();
  snow.name = "Invalidenfriedhof horizontal snow caps";
  snow.userData.snowOnly = true;
  snow.userData.snowActive = false;
  snow.userData.surfacePolicy = "horizontal top faces only";
  snow.visible = false;
  const snowMaterial = material(COLORS.snow, { roughness: 0.98 });
  const graves = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves;
  const graveCaps: Transform[] = [
    {
      position: localVoxelPosition(
        graves.scharnhorst.centerWorldM,
        graves.scharnhorst.rotationY,
        0,
        4.105,
        0,
      ),
      rotation: [0, graves.scharnhorst.rotationY, 0],
      scale: [3.82, 0.05, 2.16],
    },
    {
      position: localVoxelPosition(
        graves.scharnhorst.centerWorldM,
        graves.scharnhorst.rotationY,
        0.35,
        5.225,
        0,
      ),
      rotation: [0, graves.scharnhorst.rotationY, 0],
      scale: [1.65, 0.045, 0.72],
    },
    {
      position: localVoxelPosition(
        graves.scharnhorst.centerWorldM,
        graves.scharnhorst.rotationY,
        -1.03,
        graves.scharnhorst.publishedOverallHeightM + 0.0225,
        0,
      ),
      rotation: [0, graves.scharnhorst.rotationY, 0],
      scale: [0.62, 0.045, 0.66],
    },
    {
      position: [30.23, 7.315, -1429.853],
      rotation: [0, 0.04, 0],
      scale: [2.4, 0.05, 2.4],
    },
    {
      position: [15.239, 8.565, -1423.548],
      rotation: [0, -0.06, 0],
      scale: [2.05, 0.05, 1.56],
    },
    {
      position: [49.102, 5.6, -1453.619],
      rotation: [-0.09, -0.12, 0],
      scale: [2.05, 0.045, 1.1],
    },
    {
      position: localVoxelPosition(
        graves.vonRauch.centerWorldM,
        0.16,
        0,
        4.205,
        1.08,
      ),
      rotation: [0, 0.16, 0],
      scale: [0.34, 0.05, 0.34],
    },
    ...([-1.62, 1.62] as const).map((localX) => ({
      position: localVoxelPosition(
        graves.vonRauch.centerWorldM,
        0.16,
        localX,
        3.515,
        1.08,
      ),
      rotation: [0, 0.16, 0] as const,
      scale: [0.36, 0.05, 0.36] as const,
    })),
  ];
  addInstances(
    snow,
    "Invalidenfriedhof grave horizontal snow caps",
    new BoxGeometry(1, 1, 1),
    snowMaterial,
    graveCaps,
  );
  const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
  const litfin = INVALIDENFRIEDHOF_DETAIL_PROFILE.litfinWatchtower;
  addInstances(
    snow,
    "Invalidenfriedhof tower roof horizontal snow caps",
    new BoxGeometry(1, 1, 1),
    snowMaterial,
    [
      ...([-1, 1] as const).flatMap((sign) => [
        {
          position: localVoxelPosition(
            bell.centerWorldM,
            bell.rotationY,
            0,
            bell.measuredHeightM + 0.025,
            sign * bellHalfWidth(10.044),
          ),
          rotation: [0, bell.rotationY, 0] as const,
          scale: [2.88, 0.05, 0.13] as const,
        },
        {
          position: localVoxelPosition(
            bell.centerWorldM,
            bell.rotationY,
            sign * bellHalfWidth(10.044),
            bell.measuredHeightM + 0.025,
            0,
          ),
          rotation: [0, bell.rotationY, 0] as const,
          scale: [0.13, 0.05, 2.88] as const,
        },
      ]),
      {
        position: [
          litfin.centerWorldM[0],
          litfin.centerWorldM[1] + litfin.bodyHeightM + 0.025,
          litfin.centerWorldM[2],
        ],
        rotation: [0, litfin.rotationY, 0],
        scale: [
          litfin.roofFootprintM[0] + 0.03,
          0.05,
          litfin.roofFootprintM[1] + 0.03,
        ],
      },
    ],
  );
  const wallCaps = segmentBoxes(
    INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.canalBrickWallWorldM,
    5.2,
    INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 2.395,
    0.045,
    0.53,
  );
  addInstances(
    snow,
    "Invalidenfriedhof canal wall horizontal snow coping",
    new BoxGeometry(1, 1, 1),
    snowMaterial,
    wallCaps,
  );
  const hinterlandCaps =
    INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.hinterlandWallSegmentsWorldM.flatMap(
      (segment) =>
        segmentBoxes(
          segment,
          10_000,
          INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 3.425,
          0.05,
          0.36,
        ),
    );
  addInstances(
    snow,
    "Invalidenfriedhof Hinterlandmauer horizontal snow caps",
    new BoxGeometry(1, 1, 1),
    snowMaterial,
    hinterlandCaps,
  );
  addInstances(
    snow,
    "Invalidenfriedhof historic brick pier snow caps",
    new BoxGeometry(1, 1, 1),
    snowMaterial,
    CANAL_PIER_POSITIONS.map((pier) => ({
      position: [
        pier.x,
        INVALIDENFRIEDHOF_DETAIL_PROFILE.walls.groundY + 2.965,
        pier.z,
      ],
      rotation: [0, pier.yaw, 0],
      scale: [0.5, 0.05, 0.58],
    })),
  );
  parent.add(snow);
}

/** Build the static source-bound Invalidenfriedhof recognition layer. */
export function createInvalidenfriedhofDetails(
  options: { mobileLike?: boolean } = {},
): Group {
  const root = new Group();
  root.name = "Invalidenfriedhof granular isometric details";
  root.userData = {
    geometryStatus: INVALIDENFRIEDHOF_DETAIL_PROFILE.geometryStatus,
    modeContract: INVALIDENFRIEDHOF_DETAIL_PROFILE.modeContract,
    motionPolicy: "static; no animated people, vehicles, foliage or props",
    sourceAttribution:
      "OpenStreetMap contributors · Geoportal Berlin LoD2 (dl-de/zero-2-0) · Berlin.de monument and Wall inventories",
    texturePolicy: "procedural flat materials only; no image textures",
    visualReferenceStatus:
      INVALIDENFRIEDHOF_DETAIL_PROFILE.visualReferenceStatus,
  };
  addScharnhorstTomb(root);
  addWitzlebenCanopy(root);
  addWinterfeldPedestal(root);
  addVonKesselGrave(root);
  addVonRauchGrave(root);
  addAugusteViktoriaBell(root);
  const litfin = createLitfinWatchtower(options);
  markProtected(litfin, [
    LITFIN_WATCHTOWER_PROFILE.osmKey,
    `LoD2/${LITFIN_WATCHTOWER_PROFILE.lod2BuildingPartFullId}`,
  ]);
  root.add(litfin);
  addWallRefinements(root);
  addSnow(root);
  return root;
}

/** Toggle only the authored horizontal snow caps. */
export function setInvalidenfriedhofSnow(
  root: Object3D,
  enabled: boolean,
): void {
  root.traverse((object) => {
    if (object.userData.snowOnly !== true) return;
    object.userData.snowActive = enabled;
    object.visible = enabled;
  });
}

function worldToLocal(
  x: number,
  z: number,
  center: readonly [number, number, number],
  rotationY: number,
): readonly [number, number] {
  const dx = x - center[0];
  const dz = z - center[2];
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [cosine * dx - sine * dz, sine * dx + cosine * dz];
}

function withinOrientedBox(
  x: number,
  z: number,
  center: readonly [number, number, number],
  rotationY: number,
  sizeX: number,
  sizeZ: number,
  radius: number,
): boolean {
  const [localX, localZ] = worldToLocal(x, z, center, rotationY);
  return (
    Math.abs(localX) <= sizeX / 2 + radius &&
    Math.abs(localZ) <= sizeZ / 2 + radius
  );
}

function distanceToSegmentSquared(
  x: number,
  z: number,
  start: WorldPoint2,
  end: WorldPoint2,
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const denominator = dx * dx + dz * dz;
  const t =
    denominator === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((x - start[0]) * dx + (z - start[1]) * dz) / denominator,
          ),
        );
  const closestX = start[0] + dx * t;
  const closestZ = start[1] + dz * t;
  return (x - closestX) ** 2 + (z - closestZ) ** 2;
}

function wallSolidAt(x: number, y: number, z: number, radius: number): boolean {
  const profile = INVALIDENFRIEDHOF_DETAIL_PROFILE.walls;
  if (y >= profile.groundY - radius && y <= profile.groundY + 2.5 + radius) {
    const canalRadiusSquared = (0.25 + radius) ** 2;
    const points = profile.canalBrickWallWorldM;
    for (let index = 0; index < points.length - 1; index += 1) {
      if (
        distanceToSegmentSquared(x, z, points[index], points[index + 1]) <=
        canalRadiusSquared
      ) {
        return true;
      }
    }
  }
  if (y >= profile.groundY - radius && y <= profile.groundY + 3.4 + radius) {
    const hinterlandRadiusSquared = (0.17 + radius) ** 2;
    for (const points of profile.hinterlandWallSegmentsWorldM) {
      for (let index = 0; index < points.length - 1; index += 1) {
        if (
          distanceToSegmentSquared(x, z, points[index], points[index + 1]) <=
          hinterlandRadiusSquared
        ) {
          return true;
        }
      }
    }
  }
  if (y >= profile.groundY - radius && y <= profile.groundY + 2.95 + radius)
    for (const pier of CANAL_PIER_POSITIONS) {
      if (
        withinOrientedBox(
          x,
          z,
          [pier.x, profile.groundY, pier.z],
          pier.yaw,
          0.56,
          0.64,
          radius,
        )
      )
        return true;
    }
  return false;
}

/** Static physical solids while retaining open paths and the bell undercroft. */
export function invalidenfriedhofSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  if (![x, y, z, radius].every(Number.isFinite)) return false;
  const bodyRadius = Math.max(0, radius);
  const graves = INVALIDENFRIEDHOF_DETAIL_PROFILE.graves;
  const [scharnhorstX, scharnhorstZ] = worldToLocal(
    x,
    z,
    graves.scharnhorst.centerWorldM,
    graves.scharnhorst.rotationY,
  );
  const scharnhorstY = y - graves.scharnhorst.centerWorldM[1];
  if (
    scharnhorstY >= -bodyRadius &&
    scharnhorstY <= 0.38 + bodyRadius &&
    Math.abs(scharnhorstX) <= 2.28 + bodyRadius &&
    Math.abs(scharnhorstZ) <= 1.63 + bodyRadius
  ) {
    return true;
  }
  if (
    scharnhorstY >= 0.36 - bodyRadius &&
    scharnhorstY <= 2.78 + bodyRadius &&
    Math.abs(Math.abs(scharnhorstX) - 1.12) <= 0.58 + bodyRadius &&
    Math.abs(scharnhorstZ) <= 1.04 + bodyRadius
  ) {
    return true;
  }
  if (
    scharnhorstY >= 2.76 - bodyRadius &&
    scharnhorstY <= 4.1 + bodyRadius &&
    Math.abs(scharnhorstX) <= 1.96 + bodyRadius &&
    Math.abs(scharnhorstZ) <= 1.14 + bodyRadius
  ) {
    return true;
  }
  if (
    scharnhorstY >= 4.02 - bodyRadius &&
    scharnhorstY <= graves.scharnhorst.publishedOverallHeightM + bodyRadius &&
    Math.abs(scharnhorstX) <= 1.88 + bodyRadius &&
    Math.abs(scharnhorstZ) <= 0.76 + bodyRadius
  ) {
    return true;
  }
  if (
    scharnhorstY >= -bodyRadius &&
    scharnhorstY <= 1.36 + bodyRadius &&
    ((Math.abs(Math.abs(scharnhorstX) - 2.8) <= 0.07 + bodyRadius &&
      Math.abs(scharnhorstZ) <= 2.1 + bodyRadius) ||
      (Math.abs(Math.abs(scharnhorstZ) - 2.1) <= 0.07 + bodyRadius &&
        Math.abs(scharnhorstX) <= 2.8 + bodyRadius))
  ) {
    return true;
  }

  const [witzlebenX, witzlebenZ] = worldToLocal(
    x,
    z,
    graves.witzleben.centerWorldM,
    0.04,
  );
  const witzlebenY = y - graves.witzleben.centerWorldM[1];
  if (
    witzlebenY >= -bodyRadius &&
    witzlebenY <= 2.09 + bodyRadius &&
    Math.abs(witzlebenX) <= 1.2 + bodyRadius &&
    Math.abs(witzlebenZ) <= 1.2 + bodyRadius
  )
    return true;
  if (
    witzlebenY >= 2.09 - bodyRadius &&
    witzlebenY <= 4.13 + bodyRadius &&
    ((Math.abs(Math.abs(witzlebenX) - 0.83) <= 0.13 + bodyRadius &&
      Math.abs(Math.abs(witzlebenZ) - 0.83) <= 0.13 + bodyRadius) ||
      (Math.hypot(witzlebenX, witzlebenZ) <= 0.3 + bodyRadius &&
        witzlebenY < 4.0 + bodyRadius))
  )
    return true;
  if (
    witzlebenY >= 3.92 - bodyRadius &&
    witzlebenY <= 5.6 + bodyRadius &&
    ((Math.abs(Math.abs(witzlebenX) - 0.83) <= 0.17 + bodyRadius &&
      Math.abs(witzlebenZ) <= 1.0 + bodyRadius) ||
      (Math.abs(Math.abs(witzlebenZ) - 0.83) <= 0.17 + bodyRadius &&
        Math.abs(witzlebenX) <= 1.0 + bodyRadius))
  )
    return true;

  const [winterfeldX, winterfeldZ] = worldToLocal(
    x,
    z,
    graves.winterfeld.centerWorldM,
    -0.06,
  );
  const winterfeldY = y - graves.winterfeld.centerWorldM[1];
  if (
    winterfeldY >= -bodyRadius &&
    winterfeldY <= 0.5 + bodyRadius &&
    Math.abs(winterfeldX) <= 1.42 + bodyRadius &&
    Math.abs(winterfeldZ) <= 1.08 + bodyRadius
  ) {
    return true;
  }
  if (
    winterfeldY >= 0.2 - bodyRadius &&
    winterfeldY <= 3.05 + bodyRadius &&
    Math.abs(winterfeldX) <= 1.03 + bodyRadius &&
    Math.abs(winterfeldZ) <= 0.8 + bodyRadius
  ) {
    return true;
  }
  if (
    winterfeldY >= 2.8 - bodyRadius &&
    winterfeldY <= 4.95 + bodyRadius &&
    Math.abs(winterfeldX) <= (winterfeldY < 3.5 ? 1.08 : 0.65) + bodyRadius &&
    Math.abs(winterfeldZ) <= 0.82 + bodyRadius
  ) {
    return true;
  }

  if (
    winterfeldY >= -bodyRadius &&
    winterfeldY <= 1.36 + bodyRadius &&
    ((Math.abs(Math.abs(winterfeldX) - 1.7) <= 0.07 + bodyRadius &&
      Math.abs(winterfeldZ) <= 1.45 + bodyRadius) ||
      (Math.abs(Math.abs(winterfeldZ) - 1.45) <= 0.07 + bodyRadius &&
        Math.abs(winterfeldX) <= 1.7 + bodyRadius))
  )
    return true;

  const [kesselX, kesselZ] = worldToLocal(
    x,
    z,
    graves.vonKessel.centerWorldM,
    -0.12,
  );
  const kesselY = y - graves.vonKessel.centerWorldM[1];
  if (
    kesselY >= -bodyRadius &&
    kesselY <= 0.48 + bodyRadius &&
    Math.abs(kesselX) <= 1.62 + bodyRadius &&
    Math.abs(kesselZ) <= 1.22 + bodyRadius
  ) {
    return true;
  }
  if (
    kesselY >= 0.18 - bodyRadius &&
    kesselY <= 1.08 + bodyRadius &&
    Math.abs(kesselX) <= 0.82 + bodyRadius &&
    Math.abs(kesselZ - 0.87) <= 0.14 + bodyRadius
  ) {
    return true;
  }
  if (
    kesselY >= -bodyRadius &&
    kesselY <= 0.7 + bodyRadius &&
    ((Math.abs(Math.abs(kesselX) - 1.75) <= 0.06 + bodyRadius &&
      Math.abs(kesselZ) <= 1.35 + bodyRadius) ||
      (Math.abs(Math.abs(kesselZ) - 1.35) <= 0.06 + bodyRadius &&
        Math.abs(kesselX) <= 1.75 + bodyRadius))
  ) {
    return true;
  }

  const [rauchX, rauchZ] = worldToLocal(
    x,
    z,
    graves.vonRauch.centerWorldM,
    0.16,
  );
  const rauchY = y - graves.vonRauch.centerWorldM[1];
  if (
    rauchY >= -bodyRadius &&
    rauchY <= 0.32 + bodyRadius &&
    Math.abs(rauchX) <= 2.08 + bodyRadius &&
    Math.abs(rauchZ) <= 1.3 + bodyRadius
  ) {
    return true;
  }
  if (
    rauchY >= 0.1 - bodyRadius &&
    rauchY <= 1.55 + bodyRadius &&
    Math.abs(rauchX) <= 2.08 + bodyRadius &&
    Math.abs(rauchZ - 1.08) <= 0.15 + bodyRadius
  ) {
    return true;
  }
  if (
    rauchY >= 0.8 - bodyRadius &&
    rauchY <= 3.75 + bodyRadius &&
    [1.62, 0.62].some(
      (columnX) =>
        Math.abs(Math.abs(rauchX) - columnX) <= 0.2 + bodyRadius &&
        Math.abs(rauchZ - 1.08) <= 0.2 + bodyRadius,
    )
  ) {
    return true;
  }
  if (
    rauchY >= 1.0 - bodyRadius &&
    rauchY <= 3.62 + bodyRadius &&
    ((Math.abs(rauchX) <= 0.14 + bodyRadius &&
      Math.abs(rauchZ - 0.9) <= 0.14 + bodyRadius) ||
      (Math.abs(rauchX) <= 0.62 + bodyRadius &&
        Math.abs(rauchY - 2.05) <= 0.14 + bodyRadius &&
        Math.abs(rauchZ - 0.9) <= 0.14 + bodyRadius))
  ) {
    return true;
  }
  if (
    rauchY >= 3.2 - bodyRadius &&
    rauchY <= 4.05 + bodyRadius &&
    Math.abs(rauchX) <= 0.84 + bodyRadius &&
    Math.abs(rauchZ - 1.08) <= 0.2 + bodyRadius
  ) {
    return true;
  }

  for (const side of [-1, 1])
    if (
      Math.abs(rauchZ + 0.45) <= 0.26 + bodyRadius &&
      ((rauchY <= 0.7 + bodyRadius &&
        rauchY >= -bodyRadius &&
        Math.abs(rauchX - side * 1.3) <= 0.29 + bodyRadius) ||
        (rauchY <= 2.26 + bodyRadius &&
          rauchY >= 0.7 - bodyRadius &&
          Math.abs(rauchX - side * 1.3) <= 0.07 + bodyRadius) ||
        (Math.abs(rauchY - 1.82) <= 0.07 + bodyRadius &&
          Math.abs(rauchX - side * 1.3) <= 0.41 + bodyRadius))
    )
      return true;

  if (litfinWatchtowerSolidAt(x, y, z, bodyRadius)) return true;

  const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
  const [bellX, bellZ] = worldToLocal(x, z, bell.centerWorldM, bell.rotationY);
  const bellY = y - bell.centerWorldM[1];
  if (bellY >= -bodyRadius && bellY <= bell.measuredHeightM + bodyRadius) {
    const half = bellHalfWidth(bellY);
    if (
      bellY >= 4.65 - bodyRadius &&
      Math.max(Math.abs(bellX), Math.abs(bellZ)) <= half + 0.13 + bodyRadius &&
      Math.max(Math.abs(bellX), Math.abs(bellZ)) >= half - 0.14 - bodyRadius
    )
      return true;
    if (
      bellY >= 2.51 - bodyRadius &&
      bellY <= 4.6 + bodyRadius &&
      Math.hypot(bellX, bellZ) <= 0.8 + bodyRadius
    )
      return true;
    for (const xs of [-1, 1])
      for (const zs of [-1, 1])
        if (
          Math.hypot(bellX - xs * half, bellZ - zs * half) <=
          0.17 + bodyRadius
        )
          return true;
  }
  return wallSolidAt(x, y, z, bodyRadius);
}

/**
 * The raw LoD2 bell envelope is closed, while the photographed steel frame has
 * a real open undercroft. This narrow exception never applies to Litfin or any
 * other source prism, and the authored legs/bell/casing remain solid.
 */
export function invalidenfriedhofWalkableInteriorAt(
  x: number,
  y: number,
  z: number,
  sourceId?: string,
  radius = 0,
): boolean {
  const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
  if (
    sourceId !== bell.lod2BuildingPartId ||
    ![x, y, z, radius].every(Number.isFinite)
  ) {
    return false;
  }
  const bodyRadius = Math.max(0, radius);
  const [localX, localZ] = worldToLocal(
    x,
    z,
    bell.centerWorldM,
    bell.rotationY,
  );
  const localY = y - bell.centerWorldM[1];
  if (
    localY < -bodyRadius ||
    localY > bell.measuredHeightM + bodyRadius ||
    Math.abs(localX) > bell.footprintM[0] / 2 - bodyRadius ||
    Math.abs(localZ) > bell.footprintM[1] / 2 - bodyRadius
  ) {
    return false;
  }
  return !invalidenfriedhofSolidAt(x, y, z, bodyRadius);
}

/** Ownership of the two LoD2 footprints replaced by Minecraft block models. */
export function invalidenfriedhofVoxelReplacementAt(
  x: number,
  z: number,
): "litfin-watchtower" | "auguste-viktoria-bell" | null {
  if (![x, z].every(Number.isFinite)) return null;
  const litfin = INVALIDENFRIEDHOF_DETAIL_PROFILE.litfinWatchtower;
  if (
    withinOrientedBox(
      x,
      z,
      litfin.centerWorldM,
      litfin.rotationY,
      litfin.roofFootprintM[0],
      litfin.roofFootprintM[1],
      0,
    )
  ) {
    return "litfin-watchtower";
  }
  const bell = INVALIDENFRIEDHOF_DETAIL_PROFILE.augusteViktoriaBell;
  if (
    withinOrientedBox(
      x,
      z,
      bell.centerWorldM,
      bell.rotationY,
      bell.footprintM[0],
      bell.footprintM[1],
      0,
    )
  ) {
    return "auguste-viktoria-bell";
  }
  return null;
}

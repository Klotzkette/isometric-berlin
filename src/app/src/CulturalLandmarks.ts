import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Material,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { markArchitecturalAccentInk } from "./architecturalInk";
import { WATER_TOP_Y } from "./MinecraftVoxelWorld";
import { SPREEBOGEN_PARK_PROFILE } from "./SpreebogenPark";
import {
  createStarbucksPariserPlatz,
  STARBUCKS_PARISER_PLATZ_PROFILE,
} from "./StarbucksPariserPlatz";
import { createTipiAmKanzleramt, TIPI_GROUND_Y } from "./TipiAmKanzleramt";

export type CulturalLandmark = {
  name: string;
  world: [number, number, number];
};

export type CulturalFocusCamera = {
  azimuth_degrees: number;
  distance_m: number;
  polar_degrees: number;
  target_height_m: number;
  target_world: [number, number, number];
};

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

const TIPI_NAME = "TIPI am Kanzleramt";
const CARILLON_NAME = "Carillon im Tiergarten";
const SPREEBOGEN_NAME = "Spreebogen";
const HKW_NAME = "Haus der Kulturen der Welt (Schwangere Auster)";
const STARBUCKS_NAME = STARBUCKS_PARISER_PLATZ_PROFILE.name;
// The committed "Carillon im Tiergarten" landmark anchor derives from
// Wikimedia photo geotags (photographer standpoints, see
// geo_data/regierungsviertel/landmarks.geojson) and lands about 29 m
// south-west of the tower; docs/landmark-alignment.md accordingly matches it
// only to John-Foster-Dulles-Allee at 13.70 m, not to the Carillon itself.
// The official mesh carries the real tower: its roof plate in
// tile-3890_58196 spans world x [-313.2, -300.9], z [112.1, 125.0]
// (EPSG:25833 centre 389192.9 E, 5819881.5 N = 52.51776 N, 13.36696 E, the
// surveyed Carillon). Centring the recognition detail on that footprint keeps
// it on the photogrammetry tower instead of showing a second tower beside it.
const CARILLON_MESH_TOWER_WORLD: [number, number] = [-307.06, 118.51];
// Fifth-percentile mesh surface elevation sampled within 14 m of the
// verified tower footprint (the previous 3.778 was sampled around the
// offset photo-geotag anchor).
const CARILLON_GROUND_Y = 4.51;
const SPREE_WATER_Y = WATER_TOP_Y;
const LEGO_GIRAFFE_WORLD: [number, number, number] = [17.884, 4.12, 1023.63];
const SPREE_CENTERLINE_WORLD: Array<[number, number]> = [
  [513.9, -25.1],
  [471, -38.2],
  [431, -58.7],
  [394.5, -84.8],
  [363.7, -117.5],
  [347.1, -159.1],
  [341.8, -203.8],
  [335.6, -248.3],
  [322.2, -291],
  [300.3, -330],
  [270.1, -363.4],
  [235, -391.5],
  [198.1, -417.1],
  [158.5, -438.4],
  [115.9, -452.5],
  [71.6, -460.5],
  [26.7, -461.3],
  [-17.4, -453],
  [-59.7, -437.8],
  [-99.9, -418.3],
  [-134.3, -389.6],
  [-162.6, -354.7],
  [-187.7, -317.4],
  [-211.9, -279.4],
  [-237.6, -242.5],
  [-269.5, -210.9],
  [-305.1, -183.4],
  [-344.1, -161.1],
  [-384.7, -141.7],
  [-425.4, -122.4],
  [-467.3, -106.2],
  [-509.4, -90.2],
  [-551.5, -74.2],
  [-593.5, -58.2],
  [-632.9, -36.5],
  [-670.4, -11.7],
  [-704, 18.2],
  [-707.4, 21.2],
];

function modelMaterial(
  color: number,
  options: {
    metalness?: number;
    opacity?: number;
    roughness?: number;
  } = {},
): MeshStandardMaterial {
  const opacity = options.opacity ?? 1;
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.04,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1.1,
    polygonOffsetUnits: -1.1,
    roughness: options.roughness ?? 0.72,
    side: DoubleSide,
    transparent: opacity < 1,
  });
}

function nightEmitter<T extends MeshStandardMaterial>(
  material: T,
  color: number,
  intensity: number,
): T {
  material.userData.nightEmissive = color;
  material.userData.nightEmissiveIntensity = intensity;
  return material;
}

function addMesh<T extends BufferGeometry, M extends Material>(
  group: Group,
  name: string,
  geometry: T,
  material: M,
  position: [number, number, number],
): Mesh<T, M> {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial,
): Mesh {
  return addMesh(group, name, new BoxGeometry(...size), material, position);
}

function addInstances(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  material: Material,
  transforms: InstanceTransform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

function addSegment(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial,
): Mesh {
  const delta = end.clone().sub(start);
  const mesh = addMesh(
    group,
    name,
    new CylinderGeometry(radius, radius, delta.length(), 8),
    material,
    start.clone().add(end).multiplyScalar(0.5).toArray(),
  );
  mesh.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    delta.normalize(),
  );
  return mesh;
}

function bellGeometry(): LatheGeometry {
  return new LatheGeometry(
    [
      new Vector2(0.1, 0.82),
      new Vector2(0.34, 0.7),
      new Vector2(0.43, 0.18),
      new Vector2(0.58, -0.08),
      new Vector2(0.12, -0.16),
    ],
    12,
  );
}

function createCarillon(anchor: CulturalLandmark): Group {
  const group = new Group();
  group.name = "Granular 42 m Carillon im Tiergarten";
  group.position.set(
    CARILLON_MESH_TOWER_WORLD[0],
    CARILLON_GROUND_Y,
    CARILLON_MESH_TOWER_WORLD[1],
  );
  group.userData = {
    bellCount: 68,
    geometryStatus:
      "Official mesh pylons with published-height roof and 68-bell recognition detail, centred on the mesh tower footprint",
    heightM: 42,
    officialMeshCarriesPylons: true,
    payloadAnchorWorld: anchor.world,
    payloadAnchorNote:
      "Landmark payload anchor stems from photo geotags ~29 m south-west of the tower; the model is re-centred on the official-mesh tower to avoid a duplicate tower",
    sourceUrl: "https://www.berlin.de/kultur-und-tickets/tipps/pfingsten/4877500-3383646-pfingstcarillon-internationales-carillon.html",
  };

  const bronze = modelMaterial(0x9b652d, { metalness: 0.72, roughness: 0.3 });
  const roof = modelMaterial(0x4f5c58, { metalness: 0.58, roughness: 0.42 });
  const cabinGlass = nightEmitter(
    modelMaterial(0x28383d, { metalness: 0.22, opacity: 0.58, roughness: 0.24 }),
    0xffc66d,
    1.5,
  );

  // The photogrammetric source already carries the four granite pylons.
  // This additive layer supplies recognition detail without drawing a second tower.
  addBox(
    group,
    "Carillon overhanging patinated flying-bowl roof",
    [9.8, 0.35, 9.8],
    [0, 41.27, 0],
    roof,
  );
  const roofCap = addMesh(
    group,
    "Carillon shallow four-sided roof cap",
    new ConeGeometry(6.7, 0.7, 4),
    roof,
    [0, 41.65, 0],
  );
  roofCap.rotation.y = Math.PI / 4;
  addBox(
    group,
    "Carillon player cabin at 33 m",
    [4.8, 2.6, 4.8],
    [0, 33, 0],
    cabinGlass,
  );

  const bells: InstanceTransform[] = [];
  const clappers: InstanceTransform[] = [];
  for (let index = 0; index < 68; index += 1) {
    const face = index % 4;
    const slot = Math.floor(index / 4);
    const row = Math.floor(slot / 4);
    const column = slot % 4;
    const y = 29.1 + row * 2.28;
    const offset = (column - 1.5) * 1.18;
    const scale = Math.max(0.46, 1.05 - row * 0.12);
    const position: [number, number, number] =
      face === 0
        ? [offset, y, 3.45]
        : face === 1
          ? [-offset, y, -3.45]
          : face === 2
            ? [3.45, y, offset]
            : [-3.45, y, -offset];
    bells.push({ position, scale: [scale, scale, scale] });
    clappers.push({
      position: [position[0], position[1] - scale * 0.43, position[2]],
      scale: [scale, scale, scale],
    });
  }
  addInstances(
    group,
    "Carillon 68 bronze bells",
    bellGeometry(),
    bronze,
    bells,
  );
  addInstances(
    group,
    "Carillon 68 bell clappers",
    new SphereGeometry(0.12, 8, 6),
    modelMaterial(0x4e3827, { metalness: 0.62, roughness: 0.36 }),
    clappers,
  );

  for (const x of [-3.6, 3.6]) {
    for (const z of [-3.6, 3.6]) {
      addMesh(
        group,
        "Carillon warm base uplight",
        new CylinderGeometry(0.22, 0.3, 0.34, 10),
        nightEmitter(modelMaterial(0x554224), 0xffc86b, 3.8),
        [x, 0.17, z],
      );
    }
  }
  return group;
}

function spreeWaveSurfaceGeometry(): BufferGeometry {
  const curve = new CatmullRomCurve3(
    SPREE_CENTERLINE_WORLD.map(
      ([x, z]) => new Vector3(x, SPREE_WATER_Y, z),
    ),
    false,
    "centripetal",
  );
  const longitudinalSegments = 224;
  const crossSegments = 10;
  const halfWidth = 15;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= longitudinalSegments; row += 1) {
    const t = row / longitudinalSegments;
    const center = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    const crossNormal = new Vector3(-tangent.z, 0, tangent.x);
    for (let column = 0; column <= crossSegments; column += 1) {
      const cross = (column / crossSegments) * 2 - 1;
      const longWave = Math.sin(row * 0.52 + cross * 4.6) * 0.11;
      const crossWave = Math.sin(row * 0.21 - cross * 7.4) * 0.05;
      const vertex = center
        .clone()
        .addScaledVector(crossNormal, cross * halfWidth);
      vertex.y += longWave + crossWave;
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(t, column / crossSegments);
    }
  }

  const rowLength = crossSegments + 1;
  for (let row = 0; row < longitudinalSegments; row += 1) {
    for (let column = 0; column < crossSegments; column += 1) {
      const topLeft = row * rowLength + column;
      const bottomLeft = topLeft + rowLength;
      indices.push(
        topLeft,
        bottomLeft,
        topLeft + 1,
        topLeft + 1,
        bottomLeft,
        bottomLeft + 1,
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    crossSegments,
    longitudinalSegments,
    waveReliefM: 0.32,
  };
  return geometry;
}

function spreeWaveCrestGeometry(surface: BufferGeometry): BufferGeometry {
  const source = surface.getAttribute("position");
  const crossSegments = surface.userData.crossSegments as number;
  const longitudinalSegments = surface.userData.longitudinalSegments as number;
  const rowLength = crossSegments + 1;
  const positions: number[] = [];
  for (const column of [1, 3, 5, 7, 9]) {
    for (let row = 0; row < longitudinalSegments; row += 1) {
      if ((row + column) % 4 === 0) {
        continue;
      }
      for (const index of [row * rowLength + column, (row + 1) * rowLength + column]) {
        positions.push(
          source.getX(index),
          source.getY(index) + 0.035,
          source.getZ(index),
        );
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createSpreeWaveField(): Group {
  const group = new Group();
  group.name = "OSM-derived three-dimensional Spree wave field";
  group.userData = {
    geometryStatus:
      "Thirty-metre display ribbon aligned to the committed OSM Spree centreline; wave relief is procedural",
    source: "geo_data/regierungsviertel/osm.gpkg water layer",
    waveReliefM: 0.32,
  };
  const geometry = spreeWaveSurfaceGeometry();
  const water = new Mesh(
    geometry,
    new MeshPhysicalMaterial({
      color: 0x39a9c7,
      depthWrite: false,
      metalness: 0.04,
      opacity: 0.2,
      roughness: 0.2,
      side: DoubleSide,
      thickness: 0.25,
      transmission: 0.16,
      transparent: true,
    }),
  );
  water.name = "Spree metrically aligned undulating water surface";
  water.castShadow = false;
  water.receiveShadow = true;
  water.renderOrder = 3;
  water.material.userData.nightEmissive = 0x0b4a60;
  water.material.userData.nightEmissiveIntensity = 0.28;
  group.add(water);

  const crests = new LineSegments(
    spreeWaveCrestGeometry(geometry),
    markArchitecturalAccentInk(
      new LineBasicMaterial({
        depthWrite: false,
        opacity: 0.28,
        transparent: true,
      }),
      0xc8f3ef,
      "micro",
    ),
  );
  crests.name = "Spree broken three-dimensional wave crest highlights";
  crests.renderOrder = 4;
  group.add(crests);
  return group;
}

function createLegoGiraffe(): Group {
  const group = new Group();
  group.name = "LEGOLAND Discovery Centre LEGO giraffe recognition model";
  group.position.set(...LEGO_GIRAFFE_WORLD);
  group.rotation.y = MathUtils.degToRad(-18);
  group.userData = {
    heightM: 6.8,
    geometryStatus:
      "Display approximation anchored to the OSM LEGOLAND POI; the sculpture footprint is not surveyed",
    sourceUrls: [
      "https://www.openstreetmap.org/node/429567552",
      "https://commons.wikimedia.org/wiki/File:Sony_Center_Giraffe.JPG",
      "https://www.legolanddiscoverycentre.com/berlin/plane-deinen-besuch/vor-deinem-besuch/anfahrt/",
    ],
  };

  const yellow = modelMaterial(0xf6b900, { roughness: 0.58 });
  const ochre = modelMaterial(0xd98916, { roughness: 0.62 });
  const brown = modelMaterial(0x5d341f, { roughness: 0.72 });
  const black = modelMaterial(0x171717, { roughness: 0.5 });
  const white = modelMaterial(0xf5f2df, { roughness: 0.48 });

  for (const [x, z] of [
    [-0.48, -0.8],
    [0.48, -0.8],
    [-0.48, 0.8],
    [0.48, 0.8],
  ] as Array<[number, number]>) {
    addBox(
      group,
      "LEGO giraffe articulated block leg",
      [0.34, 2.45, 0.34],
      [x, 1.225, z],
      yellow,
    );
    addBox(
      group,
      "LEGO giraffe dark hoof",
      [0.42, 0.24, 0.58],
      [x, 0.12, z - 0.08],
      brown,
    );
  }
  addBox(
    group,
    "LEGO giraffe brick body",
    [1.35, 1.28, 2.25],
    [0, 2.9, 0],
    yellow,
  );
  addBox(
    group,
    "LEGO giraffe long brick neck",
    [0.62, 3.25, 0.66],
    [0, 4.72, -0.68],
    yellow,
  );
  addBox(
    group,
    "LEGO giraffe brick head",
    [0.92, 0.72, 1.34],
    [0, 6.42, -0.98],
    yellow,
  );
  addBox(
    group,
    "LEGO giraffe muzzle",
    [0.78, 0.42, 0.72],
    [0, 6.22, -1.83],
    ochre,
  );

  for (const side of [-1, 1]) {
    const eye = addMesh(
      group,
      "LEGO giraffe eye",
      new SphereGeometry(0.105, 10, 6),
      white,
      [side * 0.39, 6.55, -1.42],
    );
    eye.scale.z = 0.42;
    addMesh(
      group,
      "LEGO giraffe pupil",
      new SphereGeometry(0.052, 8, 5),
      black,
      [side * 0.43, 6.56, -1.47],
    );
    const ear = addMesh(
      group,
      "LEGO giraffe ear",
      new ConeGeometry(0.24, 0.65, 8),
      yellow,
      [side * 0.62, 6.68, -0.83],
    );
    ear.rotation.z = -side * Math.PI / 2;
    addMesh(
      group,
      "LEGO giraffe ossicone",
      new CylinderGeometry(0.075, 0.1, 0.55, 8),
      ochre,
      [side * 0.25, 7.01, -0.84],
    );
    addMesh(
      group,
      "LEGO giraffe ossicone cap",
      new SphereGeometry(0.13, 8, 6),
      brown,
      [side * 0.25, 7.29, -0.84],
    );
  }

  const spots: InstanceTransform[] = [];
  for (let index = 0; index < 30; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const tier = Math.floor(index / 6);
    spots.push({
      position: [
        side * 0.69,
        2.46 + tier * 0.72,
        -0.82 + (index % 3) * 0.82,
      ],
      rotation: [0, 0, side * 0.05],
      scale: [0.78 + (index % 3) * 0.1, 0.75, 0.35],
    });
  }
  addInstances(
    group,
    "LEGO giraffe thirty raised brown coat bricks",
    new BoxGeometry(0.11, 0.34, 0.42),
    brown,
    spots,
  );

  const studs: InstanceTransform[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      studs.push({
        position: [-0.48 + column * 0.32, 3.57, -0.72 + row * 0.72],
      });
    }
  }
  addInstances(
    group,
    "LEGO giraffe visible top studs",
    new CylinderGeometry(0.105, 0.105, 0.08, 10),
    yellow,
    studs,
  );
  return group;
}

export function createCulturalLandmarks(landmarks: CulturalLandmark[]): Group {
  const group = new Group();
  group.name = "Cultural venues, Carillon and Spree detail";
  const byName = new Map(landmarks.map((landmark) => [landmark.name, landmark]));
  const tipi = byName.get(TIPI_NAME);
  const carillon = byName.get(CARILLON_NAME);
  if (tipi) {
    group.add(createTipiAmKanzleramt(tipi.world));
  }
  if (carillon) {
    group.add(createCarillon(carillon));
  }
  const starbucks = byName.get(STARBUCKS_NAME);
  if (starbucks) {
    group.add(createStarbucksPariserPlatz());
  }
  group.add(createSpreeWaveField());
  group.add(createLegoGiraffe());
  return group;
}

export function culturalFocusCamera(name: string): CulturalFocusCamera | null {
  if (name === HKW_NAME) {
    return {
      azimuth_degrees: 38,
      distance_m: 385,
      polar_degrees: 58,
      target_height_m: 15,
      target_world: [-505.17, 3.89, -12.073],
    };
  }
  if (name === TIPI_NAME) {
    return {
      azimuth_degrees: 34,
      distance_m: 74,
      polar_degrees: 61,
      target_height_m: 8.6,
      target_world: [-297.284, TIPI_GROUND_Y, 52.502],
    };
  }
  if (name === CARILLON_NAME) {
    return {
      azimuth_degrees: 42,
      distance_m: 88,
      polar_degrees: 66,
      target_height_m: 20,
      target_world: [
        CARILLON_MESH_TOWER_WORLD[0],
        CARILLON_GROUND_Y,
        CARILLON_MESH_TOWER_WORLD[1],
      ],
    };
  }
  if (name === SPREEBOGEN_NAME) {
    return {
      azimuth_degrees: 130,
      distance_m: 120,
      polar_degrees: 58,
      target_height_m: 4,
      target_world: [
        SPREEBOGEN_PARK_PROFILE.centreX,
        4.8,
        (SPREEBOGEN_PARK_PROFILE.southZ + SPREEBOGEN_PARK_PROFILE.northZ) / 2,
      ],
    };
  }
  if (name === STARBUCKS_NAME) {
    return {
      // Look from the exterior angle bisector of the west and south LoD2
      // facade normals. The former 222-degree preset sat behind both skins
      // and put a phone camera inside K00005Hq's wall.
      azimuth_degrees: -40,
      distance_m: 58,
      polar_degrees: 68,
      target_height_m: 2.4,
      target_world: [
        STARBUCKS_PARISER_PLATZ_PROFILE.southwestCornerWorldM[0] + 2.2,
        STARBUCKS_PARISER_PLATZ_PROFILE.groundY,
        STARBUCKS_PARISER_PLATZ_PROFILE.southwestCornerWorldM[1] - 1.2,
      ],
    };
  }
  return null;
}

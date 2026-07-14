import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import {
  type ArchitecturalSignature as ReichstagDomeSignature,
  createOfficialReichstagDome,
} from "./ReichstagDome";

export type FocusCamera = {
  azimuth_degrees: number;
  distance_m: number;
  polar_degrees: number;
  target_height_m: number;
  target_world?: [number, number, number];
};

type SignatureBase = {
  anchor_world: [number, number, number];
  focus_camera: FocusCamera;
  geometry_status: string;
  id: string;
  kind: string;
  landmark_name: string;
  rotation_y_degrees: number;
  source_url: string;
};

export type ReichstagModelSignature = SignatureBase & {
  body_height_m: number;
  depth_m: number;
  kind: "reichstag_model";
  width_m: number;
};

export type ChancelleryModelSignature = SignatureBase & {
  cube_depth_m: number;
  cube_height_m: number;
  cube_offset_world: [number, number, number];
  cube_width_m: number;
  forecourt_offset_world?: [number, number, number] | null;
  forecourt_sculpture_height_m?: number;
  kind: "chancellery_model";
  office_height_m: number;
  office_segments: Array<{
    depth_m: number;
    height_m: number;
    offset_world: [number, number, number];
    width_m: number;
  }>;
  overall_depth_m: number;
  overall_width_m: number;
};

export type HauptbahnhofModelSignature = SignatureBase & {
  east_west_roof_length_m: number;
  east_west_roof_width_m: number;
  kind: "hauptbahnhof_model";
  north_south_hall_length_m: number;
  north_south_hall_width_m: number;
  office_bridge_height_m: number;
};

export type BrandenburgGateModelSignature = SignatureBase & {
  column_height_m: number;
  column_rows: number;
  columns_per_row: number;
  depth_m: number;
  gate_height_m: number;
  kind: "brandenburg_gate_model";
  total_height_m: number;
  width_m: number;
};

export type ArchitecturalSignature =
  | ReichstagDomeSignature
  | ReichstagModelSignature
  | ChancelleryModelSignature
  | HauptbahnhofModelSignature
  | BrandenburgGateModelSignature;

const EDGE_COLOR = 0x26383d;

function nightEmitter<T extends MeshStandardMaterial>(
  material: T,
  color: number,
  intensity: number,
): T {
  material.userData.nightEmissive = color;
  material.userData.nightEmissiveIntensity = intensity;
  return material;
}

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
    metalness: options.metalness ?? 0.05,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1.4,
    polygonOffsetUnits: -1.4,
    roughness: options.roughness ?? 0.68,
    side: DoubleSide,
    transparent: opacity < 1,
    depthWrite: opacity >= 0.75,
  });
}

function addEdges(group: Group, mesh: Mesh, opacity = 0.78): LineSegments {
  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry, 24),
    new LineBasicMaterial({
      color: EDGE_COLOR,
      opacity,
      transparent: opacity < 1,
    }),
  );
  edges.name = `${mesh.name} model edges`;
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  edges.scale.copy(mesh.scale);
  edges.renderOrder = 8;
  group.add(edges);
  return edges;
}

function addBoxOutline(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  opacity = 0.7,
  color = EDGE_COLOR,
): LineSegments {
  const source = new BoxGeometry(...size);
  const edges = new LineSegments(
    new EdgesGeometry(source, 24),
    new LineBasicMaterial({
      color,
      opacity,
      transparent: opacity < 1,
    }),
  );
  source.dispose();
  edges.name = name;
  edges.position.set(...position);
  edges.renderOrder = 8;
  group.add(edges);
  return edges;
}

function addBox(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  edgeOpacity = 0,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = material.opacity >= 0.5;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (edgeOpacity > 0) {
    addEdges(group, mesh, edgeOpacity);
  }
  return mesh;
}

function placeMetricGroup(group: Group, signature: SignatureBase): void {
  group.position.fromArray(signature.anchor_world);
  group.rotation.y = MathUtils.degToRad(signature.rotation_y_degrees);
  group.userData = { ...signature };
}

function addCylinderBetween(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  radialSegments = 10,
): Mesh {
  const direction = end.clone().sub(start);
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, direction.length(), radialSegments),
    material,
  );
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function addGermanFlag(
  group: Group,
  name: string,
  position: [number, number, number],
): void {
  const pole = modelMaterial(0x6f7675, { metalness: 0.62, roughness: 0.3 });
  const poleHeight = 9;
  const poleMesh = new Mesh(new CylinderGeometry(0.12, 0.16, poleHeight, 10), pole);
  poleMesh.name = `${name} flagpole`;
  poleMesh.position.set(position[0], position[1] + poleHeight / 2, position[2]);
  poleMesh.castShadow = true;
  group.add(poleMesh);

  const stripeColors = [0x151515, 0xc82f35, 0xe5b93f];
  for (let index = 0; index < stripeColors.length; index += 1) {
    const stripe = new Mesh(
      new PlaneGeometry(4.8, 0.76, 4, 1),
      new MeshBasicMaterial({
        color: stripeColors[index],
        side: DoubleSide,
      }),
    );
    stripe.name = `${name} German flag stripe ${index + 1}`;
    stripe.position.set(
      position[0] + 2.4,
      position[1] + poleHeight - 0.5 - index * 0.76,
      position[2],
    );
    stripe.rotation.y = -0.06;
    stripe.rotation.z = 0.04 * (index - 1);
    group.add(stripe);
  }
}

function addEuropeanFlag(
  group: Group,
  name: string,
  position: [number, number, number],
): void {
  const poleMaterial = modelMaterial(0x6f7675, {
    metalness: 0.62,
    roughness: 0.3,
  });
  const poleHeight = 9;
  const pole = new Mesh(
    new CylinderGeometry(0.12, 0.16, poleHeight, 10),
    poleMaterial,
  );
  pole.name = `${name} flagpole`;
  pole.position.set(position[0], position[1] + poleHeight / 2, position[2]);
  pole.castShadow = true;
  group.add(pole);

  const flag = new Mesh(
    new PlaneGeometry(4.8, 2.28, 4, 2),
    new MeshBasicMaterial({ color: 0x174c9c, side: DoubleSide }),
  );
  flag.name = `${name} European Union flag`;
  flag.position.set(position[0] + 2.4, position[1] + poleHeight - 1.25, position[2]);
  flag.rotation.y = -0.06;
  group.add(flag);

  const stars = new InstancedMesh(
    new CircleGeometry(0.09, 5),
    new MeshBasicMaterial({ color: 0xffd447, side: DoubleSide }),
    12,
  );
  stars.name = `${name} European Union flag stars`;
  const dummy = new Object3D();
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    dummy.position.set(
      position[0] + 2.4 + Math.cos(angle) * 0.58,
      position[1] + poleHeight - 1.25 + Math.sin(angle) * 0.58,
      position[2] - 0.015,
    );
    dummy.rotation.y = -0.06;
    dummy.updateMatrix();
    stars.setMatrixAt(index, dummy.matrix);
  }
  stars.instanceMatrix.needsUpdate = true;
  group.add(stars);
}

function addReichstagWindowGrid(
  group: Group,
  signature: ReichstagModelSignature,
): void {
  const windowMaterial = nightEmitter(
    modelMaterial(0x34474e, {
      metalness: 0.12,
      opacity: 0.16,
      roughness: 0.24,
    }),
    0xffd58a,
    1.7,
  );
  const floors = [6.1, 10.5, 14.9, 19.3];
  const longCount = 14;
  const shortCount = 10;
  const longWindows = new InstancedMesh(
    new BoxGeometry(4.25, 2.15, 0.16),
    windowMaterial,
    floors.length * longCount * 2,
  );
  longWindows.name = "Reichstag north/south facade windows";
  const shortWindows = new InstancedMesh(
    new BoxGeometry(0.16, 2.15, 4.25),
    windowMaterial,
    floors.length * shortCount * 2,
  );
  shortWindows.name = "Reichstag east/west facade windows";
  const dummy = new Object3D();
  let longIndex = 0;
  let shortIndex = 0;
  for (const y of floors) {
    for (const side of [-1, 1]) {
      for (let index = 0; index < longCount; index += 1) {
        dummy.position.set(
          -signature.width_m / 2 + 8 + (index / (longCount - 1)) * (signature.width_m - 16),
          y,
          side * (signature.depth_m / 2 + 0.1),
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        longWindows.setMatrixAt(longIndex, dummy.matrix);
        longIndex += 1;
      }
      for (let index = 0; index < shortCount; index += 1) {
        dummy.position.set(
          side * (signature.width_m / 2 + 0.1),
          y,
          -signature.depth_m / 2 + 13 +
            (index / (shortCount - 1)) * (signature.depth_m - 26),
        );
        dummy.updateMatrix();
        shortWindows.setMatrixAt(shortIndex, dummy.matrix);
        shortIndex += 1;
      }
    }
  }
  longWindows.instanceMatrix.needsUpdate = true;
  shortWindows.instanceMatrix.needsUpdate = true;
  group.add(longWindows, shortWindows);
}

function triangularPrism(width: number, height: number, depth: number): BufferGeometry {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -halfDepth,
        0,
        -halfWidth,
        -halfDepth,
        0,
        halfWidth,
        -halfDepth,
        height,
        0,
        halfDepth,
        0,
        -halfWidth,
        halfDepth,
        0,
        halfWidth,
        halfDepth,
        height,
        0,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5,
    4,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function createReichstagModel(signature: ReichstagModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Reichstag recognition model";
  placeMetricGroup(group, signature);

  const stoneAccent = modelMaterial(0xd8d0bf, {
    opacity: 0.48,
    roughness: 0.82,
  });
  const entranceShadow = modelMaterial(0x343a39, {
    opacity: 0.72,
    roughness: 0.94,
  });
  addBoxOutline(
    group,
    "Reichstag LoD2 envelope",
    [signature.width_m, signature.body_height_m, signature.depth_m],
    [0, signature.body_height_m / 2, 0],
    0.58,
  );

  const towerSize = 19;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      addBoxOutline(
        group,
        `Reichstag corner tower ${x}:${z}`,
        [towerSize, signature.body_height_m + 2.4, towerSize],
        [
          x * (signature.width_m / 2 - towerSize / 2 - 2),
          (signature.body_height_m + 2.4) / 2,
          z * (signature.depth_m / 2 - towerSize / 2 - 2),
        ],
        0.76,
      );
      addBox(
        group,
        "Reichstag corner-tower roof cornice",
        [towerSize + 1.2, 0.8, towerSize + 1.2],
        [
          x * (signature.width_m / 2 - towerSize / 2 - 2),
          signature.body_height_m + 1.95,
          z * (signature.depth_m / 2 - towerSize / 2 - 2),
        ],
        stoneAccent,
        0.72,
      );
      const flagPosition: [number, number, number] = [
        x * (signature.width_m / 2 - towerSize / 2 - 2),
        signature.body_height_m + 2.35,
        z * (signature.depth_m / 2 - towerSize / 2 - 2),
      ];
      if (x === 1 && z === 1) {
        addEuropeanFlag(group, `Reichstag tower ${x}:${z}`, flagPosition);
      } else {
        addGermanFlag(group, `Reichstag tower ${x}:${z}`, flagPosition);
      }
    }
  }

  for (const z of [-1, 1]) {
    addBox(
      group,
      "Reichstag long roof balustrade",
      [signature.width_m - 35, 0.72, 0.7],
      [0, signature.body_height_m + 0.6, z * (signature.depth_m / 2 - 2.2)],
      stoneAccent,
      0.62,
    );
  }
  for (const x of [-1, 1]) {
    addBox(
      group,
      "Reichstag short roof balustrade",
      [0.7, 0.72, signature.depth_m - 35],
      [x * (signature.width_m / 2 - 2.2), signature.body_height_m + 0.6, 0],
      stoneAccent,
      0.62,
    );
  }

  const westX = -signature.width_m / 2 - 3.6;
  const columnHeight = 14.5;
  for (let index = 0; index < 6; index += 1) {
    const column = new Mesh(
      new CylinderGeometry(1.05, 1.25, columnHeight, 16),
      stoneAccent,
    );
    column.name = `Reichstag west portico column ${index + 1}`;
    column.position.set(westX, 4 + columnHeight / 2, -17.5 + index * 7);
    column.castShadow = true;
    group.add(column);
    const base = new Mesh(new CylinderGeometry(1.55, 1.7, 0.55, 18), stoneAccent);
    base.name = `Reichstag west portico column base ${index + 1}`;
    base.position.set(westX, 4.28, -17.5 + index * 7);
    group.add(base);
    const capital = new Mesh(
      new CylinderGeometry(1.65, 1.25, 0.72, 18),
      stoneAccent,
    );
    capital.name = `Reichstag west portico capital ${index + 1}`;
    capital.position.set(westX, 18.15, -17.5 + index * 7);
    group.add(capital);
  }
  for (let index = 0; index < 5; index += 1) {
    addBox(
      group,
      "Reichstag west entrance shadow",
      [0.28, 8.6, 4.2],
      [westX + 0.7, 8.35, -14 + index * 7],
      entranceShadow,
    );
  }
  addBox(
    group,
    "Reichstag west portico entablature",
    [7.4, 2.2, 41],
    [westX, 19.1, 0],
    stoneAccent,
    0.9,
  );
  const pediment = new Mesh(triangularPrism(39, 6.3, 7), stoneAccent);
  pediment.name = "Reichstag west triangular pediment";
  pediment.position.set(westX, 20.2, 0);
  pediment.castShadow = true;
  group.add(pediment);
  addEdges(group, pediment, 0.9);
  addReichstagWindowGrid(group, signature);

  return group;
}

function addChancelleryOfficeBand(
  group: Group,
  x: number,
  z: number,
  width: number,
  depth: number,
  height: number,
): void {
  const glass = nightEmitter(
    modelMaterial(0x70bfd0, {
      metalness: 0.12,
      opacity: 0.18,
      roughness: 0.22,
    }),
    0xffd994,
    1.25,
  );
  const concrete = modelMaterial(0xe6ebe8, {
    opacity: 0.74,
    roughness: 0.76,
  });
  addBox(
    group,
    "Chancellery office-band glass volume",
    [width, height - 2.2, depth],
    [x, height / 2, z],
    glass,
    0.52,
  );
  addBox(
    group,
    "Chancellery office-band roof line",
    [width, 1.15, depth + 0.8],
    [x, height - 0.55, z],
    concrete,
    0.46,
  );
  const columnCount = Math.max(8, Math.round(width / 16));
  for (const side of [-1, 1]) {
    for (let index = 0; index <= columnCount; index += 1) {
      const columnX = x - width / 2 + (index / columnCount) * width;
      addBox(
        group,
        "Chancellery office-band facade mullion",
        [0.4, height - 2.8, 0.42],
        [columnX, height / 2 - 0.2, z + side * (depth / 2 + 0.13)],
        concrete,
      );
    }
  }
  for (const floorY of [3.6, 7.2, 10.8, 14.4]) {
    addBox(
      group,
      "Chancellery office-band floor plate",
      [width, 0.34, depth + 0.5],
      [x, floorY, z],
      concrete,
      0.2,
    );
  }
}

function addChancelleryForecourt(
  group: Group,
  signature: ChancelleryModelSignature,
): void {
  if (!signature.forecourt_offset_world) {
    return;
  }
  const [x, , z] = signature.forecourt_offset_world;
  const paving = modelMaterial(0xcfd3cf, {
    opacity: 0.34,
    roughness: 0.86,
  });
  const joint = modelMaterial(0x7f8b89, {
    opacity: 0.55,
    roughness: 0.9,
  });
  addBox(
    group,
    "Chancellery Ehrenhof paving",
    [76, 0.16, 52],
    [x, 0.08, z],
    paving,
  );
  for (let index = -4; index <= 4; index += 1) {
    addBox(
      group,
      "Chancellery Ehrenhof east-west paving joint",
      [76, 0.025, 0.08],
      [x, 0.18, z + index * 5.6],
      joint,
    );
  }
  for (let index = -6; index <= 6; index += 1) {
    addBox(
      group,
      "Chancellery Ehrenhof north-south paving joint",
      [0.08, 0.025, 52],
      [x + index * 5.6, 0.18, z],
      joint,
    );
  }

  const sculptureHeight = signature.forecourt_sculpture_height_m ?? 5.5;
  const steel = modelMaterial(0x8d4938, {
    metalness: 0.48,
    roughness: 0.52,
  });
  addBox(
    group,
    "Eduardo Chillida Berlin sculpture plinth",
    [8.4, 0.42, 5.6],
    [x, 0.4, z],
    modelMaterial(0x787c78, { roughness: 0.9 }),
    0.4,
  );
  for (const side of [-1, 1]) {
    const sculptureX = x + side * 1.7;
    addBox(
      group,
      "Eduardo Chillida Berlin vertical steel body",
      [1.05, sculptureHeight, 1.2],
      [sculptureX, 0.62 + sculptureHeight / 2, z],
      steel,
      0.55,
    );
    for (const level of [0.28, 0.72]) {
      addBox(
        group,
        "Eduardo Chillida Berlin interlocking arm",
        [3.2, 0.72, 1.05],
        [
          sculptureX - side * 1.05,
          0.62 + sculptureHeight * level,
          z + side * (level > 0.5 ? 0.62 : -0.62),
        ],
        steel,
        0.5,
      );
    }
  }
}

function createChancelleryModel(signature: ChancelleryModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Federal Chancellery recognition model";
  placeMetricGroup(group, signature);

  const concrete = modelMaterial(0xe8ece9, {
    opacity: 0.58,
    roughness: 0.78,
  });
  const glass = nightEmitter(
    modelMaterial(0x6fb9c8, {
      metalness: 0.08,
      opacity: 0.24,
      roughness: 0.2,
    }),
    0xffd994,
    1.45,
  );
  const cubeX = signature.cube_offset_world[0];
  const cubeZ = signature.cube_offset_world[2];
  addBox(
    group,
    "Chancellery central glass cube",
    [
      signature.cube_width_m - 7,
      signature.cube_height_m - 5,
      signature.cube_depth_m - 7,
    ],
    [cubeX, signature.cube_height_m / 2, cubeZ],
    glass,
    0.7,
  );

  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      addBox(
        group,
        "Chancellery central concrete pylon",
        [4.6, signature.cube_height_m, 4.6],
        [
          cubeX + x * (signature.cube_width_m / 2 - 2.3),
          signature.cube_height_m / 2,
          cubeZ + z * (signature.cube_depth_m / 2 - 2.3),
        ],
        concrete,
        0.82,
      );
    }
  }
  addBox(
    group,
    "Chancellery central roof frame",
    [signature.cube_width_m, 2.1, signature.cube_depth_m],
    [cubeX, signature.cube_height_m - 1.05, cubeZ],
    concrete,
    0.84,
  );

  const windowGlass = nightEmitter(
    new MeshPhysicalMaterial({
      color: 0x5fcce0,
      depthWrite: false,
      metalness: 0.04,
      opacity: 0.42,
      roughness: 0.12,
      side: DoubleSide,
      transparent: true,
      transmission: 0.2,
    }),
    0xffcf78,
    2.2,
  );
  const archFrame = modelMaterial(0xf0f1ec, { roughness: 0.68 });
  for (const xDirection of [-1, 1]) {
    const glassWindow = new Mesh(new CircleGeometry(17.2, 64, 0, Math.PI), windowGlass);
    glassWindow.name = "Chancellery semicircular leadership window";
    glassWindow.rotation.y = Math.PI / 2;
    glassWindow.position.set(
      cubeX + xDirection * (signature.cube_width_m / 2 + 0.12),
      10.5,
      cubeZ,
    );
    group.add(glassWindow);
    const frame = new Mesh(new RingGeometry(16.5, 18.1, 64, 2, 0, Math.PI), archFrame);
    frame.name = "Chancellery semicircular window frame";
    frame.rotation.y = Math.PI / 2;
    frame.position.copy(glassWindow.position).add(
      new Vector3(xDirection * 0.08, 0, 0),
    );
    group.add(frame);
    for (const zOffset of [-10.5, 0, 10.5]) {
      addBox(
        group,
        "Chancellery semicircular window vertical mullion",
        [0.2, 15.5, 0.38],
        [
          cubeX + xDirection * (signature.cube_width_m / 2 + 0.2),
          17.2,
          cubeZ + zOffset,
        ],
        archFrame,
      );
    }
    for (const y of [12.5, 17.5, 22.5]) {
      addBox(
        group,
        "Chancellery semicircular window horizontal mullion",
        [0.2, 0.38, 29],
        [
          cubeX + xDirection * (signature.cube_width_m / 2 + 0.21),
          y,
          cubeZ,
        ],
        archFrame,
      );
    }
  }

  for (const segment of signature.office_segments) {
    addChancelleryOfficeBand(
      group,
      segment.offset_world[0],
      segment.offset_world[2],
      segment.width_m,
      segment.depth_m,
      segment.height_m,
    );
  }
  addChancelleryForecourt(group, signature);
  return group;
}

function barrelRoofGeometry(
  length: number,
  width: number,
  height: number,
  alongX: boolean,
  segments = 48,
): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const longitudinal of [-length / 2, length / 2]) {
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI;
      const lateral = Math.cos(angle) * (width / 2);
      const y = Math.sin(angle) * height;
      vertices.push(
        ...(alongX
          ? [longitudinal, y, lateral]
          : [lateral, y, longitudinal]),
      );
    }
  }
  const row = segments + 1;
  for (let index = 0; index < segments; index += 1) {
    const a = index;
    const b = index + 1;
    const c = row + index;
    const d = row + index + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBarrelRoof(
  group: Group,
  name: string,
  length: number,
  width: number,
  height: number,
  baseY: number,
  alongX: boolean,
): void {
  const glass = nightEmitter(
    new MeshPhysicalMaterial({
      color: 0x72d0e3,
      depthTest: false,
      depthWrite: false,
      metalness: 0.04,
      opacity: 0.24,
      roughness: 0.12,
      side: DoubleSide,
      transparent: true,
      transmission: 0.28,
    }),
    0xaedfff,
    1.1,
  );
  const steel = modelMaterial(0x47616d, { metalness: 0.66, roughness: 0.28 });
  const roof = new Mesh(barrelRoofGeometry(length, width, height, alongX), glass);
  roof.name = name;
  roof.position.y = baseY + 0.18;
  roof.renderOrder = 6;
  group.add(roof);

  const ribCount = Math.max(14, Math.round(length / 8));
  for (let ribIndex = 0; ribIndex <= ribCount; ribIndex += 1) {
    const longitudinal = -length / 2 + (ribIndex / ribCount) * length;
    const points = Array.from({ length: 25 }, (_, index) => {
      const angle = (index / 24) * Math.PI;
      const lateral = Math.cos(angle) * (width / 2);
      const y = baseY + Math.sin(angle) * height;
      return alongX
        ? new Vector3(longitudinal, y, lateral)
        : new Vector3(lateral, y, longitudinal);
    });
    const rib = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(points), 32, 0.12, 4, false),
      steel,
    );
    rib.name = `${name} steel arch rib`;
    rib.castShadow = true;
    group.add(rib);
  }

  for (const fraction of Array.from(
    { length: 11 },
    (_, index) => (index + 1) / 12,
  )) {
    const angle = fraction * Math.PI;
    const lateral = Math.cos(angle) * (width / 2);
    const y = baseY + Math.sin(angle) * height;
    addBox(
      group,
      `${name} longitudinal steel purlin`,
      alongX ? [length, 0.18, 0.18] : [0.18, 0.18, length],
      alongX ? [0, y, lateral] : [lateral, y, 0],
      steel,
    );
  }
}

function addStationOfficeBridge(
  group: Group,
  x: number,
  depth: number,
  height: number,
): void {
  const glass = nightEmitter(
    modelMaterial(0x75b4c4, {
      metalness: 0.12,
      opacity: 0.16,
      roughness: 0.2,
    }),
    0xffdca0,
    1.35,
  );
  const frame = modelMaterial(0x60757c, {
    metalness: 0.42,
    roughness: 0.38,
  });
  addBox(
    group,
    "Hauptbahnhof office-bridge glazed volume",
    [18.4, height - 2.2, depth - 1.2],
    [x, height / 2, 0],
    glass,
  );
  addBoxOutline(
    group,
    "Hauptbahnhof 46 m office bridge",
    [20, height, depth],
    [x, height / 2, 0],
    0.32,
    0x6f9eaa,
  );
  for (const floorY of [9, 18, 27, 36]) {
    addBoxOutline(
      group,
      "Hauptbahnhof office-bridge floor line",
      [20.5, 0.36, depth],
      [x, floorY, 0],
      0.3,
      0x769da7,
    );
  }
  const mullionCount = Math.max(10, Math.round(depth / 12));
  for (const side of [-1, 1]) {
    for (let index = 0; index <= mullionCount; index += 1) {
      addBox(
        group,
        "Hauptbahnhof office-bridge facade mullion",
        [0.24, height - 2.4, 0.28],
        [
          x + side * 9.3,
          height / 2,
          -depth / 2 + (index / mullionCount) * depth,
        ],
        frame,
      );
    }
  }
}

function addStationTrain(
  group: Group,
  options: {
    bodyColor: number;
    length: number;
    name: string;
    stripeColor: number;
    windowColor: number;
    x: number;
    z: number;
  },
): void {
  const bodyMaterial = modelMaterial(options.bodyColor, {
    metalness: 0.16,
    roughness: 0.38,
  });
  const stripeMaterial = modelMaterial(options.stripeColor, {
    roughness: 0.48,
  });
  const windowMaterial = nightEmitter(
    modelMaterial(options.windowColor, {
      metalness: 0.24,
      opacity: 0.88,
      roughness: 0.2,
    }),
    0xffd688,
    1.5,
  );
  const body = new Mesh(
    new CapsuleGeometry(1.58, options.length - 3.16, 5, 12),
    bodyMaterial,
  );
  body.name = `${options.name} rounded body`;
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 1, 0.92);
  body.position.set(options.x, 13.15, options.z);
  body.castShadow = true;
  group.add(body);
  addBox(
    group,
    `${options.name} colour stripe`,
    [options.length - 4.6, 0.34, 3.05],
    [options.x, 12.55, options.z],
    stripeMaterial,
  );
  addBox(
    group,
    `${options.name} dark roof equipment`,
    [options.length * 0.46, 0.18, 1.72],
    [options.x, 14.75, options.z],
    windowMaterial,
  );

  const windowCount = Math.max(8, Math.floor(options.length / 9));
  for (const side of [-1, 1]) {
    for (let index = 0; index < windowCount; index += 1) {
      const windowX =
        -options.length / 2 + 5.5 + (index / (windowCount - 1)) * (options.length - 11);
      addBox(
        group,
        `${options.name} side window`,
        [4.4, 0.88, 0.08],
        [options.x + windowX, 13.55, options.z + side * 1.5],
        windowMaterial,
      );
    }
  }
  for (const end of [-1, 1]) {
    addBox(
      group,
      `${options.name} cab windscreen`,
      [0.1, 0.9, 1.9],
      [
        options.x + end * (options.length / 2 - 0.72),
        13.66,
        options.z,
      ],
      windowMaterial,
    );
  }
}

function createHauptbahnhofModel(signature: HauptbahnhofModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Berlin Hauptbahnhof recognition model";
  placeMetricGroup(group, signature);

  const deck = modelMaterial(0x42545b, { metalness: 0.34, roughness: 0.7 });
  const rail = modelMaterial(0x74868b, { metalness: 0.78, roughness: 0.26 });
  const platform = modelMaterial(0xaeb7b4, { roughness: 0.82 });
  addBox(
    group,
    "Hauptbahnhof east-west elevated track deck",
    [signature.east_west_roof_length_m, 1.1, signature.east_west_roof_width_m - 3],
    [0, 9.8, 0],
    deck,
    0.5,
  );
  for (const trackZ of [-12, -4, 4, 12]) {
    for (const railOffset of [-0.76, 0.76]) {
      addBox(
        group,
        "Hauptbahnhof upper-level rail",
        [signature.east_west_roof_length_m + 110, 0.16, 0.14],
        [0, 10.48, trackZ + railOffset],
        rail,
      );
    }
  }
  for (const platformZ of [-8, 8]) {
    addBox(
      group,
      "Hauptbahnhof upper platform",
      [224, 0.42, 4.3],
      [0, 10.52, platformZ],
      platform,
      0.25,
    );
  }
  addStationTrain(group, {
    bodyColor: 0xf1f2ef,
    length: 126,
    name: "Hauptbahnhof stationary ICE",
    stripeColor: 0xd63d3d,
    windowColor: 0x173b4b,
    x: 130,
    z: -12,
  });
  addStationTrain(group, {
    bodyColor: 0xe8c23d,
    length: 74,
    name: "Hauptbahnhof stationary Berlin S-Bahn",
    stripeColor: 0xb42f2f,
    windowColor: 0x213f48,
    x: -155,
    z: 4,
  });
  addBarrelRoof(
    group,
    "Hauptbahnhof 321 m east-west glass roof",
    signature.east_west_roof_length_m,
    signature.east_west_roof_width_m,
    12.5,
    10.4,
    true,
  );
  addBarrelRoof(
    group,
    "Hauptbahnhof 160 m north-south hall",
    signature.north_south_hall_length_m,
    signature.north_south_hall_width_m,
    19,
    8.2,
    false,
  );
  const officeX = signature.north_south_hall_width_m / 2 + 18;
  addStationOfficeBridge(
    group,
    -officeX,
    signature.north_south_hall_length_m,
    signature.office_bridge_height_m,
  );
  addStationOfficeBridge(
    group,
    officeX,
    signature.north_south_hall_length_m,
    signature.office_bridge_height_m,
  );
  return group;
}

function createBrandenburgGateModel(
  signature: BrandenburgGateModelSignature,
): Group {
  const group = new Group();
  group.name = "Metre-scale Brandenburg Gate recognition model";
  placeMetricGroup(group, signature);

  const sandstone = modelMaterial(0xd9c79f, { roughness: 0.84 });
  const sandstoneShadow = modelMaterial(0xbba77c, { roughness: 0.9 });
  const recess = modelMaterial(0x4a4b45, { opacity: 0.74, roughness: 0.92 });
  const bronze = modelMaterial(0x2e826d, { metalness: 0.62, roughness: 0.38 });
  const passageInterior = new MeshStandardMaterial({
    color: 0x303633,
    roughness: 0.96,
    side: FrontSide,
  });
  const colonnadeWidth = 43;
  for (let row = 0; row < signature.column_rows; row += 1) {
    const x = row === 0 ? -3.25 : 3.25;
    for (let index = 0; index < signature.columns_per_row; index += 1) {
      const column = new Mesh(
        new CylinderGeometry(1.05, 1.34, signature.column_height_m, 20),
        sandstone,
      );
      column.name = `Brandenburg Gate Doric column ${row + 1}:${index + 1}`;
      column.position.set(
        x,
        signature.column_height_m / 2,
        -colonnadeWidth / 2 + (index / 5) * colonnadeWidth,
      );
      column.castShadow = true;
      group.add(column);
      const base = new Mesh(new CylinderGeometry(1.55, 1.68, 0.46, 20), sandstone);
      base.name = `Brandenburg Gate column base ${row + 1}:${index + 1}`;
      base.position.set(x, 0.23, column.position.z);
      group.add(base);
      const capital = new Mesh(
        new CylinderGeometry(1.62, 1.16, 0.72, 20),
        sandstone,
      );
      capital.name = `Brandenburg Gate Doric capital ${row + 1}:${index + 1}`;
      capital.position.set(x, signature.column_height_m - 0.25, column.position.z);
      group.add(capital);
    }
  }

  for (let passage = 0; passage < 5; passage += 1) {
    const passageZ = -colonnadeWidth / 2 + ((passage + 0.5) / 5) * colonnadeWidth;
    addBox(
      group,
      "Brandenburg Gate passage paving shadow",
      [signature.depth_m - 0.6, 0.08, 6.1],
      [0, 0.05, passageZ],
      recess,
    );
    const shadow = new Mesh(new PlaneGeometry(6.1, 11.8), passageInterior);
    shadow.name = "Brandenburg Gate shaded passage interior";
    shadow.rotation.y = Math.PI / 2;
    shadow.position.set(-signature.depth_m / 2 + 0.22, 6.05, passageZ);
    shadow.receiveShadow = true;
    group.add(shadow);
  }

  const pavilionWidth = (signature.width_m - colonnadeWidth) / 2;
  const pavilionHeight = 15.6;
  for (const z of [-1, 1]) {
    const pavilionZ = z * (signature.width_m / 2 - pavilionWidth / 2);
    addBox(
      group,
      "Brandenburg Gate side pavilion",
      [signature.depth_m, pavilionHeight, pavilionWidth],
      [
        0,
        pavilionHeight / 2,
        pavilionZ,
      ],
      sandstoneShadow,
      0.88,
    );
    for (const x of [-1, 1]) {
      addBox(
        group,
        "Brandenburg Gate pavilion facade recess",
        [0.24, 10.8, pavilionWidth - 2.8],
        [x * (signature.depth_m / 2 - 0.12), 9.2, pavilionZ],
        recess,
      );
    }
    for (const x of [-1, 1]) {
      for (const offsetZ of [-2.5, 2.5]) {
        addBox(
          group,
          "Brandenburg Gate pavilion pilaster",
          [0.48, 12.4, 1.05],
          [x * (signature.depth_m / 2 - 0.24), 7.4, pavilionZ + offsetZ],
          sandstone,
          0.4,
        );
      }
    }
    addBox(
      group,
      "Brandenburg Gate pavilion cornice",
      [signature.depth_m, 1.05, pavilionWidth],
      [0, pavilionHeight + 0.2, pavilionZ],
      sandstone,
      0.78,
    );
  }
  addBox(
    group,
    "Brandenburg Gate entablature",
    [signature.depth_m, 3.1, colonnadeWidth + 1.8],
    [0, signature.column_height_m + 1.2, 0],
    sandstone,
    0.9,
  );
  addBox(
    group,
    "Brandenburg Gate attic",
    [signature.depth_m - 0.5, 3.9, colonnadeWidth - 1.2],
    [0, signature.gate_height_m - 1.95, 0],
    sandstoneShadow,
    0.9,
  );
  addBox(
    group,
    "Brandenburg Gate upper lintel",
    [signature.depth_m, 2.35, colonnadeWidth + 1.4],
    [0, 16.45, 0],
    sandstoneShadow,
    0.88,
  );
  addBox(
    group,
    "Brandenburg Gate sculpted frieze band",
    [signature.depth_m, 0.72, colonnadeWidth - 2.2],
    [0, 17.2, 0],
    sandstone,
    0.8,
  );

  addBox(group, "Quadriga chariot", [3.4, 1.0, 5.8], [-1.1, 21.0, 0], bronze, 0.8);
  for (const wheelZ of [-2.45, 2.45]) {
    const wheel = new Mesh(new TorusGeometry(0.92, 0.13, 8, 20), bronze);
    wheel.name = "Quadriga chariot wheel";
    wheel.position.set(-1.2, 21.25, wheelZ);
    wheel.castShadow = true;
    group.add(wheel);
  }
  for (let index = 0; index < 4; index += 1) {
    const z = -2.4 + index * 1.6;
    const body = new Mesh(new SphereGeometry(1, 16, 10), bronze);
    body.name = `Quadriga horse ${index + 1}`;
    body.scale.set(2.05, 0.76, 0.52);
    body.position.set(1.0, 22.2, z);
    body.castShadow = true;
    group.add(body);
    const head = new Mesh(new SphereGeometry(0.62, 14, 8), bronze);
    head.name = `Quadriga horse head ${index + 1}`;
    head.scale.set(1.0, 1.2, 0.82);
    head.position.set(3.15, 23.35, z);
    head.castShadow = true;
    group.add(head);
    const muzzle = new Mesh(new SphereGeometry(0.36, 12, 8), bronze);
    muzzle.name = `Quadriga horse muzzle ${index + 1}`;
    muzzle.scale.set(1.35, 0.72, 0.82);
    muzzle.position.set(3.68, 23.12, z);
    muzzle.castShadow = true;
    group.add(muzzle);
    addCylinderBetween(
      group,
      `Quadriga horse neck ${index + 1}`,
      new Vector3(2.0, 22.45, z),
      new Vector3(2.85, 23.15, z),
      0.36,
      bronze,
      10,
    );
    for (const earZ of [-0.22, 0.22]) {
      const ear = new Mesh(new ConeGeometry(0.16, 0.55, 8), bronze);
      ear.name = `Quadriga horse ear ${index + 1}`;
      ear.position.set(3.08, 24.05, z + earZ);
      ear.rotation.z = -0.18;
      group.add(ear);
    }
    for (const legX of [0.1, 1.72]) {
      for (const legZ of [-0.22, 0.22]) {
        addCylinderBetween(
          group,
          `Quadriga horse leg ${index + 1}`,
          new Vector3(legX, 21.82, z + legZ),
          new Vector3(legX + (legX > 1 ? 0.36 : -0.18), 20.48, z + legZ),
          0.13,
          bronze,
          8,
        );
      }
    }
    const tailPoints = [
      new Vector3(-1.0, 22.35, z),
      new Vector3(-1.55, 21.95, z),
      new Vector3(-1.85, 21.15, z + 0.08),
    ];
    const tail = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(tailPoints), 12, 0.1, 6, false),
      bronze,
    );
    tail.name = `Quadriga horse tail ${index + 1}`;
    group.add(tail);
    addCylinderBetween(
      group,
      `Quadriga rein ${index + 1}`,
      new Vector3(-0.6, 23.1, 0),
      new Vector3(3.45, 23.55, z),
      0.035,
      bronze,
      6,
    );
  }
  addBox(
    group,
    "Quadriga horse harness crossbar",
    [0.2, 0.24, 6.7],
    [0.05, 22.7, 0],
    bronze,
    0.5,
  );
  const victoria = new Mesh(new CylinderGeometry(0.3, 0.58, 3.6, 12), bronze);
  victoria.name = "Quadriga Victoria";
  victoria.position.set(-1.6, 23.1, 0);
  victoria.castShadow = true;
  group.add(victoria);
  const dress = new Mesh(new ConeGeometry(0.82, 3.2, 18, 1, true), bronze);
  dress.name = "Quadriga Victoria draped robe";
  dress.position.set(-1.6, 22.65, 0);
  dress.castShadow = true;
  group.add(dress);
  const victoriaHead = new Mesh(new SphereGeometry(0.38, 14, 10), bronze);
  victoriaHead.name = "Quadriga Victoria head";
  victoriaHead.position.set(-1.6, 25.12, 0);
  group.add(victoriaHead);
  for (const side of [-1, 1]) {
    addCylinderBetween(
      group,
      "Quadriga Victoria arm",
      new Vector3(-1.58, 24.0, side * 0.18),
      new Vector3(-0.92, 24.55, side * 0.52),
      0.11,
      bronze,
      8,
    );
  }
  for (const side of [-1, 1]) {
    const wing = new Mesh(new ConeGeometry(0.9, 2.8, 3), bronze);
    wing.name = "Quadriga Victoria wing";
    wing.rotation.x = Math.PI / 2;
    wing.rotation.z = side * 0.42;
    wing.position.set(-1.95, 24.1, side * 0.72);
    wing.castShadow = true;
    group.add(wing);
  }
  addCylinderBetween(
    group,
    "Quadriga victory standard",
    new Vector3(-1.2, 24.1, 0),
    new Vector3(-0.45, 25.65, 0),
    0.09,
    bronze,
    8,
  );
  const wreath = new Mesh(new RingGeometry(0.65, 0.9, 24), bronze);
  wreath.name = "Quadriga victory wreath";
  wreath.rotation.y = Math.PI / 2;
  wreath.position.set(-0.35, signature.total_height_m - 0.55, 0);
  group.add(wreath);
  addBox(
    group,
    "Quadriga Iron Cross vertical",
    [0.12, 0.68, 0.12],
    [-0.32, signature.total_height_m - 0.56, 0],
    bronze,
  );
  addBox(
    group,
    "Quadriga Iron Cross horizontal",
    [0.12, 0.16, 0.62],
    [-0.32, signature.total_height_m - 0.5, 0],
    bronze,
  );
  return group;
}

export function createArchitecturalSignature(
  signature: ArchitecturalSignature,
): Group | null {
  switch (signature.id) {
    case "reichstag-dome":
      return createOfficialReichstagDome(signature as ReichstagDomeSignature);
    case "reichstag-model":
      return createReichstagModel(signature as ReichstagModelSignature);
    case "bundeskanzleramt-model":
      return createChancelleryModel(signature as ChancelleryModelSignature);
    case "hauptbahnhof-model":
      return createHauptbahnhofModel(signature as HauptbahnhofModelSignature);
    case "brandenburger-tor-model":
      return createBrandenburgGateModel(signature as BrandenburgGateModelSignature);
    default:
      return null;
  }
}

export function focusCameraForSignature(
  signature: ArchitecturalSignature,
): FocusCamera | null {
  if (!("focus_camera" in signature)) {
    return null;
  }
  const targetWorld: [number, number, number] = [...signature.anchor_world];
  if (signature.kind === "chancellery_model") {
    const rotation = MathUtils.degToRad(signature.rotation_y_degrees);
    const [offsetX, offsetY, offsetZ] = signature.cube_offset_world;
    targetWorld[0] += offsetX * Math.cos(rotation) + offsetZ * Math.sin(rotation);
    targetWorld[1] += offsetY;
    targetWorld[2] += -offsetX * Math.sin(rotation) + offsetZ * Math.cos(rotation);
  }
  return {
    ...signature.focus_camera,
    target_world: targetWorld,
  };
}

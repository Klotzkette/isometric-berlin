import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
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
};

type SignatureBase = {
  anchor_world: [number, number, number];
  focus_camera: FocusCamera;
  geometry_status: string;
  id: string;
  kind: string;
  landmark_name: string;
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
  group.position.fromArray(signature.anchor_world);
  group.userData = { ...signature };

  const stoneAccent = modelMaterial(0xc9ae78, {
    opacity: 0.78,
    roughness: 0.82,
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
    }
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
  const glass = modelMaterial(0x70bfd0, {
    metalness: 0.12,
    opacity: 0.24,
    roughness: 0.22,
  });
  const concrete = modelMaterial(0xdde3df, {
    opacity: 0.68,
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
  for (let index = 0; index <= columnCount; index += 1) {
    const columnX = x - width / 2 + (index / columnCount) * width;
    addBox(
      group,
      "Chancellery office-band facade mullion",
      [0.48, height - 2.8, 0.5],
      [columnX, height / 2 - 0.2, z - depth / 2 - 0.16],
      concrete,
    );
  }
}

function createChancelleryModel(signature: ChancelleryModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Federal Chancellery recognition model";
  group.position.fromArray(signature.anchor_world);
  group.userData = { ...signature };

  const concrete = modelMaterial(0xe4e8e4, { roughness: 0.78 });
  const glass = modelMaterial(0x55b6cc, {
    metalness: 0.08,
    opacity: 0.3,
    roughness: 0.2,
  });
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

  const windowGlass = new MeshPhysicalMaterial({
    color: 0x5fcce0,
    depthWrite: false,
    metalness: 0.04,
    opacity: 0.42,
    roughness: 0.12,
    side: DoubleSide,
    transparent: true,
    transmission: 0.2,
  });
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
  const glass = new MeshPhysicalMaterial({
    color: 0x72d0e3,
    depthWrite: false,
    metalness: 0.04,
    opacity: 0.3,
    roughness: 0.12,
    side: DoubleSide,
    transparent: true,
    transmission: 0.28,
  });
  const steel = modelMaterial(0x47616d, { metalness: 0.66, roughness: 0.28 });
  const roof = new Mesh(barrelRoofGeometry(length, width, height, alongX), glass);
  roof.name = name;
  roof.position.y = baseY;
  roof.renderOrder = 6;
  group.add(roof);

  const ribCount = Math.max(10, Math.round(length / 16));
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

  for (const fraction of [0.2, 0.38, 0.62, 0.8]) {
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
  addBoxOutline(
    group,
    "Hauptbahnhof 46 m office bridge",
    [20, height, depth],
    [x, height / 2, 0],
    0.32,
    0x6f9eaa,
  );
}

function createHauptbahnhofModel(signature: HauptbahnhofModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Berlin Hauptbahnhof recognition model";
  group.position.fromArray(signature.anchor_world);
  group.userData = { ...signature };

  const deck = modelMaterial(0x42545b, { metalness: 0.34, roughness: 0.7 });
  addBox(
    group,
    "Hauptbahnhof east-west elevated track deck",
    [signature.east_west_roof_length_m, 1.1, signature.east_west_roof_width_m - 3],
    [0, 9.8, 0],
    deck,
    0.5,
  );
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
  group.position.fromArray(signature.anchor_world);
  group.userData = { ...signature };

  const sandstone = modelMaterial(0xd1b16f, { roughness: 0.84 });
  const sandstoneShadow = modelMaterial(0xb99454, { roughness: 0.9 });
  const recess = modelMaterial(0x5d584d, { roughness: 0.92 });
  const bronze = modelMaterial(0x2b8c76, { metalness: 0.62, roughness: 0.38 });
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
    }
  }

  const pavilionWidth = (signature.width_m - colonnadeWidth) / 2;
  for (const z of [-1, 1]) {
    const pavilionZ = z * (signature.width_m / 2 - pavilionWidth / 2);
    addBox(
      group,
      "Brandenburg Gate side pavilion",
      [signature.depth_m, signature.gate_height_m, pavilionWidth],
      [
        0,
        signature.gate_height_m / 2,
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

  addBox(group, "Quadriga chariot", [3.2, 1.1, 5.8], [0, 21.1, 0], bronze, 0.8);
  for (let index = 0; index < 4; index += 1) {
    const z = -2.4 + index * 1.6;
    const body = new Mesh(new SphereGeometry(1, 16, 10), bronze);
    body.name = `Quadriga horse ${index + 1}`;
    body.scale.set(2.25, 0.85, 0.58);
    body.position.set(1.3, 22.25, z);
    body.castShadow = true;
    group.add(body);
    const head = new Mesh(new SphereGeometry(0.62, 14, 8), bronze);
    head.name = `Quadriga horse head ${index + 1}`;
    head.position.set(3.05, 23.25, z);
    head.castShadow = true;
    group.add(head);
  }
  const victoria = new Mesh(new CylinderGeometry(0.34, 0.62, 3.8, 12), bronze);
  victoria.name = "Quadriga Victoria";
  victoria.position.set(-0.8, 23.3, 0);
  victoria.castShadow = true;
  group.add(victoria);
  const wreath = new Mesh(new RingGeometry(0.65, 0.9, 24), bronze);
  wreath.name = "Quadriga victory wreath";
  wreath.rotation.y = Math.PI / 2;
  wreath.position.set(0.15, signature.total_height_m - 0.7, 0);
  group.add(wreath);
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
  return "focus_camera" in signature ? signature.focus_camera : null;
}

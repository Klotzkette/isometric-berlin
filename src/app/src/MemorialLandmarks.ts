import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

export type MemorialLandmark = {
  name: string;
  world: [number, number, number];
};

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

const CONCRETE = 0x8f9698;
const MARBLE = 0xe5e3d8;
const GOLD = 0xc89a32;

// Fifth-percentile surface samples from the committed official Berlin mesh.
// The manifest camera anchors use a uniform 38 m NHN and are not ground points.
const MEMORIAL_GROUND_Y: Record<string, number> = {
  "Beethoven-Haydn-Mozart-Denkmal": 3.73,
  "Denkmal für die ermordeten Juden Europas": 4.61,
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas":
    4.48,
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen": 4.11,
  "Goethe-Denkmal": 4.69,
  "Mahnmal für verfolgte Zeugen Jehovas": 3.87,
  "Sowjetisches Ehrenmal Tiergarten": 4.79,
};

function placeOnOfficialMesh(group: Group, anchor: MemorialLandmark): void {
  group.position.set(
    anchor.world[0],
    MEMORIAL_GROUND_Y[anchor.name] ?? anchor.world[1],
    anchor.world[2],
  );
}

function modelMaterial(
  color: number,
  options: { metalness?: number; roughness?: number } = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: options.metalness ?? 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1.2,
    polygonOffsetUnits: -1.2,
    roughness: options.roughness ?? 0.7,
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
    delta.clone().normalize(),
  );
  return mesh;
}

function createHolocaustMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.rotation.y = -0.105;
  group.userData.geometryStatus =
    "Official count, cross-section and height bands; scene placement remains approximate";

  const cells: Array<{ column: number; edge: number; row: number }> = [];
  for (let row = 0; row < 52; row += 1) {
    for (let column = 0; column < 53; column += 1) {
      cells.push({
        column,
        edge: Math.min(row, 51 - row, column, 52 - column),
        row,
      });
    }
  }
  const retained = cells.slice(23, cells.length - 23);
  retained.sort((left, right) => left.edge - right.edge || left.row - right.row);
  const transforms: InstanceTransform[] = retained.map((cell, index) => {
    let height: number;
    if (index < 112) {
      height = 0.2;
    } else if (index < 923) {
      height = 0.35 + (((index * 47) % 997) / 996) * 1.6;
    } else if (index < 1_838) {
      height = 2 + (((index * 59) % 991) / 990) * 1.45;
    } else {
      height = 3.5 + (((index * 71) % 983) / 982) * 1.2;
    }
    const normalizedX = (cell.column - 26) / 26;
    const normalizedZ = (cell.row - 25.5) / 25.5;
    const depression = -1.55 * Math.max(0, 1 - Math.hypot(normalizedX, normalizedZ));
    const tilt = ((index * 13) % 17) / 16;
    return {
      position: [
        (cell.column - 26) * 2.45,
        depression + height / 2 + 0.08,
        (cell.row - 25.5) * 2.9,
      ],
      rotation: [
        ((0.5 + tilt * 1.5) * Math.PI) / 180,
        0,
        ((0.5 + (1 - tilt) * 1.5) * Math.PI) / 180,
      ],
      scale: [1, height, 1],
    };
  });
  const stelae = addInstances(
    group,
    "Holocaust Memorial 2710 instanced stelae",
    new BoxGeometry(0.95, 1, 2.38),
    modelMaterial(CONCRETE, { roughness: 0.82 }),
    transforms,
  );
  stelae.userData.heightBands = {
    edge: 112,
    high: 872,
    low: 811,
    medium: 915,
  };
  stelae.castShadow = false;
  return group;
}

function createSintiRomaMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "Characteristic water basin, centre stone and remembrance path from official and licensed visual references";
  const rim = addMesh(
    group,
    "Sinti and Roma memorial dark circular basin",
    new CylinderGeometry(7.6, 7.6, 0.28, 72),
    modelMaterial(0x1a2224, { metalness: 0.2, roughness: 0.42 }),
    [0, 0.14, 0],
  );
  rim.receiveShadow = true;
  const water = addMesh(
    group,
    "Sinti and Roma memorial black reflecting water",
    new CylinderGeometry(7.15, 7.15, 0.06, 72),
    new MeshPhysicalMaterial({
      color: 0x061318,
      metalness: 0.18,
      roughness: 0.12,
      transparent: true,
      opacity: 0.9,
    }),
    [0, 0.33, 0],
  );
  water.userData.nightEmissive = 0x0c2730;
  water.userData.nightEmissiveIntensity = 0.38;
  const stone = addMesh(
    group,
    "Sinti and Roma memorial triangular centre stone",
    new CylinderGeometry(0.88, 0.88, 0.18, 3),
    modelMaterial(0x282d30, { roughness: 0.48 }),
    [0, 0.48, 0],
  );
  stone.rotation.y = Math.PI / 6;
  const path = addMesh(
    group,
    "Sinti and Roma memorial remembrance path",
    new RingGeometry(8.35, 10.8, 72),
    modelMaterial(0x9a9589, { roughness: 0.92 }),
    [0, 0.04, 0],
  );
  path.rotation.x = -Math.PI / 2;
  return group;
}

function createHomosexualMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.rotation.y = -0.18;
  group.userData.geometryStatus =
    "Characteristic concrete cuboid and viewing window from official and licensed visual references";
  addBox(
    group,
    "Memorial to persecuted homosexuals concrete cuboid",
    [3.7, 4.2, 2.55],
    [0, 2.1, 0],
    modelMaterial(0x555b5d, { roughness: 0.84 }),
  );
  const window = addMesh(
    group,
    "Memorial to persecuted homosexuals viewing window",
    new PlaneGeometry(1.28, 0.88),
    nightEmitter(modelMaterial(0x101819, { roughness: 0.18 }), 0xd7e6de, 0.5),
    [-0.38, 1.52, 1.281],
  );
  window.renderOrder = 4;
  return group;
}

function addTank(group: Group, name: string, x: number): void {
  const armor = modelMaterial(0x496451, { metalness: 0.28, roughness: 0.62 });
  const dark = modelMaterial(0x222a25, { metalness: 0.34, roughness: 0.68 });
  const hull = addBox(
    group,
    `${name} hull`,
    [3.05, 1.18, 5.45],
    [x, 1.28, 8],
    armor,
  );
  hull.userData.vehicleType = "T-34/76";
  addBox(group, `${name} left track`, [0.52, 0.78, 5.9], [x - 1.55, 0.62, 8], dark);
  addBox(group, `${name} right track`, [0.52, 0.78, 5.9], [x + 1.55, 0.62, 8], dark);
  const wheelTransforms: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 5; index += 1) {
      wheelTransforms.push({
        position: [x + side * 1.82, 0.62, 5.92 + index * 1.04],
        rotation: [0, 0, Math.PI / 2],
      });
    }
  }
  addInstances(
    group,
    `${name} ten T-34 road wheels`,
    new CylinderGeometry(0.46, 0.46, 0.24, 12),
    dark,
    wheelTransforms,
  );
  const glacis = addBox(
    group,
    `${name} sloped front glacis`,
    [2.78, 0.62, 1.18],
    [x, 1.52, 5.38],
    armor,
  );
  glacis.rotation.x = -0.32;
  addBox(
    group,
    `${name} engine deck`,
    [2.74, 0.28, 1.48],
    [x, 1.91, 9.92],
    armor,
  );
  addMesh(
    group,
    `${name} turret`,
    new CylinderGeometry(1.16, 1.4, 0.94, 12),
    armor,
    [x, 2.33, 7.82],
  );
  addMesh(
    group,
    `${name} command hatch`,
    new CylinderGeometry(0.42, 0.46, 0.16, 12),
    dark,
    [x + 0.34, 2.88, 7.94],
  );
  addMesh(
    group,
    `${name} gun mantlet`,
    new SphereGeometry(0.43, 12, 8),
    armor,
    [x, 2.36, 6.7],
  ).scale.set(1.35, 0.82, 0.58);
  addSegment(
    group,
    `${name} 76 mm barrel`,
    new Vector3(x, 2.38, 6.62),
    new Vector3(x, 2.45, 3.15),
    0.14,
    dark,
  );
  for (const side of [-1, 1]) {
    addMesh(
      group,
      `${name} front headlamp ${side < 0 ? "left" : "right"}`,
      new SphereGeometry(0.17, 10, 7),
      modelMaterial(0xe5d6a4, { metalness: 0.18, roughness: 0.32 }),
      [x + side * 0.92, 1.72, 5.12],
    );
  }
}

function createSovietMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.rotation.y = Math.PI;
  group.userData.geometryStatus =
    "Official composition, T-34/76 tank type and 8 m soldier height; local spacing remains a visual approximation";
  group.userData.sourceUrl =
    "https://www.berlin.de/sehenswuerdigkeiten/3561689-3558930-sowjetisches-ehrenmal-tiergarten.html";
  const stone = modelMaterial(0xc2c1b7, { roughness: 0.78 });
  const stoneDark = modelMaterial(0x777a73, { roughness: 0.84 });
  const bronze = modelMaterial(0x4f6657, { metalness: 0.38, roughness: 0.55 });
  addBox(group, "Soviet memorial lower stair", [62, 0.5, 18], [0, 0.25, 0], stone);
  addBox(group, "Soviet memorial upper stair", [56, 0.55, 14], [0, 0.78, -1], stone);
  addBox(group, "Soviet memorial central pylon", [6, 12, 5], [0, 7.05, -3], stoneDark);
  const columnTransforms: InstanceTransform[] = [-24, -16, -8, 8, 16, 24].map(
    (x) => ({
      position: [x, 6.1, -3 + Math.abs(x) * 0.075],
    }),
  );
  addInstances(
    group,
    "Soviet memorial six side pylons",
    new BoxGeometry(4.3, 10, 3.2),
    stone,
    columnTransforms,
  );
  addBox(group, "Soviet memorial left colonnade beam", [23, 1.4, 3.2], [-17, 11.1, -1.8], stone);
  addBox(group, "Soviet memorial right colonnade beam", [23, 1.4, 3.2], [17, 11.1, -1.8], stone);
  addMesh(
    group,
    "Soviet memorial eight metre soldier body",
    new CapsuleGeometry(1.35, 4.7, 5, 10),
    bronze,
    [0, 16.5, -3],
  );
  addMesh(
    group,
    "Soviet memorial soldier head",
    new SphereGeometry(0.82, 14, 10),
    bronze,
    [0, 19.45, -3],
  );
  addSegment(
    group,
    "Soviet memorial soldier rifle",
    new Vector3(0.85, 15.2, -3.2),
    new Vector3(1.2, 20, -3.55),
    0.16,
    bronze,
  );
  addTank(group, "Soviet memorial T-34 west", -25);
  addTank(group, "Soviet memorial T-34 east", 25);
  return group;
}

function createGoetheMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "Pedestal, standing Goethe and three allegorical groups from Berlin monument inventory and licensed references";
  const marble = modelMaterial(MARBLE, { roughness: 0.7 });
  addBox(group, "Goethe memorial plinth", [7.2, 0.65, 7.2], [0, 0.33, 0], marble);
  addMesh(
    group,
    "Goethe memorial round pedestal",
    new CylinderGeometry(2.25, 2.6, 3.5, 20),
    marble,
    [0, 2.4, 0],
  );
  addMesh(
    group,
    "Goethe standing figure body",
    new CapsuleGeometry(0.8, 2.55, 5, 10),
    marble,
    [0, 5.65, 0],
  );
  addMesh(
    group,
    "Goethe standing figure head",
    new SphereGeometry(0.58, 14, 10),
    marble,
    [0, 7.55, 0],
  );
  const allegories: InstanceTransform[] = [0, 1, 2].map((index) => {
    const angle = (index / 3) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 2.9, 1.45, Math.sin(angle) * 2.9],
      rotation: [0, -angle, Math.PI / 2],
      scale: [0.78, 1.1, 0.78],
    };
  });
  addInstances(
    group,
    "Goethe memorial three allegorical figure groups",
    new CapsuleGeometry(0.62, 1.65, 4, 8),
    marble,
    allegories,
  );
  return group;
}

function createComposerMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "Official 10 m height and characteristic three-sided marble monument with gilded crown";
  const marble = modelMaterial(MARBLE, { roughness: 0.66 });
  const gold = nightEmitter(
    modelMaterial(GOLD, { metalness: 0.66, roughness: 0.35 }),
    0xffc45f,
    0.82,
  );
  addMesh(
    group,
    "Composer memorial three-sided marble base",
    new CylinderGeometry(4.2, 4.7, 0.7, 3),
    marble,
    [0, 0.35, 0],
  );
  addMesh(
    group,
    "Composer memorial three-sided coloured stele",
    new CylinderGeometry(2.9, 3.5, 6.2, 3),
    modelMaterial(0xd8d4c3, { roughness: 0.72 }),
    [0, 3.8, 0],
  );
  const busts: InstanceTransform[] = [0, 1, 2].map((index) => {
    const angle = (index / 3) * Math.PI * 2 + Math.PI / 6;
    return {
      position: [Math.cos(angle) * 3.05, 4.3, Math.sin(angle) * 3.05],
      scale: [1, 1.25, 0.72],
    };
  });
  addInstances(
    group,
    "Composer memorial Haydn Beethoven Mozart busts",
    new SphereGeometry(0.68, 14, 10),
    marble,
    busts,
  );
  const dome = addMesh(
    group,
    "Composer memorial gilded cupola",
    new SphereGeometry(2.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    gold,
    [0, 7.2, 0],
  );
  dome.scale.y = 0.7;
  addMesh(
    group,
    "Composer memorial laurel crown",
    new TorusGeometry(1.65, 0.19, 8, 24),
    gold,
    [0, 9.55, 0],
  ).rotation.x = Math.PI / 2;
  const putti: InstanceTransform[] = [0, 1, 2].map((index) => {
    const angle = (index / 3) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 0.95, 8.55, Math.sin(angle) * 0.95],
      rotation: [0, -angle, 0],
      scale: [0.72, 1.1, 0.72],
    };
  });
  addInstances(
    group,
    "Composer memorial three gilded putti",
    new CapsuleGeometry(0.35, 0.95, 4, 8),
    gold,
    putti,
  );
  return group;
}

function createJehovahsWitnessesMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "2026 flared bronze sculpture from official description and licensed visual references; height is visual-reference derived";
  const gold = nightEmitter(
    modelMaterial(0xb8872d, { metalness: 0.72, roughness: 0.38 }),
    0xffc85c,
    0.78,
  );
  addMesh(
    group,
    "Jehovahs Witnesses memorial textured rising column",
    new CylinderGeometry(0.68, 1.15, 7.2, 18),
    gold,
    [0, 3.6, 0],
  );
  const crown = addMesh(
    group,
    "Jehovahs Witnesses memorial flared crown",
    new ConeGeometry(2.35, 2.25, 18, 2, true),
    gold,
    [0, 8.18, 0],
  );
  crown.rotation.x = Math.PI;
  const ribs: InstanceTransform[] = Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 0.82, 5.15, Math.sin(angle) * 0.82],
      rotation: [0, -angle, 0],
      scale: [0.38, 1, 0.38],
    };
  });
  addInstances(
    group,
    "Jehovahs Witnesses memorial fine vertical folds",
    new BoxGeometry(0.09, 5.8, 0.11),
    gold,
    ribs,
  );
  return group;
}

const BUILDERS: Record<string, (landmark: MemorialLandmark) => Group> = {
  "Beethoven-Haydn-Mozart-Denkmal": createComposerMemorial,
  "Denkmal für die ermordeten Juden Europas": createHolocaustMemorial,
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas":
    createSintiRomaMemorial,
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen":
    createHomosexualMemorial,
  "Goethe-Denkmal": createGoetheMemorial,
  "Mahnmal für verfolgte Zeugen Jehovas": createJehovahsWitnessesMemorial,
  "Sowjetisches Ehrenmal Tiergarten": createSovietMemorial,
};

export function createMemorialLandmarks(landmarks: MemorialLandmark[]): Group {
  const root = new Group();
  root.name = "Verified memorial detail models";
  for (const landmark of landmarks) {
    const builder = BUILDERS[landmark.name];
    if (builder) {
      root.add(builder(landmark));
    }
  }
  root.userData.modelCount = root.children.length;
  return root;
}

export function memorialFocusDistance(name: string): number | null {
  if (name === "Denkmal für die ermordeten Juden Europas") {
    return 155;
  }
  if (name === "Sowjetisches Ehrenmal Tiergarten") {
    return 145;
  }
  if (name === "Beethoven-Haydn-Mozart-Denkmal") {
    return 72;
  }
  if (name === "Goethe-Denkmal") {
    return 58;
  }
  if (
    name ===
      "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas" ||
    name === "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen" ||
    name === "Mahnmal für verfolgte Zeugen Jehovas"
  ) {
    return 48;
  }
  return null;
}

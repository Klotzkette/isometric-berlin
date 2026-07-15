import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from "three";
import { markWindFlag } from "./WindFlags";

export type CivicLandmark = {
  name: string;
  world: [number, number, number];
};

type Transform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

const SWISS_EMBASSY_WORLD: [number, number, number] = [
  -5.21648, 3.86, -244.099765,
];
const SWISS_EMBASSY_ROTATION_Y = (-1.322 * Math.PI) / 180;

function material(
  color: number,
  options: { metalness?: number; opacity?: number; roughness?: number } = {},
): MeshStandardMaterial {
  const opacity = options.opacity ?? 1;
  return new MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.04,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1.35,
    polygonOffsetUnits: -1.35,
    roughness: options.roughness ?? 0.72,
    side: DoubleSide,
    transparent: opacity < 1,
    depthWrite: opacity >= 0.72,
  });
}

function nightEmitter<T extends MeshStandardMaterial>(
  surface: T,
  color: number,
  intensity: number,
): T {
  surface.userData.nightEmissive = color;
  surface.userData.nightEmissiveIntensity = intensity;
  return surface;
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

function addInstances(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  surface: MeshStandardMaterial,
  transforms: Transform[],
): InstancedMesh {
  const instances = new InstancedMesh(geometry, surface, transforms.length);
  instances.name = name;
  const dummy = new Object3D();
  transforms.forEach((transform, index) => {
    dummy.position.set(...transform.position);
    dummy.rotation.set(...(transform.rotation ?? [0, 0, 0]));
    dummy.scale.set(...(transform.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    instances.setMatrixAt(index, dummy.matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.computeBoundingBox();
  instances.computeBoundingSphere();
  instances.castShadow = true;
  instances.receiveShadow = true;
  group.add(instances);
  return instances;
}

function hippedRoofGeometry(
  width: number,
  depth: number,
  height: number,
  inset: number,
): BufferGeometry {
  const bottomX = width / 2;
  const bottomZ = depth / 2;
  const topX = Math.max(0.5, bottomX - inset);
  const topZ = Math.max(0.5, bottomZ - inset);
  const vertices = [
    -bottomX, 0, -bottomZ,
    bottomX, 0, -bottomZ,
    bottomX, 0, bottomZ,
    -bottomX, 0, bottomZ,
    -topX, height, -topZ,
    topX, height, -topZ,
    topX, height, topZ,
    -topX, height, topZ,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex([
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
    4, 5, 6, 4, 6, 7,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function addSwissFlag(group: Group): void {
  const poleX = 13.2;
  const poleZ = 14.1;
  const poleHeight = 8.5;
  const pole = new Mesh(
    new CylinderGeometry(0.1, 0.14, poleHeight, 12),
    material(0x7b8587, { metalness: 0.72, roughness: 0.28 }),
  );
  pole.name = "Swiss Embassy flagpole";
  pole.position.set(poleX, poleHeight / 2, poleZ);
  pole.castShadow = true;
  group.add(pole);

  const width = 3.5;
  const makeFlagPart = (
    name: string,
    geometry: PlaneGeometry,
    color: number,
    zOffset: number,
  ) => {
    const mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({ color, side: DoubleSide }),
    );
    mesh.name = name;
    mesh.position.set(poleX, poleHeight - 1.8, poleZ + zOffset);
    markWindFlag(mesh, width, { amplitudeM: 0.22, phase: 0.42 });
    group.add(mesh);
  };
  const field = new PlaneGeometry(width, width, 12, 10);
  field.translate(width / 2, 0, 0);
  makeFlagPart("Swiss Embassy animated red flag field", field, 0xd9272e, 0);
  const horizontal = new PlaneGeometry(2.15, 0.68, 8, 2);
  horizontal.translate(width / 2, 0, 0.02);
  makeFlagPart("Swiss Embassy animated white flag cross horizontal", horizontal, 0xffffff, -0.03);
  const vertical = new PlaneGeometry(0.68, 2.15, 3, 6);
  vertical.translate(width / 2, 0, 0.025);
  makeFlagPart("Swiss Embassy animated white flag cross vertical", vertical, 0xffffff, -0.035);
}

function createSwissEmbassy(): Group {
  const group = new Group();
  group.name = "Metric Swiss Embassy recognition model";
  group.position.set(...SWISS_EMBASSY_WORLD);
  group.rotation.y = SWISS_EMBASSY_ROTATION_Y;
  group.userData = {
    footprintDepthM: 22.804,
    footprintWidthM: 50.927,
    geometryStatus: "Berlin LoD2 footprint and heights with an official-history recognition overlay",
    sourceUrls: [
      "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
      "https://www.schweiz-deutschland.eda.admin.ch/de/das-botschaftsgebaeude",
    ],
  };
  const historicStone = material(0xd9cfb7, { roughness: 0.83 });
  const modernStone = material(0xe3e7e4, { roughness: 0.74 });
  const roof = material(0x657273, { metalness: 0.3, roughness: 0.52 });
  const glass = nightEmitter(
    material(0x36545d, { metalness: 0.18, opacity: 0.56, roughness: 0.3 }),
    0xffd58f,
    1.15,
  );

  addBox(
    group,
    "Swiss Embassy 1871 historic palace",
    [34.8, 17.95, 22.4],
    [-8.05, 8.975, 0],
    historicStone,
  );
  const roofMesh = new Mesh(hippedRoofGeometry(35.4, 23, 3.1, 4.1), roof);
  roofMesh.name = "Swiss Embassy historic hipped roof";
  roofMesh.position.set(-8.05, 17.95, 0);
  roofMesh.castShadow = true;
  group.add(roofMesh);
  addBox(
    group,
    "Swiss Embassy Diener and Diener modern extension",
    [16.1, 18.71, 15.8],
    [17.4, 9.355, -0.2],
    modernStone,
  );

  const historicWindows: Transform[] = [];
  for (const zSide of [-1, 1]) {
    for (const y of [5.1, 11.4]) {
      for (let index = 0; index < 8; index += 1) {
        historicWindows.push({
          position: [-22.3 + index * 4.05, y, zSide * 11.27],
        });
      }
    }
  }
  for (const xSide of [-1, 1]) {
    for (const y of [5.1, 11.4]) {
      for (const z of [-6.6, -2.2, 2.2, 6.6]) {
        historicWindows.push({
          position: [-8.05 + xSide * 17.47, y, z],
          rotation: [0, Math.PI / 2, 0],
        });
      }
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced tall historic windows",
    new BoxGeometry(1.45, 2.65, 0.14),
    glass,
    historicWindows,
  );

  const modernPanes: Transform[] = [];
  for (const zSide of [-1, 1]) {
    for (let floor = 0; floor < 4; floor += 1) {
      for (let index = 0; index < 6; index += 1) {
        modernPanes.push({
          position: [11.35 + index * 2.4, 3.2 + floor * 4.05, zSide * 8.02],
        });
      }
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced modern-extension windows",
    new BoxGeometry(1.38, 2.55, 0.12),
    glass,
    modernPanes,
  );
  const fins: Transform[] = [];
  for (let index = 0; index <= 7; index += 1) {
    fins.push(
      { position: [9.6 + index * 2.25, 9.35, -8.12] },
      { position: [9.6 + index * 2.25, 9.35, 8.12] },
    );
  }
  addInstances(
    group,
    "Swiss Embassy modern vertical stone fins",
    new BoxGeometry(0.2, 18.1, 0.46),
    modernStone,
    fins,
  );
  addSwissFlag(group);
  return group;
}

function createUnityFlag(anchor: CivicLandmark): Group {
  const group = new Group();
  group.name = "Official-dimension Flag of Unity model";
  group.position.set(anchor.world[0], 4.18, anchor.world[2]);
  group.userData = {
    flagAreaSquareM: 60,
    geometryStatus: "Official Bundestag pole height and flag area",
    poleHeightM: 28.5,
    sourceUrl:
      "https://www.bundestag.de/dokumente/textarchiv/2023/kw34-rtg-flagge-der-einheit-383254",
  };
  const poleHeight = 28.5;
  const pole = new Mesh(
    new CylinderGeometry(0.18, 0.27, poleHeight, 16),
    material(0x788184, { metalness: 0.7, roughness: 0.26 }),
  );
  pole.name = "Flag of Unity 28.5 m galvanized-steel pole";
  pole.position.y = poleHeight / 2;
  pole.castShadow = true;
  group.add(pole);

  const width = 10;
  [0x161616, 0xd42d38, 0xf1c43f].forEach((color, index) => {
    const geometry = new PlaneGeometry(width, 2, 24, 3);
    geometry.translate(width / 2, 0, 0);
    const stripe = new Mesh(
      geometry,
      new MeshBasicMaterial({ color, side: DoubleSide }),
    );
    stripe.name = `Flag of Unity animated German stripe ${index + 1}`;
    stripe.position.set(0, poleHeight - 1.15 - index * 2, 0);
    markWindFlag(stripe, width, { amplitudeM: 0.62, phase: 0.42 });
    group.add(stripe);
  });

  const lightMaterial = nightEmitter(
    material(0xe8d3a1, { metalness: 0.28, roughness: 0.34 }),
    0xffdda0,
    3.2,
  );
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2;
    const fixture = new Mesh(new CylinderGeometry(0.18, 0.28, 0.55, 10), lightMaterial);
    fixture.name = `Flag of Unity night spotlight ${index + 1}`;
    fixture.position.set(Math.cos(angle) * 1.4, 0.3, Math.sin(angle) * 1.4);
    fixture.rotation.z = Math.PI / 5;
    group.add(fixture);
  }
  return group;
}

export function createCivicLandmarks(landmarks: CivicLandmark[]): Group {
  const root = new Group();
  root.name = "Embassy and parliamentary civic recognition details";
  root.add(createSwissEmbassy());
  const byName = new Map(landmarks.map((landmark) => [landmark.name, landmark]));
  const unityFlag = byName.get("Fahne der Einheit");
  if (unityFlag) {
    root.add(createUnityFlag(unityFlag));
  }
  return root;
}

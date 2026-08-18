import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from "three";
import { markArchitecturalInk } from "./architecturalInk";
import { createLetteringTexture } from "./drawnLettering";
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

function addInkDrawing(group: Group, name: string, segments: number[]): void {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(segments), 3),
  );
  const lines = new LineSegments(
    geometry,
    markArchitecturalInk(
      new LineBasicMaterial({ opacity: 0.62, transparent: true }),
      "detail",
    ),
  );
  lines.name = name;
  lines.renderOrder = 7;
  group.add(lines);
}

// Preserve the former LoD2-derived 21.05 m total envelope while correcting
// only its roof form from a hip to the documented flat parapet.
const SWISS_HISTORIC_ROOF_Y_M = 21.05;

function addSwissFlag(group: Group): void {
  // The flag belongs on the historic palace roof, not beside the building at
  // terrain level. Its mast rises from the flat parapet roof visible in the
  // embassy's own building documentation and the committed reference views.
  const poleX = -8.05;
  const poleZ = 0;
  const roofY = SWISS_HISTORIC_ROOF_Y_M;
  const poleHeight = 7.2;
  const pole = new Mesh(
    new CylinderGeometry(0.1, 0.14, poleHeight, 12),
    material(0x7b8587, { metalness: 0.72, roughness: 0.28 }),
  );
  pole.name = "Swiss Embassy flagpole";
  pole.position.set(poleX, roofY + poleHeight / 2, poleZ);
  pole.castShadow = true;
  group.add(pole);

  // The street-front photograph shows a deliberately modest square flag,
  // centred over the historic palace rather than a billboard-sized field.
  const width = 2.2;
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
    mesh.position.set(poleX, roofY + poleHeight - 1.2, poleZ + zOffset);
    markWindFlag(mesh, width, {
      amplitudeM: 0.14,
      kind: "switzerland",
      phase: 0.42,
    });
    group.add(mesh);
  };
  const field = new PlaneGeometry(width, width, 12, 10);
  field.translate(width / 2, 0, 0);
  makeFlagPart("Swiss Embassy animated red flag field", field, 0xd9272e, 0);
  for (const [side, offset] of [
    ["front", 0.03],
    ["back", -0.03],
  ] as const) {
    const horizontal = new PlaneGeometry(1.36, 0.43, 8, 2);
    horizontal.translate(width / 2, 0, 0);
    makeFlagPart(
      `Swiss Embassy animated white flag cross horizontal ${side}`,
      horizontal,
      0xffffff,
      offset,
    );
    const vertical = new PlaneGeometry(0.43, 1.36, 3, 6);
    vertical.translate(width / 2, 0, 0);
    makeFlagPart(
      `Swiss Embassy animated white flag cross vertical ${side}`,
      vertical,
      0xffffff,
      offset * 1.08,
    );
  }
}

function createSwissEmbassy(): Group {
  const group = new Group();
  group.name = "Metric Swiss Embassy recognition model";
  group.position.set(...SWISS_EMBASSY_WORLD);
  group.rotation.y = SWISS_EMBASSY_ROTATION_Y;
  group.userData = {
    footprintDepthM: 22.804,
    footprintWidthM: 50.927,
    geometryStatus:
      "Berlin LoD2 footprint and heights with an official-history recognition overlay",
    historicFacadeBayCount: 9,
    historicStreetFacadeWindowCount: 26,
    roofBalusterCount: 104,
    swissFlagWidthM: 2.2,
    visualReferenceStatus:
      "Facade articulation is bounded from the owner-supplied street photograph and official EDA facade views; fixture dimensions are recognition geometry, not survey observations",
    sourceUrls: [
      "https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin",
      "https://www.schweiz-deutschland.eda.admin.ch/de/das-botschaftsgebaeude",
    ],
  };
  const historicStone = material(0xd8d3c7, { roughness: 0.83 });
  const historicBaseStone = material(0xc9ad87, { roughness: 0.9 });
  const historicTrim = material(0xe4dfd3, { roughness: 0.86 });
  const modernStone = material(0xe2e2de, { roughness: 0.74 });
  const roof = material(0x8f9794, { metalness: 0.16, roughness: 0.64 });
  const modernGlass = nightEmitter(
    material(0x70898d, { metalness: 0.1, opacity: 0.62, roughness: 0.34 }),
    0xffd58f,
    0.72,
  );
  const historicGlass = nightEmitter(
    material(0x8fa5a7, { metalness: 0.08, roughness: 0.3 }),
    0xffd39a,
    0.62,
  );

  addBox(
    group,
    "Swiss Embassy 1871 historic palace",
    [34.8, 17.95, 22.4],
    [-8.05, 8.975, 0],
    historicStone,
  );
  // The surviving 1871 palace has a low flat roof behind a balustraded
  // parapet. The former hipped cap contradicted all three committed facade
  // references and made the embassy read as a detached villa.
  addBox(
    group,
    "Swiss Embassy historic flat roof slab",
    [35.4, 0.42, 23],
    [-8.05, 18.16, 0],
    roof,
  );
  for (const y of [17.74, 18.42]) {
    addBox(
      group,
      "Swiss Embassy historic projecting cornice",
      [35.8, 0.34, 23.4],
      [-8.05, y, 0],
      historicStone,
    );
  }
  const parapetPosts: Transform[] = [];
  const roofFineDetail = new Group();
  roofFineDetail.name = "Swiss Embassy historic roof fine detail";
  group.add(roofFineDetail);
  const longPostCount = 40;
  for (const zSide of [-1, 1]) {
    for (let index = 0; index <= longPostCount; index += 1) {
      parapetPosts.push({
        position: [
          -25.25 + (index / longPostCount) * 34.4,
          19.96,
          zSide * 11.18,
        ],
      });
    }
  }
  for (const xSide of [-1, 1]) {
    for (let index = 1; index < 12; index += 1) {
      parapetPosts.push({
        position: [-8.05 + xSide * 17.2, 19.96, -10.6 + (index / 12) * 21.2],
      });
    }
  }
  addInstances(
    roofFineDetail,
    "Swiss Embassy instanced historic roof balusters",
    new CylinderGeometry(0.13, 0.18, 1.12, 8),
    historicStone,
    parapetPosts,
  );
  for (const zSide of [-1, 1]) {
    addBox(
      group,
      "Swiss Embassy historic parapet lower rail",
      [35.2, 0.54, 0.5],
      [-8.05, 19.13, zSide * 11.18],
      historicStone,
    );
    addBox(
      group,
      "Swiss Embassy historic parapet rail",
      [35.2, 0.3, 0.42],
      [-8.05, 20.66, zSide * 11.18],
      historicStone,
    );
  }
  for (const xSide of [-1, 1]) {
    addBox(
      group,
      "Swiss Embassy historic side parapet lower rail",
      [0.5, 0.54, 22.1],
      [-8.05 + xSide * 17.2, 19.13, 0],
      historicStone,
    );
    addBox(
      group,
      "Swiss Embassy historic side parapet rail",
      [0.42, 0.3, 22.1],
      [-8.05 + xSide * 17.2, 20.66, 0],
      historicStone,
    );
  }
  const parapetPedestals: Transform[] = [];
  for (const zSide of [-1, 1]) {
    for (let index = 0; index <= 6; index += 1) {
      parapetPedestals.push({
        position: [-25.25 + (index / 6) * 34.4, 19.8, zSide * 11.18],
      });
    }
  }
  for (const xSide of [-1, 1]) {
    for (const z of [-5.3, 0, 5.3]) {
      parapetPedestals.push({
        position: [-8.05 + xSide * 17.2, 19.8, z],
      });
    }
  }
  addInstances(
    roofFineDetail,
    "Swiss Embassy instanced historic parapet pedestals",
    new BoxGeometry(0.72, 1.95, 0.72),
    historicTrim,
    parapetPedestals,
  );
  addBox(
    group,
    "Swiss Embassy Diener and Diener modern extension",
    [16.1, 18.71, 15.8],
    [17.4, 9.355, -0.2],
    modernStone,
  );

  // The rear and short elevations keep a restrained LoD2-aligned register.
  // The photographed street front is authored separately below, with its
  // three distinct storeys, surrounds, sashes and offset timber entrance.
  const historicWindows: Transform[] = [];
  for (const zSide of [-1]) {
    for (const y of [5.1, 11.4]) {
      for (let index = 0; index < 9; index += 1) {
        historicWindows.push({
          position: [-22.05 + index * 3.5, y, zSide * 11.27],
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
    historicGlass,
    historicWindows,
  );

  const historicPilasters: Transform[] = [];
  for (const zSide of [-1]) {
    for (let index = 0; index <= 9; index += 1) {
      historicPilasters.push({
        position: [-23.8 + index * 3.5, 10.7, zSide * 11.36],
      });
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced historic facade pilasters",
    new BoxGeometry(0.34, 12.8, 0.42),
    historicStone,
    historicPilasters,
  );
  const historicSills = historicWindows.map((window) => ({
    position: [
      window.position[0],
      window.position[1] - 1.52,
      window.position[2],
    ] as [number, number, number],
    rotation: window.rotation,
  }));
  addInstances(
    group,
    "Swiss Embassy instanced historic window sills",
    new BoxGeometry(1.82, 0.18, 0.34),
    historicStone,
    historicSills,
  );

  // Deep rustication on the high base and the Ionic half-columns are the
  // historic palace's strongest close-range recognition cues. They sit proud
  // of the body by 12–20 cm, avoiding coplanar surfaces.
  const baseCourses: Transform[] = [];
  for (const zSide of [-1, 1]) {
    for (const y of [0.8, 1.65, 2.5, 3.35]) {
      baseCourses.push({ position: [-8.05, y, zSide * 11.43] });
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced rusticated base courses",
    new BoxGeometry(34.7, 0.16, 0.18),
    material(0xc8bda5, { roughness: 0.9 }),
    baseCourses,
  );
  const baseJoints: Transform[] = [];
  for (const zSide of [-1, 1]) {
    for (let index = 0; index <= 18; index += 1) {
      baseJoints.push({
        position: [-24.9 + index * 1.88, 2.05, zSide * 11.44],
      });
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced staggered base joints",
    new BoxGeometry(0.1, 3.7, 0.14),
    material(0xb9ae98, { roughness: 0.92 }),
    baseJoints,
  );
  const ionicColumns: Transform[] = [];
  for (const zSide of [-1]) {
    for (const x of [-18.55, -11.55, -4.55, 2.45]) {
      ionicColumns.push({ position: [x, 11.3, zSide * 11.57] });
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced Ionic half-columns",
    new CylinderGeometry(0.34, 0.42, 9.3, 14),
    historicStone,
    ionicColumns,
  );
  const capitals = ionicColumns.map(({ position }) => ({
    position: [position[0], 16.05, position[2]] as [number, number, number],
  }));
  addInstances(
    group,
    "Swiss Embassy instanced Ionic capitals",
    new BoxGeometry(1.05, 0.42, 0.62),
    historicStone,
    capitals,
  );
  const friezePanels: Transform[] = [];
  for (const zSide of [-1]) {
    for (let index = 0; index < 9; index += 1) {
      friezePanels.push({
        position: [-22.05 + index * 3.5, 16.72, zSide * 11.52],
      });
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced allegorical frieze panels",
    new BoxGeometry(2.45, 0.62, 0.22),
    material(0xc5b99e, { roughness: 0.88 }),
    friezePanels,
  );

  const streetFront = new Group();
  streetFront.name = "Swiss Embassy historic street-front fine detail";
  group.add(streetFront);
  const frontZ = 11.42;
  addBox(
    streetFront,
    "Swiss Embassy warm rusticated street-front base",
    [34.72, 5.8, 0.2],
    [-8.05, 2.9, frontZ - 0.12],
    historicBaseStone,
  );
  for (const [name, y, height, depth] of [
    ["lower string course", 5.92, 0.28, 0.46],
    ["piano-nobile sill course", 7.18, 0.22, 0.34],
    ["upper frieze lower course", 15.78, 0.3, 0.42],
    ["upper frieze crown course", 17.15, 0.38, 0.5],
  ] as const) {
    addBox(
      streetFront,
      `Swiss Embassy historic ${name}`,
      [35.05, height, depth],
      [-8.05, y, frontZ],
      historicTrim,
    );
  }

  const bayCenters = Array.from({ length: 9 }, (_, index) =>
    Number((-22.05 + index * 3.5).toFixed(3)),
  );
  const entranceX = bayCenters[0];
  const windowRows = [
    { height: 3.55, skipEntrance: true, width: 1.5, y: 3.1 },
    {
      height: 3.65,
      skipEntrance: false,
      width: 1.55,
      y: 9.5,
    },
    { height: 2.55, skipEntrance: false, width: 1.35, y: 13.72 },
  ] as const;
  const frontWindows: Transform[] = [];
  const surroundVerticals: Transform[] = [];
  const surroundHorizontals: Transform[] = [];
  const sashVerticals: Transform[] = [];
  const sashHorizontals: Transform[] = [];
  for (const row of windowRows) {
    for (let bay = 0; bay < bayCenters.length; bay += 1) {
      if (row.skipEntrance && bay === 0) {
        continue;
      }
      const x = bayCenters[bay];
      frontWindows.push({
        position: [x, row.y, frontZ + 0.12],
        scale: [row.width, row.height, 1],
      });
      for (const side of [-1, 1]) {
        surroundVerticals.push({
          position: [x + side * (row.width / 2 + 0.16), row.y, frontZ + 0.21],
          scale: [0.18, row.height + 0.5, 1],
        });
      }
      for (const side of [-1, 1]) {
        surroundHorizontals.push({
          position: [x, row.y + side * (row.height / 2 + 0.16), frontZ + 0.21],
          scale: [row.width + 0.5, 0.18, 1],
        });
      }
      sashVerticals.push({
        position: [x, row.y, frontZ + 0.27],
        scale: [0.08, row.height - 0.18, 1],
      });
      sashHorizontals.push({
        position: [x, row.y + row.height * 0.08, frontZ + 0.27],
        scale: [row.width - 0.16, 0.08, 1],
      });
    }
  }
  addInstances(
    streetFront,
    "Swiss Embassy instanced three-storey street-front windows",
    new BoxGeometry(1, 1, 0.16),
    historicGlass,
    frontWindows,
  );
  addInstances(
    streetFront,
    "Swiss Embassy instanced street-front vertical window surrounds",
    new BoxGeometry(1, 1, 0.18),
    historicTrim,
    surroundVerticals,
  );
  addInstances(
    streetFront,
    "Swiss Embassy instanced street-front horizontal window surrounds",
    new BoxGeometry(1, 1, 0.18),
    historicTrim,
    surroundHorizontals,
  );
  const sashMaterial = material(0xd4d8d2, {
    metalness: 0.14,
    roughness: 0.48,
  });
  addInstances(
    streetFront,
    "Swiss Embassy instanced street-front vertical window sashes",
    new BoxGeometry(1, 1, 0.1),
    sashMaterial,
    sashVerticals,
  );
  addInstances(
    streetFront,
    "Swiss Embassy instanced street-front horizontal window sashes",
    new BoxGeometry(1, 1, 0.1),
    sashMaterial,
    sashHorizontals,
  );

  const frontPilasters: Transform[] = [];
  for (let index = 1; index < bayCenters.length; index += 1) {
    frontPilasters.push({
      position: [
        (bayCenters[index - 1] + bayCenters[index]) / 2,
        11.6,
        frontZ + 0.2,
      ],
    });
  }
  addInstances(
    streetFront,
    "Swiss Embassy instanced street-front engaged columns",
    new CylinderGeometry(0.18, 0.23, 7.5, 12),
    historicTrim,
    frontPilasters,
  );
  addInstances(
    streetFront,
    "Swiss Embassy instanced street-front column capitals",
    new BoxGeometry(0.72, 0.34, 0.48),
    historicTrim,
    frontPilasters.map(({ position }) => ({
      position: [position[0], 15.53, position[2]],
    })),
  );
  const dentils = Array.from({ length: 34 }, (_, index) => ({
    position: [-24.55 + index * 1, 16.68, frontZ + 0.24] as [
      number,
      number,
      number,
    ],
  }));
  addInstances(
    streetFront,
    "Swiss Embassy instanced historic cornice dentils",
    new BoxGeometry(0.34, 0.36, 0.34),
    historicTrim,
    dentils,
  );
  addInstances(
    streetFront,
    "Swiss Embassy instanced historic frieze rosettes",
    new CylinderGeometry(0.17, 0.17, 0.13, 12),
    material(0xc4baa8, { roughness: 0.9 }),
    bayCenters.map((x) => ({
      position: [x, 16.3, frontZ + 0.29],
      rotation: [Math.PI / 2, 0, 0],
    })),
  );

  const doorWood = material(0x8f5f38, { roughness: 0.82 });
  addBox(
    streetFront,
    "Swiss Embassy historic timber entrance left leaf",
    [1.02, 4.45, 0.2],
    [entranceX - 0.54, 2.65, frontZ + 0.18],
    doorWood,
  );
  addBox(
    streetFront,
    "Swiss Embassy historic timber entrance right leaf",
    [1.02, 4.45, 0.2],
    [entranceX + 0.54, 2.65, frontZ + 0.18],
    doorWood,
  );
  addBox(
    streetFront,
    "Swiss Embassy historic entrance transom",
    [2.16, 0.72, 0.18],
    [entranceX, 5.24, frontZ + 0.18],
    historicGlass,
  );
  for (const side of [-1, 1]) {
    addBox(
      streetFront,
      "Swiss Embassy historic entrance stone jamb",
      [0.42, 5.55, 0.48],
      [entranceX + side * 1.34, 2.77, frontZ + 0.2],
      historicTrim,
    );
  }
  addBox(
    streetFront,
    "Swiss Embassy historic entrance stone lintel",
    [3.12, 0.5, 0.5],
    [entranceX, 5.67, frontZ + 0.2],
    historicTrim,
  );
  addBox(
    streetFront,
    "Swiss Embassy historic entrance sandstone step",
    [3.25, 0.22, 1.25],
    [entranceX, 0.11, 11.92],
    historicBaseStone,
  );
  const doorPanels: Transform[] = [];
  for (const xOffset of [-0.54, 0.54]) {
    for (const y of [1.25, 2.55, 3.85]) {
      doorPanels.push({
        position: [entranceX + xOffset, y, frontZ + 0.31],
      });
    }
  }
  addInstances(
    streetFront,
    "Swiss Embassy instanced timber door panels",
    new BoxGeometry(0.72, 0.9, 0.08),
    material(0xa9794e, { roughness: 0.78 }),
    doorPanels,
  );
  addInstances(
    streetFront,
    "Swiss Embassy brass entrance handles",
    new CylinderGeometry(0.055, 0.055, 0.18, 10),
    material(0xc5a75a, { metalness: 0.68, roughness: 0.28 }),
    [-0.18, 0.18].map((offset) => ({
      position: [entranceX + offset, 2.7, frontZ + 0.38],
      rotation: [Math.PI / 2, 0, 0],
    })),
  );

  const facadeInk: number[] = [];
  const inkZ = frontZ + 0.37;
  for (const y of [1.0, 2.0, 3.0, 4.0, 5.0, 5.92, 15.78, 16.68, 17.34]) {
    facadeInk.push(-25.35, y, inkZ, 9.25, y, inkZ);
  }
  for (let row = 0; row < 5; row += 1) {
    const y0 = row;
    const y1 = row + 1;
    const offset = row % 2 === 0 ? 0 : 0.94;
    for (let x = -24.9 + offset; x < 9.2; x += 1.88) {
      facadeInk.push(x, y0, inkZ, x, y1, inkZ);
    }
  }
  for (let index = 0; index <= bayCenters.length; index += 1) {
    const x = -23.8 + index * 3.5;
    facadeInk.push(x, 6.2, inkZ, x, 17.1, inkZ);
  }
  addInkDrawing(
    streetFront,
    "Swiss Embassy historic street-front ink lines",
    facadeInk,
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
    modernGlass,
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
  // The extension's east end is an opaque concrete screen punctured by
  // staggered, narrow slots, rather than another regular curtain wall.
  const modernEndSlots: Transform[] = [];
  for (let floor = 0; floor < 4; floor += 1) {
    for (let bay = 0; bay < 3; bay += 1) {
      modernEndSlots.push({
        position: [
          25.48,
          3.1 + floor * 4.05,
          -5.2 + bay * 5.2 + (floor % 2 === 0 ? -0.65 : 0.65),
        ],
      });
    }
  }
  addInstances(
    group,
    "Swiss Embassy instanced modern end-wall slot windows",
    new BoxGeometry(0.16, 2.55, 1.05),
    modernGlass,
    modernEndSlots,
  );
  addBox(
    group,
    "Swiss Embassy modern recessed entrance portal",
    [0.18, 5.2, 3.3],
    [25.5, 2.6, 5.45],
    material(0x3d494a, { roughness: 0.82 }),
  );
  const embassyLabel = createLetteringTexture({
    bandHeightM: 0.72,
    bandWidthM: 6.8,
    capHeightM: 0.34,
    fieldColor: "#e2e2de",
    letterColor: "#31393a",
    text: "SCHWEIZERISCHE BOTSCHAFT",
  });
  if (embassyLabel) {
    const label = new Mesh(
      new PlaneGeometry(6.8, 0.72),
      new MeshBasicMaterial({ map: embassyLabel, side: DoubleSide }),
    );
    label.name = "Swiss Embassy modern street-front lettering";
    label.position.set(21.25, 3.35, 8.14);
    label.renderOrder = 8;
    group.add(label);
  }
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
    markWindFlag(stripe, width, {
      amplitudeM: 0.62,
      kind: "germany",
      phase: 0.42,
    });
    group.add(stripe);
  });

  const lightMaterial = nightEmitter(
    material(0xe8d3a1, { metalness: 0.28, roughness: 0.34 }),
    0xffdda0,
    3.2,
  );
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2;
    const fixture = new Mesh(
      new CylinderGeometry(0.18, 0.28, 0.55, 10),
      lightMaterial,
    );
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
  const byName = new Map(
    landmarks.map((landmark) => [landmark.name, landmark]),
  );
  const unityFlag = byName.get("Fahne der Einheit");
  if (unityFlag) {
    root.add(createUnityFlag(unityFlag));
  }
  return root;
}

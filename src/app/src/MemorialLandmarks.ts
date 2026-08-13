import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import {
  HOLOCAUST_FIELD,
  HOLOCAUST_GEOMETRY_STATUS,
  HOLOCAUST_PALETTES,
  holocaustStelePlacements,
} from "./holocaustField";
import { createGeorgElserMemorial } from "./GeorgElserMemorial";

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
const EDGE_COLOR = 0x716c62;

export const KROLLOPER_SCULPTURE_PROFILE = {
  groundY: 4.45,
  geometryStatus:
    "Four OSM monument nodes at the former Krolloper site; forms are bounded procedural reconstructions from freely licensed Commons reference views",
  works: [
    {
      name: "Contact",
      osmNodeId: "2589577819",
      worldM: [-179.6, 55.7] as const,
    },
    {
      name: "Himmelschlüssel",
      osmNodeId: "9775538466",
      worldM: [-189.2, 64.8] as const,
    },
    {
      name: "Große Knospe III/63",
      osmNodeId: "9775503531",
      worldM: [-202.3, 24.7] as const,
    },
    {
      name: "Todes Mauer Bruch",
      osmNodeId: "9775536511",
      worldM: [-231.2, 33.8] as const,
    },
  ],
  sources: [
    "https://commons.wikimedia.org/wiki/File:Berlin-Tiergarten_Skulpturen_gegen_Krieg_und_Gewalt.jpg",
    "https://bildhauerei-in-berlin.de/bildwerk/himmelsschluessel-8326/",
    "https://bildhauerei-in-berlin.de/bildwerk/grosse-knospe-iii-63-6271/",
    "https://bildhauerei-in-berlin.de/bildwerk/todes-mauer-bruch-5457/",
  ],
} as const;

export const SINTI_ROMA_MEMORIAL = {
  overallExtentM: 60,
  placeStoneCount: 69,
  poolDiameterM: 12,
} as const;

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
  // Not a direct mesh sample: the Gedenkort sits on the Spreebogen lawn, so
  // this is matched to the surrounding terrace rather than sampled per point.
  "Gedenkort für Polen 1939-1945": 4.6,
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

function addEdges(group: Group, mesh: Mesh, opacity = 0.8): LineSegments {
  const material = markArchitecturalInk(
    new LineBasicMaterial({
      color: EDGE_COLOR,
      opacity,
      transparent: opacity < 1,
    }),
    opacity >= 0.76 ? "silhouette" : "detail",
  );
  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    material,
  );
  edges.name = `${mesh.name} model edges`;
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  edges.scale.copy(mesh.scale);
  edges.renderOrder = 8;
  group.add(edges);
  return edges;
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

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 7) * 19.913 + salt * 73.117) * 31_337.219;
  return value - Math.floor(value);
}

/** The four individually mapped works of the former Krolloper symposium. */
export function createKrolloperSculptureEnsemble(): Group {
  const root = new Group();
  root.name = "Skulpturen gegen Krieg und Gewalt am ehemaligen Krolloperplatz";
  root.userData.profile = KROLLOPER_SCULPTURE_PROFILE;
  const limestone = modelMaterial(0xbeb8aa, { roughness: 0.96 });
  const limestoneLight = modelMaterial(0xd2cec1, { roughness: 0.94 });
  const limestoneShadow = modelMaterial(0x85837d, { roughness: 0.98 });
  const steel = modelMaterial(0x545958, { metalness: 0.42, roughness: 0.72 });
  const plaque = modelMaterial(0x68645c, { metalness: 0.3, roughness: 0.62 });

  const workGroup = (index: number): Group => {
    const work = KROLLOPER_SCULPTURE_PROFILE.works[index];
    const group = new Group();
    group.name = `Krolloper sculpture ${work.name}`;
    group.position.set(
      work.worldM[0],
      KROLLOPER_SCULPTURE_PROFILE.groundY,
      work.worldM[1],
    );
    group.userData = { ...work };
    root.add(group);
    return group;
  };

  const contact = workGroup(0);
  addBox(contact, "Contact low stone plinth", [3.2, 0.35, 1.55], [0, 0.18, 0], limestone);
  const contactBody = addMesh(
    contact,
    "Contact rough oval monolith",
    new SphereGeometry(1, 14, 10),
    limestone,
    [0, 1.85, 0],
  );
  contactBody.scale.set(1.55, 1.8, 0.58);
  contactBody.rotation.z = -0.09;
  addEdges(contact, contactBody, 0.62);
  addInstances(
    contact,
    "Contact carved negative-space grooves",
    new BoxGeometry(1, 1, 1),
    limestoneShadow,
    [
      { position: [-0.45, 1.95, -0.57], rotation: [0, 0, -0.5], scale: [0.24, 1.55, 0.08] },
      { position: [0.42, 1.72, -0.58], rotation: [0, 0, 0.45], scale: [0.22, 1.28, 0.08] },
      { position: [0, 2.76, -0.59], scale: [0.72, 0.2, 0.08] },
    ],
  );

  const key = workGroup(1);
  addBox(key, "Himmelschlüssel stone foot", [1.85, 0.34, 1.65], [0, 0.17, 0], limestone);
  for (let level = 0; level < 6; level += 1) {
    const band = addBox(
      key,
      "Himmelschlüssel stacked cut limestone band",
      [1.25 - level * 0.055, 0.72, 1.02],
      [0, 0.7 + level * 0.62, 0],
      level % 2 === 0 ? limestone : limestoneLight,
    );
    band.rotation.y = (level % 2 === 0 ? -1 : 1) * (0.12 + level * 0.025);
    addEdges(key, band, 0.54);
  }
  addInstances(
    key,
    "Himmelschlüssel split crown lobes",
    new SphereGeometry(0.5, 10, 7),
    limestoneLight,
    [
      { position: [-0.38, 4.35, 0], scale: [0.78, 1.35, 0.86] },
      { position: [0.38, 4.35, 0], scale: [0.78, 1.35, 0.86] },
    ],
  );
  addMesh(
    key,
    "Himmelschlüssel crown aperture",
    new CylinderGeometry(0.25, 0.25, 1.08, 16),
    limestoneShadow,
    [0, 4.42, -0.34],
  ).rotation.x = Math.PI / 2;

  const bud = workGroup(2);
  addBox(bud, "Große Knospe stone base", [3, 0.42, 2.3], [0, 0.21, 0], limestone);
  addInstances(
    bud,
    "Große Knospe four organic lobes",
    new SphereGeometry(1, 12, 9),
    limestone,
    [
      { position: [-0.72, 1.48, -0.25], rotation: [0, 0.2, -0.25], scale: [1.05, 1.45, 0.78] },
      { position: [0.72, 1.48, -0.16], rotation: [0, -0.25, 0.25], scale: [1.02, 1.52, 0.8] },
      { position: [-0.42, 2.45, 0], rotation: [0, 0, 0.25], scale: [0.8, 1.05, 0.65] },
      { position: [0.43, 2.42, 0], rotation: [0, 0, -0.25], scale: [0.82, 1.08, 0.66] },
    ],
  );
  addBox(bud, "Große Knospe central cleft", [0.16, 2.25, 0.1], [0, 1.95, -0.76], limestoneShadow);

  const breakWork = workGroup(3);
  addBox(breakWork, "Todes Mauer Bruch granite inscription slab", [3.6, 0.24, 2.2], [0, 0.12, 0], limestone);
  const breakTransforms: InstanceTransform[] = [
    { position: [-0.98, 1.55, 0], rotation: [0, 0.04, -0.08], scale: [0.8, 3, 0.42] },
    { position: [-0.28, 1.8, 0], rotation: [0, -0.03, 0.08], scale: [0.55, 3.45, 0.42] },
    { position: [0.42, 1.68, 0], rotation: [0, 0.05, -0.06], scale: [0.58, 3.18, 0.42] },
    { position: [1.02, 1.45, 0], rotation: [0, -0.04, 0.1], scale: [0.56, 2.72, 0.42] },
  ];
  addInstances(
    breakWork,
    "Todes Mauer Bruch split weathered steel plates",
    new BoxGeometry(1, 1, 1),
    steel,
    breakTransforms,
  );

  for (const group of root.children as Group[]) {
    addBox(group, `${group.name} information plaque`, [0.62, 0.06, 0.42], [1.8, 0.08, 1.2], plaque);
  }
  root.userData.modelCount = root.children.length;
  return root;
}

function createHolocaustMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.rotation.y = -0.105;
  group.userData.geometryStatus = HOLOCAUST_GEOMETRY_STATUS;

  // The layout now comes from `holocaustField.ts`, which derives the whole
  // grid from the documented stele footprint and Eisenman's 0.95 m alley.
  // The field that shipped before had three measurable errors: 2710 stelae
  // instead of 2711, alleys 1.50 m wide across the field (58 % too wide)
  // and 0.52 m along it (45 % too narrow). The alley is the memorial —
  // wide enough for one person, too narrow for two, the same either way
  // you turn — and having it wrong in opposite directions on the two axes
  // turned a lattice of equal corridors into rows of spaced blocks.
  const placements = holocaustStelePlacements();
  const transforms: InstanceTransform[] = placements.map((stele) => ({
    position: [stele.x, stele.ground + stele.height / 2, stele.z],
    rotation: [stele.tiltX, 0, stele.tiltZ],
    scale: [1, stele.height, 1],
  }));
  const stelae = addInstances(
    group,
    `Holocaust Memorial ${HOLOCAUST_FIELD.steleCount} instanced stelae`,
    new BoxGeometry(
      HOLOCAUST_FIELD.steleWidth,
      1,
      HOLOCAUST_FIELD.steleLength,
    ),
    modelMaterial(HOLOCAUST_PALETTES.day.concrete, { roughness: 0.82 }),
    transforms,
  );
  stelae.castShadow = false;
  return group;
}

function createSintiRomaMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "Published approximately 12 m pool and 69 place stones; 60 x 60 m published overall artwork extent; uncited local dimensions are visual-reference approximations";
  group.userData.evidence = {
    overallExtentM: SINTI_ROMA_MEMORIAL.overallExtentM,
    placeStoneCount: SINTI_ROMA_MEMORIAL.placeStoneCount,
    poolDiameterM: SINTI_ROMA_MEMORIAL.poolDiameterM,
  };

  // The group anchor is the fifth-percentile mesh sample, while the clearing
  // itself sits on the locally raised Tiergarten surface. Keep this calibrated
  // offset explicit so thin stones do not disappear inside the official mesh.
  const clearingSurfaceY = 0.46;

  // Dani Karavan's centre is an approximately 12 m black reflecting lake in
  // a thin, dark-coated steel pan. The previous 15.2 m disk was 27 % too wide
  // and consequently made every neighbouring element look too small.
  const rim = addMesh(
    group,
    "Sinti and Roma memorial dark circular basin",
    new CylinderGeometry(6.2, 6.2, 0.24, 96),
    modelMaterial(0x11191b, { metalness: 0.38, roughness: 0.3 }),
    [0, clearingSurfaceY + 0.12, 0],
  );
  rim.receiveShadow = true;
  rim.userData.poolDiameterM = SINTI_ROMA_MEMORIAL.poolDiameterM;
  const waterMaterial = new MeshBasicMaterial({
    color: 0x070d0d,
    polygonOffset: true,
    polygonOffsetFactor: -2.4,
    polygonOffsetUnits: -2.4,
  });
  // An unlit material keeps the defining black mirror temporally stable. A
  // glossy physical material produced a large cyan sky lobe in the isometric
  // light rig and read as a second water body rather than a dark reflection.
  const water = addMesh(
    group,
    "Sinti and Roma memorial black reflecting water",
    new CylinderGeometry(6, 6, 0.045, 96),
    waterMaterial,
    [0, clearingSurfaceY + 0.3, 0],
  );
  water.castShadow = false;
  water.renderOrder = 3;
  water.userData.poolDiameterM = SINTI_ROMA_MEMORIAL.poolDiameterM;

  // The retractable granite triangle barely clears the water; it is broad
  // enough to remain recognisable from the close isometric camera without
  // becoming a raised monument in its own right.
  const stone = addMesh(
    group,
    "Sinti and Roma memorial triangular centre stone",
    new CylinderGeometry(1.62, 1.62, 0.14, 3),
    modelMaterial(0x414547, { roughness: 0.34 }),
    [0, clearingSurfaceY + 0.41, 0],
  );
  stone.rotation.y = Math.PI / 6;
  stone.userData.retractsDaily = true;
  addEdges(group, stone, 0.58);

  // One fresh flower lies on the stone every day. A small instanced rosette
  // is much clearer than a coloured point and still costs one draw call.
  const petalTransforms = Array.from({ length: 12 }, (_unused, index) => {
    const angle = (index / 12) * Math.PI * 2;
    return {
      position: [
        Math.cos(angle) * 0.2,
        clearingSurfaceY + 0.53,
        Math.sin(angle) * 0.2,
      ] as [number, number, number],
      rotation: [0, -angle, 0] as [number, number, number],
      scale: [0.17, 0.035, 0.075] as [number, number, number],
    };
  });
  addInstances(
    group,
    "Sinti and Roma memorial daily flower petals",
    new SphereGeometry(1, 8, 5),
    modelMaterial(0xd95b32, { roughness: 0.68 }),
    petalTransforms,
  );
  addMesh(
    group,
    "Sinti and Roma memorial daily flower centre",
    new CylinderGeometry(0.085, 0.085, 0.055, 12),
    modelMaterial(0x64341f, { roughness: 0.78 }),
    [0, clearingSurfaceY + 0.54, 0],
  );

  // Spinelli's poem surrounds the steel pan in German and English. At this
  // scale the engraved letters resolve as short pewter strokes rather than a
  // false solid band; the two Romanes versions belong to the chronology.
  const poemStrokes: InstanceTransform[] = [];
  for (let language = 0; language < 2; language += 1) {
    for (let index = 0; index < 42; index += 1) {
      const angle =
        language * Math.PI +
        0.18 +
        (index / 41) * (Math.PI - 0.36);
      poemStrokes.push({
        position: [
          Math.cos(angle) * 6.1,
          clearingSurfaceY + 0.335,
          Math.sin(angle) * 6.1,
        ],
        rotation: [0, -angle - Math.PI / 2, 0],
        scale: [
          0.055 + deterministicUnit(index, language + 1) * 0.04,
          0.018,
          0.028,
        ],
      });
    }
  }
  addInstances(
    group,
    "Sinti and Roma memorial German and English poem engraving",
    new BoxGeometry(1, 1, 1),
    modelMaterial(0x858989, { metalness: 0.45, roughness: 0.42 }),
    poemStrokes,
  );

  // The narrow apron is made from individually broken granite pieces with
  // grass joints, not a smooth grey annulus. A deterministic irregular field
  // preserves the calm circle without turning the fragments into radial rays.
  const apronTransforms = Array.from({ length: 168 }, (_unused, index) => {
    const angle =
      index * Math.PI * (3 - Math.sqrt(5)) +
      deterministicUnit(index, 21) * 0.11;
    const radius = 6.35 + deterministicUnit(index, 22) * 1.72;
    return {
      position: [
        Math.cos(angle) * radius,
        clearingSurfaceY + 0.07,
        Math.sin(angle) * radius,
      ] as [number, number, number],
      rotation: [0, deterministicUnit(index, 23) * Math.PI * 2, 0] as [
        number,
        number,
        number,
      ],
      scale: [
        0.16 + deterministicUnit(index, 24) * 0.18,
        0.045,
        0.12 + deterministicUnit(index, 25) * 0.14,
      ] as [number, number, number],
    };
  });
  addInstances(
    group,
    "Sinti and Roma memorial fragmented granite apron",
    new CylinderGeometry(1, 1, 1, 5),
    modelMaterial(0xaaa99f, { roughness: 0.95 }),
    apronTransforms,
  );

  // Exactly 69 irregular granite shards carry the documented crime-site
  // names. Their individual dimensions and positions are visual-reference
  // approximations; the official count and the broken-shard character are
  // not. A separate dark groove per stone keeps the names readable as marks
  // in an isometric close view without inventing letterforms.
  const placeStoneTransforms = Array.from(
    { length: SINTI_ROMA_MEMORIAL.placeStoneCount },
    (_unused, index) => {
      const progress = (index + 0.5) / SINTI_ROMA_MEMORIAL.placeStoneCount;
      const angle =
        index * Math.PI * (3 - Math.sqrt(5)) +
        deterministicUnit(index, 31) * 0.18;
      const radius =
        8.1 + Math.sqrt(progress) * 10.2 + deterministicUnit(index, 32) * 0.8;
      return {
        position: [
          Math.cos(angle) * radius,
          clearingSurfaceY + 0.08,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        rotation: [0, deterministicUnit(index, 33) * Math.PI * 2, 0] as [
          number,
          number,
          number,
        ],
        scale: [
          0.28 + deterministicUnit(index, 34) * 0.28,
          0.055,
          0.2 + deterministicUnit(index, 35) * 0.22,
        ] as [number, number, number],
      };
    },
  );
  const placeStones = addInstances(
    group,
    "Sinti and Roma memorial 69 camp name stones",
    new CylinderGeometry(1, 1, 1, 5),
    modelMaterial(0x74746f, { roughness: 0.9 }),
    placeStoneTransforms,
  );
  placeStones.userData.placeCount = SINTI_ROMA_MEMORIAL.placeStoneCount;
  addInstances(
    group,
    "Sinti and Roma memorial engraved place-name grooves",
    new BoxGeometry(1, 1, 1),
    modelMaterial(0x3d3c39, { roughness: 0.72 }),
    placeStoneTransforms.map((transform, index) => ({
      position: [
        transform.position[0],
        clearingSurfaceY + 0.14,
        transform.position[2],
      ],
      rotation: transform.rotation,
      scale: [
        0.12 + deterministicUnit(index, 36) * 0.16,
        0.012,
        0.025,
      ],
    })),
  );

  // The chronology is a long, segmented glass and Corten-steel boundary,
  // with one actual doorway. The 2022 outdoor exhibition added nine
  // biographies and media stations. Restrained portrait rectangles are
  // procedural display cues, not copied photographs.
  const panelSlots = 22;
  const gateSlot = 15;
  const panelSpacing = 1.78;
  const panelTransforms: InstanceTransform[] = [];
  for (let slot = 0; slot < panelSlots; slot += 1) {
    if (slot === gateSlot) continue;
    panelTransforms.push({
      position: [(slot - (panelSlots - 1) / 2) * panelSpacing, 1.22, -22],
      scale: [1.66, 2.36, 0.1],
    });
  }
  const glassMaterial = new MeshPhysicalMaterial({
    color: 0x91a7a5,
    metalness: 0.08,
    opacity: 0.62,
    roughness: 0.38,
    transparent: true,
  });
  glassMaterial.depthWrite = false;
  const chronology = addInstances(
    group,
    "Sinti and Roma memorial glass chronicle wall",
    new BoxGeometry(1, 1, 1),
    glassMaterial,
    panelTransforms,
  );
  chronology.renderOrder = 4;

  const frameMaterial = modelMaterial(0x5d4035, {
    metalness: 0.32,
    roughness: 0.72,
  });
  const wallHalfWidth = ((panelSlots - 1) * panelSpacing) / 2;
  addInstances(
    group,
    "Sinti and Roma memorial Corten chronology frames",
    new BoxGeometry(1, 1, 1),
    frameMaterial,
    Array.from({ length: panelSlots + 1 }, (_unused, index) => ({
      position: [
        -wallHalfWidth - panelSpacing / 2 + index * panelSpacing,
        1.22,
        -22,
      ],
      scale: [0.055, 2.48, 0.15],
    })),
  );
  const gateX = (gateSlot - (panelSlots - 1) / 2) * panelSpacing;
  addBox(
    group,
    "Sinti and Roma memorial Corten entrance lintel",
    [panelSpacing + 0.12, 0.12, 0.2],
    [gateX, 2.42, -22],
    frameMaterial,
  );
  addInstances(
    group,
    "Sinti and Roma memorial chronology text lines",
    new BoxGeometry(1, 1, 1),
    modelMaterial(0x394544, { roughness: 0.78 }),
    panelTransforms.flatMap((panel, panelIndex) =>
      Array.from({ length: 4 }, (_unused, row) => ({
        position: [
          panel.position[0] -
            0.2 +
            deterministicUnit(panelIndex, row + 41) * 0.12,
          0.62 + row * 0.32,
          -21.93,
        ] as [number, number, number],
        scale: [
          0.42 + deterministicUnit(panelIndex, row + 51) * 0.32,
          0.025,
          0.018,
        ] as [number, number, number],
      })),
    ),
  );

  const biographyPanels = panelTransforms.filter(
    (_panel, index) => index % 2 === 0,
  ).slice(0, 9);
  const portraits = addInstances(
    group,
    "Sinti and Roma memorial nine biography portraits",
    new PlaneGeometry(1, 1),
    modelMaterial(0xb8bbb6, { roughness: 0.86 }),
    biographyPanels.map((panel, index) => ({
      position: [panel.position[0], 1.66, -21.925],
      scale: [0.42 + (index % 3) * 0.04, 0.58, 1],
    })),
  );
  portraits.userData.biographyCount = 9;
  addInstances(
    group,
    "Sinti and Roma memorial three exhibition benches",
    new BoxGeometry(1, 1, 1),
    modelMaterial(0x282c2d, { metalness: 0.18, roughness: 0.62 }),
    [-6.2, 0, 6.2].map((x) => ({
      position: [x, 0.34, -18.3],
      scale: [3.2, 0.48, 0.82],
    })),
  );
  return group;
}

function createHomosexualMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.rotation.y = -0.18;
  group.userData.geometryStatus =
    "Characteristic tilted concrete cuboid and viewing window from official and licensed visual references";
  // Elmgreen & Dragset's cuboid leans — it echoes a single skewed stele of
  // the Holocaust memorial across the road, so the tilt is the whole point.
  const tilted = new Group();
  tilted.name = "Memorial to persecuted homosexuals tilted body";
  tilted.rotation.z = 0.06;
  tilted.rotation.x = -0.045;
  group.add(tilted);
  addBox(
    tilted,
    "Memorial to persecuted homosexuals concrete cuboid",
    [3.7, 4.2, 2.55],
    [0, 2.1, 0],
    modelMaterial(0x555b5d, { roughness: 0.84 }),
  );
  // The window is a hole cut through 30 cm of concrete, not a decal: the
  // reveal is what you actually see from an angle, and the film inside it
  // is the only light the cuboid gives off at night.
  addBox(
    tilted,
    "Memorial to persecuted homosexuals window reveal",
    [1.44, 1.04, 0.34],
    [-0.38, 1.52, 1.19],
    modelMaterial(0x3d4345, { roughness: 0.88 }),
  );
  const window = addMesh(
    tilted,
    "Memorial to persecuted homosexuals viewing window",
    new PlaneGeometry(1.28, 0.88),
    nightEmitter(modelMaterial(0x101819, { roughness: 0.18 }), 0xd7e6de, 0.5),
    [-0.38, 1.52, 1.281],
  );
  window.renderOrder = 4;
  return group;
}

/**
 * The Gedenkort für Polen 1939-1945 at the former Kroll-Oper site, unveiled on
 * 16 June 2025: a glacial erratic on an oval gravel plaza, with a weathering
 * steel plaque, two trilingual information panels and a single wild apple tree.
 */
function createPolishMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.rotation.y = 0.22;
  // The elements are documented; their measurements are not published, so the
  // sizes here are read off photographs against the boulder and the panels.
  group.userData.geometryStatus =
    "Findling, steel plaque, two information panels and the wild apple tree of the 2025 Gedenkort; element sizes are photo-derived because no dimensions are published, and the permanent Deutsch-Polnisches Haus is not built and is deliberately not modelled";
  const plaza = addMesh(
    group,
    "Polish memorial oval gravel plaza",
    new CylinderGeometry(1, 1, 0.12, 40),
    modelMaterial(0xb0a893, { roughness: 0.96 }),
    [0, 0.06, 0],
  );
  plaza.scale.set(6.4, 1, 4.6);
  plaza.castShadow = false;
  // A roughly 30 t erratic: a sphere pushed out of round and sunk into the
  // gravel, so it reads as a boulder rather than as a dressed block.
  const findling = addMesh(
    group,
    "Polish memorial Findling",
    new SphereGeometry(1, 9, 6),
    modelMaterial(0x8a8377, { roughness: 0.88 }),
    [0, 0.78, 0],
  );
  findling.scale.set(1.55, 0.92, 1.18);
  findling.rotation.set(0.12, 0.6, -0.07);
  const plaque = addBox(
    group,
    "Polish memorial weathering steel plaque",
    [1.35, 0.78, 0.05],
    [0.1, 0.86, 1.02],
    modelMaterial(0x7a4b30, { metalness: 0.5, roughness: 0.66 }),
  );
  plaque.rotation.x = -0.14;
  const panelPosts: InstanceTransform[] = [-1, 1].map((side) => ({
    position: [side * 3.5, 0.55, 1.5],
  }));
  addInstances(
    group,
    "Polish memorial information panel posts",
    new BoxGeometry(0.09, 1.1, 0.09),
    modelMaterial(0x5c5a54, { metalness: 0.35, roughness: 0.6 }),
    panelPosts,
  );
  const panels: InstanceTransform[] = [-1, 1].map((side) => ({
    position: [side * 3.5, 1.24, 1.5],
    rotation: [-0.5, 0, 0],
  }));
  addInstances(
    group,
    "Polish memorial trilingual information panels",
    new BoxGeometry(1.15, 0.72, 0.04),
    modelMaterial(0x4a4f52, { metalness: 0.28, roughness: 0.5 }),
    panels,
  );
  addMesh(
    group,
    "Polish memorial wild apple tree trunk",
    new CylinderGeometry(0.11, 0.16, 2.3, 8),
    modelMaterial(0x6b5b45, { roughness: 0.92 }),
    [-4.1, 1.15, -1.1],
  );
  const crown = addMesh(
    group,
    "Polish memorial wild apple tree crown",
    new SphereGeometry(1.55, 10, 7),
    modelMaterial(0x6f8156, { roughness: 0.95 }),
    [-4.1, 3.3, -1.1],
  );
  crown.scale.set(1, 0.82, 1);
  return group;
}

function addTank(
  group: Group,
  name: string,
  x: number,
  z: number,
  lift = 0,
): void {
  const vehicle = new Group();
  vehicle.name = `${name} vehicle`;
  vehicle.position.set(x, 0, z);
  // Both preserved tanks stand parallel to the Strasse des 17. Juni and face
  // outward along it, rather than aiming through the memorial forecourt.
  vehicle.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  group.add(vehicle);
  // Restored display finish: pale Soviet olive, not the near-black green that
  // made both vehicles disappear against the Tiergarten canopy.
  const armor = modelMaterial(0x718264, { metalness: 0.24, roughness: 0.66 });
  const dark = modelMaterial(0x1b221d, { metalness: 0.34, roughness: 0.68 });
  const hull = addBox(
    vehicle,
    `${name} hull`,
    [3.05, 1.18, 5.45],
    [0, 1.28 + lift, 0],
    armor,
  );
  hull.userData.vehicleType = "T-34/76";
  addEdges(vehicle, hull);
  addBox(
    vehicle,
    `${name} left track`,
    [0.52, 0.78, 5.9],
    [-1.55, 0.62 + lift, 0],
    dark,
  );
  addBox(
    vehicle,
    `${name} right track`,
    [0.52, 0.78, 5.9],
    [1.55, 0.62 + lift, 0],
    dark,
  );
  const wheelTransforms: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 5; index += 1) {
      wheelTransforms.push({
        position: [side * 1.82, 0.62 + lift, -2.08 + index * 1.04],
        rotation: [0, 0, Math.PI / 2],
      });
    }
  }
  addInstances(
    vehicle,
    `${name} ten T-34 road wheels`,
    new CylinderGeometry(0.46, 0.46, 0.24, 12),
    dark,
    wheelTransforms,
  );
  const glacis = addBox(
    vehicle,
    `${name} sloped front glacis`,
    [2.78, 0.62, 1.18],
    [0, 1.52 + lift, -2.62],
    armor,
  );
  glacis.rotation.x = -0.32;
  addEdges(vehicle, glacis);
  addBox(
    vehicle,
    `${name} engine deck`,
    [2.74, 0.28, 1.48],
    [0, 1.91 + lift, 1.92],
    armor,
  );
  addEdges(
    vehicle,
    addMesh(
      vehicle,
      `${name} turret`,
      new CylinderGeometry(1.16, 1.4, 0.94, 12),
      armor,
      [0, 2.33 + lift, -0.18],
    ),
  );
  addMesh(
    vehicle,
    `${name} command hatch`,
    new CylinderGeometry(0.42, 0.46, 0.16, 12),
    dark,
    [0.34, 2.88 + lift, -0.06],
  );
  addMesh(
    vehicle,
    `${name} gun mantlet`,
    new SphereGeometry(0.43, 12, 8),
    armor,
    [0, 2.36 + lift, -1.3],
  ).scale.set(1.35, 0.82, 0.58);
  addSegment(
    vehicle,
    `${name} 76 mm barrel`,
    new Vector3(0, 2.38 + lift, -1.38),
    new Vector3(0, 2.45 + lift, -4.85),
    0.14,
    dark,
  );
  for (const side of [-1, 1]) {
    addMesh(
      vehicle,
      `${name} front headlamp ${side < 0 ? "left" : "right"}`,
      new SphereGeometry(0.17, 10, 7),
      modelMaterial(0xe5d6a4, { metalness: 0.18, roughness: 0.32 }),
      [side * 0.92, 1.72 + lift, -2.88],
    );
  }
}

/**
 * One of the two ML-20 152 mm gun-howitzers that stand beside the T-34s.
 * Split-trail carriage, twin road wheels, shield and the long tube with its
 * muzzle brake — the features that tell it apart from the tanks at a glance.
 */
function addHowitzer(
  group: Group,
  name: string,
  x: number,
  z: number,
  lift: number,
): void {
  const steel = modelMaterial(0x3d5445, { metalness: 0.3, roughness: 0.6 });
  const dark = modelMaterial(0x1d241f, { metalness: 0.34, roughness: 0.66 });
  addBox(group, `${name} cradle`, [1.1, 0.62, 2.1], [x, 1.18 + lift, z], steel);
  const shield = addBox(
    group,
    `${name} gun shield`,
    [2.5, 1.35, 0.12],
    [x, 1.5 + lift, z - 0.85],
    steel,
  );
  shield.rotation.x = 0.16;
  addEdges(group, shield);
  addSegment(
    group,
    `${name} 152 mm tube`,
    new Vector3(x, 1.42 + lift, z - 0.9),
    new Vector3(x, 2.2 + lift, z - 5.4),
    0.11,
    dark,
  );
  addMesh(
    group,
    `${name} muzzle brake`,
    new CylinderGeometry(0.19, 0.19, 0.5, 10),
    dark,
    [x, 2.24 + lift, z - 5.55],
  ).rotation.x = Math.PI / 2;
  // Split trails, spread the way the piece is displayed.
  for (const side of [-1, 1]) {
    addSegment(
      group,
      `${name} split trail ${side < 0 ? "left" : "right"}`,
      new Vector3(x, 0.95 + lift, z + 0.4),
      new Vector3(x + side * 1.5, 0.35 + lift, z + 4.4),
      0.12,
      steel,
    );
  }
  const wheels: InstanceTransform[] = [-1, 1].map((side) => ({
    position: [x + side * 1.16, 0.72 + lift, z],
    rotation: [0, 0, Math.PI / 2],
  }));
  addInstances(
    group,
    `${name} two carriage wheels`,
    new CylinderGeometry(0.72, 0.72, 0.28, 14),
    dark,
    wheels,
  );
}

/**
 * Kerbel's eight-metre bronze soldier on the crown of the central portal.
 * A capsule and a ball read as a grey pill from the presentation camera, so
 * the parts that carry the silhouette are modelled: the flaring skirt of the
 * greatcoat, the shoulders, the peaked cap and the slung rifle.
 */
function addSovietSoldier(group: Group, bronze: MeshStandardMaterial): void {
  const base = 13.05;
  const z = -3;
  for (const side of [-1, 1]) {
    const leg = addBox(
      group,
      `Soviet memorial soldier ${side < 0 ? "left" : "right"} boot`,
      [0.66, 2.6, 0.98],
      [side * 0.55, base + 1.3, z],
      bronze,
    );
    addEdges(group, leg);
  }
  const coat = addMesh(
    group,
    "Soviet memorial eight metre soldier body",
    new CylinderGeometry(1.12, 1.72, 4.1, 10),
    bronze,
    [0, base + 3.95, z],
  );
  addEdges(group, coat);
  const shoulders = addBox(
    group,
    "Soviet memorial soldier shoulders",
    [2.62, 0.92, 1.24],
    [0, base + 6.32, z],
    bronze,
  );
  addEdges(group, shoulders);
  for (const side of [-1, 1]) {
    addSegment(
      group,
      `Soviet memorial soldier ${side < 0 ? "left" : "right"} arm`,
      new Vector3(side * 1.2, base + 6.2, z),
      new Vector3(side * 1.42, base + 3.5, z + side * 0.2),
      0.34,
      bronze,
    );
  }
  addMesh(
    group,
    "Soviet memorial soldier head",
    new SphereGeometry(0.62, 14, 10),
    bronze,
    [0, base + 7.2, z],
  );
  const cap = addMesh(
    group,
    "Soviet memorial soldier peaked cap",
    new CylinderGeometry(0.72, 0.66, 0.34, 12),
    bronze,
    [0, base + 7.72, z],
  );
  addEdges(group, cap);
  addMesh(
    group,
    "Soviet memorial soldier cap visor",
    new BoxGeometry(0.92, 0.1, 0.5),
    bronze,
    [0, base + 7.58, z + 0.62],
  );
  // Rifle slung muzzle-up across the right shoulder.
  addSegment(
    group,
    "Soviet memorial soldier rifle",
    new Vector3(1.46, base + 8.15, z - 0.55),
    new Vector3(0.72, base + 2.5, z - 0.15),
    0.15,
    bronze,
  );
}

function createSovietMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  // Project world +z points south here. Keep the entrance, tanks and broad
  // forecourt on that side, toward the Strasse des 17. Juni; the former PI
  // rotation put the ensemble on the park side and swapped east with west.
  group.userData.streetFrontWorldAxis = "+z";
  group.userData.geometryStatus =
    "Official street-facing composition, T-34/76 tank type and 8 m soldier height; local spacing remains a visual approximation";
  group.userData.sourceUrl =
    "https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/";
  const stone = modelMaterial(0xcfccc0, { roughness: 0.78 });
  // The old 0x777a73 pylon read near-black under the day rig; the real
  // memorial is warm light granite throughout.
  const stoneDark = modelMaterial(0xa9a79b, { roughness: 0.84 });
  const bronze = modelMaterial(0x4f6657, { metalness: 0.38, roughness: 0.55 });
  const gold = modelMaterial(0xc9a227, { metalness: 0.45, roughness: 0.4 });
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
  // The colonnade carries a projecting cornice over the entablature and
  // stands on a continuous stylobate, not directly on the paving.
  for (const side of [-1, 1]) {
    addBox(
      group,
      "Soviet memorial colonnade cornice",
      [24.4, 0.55, 4.1],
      [side * 17, 12.05, -1.75],
      stoneDark,
    );
    addBox(
      group,
      "Soviet memorial colonnade stylobate",
      [24.4, 1.1, 4.2],
      [side * 17, 1.35, -2.4],
      stone,
    );
  }
  // Gilded inscriptions: a name plate on every side pylon and the
  // dedication band on the central pylon, like the real memorial.
  for (const x of [-24, -16, -8, 8, 16, 24]) {
    addBox(
      group,
      "Soviet memorial gilded name plate",
      [2.6, 3.4, 0.12],
      [x, 6.4, -1.35 - Math.abs(x) * 0.075],
      gold,
    );
  }
  addBox(group, "Soviet memorial gilded dedication band", [5.2, 1.1, 0.12], [0, 11.6, -0.4], gold);
  // Flower beds flank the stairs.
  addBox(group, "Soviet memorial west flower bed", [10, 0.5, 4], [-20, 0.55, 8], modelMaterial(0x4c6a3c, { roughness: 0.95 }));
  addBox(group, "Soviet memorial east flower bed", [10, 0.5, 4], [20, 0.55, 8], modelMaterial(0x4c6a3c, { roughness: 0.95 }));
  addSovietSoldier(group, bronze);
  // The two T-34s frame the main entrance directly beside the road. The two
  // ML-20 gun-howitzers stand diagonally behind them at the first stair.
  const TANK_PLINTH = 1.85;
  const GUN_PLINTH = 1.25;
  const TANK_Z = 11.5;
  const GUN_Z = 4.5;
  // The official TrueDOP shows the tanks outside the guns on both wings.
  // Their hulls at x=+/-33 clear the colonnade cornice, which ends at
  // x=+/-29.2; the guns sit farther in and behind at the first stair.
  for (const side of [-1, 1]) {
    addEdges(
      group,
      addBox(
        group,
        "Soviet memorial T-34 plinth",
        [9.4, TANK_PLINTH, 6.2],
        [side * 33, TANK_PLINTH / 2, TANK_Z],
        stoneDark,
      ),
    );
    addEdges(
      group,
      addBox(
        group,
        "Soviet memorial howitzer plinth",
        [5.2, GUN_PLINTH, 8.6],
        [side * 24, GUN_PLINTH / 2, GUN_Z],
        stoneDark,
      ),
    );
  }
  addTank(group, "Soviet memorial T-34 west", -33, TANK_Z, TANK_PLINTH);
  addTank(group, "Soviet memorial T-34 east", 33, TANK_Z, TANK_PLINTH);
  addHowitzer(
    group,
    "Soviet memorial ML-20 howitzer west",
    -24,
    GUN_Z,
    GUN_PLINTH,
  );
  addHowitzer(
    group,
    "Soviet memorial ML-20 howitzer east",
    24,
    GUN_Z,
    GUN_PLINTH,
  );
  return group;
}

function createGoetheMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "Pedestal, standing Goethe and three allegorical groups from Berlin monument inventory and licensed references";
  const marble = modelMaterial(MARBLE, { roughness: 0.7 });
  // The monument stands on a two-step stylobate; without the steps the
  // plinth looks dropped on the lawn rather than built into the Großer Weg.
  addEdges(
    group,
    addBox(group, "Goethe memorial lower step", [9, 0.3, 9], [0, 0.15, 0], marble),
  );
  addEdges(
    group,
    addBox(group, "Goethe memorial upper step", [8.1, 0.3, 8.1], [0, 0.45, 0], marble),
  );
  addEdges(
    group,
    addBox(group, "Goethe memorial plinth", [7.2, 0.65, 7.2], [0, 0.93, 0], marble),
  );
  const pedestal = addMesh(
    group,
    "Goethe memorial round pedestal",
    new CylinderGeometry(2.25, 2.6, 3.5, 20),
    marble,
    [0, 3, 0],
  );
  addEdges(group, pedestal);
  // A cornice under the standing figure and a base moulding at the drum's
  // foot: the two lines that read as a pedestal at isometric distance.
  const cornice = addMesh(
    group,
    "Goethe memorial pedestal cornice",
    new CylinderGeometry(2.55, 2.35, 0.34, 20),
    marble,
    [0, 4.9, 0],
  );
  addEdges(group, cornice);
  const baseMoulding = addMesh(
    group,
    "Goethe memorial pedestal base moulding",
    new CylinderGeometry(2.85, 3, 0.4, 20),
    marble,
    [0, 1.45, 0],
  );
  addEdges(group, baseMoulding);
  const body = addMesh(
    group,
    "Goethe standing figure body",
    new CapsuleGeometry(0.8, 2.55, 5, 10),
    marble,
    [0, 6.25, 0],
  );
  addEdges(group, body);
  // Schaper's Goethe wears a long cloak over the left shoulder and holds a
  // scroll; the cloak is what gives the figure its wide, readable silhouette.
  const cloak = addMesh(
    group,
    "Goethe standing figure cloak",
    new ConeGeometry(0.98, 2.9, 14, 1, true),
    marble,
    [-0.08, 6, -0.06],
  );
  cloak.rotation.z = 0.05;
  addEdges(group, cloak);
  const head = addMesh(
    group,
    "Goethe standing figure head",
    new SphereGeometry(0.58, 14, 10),
    marble,
    [0, 8.15, 0],
  );
  addEdges(group, head);
  addSegment(
    group,
    "Goethe standing figure right arm",
    new Vector3(0.62, 7.1, 0.1),
    new Vector3(0.78, 5.95, 0.62),
    0.19,
    marble,
  );
  addSegment(
    group,
    "Goethe standing figure left arm",
    new Vector3(-0.62, 7.1, 0.05),
    new Vector3(-0.5, 6.1, 0.5),
    0.19,
    marble,
  );
  addEdges(
    group,
    addBox(
      group,
      "Goethe standing figure scroll",
      [0.16, 0.16, 0.62],
      [0.82, 5.88, 0.72],
      marble,
    ),
  );
  // Lyrik, Forschung and Drama sit against the drum: seated bodies with
  // separate heads, so each group reads as a figure and not a lump.
  const allegoryAngles = [0, 1, 2].map((index) => (index / 3) * Math.PI * 2);
  // Lyrik, Forschung and Drama each sit on a block that steps out of the
  // drum, the way Schaper set them — otherwise they float against it.
  addInstances(
    group,
    "Goethe memorial allegorical figure pedestals",
    new BoxGeometry(1.9, 0.85, 1.6),
    marble,
    allegoryAngles.map((angle) => ({
      position: [Math.cos(angle) * 3.1, 1.68, Math.sin(angle) * 3.1],
      rotation: [0, -angle, 0],
    })),
  );
  addInstances(
    group,
    "Goethe memorial three allegorical figure groups",
    new CapsuleGeometry(0.62, 1.65, 4, 8),
    marble,
    allegoryAngles.map((angle) => ({
      position: [Math.cos(angle) * 2.9, 2.65, Math.sin(angle) * 2.9],
      rotation: [0, -angle, Math.PI / 2],
      scale: [0.78, 1.1, 0.78],
    })),
  );
  addInstances(
    group,
    "Goethe memorial allegorical figure heads",
    new SphereGeometry(0.34, 12, 9),
    marble,
    allegoryAngles.map((angle) => ({
      position: [Math.cos(angle) * 3.35, 3.48, Math.sin(angle) * 3.35],
    })),
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
  // A round stone step ring under the triangular base, as on the Großer
  // Weg: the monument is approached, it does not just stand on grass.
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial step ring",
      new CylinderGeometry(6.2, 6.6, 0.34, 24),
      marble,
      [0, 0.17, 0],
    ),
  );
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial three-sided marble base",
      new CylinderGeometry(4.2, 4.7, 0.7, 3),
      marble,
      [0, 0.69, 0],
    ),
  );
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial three-sided coloured stele",
      new CylinderGeometry(2.9, 3.5, 6.2, 3),
      modelMaterial(0xd8d4c3, { roughness: 0.72 }),
      [0, 4.14, 0],
    ),
  );
  const faceAngles = [0, 1, 2].map(
    (index) => (index / 3) * Math.PI * 2 + Math.PI / 6,
  );
  // Each composer's bust sits in a recessed niche. The frame around it is
  // what makes the three faces read as faces rather than a plain cone.
  addInstances(
    group,
    "Composer memorial three bust niches",
    new BoxGeometry(2, 3.1, 0.3),
    modelMaterial(0xbdb7a4, { roughness: 0.78 }),
    faceAngles.map((angle) => ({
      // A three-sided cylinder puts its faces at half the circumradius,
      // so the niches sit at ~1.6 m, not out at the 3.1 m corners.
      position: [Math.cos(angle) * 1.62, 4.5, Math.sin(angle) * 1.62],
      rotation: [0, Math.PI / 2 - angle, 0],
    })),
  );
  // The corners of the triangle are carried by slim marble piers.
  addInstances(
    group,
    "Composer memorial corner piers",
    new BoxGeometry(0.62, 6.2, 0.62),
    marble,
    [0, 1, 2].map((index) => {
      const angle = (index / 3) * Math.PI * 2 + Math.PI / 2;
      return {
        position: [Math.cos(angle) * 3.1, 4.14, Math.sin(angle) * 3.1],
        rotation: [0, -angle, 0],
      };
    }),
  );
  const busts: InstanceTransform[] = faceAngles.map((angle) => ({
    position: [Math.cos(angle) * 2.05, 4.64, Math.sin(angle) * 2.05],
    scale: [1, 1.25, 0.72],
  }));
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
    [0, 7.54, 0],
  );
  dome.scale.y = 0.7;
  addEdges(group, dome);
  addMesh(
    group,
    "Composer memorial laurel crown",
    new TorusGeometry(1.65, 0.19, 8, 24),
    gold,
    [0, 9.89, 0],
  ).rotation.x = Math.PI / 2;
  const putti: InstanceTransform[] = [0, 1, 2].map((index) => {
    const angle = (index / 3) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * 0.95, 8.89, Math.sin(angle) * 0.95],
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

const JEHOVAH_DISC_COUNT = 15;
const JEHOVAH_TOTAL_HEIGHT = 5;
const JEHOVAH_BASE_HEIGHT = 0.15;

/**
 * Radius of the trunk stele at height fraction `t`. The documented silhouette
 * is an hourglass: it flares at the foot, pinches near mid-height and opens
 * out again into the crown.
 */
export function jehovahDiscRadius(t: number): number {
  const waist = 0.42;
  return t < 0.5
    ? waist + 0.53 * ((0.5 - t) / 0.5) ** 1.7
    : waist + 0.76 * ((t - 0.5) / 0.5) ** 1.9;
}

function createJehovahsWitnessesMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  // Matthias Leeck's stele, handed over on 24 June 2026: about five metres and
  // twelve tonnes of golden bronze, assembled from a base plate and fifteen
  // stacked discs. The diameters and the inscription are not published.
  group.userData.geometryStatus =
    "Five-metre bronze tree-trunk stele of a base plate and fifteen stacked discs, from the official description; disc diameters and the inscription are undocumented and the surface furrows are approximated by the offset facets";
  const gold = nightEmitter(
    modelMaterial(0xb8872d, { metalness: 0.72, roughness: 0.38 }),
    0xffc85c,
    0.78,
  );
  addMesh(
    group,
    "Jehovahs Witnesses memorial base plate",
    new CylinderGeometry(1.25, 1.32, JEHOVAH_BASE_HEIGHT, 20),
    gold,
    [0, JEHOVAH_BASE_HEIGHT / 2, 0],
  );
  const trunk = JEHOVAH_TOTAL_HEIGHT - JEHOVAH_BASE_HEIGHT;
  const discHeight = trunk / JEHOVAH_DISC_COUNT;
  const discs: InstanceTransform[] = Array.from(
    { length: JEHOVAH_DISC_COUNT },
    (_, index) => {
      const radius = jehovahDiscRadius((index + 0.5) / JEHOVAH_DISC_COUNT);
      return {
        position: [
          0,
          JEHOVAH_BASE_HEIGHT + (index + 0.5) * discHeight,
          0,
        ] as [number, number, number],
        // Each disc is turned against the one below so the twelve facets never
        // line up into a smooth wall: that offset is what reads as the deep
        // vertical furrowing of the cast surface.
        rotation: [0, index * 0.21, 0] as [number, number, number],
        scale: [radius, discHeight, radius] as [number, number, number],
      };
    },
  );
  addInstances(
    group,
    "Jehovahs Witnesses memorial stacked bronze discs",
    new CylinderGeometry(1, 1, 1, 12),
    gold,
    discs,
  );
  return group;
}

const BUILDERS: Record<string, (landmark: MemorialLandmark) => Group> = {
  "Beethoven-Haydn-Mozart-Denkmal": createComposerMemorial,
  "Denkzeichen Georg Elser": createGeorgElserMemorial,
  "Denkmal für die ermordeten Juden Europas": createHolocaustMemorial,
  "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas":
    createSintiRomaMemorial,
  "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen":
    createHomosexualMemorial,
  "Gedenkort für Polen 1939-1945": createPolishMemorial,
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
    // The forecourt is 75 m wide; at the old 145 m the T-34s and the
    // howitzers on the wings were two dark specks.
    return 108;
  }
  if (name === "Beethoven-Haydn-Mozart-Denkmal") {
    return 72;
  }
  if (name === "Goethe-Denkmal") {
    return 58;
  }
  if (name === "Gedenkort für Polen 1939-1945") {
    return 34;
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

import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
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
import { createLetteringTexture } from "./drawnLettering";
import {
  HOLOCAUST_FIELD,
  HOLOCAUST_GEOMETRY_STATUS,
  HOLOCAUST_PALETTES,
  holocaustStelePlacements,
} from "./holocaustField";
import { createGeorgElserMemorial } from "./GeorgElserMemorial";
import {
  TIERGARTEN_LITERARY_MEMORIALS_PROFILE,
  createTiergartenLiteraryMemorials,
} from "./TiergartenLiteraryMemorials";
import {
  WAGNER_MEMORIAL_PROFILE,
  createWagnerMemorial,
} from "./WagnerMemorial";

export {
  KROLLOPER_SCULPTURE_PROFILE,
  createKrolloperSculptureEnsemble,
} from "./KrolloperSculptures";

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

export const SINTI_ROMA_MEMORIAL = {
  overallExtentM: 60,
  placeStoneCount: 69,
  poolDiameterM: 12,
} as const;

export const SOVIET_WAR_MEMORIAL_PROFILE = {
  colonnadePiers: [
    [-25.5, -0.65],
    [-17, -1.65],
    [-8.5, -2.35],
    [8.5, -2.35],
    [17, -1.65],
    [25.5, -0.65],
  ] as const,
  dedicationLines: [
    "ВЕЧНАЯ СЛАВА",
    "ГЕРОЯМ ПАВШИМ",
    "В БОЯХ С НЕМЕЦКО-",
    "ФАШИСТСКИМИ",
    "ЗАХВАТЧИКАМИ",
    "ЗА СВОБОДУ И",
    "НЕЗАВИСИМОСТЬ",
    "СОВЕТСКОГО",
    "СОЮЗА",
  ] as const,
  forecourtWidthM: 78,
  fountainCount: 2,
  howitzerCount: 2,
  sarcophagusCount: 2,
  sidePylonCount: 6,
  soldierHeightM: 8,
  tankCount: 2,
  tankRoadWheelCount: 10,
  totalHeightM: 20.85,
  years: ["1941", "1945"] as const,
} as const;

export const BEETHOVEN_HAYDN_MOZART_PROFILE = {
  documentedHalfFigureHeightRangeM: [1.56, 1.7] as const,
  officialPartObject: "09046318,T,030",
  presentationFocus: {
    // The monument stands inside a dense Tiergarten canopy.  A high southern
    // approach clears the low trees along the path while retaining a readable
    // three-quarter view of the niches and cupola.
    azimuthDegrees: 180,
    distanceM: 48,
    fovDegrees: 34,
    polarDegrees: 65,
    targetHeightM: 4.4,
    targetWorldM: [-88.23575241171056, 3.73, 570.9512711009011] as const,
  },
  subjects: ["Mozart", "Haydn", "Beethoven"] as const,
  totalHeightM: 10,
  sources: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318",
    "https://bildhauerei-in-berlin.de/bildwerk/haydn-mozart-beethoven-denkmal-5236/",
  ],
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

/** A three-sided pavilion with each corner cut back to a short sixth face. */
function chamferedTrianglePrismGeometry(
  bottomRadius: number,
  topRadius: number,
  height: number,
): BufferGeometry {
  const triangle = [0, 1, 2].map((index) => {
    const angle = Math.PI / 2 + (index * Math.PI * 2) / 3;
    return [Math.cos(angle), Math.sin(angle)] as const;
  });
  const chamfer = 0.18;
  const outline: Array<readonly [number, number]> = [];
  triangle.forEach((corner, index) => {
    const previous = triangle[(index + triangle.length - 1) % triangle.length];
    const next = triangle[(index + 1) % triangle.length];
    outline.push(
      [
        corner[0] * (1 - chamfer) + previous[0] * chamfer,
        corner[1] * (1 - chamfer) + previous[1] * chamfer,
      ],
      [
        corner[0] * (1 - chamfer) + next[0] * chamfer,
        corner[1] * (1 - chamfer) + next[1] * chamfer,
      ],
    );
  });
  const positions: number[] = [];
  for (const radius of [bottomRadius, topRadius]) {
    const y = radius === bottomRadius ? 0 : height;
    for (const [x, z] of outline) positions.push(x * radius, y, z * radius);
  }
  const count = outline.length;
  const indices: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    indices.push(index, next, count + next, index, count + next, count + index);
  }
  for (let index = 1; index < count - 1; index += 1) {
    indices.push(0, index, index + 1);
    indices.push(count, count + index + 1, count + index);
  }
  const indexed = new BufferGeometry();
  indexed.setAttribute("position", new Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  return geometry;
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

function addRectangularSpan(
  group: Group,
  name: string,
  start: readonly [number, number],
  end: readonly [number, number],
  centerY: number,
  height: number,
  depth: number,
  material: MeshStandardMaterial,
): Mesh {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const span = addBox(
    group,
    name,
    [length, height, depth],
    [(start[0] + end[0]) / 2, centerY, (start[1] + end[1]) / 2],
    material,
  );
  span.rotation.y = -Math.atan2(dz, dx);
  addEdges(group, span, 0.72);
  return span;
}

function addMemorialLettering(
  group: Group,
  name: string,
  text: string,
  size: readonly [number, number],
  position: readonly [number, number, number],
  capHeightM: number,
  fieldColor = "#777870",
  letterColor = "#d0aa32",
  rotation: readonly [number, number, number] = [0, 0, 0],
): Mesh {
  const texture = createLetteringTexture({
    bandHeightM: size[1],
    bandWidthM: size[0],
    capHeightM,
    fieldColor,
    letterColor,
    text,
    texelsPerMetre: 320,
  });
  const dayMaterial = texture
    ? new MeshBasicMaterial({ map: texture, side: DoubleSide })
    : new MeshBasicMaterial({
        color: Number.parseInt(fieldColor.slice(1), 16),
        side: DoubleSide,
      });
  const nightMaterial = texture
    ? new MeshStandardMaterial({ map: texture, roughness: 0.74, side: DoubleSide })
    : new MeshStandardMaterial({
        color: Number.parseInt(fieldColor.slice(1), 16),
        roughness: 0.74,
        side: DoubleSide,
      });
  nightMaterial.userData.nightEmissive = Number.parseInt(
    letterColor.slice(1),
    16,
  );
  nightMaterial.userData.nightEmissiveIntensity = 0.12;
  const panel = addMesh(
    group,
    name,
    new PlaneGeometry(size[0], size[1]),
    dayMaterial,
    [...position],
  );
  panel.rotation.set(...rotation);
  panel.castShadow = false;
  panel.receiveShadow = false;
  panel.renderOrder = 5;
  panel.userData.dayMaterial = dayMaterial;
  panel.userData.fallbackWithoutCanvas = texture === null;
  panel.userData.lettering = text;
  panel.userData.nightMaterial = nightMaterial;
  return panel;
}

function deterministicUnit(index: number, salt: number): number {
  const value = Math.sin((index + 7) * 19.913 + salt * 73.117) * 31_337.219;
  return value - Math.floor(value);
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
  const wheelGreen = modelMaterial(0x64755a, {
    metalness: 0.3,
    roughness: 0.64,
  });
  addEdges(
    vehicle,
    addBox(
      vehicle,
      `${name} lower sloped hull`,
      [2.76, 0.64, 4.9],
      [0, 0.88 + lift, 0.04],
      armor,
    ),
  );
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
  const trackShoeTransforms: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 12; index += 1) {
      const zPosition = -2.55 + index * (5.1 / 11);
      trackShoeTransforms.push(
        {
          position: [side * 1.83, 0.29 + lift, zPosition],
          rotation: [0, 0, Math.PI / 2],
        },
        {
          position: [side * 1.83, 1.03 + lift, zPosition],
          rotation: [0, 0, Math.PI / 2],
        },
      );
    }
  }
  addInstances(
    vehicle,
    `${name} forty-eight individual track shoes`,
    new BoxGeometry(0.28, 0.13, 0.42),
    dark,
    trackShoeTransforms,
  );
  addInstances(
    vehicle,
    `${name} track fenders`,
    new BoxGeometry(0.26, 0.12, 5.64),
    armor,
    [-1, 1].map((side) => ({
      position: [side * 1.61, 1.54 + lift, 0],
    })),
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
  addInstances(
    vehicle,
    `${name} ten green road-wheel hubs`,
    new CylinderGeometry(0.29, 0.29, 0.27, 12),
    wheelGreen,
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
  const turretRing = addMesh(
    vehicle,
    `${name} turret race ring`,
    new TorusGeometry(1.22, 0.08, 6, 20),
    dark,
    [0, 1.94 + lift, -0.18],
  );
  turretRing.rotation.x = Math.PI / 2;
  addMesh(
    vehicle,
    `${name} loader hatch`,
    new CylinderGeometry(0.31, 0.34, 0.12, 12),
    armor,
    [-0.46, 2.83 + lift, -0.1],
  );
  addBox(
    vehicle,
    `${name} rear engine grille`,
    [1.7, 0.05, 0.86],
    [0, 2.08 + lift, 2.18],
    dark,
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
  const turretNumber = name.endsWith("west") ? "300" : "200";
  for (const side of [-1, 1]) {
    addMemorialLettering(
      vehicle,
      `${name} turret number ${turretNumber} ${side < 0 ? "left" : "right"}`,
      turretNumber,
      [1.18, 0.48],
      [side * 1.18, 2.45 + lift, -0.18],
      0.34,
      "#718264",
      "#f3f0df",
      [0, side * (Math.PI / 2), 0],
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

/** Kerbel's eight-metre bronze soldier on the central granite pylon. */
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
  const cloak = addMesh(
    group,
    "Soviet memorial soldier broad greatcoat cloak",
    new ConeGeometry(1.82, 4.9, 12),
    bronze,
    [0, base + 4.25, z - 0.48],
  );
  cloak.scale.z = 0.72;
  addEdges(group, cloak);
  const coat = addMesh(
    group,
    "Soviet memorial eight metre soldier body",
    new CylinderGeometry(1.06, 1.55, 4.05, 12),
    bronze,
    [0, base + 4.05, z + 0.18],
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
  addSegment(
    group,
    "Soviet memorial soldier left bent arm",
    new Vector3(-1.15, base + 6.18, z + 0.08),
    new Vector3(-0.72, base + 4.75, z + 0.72),
    0.34,
    bronze,
  );
  addSegment(
    group,
    "Soviet memorial soldier right lowered arm",
    new Vector3(1.16, base + 6.17, z),
    new Vector3(1.34, base + 3.62, z + 0.22),
    0.34,
    bronze,
  );
  for (const [side, y, zOffset] of [
    [-1, base + 4.68, 0.78],
    [1, base + 3.45, 0.28],
  ] as const) {
    addMesh(
      group,
      `Soviet memorial soldier ${side < 0 ? "left" : "right"} hand`,
      new SphereGeometry(0.35, 10, 7),
      bronze,
      [side * (side < 0 ? 0.69 : 1.35), y, z + zOffset],
    );
  }
  addBox(
    group,
    "Soviet memorial soldier greatcoat belt",
    [2.45, 0.24, 1.38],
    [0, base + 4.68, z + 0.23],
    bronze,
  );
  addBox(
    group,
    "Soviet memorial soldier belt buckle",
    [0.42, 0.36, 0.12],
    [0, base + 4.65, z + 0.97],
    bronze,
  );
  for (const side of [-1, 1]) {
    const lapel = addBox(
      group,
      `Soviet memorial soldier ${side < 0 ? "left" : "right"} coat lapel`,
      [0.28, 1.6, 0.12],
      [side * 0.39, base + 5.6, z + 0.85],
      bronze,
    );
    lapel.rotation.z = side * 0.3;
  }
  const head = addMesh(
    group,
    "Soviet memorial soldier head",
    new SphereGeometry(0.62, 16, 12),
    bronze,
    [0, base + 6.94, z + 0.08],
  );
  head.scale.set(0.82, 1.05, 0.78);
  addMesh(
    group,
    "Soviet memorial soldier face and nose",
    new SphereGeometry(0.16, 9, 7),
    bronze,
    [0, base + 6.96, z + 0.57],
  );
  const helmet = addMesh(
    group,
    "Soviet memorial soldier steel helmet",
    new SphereGeometry(0.76, 16, 10),
    bronze,
    [0, base + 7.45, z + 0.02],
  );
  helmet.scale.set(1, 0.52, 1.08);
  addEdges(group, helmet);
  const helmetRim = addMesh(
    group,
    "Soviet memorial soldier helmet rim",
    new CylinderGeometry(0.82, 0.82, 0.11, 16),
    bronze,
    [0, base + 7.26, z + 0.02],
  );
  addEdges(group, helmetRim);
  // Rifle slung muzzle-up across the right shoulder.
  addSegment(
    group,
    "Soviet memorial soldier rifle",
    new Vector3(1.5, base + 7.86, z - 0.66),
    new Vector3(0.78, base + 2.4, z - 0.42),
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
    "Official street-facing composition, T-34/76 tank type and 8 m soldier height; colonnade, inscription, forecourt and garden proportions are owner-reference-bounded approximations over official terrain";
  group.userData.profile = SOVIET_WAR_MEMORIAL_PROFILE;
  group.userData.sourceUrl =
    "https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/";
  group.userData.referenceUrls = [
    group.userData.sourceUrl,
    "https://commons.wikimedia.org/wiki/File:Sowjetisches_Ehrenmal_(Berlin-Tiergarten)_Totale.jpg",
  ];
  const stone = modelMaterial(0xd2d0c6, { roughness: 0.8 });
  // The old 0x777a73 pylon read near-black under the day rig; the real
  // memorial is warm light granite throughout.
  const stoneDark = modelMaterial(0x999a93, { roughness: 0.86 });
  const stoneJoint = modelMaterial(0x777a75, { roughness: 0.9 });
  const blackGranite = modelMaterial(0x383c39, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const bronze = modelMaterial(0x4f6657, { metalness: 0.38, roughness: 0.55 });
  const gold = modelMaterial(0xc9a227, { metalness: 0.45, roughness: 0.4 });
  const soil = modelMaterial(0x4b3e31, { roughness: 0.98 });
  const hedge = modelMaterial(0x4c6a3c, { roughness: 0.96 });
  const paving = addBox(
    group,
    "Soviet memorial broad granite forecourt",
    [SOVIET_WAR_MEMORIAL_PROFILE.forecourtWidthM, 0.14, 29],
    [0, 0.07, 10],
    modelMaterial(0xbebdb4, { roughness: 0.92 }),
  );
  paving.castShadow = false;
  const pavingJoints: InstanceTransform[] = [];
  for (let x = -36; x <= 36; x += 6) {
    pavingJoints.push({ position: [x, 0.15, 10] });
  }
  addInstances(
    group,
    "Soviet memorial forecourt longitudinal granite joints",
    new BoxGeometry(0.025, 0.018, 28.5),
    stoneJoint,
    pavingJoints,
  );
  addInstances(
    group,
    "Soviet memorial forecourt transverse granite joints",
    new BoxGeometry(77.5, 0.018, 0.025),
    stoneJoint,
    Array.from({ length: 9 }, (_, index) => ({
      position: [0, 0.15, -2 + index * 3],
    })),
  );

  // Four shallow risers reproduce the broad street-facing stair rather than
  // the former pair of slab-like platforms.
  for (const [index, width, depth, z] of [
    [0, 64, 15.5, 2.1],
    [1, 61.5, 12.8, 0.8],
    [2, 59, 10.2, -0.45],
    [3, 56.5, 7.6, -1.65],
  ] as const) {
    addEdges(
      group,
      addBox(
        group,
        index === 0 ? "Soviet memorial lower stair" : `Soviet memorial stair tread ${index + 1}`,
        [width, 0.24, depth],
        [0, 0.24 + index * 0.24, z],
        stone,
      ),
      0.64,
    );
  }
  addBox(
    group,
    "Soviet memorial upper stair",
    [57, 0.28, 5.4],
    [0, 1.08, -2.45],
    stone,
  );

  // The two named officers' sarcophagi sit halfway up the broad stair, not
  // behind the colonnade. Their low ridged lids keep the street elevation
  // readable without turning them into full-height wall blocks.
  for (const side of [-1, 1]) {
    const x = side * 12.8;
    addEdges(
      group,
      addBox(
        group,
        `Soviet memorial ${side < 0 ? "west" : "east"} officers sarcophagus`,
        [5.6, 1.04, 2.2],
        [x, 1.4, 0.1],
        blackGranite,
      ),
      0.7,
    );
    const lid = addBox(
      group,
      "Soviet memorial two officers sarcophagus ridged lids",
      [5.85, 0.34, 2.42],
      [x, 2.09, 0.1],
      stoneDark,
    );
    lid.rotation.x = side * 0.025;
    addEdges(group, lid, 0.68);
    addInstances(
      group,
      "Soviet memorial officers sarcophagus engraved name rows",
      new BoxGeometry(3.8, 0.035, 0.025),
      gold,
      Array.from({ length: 3 }, (_, row) => ({
        position: [x, 1.65 - row * 0.23, 1.22],
        scale: [1 - row * 0.09, 1, 1],
      })),
    );
  }

  addEdges(
    group,
    addBox(
      group,
      "Soviet memorial central pylon lower black granite course",
      [7.2, 1.12, 4.8],
      [0, 1.68, -3],
      blackGranite,
    ),
  );
  const centralPylon = addBox(
    group,
    "Soviet memorial central pylon",
    [5.8, 10.75, 3.8],
    [0, 7.7, -3],
    stoneDark,
  );
  addEdges(group, centralPylon);
  for (const side of [-1, 1]) {
    addEdges(
      group,
      addBox(
        group,
        `Soviet memorial central pylon ${side < 0 ? "west" : "east"} stepped shoulder`,
        [0.82, 6.3, 4.18],
        [side * 3.25, 5.35, -3],
        stoneDark,
      ),
      0.72,
    );
  }
  addEdges(
    group,
    addBox(
      group,
      "Soviet memorial central pylon crown course",
      [6.55, 0.62, 4.24],
      [0, 12.92, -3],
      stoneDark,
    ),
  );
  const centralFrontZ = -1.08;
  addInstances(
    group,
    "Soviet memorial central pylon horizontal granite joints",
    new BoxGeometry(5.58, 0.035, 0.028),
    stoneJoint,
    Array.from({ length: 6 }, (_, index) => ({
      position: [0, 3.15 + index * 1.54, centralFrontZ],
    })),
  );
  addInstances(
    group,
    "Soviet memorial central pylon vertical granite joints",
    new BoxGeometry(0.035, 10.1, 0.028),
    stoneJoint,
    [-1.88, 0, 1.88].map((x) => ({ position: [x, 7.72, centralFrontZ] })),
  );

  const emblemDisk = addMesh(
    group,
    "Soviet memorial gilded USSR emblem disc",
    new CylinderGeometry(0.86, 0.86, 0.11, 24),
    gold,
    [0, 10.78, centralFrontZ + 0.03],
  );
  emblemDisk.rotation.x = Math.PI / 2;
  const emblemWreath = addMesh(
    group,
    "Soviet memorial gilded USSR emblem wreath",
    new TorusGeometry(0.75, 0.1, 7, 28),
    gold,
    [0, 10.78, centralFrontZ + 0.1],
  );
  emblemWreath.scale.y = 1.08;
  const emblemLeaves: InstanceTransform[] = [];
  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2;
    emblemLeaves.push({
      position: [
        Math.cos(angle) * 0.76,
        10.78 + Math.sin(angle) * 0.82,
        centralFrontZ + 0.17,
      ],
      rotation: [0, 0, angle],
      scale: [0.52, 1.2, 0.46],
    });
  }
  addInstances(
    group,
    "Soviet memorial gilded USSR wreath leaves",
    new SphereGeometry(0.13, 7, 5),
    gold,
    emblemLeaves,
  );
  addSegment(
    group,
    "Soviet memorial gilded hammer shaft",
    new Vector3(-0.22, 10.48, centralFrontZ + 0.2),
    new Vector3(0.22, 11.04, centralFrontZ + 0.2),
    0.055,
    gold,
  );
  addSegment(
    group,
    "Soviet memorial gilded hammer head",
    new Vector3(0.08, 11.1, centralFrontZ + 0.2),
    new Vector3(0.38, 10.88, centralFrontZ + 0.2),
    0.065,
    gold,
  );
  const sickle = addMesh(
    group,
    "Soviet memorial gilded sickle",
    new TorusGeometry(0.32, 0.055, 6, 18, Math.PI * 1.35),
    gold,
    [-0.02, 10.74, centralFrontZ + 0.2],
  );
  sickle.rotation.z = -0.58;

  SOVIET_WAR_MEMORIAL_PROFILE.dedicationLines.forEach((line, index) => {
    addMemorialLettering(
      group,
      `Soviet memorial gilded dedication line ${index + 1}`,
      line,
      [5.18, 0.4],
      [0, 9.75 - index * 0.49, centralFrontZ + 0.12],
      0.21,
    );
  });
  SOVIET_WAR_MEMORIAL_PROFILE.years.forEach((year, index) => {
    addMemorialLettering(
      group,
      `Soviet memorial gilded year ${year}`,
      year,
      [2.25, 0.62],
      [0, 4.88 - index * 0.72, centralFrontZ + 0.12],
      0.43,
    );
  });

  const piers = SOVIET_WAR_MEMORIAL_PROFILE.colonnadePiers;
  for (const [index, [x, z]] of piers.entries()) {
    const width = Math.abs(x) > 24 ? 3.75 : 3.15;
    const pylon = addBox(
      group,
      "Soviet memorial six side pylons",
      [width, 9.35, 2.82],
      [x, 6.25, z],
      stone,
    );
    addEdges(group, pylon);
    addBox(
      group,
      "Soviet memorial side-pylon black granite foot",
      [width + 0.22, 0.72, 3.04],
      [x, 1.43, z],
      blackGranite,
    );
    addBox(
      group,
      "Soviet memorial side-pylon capital course",
      [width + 0.32, 0.46, 3.12],
      [x, 10.98, z],
      stoneDark,
    );
    const pylonFront = z + 1.43;
    addBox(
      group,
      "Soviet memorial recessed side-pylon inscription field",
      [width - 0.72, 4.35, 0.08],
      [x, 6.15, pylonFront],
      stoneDark,
    );
    const sideWreath = addMesh(
      group,
      "Soviet memorial side-pylon gilded wreath",
      new TorusGeometry(0.48, 0.065, 6, 20),
      gold,
      [x, 8.83, pylonFront + 0.07],
    );
    sideWreath.scale.y = 1.08;
    addInstances(
      group,
      "Soviet memorial side-pylon fine inscription rows",
      new BoxGeometry(width - 1.08, 0.035, 0.025),
      gold,
      Array.from({ length: 8 }, (_, row) => ({
        position: [x, 7.85 - row * 0.42, pylonFront + 0.07],
        scale: [1 - ((index + row) % 3) * 0.08, 1, 1],
      })),
    );
  }

  // Three open bays per side follow a shallow forward bow visible in the
  // frontal and aerial references. Separate spans preserve that curvature.
  for (const side of [-1, 1]) {
    const sidePiers = piers
      .filter(([x]) => Math.sign(x) === side)
      .sort(([a], [b]) => Math.abs(a) - Math.abs(b));
    const nodes: [number, number][] = [
      [side * 3.25, -2.9],
      ...sidePiers.map(([x, z]) => [x, z] as [number, number]),
    ];
    for (let index = 0; index < nodes.length - 1; index += 1) {
      addRectangularSpan(
        group,
        side < 0 ? "Soviet memorial left colonnade beam" : "Soviet memorial right colonnade beam",
        nodes[index],
        nodes[index + 1],
        11.25,
        1.35,
        2.9,
        stone,
      );
      addRectangularSpan(
        group,
        "Soviet memorial colonnade cornice",
        nodes[index],
        nodes[index + 1],
        12.05,
        0.48,
        3.7,
        stoneDark,
      );
      addRectangularSpan(
        group,
        "Soviet memorial colonnade stylobate",
        nodes[index],
        nodes[index + 1],
        1.42,
        0.92,
        3.62,
        stone,
      );
    }
  }

  // Formal side beds and circular basins visible in the aerial reference.
  const flowerTransforms: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    addEdges(
      group,
      addBox(
        group,
        side < 0 ? "Soviet memorial west flower bed" : "Soviet memorial east flower bed",
        [12.5, 0.34, 4.4],
        [side * 18.2, 0.34, 10.1],
        soil,
      ),
      0.56,
    );
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 12; column += 1) {
        flowerTransforms.push({
          position: [
            side * 18.2 - 5.45 + column * 0.99,
            0.72,
            8.8 + row * 1.22,
          ],
          scale: [1, 0.72, 1],
        });
      }
    }
    const basin = addMesh(
      group,
      `Soviet memorial ${side < 0 ? "west" : "east"} circular garden basin`,
      new CylinderGeometry(2.05, 2.22, 0.32, 28),
      stoneDark,
      [side * 35, 0.25, -7.8],
    );
    addEdges(group, basin, 0.68);
    const basinWater = addMesh(
      group,
      `Soviet memorial ${side < 0 ? "west" : "east"} circular basin water`,
      new CylinderGeometry(1.64, 1.64, 0.08, 28),
      modelMaterial(0x6f9491, { metalness: 0.08, roughness: 0.3 }),
      [side * 35, 0.45, -7.8],
    );
    basinWater.castShadow = false;
    const fountainWater = modelMaterial(0x9fc9c8, {
      metalness: 0.04,
      roughness: 0.18,
    });
    addInstances(
      group,
      `Soviet memorial ${side < 0 ? "west" : "east"} fountain jets`,
      new CylinderGeometry(0.045, 0.08, 1.62, 7),
      fountainWater,
      [
        { position: [side * 35, 1.28, -7.8] },
        { position: [side * 35 - 0.72, 0.96, -7.8], scale: [1, 0.62, 1] },
        { position: [side * 35 + 0.72, 0.96, -7.8], scale: [1, 0.62, 1] },
        { position: [side * 35, 0.96, -8.52], scale: [1, 0.62, 1] },
        { position: [side * 35, 0.96, -7.08], scale: [1, 0.62, 1] },
      ],
    );
    addMesh(
      group,
      `Soviet memorial ${side < 0 ? "west" : "east"} fountain crown spray`,
      new SphereGeometry(0.28, 8, 6),
      fountainWater,
      [side * 35, 2.12, -7.8],
    ).scale.set(1.35, 0.72, 1.35);
    addBox(
      group,
      `Soviet memorial ${side < 0 ? "west" : "east"} clipped hedge wall`,
      [14.5, 1.15, 1.5],
      [side * 34, 0.75, -13],
      hedge,
    );
  }
  addInstances(
    group,
    "Soviet memorial red and white formal flower rows",
    new SphereGeometry(0.15, 7, 5),
    modelMaterial(0xb64136, { roughness: 0.82 }),
    flowerTransforms,
  );
  addInstances(
    group,
    "Soviet memorial street-front bollards",
    new CylinderGeometry(0.16, 0.2, 0.92, 10),
    blackGranite,
    Array.from({ length: 11 }, (_, index) => ({
      position: [-35 + index * 7, 0.54, 23.6],
    })),
  );
  for (let index = 0; index < 10; index += 1) {
    addSegment(
      group,
      `Soviet memorial street chain span ${index + 1}`,
      new Vector3(-35 + index * 7, 0.62, 23.6),
      new Vector3(-28 + index * 7, 0.62, 23.6),
      0.035,
      blackGranite,
    );
  }
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

function createComposerMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  placeOnOfficialMesh(group, anchor);
  group.userData.geometryStatus =
    "Landesdenkmalamt/Bildhauerei-in-Berlin: 10 m monument with rounded granite understructure, chamfered three-sided Pentelic-marble pavilion, three 1.56-1.70 m Laas-marble half figures in shallow round-arched niches, pilasters, restored gilded masks/instruments, lyre-bearing swans, scaled gilded cupola, pinecones and three putti carrying a laurel wreath. Unpublished local subdivisions and bearings are procedural recognition geometry.";
  group.userData.evidence = BEETHOVEN_HAYDN_MOZART_PROFILE;
  const granite = modelMaterial(0x85827c, { roughness: 0.82 });
  const pentelicMarble = modelMaterial(0xd8c99f, { roughness: 0.68 });
  const laasMarble = modelMaterial(0xf1efe8, { roughness: 0.62 });
  const marbleShadow = modelMaterial(0xb7aa88, { roughness: 0.75 });
  const nicheShadow = modelMaterial(0x78705e, { roughness: 0.84 });
  const gold = nightEmitter(
    modelMaterial(GOLD, { metalness: 0.66, roughness: 0.35 }),
    0xffc45f,
    0.38,
  );

  // The source calls this a rounded granite understructure. Its unpublished
  // radii are display estimates; two low courses prevent the old oversized
  // single disc from reading as a circular fountain basin.
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial step ring",
      new CylinderGeometry(4.55, 4.85, 0.28, 30),
      granite,
      [0, 0.14, 0],
    ),
  );
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial three-sided marble base",
      new CylinderGeometry(3.9, 4.35, 0.48, 30),
      granite,
      [0, 0.52, 0],
    ),
  );

  // A purpose-built six-face outline alternates three long elevations with
  // three short cut corners; a regular triangular or hexagonal cylinder does
  // not reproduce the documented "an den Ecken abgestumpft" pavilion.
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial three-sided coloured stele",
      chamferedTrianglePrismGeometry(3.6, 3.18, 5.38),
      pentelicMarble,
      [0, 0.76, 0],
    ),
  );
  const faceAngles = [0, 1, 2].map(
    (index) => (index / 3) * Math.PI * 2 + Math.PI / 6,
  );
  const faceRotation = (angle: number): [number, number, number] => [
    0,
    Math.PI / 2 - angle,
    0,
  ];
  const radial = (
    angle: number,
    radius: number,
    y: number,
  ): [number, number, number] => [
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  ];

  // Shallow rectangular recesses plus true upper arch caps and projecting
  // torus frames read as the three documented round-arched niches.
  addInstances(
    group,
    "Composer memorial three bust niches",
    new BoxGeometry(1.82, 2.18, 0.16),
    nicheShadow,
    faceAngles.map((angle) => ({
      position: radial(angle, 1.78, 3.48),
      rotation: faceRotation(angle),
    })),
  );
  addInstances(
    group,
    "Composer memorial three round-arch niche caps",
    new SphereGeometry(0.91, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2),
    nicheShadow,
    faceAngles.map((angle) => ({
      position: radial(angle, 1.8, 4.56),
      rotation: faceRotation(angle),
      scale: [1, 1, 0.12],
    })),
  );
  addInstances(
    group,
    "Composer memorial three projecting round-arch frames",
    new TorusGeometry(0.91, 0.1, 6, 18, Math.PI),
    laasMarble,
    faceAngles.map((angle) => ({
      position: radial(angle, 1.92, 4.52),
      rotation: faceRotation(angle),
    })),
  );

  // Pilasters emphasise the three blunt corners rather than sitting at the
  // centre of the principal elevations.
  addInstances(
    group,
    "Composer memorial corner piers",
    new BoxGeometry(0.66, 5.08, 0.58),
    pentelicMarble,
    [0, 1, 2].map((index) => {
      const angle = (index / 3) * Math.PI * 2 + Math.PI / 2;
      return {
        position: radial(angle, 3.03, 3.34),
        rotation: [0, -angle, 0],
      };
    }),
  );

  const torsos = addInstances(
    group,
    "Composer memorial Haydn Beethoven Mozart busts",
    new SphereGeometry(0.54, 14, 10),
    laasMarble,
    faceAngles.map((angle) => ({
      position: radial(angle, 2.01, 3.22),
      rotation: faceRotation(angle),
      scale: [1.18, 0.72, 0.58],
    })),
  );
  torsos.userData.subjects = BEETHOVEN_HAYDN_MOZART_PROFILE.subjects;
  torsos.userData.documentedHeightRangeM =
    BEETHOVEN_HAYDN_MOZART_PROFILE.documentedHalfFigureHeightRangeM;
  addInstances(
    group,
    "Composer memorial three white-marble portrait heads",
    new SphereGeometry(0.43, 14, 10),
    laasMarble,
    faceAngles.map((angle, index) => ({
      position: radial(angle, 2.1, 4.0 + (index === 2 ? 0.03 : 0)),
      scale: [0.9, index === 2 ? 1.12 : 1.04, 0.82],
    })),
  );
  addInstances(
    group,
    "Composer memorial differentiated portrait hair",
    new SphereGeometry(0.2, 9, 7),
    marbleShadow,
    faceAngles.flatMap((angle, faceIndex) =>
      [-0.28, 0, 0.28].map((tangentOffset) => ({
        position: [
          Math.cos(angle) * 2.12 - Math.sin(angle) * tangentOffset,
          4.32,
          Math.sin(angle) * 2.12 + Math.cos(angle) * tangentOffset,
        ] as [number, number, number],
        scale: [faceIndex === 2 ? 1.25 : 0.95, 1.05, 0.72] as [
          number,
          number,
          number,
        ],
      })),
    ),
  );

  // Restored gilded appliques: paired theatre masks and abstracted wind/string
  // instruments occupy the pilaster faces. Their exact local spacing is not
  // published and therefore remains deterministic display geometry.
  const cornerAngles = [0, 1, 2].map(
    (index) => (index / 3) * Math.PI * 2 + Math.PI / 2,
  );
  addInstances(
    group,
    "Composer memorial six paired gilded theatre masks",
    new SphereGeometry(0.22, 9, 7),
    gold,
    cornerAngles.flatMap((angle) =>
      [-0.24, 0.24].map((offset) => ({
        position: [
          Math.cos(angle) * 3.37 - Math.sin(angle) * offset,
          3.52,
          Math.sin(angle) * 3.37 + Math.cos(angle) * offset,
        ] as [number, number, number],
        scale: [0.78, 1.1, 0.45] as [number, number, number],
      })),
    ),
  );
  addInstances(
    group,
    "Composer memorial six gilded instrument appliques",
    new CapsuleGeometry(0.075, 0.72, 3, 6),
    gold,
    cornerAngles.flatMap((angle) =>
      [-0.22, 0.22].map((offset, index) => ({
        position: [
          Math.cos(angle) * 3.38 - Math.sin(angle) * offset,
          index === 0 ? 2.55 : 4.42,
          Math.sin(angle) * 3.38 + Math.cos(angle) * offset,
        ] as [number, number, number],
        rotation: [0, -angle, index === 0 ? -0.35 : 0.35] as [
          number,
          number,
          number,
        ],
      })),
    ),
  );

  // A swan spreading two wings over each niche and a small lyre at its chest.
  addInstances(
    group,
    "Composer memorial three lyre-bearing swans",
    new CapsuleGeometry(0.18, 0.5, 4, 7),
    laasMarble,
    faceAngles.map((angle) => ({
      position: radial(angle, 2.08, 5.25),
      rotation: [0, Math.PI / 2 - angle, Math.PI / 2],
    })),
  );
  addInstances(
    group,
    "Composer memorial six spread swan wings",
    new SphereGeometry(0.42, 10, 7),
    laasMarble,
    faceAngles.flatMap((angle) =>
      [-0.42, 0.42].map((offset) => ({
        position: [
          Math.cos(angle) * 2.06 - Math.sin(angle) * offset,
          5.3,
          Math.sin(angle) * 2.06 + Math.cos(angle) * offset,
        ] as [number, number, number],
        rotation: faceRotation(angle),
        scale: [1.1, 0.34, 0.3] as [number, number, number],
      })),
    ),
  );
  addInstances(
    group,
    "Composer memorial three swan lyres",
    new TorusGeometry(0.2, 0.045, 5, 10, Math.PI * 1.45),
    gold,
    faceAngles.map((angle) => ({
      position: radial(angle, 2.5, 5.25),
      rotation: faceRotation(angle),
    })),
  );

  // The multiply profiled cornice carries the scaled gilded cupola.
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial lower profiled cornice",
      chamferedTrianglePrismGeometry(3.45, 3.31, 0.25),
      pentelicMarble,
      [0, 6.02, 0],
    ),
  );
  addEdges(
    group,
    addMesh(
      group,
      "Composer memorial upper profiled cornice",
      chamferedTrianglePrismGeometry(3.64, 3.46, 0.24),
      pentelicMarble,
      [0, 6.27, 0],
    ),
  );
  const dome = addMesh(
    group,
    "Composer memorial gilded cupola",
    new SphereGeometry(3.18, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    gold,
    [0, 6.5, 0],
  );
  dome.scale.y = 0.5;
  addEdges(group, dome);
  addInstances(
    group,
    "Composer memorial gilded scale-roof shingles",
    new BoxGeometry(0.58, 0.09, 0.34),
    gold,
    [0, 1, 2].flatMap((ring) =>
      [0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2 + (ring % 2) * 0.18;
        const radius = 2.55 - ring * 0.56;
        return {
          position: radial(angle, radius, 6.88 + ring * 0.43),
          rotation: [0, -angle, -0.12 - ring * 0.04] as [
            number,
            number,
            number,
          ],
        };
      }),
    ),
  );
  addInstances(
    group,
    "Composer memorial three leaf volutes and pinecones",
    new ConeGeometry(0.25, 0.72, 8),
    gold,
    cornerAngles.map((angle) => ({
      position: radial(angle, 2.75, 7.05),
      rotation: [0, 0, Math.PI],
    })),
  );

  const putti = addInstances(
    group,
    "Composer memorial three gilded putti",
    new CapsuleGeometry(0.26, 0.68, 4, 8),
    gold,
    [0, 1, 2].map((index) => {
      const angle = (index / 3) * Math.PI * 2;
      return {
        position: radial(angle, 0.78, 8.53),
        rotation: [0, -angle, 0],
      };
    }),
  );
  putti.userData.materialEvidence = "gilded galvanoplastic WMF figures";
  addInstances(
    group,
    "Composer memorial three putti heads",
    new SphereGeometry(0.23, 10, 8),
    gold,
    [0, 1, 2].map((index) => {
      const angle = (index / 3) * Math.PI * 2;
      return { position: radial(angle, 0.78, 9.12) };
    }),
  );
  addInstances(
    group,
    "Composer memorial six raised putti arms",
    new BoxGeometry(0.14, 0.72, 0.14),
    gold,
    [0, 1, 2].flatMap((index) => {
      const angle = (index / 3) * Math.PI * 2;
      return [-1, 1].map((side) => ({
        position: [
          Math.cos(angle) * 0.7 - Math.sin(angle) * side * 0.24,
          9.28,
          Math.sin(angle) * 0.7 + Math.cos(angle) * side * 0.24,
        ] as [number, number, number],
        rotation: [0, -angle, side * 0.48] as [number, number, number],
      }));
    }),
  );
  addMesh(
    group,
    "Composer memorial laurel crown",
    new TorusGeometry(1.2, 0.16, 8, 24),
    gold,
    [0, 9.84, 0],
  ).rotation.x = Math.PI / 2;
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
  "Mahnmal für verfolgte Zeugen Jehovas": createJehovahsWitnessesMemorial,
  "Sowjetisches Ehrenmal Tiergarten": createSovietMemorial,
};

export function createMemorialLandmarks(landmarks: MemorialLandmark[]): Group {
  const root = new Group();
  root.name = "Verified memorial detail models";
  const requestedNames = new Set(landmarks.map(({ name }) => name));
  for (const landmark of landmarks) {
    const builder = BUILDERS[landmark.name];
    if (builder) {
      root.add(builder(landmark));
    }
  }
  if (
    requestedNames.has(TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.name) ||
    requestedNames.has(TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.name)
  ) {
    const literaryMemorials = createTiergartenLiteraryMemorials();
    for (const memorial of [...literaryMemorials.children]) {
      const profile =
        memorial.userData.exactOwnOsmKey ===
        TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.osmKey
          ? TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe
          : memorial.userData.exactOwnOsmKey ===
              TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing.osmKey
            ? TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing
            : null;
      if (!profile || !requestedNames.has(profile.name)) continue;
      memorial.removeFromParent();
      memorial.name = profile.name;
      memorial.userData.tiergartenLiteraryMemorialSmooth = true;
      root.add(memorial);
    }
  }
  if (requestedNames.has(WAGNER_MEMORIAL_PROFILE.name)) {
    root.add(createWagnerMemorial());
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
    return 42;
  }
  if (name === "Goethe-Denkmal") {
    return 38;
  }
  if (name === "Lessing-Denkmal") {
    return 36;
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

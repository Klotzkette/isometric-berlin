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
  Path,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalAccentInk,
  markArchitecturalInk,
} from "./architecturalInk";
import {
  type ArchitecturalSignature as ReichstagDomeSignature,
  createOfficialReichstagDome,
} from "./ReichstagDome";
import { QUADRIGA_DIMENSIONS, createQuadriga } from "./Quadriga";
import { createDedicationTexture } from "./reichstagInscription";
import { markWindFlag, markWindFlagInstances } from "./WindFlags";

export type FocusCamera = {
  azimuth_degrees: number;
  distance_m: number;
  /** Keep a close presentation view photographic rather than axonometric. */
  fov_degrees?: number;
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

// Hero-model ink follows the drawn city's fine grey pencil register
// (was a dark blue-teal that clashed by day and vanished at night).
const EDGE_COLOR = 0x716c62;

// Corner-tower footprint read off the LoD2 prism K0002MCN (the Reichstag's own
// footprint in the shipped lod2-prisms.json): the towers occupy a ~16 m band in
// depth and reach the building's full width, so they sit almost flush with the
// corner rather than inset by 2 m as they were modelled before.
export const REICHSTAG_TOWER_SIZE_M = 16.5;
export const REICHSTAG_TOWER_INSET_M = 0.9;
/** Official Bundestag tower-flag dimensions: 5 m high by 7 m long. */
export const REICHSTAG_FLAG_HEIGHT_M = 5;
export const REICHSTAG_FLAG_WIDTH_M = 7;
export const REICHSTAG_FLAGPOLE_HEIGHT_M = 12;
/** Published overall length of the west-portal dedication. */
export const REICHSTAG_INSCRIPTION_FIELD_WIDTH_M = 16;

/** Centre of a corner tower along one axis, given that axis' full extent. */
function reichstagTowerCentre(side: number, extentM: number): number {
  return (
    side * (extentM / 2 - REICHSTAG_TOWER_SIZE_M / 2 - REICHSTAG_TOWER_INSET_M)
  );
}

/**
 * The six inner courtyards, measured off the same LoD2 prism: its ring carries
 * six holes, and these are their centres and sizes in the model's local frame
 * (metres, +x east, +z south). Two large pairs flank the north and south wings
 * and a narrower light well sits at each eastern end. The model used to render
 * the Reichstag as one solid block, which reads wrong from above — under an
 * isometric camera the courtyards are the building's most legible plan feature.
 */
export const REICHSTAG_COURTYARDS: Array<{
  depth_m: number;
  width_m: number;
  x_m: number;
  z_m: number;
}> = [
  { depth_m: 15.5, width_m: 11.3, x_m: 6.0, z_m: -33.5 },
  { depth_m: 15.6, width_m: 11.3, x_m: -11.1, z_m: -33.5 },
  { depth_m: 17.0, width_m: 6.1, x_m: 26.0, z_m: -30.9 },
  { depth_m: 15.5, width_m: 11.3, x_m: -11.1, z_m: 33.7 },
  { depth_m: 15.6, width_m: 11.3, x_m: 6.0, z_m: 33.7 },
  { depth_m: 16.9, width_m: 6.0, x_m: 25.9, z_m: 31.1 },
];
/** How far the courtyard floors sit below the main cornice. */
export const REICHSTAG_COURTYARD_DEPTH_M = 9.5;

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

type VectorSegment = [[number, number, number], [number, number, number]];

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

function addBoxOutline(
  group: Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  opacity = 0.7,
  color = EDGE_COLOR,
): LineSegments {
  const source = new BoxGeometry(...size);
  const outlineMaterial = new LineBasicMaterial({
    color,
    depthWrite: opacity >= 0.75,
    opacity,
    transparent: opacity < 1,
  });
  if (color === EDGE_COLOR) {
    markArchitecturalInk(
      outlineMaterial,
      opacity >= 0.76 ? "silhouette" : "detail",
    );
  } else {
    markArchitecturalAccentInk(
      outlineMaterial,
      color,
      opacity >= 0.76 ? "silhouette" : "detail",
    );
  }
  const edges = new LineSegments(
    new EdgesGeometry(source, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    outlineMaterial,
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

function addInstancedGeometry(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  transforms: InstanceTransform[],
): InstancedMesh {
  const instances = new InstancedMesh(geometry, material, transforms.length);
  instances.name = name;
  instances.castShadow = material.opacity >= 0.5;
  instances.receiveShadow = true;
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
  group.add(instances);
  return instances;
}

function addInstancedBoxes(
  group: Group,
  name: string,
  size: [number, number, number],
  material: MeshStandardMaterial | MeshPhysicalMaterial,
  transforms: InstanceTransform[],
): InstancedMesh {
  return addInstancedGeometry(
    group,
    name,
    new BoxGeometry(...size),
    material,
    transforms,
  );
}

function addVectorSegments(
  group: Group,
  name: string,
  segments: VectorSegment[],
  color: number,
  opacity = 0.72,
): LineSegments {
  const positions = segments.flatMap(([start, end]) => [...start, ...end]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const role = opacity >= 0.76 ? "detail" : "micro";
  const baseMaterial = new LineBasicMaterial({
    depthWrite: opacity >= 0.75,
    opacity,
    transparent: opacity < 1,
  });
  const material =
    color === EDGE_COLOR
      ? markArchitecturalInk(baseMaterial, role)
      : markArchitecturalAccentInk(baseMaterial, color, role);
  const lines = new LineSegments(geometry, material);
  lines.name = name;
  lines.renderOrder = 9;
  group.add(lines);
  return lines;
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
  const poleHeight = REICHSTAG_FLAGPOLE_HEIGHT_M;
  const poleMesh = new Mesh(
    new CylinderGeometry(0.12, 0.16, poleHeight, 10),
    pole,
  );
  poleMesh.name = `${name} flagpole`;
  poleMesh.position.set(position[0], position[1] + poleHeight / 2, position[2]);
  poleMesh.castShadow = true;
  group.add(poleMesh);

  const stripeColors = [0x151515, 0xc82f35, 0xe5b93f];
  const flagWidth = REICHSTAG_FLAG_WIDTH_M;
  const stripeHeight = REICHSTAG_FLAG_HEIGHT_M / 3;
  const flagTop = position[1] + poleHeight - 0.65;
  for (let index = 0; index < stripeColors.length; index += 1) {
    const geometry = new PlaneGeometry(flagWidth, stripeHeight, 18, 3);
    geometry.translate(flagWidth / 2, 0, 0);
    const stripe = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: stripeColors[index],
        side: DoubleSide,
      }),
    );
    stripe.name = `${name} German flag stripe ${index + 1}`;
    stripe.position.set(
      position[0],
      flagTop - stripeHeight / 2 - index * stripeHeight,
      position[2],
    );
    stripe.rotation.y = -0.06;
    stripe.rotation.z = 0.04 * (index - 1);
    markWindFlag(stripe, flagWidth, { phase: 0.42 });
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
  const poleHeight = REICHSTAG_FLAGPOLE_HEIGHT_M;
  const pole = new Mesh(
    new CylinderGeometry(0.12, 0.16, poleHeight, 10),
    poleMaterial,
  );
  pole.name = `${name} flagpole`;
  pole.position.set(position[0], position[1] + poleHeight / 2, position[2]);
  pole.castShadow = true;
  group.add(pole);

  const flagWidth = REICHSTAG_FLAG_WIDTH_M;
  const flagHeight = REICHSTAG_FLAG_HEIGHT_M;
  const flagCentreY = position[1] + poleHeight - 0.65 - flagHeight / 2;
  const flagGeometry = new PlaneGeometry(flagWidth, flagHeight, 18, 8);
  flagGeometry.translate(flagWidth / 2, 0, 0);
  const flag = new Mesh(
    flagGeometry,
    new MeshBasicMaterial({ color: 0x174c9c, side: DoubleSide }),
  );
  flag.name = `${name} European Union flag`;
  flag.position.set(position[0], flagCentreY, position[2]);
  flag.rotation.y = -0.06;
  markWindFlag(flag, flagWidth, { phase: 0.42 });
  group.add(flag);

  const stars = new InstancedMesh(
    new CircleGeometry(0.16, 5),
    new MeshBasicMaterial({ color: 0xffd447, side: DoubleSide }),
    12,
  );
  stars.name = `${name} European Union flag stars`;
  const dummy = new Object3D();
  const starTransforms: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    xFromPoleM: number;
  }> = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const starPosition: [number, number, number] = [
      position[0] + flagWidth / 2 + Math.cos(angle) * 1.05,
      flagCentreY + Math.sin(angle) * 1.05,
      position[2] - 0.015,
    ];
    dummy.position.set(...starPosition);
    dummy.rotation.y = -0.06;
    dummy.updateMatrix();
    stars.setMatrixAt(index, dummy.matrix);
    starTransforms.push({
      position: starPosition,
      rotation: [0, -0.06, 0],
      xFromPoleM: starPosition[0] - position[0],
    });
  }
  stars.instanceMatrix.needsUpdate = true;
  markWindFlagInstances(stars, starTransforms, flagWidth, { phase: 0.42 });
  group.add(stars);
}

function archedWindowGeometry(width: number, height: number): ShapeGeometry {
  const radius = width / 2;
  const bottom = -height / 2;
  const spring = height / 2 - radius;
  const shape = new Shape();
  shape.moveTo(-radius, bottom);
  shape.lineTo(radius, bottom);
  shape.lineTo(radius, spring);
  shape.absarc(0, spring, radius, 0, Math.PI, false);
  shape.lineTo(-radius, bottom);
  return new ShapeGeometry(shape, 24);
}

function rectangularWindowFrameGeometry(
  width = 1.25,
  height = 2.65,
  frameM = 0.1,
): ShapeGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const outer = new Shape();
  outer.moveTo(-halfWidth, -halfHeight);
  outer.lineTo(halfWidth, -halfHeight);
  outer.lineTo(halfWidth, halfHeight);
  outer.lineTo(-halfWidth, halfHeight);
  outer.closePath();
  const insetX = halfWidth - frameM;
  const insetY = halfHeight - frameM;
  const opening = new Path();
  opening.moveTo(-insetX, -insetY);
  opening.lineTo(-insetX, insetY);
  opening.lineTo(insetX, insetY);
  opening.lineTo(insetX, -insetY);
  opening.closePath();
  outer.holes.push(opening);
  return new ShapeGeometry(outer);
}

function addReichstagWindowSets(
  group: Group,
  signature: ReichstagModelSignature,
): void {
  const darkGlass = modelMaterial(0x7c9499, {
    metalness: 0.1,
    opacity: 0.62,
    roughness: 0.34,
  });
  const occupiedGlass = nightEmitter(
    modelMaterial(0x8d9893, {
      metalness: 0.08,
      opacity: 0.6,
      roughness: 0.34,
    }),
    0xffd28a,
    0.78,
  );
  const windowMetal = modelMaterial(0xc1b6a4, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const arched: InstanceTransform[] = [];
  const upper: InstanceTransform[] = [];
  const towerArches: InstanceTransform[] = [];
  const towerUpper: InstanceTransform[] = [];
  const longCount = 11;
  const longSpan = signature.width_m - 46;
  const shortCount = 15;
  const shortSpan = signature.depth_m - 48;

  for (const side of [-1, 1]) {
    for (let index = 0; index < longCount; index += 1) {
      const x = -longSpan / 2 + (index / (longCount - 1)) * longSpan;
      arched.push({
        position: [x, 9.1, side * (signature.depth_m / 2 + 0.12)],
      });
      for (const y of [16.2, 20.6]) {
        upper.push({
          position: [x, y, side * (signature.depth_m / 2 + 0.14)],
        });
      }
    }
    for (let index = 0; index < shortCount; index += 1) {
      const z = -shortSpan / 2 + (index / (shortCount - 1)) * shortSpan;
      if (side > 0 || Math.abs(z) > 24) {
        arched.push({
          position: [side * (signature.width_m / 2 + 0.12), 9.1, z],
          rotation: [0, Math.PI / 2, 0],
        });
      }
      for (const y of [16.2, 20.6]) {
        upper.push({
          position: [side * (signature.width_m / 2 + 0.14), y, z],
          rotation: [0, Math.PI / 2, 0],
        });
      }
    }
  }

  const towerSize = REICHSTAG_TOWER_SIZE_M;
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const towerX = reichstagTowerCentre(xSide, signature.width_m);
      const towerZ = reichstagTowerCentre(zSide, signature.depth_m);
      for (const offset of [-4.1, 0, 4.1]) {
        towerArches.push(
          {
            position: [
              towerX + offset,
              10.2,
              zSide * (signature.depth_m / 2 + 0.16),
            ],
          },
          {
            position: [
              xSide * (signature.width_m / 2 + 0.16),
              10.2,
              towerZ + offset,
            ],
            rotation: [0, Math.PI / 2, 0],
          },
        );
        towerUpper.push(
          {
            position: [
              towerX + offset,
              20.55,
              zSide * (signature.depth_m / 2 + 0.17),
            ],
          },
          {
            position: [
              xSide * (signature.width_m / 2 + 0.17),
              20.55,
              towerZ + offset,
            ],
            rotation: [0, Math.PI / 2, 0],
          },
        );
      }
    }
  }

  const splitLighting = (transforms: InstanceTransform[]) => ({
    dark: transforms.filter((_, index) => index % 6 !== 2),
    lit: transforms.filter((_, index) => index % 6 === 2),
  });
  const mainSets = splitLighting(arched);
  const mainGeometry = archedWindowGeometry(2.35, 6.1);
  const towerGeometry = archedWindowGeometry(2.25, 6.8);
  const upperGeometry = new PlaneGeometry(1.25, 2.65);
  addInstancedGeometry(
    group,
    "Reichstag dark tall arched facade windows",
    mainGeometry,
    darkGlass,
    mainSets.dark,
  );
  addInstancedGeometry(
    group,
    "Reichstag selectively lit tall arched facade windows",
    mainGeometry,
    occupiedGlass,
    mainSets.lit,
  );
  addInstancedGeometry(
    group,
    "Reichstag dark upper rectangular facade windows",
    upperGeometry,
    darkGlass,
    upper,
  );
  addInstancedGeometry(
    group,
    "Reichstag instanced upper-window 10 cm reveal frames",
    rectangularWindowFrameGeometry(),
    windowMetal,
    upper,
  );
  addInstancedGeometry(
    group,
    "Reichstag dark three-bay tower arched windows",
    towerGeometry,
    darkGlass,
    towerArches,
  );
  addInstancedGeometry(
    group,
    "Reichstag dark upper corner-tower windows",
    new PlaneGeometry(1.35, 3.4),
    darkGlass,
    towerUpper,
  );
  addInstancedGeometry(
    group,
    "Reichstag instanced upper corner-tower window frames",
    rectangularWindowFrameGeometry(1.35, 3.4, 0.11),
    windowMetal,
    towerUpper,
  );
  addInstancedBoxes(
    group,
    "Reichstag instanced tall-window vertical mullions",
    [0.11, 4.85, 0.1],
    windowMetal,
    arched,
  );
  addInstancedBoxes(
    group,
    "Reichstag instanced tower-window vertical mullions",
    [0.11, 5.45, 0.1],
    windowMetal,
    towerArches,
  );
  addInstancedBoxes(
    group,
    "Reichstag instanced upper tower-window mullions",
    [0.1, 2.78, 0.1],
    windowMetal,
    towerUpper,
  );
  const transoms = [...arched, ...towerArches].map((transform) => ({
    ...transform,
    position: [
      transform.position[0],
      transform.position[1] + 0.85,
      transform.position[2],
    ] as [number, number, number],
  }));
  addInstancedBoxes(
    group,
    "Reichstag instanced arched-window transoms",
    [1.92, 0.11, 0.1],
    windowMetal,
    transoms,
  );
}

function addReichstagMicroDetails(
  group: Group,
  signature: ReichstagModelSignature,
  stone: MeshStandardMaterial,
): void {
  const postTransforms: InstanceTransform[] = [];
  const longPostCount = Math.max(
    16,
    Math.round((signature.width_m - 24) / 4.2),
  );
  const shortPostCount = Math.max(
    20,
    Math.round((signature.depth_m - 24) / 4.2),
  );
  for (const zSide of [-1, 1]) {
    for (let index = 0; index <= longPostCount; index += 1) {
      postTransforms.push({
        position: [
          -signature.width_m / 2 +
            12 +
            (index / longPostCount) * (signature.width_m - 24),
          signature.body_height_m + 1.05,
          zSide * (signature.depth_m / 2 - 2.2),
        ],
      });
    }
  }
  for (const xSide of [-1, 1]) {
    for (let index = 0; index <= shortPostCount; index += 1) {
      postTransforms.push({
        position: [
          xSide * (signature.width_m / 2 - 2.2),
          signature.body_height_m + 1.05,
          -signature.depth_m / 2 +
            12 +
            (index / shortPostCount) * (signature.depth_m - 24),
        ],
      });
    }
  }
  addInstancedBoxes(
    group,
    "Reichstag instanced roof-balustrade posts",
    [0.28, 1.22, 0.28],
    stone,
    postTransforms,
  );

  const courses: VectorSegment[] = [];
  for (const y of [4.1, 8.5, 12.9, 17.3, 21.7]) {
    const x = signature.width_m / 2 + 0.2;
    const z = signature.depth_m / 2 + 0.2;
    courses.push(
      [
        [-x, y, -z],
        [x, y, -z],
      ],
      [
        [-x, y, z],
        [x, y, z],
      ],
      [
        [-x, y, -z],
        [-x, y, z],
      ],
      [
        [x, y, -z],
        [x, y, z],
      ],
    );
  }
  addVectorSegments(
    group,
    "Reichstag batched facade string courses",
    courses,
    0x817665,
    0.68,
  );
}

/**
 * Wallot's documented classical apparatus on the west front and the four
 * corner towers. LoD2 gives the envelope only, so the features that make
 * the 1894 elevation legible are drawn here: the fluted Corinthian
 * portico order, the tympanum relief field, the architrave mouldings
 * that frame the dedication, the rusticated base storey, and the tower
 * attics with their corner pinnacles.
 */
function addReichstagDocumentedOrders(
  group: Group,
  signature: ReichstagModelSignature,
  stone: MeshStandardMaterial,
): void {
  const towerSize = REICHSTAG_TOWER_SIZE_M;
  const towerTop = signature.body_height_m + 2.35;
  const atticHeight = 2.7;
  const parapets: InstanceTransform[] = [];
  const pinnacles: InstanceTransform[] = [];
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const cx = reichstagTowerCentre(xSide, signature.width_m);
      const cz = reichstagTowerCentre(zSide, signature.depth_m);
      // Parapet walls sit on the tower edges, so the flag mast keeps the
      // centre of every tower platform free.
      for (const edge of [-1, 1]) {
        parapets.push({
          position: [
            cx,
            towerTop + atticHeight / 2,
            cz + edge * (towerSize / 2 - 0.5),
          ],
        });
        parapets.push({
          position: [
            cx + edge * (towerSize / 2 - 0.5),
            towerTop + atticHeight / 2,
            cz,
          ],
          rotation: [0, Math.PI / 2, 0],
        });
      }
      for (const cornerX of [-1, 1]) {
        for (const cornerZ of [-1, 1]) {
          pinnacles.push({
            position: [
              cx + cornerX * (towerSize / 2 - 1.1),
              towerTop + 1.9,
              cz + cornerZ * (towerSize / 2 - 1.1),
            ],
          });
        }
      }
    }
  }
  addInstancedBoxes(
    group,
    "Reichstag instanced corner-tower attic parapets",
    [towerSize - 1.6, atticHeight, 0.8],
    stone,
    parapets,
  );
  addInstancedBoxes(
    group,
    "Reichstag instanced corner-tower pinnacles",
    [2.1, 3.8, 2.1],
    stone,
    pinnacles,
  );

  const westX = -signature.width_m / 2 - 3.6;
  // Corinthian shafts: fluting on the visible west half of each drum.
  const fluting: VectorSegment[] = [];
  const FLUTES = 7;
  for (let column = 0; column < 6; column += 1) {
    const cz = -17.5 + column * 7;
    for (let flute = 0; flute < FLUTES; flute += 1) {
      const angle = Math.PI + (flute / (FLUTES - 1) - 0.5) * 2.2;
      const fx = westX + Math.cos(angle) * 1.16;
      const fz = cz + Math.sin(angle) * 1.16;
      fluting.push([
        [fx, 4.95, fz],
        [fx, 17.85, fz],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Reichstag batched fluted portico shafts",
    fluting,
    EDGE_COLOR,
    0.62,
  );

  // Architrave mouldings above and below the gilded dedication band.
  for (const y of [17.78, 19.34]) {
    addBox(
      group,
      "Reichstag portico architrave moulding",
      [0.62, 0.34, 27.6],
      [westX - 3.72, y, 0],
      stone,
      0.84,
    );
  }
  // The tympanum carries a relief field, not blank ashlar.
  addBox(
    group,
    "Reichstag west tympanum relief field",
    [0.34, 3.1, 21.5],
    [westX - 3.3, 22.05, 0],
    stone,
    0.86,
  );

  // Rusticated base storey: deep horizontal beds plus staggered joints
  // on the two long fronts.
  const rustication: VectorSegment[] = [];
  const rx = signature.width_m / 2 + 0.18;
  const rz = signature.depth_m / 2 + 0.18;
  for (const y of [1.35, 2.7]) {
    rustication.push(
      [
        [-rx, y, -rz],
        [rx, y, -rz],
      ],
      [
        [-rx, y, rz],
        [rx, y, rz],
      ],
      [
        [-rx, y, -rz],
        [-rx, y, rz],
      ],
      [
        [rx, y, -rz],
        [rx, y, rz],
      ],
    );
  }
  for (const zSide of [-rz, rz]) {
    for (let index = 0; index <= 24; index += 1) {
      const x = -rx + (index / 24) * (rx * 2);
      const yTop = index % 2 === 0 ? 2.7 : 4.05;
      rustication.push([
        [x, 0.1, zSide],
        [x, yTop, zSide],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Reichstag batched rusticated base joints",
    rustication,
    0x817665,
    0.5,
  );
}

function triangularPrism(
  width: number,
  height: number,
  depth: number,
): BufferGeometry {
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
    0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}

function createReichstagModel(signature: ReichstagModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Reichstag recognition model";
  placeMetricGroup(group, signature);

  const stoneAccent = nightEmitter(
    modelMaterial(0xd8d0bf, {
      opacity: 0.48,
      roughness: 0.82,
    }),
    0x65778d,
    0.5,
  );
  const entranceGlass = nightEmitter(
    modelMaterial(0x6f8f94, {
      metalness: 0.1,
      opacity: 0.64,
      roughness: 0.32,
    }),
    0xffd69a,
    0.85,
  );
  addBoxOutline(
    group,
    "Reichstag LoD2 envelope",
    [signature.width_m, signature.body_height_m, signature.depth_m],
    [0, signature.body_height_m / 2, 0],
    0.58,
  );

  const towerSize = REICHSTAG_TOWER_SIZE_M;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      addBoxOutline(
        group,
        `Reichstag corner tower ${x}:${z}`,
        [towerSize, signature.body_height_m + 2.4, towerSize],
        [
          reichstagTowerCentre(x, signature.width_m),
          (signature.body_height_m + 2.4) / 2,
          reichstagTowerCentre(z, signature.depth_m),
        ],
        0.76,
      );
      addBox(
        group,
        "Reichstag corner-tower roof cornice",
        [towerSize + 1.2, 0.8, towerSize + 1.2],
        [
          reichstagTowerCentre(x, signature.width_m),
          signature.body_height_m + 1.95,
          reichstagTowerCentre(z, signature.depth_m),
        ],
        stoneAccent,
        0.72,
      );
      const flagPosition: [number, number, number] = [
        reichstagTowerCentre(x, signature.width_m),
        signature.body_height_m + 2.35,
        reichstagTowerCentre(z, signature.depth_m),
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
    const base = new Mesh(
      new CylinderGeometry(1.55, 1.7, 0.55, 18),
      stoneAccent,
    );
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
      "Reichstag west entrance tall glass pane",
      [0.28, 8.6, 4.2],
      [westX + 0.7, 8.35, -14 + index * 7],
      entranceGlass,
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
  // The bronze dedication on the architrave — the Reichstag's most famous
  // line, now spelled out instead of abstracted into three letter blocks.
  const bandWidth = REICHSTAG_INSCRIPTION_FIELD_WIDTH_M;
  const bandHeight = 1.15;
  addBox(
    group,
    "Reichstag DEM DEUTSCHEN VOLKE inscription band",
    [0.26, bandHeight, bandWidth],
    [westX - 3.8, 18.55, 0],
    modelMaterial(0xcfc6b3, { roughness: 0.72 }),
  );
  const dedicationTexture = createDedicationTexture({
    bandHeightM: bandHeight,
    bandWidthM: bandWidth,
    fieldColor: "#cfc6b3",
    letterColor: "#6d4a1e",
  });
  const dedicationMaterial = nightEmitter(
    modelMaterial(dedicationTexture ? 0xffffff : 0x6d4a1e, {
      metalness: 0.34,
      roughness: 0.46,
    }),
    0xffca7a,
    0.22,
  );
  dedicationMaterial.map = dedicationTexture;
  dedicationMaterial.side = FrontSide;
  const dedication = new Mesh(
    new PlaneGeometry(bandWidth, bandHeight),
    dedicationMaterial,
  );
  dedication.name = "Reichstag DEM DEUTSCHEN VOLKE dedication lettering";
  // Rotated so the plane's +Z normal points west (local -X) and its +X axis
  // runs along +Z, which is left-to-right for a viewer standing in front of
  // the portico.
  dedication.rotation.y = -Math.PI / 2;
  // Keep a physical 23 cm standoff from the stone band. The previous 1 cm
  // separation shared nearly the same depth values at overview scale, so the
  // bronze letters could disappear or shimmer through z-fighting.
  dedication.position.set(westX - 4.17, 18.55, 0);
  dedication.frustumCulled = false;
  dedication.renderOrder = 12;
  dedicationMaterial.depthWrite = false;
  dedicationMaterial.polygonOffsetFactor = -6;
  dedicationMaterial.polygonOffsetUnits = -6;
  group.add(dedication);
  // The grand west stair rises to the portico floor.
  for (let step = 0; step < 5; step += 1) {
    addBox(
      group,
      "Reichstag west grand stair step",
      [1.25, 0.45, 37 - step * 1.6],
      [westX - 4.6 - step * 1.2, 3.55 - step * 0.75, 0],
      stoneAccent,
      0.9,
    );
  }
  // The dome rises from a square roof podium, not bare terrace.
  addBox(
    group,
    "Reichstag dome roof podium",
    [46, 1.6, 46],
    [0, signature.body_height_m + 0.8, 0],
    stoneAccent,
    0.88,
  );
  // The six inner courtyards. The roof itself is the LoD2 prism's top face, so
  // each well is drawn as a recessed floor plate (the material's polygon offset
  // keeps it in front of the prism roof instead of z-fighting it) plus the
  // outline of the shaft, which is what gives the opening depth close up.
  const courtyardFloor = nightEmitter(
    modelMaterial(0x8f8878, { roughness: 0.9 }),
    0x2d3a4c,
    0.35,
  );
  for (const court of REICHSTAG_COURTYARDS) {
    const floorTop = signature.body_height_m - REICHSTAG_COURTYARD_DEPTH_M;
    addBox(
      group,
      "Reichstag inner courtyard floor",
      [court.width_m, 0.4, court.depth_m],
      [court.x_m, floorTop - 0.2, court.z_m],
      courtyardFloor,
      0.7,
    );
    addBoxOutline(
      group,
      "Reichstag inner courtyard shaft",
      [court.width_m, REICHSTAG_COURTYARD_DEPTH_M, court.depth_m],
      [
        court.x_m,
        signature.body_height_m - REICHSTAG_COURTYARD_DEPTH_M / 2,
        court.z_m,
      ],
      0.72,
    );
  }

  // Central risalits on the north, east and south fronts — the real
  // elevation projects on all four sides, not only at the portico.
  addBox(
    group,
    "Reichstag east central risalit",
    [3.4, signature.body_height_m + 1.8, 30],
    [signature.width_m / 2 + 0.9, (signature.body_height_m + 1.8) / 2, 0],
    stoneAccent,
    0.85,
  );
  for (const side of [-1, 1]) {
    addBox(
      group,
      "Reichstag long-front central risalit",
      [30, signature.body_height_m + 1.8, 3.4],
      [
        0,
        (signature.body_height_m + 1.8) / 2,
        side * (signature.depth_m / 2 + 0.9),
      ],
      stoneAccent,
      0.85,
    );
  }
  addEdges(group, pediment, 0.9);
  addReichstagWindowSets(group, signature);
  addReichstagMicroDetails(group, signature, stoneAccent);
  addReichstagDocumentedOrders(group, signature, stoneAccent);

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
    modelMaterial(0x9bc7cd, {
      metalness: 0.08,
      opacity: 0.26,
      roughness: 0.28,
    }),
    0x18343f,
    0.18,
  );
  const concrete = nightEmitter(
    modelMaterial(0xf0f2ef, {
      opacity: 0.86,
      roughness: 0.76,
    }),
    0x55687b,
    0.32,
  );
  const darkPane = nightEmitter(
    modelMaterial(0x79aab3, {
      metalness: 0.1,
      opacity: 0.36,
      roughness: 0.26,
    }),
    0x1b3038,
    0.12,
  );
  const litPane = nightEmitter(
    modelMaterial(0x79aab3, {
      metalness: 0.1,
      opacity: 0.36,
      roughness: 0.26,
    }),
    0xffd18b,
    0.82,
  );
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
  const columnCount = Math.max(18, Math.round(width / 2.65));
  const mullions: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index <= columnCount; index += 1) {
      const columnX = x - width / 2 + (index / columnCount) * width;
      mullions.push({
        position: [columnX, height / 2 - 0.2, z + side * (depth / 2 + 0.13)],
      });
    }
  }
  addInstancedBoxes(
    group,
    "Chancellery instanced office-band facade mullions",
    [0.28, height - 2.8, 0.3],
    concrete,
    mullions,
  );

  const bayWidth = Math.max(1.35, width / columnCount - 0.38);
  const darkPanes: InstanceTransform[] = [];
  const litPanes: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let floor = 0; floor < 5; floor += 1) {
      for (let bay = 0; bay < columnCount; bay += 1) {
        const transform: InstanceTransform = {
          position: [
            x - width / 2 + ((bay + 0.5) / columnCount) * width,
            1.8 + floor * 3.6,
            z + side * (depth / 2 + 0.17),
          ],
        };
        const occupied = Math.abs(bay * 7 + floor * 11 + side * 3) % 9 < 3;
        (occupied ? litPanes : darkPanes).push(transform);
      }
    }
  }
  addInstancedBoxes(
    group,
    "Chancellery instanced office-band window panes",
    [bayWidth, 2.72, 0.12],
    darkPane,
    darkPanes,
  );
  addInstancedBoxes(
    group,
    "Chancellery selectively lit office-band window panes",
    [bayWidth, 2.72, 0.12],
    litPane,
    litPanes,
  );
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

/**
 * Schultes and Frank's documented articulation, which the LoD2 extents
 * cannot carry: the radial tracery of the two semicircular leadership
 * windows (the round-window motif the building is known for), the
 * two-storey winter-garden recesses cut into the office bands, the
 * structural joints that divide those 200 m bands, and the column row
 * that frames the Ehrenhof.
 */
function addChancelleryDocumentedDetail(
  group: Group,
  signature: ChancelleryModelSignature,
): void {
  const concrete = nightEmitter(
    modelMaterial(0xf0f2ef, { opacity: 0.86, roughness: 0.76 }),
    0x55687b,
    0.32,
  );
  const recess = nightEmitter(
    modelMaterial(0x8fb0b4, { opacity: 0.5, roughness: 0.42 }),
    0x2a4650,
    0.3,
  );
  const cubeX = signature.cube_offset_world[0];
  const cubeZ = signature.cube_offset_world[2];

  // The semicircular windows are glazed with radial spokes and
  // concentric arcs, not with a rectangular curtain-wall grid.
  const tracery: VectorSegment[] = [];
  const RADIUS = 17.2;
  const SPRING_Y = 10.5;
  for (const xDirection of [-1, 1]) {
    const faceX = cubeX + xDirection * (signature.cube_width_m / 2 + 0.26);
    for (let spoke = 1; spoke < 9; spoke += 1) {
      const angle = (spoke / 9) * Math.PI;
      tracery.push([
        [faceX, SPRING_Y, cubeZ],
        [
          faceX,
          SPRING_Y + Math.sin(angle) * RADIUS,
          cubeZ - Math.cos(angle) * RADIUS,
        ],
      ]);
    }
    for (const ringRadius of [5.9, 11.5]) {
      const STEPS = 18;
      for (let step = 0; step < STEPS; step += 1) {
        const a0 = (step / STEPS) * Math.PI;
        const a1 = ((step + 1) / STEPS) * Math.PI;
        tracery.push([
          [
            faceX,
            SPRING_Y + Math.sin(a0) * ringRadius,
            cubeZ - Math.cos(a0) * ringRadius,
          ],
          [
            faceX,
            SPRING_Y + Math.sin(a1) * ringRadius,
            cubeZ - Math.cos(a1) * ringRadius,
          ],
        ]);
      }
    }
  }
  addVectorSegments(
    group,
    "Chancellery batched semicircular window radial tracery",
    tracery,
    0xdce9e7,
    0.7,
  );

  // Four freestanding supports are plainly visible behind each monumental
  // semicircle. They are essential to Schultes and Frank's layered elevation:
  // the circle frames a column hall rather than a flat glazed disc.
  const leadershipColumns: InstanceTransform[] = [];
  const leadershipCapitals: InstanceTransform[] = [];
  for (const xDirection of [-1, 1]) {
    const faceX = cubeX + xDirection * (signature.cube_width_m / 2 + 0.05);
    for (const zOffset of [-10.2, -3.4, 3.4, 10.2]) {
      leadershipColumns.push({
        position: [faceX, 18.15, cubeZ + zOffset],
      });
      leadershipCapitals.push({
        position: [faceX, 25.7, cubeZ + zOffset],
      });
    }
  }
  addInstancedGeometry(
    group,
    "Chancellery instanced semicircular-hall columns",
    new CylinderGeometry(0.5, 0.58, 15.1, 12),
    concrete,
    leadershipColumns,
  );
  addInstancedGeometry(
    group,
    "Chancellery instanced semicircular-hall capitals",
    new CylinderGeometry(0.92, 0.55, 0.72, 12),
    concrete,
    leadershipCapitals,
  );
  const balconyRails: VectorSegment[] = [];
  for (const xDirection of [-1, 1]) {
    const faceX = cubeX + xDirection * (signature.cube_width_m / 2 + 0.33);
    for (const y of [11.75, 12.65]) {
      balconyRails.push([
        [faceX, y, cubeZ - 14.5],
        [faceX, y, cubeZ + 14.5],
      ]);
    }
    for (let index = 0; index <= 12; index += 1) {
      const z = cubeZ - 14.5 + (index / 12) * 29;
      balconyRails.push([
        [faceX, 11.1, z],
        [faceX, 12.7, z],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Chancellery batched semicircular-hall balcony rails",
    balconyRails,
    0x81979b,
    0.82,
  );

  const loggiaFrames: InstanceTransform[] = [];
  const loggiaVoids: InstanceTransform[] = [];
  const joints: VectorSegment[] = [];
  for (const segment of signature.office_segments) {
    const x = segment.offset_world[0];
    const z = segment.offset_world[2];
    const { depth_m: depth, height_m: height, width_m: width } = segment;
    const loggiaCount = Math.max(2, Math.round(width / 62));
    for (const side of [-1, 1]) {
      for (let index = 0; index < loggiaCount; index += 1) {
        const loggiaX = x - width / 2 + ((index + 0.5) / loggiaCount) * width;
        loggiaFrames.push({
          position: [loggiaX, height / 2 + 1.1, z + side * (depth / 2 + 0.26)],
        });
        loggiaVoids.push({
          position: [loggiaX, height / 2 + 1.1, z + side * (depth / 2 - 0.6)],
        });
      }
    }
    // Structural joints: the bands are built in roughly 33 m sections.
    const jointCount = Math.max(2, Math.round(width / 33));
    for (const side of [-1, 1]) {
      const faceZ = z + side * (depth / 2 + 0.2);
      for (let index = 1; index < jointCount; index += 1) {
        const jointX = x - width / 2 + (index / jointCount) * width;
        joints.push([
          [jointX, 0.4, faceZ],
          [jointX, height - 0.2, faceZ],
        ]);
      }
    }
  }
  addInstancedBoxes(
    group,
    "Chancellery instanced office-band winter-garden reveals",
    [7.6, 7.8, 0.5],
    concrete,
    loggiaFrames,
  );
  addInstancedBoxes(
    group,
    "Chancellery instanced office-band winter-garden voids",
    [6.6, 6.9, 0.4],
    recess,
    loggiaVoids,
  );
  addVectorSegments(
    group,
    "Chancellery batched office-band structural joints",
    joints,
    EDGE_COLOR,
    0.6,
  );

  if (!signature.forecourt_offset_world) {
    return;
  }
  // The Ehrenhof is framed by a row of slender round columns carrying a
  // thin architrave.
  const [courtX, , courtZ] = signature.forecourt_offset_world;
  const COLUMN_HEIGHT = 15.4;
  const COLUMN_COUNT = 11;
  const columnSpan = 46;
  for (let index = 0; index < COLUMN_COUNT; index += 1) {
    const columnX =
      courtX - columnSpan / 2 + (index / (COLUMN_COUNT - 1)) * columnSpan;
    const column = new Mesh(
      new CylinderGeometry(0.52, 0.6, COLUMN_HEIGHT, 12),
      concrete,
    );
    column.name = `Chancellery Ehrenhof column ${index + 1}`;
    column.position.set(columnX, COLUMN_HEIGHT / 2, courtZ - 17.5);
    column.castShadow = true;
    group.add(column);
  }
  addBox(
    group,
    "Chancellery Ehrenhof colonnade architrave",
    [columnSpan + 2.4, 1.15, 1.5],
    [courtX, COLUMN_HEIGHT + 0.58, courtZ - 17.5],
    concrete,
    0.78,
  );

  // Kanzlergarten: Reuterswärd's "Non-Violence" — the knotted .357
  // revolver, a replica of the 1985 original, on a low granite plinth.
  const westBand =
    signature.office_segments[signature.office_segments.length - 1];
  const gardenX = westBand.offset_world[0] + 34;
  const gardenZ = westBand.offset_world[2] + 27;
  const granite = modelMaterial(0x8a8b86, { roughness: 0.88 });
  const gunmetal = nightEmitter(
    modelMaterial(0x555c60, { metalness: 0.52, roughness: 0.44 }),
    0x2c3236,
    0.2,
  );
  addBox(
    group,
    "Kanzlergarten Non-Violence sculpture plinth",
    [2.2, 0.55, 2.2],
    [gardenX, 0.28, gardenZ],
    granite,
    0.42,
  );
  // Grip and frame rise from the plinth; the barrel loops over into a
  // knot and points its muzzle back at the sky.
  addCylinderBetween(
    group,
    "Non-Violence revolver grip",
    new Vector3(gardenX, 0.55, gardenZ),
    new Vector3(gardenX - 0.18, 2.1, gardenZ),
    0.26,
    gunmetal,
  );
  addBox(
    group,
    "Non-Violence revolver cylinder frame",
    [0.62, 0.7, 0.5],
    [gardenX + 0.1, 2.4, gardenZ],
    gunmetal,
    0.5,
  );
  const KNOT_RADIUS = 0.72;
  const KNOT_STEPS = 14;
  const knotCenter = new Vector3(gardenX + 0.55, 3.25, gardenZ);
  for (let step = 0; step < KNOT_STEPS; step += 1) {
    const a0 = (step / KNOT_STEPS) * Math.PI * 1.85;
    const a1 = ((step + 1) / KNOT_STEPS) * Math.PI * 1.85;
    const point = (angle: number): Vector3 =>
      new Vector3(
        knotCenter.x + Math.sin(angle) * KNOT_RADIUS,
        knotCenter.y - Math.cos(angle) * KNOT_RADIUS,
        knotCenter.z + Math.sin(angle * 2) * 0.3,
      );
    addCylinderBetween(
      group,
      "Non-Violence knotted barrel",
      point(a0),
      point(a1),
      0.19,
      gunmetal,
      8,
    );
  }
  addCylinderBetween(
    group,
    "Non-Violence upturned muzzle",
    knotCenter.clone().add(new Vector3(-0.3, 0.62, 0.1)),
    knotCenter.clone().add(new Vector3(-0.5, 1.5, 0.16)),
    0.17,
    gunmetal,
  );
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

function addChancelleryPolice(
  group: Group,
  signature: ChancelleryModelSignature,
): void {
  if (!signature.forecourt_offset_world) {
    return;
  }
  const cube = new Vector3(
    signature.cube_offset_world[0],
    0,
    signature.cube_offset_world[2],
  );
  const forecourt = new Vector3(
    signature.forecourt_offset_world[0],
    0,
    signature.forecourt_offset_world[2],
  );
  const forward = forecourt.clone().sub(cube).normalize();
  const lateral = new Vector3(-forward.z, 0, forward.x);
  const entrance = cube.clone().addScaledVector(forward, 34);
  const heading = Math.atan2(forward.x, forward.z);
  const officers = [-1, 1].map((side) =>
    entrance.clone().addScaledVector(lateral, side * 1.45),
  );
  const transformsAt = (
    y: number,
    lateralOffset = 0,
    forwardOffset = 0,
  ): InstanceTransform[] =>
    officers.map((position) => {
      const placed = position
        .clone()
        .addScaledVector(lateral, lateralOffset)
        .addScaledVector(forward, forwardOffset);
      return {
        position: [placed.x, y, placed.z],
        rotation: [0, heading, 0],
      };
    });

  const navy = modelMaterial(0x162c41, { roughness: 0.76 });
  const black = modelMaterial(0x15191c, { roughness: 0.82 });
  const skin = modelMaterial(0xc58f6c, { roughness: 0.86 });
  const reflective = nightEmitter(
    modelMaterial(0xb8d8d9, { metalness: 0.08, roughness: 0.42 }),
    0xdafcff,
    0.32,
  );
  addInstancedGeometry(
    group,
    "Chancellery two Federal Police uniformed torsos",
    new CapsuleGeometry(0.25, 0.45, 4, 8),
    navy,
    transformsAt(1.16),
  );
  addInstancedGeometry(
    group,
    "Chancellery four Federal Police trouser legs",
    new CylinderGeometry(0.1, 0.115, 0.72, 8),
    navy,
    [...transformsAt(0.42, -0.13), ...transformsAt(0.42, 0.13)],
  );
  addInstancedBoxes(
    group,
    "Chancellery four Federal Police boots",
    [0.22, 0.16, 0.34],
    black,
    [...transformsAt(0.12, -0.13, 0.06), ...transformsAt(0.12, 0.13, 0.06)],
  );
  addInstancedGeometry(
    group,
    "Chancellery four Federal Police uniformed arms",
    new CylinderGeometry(0.085, 0.095, 0.62, 8),
    navy,
    [...transformsAt(1.19, -0.32), ...transformsAt(1.19, 0.32)],
  );
  addInstancedGeometry(
    group,
    "Chancellery two Federal Police heads",
    new SphereGeometry(0.17, 10, 8),
    skin,
    transformsAt(1.74),
  );
  addInstancedGeometry(
    group,
    "Chancellery two Federal Police caps",
    new CylinderGeometry(0.2, 0.215, 0.13, 12),
    navy,
    transformsAt(1.91),
  );
  addInstancedBoxes(
    group,
    "Chancellery two Federal Police cap brims",
    [0.35, 0.04, 0.24],
    navy,
    transformsAt(1.865, 0, 0.12),
  );
  addInstancedBoxes(
    group,
    "Chancellery two Federal Police reflective chest bands",
    [0.5, 0.075, 0.29],
    reflective,
    transformsAt(1.3, 0, 0.015),
  );
  addInstancedBoxes(
    group,
    "Chancellery two Federal Police shoulder radios",
    [0.09, 0.18, 0.08],
    black,
    transformsAt(1.48, 0.19, 0.08),
  );
}

function createChancelleryModel(signature: ChancelleryModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Federal Chancellery recognition model";
  placeMetricGroup(group, signature);

  const concrete = nightEmitter(
    modelMaterial(0xf0f2ef, {
      opacity: 0.78,
      roughness: 0.78,
    }),
    0x55687b,
    0.32,
  );
  const glass = nightEmitter(
    modelMaterial(0x9ccbd0, {
      metalness: 0.06,
      opacity: 0.32,
      roughness: 0.25,
    }),
    0x274b57,
    0.28,
  );
  const cubeX = signature.cube_offset_world[0];
  const cubeZ = signature.cube_offset_world[2];
  const glassWidth = signature.cube_width_m - 7;
  const glassHeight = signature.cube_height_m - 5;
  const glassDepth = signature.cube_depth_m - 7;
  const glassMinY = signature.cube_height_m / 2 - glassHeight / 2;
  const glassMaxY = glassMinY + glassHeight;
  addBox(
    group,
    "Chancellery central glass cube",
    [glassWidth, glassHeight, glassDepth],
    [cubeX, signature.cube_height_m / 2, cubeZ],
    glass,
    0.7,
  );
  const cubeGrid: VectorSegment[] = [];
  const verticalBays = Math.max(10, Math.round(glassWidth / 3.8));
  for (const zSide of [-1, 1]) {
    const faceZ = cubeZ + zSide * (glassDepth / 2 - 0.02);
    for (let bay = 0; bay <= verticalBays; bay += 1) {
      const x = cubeX - glassWidth / 2 + (bay / verticalBays) * glassWidth;
      cubeGrid.push([
        [x, glassMinY + 0.1, faceZ],
        [x, glassMaxY - 0.1, faceZ],
      ]);
    }
    for (let y = glassMinY + 3.2; y < glassMaxY; y += 3.2) {
      cubeGrid.push([
        [cubeX - glassWidth / 2, y, faceZ],
        [cubeX + glassWidth / 2, y, faceZ],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Chancellery batched central-cube curtain-wall grid",
    cubeGrid,
    0xa8d6d9,
    0.58,
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
      color: 0x98d3da,
      depthWrite: false,
      metalness: 0.04,
      opacity: 0.42,
      roughness: 0.12,
      side: DoubleSide,
      transparent: true,
      transmission: 0.2,
    }),
    0xffcf78,
    0.82,
  );
  const archFrame = modelMaterial(0xf0f1ec, { roughness: 0.68 });
  const windowGrid: VectorSegment[] = [];
  for (const xDirection of [-1, 1]) {
    const glassWindow = new Mesh(
      new CircleGeometry(17.2, 64, 0, Math.PI),
      windowGlass,
    );
    glassWindow.name = "Chancellery semicircular leadership window";
    glassWindow.rotation.y = Math.PI / 2;
    glassWindow.position.set(
      cubeX + xDirection * (signature.cube_width_m / 2 + 0.12),
      10.5,
      cubeZ,
    );
    group.add(glassWindow);
    const frame = new Mesh(
      new RingGeometry(16.5, 18.1, 64, 2, 0, Math.PI),
      archFrame,
    );
    frame.name = "Chancellery semicircular window frame";
    frame.rotation.y = Math.PI / 2;
    frame.position
      .copy(glassWindow.position)
      .add(new Vector3(xDirection * 0.08, 0, 0));
    group.add(frame);
    const faceX = cubeX + xDirection * (signature.cube_width_m / 2 + 0.22);
    for (const zOffset of [-13.5, -9, -4.5, 0, 4.5, 9, 13.5]) {
      const top = 10.5 + Math.sqrt(17.2 ** 2 - zOffset ** 2);
      windowGrid.push([
        [faceX, 10.5, cubeZ + zOffset],
        [faceX, top, cubeZ + zOffset],
      ]);
    }
    for (const yOffset of [3, 6, 9, 12, 15]) {
      const halfWidth = Math.sqrt(17.2 ** 2 - yOffset ** 2);
      windowGrid.push([
        [faceX, 10.5 + yOffset, cubeZ - halfWidth],
        [faceX, 10.5 + yOffset, cubeZ + halfWidth],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Chancellery batched semicircular leadership-window grid",
    windowGrid,
    0xdce9e7,
    0.82,
  );

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
  addChancelleryDocumentedDetail(group, signature);
  addChancelleryForecourt(group, signature);
  addChancelleryPolice(group, signature);
  return group;
}

/**
 * The real lateral curvature of the Stadtbahn viaduct through the
 * Hauptbahnhof, in the station model's own local (unrotated) frame,
 * fitted from ``rail-lines.json`` (see ``createHauptbahnhofModel`` for the
 * derivation notes and the world<->local transform). The user's v0.56
 * complaint about v0.55 was exact: the east-west glass hall must bend
 * WITH the real track curve, not with a synthetic symmetric sine bow
 * peaking at the shed's midpoint. Fitting a quadratic z = a*x^2 + b*x to
 * the ``viaduct_tracks`` polyline nearest the station anchor (track index
 * 0, x in [-280, 220] m local, which covers the whole 431 m rendered
 * deck) gives a residual under 2 m end to end -- the real curve reads as
 * a shallow circular arc (radius ~635 m) here, not a symmetric bow. These
 * two coefficients are that fit, frozen as constants because the real
 * track geometry does not change at runtime; `tests/hauptbahnhof-curve.
 * test.ts` re-derives the same fit from the shipped rail-lines.json and
 * pins these numbers against it so a future rail-data refresh cannot
 * silently drift the roof away from the tracks again.
 */
export const HAUPTBAHNHOF_RAIL_CURVE_A = 0.000_787;
export const HAUPTBAHNHOF_RAIL_CURVE_B = 0.223_3;
// The glass skin must read as a continuous pale volume before its steel
// lattice.  Lower envelope opacity plus stronger seams made the station look
// like a wireframe at overview scale even though its metric geometry was
// correct.  Keep this hierarchy explicit and covered by the glass contract.
export const HAUPTBAHNHOF_GLASS_DAY_OPACITY = 0.5;
export const HAUPTBAHNHOF_GLASS_GRID_OPACITY = 0.28;

/**
 * Lateral offset (local metres) of the real rail curve at local-x
 * `xLocal`, relative to the curve's own value at `xLocal = 0` (roughly
 * the crossing with the north-south hall) -- i.e. the curve's *shape*,
 * not its absolute lateral position, since the roof is otherwise
 * centred on z = 0 in the model's local frame.
 */
function railCurveOffset(xLocal: number): number {
  return (
    HAUPTBAHNHOF_RAIL_CURVE_A * xLocal * xLocal +
    HAUPTBAHNHOF_RAIL_CURVE_B * xLocal
  );
}

/**
 * A shallow lateral bow applied along the roof's long axis. `"rail"`
 * follows the real quadratic rail curve above -- used for the east-west
 * hall, which rides the actual curved viaduct -- and `"none"` is a
 * dead-straight barrel -- used for the north-south hall, which the real
 * station also builds straight, square across the east-west hall. There
 * is deliberately no more synthetic symmetric "sine bow" shape: the whole
 * point of the v0.56 rebuild is that the curve is derived from the real
 * rail data, evaluated in the *model group's own local frame* (absolute
 * local x, not relative to any one roof segment's own extent), so every
 * curved part of the station -- roof glazing, ribs, purlins, seams --
 * bends by the same amount at the same local x.
 */
type RoofCurve = "none" | "rail";

function roofBowOffset(xLocalInGroup: number, curve: RoofCurve): number {
  if (curve === "none") {
    return 0;
  }
  // Re-centre so the curve reads as zero at the station's own crossing
  // (local x = 0, where the north-south hall meets the east-west hall);
  // the rail curve fit itself is anchored there (see
  // HAUPTBAHNHOF_RAIL_CURVE_A/B above).
  return railCurveOffset(xLocalInGroup) - railCurveOffset(0);
}

function barrelRoofGeometry(
  length: number,
  width: number,
  height: number,
  alongX: boolean,
  segments = 48,
  offsetLongitudinal = 0,
  curve: RoofCurve = "none",
  bowSegments = 48,
): BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const bowSteps = curve === "none" ? 1 : bowSegments;
  for (let bowIndex = 0; bowIndex <= bowSteps; bowIndex += 1) {
    const fraction = bowIndex / bowSteps;
    // Geometry vertices are authored in the roof mesh's OWN local frame
    // (the mesh itself is translated by offsetLongitudinal afterwards), so
    // the curve must be sampled at the equivalent absolute group-local x.
    const longitudinal = -length / 2 + fraction * length;
    const xLocalInGroup = longitudinal + offsetLongitudinal;
    const bow = roofBowOffset(xLocalInGroup, curve);
    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI;
      const lateral = Math.cos(angle) * (width / 2) + bow;
      const y = Math.sin(angle) * height;
      vertices.push(
        ...(alongX ? [longitudinal, y, lateral] : [lateral, y, longitudinal]),
      );
    }
  }
  const row = segments + 1;
  for (let bowIndex = 0; bowIndex < bowSteps; bowIndex += 1) {
    for (let index = 0; index < segments; index += 1) {
      const a = bowIndex * row + index;
      const b = a + 1;
      const c = a + row;
      const d = b + row;
      indices.push(a, c, b, b, c, d);
    }
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
  offsetLongitudinal = 0,
  curve: RoofCurve = "none",
): void {
  // Pale, properly depth-tested glazing, transparent hellblau (light
  // blue) glass with visible steel structure -- the only material this
  // station's aboveground envelope is built from (v0.56: no opaque grey
  // boxes anywhere over the footprint).
  const glass = nightEmitter(
    new MeshPhysicalMaterial({
      color: 0xcfe9ed,
      depthWrite: false,
      metalness: 0.03,
      opacity: HAUPTBAHNHOF_GLASS_DAY_OPACITY,
      roughness: 0.1,
      side: DoubleSide,
      transparent: true,
      transmission: 0.34,
    }),
    0xaedfff,
    1.1,
  );
  const steel = modelMaterial(0x718992, { metalness: 0.54, roughness: 0.32 });
  const roof = new Mesh(
    barrelRoofGeometry(
      length,
      width,
      height,
      alongX,
      48,
      offsetLongitudinal,
      curve,
    ),
    glass,
  );
  roof.name = name;
  roof.position.y = baseY + 0.18;
  if (alongX) {
    roof.position.x = offsetLongitudinal;
  } else {
    roof.position.z = offsetLongitudinal;
  }
  roof.renderOrder = 6;
  group.add(roof);

  // Ribs stay on straight, unbowed arches in cross-section (the real
  // shed's structural steel is built from straight prefabricated arch
  // segments; only the glazing envelope and its seams follow the shallow
  // curve of the viaduct it rides), but each rib's longitudinal position
  // and its own arch centreline both shift sideways by the curve's offset
  // at that rib's location, so the ribs still march along the bent tube
  // instead of standing on a straight line through a curved skin.
  const ribCount = Math.max(18, Math.round(length / 6));
  const ribTransforms = Array.from({ length: ribCount + 1 }, (_, index) => {
    const longitudinal = -length / 2 + (index / ribCount) * length;
    const xLocalInGroup = longitudinal + offsetLongitudinal;
    const bow = roofBowOffset(xLocalInGroup, curve);
    return {
      position: (alongX ? [longitudinal, 0, bow] : [bow, 0, longitudinal]) as [
        number,
        number,
        number,
      ],
    };
  });
  const ribPoints = Array.from({ length: 33 }, (_, index) => {
    const angle = (index / 32) * Math.PI;
    const lateral = Math.cos(angle) * (width / 2);
    const y = baseY + Math.sin(angle) * height;
    return alongX ? new Vector3(0, y, lateral) : new Vector3(lateral, y, 0);
  });
  addInstancedGeometry(
    group,
    `${name} instanced steel arch ribs`,
    new TubeGeometry(new CatmullRomCurve3(ribPoints), 40, 0.12, 5, false),
    steel,
    ribTransforms,
  );

  // Purlins run the full length of the roof, one per lateral angle step.
  // On the curved (rail) roofs, each purlin is built from short straight
  // sub-segments that follow the same bow as the glazing above it, all
  // packed into a single InstancedMesh so the naming/count contract
  // ("instanced longitudinal steel purlins", one mesh per roof) is
  // unchanged from the straight-roof case.
  const purlinFractions = Array.from(
    { length: 17 },
    (_, index) => (index + 1) / 18,
  );
  const purlinLongSteps = curve === "none" ? 1 : 24;
  const purlinUnitLength = length / purlinLongSteps;
  const purlinTransforms: InstanceTransform[] = [];
  for (const fraction of purlinFractions) {
    const angle = fraction * Math.PI;
    const y = baseY + Math.sin(angle) * height + 0.09;
    for (let step = 0; step < purlinLongSteps; step += 1) {
      const t0 = step / purlinLongSteps;
      const t1 = (step + 1) / purlinLongSteps;
      const long0 = -length / 2 + t0 * length;
      const long1 = -length / 2 + t1 * length;
      const bow0 = roofBowOffset(long0 + offsetLongitudinal, curve);
      const bow1 = roofBowOffset(long1 + offsetLongitudinal, curve);
      const lateral0 = Math.cos(angle) * (width / 2) + bow0;
      const lateral1 = Math.cos(angle) * (width / 2) + bow1;
      const midLong = (long0 + long1) / 2;
      const midLateral = (lateral0 + lateral1) / 2;
      const dLong = long1 - long0;
      const dLateral = lateral1 - lateral0;
      const segLength = Math.hypot(dLong, dLateral);
      const yaw = Math.atan2(dLateral, dLong);
      purlinTransforms.push({
        position: alongX ? [midLong, y, midLateral] : [midLateral, y, midLong],
        rotation: alongX ? [0, -yaw, 0] : [0, Math.PI / 2 - yaw, 0],
        scale: [segLength / (purlinUnitLength || 1), 1, 1],
      });
    }
  }
  addInstancedBoxes(
    group,
    `${name} instanced longitudinal steel purlins`,
    [purlinUnitLength, 0.18, 0.18],
    steel,
    purlinTransforms,
  );

  const panelSegments: VectorSegment[] = [];
  const transverseCount = Math.max(30, Math.round(length / 3));
  const arcSegments = 28;
  for (let seam = 0; seam <= transverseCount; seam += 1) {
    const fraction = seam / transverseCount;
    const longitudinal = -length / 2 + fraction * length;
    const bow = roofBowOffset(longitudinal + offsetLongitudinal, curve);
    for (let index = 0; index < arcSegments; index += 1) {
      const startAngle = (index / arcSegments) * Math.PI;
      const endAngle = ((index + 1) / arcSegments) * Math.PI;
      const startLateral = Math.cos(startAngle) * (width / 2) + bow;
      const endLateral = Math.cos(endAngle) * (width / 2) + bow;
      const startY = baseY + Math.sin(startAngle) * height + 0.24;
      const endY = baseY + Math.sin(endAngle) * height + 0.24;
      panelSegments.push(
        alongX
          ? [
              [longitudinal, startY, startLateral],
              [longitudinal, endY, endLateral],
            ]
          : [
              [startLateral, startY, longitudinal],
              [endLateral, endY, longitudinal],
            ],
      );
    }
  }
  for (const fraction of purlinFractions) {
    const angle = fraction * Math.PI;
    const longSteps = curve === "none" ? 1 : 24;
    for (let step = 0; step < longSteps; step += 1) {
      const t0 = step / longSteps;
      const t1 = (step + 1) / longSteps;
      const long0 = -length / 2 + t0 * length;
      const long1 = -length / 2 + t1 * length;
      const bow0 = roofBowOffset(long0 + offsetLongitudinal, curve);
      const bow1 = roofBowOffset(long1 + offsetLongitudinal, curve);
      const lateral0 = Math.cos(angle) * (width / 2) + bow0;
      const lateral1 = Math.cos(angle) * (width / 2) + bow1;
      const y = baseY + Math.sin(angle) * height + 0.24;
      panelSegments.push(
        alongX
          ? [
              [long0, y, lateral0],
              [long1, y, lateral1],
            ]
          : [
              [lateral0, y, long0],
              [lateral1, y, long1],
            ],
      );
    }
  }
  addVectorSegments(
    group,
    `${name} batched glass panel seams`,
    panelSegments,
    0x668892,
    HAUPTBAHNHOF_GLASS_GRID_OPACITY,
  );
}

/**
 * The barrel roof's end gable: a filled semicircular wall standing exactly
 * at one end of the shed, cut perpendicular to the *local tangent* of the
 * (possibly curved) rail axis at that end rather than perpendicular to the
 * shed's own longitudinal (x or z) construction axis. On the curved
 * east-west roof the rail axis is not parallel to that construction axis
 * at the ends (the quadratic bow has a non-zero slope there), so a portal
 * built square to x would lean away from the tracks it is meant to frame;
 * rotating it by the curve's local tangent angle keeps the archway square
 * across the rails themselves, exactly the "Portalbogen exakt ueber dem
 * Gleisbuendel" the user asked for.
 */
function addBarrelRoofEndPortal(
  group: Group,
  name: string,
  endLongitudinal: number,
  width: number,
  height: number,
  baseY: number,
  alongX: boolean,
  offsetLongitudinal: number,
  curve: RoofCurve,
  outward: 1 | -1,
): void {
  const glass = nightEmitter(
    new MeshPhysicalMaterial({
      color: 0xcfe9ed,
      depthWrite: false,
      metalness: 0.03,
      opacity: HAUPTBAHNHOF_GLASS_DAY_OPACITY,
      roughness: 0.1,
      side: DoubleSide,
      transparent: true,
      transmission: 0.34,
    }),
    0xaedfff,
    1.1,
  );
  const xLocalInGroup = endLongitudinal + offsetLongitudinal;
  const bow = roofBowOffset(xLocalInGroup, curve);
  // Local tangent slope of the bow curve at this end -- dz/dx for "rail",
  // zero for "none" -- so the portal plane is perpendicular to the rails
  // themselves, not to the shed's construction axis.
  const tangentSlope =
    curve === "none"
      ? 0
      : 2 * HAUPTBAHNHOF_RAIL_CURVE_A * xLocalInGroup +
        HAUPTBAHNHOF_RAIL_CURVE_B;
  const tangentAngle = Math.atan(tangentSlope);
  const shapePoints = 33;
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  for (let index = 0; index <= shapePoints; index += 1) {
    const angle = (index / shapePoints) * Math.PI;
    shape.lineTo(Math.cos(angle) * (width / 2), Math.sin(angle) * height);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const portal = new Mesh(new ShapeGeometry(shape), glass);
  portal.name = name;
  const longitudinalPos = endLongitudinal + outward * 0.35;
  if (alongX) {
    portal.position.set(longitudinalPos, baseY + 0.18, bow);
    portal.rotation.y = Math.PI / 2 - tangentAngle;
  } else {
    portal.position.set(bow, baseY + 0.18, longitudinalPos);
    portal.rotation.y = -tangentAngle;
  }
  portal.renderOrder = 6;
  group.add(portal);
  addEdges(group, portal, 0.55);
}

/**
 * The end support (Auflager) that carries the barrel roof's end portal
 * down onto the elevated viaduct deck: without it the shed reads as
 * floating free past its last rib, which is exactly the "wuerde
 * abstuerzen" (over the Humboldthafen, on the west end) complaint from
 * the reference screenshot. Twin steel piers sit under the portal's own
 * rim, one on each side of the track bundle, following the same lateral
 * bow as the roof so they land under the arch instead of beside it.
 */
function addBarrelRoofEndSupport(
  group: Group,
  name: string,
  endLongitudinal: number,
  width: number,
  height: number,
  baseY: number,
  deckTopY: number,
  alongX: boolean,
  offsetLongitudinal: number,
  curve: RoofCurve,
): void {
  const steel = modelMaterial(0x47616d, { metalness: 0.66, roughness: 0.28 });
  const xLocalInGroup = endLongitudinal + offsetLongitudinal;
  const bow = roofBowOffset(xLocalInGroup, curve);
  const pierHeight = Math.max(0.5, baseY - deckTopY);
  const pierCentreY = deckTopY + pierHeight / 2;
  for (const side of [-1, 1]) {
    const lateral = bow + side * (width / 2 - 1.2);
    const position: [number, number, number] = alongX
      ? [endLongitudinal, pierCentreY, lateral]
      : [lateral, pierCentreY, endLongitudinal];
    addBox(group, name, [1.4, pierHeight, 1.4], position, steel, 0.5);
  }
  // A horizontal transom along the portal's own foot ties the two piers
  // together and gives the glazed gable something to visibly rest on.
  const beamLength = width - 1.6;
  const beamPosition: [number, number, number] = alongX
    ? [endLongitudinal, baseY - 0.1, bow]
    : [bow, baseY - 0.1, endLongitudinal];
  const beam = addBox(
    group,
    `${name} transom`,
    alongX ? [1.1, 0.7, beamLength] : [beamLength, 0.7, 1.1],
    beamPosition,
    steel,
    0.5,
  );
  beam.rotation.y = 0;
}

/**
 * An escalator that reads as a PATH into the depth, not as a tilted plank:
 * the inclined band carries transverse step ridges, both sides get a glass
 * balustrade with a dark handrail line above it, and each end lands on a
 * short horizontal comb plate. All of it is presentation geometry — the
 * point is that the eye can follow the descent from the daylight slot down
 * to the deep platforms ("Rolltreppenwege in die Tiefe").
 */
function addEscalatorRun(
  group: Group,
  name: string,
  from: [number, number, number],
  to: [number, number, number],
  width: number,
  material: MeshStandardMaterial,
): void {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const run = Math.hypot(dx, dy, dz);
  if (run < 0.5) {
    return;
  }
  const centre: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ];
  const carrier = new Group();
  carrier.name = name;
  carrier.position.set(...centre);
  // Point the carrier's local +Z along the run. A flight may also drift
  // sideways (the deep flight walks outward to land on its platform), so
  // the full 3D direction is used, not just the y/z tilt.
  carrier.quaternion.setFromUnitVectors(
    new Vector3(0, 0, 1),
    new Vector3(dx, dy, dz).normalize(),
  );

  const band = new Mesh(new BoxGeometry(width, 0.55, run), material);
  band.name = `${name} band`;
  band.castShadow = true;
  band.receiveShadow = true;
  carrier.add(band);
  addEdges(carrier, band, 0.4);

  // Step ridges across the band: one thin bar roughly every 1.1 m of run.
  const stepMaterial = modelMaterial(0x6d7a80, {
    metalness: 0.42,
    roughness: 0.5,
  });
  const ridges: InstanceTransform[] = [];
  const ridgeCount = Math.max(4, Math.floor(run / 1.1));
  for (let index = 1; index < ridgeCount; index += 1) {
    ridges.push({
      position: [0, 0.31, -run / 2 + (index / ridgeCount) * run],
    });
  }
  addInstancedBoxes(
    carrier,
    `${name} instanced step ridges`,
    [width - 0.3, 0.09, 0.16],
    stepMaterial,
    ridges,
  );

  // Glass balustrades with a dark handrail on top, one per side.
  const balustrade = modelMaterial(0xbcd8de, {
    metalness: 0.2,
    opacity: 0.5,
    roughness: 0.25,
  });
  balustrade.transparent = true;
  const handrail = modelMaterial(0x2e3538, { roughness: 0.6 });
  for (const side of [-1, 1]) {
    addBox(
      carrier,
      `${name} glass balustrade`,
      [0.08, 1.05, run - 0.3],
      [side * (width / 2 + 0.04), 0.75, 0],
      balustrade,
      0.25,
    );
    addBox(
      carrier,
      `${name} handrail`,
      [0.14, 0.12, run - 0.2],
      [side * (width / 2 + 0.04), 1.34, 0],
      handrail,
    );
  }
  group.add(carrier);

  // Comb plates: short horizontal landings at both ends, extending past
  // the run, so it visibly docks onto its floor instead of knifing
  // through it.
  const zDirection = Math.sign(dz) || 1;
  addBox(
    group,
    `${name} upper comb plate`,
    [width + 0.5, 0.18, 2.2],
    [from[0], from[1] + 0.09, from[2] - zDirection * 1.0],
    material,
    0.3,
  );
  addBox(
    group,
    `${name} lower comb plate`,
    [width + 0.5, 0.18, 2.2],
    [to[0], to[1] + 0.09, to[2] + zDirection * 1.0],
    material,
    0.3,
  );
}

/**
 * What you see when you look down through the north–south hall's glass
 * barrel: not one enormous empty room, but four stacked levels.
 *
 * The real Hauptbahnhof is a Turmbahnhof — the Stadtbahn crosses the top,
 * the north–south main line runs 15 m under it at right angles, and the
 * concourse levels in between are galleries with a long slot down the
 * middle so daylight reaches the deep platforms. Only that slot is drawn
 * out: the levels are flat plates with an open centre, joined by escalator
 * bands. It is an indication, not a model of the interior.
 *
 * The plates live in the two arms of the north–south hall, north and south
 * of the crossing, because that is the only place the barrel roof is not
 * covered by the opaque upper track deck — everywhere else you could not
 * see them anyway.
 */
function addStationInterior(
  group: Group,
  signature: HauptbahnhofModelSignature,
): void {
  const slab = modelMaterial(0xb4b8b2, { roughness: 0.9 });
  const platform = modelMaterial(0xa7b0ad, { roughness: 0.84 });
  const escalator = modelMaterial(0x8b9aa1, { metalness: 0.5, roughness: 0.4 });
  const deepRail = modelMaterial(0x74868b, {
    metalness: 0.78,
    roughness: 0.26,
  });
  const retailGlass = nightEmitter(
    modelMaterial(0x6f949c, {
      metalness: 0.08,
      opacity: 0.58,
      roughness: 0.28,
    }),
    0xffd49a,
    0.62,
  );

  const halfWidth = signature.north_south_hall_width_m / 2 - 1;
  const halfLength = signature.north_south_hall_length_m / 2 - 2;
  // The upper track deck covers the crossing, so the arms start beyond it.
  const armNear = signature.east_west_roof_width_m / 2;
  // Real levels: gallery +1, concourse, gallery −1, deep platforms at −15.
  const levels = [
    { openHalf: 7.5, y: 4.6 },
    { openHalf: 9.5, y: 0 },
    { openHalf: 12, y: -5.4 },
  ];
  const storefronts: InstanceTransform[] = [];
  const galleryRailSegments: VectorSegment[] = [];

  for (const side of [-1, 1]) {
    const near = side * armNear;
    const far = side * halfLength;
    for (const level of levels) {
      for (const edge of [-1, 1]) {
        const inner = edge * level.openHalf;
        const outer = edge * halfWidth;
        addBox(
          group,
          "Hauptbahnhof concourse gallery slab",
          [Math.abs(outer - inner), 0.5, Math.abs(far - near)],
          [(inner + outer) / 2, level.y, (near + far) / 2],
          slab,
          0.45,
        );
      }
      const armStart = Math.min(Math.abs(near), Math.abs(far));
      const armEnd = Math.max(Math.abs(near), Math.abs(far));
      for (let index = 0; index < 5; index += 1) {
        const z =
          side *
          (armStart + 8 + (index / 4) * Math.max(0, armEnd - armStart - 16));
        for (const edge of [-1, 1]) {
          storefronts.push({
            position: [edge * (halfWidth - 0.45), level.y + 1.75, z],
            scale: [1, 1, 1],
          });
        }
      }
      for (const edge of [-1, 1]) {
        galleryRailSegments.push([
          [edge * level.openHalf, level.y + 0.9, near],
          [edge * level.openHalf, level.y + 0.9, far],
        ]);
      }
    }
    // Two escalator runs per gap, flanking the slot the way the real ones do.
    const gaps: Array<[number, number]> = [
      [4.6, 0],
      [0, -5.4],
      [-5.4, -15],
    ];
    gaps.forEach(([top, bottom], index) => {
      const zTop = side * (armNear + 14 + index * 21);
      const zBottom = zTop + side * (top - bottom) * 1.9;
      // The gallery flights criss-cross the daylight slot; the deepest
      // flight must LAND ON the inner island platforms (centres ±9.5 m),
      // not between them on a track. So its lower end walks outward.
      const landsOnPlatform = bottom <= -14;
      for (const edge of [-1, 1]) {
        addEscalatorRun(
          group,
          "Hauptbahnhof escalator run",
          [edge * 5.2, top, zTop],
          [edge * (landsOnPlatform ? 9.5 : 5.2), bottom, zBottom],
          2.4,
          escalator,
        );
      }
    });
  }
  addInstancedBoxes(
    group,
    "Hauptbahnhof instanced concourse shopfronts",
    [0.28, 3.5, 11.5],
    retailGlass,
    storefronts,
  );
  addVectorSegments(
    group,
    "Hauptbahnhof batched gallery glass balustrades",
    galleryRailSegments,
    0x7c999f,
    0.54,
  );

  // The station's four panoramic lifts are cylindrical glazed shafts, not
  // opaque square towers. A light four-post frame keeps each cylinder legible
  // through the hall without creating another dense transparent layer.
  const liftFrames: InstanceTransform[] = [];
  for (const x of [-14.8, 14.8]) {
    for (const z of [-33, 33]) {
      const shaft = new Mesh(
        new CylinderGeometry(1.72, 1.72, 23.5, 20, 1, true),
        retailGlass,
      );
      shaft.name = "Hauptbahnhof cylindrical glass lift shaft";
      shaft.position.set(x, -2.25, z);
      shaft.castShadow = false;
      shaft.receiveShadow = true;
      shaft.userData.sourceUrl =
        "https://www.deutschebahn.com/de/architektur_bahnhof-6878040";
      group.add(shaft);
      for (const [dx, dz] of [
        [-1.48, 0],
        [1.48, 0],
        [0, -1.48],
        [0, 1.48],
      ] as Array<[number, number]>) {
        liftFrames.push({ position: [x + dx, -2.25, z + dz] });
      }
      addBox(
        group,
        "Hauptbahnhof lift car",
        [2.35, 3.15, 2.35],
        [x, z > 0 ? 1.4 : -8.6, z],
        escalator,
        0.2,
      );
    }
  }
  addInstancedBoxes(
    group,
    "Hauptbahnhof instanced cylindrical lift frames",
    [0.12, 23.5, 0.12],
    escalator,
    liftFrames,
  );

  // The north–south deep station, crossing under the Stadtbahn at −15 m.
  //
  // Berlin Hbf's lower level carries EIGHT tracks at four island
  // platforms (Gleis 1–8), not the three tracks this used to draw. The
  // deep box is also wider than the hall standing on it — the station box
  // continues past the north–south hall's 42 m underground — so the layout
  // is built from the real module (island platform between two tracks)
  // rather than squeezed into the hall's footprint. Reference-based
  // presentation geometry for an interior nobody surveyed, exactly like
  // the galleries above it.
  const PLATFORM_W = 9.6;
  const TRACK_W = 4.7;
  const MODULE = PLATFORM_W + 2 * TRACK_W;
  const ISLANDS = 4;
  const deepWidth = ISLANDS * MODULE;
  const deepLength = signature.north_south_hall_length_m;
  addBox(
    group,
    "Hauptbahnhof deep-level platform floor",
    [deepWidth, 0.6, deepLength],
    [0, -15.3, 0],
    slab,
    0.4,
  );
  const platformCentres: number[] = [];
  const trackCentres: number[] = [];
  for (let island = 0; island < ISLANDS; island += 1) {
    const centre = (island - (ISLANDS - 1) / 2) * MODULE;
    platformCentres.push(centre);
    trackCentres.push(centre - (PLATFORM_W + TRACK_W) / 2);
    trackCentres.push(centre + (PLATFORM_W + TRACK_W) / 2);
  }
  for (const platformX of platformCentres) {
    addBox(
      group,
      "Hauptbahnhof deep-level island platform",
      [PLATFORM_W, 0.95, deepLength - 12],
      [platformX, -14.53, 0],
      platform,
      0.35,
    );
  }
  for (const trackX of trackCentres) {
    addBox(
      group,
      "Hauptbahnhof deep-level ballast",
      [TRACK_W - 0.5, 0.3, deepLength - 8],
      [trackX, -15.15, 0],
      slab,
      0.25,
    );
    for (const railOffset of [-0.72, 0.72]) {
      addBox(
        group,
        "Hauptbahnhof deep-level rail",
        [0.14, 0.16, deepLength - 8],
        [trackX + railOffset, -14.9, 0],
        deepRail,
      );
    }
  }
  // The tunnel box: side walls and the ceiling the concourse stands on, so
  // the deep level reads as a room under the city rather than a floating
  // slab. The centre slot stays open — that is the void you look down.
  const wall = modelMaterial(0x9aa19c, { roughness: 0.92 });
  for (const side of [-1, 1]) {
    addBox(
      group,
      "Hauptbahnhof deep-level box wall",
      [1.2, 9.4, deepLength],
      [side * (deepWidth / 2 + 0.6), -10.9, 0],
      wall,
      0.3,
    );
  }
  // Trains standing at the deep platforms, arriving FROM THE NORTH through
  // the tunnel. The two innermost tracks are the ones visible through the
  // daylight slot, so those are the ones that carry stock.
  const deepRailTopY = -14.82;
  const innerTracks = trackCentres
    .slice()
    .sort((left, right) => Math.abs(left) - Math.abs(right))
    .slice(0, 2);
  innerTracks.forEach((trackX, index) => {
    addStationTrain(
      group,
      {
        bodyColor: 0xf2f3f0,
        length: 96,
        name: `Hauptbahnhof deep-level ICE ${index + 1}`,
        // A train on the deep level runs NORTH–SOUTH, i.e. along the
        // model's local Z, so it is built along X and turned a quarter.
        northSouth: true,
        stripeColor: 0xc4123a,
        windowColor: 0x4c6f7a,
        x: trackX,
        z: index === 0 ? -18 : 22,
      },
      deepRailTopY,
    );
  });
}

function addStationOfficeBridge(
  group: Group,
  x: number,
  depth: number,
  height: number,
): void {
  // Step 39 (v0.56): the real Bugelbauten are glass-and-aluminium office
  // bars, not grey concrete blocks -- the user's exact complaint about
  // v0.55 was the opaque grey roof cap reading as a flat box dropped on
  // top of the glass hall. Every surface of this tower, including its
  // roof, is now the same transparent hellblau (light blue) glass family
  // as the barrel-vault roofs, so nothing here can read as an opaque
  // grey mass in the render. Only the mullions/frame stay solid metal --
  // thin structural members, not a cladding panel.
  const width = 19;
  const glass = nightEmitter(
    modelMaterial(0xa7ccd3, {
      metalness: 0.08,
      opacity: HAUPTBAHNHOF_GLASS_DAY_OPACITY,
      roughness: 0.25,
    }),
    0xffdca0,
    0.72,
  );
  const roofGlass = nightEmitter(
    modelMaterial(0xcfe9ed, {
      metalness: 0.05,
      opacity: HAUPTBAHNHOF_GLASS_DAY_OPACITY,
      roughness: 0.12,
    }),
    0xaedfff,
    0.9,
  );
  const frame = modelMaterial(0x758b92, {
    metalness: 0.42,
    roughness: 0.38,
  });

  const towerBox = addBox(
    group,
    "Hauptbahnhof 46 m office bridge",
    [width, height, depth],
    [x, height / 2, 0],
    glass,
  );
  addEdges(group, towerBox, 0.55);

  // Flat roof cap, drawn flush with the tower's own footprint (not a
  // wider, independently-drawn slab) so it cannot visually detach from
  // the body beneath it the way the old oversized outline did -- and, as
  // of v0.56, glazed rather than opaque, matching the real all-glass
  // Bugelbau envelope.
  const roofCap = addBox(
    group,
    "Hauptbahnhof office-bridge roof cap",
    [width + 0.6, 0.5, depth + 0.6],
    [x, height + 0.25, 0],
    roofGlass,
  );
  addEdges(group, roofCap, 0.4);

  const storeyHeight = height / 10;
  for (let storey = 1; storey < 10; storey += 1) {
    addBoxOutline(
      group,
      "Hauptbahnhof office-bridge floor line",
      [width + 0.08, 0.32, depth],
      [x, storey * storeyHeight, 0],
      0.3,
      0x769da7,
    );
  }
  const mullionCount = Math.max(18, Math.round(depth / 6));
  const mullions: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index <= mullionCount; index += 1) {
      mullions.push({
        position: [
          x + (side * width) / 2,
          height / 2,
          -depth / 2 + (index / mullionCount) * depth,
        ],
      });
    }
  }
  addInstancedBoxes(
    group,
    "Hauptbahnhof instanced office-bridge facade mullions",
    [0.24, height - 0.6, 0.28],
    frame,
    mullions,
  );

  const panelSeams: VectorSegment[] = [];
  for (const side of [-1, 1]) {
    const faceX = x + (side * width) / 2 + side * 0.02;
    for (let y = storeyHeight / 2; y < height; y += storeyHeight / 2) {
      panelSeams.push([
        [faceX, y, -depth / 2],
        [faceX, y, depth / 2],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Hauptbahnhof batched office-bridge curtain-wall seams",
    panelSeams,
    0x9bc6cf,
    HAUPTBAHNHOF_GLASS_GRID_OPACITY,
  );

  // Washingtonplatz and Europaplatz look directly at the narrow ends of the
  // two Buegelbauten. Give those end faces the same ten-storey curtain-wall
  // order as their long sides instead of leaving two blank glass slabs.
  const endFacadeGrid: VectorSegment[] = [];
  const endBayCount = 5;
  for (const zSide of [-1, 1]) {
    const faceZ = zSide * (depth / 2 + 0.03);
    for (let bay = 0; bay <= endBayCount; bay += 1) {
      const faceX = x - width / 2 + (bay / endBayCount) * width;
      endFacadeGrid.push([
        [faceX, 0.35, faceZ],
        [faceX, height - 0.35, faceZ],
      ]);
    }
    for (let storey = 1; storey < 10; storey += 1) {
      endFacadeGrid.push([
        [x - width / 2, storey * storeyHeight, faceZ],
        [x + width / 2, storey * storeyHeight, faceZ],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Hauptbahnhof batched office-bridge end-facade grid",
    endFacadeGrid,
    0x7799a1,
    HAUPTBAHNHOF_GLASS_GRID_OPACITY,
  );
}

/**
 * The north-south hall's two gable ends -- Europaplatz to the north,
 * Washingtonplatz to the south -- are not blank barrel-vault end caps in
 * the real station: they are dedicated cable-and-glass curtain-wall
 * entrance facades (see baunetzwissen's writeup of the two entrance
 * facades). This draws a flat glazed screen filling the gable, with a
 * simple mullion grid, in the same light-blue glass family as the rest
 * of the envelope -- an explicit "Eingangsfront", not just the barrel's
 * open end.
 */
function addStationHallEntranceFacade(
  group: Group,
  z: number,
  hallWidth: number,
  hallHeight: number,
  name: string,
): void {
  const glass = nightEmitter(
    new MeshPhysicalMaterial({
      color: 0xcfe9ed,
      depthWrite: false,
      metalness: 0.04,
      opacity: HAUPTBAHNHOF_GLASS_DAY_OPACITY,
      roughness: 0.1,
      side: DoubleSide,
      transparent: true,
      transmission: 0.4,
    }),
    0xaedfff,
    1.15,
  );
  const frame = modelMaterial(0x728a91, { metalness: 0.4, roughness: 0.36 });

  const facadeWidth = hallWidth - 1.2;
  const facadeHeight = hallHeight - 0.6;
  const facade = new Mesh(
    new PlaneGeometry(facadeWidth, facadeHeight, 1, 1),
    glass,
  );
  facade.name = name;
  facade.position.set(0, facadeHeight / 2, z);
  facade.renderOrder = 6;
  group.add(facade);
  addEdges(group, facade, 0.5);

  const mullions: InstanceTransform[] = [];
  const verticalCount = Math.max(8, Math.round(facadeWidth / 2.45));
  for (let index = 0; index <= verticalCount; index += 1) {
    mullions.push({
      position: [
        -facadeWidth / 2 + (index / verticalCount) * facadeWidth,
        facadeHeight / 2,
        z,
      ],
      scale: [1, facadeHeight, 1],
    });
  }
  const horizontalCount = Math.max(6, Math.round(facadeHeight / 1.54));
  for (let index = 0; index <= horizontalCount; index += 1) {
    mullions.push({
      position: [0, (index / horizontalCount) * facadeHeight, z],
      scale: [facadeWidth / 0.16, 1, 1],
    });
  }
  addInstancedBoxes(
    group,
    `${name} instanced mullions`,
    [0.16, 0.16, 0.14],
    frame,
    mullions,
  );
}

function addStationTrain(
  group: Group,
  options: {
    bodyColor: number;
    length: number;
    name: string;
    /** Runs along the model's local Z (the north–south hall) instead of X. */
    northSouth?: boolean;
    stripeColor: number;
    windowColor: number;
    x: number;
    z: number;
  },
  // The station model's own local upper-level rail sits at y=10.48; every
  // absolute height below is expressed as an offset from that so the same
  // train can be rebuilt on a different rail-top height (e.g. the real
  // OSM corridor's world-space rail top) without retuning each number.
  railTopY = 10.48,
): void {
  // A north–south train is built along the local X axis like every other,
  // then the finished vehicle is turned a quarter turn and moved onto its
  // track. Building it twice in two axes would mean two copies of every
  // window, door and bogie to keep in step.
  const host = options.northSouth ? new Group() : group;
  const railY = options.northSouth ? 0 : railTopY;
  const originX = options.northSouth ? 0 : options.x;
  const originZ = options.northSouth ? 0 : options.z;
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
  body.position.set(originX, railY + 2.67, originZ);
  body.castShadow = true;
  group.add(body);
  addBox(
    host,
    `${options.name} colour stripe`,
    [options.length - 4.6, 0.34, 3.05],
    [originX, railY + 2.07, originZ],
    stripeMaterial,
  );
  addBox(
    host,
    `${options.name} dark roof equipment`,
    [options.length * 0.46, 0.18, 1.72],
    [originX, railY + 4.27, originZ],
    windowMaterial,
  );

  const windowCount = Math.max(8, Math.floor(options.length / 9));
  const windows: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < windowCount; index += 1) {
      const windowX =
        -options.length / 2 +
        5.5 +
        (index / (windowCount - 1)) * (options.length - 11);
      windows.push({
        position: [originX + windowX, railY + 3.07, originZ + side * 1.5],
      });
    }
  }
  addInstancedBoxes(
    host,
    `${options.name} instanced side windows`,
    [4.4, 0.88, 0.08],
    windowMaterial,
    windows,
  );

  const doorCount = Math.max(3, Math.round(options.length / 28));
  const doors: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 1; index <= doorCount; index += 1) {
      doors.push({
        position: [
          originX -
            options.length / 2 +
            (index / (doorCount + 1)) * options.length,
          railY + 2.57,
          originZ + side * 1.56,
        ],
      });
    }
  }
  addInstancedBoxes(
    host,
    `${options.name} instanced passenger doors`,
    [1.18, 2.05, 0.08],
    windowMaterial,
    doors,
  );

  const wheelMaterial = modelMaterial(0x20272a, {
    metalness: 0.56,
    roughness: 0.5,
  });
  const wheels: InstanceTransform[] = [];
  for (const fraction of [0.16, 0.34, 0.66, 0.84]) {
    for (const side of [-1, 1]) {
      wheels.push({
        position: [
          originX - options.length / 2 + fraction * options.length,
          railY + 0.56,
          originZ + side * 1.58,
        ],
        rotation: [Math.PI / 2, 0, 0],
      });
    }
  }
  addInstancedGeometry(
    host,
    `${options.name} instanced wheels`,
    new CylinderGeometry(0.48, 0.48, 0.18, 16),
    wheelMaterial,
    wheels,
  );

  const carriageSeams: VectorSegment[] = [];
  const carriageCount = Math.max(3, Math.round(options.length / 25));
  for (let index = 1; index < carriageCount; index += 1) {
    const seamX =
      originX - options.length / 2 + (index / carriageCount) * options.length;
    for (const side of [-1, 1]) {
      carriageSeams.push([
        [seamX, railY + 1.42, originZ + side * 1.6],
        [seamX, railY + 3.77, originZ + side * 1.6],
      ]);
    }
  }
  addVectorSegments(
    host,
    `${options.name} batched carriage joints`,
    carriageSeams,
    0x39494d,
    0.72,
  );
  for (const end of [-1, 1]) {
    addBox(
      host,
      `${options.name} cab windscreen`,
      [0.1, 0.9, 1.9],
      [originX + end * (options.length / 2 - 0.72), railY + 3.18, originZ],
      windowMaterial,
    );
    // A driving car is not a tube cut off square. Three stacked slices of
    // decreasing width and height give the power car its raked nose, which
    // is what makes the vehicle read as a solid body end-on instead of the
    // flat disc a bare capsule cap shows ("die Züge … das ist zu platt").
    const noseSlices: Array<[number, number, number, number]> = [
      [0.9, 2.86, 2.5, 0.15],
      [2.0, 2.5, 2.0, 0.62],
      [2.9, 1.9, 1.35, 1.05],
    ];
    for (const [inset, width, height, drop] of noseSlices) {
      addBox(
        host,
        `${options.name} raked nose`,
        [0.9, height, width],
        [
          originX + end * (options.length / 2 - inset),
          railY + 2.72 - drop / 2,
          originZ,
        ],
        bodyMaterial,
        0.35,
      );
    }
  }
  // Roof pantographs: the one piece of a mainline train that unmistakably
  // reads as three-dimensional from above, which is exactly the angle an
  // isometric drawing shows.
  for (const fraction of [0.3, 0.72]) {
    const pantographX =
      originX - options.length / 2 + fraction * options.length;
    addBox(
      host,
      `${options.name} pantograph base`,
      [2.6, 0.22, 2.1],
      [pantographX, railY + 4.36, originZ],
      wheelMaterial,
    );
    addVectorSegments(
      host,
      `${options.name} pantograph arms`,
      [
        [
          [pantographX - 1.1, railY + 4.45, originZ],
          [pantographX + 0.5, railY + 5.55, originZ],
        ],
        [
          [pantographX + 1.1, railY + 4.45, originZ],
          [pantographX + 0.5, railY + 5.55, originZ],
        ],
      ],
      0x2b3438,
      1.4,
    );
    addBox(
      host,
      `${options.name} pantograph contact strip`,
      [0.24, 0.1, 1.9],
      [pantographX + 0.5, railY + 5.6, originZ],
      wheelMaterial,
    );
  }

  if (options.northSouth) {
    host.rotation.y = Math.PI / 2;
    host.position.set(options.x, railTopY, options.z);
    host.name = options.name;
    group.add(host);
  }
}

/**
 * Where the Hauptbahnhof model itself is anchored (see the
 * "hauptbahnhof-model" architectural signature in scene.json). The ICE
 * must sit on a real rail run near here, not just on whichever OSM
 * polyline happens to be longest somewhere else in the quarter.
 */
export const HAUPTBAHNHOF_ANCHOR_WORLD: readonly [number, number] = [
  -119.936, -683.307,
];
// scene.json's "hauptbahnhof-model" signature rotation_y_degrees -- the
// same transform `placeMetricGroup` applies to this model group, needed
// by tests that must convert a world-space rail-lines.json point into
// this model's local (unrotated) frame to check the curvature contract.
export const HAUPTBAHNHOF_ROTATION_Y_DEGREES = 21.82;

/**
 * Places the stationary ICE on a real rail centreline instead of the
 * station model's own local deck. The old placement stood the train on a
 * stub track that ran off the model's east gable and pointed at open air
 * over the Humboldthafen; this builds the same train geometry as
 * `addStationTrain` but as a standalone world-space group, positioned and
 * yawed to sit tangent to a real `viaduct_tracks` polyline from
 * `rail-lines.json`, on the run that actually passes the station.
 *
 * Exported so `ThreeViewer.tsx` can add it straight to `isoWorld`, in the
 * same world-space frame as `createRailNetwork`'s deck and rails, rather
 * than nesting it inside the rotated/translated Hauptbahnhof model group.
 */
export function createIceOnRails(rail: {
  deck_top_y_m: number;
  rail_top_over_deck_m: number;
  viaduct_tracks: number[][][];
}): Group | null {
  const placement = findIceTrackPlacement(
    rail.viaduct_tracks,
    126,
    HAUPTBAHNHOF_ANCHOR_WORLD,
  );
  if (!placement) {
    return null;
  }
  const group = new Group();
  group.name = "Hauptbahnhof stationary ICE (on real rails)";
  group.position.set(placement.x, 0, placement.z);
  group.rotation.y = placement.rotationY;
  const railTopY = rail.deck_top_y_m + rail.rail_top_over_deck_m;
  addStationTrain(
    group,
    {
      bodyColor: 0xf1f2ef,
      length: 126,
      name: "Hauptbahnhof stationary ICE",
      stripeColor: 0xd63d3d,
      windowColor: 0x4c7480,
      x: 0,
      z: 0,
    },
    railTopY,
  );
  return group;
}

/**
 * Finds the `viaduct_tracks` polyline that actually passes closest to
 * `anchor`, then a run of `length` metres centred on the point of closest
 * approach, and returns that run's midpoint plus tangent heading, all in
 * world metres. Tracks that never come within `MAX_ANCHOR_DISTANCE_M` of
 * the anchor are ignored, so a long polyline elsewhere in the quarter can
 * never outrank the short run that is actually under the station roof.
 */
const MAX_ANCHOR_DISTANCE_M = 60;

function findIceTrackPlacement(
  tracks: number[][][],
  length: number,
  anchor: readonly [number, number],
): { rotationY: number; x: number; z: number } | null {
  let best: {
    anchorDistance: number;
    x: number;
    z: number;
    rotationY: number;
  } | null = null;
  for (const track of tracks) {
    const points = track.map(([x, z]) => [x / 10, z / 10] as [number, number]);
    if (points.length < 2) {
      continue;
    }
    const cumulative = [0];
    for (let index = 1; index < points.length; index += 1) {
      const [x0, z0] = points[index - 1];
      const [x1, z1] = points[index];
      cumulative.push(cumulative[index - 1] + Math.hypot(x1 - x0, z1 - z0));
    }
    const total = cumulative[cumulative.length - 1];

    // Distance from the anchor to the closest point on this polyline, and
    // the arclength at which that closest approach happens.
    let closestDistance = Infinity;
    let closestArclength = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x0, z0] = points[index];
      const [x1, z1] = points[index + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const segLenSq = dx * dx + dz * dz;
      const t =
        segLenSq > 0
          ? Math.max(
              0,
              Math.min(
                1,
                ((anchor[0] - x0) * dx + (anchor[1] - z0) * dz) / segLenSq,
              ),
            )
          : 0;
      const cx = x0 + t * dx;
      const cz = z0 + t * dz;
      const distance = Math.hypot(anchor[0] - cx, anchor[1] - cz);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestArclength = cumulative[index] + t * Math.hypot(dx, dz);
      }
    }
    if (closestDistance > MAX_ANCHOR_DISTANCE_M) {
      continue;
    }
    if (best !== null && closestDistance >= best.anchorDistance) {
      continue;
    }

    const targetStart = Math.max(
      0,
      Math.min(total - length, closestArclength - length / 2),
    );
    const targetEnd = Math.min(total, targetStart + length);
    const start = pointAtDistance(points, cumulative, targetStart);
    const end = pointAtDistance(points, cumulative, targetEnd);
    const midX = (start.x + end.x) / 2;
    const midZ = (start.z + end.z) / 2;
    // Three.js's RotationY(theta) matrix maps a local +X axis (1, 0, 0)
    // to world direction (cos(theta), -sin(theta)) in (x, z). Solving
    // cos(theta) = dx/|d| and -sin(theta) = dz/|d| for theta gives
    // atan2(-dz, dx) -- so the train's local length axis (+X, per
    // addStationTrain) ends up tangent to the (dx, dz) run direction.
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const rotationY = Math.atan2(-dz, dx);
    best = { anchorDistance: closestDistance, x: midX, z: midZ, rotationY };
  }
  return best;
}

/** Walks a polyline's cumulative-arclength table to the point at `distance`. */
function pointAtDistance(
  points: Array<[number, number]>,
  cumulative: number[],
  distance: number,
): { x: number; z: number } {
  const clamped = Math.max(
    0,
    Math.min(cumulative[cumulative.length - 1], distance),
  );
  let index = 1;
  while (index < cumulative.length && cumulative[index] < clamped) {
    index += 1;
  }
  index = Math.min(index, cumulative.length - 1);
  const segStart = cumulative[index - 1];
  const segEnd = cumulative[index];
  const t = segEnd > segStart ? (clamped - segStart) / (segEnd - segStart) : 0;
  const [x0, z0] = points[index - 1];
  const [x1, z1] = points[index];
  return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t };
}

function createHauptbahnhofModel(signature: HauptbahnhofModelSignature): Group {
  const group = new Group();
  group.name = "Metre-scale Berlin Hauptbahnhof recognition model";
  placeMetricGroup(group, signature);

  const deck = modelMaterial(0x42545b, { metalness: 0.34, roughness: 0.7 });
  const rail = modelMaterial(0x74868b, { metalness: 0.78, roughness: 0.26 });
  const platform = modelMaterial(0xaeb7b4, { roughness: 0.82 });
  // The approach is straight only to the west, where the model deck stays
  // within 6 m of the OSM alignment for its whole 110 m. Eastwards the
  // Stadtbahn curves away towards Friedrichstraße — a straight stub was 46 m
  // off the real tracks after 200 m and 84 m off at its tip, pointing at
  // empty air over the Humboldthafen. So the deck now ends at the east
  // gable and the OSM-derived viaduct carries the tracks on from there.
  // signature.east_west_roof_length_m is the official Hauptbahnhof
  // 321 m east-west glass roof (scene.json / Deutsche Bahn figures); the
  // rendered deck below extends a further 110 m west to carry the model's
  // straight OSM-aligned approach, so trackLength (431 m) is the combined
  // rendered span, not the official figure itself.
  const trackWestX = -(signature.east_west_roof_length_m / 2 + 110);
  const trackEastX = signature.east_west_roof_length_m / 2;
  const trackLength = trackEastX - trackWestX;
  const trackCentreX = (trackWestX + trackEastX) / 2;
  // v0.56: the user's exact complaint was that the glass tube must bend
  // WITH the real track curve, not sit over a dead-straight deck with
  // only the roof bowed on top. So the elevated deck, its ballast beds,
  // rails and sleepers are now built from short straight sub-segments
  // that each shift sideways by the same real rail-curve offset
  // (railCurveOffset, fit from rail-lines.json) as the glass roof above
  // them -- deck and roof bend together, matching the reference aerials.
  const deckSteps = Math.max(24, Math.round(trackLength / 12));
  const deckSegments: Array<{
    x0: number;
    x1: number;
    z0: number;
    z1: number;
  }> = [];
  for (let step = 0; step < deckSteps; step += 1) {
    const x0 = trackWestX + (step / deckSteps) * trackLength;
    const x1 = trackWestX + ((step + 1) / deckSteps) * trackLength;
    deckSegments.push({
      x0,
      x1,
      z0: railCurveOffset(x0) - railCurveOffset(0),
      z1: railCurveOffset(x1) - railCurveOffset(0),
    });
  }
  const deckSegmentLength = trackLength / deckSteps;
  for (const { x0, x1, z0, z1 } of deckSegments) {
    const midX = (x0 + x1) / 2;
    const midZ = (z0 + z1) / 2;
    const yaw = Math.atan2(z1 - z0, x1 - x0);
    addBox(
      group,
      "Hauptbahnhof east-west elevated track deck",
      [deckSegmentLength * 1.02, 1.1, signature.east_west_roof_width_m - 3],
      [midX, 9.8, midZ],
      deck,
      0.5,
    ).rotation.y = -yaw;
  }
  for (const trackZ of [-12, -4, 4, 12]) {
    for (const { x0, x1, z0, z1 } of deckSegments) {
      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2 + trackZ;
      const yaw = Math.atan2(z1 - z0, x1 - x0);
      addBox(
        group,
        "Hauptbahnhof upper-level ballast bed",
        [deckSegmentLength * 1.02, 0.1, 3.45],
        [midX, 10.34, midZ],
        modelMaterial(0x6e706a, { roughness: 0.96 }),
      ).rotation.y = -yaw;
      for (const railOffset of [-0.76, 0.76]) {
        addBox(
          group,
          "Hauptbahnhof upper-level rail",
          [deckSegmentLength * 1.02, 0.16, 0.14],
          [midX, 10.48, midZ + railOffset],
          rail,
        ).rotation.y = -yaw;
      }
    }
  }
  const approachPiers: InstanceTransform[] = [];
  for (let x = trackWestX + 13; x <= trackEastX - 13; x += 26) {
    if (Math.abs(x) <= signature.east_west_roof_length_m / 2 - 18) {
      continue;
    }
    const curveZ = railCurveOffset(x) - railCurveOffset(0);
    for (const z of [-13, 13]) {
      approachPiers.push({ position: [x, 4.55, z + curveZ] });
    }
  }
  addInstancedBoxes(
    group,
    "Hauptbahnhof instanced approach-viaduct piers",
    [1.35, 9.1, 1.35],
    modelMaterial(0x8a9594, { roughness: 0.84 }),
    approachPiers,
  );
  const sleeperCount = Math.max(100, Math.round(trackLength / 2.5));
  const sleeperTransforms: InstanceTransform[] = [];
  for (const trackZ of [-12, -4, 4, 12]) {
    for (let index = 0; index <= sleeperCount; index += 1) {
      const sleeperX = trackWestX + (index / sleeperCount) * trackLength;
      const curveZ = railCurveOffset(sleeperX) - railCurveOffset(0);
      sleeperTransforms.push({
        position: [sleeperX, 10.39, trackZ + curveZ],
      });
    }
  }
  addInstancedBoxes(
    group,
    "Hauptbahnhof instanced upper-level track sleepers",
    [0.26, 0.12, 3.6],
    modelMaterial(0x554f48, { roughness: 0.86 }),
    sleeperTransforms,
  );
  const platformSteps = Math.max(20, Math.round(224 / 12));
  for (const platformZ of [-8, 8]) {
    for (let step = 0; step < platformSteps; step += 1) {
      const x0 = -112 + (step / platformSteps) * 224;
      const x1 = -112 + ((step + 1) / platformSteps) * 224;
      const z0 = railCurveOffset(x0) - railCurveOffset(0) + platformZ;
      const z1 = railCurveOffset(x1) - railCurveOffset(0) + platformZ;
      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2;
      const yaw = Math.atan2(z1 - z0, x1 - x0);
      addBox(
        group,
        "Hauptbahnhof upper platform",
        [(224 / platformSteps) * 1.02, 0.42, 4.3],
        [midX, 10.52, midZ],
        platform,
        0.25,
      ).rotation.y = -yaw;
    }
  }
  const platformJointSegments: VectorSegment[] = [];
  for (const platformZ of [-8, 8]) {
    for (let x = -108; x <= 108; x += 4) {
      const curveZ = railCurveOffset(x) - railCurveOffset(0);
      platformJointSegments.push([
        [x, 10.75, platformZ - 2.05 + curveZ],
        [x, 10.75, platformZ + 2.05 + curveZ],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Hauptbahnhof batched upper-platform paving joints",
    platformJointSegments,
    0x75817e,
    0.5,
  );
  // The stationary ICE used to live here, on this model's own synthetic
  // deck. Task 37 moves it into world space, riding the real OSM rail
  // corridor (see createIceOnRails in RailNetwork.ts) instead of a local
  // stub track that pointed off the east gable at the Humboldthafen.
  addStationTrain(group, {
    bodyColor: 0xe8c23d,
    length: 74,
    name: "Hauptbahnhof stationary Berlin S-Bahn",
    stripeColor: 0xb42f2f,
    windowColor: 0x567984,
    x: -155,
    z: 4,
  });
  addStationInterior(group, signature);
  // v0.56 ("Hbf ganz aus Glas"): the user's exact, literal complaint about
  // v0.55 was that (1) the east-west glass tube must bend WITH the real
  // track curve rather than run dead straight or with a synthetic
  // symmetric bow, and (2) the whole aboveground station is glass --
  // no grey boxes, no opaque roof caps, nothing doubled up. This single
  // continuous roof follows `railCurveOffset`, the quadratic fit to the
  // real Stadtbahn viaduct curve derived from rail-lines.json (see the
  // HAUPTBAHNHOF_RAIL_CURVE_A/B constants above) -- matching the
  // reference aerials (IMG_0180-83), which show one continuously curved
  // hall, not a straight tube with a cosmetic bow.
  //
  // v0.56.1 ("Glasdach-Enden"): the roof used to span `trackLength`
  // (431 m -- the rendered deck's full extent, including the 110 m
  // straight west approach stub) instead of the official
  // `east_west_roof_length_m` (321 m). That let the glazed tube run past
  // its own last rib with nothing holding it up, reading as cantilevered
  // free over the Humboldthafen at the west end and drifting off the rail
  // curve towards the east end -- exactly the user's screenshot complaint
  // on both ends. The roof itself must only cover the real 321 m shed,
  // centred on the station crossing (`offsetLongitudinal = 0`, the same
  // origin the rail-curve fit is anchored to), riding on the elevated
  // deck the approach still extends 110 m further west underneath. The
  // roof's own name keeps the rounded length so the curve-contract test
  // can keep asserting against it.
  const roofHalfLength = signature.east_west_roof_length_m / 2;
  addBarrelRoof(
    group,
    `Hauptbahnhof ${Math.round(signature.east_west_roof_length_m)} m east-west glass roof`,
    signature.east_west_roof_length_m,
    signature.east_west_roof_width_m,
    12.5,
    10.4,
    true,
    0,
    "rail",
  );
  // Each end of the 321 m shed gets a filled glazed gable, cut
  // perpendicular to the rail curve's own local tangent (not to the
  // shed's straight x-axis), plus twin steel piers and a transom tying
  // the gable down onto the elevated deck below -- the "Auflager auf dem
  // Viaduct" the roof was missing at both ends.
  addBarrelRoofEndPortal(
    group,
    "Hauptbahnhof west end portal",
    -roofHalfLength,
    signature.east_west_roof_width_m,
    12.5,
    10.4,
    true,
    0,
    "rail",
    -1,
  );
  addBarrelRoofEndPortal(
    group,
    "Hauptbahnhof east end portal",
    roofHalfLength,
    signature.east_west_roof_width_m,
    12.5,
    10.4,
    true,
    0,
    "rail",
    1,
  );
  addBarrelRoofEndSupport(
    group,
    "Hauptbahnhof west end portal support",
    -roofHalfLength,
    signature.east_west_roof_width_m,
    12.5,
    10.4,
    9.8,
    true,
    0,
    "rail",
  );
  addBarrelRoofEndSupport(
    group,
    "Hauptbahnhof east end portal support",
    roofHalfLength,
    signature.east_west_roof_width_m,
    12.5,
    10.4,
    9.8,
    true,
    0,
    "rail",
  );
  // The north-south crossing hall is built dead straight, square across
  // the east-west hall -- the real station's Europaplatz/Washingtonplatz
  // hall does not itself curve, only the east-west hall it crosses does.
  addBarrelRoof(
    group,
    `Hauptbahnhof ${Math.round(signature.north_south_hall_length_m)} m north-south hall`,
    signature.north_south_hall_length_m,
    signature.north_south_hall_width_m,
    19,
    8.2,
    false,
    0,
    "none",
  );
  addStationHallEntranceFacade(
    group,
    signature.north_south_hall_length_m / 2,
    signature.north_south_hall_width_m,
    19,
    "Hauptbahnhof Europaplatz entrance facade",
  );
  addStationHallEntranceFacade(
    group,
    -signature.north_south_hall_length_m / 2,
    signature.north_south_hall_width_m,
    19,
    "Hauptbahnhof Washingtonplatz entrance facade",
  );
  // Two parallel glass Bugelbauten (office bars, ~46 m/10 storeys) span
  // OVER the east-west hall, parallel to and flanking the north-south
  // hall -- exactly the reference aerials' layout (IMG_0180-83). Both
  // sit right at the east-west/north-south crossing (local x = 0), which
  // is also where the rail curve fit is anchored to zero, so no extra
  // lateral offset is needed here.
  const officeX = signature.north_south_hall_width_m / 2 + 14;
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

  const sandstone = nightEmitter(
    modelMaterial(0xd9c79f, { roughness: 0.84 }),
    0xf0c184,
    0.72,
  );
  const sandstoneShadow = nightEmitter(
    modelMaterial(0xbba77c, { roughness: 0.9 }),
    0x9a7650,
    0.46,
  );
  const recess = modelMaterial(0x4a4b45, { opacity: 0.74, roughness: 0.92 });
  const bronze = modelMaterial(0x2e826d, { metalness: 0.62, roughness: 0.38 });
  const passageInterior = new MeshStandardMaterial({
    color: 0x303633,
    roughness: 0.96,
    side: FrontSide,
  });
  const colonnadeWidth = 43;
  const columnCenters: Array<[number, number]> = [];
  for (let row = 0; row < signature.column_rows; row += 1) {
    const x = row === 0 ? -3.25 : 3.25;
    for (let index = 0; index < signature.columns_per_row; index += 1) {
      const z = -colonnadeWidth / 2 + (index / 5) * colonnadeWidth;
      columnCenters.push([x, z]);
      const column = new Mesh(
        new CylinderGeometry(1.05, 1.34, signature.column_height_m, 20),
        sandstone,
      );
      column.name = `Brandenburg Gate Doric column ${row + 1}:${index + 1}`;
      column.position.set(x, signature.column_height_m / 2, z);
      column.castShadow = true;
      group.add(column);
      const base = new Mesh(
        new CylinderGeometry(1.55, 1.68, 0.46, 20),
        sandstone,
      );
      base.name = `Brandenburg Gate column base ${row + 1}:${index + 1}`;
      base.position.set(x, 0.23, column.position.z);
      group.add(base);
      const capital = new Mesh(
        new CylinderGeometry(1.62, 1.16, 0.72, 20),
        sandstone,
      );
      capital.name = `Brandenburg Gate Doric capital ${row + 1}:${index + 1}`;
      capital.position.set(
        x,
        signature.column_height_m - 0.25,
        column.position.z,
      );
      group.add(capital);
    }
  }
  addInstancedBoxes(
    group,
    "Brandenburg Gate instanced Doric capital abaci",
    [2.8, 0.3, 2.8],
    sandstone,
    columnCenters.map(([x, z]) => ({
      position: [x, signature.column_height_m + 0.13, z],
    })),
  );
  const flutingSegments: VectorSegment[] = [];
  for (const [columnX, columnZ] of columnCenters) {
    for (let flute = 0; flute < 12; flute += 1) {
      const angle = (flute / 12) * Math.PI * 2;
      flutingSegments.push([
        [
          columnX + Math.cos(angle) * 1.3,
          0.72,
          columnZ + Math.sin(angle) * 1.3,
        ],
        [
          columnX + Math.cos(angle) * 1.04,
          signature.column_height_m - 0.7,
          columnZ + Math.sin(angle) * 1.04,
        ],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Brandenburg Gate batched Doric column fluting",
    flutingSegments,
    0x887b62,
    0.58,
  );

  for (let passage = 0; passage < 5; passage += 1) {
    const passageZ =
      -colonnadeWidth / 2 + ((passage + 0.5) / 5) * colonnadeWidth;
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
  const pavilionMasonry: VectorSegment[] = [];
  for (const z of [-1, 1]) {
    const pavilionZ = z * (signature.width_m / 2 - pavilionWidth / 2);
    addBox(
      group,
      "Brandenburg Gate side pavilion",
      [signature.depth_m, pavilionHeight, pavilionWidth],
      [0, pavilionHeight / 2, pavilionZ],
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
    const courseHeight = 1.3;
    for (const xSide of [-1, 1]) {
      const faceX = xSide * (signature.depth_m / 2 - 0.01);
      for (let course = 1; course < 12; course += 1) {
        const y = course * courseHeight;
        pavilionMasonry.push([
          [faceX, y, pavilionZ - pavilionWidth / 2 + 0.3],
          [faceX, y, pavilionZ + pavilionWidth / 2 - 0.3],
        ]);
      }
      for (let course = 0; course < 12; course += 1) {
        const yStart = course * courseHeight;
        const offset = course % 2 === 0 ? 0 : 1.05;
        for (
          let jointZ = pavilionZ - pavilionWidth / 2 + 0.9 + offset;
          jointZ < pavilionZ + pavilionWidth / 2 - 0.5;
          jointZ += 2.1
        ) {
          pavilionMasonry.push([
            [faceX, yStart, jointZ],
            [faceX, Math.min(pavilionHeight, yStart + courseHeight), jointZ],
          ]);
        }
      }
    }
  }
  addVectorSegments(
    group,
    "Brandenburg Gate batched pavilion masonry joints",
    pavilionMasonry,
    0x9c8c6f,
    0.38,
  );
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
  const triglyphs: InstanceTransform[] = [];
  const triglyphCount = 24;
  for (const xSide of [-1, 1]) {
    for (let index = 0; index <= triglyphCount; index += 1) {
      triglyphs.push({
        position: [
          xSide * (signature.depth_m / 2 - 0.13),
          17.2,
          -colonnadeWidth / 2 + (index / triglyphCount) * colonnadeWidth,
        ],
      });
    }
  }
  addInstancedBoxes(
    group,
    "Brandenburg Gate instanced frieze triglyphs",
    [0.26, 0.64, 0.72],
    sandstoneShadow,
    triglyphs,
  );

  const entablatureProfiles: VectorSegment[] = [];
  for (const xSide of [-1, 1]) {
    const faceX = xSide * (signature.depth_m / 2 - 0.01);
    for (const y of [13.45, 14.5, 15.65, 16.45, 17.2, 17.65]) {
      entablatureProfiles.push([
        [faceX, y, -colonnadeWidth / 2],
        [faceX, y, colonnadeWidth / 2],
      ]);
    }
    for (let division = 0; division <= 5; division += 1) {
      const z = -colonnadeWidth / 2 + (division / 5) * colonnadeWidth;
      entablatureProfiles.push([
        [faceX, 13.25, z],
        [faceX, 17.62, z],
      ]);
    }
  }
  addVectorSegments(
    group,
    "Brandenburg Gate batched entablature profiles",
    entablatureProfiles,
    0x88775d,
    0.62,
  );

  // The Quadriga. Built in its own module at the finest granularity in
  // this drawing — four horses modelled down to the nostrils, a spoked
  // chariot, Victoria's wings, and Schinkel's standard whose Iron Cross
  // is a real cross pattee generated from pinned ratios rather than two
  // crossed boxes. It is authored in local metres with y = 0 at the
  // plinth, so it is placed on the attic and scaled from the signature's
  // own published figures: the gate is 20.3 m to the attic and 26.0 m
  // over all, which leaves the sculpture exactly 5.7 m.
  const quadriga = createQuadriga();
  const quadrigaHeight = signature.total_height_m - signature.gate_height_m;
  quadriga.scale.setScalar(quadrigaHeight / QUADRIGA_DIMENSIONS.totalHeight);
  quadriga.position.set(-1.1, signature.gate_height_m, 0);
  group.add(quadriga);

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
      return createBrandenburgGateModel(
        signature as BrandenburgGateModelSignature,
      );
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
    targetWorld[0] +=
      offsetX * Math.cos(rotation) + offsetZ * Math.sin(rotation);
    targetWorld[1] += offsetY;
    targetWorld[2] +=
      -offsetX * Math.sin(rotation) + offsetZ * Math.cos(rotation);
  }
  return {
    ...signature.focus_camera,
    target_world: targetWorld,
  };
}

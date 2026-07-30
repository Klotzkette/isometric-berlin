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
  type ArchitecturalSignature as ReichstagDomeSignature,
  createOfficialReichstagDome,
} from "./ReichstagDome";
import { markWindFlag, markWindFlagInstances } from "./WindFlags";

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

// Hero-model ink follows the drawn city's fine grey pencil register
// (was a dark blue-teal that clashed by day and vanished at night).
const EDGE_COLOR = 0x716c62;

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

type VectorSegment = [
  [number, number, number],
  [number, number, number],
];

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
  const material = new LineBasicMaterial({
    color: EDGE_COLOR,
    opacity,
    transparent: opacity < 1,
  });
  material.userData.modeInk = true;
  const edges = new LineSegments(new EdgesGeometry(mesh.geometry, 24), material);
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
    outlineMaterial.userData.modeInk = true;
  }
  const edges = new LineSegments(new EdgesGeometry(source, 24), outlineMaterial);
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
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({
      color,
      depthWrite: opacity >= 0.75,
      opacity,
      transparent: opacity < 1,
    }),
  );
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
  const poleHeight = 9;
  const poleMesh = new Mesh(new CylinderGeometry(0.12, 0.16, poleHeight, 10), pole);
  poleMesh.name = `${name} flagpole`;
  poleMesh.position.set(position[0], position[1] + poleHeight / 2, position[2]);
  poleMesh.castShadow = true;
  group.add(poleMesh);

  const stripeColors = [0x151515, 0xc82f35, 0xe5b93f];
  const flagWidth = 4.8;
  for (let index = 0; index < stripeColors.length; index += 1) {
    const geometry = new PlaneGeometry(flagWidth, 0.76, 12, 2);
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
      position[1] + poleHeight - 0.5 - index * 0.76,
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
  const poleHeight = 9;
  const pole = new Mesh(
    new CylinderGeometry(0.12, 0.16, poleHeight, 10),
    poleMaterial,
  );
  pole.name = `${name} flagpole`;
  pole.position.set(position[0], position[1] + poleHeight / 2, position[2]);
  pole.castShadow = true;
  group.add(pole);

  const flagWidth = 4.8;
  const flagGeometry = new PlaneGeometry(flagWidth, 2.28, 12, 4);
  flagGeometry.translate(flagWidth / 2, 0, 0);
  const flag = new Mesh(
    flagGeometry,
    new MeshBasicMaterial({ color: 0x174c9c, side: DoubleSide }),
  );
  flag.name = `${name} European Union flag`;
  flag.position.set(position[0], position[1] + poleHeight - 1.25, position[2]);
  flag.rotation.y = -0.06;
  markWindFlag(flag, flagWidth, { phase: 0.42 });
  group.add(flag);

  const stars = new InstancedMesh(
    new CircleGeometry(0.09, 5),
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
      position[0] + 2.4 + Math.cos(angle) * 0.58,
      position[1] + poleHeight - 1.25 + Math.sin(angle) * 0.58,
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

  const towerSize = 19;
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const towerX = xSide * (signature.width_m / 2 - towerSize / 2 - 2);
      const towerZ = zSide * (signature.depth_m / 2 - towerSize / 2 - 2);
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
  const longPostCount = Math.max(16, Math.round((signature.width_m - 24) / 4.2));
  const shortPostCount = Math.max(20, Math.round((signature.depth_m - 24) / 4.2));
  for (const zSide of [-1, 1]) {
    for (let index = 0; index <= longPostCount; index += 1) {
      postTransforms.push({
        position: [
          -signature.width_m / 2 + 12 +
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
          -signature.depth_m / 2 + 12 +
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
      [[-x, y, -z], [x, y, -z]],
      [[-x, y, z], [x, y, z]],
      [[-x, y, -z], [-x, y, z]],
      [[x, y, -z], [x, y, z]],
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
  const towerSize = 19;
  const towerTop = signature.body_height_m + 2.35;
  const atticHeight = 2.7;
  const parapets: InstanceTransform[] = [];
  const pinnacles: InstanceTransform[] = [];
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      const cx = xSide * (signature.width_m / 2 - towerSize / 2 - 2);
      const cz = zSide * (signature.depth_m / 2 - towerSize / 2 - 2);
      // Parapet walls sit on the tower edges, so the flag mast keeps the
      // centre of every tower platform free.
      for (const edge of [-1, 1]) {
        parapets.push({
          position: [cx, towerTop + atticHeight / 2, cz + edge * (towerSize / 2 - 0.5)],
        });
        parapets.push({
          position: [cx + edge * (towerSize / 2 - 0.5), towerTop + atticHeight / 2, cz],
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
      const angle = Math.PI + ((flute / (FLUTES - 1)) - 0.5) * 2.2;
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
      [[-rx, y, -rz], [rx, y, -rz]],
      [[-rx, y, rz], [rx, y, rz]],
      [[-rx, y, -rz], [-rx, y, rz]],
      [[rx, y, -rz], [rx, y, rz]],
    );
  }
  for (const zSide of [-rz, rz]) {
    for (let index = 0; index <= 24; index += 1) {
      const x = -rx + (index / 24) * (rx * 2);
      const yTop = index % 2 === 0 ? 2.7 : 4.05;
      rustication.push([[x, 0.1, zSide], [x, yTop, zSide]]);
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
  // The gilded dedication on the architrave — the Reichstag's most
  // famous line, read here as a gold band with letter-group blocks.
  const gilded = modelMaterial(0xc9a227, { metalness: 0.45, roughness: 0.4 });
  addBox(
    group,
    "Reichstag DEM DEUTSCHEN VOLKE inscription band",
    [0.26, 1.15, 26],
    [westX - 3.8, 18.55, 0],
    gilded,
  );
  for (const [offset, width] of [
    [-9.5, 5.4],
    [-0.5, 10.6],
    [9.8, 7.4],
  ] as const) {
    addBox(
      group,
      "Reichstag inscription letter group",
      [0.3, 0.62, width],
      [westX - 3.85, 18.55, offset],
      stoneAccent,
      0.92,
    );
  }
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
      [0, (signature.body_height_m + 1.8) / 2, side * (signature.depth_m / 2 + 0.9)],
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
        position: [
          columnX,
          height / 2 - 0.2,
          z + side * (depth / 2 + 0.13),
        ],
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
    const columnX = courtX - columnSpan / 2 + (index / (COLUMN_COUNT - 1)) * columnSpan;
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
  const westBand = signature.office_segments[signature.office_segments.length - 1];
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
    [
      ...transformsAt(0.12, -0.13, 0.06),
      ...transformsAt(0.12, 0.13, 0.06),
    ],
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
  // Pale, properly depth-tested glazing: the old material disabled
  // depth testing entirely (the roof floated in front of everything)
  // and its strong turquoise clashed with the ivory register.
  const glass = nightEmitter(
    new MeshPhysicalMaterial({
      color: 0xc6e3ea,
      depthWrite: false,
      metalness: 0.03,
      opacity: 0.3,
      roughness: 0.1,
      side: DoubleSide,
      transparent: true,
      transmission: 0.34,
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

  const ribCount = Math.max(18, Math.round(length / 6));
  const ribPoints = Array.from({ length: 33 }, (_, index) => {
    const angle = (index / 32) * Math.PI;
    const lateral = Math.cos(angle) * (width / 2);
    const y = baseY + Math.sin(angle) * height;
    return alongX
      ? new Vector3(0, y, lateral)
      : new Vector3(lateral, y, 0);
  });
  const ribTransforms = Array.from({ length: ribCount + 1 }, (_, index) => {
    const longitudinal = -length / 2 + (index / ribCount) * length;
    return {
      position: (alongX
        ? [longitudinal, 0, 0]
        : [0, 0, longitudinal]) as [number, number, number],
    };
  });
  addInstancedGeometry(
    group,
    `${name} instanced steel arch ribs`,
    new TubeGeometry(new CatmullRomCurve3(ribPoints), 40, 0.12, 5, false),
    steel,
    ribTransforms,
  );

  const purlinFractions = Array.from(
    { length: 17 },
    (_, index) => (index + 1) / 18,
  );
  const purlinTransforms: InstanceTransform[] = [];
  for (const fraction of purlinFractions) {
    const angle = fraction * Math.PI;
    const lateral = Math.cos(angle) * (width / 2);
    const y = baseY + Math.sin(angle) * height;
    purlinTransforms.push({
      position: alongX ? [0, y, lateral] : [lateral, y, 0],
    });
  }
  addInstancedBoxes(
    group,
    `${name} instanced longitudinal steel purlins`,
    alongX ? [length, 0.18, 0.18] : [0.18, 0.18, length],
    steel,
    purlinTransforms,
  );

  const panelSegments: VectorSegment[] = [];
  const transverseCount = Math.max(30, Math.round(length / 3));
  const arcSegments = 28;
  for (let seam = 0; seam <= transverseCount; seam += 1) {
    const longitudinal = -length / 2 + (seam / transverseCount) * length;
    for (let index = 0; index < arcSegments; index += 1) {
      const startAngle = (index / arcSegments) * Math.PI;
      const endAngle = ((index + 1) / arcSegments) * Math.PI;
      const startLateral = Math.cos(startAngle) * (width / 2);
      const endLateral = Math.cos(endAngle) * (width / 2);
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
    const lateral = Math.cos(angle) * (width / 2);
    const y = baseY + Math.sin(angle) * height + 0.24;
    panelSegments.push(
      alongX
        ? [
            [-length / 2, y, lateral],
            [length / 2, y, lateral],
          ]
        : [
            [lateral, y, -length / 2],
            [lateral, y, length / 2],
          ],
    );
  }
  addVectorSegments(
    group,
    `${name} batched glass panel seams`,
    panelSegments,
    0x3d6874,
    0.64,
  );
}

function addStationOfficeBridge(
  group: Group,
  x: number,
  depth: number,
  height: number,
): void {
  const glass = nightEmitter(
    modelMaterial(0xa7ccd3, {
      metalness: 0.08,
      opacity: 0.24,
      roughness: 0.25,
    }),
    0xffdca0,
    0.72,
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
  const mullionCount = Math.max(18, Math.round(depth / 6));
  const mullions: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index <= mullionCount; index += 1) {
      mullions.push({
        position: [
          x + side * 9.3,
          height / 2,
          -depth / 2 + (index / mullionCount) * depth,
        ],
      });
    }
  }
  addInstancedBoxes(
    group,
    "Hauptbahnhof instanced office-bridge facade mullions",
    [0.24, height - 2.4, 0.28],
    frame,
    mullions,
  );

  const panelSeams: VectorSegment[] = [];
  for (const side of [-1, 1]) {
    const faceX = x + side * 9.43;
    for (let y = 3; y < height; y += 3) {
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
    0.52,
  );
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
  const windows: InstanceTransform[] = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < windowCount; index += 1) {
      const windowX =
        -options.length / 2 + 5.5 + (index / (windowCount - 1)) * (options.length - 11);
      windows.push({
        position: [options.x + windowX, 13.55, options.z + side * 1.5],
      });
    }
  }
  addInstancedBoxes(
    group,
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
          options.x - options.length / 2 + (index / (doorCount + 1)) * options.length,
          13.05,
          options.z + side * 1.56,
        ],
      });
    }
  }
  addInstancedBoxes(
    group,
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
          options.x - options.length / 2 + fraction * options.length,
          11.04,
          options.z + side * 1.58,
        ],
        rotation: [Math.PI / 2, 0, 0],
      });
    }
  }
  addInstancedGeometry(
    group,
    `${options.name} instanced wheels`,
    new CylinderGeometry(0.48, 0.48, 0.18, 16),
    wheelMaterial,
    wheels,
  );

  const carriageSeams: VectorSegment[] = [];
  const carriageCount = Math.max(3, Math.round(options.length / 25));
  for (let index = 1; index < carriageCount; index += 1) {
    const seamX = options.x - options.length / 2 + (index / carriageCount) * options.length;
    for (const side of [-1, 1]) {
      carriageSeams.push([
        [seamX, 11.9, options.z + side * 1.6],
        [seamX, 14.25, options.z + side * 1.6],
      ]);
    }
  }
  addVectorSegments(
    group,
    `${options.name} batched carriage joints`,
    carriageSeams,
    0x39494d,
    0.72,
  );
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
  // Keep both complete trains and a legible stretch of approach viaduct on
  // supported track beyond the 321 m station roof.
  const trackLength = signature.east_west_roof_length_m + 220;
  addBox(
    group,
    "Hauptbahnhof east-west elevated track deck",
    [trackLength, 1.1, signature.east_west_roof_width_m - 3],
    [0, 9.8, 0],
    deck,
    0.5,
  );
  for (const trackZ of [-12, -4, 4, 12]) {
    addBox(
      group,
      "Hauptbahnhof upper-level ballast bed",
      [trackLength, 0.1, 3.45],
      [0, 10.34, trackZ],
      modelMaterial(0x6e706a, { roughness: 0.96 }),
    );
    for (const railOffset of [-0.76, 0.76]) {
      addBox(
        group,
        "Hauptbahnhof upper-level rail",
        [trackLength, 0.16, 0.14],
        [0, 10.48, trackZ + railOffset],
        rail,
      );
    }
  }
  const approachPiers: InstanceTransform[] = [];
  for (let x = -trackLength / 2 + 13; x <= trackLength / 2 - 13; x += 26) {
    if (Math.abs(x) <= signature.east_west_roof_length_m / 2 - 18) {
      continue;
    }
    for (const z of [-13, 13]) {
      approachPiers.push({ position: [x, 4.55, z] });
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
      sleeperTransforms.push({
        position: [
          -trackLength / 2 + (index / sleeperCount) * trackLength,
          10.39,
          trackZ,
        ],
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
  const platformJointSegments: VectorSegment[] = [];
  for (const platformZ of [-8, 8]) {
    for (let x = -108; x <= 108; x += 4) {
      platformJointSegments.push([
        [x, 10.75, platformZ - 2.05],
        [x, 10.75, platformZ + 2.05],
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
  addStationTrain(group, {
    bodyColor: 0xf1f2ef,
    length: 126,
    name: "Hauptbahnhof stationary ICE",
    stripeColor: 0xd63d3d,
    windowColor: 0x4c7480,
    x: 130,
    z: -12,
  });
  addStationTrain(group, {
    bodyColor: 0xe8c23d,
    length: 74,
    name: "Hauptbahnhof stationary Berlin S-Bahn",
    stripeColor: 0xb42f2f,
    windowColor: 0x567984,
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
    "Hauptbahnhof 180 m north-south hall",
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
      column.position.set(
        x,
        signature.column_height_m / 2,
        z,
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
  const pavilionMasonry: VectorSegment[] = [];
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

  addBox(group, "Quadriga chariot", [3.4, 1.0, 7.4], [-1.1, 21.0, 0], bronze, 0.8);
  // Chariot rail, so the car reads as a vehicle from above.
  addBox(group, "Quadriga chariot rail", [0.24, 1.2, 7.4], [-2.6, 22.0, 0], bronze, 0.9);
  for (const wheelZ of [-2.45, 2.45]) {
    const wheel = new Mesh(new TorusGeometry(0.92, 0.13, 8, 20), bronze);
    wheel.name = "Quadriga chariot wheel";
    wheel.position.set(-1.2, 21.25, wheelZ);
    wheel.castShadow = true;
    group.add(wheel);
  }
  for (let index = 0; index < 4; index += 1) {
    // Wider spacing plus faceted, inked bodies so the four-horse team
    // is countable in the drawing instead of merging into one blob.
    const z = -3.0 + index * 2.0;
    const body = new Mesh(new SphereGeometry(1, 9, 6), bronze);
    body.name = `Quadriga horse ${index + 1}`;
    body.scale.set(2.05, 0.76, 0.5);
    body.position.set(1.0, 22.2, z);
    body.castShadow = true;
    group.add(body);
    addEdges(group, body, 0.85);
    const head = new Mesh(new SphereGeometry(0.62, 8, 5), bronze);
    head.name = `Quadriga horse head ${index + 1}`;
    head.scale.set(1.0, 1.2, 0.82);
    head.position.set(3.15, 23.35, z);
    head.castShadow = true;
    group.add(head);
    addEdges(group, head, 0.85);
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
  addEdges(group, victoria, 0.85);
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
  // Victoria's staff: pole, oak wreath, Prussian eagle and the Iron
  // Cross — the Quadriga's signature silhouette above the attic.
  const staff = new Mesh(new CylinderGeometry(0.09, 0.09, 4.6, 8), bronze);
  staff.name = "Quadriga Victoria eagle staff";
  staff.position.set(-0.35, signature.total_height_m - 3.4, 0);
  group.add(staff);
  const crossBar = new Mesh(new BoxGeometry(0.62, 0.16, 0.16), bronze);
  crossBar.name = "Quadriga Iron Cross transom";
  crossBar.position.set(-0.35, signature.total_height_m - 1.6, 0);
  group.add(crossBar);
  const eagleBody = new Mesh(new BoxGeometry(0.34, 0.72, 0.34), bronze);
  eagleBody.name = "Quadriga Prussian eagle body";
  eagleBody.position.set(-0.35, signature.total_height_m - 0.72, 0);
  group.add(eagleBody);
  for (const side of [-1, 1]) {
    const eagleWing = new Mesh(new BoxGeometry(0.16, 0.5, 0.9), bronze);
    eagleWing.name = "Quadriga Prussian eagle wing";
    eagleWing.position.set(-0.35, signature.total_height_m - 0.62, side * 0.55);
    eagleWing.rotation.x = side * 0.42;
    group.add(eagleWing);
  }
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

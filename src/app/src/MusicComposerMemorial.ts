import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import {
  createBuilder,
  finishDrawnGroup,
  paintGeometry,
  type Builder,
} from "./drawnKit";
import type { MemorialLandmark } from "./MemorialLandmarks";
type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};
const GOLD = 0xc89a32;
const EDGE_COLOR = 0x716c62;
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
    indices.push(index, count + next, next, index, count + index, count + next);
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

export function createComposerMemorial(anchor: MemorialLandmark): Group {
  const group = new Group();
  group.name = anchor.name;
  group.position.set(anchor.world[0], 3.73, anchor.world[2]);
  group.userData.composerMemorialSmooth = true;
  group.userData.geometryStatus =
    "Landesdenkmalamt/Bildhauerei-in-Berlin: 10 m monument with rounded granite understructure, chamfered three-sided Pentelic-marble pavilion, three 1.56-1.70 m Laas-marble half figures in shallow round-arched niches, pilasters, restored gilded masks/instruments, lyre-bearing swans, pale scaled cupola fields with gilded ribs, pinecones and three putti carrying a laurel wreath. Unpublished local subdivisions and bearings are procedural recognition geometry.";
  group.userData.evidence = BEETHOVEN_HAYDN_MOZART_PROFILE;
  const granite = modelMaterial(0x85827c, { roughness: 0.82 });
  const pentelicMarble = modelMaterial(0xdfd8c5, { roughness: 0.68 });
  const laasMarble = modelMaterial(0xf1efe8, { roughness: 0.62 });
  const marbleShadow = modelMaterial(0xb7aa88, { roughness: 0.75 });
  const nicheShadow = modelMaterial(0xc4bead, { roughness: 0.84 });
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
      position: radial(angle, 2.01, 3.38),
      rotation: faceRotation(angle),
      scale: [1.12, 0.98, 0.62],
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
      position: radial(angle, 2.13, 4.0 + (index === 2 ? 0.03 : 0)),
      rotation: [0, Math.PI / 2 - angle + (index === 2 ? -0.22 : 0.18), 0],
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
    "Composer memorial three-sided curved scale cupola",
    composerCupolaGeometry(),
    modelMaterial(0xd0cbbd),
    [0, 0, 0],
  );
  addEdges(group, dome);
  addInstances(
    group,
    "Composer memorial three upward pinecones",
    new ConeGeometry(0.22, 0.58, 8),
    gold,
    cornerAngles.map((angle) => ({ position: radial(angle, 2.49, 6.99) })),
  );
  addComposerCloseDetails(group, faceAngles, cornerAngles);

  const putti = addInstances(
    group,
    "Composer memorial three gilded putti",
    new CapsuleGeometry(0.2, 0.32, 4, 8),
    gold,
    [0, 1, 2].map((index) => {
      const angle = (index / 3) * Math.PI * 2;
      return {
        position: radial(angle, 0.78, 8.64),
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
  group.userData.refinement = MUSIC_COMPOSER_REFINEMENT;
  return group;
}

export const MUSIC_COMPOSER_REFINEMENT = Object.freeze({
  revision: "v1.0.5",
  geometryStatus:
    "Committed anchor and documented 10 m total; local anatomy, niche and roof subdivisions are photograph-bounded display geometry, not surveyed",
  roof: "three-sided curved cupola with pale scaled fields and gilded ribs; current free 2014 photo distinguishes infill from historical gilding programme",
  subjectAttributes: [
    "Mozart: turned powdered head, scroll and cupped hand",
    "Haydn: short wig, high collar and score book",
    "Beethoven: broad turned head, unruly hair and double-breasted coat",
  ],
  consoleReliefs: [
    "flower-bearing dancer",
    "country dancer",
    "rock-breaking Titan",
  ],
  sourcePhotos: [
    "Beethoven-Haydn-Mozart Memorial, Berlin.jpg",
    "Beethoven - Beethoven-Haydn-Mozart-Denkmal - Berlin, Germany - DSC09442.JPG",
    "Mozart - Beethoven-Haydn-Mozart-Denkmal - Berlin, Germany - DSC09446.JPG",
  ],
  textureFree: true,
});
const CUPOLA_COURSES = [
  [6.51, 3.5],
  [6.74, 3.17],
  [7.08, 2.57],
  [7.4, 1.88],
  [7.69, 1.16],
  [7.93, 0.61],
  [8.08, 0.48],
] as const;
/** Three chamfered corners continue the marble body through a curved roof profile. */
export function composerCupolaGeometry(): BufferGeometry {
  const positions: number[] = [];
  for (let k = 0; k < CUPOLA_COURSES.length - 1; k++) {
    const [y, r] = CUPOLA_COURSES[k],
      [ny, nr] = CUPOLA_COURSES[k + 1];
    const g = chamferedTrianglePrismGeometry(r, nr, ny - y);
    g.translate(0, y, 0);
    positions.push(...Array.from(g.getAttribute("position").array));
    g.dispose();
  }
  const result = new BufferGeometry();
  result.setAttribute("position", new Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  return result;
}
function detailPart(builder: Builder, g: BufferGeometry, color: number): void {
  paintGeometry(g, color);
  builder.parts.push(g);
}
function detailEllipsoid(
  b: Builder,
  c: number,
  p: readonly number[],
  s: readonly number[],
  yaw = 0,
): void {
  const g = new SphereGeometry(1, 8, 6);
  g.scale(s[0], s[1], s[2]);
  g.rotateY(yaw);
  g.translate(p[0], p[1], p[2]);
  detailPart(b, g, c);
}
function detailBeam(
  b: Builder,
  c: number,
  a: readonly number[],
  p: readonly number[],
  r: number,
): void {
  const delta = new Vector3(p[0] - a[0], p[1] - a[1], p[2] - a[2]);
  const g = new CylinderGeometry(r, r, delta.length(), 6);
  g.applyQuaternion(
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      delta.normalize(),
    ),
  );
  g.translate((a[0] + p[0]) / 2, (a[1] + p[1]) / 2, (a[2] + p[2]) / 2);
  detailPart(b, g, c);
}
function detailBox(
  b: Builder,
  c: number,
  p: readonly number[],
  s: readonly number[],
  yaw = 0,
): void {
  const g = new BoxGeometry(s[0], s[1], s[2]);
  g.rotateY(yaw);
  g.translate(p[0], p[1], p[2]);
  detailPart(b, g, c);
}
function addComposerCloseDetails(
  group: Group,
  faces: number[],
  corners: number[],
): void {
  const stone = createBuilder(),
    gold = createBuilder(),
    white = 0xeeeae0,
    shadow = 0xb9b3a4,
    pale = 0xded8c7;
  const facePoint = (
    a: number,
    x: number,
    y: number,
    r: number,
  ): [number, number, number] => [
    Math.cos(a) * r - Math.sin(a) * x,
    y,
    Math.sin(a) * r + Math.cos(a) * x,
  ];
  for (const [index, angle] of faces.entries()) {
    const p = (x: number, y: number, r = 2.16) => facePoint(angle, x, y, r),
      yaw = Math.PI / 2 - angle;
    for (const side of [-1, 1])
      detailBox(
        stone,
        pale,
        p(side * 0.96, 3.5, 1.91),
        [0.11, 2.05, 0.18],
        yaw,
      );
    detailBox(stone, pale, p(0, 2.7, 2.04), [1.86, 0.18, 0.57], yaw);
    detailBox(stone, pale, p(0, 1.87, 1.98), [1.1, 1.36, 0.27], yaw);
    for (const side of [-1, 1]) {
      detailBeam(
        stone,
        pale,
        p(side * 0.65, 1.3, 1.97),
        p(side * 0.8, 2.57, 2.15),
        0.1,
      );
      const scroll = new TorusGeometry(0.17, 0.065, 5, 12, Math.PI * 1.7);
      scroll.rotateY(yaw);
      scroll.translate(...p(side * 0.72, 2.46, 2.24));
      detailPart(stone, scroll, white);
      detailBeam(
        stone,
        white,
        p(side * 0.4, 3.65, 2.28),
        p(side * 0.13, 3.27, 2.44),
        0.055,
      );
      detailBeam(
        stone,
        white,
        p(side * 0.48, 3.58, 2.11),
        p(side * 0.55, 3.02, 2.25),
        0.105,
      );
      for (let row = 0; row < 3; row++)
        detailEllipsoid(
          stone,
          white,
          p(side * (index === 2 ? 0.11 : 0.025), 3.08 + row * 0.15, 2.49),
          [0.026, 0.026, 0.023],
        );
    }
    const turn = index === 2 ? -0.22 : 0.18;
    detailEllipsoid(
      stone,
      white,
      p(turn, 4.02, 2.47),
      [0.075, 0.11, 0.075],
      yaw,
    );
    for (const side of [-1, 1])
      detailBeam(
        stone,
        shadow,
        p(turn + side * 0.04, 4.13, 2.45),
        p(turn + side * 0.14, 4.12, 2.42),
        0.014,
      );
    if (index === 0) {
      detailBeam(
        stone,
        white,
        p(-0.5, 3.02, 2.31),
        p(-0.25, 3.04, 2.62),
        0.085,
      );
      detailBeam(stone, white, p(0.52, 3, 2.31), p(0.27, 2.91, 2.61), 0.085);
      detailBeam(stone, white, p(-0.28, 3.1, 2.65), p(0.39, 2.88, 2.62), 0.055);
      detailEllipsoid(stone, white, p(-0.3, 3.01, 2.6), [0.14, 0.05, 0.1], yaw);
    } else if (index === 1) {
      detailBox(stone, shadow, p(0.04, 3, 2.58), [0.62, 0.12, 0.35], yaw);
      detailBox(stone, white, p(0.04, 3.06, 2.58), [0.58, 0.04, 0.32], yaw);
      for (const side of [-1, 1])
        detailBeam(
          stone,
          white,
          p(side * 0.52, 3.05, 2.25),
          p(side * 0.28, 3.09, 2.65),
          0.085,
        );
    } else
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        detailEllipsoid(
          stone,
          white,
          p(Math.sin(a) * 0.31, 4.02 + Math.cos(a) * 0.33, 2.16),
          [0.1, 0.15, 0.09],
          yaw,
        );
      }
    // Three shallow relief silhouettes follow the inventory's different allegories.
    const lean = index === 2 ? -0.18 : 0.12;
    detailEllipsoid(stone, white, p(lean, 1.91, 2.18), [0.17, 0.33, 0.06], yaw);
    detailEllipsoid(
      stone,
      white,
      p(lean - 0.05, 2.29, 2.2),
      [0.1, 0.12, 0.06],
      yaw,
    );
    detailBeam(
      stone,
      white,
      p(lean - 0.1, 1.99, 2.21),
      p(-0.4, 2.35, 2.22),
      0.043,
    );
    detailBeam(
      stone,
      white,
      p(lean + 0.1, 1.99, 2.21),
      p(0.39, index === 2 ? 2.49 : 2.42, 2.22),
      0.043,
    );
    detailBeam(
      stone,
      white,
      p(lean - 0.08, 1.7, 2.22),
      p(-0.28, 1.27, 2.2),
      0.047,
    );
    detailBeam(
      stone,
      white,
      p(lean + 0.08, 1.7, 2.22),
      p(0.31, 1.3, 2.2),
      0.047,
    );
    if (index === 0)
      detailBox(stone, pale, p(0.17, 2.48, 2.2), [0.43, 0.12, 0.09], yaw);
    for (let k = 0; k < 9; k++) {
      const a = (k / 8) * Math.PI;
      detailEllipsoid(
        stone,
        white,
        p(Math.cos(a) * 1.04, 4.52 + Math.sin(a) * 1.04, 1.96),
        [0.085, 0.13, 0.04],
        yaw,
      );
    }
    for (const side of [-1, 1])
      for (let k = 0; k < 5; k++)
        detailBeam(
          stone,
          white,
          p(side * 0.18, 5.31, 2.15),
          p(side * (0.42 + k * 0.17), 5.48 - k * 0.025, 2.18),
          0.04,
        );
    detailBeam(stone, white, p(0, 5.29, 2.22), p(0, 5.66, 2.3), 0.065);
    detailEllipsoid(stone, white, p(0.06, 5.65, 2.32), [0.11, 0.08, 0.08], yaw);
    for (const x of [-0.1, 0, 0.1])
      detailBeam(gold, GOLD, p(x, 5.12, 2.54), p(x, 5.36, 2.54), 0.012);
  }
  for (const angle of corners) {
    for (let k = 0; k < CUPOLA_COURSES.length - 1; k++) {
      const [y, r] = CUPOLA_COURSES[k],
        [ny, nr] = CUPOLA_COURSES[k + 1];
      detailBeam(
        gold,
        GOLD,
        facePoint(angle, 0, y + 0.035, r * 0.739),
        facePoint(angle, 0, ny + 0.035, nr * 0.739),
        0.065,
      );
    }
    const cap = new TorusGeometry(0.2, 0.07, 5, 12, Math.PI * 1.65);
    cap.rotateY(Math.PI / 2 - angle);
    cap.translate(...facePoint(angle, 0, 8.06, 0.47));
    detailPart(gold, cap, GOLD);
  }
  // Putti retain their original radial placement; paired legs now reach the roof.
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    for (const side of [-1, 1])
      detailBeam(
        gold,
        GOLD,
        facePoint(a, side * 0.14, 8.34, 0.77),
        facePoint(a, side * 0.19, 8.03, 0.59),
        0.09,
      );
  }
  // Scallops lie on the three roof fields, not a hemisphere.
  for (const angle of faces)
    for (let row = 0; row < 5; row++) {
      const [y, r] = CUPOLA_COURSES[row],
        [ny, nr] = CUPOLA_COURSES[row + 1],
        rad = (r + nr) / 4 + 0.04,
        half = (r + nr) * 0.22,
        count = Math.max(2, 6 - row);
      for (let k = 0; k < count; k++) {
        const x = ((k / (count - 1)) * 2 - 1) * half;
        const arc = new TorusGeometry(0.13, 0.012, 3, 7, Math.PI);
        arc.rotateZ(Math.PI);
        arc.rotateY(Math.PI / 2 - angle);
        arc.translate(...facePoint(angle, x, (y + ny) / 2 + 0.05, rad));
        detailPart(stone, arc, 0xb3ae9f);
      }
    }
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    detailEllipsoid(
      gold,
      GOLD,
      [Math.cos(a) * 1.19, 9.83, Math.sin(a) * 1.19],
      [0.22, 0.09, 0.09],
      -a + 0.25,
    );
  }
  const masonry = finishDrawnGroup(stone, {
    name: "Composer memorial carved portrait console and scale details",
  })!;
  masonry.userData.fadeAsFineDetail = true;
  const gilding = finishDrawnGroup(gold, {
    name: "Composer memorial roof ribs and laurel leaves",
  })!;
  gilding.userData.layerRole = "structural";
  group.add(masonry, gilding);
}
/** Authored cube courses preserve the same monument and replace smooth geometry in Minecraft. */
export function createComposerMemorialMinecraft(): InstancedMesh {
  const transforms: InstanceTransform[] = [],
    colors: number[] = [],
    origin = BEETHOVEN_HAYDN_MOZART_PROFILE.presentationFocus.targetWorldM;
  const block = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: number,
    yaw = 0,
  ) => {
    transforms.push({
      position: [origin[0] + x, origin[1] + y, origin[2] + z],
      scale: [sx, sy, sz],
      rotation: [0, yaw, 0],
    });
    colors.push(c);
  };
  const inside = (x: number, z: number, r: number) =>
    [0, 1, 2].every((k) => {
      const a = (k * Math.PI * 2) / 3 + Math.PI / 6;
      return Math.cos(a) * x + Math.sin(a) * z <= r / 2 + 0.01;
    });
  for (const [r, y, h] of [
    [4.85, 0.14, 0.28],
    [4.35, 0.52, 0.48],
  ] as const)
    for (let x = -r; x <= r; x += 0.55)
      for (let z = -r; z <= r; z += 0.55)
        if (x * x + z * z <= (r - 0.28) ** 2)
          block(x, y, z, 0.55, h, 0.55, 0x85827c);
  for (let y = 1.02; y < 6.25; y += 0.48) {
    const r = 3.6 - ((y - 0.76) / 5.38) * 0.42;
    for (let x = -3.36; x <= 3.36; x += 0.48)
      for (let z = -3.36; z <= 3.36; z += 0.48) {
        if (
          !inside(x, z, r) ||
          Math.hypot(x, z) > r * 0.79 ||
          (y < 5.9 && inside(x, z, r - 0.72))
        )
          continue;
        block(x, y, z, 0.48, 0.48, 0.48, 0xdfd8c5);
      }
  }
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + Math.PI / 6,
      yaw = Math.PI / 2 - a;
    const at = (
      x: number,
      y: number,
      r: number,
      s: number,
      c: number,
      sy = s,
    ) =>
      block(
        Math.cos(a) * r - Math.sin(a) * x,
        y,
        Math.sin(a) * r + Math.cos(a) * x,
        s,
        sy,
        s,
        c,
        yaw,
      );
    for (let row = 0; row < 5; row++)
      for (let col = -1; col <= 1; col++)
        at(col * 0.42, 2.65 + row * 0.45, 1.91, 0.43, 0xb7aa88);
    for (let row = 0; row < 3; row++)
      for (let col = -1; col <= 1; col++)
        at(col * 0.31, 2.9 + row * 0.37, 2.23, 0.32, 0xf1efe8);
    at(k === 2 ? -0.06 : 0.06, 4.08, 2.22, 0.47, 0xf1efe8, 0.55);
    at(0, 2.3, 2.15, 0.38, 0xf1efe8, 0.45);
    at(0, 1.7, 2.13, 0.24, 0xf1efe8, 0.6);
    if (k === 0) {
      at(-0.36, 3.08, 2.55, 0.18, 0xf1efe8);
      at(0.25, 2.95, 2.58, 0.18, 0xf1efe8);
      at(-0.05, 3.02, 2.58, 0.35, 0xf1efe8, 0.1);
    }
    if (k === 1) at(0, 3.03, 2.59, 0.54, 0xf1efe8, 0.13);
    for (const side of [-1, 1])
      for (let w = 0; w < 3; w++)
        at(
          side * (0.35 + w * 0.28),
          5.39 + w * 0.04,
          2.19,
          0.3,
          0xf1efe8,
          0.16,
        );
    at(0, 5.5, 2.24, 0.19, 0xf1efe8, 0.45);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + Math.PI / 2;
    for (const offset of [-0.15, 0.15])
      block(
        Math.cos(a) * 2.85 - Math.sin(a) * offset,
        3.63,
        Math.sin(a) * 2.85 + Math.cos(a) * offset,
        0.23,
        0.36,
        0.18,
        GOLD,
        Math.PI / 2 - a,
      );
    block(Math.cos(a) * 2.84, 4.05, Math.sin(a) * 2.84, 0.12, 0.45, 0.12, GOLD);
    block(Math.cos(a) * 2.5, 6.99, Math.sin(a) * 2.5, 0.25, 0.54, 0.25, GOLD);
  }
  for (let row = 0; row < CUPOLA_COURSES.length - 1; row++) {
    const [y, r] = CUPOLA_COURSES[row],
      next = CUPOLA_COURSES[row + 1];
    for (let x = -3.2; x <= 3.2; x += 0.4)
      for (let z = -3.2; z <= 3.2; z += 0.4)
        if (
          inside(x, z, r) &&
          Math.hypot(x, z) < r * 0.8 &&
          (!inside(x, z, r - 0.9) || r < 1.3)
        )
          block(x, (y + next[0]) / 2, z, 0.4, next[0] - y, 0.4, 0xd0cbbd);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + Math.PI / 2;
      block(
        Math.cos(a) * r * 0.74,
        y + 0.11,
        Math.sin(a) * r * 0.74,
        0.23,
        0.24,
        0.23,
        GOLD,
      );
    }
  }
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    for (const y of [8.2, 8.6, 8.98])
      block(Math.cos(a) * 0.7, y, Math.sin(a) * 0.7, 0.3, 0.38, 0.3, GOLD);
    for (const side of [-1, 1])
      block(
        Math.cos(a) * 0.7 - Math.sin(a) * side * 0.24,
        9.38,
        Math.sin(a) * 0.7 + Math.cos(a) * side * 0.24,
        0.14,
        0.55,
        0.14,
        GOLD,
      );
  }
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    block(Math.cos(a) * 1.12, 9.87, Math.sin(a) * 1.12, 0.3, 0.26, 0.3, GOLD);
  }
  if (transforms.length > 2000)
    throw new Error("Composer Minecraft block budget exceeded");
  const mesh = addInstances(
    new Group(),
    "Composer memorial Minecraft block batch",
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.9,
    }),
    transforms,
  );
  colors.forEach((c, k) => mesh.setColorAt(k, new Color(c)));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData = {
    blockNative: true,
    blockCount: transforms.length,
    textureFree: true,
    smoothGeometryExcluded: true,
    refinement: MUSIC_COMPOSER_REFINEMENT,
  };
  return mesh;
}
export function setComposerMemorialSmoothVisibility(
  root: Group,
  visible: boolean,
): void {
  root.traverse((o) => {
    if (o.userData.composerMemorialSmooth === true) o.visible = visible;
  });
}

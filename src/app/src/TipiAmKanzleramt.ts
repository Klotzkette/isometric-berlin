import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

export const TIPI_GROUND_Y = 3.98;
export const TIPI_ROTATION_Y = (8 * Math.PI) / 180;

export const TIPI_AM_KANZLERAMT_PROFILE = {
  ellipseLengthM: 32,
  ellipseWidthM: 26,
  geometryStatus:
    "Official 32 x 26 m auditorium envelope with a source-described, photo-bounded multi-peak canvas and entrance-pavilion reconstruction",
  groundY: TIPI_GROUND_Y,
  mainRoofPeakCount: 8,
  marquee: "PIGOR & EICHHORN",
  marqueeIsOwnerAuthored: true,
  osmLandmarkWorldM: [-297.284, 52.502] as const,
  rotationY: TIPI_ROTATION_Y,
  sourceUrls: [
    "https://www.tipi-am-kanzleramt.de/de/theater/tipi-am-kanzleramt.html",
    "https://www.tipi-am-kanzleramt.de/_Resources/Persistent/0/1/3/9/0139b75bd22d148179852011cf066a1968138877/TIPI_Technikinfo_07_2024.pdf",
    "https://commons.wikimedia.org/wiki/File%3ATipi_am_Kanzleramt.jpg",
    "https://commons.wikimedia.org/wiki/File%3ABerlin-Tiergarten%2C_das_Theater_TIPI%2C_Blick_zum_Carillon.JPG",
  ] as const,
  todayMarquee: "NUR HEUTE ABEND",
} as const;

type InstanceTransform = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

const UP = new Vector3(0, 1, 0);
const MARQUEE_Z = 16.04;

function material(
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
    depthWrite: opacity >= 1,
    flatShading: true,
    metalness: options.metalness ?? 0.04,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: -1.1,
    polygonOffsetUnits: -1.1,
    roughness: options.roughness ?? 0.76,
    side: DoubleSide,
    transparent: opacity < 1,
  });
}

function nightEmitter<T extends MeshStandardMaterial>(
  source: T,
  color: number,
  intensity: number,
): T {
  source.userData.nightEmissive = color;
  source.userData.nightEmissiveIntensity = intensity;
  return source;
}

function addMesh<T extends BufferGeometry, M extends Material>(
  group: Group,
  name: string,
  geometry: T,
  meshMaterial: M,
  position: [number, number, number],
): Mesh<T, M> {
  const mesh = new Mesh(geometry, meshMaterial);
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
  meshMaterial: MeshStandardMaterial,
): Mesh {
  return addMesh(group, name, new BoxGeometry(...size), meshMaterial, position);
}

function addInstances(
  group: Group,
  name: string,
  geometry: BufferGeometry,
  meshMaterial: Material,
  transforms: InstanceTransform[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, meshMaterial, transforms.length);
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

function addTriangle(
  positions: number[],
  normals: number[],
  first: Vector3,
  second: Vector3,
  third: Vector3,
): void {
  const normal = second
    .clone()
    .sub(first)
    .cross(third.clone().sub(first))
    .normalize();
  for (const point of [first, second, third]) {
    positions.push(point.x, point.y, point.z);
    normals.push(normal.x, normal.y, normal.z);
  }
}

function addQuad(
  positions: number[],
  normals: number[],
  first: Vector3,
  second: Vector3,
  third: Vector3,
  fourth: Vector3,
): void {
  addTriangle(positions, normals, first, second, third);
  addTriangle(positions, normals, first, third, fourth);
}

function roofRingPoint(
  ring: "outer" | "peak" | "inner",
  index: number,
): Vector3 {
  const segmentCount = 16;
  const angle = (index / segmentCount) * Math.PI * 2;
  if (ring === "outer") {
    return new Vector3(Math.cos(angle) * 16, 3.35, Math.sin(angle) * 13);
  }
  if (ring === "peak") {
    const highPeak = index % 2 === 0;
    return new Vector3(
      Math.cos(angle) * 8.1,
      highPeak ? 13.25 : 9.45,
      Math.sin(angle) * 6.45,
    );
  }
  return new Vector3(
    Math.cos(angle) * 2.45,
    10.05 + (index % 2 === 0 ? 0.35 : -0.2),
    Math.sin(angle) * 2,
  );
}

/** Alternating meshes keep the photographed warm/cool canvas facet rhythm. */
function compoundRoofGeometry(parity: 0 | 1): BufferGeometry {
  const normals: number[] = [];
  const positions: number[] = [];
  for (let index = parity; index < 16; index += 2) {
    const next = index + 1;
    const outer = roofRingPoint("outer", index);
    const outerNext = roofRingPoint("outer", next);
    const peak = roofRingPoint("peak", index);
    const peakNext = roofRingPoint("peak", next);
    const inner = roofRingPoint("inner", index);
    const innerNext = roofRingPoint("inner", next);
    addQuad(positions, normals, outer, outerNext, peakNext, peak);
    addQuad(positions, normals, peak, peakNext, innerNext, inner);
    addTriangle(positions, normals, inner, innerNext, new Vector3(0, 10.62, 0));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function gableRoofGeometry(
  width: number,
  depth: number,
  rise: number,
): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const frontLeft = new Vector3(-width / 2, -rise / 2, depth / 2);
  const frontRight = new Vector3(width / 2, -rise / 2, depth / 2);
  const frontRidge = new Vector3(0, rise / 2, depth / 2);
  const backLeft = new Vector3(-width / 2, -rise / 2, -depth / 2);
  const backRight = new Vector3(width / 2, -rise / 2, -depth / 2);
  const backRidge = new Vector3(0, rise / 2, -depth / 2);
  addQuad(positions, normals, frontLeft, backLeft, backRidge, frontRidge);
  addQuad(positions, normals, frontRidge, backRidge, backRight, frontRight);
  addTriangle(positions, normals, frontLeft, frontRight, frontRidge);
  addTriangle(positions, normals, backRight, backLeft, backRidge);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function cylinderMatrix(start: Vector3, end: Vector3): Matrix4 {
  const direction = end.clone().sub(start);
  const rotation = new Quaternion().setFromUnitVectors(
    UP,
    direction.clone().normalize(),
  );
  return new Matrix4().compose(
    start.clone().add(end).multiplyScalar(0.5),
    rotation,
    new Vector3(1, direction.length(), 1),
  );
}

function addRoofRibs(group: Group): void {
  const pairs: Array<[Vector3, Vector3]> = [];
  for (let index = 0; index < 16; index += 1) {
    const outer = roofRingPoint("outer", index);
    const peak = roofRingPoint("peak", index);
    const inner = roofRingPoint("inner", index);
    pairs.push([outer, peak], [peak, inner], [inner, new Vector3(0, 10.62, 0)]);
  }
  const ribMaterial = material(0x766c60, { metalness: 0.12, roughness: 0.68 });
  const ribs = new InstancedMesh(
    new CylinderGeometry(0.055, 0.055, 1, 6),
    ribMaterial,
    pairs.length,
  );
  ribs.name = "TIPI forty-eight batched canvas seam ribs";
  pairs.forEach(([start, end], index) => {
    ribs.setMatrixAt(index, cylinderMatrix(start, end));
  });
  ribs.instanceMatrix.needsUpdate = true;
  ribs.computeBoundingBox();
  ribs.computeBoundingSphere();
  ribs.castShadow = true;
  group.add(ribs);
}

const DOT_GLYPHS: Record<string, string[]> = {
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
};

export function tipiMarqueeTransforms(
  text: string,
  options: { centerY: number; spacing: number; z?: number },
): InstanceTransform[] {
  const { centerY, spacing } = options;
  const glyphAdvance = spacing * 6;
  const width = text.length * glyphAdvance - spacing;
  const transforms: InstanceTransform[] = [];
  for (
    let characterIndex = 0;
    characterIndex < text.length;
    characterIndex += 1
  ) {
    const glyph = DOT_GLYPHS[text[characterIndex]];
    if (!glyph) continue;
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== "1") continue;
        transforms.push({
          position: [
            -width / 2 + characterIndex * glyphAdvance + column * spacing,
            centerY + (3 - row) * spacing,
            options.z ?? MARQUEE_Z,
          ],
        });
      }
    }
  }
  return transforms;
}

function addEntrancePavilion(group: Group): void {
  const timber = material(0x4b3328, { roughness: 0.88 });
  const timberHighlight = material(0x79523a, { roughness: 0.82 });
  const darkGlass = nightEmitter(
    material(0x26383c, { metalness: 0.14, opacity: 0.82, roughness: 0.24 }),
    0x79b8c6,
    0.42,
  );
  addBox(
    group,
    "TIPI low dark-timber entrance hall",
    [35.5, 4.2, 4.6],
    [0, 2.1, 13.8],
    timber,
  );
  addInstances(
    group,
    "TIPI two symmetric entrance gables",
    gableRoofGeometry(11.2, 5.6, 3.3),
    timberHighlight,
    [-1, 1].map((side) => ({ position: [side * 10.35, 5.55, 13.5] })),
  );
  addBox(
    group,
    "TIPI central raised foyer pavilion",
    [10.2, 4.6, 5.3],
    [0, 6.0, 11.8],
    timber,
  );
  addBox(
    group,
    "TIPI projecting entrance canopy",
    [11.1, 0.36, 6.2],
    [0, 8.48, 11.8],
    timberHighlight,
  );
  addInstances(
    group,
    "TIPI four raised foyer blue-grey glazing fields",
    new BoxGeometry(1.65, 2.4, 0.22),
    darkGlass,
    [-3.6, -1.2, 1.2, 3.6].map((x) => ({
      position: [x, 6.05, 14.52],
    })),
  );
  addInstances(
    group,
    "TIPI eight entrance door fields",
    new BoxGeometry(2.75, 2.85, 0.22),
    darkGlass,
    Array.from({ length: 8 }, (_, index) => ({
      position: [-14.3 + index * 4.08, 1.75, 16.16],
    })),
  );
  const railingTransforms: InstanceTransform[] = [];
  for (let index = 0; index < 11; index += 1) {
    railingTransforms.push({ position: [-5 + index, 9.15, 14.28] });
  }
  addInstances(
    group,
    "TIPI central roof-deck railing posts",
    new BoxGeometry(0.08, 1.15, 0.08),
    material(0xb0aaa1, { metalness: 0.38, roughness: 0.42 }),
    railingTransforms,
  );
  addBox(
    group,
    "TIPI Kasse ticket booth",
    [3.9, 3.2, 2.3],
    [14.1, 1.6, 16.0],
    timberHighlight,
  );
  addBox(
    group,
    "TIPI Kasse warm service window",
    [2.2, 1.2, 0.12],
    [14.1, 2.05, 17.2],
    nightEmitter(material(0x796349), 0xffcf7d, 1.1),
  );
  addInstances(
    group,
    "TIPI four entrance planters",
    new CylinderGeometry(0.48, 0.62, 0.78, 10),
    material(0x596956, { roughness: 0.9 }),
    [-12.1, -9.8, 9.8, 12.1].map((x) => ({
      position: [x, 0.39, 16.3],
    })),
  );
}

function addMarquee(group: Group): void {
  const darkBoard = material(0x171416, { roughness: 0.66 });
  addBox(
    group,
    "TIPI two-line Pigor and Eichhorn marquee board",
    [26.8, 4.35, 0.44],
    [0, 7.25, 15.72],
    darkBoard,
  );
  const title = tipiMarqueeTransforms(TIPI_AM_KANZLERAMT_PROFILE.marquee, {
    centerY: 8.35,
    spacing: 0.225,
  });
  const subtitle = tipiMarqueeTransforms(
    TIPI_AM_KANZLERAMT_PROFILE.todayMarquee,
    { centerY: 6.3, spacing: 0.162 },
  );
  // Opaque square cells keep both invented lines readable in Day, Snowstorm,
  // Schwellenraum and the flat-material fallback. Spherical bulbs sit just in
  // front and provide the restrained Night glow without owning legibility.
  addInstances(
    group,
    "TIPI PIGOR & EICHHORN high-contrast letter cells",
    new BoxGeometry(0.18, 0.18, 0.08),
    nightEmitter(
      material(0xd6a92d, { metalness: 0.28, roughness: 0.34 }),
      0xffbd3d,
      1.7,
    ),
    title.map((transform) => ({
      ...transform,
      position: [transform.position[0], transform.position[1], 15.99],
    })),
  );
  addInstances(
    group,
    "TIPI PIGOR & EICHHORN golden marquee bulbs",
    new SphereGeometry(0.084, 7, 5),
    nightEmitter(
      material(0x9b7621, { metalness: 0.42, roughness: 0.28 }),
      0xffbd3d,
      5.4,
    ),
    title,
  );
  addInstances(
    group,
    "TIPI NUR HEUTE ABEND golden marquee bulbs",
    new SphereGeometry(0.066, 7, 5),
    nightEmitter(
      material(0xb48724, { metalness: 0.36, roughness: 0.3 }),
      0xffc957,
      5.1,
    ),
    subtitle,
  );
}

function addSatellitePavilions(group: Group): void {
  const canvas = nightEmitter(
    material(0xe9e7df, { roughness: 0.94 }),
    0xffb56f,
    0.1,
  );
  addInstances(
    group,
    "TIPI two large side pavilions",
    new ConeGeometry(7.1, 10.6, 20, 1, true),
    canvas,
    [-1, 1].map((side) => ({
      position: [side * 18.1, 5.3, 5.8],
      scale: [1, 1, 0.82],
    })),
  );
  addInstances(
    group,
    "TIPI two smaller rear pavilions",
    new ConeGeometry(4.2, 7.8, 16, 1, true),
    canvas,
    [-1, 1].map((side) => ({
      position: [side * 10.5, 3.9, -10.2],
      scale: [1, 1, 0.86],
    })),
  );
}

function addCanvasLights(group: Group): void {
  const transforms: InstanceTransform[] = [];
  for (let rib = 0; rib < 16; rib += 1) {
    const outer = roofRingPoint("outer", rib);
    const peak = roofRingPoint("peak", rib);
    for (let step = 0; step <= 8; step += 1) {
      const t = step / 8;
      transforms.push({
        position: [
          outer.x + (peak.x - outer.x) * t,
          outer.y + (peak.y - outer.y) * t + 0.08,
          outer.z + (peak.z - outer.z) * t,
        ],
      });
    }
  }
  addInstances(
    group,
    "TIPI warm canvas-rib string bulbs",
    new SphereGeometry(0.078, 6, 4),
    nightEmitter(material(0x8d7443), 0xffd27a, 4.1),
    transforms,
  );

  const washColors = [0xff477e, 0x47d7ff, 0xa967ff, 0xffb13b];
  washColors.forEach((color, index) => {
    const angle = (-42 + index * 28) * (Math.PI / 180);
    const light = new PointLight(color, 7, 28, 1.5);
    light.name = `TIPI restrained concert light ${index + 1}`;
    light.position.set(Math.sin(angle) * 9.8, 4.1, Math.cos(angle) * 9.8);
    light.visible = false;
    light.userData.nightOnly = true;
    group.add(light);
  });
}

export function createTipiAmKanzleramt(
  anchorWorld: readonly [number, number, number],
): Group {
  const group = new Group();
  group.name = "Granular TIPI am Kanzleramt show tent";
  group.position.set(anchorWorld[0], TIPI_GROUND_Y, anchorWorld[2]);
  group.rotation.y = TIPI_ROTATION_Y;
  group.userData = {
    collisionRole: "visual-recognition-over-source-terrain",
    ellipseLengthM: TIPI_AM_KANZLERAMT_PROFILE.ellipseLengthM,
    ellipseWidthM: TIPI_AM_KANZLERAMT_PROFILE.ellipseWidthM,
    geometryStatus: TIPI_AM_KANZLERAMT_PROFILE.geometryStatus,
    marquee: TIPI_AM_KANZLERAMT_PROFILE.marquee,
    marqueeAlwaysVisible: true,
    marqueeIsOwnerAuthored: true,
    mainRoofPeakCount: TIPI_AM_KANZLERAMT_PROFILE.mainRoofPeakCount,
    sourceUrls: [...TIPI_AM_KANZLERAMT_PROFILE.sourceUrls],
    todayMarquee: TIPI_AM_KANZLERAMT_PROFILE.todayMarquee,
  };

  const skirtMaterial = nightEmitter(
    material(0xd9d6ce, { roughness: 0.94 }),
    0xffb56f,
    0.1,
  );
  const skirt = addMesh(
    group,
    "TIPI elliptical canvas skirt",
    new CylinderGeometry(13, 13, 3.35, 32, 1, true),
    skirtMaterial,
    [0, 1.675, 0],
  );
  skirt.scale.x = 16 / 13;

  addMesh(
    group,
    "TIPI main peaked canvas roof",
    compoundRoofGeometry(0),
    nightEmitter(material(0xeeeae0, { roughness: 0.94 }), 0xffb86b, 0.1),
    [0, 0, 0],
  );
  addMesh(
    group,
    "TIPI alternating cool compound roof facets",
    compoundRoofGeometry(1),
    nightEmitter(material(0xcfcfc9, { roughness: 0.95 }), 0xbd5f82, 0.07),
    [0, 0, 0],
  );
  addRoofRibs(group);
  addSatellitePavilions(group);
  addEntrancePavilion(group);
  addMarquee(group);
  addCanvasLights(group);
  return group;
}

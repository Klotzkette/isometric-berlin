import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix3,
  Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, Vector2, Vector3,
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { CALDER_LOCAL_FIT_V221 as FIT, NATIONALGALERIE_SCULPTURES_V221 as P } from "./nationalgalerieSculpturesV221Profile";
import { createNationalgalerieApronV221 } from "./NationalgalerieApronV221";

type Point = [number, number, number];
type Plate = { shape: Shape; depth: number; yaw: number; position: Point; color: number; bulge?: number; bevel?: number };
type Block = [number, number, number, number, number, number, number];
const STEEL = 0x20282b, BRONZE = 0x6c634d, PLINTH = 0x414b50;

class SculptureBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];

  add(geometry: BufferGeometry, matrix: Matrix4, color: number): void {
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const point = new Vector3(), normal = new Vector3(), normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const rgb = new Color(color), offset = this.positions.length / 3;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
      const shade = .52 + .48 * Math.max(0, .35 * normal.x + .80 * normal.y + .48 * normal.z);
      this.positions.push(point.x, point.y, point.z);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colors.push(rgb.r * shade, rgb.g * shade, rgb.b * shade);
    }
    if (geometry.index) for (const index of geometry.index.array) this.indices.push(offset + index);
    else for (let i = 0; i < positions.count; i++) this.indices.push(offset + i);
    geometry.dispose();
  }

  finish(name: string, native: boolean, blocks: Block[] = []): Group {
    const root = new Group(); root.name = name;
    let mesh: Mesh;
    const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
    const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .68, metalness: .18 });
    if (native) {
      const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
      const normals = geometry.getAttribute("normal"), colors = new Float32Array(normals.count * 3);
      for (let i = 0; i < normals.count; i++) {
        const shade = normals.getY(i) > 0 ? 1 : normals.getY(i) < 0 ? .63 : normals.getX(i) !== 0 ? .82 : .72;
        colors.fill(shade, i * 3, i * 3 + 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      const instances = new InstancedMesh(geometry, day, 0), matrix = new Matrix4(), rgb = new Color();
      const matrices = new Float32Array(blocks.length * 16), tints = new Float32Array(blocks.length * 3);
      blocks.forEach(([x, y, z, w, h, d, tint], i) => {
        matrix.makeScale(w, h, d).setPosition(x, y, z).toArray(matrices, i * 16);
        rgb.setHex(tint).toArray(tints, i * 3);
      });
      instances.count = blocks.length;
      instances.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
      instances.instanceColor = new InstancedBufferAttribute(tints, 3);
      instances.computeBoundingBox(); instances.computeBoundingSphere(); mesh = instances;
    } else {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
      geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
      geometry.setIndex(this.indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      mesh = new Mesh(geometry, day);
    }
    mesh.name = name + (native ? " independent voxel surface" : " continuous sculpted surface");
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true,
      blockNative: native, nativeMinecraft: native, keepInMinecraft: native };
    mesh.castShadow = true; mesh.receiveShadow = true;
    let gpuBytes = mesh.geometry.index?.array.byteLength ?? 0;
    for (const attribute of Object.values(mesh.geometry.attributes)) gpuBytes += attribute.array.byteLength;
    if (mesh instanceof InstancedMesh) gpuBytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
    root.add(mesh);
    root.userData = { textureFree: true, fullAndMobileIdentical: true, fullStaticDetailOnTouch: true,
      blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
      gpuBytes, instanceCount: blocks.length, geometryStatus: P.geometryStatus, source: P.source };
    freezeStaticSceneTransforms(mesh);
    return root;
  }
}

function plateMatrix(plate: Plate): Matrix4 {
  return new Matrix4().makeRotationY(plate.yaw).setPosition(...plate.position);
}

function addPlate(batch: SculptureBatch, plate: Plate): void {
  const bevel = plate.bevel ?? 0;
  let geometry: BufferGeometry = new ExtrudeGeometry(plate.shape, {
    depth: plate.depth, curveSegments: 18, steps: 1,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 4,
  });
  geometry.translate(0, 0, -plate.depth / 2);
  geometry.deleteAttribute("uv");
  if (plate.bulge) {
    // Interior cap samples make the bronze a genuinely curved volume rather
    // than a flat polygon with only a rounded perimeter.
    const original = geometry.getAttribute("position"), refined: number[] = [];
    const triangle = (a: Vector3, b: Vector3, c: Vector3, depth: number): void => {
      if (depth < 3 && Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) > .40) {
        const ab = a.clone().add(b).multiplyScalar(.5), bc = b.clone().add(c).multiplyScalar(.5), ca = c.clone().add(a).multiplyScalar(.5);
        triangle(a, ab, ca, depth + 1); triangle(ab, b, bc, depth + 1);
        triangle(ca, bc, c, depth + 1); triangle(ab, bc, ca, depth + 1);
      } else refined.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    };
    for (let i = 0; i < original.count; i += 3)
      triangle(new Vector3().fromBufferAttribute(original, i), new Vector3().fromBufferAttribute(original, i + 1), new Vector3().fromBufferAttribute(original, i + 2), 0);
    geometry.dispose(); geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(refined, 3));
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      positions.setZ(i, z + plate.bulge * Math.sin(y * 1.6) * Math.cos(x * 1.3));
    }
    geometry.deleteAttribute("normal");
    const welded = mergeVertices(geometry, .00001); geometry.dispose(); geometry = welded;
    geometry.computeVertexNormals();
  }
  batch.add(geometry, plateMatrix(plate), plate.color);
}

function disk(x: number, y: number, rx: number, ry: number): Shape {
  const shape = new Shape(); shape.absellipse(x, y, rx, ry, 0, 2 * Math.PI, false, -.18); return shape;
}

function calderPlates(): Plate[] {
  const plates: Plate[] = [];
  // Three intersecting cut-steel sheets retain six split feet, six upright heads
  // and generous openings. The tail sheet contributes the seventh foot.
  for (let i = 0; i < 3; i++) {
    const shape = new Shape(), yaw = [0, 1.1, -1.13][i];
    shape.moveTo(-1.65, 0); shape.lineTo(-1.48, 0);
    shape.bezierCurveTo(-.85, 1.0, -.68, 1.7, -.38, 1.87);
    shape.bezierCurveTo(.0, 1.76, .62, .62, 1.35, 0);
    shape.lineTo(1.54, 0); shape.bezierCurveTo(.75, 1.52, .69, 2.15, .83, 2.87);
    shape.bezierCurveTo(.92, 3.41, 1.05, 4.05, 1.08, 4.64 - i * .14);
    shape.lineTo(.91, 4.65 - i * .14); shape.bezierCurveTo(.80, 3.67, .54, 3.27, .25, 3.18);
    shape.bezierCurveTo(-.16, 3.14, -.43, 3.55, -.65, 4.91 - i * .18);
    shape.lineTo(-.82, 4.92 - i * .18); shape.bezierCurveTo(-.70, 3.70, -1.20, 2.15, -1.15, 1.82);
    shape.bezierCurveTo(-1.13, 1.20, -1.38, .45, -1.65, 0); shape.closePath();
    const position: Point = [i === 0 ? -.3 : .05, 0, i === 0 ? .02 : -.07];
    const color = [STEEL, 0x262d2e, 0x1c2428][i];
    plates.push({ shape, depth: .045, yaw, position, color });
    for (const [x, y, rx, ry] of [[-.735, 4.94 - i * .18, .30, .25], [1, 4.66 - i * .14, .23, .20]])
      plates.push({ shape: disk(x, y, rx, ry), depth: .045, yaw, position, color });
  }
  const tail = new Shape();
  tail.moveTo(2.35, 0); tail.lineTo(2.17, 0);
  tail.bezierCurveTo(1.37, 1.34, .62, 1.88, -.85, 2.10);
  tail.lineTo(-.89, 2.64); tail.bezierCurveTo(.34, 2.71, 1.66, 3.17, 1.94, 3.93);
  tail.bezierCurveTo(2.16, 4.51, 1.72, 5.24, 1.61, 5.49);
  tail.bezierCurveTo(2.21, 4.94, 2.53, 4.23, 2.34, 3.65);
  tail.bezierCurveTo(2.13, 3.03, 1.37, 2.77, 1.48, 1.90);
  tail.bezierCurveTo(1.55, 1.22, 1.94, .54, 2.35, 0); tail.closePath();
  plates.push({ shape: tail, depth: .055, yaw: 0, position: [0, 0, .055], color: 0x22292b });
  return plates;
}

function insidePolygon(x: number, y: number, ring: readonly Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Samples the analytic profiles independently; it never constructs a smooth
 * mesh for Minecraft. Hidden cells are omitted and adjacent exterior cells merge. */
function nativeSurface(bounds: Point, cell: number, occupied: (x: number, y: number, z: number) => number): Block[] {
  const nx = Math.ceil(bounds[0] / cell), ny = Math.ceil(bounds[1] / cell), nz = Math.ceil(bounds[2] / cell);
  const cells = new Uint32Array(nx * ny * nz), index = (i: number, j: number, k: number) => (j * nz + k) * nx + i;
  const x = (i: number) => (i + .5 - nx / 2) * cell, z = (k: number) => (k + .5 - nz / 2) * cell;
  const has = (i: number, j: number, k: number) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz ? cells[index(i, j, k)] : 0;
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++)
    cells[index(i, j, k)] = occupied(x(i), (j + .5) * cell, z(k));
  const exterior = (i: number, j: number, k: number) => has(i, j, k) &&
    (!has(i - 1, j, k) || !has(i + 1, j, k) || !has(i, j - 1, k) || !has(i, j + 1, k) || !has(i, j, k - 1) || !has(i, j, k + 1));
  const blocks: Block[] = [];
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx;) {
    if (!exterior(i, j, k)) { i++; continue; }
    const start = i, color = has(i, j, k);
    do { i++; } while (i < nx && exterior(i, j, k) && has(i, j, k) === color);
    const height = Math.min(cell, bounds[1] - j * cell);
    blocks.push([(x(start) + x(i - 1)) / 2, j * cell + height / 2, z(k), (i - start) * cell, height, cell, color]);
  }
  return blocks;
}

function plateOccupancy(plates: Plate[], padding: number): (x: number, y: number, z: number) => number {
  const profiles = plates.map(plate => ({ ...plate, ring: plate.shape.getPoints(18), c: Math.cos(plate.yaw), s: Math.sin(plate.yaw) }));
  return (x, y, z) => {
    for (const p of profiles) {
      const dx = x - p.position[0], dy = y - p.position[1], dz = z - p.position[2];
      const u = p.c * dx - p.s * dz, v = p.s * dx + p.c * dz;
      const warp = (p.bulge ?? 0) * Math.sin(dy * 1.6) * Math.cos(u * 1.3);
      if (Math.abs(v - warp) <= p.depth / 2 + (p.bevel ?? 0) + padding && insidePolygon(u, dy, p.ring)) return p.color;
    }
    return 0;
  };
}

/** Principal reading faces +Z. Feet are at Y=0; caller may position the root. */
export function createCalderTetesEtQueueV221(native = false): Group {
  const batch = new SculptureBatch(), plates = calderPlates();
  if (!native) {
    for (const plate of plates) addPlate(batch, plate);
    const cap = new ExtrudeGeometry(disk(0, 0, .14, .12), { depth: .025, bevelEnabled: false, curveSegments: 12 });
    batch.add(cap, new Matrix4().makeRotationX(-Math.PI / 2).setPosition(1.61, 5.475, .055), STEEL);
  }
  const plate = plateOccupancy(plates, .065);
  const blocks = native ? nativeSurface([5.0, 5.5, 3.4], .13, (x, y, z) =>
    y > 5.39 && Math.hypot(x - 1.61, z - .055) < .19 ? STEEL : plate(x, y, z)) : [];
  const root = batch.finish("Alexander Calder — Têtes et Queue (1965)", native, blocks);
  const mesh = root.children[0];
  mesh.scale.set(FIT.scaleX, 1, FIT.scaleZ);
  mesh.position.set(-FIT.centerX * FIT.scaleX, 0, -FIT.centerZ * FIT.scaleZ); mesh.updateMatrix();
  root.userData = { ...root.userData, sculptureId: P.calder.id, artist: P.calder.artist,
    sourceUrls: P.calder.sourceUrls, steelSheets: 4, uprightHeads: 6, splitFeet: 7, heightM: P.calder.heightM };
  return root;
}

function moorePlates(): Plate[] {
  const broad = new Shape();
  broad.moveTo(-.08, .08); broad.bezierCurveTo(-.62, .26, -1.28, .85, -1.30, 1.43);
  broad.bezierCurveTo(-1.38, 1.98, -.92, 2.20, -.51, 2.19);
  broad.bezierCurveTo(-.43, 1.86, -.41, 1.60, -.20, 1.44);
  broad.bezierCurveTo(.01, 1.28, .20, 1.22, .21, .95);
  broad.bezierCurveTo(.11, .63, -.01, .40, -.08, .08); broad.closePath();
  const upright = new Shape();
  upright.moveTo(.09, .04); upright.bezierCurveTo(.08, .45, -.03, .67, -.22, .83);
  upright.bezierCurveTo(-.45, 1.07, -.56, 1.27, -.53, 1.45);
  upright.bezierCurveTo(-.12, 1.28, .27, 1.61, .34, 2.19);
  upright.lineTo(.89, 2.21); upright.bezierCurveTo(.87, 1.76, .84, 1.44, 1.04, 1.24);
  upright.bezierCurveTo(.86, .94, .65, .54, .69, .06); upright.closePath();
  return [
    { shape: broad, depth: .19, bevel: .045, yaw: -.16, position: [0, .8, -.09], color: BRONZE, bulge: -.28 },
    { shape: upright, depth: .24, bevel: .045, yaw: .39, position: [.08, .8, -.24], color: 0x746951, bulge: .23 },
  ];
}

const CROSSPIECE_POINTS: Point[] = [[-.56, 2.07, .68], [-.30, 1.94, .27], [.22, 1.94, .23], [.94, 1.99, .60]];
function crosspieceGeometry(): BufferGeometry {
  const curve = new CatmullRomCurve3(CROSSPIECE_POINTS.map(p => new Vector3(...p))), segments = 28, sides = 32;
  const frames = curve.computeFrenetFrames(segments, false), positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPointAt(t), radius = .22 + .09 * Math.abs(t * 2 - 1) ** 2;
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const p = center.clone().addScaledVector(frames.normals[i], Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * radius);
      positions.push(p.x, p.y, p.z);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  // Real end disks, separately triangulated to keep the two prominent round cuts.
  for (const end of [0, segments]) {
    const center = curve.getPointAt(end / segments), c = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    const first = positions.length / 3;
    for (let j = 0; j <= sides; j++) {
      const old = (end * (sides + 1) + j) * 3;
      positions.push(positions[old], positions[old + 1], positions[old + 2]);
    }
    for (let j = 0; j < sides; j++) {
      const a = first + j;
      if (end === 0) indices.push(c, a + 1, a); else indices.push(c, a, a + 1);
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function pedestalGeometry(): BufferGeometry {
  const shape = new Shape(); shape.absarc(0, 0, P.moore.pedestalRadiusM, 0, Math.PI * 2, false);
  const hole = new Shape(); hole.absarc(0, 0, P.moore.pedestalRadiusM - .065, 0, Math.PI * 2, true); shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, { depth: .8, curveSegments: 24, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2); return geometry;
}

/** Bronze body and hollow circular steel pedestal; plinth bottom is Y=0. */
export function createMooreArcherV221(native = false): Group {
  const batch = new SculptureBatch(), plates = moorePlates();
  let blocks: Block[] = [];
  if (native) {
    const plate = plateOccupancy(plates, .025);
    const curve = new CatmullRomCurve3(CROSSPIECE_POINTS.map(p => new Vector3(...p)));
    const centers = curve.getSpacedPoints(32);
    blocks = nativeSurface([2.9, 3.08, 2.5], .13, (x, y, z) => {
      const radius = Math.hypot(x, z);
      if (y < .8 && radius <= P.moore.pedestalRadiusM + .025 && radius >= P.moore.pedestalRadiusM - .13) return PLINTH;
      const color = plate(x, y, z); if (color) return color;
      for (let i = 0; i < centers.length; i++) {
        const p = centers[i], r = .22 + .09 * Math.abs(i / 32 * 2 - 1) ** 2;
        if ((x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2 < r * r) return BRONZE;
      }
      return 0;
    });
  } else {
    for (const plate of plates) addPlate(batch, plate);
    batch.add(crosspieceGeometry(), new Matrix4(), 0x817352);
    batch.add(pedestalGeometry(), new Matrix4(), PLINTH);
  }
  const root = batch.finish("Henry Moore — Three Way Piece No. 2: Archer (1964)", native, blocks);
  root.userData = { ...root.userData, sculptureId: P.moore.id, artist: P.moore.artist,
    sourceUrls: P.moore.sourceUrls, interlockingMembers: 3, hollowPedestal: true,
    pedestalHeightM: .8, figureHeightM: 2.25, heightM: P.moore.heightM, heightStatus: P.heightStatus };
  return root;
}

export type NationalgalerieSculpturePlacementV221 = { centerXZ: readonly number[]; baseY: number; yaw: number };

/** Two artwork meshes plus one exact paving-complement mesh, all in city coordinates. */
export function createNationalgalerieSculpturesV221(native = false, placements: {
  calder: NationalgalerieSculpturePlacementV221; moore: NationalgalerieSculpturePlacementV221;
} = P): Group {
  const root = new Group(); root.name = "Nationalgalerie terrace sculptures v221" + (native ? " native" : "");
  const calder = createCalderTetesEtQueueV221(native), moore = createMooreArcherV221(native);
  for (const [sculpture, placement] of [[calder, placements.calder], [moore, placements.moore]] as const) {
    sculpture.position.set(placement.centerXZ[0], placement.baseY, placement.centerXZ[1]);
    sculpture.rotation.y = placement.yaw; freezeStaticSceneTransforms(sculpture); root.add(sculpture);
  }
  const apron = createNationalgalerieApronV221(native); root.add(apron);
  const sculptureGpuBytes = calder.userData.gpuBytes + moore.userData.gpuBytes;
  const sculptureInstanceCount = calder.userData.instanceCount + moore.userData.instanceCount;
  root.userData = { nationalgalerieSculpturesV221: true, textureFree: true,
    fullAndMobileIdentical: true, fullStaticDetailOnTouch: true,
    blockNative: native, nativeMinecraft: native, keepInMinecraft: native,
    sculptureIds: [P.calder.id, P.moore.id], source: P.source, geometryStatus: P.geometryStatus,
    sculptureGpuBytes, sculptureInstanceCount,
    apronGpuBytes: apron.userData.gpuBytes, apronInstanceCount: apron.userData.instanceCount,
    gpuBytes: sculptureGpuBytes + apron.userData.gpuBytes,
    instanceCount: sculptureInstanceCount + apron.userData.instanceCount };
  return freezeStaticSceneTransforms(root);
}

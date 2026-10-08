import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Path, Quaternion, Shape, ShapeGeometry, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import source from "./data/ostkreuzV190.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";

type Roof = typeof source.roofs[number];
type Rows = number[][];
const STEEL = 0x747e7b, ROOF = 0xb7bdb7, BALLAST = 0x8c918a;
function height(roof: Roof, x: number, z: number): number {
  const f = roof.frame, v = -(x - f.x) * f.dz + (z - f.z) * f.dx;
  return roof.top - (roof.hall ? 3.5 * (v / (f.width / 2)) ** 2 : 0);
}
function inRing(ring: number[][], x: number, z: number): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function contains(rings: number[][][], x: number, z: number): boolean {
  return inRing(rings[0], x, z) && !rings.slice(1).some(r => inRing(r, x, z));
}
function skin(rings: number[][][], y: (x: number, z: number) => number): BufferGeometry {
  const shape = new Shape(rings[0].map(([x, z]) => new Vector2(x, -z)));
  shape.holes = rings.slice(1).map(r => new Path(r.map(([x, z]) => new Vector2(x, -z))));
  const geometry = new ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) positions.setY(i, y(positions.getX(i), positions.getZ(i)));
  geometry.deleteAttribute("uv"); geometry.computeVertexNormals(); return geometry;
}
function cells(rows: Rows, rings: number[][][], y: (x: number, z: number) => number, color: number): void {
  const r = rings[0], minX = Math.min(...r.map(p => p[0])), maxX = Math.max(...r.map(p => p[0]));
  const minZ = Math.min(...r.map(p => p[1])), maxZ = Math.max(...r.map(p => p[1]));
  for (let x = minX; x < maxX; x += 2) for (let z = minZ; z < maxZ; z += 2) {
    const w = Math.min(2, maxX - x), d = Math.min(2, maxZ - z), cx = x + w / 2, cz = z + d / 2;
    if (contains(rings, cx, cz)) rows.push([cx, y(cx, cz) - .10, cz, w, .20, d, color]);
  }
}
/** Three-dimensional bars; native construction uses only world-axis cubes. */
function bar(rows: Rows, native: boolean, a: number[], b: number[], width: number, depth: number, color = STEEL): void {
  const length = Math.hypot(...b.map((v, i) => v - a[i])); if (length < .001) return;
  if (!native) { rows.push([...a, ...b, width, depth, color]); return; }
  const n = Math.max(1, Math.ceil(length / 1.5));
  for (let i = 0; i < n; i++) rows.push([
    ...a.map((v, j) => v + (b[j] - v) * (i + .5) / n),
    Math.max(width, Math.abs(b[0] - a[0]) / n),
    Math.max(depth, Math.abs(b[1] - a[1]) / n),
    Math.max(width, Math.abs(b[2] - a[2]) / n), color,
  ]);
}
function bars(rows: Rows, native: boolean): InstancedMesh {
  if (native) return justicePalaceV183Boxes(rows, true);
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .86 });
  const mesh = new InstancedMesh(geometry, day, 0), matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const a = new Vector3(), b = new Vector3(), dir = new Vector3(), mid = new Vector3();
  const q = new Quaternion(), matrix = new Matrix4(), scale = new Vector3(), color = new Color(), axis = new Vector3(1, 0, 0);
  rows.forEach((r, i) => {
    a.fromArray(r); b.fromArray(r, 3); dir.subVectors(b, a); const length = dir.length();
    q.setFromUnitVectors(axis, dir.normalize()); mid.addVectors(a, b).multiplyScalar(.5);
    matrix.compose(mid, q, scale.set(length, r[7], r[6])).toArray(matrices, i * 16);
    color.setHex(r[8]).toArray(colors, i * 3);
  });
  mesh.count = rows.length; mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}
function merged(parts: BufferGeometry[], color: number, name: string): Mesh {
  const geometry = mergeGeometries(parts, false)!; for (const part of parts) part.dispose();
  const day = new MeshBasicMaterial({ color, side: DoubleSide });
  const night = new MeshStandardMaterial({ color, side: DoubleSide, roughness: .85 });
  const mesh = new Mesh(geometry, day); mesh.name = name;
  mesh.userData = { textureFree: true, dayMaterial: day, nightMaterial: night };
  return mesh;
}

export function createOstkreuzV190(native = false): Group {
  const root = new Group(); root.name = "Ostkreuz open hall and separated local rail crossing v190";
  root.userData = { sourceOwnerIds: source.ownerIds, sourceStatus: source.policy, textureFree: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native, openRailMouths: true };
  const steel: Rows = [], blockRoofs: Rows = [], glassBlocks: Rows = [], deckBlocks: Rows = [];
  const caps: BufferGeometry[] = [], decks: BufferGeometry[] = [], glazing: number[] = [];
  for (const [x, z, base, top, width] of source.supports)
    bar(steel, native, [x, base, z], [x, top, z], width, width, 0x92968d);
  for (const roof of source.roofs) {
    if (native) cells(blockRoofs, roof.rings, (x, z) => height(roof, x, z), ROOF);
    else for (const panel of roof.roofPanels) caps.push(skin(panel, (x, z) => height(roof, x, z)));
    if (roof.floor > 10) {
      if (native) cells(deckBlocks, roof.rings, () => 11.1, BALLAST);
      else decks.push(skin(roof.rings, () => 11.1));
    }
    for (const section of roof.sections) {
      const [a, b] = section;
      if (roof.hall) {
        for (const p of [a, b]) bar(steel, native, [p[0], roof.floor, p[1]], [p[0], height(roof, ...p as [number, number]), p[1]], .42, .45);
        for (let j = 0; j < 8; j++) {
          const q = (t: number) => { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; return [x, height(roof, x, z) - .3, z]; };
          bar(steel, native, q(j / 8), q((j + 1) / 8), .32, .45);
        }
      } else {
        const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
        bar(steel, native, [x, roof.floor, z], [x, roof.top, z], .30, .34);
        bar(steel, native, [a[0], roof.top - .2, a[1]], [b[0], roof.top - .2, b[1]], .25, .32);
      }
    }
    // Source polygon boundary retains real taper; glass is confined to the
    // upper hall. End glazing begins 6.2 m above its deck, leaving rail mouths.
    for (const ring of roof.rings) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ya = height(roof, a[0], a[1]), yb = height(roof, b[0], b[1]);
      if (!roof.hall) {
        bar(steel, native, [a[0], ya, a[1]], [b[0], yb, b[1]], .28, .32);
        continue;
      }
      const along = Math.abs(((b[0] - a[0]) * roof.frame.dx + (b[1] - a[1]) * roof.frame.dz) / len);
      const bottom = roof.floor + (along > .7 ? .12 : 6.2);
      const n = Math.max(1, Math.ceil(len / 3));
      for (let j = 0; j < n; j++) {
        // Keep the complete original boundary, subdividing only along it.
        // End glazing and fascia follow the barrel crown, not an eave-to-eave
        // chord that would leave an unrepresented opening above the glass.
        const ax = a[0] + (b[0] - a[0]) * j / n, az = a[1] + (b[1] - a[1]) * j / n;
        const bx = a[0] + (b[0] - a[0]) * (j + 1) / n, bz = a[1] + (b[1] - a[1]) * (j + 1) / n;
        const ay = height(roof, ax, az), by = height(roof, bx, bz);
        bar(steel, native, [ax, ay, az], [bx, by, bz], .28, .32);
        if (!native) glazing.push(ax, bottom, az, bx, bottom, bz, bx, by, bz, ax, bottom, az, bx, by, bz, ax, ay, az);
        const t = (j + .5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, top = height(roof, x, z);
        if (native) glassBlocks.push([x, (bottom + top) / 2, z, Math.max(.08, Math.abs(b[0] - a[0]) / n), top - bottom, Math.max(.08, Math.abs(b[1] - a[1]) / n), 0x97b6b4]);
        bar(steel, native, [x, bottom, z], [x, top, z], .10, .10);
      }
      for (let y = bottom + 2.1; y < Math.min(ya, yb); y += 2.1) bar(steel, native, [a[0], y, a[1]], [b[0], y, b[1]], .10, .10);
    }
  }
  for (const track of source.tracks) for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1], b = track.points[i], dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz);
    if (len < .01) continue;
    for (const offset of [-.7175, .7175]) bar(steel, native,
      [a[0] - dz / len * offset, a[1], a[2] + dx / len * offset],
      [b[0] - dz / len * offset, b[1], b[2] + dx / len * offset], .10, .15, 0x515954);
    // A shallow sleeper pair follows each finite source segment, including
    // graded approach interpolation. It never crosses between separate ways.
    const x = (a[0] + b[0]) / 2, z = (a[2] + b[2]) / 2, y = (a[1] + b[1]) / 2 - .13;
    bar(steel, native, [x - dz / len * 1.2, y, z + dx / len * 1.2], [x + dz / len * 1.2, y, z - dx / len * 1.2], .22, .18, 0x817f70);
  }
  if (native) {
    const roofMesh = justicePalaceV183Boxes(blockRoofs, true); roofMesh.name = "Ostkreuz independent block barrel roof and canopies"; root.add(roofMesh);
    const deckMesh = justicePalaceV183Boxes(deckBlocks, true); deckMesh.name = "Ostkreuz elevated open bridge deck blocks"; root.add(deckMesh);
  } else {
    root.add(merged(caps, ROOF, "Ostkreuz four complete source roof plans"));
    root.add(merged(decks, BALLAST, "Ostkreuz elevated open bridge deck"));
  }
  let glass: Mesh;
  if (native) glass = justicePalaceV183Boxes(glassBlocks, true);
  else { const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(glazing, 3)); geometry.computeVertexNormals(); glass = new Mesh(geometry); }
  const glassDay = new MeshBasicMaterial({ color: 0x8caeaf, opacity: .19, transparent: true, depthWrite: false, side: DoubleSide });
  glass.material = glassDay; glass.userData.dayMaterial = glassDay; glass.userData.nightMaterial = glassDay;
  glass.name = "Ostkreuz translucent side and upper end glazing with open rail mouths";
  glass.userData.textureFree = true; root.add(glass);
  const frame = bars(steel, native); frame.name = "Ostkreuz open steel frames and source track grades"; root.add(frame);
  return root;
}

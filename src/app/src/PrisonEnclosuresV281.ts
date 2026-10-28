import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector3,
} from 'three';
import source from './data/prisonEnclosuresV281.json';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

type Point = readonly number[];
type Box = [number, number, number, number, number, number, number, number];
type Site = 'moabit' | 'hsh';
const BRICK = 0x79574b, COPING = 0xafa99b, CREAM = 0xb4aa91;
const GLASS = 0x374d50, FRAME = 0xc6c4b8, ROOF = 0x626b64;
export const PRISON_ENCLOSURES_V281_PROFILE = source;
export const PRISON_ENCLOSURES_V281_CAMERAS = {
  moabit: { position: [-840, 120, -420], target: [-1090, 10, -690], spanM: 360 },
  hsh: { position: [8640, 110, -2220], target: [8865, 7, -2350], spanM: 300 },
};

function nativeWallCell(x: number, z: number): boolean {
  if (source.gatePoints.some(p => Math.hypot(x + .5 - p[0], z + .5 - p[1]) < 2.1)) return false;
  return source.walls.some(([ax, az, bx, bz]) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 4);
    let low = 0, high = 1;
    for (const [a, d, min] of [[ax, bx - ax, x], [az, bz - az, z]]) {
      if (Math.abs(d) < 1e-12) { if (a < min || a >= min + 1) return false; }
      else {
        const t0 = (min - a) / d, t1 = (min + 1 - 1e-9 - a) / d;
        low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
      }
    }
    return Math.ceil(low * n - 1e-9) <= Math.floor(high * n + 1e-9);
  });
}

function materials(vertexColors = true) {
  return { dayMaterial: new MeshBasicMaterial({ vertexColors, side: DoubleSide }),
    nightMaterial: new MeshStandardMaterial({ vertexColors, side: DoubleSide,
      roughness: .9, flatShading: true }), textureFree: true };
}

function segment(rows: Box[], a: Point, b: Point, y: number, height: number,
  width: number, color: number, native: boolean): void {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (length < .001) return;
  if (!native) {
    rows.push([(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2,
      length, height, width, -Math.atan2(dz, dx), color]);
    return;
  }
  // Independent cardinal members, with no rotated smooth mesh underneath.
  const count = Math.max(1, Math.ceil(length / 1.2));
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count;
    rows.push([a[0] + dx * t, y, a[1] + dz * t,
      Math.max(width, Math.abs(dx) / count), height,
      Math.max(width, Math.abs(dz) / count), 0, color]);
  }
}

function wallRows(native: boolean): Box[] {
  const rows: Box[] = [], bottom = source.ground, h = source.wallHeightEstimate;
  if (!native) {
    for (const [ax, az, bx, bz] of source.walls) {
      segment(rows, [ax, az], [bx, bz], bottom + h / 2, h, .48, BRICK, false);
      segment(rows, [ax, az], [bx, bz], bottom + h + .09, .18, .6, COPING, false);
    }
    return rows;
  }
  // A one-metre native wall skin is losslessly packed into equal-colour runs.
  const cells = new Set<string>();
  for (const [ax, az, bx, bz] of source.walls) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 4);
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(ax + (bx - ax) * i / n);
      const z = Math.floor(az + (bz - az) * i / n);
      if (source.gatePoints.some(p => Math.hypot(x + .5 - p[0], z + .5 - p[1]) < 2.1)) continue;
      cells.add(`${x},${z}`);
    }
  }
  const ordered = [...cells].sort((a, b) => {
    const aa = a.split(',').map(Number), bb = b.split(',').map(Number);
    return aa[1] - bb[1] || aa[0] - bb[0];
  });
  const runs: number[][] = [];
  for (const key of ordered) {
    if (!cells.delete(key)) continue;
    const [x, z] = key.split(',').map(Number);
    let width = 1;
    while (cells.delete(`${x + width},${z}`)) width++;
    const prior = runs.find(r => r[0] === x && r[2] === width && r[1] + r[3] === z);
    if (prior) prior[3]++; else runs.push([x, z, width, 1]);
  }
  for (const [x, z, w, d] of runs) {
    rows.push([x + w / 2, bottom + h / 2, z + d / 2, w, h, d, 0, BRICK]);
    rows.push([x + w / 2, bottom + h + .09, z + d / 2, w, .18, d, 0, COPING]);
  }
  return rows;
}

function batch(rows: Box[], native: boolean, name: string): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const material = materials(false), mesh = new InstancedMesh(geometry, material.dayMaterial, 0);
  const matrices = new Float32Array(rows.length * 16), colors = new Float32Array(rows.length * 3);
  const matrix = new Matrix4(), scale = new Vector3(), color = new Color();
  rows.forEach((r, i) => {
    if (native) matrix.makeScale(r[3], r[4], r[5]);
    else matrix.makeRotationY(r[6]).scale(scale.set(r[3], r[4], r[5]));
    matrix.setPosition(r[0], r[1], r[2]).toArray(matrices, i * 16);
    color.setHex(r[7]).toArray(colors, i * 3);
  });
  mesh.count = rows.length;
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.userData = { ...material, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, noHiddenSolidInfill: true };
  mesh.name = name; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  return mesh;
}

/** Additive exterior architecture only: all earlier source bodies stay rendered. */
export function createPrisonEnclosuresV281(native = false,
  _options: { mobileLike?: boolean } = {}, site?: Site): Group {
  const root = new Group(), rows: Box[] = [], roofPositions: number[] = [];
  root.name = `Prison exterior enclosures v281${native ? ' independent native' : ''}`;
  root.userData = { textureFree: true, sourceGeometryRetained: true,
    fullStaticDetailOnTouch: true, nativeMinecraft: native, blockNative: native,
    keepInMinecraft: native, exteriorOnly: true, historicalParkUnchanged: true,
    sourceReceipt: 'prison-enclosures-v281-source.json', noSourceReplacement: true };
  if (!site) {
    root.add(createPrisonEnclosuresV281(native, _options, 'moabit'),
      createPrisonEnclosuresV281(native, _options, 'hsh'));
    return freezeStaticSceneTransforms(root);
  }
  if (!site || site === 'moabit') rows.push(...wallRows(native));
  for (const tower of source.towers) {
    if (site && tower.site !== site) continue;
    const ring = tower.ring;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const hsh = tower.site === 'hsh', glassHeight = hsh ? .72 : 1.3;
    const glassY = tower.top - .22 - glassHeight / 2;
    // Native skins sit outside the retained one-metre source skin.
    const reach = native ? .72 : .035;
    const exterior = ring.map(p => {
      const length = Math.hypot(p[0] - cx, p[1] - cz);
      return [p[0] + (p[0] - cx) / length * reach,
        p[1] + (p[1] - cz) / length * reach];
    });
    if (native && !tower.bodyPresent)
      rows.push([cx, tower.top + .04, cz, 2, .08, 2, 0, ROOF]);
    for (let i = 0; i < ring.length; i++) {
      const a = exterior[i], b = exterior[(i + 1) % ring.length];
      if (!tower.bodyPresent) segment(rows, ring[i], ring[(i + 1) % ring.length],
        (tower.bottom + tower.top) / 2, tower.top - tower.bottom, .14, CREAM, native);
      segment(rows, a, b, glassY, glassHeight, native ? .13 : .055, GLASS, native);
      for (const y of [glassY - glassHeight / 2, tower.top - .2])
        segment(rows, a, b, y, .10, native ? .17 : .10, FRAME, native);
      if (hsh || i % 3 === 0) rows.push([a[0], glassY, a[1], .10, glassHeight,
        .10, 0, FRAME]);
      if (!native) {
        // Shallow photographed roof/coping recognition is a 0.22 m estimate.
        // The complete earlier flat source roof remains underneath.
        roofPositions.push(a[0], tower.top + .015, a[1], b[0], tower.top + .015,
          b[1], cx, tower.top + .22, cz);
      } else segment(rows, a, b, tower.top + .08, .16, .25, ROOF, true);
    }
  }
  root.add(batch(rows, native, 'Mapped outer Moabit walls and five public tower exteriors'));
  if (roofPositions.length) {
    const g = new BufferGeometry(), c = new Color(ROOF), colors = new Float32Array(roofPositions.length);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    g.setAttribute('position', new BufferAttribute(new Float32Array(roofPositions), 3));
    g.setAttribute('color', new BufferAttribute(colors, 3)); g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere();
    const m = materials(), roof = new Mesh(g, m.dayMaterial); roof.userData = m;
    roof.name = 'Shallow estimated roof caps above unchanged source tower roofs'; root.add(roof);
  }
  return freezeStaticSceneTransforms(root);
}

/** Matching new wall collision only; no blanket prison or memorial closure. */
export function prisonEnclosuresV281SolidAt(x: number, y: number, z: number,
  radius = 0, native = false): boolean {
  if (x > 8793 && x < 8803 && z > -2415 && z < -2404) {
    const tower = source.towers[2];
    if (y >= tower.bottom && y <= tower.top) {
      for (let i = 0; i < tower.ring.length; i++) {
        const a = tower.ring[i], b = tower.ring[(i + 1) % tower.ring.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
        if (native) {
          const n = Math.ceil(length / 1.2);
          for (let j = 0; j < n; j++) {
            const t = (j + .5) / n;
            if (Math.abs(x - a[0] - dx * t) <= Math.max(.14, Math.abs(dx) / n) / 2 + radius &&
              Math.abs(z - a[1] - dz * t) <= Math.max(.14, Math.abs(dz) / n) / 2 + radius) return true;
          }
        } else {
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length)));
          if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) <= .07 + radius) return true;
        }
      }
    }
    return false;
  }
  if (x < -1285 || x > -970 || z < -805 || z > -570 ||
    y < source.ground || y > source.ground + source.wallHeightEstimate + .18) return false;
  if (native) {
    for (let cx = Math.floor(x - radius); cx <= Math.floor(x + radius); cx++)
      for (let cz = Math.floor(z - radius); cz <= Math.floor(z + radius); cz++)
        if (nativeWallCell(cx, cz)) return true;
    return false;
  }
  return source.walls.some(([ax, az, bx, bz]) => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - t * dx, z - az - t * dz) <= .30 + radius;
  });
}

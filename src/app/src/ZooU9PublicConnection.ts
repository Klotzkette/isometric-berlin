import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshBasicMaterial, ShapeUtils, Vector2,
} from "three";
import profile from "./data/zooU9PublicConnection.json";
import { indexGeometryExactly } from "./exactGeometryIndex";
import { interleaveStaticGeometry } from "./interleaveStaticGeometry";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { UbahnAccessOpeningV326 } from "./UbahnAccessV326";

type Point = readonly number[];
type Plan = readonly Point[];
type Rectangle = readonly [number, number, number, number];
type Floor = { ring: Plan; y: number; tint: number };
type Wall = { a: Point; b: Point; low: number; high: number };

const CELL = 0.25;
const RISERS = 26;
const RISE = 0.17;
const HALF_STAIR = 1.1;
const FLOOR = 0xbeb7a6;
const LANDING = 0xc7bdab;
const TILE = 0xddccaa;
const BASEBOARD = 0x777468;
const LIGHT = 0xfff6da;

function pointInRing(x: number, z: number, ring: Plan): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function rectangle([x, z, endX, endZ]: Rectangle): Plan {
  return [[x, z], [endX, z], [endX, endZ], [x, endZ]];
}

function edges(plan: Plan) {
  return plan.slice(1).map((b, i) => [plan[i], b] as const);
}

/** Native uses its own cardinal floor cells. A row's identical treads share one rectangle. */
function nativeFloors(ring: Plan, sample: (x: number, z: number) => number, tint: number): Floor[] {
  const startX = Math.floor(Math.min(...ring.map(p => p[0])) / CELL);
  const endX = Math.ceil(Math.max(...ring.map(p => p[0])) / CELL);
  const startZ = Math.floor(Math.min(...ring.map(p => p[1])) / CELL);
  const endZ = Math.ceil(Math.max(...ring.map(p => p[1])) / CELL);
  const floors: Floor[] = [];
  for (let row = startZ; row < endZ; row++) {
    const z = (row + .5) * CELL;
    let run = startX, y: number | null = null;
    for (let col = startX; col <= endX; col++) {
      const x = (col + .5) * CELL;
      const next = col < endX && pointInRing(x, z, ring) ? sample(x, z) : null;
      if (next === y) continue;
      if (y !== null) {
        floors.push({ ring: rectangle([run * CELL, row * CELL, col * CELL, (row + 1) * CELL]), y, tint });
      }
      run = col;
      y = next;
    }
  }
  return floors;
}

function cardinal(plan: Plan): Plan {
  const snap = (n: number) => Math.round(n / CELL) * CELL;
  const result: Point[] = [[snap(plan[0][0]), snap(plan[0][1])]];
  for (const [a, b] of edges(plan)) {
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / CELL);
    for (let i = 1; i <= count; i++) {
      const x = snap(a[0] + (b[0] - a[0]) * i / count);
      const z = snap(a[1] + (b[1] - a[1]) * i / count);
      const previous = result.at(-1)!;
      if (previous[0] !== x) result.push([x, previous[1]]);
      if (previous[1] !== z) result.push([x, z]);
    }
  }
  return result;
}

function distanceToLine(x: number, z: number, a: Point, b: Point): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const ratio = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - ratio * dx, z - a[1] - ratio * dz);
}

/** Use the already admitted exterior opening and its actual terrain datum. */
export function createZooU9PublicConnection(openings: readonly UbahnAccessOpeningV326[], native: boolean) {
  const opening = openings.find(entry => entry.id === profile.entry.id && entry.sourceWay === profile.entry.way);
  const lowerEnd = opening?.sourcePoints.at(-1);
  if (!opening || !lowerEnd || opening.native !== native || !Number.isFinite(opening.bottomY) ||
      Math.hypot(lowerEnd[0] - profile.entry.lower[0], lowerEnd[1] - profile.entry.lower[1]) > .015) return null;

  const upperY = opening.bottomY;
  const lowerY = upperY - RISERS * RISE;
  const [top, bottom] = profile.stair;
  const length = Math.hypot(bottom[0] - top[0], bottom[1] - top[1]);
  const dx = (bottom[0] - top[0]) / length, dz = (bottom[1] - top[1]) / length;
  const at = (u: number, v: number) => [top[0] + u * dx - v * dz, top[1] + u * dz + v * dx];
  const tread = (from: number, to: number): Plan =>
    [at(from, -HALF_STAIR), at(to, -HALF_STAIR), at(to, HALF_STAIR), at(from, HALF_STAIR)];
  const stairY = (x: number, z: number) => {
    const along = (x - top[0]) * dx + (z - top[1]) * dz;
    const step = Math.max(0, Math.min(RISERS, Math.floor(along * RISERS / length)));
    return upperY - step * RISE;
  };
  const walkable: Floor[] = [
    { ring: profile.upperFloor, y: upperY, tint: LANDING },
    { ring: profile.lowerFloor, y: lowerY, tint: FLOOR },
  ];
  const floors = native ? walkable.flatMap(floor => nativeFloors(floor.ring, () => floor.y, floor.tint)) : walkable.slice();
  const stairFloors = native
    ? nativeFloors(tread(0, length), stairY, FLOOR)
    : Array.from({ length: RISERS }, (_, index) => {
        const from = index * length / RISERS, to = (index + 1) * length / RISERS;
        return { ring: tread(from, to), y: upperY - index * RISE, tint: FLOOR };
      });

  const positions: number[] = [], colors: number[] = [], wallColliders: Wall[] = [];
  const tint = new Color();
  function triangle(a: Point, b: Point, c: Point, hex: number): void {
    positions.push(...a, ...b, ...c);
    tint.setHex(hex);
    for (let i = 0; i < 3; i++) colors.push(tint.r, tint.g, tint.b);
  }

  function quad(a: Point, b: Point, c: Point, d: Point, hex: number): void {
    triangle(a, b, c, hex);
    triangle(a, c, d, hex);
  }

  function surface(ring: Plan, y: number, hex: number): void {
    const vertices = ring.map(([x, z]) => new Vector2(x, z));
    for (const [a, b, c] of ShapeUtils.triangulateShape(vertices, [])) {
      triangle([ring[a][0], y, ring[a][1]], [ring[b][0], y, ring[b][1]], [ring[c][0], y, ring[c][1]], hex);
    }
  }

  function band(a: Point, b: Point, low: number, high: number, hex: number): void {
    quad([a[0], low, a[1]], [b[0], low, b[1]], [b[0], high, b[1]], [a[0], high, a[1]], hex);
  }

  function stripe(a: Point, b: Point, y: number, width: number, hex: number): void {
    if (native && width > 1) {
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const x = (b[1] - a[1]) / span * width / 2, z = (a[0] - b[0]) / span * width / 2;
      const ring = [[a[0] - x, a[1] - z], [b[0] - x, b[1] - z],
        [b[0] + x, b[1] + z], [a[0] + x, a[1] + z]];
      for (const floor of nativeFloors(ring, () => y, hex)) surface(floor.ring, y, hex);
      return;
    }
    for (const [p, q] of edges(native ? cardinal([a, b]) : [a, b])) {
      const span = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (span < .0001) continue;
      const x = (q[1] - p[1]) / span * width / 2, z = (p[0] - q[0]) / span * width / 2;
      surface([[p[0] - x, p[1] - z], [q[0] - x, q[1] - z],
        [q[0] + x, q[1] + z], [p[0] + x, p[1] + z]], y, hex);
    }
  }

  for (const floor of floors) surface(floor.ring, floor.y, floor.tint);
  for (const floor of stairFloors) {
    surface(floor.ring, floor.y, floor.tint);
    for (const [a, b] of edges([...floor.ring, floor.ring[0]])) band(a, b, floor.y - RISE * 2, floor.y, BASEBOARD);
  }
  floors.push(...stairFloors);

  function wall(plan: Plan, y: number, height: number): void {
    for (const [a, b] of edges(native ? cardinal(plan) : plan)) {
      band(a, b, y, y + .25, BASEBOARD);
      band(a, b, y + .25, y + height, TILE);
      wallColliders.push({ a, b, low: y, high: y + height });
    }
  }

  for (const line of profile.walls[0]) wall(line, upperY, 2.52);
  for (const line of profile.walls[1]) wall(line, lowerY, 2.6);
  for (const side of [-1, 1]) {
    for (let i = 0; i < RISERS; i++) {
      wall([at(length * i / RISERS, side * HALF_STAIR),
        at(length * (i + 1) / RISERS, side * HALF_STAIR)], upperY - i * RISE, 2.8);
    }
  }

  const ceiling = native ? nativeFloors(profile.upperFloor, () => upperY + 2.52, BASEBOARD) :
    [{ ring: profile.upperFloor, y: upperY + 2.52, tint: BASEBOARD }];
  for (const piece of ceiling) surface(piece.ring, piece.y, piece.tint);
  for (const [a, b] of edges(profile.approach)) stripe(a, b, upperY + 2.50, .16, LIGHT);
  for (const [a, b] of edges(profile.platform)) stripe(a, b, lowerY + .012, .18, 0xf2e9ca);
  for (const track of profile.tracks) {
    for (const [a, b] of edges(track.points)) {
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = (b[1] - a[1]) / span, nz = (a[0] - b[0]) / span;
      stripe(a, b, lowerY - .79, 3.0, 0x545252);
      for (const side of [-1, 1]) {
        const offset = side * .718;
        stripe([a[0] + nx * offset, a[1] + nz * offset], [b[0] + nx * offset, b[1] + nz * offset], lowerY - .64, .095, 0x9a9690);
      }
      const wallA = [a[0] + nx * 2.22, a[1] + nz * 2.22];
      const wallB = [b[0] + nx * 2.22, b[1] + nz * 2.22];
      const platformMid = profile.platform[0];
      // Both source track axes need the outer lining away from the island.
      const s = (platformMid[0] - a[0]) * nx + (platformMid[1] - a[1]) * nz;
      const lining = s < 0 ? [wallA, wallB] : [
        [a[0] - nx * 2.22, a[1] - nz * 2.22], [b[0] - nx * 2.22, b[1] - nz * 2.22],
      ];
      wall(lining, lowerY - .79, 4.12);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  indexGeometryExactly(geometry);
  geometry.userData.exactIndexPending = false;
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const root = new Group();
  root.name = "Zoologischer Garten public U9 passage and island platform";
  const mesh = new Mesh(geometry, material);
  mesh.name = "Zoologischer Garten mapped U9 circulation";
  mesh.userData = { dayMaterial: material, nightMaterial: material, textureFree: true, nativeMinecraft: native, keepInMinecraft: native };
  root.add(mesh);
  interleaveStaticGeometry(root);
  freezeStaticSceneTransforms(root);

  const bounds = floors.reduce((box, floor) => {
    for (const [x, z] of floor.ring) {
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], z);
      box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], z);
    }
    return box;
  }, [Infinity, Infinity, -Infinity, -Infinity]);

  let disposed = false;
  return {
    root,
    groundAt(x: number, z: number, currentY?: number): number | null {
      if (disposed || currentY === undefined || x < bounds[0] || z < bounds[1] ||
          x > bounds[2] || z > bounds[3] || currentY > upperY + 1 || currentY < lowerY - 1) return null;
      let best: number | null = null;
      for (const floor of floors) {
        if (floor.y > currentY + .64 || floor.y < currentY - .95 ||
            best !== null && Math.abs(floor.y - currentY) >= Math.abs(best - currentY)) continue;
        if (pointInRing(x, z, floor.ring)) best = floor.y;
      }
      return best;
    },
    solidAt(x: number, y: number, z: number, radius = 0): boolean {
      if (disposed || y < lowerY - .8 || y > upperY + 2.9 ||
          x < bounds[0] - 12 || z < bounds[1] - 12 || x > bounds[2] + 12 || z > bounds[3] + 12) return false;
      return wallColliders.some(wall => y >= wall.low && y <= wall.high &&
        distanceToLine(x, z, wall.a, wall.b) <= radius + .045);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

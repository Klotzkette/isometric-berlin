import {
  BoxGeometry, Color, CylinderGeometry, DynamicDrawUsage, Group, InstancedMesh,
  Matrix4, MeshBasicMaterial, Quaternion, Vector3,
} from "three";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import data from "./data/railAccessV334.json";

type Point = [x: number, z: number];
type Entry = [id: string, station: number, x: number, z: number, mode: "S" | "U" | "SU",
  kind: "stair" | "entrance" | "lift", travel: -1 | 0 | 1, heading: number | null, stair: string | null];
type Stair = [points: Point[], levels: number, count: number | null, width: number | null];
type Row = [x: number, y: number, z: number, w: number, h: number, d: number, color: number, yaw: number, roll?: number];
type Tread = { x: number; z: number; top: number; depth: number; width: number; yaw: number };
const entries = data.cells as unknown as Record<string, Entry[]>;
const stairs = data.stairs as unknown as Record<string, Stair>;
const RAD = 275;
const MAX_SIGNS = 42;
const MAX_BOXES = 1350;
const MAX_ROUNDS = MAX_SIGNS;
const MAX_LETTERS = 5200;
const LETTER_DISTANCE = 120;
const GREEN = 0x117a4a, BLUE = 0x285b84, PAPER = 0xf5f1de, INK = 0x253847, POLE = 0x696f6a;

export type RailAccessTerrainV334 = {
  ground(x: number, z: number): number | null;
  water(x: number, z: number): boolean;
  blocked(x: number, y: number, z: number): boolean;
  landing?(x: number, z: number, feetHint: number): number | null;
};

function candidateEntries(x: number, z: number): Entry[] {
  const out: Entry[] = [];
  const cell = data.cellMeters;
  for (let j = Math.floor((z - RAD) / cell); j <= Math.floor((z + RAD) / cell); j++) {
    for (let i = Math.floor((x - RAD) / cell); i <= Math.floor((x + RAD) / cell); i++) {
      const tile = entries[`${i}_${j}`];
      if (tile) out.push(...tile);
    }
  }
  const d = (entry: Entry) => (entry[2] - x) ** 2 + (entry[3] - z) ** 2;
  return out.filter(entry => d(entry) <= RAD ** 2).sort((a, b) => d(a) - d(b) || a[0].localeCompare(b[0]));
}

function support(entry: Entry, terrain: RailAccessTerrainV334): [number, number, number] | null {
  const [, , x, z, , , , heading] = entry;
  for (const offset of heading === null ? [0] : [0, .7, 1.35, 2]) {
    const xx = x - Math.cos(heading ?? 0) * offset, zz = z - Math.sin(heading ?? 0) * offset;
    const y = terrain.ground(xx, zz);
    if (y != null && Number.isFinite(y) && !terrain.water(xx, zz) && !terrain.blocked(xx, y, zz)) return [xx, y, zz];
  }
  return null;
}

function sourceTreads(stair: Stair, terrain: RailAccessTerrainV334): Tread[] {
  if (!terrain.landing) return [];
  const [points, levels, taggedCount, taggedWidth] = stair;
  const a = points[0], b = points[points.length - 1];
  const base = terrain.ground(...a);
  if (base == null || !Number.isFinite(base) || terrain.water(...a) || terrain.blocked(a[0], base, a[1])) return [];
  const upperGround = terrain.ground(...b);
  if (upperGround == null || !Number.isFinite(upperGround)) return [];
  const top = terrain.landing(...b, base + (taggedCount ? taggedCount * .17 : levels * 3));
  if (top == null || !Number.isFinite(top)) return [];
  const rise = top - base;
  const legs = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const distance = legs.reduce((a, b) => a + b, 0);
  if (rise < .5 || rise > 12 || rise / distance < .12 || rise / distance > .9) return [];
  const count = taggedCount ?? Math.max(3, Math.round(rise / .17));
  const depth = distance / count;
  if (depth < .19 || depth > .75 || rise / count < .09 || rise / count > .24) return [];
  const output: Tread[] = [];
  let leg = 0, accumulated = 0;
  for (let i = 0; i < count; i++) {
    const at = depth * (i + .5);
    while (leg < legs.length - 1 && accumulated + legs[leg] < at) accumulated += legs[leg++];
    const a = points[leg], b = points[leg + 1];
    if (legs[leg] < .02) return [];
    const t = (at - accumulated) / legs[leg];
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    const y = base + rise * (i + 1) / count;
    if (terrain.blocked(x, y, z) || terrain.water(x, z)) return [];
    output.push({ x, z, top: y, depth, width: taggedWidth ?? 1.7, yaw: -Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  return output;
}

function treadRows(treads: Tread[], native: boolean): Row[] {
  const out: Row[] = [];
  for (const [i, t] of treads.entries()) {
    const { x, z, top, depth, width, yaw } = t;
    const shade = i % 2 ? 0xb3afa5 : 0xbdb8af;
    const dx = Math.cos(yaw), dz = -Math.sin(yaw);
    if (!native) {
      out.push([x, top - .12, z, depth + .025, .24, width, shade, yaw]);
    } else {
      // Small orthogonal cells tile each recorded tread across the actual way.
      const n = Math.ceil(width / .34), widthCell = width / n;
      for (let j = 0; j < n; j++) {
        const lateral = (j + .5) * widthCell - width / 2;
        out.push([x - dz * lateral, top - .12, z + dx * lateral,
          Math.abs(dx) * depth + Math.abs(dz) * widthCell, .24,
          Math.abs(dz) * depth + Math.abs(dx) * widthCell, shade, 0]);
      }
    }
  }
  return out;
}

export function createRailAccessV334() {
  const root = new Group();
  root.name = "VBB verified public rail access v334";
  const boxes = new BoxGeometry(), circles = new CylinderGeometry(.5, .5, 1, 20);
  const material = new MeshBasicMaterial();
  const batch = new InstancedMesh(boxes, material, MAX_BOXES);
  const disks = new InstancedMesh(circles, material, MAX_ROUNDS);
  const strokes = new InstancedMesh(boxes, material, MAX_LETTERS);
  const pools = [batch, disks, strokes];
  for (const mesh of pools) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    root.add(mesh);
  }
  batch.name = "Grounded VBB street access signs and matched stair treads";
  disks.name = "S-Bahn circular marker bodies";
  strokes.name = "Two-sided station names and access marks";
  const transform = new Matrix4(), rotation = new Quaternion(), glyphRotation = new Quaternion();
  const position = new Vector3(), scale = new Vector3(), direction = new Vector3();
  const vertical = new Vector3(0, 1, 0), localDepth = new Vector3(0, 0, 1), color = new Color();
  const text = new Map<string, { width: number; paths: [number, number][][] }>();
  let last: { x: number; z: number; native: boolean; revision: number } | null = null;
  let disposed = false;

  function upload(pool: InstancedMesh, rows: Row[]) {
    pool.count = rows.length;
    rows.forEach(([x, y, z, w, h, d, rgb, yaw, roll], i) => {
      if (pool === disks) {
        rotation.setFromUnitVectors(vertical, direction.set(Math.cos(yaw), 0, Math.sin(yaw)));
      } else {
        rotation.setFromAxisAngle(vertical, yaw);
        if (roll !== undefined) rotation.multiply(glyphRotation.setFromAxisAngle(localDepth, roll));
      }
      pool.setMatrixAt(i, transform.compose(position.set(x, y, z), rotation, scale.set(w, h, d)));
      pool.setColorAt(i, color.setHex(rgb));
    });
    pool.instanceMatrix.needsUpdate = true;
    if (pool.instanceColor) pool.instanceColor.needsUpdate = true;
  }

  function refresh(x: number, z: number, native: boolean, revision: number, terrain: RailAccessTerrainV334): boolean {
    if (disposed || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (last && last.native === native && last.revision === revision && Math.hypot(x - last.x, z - last.z) < 9) return false;
    last = { x, z, native, revision };
    const members: Row[] = [], badges: Row[] = [], symbolsOnly: Row[] = [];
    const selected: string[] = [];
    const namePanels: { panel: Row; lettering: Row[] }[] = [];
    const builtStairs = new Set<string>();
    for (const entry of candidateEntries(x, z)) {
      if (selected.length >= MAX_SIGNS || members.length + 5 > MAX_BOXES) break;
      const anchor = support(entry, terrain);
      if (!anchor) continue;
      const [xx, yy, zz] = anchor;
      const [id, station, ex, ez, mode, kind, travel, heading, stair] = entry;
      const angle = heading === null ? 0 : heading + Math.PI / 2;
      const yaw = native ? -Math.round(angle / (Math.PI / 2)) * Math.PI / 2 : -angle;
      const dx = Math.cos(yaw), dz = -Math.sin(yaw);
      const name = data.stations[station][1];
      const rgb = mode === "U" ? BLUE : GREEN;
      const symbols = mode === "SU" ? [["S", -.29, GREEN], ["U", .29, BLUE]] as const : [[mode, 0, rgb]] as const;
      members.push([xx, yy + 1.34, zz, .095, 2.68, .095, POLE, 0]);
      for (const [symbol, u, tint] of symbols) {
        const bx = xx + dx * u, bz = zz + dz * u;
        if (symbol === "S" && !native) {
          badges.push([bx, yy + 2.66, bz, .54, .095, .54, tint, angle - Math.PI / 2]);
        } else {
          members.push([bx, yy + 2.66, bz, .52, .52, .095, tint, yaw]);
        }
        appendText(symbolsOnly, symbol, .35, u, 2.485, PAPER);
      }

      // All symbols identify the exact selected stop. Longer labels appear at
      // street scale and use the project's deterministic, texture-free alphabet.
      if (Math.hypot(ex - x, ez - z) <= LETTER_DISTANCE) {
        const visibleName = name.toUpperCase().replace(/[^ A-ZÄÖÜ0-9.'()-]/g, " ");
        const detail = kind === "lift" ? "AUFZUG" : kind === "stair" ? travel > 0 ? "AUFGANG" : travel < 0 ? "ABGANG" : "TREPPE" : "EINGANG";
        let height = .205;
        let width = label(visibleName, height).width;
        if (width > 3.18) {
          height *= 3.18 / width;
          width = 3.18;
        }
        const lettering: Row[] = [];
        appendText(lettering, visibleName, height, 0, 2.13, INK);
        appendText(lettering, detail, .11, 0, 1.96, rgb);
        namePanels.push({
          panel: [xx, yy + 2.12, zz, Math.max(1.22, width + .21), .48, .085, PAPER, yaw],
          lettering,
        });
      }
      if (stair && !builtStairs.has(stair)) {
        const details = stairs[stair];
        const rows = treadRows(sourceTreads(details, terrain), native);
        if (members.length + rows.length <= MAX_BOXES && rows.length) {
          members.push(...rows);
          builtStairs.add(stair);
        }
      }
      selected.push(id);

      function appendText(target: Row[], value: string, height: number, u: number, y: number, tint: number) {
        const paths = label(value, height).paths;
        const weight = Math.max(.014, height * .13);
        for (const face of [-1, 1]) for (const path of paths) for (let j = 1; j < path.length; j++) {
          const [ax, ay] = path[j - 1], [bx, by] = path[j];
          const length = Math.hypot(bx - ax, by - ay);
          if (!length) continue;
          const steps = native ? Math.max(1, Math.ceil(length / Math.max(weight * .88, .021))) : 1;
          const width = native ? Math.max(weight, Math.abs(bx - ax) / steps + weight * .7) : length + weight;
          const h = native ? Math.max(weight, Math.abs(by - ay) / steps + weight * .7) : weight;
          const roll = native ? undefined : Math.atan2(by - ay, (bx - ax) * face);
          for (let k = 0; k < steps; k++) {
            const t = (k + .5) / steps;
            const lateral = u + (ax + (bx - ax) * t) * face;
            target.push([xx + dx * lateral - dz * face * .059, yy + y + ay + (by - ay) * t,
              zz + dz * lateral + dx * face * .059, width, h, .018, tint, yaw, roll]);
          }
        }
      }
    }
    for (const { panel, lettering } of namePanels) {
      if (members.length >= MAX_BOXES || symbolsOnly.length + lettering.length > MAX_LETTERS) break;
      members.push(panel);
      symbolsOnly.push(...lettering);
    }
    upload(batch, members);
    upload(disks, badges);
    upload(strokes, symbolsOnly);
    root.userData = { railAccessV334: true, native, sourceIds: selected, stairWays: Array.from(builtStairs) };
    return true;
  }

  function label(value: string, height: number) {
    const key = `${value}:${height.toFixed(4)}`;
    const cached = text.get(key);
    if (cached) return cached;
    const fresh = { width: letteringLayout(value, height).totalWidthM, paths: letteringStrokePaths(value, height) };
    if (text.size >= 160) text.clear();
    text.set(key, fresh);
    return fresh;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const mesh of pools) mesh.dispose();
    boxes.dispose();
    circles.dispose();
    material.dispose();
    text.clear();
    root.clear();
  }
  return { root, refresh, dispose };
}

export type RailAccessV334 = ReturnType<typeof createRailAccessV334>;

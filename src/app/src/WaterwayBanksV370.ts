import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  masonryTileMetresV370,
  ownBankMasonryMapV370,
  waterwayMasonryMapV370,
  type BankMasonryV370,
} from "./waterwayMasonryV370";

export interface WaterwayBankV370 {
  id: string;
  water: string;
  material: string;
  points: readonly (readonly number[])[];
  waterSide?: number;
  height?: number;
  waterY?: number;
  topY?: readonly number[];
  width?: number;
  faceOffset?: number;
  brickPlinthHeight?: number;
  reed?: boolean;
  profile?: string;
}
export type BankWaterLevelV370 = number | ((x: number, z: number, water: string) => number);
type P = [number, number, number];
type XZ = [number, number];
type Finish = "plain" | BankMasonryV370;
type Part = { pos: number[]; rgb: number[]; uv: number[]; index: number[]; ids: Set<string> };
type Put = (finish: Finish, a: P, b: P, c: P, d: P, hex: number, uv?: number[]) => void;
type Section = {
  p(s: number, y: number, offset: number): P;
  top(s: number): number;
  water(s: number): number;
  length: number;
  chain: number;
};

const STEEL = [0x696963, 0x5b605c, 0x737169, 0x484f4c];
const WET_STEEL = [0x4e5550, 0x46514c, 0x565b52, 0x3b4943];
const STEEL_CAP = 0x87877b,
  WALER = 0x565852;
const CONCRETE = 0xaaa99c,
  DAMP = 0x777e71,
  COPING = 0xb7b4a4;
const GRID = 0.5;
const finite = Number.isFinite;
const distinct = (a: readonly number[], b: readonly number[]) => a[0] !== b[0] || a[1] !== b[1];
const safe = (p: readonly number[] | undefined) => !!p && finite(p[0]) && finite(p[1]);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const tint = new Color();

function normal(a: readonly number[], b: readonly number[], side: number): XZ {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  return [(-side * dz) / length, (side * dx) / length];
}

/** A shared offset at a polyline vertex closes the joints between adjacent faces.
 * Limit the miter at tight corners, including near-reversals in the source line. */
function join(incoming: XZ, outgoing: XZ): XZ {
  const sx = incoming[0] + outgoing[0],
    sz = incoming[1] + outgoing[1];
  const denominator = sx * outgoing[0] + sz * outgoing[1];
  if (denominator < 1e-6) return outgoing;
  const scale = Math.min(1 / denominator, 1.65 / Math.hypot(sx, sz));
  return [sx * scale, sz * scale];
}

function verticalUV(kind: BankMasonryV370, lo: number, hi: number, a: P, b: P, c: P, d: P): number[] {
  const [w, h] = masonryTileMetresV370[kind];
  const u = lo / w - Math.floor(lo / w),
    v = Math.floor(Math.min(a[1], b[1]) / h);
  const end = u + (hi - lo) / w;
  return [u, a[1] / h - v, end, b[1] / h - v, end, c[1] / h - v, u, d[1] / h - v];
}
const masonry = (kind: string): BankMasonryV370 | undefined =>
  kind === "brick" || kind === "stone" || kind === "mixed-masonry" ? kind : undefined;

function upright(
  put: Put,
  q: Section,
  lo: number,
  hi: number,
  d0: number,
  d1: number,
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  color: number,
  kind?: BankMasonryV370,
) {
  const a = q.p(lo, a0, d0),
    b = q.p(hi, a1, d1),
    c = q.p(hi, b1, d1),
    d = q.p(lo, b0, d0);
  put(
    kind ?? "plain",
    a,
    b,
    c,
    d,
    color,
    kind ? verticalUV(kind, q.chain + lo, q.chain + hi, a, b, c, d) : undefined,
  );
}

function shelf(
  put: Put,
  q: Section,
  a: number,
  b: number,
  front0: number,
  front1: number,
  back: number,
  y0: number,
  y1: number,
  tone: number,
) {
  put("plain", q.p(a, y0, back), q.p(b, y1, back), q.p(b, y1, front1), q.p(a, y0, front0), tone);
}

function steel(put: Put, q: Section, lo: number, hi: number) {
  // Each rolled section has two flanges and two inclined webs. Profile phase
  // follows chainage through survey vertices, rather than restarting at each one.
  const pitch = 0.72,
    stops = [0, 0.25, 0.46, 0.75, 1],
    folds = [0.13, 0.13, 0.34, 0.34, 0.13];
  const bottom = (s: number) => Math.min(q.water(s) - 0.32, q.top(s) - 0.3);
  const stain = (s: number) => Math.min(q.water(s) + 0.16, q.top(s) - 0.08);
  for (let unit = Math.floor((q.chain + lo) / pitch); unit * pitch < q.chain + hi; unit++) {
    for (let i = 0; i < 4; i++) {
      const start = (unit + stops[i]) * pitch - q.chain,
        end = (unit + stops[i + 1]) * pitch - q.chain;
      const a = Math.max(lo, start),
        b = Math.min(hi, end);
      if (b - a < 1e-6) continue;
      const depth = (s: number) => mix(folds[i], folds[i + 1], (s - start) / (end - start));
      const da = depth(a),
        db = depth(b);
      upright(put, q, a, b, da, db, bottom(a), bottom(b), stain(a), stain(b), WET_STEEL[i]);
      upright(put, q, a, b, da, db, stain(a), stain(b), q.top(a), q.top(b), STEEL[i]);
      shelf(put, q, a, b, da, db, -0.035, q.top(a), q.top(b), STEEL_CAP);
    }
  }
  const railTop = (s: number) => q.top(s) - Math.max(0.1, (q.top(s) - q.water(s)) * 0.27);
  upright(
    put,
    q,
    lo,
    hi,
    0.405,
    0.405,
    railTop(lo) - 0.13,
    railTop(hi) - 0.13,
    railTop(lo),
    railTop(hi),
    WALER,
  );
  shelf(put, q, lo, hi, 0.405, 0.405, 0.15, railTop(lo), railTop(hi), 0x79796c);
}

function wall(put: Put, q: Section, lo: number, hi: number, material: string) {
  const kind = masonry(material),
    edge = 0.16,
    cap = 0.11;
  const shoulder = (s: number) => q.top(s) - cap;
  const wet = (s: number) => Math.min(q.water(s) + 0.17, shoulder(s) - 0.03);
  const foot = (s: number) => Math.min(q.water(s) - 0.32, wet(s) - 0.15);
  upright(put, q, lo, hi, edge, edge, foot(lo), foot(hi), wet(lo), wet(hi), kind ? 0xc2c6b8 : DAMP, kind);
  upright(
    put,
    q,
    lo,
    hi,
    edge,
    edge,
    wet(lo),
    wet(hi),
    shoulder(lo),
    shoulder(hi),
    kind ? 0xffffff : CONCRETE,
    kind,
  );
  upright(put, q, lo, hi, 0.2, 0.2, shoulder(lo), shoulder(hi), q.top(lo), q.top(hi), COPING);
  shelf(put, q, lo, hi, 0.2, 0.2, -0.23, q.top(lo), q.top(hi), 0xc4c0b0);
  // Separate coping stones and the longer movement joints in poured concrete.
  const pitch = 1.62;
  for (let n = Math.ceil((q.chain + lo) / pitch); n * pitch < q.chain + hi; n++) {
    const a = n * pitch - q.chain,
      b = Math.min(hi, a + 0.019);
    shelf(put, q, a, b, 0.2, 0.2, -0.23, q.top(a) + 0.002, q.top(b) + 0.002, 0x8e8d80);
    if (!kind && n % 3 === 0)
      upright(put, q, a, b, edge + 0.003, edge + 0.003, wet(a), wet(b), shoulder(a), shoulder(b), 0x899084);
  }
}

function slopeWidth(rec: WaterwayBankV370, height: number) {
  return finite(rec.width) && rec.width! > 0 ? rec.width! : Math.max(1.1, Math.min(7, 1.8 * height));
}
function slope(put: Put, q: Section, lo: number, hi: number, rec: WaterwayBankV370) {
  const paved = rec.profile === "paved-slope",
    sand = rec.profile === "sand";
  const colors = paved
    ? [0xffffff, 0xf8f7f1, 0xc5cabe]
    : sand
      ? [0xc9bb97, 0xc4b38d, 0x9b957c]
      : [0x929875, 0x8e8870, 0x697260];
  const steps = [0, 0.25, 0.79, 1];
  const width = (s: number) => slopeWidth(rec, q.top(s) - q.water(s));
  const at = (s: number, t: number) =>
    q.p(s, mix(q.top(s) + 0.025, q.water(s) - 0.23, t), mix(-0.075, width(s), t));
  for (let i = 0; i < 3; i++) {
    const a = steps[i],
      b = steps[i + 1];
    const u0 = q.chain + lo,
      u1 = q.chain + hi;
    const [w, h] = masonryTileMetresV370.setts;
    const base = Math.floor(u0 / w);
    put(
      paved ? "setts" : "plain",
      at(lo, a),
      at(hi, a),
      at(hi, b),
      at(lo, b),
      colors[i],
      paved
        ? [
            u0 / w - base,
            (a * width(lo)) / h,
            u1 / w - base,
            (a * width(hi)) / h,
            u1 / w - base,
            (b * width(hi)) / h,
            u0 / w - base,
            (b * width(lo)) / h,
          ]
        : undefined,
    );
  }
  if (!paved && (rec.reed || rec.profile === "reeds")) {
    for (let n = Math.ceil((q.chain + lo) / 13); n * 13 < q.chain + hi; n++) {
      const s = n * 13 - q.chain,
        band = width(s) * 0.91;
      for (let i = 0; i < 5; i++) {
        const d = band + (i % 2) * 0.1,
          u = s + (i - 2) * 0.065;
        const baseY = mix(q.top(s) + 0.025, q.water(s) - 0.23, 0.91);
        const blade = 0.45 + ((n + i * 3) % 5) * 0.092;
        const a = q.p(u - 0.025, baseY, d),
          b = q.p(u + 0.025, baseY, d);
        const c = q.p(u + 0.087, baseY + blade, d + 0.08 * (i - 2)),
          tip = q.p(u + 0.077, baseY + blade, d + 0.08 * (i - 2));
        put("plain", a, b, c, tip, i % 2 ? 0x838356 : 0x777f50);
      }
    }
  }
}

function isSlope(rec: WaterwayBankV370) {
  return (
    rec.material === "natural" ||
    rec.profile === "paved-slope" ||
    rec.profile === "sand" ||
    rec.profile === "reeds"
  );
}

type NativeCell = {
  x: number;
  z: number;
  x1: number;
  z1: number;
  bottom: number;
  top: number;
  water: number;
  kind: Finish;
  dry: number;
  wet: number;
  cap: number;
  wall: boolean;
};

/** Cardinal source walls, in particular V229's Panke, retain the exact
 * river-facing plane so existing painted strokes remain in front of the brick. */
function nativeAxisWall(put: Put, q: Section, rec: WaterwayBankV370, n: XZ, offset: number) {
  const pile = rec.material === "steel",
    kind = masonry(rec.material);
  const count = Math.max(1, Math.ceil(q.length / (pile ? GRID : 2)));
  for (let i = 0; i < count; i++) {
    const lo = (q.length * i) / count,
      hi = (q.length * (i + 1)) / count,
      s = (lo + hi) / 2;
    const a = q.p(lo, 0, -offset),
      b = q.p(hi, 0, -offset),
      water = q.water(s),
      top = Math.round(q.top(s) * 8) / 8;
    const depth = (pile ? (Math.floor((q.chain + s) / GRID) % 2 === 0 ? 0.34 : 0.13) : 0.16) + offset;
    const rear = offset - 0.12;
    const rect = (front: number, back: number) => {
      const xs = [a[0] + n[0] * front, b[0] + n[0] * front, a[0] + n[0] * back, b[0] + n[0] * back];
      const zs = [a[2] + n[1] * front, b[2] + n[1] * front, a[2] + n[1] * back, b[2] + n[1] * back];
      return { x: Math.min(...xs), x1: Math.max(...xs), z: Math.min(...zs), z1: Math.max(...zs) };
    };
    const body: NativeCell = {
      ...rect(depth, rear),
      bottom: Math.min(water - 0.32, top - 0.25),
      top,
      water,
      wall: true,
      kind: kind ?? "plain",
      dry: pile ? STEEL[i % 4] : kind ? 0xffffff : CONCRETE,
      wet: pile ? WET_STEEL[i % 4] : kind ? 0xc2c6b8 : DAMP,
      cap: pile ? STEEL_CAP : COPING,
    };
    nativeBox(put, body);
    if (pile) {
      const railTop = top - Math.max(0.1, (top - water) * 0.27);
      nativeBox(put, {
        ...body,
        ...rect(0.405 + offset, 0.12 + offset),
        wall: false,
        top: railTop,
        bottom: railTop - 0.13,
        cap: STEEL_CAP,
        dry: WALER,
      });
    }
  }
}

/** Independently rasterise the shoreline and slope onto square columns. All
 * Native faces and exposed risers are cardinal, even along diagonal water. */
function rasterBank(cells: Map<string, NativeCell>, q: Section, rec: WaterwayBankV370) {
  const slopeBank = isSlope(rec),
    pile = rec.material === "steel",
    kind = masonry(rec.material);
  const stepCount = Math.max(1, Math.ceil(q.length / (GRID / 2)));
  function add(
    p: P,
    bottom: number,
    top: number,
    water: number,
    finish: Finish,
    dry: number,
    wet: number,
    cap: number,
    wall: boolean,
  ) {
    const ix = Math.floor(p[0] / GRID),
      iz = Math.floor(p[2] / GRID),
      key = ix + "," + iz;
    if (!cells.has(key) || cells.get(key)!.top < top)
      cells.set(key, {
        x: ix * GRID,
        z: iz * GRID,
        x1: (ix + 1) * GRID,
        z1: (iz + 1) * GRID,
        bottom,
        top,
        water,
        kind: finish,
        dry,
        wet,
        cap,
        wall,
      });
  }
  for (let i = 0; i < stepCount; i++) {
    const s = ((i + 0.5) * q.length) / stepCount,
      top = q.top(s),
      water = q.water(s),
      base = Math.min(water - 0.32, top - 0.25);
    if (slopeBank) {
      const width = slopeWidth(rec, top - water),
        count = Math.max(2, Math.ceil(width / (GRID / 2)));
      for (let j = 0; j < count; j++) {
        const t = j / (count - 1),
          offset = mix(-0.075, width, t);
        const y = Math.round(mix(top + 0.025, water - 0.23, t) * 8) / 8;
        const paved = rec.profile === "paved-slope";
        const tone = paved
          ? 0xffffff
          : rec.profile === "sand"
            ? t > 0.78
              ? 0xa49d81
              : 0xc4b58f
            : t > 0.78
              ? 0x727962
              : t < 0.3
                ? 0x959976
                : 0x89836a;
        add(
          q.p(s, y, offset),
          Math.min(base, y - 0.12),
          y,
          water,
          paved ? "setts" : "plain",
          tone,
          tone,
          tone,
          false,
        );
      }
    } else {
      const forward = pile && Math.floor((q.chain + s) / GRID) % 2 === 0;
      const snapped = Math.round(top * 8) / 8;
      add(
        q.p(s, top, 0.14),
        base,
        snapped,
        water,
        pile ? "plain" : (kind ?? "plain"),
        pile ? STEEL[1] : kind ? 0xffffff : CONCRETE,
        pile ? WET_STEEL[0] : kind ? 0xc2c6b8 : DAMP,
        pile ? STEEL_CAP : COPING,
        true,
      );
      if (forward)
        add(
          q.p(s, top, 0.14 + GRID * 0.8),
          base,
          snapped,
          water,
          "plain",
          STEEL[2],
          WET_STEEL[2],
          STEEL_CAP,
          true,
        );
    }
  }
}

function nativeBox(put: Put, c: NativeCell, neighbours?: ReadonlyMap<string, NativeCell>) {
  const { x, z, x1, z1, bottom, top, kind, water } = c;
  const footprint: XZ[] = [
    [x, z],
    [x1, z],
    [x1, z1],
    [x, z1],
  ];
  const neighboursXZ = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = neighboursXZ[i];
    const neighbour = neighbours?.get(Math.round(x / GRID) + dx + "," + (Math.round(z / GRID) + dz));
    const floor = Math.max(bottom, neighbour?.top ?? bottom);
    if (floor >= top - 0.001) continue;
    const [ax, az] = footprint[i],
      [bx, bz] = footprint[(i + 1) % 4];
    const face = (lo: number, hi: number, shade: number, finish: Finish) => {
      lo = Math.max(lo, floor);
      if (hi - lo < 0.001) return;
      const a: P = [ax, lo, az],
        b: P = [bx, lo, bz],
        d: P = [ax, hi, az],
        e: P = [bx, hi, bz];
      const along = ax === bx ? az : ax,
        end = ax === bx ? bz : bx;
      put(
        finish,
        a,
        b,
        e,
        d,
        shade,
        finish !== "plain" ? verticalUV(finish, along, end, a, b, e, d) : undefined,
      );
    };
    if (c.wall) {
      const shoulder = Math.max(bottom, top - 0.1),
        wet = Math.max(bottom, Math.min(shoulder, water + 0.15));
      face(bottom, wet, c.wet, kind);
      face(wet, shoulder, c.dry, kind);
      face(shoulder, top, c.cap, "plain");
    } else {
      face(floor, top, c.dry, kind);
    }
  }
  const textured = !c.wall && kind === "setts",
    [w, h] = masonryTileMetresV370.setts;
  put(
    textured ? "setts" : "plain",
    [x, top, z],
    [x1, top, z],
    [x1, top, z1],
    [x, top, z1],
    c.cap,
    textured ? [x / w, z / h, x1 / w, z / h, x1 / w, z1 / h, x / w, z1 / h] : undefined,
  );
}

/** Axis-aligned boxes also keep planted details native on diagonal reaches. */
function block(put: Put, a: P, b: P, bottom: number, top: number, color: number, kind: Finish = "plain") {
  const wall = kind === "brick";
  nativeBox(put, {
    x: Math.min(a[0], b[0]),
    x1: Math.max(a[0], b[0]),
    z: Math.min(a[2], b[2]),
    z1: Math.max(a[2], b[2]),
    bottom,
    top,
    kind,
    wall,
    water: bottom + 0.32,
    dry: color,
    wet: wall ? 0xc2c6b8 : color,
    cap: wall ? COPING : color,
  });
}

/** The Walter-Röber reach has a low red brick plinth and turf returning to the
 * higher original bank. Only unpainted sections receive the projection. */
function brickPlinth(put: Put, q: Section, rec: WaterwayBankV370, native: boolean) {
  const width = rec.width && rec.width > 0.3 ? rec.width : 0.9;
  const shoulder = (s: number) => Math.min(q.top(s) - 0.1, q.water(s) + rec.brickPlinthHeight!);
  const grass = [0x8a956c, 0x798960, 0x78845f];
  if (native) {
    const n = Math.ceil(q.length);
    for (let i = 0; i < n; i++) {
      const a = (i * q.length) / n,
        b = ((i + 1) * q.length) / n,
        c = (a + b) / 2;
      const top = Math.round(shoulder(c) * 8) / 8;
      block(put, q.p(a, 0, -0.06), q.p(b, 0, width), q.water(c) - 0.32, top, 0xffffff, "brick");
      for (let j = 0; j < 3; j++) {
        const d0 = mix(-0.06, width - 0.08, j / 3),
          d1 = mix(-0.06, width - 0.08, (j + 1) / 3);
        const y = Math.round(mix(q.top(c) + 0.03, top, j / 3) * 8) / 8;
        if (y > top) block(put, q.p(a, 0, d0), q.p(b, 0, d1), top, y, grass[j]);
      }
    }
    return;
  }
  const base: Section = { ...q, top: shoulder, p: (s, y, d) => q.p(s, y, d + width - 0.16) };
  for (let a = 0; a < q.length; a += 20) {
    const b = Math.min(a + 20, q.length);
    wall(put, base, a, b, "brick");
    const at = (s: number, t: number) =>
      q.p(s, mix(q.top(s) + 0.03, shoulder(s) + 0.005, t), mix(-0.06, width - 0.08, t));
    for (let j = 0; j < 3; j++)
      put("plain", at(a, j / 3), at(b, j / 3), at(b, (j + 1) / 3), at(a, (j + 1) / 3), grass[j]);
  }
}

/** Mid-water planting shelves on the IGB's 40 m pilot wall. Their steel frames
 * hold a gently sloping substrate and emergent reed/willow clumps. */
function plantedSteel(put: Put, q: Section, native: boolean) {
  const pitch = 40 / 76;
  for (let i = Math.floor(q.chain / pitch); i * pitch < q.chain + q.length; i++) {
    const a = Math.max(0, i * pitch - q.chain + 0.018),
      b = Math.min(q.length, (i + 1) * pitch - q.chain - 0.018);
    if (b - a < 0.012) continue;
    const w0 = q.water(a),
      w1 = q.water(b);
    const rim = 0.89;
    if (native)
      block(put, q.p(a, 0, 0.3), q.p(b, 0, rim), Math.min(w0, w1) - 0.15, (w0 + w1) / 2 + 0.11, 0x727757);
    else {
      put(
        "plain",
        q.p(a, w0 + 0.18, 0.3),
        q.p(b, w1 + 0.18, 0.3),
        q.p(b, w1 + 0.04, rim),
        q.p(a, w0 + 0.04, rim),
        0x757b55,
      );
      upright(put, q, a, b, rim, rim, w0 - 0.15, w1 - 0.15, w0 + 0.04, w1 + 0.04, 0x595c47);
    }
    // Count each clump once where a survey vertex cuts a planting module.
    const s = (i + 0.5) * pitch - q.chain;
    if (s < a || s >= b) continue;
    const w = q.water(s);
    for (let j = 0; j < 4; j++) {
      const along = s + (j - 1.5) * 0.054,
        d = 0.52 + (j % 2) * 0.14;
      const tip = w + 0.5 + ((i * 3 + j * 7) % 9) * 0.073;
      const ink = [0x728656, 0x85965d, 0x687b4d, 0x93a16e][j];
      if (native) {
        const [x, , z] = q.p(along, 0, d);
        block(put, [x - 0.039, 0, z - 0.039], [x + 0.039, 0, z + 0.039], w + 0.08, tip, ink);
      } else
        put(
          "plain",
          q.p(along - 0.025, w + 0.08, d),
          q.p(along + 0.025, w + 0.08, d),
          q.p(along + 0.013 + (j - 1.5) * 0.065, tip, d + 0.05 * (j - 1)),
          q.p(along + 0.004 + (j - 1.5) * 0.065, tip, d + 0.05 * (j - 1)),
          ink,
        );
    }
  }
}

/** The line follows the bank's crown. With waterSide=+1, water is on the
 * (-dz,+dx) side in viewer X/Z. Water and absolute crown elevations are
 * interpolated independently and never used to move the source terrain. */
export function createWaterwayBanksV370(
  records: readonly WaterwayBankV370[],
  waterY: BankWaterLevelV370,
  native = false,
): Group {
  const root = new Group();
  root.name = "Waterway bank materials v370";
  Object.assign(root.userData, {
    waterwayBanksV370: true,
    nativeMinecraft: native,
    blockNative: native,
    keepInMinecraft: native,
  });
  const buckets = new Map<string, { finish: Finish; part: Part }>();
  const palette = new Map<number, number[]>();
  for (const rec of records) {
    const side = rec.waterSide === -1 ? -1 : 1,
      offset = finite(rec.faceOffset) ? rec.faceOffset! : 0;
    const points: Array<{ p: readonly number[]; top?: number }> = [];
    for (let i = 0; i < rec.points.length; i++) {
      const p = rec.points[i];
      if (!safe(p)) {
        points.length = 0;
        break;
      }
      if (!points.length || distinct(points[points.length - 1].p, p)) points.push({ p, top: rec.topY?.[i] });
    }
    if (points.length < 2) continue;
    const nativeCells = new Map<string, NativeCell>();
    const sample = (p: readonly number[]) =>
      finite(rec.waterY) ? rec.waterY! : typeof waterY === "number" ? waterY : waterY(p[0], p[1], rec.water);
    const levels = points.map(({ p }) => sample(p));
    if (levels.some((y) => !finite(y))) continue;
    const tops = points.map(({ top }, i) =>
      finite(top) ? top! : levels[i] + (finite(rec.height) ? rec.height! : isSlope(rec) ? 1.15 : 2.1),
    );
    const normals = points.slice(1).map(({ p }, i) => normal(points[i].p, p, side));
    const closed = !distinct(points[0].p, points[points.length - 1].p);
    const miters = points.map((_, i) =>
      join(
        normals[i - 1] ?? (closed ? normals[normals.length - 1] : normals[0]),
        normals[i] ?? (closed ? normals[0] : normals[normals.length - 1]),
      ),
    );
    const put: Put = (finish, a, b, c, d, hex, uv) => {
      // Spatial bins permit off-screen sections to be culled independently.
      const key = Math.floor((a[0] + c[0]) / 512) + ":" + Math.floor((a[2] + c[2]) / 512) + ":" + finish;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { finish, part: { pos: [], rgb: [], index: [], uv: [], ids: new Set() } };
        buckets.set(key, bucket);
      }
      const part = bucket.part,
        base = part.pos.length / 3;
      let rgb = palette.get(hex);
      if (!rgb) {
        tint.setHex(hex);
        rgb = [tint.r, tint.g, tint.b].map((v) => Math.round(v * 255));
        palette.set(hex, rgb);
      }
      for (const p of [a, b, c, d]) {
        part.pos.push(...p);
        part.rgb.push(...rgb);
      }
      if (uv) part.uv.push(...uv);
      part.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      part.ids.add(rec.id);
    };
    let chain = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i].p,
        b = points[i + 1].p,
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const q: Section = {
        length,
        chain,
        top: (s) => mix(tops[i], tops[i + 1], s / length),
        water: (s) => mix(levels[i], levels[i + 1], s / length),
        p: (s, y, d) => {
          const t = s / length;
          return [
            mix(a[0], b[0], t) + mix(miters[i][0], miters[i + 1][0], t) * (d + offset),
            y,
            mix(a[1], b[1], t) + mix(miters[i][1], miters[i + 1][1], t) * (d + offset),
          ];
        },
      };
      if (rec.material === "brick" && finite(rec.brickPlinthHeight) && rec.brickPlinthHeight! > 0) {
        brickPlinth(put, q, rec, native);
      } else if (native) {
        if (!isSlope(rec) && (a[0] === b[0] || a[1] === b[1]))
          nativeAxisWall(put, q, rec, normals[i], offset);
        else rasterBank(nativeCells, q, rec);
        if (isSlope(rec) && (rec.reed || rec.profile === "reeds")) {
          for (let reedN = Math.ceil(chain / 13); reedN * 13 < chain + length; reedN++) {
            const s = reedN * 13 - chain,
              w = q.water(s);
            const width = slopeWidth(rec, q.top(s) - w);
            for (let j = 0; j < 3; j++) {
              const p = q.p(s + j * 0.12, 0, width * 0.9 + j * 0.06),
                y = w + 0.4 + ((reedN + j) % 3) * 0.13;
              nativeBox(put, {
                x: p[0] - 0.035,
                x1: p[0] + 0.035,
                z: p[2] - 0.035,
                z1: p[2] + 0.035,
                bottom: w - 0.16,
                top: y,
                water: w,
                wall: false,
                kind: "plain",
                dry: 0x80824f,
                wet: 0x80824f,
                cap: 0x919063,
              });
            }
          }
        }
      } else
        for (let start = 0; start < length; start += 20) {
          const end = Math.min(start + 20, length);
          if (isSlope(rec)) slope(put, q, start, end, rec);
          else if (rec.material === "steel") steel(put, q, start, end);
          else wall(put, q, start, end, rec.material);
        }
      if (rec.material === "steel" && rec.reed) plantedSteel(put, q, native);
      chain += length;
    }
    if (native) for (const c of nativeCells.values()) nativeBox(put, c, nativeCells);
  }

  const materials = new Map<Finish, [MeshBasicMaterial | MeshStandardMaterial, MeshStandardMaterial]>();
  for (const [key, { finish, part }] of buckets) {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(part.pos, 3));
    g.setAttribute("color", new BufferAttribute(Uint8Array.from(part.rgb), 3, true));
    if (part.uv.length) g.setAttribute("uv", new Float32BufferAttribute(part.uv, 2));
    g.setIndex(part.index);
    g.computeVertexNormals();
    // Unit normals use signed normalized bytes, including all axis-aligned Native faces.
    const normals = g.getAttribute("normal");
    g.setAttribute(
      "normal",
      new BufferAttribute(
        Int8Array.from(normals.array, (v) => Math.round(v * 127)),
        3,
        true,
      ),
    );
    g.computeBoundingSphere();
    let pair = materials.get(finish);
    if (!pair) {
      const map = finish === "plain" ? null : waterwayMasonryMapV370(finish);
      const night = new MeshStandardMaterial({ vertexColors: true, map, roughness: 0.93, side: DoubleSide });
      const day = native ? night : new MeshBasicMaterial({ vertexColors: true, map, side: DoubleSide });
      if (map) ownBankMasonryMapV370(map, day, night);
      pair = [day, night];
      materials.set(finish, pair);
    }
    const [day, night] = pair,
      mesh = new Mesh(g, day);
    mesh.name = `Waterway ${native ? "blocks" : "bank"} ${key}`;
    Object.assign(mesh.userData, {
      waterwayBanksV370: true,
      waterwayBankFinish: finish,
      bankIds: [...part.ids],
      dayMaterial: day,
      nightMaterial: night,
      blockNative: native,
      keepInMinecraft: native,
    });
    root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

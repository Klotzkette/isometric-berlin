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
import { terrainGroundAt } from "./weinbergTerrainV176";
export type P = [number, number, number];
export interface WaterwayCrossingV378 {
  id: string;
  name: string;
  role: string;
  form: string;
  material: string;
  center: number[];
  course: number[];
  sections: number[][];
  openings: number[][];
  landing: (number[] | null)[];
  paths: [string, number[][], number][];
  lamps?: number[][];
  sett?: boolean;
  ironwork: boolean;
  pier?: string;
  covered?: boolean;
  walking?: boolean;
  railDatum?: number[][];
}
const palette = new Map<number, number[]>();
function rgb(tone: number) {
  let color = palette.get(tone);
  if (!color) {
    const c = new Color(tone);
    color = [
      Math.round(c.r * 255),
      Math.round(c.g * 255),
      Math.round(c.b * 255),
    ];
    palette.set(tone, color);
  }
  return color;
}

/** One indexed draw batch per kind in a resident cell, including handrails and all leaves. */
export class Batch {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  face(corners: P[], tone: number) {
    const start = this.positions.length / 3,
      color = rgb(tone);
    for (const p of corners) {
      this.positions.push(...p);
      this.colors.push(...color);
    }
    for (let i = 1; i < corners.length - 1; i++)
      this.indices.push(start, start + i, start + i + 1);
  }

  beam(a: P, b: P, width: number, depth: number, tone: number) {
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz);
    if (length < 0.001) {
      const w = width / 2,
        y = Math.max(a[1], b[1]),
        base = Math.min(a[1], b[1]);
      const loop: P[] = [
        [-w, 0, -w],
        [w, 0, -w],
        [w, 0, w],
        [-w, 0, w],
      ].map(([x, , z]) => [a[0] + x, base, a[2] + z]);
      const high: P[] = loop.map(([x, , z]) => [x, y, z]);
      for (let j = 0; j < 4; j++)
        this.face(
          [loop[j], loop[(j + 1) % 4], high[(j + 1) % 4], high[j]],
          tone,
        );
      this.face(high, tone);
      return;
    }
    const nx = (-dz * width) / (2 * length),
      nz = (dx * width) / (2 * length);
    const ring = (p: P): P[] => [
      [p[0] + nx, p[1] - depth / 2, p[2] + nz],
      [p[0] - nx, p[1] - depth / 2, p[2] - nz],
      [p[0] - nx, p[1] + depth / 2, p[2] - nz],
      [p[0] + nx, p[1] + depth / 2, p[2] + nz],
    ];
    const left = ring(a),
      right = ring(b);
    for (let j = 0; j < 4; j++)
      this.face(
        [left[j], right[j], right[(j + 1) % 4], left[(j + 1) % 4]],
        tone,
      );
    this.face(left, tone);
    this.face(right, tone);
  }

  mesh(name: string) {
    if (!this.indices.length) return null;
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    g.setAttribute(
      "color",
      new BufferAttribute(new Uint8Array(this.colors), 3, true),
    );
    g.setIndex(this.indices);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const day = new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const night = new MeshStandardMaterial({
      vertexColors: true,
      side: DoubleSide,
      roughness: 0.93,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new Mesh(g, day);
    mesh.name = name;
    mesh.userData = {
      dayMaterial: day,
      nightMaterial: night,
      waterwaysV378: true,
    };
    return mesh;
  }
}

export const lift = (p: P, y: number): P => [p[0], p[1] + y, p[2]];
export const mix = (a: P, b: P, t: number): P => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export function ribbon(batch: Batch, pts: P[], width: number, tone: number) {
  const tangents = pts.slice(1).map((q, i) => {
    const dx = q[0] - pts[i][0],
      dz = q[2] - pts[i][2],
      l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  });
  let last: P[] = [];
  pts.forEach((p, i) => {
    const a = tangents[Math.max(0, i - 1)],
      b = tangents[Math.min(i, tangents.length - 1)];
    const len = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1,
      nx = (a[0] + b[0]) / len,
      nz = (a[1] + b[1]) / len;
    const w = width / 2 / Math.max(0.55, nx * b[0] + nz * b[1]);
    const line: P[] = [
      [p[0] - nx * w, p[1], p[2] - nz * w],
      [p[0] + nx * w, p[1], p[2] + nz * w],
    ];
    if (i) batch.face([last[0], last[1], line[1], line[0]], tone);
    last = line;
  });
}

/** Preserve source curve vertices, place posts on continuous chainage across short ways. */
export function railing(
  batch: Batch,
  pts: P[],
  height: number,
  guard = false,
  decorative = false,
) {
  const color = decorative ? 0x394841 : guard ? 0x8a8f89 : 0x65716c;
  const pitch = decorative ? 1.7 : 2.45;
  let next = 0,
    at = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      l = Math.hypot(a[0] - b[0], a[2] - b[2]);
    if (l < 0.01) continue;
    batch.beam(
      lift(a, height),
      lift(b, height),
      guard ? 0.17 : 0.085,
      guard ? 0.18 : 0.075,
      color,
    );
    if (!guard)
      batch.beam(
        lift(a, height * 0.48),
        lift(b, height * 0.48),
        0.065,
        0.055,
        color,
      );
    while (next < at + l - 0.03) {
      const p = mix(a, b, (next - at) / l);
      batch.beam(p, lift(p, height), 0.092, 0.09, color);
      if (decorative && next + pitch <= at + l) {
        const end = mix(a, b, (next + pitch - at) / l),
          mid = mix(p, end, 0.5);
        batch.beam(lift(p, 0.48), lift(mid, height - 0.14), 0.05, 0.05, color);
        batch.beam(
          lift(mid, height - 0.14),
          lift(end, 0.48),
          0.05,
          0.05,
          color,
        );
      }
      next += pitch;
    }
    at += l;
  }
  const last = pts[pts.length - 1];
  batch.beam(last, lift(last, height), 0.09, 0.09, color);
}

export function crossingProfileV378(r: WaterwayCrossingV378, native: boolean) {
  const [x, z] = r.center,
    [dx, dz] = r.course,
    sec = r.sections;
  const p = (s: number, w: number, y: number): P => [
    x + dx * s - dz * w,
    y,
    z + dz * s + dx * w,
  ];
  const water = -1.15;
  const atLanding = (i: number) => {
    const s = i === 0 ? sec[0] : sec[sec.length - 1],
      pt = p(s[0], s[1], 0),
      val = r.landing[i];
    return val
      ? val[native ? 1 : 0] / 10
      : terrainGroundAt(pt[0], pt[2], 3, native);
  };
  const left = atLanding(0),
    right = atLanding(1),
    start = sec[0][0],
    end = sec[sec.length - 1][0];
  const utility = r.role === "utility",
    rail = r.role === "rail" || r.role === "former-rail";
  const steel = r.material === "steel",
    stone = r.material === "stone";
  const structure = steel
    ? 0x626e69
    : stone
      ? 0xaa9a86
      : r.material === "composite"
        ? 0x879290
        : 0xb8b7aa;
  const underside = steel ? 0x424f4e : stone ? 0x8d7e6a : 0x97988e;
  const closest = (s: number) =>
    r.openings.reduce<number[] | undefined>(
      (a, b) => (!a || Math.abs(s - b[0]) < Math.abs(s - a[0]) ? b : a),
      undefined,
    );
  const bottom = (s: number) => {
    const v = closest(s);
    if (!v) return Math.min(left, right) - (rail ? 1.0 : 0.66);
    const u = Math.max(-1, Math.min(1, (s - v[0]) / (v[1] / 2)));
    // Fit the published crown and both edges. Beyond the measured window
    // keep the last measured height without inventing riverbed abutments.
    const edge = u < 0 ? v[2] : v[4];
    return water + v[3] + (edge - v[3]) * u * u;
  };
  const crown = r.openings.reduce(
    (h, row) => Math.max(h, water + row[3] + (rail ? 0.84 : 0.43)),
    -Infinity,
  );
  const centralTop = Math.max(crown, (left + right) / 2 + 0.23);
  const top = (s: number) => {
    if (r.railDatum?.length) {
      const points = r.railDatum,
        first = points[0],
        last = points[points.length - 1];
      if (s <= first[0]) return first[1];
      if (s >= last[0]) return last[1];
      const i = points.findIndex((row) => row[0] >= s),
        a = points[i - 1],
        b = points[i];
      return a[1] + ((b[1] - a[1]) * (s - a[0])) / (b[0] - a[0]);
    }
    const t = (s - start) / (end - start),
      base = left + (right - left) * t + 0.23;
    const run = Math.min(
      1,
      Math.max(
        0,
        Math.min(s - start, end - s) / Math.min(8, (end - start) * 0.28),
      ),
    );
    return Math.max(
      bottom(s) + 0.23,
      base + (centralTop - (left + right) / 2 - 0.23) * run,
    );
  };
  return {
    x,
    z,
    dx,
    dz,
    sec,
    p,
    water,
    structure,
    underside,
    rail,
    utility,
    bottom,
    top,
  };
}

export function drawCrossingV378(
  batch: Batch,
  r: WaterwayCrossingV378,
  native: boolean,
) {
  const {
    x,
    z,
    dx,
    dz,
    sec,
    p,
    water,
    structure,
    underside,
    rail,
    utility,
    bottom,
    top,
  } = crossingProfileV378(r, native);
  const surface = rail
    ? 0x78766b
    : r.role === "foot"
      ? 0xb9b7a8
      : r.sett
        ? 0xa29a8b
        : 0x807f77;
  const leftRim: P[] = [],
    rightRim: P[] = [];
  for (let i = 0; i < sec.length; i++) {
    const [s, a, b] = sec[i],
      y = top(s);
    leftRim.push(p(s, a + 0.09, y));
    rightRim.push(p(s, b - 0.09, y));
    if (!i) continue;
    const [s0, a0, b0] = sec[i - 1],
      y0 = top(s0),
      lo0 = bottom(s0),
      lo = bottom(s);
    if (s - s0 < 0.004) continue;
    if (utility) {
      const h = 0.58,
        ring = (at: number, low: number, j: number): P =>
          p(
            at,
            Math.cos((j * Math.PI) / 4) * h,
            low + h + Math.sin((j * Math.PI) / 4) * h,
          );
      for (let j = 0; j < 8; j++)
        batch.face(
          [
            ring(s0, lo0, j),
            ring(s, lo, j),
            ring(s, lo, j + 1),
            ring(s0, lo0, j + 1),
          ],
          j < 4 ? 0x8b8277 : 0x6d6a60,
        );
      continue;
    }
    const raised = r.form === "open-arch" || r.form === "truss";
    const thickness = raised ? 0.34 : Math.min(0.77, Math.max(0.22, y - lo));
    const underside0 = raised ? y0 - thickness : lo0,
      underside1 = raised ? y - thickness : lo;
    batch.face([p(s0, a0, y0), p(s0, b0, y0), p(s, b, y), p(s, a, y)], surface);
    batch.face(
      [
        p(s0, a0, underside0),
        p(s, a, underside1),
        p(s, b, underside1),
        p(s0, b0, underside0),
      ],
      underside,
    );
    if (
      raised &&
      r.openings.some((o) =>
        [o[0] - o[1] / 2, o[0], o[0] + o[1] / 2].some(
          (t) => Math.abs(t - s) < 0.02,
        ),
      )
    ) {
      batch.beam(p(s, a, lo + 0.08), p(s, b, lo + 0.08), 0.19, 0.16, underside);
    }
    if (r.id === "w659050176") {
      // Berlin's heritage survey gives the two-metre spacing of the iron arch ribs.
      for (
        let offset = Math.ceil(Math.max(a, a0) / 2) * 2;
        offset < Math.min(b, b0);
        offset += 2
      ) {
        batch.beam(
          p(s0, offset, lo0 + 0.09),
          p(s, offset, lo + 0.09),
          0.18,
          0.18,
          underside,
        );
      }
    }
    for (const [v0, v] of [
      [a0, a],
      [b0, b],
    ]) {
      batch.face(
        [p(s0, v0, underside0), p(s, v, underside1), p(s, v, y), p(s0, v0, y0)],
        structure,
      );
      if (raised) {
        batch.beam(
          p(s0, v0, lo0 + 0.09),
          p(s, v, lo + 0.09),
          0.22,
          0.18,
          underside,
        );
        if (lo + 0.18 < y - thickness) {
          if (r.form === "truss")
            batch.beam(
              p(s0, v0, lo0 + 0.13),
              p(s, v, y - thickness),
              0.15,
              0.14,
              structure,
            );
          else
            batch.beam(
              p(s, v, lo + 0.1),
              p(s, v, y - thickness),
              0.16,
              0.16,
              structure,
            );
        }
      }
    }
  }
  if (utility) return;
  if (r.ironwork)
    for (const edge of [leftRim, rightRim])
      railing(batch, edge, 1.02, false, true);
  if (r.pier && r.openings.length === 2) {
    const [a, b] = [...r.openings].sort((m, n) => m[0] - n[0]);
    const x0 = a[0] + a[1] / 2,
      x1 = b[0] - b[1] / 2,
      mid = (x0 + x1) / 2;
    const at = sec.reduce((v, u) =>
      Math.abs(u[0] - mid) < Math.abs(v[0] - mid) ? u : v,
    );
    if (x1 > x0 + 0.1) {
      const rim = [
        p(x0, at[1], water - 0.5),
        p(x1, at[1], water - 0.5),
        p(x1, at[2], water - 0.5),
        p(x0, at[2], water - 0.5),
      ];
      const roof = rim.map((q) => lift(q, bottom(mid) - water + 0.53));
      for (let i = 0; i < 4; i++)
        batch.face(
          [rim[i], rim[(i + 1) % 4], roof[(i + 1) % 4], roof[i]],
          0xab796a,
        );
    }
  }
  if (r.covered) {
    for (const edge of [leftRim, rightRim]) {
      for (let i = 1; i < edge.length; i++)
        batch.beam(
          lift(edge[i - 1], 2.38),
          lift(edge[i], 2.38),
          0.14,
          0.16,
          0x848d83,
        );
      for (let i = 0; i < edge.length; i += 2)
        batch.beam(edge[i], lift(edge[i], 2.38), 0.12, 0.12, 0x69776e);
    }
    for (let i = 1; i < sec.length; i++)
      batch.face(
        [
          lift(leftRim[i - 1], 2.46),
          lift(rightRim[i - 1], 2.46),
          lift(rightRim[i], 2.46),
          lift(leftRim[i], 2.46),
        ],
        0x969f94,
      );
  }
  for (const [px, pz] of r.lamps ?? []) {
    const y = top((px - x) * dx + (pz - z) * dz),
      base: P = [px, y, pz];
    batch.beam(base, lift(base, 0.43), 0.35, 0.35, 0x444d47);
    batch.beam(lift(base, 0.43), lift(base, 4.23), 0.13, 0.13, 0x46504b);
    batch.beam(lift(base, 4.18), lift(base, 4.32), 0.34, 0.34, 0x434f49);
    const lower: P[] = [],
      upper: P[] = [];
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      lower.push([px + 0.17 * Math.cos(a), y + 4.3, pz + 0.17 * Math.sin(a)]);
      upper.push([px + 0.28 * Math.cos(a), y + 4.87, pz + 0.28 * Math.sin(a)]);
    }
    for (let j = 0; j < 6; j++) {
      const k = (j + 1) % 6;
      batch.face([lower[j], lower[k], upper[k], upper[j]], 0xe9dfbd);
      batch.beam(lower[j], upper[j], 0.035, 0.035, 0x424a43);
      batch.face([upper[j], upper[k], lift(base, 5.14)], 0x455448);
    }
  }
  for (const [kind, coords, widthDm] of r.paths) {
    // A two-node OSM sidewalk still follows the bridge's cambered deck
    // through every intermediate cross section and both approach gradients.
    const pts: P[] = [];
    const cuts = sec.map((q) => q[0]);
    const make = (px: number, pz: number): P => [
      px,
      top((px - x) * dx + (pz - z) * dz) + 0.085,
      pz,
    ];
    for (let i = 0; i < coords.length; i++) {
      const [px, pz] = coords[i];
      if (i) {
        const [ax, az] = coords[i - 1],
          s0 = (ax - x) * dx + (az - z) * dz,
          s1 = (px - x) * dx + (pz - z) * dz;
        const factors = cuts
          .map((s) => (s - s0) / (s1 - s0))
          .filter((t) => t > 0.001 && t < 0.999)
          .sort((a, b) => a - b);
        for (const t of factors)
          pts.push(make(ax + (px - ax) * t, az + (pz - az) * t));
      }
      pts.push(make(px, pz));
    }
    if (pts.length < 2) continue;
    if (kind === "track" && r.railDatum) continue;
    if (kind === "track") {
      // Gauge is 1.435 m. The source line is the track centre.
      for (const side of [-0.7175, 0.7175])
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1],
            b = pts[i],
            l = Math.hypot(b[0] - a[0], b[2] - a[2]);
          if (!l) continue;
          const move = (p: P): P => [
            p[0] - ((b[2] - a[2]) * side) / l,
            p[1] + 0.1,
            p[2] + ((b[0] - a[0]) * side) / l,
          ];
          batch.beam(move(a), move(b), 0.1, 0.14, 0x9fa5a0);
        }
    } else if (r.role === "street")
      ribbon(batch, pts, widthDm / 10, kind === "cycle" ? 0xa1907f : 0xc2beb0);
  }
}

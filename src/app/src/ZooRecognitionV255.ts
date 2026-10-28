import anchors from "./data/zooRecognitionV255Source.json";

type P = [number, number, number];
type Ring = number[][];
export interface ZooRecognitionV255Sink {
  readonly native: boolean;
  box(c: number, x: number, y: number, z: number, w: number, h: number, d: number, yaw?: number): void;
  line(c: number, a: P, b: P, width?: number): void;
  face(c: number, ring: P[]): void;
  /** Optional exact owner capture; ordinary static/test sinks stay unchanged. */
  animal?(id: string, x: number, y: number, z: number, emit: () => void, heading?: number): void;
}
interface Source {
  parts: { id: string; ring: Ring; osm: string; top_y_m: number }[];
}
const GROUND = anchors.groundY;
const RED = 0xad6f59, RED_LIGHT = 0xc58b70, GOLD = 0xbea14e;
const WOOD = 0x967348, WOOD_LIGHT = 0xb79764, STEEL = 0xb1bdbb;

/** These details enter the existing v165 batches; no separate scene lifetime. */
function turned(
  d: ZooRecognitionV255Sink, c: number, x: number, z: number,
  profile: [number, number][], sides = 12,
): void {
  if (d.native) {
    for (let j = 1; j < profile.length; j++) {
      const [y0, r0] = profile[j - 1], [y1, r1] = profile[j];
      d.box(c, x, (y0 + y1) / 2, z, Math.max(.12, r0 + r1), y1 - y0, Math.max(.12, r0 + r1));
    }
    return;
  }
  for (let j = 1; j < profile.length; j++) for (let i = 0; i < sides; i++) {
    const a = i * Math.PI * 2 / sides, b = (i + 1) * Math.PI * 2 / sides;
    const [y0, r0] = profile[j - 1], [y1, r1] = profile[j];
    d.face(c, [
      [x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0],
      [x + Math.cos(b) * r0, y0, z + Math.sin(b) * r0],
      [x + Math.cos(b) * r1, y1, z + Math.sin(b) * r1],
      [x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1],
    ]);
  }
}

function pagoda(d: ZooRecognitionV255Sink): void {
  const { centre: [x, z], yaw, width, levels } = anchors.tower;
  const at = (u: number, y: number, v: number): P =>
    [x + Math.cos(yaw) * u + Math.sin(yaw) * v, y, z - Math.sin(yaw) * u + Math.cos(yaw) * v];
  // The 18 stacked levels are documented. Taper, gaps and lotus-scale accents
  // are explicitly estimated inside the actual mapped tower footprint.
  for (let level = 0; level < levels; level++) {
    const w = width - level * .185, y = GROUND + 3 + level * 1.095;
    for (let side = 0; side < 4; side++) {
      const angle = yaw + side * Math.PI / 2;
      const u = Math.sin(side * Math.PI / 2) * (w / 2 - .18);
      const v = Math.cos(side * Math.PI / 2) * (w / 2 - .18);
      d.box(level % 2 ? RED : RED_LIGHT, ...at(u, y + .29, v), w, .58, .36, angle);
      d.box(RED, ...at(u, y + .7, v), w - .12, .15, .3, angle);
    }
    for (const u of [-1, 1]) for (const v of [-1, 1])
      d.box(RED, ...at(u * (w / 2 - .55), y + .56, v * (w / 2 - .55)), .3, 1.08, .3, yaw);
    // Restrained raised diamonds recall the lotus panels without tracing art.
    if (level % 3 === 0) for (const side of [-1, 1]) for (const u of [-1.3, 0, 1.3]) {
      if (Math.abs(u) > w / 2 - .45) continue;
      const a = at(u - .18, y + .28, side * (w / 2 + .015));
      const b = at(u, y + .46, side * (w / 2 + .015));
      const c = at(u + .18, y + .28, side * (w / 2 + .015));
      const e = at(u, y + .10, side * (w / 2 + .015));
      d.line(RED_LIGHT, a, b, .045); d.line(RED_LIGHT, b, c, .045);
      d.line(RED_LIGHT, c, e, .045); d.line(RED_LIGHT, e, a, .045);
    }
  }
  for (const u of [-width / 2 + .42, width / 2 - .42])
    for (const v of [-width / 2 + .42, width / 2 - .42])
      d.box(RED, ...at(u, GROUND + 1.55, v), .65, 3.1, .65, yaw);
  turned(d, GOLD, x, z, [[28.0, 1.25], [28.18, 1.25], [28.2, 0], [28.68, 0]]);
  turned(d, GOLD, x, z, [[28.7, .92], [28.94, .92], [28.96, 0], [29.35, 0]]);
  turned(d, GOLD, x, z, [[29.36, .38], [29.75, .23], [30.2, 0]]);
}

function antelope(d: ZooRecognitionV255Sink, source: Source): void {
  // These four vertices are the measured entry pavilion's corners, not an
  // invented axis-aligned replacement. Complete source walls/roof stay present.
  const part = source.parts.find(p => p.id === "DEBE3DlyqEefwivU")!;
  const a = part.ring[7], b = part.ring[0];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
  const nx = tz, nz = -tx;
  const at = (u: number, y: number, offset = .16): P =>
    [a[0] + tx * u + nx * offset, y, a[1] + tz * u + nz * offset];
  const yaw = Math.atan2(-tz, tx);
  for (const u of [.48, length - .48]) {
    d.box(0xc4ad72, ...at(u, 10.95), .68, 11.5, .23, yaw);
    for (let y = 5.9; y < 16.5; y += 1.08) d.box(0x7899ab, ...at(u, y, .3), .72, .14, .12, yaw);
  }
  for (const y of [6.02, 16.67, 17.28]) d.line(0xc8b784, at(0, y), at(length, y), .2);
  // Open, pointed arch surround and two slender columns, all on the wall face.
  for (const u of [2.12, length - 2.12]) {
    d.box(0xe1dac4, ...at(u, 8.25, .31), .27, 5.6, .27, yaw);
    d.box(0xcac2a7, ...at(u, 5.51, .31), .53, .28, .53, yaw);
    d.box(0xcac2a7, ...at(u, 10.94, .31), .52, .3, .52, yaw);
  }
  for (const side of [-1, 1]) {
    let previous = at(length / 2 + side * (length / 2 - 1.45), 10.8, .34);
    for (let j = 1; j <= 10; j++) {
      const t = j / 10;
      const p = at(length / 2 + side * (length / 2 - 1.45) * Math.cos(t * Math.PI / 2), 10.8 + 5.08 * Math.sin(t * Math.PI / 2), .34);
      d.line(0xdfd7bb, previous, p, .19); previous = p;
    }
  }
  // Four slender minarets visible in the operator's current facade photograph.
  // All small heights/radii are visual estimates above the retained roof.
  for (const index of [7, 0, 4, 3]) {
    const [x, z] = part.ring[index], base = part.top_y_m;
    turned(d, 0xc7b788, x, z, [[base, .48], [base + .25, .66], [base + .65, .48], [base + 3.6, .48], [base + 3.85, .66], [base + 4.08, .54]]);
    turned(d, 0x52766d, x, z, [[base + 4.08, .32], [base + 4.4, .20], [base + 4.7, .42], [base + 5.05, .5], [base + 5.4, .25], [base + 5.75, .06]]);
    d.line(0x80734c, [x, base + 5.7, z], [x, base + 6.2, z], .055);
  }
}

function slide(d: ZooRecognitionV255Sink, start: P, end: P): void {
  const dx = end[0] - start[0], dz = end[2] - start[2], length = Math.hypot(dx, dz);
  const nx = -dz / length * .47, nz = dx / length * .47;
  const left = (p: P): P => [p[0] + nx, p[1], p[2] + nz];
  const right = (p: P): P => [p[0] - nx, p[1], p[2] - nz];
  if (d.native) {
    const count = Math.ceil(length / .55);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      d.box(STEEL, start[0] + dx * t, start[1] + (end[1] - start[1]) * t, start[2] + dz * t, 1.02, .15, .65);
    }
  } else d.face(STEEL, [left(start), left(end), right(end), right(start)]);
  d.line(0x889b9c, left(start), left(end), .09);
  d.line(0x889b9c, right(start), right(end), .09);
}

function playground(d: ZooRecognitionV255Sink): void {
  const towers = anchors.playground.towers;
  for (const { position: [x, z], deck, roof } of towers) {
    d.box(WOOD, x, GROUND + deck, z, 3.1, .16, 3.1);
    for (const u of [-1, 1]) for (const v of [-1, 1])
      d.line(WOOD, [x + u * 1.45, GROUND, z + v * 1.45], [x + u * 1.55, GROUND + roof - .8, z + v * 1.35], .22);
    for (let i = 0; i < 11; i++) {
      const u = -1.4 + i * .28;
      for (const side of [-1, 1]) {
        d.line(i % 3 ? WOOD : WOOD_LIGHT, [x + u, GROUND + deck, z + side * 1.5], [x + u + .13, GROUND + deck + 1.15 + .13 * Math.sin(i * 4), z + side * 1.5], .10);
      }
    }
    // Open timber cone roof: light passes between its irregular narrow poles.
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16;
      d.line(WOOD_LIGHT, [x + Math.cos(angle) * 2, GROUND + roof - 1.2, z + Math.sin(angle) * 2], [x + .12, GROUND + roof, z - .15], .12);
    }
    slide(d, [x, GROUND + deck + .12, z + 1.6], [x + 2.3, GROUND + .28, z + 8.0]);
    for (let j = 0; j < 8; j++) d.box(WOOD_LIGHT, x - 2.9 + j * .16, GROUND + .2 + deck * j / 8, z, .75, .12, 1.25);
    for (const side of [-1, 1]) d.line(WOOD, [x - 2.9, GROUND + 1.1, z + side * .68], [x - 1.5, GROUND + deck + 1, z + side * .68], .11);
  }
  for (let i = 1; i < towers.length; i++) {
    const a = towers[i - 1], b = towers[i];
    const dx = b.position[0] - a.position[0], dz = b.position[1] - a.position[1], length = Math.hypot(dx, dz);
    const nx = -dz / length * .62, nz = dx / length * .62;
    for (let j = 0; j <= 13; j++) {
      const t = .18 + .64 * j / 13, sag = Math.sin(t * Math.PI) * .4;
      const x = a.position[0] + dx * t, z = a.position[1] + dz * t, y = GROUND + a.deck + (b.deck - a.deck) * t - sag;
      d.line(WOOD_LIGHT, [x - nx, y, z - nz], [x + nx, y, z + nz], .15);
      if (j % 3 === 0) for (const side of [-1, 1]) d.line(WOOD, [x + nx * side, y, z + nz * side], [x + nx * side, y + .9, z + nz * side], .10);
      if (j) for (const side of [-1, 1]) {
        const t0 = .18 + .64 * (j - 1) / 13;
        d.line(0x5c5140, [a.position[0] + dx * t0 + nx * side, GROUND + a.deck + (b.deck - a.deck) * t0 - Math.sin(t0 * Math.PI) * .4 + .9, a.position[1] + dz * t0 + nz * side], [x + nx * side, y + .9, z + nz * side], .045);
      }
    }
  }
}

export function appendZooRecognitionV255(d: ZooRecognitionV255Sink, source: Source): void {
  pagoda(d); antelope(d, source); playground(d);
  for (const [x, z] of anchors.reeds) for (let k = 0; k < 5; k++) {
    const angle = k * Math.PI * 2 / 5;
    d.line(k % 2 ? 0x899553 : 0x637c48, [x, 5.39, z], [x + Math.cos(angle) * .36, 6.04 + .2 * Math.sin(k), z + Math.sin(angle) * .36], .07);
  }
}

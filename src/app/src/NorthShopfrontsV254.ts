import data from "./data/northShopfrontsV254.json";

type Rows = number[][];
type Front = typeof data.drawn[number];

/** Existing northern batches own every fitting and its disposal. No new mesh. */
export function appendNorthShopfrontsV254(rows: Rows, native = false): void {
  const member = (f: Front, u: number, dy: number, width: number, height: number,
    depth: number, out: number, color: number) => {
    const [tx, tz] = f.t, [nx, nz] = f.n;
    // Each native strip is built from axis-aligned rectangles; it never carries
    // a rotated smooth facade. Source-aligned native spans need no staircase.
    const count = native && Math.abs(tx * tz) > 1e-8 ? Math.ceil(width / .55) : 1;
    for (let i = 0; i < count; i++) {
      const along = u + (i + .5) * width / count - width / 2;
      const x = f.c[0] + tx * along + nx * (f.out + out);
      const z = f.c[2] + tz * along + nz * (f.out + out);
      if (native) rows.push([x, f.c[1] + dy, z,
        Math.abs(tx) * width / count + Math.abs(nx) * depth, height,
        Math.abs(tz) * width / count + Math.abs(nz) * depth, color]);
      else rows.push([x, f.c[1] + dy, z, width, height, depth, -Math.atan2(tz, tx), color]);
    }
  };
  for (const f of native ? data.native : data.drawn) {
    if (f.existing) {
      // The earlier Tor glass, mullions, sill and jambs remain entirely exposed.
      // This slim outer casing sits beyond their recorded envelope.
      for (const sign of [-1, 1]) member(f, sign * (f.w / 2 + .16), 0,
        .06, f.h + .22, .07, 0, 0x9a9382);
      member(f, 0, f.h / 2 + .17, f.w + .38, .08, .16, .025, 0xb6ad98);
      continue;
    }
    const frame = 0x9a9c91;
    member(f, 0, 0, f.w, f.h, .035, 0, 0x657e80);
    for (const sign of [-1, 1]) {
      member(f, sign * (f.w / 2 + .04), 0, .08, f.h + .16, .075, .035, frame);
      member(f, 0, sign * (f.h / 2 + .04), f.w + .16, .08, .075, .035, frame);
    }
    member(f, 0, 0, .065, f.h, .055, .055, 0xb2b5a7);
    // Split shallow reflection strips leave the mullion visible. These are
    // estimated material accents, not lettering, merchandise or tenant names.
    for (const sign of [-1, 1]) member(f, sign * f.w * .25, f.h * .25,
      f.w * .36, f.h * .28, .018, .025, 0x8fa19a);
    member(f, 0, -f.h / 2 - .105, f.w + .20, .10, .15, .06, 0xb8b09b);
  }
}

export const NORTH_SHOPFRONTS_V254_COUNTS = data.counts;
export const NORTH_SHOPFRONTS_V254_CAMERAS = data.cameras;

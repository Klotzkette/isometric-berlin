type Point = readonly [number, number];
type Surface = readonly [number, number, number, number];
type Rows = number[][];

// Frontage axes and cardinal wall courses from the delivered LoD2 owners.
// The photo references set the opening rhythm and the material reading.
export const ODERBERGER_FRONTS = {
  bath: {
    owner: "DEBE03YY600003MZ",
    tile: "5_-5",
    front: [2687.35, -2082.28, 2723.72, -2058.57] as Surface,
    outward: 1,
    native: [
      [2724, -2058], [2724, -2060], [2720, -2060], [2720, -2062],
      [2716, -2062], [2716, -2064], [2714, -2064], [2714, -2066],
      [2710, -2066], [2710, -2068], [2708, -2068], [2708, -2070],
      [2704, -2070], [2704, -2072], [2702, -2072], [2702, -2074],
      [2698, -2074], [2698, -2076], [2696, -2076], [2696, -2078],
      [2692, -2078], [2692, -2080], [2690, -2080], [2690, -2082],
      [2686, -2082],
    ] as readonly Point[],
  },
  fire: {
    owner: "DEBE03YY600006Gq",
    tile: "4_-5",
    front: [2421.27, -2294.48, 2445.38, -2278.88] as Surface,
    outward: -1,
    native: [
      [2422, -2296], [2422, -2294], [2424, -2294], [2424, -2292],
      [2426, -2292], [2426, -2290], [2430, -2290], [2430, -2288],
      [2432, -2288], [2432, -2286], [2436, -2286], [2436, -2284],
      [2440, -2284], [2440, -2282], [2442, -2282], [2442, -2280],
      [2448, -2280],
    ] as readonly Point[],
  },
};

type Fitting = (
  u: number, y: number, width: number, height: number,
  color: number, offset: number, depth?: number,
) => void;

function facadeWriters(site: typeof ODERBERGER_FRONTS.bath, rows: Rows, arches: Rows, native: boolean) {
  const [ax, az, bx, bz] = site.front;
  const length = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / length;
  const dz = (bz - az) / length;
  const nx = dz * site.outward;
  const nz = -dx * site.outward;
  const yaw = -Math.atan2(dz, dx);
  const ground = 3;
  const nativeWalls = native ? site.native.slice(0, -1).map((a, i) => {
    const b = site.native[i + 1];
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / span;
    const tz = (b[1] - a[1]) / span;
    const projection = (x: number, z: number) => (x - ax) * dx + (z - az) * dz;
    return { a, tx, tz, start: projection(...a), end: projection(...b) };
  }) : [];

  const box: Fitting = (u, y, width, height, color, offset, depth = .09) => {
    if (!native) {
      rows.push([ax + dx * u + nx * offset, ground + y, az + dz * u + nz * offset,
        width, height, depth, yaw, color]);
      return;
    }
    const left = u - width / 2;
    const right = u + width / 2;
    for (const { a, tx, tz, start, end } of nativeWalls) {
      const lo = Math.max(Math.min(start, end), left);
      const hi = Math.min(Math.max(start, end), right);
      if (hi - lo < .024) continue;
      const ratio = tx * dx + tz * dz;
      const center = ((lo + hi) / 2 - start) / ratio;
      const span = (hi - lo) / Math.abs(ratio);
      // These ordered native courses are CCW exterior rings.
      rows.push([a[0] + tx * center + tz * offset, ground + y, a[1] + tz * center - tx * offset,
        tx ? span : depth, height, tz ? span : depth, color]);
    }
  };

  const arch: Fitting = (u, y, width, height, color, offset, depth = .09) => {
    if (!native) {
      arches.push([ax + dx * u + nx * offset, ground + y, az + dz * u + nz * offset,
        width, height, depth, yaw, color]);
      return;
    }
    box(u, y - .25 * height, width, .5 * height, color, offset, depth);
    box(u, y + .12 * height, .92 * width, .24 * height, color, offset, depth);
    box(u, y + .33 * height, .68 * width, .18 * height, color, offset, depth);
    box(u, y + .46 * height, .39 * width, .08 * height, color, offset, depth);
  };
  return { box, arch, length };
}

/** Public street faces, batched with the existing northern facade relief. */
export function appendOderbergerFacades(rows: Rows, arches: Rows, native: boolean): void {
  const bath = facadeWriters(ODERBERGER_FRONTS.bath, rows, arches, native);
  const stone = 0xb5ab97;
  const lightStone = 0xc4b9a4;
  const glass = 0x54666a;
  const sash = 0xb0b2a9;
  const portal = bath.length * .548;

  bath.box(bath.length / 2, 4.35, bath.length - .16, 8.7, 0xa49987, .068);
  bath.box(bath.length / 2, 13.4, bath.length - .16, 9.4, 0xb8ae9d, .068);
  for (const [y, height] of [[.45, .48], [7.75, .16], [9.03, .30], [17.65, .28], [18.05, .17]]) {
    bath.box(bath.length / 2, y, bath.length - .16, height, lightStone, .17, .17);
  }
  // Five wide lower arches to one side of the carved portal, four to the other.
  for (const position of [.078, .174, .27, .365, .46, .635, .73, .825, .92]) {
    const u = position * bath.length;
    bath.arch(u, 3.26, 2.95, 3.6, lightStone, .17);
    bath.arch(u, 3.22, 2.54, 3.26, glass, .24);
    for (const delta of [-.61, 0, .61]) bath.box(u + delta, 3.02, .071, 2.75, sash, .31);
    bath.box(u, 3.48, 2.54, .082, sash, .31);
    bath.box(u, 1.52, 2.78, .14, stone, .27, .22);
    bath.box(u, 11.87, 1.53, 2.40, stone, .16);
    bath.box(u, 11.87, 1.22, 2.07, glass, .23);
    bath.box(u, 11.88, .067, 2.07, sash, .30);
    bath.box(u, 12.2, 1.22, .07, sash, .30);
    bath.box(u, 13.14, 1.78, .16, lightStone, .21, .15);
    bath.box(u, 13.29, 1.27, .14, lightStone, .23, .17);
    bath.box(u, 10.61, 1.64, .13, lightStone, .24, .22);
  }
  for (const position of [.08, .14, .24, .32, .40, .48, .55, .63, .74, .83, .91]) {
    const u = position * bath.length;
    bath.arch(u, 16.56, 1.33, 1.45, lightStone, .15);
    bath.arch(u, 16.52, .96, 1.18, glass, .22);
  }
  for (let bay = 0; bay < 18; bay++) {
    const u = (bay + 1.5) * bath.length / 20;
    bath.arch(u, 8.39, 1.31, 1.18, lightStone, .16);
    bath.arch(u, 8.35, .89, .87, bay % 2 ? 0x77786e : glass, .23);
    bath.box(u, 8.14, .75, .095, sash, .30);
  }
  bath.arch(portal, 2.69, 4.23, 5.20, lightStone, .21, .19);
  bath.arch(portal, 2.26, 2.77, 4.36, 0x333d3c, .35);
  bath.arch(portal, 5.92, 3.23, 1.52, lightStone, .29, .23);
  bath.box(portal, 5.33, 3.70, .26, 0x9b917e, .37, .23);
  for (const side of [-1, 1]) {
    bath.box(portal + side * 1.72, 2.38, .23, 4.10, 0xaea28f, .39, .22);
    bath.box(portal + side * .83, 5.99, .20, .78, 0xa49784, .43, .15);
  }

  const fire = facadeWriters(ODERBERGER_FRONTS.fire, rows, arches, native);
  const clinker = 0xaa7957;
  const band = 0x8f634c;
  const reveal = 0xd3a17b;
  const width = fire.length - .16;
  fire.box(fire.length / 2, 6.84, width, 13.68, 0xb68a67, .068);
  fire.box(fire.length / 2, .37, width, .74, 0x6d6660, .13);
  for (const [y, h] of [[4.85, .19], [5.1, .12], [12.95, .18], [13.54, .21]]) {
    fire.box(fire.length / 2, y, width, h, band, .16, .14);
  }
  for (let corbel = 0; corbel < 38; corbel++) {
    const u = (corbel + 1) * fire.length / 39;
    fire.box(u, 13.23, .23, .31, clinker, .19, .23);
  }
  const axes = [.065, .178, .285, .394, .503, .61, .736, .83, .923];
  for (const fraction of axes) {
    const u = fraction * fire.length;
    for (const y of [6.75, 10.28]) {
      fire.arch(u, y, 1.64, 2.71, band, .15);
      fire.arch(u, y - .035, 1.32, 2.49, glass, .22);
      fire.box(u, y - .16, .065, 2.15, 0xd0cdc1, .28);
      fire.box(u, y + .31, 1.28, .074, 0xd0cdc1, .28);
      fire.box(u, y - 1.29, 1.62, .11, reveal, .23, .16);
    }
  }
  for (const fraction of axes.slice(1, 6)) {
    const u = fraction * fire.length;
    fire.arch(u, 2.43, 2.91, 4.54, reveal, .15);
    fire.arch(u, 2.33, 2.55, 4.32, 0x453932, .22);
    fire.box(u, 1.77, 2.49, 3.48, 0xa82d27, .30);
    fire.box(u, 1.77, .065, 3.48, 0x692622, .36);
    for (const y of [1.2, 2.34, 3.27]) fire.box(u, y, 2.39, .055, 0xbf443a, .37);
    for (const delta of [-.62, 0, .62]) fire.box(u + delta, 3.71, .053, .31, 0x988776, .31);
  }
  for (const fraction of axes.slice(6)) {
    const u = fraction * fire.length;
    fire.arch(u, 2.24, 1.86, 3.10, band, .15);
    fire.arch(u, 2.22, 1.60, 2.85, glass, .23);
    fire.box(u, 2.10, .071, 2.45, 0xb0a08b, .29);
  }
}

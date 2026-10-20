type Vec = [number, number, number];
type Parts = {
  native: boolean;
  box(position: Vec, size: Vec, tint: number, yaw?: number): void;
};

/** One illustrative stationary city bus; not a live service or surveyed vehicle. */
export const BVG_BUS_V253 = {
  center: [-149.24884382, -812.36876043] as const,
  yaw: 0.44599652523,
  length: 12,
  width: 2.55,
  height: 3.2,
  stop: "S+U Hauptbahnhof (Invalidenstraße)",
  osmPlatform: 382412794,
  osmStop: 817754406,
  illustrative: true,
} as const;

/** Shares the existing Hbf batch/material/lifetime; no textures or frame work. */
export function appendBvgBusV253(parts: Parts, terrainAt: (x: number, z: number) => number): number {
  const [x, z] = BVG_BUS_V253.center, yaw = BVG_BUS_V253.yaw;
  const base = terrainAt(x, z) + .14;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let count = 0;
  const box = (u: number, y: number, v: number, w: number, h: number, d: number, color: number) => {
    // Native members form orthogonal strips along the same plan, rather than
    // a rotated smooth bus or a large axis-aligned bounding-box substitute.
    const nu = parts.native ? Math.ceil(w / .4) : 1;
    const nv = parts.native ? Math.ceil(d / .4) : 1;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const du = ((i + .5) / nu - .5) * w, dv = ((j + .5) / nv - .5) * d;
      const ww = w / nu, dd = d / nv;
      const size: Vec = parts.native
        ? [Math.abs(c) * ww + Math.abs(s) * dd, h, Math.abs(s) * ww + Math.abs(c) * dd]
        : [w, h, d];
      parts.box([x + c * (u + du) + s * (v + dv), base + y, z - s * (u + du) + c * (v + dv)],
        size, color, parts.native ? 0 : yaw);
      count++;
    }
  };
  const yellow = 0xf4ce17, glass = 0x345460, dark = 0x262e31, trim = 0xd8dfda;
  box(0, .91, 0, 11.9, 1.12, 2.55, yellow);
  box(0, 2.06, 0, 11.65, 1.24, 2.48, glass);
  box(0, 2.83, 0, 11.9, .30, 2.55, yellow);
  box(-1, 3.08, 0, 4.6, .24, 1.75, 0xc3c7bd);
  box(0, .38, 0, 11.75, .16, 2.48, dark);
  for (const side of [-1, 1]) {
    for (const u of [-5.6, -3.5, -1.4, .7, 2.8, 4.9])
      box(u, 2.07, side * 1.255, .09, 1.24, .055, yellow);
    // Faceted tyres stand vertically and touch the road. The lower body is
    // above their contact patches; silver hubs sit on their outward faces.
    for (const u of [-3.55, 3.55]) {
      box(u, .49, side * 1.28, .96, .62, .17, dark);
      box(u, .49, side * 1.28, .64, .98, .17, dark);
      box(u, .49, side * 1.38, .34, .34, .05, 0x8b9290);
    }
    box(5.67, 2.45, side * 1.50, .31, .43, .16, dark);
  }
  // Front and central double doors on the right, toward the mapped platform.
  for (const u of [4.65, .65]) {
    box(u, 1.50, 1.286, 1.20, 2.14, .055, dark);
    for (const leaf of [-1, 1]) box(u + leaf * .30, 1.85, 1.325, .49, 1.20, .04, glass);
    box(u, 1.5, 1.355, .045, 2.05, .035, trim);
  }
  box(5.99, 2.1, 0, .055, 1.02, 2.30, glass);
  box(5.99, 2.70, 0, .06, .30, 2.26, dark);
  box(-5.99, 2.1, 0, .055, .93, 2.1, glass);
  for (const side of [-1, 1]) {
    box(6.00, .85, side * .88, .06, .19, .35, 0xfff4ce);
    box(-6.00, .85, side * 1.03, .06, .37, .16, 0xc5362a);
    box(0, .72, side * 1.30, 1.35, .46, .035, yellow);
  }
  // Small procedural BVG lettering: side badges and amber destination display.
  const letters = ["110101110101110", "101101101101010", "111100101101111"];
  for (let letter = 0; letter < 3; letter++) for (let row = 0; row < 5; row++)
    for (let col = 0; col < 3; col++) if (letters[letter][row * 3 + col] === "1") {
      const u = (letter * 4 + col - 5) * .105, y = .87 - row * .075;
      for (const side of [-1, 1]) box(side * u - 2, y, side * 1.315, .083, .060, .035, dark);
      box(6.03, 2.79 - row * .041, -(letter * 4 + col - 5) * .085, .03, .032, .061, 0xffd777);
    }
  return count;
}

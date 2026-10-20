import data from "./data/kulturbrauereiV252.json";
import north from "./data/northV185.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";

type Rows = number[][];
type Face = typeof data.drawn[number];

/** Compact source recipes join the existing northern batch; no extra mesh. */
export function appendKulturbrauereiV252(rows: Rows, native = false): void {
  const member = (f: Face, u: number, y: number, w: number, h: number, out: number, color: number) => {
    const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const tx = (f.b[0] - f.a[0]) / length, tz = (f.b[1] - f.a[1]) / length;
    const [nx, nz] = f.n, depth = .045;
    const x = f.a[0] + tx * u + nx * out, z = f.a[1] + tz * u + nz * out;
    if (native) rows.push([x, y, z, Math.abs(tx) * w + Math.abs(nx) * depth, h,
      Math.abs(tz) * w + Math.abs(nz) * depth, color]);
    else rows.push([x, y, z, w, h, depth, -Math.atan2(tz, tx), color]);
  };
  for (const f of native ? data.native : data.drawn) {
    for (const [u, y, w, h] of f.windows) {
      if (!f.existing) {
        member(f, u, y, w, h, .09, 0x728f95);
        member(f, u, y - h / 2 - .10, w + .22, .12, .17, 0xc9c1aa);
        member(f, u, y, .065, h, .14, 0xc5ceca);
      }
      // Existing panes keep their exact geometry, sills and transoms.
      member(f, u, y + h / 2 + .09, w + .21, .11, .17, 0xd5ceba);
      if (f.existing) member(f, u - w / 2 - .045, y, .07, h + .10, .15, 0xc5c4b6);
    }
  }
  for (const f of north.faces.filter(f => f.kind === "kulturbrauerei")) {
    const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const ground = 3 + buildingTerrainOffset(f.id, (f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2);
    const low = ground + f.wallBottom, high = ground + f.wallTop, height = high - low;
    const levels = Math.min(7, Math.max(1, Math.floor((height - 1) / 4.2)));
    const dy = (height - 1.5) / levels, bays = Math.max(1, Math.floor(length / 3.8)), pitch = length / bays;
    const recipe: Face = {owner: f.id, a: f.a, b: f.b, n: f.normal, low, high, existing: true, windows: []};
    for (let level = 0; level < levels; level++) {
      const y = low + 1.85 + level * dy;
      if (y + 1.15 >= high - .8) continue;
      const w = Math.min(1.65, pitch * .48), h = Math.min(2, dy * .58);
      for (let bay = 0; bay < bays; bay++) {
        const u = (bay + .5) * pitch, out = native ? 1.48 : .43;
        // Preserve each existing arch and central mullion; restrained crossbars
        // sit in the rectangular lower portion of the same retained opening.
        member(recipe, u, y - h * .21, w * .88, .055, out, 0xb7b7a1);
        member(recipe, u - w * .24, y - h * .14, w * .25, h * .30, out - .025, 0xa4b7ac);
      }
    }
  }
}

export const KULTURBRAUEREI_V252_CAMERAS = data.cameras;
export const KULTURBRAUEREI_V252_COUNTS = data.counts;

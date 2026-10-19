import { Group } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import nativeSupport from "./data/civicV246NativeFaces.json";

/** Retained OSM/LoD2 planes; small fittings are reference-based estimates.
 * Native fronts are sampled into independent axis-aligned surface blocks. */
export const CIVIC_V246 = {
  green: { osm: "54672713", address: "Platz vor dem Neuen Tor 1", camera: [520, 28, -1075], target: [555.8, 17, -1090.7] },
  spd: { osm: "47080629", address: "Wilhelmstraße / Stresemannstraße", camera: [1150, 30, 2205], target: [1115, 17, 2150] },
  rosa: { osm: "610863187", address: "Straße der Pariser Kommune 8A", camera: [4400, 40, 1245], target: [4365.8, 20, 1179.1] },
} as const;

type Face = { a: readonly number[]; b: readonly number[]; length: number; yaw: number; tx: number; tz: number };
function face(a: readonly number[], b: readonly number[]): Face {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { a, b, length, tx: (b[0] - a[0]) / length, tz: (b[1] - a[1]) / length, yaw: -Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

/** One small batch per site, so offscreen GPU retirement can work locally. */
export function createCivicPartyDetailsV246(native = false): Group {
  const root = new Group(); root.name = "Civic party architecture v246";
  root.userData = { civicV246: true, textureFree: true, fullStaticDetailOnTouch: true,
    sourceGeometryRetained: true, additiveOnly: true, keepInMinecraft: native,
    nativeMinecraft: native, blockNative: native, sourceReceipt: "civic-v246-source.json" };
  function site(key: "green" | "spd" | "rosa", name: string, draw: (put: (f: Face, u: number, y: number, w: number, h: number, depth: number, color: number, offset?: number) => void) => void) {
    const rows: number[][] = [], cells = new Map<string, number[]>();
    const surfaceSamples = new Map<Face, number[][]>();
    function samples(f: Face): number[][] {
      const previous = surfaceSamples.get(f);
      if (previous) return previous;
      const values: number[][] = [];
      for (const [axis, plane, start, end, sign, low, high] of nativeSupport[key].faces) {
        if ((axis === 0 ? -f.tz : f.tx) * sign <= .2) continue;
        for (let along = start + .25; along < end; along += .5) {
          const sx = axis === 0 ? plane : along, sz = axis === 2 ? plane : along;
          const dx = sx - f.a[0], dz = sz - f.a[1];
          const u = dx * f.tx + dz * f.tz;
          // Four-metre core columns and two-metre outer blocks are independent
          // retained silhouettes. Project fittings onto their exposed planes,
          // never create a second stepped facade around the drawn diagonal.
          if (u < -.25 || u > f.length + .25 || Math.abs(-dx * f.tz + dz * f.tx) > 3.2) continue;
          values.push([sx + (axis === 0 ? sign * .25 : 0), sz + (axis === 2 ? sign * .25 : 0), u, low, high]);
        }
      }
      surfaceSamples.set(f, values);
      return values;
    }
    function put(f: Face, u: number, y: number, w: number, h: number, depth: number, color: number, offset = .12) {
      const x = f.a[0] + f.tx * u - f.tz * offset;
      const z = f.a[1] + f.tz * u + f.tx * offset;
      if (!native) { rows.push([x, y, z, w, h, depth, f.yaw, color]); return; }
      // Every block's inner face touches an actual retained native wall. All
      // colours share the same skin so later window divisions replace cells.
      for (const [cx, cz, projectedU, low, high] of samples(f)) {
        if (Math.abs(projectedU - u) > Math.max(w / 2, .25)) continue;
        const bottom = Math.max(low, y - h / 2), top = Math.min(high, y + h / 2);
        for (let cy = Math.floor(bottom * 2) / 2 + .25; cy < top; cy += .5) {
          if (cy - .25 < low - 1e-6 || cy + .25 > high + 1e-6) continue;
          cells.set(`${cx},${cy},${cz}`, [cx, cy, cz, .5, .5, .5, color]);
        }
      }
    }
    draw(put);
    // Merge only vertically adjacent equal-colour half-metre cells. This is
    // exactly the same occupied skin, with far fewer matrices to keep on GPU.
    const nativeRows: number[][] = [];
    if (native) {
      const columns = new Map<string, number[][]>();
      for (const cell of cells.values()) {
        const key = `${cell[0]},${cell[2]},${cell[6]}`;
        const column = columns.get(key) ?? [];
        column.push(cell); columns.set(key, column);
      }
      for (const column of columns.values()) {
        column.sort((a, b) => a[1] - b[1]);
        let run = column[0].slice();
        for (const cell of column.slice(1)) {
          if (Math.abs(cell[1] - .25 - (run[1] + run[4] / 2)) < 1e-6) {
            run[1] += .25; run[4] += .5;
          } else { nativeRows.push(run); run = cell.slice(); }
        }
        nativeRows.push(run);
      }
    }
    const mesh = justicePalaceV183Boxes(native ? nativeRows : rows, native);
    mesh.name = name; mesh.userData.civicSiteV246 = name; root.add(mesh);
  }
  site("green", "Green headquarters: yellow plaster, green divided windows and entrance", put => {
    // The actual public front is the western measured wall, not the old grid
    // across the building's centre. The measured roof remains untouched.
    const f = face([555, -1100.2], [556.5, -1081.3]);
    put(f, f.length / 2, 16, f.length, 21.6, .09, 0xe5d799, .08);
    for (const y of [8.8, 12.9, 17, 21.1, 25.2]) {
      for (let bay = 0; bay < 6; bay++) {
        const u = 1.9 + bay * 3.05;
        if (y === 8.8 && bay === 2) continue;
        put(f, u, y, 1.6, 2.65, .11, 0x476d59, .18);
        put(f, u, y, 1.30, 2.35, .10, 0x92adb0, .255);
        put(f, u, y, .09, 2.4, .08, 0x456d56, .34);
        put(f, u, y + .48, 1.4, .09, .08, 0x456d56, .34);
        put(f, u, y - 1.39, 1.86, .15, .35, 0xece2bc, .20);
        put(f, u, y + 1.5, 1.85, .13, .21, 0xdacfa6, .15);
      }
    }
    for (const y of [10.6, 26.9]) put(f, f.length / 2, y, f.length + .15, .22, .32, 0xe9dfb6, .18);
    put(f, 8, 7.1, 2.15, 3.8, .12, 0x37694c, .2);
    put(f, 8, 8.0, 1.5, 1.45, .1, 0x8eaba6, .29);
    put(f, 9.65, 8.65, .65, .9, .12, 0x5b974c, .2);
  });
  site("spd", "Willy-Brandt-Haus: pale stone, atrium glazing and rounded prow", put => {
    const fronts = [face([1119.5, 2169.2], [1114.4, 2068.5]), face([1060.4, 2086.6], [1111.3, 2171.5])];
    for (const f of fronts) {
      put(f, f.length / 2, 15.7, f.length, 20.8, .09, 0xe5ddc8, .08);
      const bays = Math.floor(f.length / 3.8);
      for (let row = 0; row < 6; row++) for (let bay = 0; bay < bays; bay++) {
        const u = (bay + .5) * f.length / bays;
        const y = 7.4 + row * 3.35;
        put(f, u, y, f.length / bays - .72, 2.45, .10, 0x536e78, .18);
        put(f, u, y + .35, f.length / bays - .95, .68, .06, 0x9eb7b6, .255);
        put(f, u, y, .10, 2.4, .08, 0x33494e, .31);
      }
      // Broad white horizontal bands and paired stone piers frame the tall
      // glass foyer; these are shallow skins, never replacement source mass.
      for (let row = 0; row < 7; row++) put(f, f.length / 2, 5.7 + row * 3.35, f.length, .35, .22, 0xf0e9d9, .19);
    }
    const f = fronts[0];
    put(f, 33, 15.3, 22, 19.8, .10, 0x607d83, .35);
    for (let u = 22; u <= 44; u += 2.2) put(f, u, 15.3, .12, 20, .13, 0xc4d0cb, .46);
    for (let y = 6; y < 25; y += 1.7) put(f, 33, y, 22, .09, .12, 0x374b4e, .47);
    for (const u of [21.4, 44.6]) put(f, u, 15.4, .9, 21, .65, 0xe9e0cd, .35);
    // Polygonal curved corner follows the retained OSM prow, avoiding a new tower.
    const prow = [[1119.5,2169.2],[1117.6,2169.3],[1117.5,2171],[1116.8,2171.8],[1116.1,2172.3],[1114.8,2172.4],[1113.9,2172.1],[1112.8,2170.7]];
    for (let i = 0; i < prow.length - 1; i++) {
      const s = face(prow[i + 1], prow[i]);
      put(s, s.length / 2, 20.6, s.length, 10.9, .12, 0x3d6978, .2);
      for (const y of [15.3, 18.7, 22.1, 25.5]) put(s, s.length / 2, y, s.length, .24, .3, 0xe8e1d0, .28);
    }
    put(f, 7, 11.8, 4.6, 1.7, .12, 0xc23d3d, .26);
  });
  site("rosa", "Rosa-Luxemburg-Stiftung: brick bands, red frames and concrete crosses", put => {
    const corners = [[4345.06,1185.77],[4366.19,1200.87],[4386.56,1172.42],[4365.43,1157.3]];
    for (let side = 0; side < 4; side++) {
      const f = face(corners[side], corners[(side + 1) % 4]);
      for (const y of [4.4, 12.7, 16.9, 21.1, 25.3, 29.5, 33.7, 38.5])
        put(f, f.length / 2, y, f.length, y === 4.4 ? 2.7 : 1.35, .1, 0x9b594b, .09);
      const count = Math.round(f.length / 2.25);
      for (const y of [15, 19.2, 23.4, 27.6, 31.8, 36.3]) for (let i = 0; i < count; i++) {
        const u = (i + .5) * f.length / count;
        put(f, u, y, f.length / count - .12, 2.5, .1, 0x8b4140, .18);
        put(f, u, y, f.length / count - .36, 2.18, .09, 0x91a5a9, .26);
        put(f, u, y + .62, f.length / count - .36, .09, .08, 0x8d4a46, .33);
      }
      put(f, f.length / 2, 8.8, f.length, 5.4, .1, 0x685c59, .18);
      // Piecewise narrow diagonal strips keep a single cheap box batch.
      // At viewing scale they form the published X-shaped concrete supports.
      const crosses = Math.round(f.length / 6.4), steps = native ? 11 : 28;
      for (let c = 0; c < crosses; c++) for (const dir of [-1, 1]) for (let i = 0; i < steps; i++) {
        const t = (i + .5) / steps;
        put(f, (c + .5 + dir * (t - .5) * .88) * f.length / crosses, 6.2 + t * 5.2,
          .62, 5.2 / steps + .15, .20, 0xdbd9cf, .36);
      }
      put(f, f.length / 2, 7, f.length, .08, .12, 0x8b4440, .54);
      for (let u = .6; u < f.length; u += .7) put(f, u, 6.5, .055, 1, .08, 0x8b4440, .54);
    }
  });
  return freezeStaticSceneTransforms(root);
}

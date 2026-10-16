import { Color } from "three";
import scope from "./data/districtHouseScopeV225.json";

type Rgb = readonly [number, number, number];
const linear = (hex: number): Rgb => new Color(hex).toArray().map(value => Math.round(value * 255)) as [number, number, number];
export const DISTRICT_HOUSE_REGIONS_V225 = scope.regions;
type ScopeRegion = {
  bounds: readonly number[];
  grid: { size: number; x0: number; z0: number; width: number; cells: string };
  boundaryCells: Readonly<Record<string, number[][][][] | undefined>>;
};
type RegionSelector = (x: number, z: number) => number;
const SCHOOL_OWNERS = new Set(["DEBE06YYB0000AUq", "DEBE06YYB0000nL1", "DEBE06YYB0000nx8",
  "B0000AUq", "B0000nL1", "B0000nx8", "way/31544586", "way/35607217", "way/35607218", "way/387263943"]);

function insideRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** Selection only: exact ALKIS rings and the documented finite school margin.
 * No change to building/coverage geometry, and no per-frame scope work. */
export function districtHouseRegionV225(x: number, z: number): number {
  return districtHouseRegionInScopeV225(scope.regions, x, z);
}

/** Shared exact lookup; supplying another scope does not alter the frozen v225 selector. */
export function districtHouseRegionInScopeV225(regions: readonly ScopeRegion[], x: number, z: number): number {
  return regions.findIndex(region => {
    const [x0, z0, x1, z1] = region.bounds;
    if (x < x0 || x > x1 || z < z0 || z > z1) return false;
    // Exact offline cell containment avoids scanning detailed ALKIS rings for
    // ordinary interior points. Boundary cells still use the complete rings.
    const grid = region.grid;
    const index = (Math.floor(z / grid.size) - grid.z0) * grid.width + Math.floor(x / grid.size) - grid.x0;
    const cell = grid.cells[index];
    if (cell !== "2") return cell === "1";
    const fragments = region.boundaryCells[String(index)] ?? [];
    return fragments.some(poly => insideRing(x, z, poly[0]) &&
      !poly.some((hole, index) => index > 0 && insideRing(x, z, hole)));
  });
}

/** Only whole ordinary footprints inside a requested region qualify. */
export function districtHouseOwnerV225(sourceId: string, ring: readonly (readonly number[])[], originX: number, originZ: number, scale = 1, select: RegionSelector = districtHouseRegionV225): boolean {
  if (SCHOOL_OWNERS.has(sourceId) || ring.length < 3) return false;
  const region = select(originX + ring[0][0] * scale, originZ + ring[0][1] * scale);
  return region >= 0 && ring.every(([x, z]) => select(originX + x * scale, originZ + z * scale) === region);
}

// Neutral roof/wall separation is a display choice, not a slate-material claim.
// Existing source-coloured roofs and all authored paint never enter this path.
export const DISTRICT_HOUSE_ROOF_HEX_V225 = 0x777e7b;
export const DISTRICT_HOUSE_ROOF_V225: Rgb = linear(DISTRICT_HOUSE_ROOF_HEX_V225);
const DRAWN_BOTTOM = linear(0x7a9497), DRAWN_TOP = linear(0x4e6972), NATIVE = linear(0x5d777c);
const GLASS_BOTTOM = linear(0x788b8b), GLASS_TOP = linear(0xa6bbc0), GLASS_NATIVE = linear(0x849d9f);
const equal = (values: Uint16Array, at: number, rgb: Rgb): boolean =>
  values[at + 3] === rgb[0] * 257 && values[at + 4] === rgb[1] * 257 && values[at + 5] === rgb[2] * 257;

/** The immutable v188/v209 recipes store one unshared four-vertex quad per
 * pane. Require its exact index topology, dimensions and both original colours;
 * sills/crossbars/cornices and arbitrary authored glass remain unchanged. Reuse
 * final colour cells only, retaining all geometry and the native block family. */
export function* shadeDistrictHousePanesV225(
  kind: string, vertices: Uint16Array, indices: Uint16Array | Uint32Array,
  start: number, count: number, originX: number, originZ: number, native: boolean,
  select: RegionSelector = districtHouseRegionV225,
): Generator<void, number> {
  if (kind !== "district-facades-v188" && kind !== "kiez-facades-v209") return 0;
  let changed = 0;
  for (let at = start; at + 5 < start + count; at += 6) {
    if ((at - start) % 4092 === 0) yield;
    const a = indices[at], b = indices[at + 1], c = indices[at + 2], d = indices[at + 5];
    if (b !== a + 1 || c !== a + 2 || d !== a + 3 || indices[at + 3] !== a || indices[at + 4] !== c) continue;
    const p = a * 6, q = b * 6, r = c * 6, s = d * 6;
    if (!equal(vertices, p, native ? NATIVE : DRAWN_BOTTOM) || !equal(vertices, q, native ? NATIVE : DRAWN_BOTTOM) ||
        !equal(vertices, r, native ? NATIVE : DRAWN_TOP) || !equal(vertices, s, native ? NATIVE : DRAWN_TOP)) continue;
    if (vertices[p + 1] !== vertices[q + 1] || vertices[r + 1] !== vertices[s + 1] ||
        vertices[p] !== vertices[s] || vertices[p + 2] !== vertices[s + 2] ||
        vertices[q] !== vertices[r] || vertices[q + 2] !== vertices[r + 2]) continue;
    if (Math.abs(Math.hypot(vertices[q] - vertices[p], vertices[q + 2] - vertices[p + 2]) - (native ? 115 : 132)) > 1.5 ||
        Math.abs(vertices[r + 1] - vertices[p + 1] - (native ? 140 : 180)) > 1) continue;
    const region = select(originX + vertices[p] / 100, originZ + vertices[p + 2] / 100);
    if (region < 0 || select(originX + vertices[q] / 100, originZ + vertices[q + 2] / 100) !== region) continue;
    for (let i = 0; i < 4; i++) {
      const tone = native ? GLASS_NATIVE : i < 2 ? GLASS_BOTTOM : GLASS_TOP;
      for (let channel = 0; channel < 3; channel++) vertices[(a + i) * 6 + 3 + channel] = tone[channel] * 257;
    }
    changed++;
  }
  return changed;
}

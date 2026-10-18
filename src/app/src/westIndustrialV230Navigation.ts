import data from "./data/westIndustrialV230Navigation.json";
import nativeData from "./data/westIndustrialV230Native.json";

const CELL = 8;
interface NativeSite {
  bounds: number[];
  boxes: Float32Array;
  cells: Map<number, Uint32Array>;
  originX: number;
  originZ: number;
  columns: number;
  terrainTop: number | null;
}
let nativeNavigation: NativeSite[] | null = null;

/** Copy only collision bounds on first native use. The weak construction sites,
 * colours and row arrays are never retained by the navigation index. */
function nativeSites(): NativeSite[] {
  return nativeNavigation ??= nativeData.sites.map(site => {
    const boxes = new Float32Array(site.skinCount * 6);
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    site.blocks.forEach(([x, y, z, w, h, d], i) => {
      if (i >= site.skinCount) return;
      boxes.set([x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2], i * 6);
      bounds[0] = Math.min(bounds[0], x - w / 2); bounds[1] = Math.min(bounds[1], z - d / 2);
      bounds[2] = Math.max(bounds[2], x + w / 2); bounds[3] = Math.max(bounds[3], z + d / 2);
    });
    const originX = Math.floor(bounds[0] / CELL), originZ = Math.floor(bounds[1] / CELL);
    const columns = Math.floor(bounds[2] / CELL) - originX + 1;
    const staging = new Map<number, number[]>();
    for (let i = 0; i < boxes.length; i += 6)
      for (let gz = Math.floor(boxes[i + 2] / CELL); gz <= Math.floor(boxes[i + 5] / CELL); gz++)
        for (let gx = Math.floor(boxes[i] / CELL); gx <= Math.floor(boxes[i + 3] / CELL); gx++) {
          const key = (gz - originZ) * columns + gx - originX;
          const offsets = staging.get(key); if (offsets) offsets.push(i); else staging.set(key, [i]);
        }
    const cells = new Map<number, Uint32Array>();
    for (const [key, offsets] of staging) cells.set(key, Uint32Array.from(offsets));
    const pads = data.sites.find(s => s.key === site.key)?.pads ?? [];
    return { bounds, boxes, cells, originX, originZ, columns,
      terrainTop: pads.length ? Math.max(...pads.map(p => Math.floor(p.high) + 1)) : null };
  });
}
function nativeSupportAt(x: number, z: number, limit: number, terrain = false): number | null {
  let support: number | null = null;
  for (const site of nativeSites()) if (inBounds(site.bounds, x, z)) {
    if (terrain && site.terrainTop === null) continue;
    const maxY = terrain ? Math.min(limit, site.terrainTop!) : limit;
    const offsets = site.cells.get((Math.floor(z / CELL) - site.originZ) * site.columns + Math.floor(x / CELL) - site.originX);
    if (!offsets) continue;
    const b = site.boxes;
    for (const i of offsets) {
      const top = b[i + 4];
      if (x < b[i] || x > b[i + 3] || z < b[i + 2] || z > b[i + 5] || top > maxY || top <= (support ?? -Infinity)) continue;
      // A merge seam inside a taller wall is not a walkable ledge. Terrain
      // deliberately reports the foundation beneath the building volume.
      if (!terrain && offsets.some(j => b[j + 1] <= top && b[j + 4] > top &&
        x >= b[j] && x <= b[j + 3] && z >= b[j + 2] && z <= b[j + 5])) continue;
      support = top;
    }
  }
  return support;
}
function nativeSolidAt(x: number, y: number, z: number, radius: number): boolean {
  for (const site of nativeSites()) if (inBounds(site.bounds, x, z, radius)) {
    const b = site.boxes;
    const x0 = Math.max(site.originX, Math.floor((x - radius) / CELL));
    const x1 = Math.min(site.originX + site.columns - 1, Math.floor((x + radius) / CELL));
    const z0 = Math.max(site.originZ, Math.floor((z - radius) / CELL));
    const z1 = Math.min(Math.floor(site.bounds[3] / CELL), Math.floor((z + radius) / CELL));
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const offsets = site.cells.get((gz - site.originZ) * site.columns + gx - site.originX);
      if (!offsets) continue;
      for (const i of offsets) {
        if (y <= b[i + 1] || y >= b[i + 4]) continue;
        const dx = Math.max(b[i] - x, 0, x - b[i + 3]), dz = Math.max(b[i + 2] - z, 0, z - b[i + 5]);
        if (dx * dx + dz * dz <= radius * radius) return true;
      }
    }
  }
  return false;
}

function inside(ring: readonly number[][], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
function contains(p: { ring: number[][]; holes: number[][][] }, x: number, z: number): boolean {
  return inside(p.ring, x, z) && !p.holes.some(r => inside(r, x, z));
}
function inBounds(b: readonly number[], x: number, z: number, margin = 0): boolean {
  return x >= b[0] - margin && x <= b[2] + margin && z >= b[1] - margin && z <= b[3] + margin;
}
function roofAt(triangles: readonly number[][][], x: number, z: number): number | null {
  let roof: number | null = null;
  for (const [a, b, c] of triangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -.000001 || v < -.000001 || u + v > 1.000001) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    roof = Math.max(roof ?? -Infinity, y);
  }
  return roof;
}
export function westIndustrialV230RoofAt(x: number, z: number, native = false): number | null {
  if (native) return nativeSupportAt(x, z, Infinity);
  for (const site of data.sites) if (inBounds(site.bounds, x, z)) {
    const roof = roofAt(site.roofTriangles, x, z); if (roof !== null) return roof;
  }
  return null;
}
/** Real represented pad support also exists where the earlier city has no tile. */
export function westIndustrialV230TerrainAt(x: number, z: number, native = false): number | null {
  if (native) return nativeSupportAt(x, z, Infinity, true);
  for (const site of data.sites) if (inBounds(site.bounds, x, z))
    for (const pad of site.pads) if (contains(pad, x, z)) return pad.high;
  return null;
}
/** Courtyards stay open and a high roof never lifts a pedestrian from below. */
export function westIndustrialV230GroundAt(x: number, z: number, feet: number, native = false): number | null {
  if (!Number.isFinite(feet)) return null;
  if (native) return nativeSupportAt(x, z, feet + .45);
  for (const site of data.sites) if (inBounds(site.bounds, x, z)) {
    const roof = roofAt(site.roofTriangles, x, z);
    if (roof !== null && feet >= roof - .45) return roof;
    for (const pad of site.pads) if (contains(pad, x, z)) {
      const y = pad.high;
      if (feet >= y - .45) return y;
    }
  }
  return null;
}
function towerSolidAt(site: typeof data.sites[number], x: number, y: number, z: number, margin: number): boolean {
  const tower=site.tower;
  if (!tower) return false;
  const profile=tower.profile;
  if(y<profile[0][0] || y>profile[profile.length-1][0])return false;
  for(let i=1;i<profile.length;i++)if(y<=profile[i][0]){
    const [lo,r0]=profile[i-1],[hi,r1]=profile[i];
    const r=r0+(r1-r0)*(y-lo)/(hi-lo), d=Math.hypot(x-tower.center[0],z-tower.center[1]);
    return d>=r-tower.thickness-margin && d<=r+margin;
  }
  return false;
}
export function westIndustrialV230SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (native && nativeSolidAt(x, y, z, radius)) return true;
  // Preserve the enclosed source volume as solid; the exact native surface
  // cells above additionally cover its independently rasterised outer edges.
  for (const site of data.sites) if (inBounds(site.bounds, x, z, radius)) {
    if (!native && towerSolidAt(site,x,y,z,radius)) return true;
    for (const p of site.owners) {
      if (y <= p.low || y > p.high) continue;
      if (contains(p, x, z)) {
        const roof = roofAt(site.roofTriangles, x, z); if (roof !== null && y < roof) return true;
      }
      if (radius > 0) for (const ring of [p.ring, ...p.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        const px = a[0] + t * dx, pz = a[1] + t * dz;
        if (Math.hypot(x - px, z - pz) < radius) {
          const roof = roofAt(site.roofTriangles, px, pz); if (roof !== null && y < roof) return true;
        }
      }
    }
    for (const pad of site.pads) if (y > pad.low && y < pad.high && contains(pad, x, z)) return true;
  }
  return false;
}

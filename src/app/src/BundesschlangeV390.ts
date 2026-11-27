import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Int8BufferAttribute, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Uint8BufferAttribute,
} from "three";
import source from "./data/bundesschlangeV390.json";
import type { VoxelPayload } from "./terrainPayload";

type Style = "street" | "garden" | "head";
type Site = typeof source.sites[number];
type Face = [edge: number, beginCm: number, endCm: number, style: Style];
type Wall = {
  x: number; z: number; dx: number; dz: number; length: number; low: number; high: number;
  along: number; style: Style;
};
const owners = new Map(source.sites.map(site => [site.prism.id, JSON.stringify(site.prism)]));
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const brick = 0xd5af80, yellowBrick = 0xddc29a, railBrick = 0xcfa777, coping = 0xdfd2bc;
const metal = 0xb6b5a9, reveal = 0x685e50, pane = 0x697e83, palePane = 0x869394;

// One indexed, vertex-coloured skin. Each window is cut into the elevation's
// strips, so even at long distances no pair of coplanar coloured panels fights.
class Elevation {
  positions: number[] = [];
  colours: number[] = [];
  normals: number[] = [];
  indices: number[] = [];
  private linear = new Map<number, Color>();

  rect(w: Wall, left: number, right: number, bottom: number, top: number, colour: number) {
    if (right - left < .002 || top <= bottom) return;
    let c = this.linear.get(colour);
    if (!c) { c = new Color(colour); this.linear.set(colour, c); }
    const light = .9 + .10 * (w.dz * .6 + w.dx * .8);
    const r = Math.round(c.r * light * 255), g = Math.round(c.g * light * 255), b = Math.round(c.b * light * 255);
    const first = this.positions.length / 3;
    const ax = w.x + w.dx * left, az = w.z + w.dz * left;
    const bx = w.x + w.dx * right, bz = w.z + w.dz * right;
    this.positions.push(ax,bottom,az, ax,top,az, bx,top,bz, bx,bottom,bz);
    this.colours.push(r,g,b, r,g,b, r,g,b, r,g,b);
    const nx = Math.round(127 * w.dz), nz = Math.round(-127 * w.dx);
    this.normals.push(nx,0,nz, nx,0,nz, nx,0,nz, nx,0,nz);
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  band(w: Wall, bottom: number, top: number, colour: number) {
    this.rect(w, 0, w.length, bottom, top, colour);
  }

  floor(w: Wall, level: number, floors: number) {
    const pitch = (w.high - w.low - .32) / floors;
    const floor = w.low + .13 + level * pitch;
    const field = w.style === "street" ? yellowBrick : w.style === "head" ? coping : brick;
    const glazing = w.style === "garden" || w.style === "head" && level < 4;
    const sill = floor + pitch * (level === 0 && w.style === "head" ? .10 : glazing ? .29 : .25);
    const lintel = floor + pitch * (glazing ? .87 : .83);
    this.band(w, floor, sill - .075, field);
    this.band(w, sill - .075, sill, glazing ? metal : field);
    this.band(w, lintel, lintel + .085, glazing ? reveal : field);
    this.band(w, lintel + .085, floor + pitch, field);
    // Aligned axes follow the running length of the surveyed curve across
    // short tessellation facets. The park elevation has continuous ribbon
    // glazing, the entrance elevation has both upright and horizontal lights.
    const step = w.style === "head" ? 3.6 : 3.95;
    const first = Math.floor(w.along / step), last = Math.ceil((w.along + w.length) / step);
    for (let bay = first; bay < last; bay++) {
      const u = bay * step - w.along;
      const part = (a: number, b: number, y0: number, y1: number, colour: number) =>
        this.rect(w, Math.max(0, u + a), Math.min(w.length, u + b), y0, y1, colour);
      if (glazing) {
        part(0, .11, sill, lintel, metal);
        part(.11, step * .57, sill, lintel, (bay + level) % 3 === 0 ? palePane : pane);
        part(step * .57, step * .57 + .085, sill, lintel, metal);
        part(step * .57 + .085, step, sill, lintel, (bay + level) % 3 === 1 ? palePane : pane);
      } else {
        const upright = (bay % 4 + 4) % 4 === 0;
        const inset = upright ? 1.43 : .49;
        const bottom = upright ? sill : sill + pitch * .24;
        part(0, inset, sill, lintel, field);
        part(step - inset, step, sill, lintel, field);
        part(inset, step - inset, sill, bottom, field);
        part(inset, inset + .09, bottom, lintel, reveal);
        part(inset + .09, step - inset, bottom, lintel, (bay + level) % 3 === 1 ? palePane : pane);
      }
    }
  }

  wall(w: Wall, floors: number) {
    this.band(w, w.low, w.low + .13, railBrick);
    for (let i = 0; i < floors; i++) this.floor(w, i, floors);
    this.band(w, w.high - .19, w.high, coping);
  }
}

function drawnWalls(site: Site): Wall[] {
  const ring = site.prism.ring;
  let perimeter = 0;
  const distance = ring.map(([x,z], i) => {
    const start = perimeter, b = ring[(i + 1) % ring.length];
    perimeter += Math.hypot(x - b[0], z - b[1]) / 10;
    return start;
  });
  return (site.faces as Face[]).map(([i,start,end,style]) => {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l;
    return { x: a[0] / 10 + dx * start / 100 + dz * .16, z: a[1] / 10 + dz * start / 100 - dx * .16,
      dx, dz, length: (end - start) / 100, low: site.prism.y0_dm / 10,
      high: (site.prism.y0_dm + site.prism.h_dm) / 10, along: distance[i] + start / 100, style };
  });
}

function matchingGrid(v: VoxelPayload) {
  return !!v.building_rows && v.cell_m === 4 && v.schema_version === 2 &&
    Object.entries(source.grid).every(([k,n]) => v.grid[k as keyof typeof source.grid] === n) &&
    JSON.stringify(v.classes) === JSON.stringify(source.classes);
}

function blockWall(v: VoxelPayload, row: number[], facade: Wall): Wall | null {
  const [x,z,d,lo,hi,kind] = row;
  const [nx,nz] = directions[d];
  const columns = (i: number, j: number) => {
    const offset = i - v.grid.min_x_idx;
    return v.building_rows?.[j - v.grid.min_z_idx]?.filter(([start, count]) =>
      start <= offset && offset < start + count) ?? [];
  };
  if (!columns(x,z).some(([, , l, h, k]) => l === lo && h === hi && k === kind) ||
      columns(x + nx,z + nz).some(([, , l, h]) => l < hi && h > lo)) return null;
  const dx = -nz, dz = nx;
  const ax = x * 4 + 2 + nx * 2.18 - dx * 2, az = z * 4 + 2 + nz * 2.18 - dz * 2;
  return { x: ax, z: az, dx, dz, length: 4, low: lo / 10, high: hi / 10, style: facade.style,
    along: facade.along + (ax - facade.x) * facade.dx + (az - facade.z) * facade.dz };
}

/** Add only the facades of these nine measured building parts. All
 * foundations, roof profiles, courtyards and walking surfaces remain owned by
 * the original city geometry. */
export function createBundesschlangeV390(records: readonly unknown[], voxel?: VoxelPayload) {
  if (voxel && !matchingGrid(voxel)) return null;
  const accepted = new Map<string, boolean>();
  for (const p of records) {
    if (!p || typeof p !== "object" || !("id" in p) || typeof p.id !== "string" || !owners.has(p.id)) continue;
    accepted.set(p.id, !accepted.has(p.id) && JSON.stringify(p) === owners.get(p.id));
  }
  const model = new Elevation();
  for (const site of source.sites) {
    if (!accepted.get(site.prism.id)) continue;
    const walls = drawnWalls(site);
    if (voxel) {
      for (const row of site.native) {
        const w = blockWall(voxel, row, walls[row[6]]);
        if (w) model.wall(w, site.floors);
      }
    } else {
      for (const w of walls) model.wall(w, site.floors);
    }
  }
  if (!model.indices.length) return null;
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(model.positions, 3));
  geo.setAttribute("color", new Uint8BufferAttribute(model.colours, 3, true));
  geo.setIndex(model.indices);
  geo.setAttribute("normal", new Int8BufferAttribute(model.normals, 3, true));
  geo.computeBoundingSphere();
  const dayMaterial = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const nightMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: .88 });
  // Only the lighter glass bays pick up the warm room light. The ordinary
  // viewer light switch controls the same emissive uniform as other landmarks.
  nightMaterial.userData.nightEmissive = 0xe2bb83;
  nightMaterial.userData.nightEmissiveIntensity = .53;
  nightMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
       totalEmissiveRadiance *= step(vColor.r * 1.12, vColor.b) * step(0.165, vColor.r);`);
  };
  nightMaterial.customProgramCacheKey = () => "bundesschlange-window-light-v390";
  const mesh = new Mesh(geo, dayMaterial);
  mesh.name = "Bundesschlange am Moabiter Werder";
  mesh.userData = { dayMaterial, nightMaterial, facadeOnly: true, textureFree: true, blockNative: !!voxel,
    keepInMinecraft: !!voxel, fullAndMobileIdentical: true };
  return mesh;
}

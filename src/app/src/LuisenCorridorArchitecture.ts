import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { LUISEN_CORRIDOR_SOURCE as S, LUISEN_CORRIDOR_GROUP, MINECRAFT_LUISEN_CORRIDOR_GROUP, LUISEN_CORRIDOR_EVIDENCE } from "./luisenCorridorProfile";

type Point = readonly [number, number];
type Triple = [number, number, number];
export type LuisenSourcePrism = Pick<PrismBuilding, "id" | "ring" | "holes" | "y0_dm" | "h_dm">;
type Wall = { part: PrismBuilding; a: Point; dx: number; dz: number; nx: number; nz: number; length: number; street: boolean; front: boolean };
export type LuisenBlock = { position: Triple; size: Triple; yaw: number; color: number; role: string; sourceId: string; normal: Point; glass: boolean };
type Voxels = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type LuisenOptions = { mobileLike?: boolean; minecraft?: boolean; voxels?: Voxels; sourcePrisms?: readonly LuisenSourcePrism[]; diagnostics?: boolean };
const GLASS = 0x506d73, FRAME = 0xe8e7dd, DARK = 0x485050;

function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function luisenPrismContains(part: LuisenSourcePrism, x: number, z: number): boolean {
  return inRing(part.ring, x * 10, z * 10) && !(part.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}
function nearestRoad(x: number, z: number): { distance: number; x: number; z: number } {
  let nearest = { distance: Infinity, x, z };
  for (const road of S.roads) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const px = a[0] + t * dx, pz = a[1] + t * dz, distance = Math.hypot(x - px, z - pz);
    if (distance < nearest.distance) nearest = { distance, x: px, z: pz };
  }
  return nearest;
}
export function luisenCorridorWalls(): Wall[] {
  const walls: Wall[] = [];
  for (const part of S.prisms as PrismBuilding[]) for (const [ri, ring] of [part.ring, ...(part.holes ?? [])].entries()) {
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a: Point = [ring[i][0] / 10, ring[i][1] / 10], b = ring[(i + 1) % ring.length];
      const length = Math.hypot(b[0] / 10 - a[0], b[1] / 10 - a[1]);
      if (length < 1.8) continue;
      const dx = (b[0] / 10 - a[0]) / length, dz = (b[1] / 10 - a[1]) / length, nx = sign * dz, nz = -sign * dx;
      const x = a[0] + dx * length / 2, z = a[1] + dz * length / 2, road = nearestRoad(x, z);
      const street = ri === 0 && road.distance < 33 && (road.x - x) * nx + (road.z - z) * nz > road.distance * .45;
      walls.push({ part, a, dx, dz, nx, nz, length, street, front: street && Math.abs(nx) > .7 });
    }
  }
  return walls;
}
function at(w: Wall, u: number, y: number, out: number): Triple {
  return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out];
}
function voxelSampler(payload?: Voxels): (w: Wall, u: number, width: number, y: number, height: number) => number {
  if (!payload) return () => 0;
  const cols = new Map<string, Point>(), cell = payload.cell_m;
  const add = (x: number, z: number, low: number, high: number) => {
    if (x * cell < 475 || x * cell > 1130 || z * cell < -685 || z * cell > -45) return;
    cols.set(`${x},${z}`, [low / 10, high / 10]);
  };
  payload.building_rows?.forEach((row, zi) => {
    const z = payload.grid.min_z_idx + zi;
    if (z * cell < -685 || z * cell > -45) return;
    for (const [x, count, low, high] of row) for (let j = 0; j < count; j++) add(payload.grid.min_x_idx + x + j, z, low, high);
  });
  payload.buildings?.forEach(([x, z, lo, hi]) => add(x, z, lo, hi));
  return (w, u, width, y, height) => {
    const points = [-width / 2, width / 2].flatMap(du => [0, 3.6].map(d => at(w, u + du, y, d)));
    const x0 = Math.floor(Math.min(...points.map(p => p[0])) / cell), x1 = Math.floor(Math.max(...points.map(p => p[0])) / cell);
    const z0 = Math.floor(Math.min(...points.map(p => p[2])) / cell), z1 = Math.floor(Math.max(...points.map(p => p[2])) / cell);
    let push = 0;
    // Clip each intersecting source cell in wall coordinates. Sparse point
    // probes miss the projecting corner of oblique cells between samples.
    const clip = (ring: Point[], edge: number, greater: boolean): Point[] => {
      const result: Point[] = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const ina = greater ? a[0] >= edge : a[0] <= edge, inb = greater ? b[0] >= edge : b[0] <= edge;
        if (ina) result.push(a);
        if (ina !== inb) { const t = (edge - a[0]) / (b[0] - a[0]); result.push([edge, a[1] + t * (b[1] - a[1])]); }
      }
      return result;
    };
    for (let xi = x0; xi <= x1; xi++) for (let zi = z0; zi <= z1; zi++) {
      const column = cols.get(`${xi},${zi}`);
      if (!column || column[0] > y + height / 2 || column[1] < y - height / 2) continue;
      let ring: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([cx, cz]) => {
        const dx = (xi + cx) * cell - w.a[0], dz = (zi + cz) * cell - w.a[1];
        return [dx * w.dx + dz * w.dz, dx * w.nx + dz * w.nz];
      });
      ring = clip(clip(ring, u - width / 2, true), u + width / 2, false);
      if (!ring.length || Math.min(...ring.map(p => p[1])) > 3.6) continue;
      const far = Math.max(...ring.map(p => p[1]));
      if (far > 0) push = Math.max(push, far + .1);
    }
    // Do not move a bay through an opposite wall in a tiny courtyard.
    return push > 3.6 ? Infinity : push;
  };
}

export function planLuisenCorridor(options: LuisenOptions = {}): LuisenBlock[] {
  const blocks: LuisenBlock[] = [], mc = !!options.minecraft, mobile = mc && !!options.mobileLike, voxel = voxelSampler(options.voxels);
  const parts = S.prisms as PrismBuilding[];
  const byId = new Map(S.profiles.flatMap(p => p.ids.map(id => [id, p] as const)));
  const boundsOf = (p: LuisenSourcePrism) => ({ p, x0: Math.min(...p.ring.map(a => a[0])) / 10, x1: Math.max(...p.ring.map(a => a[0])) / 10,
    z0: Math.min(...p.ring.map(a => a[1])) / 10, z1: Math.max(...p.ring.map(a => a[1])) / 10 });
  const selectedBounds = parts.map(boundsOf);
  const extent = { x0: Math.min(...selectedBounds.map(b => b.x0)) - 4, x1: Math.max(...selectedBounds.map(b => b.x1)) + 4,
    z0: Math.min(...selectedBounds.map(b => b.z0)) - 4, z1: Math.max(...selectedBounds.map(b => b.z1)) + 4 };
  // Read the complete source once, then retain only the corridor vicinity.
  // Unselected adjoining buildings still occlude shared partywall details.
  const bounds = (options.sourcePrisms ?? parts).map(boundsOf).filter(b => b.x1 >= extent.x0 && b.x0 <= extent.x1 && b.z1 >= extent.z0 && b.z0 <= extent.z1);
  for (const w of luisenCorridorWalls()) {
    const profile = byId.get(w.part.id)!;
    const base = w.part.y0_dm / 10, top = (S.facadeTops as Record<string, number>)[w.part.id];
    const usableBase = Math.max(base, 5.2), span = top - usableBase;
    if (span < 3.5) continue;
    const nearby = bounds.filter(q => q.p.id !== w.part.id && q.x1 >= w.a[0] - w.length - 2 && q.x0 <= w.a[0] + w.length + 2 && q.z1 >= w.a[1] - w.length - 2 && q.z0 <= w.a[1] + w.length + 2);
    const hidden = (u: number, y: number, width: number, height: number, out: number) => {
      for (const du of [-width * .48, 0, width * .48]) for (const dy of [-height * .45, 0, height * .45]) for (const d of [.015, out]) {
        const p = at(w, u + du, y + dy, d);
        if (nearby.some(q => p[0] >= q.x0 && p[0] <= q.x1 && p[2] >= q.z0 && p[2] <= q.z1 && p[1] >= q.p.y0_dm / 10 && p[1] < (q.p.y0_dm + q.p.h_dm) / 10 && luisenPrismContains(q.p, p[0], p[2]))) return true;
      }
      return false;
    };
    let sharedPush = 0;
    const bayClearance = (u: number, width: number, y: number, height: number): number => {
      return mc ? voxel(w, u, width, y, height) : 0;
    };
    const emit = (u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, glass = false) => {
      if (!Number.isFinite(sharedPush)) return;
      if (hidden(u, y, width, height, out + sharedPush) || y + height / 2 > top + .06 || y - height / 2 < usableBase - .1) return;
      // All members of a window share this offset. Pushing each thin part to
      // its own clearance plane would put the reveal in front of the glass.
      out += sharedPush;
      blocks.push({ position: at(w, u, y, out), size: [width, height, depth], yaw: -Math.atan2(w.dz, w.dx),
        color, role, sourceId: w.part.id, normal: [w.nx, w.nz], glass });
    };
    const style = profile.style;
    const historic = ["historic", "stucco", "mori", "cafe", "patent"].includes(style);
    const floors = Math.max(1, Math.min(profile.floors, Math.floor(span / 2.65)));
    const pitch = span / floors;
    const bays = Math.max(1, Math.round(w.length / (style === "louvres" ? 2.55 : mc ? 4.3 : w.street ? 3.2 : 4)));
    const step = w.length / bays;
    // Split long floor bands into real exposed wall intervals: no bands through neighbours.
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * step;
      for (let f = 0; f < floors; f++) {
        const y = usableBase + (f + .52) * pitch;
        const shop = w.street && f === 0 && style !== "patent";
        const width = Math.min(step * (shop || style === "louvres" || style === "stone-grid" ? .79 : .48), shop ? 3.5 : 2.8);
        const height = pitch * (shop ? .76 : .60);
        sharedPush = bayClearance(u, Math.max(width + .7, step), y, pitch);
        emit(u, y, width + .24, height + .22, .12, .11, historic ? 0xc9c3b2 : DARK, "window reveal");
        emit(u, y, width, height, .08, .205, GLASS, shop ? "street shop glazing" : "window glazing", true);
        emit(u, y - height / 2 - .08, width + .36, .15, .32, .22, FRAME, "projecting sill");
        if (!mc) {
          emit(u, y, .065, height, .08, .26, FRAME, "vertical window mullion");
          if (!mobile || w.street) emit(u, y + height * .16, width, .065, .08, .26, FRAME, "cross window transom");
        }
        if (historic && w.street) {
          for (const side of [-1, 1]) emit(u + side * (width / 2 + .10), y, .14, height + .28, .18, .18, FRAME, "stucco window surround");
          emit(u, y + height / 2 + .16, width + .35, .16, .24, .2, FRAME, "window cornice");
        }
        if (style === "louvres" && w.street && f > 0) {
          const louvers = mc ? 2 : mobile ? 4 : 7;
          for (let l = 0; l < louvers; l++) emit(u, y - height / 2 + (l + .5) * height / louvers, width + .15, mc ? .2 : .065, .24, .42, 0xc0c8c4, "silver external sun louvre");
        }
        if (style === "balconies" && w.street && f > 0 && w.length > 5 && i % 3 === 1) {
          // Chamfered rail follows the bowed metal balcony reading; reduced facets in blocks.
          const ww = Math.min(3.1, step * .94);
          emit(u, y - height / 2 - .25, ww, .19, 1.15, .65, 0x9baba7, "balcony floor");
          emit(u, y - height / 2 + .30, ww * .72, .72, .12, 1.18, 0xd4d5ca, "bowed balcony front");
          for (const side of [-1, 1]) {
            emit(u + side * ww * .42, y - height / 2 + .3, ww * .24, .72, .12, .92, 0xd4d5ca, "bowed balcony return");
            if (!mc && !mobile) for (let hole = 0; hole < 3; hole++) emit(u + side * (hole + .5) * ww / 8, y - height / 2 + .35, .06, .13, .035, 1.26, 0x767f79, "metal balcony perforation");
          }
        }
        if (style === "patent" && w.front) {
          // Granular rustication, coupled pilasters and arch voussoirs follow the historic front.
          for (const side of [-1, 1]) {
            emit(u + side * (width / 2 + .32), y, .32, pitch - .16, .34, .26, 0xc9bda3, "Patentamt pilaster");
            if (!mobile && !mc) for (let joint = 0; joint < 5; joint++) emit(u + side * (width / 2 + .32), y - pitch * .4 + joint * pitch * .2, .4, .065, .38, .29, 0x9a8f7c, "Patentamt stone joint");
          }
          const radius = width * .51;
          for (let j = 0; j <= (mc ? 4 : 10); j++) {
            const a = Math.PI * j / (mc ? 4 : 10);
            emit(u + Math.cos(a) * radius, y + height * .24 + Math.sin(a) * radius * .55, mc ? .34 : .16, mc ? .28 : .18, .25, .33, FRAME, "Patentamt arch stone");
          }
          emit(u, y - height / 2 - .30, width + .6, .22, .42, .31, 0xd7c6a6, "Patentamt sculpted ledge");
        }
        if (f > 0) emit(u, usableBase + f * pitch, step + .015, historic ? .17 : .24, .16, .1, historic ? 0xbcb7a7 : 0xbcc1ba, "storey course");
      }
      sharedPush = bayClearance(u, step, top - .25, .5);
      emit(u, top - .12, step + .015, .24, .27, .17, historic ? FRAME : 0xb8c0bb, "continuous eaves course");
      if (historic && w.street && !mobile && !mc) for (let d = 0; d < 3; d++) emit(u + (d - 1) * step / 3, top - .48, .18, .28, .28, .23, FRAME, "eaves dentil");
      if (style === "balconies" && w.street && !mc) for (let f = 0; f < floors; f++) emit(u + step / 2 - .02, usableBase + (f + .5) * pitch, .035, pitch - .15, .035, .07, 0x899590, "grey cladding seam");
    }
  }
  return blocks;
}

export function createLuisenCorridorArchitecture(options: LuisenOptions = {}): Group {
  const root = new Group(), plan = planLuisenCorridor(options);
  root.name = options.minecraft ? MINECRAFT_LUISEN_CORRIDOR_GROUP : LUISEN_CORRIDOR_GROUP;
  root.userData.evidence = LUISEN_CORRIDOR_EVIDENCE;
  root.userData.profile = options.mobileLike ? "mobile" : "full";
  root.userData.sourcePartCount = S.prisms.length;
  root.userData.textureFree = true;
  root.userData.runtimeAssets = [];
  if (options.diagnostics) root.userData.blocks = plan;
  const cube = new BoxGeometry(1, 1, 1), matrix = new Matrix4(), color = new Color();
  cube.deleteAttribute("uv");
  for (const glazing of [false, true]) {
    const blocks = plan.filter(p => p.glass === glazing);
    const material = new MeshStandardMaterial({ color: 0xffffff, roughness: glazing ? .39 : .89 });
    const mesh = new InstancedMesh(cube, material, blocks.length);
    mesh.name = glazing ? "Luisen corridor framed glazing" : "Luisen corridor masonry and metal details";
    mesh.userData.dayMaterial = material;
    mesh.userData.nightMaterial = new MeshStandardMaterial({ color: glazing ? 0xcdd4d5 : 0x627181, roughness: .8, emissive: glazing ? 0x7b531d : 0, emissiveIntensity: glazing ? .22 : 0 });
    for (let i = 0; i < blocks.length; i++) {
      const p = blocks[i]; matrix.makeRotationY(p.yaw); matrix.scale({ x: p.size[0], y: p.size[1], z: p.size[2] } as import("three").Vector3); matrix.setPosition(...p.position);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(p.color));
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
  freezeStaticSceneTransforms(root); return root;
}

import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";
import { ROHWEDDER_HAUS_SOURCE as S, ROHWEDDER_HAUS_GROUP, MINECRAFT_ROHWEDDER_HAUS_GROUP, ROHWEDDER_HAUS_IDS, ROHWEDDER_HAUS_PROFILE, rohwedderPrismContains } from "./rohwedderHausProfile";

type Point = [number, number];
type Triple = [number, number, number];
type SourcePrism = Pick<PrismBuilding, "id" | "ring" | "holes" | "y0_dm" | "h_dm">;
type Voxels = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type RohwedderOptions = { minecraft?: boolean; mobileLike?: boolean; voxels?: Voxels; diagnostics?: boolean };
export type RohwedderBlock = { position: Triple; size: Triple; yaw: number; roll?: number; pitch?: number; color: number; role: string; sourceId: string; normal: Point; glass: boolean };
type Wall = { part: SourcePrism; edge: number; a: Point; dx: number; dz: number; nx: number; nz: number; length: number };
const C = { stone: 0xc9c6b5, bright: 0xdad7c5, dark: 0x484e4b, shadow: 0x363f3e, frame: 0xb0b9b1, glass: 0x536b70, roof: 0x868984, copper: 0x838d80, joint: 0xb1b1a4 };

export function rohwedderHausWalls(parts: readonly SourcePrism[] = S.buildings): Wall[] {
  const walls: Wall[] = [];
  for (const part of parts) for (const [ri, ring] of [part.ring, ...(part.holes ?? [])].entries()) {
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a: Point = [ring[i][0] / 10, ring[i][1] / 10], b = ring[(i + 1) % ring.length];
      const length = Math.hypot(b[0] / 10 - a[0], b[1] / 10 - a[1]);
      if (length < 1.5) continue;
      const dx = (b[0] / 10 - a[0]) / length, dz = (b[1] / 10 - a[1]) / length;
      walls.push({ part, edge: i, a, dx, dz, nx: sign * dz, nz: -sign * dx, length });
    }
  }
  return walls;
}
function at(w: Wall, u: number, y: number, out: number): Triple { return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out]; }

function voxelClearance(payload?: Voxels): (w: Wall, u: number, width: number, y: number, height: number) => number {
  if (!payload) return () => 0;
  const columns = new Map<string, Point>(), cell = payload.cell_m;
  const add = (x: number, z: number, lo: number, hi: number) => {
    if (x * cell > 692 && x * cell < 917 && z * cell > 1020 && z * cell < 1299) columns.set(`${x},${z}`, [lo / 10, hi / 10]);
  };
  payload.building_rows?.forEach((row, zi) => {
    const z = payload.grid.min_z_idx + zi;
    if (z * cell < 1020 || z * cell > 1299) return;
    for (const [xi, count, lo, hi] of row) for (let j = 0; j < count; j++) add(payload.grid.min_x_idx + xi + j, z, lo, hi);
  });
  payload.buildings?.forEach(([x, z, lo, hi]) => add(x, z, lo, hi));
  const clip = (ring: Point[], edge: number, greater: boolean): Point[] => {
    const output: Point[] = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], ia = greater ? a[0] >= edge : a[0] <= edge, ib = greater ? b[0] >= edge : b[0] <= edge;
      if (ia) output.push(a);
      if (ia !== ib) { const t = (edge - a[0]) / (b[0] - a[0]); output.push([edge, a[1] + (b[1] - a[1]) * t]); }
    }
    return output;
  };
  return (w, u, width, y, height) => {
    const points = [-width / 2, width / 2].flatMap(du => [0, 3.8].map(d => at(w, u + du, y, d)));
    const x0 = Math.floor(Math.min(...points.map(p => p[0])) / cell), x1 = Math.floor(Math.max(...points.map(p => p[0])) / cell);
    const z0 = Math.floor(Math.min(...points.map(p => p[2])) / cell), z1 = Math.floor(Math.max(...points.map(p => p[2])) / cell);
    let push = 0;
    for (let xi = x0; xi <= x1; xi++) for (let zi = z0; zi <= z1; zi++) {
      const col = columns.get(`${xi},${zi}`);
      if (!col || col[0] > y + height / 2 || col[1] < y - height / 2) continue;
      let ring: Point[] = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([cx, cz]) => {
        const dx = (xi + cx) * cell - w.a[0], dz = (zi + cz) * cell - w.a[1];
        return [dx * w.dx + dz * w.dz, dx * w.nx + dz * w.nz];
      });
      ring = clip(clip(ring, u - width / 2, true), u + width / 2, false);
      if (!ring.length || Math.min(...ring.map(p => p[1])) > 3.8) continue;
      push = Math.max(push, Math.max(...ring.map(p => p[1])) + .08);
    }
    return push > 3.8 ? Infinity : Math.max(0, push);
  };
}

export function planRohwedderHaus(payload?: { buildings: readonly SourcePrism[] }, options: RohwedderOptions = {}): RohwedderBlock[] {
  const parts = S.buildings as SourcePrism[], blocks: RohwedderBlock[] = [], mc = !!options.minecraft, mobile = mc && !!options.mobileLike, clearance = voxelClearance(options.voxels);
  const nearby = (payload?.buildings ?? [...parts, ...S.occluders]).filter(p => p.ring.some(([x, z]) => x >= 6880 && x <= 9200 && z >= 10150 && z <= 13000));
  const walls = rohwedderHausWalls(parts);
  const hidden = (w: Wall, u: number, y: number, width: number, height: number, out: number) => {
    const others = nearby.filter(p => p.id !== w.part.id && y + height / 2 >= p.y0_dm / 10 && y - height / 2 <= (p.y0_dm + p.h_dm) / 10);
    return [-.48, 0, .48].some(du => [-.45, 0, .45].some(dy => [.01, out].some(d => {
      const p = at(w, u + du * width, y + dy * height, d);
      return others.some(q => p[1] >= q.y0_dm / 10 && p[1] <= (q.y0_dm + q.h_dm) / 10 && rohwedderPrismContains(q, p[0], p[2]));
    })));
  };
  let push = 0;
  const emit = (w: Wall, u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, glass = false, roll = 0) => {
    if (!Number.isFinite(push) || hidden(w, u, y, width, height, out + push)) return;
    blocks.push({ position: at(w, u, y, out + push), size: [width, height, depth], yaw: -Math.atan2(w.dz, w.dx), roll, color, role, glass, sourceId: w.part.id, normal: [w.nx, w.nz] });
  };
  const window = (w: Wall, u: number, y: number, width: number, height: number, role = "office window", monumental = false, grille = false) => {
    push = mc ? clearance(w, u, width + (monumental ? .7 : .2), y, height + .6) : 0;
    if (hidden(w, u, y, width + .2, height + .2, push + .3)) return;
    emit(w, u, y, width + .2, height + .2, .12, .1, C.dark, `${role} reveal`);
    emit(w, u, y, width, height, .055, .185, C.glass, role, true);
    emit(w, u, y, mc ? .13 : .07, height, .09, .25, C.frame, `${role} centre mullion`);
    if (!mobile || monumental) emit(w, u, y + height * .12, width, mc ? .13 : .07, .09, .25, C.frame, `${role} cross mullion`);
    emit(w, u, y - height / 2 - .09, width + .32, .14, .34, .21, C.bright, `${role} stone sill`);
    if (!mobile || monumental) emit(w, u, y + height / 2 + .09, width + .24, .1, .14, .13, C.bright, `${role} stone lintel`);
    if (monumental) {
      for (const du of [-width / 2 - .24, width / 2 + .24]) emit(w, u + du, y, .23, height + .45, .42, .32, C.stone, "tall hall window jamb");
      emit(w, u, y + height / 2 + .36, width + 1, .2, .65, .42, C.bright, "tall hall projecting hood");
      emit(w, u, y - height / 2 - .32, width + .8, .3, .72, .43, C.stone, "tall hall console sill");
      for (const du of [-width * .4, width * .4]) emit(w, u + du, y - height / 2 - .65, .3, .5, .38, .33, C.stone, "tall hall paired console");
      for (const ratio of [-.31, .31]) emit(w, u, y + height * ratio, width, .09, .14, .29, C.frame, "tall hall secondary transom");
    }
    if (grille) {
      const count = mc || mobile ? 4 : 6;
      for (let j = 0; j < count; j++) emit(w, u - width * .43 + j * width * .86 / (count - 1), y, mc ? .095 : .055, height + .12, .14, .4, C.dark, "ground iron window grille");
      if (!mobile) for (const ratio of [-.25, .25]) emit(w, u, y + height * ratio, width, .05, .12, .4, C.dark, "grille cross rail");
    }
  };
  for (const w of walls) {
    const base = Math.max(5, w.part.y0_dm / 10), low = w.part.id === "nU6RPfQE";
    const facadeTop = (S.facadeTops as Record<string, number>)[w.part.id], height = facadeTop - base;
    const floors = low ? 4 : ["BpVfJNGl", "b2fhmrSW"].includes(w.part.id) ? 7 : w.part.id === "H1fcpzly" ? 6 : Math.max(1, Math.floor(height / 3.6)), pitch = height / floors;
    const courtyardHall = w.part.id === "K0001yJa" && w.edge === 2;
    const bays = courtyardHall ? 9 : Math.max(1, Math.floor((w.length - 1.2) / 3.65)), bay = w.length / bays;
    const representativeStreet = w.part.id === "H1fcpzly" && [19, 31].includes(w.edge);
    const northArcade = w.part.id === "b2fhmrSW" && (w.edge === 0 || w.edge === 1);
    const street = (w.nx > .8 && [19, 25, 31].includes(w.edge) && w.part.id === "H1fcpzly") || northArcade || (w.part.id === "H1fcpzly" && w.edge === 34);
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * bay;
      const tallHall = courtyardHall;
      for (let f = 0; f < floors; f++) {
        if (tallHall) continue;
        if (representativeStreet && f === 2 && i >= 2 && i < bays - 2) continue;
        if (northArcade && f === 0) continue;
        if (northArcade && i >= 2 && i < bays - 2 && [2, 3].includes(f)) continue;
        const attic = f === floors - 1, h = pitch * (attic ? .39 : .58), y = base + pitch * (f + .5);
        window(w, u, y, Math.min(1.52, bay * .43), h, attic ? "small upper office window" : "office window", false, f === 0 && street);
      }
      if (tallHall) {
        window(w, u, base + 12.55, Math.min(1.68, bay * .5), 11, "Ehrenhof tall hall glazing", true);
        window(w, u, base + 21.12, 1.45, 1.72, "Ehrenhof upper office glazing");
        emit(w, u, base + 19.18, 2.44, .62, .18, .28, C.dark, "Ehrenhof recessed frieze field");
        emit(w, u, base + 19.18, 2.21, .42, .1, .41, C.stone, "Ehrenhof inset frieze panel");
      }
      if (representativeStreet && i >= 2 && i < bays - 2) window(w, u, base + pitch * 2.5, Math.min(1.68, bay * .5), pitch * 1.15, "Wilhelmstrasse representative glazing", true);
      if (northArcade) {
        const y = base + pitch * .59, h = pitch * 1.18, width = bay - 1.18;
        push = mc ? clearance(w, u, bay, y, h) : 0;
        emit(w, u, y, width, h, .09, .12, C.shadow, "Leipziger arcade recess");
        emit(w, u - bay / 2 + .51, y, 1.03, h, .95, .58, C.stone, "Leipziger arcade pier");
        emit(w, u, base + h + .13, bay + .05, .4, 1.12, .6, C.bright, "Leipziger arcade architrave");
        if (i >= 2 && i < bays - 2) window(w, u, base + pitch * 2.7, Math.min(1.7, bay * .52), pitch * 1.55, "Leipziger representative window", true);
      }
    }
    // Fine cladding is restricted to external wall intervals, including courts.
    // Shared internal walls fail the same source-solid visibility probes.
    const segments = Math.max(1, Math.ceil(w.length / 8)), step = w.length / segments;
    for (let i = 0; i < segments; i++) {
      const u = (i + .5) * step;
      push = mc ? clearance(w, u, step, facadeTop - .3, .5) : 0;
      emit(w, u, facadeTop - .12, step + .03, .23, .48, .2, C.copper, "layered roof coping");
      emit(w, u, facadeTop - .48, step + .03, .26, .42, .15, C.bright, "source-bound eaves cornice");
      if (!mobile && !mc) {
        for (let y = base + .85; y < facadeTop - .75; y += 1.28) {
          push = 0;
          emit(w, u, y, step, .022, .025, .021, C.joint, "limestone horizontal bedding");
          const seamU = u + (Math.round((y - base) / 1.28) % 2 ? .7 : -.7);
          emit(w, seamU, y + .64, .022, 1.26, .025, .021, C.joint, "staggered limestone joint");
        }
        for (let n = 0; n < 5; n++) emit(w, u + (n - 2) * step / 5, facadeTop - .72, .28, .21, .28, .18, C.stone, "cornice dentil");
      }
    }
    if (courtyardHall) {
      for (let i = 0; i < bays; i++) {
        const u = (i + .5) * bay; push = mc ? clearance(w, u, bay, base + 2.45, 4.9) : 0;
        emit(w, u, base + 2.45, bay - .62, 4.9, .09, .13, C.shadow, "Ehrenhof entry recess");
        emit(w, u - bay / 2 + .22, base + 2.5, .44, 5, .7, .43, C.stone, "Ehrenhof entry pier");
        emit(w, u, base + 5.35, bay, .32, 1, .49, C.bright, "Ehrenhof balcony slab");
        for (const dy of [5.6, 6.25]) emit(w, u, base + dy, bay, .07, .09, .91, C.dark, "Ehrenhof balcony iron rail");
        for (let n = 0; n < (mobile || mc ? 3 : 7); n++) emit(w, u - bay * .43 + n * bay * .86 / ((mobile || mc ? 3 : 7) - 1), base + 5.95, .045, .6, .06, .91, C.dark, "Ehrenhof balcony baluster");
      }
    }
  }
  // Rectangular roof lights follow the photographed row vocabulary. They sit
  // only on wide source wings and do not bridge any of the open courtyards.
  for (const w of walls.filter(w => (w.part.id === "BpVfJNGl" && w.edge === 2) || (w.part.id === "H1fcpzly" && [19, 31, 13, 36].includes(w.edge)))) {
    const top = (w.part.y0_dm + w.part.h_dm) / 10, count = Math.floor((w.length - 6) / 6.3);
    for (let i = 0; i < count; i++) {
      const u = 3.8 + (i + .5) * (w.length - 7.6) / count, centre = at(w, u, top + .25, -3.5);
      if (!rohwedderPrismContains(w.part, centre[0], centre[2])) continue;
      const roofBlock = (height: number, y: number, width: number, depth: number, color: number, role: string, pitch = 0, shift = 0) => {
        const p = at(w, u, y, -3.5 + shift);
        blocks.push({ position: p, size: [width, height, depth], yaw: -Math.atan2(w.dz, w.dx), pitch, color, role, glass: role.includes("glazing"), sourceId: w.part.id, normal: [0, 0] });
      };
      roofBlock(.24, top + .13, 3.05, 3.6, C.bright, "roof lantern kerb");
      if (mc) {
        roofBlock(.45, top + .44, 2.75, 2.95, C.glass, "block roof lantern glazing");
        roofBlock(.24, top + .75, 2.75, 1.6, C.frame, "stepped roof lantern crown");
      } else {
        for (const sign of [-1, 1]) roofBlock(.08, top + .61, 2.74, 1.89, C.glass, "sloping roof lantern glazing", sign * .49, sign * .84);
        roofBlock(.09, top + 1.04, 2.9, .11, C.frame, "roof lantern ridge");
      }
    }
  }
  // Current high iron screen at its separately attributed OSM polyline.
  for (let k = 1; k < S.entranceFence.points.length; k++) {
    const a = S.entranceFence.points[k - 1], b = S.entranceFence.points[k], length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const fence: Wall = { part: parts[0], edge: -1, a: [a[0], a[1]], dx, dz, nx: dz, nz: -dx, length };
    const pushFence = (u: number, y: number, width: number, height: number, depth: number, color: number, role: string) => blocks.push({ position: at(fence, u, y, 0), size: [width, height, depth], yaw: -Math.atan2(dz, dx), color, role, sourceId: S.entranceFence.osm, normal: [dz, -dx], glass: false });
    for (const y of [5.18, 7.2, 9.7]) pushFence(length / 2, y, length, .1, .18, C.dark, "mapped Ehrenhof screen rail");
    const bars = Math.ceil(length / (mc ? .55 : mobile ? .42 : .22));
    for (let i = 0; i <= bars; i++) pushFence(length * i / bars, 7.45, mc ? .14 : .065, 4.7, .16, C.dark, "mapped Ehrenhof iron screen");
    const fields = Math.ceil(length / 4.4);
    for (let i = 0; i <= fields; i++) pushFence(length * i / fields, 7.4, .19, 4.8, .22, C.dark, "screen structural post");
  }
  const entrance = walls.find(w => w.part.id === "H1fcpzly" && w.edge === 22);
  if (entrance) {
    const text = "BUNDESMINISTERIUM DER FINANZEN";
    for (const path of letteringStrokePaths(text, .16)) for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], du = b[0] - a[0], dy = b[1] - a[1];
      push = mc ? clearance(entrance, entrance.length / 2, entrance.length, 7.7, .8) : 0;
      if (mc) {
        const count = Math.max(1, Math.ceil(Math.hypot(du, dy) / .045));
        for (let j = 0; j < count; j++) { const t = (j + .5) / count; emit(entrance, entrance.length / 2 - a[0] - du * t, 7.7 + a[1] + dy * t, .028, .028, .035, .17, C.dark, "current ministry name pixel"); }
      } else emit(entrance, entrance.length / 2 - (a[0] + b[0]) / 2, 7.7 + (a[1] + b[1]) / 2, Math.hypot(du, dy), .025, .035, .17, C.dark, "current ministry name stroke", false, Math.atan2(dy, -du));
    }
  }
  return blocks;
}

export function createRohwedderHausArchitecture(payload?: { buildings: readonly SourcePrism[] }, options: RohwedderOptions = {}): Group {
  const blocks = planRohwedderHaus(payload, options), group = new Group();
  group.name = options.minecraft ? MINECRAFT_ROHWEDDER_HAUS_GROUP : ROHWEDDER_HAUS_GROUP;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const matrix = new Matrix4(), rotation = new Matrix4(), scale = new Vector3(), color = new Color();
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .84, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, blocks.length); mesh.name = `${group.name} facade blocks`;
  blocks.forEach((b, i) => {
    matrix.makeRotationY(b.yaw);
    if (b.roll) matrix.multiply(rotation.makeRotationZ(b.roll));
    if (b.pitch) matrix.multiply(rotation.makeRotationX(b.pitch));
    matrix.scale(scale.set(...b.size)).setPosition(...b.position); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(b.color));
  });
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  group.userData.profile = ROHWEDDER_HAUS_PROFILE; group.userData.sourceIds = [...ROHWEDDER_HAUS_IDS]; group.userData.textureFree = true;
  group.userData.instanceCount = blocks.length; group.userData.detailCounts = blocks.reduce<Record<string, number>>((counts, b) => { counts[b.role] = (counts[b.role] ?? 0) + 1; return counts; }, {});
  if (options.diagnostics) group.userData.blocks = blocks;
  freezeStaticSceneTransforms(group); return group;
}
export function createMinecraftRohwedderHausArchitecture(payload?: { buildings: readonly SourcePrism[] }, options: Omit<RohwedderOptions, "minecraft"> = {}): Group {
  return createRohwedderHausArchitecture(payload, { ...options, minecraft: true });
}

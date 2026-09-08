import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Shape, ShapeGeometry, Vector2, Vector3 } from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { createBuilder, finishDrawnGroup, paintGeometry } from "./drawnKit";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  BOELL_STIFTUNG_BELETAGE_TOP, BOELL_STIFTUNG_CORE_ID, BOELL_STIFTUNG_GROUP,
  BOELL_STIFTUNG_IDS, BOELL_STIFTUNG_LOW_ID, BOELL_STIFTUNG_PROFILE,
  BOELL_STIFTUNG_SOURCE_PRISMS, BOELL_STIFTUNG_TOP, BOELL_STIFTUNG_UNDERSIDE,
  MINECRAFT_BOELL_STIFTUNG_GROUP, boellStiftungLowColumnContains, boellStiftungPrismContains,
} from "./boellStiftungProfile";

type Point = readonly [number, number];
type Triple = [number, number, number];
export type BoellStiftungVoxelPayload = { cell_m: number; grid: { min_x_idx: number; min_z_idx: number }; building_rows?: Array<Array<[number, number, number, number, number]>>; buildings?: Array<[number, number, number, number, number]> };
export type BoellStiftungOptions = { mobileLike?: boolean; minecraft?: boolean; diagnostics?: boolean; voxels?: BoellStiftungVoxelPayload };
export type BoellStiftungBlock = { position: Triple; size: Triple; yaw: number; roll?: number; color: number; role: string; sourceId: string; normal?: Point };
export type BoellStiftungWall = { part: PrismBuilding; index: number; a: Point; b: Point; length: number; dx: number; dz: number; nx: number; nz: number };
const C = { silver: 0xc8d0cf, bright: 0xe4e8e1, shadow: 0x899998, frame: 0xc0d0cc, glass: 0x527481, glassAlt: 0x648b93, green: 0x246960, greenLight: 0x4c8b7a, dark: 0x2c4949, roof: 0xa4a69a, sign: 0x253430, logo: 0xa2ca37 };

export function boellStiftungWalls(payload?: { buildings: readonly PrismBuilding[] }): BoellStiftungWall[] {
  const parts = (payload?.buildings ?? BOELL_STIFTUNG_SOURCE_PRISMS as unknown as PrismBuilding[]).filter(p => BOELL_STIFTUNG_IDS.has(p.id));
  const walls: BoellStiftungWall[] = [];
  for (const part of parts) for (const [ri, ring] of [part.ring, ...(part.holes ?? [])].entries()) {
    const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
    const sign = (area >= 0 ? 1 : -1) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a: Point = [ring[i][0] / 10, ring[i][1] / 10], b: Point = [ring[(i + 1) % ring.length][0] / 10, ring[(i + 1) % ring.length][1] / 10];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (length < .1) continue;
      const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
      walls.push({ part, index: i, a, b, length, dx, dz, nx: sign * dz, nz: -sign * dx });
    }
  }
  return walls;
}
function at(w: BoellStiftungWall, u: number, y: number, out: number): Triple {
  return [w.a[0] + w.dx * u + w.nx * out, y, w.a[1] + w.dz * u + w.nz * out];
}
function voxelSampler(payload?: BoellStiftungVoxelPayload): (x: number, y: number, z: number) => boolean {
  const columns = new Map<string, Point>(); if (!payload) return () => false;
  const c = payload.cell_m;
  const add = (x: number, z: number, lo: number, hi: number) => {
    const wx = (x + .5) * c, wz = (z + .5) * c;
    if (wx < 766 || wx > 822 || wz < -551 || wz > -491 || boellStiftungLowColumnContains(wx, wz)) return;
    columns.set(`${x},${z}`, [lo / 10, hi / 10]);
  };
  payload.building_rows?.forEach((row, zi) => {
    const z = payload.grid.min_z_idx + zi; if (z * c < -555 || z * c > -487) return;
    for (const [x, count, lo, hi] of row) for (let n = 0; n < count; n++) add(payload.grid.min_x_idx + x + n, z, lo, hi);
  });
  for (const [x, z, lo, hi] of payload.buildings ?? []) add(x, z, lo, hi);
  return (x, y, z) => { const col = columns.get(`${Math.floor(x / c)},${Math.floor(z / c)}`); return !!col && y >= col[0] && y <= col[1]; };
}

export function createBoellStiftungArchitecture(payload?: { buildings: readonly PrismBuilding[] }, options: BoellStiftungOptions = {}): Group {
  const parts = (payload?.buildings ?? BOELL_STIFTUNG_SOURCE_PRISMS as unknown as PrismBuilding[]).filter(p => BOELL_STIFTUNG_IDS.has(p.id));
  const walls = boellStiftungWalls({ buildings: parts }), blocks: BoellStiftungBlock[] = [], caps = createBuilder();
  const minecraft = !!options.minecraft, mobile = !!options.mobileLike, voxel = voxelSampler(options.voxels);
  const core = parts.find(p => p.id === BOELL_STIFTUNG_CORE_ID), low = parts.find(p => p.id === BOELL_STIFTUNG_LOW_ID);
  const occupied = (w: BoellStiftungWall, u: number, y: number) => {
    const p = at(w, u, y, .15);
    return parts.some(q => q.id !== w.part.id && y >= (q.id === BOELL_STIFTUNG_LOW_ID ? BOELL_STIFTUNG_UNDERSIDE : q.y0_dm / 10) && y < (q.y0_dm + q.h_dm) / 10 && boellStiftungPrismContains(q, p[0], p[2]));
  };
  const emit = (w: BoellStiftungWall, u: number, y: number, width: number, height: number, depth: number, out: number, color: number, role: string, visible = true, roll = 0) => {
    if (width <= 0 || height <= 0 || (visible && occupied(w, u, y))) return;
    if (minecraft) for (const du of [-width * .46, 0, width * .46]) for (let d = 0; d < 3.7; d += .15)
      if (voxel(...at(w, u + du, y, d))) out = Math.max(out, d + depth / 2 + .14);
    blocks.push({ position: at(w, u, y, out), size: [width, height, depth], yaw: -Math.atan2(w.dz, w.dx), roll, color, role, sourceId: w.part.id, normal: [w.nx, w.nz] });
  };
  for (const w of walls) {
    const isLow = w.part.id === BOELL_STIFTUNG_LOW_ID, base = w.part.y0_dm / 10;
    const bays = Math.max(1, Math.round(w.length / (minecraft ? (mobile ? 3.8 : 2.7) : 1.85))), bay = w.length / bays;
    if (isLow) {
      for (let i = 0; i < bays; i++) {
        const u = (i + .5) * bay, height = BOELL_STIFTUNG_BELETAGE_TOP - BOELL_STIFTUNG_UNDERSIDE;
        emit(w, u, BOELL_STIFTUNG_UNDERSIDE + height / 2, bay + .015, height, .12, -.04, i % 3 ? C.green : C.greenLight, "beletage green glazing");
        emit(w, u - bay / 2 + .045, BOELL_STIFTUNG_UNDERSIDE + height / 2, minecraft ? .15 : .085, height, .18, .1, C.frame, "beletage vertical mullion");
        emit(w, u, BOELL_STIFTUNG_UNDERSIDE + height * .78, bay, .08, .17, .115, C.shadow, "beletage high transom");
        if (!mobile && !minecraft) for (let n = 0; n < 5; n++) emit(w, u - bay * .4 + n * bay * .2, BOELL_STIFTUNG_UNDERSIDE + height * .46, .028, height * .81, .03, .025, i % 2 ? C.greenLight : C.dark, "green curtain folds");
      }
      for (const y of [BOELL_STIFTUNG_UNDERSIDE + .09, BOELL_STIFTUNG_BELETAGE_TOP - .09])
        for (let i = 0; i < bays; i++) emit(w, (i + .5) * bay, y, bay, .18, .24, .01, C.bright, "beletage perimeter cap");
      continue;
    }
    const officeFloor = (BOELL_STIFTUNG_TOP - BOELL_STIFTUNG_BELETAGE_TOP) / 3;
    for (let i = 0; i < bays; i++) {
      const u = (i + .5) * bay;
      // Glazed, recessed ground floor and conference level inside the source core.
      for (const [y, h, role, color] of [[(base + BOELL_STIFTUNG_UNDERSIDE) / 2, BOELL_STIFTUNG_UNDERSIDE - base, "recessed foyer glazing", C.dark], [(BOELL_STIFTUNG_UNDERSIDE + BOELL_STIFTUNG_BELETAGE_TOP) / 2, BOELL_STIFTUNG_BELETAGE_TOP - BOELL_STIFTUNG_UNDERSIDE, "core beletage glazing", C.green]] as const) {
        emit(w, u, y, bay - .08, h - .14, .1, .08, color, role);
        emit(w, u - bay / 2 + .06, y, .12, h, .24, .16, C.silver, "foyer upright");
      }
      for (let floor = 0; floor < 3; floor++) {
        const y = BOELL_STIFTUNG_BELETAGE_TOP + (floor + .5) * officeFloor;
        emit(w, u, y, bay - .27, officeFloor - .43, .12, .11, i % 4 ? C.glass : C.glassAlt, "office glazing");
        emit(w, u, y - officeFloor / 2 + .22, bay, .44, .19, .16, C.silver, "office aluminium spandrel");
        if (!minecraft && !mobile) emit(w, u, y - officeFloor / 2 + .09, bay, .035, .04, .28, C.bright, "spandrel fine seam");
        if (i % 7 === floor + 2) emit(w, u, y + officeFloor * .26, bay - .3, officeFloor * .33, .04, .2, 0x9aaea7, "individual sunblind");
      }
      // Flanged aluminium profiles: broad face, projecting web and paired ribs.
      const y = (BOELL_STIFTUNG_TOP + BOELL_STIFTUNG_BELETAGE_TOP) / 2, h = BOELL_STIFTUNG_TOP - BOELL_STIFTUNG_BELETAGE_TOP;
      emit(w, u - bay / 2 + .1, y, .27, h, .22, .2, C.silver, "aluminium profile face");
      emit(w, u - bay / 2 + .1, y, minecraft ? .18 : .065, h, .44, .31, C.bright, "aluminium projecting web");
      if (!mobile && !minecraft) for (const du of [-.115, .115]) emit(w, u - bay / 2 + .1 + du, y, .035, h, .3, .34, C.shadow, "aluminium folded edge");
    }
    emit(w, w.length / 2, BOELL_STIFTUNG_TOP - .13, w.length, .26, .32, .12, C.silver, "source roof parapet");
  }
  // The source-exact beletage footprint is elevated; no ground infill.
  if (low) {
    if (minecraft) {
      const q = .7, xs = low.ring.map(p => p[0] / 10), zs = low.ring.map(p => p[1] / 10);
      for (let x = Math.floor(Math.min(...xs) / q) * q + q / 2; x < Math.max(...xs); x += q)
        for (let z = Math.floor(Math.min(...zs) / q) * q + q / 2; z < Math.max(...zs); z += q)
          if (boellStiftungPrismContains(low, x, z)) {
            // Boundary cells shrink inside the exact L; the Minecraft cap
            // cannot fill its concave notch or protrude beyond the source.
            let size = q;
            while (size > .035 && ![-1, 1].every(dx => [-1, 1].every(dz => boellStiftungPrismContains(low, x + dx * size / 2, z + dz * size / 2)))) size *= .65;
            if (size <= .035) continue;
            for (const [y, color, role] of [[BOELL_STIFTUNG_UNDERSIDE + .08, C.bright, "beletage soffit block"], [BOELL_STIFTUNG_BELETAGE_TOP - .08, C.roof, "beletage roof block"]] as const)
              blocks.push({ position: [x, y, z], size: [size, .16, size], yaw: 0, color, role, sourceId: low.id });
          }
    } else for (const [y, upside] of [[BOELL_STIFTUNG_UNDERSIDE, false], [BOELL_STIFTUNG_BELETAGE_TOP, true]] as const) {
      const shape = new Shape(low.ring.map(([x, z]) => new Vector2(x / 10, -z / 10)));
      const cap = new ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, y, 0);
      if (!upside) { const index = cap.index!; for (let i = 0; i < index.count; i += 3) { const a = index.getX(i); index.setX(i, index.getX(i + 1)); index.setX(i + 1, a); } }
      paintGeometry(cap, upside ? C.roof : C.bright); caps.parts.push(cap);
    }
  }
  const north = walls.find(w => w.part.id === BOELL_STIFTUNG_CORE_ID && w.index === 0);
  if (north) {
    const middle = north.length * .53, ground = north.part.y0_dm / 10;
    // Four entrance leaves on the north/Schumannstrasse face. The paired metal
    // piers carry the photographed vertical wordmark and house number.
    for (let i = 0; i < 4; i++) {
      const u = middle - 2.25 + i * 1.5;
      emit(north, u, ground + 1.45, 1.43, 2.9, .12, .21, C.dark, "entry door glass", false);
      for (const d of [-.72, .72]) emit(north, u + d, ground + 1.5, .1, 3, .22, .29, C.bright, "entry door frame", false);
      emit(north, u, ground + 2.9, 1.45, .12, .22, .29, C.bright, "entry door head", false);
      emit(north, u + .5, ground + 1.55, .06, .7, .13, .46, C.silver, "entry door handle", false);
    }
    const signU = middle + 3.55;
    emit(north, signU, ground + 1.7, .82, 3.4, .22, .3, C.bright, "vertical nameplate", false);
    emit(north, middle - 3.7, ground + 1.7, .68, 3.4, .22, .3, C.bright, "house number plate", false);
    const signText = "HEINRICH BOLL STIFTUNG", capHeight = .095;
    const word = letteringStrokePaths(signText, capHeight), layout = letteringLayout(signText, capHeight);
    const umlautLeft = layout.glyphs[10].leftM - layout.totalWidthM / 2;
    for (const dx of [.2, .6]) word.push([[umlautLeft + dx * capHeight, capHeight * 1.14], [umlautLeft + (dx + .06) * capHeight, capHeight * 1.14]]);
    for (const path of word) for (let j = 1; j < path.length; j++) {
      const [ax, ay] = path[j - 1], [bx, by] = path[j];
      // Rotate the baseline upward: text reads from bottom to top, as onsite.
      const u = signU + (ay + by) / 2 - capHeight / 2, y = ground + 1.96 + (ax + bx) / 2;
      const du = by - ay, dy = bx - ax;
      if (minecraft) {
        const n = Math.max(1, Math.ceil(Math.hypot(du, dy) / .045));
        for (let k = 0; k < n; k++) emit(north, u + du * ((k + .5) / n - .5), y + dy * ((k + .5) / n - .5), .027, .027, .04, .44, C.sign, "nameplate wordmark pixel", false);
      } else emit(north, u, y, Math.hypot(du, dy) + .014, .018, .025, .43, C.sign, "nameplate wordmark stroke", false, Math.atan2(dy, du));
    }
    for (let n = 0; n < 3; n++) emit(north, signU, ground + .42 + n * .115, .22, .085, .04, .44, n === 0 ? 0xd0dfa0 : C.logo, "three-bar green foundation mark", false);
    for (const path of letteringStrokePaths("8", .23)) for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i];
      emit(north, middle - 3.7 - (ax + bx) / 2, ground + 2.65 + (ay + by) / 2, Math.hypot(bx - ax, by - ay), .032, .03, .43, C.sign, "house number 8", false, Math.atan2(by - ay, ax - bx));
    }
  }
  // Closed seasonal atrium roof and low solar/plant fields inside the measured
  // cap. DOP controls vocabulary; local proportions are explicitly schematic.
  if (core) {
    const roofAxis = walls.find(w => w.part.id === core.id && w.index === 0)!;
    const roofBox = (u: number, inward: number, width: number, depth: number, color: number, role: string) => {
      blocks.push({ position: at(roofAxis, u, BOELL_STIFTUNG_TOP + (role === "atrium cover frame" ? .014 : .006), -inward), size: [width, .012, depth], yaw: -Math.atan2(roofAxis.dz, roofAxis.dx), color, role, sourceId: core.id });
    };
    roofBox(12, 19, 9.1, 9.3, C.dark, "closed seasonal atrium cover");
    for (const d of [-4.55, 0, 4.55]) roofBox(12 + d, 19, .11, 9.4, C.silver, "atrium cover frame");
    for (const d of [-4.65, 0, 4.65]) roofBox(12, 19 + d, 9.2, .11, C.silver, "atrium cover frame");
    for (const inward of [3.2, 5.1, 27.2, 29.1]) roofBox(16.2, inward, 28, 1.2, 0xd9ddcf, "roof array row");
    for (const inward of [7.0, 8.9, 10.8]) roofBox(25.9, inward, 8.6, 1.2, 0xd9ddcf, "short roof array row");
    for (const inward of [13, 19]) roofBox(21.6, inward, 2.4, 4.1, 0xc9cabd, "roof service enclosure");
  }
  const root = new Group(); root.name = minecraft ? MINECRAFT_BOELL_STIFTUNG_GROUP : BOELL_STIFTUNG_GROUP;
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .77, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, blocks.length), matrix = new Matrix4(), roll = new Matrix4(), scale = new Vector3(), color = new Color();
  blocks.forEach((b, i) => { matrix.makeRotationY(b.yaw); if (b.roll) matrix.multiply(roll.makeRotationZ(b.roll)); matrix.scale(scale.set(...b.size)).setPosition(...b.position); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(b.color)); });
  mesh.name = `${root.name} facade blocks`; mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  const capGroup = finishDrawnGroup(caps, { name: "Boell elevated source-exact roof and soffit" }); if (capGroup) root.add(capGroup);
  root.userData.profile = BOELL_STIFTUNG_PROFILE; root.userData.sourceIds = parts.map(p => p.id); root.userData.textureFree = true;
  root.userData.instanceCount = blocks.length; root.userData.detailCounts = blocks.reduce<Record<string, number>>((acc, b) => { acc[b.role] = (acc[b.role] ?? 0) + 1; return acc; }, {});
  if (options.diagnostics) root.userData.blocks = blocks;
  freezeStaticSceneTransforms(root); return root;
}
export function createMinecraftBoellStiftungArchitecture(payload?: { buildings: readonly PrismBuilding[] }, options: Omit<BoellStiftungOptions, "minecraft"> = {}): Group {
  return createBoellStiftungArchitecture(payload, { ...options, minecraft: true });
}

import {
  BoxGeometry, Color, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Path, Quaternion, Shape, Vector2, Vector3,
} from "three";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  MINECRAFT_PARLIAMENT_ARCHITECTURE_GROUP, PARLIAMENT_ARCHITECTURE_GROUP,
  PARLIAMENT_ARCHITECTURE_IDS, PARLIAMENT_ARCHITECTURE_PROFILE, JAKOB_KAISER_EAST_UPPER_PROFILE,
} from "./parliamentArchitectureProfile";

type Point = readonly [number, number];
type Triple = [number, number, number];
type Block = { centre: Triple; size: Triple; yaw: number; color: number; role: string; sourceId?: string; normal?: Point };
export type ParliamentVoxelPayload = {
  cell_m: number;
  grid: { min_x_idx: number; min_z_idx: number };
  building_rows?: Array<Array<[number, number, number, number, number]>>;
  buildings?: Array<[number, number, number, number, number]>;
};
export type ParliamentDetailOptions = { mobileLike?: boolean; voxels?: ParliamentVoxelPayload };
export type ParliamentFacade = {
  sourceId: string; start: Point; end: Point; normal: Point;
  bottomY: number; topY: number; courtyard: boolean; family: "jkh" | "melh";
};

const C = {
  concrete: 0xd6d7cb, light: 0xe6e5d8, stone: 0xcac7b5,
  glass: 0x597e87, glassLight: 0x72989d, steel: 0x939f9c,
  dark: 0x435758, cedar: 0x977154, cedarLight: 0xb29270,
};
const JKH_IDS = new Set<string>(PARLIAMENT_ARCHITECTURE_PROFILE.jakobKaiserHaus.sourceIds);
JKH_IDS.add(JAKOB_KAISER_EAST_UPPER_PROFILE.displayPrismId);

function inRing(x: number, z: number, ring: readonly (readonly number[])[], scale = 1): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[i][0] * scale, az = ring[i][1] * scale;
    const bx = ring[j][0] * scale, bz = ring[j][1] * scale;
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

function occupied(x: number, y: number, z: number, parts: readonly PrismBuilding[]): boolean {
  return parts.some((b) => y >= b.y0_dm / 10 && y <= (b.y0_dm + b.h_dm) / 10 &&
    inRing(x, z, b.ring, 0.1) && !(b.holes ?? []).some((h) => inRing(x, z, h, 0.1)));
}

export function jakobKaiserEastUpperContains(x: number, z: number): boolean {
  const p = JAKOB_KAISER_EAST_UPPER_PROFILE;
  return inRing(x, z, p.footprintWorld) && !inRing(x, z, p.courtyardWorld);
}

export function jakobKaiserEastUpperMinecraftContains(x: number, z: number): boolean {
  const centreX = 536 + Math.floor((x - 534) / 4) * 4;
  const centreZ = 20 + Math.floor((z - 18) / 4) * 4;
  return centreX >= 536 && centreX < 598 && centreZ >= 20 && centreZ < 104 &&
    jakobKaiserEastUpperContains(centreX, centreZ);
}

/** A fresh, explicitly named display record; never mutate the source payload. */
export function jakobKaiserEastUpperDisplayPrism(): PrismBuilding {
  const p = JAKOB_KAISER_EAST_UPPER_PROFILE;
  return { id: p.displayPrismId, ring: p.footprintWorld.map(([x, z]) => [x * 10, z * 10]),
    holes: [p.courtyardWorld.map(([x, z]) => [x * 10, z * 10])],
    y0_dm: p.bottomY * 10, h_dm: (p.topY - p.bottomY) * 10, class: 0, roof: 1000 };
}

function withDisplayWing(payload: PrismPayload): PrismPayload {
  return payload.buildings.some((b) => b.id === JAKOB_KAISER_EAST_UPPER_PROFILE.sourcePrismId)
    ? { ...payload, buildings: [...payload.buildings, jakobKaiserEastUpperDisplayPrism()] } : payload;
}

function voxelSkinSampler(payload?: ParliamentVoxelPayload): ((x: number, y: number, z: number) => boolean) | null {
  if (!payload) return null;
  const cell = payload.cell_m;
  const cells = new Map<string, [number, number]>();
  const add = (xi: number, zi: number, bottom: number, top: number) => {
    if (xi * cell > 355 && xi * cell < 615 && zi * cell > -200 && zi * cell < 205)
      cells.set(`${xi},${zi}`, [bottom / 10, top / 10]);
  };
  if (payload.building_rows) payload.building_rows.forEach((row, z) => {
    const zi = payload.grid.min_z_idx + z;
    if (zi * cell < -205 || zi * cell > 210) return;
    for (const [x, count, bottom, top] of row)
      for (let offset = 0; offset < count; offset++) add(payload.grid.min_x_idx + x + offset, zi, bottom, top);
  });
  else for (const [x, z, bottom, top] of payload.buildings ?? []) add(x, z, bottom, top);
  return (x, y, z) => {
    const column = cells.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
    return !!column && y >= column[0] && y <= column[1];
  };
}

/** Exact ordered source edges, including hole walls; no bounding rectangles. */
export function parliamentFacadeAxes(payload: PrismPayload): ParliamentFacade[] {
  const axes: ParliamentFacade[] = [];
  for (const b of payload.buildings) {
    if ((!PARLIAMENT_ARCHITECTURE_IDS.has(b.id) && b.id !== JAKOB_KAISER_EAST_UPPER_PROFILE.displayPrismId) || b.h_dm < 100) continue;
    for (const [ringIndex, sourceRing] of [b.ring, ...(b.holes ?? [])].entries()) {
      const ring: Point[] = sourceRing.map(([x, z]) => [x / 10, z / 10]);
      let area = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length];
        area += a[0] * c[1] - c[0] * a[1];
      }
      const outward = (area >= 0 ? 1 : -1) * (ringIndex === 0 ? 1 : -1);
      for (let i = 0; i < ring.length; i++) {
        const start = ring[i], end = ring[(i + 1) % ring.length];
        const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz);
        if (length < 6) continue;
        axes.push({ sourceId: b.id, start, end, normal: [outward * dz / length, -outward * dx / length],
          bottomY: Math.max(4.5, b.y0_dm / 10), topY: (b.y0_dm + b.h_dm) / 10,
          courtyard: ringIndex > 0, family: JKH_IDS.has(b.id) ? "jkh" : "melh" });
      }
    }
  }
  return axes;
}

function point(a: ParliamentFacade, along: number, y: number, outward: number): Triple {
  const dx = a.end[0] - a.start[0], dz = a.end[1] - a.start[1], length = Math.hypot(dx, dz);
  return [a.start[0] + dx / length * along + a.normal[0] * outward, y,
    a.start[1] + dz / length * along + a.normal[1] * outward];
}

function facadeBox(blocks: Block[], a: ParliamentFacade, along: number, y: number, outward: number,
  width: number, height: number, depth: number, color: number, role: string, minecraft: boolean): void {
  const dx = a.end[0] - a.start[0], dz = a.end[1] - a.start[1], length = Math.hypot(dx, dz);
  const size: Triple = minecraft
    ? [Math.abs(dx / length) * width + Math.abs(dz / length) * depth, height,
      Math.abs(dz / length) * width + Math.abs(dx / length) * depth]
    : [width, height, depth];
  blocks.push({ centre: point(a, along, y, outward), size, yaw: minecraft ? 0 : -Math.atan2(dz, dx), color, role,
    sourceId: a.sourceId, normal: a.normal });
}

function addFacade(blocks: Block[], a: ParliamentFacade, parts: readonly PrismBuilding[], minecraft: boolean, mobile: boolean,
  voxelOccupied: ReturnType<typeof voxelSkinSampler>): void {
  const length = Math.hypot(a.end[0] - a.start[0], a.end[1] - a.start[1]);
  const library = a.sourceId === PARLIAMENT_ARCHITECTURE_PROFILE.marieElisabethLuedersHaus.librarySourceId;
  const displayNorthHall = a.sourceId === JAKOB_KAISER_EAST_UPPER_PROFILE.displayPrismId &&
    length > 20 && (a.start[1] + a.end[1]) / 2 < 50;
  const glassCurtain = library || (a.family === "jkh" && a.courtyard) || displayNorthHall;
  const pitchTarget = minecraft ? (mobile ? 8 : 6) : (mobile ? 5 : 3.6);
  const bays = Math.max(1, Math.floor(length / pitchTarget));
  const pitch = length / bays;
  const height = a.topY - a.bottomY;
  const floors = Math.max(2, Math.floor(height / 4.2));
  const floorHeight = (height - 1.15) / floors;
  const baseProjection = minecraft ? 1.15 : 0.17;
  const depth = minecraft ? 0.6 : 0.18;
  for (let bay = 0; bay < bays; bay++) {
    const u = (bay + 0.5) * pitch;
    const easternCedar = !displayNorthHall && a.family === "jkh" && point(a, u, 0, 0)[0] > 548;
    for (let floor = 0; floor < floors; floor++) {
      const y = a.bottomY + 0.75 + (floor + 0.5) * floorHeight;
      const probe = point(a, u, y, 0.5);
      if (occupied(...probe, parts)) continue;
      const width = pitch * (glassCurtain ? 0.965 : 0.68);
      const windowHeight = floorHeight * (glassCurtain ? 0.94 : 0.66);
      let projection = baseProjection;
      if (minecraft && voxelOccupied) {
        // The 4 m source raster can project beyond a surveyed wall. Follow
        // the actual nearest exposed cube face instead of burying windows.
        for (const du of [-width * 0.4, 0, width * 0.4]) {
          for (let distance = 0; distance <= 3.4; distance += 0.1) {
            const sample = point(a, u + du, y, distance);
            if (voxelOccupied(...sample)) projection = Math.max(projection, distance + depth / 2 + 0.13);
          }
        }
      }
      const glass = (bay + floor) % 4 === 0 ? C.glassLight : C.glass;
      facadeBox(blocks, a, u, y, projection, width, windowHeight, depth, glass,
        library ? "library curtain glazing" : a.courtyard ? "courtyard glazing" : "office glazing", minecraft);
      // Horizontal ledges and thin centre mullions sit in front of the glass.
      facadeBox(blocks, a, u, y - windowHeight / 2 - 0.1, projection + 0.1,
        width + 0.22, minecraft ? 0.35 : 0.15, depth + 0.12,
        easternCedar ? C.cedar : glassCurtain ? C.steel : C.light, "window sill", minecraft);
      if (glassCurtain || easternCedar || (!mobile && !minecraft && bay % 2 === 0)) {
        facadeBox(blocks, a, u, y, projection + 0.12, minecraft ? 0.35 : 0.1,
          windowHeight + 0.12, depth + 0.12, glassCurtain ? C.steel : C.light,
          "vertical mullion", minecraft);
      }
      if (easternCedar) {
        facadeBox(blocks, a, u, y + windowHeight / 2 - 0.12, projection + 0.34,
          width, minecraft ? 0.5 : 0.28, minecraft ? 0.9 : 0.8,
          (bay + floor) % 3 ? C.cedar : C.cedarLight, "cedar folding shade", minecraft);
        if (!mobile && !minecraft) {
          for (const side of [-1, 1]) facadeBox(blocks, a, u + side * width / 2, y,
            projection + 0.15, 0.15, windowHeight, 0.3, C.cedar, "cedar side frame", minecraft);
        }
      }
      // The five reading-room gallery levels remain legible through the
      // patterned curtain wall; no opaque cylinder buries this frontage.
      if (library && !mobile && !minecraft) {
        facadeBox(blocks, a, u, y - windowHeight / 2 + 0.32, projection + 0.04,
          width * 0.9, 0.1, 0.14, C.dark, "library gallery rail", minecraft);
      }
      if (displayNorthHall && (!mobile || bay % 2 === 0)) {
        facadeBox(blocks, a, u, y + windowHeight * 0.23, projection + 0.12,
          width, minecraft ? 0.18 : 0.09, depth + 0.12, C.steel, "JKH hall secondary transom", minecraft);
      }
    }
    const capProbe = point(a, u, a.topY - 0.3, 0.5);
    if (!occupied(...capProbe, parts)) facadeBox(blocks, a, u, a.topY - 0.25,
      baseProjection, pitch * 0.98, 0.32, minecraft ? 0.8 : 0.32, C.light, "source edge parapet", minecraft);
  }
}

function addDisplayWing(root: Group, blocks: Block[], minecraft: boolean): void {
  const p = JAKOB_KAISER_EAST_UPPER_PROFILE;
  if (minecraft) {
    const cell = 4, courses = Math.ceil((p.topY - p.bottomY) / cell), dy = (p.topY - p.bottomY) / courses;
    for (let x = 536; x < 598; x += cell) for (let z = 20; z < 104; z += cell) {
      if (!jakobKaiserEastUpperContains(x, z)) continue;
      for (let level = 0; level < courses; level++) blocks.push({
        centre: [x, p.bottomY + (level + 0.5) * dy, z], size: [cell, dy, cell], yaw: 0,
        color: level === courses - 1 ? C.concrete : C.stone, role: "JKH east upper display wing",
      });
    }
    return;
  }
  const shape = new Shape(p.footprintWorld.map(([x, z]) => new Vector2(x, -z)));
  const hole = new Path(p.courtyardWorld.map(([x, z]) => new Vector2(x, -z)));
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, { depth: p.topY - p.bottomY, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, p.bottomY, 0); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: C.stone });
  const night = new MeshStandardMaterial({ color: C.stone, roughness: 0.9, flatShading: true });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Jakob-Kaiser northeast upper wing source-gap display";
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  mesh.userData.sourceConflict = p; mesh.userData.textureFree = true;
  root.add(mesh);
}

function addLibraryCrown(blocks: Block[], minecraft: boolean, mobile: boolean): void {
  const p = PARLIAMENT_ARCHITECTURE_PROFILE.marieElisabethLuedersHaus.libraryCrown;
  const segments = minecraft ? (mobile ? 16 : 24) : 48;
  for (let i = 0; i < segments; i++) {
    const angle = (i + 0.5) / segments * Math.PI * 2;
    const x = p.centreWorld[0] + Math.cos(angle) * p.radiusM;
    const z = p.centreWorld[1] + Math.sin(angle) * p.radiusM;
    const width = 2 * p.radiusM * Math.tan(Math.PI / segments) + 0.05;
    const shape = (radius: number, y: number, h: number, color: number, role: string) => {
      const centre: Triple = [p.centreWorld[0] + Math.cos(angle) * radius, y,
        p.centreWorld[1] + Math.sin(angle) * radius];
      const size: Triple = minecraft
        ? [Math.abs(Math.sin(angle)) * width + 0.72, h, Math.abs(Math.cos(angle)) * width + 0.72]
        : [width, h, 0.26];
      blocks.push({ centre, size, yaw: minecraft ? 0 : Math.PI / 2 - angle, color, role });
    };
    shape(p.radiusM, p.baseY + p.glazingHeightM / 2, p.glazingHeightM, C.dark, "library roof clerestory");
    shape(p.radiusM + 0.15, p.baseY + p.glazingHeightM + p.capHeightM / 2,
      p.capHeightM, C.light, "library shallow crown rim");
    // A thin segmented roof disk with no full-height buried solid volume.
    if (i % (minecraft ? 1 : 2) === 0) blocks.push({
      centre: [x - Math.cos(angle) * p.radiusM / 2,
        // Recess the darker roof below its pale rim. Their differently
        // coloured top faces must never occupy the same depth plane.
        p.baseY + p.glazingHeightM + p.capHeightM / 2 - 0.08, z - Math.sin(angle) * p.radiusM / 2],
      size: minecraft ? [Math.abs(Math.cos(angle)) * p.radiusM + 1, p.capHeightM,
        Math.abs(Math.sin(angle)) * p.radiusM + 1] : [p.radiusM + 0.3, p.capHeightM, width * 1.95],
      yaw: minecraft ? 0 : -angle, color: C.concrete, role: "library shallow crown roof",
    });
  }
}

function finish(root: Group, blocks: Block[], name: string, minecraft: boolean, mobile: boolean): Group {
  root.name = name;
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, flatShading: true });
  const geometry = new BoxGeometry(1, 1, 1);
  geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(geometry, day, blocks.length);
  mesh.name = `${name} facade and roof details`;
  const matrix = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), color = new Color();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    matrix.compose(new Vector3(...b.centre), q.setFromAxisAngle(up, b.yaw), new Vector3(...b.size));
    mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(b.color));
  }
  mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
  mesh.userData.textureFree = true;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  root.add(mesh);
  root.userData.profile = PARLIAMENT_ARCHITECTURE_PROFILE;
  root.userData.mobileLike = mobile;
  root.userData.minecraft = minecraft;
  root.userData.replacesLoD2 = false;
  root.userData.sourceGapDisplayWing = JAKOB_KAISER_EAST_UPPER_PROFILE;
  root.userData.blocks = blocks;
  root.userData.detailCounts = blocks.reduce<Record<string, number>>((counts, b) => {
    counts[b.role] = (counts[b.role] ?? 0) + 1; return counts;
  }, {});
  freezeStaticSceneTransforms(root);
  return root;
}

function create(payload: PrismPayload, options: ParliamentDetailOptions, minecraft: boolean): Group {
  const mobile = minecraft && (options.mobileLike ?? false);
  const displayPayload = withDisplayWing(payload);
  const parts = displayPayload.buildings.filter((b) => PARLIAMENT_ARCHITECTURE_IDS.has(b.id) || b.id === JAKOB_KAISER_EAST_UPPER_PROFILE.displayPrismId);
  const blocks: Block[] = [];
  const root = new Group();
  const voxelSourceOccupied = voxelSkinSampler(options.voxels);
  const hasDisplayWing = parts.some((b) => b.id === JAKOB_KAISER_EAST_UPPER_PROFILE.displayPrismId);
  const voxelOccupied = minecraft ? (x: number, y: number, z: number) =>
    !!voxelSourceOccupied?.(x, y, z) || (hasDisplayWing && y >= JAKOB_KAISER_EAST_UPPER_PROFILE.bottomY &&
      y <= JAKOB_KAISER_EAST_UPPER_PROFILE.topY && jakobKaiserEastUpperMinecraftContains(x, z)) : null;
  if (hasDisplayWing) addDisplayWing(root, blocks, minecraft);
  for (const axis of parliamentFacadeAxes(displayPayload)) addFacade(blocks, axis, parts, minecraft, mobile, voxelOccupied);
  if (parts.some((b) => b.id === "K0001x35")) addLibraryCrown(blocks, minecraft, mobile);
  return finish(root, blocks, minecraft ? MINECRAFT_PARLIAMENT_ARCHITECTURE_GROUP : PARLIAMENT_ARCHITECTURE_GROUP,
    minecraft, mobile);
}

export function createParliamentArchitecture(payload: PrismPayload, options: ParliamentDetailOptions = {}): Group {
  return create(payload, options, false);
}

export function createMinecraftParliamentArchitecture(payload: PrismPayload, options: ParliamentDetailOptions = {}): Group {
  return create(payload, options, true);
}

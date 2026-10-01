import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import {
  MOABIT_GUARD_HOUSE_SOURCE as SOURCE,
  MOABIT_GUARD_HOUSE_PROFILE as PROFILE,
  MOABIT_GUARD_HOUSE_GROUP_NAME,
  MINECRAFT_MOABIT_GUARD_HOUSE_GROUP_NAME,
  moabitGuardHouseContains,
} from "./moabitGuardHouseProfile";

type Point = [number, number, number];
type House = typeof SOURCE.houses[number];
type Part = House["parts"][number];
type Wall = { x: number; z: number; dx: number; dz: number; nx: number; nz: number; length: number };
type DetailRecord = { partId: string; role: string; position: Point; size: Point; angle: number; color: number; parkFacing: boolean };
const UP = new Vector3(0, 1, 0);
const BRICK = 0x9c6248, LIGHT_BRICK = 0xb17755, DARK_BRICK = 0x795040;
const MORTAR = 0xb09479, GLASS = 0x354448, FRAME = 0x80745c, ZINC = 0x747c76;

function walls(part: Part): Wall[] {
  const ring = part.previous_prism.ring;
  return ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const dx = (b[0] - a[0]) / 10, dz = (b[1] - a[1]) / 10;
    const length = Math.hypot(dx, dz);
    let nx = dz / length, nz = -dx / length;
    if (moabitGuardHouseContains(ring, (a[0] + b[0]) / 20 + nx * .05,
      (a[1] + b[1]) / 20 + nz * .05)) { nx = -nx; nz = -nz; }
    return { x: a[0] / 10, z: a[1] / 10, dx: dx / length, dz: dz / length, nx, nz, length };
  }).filter(w => w.length > .3);
}

class Batch {
  records: DetailRecord[] = [];
  constructor(readonly native: boolean) {}
  add(part: Part, wall: Wall, u: number, y: number, size: Point,
    color: number, role: string, parkFacing: boolean, out = .17): void {
    this.records.push({ partId: part.previous_prism.id, role, size, color, parkFacing,
      position: [wall.x + wall.dx * u + wall.nx * out, y, wall.z + wall.dz * u + wall.nz * out],
      angle: -Math.atan2(wall.dz, wall.dx) });
  }
  finish(root: Group, diagnostic: boolean): void {
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .94 });
    const mesh = new InstancedMesh(geometry, dayMaterial, 0);
    const matrices = new Float32Array(this.records.length * 16);
    const colors = new Float32Array(this.records.length * 3);
    const matrix = new Matrix4(), q = new Quaternion(), color = new Color();
    const position = new Vector3(), scale = new Vector3();
    this.records.forEach((r, i) => {
      matrix.compose(position.set(...r.position), q.setFromAxisAngle(UP, r.angle), scale.set(...r.size));
      matrices.set(matrix.elements, i * 16); color.setHex(r.color).toArray(colors, i * 3);
    });
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = this.records.length;
    mesh.name = `${root.name}: brick skins, blind park faces and windowed outer faces`;
    mesh.userData = { dayMaterial, nightMaterial, civicBuildingDetail: true, textureFree: true, blockNative: this.native,
      facadeOnly: !this.native, surfaceOnly: true, hiddenSolidInfill: false };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    root.userData.instanceCount = mesh.count;
    if (diagnostic) root.userData.facadeRecords = this.records;
  }
}

/** Sample the retained roof triangles without copying any source shell. */
function roofY(part: Part, x: number, z: number): number | null {
  let result: number | null = null;
  for (const ring of part.roof_surfaces_world_m) for (let i = 1; i < ring.length - 1; i++) {
    const a = ring[0], b = ring[i], c = ring[i + 1];
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    if (u < -.0001 || v < -.0001 || u + v > 1.0001) continue;
    result = Math.max(result ?? -Infinity, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return result;
}

function appendNativeRoof(batch: Batch, part: Part, eave: number): void {
  const ring = part.previous_prism.ring;
  const minX = Math.min(...ring.map(p => p[0] / 10)), maxX = Math.max(...ring.map(p => p[0] / 10));
  const minZ = Math.min(...ring.map(p => p[1] / 10)), maxZ = Math.max(...ring.map(p => p[1] / 10));
  const step = .85;
  for (let x = Math.floor(minX / step) * step + step / 2; x < maxX; x += step)
    for (let z = Math.floor(minZ / step) * step + step / 2; z < maxZ; z += step) {
      if (!moabitGuardHouseContains(ring, x, z)) continue;
      const sourceY = roofY(part, x, z); if (sourceY === null) continue;
      const top = Math.min((part.previous_prism.y0_dm + part.previous_prism.h_dm) / 10,
        Math.ceil(sourceY * 4) / 4);
      // A stepped roof shell meets the source-plane wall; nothing fills the
      // building's interior. The highest retained roof envelope is unchanged.
      const bottom = Math.max(eave - .15, top - 2.8);
      batch.records.push({ partId: part.previous_prism.id, role: "native-roof-surface",
        position: [x, (top + bottom) / 2, z], size: [step, top - bottom, step],
        angle: 0, color: ZINC, parkFacing: false });
    }
}

function appendHouse(batch: Batch, house: House): void {
  for (const part of house.parts) {
    const prism = part.previous_prism, bottom = prism.y0_dm / 10;
    const top = (prism.y0_dm + prism.h_dm) / 10 - PROFILE.drawnRoofRiseM[prism.id];
    const height = top - bottom;
    const annex = house.parts.length > 1 && part !== house.parts[0];
    for (const wall of walls(part)) {
      const middleX = wall.x + wall.dx * wall.length / 2 + wall.nx * .2;
      const middleZ = wall.z + wall.dz * wall.length / 2 + wall.nz * .2;
      // The two measured stair risalits join their towers. No fictitious
      // window or masonry layer is inserted inside that occupied joint.
      if (house.parts.some(other => other !== part &&
        moabitGuardHouseContains(other.previous_prism.ring, middleX, middleZ))) continue;
      const parkFacing = wall.nx * house.park_facing_normal[0] +
        wall.nz * house.park_facing_normal[1] > .75;
      const add = (u: number, y: number, size: Point, color: number, role: string, out = .17) =>
        batch.add(part, wall, u, y, size, color, role, parkFacing, out);
      // Surface-only colour over the retained prism. It never fills a yard,
      // broadens the body or creates a second roof/hidden block volume.
      add(wall.length / 2, (bottom + top) / 2, [wall.length, height, batch.native ? .22 : .035],
        annex ? LIGHT_BRICK : BRICK, "brick-surface", .10);
      add(wall.length / 2, bottom + .32, [wall.length, .64, .10], DARK_BRICK, "brick-plinth", .15);
      add(wall.length / 2, top - .18, [wall.length + .08, .31, .28], LIGHT_BRICK, "projecting-attic", .20);
      add(wall.length / 2, top + .02, [wall.length + .21, .09, .40], ZINC, "zinc-eaves", .23);

      const consoles = Math.max(2, Math.round(wall.length / 1.05));
      for (let k = 0; k < consoles; k++) {
        const u = (k + .5) * wall.length / consoles;
        add(u, top - .58, [.25, .48, .24], DARK_BRICK, "attic-corbel", .18);
        if (!batch.native) add(u, top - .77, [.15, .15, .15], LIGHT_BRICK, "corbel-step", .19);
      }
      // The deliberately windowless prison-side elevation is a defining
      // historic feature. The public park is not faced by invented windows.
      const bays = annex ? 2 : Math.max(2, Math.round(wall.length / 3.1));
      const pitch = wall.length / bays, floorHeight = (height - 1.1) / house.floors;
      const openings: { u: number; y: number; width: number; height: number }[] = [];
      if (!parkFacing && wall.length > 2.8) {
        for (let row = 0; row < house.floors; row++) for (let bay = 0; bay < bays; bay++) {
          const u = (bay + .5) * pitch, winHeight = Math.min(1.83, floorHeight - .61);
          const width = Math.min(1.05, pitch * .49), y = bottom + .76 + row * floorHeight + winHeight / 2;
          openings.push({ u, y, width, height: winHeight });
          add(u, y, [width + .24, winHeight + .21, .065], DARK_BRICK, "window-reveal", .15);
          add(u, y, [width, winHeight, .055], GLASS, "window-glass", .21);
          add(u, y - winHeight / 2 - .08, [width + .26, .13, .29], LIGHT_BRICK, "window-sill", .23);
          add(u, y + winHeight / 2 + .13, [width + .30, .21, .13], LIGHT_BRICK, "brick-lintel", .22);
          if (!batch.native) {
            add(u, y, [.075, winHeight, .065], FRAME, "window-mullion", .26);
            add(u, y + winHeight * .13, [width, .075, .065], FRAME, "window-transom", .26);
            for (const side of [-1, 1]) add(u + side * width / 2, y,
              [.065, winHeight, .065], FRAME, "window-jamb", .26);
          }
        }
      }
      // Slim mortar courses are interrupted at every real display opening;
      // never stripe across glazing. Native uses broader spaced brick courses.
      const coursePitch = batch.native ? .83 : .28;
      for (let y = bottom + .83; y < top - 1; y += coursePitch) {
        const cuts = openings.filter(o => Math.abs(o.y - y) < o.height / 2 + .12)
          .map(o => [Math.max(0, o.u - o.width / 2 - .13), Math.min(wall.length, o.u + o.width / 2 + .13)]);
        let u = 0;
        for (const [left, right] of [...cuts, [wall.length, wall.length]]) {
          if (left - u > .12) add((left + u) / 2, y, [left - u, .025, .022], MORTAR, "mortar-course", .126);
          u = right;
        }
      }
      // Narrow vertical rainwater pipes remain in the wall plane, never
      // outside the existing approach / park entrance.
      if (!batch.native && wall.length > 5) add(.32, (bottom + top) / 2,
        [.07, height - .16, .085], ZINC, "rainwater-pipe", .29);
    }
    if (batch.native) appendNativeRoof(batch, part, top);
  }
}

function create(native: boolean, diagnostic: boolean): Group {
  const root = new Group();
  root.name = native ? MINECRAFT_MOABIT_GUARD_HOUSE_GROUP_NAME : MOABIT_GUARD_HOUSE_GROUP_NAME;
  root.userData = { sourceBound: true, textureFree: true, fullStaticDetailOnTouch: true,
    schwellenraumGeschuetzt: true, staticInSchwellenraum: true,
    keepInMinecraft: native, blockNative: native, facadeOnly: !native, surfaceOnly: true, hiddenSolidInfill: false,
    sourceBuildingsRetained: true, houseCount: 3, sourcePartCount: 5, proceduralDimensions: true };
  const batch = new Batch(native);
  for (const house of SOURCE.houses) appendHouse(batch, house);
  batch.finish(root, diagnostic);
  return freezeStaticSceneTransforms(root);
}

export function createMoabitGuardHouses(_mobileLike = false, diagnostic = false): Group {
  return create(false, diagnostic);
}
export function createMinecraftMoabitGuardHouses(_mobileLike = false, diagnostic = false): Group {
  return create(true, diagnostic);
}

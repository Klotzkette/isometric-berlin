import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import type { PrismBuilding } from "./IsometricCityWorld";
import { chariteContainsRing, chariteRingWalls, CHARITE_VIROLOGY_IDS, type ChariteFacadeWall } from "./HistoricChariteCampus";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { createMinecraftChariteHistoricShells } from "./MinecraftChariteHistoricShells";
import roofFit from "./chariteHistoricFacadeRoofFit.json";
import {
  CHARITE_HISTORIC_FACADE_IDS, CHARITE_HISTORIC_FACADE_PROFILES,
  CHARITE_HISTORIC_FACADE_PROFILE, CHARITE_HISTORIC_FACADES_GROUP_NAME,
  MINECRAFT_CHARITE_HISTORIC_FACADES_GROUP_NAME,
} from "./chariteHistoricFacadeProfiles";

type Profile = Omit<typeof CHARITE_HISTORIC_FACADE_PROFILES[number], "material"> & {
  material: { brick: number; stone: number; floors: number; pitch: number; width: number; height: number; plaster: boolean; paired: boolean };
};
type Part = Pick<PrismBuilding, "id" | "ring" | "y0_dm" | "h_dm" | "holes">;
type Point = [number, number, number];
type Record = { sourceId: string; role: string; position: Point; size: Point; angle: number; color: number };
const UP = new Vector3(0, 1, 0);
const GLASS = 0x425961, FRAME = 0xe0dfd0, SHADOW = 0x534a41, GRANITE = 0x898178;
const fits: { [id: string]: number } = roofFit;

export function chariteHistoricFacadeTop(part: Part): number {
  return (part.y0_dm + part.h_dm) / 10 - (fits[part.id] ?? 0);
}
function point(wall: ChariteFacadeWall, u: number, y: number, out: number): Point {
  return [wall.x1 + wall.dirX * u + wall.nx * out, y, wall.z1 + wall.dirZ * u + wall.nz * out];
}
/** All adjoining source parts participate, including modern campus buildings. */
export function chariteHistoricFacadeExposure(parts: readonly Part[]): (
  part: Part, wall: ChariteFacadeWall, u: number, y: number, width?: number, height?: number,
) => boolean {
  const indexed = parts.map(part => ({ part,
    minX: Math.min(...part.ring.map(p => p[0])) / 10,
    maxX: Math.max(...part.ring.map(p => p[0])) / 10,
    minZ: Math.min(...part.ring.map(p => p[1])) / 10,
    maxZ: Math.max(...part.ring.map(p => p[1])) / 10,
  }));
  return (part, wall, u, y, width = 0, height = 0) => {
    for (const du of [-width / 2, 0, width / 2]) for (const dy of [-height / 2, height / 2]) {
      const [x, yy, z] = point(wall, u + du, y + dy, .38);
      if (indexed.some(({ part: other, minX, maxX, minZ, maxZ }) => other.id !== part.id &&
        x >= minX && x <= maxX && z >= minZ && z <= maxZ &&
        yy >= other.y0_dm / 10 && yy <= (other.y0_dm + other.h_dm) / 10 &&
        chariteContainsRing(other.ring, x, z) &&
        !(other.holes ?? []).some(hole => chariteContainsRing(hole, x, z)))) return false;
    }
    return true;
  };
}
function walls(part: Part): ChariteFacadeWall[] {
  const outer = chariteRingWalls(part.ring);
  // Courtyard faces point into the hole, preserving the source's empty court.
  return [...outer, ...(part.holes ?? []).flatMap((hole, h) => chariteRingWalls(hole)
    .map(w => ({ ...w, nx: -w.nx, nz: -w.nz, index: 10_000 + h * 1_000 + w.index })))];
}
class Batch {
  records: Record[] = [];
  constructor(readonly native: boolean, readonly diagnostic: boolean) {}
  add(part: Part, wall: ChariteFacadeWall, u: number, y: number, width: number, height: number,
    depth: number, color: number, role: string, out = .16): void {
    if (width <= 0 || height <= 0 || y + height / 2 > chariteHistoricFacadeTop(part) + .001) return;
    this.records.push({ sourceId: part.id, role, position: point(wall, u, y, out),
      size: [width, height, depth], angle: -Math.atan2(wall.dirZ, wall.dirX), color });
  }
  arch(part: Part, wall: ChariteFacadeWall, u: number, spring: number, width: number, color: number): void {
    const count = this.native ? 3 : 7, span = width + .26;
    for (let i = 0; i < count; i++) {
      const offset = ((i + .5) / count - .5) * span;
      this.add(part, wall, u + offset, spring + .22 * Math.sqrt(Math.max(0, 1 - (offset / (span / 2)) ** 2)),
        span / count + .015, .17, .16, color, "segmental-arch", .23);
    }
  }
  finish(root: Group): void {
    if (!this.records.length) return;
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
    const mesh = new InstancedMesh(geometry, dayMaterial, 0);
    const matrices = new Float32Array(this.records.length * 16), colors = new Float32Array(this.records.length * 3);
    const matrix = new Matrix4(), q = new Quaternion(), color = new Color();
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      matrix.compose(new Vector3(...r.position), q.setFromAxisAngle(UP, r.angle), new Vector3(...r.size));
      matrices.set(matrix.elements, i * 16); color.setHex(r.color).toArray(colors, i * 3);
    }
    mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16);
    mesh.instanceColor = new InstancedBufferAttribute(colors, 3); mesh.count = this.records.length;
    mesh.userData = { dayMaterial, nightMaterial, textureFree: true, sourcePlaneOnly: true };
    mesh.name = `${root.name} masonry windows and portals`;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    root.userData.instanceCount = this.records.length;
    if (this.diagnostic) root.userData.facadeRecords = this.records;
  }
}
function addPart(batch: Batch, part: Part, profile: Profile, exposed: ReturnType<typeof chariteHistoricFacadeExposure>, counts: { windows: number; portals: number; loggias: number }): void {
  const material = profile.material, ground = part.y0_dm / 10, top = chariteHistoricFacadeTop(part);
  const height = top - ground;
  if (height < 3.6) return;
  const floors = Math.max(1, Math.min(material.floors, Math.floor((height - 1.4) / 3.15)));
  const floorHeight = (height - 1.5) / floors;
  for (const wall of walls(part)) {
    if (wall.length < 1.8) continue;
    const bays = Math.max(1, Math.floor((wall.length - .7) / material.pitch));
    const pitch = (wall.length - .6) / bays;
    // Segment every horizontal course so it cannot bridge a joining wing.
    for (let bay = 0; bay < bays; bay++) {
      const u = .3 + (bay + .5) * pitch;
      const w = Math.min(material.width, pitch * .64);
      for (const y of [ground + .6, top - .28, ...Array.from({ length: floors - 1 }, (_, i) => ground + 1.5 + (i + 1) * floorHeight)]) {
        const h = y === ground + .6 ? .7 : .17;
        if (exposed(part, wall, u, y, pitch * .96, h)) batch.add(part, wall, u, y, pitch, h, .13,
          y === ground + .6 ? GRANITE : material.stone, "stone-course", .1);
      }
      for (let row = 0; row < floors; row++) {
        const winHeight = Math.min(material.height, floorHeight - .85);
        const y = ground + 1.55 + row * floorHeight + winHeight / 2;
        if (!exposed(part, wall, u, y, w + .4, winHeight + .6)) continue;
        const loggia = profile.style === "medical" && wall.nx < -.7 && wall.length > 18 && row > 0;
        const paired = material.paired && row === floors - 1 && w > 1.25;
        if (loggia) {
          batch.add(part, wall, u, y + .1, pitch * .90, winHeight + .35, .08, SHADOW, "loggia-recess", .065);
          batch.add(part, wall, u, y - winHeight / 2 + .25, pitch * .93, .48, .2, material.stone, "loggia-parapet", .24);
          counts.loggias++;
        }
        batch.add(part, wall, u, y, w + .25, winHeight + .25, .12, material.stone, "window-reveal", .13);
        batch.add(part, wall, u, y, w, winHeight, .08, GLASS, "window-glass", .22);
        if (!batch.native) {
          batch.add(part, wall, u, y, .09, winHeight, .07, FRAME, "window-mullion", .29);
          batch.add(part, wall, u, y + winHeight * .19, w, .08, .07, FRAME, "window-transom", .29);
          for (const side of [-1, 1]) batch.add(part, wall, u + side * w / 2, y, .075, winHeight, .065, FRAME, "window-jamb", .29);
        }
        if (paired) batch.add(part, wall, u, y, .24, winHeight + .12, .16, material.brick, "paired-opening-pier", .31);
        batch.add(part, wall, u, y - winHeight / 2 - .11, w + .43, .15, .28, material.stone, "window-sill", .21);
        if (!batch.native && profile.style !== "plain" && profile.style !== "workshop") batch.arch(part, wall, u, y + winHeight / 2 + .1, w, material.stone);
        if (material.plaster && row === floors - 1 && floorHeight > 3.8) {
          batch.add(part, wall, u, y - winHeight / 2 - .58, w * .74, .63, .08, material.stone, "plaster-spandrel", .075);
          if (!batch.native) for (const side of [-1, 1]) batch.add(part, wall, u + side * w * .18,
            y - winHeight / 2 - .58, .075, .63, .07, material.brick, "spandrel-brick-rib", .15);
        }
        counts.windows++;
      }
      if (!batch.native && bay % 3 === 0 && exposed(part, wall, u + pitch * .43, (top + ground) / 2, .25, height - .9)) {
        batch.add(part, wall, u + pitch * .43, (top + ground) / 2, .14, height - .9, .14, 0x686c67, "rainwater-pipe", .24);
      }
    }
  }
}
function addPortal(batch: Batch, parts: Part[], profile: Profile, exposed: ReturnType<typeof chariteHistoricFacadeExposure>, counts: { portals: number }): void {
  const candidates = parts.flatMap(part => walls(part).filter(w => w.index < 10_000 && w.length > 7 && w.length < 40)
    .map(wall => ({ part, wall }))).filter(({ part, wall }) => chariteHistoricFacadeTop(part) - part.y0_dm / 10 > 8 &&
      exposed(part, wall, wall.length / 2, part.y0_dm / 10 + 2.1, 2.7, 3.9));
  // One modest source-plane portal per named group, with no new stair footprint.
  const entry = candidates.sort((a, b) => b.wall.nz - a.wall.nz || b.wall.length - a.wall.length)[0];
  if (!entry) return;
  const { part, wall } = entry, u = wall.length / 2, base = part.y0_dm / 10;
  batch.add(part, wall, u, base + 2.05, 2.55, 3.6, .14, profile.material.stone, "portal-surround", .32);
  batch.add(part, wall, u, base + 1.95, 2.02, 3.35, .12, 0x354a47, "portal-door", .43);
  batch.add(part, wall, u, base + 1.95, .1, 3.35, .08, FRAME, "portal-mullion", .51);
  batch.arch(part, wall, u, base + 3.9, 2.55, profile.material.stone);
  counts.portals++;
}
function create(prisms: { buildings: readonly Part[] }, native: boolean, diagnostic: boolean): Group {
  const root = new Group(); root.name = native ? MINECRAFT_CHARITE_HISTORIC_FACADES_GROUP_NAME : CHARITE_HISTORIC_FACADES_GROUP_NAME;
  const sourceParts = prisms.buildings.filter(part => CHARITE_HISTORIC_FACADE_IDS.has(part.id));
  const nearby = prisms.buildings.filter(part => part.ring.some(([x, z]) => x > 1700 && x < 5600 && z > -10600 && z < -4600));
  const exposed = chariteHistoricFacadeExposure(nearby), batch = new Batch(native, diagnostic);
  const detailCounts = { sourcePrisms: sourceParts.length, windows: 0, portals: 0, loggias: 0, families: 0 };
  for (const profile of CHARITE_HISTORIC_FACADE_PROFILES) {
    const ids = new Set(profile.parts.map(part => part.id)), parts = sourceParts.filter(part => ids.has(part.id));
    if (!parts.length) continue;
    detailCounts.families++;
    for (const part of parts) addPart(batch, part, profile, exposed, detailCounts);
    addPortal(batch, parts, profile, exposed, detailCounts);
  }
  if (native) {
    // Drawn Ruska details remain owned by HistoricChariteCampus. Its six exact
    // source parts only need a native facade supplement here.
    const parts = prisms.buildings.filter(part => CHARITE_VIROLOGY_IDS.has(part.id));
    const ruska: Profile = { ...CHARITE_HISTORIC_FACADE_PROFILES[0], key: "ruska", name: "Helmut-Ruska-Haus",
      address: "Rahel-Hirsch-Weg 3", style: "children",
      material: { ...CHARITE_HISTORIC_FACADE_PROFILES[0].material, brick: 0xb8a98b, stone: 0xa35f49, floors: 3 } };
    for (const part of parts) addPart(batch, part, ruska, exposed, detailCounts);
    if (parts.length) { detailCounts.sourcePrisms += parts.length; detailCounts.families++; }
  }
  root.userData = { sourceIds: [...sourceParts.map(part => part.id), ...(native ? prisms.buildings.filter(p => CHARITE_VIROLOGY_IDS.has(p.id)).map(p => p.id) : [])], detailCounts,
    geometryStatus: CHARITE_HISTORIC_FACADE_PROFILE.geometryStatus,
    textureFree: true, nativeMinecraft: native, sourceEnvelopeRetained: true };
  batch.finish(root);
  if (native && detailCounts.sourcePrisms > 0) root.add(createMinecraftChariteHistoricShells(prisms.buildings));
  freezeStaticSceneTransforms(root); return root;
}
/** Full and mobile deliberately use identical static drawn geometry. */
export function createChariteHistoricFacades(prisms: { buildings: readonly Part[] }, _detailProfile: "full" | "mobile" = "full", diagnostic = false): Group {
  return create(prisms, false, diagnostic);
}
/** Facade cubes and complete source-bound native wall/roof skins. */
export function createMinecraftChariteHistoricFacades(prisms: { buildings: readonly Part[] }, _detailProfile: "full" | "mobile" = "full", diagnostic = false): Group {
  return create(prisms, true, diagnostic);
}

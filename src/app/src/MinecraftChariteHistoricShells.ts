import {
  BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2, Vector3,
} from "three";
import { chariteContainsRing, chariteRingWalls, CHARITE_VIROLOGY_IDS, HISTORIC_CHARITE_TONES } from "./HistoricChariteCampus";
import { CHARITE_HISTORIC_FACADE_IDS, CHARITE_HISTORIC_FACADE_TONES } from "./chariteHistoricFacadeProfiles";
import roofFits from "./chariteHistoricFacadeRoofFit.json";
import roofProfiles from "./chariteHistoricNativeRoofProfile.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { indexGeometryExactly } from "./exactGeometryIndex";

type Part = { id: string; ring: number[][]; holes?: number[][][]; y0_dm: number; h_dm: number };
type Point = [number, number];
const fits: Record<string, number> = roofFits;
const profiles: Record<string, typeof roofProfiles[keyof typeof roofProfiles]> = roofProfiles;
export const MINECRAFT_CHARITE_HISTORIC_SHELL_IDS: ReadonlySet<string> = new Set([
  ...CHARITE_HISTORIC_FACADE_IDS, ...CHARITE_VIROLOGY_IDS,
]);

/** Only a supplied, exactly identified source footprint may suppress a column. */
export function createChariteHistoricFacadeColumnTester(source: readonly Part[]) {
  const parts = source.filter(p => MINECRAFT_CHARITE_HISTORIC_SHELL_IDS.has(p.id)).map(part => ({ part,
    minX: Math.min(...part.ring.map(p => p[0])) / 10, maxX: Math.max(...part.ring.map(p => p[0])) / 10,
    minZ: Math.min(...part.ring.map(p => p[1])) / 10, maxZ: Math.max(...part.ring.map(p => p[1])) / 10,
  }));
  return (x: number, z: number): boolean => parts.some(({ part, minX, maxX, minZ, maxZ }) =>
    x >= minX && x <= maxX && z >= minZ && z <= maxZ &&
    chariteContainsRing(part.ring, x, z) && !(part.holes ?? []).some(h => chariteContainsRing(h, x, z)));
}

export function chariteHistoricNativeRoofY(part: Part, x: number, z: number): number {
  const top = (part.y0_dm + part.h_dm) / 10, rise = fits[part.id] ?? 0;
  const profile = profiles[part.id], rect = profile?.rect;
  if (!rise || !rect) return top;
  const [ax, az] = rect.axis, [cx, cz] = rect.center;
  const u = (x - cx) * ax + (z - cz) * az, v = -(x - cx) * az + (z - cz) * ax;
  if (profile.roofCode === 2100) return top - rise + rise * Math.max(0, Math.min(1, (v + rect.halfWidth) / (2 * rect.halfWidth)));
  const flank = Math.max(0, 1 - Math.abs(v) / rect.halfWidth);
  const hip = profile.roofCode === 3200 ? Math.max(0, Math.min(1, (rect.halfLength - Math.abs(u)) / Math.min(rect.halfWidth, rect.halfLength * .6))) : 1;
  return top - rise + rise * Math.min(flank, hip);
}

function clip(poly: Point[], axis: 0 | 1, edge: number, lower: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const insideA = lower ? a[axis] >= edge : a[axis] <= edge;
    const insideB = lower ? b[axis] >= edge : b[axis] <= edge;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (edge - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

/** Exact wall planes plus stepped roof tiles clipped to every source ring/hole. */
export function createMinecraftChariteHistoricShells(source: readonly Part[]): Group {
  const root = new Group(); root.name = "Charite source-bound native wall and roof skins";
  const parts = source.filter(p => MINECRAFT_CHARITE_HISTORIC_SHELL_IDS.has(p.id));
  const matrices: number[] = [], colors: number[] = [], roofs: number[] = [];
  const matrix = new Matrix4(), tint = new Color(), scale = new Vector3();
  let roofFootprintArea = 0, roofPieces = 0;
  for (const part of parts) {
    const ground = part.y0_dm / 10, top = (part.y0_dm + part.h_dm) / 10;
    const eave = top - (fits[part.id] ?? 0);
    const tone = CHARITE_HISTORIC_FACADE_TONES[part.id] ?? HISTORIC_CHARITE_TONES.virologyFacade;
    const walls = [...chariteRingWalls(part.ring), ...(part.holes ?? []).flatMap(h =>
      chariteRingWalls(h).map(w => ({ ...w, nx: -w.nx, nz: -w.nz })))];
    for (const wall of walls) {
      if (eave <= ground) continue;
      const count = Math.max(1, Math.ceil(wall.length / 2.5)), width = wall.length / count;
      for (let i = 0; i < count; i++) {
        const u = (i + .5) * width;
        matrix.makeRotationY(-Math.atan2(wall.dirZ, wall.dirX));
        matrix.scale(scale.set(width, eave - ground, .28));
        matrix.setPosition(wall.x1 + wall.dirX * u - wall.nx * .14, (ground + eave) / 2,
          wall.z1 + wall.dirZ * u - wall.nz * .14);
        matrices.push(...matrix.elements); tint.setHex(tone); colors.push(tint.r, tint.g, tint.b);
      }
    }
    const outer = part.ring.map(([x, z]) => new Vector2(x / 10, z / 10));
    const holes = (part.holes ?? []).map(h => h.map(([x, z]) => new Vector2(x / 10, z / 10)));
    const triangles = ShapeUtils.triangulateShape(outer, holes);
    const points = [...outer, ...holes.flat()];
    const rect = profiles[part.id]?.rect;
    const ax = rect?.axis[0] ?? 1, az = rect?.axis[1] ?? 0;
    const local = points.map(p => [p.x * ax + p.y * az, -p.x * az + p.y * ax] as Point);
    const world = ([u, v]: Point): Point => [u * ax - v * az, u * az + v * ax];
    const step = 2.5, heights = new Map<string, number>();
    const emit = (a: Point, ay: number, b: Point, by: number, c: Point, cy: number) => roofs.push(a[0], ay, a[1], b[0], by, b[1], c[0], cy, c[1]);
    for (const indices of triangles) {
      const tri = indices.map(i => local[i]);
      const x0 = Math.floor(Math.min(...tri.map(p => p[0])) / step), x1 = Math.ceil(Math.max(...tri.map(p => p[0])) / step);
      const z0 = Math.floor(Math.min(...tri.map(p => p[1])) / step), z1 = Math.ceil(Math.max(...tri.map(p => p[1])) / step);
      for (let ix = x0; ix < x1; ix++) for (let iz = z0; iz < z1; iz++) {
        let polygon = clip(clip(clip(clip(tri, 0, ix * step, true), 0, (ix + 1) * step, false), 1, iz * step, true), 1, (iz + 1) * step, false);
        if (polygon.length < 3) continue;
        const area = Math.abs(polygon.reduce((sum, p, i) => sum + p[0] * polygon[(i + 1) % polygon.length][1] - polygon[(i + 1) % polygon.length][0] * p[1], 0)) / 2;
        if (area < 1e-8) continue;
        roofFootprintArea += area; roofPieces++;
        const key = `${ix},${iz}`;
        let upper = heights.get(key);
        if (upper === undefined) {
          const centerU = rect ? rect.center[0] * ax + rect.center[1] * az : (ix + .5) * step;
          const centerV = rect ? -rect.center[0] * az + rect.center[1] * ax : (iz + .5) * step;
          // Closest point to the ridge retains its full height. Shed roofs
          // instead peak at the positive-v edge. Vertical steps stay bounded.
          const u = Math.max(ix * step, Math.min((ix + 1) * step, centerU));
          const v = profiles[part.id]?.roofCode === 2100 ? (iz + 1) * step : Math.max(iz * step, Math.min((iz + 1) * step, centerV));
          const [x, z] = world([u, v]);
          upper = Math.min(top, Math.ceil(chariteHistoricNativeRoofY(part, x, z) * 3) / 3);
          heights.set(key, upper);
        }
        const lower = Math.max(ground, Math.min(eave - .1, upper - .28));
        polygon = polygon.map(world);
        for (let i = 1; i < polygon.length - 1; i++) emit(polygon[0], upper, polygon[i], upper, polygon[i + 1], upper);
        // Thin vertical skirts meet every step and retain gable ends. All
        // corners are clipped to the source footprint, including court holes.
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          emit(a, lower, b, lower, b, upper); emit(a, lower, b, upper, a, upper);
        }
      }
    }
  }
  if (matrices.length) {
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const dayMaterial = new MeshBasicMaterial({ color: 0xffffff });
    const nightMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
    const mesh = new InstancedMesh(geometry, dayMaterial, 0);
    mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3); mesh.count = matrices.length / 16;
    mesh.name = "Charite exact native masonry wall courses";
    mesh.userData = { dayMaterial, nightMaterial, textureFree: true };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  }
  if (roofs.length) {
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(roofs, 3));
    geometry.computeVertexNormals(); indexGeometryExactly(geometry);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    // Back and front faces are needed for clipped tile skirts in both ring
    // orientations; they share the same source-bound stepped surface.
    const dayMaterial = new MeshBasicMaterial({ color: 0x59636a, side: 2 });
    const nightMaterial = new MeshStandardMaterial({ color: 0x59636a, side: 2, roughness: .9, flatShading: true });
    const mesh = new Mesh(geometry, dayMaterial); mesh.name = "Charite clipped native stepped roofs";
    mesh.userData = { dayMaterial, nightMaterial, textureFree: true }; root.add(mesh);
  }
  root.userData = { sourcePrismIds: parts.map(p => p.id), sourcePrisms: parts.length, roofFootprintArea,
    roofPieces, wallInstances: matrices.length / 16, textureFree: true, blockNative: true, keepInMinecraft: true,
    surfaceOnly: true, hiddenSolidInfill: false, sourceFootprintsUnchanged: true };
  return freezeStaticSceneTransforms(root);
}

import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  ShapeUtils, Vector2, Vector3,
} from "three";
import source from "./unterDenLindenSource.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
const part = source.profiles.find(p => p.key === "komischeOper")!.parts[0];
export const KOMISCHE_OPER_SOURCE_IDS = new Set(["K00001Ih"]);
export const KOMISCHE_OPER_SOURCE_PART = part;
export const KOMISCHE_OPER_GROUND_Y = source.display_ground_y_m;
const dy = KOMISCHE_OPER_GROUND_Y - part.ground_y_m;
const footprint = part.ring;
const bounds = { minX: Math.min(...footprint.map(p => p[0])), maxX: Math.max(...footprint.map(p => p[0])),
  minZ: Math.min(...footprint.map(p => p[1])), maxZ: Math.max(...footprint.map(p => p[1])) };

function triangles(rings: number[][][]): Point[][] {
  const normal = new Vector3(), ring = rings[0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    normal.x += (a[1] - b[1]) * (a[2] + b[2]);
    normal.y += (a[2] - b[2]) * (a[0] + b[0]);
    normal.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const axis = Math.abs(normal.y) > Math.abs(normal.x)
    ? Math.abs(normal.y) > Math.abs(normal.z) ? 1 : 2
    : Math.abs(normal.x) > Math.abs(normal.z) ? 0 : 2;
  const projected = rings.map(r => r.map(v => axis === 1 ? new Vector2(v[0], v[2])
    : axis === 0 ? new Vector2(v[2], v[1]) : new Vector2(v[0], v[1])));
  const flat = rings.flat();
  return ShapeUtils.triangulateShape(projected[0], projected.slice(1))
    .map(t => t.map(i => [flat[i][0], flat[i][1] + dy, flat[i][2]] as Point));
}
const roofs = part.surfaces.filter(s => s.kind === "RoofSurface").flatMap(s => triangles(s.rings));

export function komischeOperContains(x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
    const a = footprint[i], b = footprint[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Exact polygon/cell intersection for removing only the former coarse mass. */
export function isKomischeOperReplacementCell(x: number, z: number, size: number): boolean {
  if (x + size < bounds.minX || x > bounds.maxX || z + size < bounds.minZ || z > bounds.maxZ) return false;
  if ([[x, z], [x + size, z], [x, z + size], [x + size, z + size], [x + size / 2, z + size / 2]]
    .some(p => komischeOperContains(p[0], p[1]))) return true;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length];
    let lo = 0, hi = 1;
    for (const [delta, origin, min, max] of [[b[0] - a[0], a[0], x, x + size], [b[1] - a[1], a[1], z, z + size]]) {
      if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) { lo = 1; hi = 0; break; } }
      else { const t0 = (min - origin) / delta, t1 = (max - origin) / delta;
        lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    }
    if (lo <= hi) return true;
  }
  return false;
}

export function komischeOperRoofTopAt(x: number, z: number): number | null {
  if (!komischeOperContains(x, z)) return null;
  let result: number | null = null;
  for (const [a, b, c] of roofs) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    result = Math.max(result ?? -Infinity, y);
  }
  return result;
}

function setMaterials(mesh: Mesh): void {
  mesh.userData.dayMaterial = mesh.material;
  mesh.userData.nightMaterial = new MeshStandardMaterial({ color: (mesh.material as MeshBasicMaterial).color, side: DoubleSide, roughness: .9 });
  mesh.userData.textureFree = true;
}

export function createKomischeOperSourceGeometry(): Group {
  const root = new Group();
  root.name = "Komische Oper complete original LoD2 wall and roof sheets";
  root.userData = { sourceId: part.id, sourceSurfaceCount: part.surfaces.length,
    verticalTranslationM: dy, originalSourceRetained: true, textureFree: true };
  for (const kind of ["WallSurface", "RoofSurface"]) {
    const vertices = part.surfaces.filter(s => s.kind === kind).flatMap(s => triangles(s.rings)).flat(2);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: kind === "WallSurface" ? 0xc4b9a2 : 0x77817e, side: DoubleSide }));
    mesh.name = `Komische Oper source ${kind}`; setMaterials(mesh); root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

/** Bounded exterior blocks preserve the stepped source roof; no hidden fill. */
export function createMinecraftKomischeOperSourceGeometry(): Group {
  const root = new Group(); root.name = "Block-native Komische Oper source envelope";
  root.userData = { blockNative: true, keepInMinecraft: true, textureFree: true, hiddenSolidInfill: false, sourceId: part.id };
  const boxes: { p: Point; s: Point; color: number }[] = [];
  for (let x = Math.floor(bounds.minX); x < bounds.maxX; x++) for (let z = Math.floor(bounds.minZ); z < bounds.maxZ; z++) {
    const y = komischeOperRoofTopAt(x + .5, z + .5); if (y === null) continue;
    const top = Math.round(y * 2) / 2;
    boxes.push({ p: [x + .5, top - .25, z + .5], s: [1, .5, 1], color: 0x78817d });
    // Boundary cells have an exposed outer wall; interior cells keep only the roof.
    if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dz]) => !komischeOperContains(x + .5 + dx, z + .5 + dz))) {
      boxes.push({ p: [x + .5, (top + KOMISCHE_OPER_GROUND_Y) / 2, z + .5],
        s: [1, top - KOMISCHE_OPER_GROUND_Y, 1], color: 0xc4b9a2 });
    }
  }
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial({ color: 0xffffff }), boxes.length);
  const matrix = new Matrix4(), colour = new Color();
  boxes.forEach(({ p, s, color }, i) => { matrix.makeScale(...s).setPosition(...p); mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, colour.setHex(color)); });
  mesh.name = "Komische Oper native roof and exposed boundary cells";
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); setMaterials(mesh); root.add(mesh);
  return freezeStaticSceneTransforms(root);
}

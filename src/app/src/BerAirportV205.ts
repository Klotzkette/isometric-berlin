import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import data from "./data/berAirportV205.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringStrokePaths } from "./drawnLettering";

type Rows = number[][];
function beam(rows: Rows, native: boolean, a: number[], b: number[], y: number, h: number, depth: number, color: number): void {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (length < .001) return;
  if (!native) { rows.push([(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, length, h, depth, -Math.atan2(dz, dx), color]); return; }
  const count = Math.max(1, Math.ceil(length / 2));
  for (let i = 0; i < count; i++) rows.push([a[0] + dx * (i + .5) / count, y, a[1] + dz * (i + .5) / count,
    Math.max(depth, Math.abs(dx) / count), h, Math.max(depth, Math.abs(dz) / count), color]);
}
function roof(rings: number[][][], y: number): BufferGeometry {
  const shape = new Shape(rings[0].map(([x, z]) => new Vector2(x, -z)));
  shape.holes = rings.slice(1).map(r => new Path(r.map(([x, z]) => new Vector2(x, -z))));
  const g = new ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); g.deleteAttribute("uv"); return g;
}
function sheet(out: number[], a: number[], b: number[], low: number, high: number): void {
  out.push(a[0], low, a[1], b[0], low, b[1], b[0], high, b[1],
    a[0], low, a[1], b[0], high, b[1], a[0], high, a[1]);
}
function surface(g: BufferGeometry, glass: boolean): Mesh {
  g.computeBoundingBox(); g.computeBoundingSphere();
  const options = { color: glass ? 0x719b9b : 0xb9bdb6, side: DoubleSide, transparent: glass, opacity: glass ? .42 : 1, depthWrite: !glass };
  const day = new MeshBasicMaterial(options), night = new MeshStandardMaterial({ ...options, roughness: glass ? .25 : .8 });
  const mesh = new Mesh(g, day); mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true }; return mesh;
}

/** Complete mapped T1 parts, T2/pier roof caps, DFS crown, and two actual runway widths. */
export function createBerAirportV205(native = false): Group {
  const root = new Group(); root.name = "BER Willy Brandt — mapped terminal parts and runway markings v205";
  root.userData = { textureFree: true, additiveOnly: true, fullStaticDetailOnTouch: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native, sourceSha256: data.sourceSha256 };
  const rows: Rows = [], caps: BufferGeometry[] = [], glass: number[] = [], solids: number[] = [];
  for (const p of data.buildings) {
    if (native) rows.push(...p.native); else caps.push(roof(p.rings, p.top));
    for (const ring of p.rings) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      if (p.column || p.roofBottom < p.top - .31) {
        if (!native) sheet(solids, a, b, p.roofBottom, p.top);
      }
      if (p.column) continue;
      beam(rows, native, a, b, p.top + .10, .2, .2, 0x67756f);
      if (p.glass || p.tower) {
        const low = p.tower ? p.top - 6 : p.bottom;
        if (native) beam(rows, true, a, b, (low + p.top) / 2, p.top - low, .2, 0x719b9b);
        else sheet(glass, a, b, low, p.top - .1);
        beam(rows, native, a, b, low + .08, .16, .25, 0x67756f);
        const dx = b[0] - a[0], dz = b[1] - a[1], n = Math.ceil(Math.hypot(dx, dz) / 15);
        for (let j = 0; j < n; j++) {
          const x = a[0] + dx * j / n, z = a[1] + dz * j / n;
          rows.push(native ? [x, (low + p.top) / 2, z, .24, p.top - low, .24, 0x67756f] :
            [x, (low + p.top) / 2, z, .24, p.top - low, .24, 0, 0x67756f]);
        }
      }
    }
  }
  // Cartographic ground datum remains the original regional 3 m. Runway widths
  // are tagged, stripe dimensions/spacing are illustrative, not surveyed signs.
  for (const r of data.runways) {
    const a = r.points[0], b = r.points[r.points.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const point = (u: number, v: number): number[] => [a[0] + dx / length * u - dz / length * v, a[1] + dz / length * u + dx / length * v];
    for (let i = 1; i < r.points.length; i++) {
      const p = r.points[i - 1], q = r.points[i], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez);
      for (const side of [-1, 1]) beam(rows, native, [p[0] - ez / l * r.width / 2 * side, p[1] + ex / l * r.width / 2 * side],
        [q[0] - ez / l * r.width / 2 * side, q[1] + ex / l * r.width / 2 * side], 3.08, .06, .30, 0xa4aaa2);
    }
    for (let u = r.thresholdOffsets[0] + 70; u < length - r.thresholdOffsets[1] - 100; u += 120)
      beam(rows, native, point(u, 0), point(u + 30, 0), 3.10, .08, .9, 0xe5e6d9);
    for (const end of [0, 1]) for (const side of [-1, 1]) for (let i = 1; i <= 4; i++) {
      const u = end ? length - r.thresholdOffsets[1] - 65 : r.thresholdOffsets[0] + 25;
      beam(rows, native, point(u, side * (3 + i * 3)), point(u + 35, side * (3 + i * 3)), 3.10, .08, 1.2, 0xe5e6d9);
    }
    r.endLabels.forEach((label, end) => {
      const sign = end ? -1 : 1, u = end ? length - r.thresholdOffsets[1] - 100 : r.thresholdOffsets[0] + 100;
      for (const path of letteringStrokePaths(label, 8)) for (let i = 1; i < path.length; i++)
        beam(rows, native, point(u + path[i - 1][1] * sign, path[i - 1][0] * sign),
          point(u + path[i][1] * sign, path[i][0] * sign), 3.12, .08, .9, 0xe5e6d9);
    });
  }
  if (caps.length) { const geometry = mergeGeometries(caps, false)!; caps.forEach(g => g.dispose()); const mesh = surface(geometry, false); mesh.name = "BER exact source roof planes"; root.add(mesh); }
  for (const [positions, transparent] of [[solids, false], [glass, true]] as const) if (positions.length) {
    const g = new BufferGeometry(); g.setAttribute("position", new Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
    const mesh = surface(g, transparent); mesh.name = transparent ? "BER mapped glass hall and DFS crown" : "BER mapped columns and main roof fascia"; root.add(mesh);
  }
  const details = justicePalaceV183Boxes(rows, native); details.name = "BER native roofs, source frames and runway width markings"; root.add(details);
  return freezeStaticSceneTransforms(root);
}

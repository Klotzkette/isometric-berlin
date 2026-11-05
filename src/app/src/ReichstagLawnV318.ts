import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import data from "./data/reichstagLawnV318.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
function inside(x: number, z: number, ring: readonly number[][]): boolean { let v = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) v = !v; } return v; }
export function reichstagGrassAtV318(x: number, z: number): boolean {
  // A half-metre inset also clears kerbs and very narrow retained paths.
  return [[-.55, -.55], [-.55, .55], [.55, -.55], [.55, .55]].every(([dx, dz]) => {
    const a = (x + dx) * 10, b = (z + dz) * 10;
    return inside(a, b, data.ring) && !data.roads.some(r => inside(a, b, r.ring) && !r.holes.some(h => inside(a, b, h)));
  });
}
/** Grass height is a mown-lawn display estimate, not a terrain correction.
 * Both families retain every lawn/path polygon and the real ground sampler. */
export function createReichstagLawnV318(groundAt: (x: number, z: number) => number | null, native = false): Group {
  const root = new Group(); root.name = "Platz der Republik short grass v318";
  const positions: number[] = [], colors: number[] = [], matrices: number[] = [], color = new Color(), matrix = new Matrix4();
  const step = native ? 3.1 : 2.0;
  let count = 0;
  for (let z = -41; z < 112; z += step) for (let x = -31; x < 168; x += step) {
    const seed = Math.sin(x * 71.37 + z * 23.19) * 43758.5453, t = seed - Math.floor(seed), xx = x + (t - .5) * step * .65, zz = z + ((t * 13) % 1 - .5) * step * .65;
    if (!reichstagGrassAtV318(xx, zz)) continue;
    const ground = groundAt(xx, zz); if (ground === null || !Number.isFinite(ground)) continue; const y = ground + .09;
    const tint = [0x789661, 0x8aa66f, 0x99af7c, 0xa0b686][Math.floor(t * 4)]; color.setHex(tint);
    if (native) { matrix.makeScale(.42, .14 + t * .08, .42); matrix.setPosition(xx, y + .05, zz); matrices.push(...matrix.elements); color.toArray(colors, colors.length); }
    else for (let k = 0; k < 3; k++) {
      const a = t * Math.PI * 2 + k * 2.1, w = .17 + t * .10, h = .07 + t * .09, dx = Math.cos(a) * w, dz = Math.sin(a) * w;
      positions.push(xx - dx, y, zz - dz, xx + dx, y, zz + dz, xx + dx * .4, y + h, zz + dz * .4);
      for (let i = 0; i < 3; i++) color.toArray(colors, colors.length);
    }
    count++;
  }
  const day = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }), night = new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide, roughness: 1 });
  let mesh: Mesh;
  if (native) { const g = new BoxGeometry(); g.deleteAttribute("uv"); const m = new InstancedMesh(g, day, 0); m.instanceMatrix = new InstancedBufferAttribute(new Float32Array(matrices), 16); m.instanceColor = new InstancedBufferAttribute(new Float32Array(colors), 3); m.count = count; m.computeBoundingBox(); m.computeBoundingSphere(); mesh = m; }
  else { const g = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(positions, 3)).setAttribute("color", new Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); g.computeBoundingSphere(); day.vertexColors = true; night.vertexColors = true; mesh = new Mesh(g, day); }
  mesh.userData = { dayMaterial: day, nightMaterial: night }; root.add(mesh); root.userData = { native, grassClumps: count, sourceRingsRetained: true, fullStaticDetailOnTouch: true, textureFree: true, estimatedGrassHeight: true }; return freezeStaticSceneTransforms(root);
}

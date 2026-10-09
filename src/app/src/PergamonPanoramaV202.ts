import { BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from 'three';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import { PERGAMON_PANORAMA_V202_SOURCE as S, PERGAMON_PANORAMA_V202_PROFILE as P, PERGAMON_PANORAMA_V202_YAW, panoramaLocal, panoramaWorld, panoramaContains } from './pergamonPanoramaV202Profile';

type Point = [number, number, number];
const CHARCOAL = 0x343f43, STONE = 0xd9d4bf, JOINT = 0xbcb9aa, GLASS = 0x557d86;
function materials(vertexColors = true) {
  return [new MeshBasicMaterial({ vertexColors, side: DoubleSide }), new MeshStandardMaterial({ vertexColors, side: DoubleSide, roughness: .72 }), new MeshBasicMaterial({ vertexColors, side: DoubleSide, color: 0xa9bcc5 })] as const;
}
function attach(mesh: Mesh) {
  const m = materials(); mesh.material = m[0]; mesh.userData = { dayMaterial: m[0], nightMaterial: m[1], moonlitMaterial: m[2], textureFree: true };
}
/** Full mapped arc stays verbatim; only its covered rear continuation is a circle fit. */
export function panoramaRotundaRing(): number[][] {
  const [cx, cz] = S.rotunda_fit.centre, r = S.rotunda_fit.radius_m;
  const ring = S.ring.slice(0, 21).map(p => [...p]);
  let start = Math.atan2(ring[20][1] - cz, ring[20][0] - cx);
  let end = Math.atan2(ring[0][1] - cz, ring[0][0] - cx);
  while (end <= start) end += Math.PI * 2;
  const count = Math.ceil((end - start) / (Math.PI / 30));
  for (let i = 1; i < count; i++) { const angle = start + (end - start) * i / count; ring.push([cx + Math.cos(angle) * r, cz + Math.sin(angle) * r]); }
  return ring;
}
export function createPergamonPanoramaV202(options: { minecraft?: boolean; mobileLike?: boolean } = {}): Group {
  const native = !!options.minecraft, root = new Group();
  root.name = native ? 'Minecraft Pergamon Panorama source architecture v202' : 'Pergamon Panorama source architecture v202';
  root.userData = { ...P, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, originalSourceRing: true };
  const rows: { p: Point; s: Point; color: number; yaw: number }[] = [];
  const box = (p: Point, s: Point, color: number, yaw = 0) => rows.push({ p, s, color, yaw });
  const localBox = (u: number, y: number, v: number, w: number, h: number, d: number, color: number) => box(panoramaWorld(u, y, v), [w, h, d], color, PERGAMON_PANORAMA_V202_YAW);
  const pos: number[] = [], colors: number[] = [], color = new Color();
  const triangle = (a: Point, b: Point, c: Point, paint: number) => { color.setHex(paint); for (const p of [a, b, c]) { pos.push(...p); colors.push(color.r, color.g, color.b); } };
  const roof = (ring: number[][], y: number, paint: number) => {
    if (!native) for (const face of ShapeUtils.triangulateShape(ring.map(p => new Vector2(p[0], p[1])), [])) triangle(...face.map(i => [ring[i][0], y, ring[i][1]]) as [Point, Point, Point], paint);
  };
  const wall = (a: number[], b: number[], bottom: number, top: number, paint: number) => {
    if (native) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(length / 1.2));
      for (let i = 0; i < n; i++) { const t = (i + .5) / n; box([a[0] + (b[0] - a[0]) * t, (bottom + top) / 2, a[1] + (b[1] - a[1]) * t], [length / n + .025, top - bottom, .28], paint, -Math.atan2(b[1] - a[1], b[0] - a[0])); }
    } else {
      const p: Point = [a[0], bottom, a[1]], q: Point = [b[0], bottom, b[1]], r: Point = [b[0], top, b[1]], s: Point = [a[0], top, a[1]];
      triangle(p, q, r, paint); triangle(p, r, s, paint);
    }
  };
  // Exact OSM perimeter at the source-based hall level; the front remains an open portico.
  for (let i = 0; i < S.ring.length; i++) {
    // The exact first twenty edges belong to the tall drum, which owns them below.
    if(i<20)continue;
    const a = S.ring[i], b = S.ring[(i + 1) % S.ring.length];
    const ua = panoramaLocal(...a as [number, number])[0], ub = panoramaLocal(...b as [number, number])[0];
    if (Math.min(ua, ub) > 101.1) wall(a, b, P.entranceSoffitY, P.hallTopY, CHARCOAL);
    else if (Math.max(ua, ub) > 101.1) {
      const t = (101.1 - ua) / (ub - ua), cut = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      wall(ua < 101.1 ? a : cut, ua < 101.1 ? cut : b, P.baseY, P.hallTopY, CHARCOAL);
      wall(ua < 101.1 ? cut : a, ua < 101.1 ? b : cut, P.entranceSoffitY, P.hallTopY, CHARCOAL);
    } else wall(a, b, P.baseY, P.hallTopY, CHARCOAL);
  }
  roof(S.ring, P.hallTopY, 0x707975);
  const rotunda = panoramaRotundaRing();
  for (let i = 0; i < rotunda.length; i++) wall(rotunda[i], rotunda[(i + 1) % rotunda.length], P.baseY, P.rotundaTopY, STONE);
  roof(rotunda, P.rotundaTopY, 0xaaa99d);
  // Surface-only native roof courses; no invisible volume fill or smooth cylinder.
  if (native) for (let x = 1452; x < 1555; x += 1.8) for (let z = -209; z < -142; z += 1.8) {
    const radius = Math.hypot(x - P.centre[0], z - P.centre[1]);
    if (radius < S.rotunda_fit.radius_m - .2) box([x, P.rotundaTopY - .15, z], [1.8, .3, 1.8], 0xaaa99d);
    else if (panoramaContains(x, z)) box([x, P.hallTopY - .15, z], [1.8, .3, 1.8], 0x707975);
  }
  // Restrained panel seams and thin top cap follow the measured OSM drum arc.
  for (let i = 0; i < rotunda.length; i++) {
    const a = rotunda[i], b = rotunda[(i + 1) % rotunda.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    // Keep fine seams clear of both the source plane and the thicker native skin.
    // Centring them on that plane made the global contour pass produce scattered ink.
    const offset = native ? .18 : .08, ax = a[0] - P.centre[0], az = a[1] - P.centre[1], ar = Math.hypot(ax, az);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, nx = (b[1] - a[1]) / l, nz = (a[0] - b[0]) / l;
    const outward = (mx - P.centre[0]) * nx + (mz - P.centre[1]) * nz > 0 ? offset : -offset;
    box([a[0] + ax / ar * offset, (P.hallTopY + P.rotundaTopY) / 2, a[1] + az / ar * offset], [.04, P.rotundaTopY - P.hallTopY, .04], JOINT);
    for (const y of [17.5, 21.5, 25.5, 29.5, 33.5, 37.35]) box([mx + nx * outward, y, mz + nz * outward], [l + .015, y > 37 ? .16 : .025, .04], JOINT, yaw);
  }
  // Glazed east end, deep entrance shadow, four support posts and seven real treads.
  localBox(108.06, 10.55, 0, .14, 3.85, 14.05, GLASS);
  for (let v = -6.9; v <= 7; v += 2.3) localBox(108.15, 10.55, v, .17, 4, .07, CHARCOAL);
  localBox(101.15, 7.25, 0, .16, 2.6, 14.15, GLASS);
  for (const v of [-6.5, -2.2, 2.2, 6.5]) localBox(107.45, 7.3, v, .3, 2.7, .3, 0xc6c8bb);
  localBox(104.6, 5.87, 0, 7.2, .16, 14.2, 0xc4bca9);
  localBox(104.6, 8.58, 0, 7.2, .16, 14.2, 0x4f5856);
  for (let i = 0; i < 7; i++) localBox(111.9 - i * .6, 4.9 + (i + 1) * .075, 0, .615, (i + 1) * .15, 13.8, 0xbcb8a8);
  for (let i = 0; i < 31; i++) localBox(2 + i * 3.45, 9.6, 7.3, .035, 8.4, .04, 0x566062);
  for (const y of [7.3, 9.9, 12.5]) localBox(54, y, 7.3, 106, .03, .04, 0x566062);
  if (!native) {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    const mesh = new Mesh(g); attach(mesh); mesh.name = 'Full Panorama source perimeter and retained rotunda arc'; root.add(mesh);
  }
  const g = new BoxGeometry(); g.deleteAttribute('uv'); const mesh = new InstancedMesh(g, new MeshBasicMaterial(), 0), matrices = new Float32Array(rows.length * 16), paints = new Float32Array(rows.length * 3), m = new Matrix4(), q = new Quaternion();
  rows.forEach((r, i) => { m.compose(new Vector3(...r.p), q.setFromAxisAngle(new Vector3(0, 1, 0), r.yaw), new Vector3(...r.s)); matrices.set(m.elements, i * 16); color.setHex(r.color).toArray(paints, i * 3); });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(paints, 3); mesh.count = rows.length; attach(mesh); mesh.name = native ? 'Panorama one native block batch' : 'Panorama panel seams and entry fittings'; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  return freezeStaticSceneTransforms(root);
}
export function createMinecraftPergamonPanoramaV202(options: { mobileLike?: boolean } = {}): Group {
  return createPergamonPanoramaV202({ ...options, minecraft: true });
}

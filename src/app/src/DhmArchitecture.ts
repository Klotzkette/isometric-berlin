import {
  BoxGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { appendVoxelEnvelope, sourceMesh, type SourceEnvelopeBlock } from "./BebelplatzBuildingShells";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import {
  DHM_SOURCE as source, DHM_PROFILE as P, DHM_GROUP_NAME, MINECRAFT_DHM_GROUP_NAME,
  DHM_GLASS_PART_IDS, dhmSpiralTread,
} from "./dhmProfile";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type Axis = readonly [readonly [number, number], readonly [number, number]];
type Instance = { p: Point; s: Point; color: number; q?: Quaternion };
const UP = new Vector3(0, 1, 0);
const STONE = 0xc9bca5, LIGHT = 0xe0d5bc, SHADE = 0xa99b86;
const ROSE = 0xd7b7af, WINDOW = 0x43565b, FRAME = 0x384b4d;
const ZEUGHAUS_TONE = { wall: ROSE, roof: 0x717870, name: "Zeughaus complete baroque envelope" };
const PEI_TONE = { wall: 0xd9ccaf, roof: 0xb9b5a9, name: "Pei complete limestone envelope" };
function length(axis: Axis): number { return Math.hypot(axis[1][0] - axis[0][0], axis[1][1] - axis[0][1]); }
function at(axis: Axis, u: number, y: number, out = 0): Point {
  const dx = axis[1][0] - axis[0][0], dz = axis[1][1] - axis[0][1], l = length(axis);
  return [axis[0][0] + (dx * u - dz * out) / l, y, axis[0][1] + (dz * u + dx * out) / l];
}

function transparent(mesh: Mesh): void {
  const day = new MeshBasicMaterial({ color: 0xbddce1, transparent: true,
    opacity: P.glassOpacity, side: DoubleSide, depthWrite: false });
  const night = new MeshStandardMaterial({ color: 0x9ecbd0, transparent: true,
    opacity: P.glassOpacity, side: DoubleSide, depthWrite: false, roughness: 0.22,
    emissive: 0x527878, emissiveIntensity: 0.18 });
  mesh.material = day;
  mesh.userData = { ...mesh.userData, dayMaterial: day, nightMaterial: night,
    textureFree: true, transparentArchitecture: true };
}

/** Retain source glass outer envelopes, opening the lower shared cylinder overlap. */
function glassDisplayPart(part: BebelplatzSourcePart): BebelplatzSourcePart {
  if (part.id !== "DEBE3De1XccDSz8G") return part;
  return { ...part, ground_y_m: 18.453, surfaces: part.surfaces.map(s => ({ ...s,
    rings: s.rings.map(r => r.map(([x, y, z]) => [x, Math.max(18.453, y), z])) })) };
}

/** All eleven retained source parts plus source-bound code-built recognition detail. */
export function createDhmArchitecture(minecraft = false): Group {
  const root = new Group(); root.name = minecraft ? MINECRAFT_DHM_GROUP_NAME : DHM_GROUP_NAME;
  root.userData = { textureFree: true, keepInMinecraft: minecraft, blockNative: minecraft,
    originalSourceRetained: true, sourcePartCount: P.sourcePartCount, hiddenSolidInfill: false,
    spiralTreadCount: P.spiralTreadCount, courtyardOpenBelowRoof: true };
  const items: Instance[] = [], glass: Instance[] = [];
  const box = (p: Point, s: Point, color: number, yaw = 0, target = items) => {
    if (!minecraft || Math.abs(yaw) < 1e-5) {
      target.push({ p, s, color, q: new Quaternion().setFromAxisAngle(UP, yaw) }); return;
    }
    const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
    // Block-local courses preserve the real bearing without giant enclosing AABBs.
    const n = Math.max(1, Math.ceil(s[0] / 1.3));
    for (let i = 0; i < n; i++) {
      const u = -s[0] / 2 + (i + .5) * s[0] / n;
      target.push({ p: [p[0] + Math.cos(yaw) * u, p[1], p[2] - Math.sin(yaw) * u],
        s: [Math.max(.09, s[0] / n * c + s[2] * sn), s[1], Math.max(.09, s[0] / n * sn + s[2] * c)], color });
    }
  };
  const beam = (a: Point, b: Point, width: number, color: number) => {
    const delta = new Vector3(...b).sub(new Vector3(...a)), len = delta.length();
    if (minecraft) {
      const n = Math.ceil(len / .9);
      for (let i = 0; i < n; i++) box(a.map((v, k) => v + (b[k] - v) * (i + .5) / n) as Point,
        [Math.max(width, Math.abs(delta.x) / n), Math.max(width, Math.abs(delta.y) / n), Math.max(width, Math.abs(delta.z) / n)], color);
    } else items.push({ p: a.map((v, k) => (v + b[k]) / 2) as Point, s: [width, len, width], color,
      q: new Quaternion().setFromUnitVectors(UP, delta.multiplyScalar(1 / len)) });
  };
  const facadeFrames = new Map<Axis, number[][]>();
  const frontDepth = (axis: Axis, u: number): number => {
    const dx = axis[1][0] - axis[0][0], dz = axis[1][1] - axis[0][1], l = length(axis);
    let ring = facadeFrames.get(axis);
    if (!ring) {
      ring = source.profiles.zeughaus.parts[0].ring.map(([x, z]) =>
        [((x - axis[0][0]) * dx + (z - axis[0][1]) * dz) / l,
          (-(x - axis[0][0]) * dz + (z - axis[0][1]) * dx) / l]);
      facadeFrames.set(axis, ring);
    }
    let depth = -Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (u < Math.min(a[0], b[0]) - .001 || u > Math.max(a[0], b[0]) + .001) continue;
      const t = Math.abs(b[0] - a[0]) < .001 ? 0 : (u - a[0]) / (b[0] - a[0]);
      depth = Math.max(depth, a[1] + (b[1] - a[1]) * t);
    }
    return Number.isFinite(depth) ? depth : 0;
  };
  const facade = (axis: Axis, u: number, y: number, out: number, s: Point, color: number) => {
    const depth = length(axis) > 80 && s[0] <= 6 ? Math.max(frontDepth(axis, u), frontDepth(axis, u - Math.min(1.8, s[0] / 2)), frontDepth(axis, u + Math.min(1.8, s[0] / 2))) : 0;
    box(at(axis, u, y, out + depth), s, color, -Math.atan2(axis[1][1] - axis[0][1], axis[1][0] - axis[0][0]));
  };
  const opaqueParts = [source.profiles.zeughaus.parts[0],
    ...source.profiles.pei.parts.filter(p => !DHM_GLASS_PART_IDS.has(p.id))];
  if (minecraft) {
    const blocks: SourceEnvelopeBlock[] = [];
    opaqueParts.forEach(p => appendVoxelEnvelope(p, p.id === source.profiles.zeughaus.parent_id ? ZEUGHAUS_TONE : PEI_TONE, blocks));
    blocks.forEach(b => box(b.position, b.size, b.color));
  } else {
    root.add(sourceMesh(source.profiles.zeughaus.parts, ZEUGHAUS_TONE));
    root.add(sourceMesh(source.profiles.pei.parts.filter(p => !DHM_GLASS_PART_IDS.has(p.id)), PEI_TONE));
  }

  // Transparent source foyer and spiral cylinder keep exact measured roof levels.
  for (const original of source.profiles.pei.parts.filter(p => DHM_GLASS_PART_IDS.has(p.id))) {
    const part = glassDisplayPart(original);
    if (!minecraft) {
      const mesh = sourceMesh([part], { wall: 0xffffff, roof: 0xffffff, name: "Pei clear glass foyer and spiral cylinder" });
      transparent(mesh); root.add(mesh);
    } else {
      // Thin native translucent perimeter courses, with a visible stepped helix inside.
      for (let i = 0; i < part.ring.length; i++) {
        const a = part.ring[i], b = part.ring[(i + 1) % part.ring.length];
        const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 1.4));
        for (let j = 0; j < n; j++) {
          const x = a[0] + (b[0] - a[0]) * (j + .5) / n, z = a[1] + (b[1] - a[1]) * (j + .5) / n;
          const base = Math.max(5.2, part.ground_y_m), top = part.top_y_m;
          box([x, (base + top) / 2, z], [Math.max(.12, Math.abs(b[0] - a[0]) / n), top - base,
            Math.max(.12, Math.abs(b[1] - a[1]) / n)], 0xc1dbe0, 0, glass);
        }
      }
    }
    // Source-aligned frame rails: one member per measured curve chord.
    for (let i = 0; i < part.ring.length; i++) {
      const a = part.ring[i], b = part.ring[(i + 1) % part.ring.length];
      for (const y of part.id === "DEBE3De1XccDSz8G" ? [18.453, 22.649] : [5.28, 11.2, 18.453])
        beam([a[0], y, a[1]], [b[0], y, b[1]], .105, FRAME);
      if (i % (part.id === "DEBE3De1XccDSz8G" ? 5 : 4) === 0)
        beam([a[0], Math.max(5.2, part.ground_y_m), a[1]], [a[0], part.top_y_m, a[1]], .11, FRAME);
    }
  }

  // A visibly winding stair ribbon: solid treads plus separate steel inner/outer rails.
  const count = P.spiralTreadCount;
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count, p = dhmSpiralTread(t), next = dhmSpiralTread(Math.min(1, (i + 1.5) / count));
    const depth = (P.spiralRadius + P.spiralInnerRadius) / 2 * Math.PI * 2 * P.spiralTurns / count * 1.12;
    box([p.x, p.y, p.z], [P.spiralRadius - P.spiralInnerRadius, .18, depth], 0x7e9699, -p.angle);
    for (const r of [P.spiralInnerRadius, P.spiralRadius]) {
      const a: Point = [P.spiralCenter[0] + r * Math.cos(p.angle), p.y + .98, P.spiralCenter[1] + r * Math.sin(p.angle)];
      const b: Point = [P.spiralCenter[0] + r * Math.cos(next.angle), next.y + .98, P.spiralCenter[1] + r * Math.sin(next.angle)];
      beam(a, b, .085, FRAME);
      if (i % 4 === 0) beam([a[0], p.y, a[2]], a, .065, FRAME);
    }
  }
  // The structural tree is visibly open; its tilted steel legs never fill the glass.
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    beam([P.spiralCenter[0] + 2 * Math.cos(a), 5.2, P.spiralCenter[1] + 2 * Math.sin(a)],
      [P.spiralCenter[0], 22.1, P.spiralCenter[1]], .15, FRAME);
  }

  // The Schlüterhof is a real courtyard beneath a separate, clear source roof.
  const canopy = source.profiles.courtyardRoof.parts[0];
  const roofOnly = { ...canopy, surfaces: canopy.surfaces.filter(s => s.kind === "RoofSurface") };
  if (!minecraft) { const mesh = sourceMesh([roofOnly], { wall: 0xffffff, roof: 0xffffff, name: "Schlüterhof clear source roof" }); transparent(mesh); root.add(mesh); }
  else for (let x = 1706; x <= 1752; x += 2) for (let z = 104; z <= 150; z += 2) {
    if (!bebelplatzPartContains(canopy, x, z)) continue;
    const y = bebelplatzPartRoofAt(canopy, x, z); if (y !== null) box([x, y, z], [2, .14, 2], 0xc1dbe0, 0, glass);
  }
  // Steel grid samples retained source roof heights rather than a flat replacement.
  for (const swap of [false, true]) for (let u = 1708; u < 1753; u += 3.3) {
    let previous: Point | null = null;
    for (let v = 104; v <= 151; v += 2) {
      const x = swap ? 1706 + v - 104 : u, z = swap ? 104 + u - 1708 : v;
      const y = bebelplatzPartRoofAt(canopy, x, z);
      if (y === null) { previous = null; continue; }
      const point: Point = [x, y + .04, z]; if (previous) beam(previous, point, .1, FRAME); previous = point;
    }
  }

  // Rose-plaster baroque elevation, two levels, rustication and alternating hoods.
  const front = P.frontAxis, width = length(front);
  const axes: Axis[] = [front, [[1777.612, 168.041], [1769.607, 79.008]],
    [[1769.607, 79.008], [1680.43, 86.744]], [[1680.43, 86.744], [1688.464, 175.768]]];
  for (const axis of axes) {
    const w = length(axis), bays = 17;
    for (const y of [5.65, 11.85, 12.18, 21.43, 21.78, 22.13]) facade(axis, w / 2, y, .4, [w + .2, .24, .65], STONE);
    for (let course = 0; course < 8; course++) facade(axis, w / 2, 6 + course * .72, .09, [w, .065, .12], SHADE);
    for (let bay = 0; bay < bays; bay++) {
      const u = (bay + .5) * w / bays;
      for (const y of [8.4, 16.25]) {
        facade(axis, u, y, .09, [2.85, y < 10 ? 4.0 : 5.15, .15], WINDOW);
        for (const side of [-1, 1]) facade(axis, u + side * 1.59, y, .32, [.22, y < 10 ? 4.15 : 5.55, .46], LIGHT);
        facade(axis, u, y - (y < 10 ? 2.12 : 2.8), .38, [3.35, .18, .58], STONE);
        facade(axis, u, y, .3, [.11, y < 10 ? 3.9 : 5.0, .1], FRAME);
        for (const dy of [-1.25, .1, 1.4]) facade(axis, u, y + dy, .3, [2.8, .085, .1], FRAME);
      }
      // Curved lower arches and alternating triangular/segmental upper hoods.
      for (let j = 0; j < 12; j++) {
        const a = Math.PI * j / 11;
        facade(axis, u + Math.cos(a) * 1.45, 10.1 + Math.sin(a) * 1.42, .38, [.3, .28, .38], STONE);
        const hy = bay % 2 ? Math.sin(a) * .8 : (1 - Math.abs(j / 11 * 2 - 1)) * .85;
        facade(axis, u + (j / 11 * 2 - 1) * 1.7, 19.18 + hy, .38, [.34, .18, .46], LIGHT);
      }
      // Keystone/trophy silhouette is procedural, not a copied sculptural scan.
      facade(axis, u, 11.2, .54, [.48, .72, .48], STONE);
      facade(axis, u, 24.05, .2, [1.2, .5, 1.1], STONE);
      facade(axis, u, 25, .2, [.62, 1.42, .65], LIGHT);
      for (const side of [-1, 1]) facade(axis, u + side * .42, 24.8, .22, [.35, .75, .35], SHADE);
      if (bay < bays - 1) for (let k = 1; k <= 4; k++)
        facade(axis, u + (k * w / bays) / 5, 23.2, .2, [.18, 1.16, .25], LIGHT);
    }
    facade(axis, w / 2, 23.86, .2, [w, .2, .5], LIGHT);
  }
  // The south portal's four engaged columns and low pediment sit on the real front.
  const center = width / 2;
  for (const u of [center - 8.2, center - 4.9, center + 4.9, center + 8.2]) {
    facade(front, u, 16.3, .95, [.85, 8, .85], STONE);
    for (const y of [12.28, 20.35]) facade(front, u, y, .95, [1.18, .38, 1.12], LIGHT);
  }
  for (let i = 0; i < 50; i++) {
    const f = (i + .5) / 50, u = center - 10 + 20 * f, y = 22.8 + 3.2 * (1 - Math.abs(f * 2 - 1));
    facade(front, u, (22.4 + y) / 2, .45, [.43, y - 22.4, .42], STONE);
    facade(front, u, y + .14, .76, [.47, .2, .66], LIGHT);
  }
  // Recessed portal, warm stone crest and relief figures establish the centre.
  facade(front, center, 8.0, .34, [3.4, 5.4, .28], 0x39352e);
  facade(front, center, 15.0, .65, [2.1, 2.55, .45], STONE);
  facade(front, center, 15.2, .94, [1.1, 1.55, .18], 0xa99b56);
  for (const u of [center - 7, center - 3.7, center + 3.7, center + 7]) {
    facade(front, u, 5.72, 1.2, [1.6, .45, 1.4], STONE);
    facade(front, u, 7.3, 1.2, [.8, 2.8, .7], LIGHT);
    facade(front, u, 8.9, 1.2, [.57, .6, .55], STONE);
  }
  // Bounded coursing of the curved western limestone wall; unchanged source bearing.
  const limestone = source.profiles.pei.parts[0];
  for (let i = 0; i < 23; i++) {
    const a = limestone.ring[i], b = limestone.ring[i + 1];
    const axis: Axis = [[a[0], a[1]], [b[0], b[1]]]; const w = length(axis);
    for (let y = 6; y < 21.3; y += .75) facade(axis, w / 2, y, .03, [w, .035, .045], 0xc0b59b);
  }

  const addBatch = (instances: Instance[], isGlass: boolean) => {
    if (!instances.length) return;
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xffffff });
    const mesh = new InstancedMesh(geometry, day, instances.length), matrix = new Matrix4(), color = new Color(), q = new Quaternion();
    instances.forEach((b, i) => { matrix.compose(new Vector3(...b.p), b.q ?? q.identity(), new Vector3(...b.s));
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, color.setHex(b.color)); });
    mesh.name = isGlass ? "DHM native clear glazing" : "DHM baroque facade, steel framing and helical stair treads";
    mesh.userData = { textureFree: true, dayMaterial: day,
      nightMaterial: new MeshStandardMaterial({ color: 0xffffff, roughness: .78 }),
      spiralTreadCount: count, blockNative: minecraft };
    if (isGlass) transparent(mesh);
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  };
  addBatch(items, false); addBatch(glass, true);
  return freezeStaticSceneTransforms(root);
}

export function createMinecraftDhmArchitecture(): Group { return createDhmArchitecture(true); }

import { Group, InstancedMesh, Matrix4, Color, BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import data from './data/berlinHistoricCoreV288.json';
import { sourceMesh } from './BebelplatzBuildingShells';
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from './bebelplatzBuildingProfile';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';
import court from './data/littenInstanzV257.json';
import { littenInstanzV257Rows } from './littenInstanzV257';
import { berlinKlosterruineRowsV288 } from './BerlinKlosterruineV288';

type Part = BebelplatzSourcePart;
type Row = number[];
type Profile = typeof data.profiles[number];
const domProfiles = () => data.profiles.slice(0, 3);
const STONE = 0xd3c9b6, GLASS = 0x557b82, FRAME = 0xb3aa96, IRON = 0x343d3d;
export { BERLIN_HISTORIC_DOM_V288_IDS } from './BerlinHistoricCoreV288Ownership';
export const berlinHistoricDomPartsV288 = (): Part[] => domProfiles().flatMap(p => p.parts);
export const berlinHistoricDomRemaindersV288 = (): Part[] => data.domLegacyRemainderParts;
export const BERLIN_HISTORIC_CORE_V288_EVIDENCE = data.references;

function contains(parts: Part[], x: number, y: number, z: number): boolean {
  return parts.some(p => y >= p.ground_y_m - .001 && (bebelplatzPartRoofAt(p, x, z) ?? -Infinity) >= y - .001);
}
function pointIn(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
type Face = { part: Part; surface: number; a: number[]; u: number[]; n: number[]; length: number; low: number; high: number; rings: number[][][] };
function faces(profile: Profile): Face[] {
  const result: Face[] = [];
  for (const part of profile.parts) part.surfaces.forEach((s, surface) => {
    if (s.kind !== 'WallSurface') return;
    const ring = s.rings[0];
    let edge: number[][] | undefined, length = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (Math.abs(a[1] - b[1]) < .08 && d > length) { edge = [a, b]; length = d; }
    }
    if (!edge || length < 4) return;
    const a = edge[0], b = edge[1], u = [(b[0] - a[0]) / length, (b[2] - a[2]) / length];
    let n = [-u[1], u[0]];
    const low = Math.min(...ring.map(p => p[1])), high = Math.max(...ring.map(p => p[1]));
    const x = (a[0] + b[0]) / 2, z = (a[2] + b[2]) / 2, y = Math.min(high - .2, low + 1);
    if (contains(profile.parts, x + n[0] * .2, y, z + n[1] * .2)) n = [-n[0], -n[1]];
    result.push({ part, surface, a, u, n, length, low, high,
      rings: s.rings.map(r => r.map(p => [(p[0] - a[0]) * u[0] + (p[2] - a[2]) * u[1], p[1]])) });
  });
  return result;
}
function faceContains(f: Face, along: number, y: number): boolean {
  return pointIn(along, y, f.rings[0]) && !f.rings.slice(1).some(r => pointIn(along, y, r));
}
function box(rows: Row[], f: Face, along: number, y: number, w: number, h: number, d: number, color: number, offset = .09): void {
  rows.push([f.a[0] + f.u[0] * along + f.n[0] * offset, y,
    f.a[2] + f.u[1] * along + f.n[1] * offset, w, h, d, -Math.atan2(f.u[1], f.u[0]), color]);
}
/** Bounds and exposure belong to the actual source sheet; bay spacing is an estimate. */
function facadeRows(profile: Profile): Row[] {
  const rows: Row[] = [], seen = new Set<string>();
  for (const f of faces(profile)) {
    if (f.high - f.low < 7) continue;
    const pitch = profile.id === 'voltair' ? 1.85 : profile.id === 'klostergaerten' ? 3.25 : profile.id === 'voltaireHotel' ? 3.65 : 3.8;
    const columns = Math.floor((f.length - 1) / pitch), step = (f.length - .8) / Math.max(1, columns);
    for (let c = 0; c < columns; c++) for (let y = f.part.ground_y_m + 2.5; y < Math.min(28, f.high - 1.1); y += 3.4) {
      const s = .4 + (c + .5) * step, w = Math.min(2.1, step - (profile.id === 'voltair' ? .16 : .75)), h = profile.id === 'voltair' ? 2.85 : 2.35;
      if (![-1, 1].every(dx => [-1, 1].every(dy => faceContains(f, s + dx * (w / 2 + .12), y + dy * (h / 2 + .12))))) continue;
      const x = f.a[0] + f.u[0] * s, z = f.a[2] + f.u[1] * s;
      if (contains(profile.parts, x + f.n[0] * .3, y, z + f.n[1] * .3)) continue;
      const key = [Math.round(x * 10), Math.round(y * 10), Math.round(z * 10)].join('/');
      if (seen.has(key)) continue; seen.add(key);
      if (profile.id === 'voltair') {
        // Source-cube silhouette remains untouched. The glazed stress fissure
        // and pale vertical frit are facade recognition, not a carved void.
        const fissure = y > 9.5 && y < 14;
        box(rows, f, s, y, w, h, .08, fissure ? 0x293d42 : 0x91a9ad);
        for (const dx of [-.25, .25]) box(rows, f, s + dx * w, y - .3, .14, 1.55, .07, fissure ? 0x576b6f : 0xd5dcda, .15);
        continue;
      }
      box(rows, f, s, y, w, h, .08, GLASS);
      for (const dx of [-1, 1]) box(rows, f, s + dx * (w / 2 + .06), y, .12, h + .24, .12, FRAME, .13);
      for (const dy of [-1, 1]) box(rows, f, s, y + dy * (h / 2 + .06), w + .24, .12, .12, FRAME, .13);
      box(rows, f, s, y, .065, h, .07, IRON, .15);
      if (profile.id === 'klostergaerten') {
        box(rows, f, s, y - .5, w + .15, .075, .09, IRON, .31);
        for (const dx of [-.4, 0, .4]) box(rows, f, s + dx * w, y - .85, .045, .7, .065, IRON, .31);
      }
    }
  }
  return rows;
}

type Cell = { x: number; z: number; low: number; top: number };
function nativeCells(parts: Part[], cell = 2): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (const p of parts) {
    const minX = Math.min(...p.ring.map(v => v[0])), maxX = Math.max(...p.ring.map(v => v[0]));
    const minZ = Math.min(...p.ring.map(v => v[1])), maxZ = Math.max(...p.ring.map(v => v[1]));
    for (let x = Math.floor(minX / cell) * cell + cell / 2; x < maxX; x += cell) for (let z = Math.floor(minZ / cell) * cell + cell / 2; z < maxZ; z += cell) {
      if (!bebelplatzPartContains(p, x, z)) continue;
      const top = bebelplatzPartRoofAt(p, x, z);
      if (top === null || top <= p.ground_y_m + .05) continue;
      const key = `${x}/${z}`, old = cells.get(key);
      cells.set(key, { x, z, low: Math.min(old?.low ?? Infinity, p.ground_y_m), top: Math.max(old?.top ?? -Infinity, top) });
    }
  }
  return cells;
}
function nativeEnvelopeRows(parts: Part[], cell = 2, fittings = true): Row[] {
  const cells = nativeCells(parts, cell), rows: Row[] = [];
  for (const c of cells.values()) {
    const roof = Math.min(.55, c.top - c.low);
    rows.push([c.x, c.top - roof / 2, c.z, cell, roof, cell, 0, GLASS]);
    if (c.top > 29 && fittings) {
      if (Math.round(c.x - 1) % 4 === 0) rows.push([c.x, c.top + .045, c.z, .08, .08, cell, 0, 0xaab8b5]);
      if (Math.round(c.z - 1) % 4 === 0) rows.push([c.x, c.top + .045, c.z, cell, .08, .08, 0, 0xaab8b5]);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const neighbor = cells.get(`${c.x + dx * cell}/${c.z + dz * cell}`);
      const low = Math.max(c.low, neighbor?.top ?? c.low), top = c.top - roof;
      if (top <= low + .08) continue;
      const courses = Math.ceil((top - low) / 3.4), h = (top - low) / courses;
      for (let i = 0; i < courses; i++) {
        const y = low + (i + .5) * h;
        rows.push([c.x + dx * (cell / 2 - .16), y, c.z + dz * (cell / 2 - .16), dx ? .32 : cell, h, dz ? .32 : cell, 0, STONE]);
        if (fittings && i > 0 && h > 1.7 && c.top > 10) {
          // The pane is outside the retained independent cardinal wall, never hidden inside it.
          rows.push([c.x + dx * (cell / 2 + .055), y, c.z + dz * (cell / 2 + .055), dx ? .08 : 1.32, Math.min(2.1, h - .6), dz ? .08 : 1.32, 0, GLASS]);
        }
      }
    }
  }
  return rows;
}
function batch(rows: Row[], native: boolean, name: string): InstancedMesh {
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute('uv');
  const day = new MeshBasicMaterial({ color: 0xffffff });
  const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .85, flatShading: true });
  const mesh = new InstancedMesh(geometry, day, rows.length), m = new Matrix4(), v = new Vector3(), color = new Color();
  rows.forEach(([x, y, z, w, h, d, yaw, tone], i) => { m.makeRotationY(yaw).scale(v.set(w, h, d)).setPosition(x, y, z); mesh.setMatrixAt(i, m); mesh.setColorAt(i, color.setHex(tone)); });
  mesh.name = name; mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, blockNative: native, keepInMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

function roofFrames(): InstancedMesh {
  const edges = new Map<string, number[][]>();
  for (const profile of domProfiles().slice(0, 2)) for (const p of profile.parts) for (const s of p.surfaces) {
    if (s.kind !== 'RoofSurface' || Math.min(...s.rings[0].map(v => v[1])) < 26) continue;
    for (const ring of s.rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (Math.hypot(...a.map((v, j) => v - b[j])) < .25) continue;
      const key = [a.join('/'), b.join('/')].sort().join('|'); edges.set(key, [a, b]);
    }
  }
  const mesh = batch(Array.from(edges.values()).map(() => [0, 0, 0, 1, 1, 1, 0, 0xaab8b5]), false, 'Thin estimated steel sections on exact sloping glass-roof edges');
  const from = new Vector3(), to = new Vector3(), direction = new Vector3(), up = new Vector3(0, 1, 0), q = new Quaternion(), m = new Matrix4();
  Array.from(edges.values()).forEach(([a, b], i) => {
    from.set(...a as [number, number, number]); to.set(...b as [number, number, number]); direction.subVectors(to, from);
    const length = direction.length(); q.setFromUnitVectors(up, direction.normalize());
    m.compose(from.add(to).multiplyScalar(.5).add(new Vector3(0, .055, 0)), q, new Vector3(.075, length, .075)); mesh.setMatrixAt(i, m);
  });
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

type CompleteReceipt = { children: Mesh[]; buffers: { array: ArrayBufferView; hash: number }[]; counts: number[]; materials: unknown[]; matrices: number[][]; native: boolean };
const complete = new WeakMap<Group, CompleteReceipt>();
function hash(array: ArrayBufferView): number {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength); let value = 2166136261;
  for (const b of bytes) value = Math.imul(value ^ b, 16777619);
  return value >>> 0;
}
function arrays(children: Mesh[]): ArrayBufferView[] {
  const result: ArrayBufferView[] = [];
  for (const child of children) {
    for (const a of Object.values(child.geometry.attributes)) result.push(a.array);
    if (child.geometry.index) result.push(child.geometry.index.array);
    if (child instanceof InstancedMesh) {
      result.push(child.instanceMatrix.array);
      if (child.instanceColor) result.push(child.instanceColor.array);
    }
  }
  return result;
}
function remember(root: Group, native: boolean): void {
  const children = root.children as Mesh[], buffers = arrays(children).map(array => ({ array, hash: hash(array) }));
  complete.set(root, { children: [...children], buffers, counts: children.map(c => c instanceof InstancedMesh ? c.count : c.geometry.getAttribute('position').count), materials: children.map(c => c.material), matrices: [root, ...children].map(o => [...o.matrix.elements]), native });
}

/** Factory provenance plus actual live geometry. A clone, missing batch, changed
 * buffer/count/material or foreign child cannot retire any original owner. */
export function hasCompleteBerlinHistoricDomV288(value: unknown): value is Group {
  try {
    if (!(value instanceof Group)) return false;
    const r = complete.get(value); if (!r || !value.visible || value.children.length !== r.children.length) return false;
    for (let i = 0; i < r.children.length; i++) {
      const child = r.children[i];
      if (value.children[i] !== child || child.parent !== value || !child.visible || child.material !== r.materials[i] ||
        (child instanceof InstancedMesh ? child.count : child.geometry.getAttribute('position').count) !== r.counts[i]) return false;
      const material = child.material as MeshBasicMaterial;
      if (material.map || material.opacity !== 1 || material.transparent || material.color.getHex() !== 0xffffff) return false;
    }
    const live = arrays(r.children);
    return live.length === r.buffers.length && live.every((a, i) => a === r.buffers[i].array && hash(a) === r.buffers[i].hash) &&
      [value, ...r.children].every((o, i) => o.matrix.elements.every((v, j) => v === r.matrices[i][j]));
  } catch { return false; }
}

/** Complete three-owner replacement: every measured surface and source court retained. */
export function createBerlinHistoricDomV288(native = false): Group {
  const DOM = domProfiles(), parts = DOM.flatMap(p => p.parts), remainders = data.domLegacyRemainderParts;
  const root = new Group(); root.name = native ? 'Independent orthogonal DomAquarée v288' : 'Complete measured DomAquarée v288';
  root.userData = { sourceParents: DOM.map(p => p.parentId), sourcePartIds: parts.map(p => p.id),
    sourceGeometryUnchanged: true, fullStaticDetailOnTouch: true, textureFree: true, blockNative: native, keepInMinecraft: native,
    estimateStatus: data.estimateStatus, currentAsOf: data.currentAsOf, aquaDomReconstructed: false, sourceSurfaceCount: parts.reduce((n, p) => n + p.surfaces.length, 0) };
  if (native) root.add(batch(nativeEnvelopeRows([...parts, ...remainders]), true, 'Source-roof-aware open courts and cardinal exterior glazing'));
  else {
    // Low terraces/office caps retain a stone tone; the high sloping glass roof
    // is a primary-photo material interpretation. All source vertices stay exact.
    const materialView = DOM.flatMap(profile => profile.parts.map(p => ({ ...p, surfaces: p.surfaces.map(s => ({ ...s,
      kind: s.kind === 'RoofSurface' && (profile.id === 'domOffice' || Math.min(...s.rings[0].map(v => v[1])) < 26) ? 'WallSurface' : s.kind })) })));
    root.add(sourceMesh(materialView, { wall: STONE, roof: GLASS, name: 'DomAquarée complete official source' }));
    root.add(sourceMesh(remainders, { wall: STONE, roof: STONE, name: 'Exact preserved original proxy digitization slivers' }));
    root.add(batch(DOM.flatMap(facadeRows), false, 'Source-clipped stone frames and divided glazing'));
    root.add(roofFrames());
  }
  freezeStaticSceneTransforms(root); remember(root, native); return root;
}

/** Appended to the existing justice family; old v183/v257/v281 members stay first. */
export function berlinHistoricCoreV288Rows(native = false): number[][] {
  const profiles = data.profiles.filter(p => p.id === 'klostergaerten' || p.id === 'voltaireHotel' || p.id === 'voltair');
  if (!native) return [...profiles.flatMap(facadeRows), ...ruinMasonryRows(), ...courtJointRows(), ...berlinKlosterruineRowsV288()];
  return [...data.nativeOuterRows, ...data.nativeRuinRows, ...courtJointRows(true), ...berlinKlosterruineRowsV288(true)];
}

/** Build-time evidence helper: photo-estimated bays on exact retained wall sheets. */
export function berlinHistoricCoreFacadeAnchorsV288(): { profile: string; row: number[] }[] {
  return data.profiles.filter(p => p.id === 'klostergaerten' || p.id === 'voltaireHotel' || p.id === 'voltair').flatMap(p =>
    facadeRows(p).filter(r => [GLASS, 0x293d42, 0x91a9ad].includes(r[7])).map(row => ({ profile: p.id, row })));
}

/** Horizontal mortar courses on the retained steep ruin sheets, including their
 * actual sloping profile. No wall, aperture, complete roof or church is invented. */
function ruinMasonryRows(): number[][] {
  const profile = data.profiles.find(p => p.id === 'ruin')!, rows: number[][] = [];
  for (const part of profile.parts) for (const surface of part.surfaces) {
    if (!['RoofSurface', 'WallSurface'].includes(surface.kind)) continue;
    const ring = surface.rings[0], normal = new Vector3();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      normal.x += (a[1] - b[1]) * (a[2] + b[2]);
      normal.y += (a[2] - b[2]) * (a[0] + b[0]);
      normal.z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    normal.normalize(); if (Math.abs(normal.y) > .75) continue;
    const low = Math.min(...ring.map(p => p[1])), high = Math.max(...ring.map(p => p[1]));
    for (let y = Math.ceil((low + .1) / .38) * .38; y < high - .08; y += .38) {
      const hits: number[][] = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          const t = (y - a[1]) / (b[1] - a[1]); hits.push([a[0] + t * (b[0] - a[0]), a[2] + t * (b[2] - a[2])]);
        }
      }
      if (hits.length !== 2 || surface.rings.length !== 1) continue;
      const [a, b] = hits, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < .12) continue;
      rows.push([(a[0] + b[0]) / 2 + normal.x * .035, y + normal.y * .035,
        (a[1] + b[1]) / 2 + normal.z * .035, length, .035, .055, -Math.atan2(b[1] - a[1], b[0] - a[0]), 0x9d6850]);
    }
  }
  return rows;
}

/** Thin joints on the already authored surviving portal arches. Native joints
 * clad actual existing v257 block exteriors; they are never rotated miniatures. */
function courtJointRows(native = false): number[][] {
  const a = [2831.19, 64.936], b = [2852.527, 100.287], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
  const contour = court.courtFront.map(p => ({ u: (p[0] - a[0]) * ux + (p[1] - a[1]) * uz, p }));
  const nativeArches = native ? littenInstanzV257Rows(true).filter(r => r[6] === 0xd8ceb8 && r[1] > 23 && r[1] < 27) : [];
  const rows: number[][] = [], used = new Set<string>();
  for (const [centre, width] of [[length / 2, 10.4], [7.8, 5.5], [length - 7.8, 5.5]]) for (let i = 1; i < 20; i++) {
    const t = Math.PI * i / 20, u = centre + Math.cos(t) * width / 2, y = 23.4 + Math.sin(t) * 3.1;
    let segment = 1;
    while (segment < contour.length - 1 && contour[segment].u < u) segment++;
    const p = contour[segment - 1], q = contour[segment], d = q.u - p.u;
    if (d <= 1e-6) continue;
    const along = (u - p.u) / d, dx = q.p[0] - p.p[0], dz = q.p[1] - p.p[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
    const x = p.p[0] + dx * along, z = p.p[1] + dz * along;
    if (!native) rows.push([x + nx * .84, y, z + nz * .84, .045 + .15 * Math.abs(Math.cos(t)), .045 + .15 * Math.sin(t), .055, -Math.atan2(dz, dx), 0x857963]);
    else {
      const candidates = nativeArches.filter(r => Math.abs(r[1] - y) < .38 && Math.hypot(r[0] - x - nx * 1.8, r[2] - z - nz * 1.8) < 1.1);
      const r = candidates.sort((v, w) => Math.hypot(v[0] - x - nx * 1.8, v[2] - z - nz * 1.8) - Math.hypot(w[0] - x - nx * 1.8, w[2] - z - nz * 1.8))[0];
      if (!r) continue;
      const axis = Math.abs(nx) > Math.abs(nz) ? 0 : 2, sign = (axis === 0 ? nx : nz) > 0 ? 1 : -1;
      const point = [r[0], r[1], r[2]], size = [.12, .065, .12];
      point[axis] += sign * (r[axis === 0 ? 3 : 5] / 2 + .045); size[axis] = .045;
      const key = point.map(v => v.toFixed(4)).join('/'); if (used.has(key)) continue; used.add(key);
      rows.push([...point, ...size, 0x857963]);
    }
  }
  return rows;
}

export { berlinHistoricDomSolidsV288 } from './BerlinHistoricCoreV288Navigation';

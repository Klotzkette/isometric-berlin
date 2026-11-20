import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial,
} from "three";

/** World metres. Course Y is the top of the rail at each mapped vertex.
 * Width is across the supported deck. The display profile is estimated unless
 * supplied by the individual source. Pier geometry is admitted only with a mapped footprint and fitted vertical limits. */
export interface SteelRailSpanV369 {
  course: readonly (readonly number[])[];
  width: number;
  form: "steel" | "girder" | "truss" | "arch" | "unclassified";
  paint?: number;
  riveted?: boolean;
  /** Distance from deck surface (24 cm below railhead) to existing soffit. */
  deckThickness?: number;
  /** Add a missing rail bed only on a separately evidenced bridge. */
  deck?: boolean;
  /** Mapped XZ edges registered to each course station, left then right.
   * Their endpoints retain the actual skew of the abutment line. */
  edges?: readonly [readonly (readonly number[])[], readonly (readonly number[])[]];
  /** Surveyed rectangular supports, long-axis endpoints in XZ. */
  piers?: readonly { a: readonly number[]; b: readonly number[]; width: number; low: number; high: number }[];
  abutmentBaseY?: readonly [number | null, number | null];
  /** Signed lateral offsets of actual track axes on a new bed, in metres. */
  trackOffsets?: readonly number[];
  gauge?: number;
  /** Side truss or arch rising above rail level, identified by the source. */
  through?: boolean;
  trussHeight?: number;
  /** For a truss only. Use a curved upper chord only with explicit evidence. */
  bow?: boolean;
}

type Point = [number, number, number];
type EdgePair = [readonly number[], readonly number[]];
type Section = { point: Point; nx: number; nz: number; station: number; edges?: EdgePair };
const DECK_TOP = -.24;
const DEFAULT_STEEL = 0x647174;
const BALLAST = 0x888477;
const RAIL_HEAD = 0xa3a6a0;
const SLEEPER = 0x655e52;
export const STEEL_RAIL_MESH_V369 = "Steel railway bridge members v369";

function sections(span: SteelRailSpanV369): Section[] {
  const points: Point[] = [];
  const edges: EdgePair[] = [];
  if (span.edges && span.edges.some(side => side.length !== span.course.length ||
    side.some(p => p.length !== 2 || !p.every(Number.isFinite)))) return [];
  for (const [i, p] of span.course.entries()) {
    if (p.length !== 3 || !p.every(Number.isFinite)) return [];
    const previous = points.at(-1);
    if (!previous || Math.hypot(p[0] - previous[0], p[2] - previous[2]) > .02) {
      points.push([p[0], p[1], p[2]]);
      if (span.edges) edges.push([span.edges[0][i], span.edges[1][i]]);
    }
  }
  if (points.length < 2) return [];
  const normals = points.slice(1).map(([x, , z], i) => {
    const dx = x - points[i][0], dz = z - points[i][2], length = Math.hypot(dx, dz);
    return { x: -dz / length, z: dx / length, length };
  });
  let station = 0;
  return points.map((point, i) => {
    const a = normals[Math.max(0, i - 1)], b = normals[Math.min(i, normals.length - 1)];
    // A miter joins both longitudinal edges at the actual course vertex.
    const denominator = Math.max(1, 1 + a.x * b.x + a.z * b.z);
    if (i) station += a.length;
    return { point, nx: (a.x + b.x) / denominator, nz: (a.z + b.z) / denominator, station, edges: edges[i] };
  });
}

function sample(course: Section[], station: number): Section {
  let lo = 0, hi = course.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (course[mid].station <= station) lo = mid;
    else hi = mid;
  }
  const a = course[lo], b = course[hi];
  const t = (station - a.station) / (b.station - a.station);
  const edge = (side: number) => a.edges![side].map((v, k) => v + t * (b.edges![side][k] - v));
  return {
    point: a.point.map((v, i) => v + t * (b.point[i] - v)) as Point,
    edges: a.edges && b.edges ? [edge(0), edge(1)] : undefined,
    nx: a.nx + t * (b.nx - a.nx), nz: a.nz + t * (b.nz - a.nz), station,
  };
}

function at(s: Section, offset: number, rise: number): Point {
  if (s.edges && offset) {
    const e = s.edges[offset > 0 ? 0 : 1], dx = e[0] - s.point[0], dz = e[1] - s.point[2];
    const projected = (dx * s.nx + dz * s.nz) / Math.hypot(s.nx, s.nz);
    if (Math.abs(projected) > .1) {
      const f = Math.max(0, Math.min(1, offset / projected));
      return [s.point[0] + f * dx, s.point[1] + rise, s.point[2] + f * dz];
    }
  }
  return [s.point[0] + offset * s.nx, s.point[1] + rise, s.point[2] + offset * s.nz];
}

function edgeAt(s: Section, side: number, rise: number): Point {
  const e = s.edges?.[side > 0 ? 0 : 1];
  return e ? [e[0], s.point[1] + rise, e[1]] : at(s, side, rise);
}

/** A face-shaded unit box and one static instance buffer per admitted bank.
 * Native members are axis aligned, thick deck cells are subdivided across
 * their width as well as along the course to keep diagonal approaches open. */
class SteelMembers {
  readonly matrices: number[] = [];
  readonly tones: number[] = [];
  private readonly slabPositions: number[] = [];
  private readonly rivetMatrices: number[] = [];
  private readonly rivetTones: number[] = [];
  private readonly matrix = new Matrix4();

  constructor(readonly native: boolean) {}

  private append(tone: number) {
    this.matrices.push(...this.matrix.elements);
    this.tones.push(tone);
  }

  beam(a: Point, b: Point, width: number, height: number, tone: number) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const planar = Math.hypot(dx, dz), length = Math.hypot(planar, dy);
    if (length < .012) return;
    const sx = planar > 1e-6 ? dz / planar : 1;
    const sz = planar > 1e-6 ? -dx / planar : 0;
    if (!this.native) {
      // Local Y stays vertical on level rails and normal to a rising member.
      this.matrix.set(
        sx * width, dy / length * sz * height, dx, (a[0] + b[0]) / 2,
        0, (dz * sx - dx * sz) / length * height, dy, (a[1] + b[1]) / 2,
        sz * width, -dy / length * sx * height, dz, (a[2] + b[2]) / 2,
        0, 0, 0, 1,
      );
      this.append(tone);
      return;
    }
    // An axis-aligned member on level ground or a vertical post already is
    // a single native block. Otherwise fit bounded cells to its true course.
    const straight = (Math.abs(dx) < .0001 || Math.abs(dz) < .0001) && (Math.abs(dy) < .0001 || planar < .0001);
    const along = straight ? 1 : Math.ceil(Math.max(planar, Math.abs(dy)) / 1.1);
    const across = straight ? 1 : Math.ceil(width / 1.1);
    const ax = Math.abs(dx) / along, ay = Math.abs(dy) / along, az = Math.abs(dz) / along;
    const w = width / across;
    // The second cross-sectional axis must rotate into the horizontal plane
    // for a vertical post, including when that post is a Native block.
    const ux = dy / length * sz, uy = (dz * sx - dx * sz) / length, uz = -dy / length * sx;
    for (let i = 0; i < along; i++) {
      const t = (i + .5) / along;
      for (let j = 0; j < across; j++) {
        const offset = -width / 2 + (j + .5) * w;
        this.matrix.makeScale(ax + Math.abs(sx) * w + Math.abs(ux) * height,
          ay + Math.abs(uy) * height, az + Math.abs(sz) * w + Math.abs(uz) * height);
        this.matrix.setPosition(a[0] + dx * t + sx * offset, a[1] + dy * t, a[2] + dz * t + sz * offset);
        this.append(tone);
      }
    }
  }

  rivet(p: Point, nx: number, nz: number, tone: number) {
    if (this.native) {
      this.matrix.makeScale(.056, .056, .056).setPosition(...p);
      this.append(tone);
      return;
    }
    // Short eight-sided heads stand proud of the outside cover plate.
    this.matrix.set(-nz, nx, 0, p[0], 0, 0, 1, p[1], nx, nz, 0, p[2], 0, 0, 0, 1);
    this.rivetMatrices.push(...this.matrix.elements);
    this.rivetTones.push(tone);
  }

  slab(ring: Point[], thickness: number) {
    if (!this.native) {
      const underside = ring.map(([x, y, z]) => [x, y - thickness, z] as Point);
      const face = (a: Point, b: Point, c: Point, d: Point) => this.slabPositions.push(...a, ...b, ...c, ...a, ...c, ...d);
      face(ring[0], ring[1], ring[2], ring[3]);
      face(underside[3], underside[2], underside[1], underside[0]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        face(ring[i], underside[i], underside[j], ring[j]);
      }
      return;
    }
    // Intersect the true quadrilateral with parallel cardinal scanlines. Each
    // row needs a single box even on a wide, oblique multiple-track viaduct.
    const dx = Math.abs(ring[1][0] - ring[0][0]), dz = Math.abs(ring[1][2] - ring[0][2]);
    const axis = dx >= dz ? 0 : 2, other = 2 - axis;
    const low = Math.min(...ring.map(p => p[axis])), high = Math.max(...ring.map(p => p[axis]));
    for (let cell = Math.floor(low); cell < high; cell++) {
      const a = Math.max(cell, low), b = Math.min(cell + 1, high), mid = (a + b) / 2;
      const hits: { pos: number; y: number }[] = [];
      for (let i = 0; i < 4; i++) {
        const p = ring[i], q = ring[(i + 1) % 4];
        if ((p[axis] > mid) === (q[axis] > mid)) continue;
        const t = (mid - p[axis]) / (q[axis] - p[axis]);
        hits.push({ pos: p[other] + t * (q[other] - p[other]), y: p[1] + t * (q[1] - p[1]) });
      }
      if (hits.length !== 2) continue;
      const run = Math.abs(hits[1].pos - hits[0].pos);
      if (run < .005) continue;
      const across = (hits[0].pos + hits[1].pos) / 2;
      this.matrix.makeScale(axis === 0 ? b - a : run, thickness, axis === 0 ? run : b - a);
      this.matrix.setPosition(axis === 0 ? mid : across, (hits[0].y + hits[1].y - thickness) / 2, axis === 0 ? across : mid);
      this.append(BALLAST);
    }
  }

  finish(): InstancedMesh | null {
    if (!this.tones.length) return null;
    const unit = new BoxGeometry();
    unit.deleteAttribute("uv");
    const shaded: number[] = [], normals = unit.getAttribute("normal");
    for (let i = 0; i < normals.count; i++) {
      const tone = .87 + .11 * normals.getY(i) + .025 * normals.getX(i);
      shaded.push(tone, tone, tone);
    }
    unit.setAttribute("color", new Float32BufferAttribute(shaded, 3));
    const day = new MeshBasicMaterial({ vertexColors: true });
    const night = new MeshStandardMaterial({ vertexColors: true, roughness: .84, metalness: .08 });
    const mesh = new InstancedMesh(unit, this.native ? night : day, this.tones.length);
    mesh.name = STEEL_RAIL_MESH_V369;
    mesh.userData = { dayMaterial: this.native ? night : day, nightMaterial: night, keepInMinecraft: this.native, blockNative: this.native };
    if (this.native) day.dispose();
    mesh.instanceMatrix.array.set(this.matrices);
    const color = new Color();
    for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, color.setHex(this.tones[i]));
    if (this.rivetTones.length) {
      const unitHead = new CylinderGeometry(.023, .031, .025, 8);
      const headDay = new MeshBasicMaterial(), headNight = new MeshStandardMaterial({ roughness: .74, metalness: .15 });
      const heads = new InstancedMesh(unitHead, headDay, this.rivetTones.length);
      heads.name = "Documented riveted bridge joints v369";
      heads.userData = { dayMaterial: headDay, nightMaterial: headNight };
      heads.instanceMatrix.array.set(this.rivetMatrices);
      for (let i = 0; i < heads.count; i++) heads.setColorAt(i, color.setHex(this.rivetTones[i]));
      heads.computeBoundingSphere();
      mesh.add(heads);
    }
    if (this.slabPositions.length) {
      const slab = new BufferGeometry();
      slab.setAttribute("position", new Float32BufferAttribute(this.slabPositions, 3));
      slab.computeVertexNormals();
      const daySlab = new MeshBasicMaterial({ color: BALLAST });
      const nightSlab = new MeshStandardMaterial({ color: BALLAST, roughness: 1 });
      const deck = new Mesh(slab, daySlab);
      deck.name = "Mapped railway bridge decks v369";
      deck.userData = { dayMaterial: daySlab, nightMaterial: nightSlab };
      mesh.add(deck);
    }
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    return mesh;
  }
}

function addSpan(batch: SteelMembers, span: SteelRailSpanV369) {
  if (!Number.isFinite(span.width) || span.width < 1.4) return;
  const course = sections(span);
  if (!course.length) return;
  const length = course.at(-1)!.station;
  const unclassified = span.form === "unclassified";
  const paint = unclassified ? 0x918f84 : span.paint ?? DEFAULT_STEEL;
  const lip = new Color(paint).lerp(new Color(0xc4c8bd), .065).getHex();
  const thickness = span.deckThickness ?? .68;
  if (!Number.isFinite(thickness) || thickness < .12) return;
  const soffit = DECK_TOP - thickness;
  const gauge = span.gauge ?? 1.435;
  if (!Number.isFinite(gauge) || gauge <= 0) return;
  const tracks = (span.trackOffsets ?? []).filter(x => Number.isFinite(x) && Math.abs(x) + gauge / 2 < span.width / 2);
  if (unclassified && (!span.deck || !tracks.length)) return;
  const edge = span.width / 2;
  const girder = span.form === "girder";
  for (let i = 1; i < course.length; i++) {
    const a = course[i - 1], b = course[i];
    if (!unclassified) for (const side of [-edge, edge]) {
      batch.beam(edgeAt(a, side, DECK_TOP - thickness / 2), edgeAt(b, side, DECK_TOP - thickness / 2), .085, thickness, paint);
      batch.beam(edgeAt(a, side, soffit + .025), edgeAt(b, side, soffit + .025), .24, .065, lip);
      batch.beam(edgeAt(a, side, DECK_TOP - .04), edgeAt(b, side, DECK_TOP - .04), .20, .075, lip);
    }
    if (span.deck) {
      batch.slab([edgeAt(a, edge, DECK_TOP), edgeAt(b, edge, DECK_TOP),
        edgeAt(b, -edge, DECK_TOP), edgeAt(a, -edge, DECK_TOP)], unclassified ? thickness : .17);
      for (const offset of tracks) for (const rail of [-gauge / 2, gauge / 2]) {
        batch.beam(at(a, offset + rail, -.067), at(b, offset + rail, -.067), .085, .134, RAIL_HEAD);
      }
    }
  }
  if (span.deck && span.piers) {
    for (const pier of span.piers) {
      if (pier.a.length !== 2 || pier.b.length !== 2 || ![...pier.a, ...pier.b, pier.width, pier.low, pier.high].every(Number.isFinite)
          || pier.width <= 0 || pier.high <= pier.low) continue;
      const y = (pier.high + pier.low) / 2;
      batch.beam([pier.a[0], y, pier.a[1]], [pier.b[0], y, pier.b[1]], pier.width, pier.high - pier.low, paint);
    }
  }
  if (span.deck && span.abutmentBaseY) {
    for (const [i, base] of span.abutmentBaseY.entries()) {
      if (base == null || !Number.isFinite(base)) continue;
      const end = i ? course.at(-1)! : course[0];
      const height = end.point[1] + soffit - base;
      if (height < .12) continue;
      batch.beam(edgeAt(end, -edge, soffit - height / 2), edgeAt(end, edge, soffit - height / 2), .42, height, 0x918f84);
    }
  }
  // A measured deck with unknown construction has no inferred steelwork.
  if (unclassified) return;
  const panels = Math.max(1, Math.round(length / (girder ? 3.4 : 4.5)));
  const frames = Array.from({ length: panels + 1 }, (_, i) => sample(course, length * i / panels));
  for (const [i, frame] of frames.entries()) {
    // A shallow lip is visible under an existing solid deck; a newly spanned
    // opening has a deeper cross-girder connecting the two outside flanges.
    const depth = span.deck ? Math.min(thickness * .65, .65) : .13;
    batch.beam(edgeAt(frame, -edge, soffit + depth / 2 - .06), edgeAt(frame, edge, soffit + depth / 2 - .06), .19, depth, paint);
    if (girder) for (const side of [-edge, edge]) {
      batch.beam(edgeAt(frame, side, soffit + .05), edgeAt(frame, side, DECK_TOP - .05), .22, .14, lip);
    }
    if (span.riveted && i > 0 && i < panels) {
      for (const side of [-edge, edge]) {
        const foot = edgeAt(frame, side, DECK_TOP - thickness / 2);
        const outward = Math.sign(side) / Math.hypot(frame.nx, frame.nz);
        const nx = frame.nx * outward, nz = frame.nz * outward;
        const jointPoint = (along: number, up: number, out: number): Point => [
          foot[0] + along * nz + out * nx, foot[1] + up, foot[2] - along * nx + out * nz,
        ];
        const h = Math.min(.62, thickness * .72);
        batch.beam(jointPoint(-.18, 0, .084), jointPoint(.18, 0, .084), .07, h, paint);
        for (const along of [-.115, .115]) for (const y of [-h / 3, 0, h / 3]) {
          batch.rivet(jointPoint(along, y, .129), nx, nz, lip);
        }
      }
    }
  }
  if (span.deck && tracks.length) {
    const sleepers = Math.floor(length / .7);
    for (let i = 0; i < sleepers; i++) {
      const frame = sample(course, (i + .5) * length / sleepers);
      for (const offset of tracks) {
        const half = Math.min(gauge / 2 + .42, edge - Math.abs(offset) - .06);
        batch.beam(at(frame, offset - half, -.19), at(frame, offset + half, -.19), .18, .1, SLEEPER);
      }
    }
  }
  if (!span.through || !span.trussHeight || !Number.isFinite(span.trussHeight) || span.trussHeight <= .5) return;
  if (span.form !== "truss" && span.form !== "arch") return;
  const rise = span.trussHeight;
  const bays = Math.max(2, Math.round(length / Math.max(3, Math.min(7.5, rise))));
  const sideFrames = Array.from({ length: bays + 1 }, (_, i) => sample(course, length * i / bays));
  const shape = (i: number) => {
    const t = i / bays, arc = 4 * t * (1 - t);
    if (span.form === "arch") return DECK_TOP + arc * rise;
    return DECK_TOP + rise * (span.bow ? .4 + .6 * arc : 1);
  };
  for (const side of [-edge, edge]) {
    for (let i = 0; i <= bays; i++) {
      const frame = sideFrames[i], top = shape(i);
      batch.beam(edgeAt(frame, side, DECK_TOP), edgeAt(frame, side, top), .21, .19, paint);
      if (i === 0) continue;
      const previous = sideFrames[i - 1];
      batch.beam(edgeAt(previous, side, shape(i - 1)), edgeAt(frame, side, top), .31, .24, lip);
      if (span.form === "truss") {
        batch.beam(edgeAt(previous, side, i % 2 ? DECK_TOP : shape(i - 1)), edgeAt(frame, side, i % 2 ? top : DECK_TOP), .16, .18, paint);
      }
    }
  }
}

/** One frustum-culled draw per spatially admitted bank. No per-frame rebuild. */
export function createSteelRailBridgesV369(spans: readonly SteelRailSpanV369[], native = false): InstancedMesh | null {
  const batch = new SteelMembers(native);
  for (const span of spans) addSpan(batch, span);
  return batch.finish();
}

import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, ExtrudeGeometry, Group, InstancedBufferAttribute,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path,
  Quaternion, Shape, ShapeGeometry, Vector2, Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { letteringStrokePaths } from "./drawnLettering";
import { paintGeometry } from "./drawnKit";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { BIKINI_DISPLAY_PARTS, BIKINI_GROUP, BIKINI_NATIVE_GROUP, BIKINI_PROFILE, BIKINI_SOURCE, type BikiniPart as Part } from "./bikiniProfile";

type P = [number, number, number];
type Edge = { a: number[]; b: number[]; length: number; yaw: number; nx: number; nz: number };
const C = { concrete: 0xc7c4b5, cream: 0xdad4bb, sand: 0xb8ad90, amber: 0xaaa080,
  black: 0x303735, white: 0xdadbd1, grey: 0x92968e, gold: 0xa79c7e,
  glass: 0x78918d, blue: 0x648892, dark: 0x374440, roof: 0x848780,
  terrace: 0xb5b3a4, grass: 0x798967, plant: 0x64815a };
const UP = new Vector3(0, 1, 0);
const ground = BIKINI_SOURCE.groundY;

function edges(ring: number[][]): Edge[] {
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring = ring.slice(0, -1);
  let area = 0;
  for (let i = 0; i < ring.length; i++) { const b = ring[(i + 1) % ring.length]; area += ring[i][0] * b[1] - b[0] * ring[i][1]; }
  const sign = area > 0 ? 1 : -1;
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    return length < .015 ? [] : [{ a, b, length, yaw: -Math.atan2(dz, dx), nx: sign * dz / length, nz: -sign * dx / length }];
  });
}
function at(edge: Edge, u: number, y: number, out: number): P {
  const t = u / edge.length;
  return [edge.a[0] + (edge.b[0] - edge.a[0]) * t + edge.nx * out,
    ground + y, edge.a[1] + (edge.b[1] - edge.a[1]) * t + edge.nz * out];
}
function shape(part: Part): Shape {
  const result = new Shape(part.ring.map(([x, z]) => new Vector2(x, -z)));
  for (const hole of part.holes ?? []) result.holes.push(new Path(hole.map(([x, z]) => new Vector2(x, -z))));
  return result;
}
function shell(part: Part, bottom = part.bottom, top = part.top, separateRoof = false): BufferGeometry {
  const planar = top - bottom < .04;
  const roofPart = planar && part.renderRoofHoles.length ? { ...part, holes: [...part.holes, ...part.renderRoofHoles] } : part;
  const geometry = planar
    ? new ShapeGeometry(shape(roofPart))
    : new ExtrudeGeometry(shape(part), { depth: top - bottom, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, ground + bottom, 0);
  const result = geometry.index ? geometry.toNonIndexed() : geometry;
  if (result !== geometry) geometry.dispose();
  if (!planar && (separateRoof || part.renderRoofHoles.length)) {
    // Keep every wall and underside. The single coloured roof surface closes
    // this body; a second concrete cap 12 mm below it flickers at city scale.
    const p = result.getAttribute("position"), kept: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      if ([0, 1, 2].every(j => Math.abs(p.getY(i + j) - (ground + top)) < .001)) continue;
      for (let j = 0; j < 3; j++) kept.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j));
    }
    result.dispose();
    return new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(kept), 3));
  }
  return result;
}

function contains(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function terraceRails(details: Details): void {
  const terrace = BIKINI_SOURCE.parts.find(part => part.id === "364457308")!;
  for (const e of edges(terrace.ring)) {
    if (e.length < 2) continue;
    const divisions = Math.max(1, Math.ceil(e.length / 2));
    const pitch = e.length / divisions;
    for (let i = 0; i < divisions; i++) {
      const u = (i + .5) * pitch, p = at(e, u, 0, -.25);
      const obstructed = BIKINI_SOURCE.parts.some(part => part.id !== terrace.id && part.top > 7.1 &&
        contains(part.ring, p[0], p[2]) && !part.holes.some(h => contains(h, p[0], p[2])));
      const stair = BIKINI_SOURCE.parts.some(part => part.kind === "steps" && contains(part.ring, p[0], p[2]));
      if (obstructed || stair) continue;
      details.face(e, u, 8.03, pitch, .07, C.grey, -.18, .08);
      details.face(e, u - pitch / 2, 7.56, .07, 1.02, C.grey, -.18, .08);
      details.face(e, u, 7.40, pitch, .06, C.grey, -.18, .07);
    }
  }
}

function zooGlazing(details: Details): void {
  // The operator and restoration architect identify the north side as glazed.
  // Use only exposed source edges: neighbouring parts never get glass pasted
  // through them. Frame spacing is a labelled display subdivision.
  for (const part of BIKINI_SOURCE.parts) {
    if (part.top > 10 || part.top < 6 || part.kind === "roof" || part.kind === "steps") continue;
    for (const e of edges(part.ring)) {
      if (e.length < 3 || e.nz > -.25) continue;
      const p = at(e, e.length / 2, 0, .3);
      if (BIKINI_SOURCE.parts.some(other => other.id !== part.id && other.top >= 6 &&
        contains(other.ring, p[0], p[2]) && !other.holes.some(h => contains(h, p[0], p[2])))) continue;
      const bottom = Math.max(.45, part.bottom + .15), top = Math.min(6.65, part.top - .15);
      if (top <= bottom) continue;
      details.face(e, e.length / 2, (top + bottom) / 2, e.length - .12, top - bottom, C.glass, .19, .12);
      const bays = Math.max(1, Math.round(e.length / 3.6));
      for (let i = 0; i <= bays; i++) details.face(e, i * e.length / bays, (top + bottom) / 2, .10, top - bottom, C.grey, .28, .11);
      for (const y of [bottom, top]) details.face(e, e.length / 2, y, e.length, .12, C.grey, .28, .12);
    }
  }
}

class Details {
  matrices: number[] = [];
  colors: number[] = [];
  private matrix = new Matrix4();
  private color = new Color();
  constructor(readonly native: boolean) {}
  box(p: P, size: P, color: number, yaw = 0): void {
    this.matrix.compose(new Vector3(...p), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(...size));
    this.matrices.push(...this.matrix.elements); this.color.setHex(color).toArray(this.colors, this.colors.length);
  }
  face(e: Edge, u: number, y: number, width: number, height: number, color: number, out = .12, depth = .10): void {
    // Minecraft has its own cuboid relief, with no duplicate smooth shell.
    this.box(at(e, u, y, out), [width, height, this.native ? Math.max(.22, depth) : depth], color, e.yaw);
  }
  finish(root: Group): void {
    const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
    const day = new MeshBasicMaterial({ color: 0xffffff });
    const night = new MeshStandardMaterial({ color: 0xffffff, roughness: .84, flatShading: true });
    const mesh = new InstancedMesh(geometry, day, 0);
    mesh.instanceMatrix = new InstancedBufferAttribute(new Float32Array(this.matrices), 16);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.colors), 3);
    mesh.count = this.colors.length / 3; mesh.name = "Bikini window frames, coloured spandrels, steps and lettering";
    mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, nativeMinecraft: this.native };
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
    root.userData.detailInstances = mesh.count;
  }
}

function makeMesh(parts: BufferGeometry[], glass: boolean): Mesh | null {
  if (!parts.length) return null;
  const geometry = mergeGeometries(parts, false)!; parts.forEach(part => part.dispose());
  const common = { vertexColors: true, side: DoubleSide, transparent: glass, opacity: glass ? .30 : 1, depthWrite: !glass };
  const day = new MeshBasicMaterial(common);
  const night = new MeshStandardMaterial({ ...common, roughness: glass ? .38 : .87, flatShading: true });
  const mesh = new Mesh(geometry, day); mesh.name = glass ? "Bikini transparent panorama storeys" : "Bikini complete mapped building parts";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, exactOsmRings: true };
  return mesh;
}

function facade(details: Details, part: Part): void {
  const upper = part.id === BIKINI_PROFILE.upperSlabId;
  for (const edge of edges(part.ring)) {
    if (edge.length < 5) continue;
    const street = edge.nz > .55;
    if (upper) {
      const bayCount = Math.max(1, Math.round(edge.length / BIKINI_PROFILE.facadeBayPitchM));
      const pitch = edge.length / bayCount;
      for (let floor = 0; floor < 3; floor++) {
        const low = 10 + floor * 3;
        const palette = [C.sand, C.black, C.white];
        details.face(edge, edge.length / 2, low + .45, edge.length, .82, street ? palette[floor] : C.grey, .16, .20);
        details.face(edge, edge.length / 2, low + 2.82, edge.length + .05, .16, C.cream, .23, .28);
        for (let bay = 0; bay < bayCount; bay++) {
          const u = (bay + .5) * pitch;
          details.face(edge, u, low + 1.8, pitch - .16, 1.82, street ? C.blue : C.glass, .19);
          // Three slender divisions per structural bay; alternating high sash.
          for (const offset of [-.5, -.27, .27, .5]) details.face(edge, u + pitch * offset, low + 1.8, .085, 1.96, C.gold, .29, .12);
          details.face(edge, u, low + 2.28, pitch * .53, .075, C.white, .31);
          details.face(edge, u, low + .89, pitch - .12, .065, C.gold, .28);
        }
      }
      details.face(edge, edge.length / 2, 19.10, edge.length + .36, .23, C.cream, .1, .6);
    } else if (part.material === "glass") {
      const height = part.top - part.bottom;
      const bays = Math.max(1, Math.ceil(edge.length / (part.id === BIKINI_PROFILE.openStoreyId ? 5.77 : 2.9)));
      for (let i = 0; i <= bays; i++) details.face(edge, i * edge.length / bays, part.bottom + height / 2, .10, height, C.grey, .09);
      for (const y of [part.bottom + .12, part.top - .10]) details.face(edge, edge.length / 2, y, edge.length, .16, C.cream, .13, .22);
    } else if (part.top <= 8 && part.ring.length > 4 && edge.length > 8) {
      // Retain the glass-flecked folded lower walls as fine horizontal reveals.
      for (let y = part.bottom + .8; y < part.top; y += .65) details.face(edge, edge.length / 2, y, edge.length, .065, C.grey, .13, .12);
    }
  }
}

function dottedSign(details: Details, edge: Edge, text: string, width: number, y: number, u: number): void {
  const paths = letteringStrokePaths(text, 1);
  const points = paths.flat(), min = Math.min(...points.map(p => p[0])), max = Math.max(...points.map(p => p[0]));
  const scale = width / (max - min);
  const seen = new Set<string>();
  for (const path of paths) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * scale / .25));
    for (let j = 0; j <= count; j++) {
      const x = u - width / 2 + (a[0] + (b[0] - a[0]) * j / count - min) * scale;
      const h = y + (a[1] + (b[1] - a[1]) * j / count) * scale;
      const key = `${Math.round(x * 40)},${Math.round(h * 40)}`;
      if (seen.has(key)) continue; seen.add(key);
      details.face(edge, x, h, .15, .15, C.white, .31, .20);
    }
  }
}

function nativeShell(details: Details, part: Part): void {
  // Only exposed perimeter sheets and the exact source roof; no solid column
  // volume is allocated. Distinct storeys/pilotis retain their true clearances.
  const height = part.top - part.bottom;
  if (part.kind !== "roof") for (const e of [part.ring, ...part.holes].flatMap(edges)) {
    const nx = Math.max(1, Math.ceil(e.length / 1.5)), ny = Math.max(1, Math.ceil(height / 1.5));
    if (height <= 0) continue;
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) {
      details.face(e, (x + .5) * e.length / nx, part.bottom + (y + .5) * height / ny,
        e.length / nx, height / ny, part.material === "glass" ? C.glass : C.concrete, 0, .28);
    }
  }
}

export function createBikiniBerlin(native = false): Group {
  const root = new Group(); root.name = native ? BIKINI_NATIVE_GROUP : BIKINI_GROUP;
  root.userData = { textureFree: true, nativeMinecraft: native, keepInMinecraft: native,
    sourcePartIds: BIKINI_SOURCE.parts.map(part => part.id), profile: BIKINI_PROFILE,
    noHiddenSolidInfill: true, sourceEnvelopeRetained: true };
  const body: BufferGeometry[] = [], glass: BufferGeometry[] = [], detail = new Details(native);
  for (const part of BIKINI_DISPLAY_PARTS) {
    if (part.kind === "steps") {
      // Mapped stair polygon is sliced along its short axis; no staircase is
      // invented beyond the real outline. The source generator stores slices.
      for (const step of part.steps ?? []) {
        const geometry = shell({ ...part, ring: step.ring, holes: [] }, step.bottom, step.top);
        paintGeometry(geometry, C.concrete); body.push(geometry);
      }
      continue;
    }
    const thinRoof = part.kind === "roof";
    const roofY = part.top;
    const transparent = part.material === "glass" || part.roofMaterial === "glass" && thinRoof;
    if (!native) {
      const geometry = shell(part, thinRoof ? Math.max(part.bottom, part.top - .12) : part.bottom, part.top, !transparent);
      paintGeometry(geometry, transparent ? C.glass : C.concrete);
      (transparent ? glass : body).push(geometry);
    } else nativeShell(detail, part);
    // Separate source roof sheet gives terraces their actual low heights.
    // This structural member's roof is exactly the same polygon and holes as
    // relation-5424774. Its relation supplies the one visible grass surface.
    if ((!transparent || native) && part.id !== "364868139") {
      const geometry = shell(part, roofY + .012, roofY + .012);
      paintGeometry(geometry, part.roofMaterial === "grass" ? C.grass : part.roofMaterial === "glass" ? C.glass : roofY <= 8 ? C.terrace : C.roof);
      body.push(geometry);
    }
    if (!thinRoof) facade(detail, part);
  }
  const slab = BIKINI_SOURCE.parts.find(part => part.id === BIKINI_PROFILE.upperSlabId)!;
  const street = edges(slab.ring).filter(edge => edge.nz > .55 && edge.length > 30).sort((a, b) => b.length - a.length)[0];
  if (street) dottedSign(detail, street, "BIKINI BERLIN", 16, 5.2, street.length * .58);
  terraceRails(detail);
  zooGlazing(detail);
  for (const mesh of [makeMesh(body, false), makeMesh(glass, true)]) if (mesh) root.add(mesh);
  detail.finish(root);
  return freezeStaticSceneTransforms(root);
}

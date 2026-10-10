import {
  BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, ShapeUtils, Vector2,
} from "three";
import source from "./data/uraniaLuetzowV188.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const URANIA_LUETZOW_V188_GROUP = "Urania and Luetzowplatz source refinements v188";
const GROUND = 5.2;
type Rows = number[][];
type Point = readonly number[];

/** Thin members become segmented axis-aligned surface blocks in native mode. */
function put(rows: Rows, native: boolean, x: number, y: number, z: number,
  w: number, h: number, d: number, yaw: number, color: number): void {
  if (!native) { rows.push([x, y, z, w, h, d, yaw, color]); return; }
  const count = Math.max(1, Math.ceil(w / 1.25));
  const tx = Math.cos(yaw), tz = -Math.sin(yaw);
  for (let i = 0; i < count; i++) {
    const u = (i + .5) * w / count - w / 2;
    rows.push([x + tx * u, y, z + tz * u,
      Math.max(.12, Math.abs(tx) * w / count + Math.abs(tz) * d), h,
      Math.max(.12, Math.abs(tz) * w / count + Math.abs(tx) * d), color]);
  }
}

function inside(x: number, z: number, ring: readonly Point[]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function segment(rows: Rows, native: boolean, a: Point, b: Point,
  y: number, height: number, width: number, color: number): void {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < .005) return;
  put(rows, native, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2,
    length, height, width, -Math.atan2(b[1] - a[1], b[0] - a[0]), color);
}

function urania(rows: Rows, native: boolean): void {
  const p = source.urania, ring = p.highRoof.map(v => [v[0], v[2]]);
  const mid = (p.additionFloorY + p.sourceTopY) / 2;
  for (let i = 1; i < ring.length; i++) {
    segment(rows, native, ring[i - 1], ring[i], mid,
      p.sourceTopY - p.additionFloorY, .12, 0x668f9c);
    segment(rows, native, ring[i - 1], ring[i], p.sourceTopY - .04, .08, .17, 0xb8c8c5);
  }
  // Two actual street wall planes of the taller source body; tiny source edges
  // and the complete irregular rear wing stay in the retained evidence/model.
  const faces = [
    { a: [-1650.413, 1940.127], b: [-1636.966, 1905.217], normal: [-.933, -.359] },
    { a: [-1627.003, 1949.136], b: [-1649.59, 1940.444], normal: [-.359, .933] },
  ];
  faces.forEach((face, faceIndex) => {
    const length = Math.hypot(face.b[0] - face.a[0], face.b[1] - face.a[1]);
    const tx = (face.b[0] - face.a[0]) / length, tz = (face.b[1] - face.a[1]) / length;
    const yaw = -Math.atan2(tz, tx), [nx, nz] = face.normal;
    const member = (u: number, y: number, w: number, h: number, d: number, color: number, out = .18) =>
      put(rows, native, face.a[0] + tx * u + nx * out, y, face.a[1] + tz * u + nz * out, w, h, d, yaw, color);
    const bays = Math.round(length / 2.1), pitch = length / bays;
    for (let i = 0; i <= bays; i++) member(i * pitch, 13.5, .065, 12.6, .075, 0x35484a);
    for (let y = 7.3; y < p.sourceTopY - .1; y += 2.08) member(length / 2, y, length, .065, .075, 0x35484a);
    // Slight blue/grey fields explain mirrored glass without a photographic
    // reflection, texture, duplicate solid building or speculative scaffold.
    for (let i = 0; i < bays; i++) for (let j = 0; j < 2; j++) {
      member((i + .5) * pitch, 15.55 + j * 2.08, pitch - .11, 1.97, .035,
        [0x789eaa, 0x87a7ad, 0x65909d][(i + j + faceIndex) % 3], .12);
    }
    if (faceIndex !== 0) return;
    member(length * .44, 16.8, 10.4, 3.4, .20, 0xe5c93f, .34);
    member(length * .44, 15.85, 9.3, 1.1, .12, 0x2d3436, .47);
    for (const path of letteringStrokePaths("URANIA", 1.1)) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .09));
        for (let j = 0; j < count; j++) {
          const t = (j + .5) / count;
          // The source edge runs northwards; street-side reading runs south.
          member(length * .44 - a[0] - (b[0] - a[0]) * t,
            17.15 + a[1] + (b[1] - a[1]) * t, .10, .12, .08, 0x29363a, .49);
        }
      }
    }
  });
  if (native) {
    // Surface-only roof cells; no hidden fill beneath the retained source roof.
    const xs = ring.map(v => v[0]), zs = ring.map(v => v[1]);
    for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++) {
      for (let z = Math.floor(Math.min(...zs)); z < Math.max(...zs); z++) {
        if (inside(x + .5, z + .5, ring)) rows.push([x + .5, p.sourceTopY - .06, z + .5, 1, .12, 1, 0x8a9996]);
      }
    }
  }
}

function garden(rows: Rows, native: boolean): void {
  const basins = source.fountains;
  const dx = basins[2].xz[0] - basins[0].xz[0], dz = basins[2].xz[1] - basins[0].xz[1];
  const yaw = -Math.atan2(dz, dx), tx = Math.cos(yaw), tz = -Math.sin(yaw);
  for (const basin of basins) {
    const [x, z] = basin.xz;
    // Exact source anchor; the 4 m outer size and local rim/jet sections are
    // conservative photograph-based estimates, not a surveyed basin polygon.
    for (const side of [-1, 1]) {
      put(rows, native, x - tz * side * 1.825, GROUND + .32, z + tx * side * 1.825, 4, .56, .35, yaw, 0x8c8d82);
      put(rows, native, x + tx * side * 1.825, GROUND + .32, z + tz * side * 1.825, 3.3, .56, .35, yaw + Math.PI / 2, 0x8c8d82);
    }
    // Native basin water is also composed of small axis-aligned surface cells.
    if (native) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) {
      rows.push([x + tx * u - tz * v, GROUND + .26, z + tz * u + tx * v, 1.1, .06, 1.1, 0x689898]);
    } else put(rows, false, x, GROUND + .26, z, 3.25, .06, 3.25, yaw, 0x689898);
    put(rows, native, x, GROUND + .35, z, .24, .18, .24, 0, 0x69766d);
    put(rows, native, x, GROUND + .87, z, .075, .92, .075, 0, 0xc0d8d3);
  }
  // Retain the actual small lawn-island courses: only narrow edging is added.
  for (const bed of source.beds) for (const polygon of bed.geometry.coordinates) {
    const ring = polygon[0];
    for (let i = 1; i < ring.length; i++) segment(rows, native, ring[i - 1], ring[i], GROUND + .07, .12, .13, 0xb0aea1);
  }
  for (const path of source.paths) {
    const g = path.clippedGeometry;
    const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
    for (const line of lines as number[][][]) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < .1) continue;
      const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
      for (const side of [-1, 1]) {
        const ox = nx * side * path.displayWidthM / 2, oz = nz * side * path.displayWidthM / 2;
        segment(rows, native, [a[0] + ox, a[1] + oz], [b[0] + ox, b[1] + oz], GROUND + .07, .12, .12, 0xb6b2a0);
      }
    }
  }
}

/** Exact original roof buffers, also reused by the complete v206 owner. */
export function createUraniaSourceRoofV188(): Mesh {
  const ring = source.urania.highRoof.slice(0, -1);
  const contour = ring.map(p => new Vector2(p[0], p[2]));
  const indices = ShapeUtils.triangulateShape(contour, []).flatMap(t => [t[0], t[2], t[1]]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(ring.flat(), 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const day = new MeshBasicMaterial({ color: 0x8a9996 });
  const night = new MeshStandardMaterial({ color: 0x8a9996, roughness: .9 });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Urania exact higher official roof ring";
  mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, sourceGeometry: true };
  return mesh;
}

/** Independent local bounds keep both sites cheap to cull; prior owners stay. */
export function createUraniaLuetzowV188(minecraft = false, includeUrania = true): Group {
  const root = new Group();
  root.name = URANIA_LUETZOW_V188_GROUP;
  root.userData = { additiveOnly: true, sourceGeometryRetained: true, textureFree: true,
    nativeMinecraft: minecraft, blockNative: minecraft, keepInMinecraft: minecraft,
    fullStaticDetailOnTouch: true, sourceSha256: source.sourceSha256,
    sourceParentIds: [source.urania.id], basinSourceIds: source.fountains.map(f => f.id),
    sourceStatus: source.displayStatus };
  for (const site of ["urania", "luetzowplatz"]) {
    if (site === "urania" && !includeUrania) continue;
    const rows: Rows = [];
    if (site === "urania") urania(rows, minecraft); else garden(rows, minecraft);
    const mesh = justicePalaceV183Boxes(rows, minecraft);
    mesh.name = site === "urania" ? "Urania measured upper walls, mirror joints and yellow sign" : "Luetzowplatz three mapped basins and source garden edges";
    mesh.userData.site = site;
    root.add(mesh);
  }
  if (!minecraft && includeUrania) root.add(createUraniaSourceRoofV188());
  return freezeStaticSceneTransforms(root);
}

import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Group, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, Path, Shape, ShapeGeometry, Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import source from "./data/railStationsV190.json";
import refinements from "./data/ringStationDetailsV205.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { createOstkreuzV190 } from "./OstkreuzV190";

export const RAIL_STATIONS_V190_GROUP = "Complete Ring and Stadtbahn source station accents v190";
export const RAIL_STATIONS_V190_INVENTORY = source.stations;
export function railStationLabelV190(name: string): string {
  const label = name.replace(/ß/g, "SS").replace(/ä/g, "AE").replace(/ö/g, "OE").replace(/ü/g, "UE").replace(/\//g, " ").toUpperCase();
  letteringLayout(label, .32);
  return label;
}
type Rows = number[][];
type Platform = typeof source.platforms[number];
type Frame = Platform["frame"];
const C = { pavement: 0xb5b4a8, edge: 0xe5e0cf, steel: 0x66716c,
  rail: 0x505b57, blue: 0x284764, cream: 0xe6e4d4, green: 0x387454, seat: 0x8f9991 };

function point(f: Frame, u: number, v = 0): [number, number] {
  return [f.x + f.dx * u - f.dz * v, f.z + f.dz * u + f.dx * v];
}
function contains(rings: readonly number[][][], x: number, z: number): boolean {
  const inRing = (ring: readonly number[][]) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  return inRing(rings[0]) && !rings.slice(1).some(inRing);
}
function box(rows: Rows, native: boolean, x: number, y: number, z: number,
  w: number, h: number, d: number, yaw: number, color: number): void {
  if (!native) { rows.push([x, y, z, w, h, d, yaw, color]); return; }
  const n = Math.max(1, Math.ceil(w / 1.6)), dx = Math.cos(yaw), dz = -Math.sin(yaw);
  for (let i = 0; i < n; i++) {
    const u = ((i + .5) / n - .5) * w;
    rows.push([x + dx * u, y, z + dz * u,
      Math.max(.04, Math.abs(dx) * w / n + Math.abs(dz) * d), h,
      Math.max(.04, Math.abs(dz) * w / n + Math.abs(dx) * d), color]);
  }
}
function beam(rows: Rows, native: boolean, a: number[], b: number[], y: number,
  width: number, height: number, color: number): void {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (length < .002) return;
  box(rows, native, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2,
    length, height, width, -Math.atan2(dz, dx), color);
}
function nativePlatform(rows: Rows, p: Platform): void {
  // Independent orthogonal horizontal surface runs. No hidden filled column,
  // rotated native box, diagonal slab or smooth platform accompanies them.
  const minX = Math.min(...p.rings[0].map(v => v[0])), maxX = Math.max(...p.rings[0].map(v => v[0]));
  const minZ = Math.min(...p.rings[0].map(v => v[1])), maxZ = Math.max(...p.rings[0].map(v => v[1]));
  const step = 1.5;
  for (let z = minZ; z < maxZ; z += step) {
    const depth = Math.min(step, maxZ - z), cz = z + depth / 2;
    let start: number | undefined;
    for (let x = minX; x <= maxX + step; x += step) {
      const inside = x < maxX && contains(p.rings, x + Math.min(step, maxX - x) / 2, cz);
      if (inside && start === undefined) start = x;
      if (!inside && start !== undefined) {
        const end = Math.min(x, maxX);
        rows.push([(start + end) / 2, p.y - .15, cz, end - start, .3, depth, C.pavement]);
        start = undefined;
      }
    }
  }
}
function platformGeometry(p: Pick<Platform, "rings" | "y">): BufferGeometry {
  const shape = new Shape(p.rings[0].map(([x, z]) => new Vector2(x, -z)));
  shape.holes = p.rings.slice(1).map(r => new Path(r.map(([x, z]) => new Vector2(x, -z))));
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, p.y, 0);
  geometry.deleteAttribute("uv");
  return geometry;
}
function text(rows: Rows, native: boolean, f: Frame, x: number, z: number,
  y: number, label: string, height: number): void {
  const paths = letteringStrokePaths(label, height), width = letteringLayout(label, height).totalWidthM;
  const yaw = -Math.atan2(f.dz, f.dx);
  box(rows, native, x, y + height / 2, z, width + .6, height + .35, .16, yaw, C.blue);
  // Upright text is made from small orthogonal strokes in native mode. Drawn
  // strokes are short stacked horizontal bars too, avoiding font/texture loads.
  for (const path of paths) for (let j = 1; j < path.length; j++) {
    const a = path[j - 1], b = path[j], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .09));
    for (let i = 0; i < n; i++) {
      const u = a[0] + (b[0] - a[0]) * (i + .5) / n;
      box(rows, native, x + f.dx * u - f.dz * .11, y + a[1] + (b[1] - a[1]) * (i + .5) / n,
        z + f.dz * u + f.dx * .11, .075, .075, .04, yaw, C.cream);
    }
  }
}
function addFurniture(rows: Rows, native: boolean, p: Platform, name: string): void {
  const f = p.frame, yaw = -Math.atan2(f.dz, f.dx);
  // The station sign is placed on an actual platform, near its exposed end.
  // Its location and small component sections are illustrative subdivisions.
  const choices = [.43, -.43, .3, -.3, 0].map(t => point(f, f.length * t));
  const [x, z] = choices.find(q => contains(p.rings, q[0], q[1])) ?? [f.x, f.z];
  const label = railStationLabelV190(name);
  text(rows, native, f, x, z, p.y + 2.5, label, .32);
  for (const side of [-1, 1]) box(rows, native, x + f.dx * side * 1.5, p.y + 1.3,
    z + f.dz * side * 1.5, .10, 2.6, .10, 0, C.steel);
  for (const u of [-.2, .2]) {
    const q = point(f, f.length * u);
    if (!contains(p.rings, q[0], q[1])) continue;
    box(rows, native, q[0], p.y + .48, q[1], 2.2, .12, .55, yaw, C.seat);
    for (const v of [-.8, .8]) {
      const a = point(f, f.length * u + v);
      box(rows, native, a[0], p.y + .22, a[1], .13, .44, .40, yaw, C.steel);
    }
  }
}
function routeInk(native: boolean): Group {
  const root = new Group(); root.name = "Exact Stadtbahn directional course, cartographic display grade";
  const buckets = new Map<string, number[]>();
  // The complete original Ring circuit remains in OuterThinOutlines. Add only
  // the missing Stadtbahn identities, at true x/z, without a duplicated Ring.
  for (const route of source.routes.filter(r => r.family === "stadtbahn")) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      const key = `${Math.floor((a[0] + b[0]) / 1024)},${Math.floor((a[1] + b[1]) / 1024)}`;
      const positions = buckets.get(key) ?? []; buckets.set(key, positions);
      positions.push(a[0], 3.58, a[1], b[0], 3.58, b[1]);
    }
  }
  const material = new LineBasicMaterial({ color: 0x50695c, opacity: .48, transparent: true, depthTest: false, depthWrite: false });
  for (const [key, positions] of buckets) {
    if (native) {
      const rows: Rows = [];
      for (let i = 0; i < positions.length; i += 6) {
        const x = positions[i], z = positions[i + 2], ex = positions[i + 3], ez = positions[i + 5];
        const n = Math.max(1, Math.ceil(Math.hypot(ex - x, ez - z) / 3));
        for (let j = 0; j < n; j++) rows.push([x + (ex - x) * (j + .5) / n, 3.58,
          z + (ez - z) * (j + .5) / n, Math.max(.12, Math.abs(ex - x) / n), .1,
          Math.max(.12, Math.abs(ez - z) / n), C.rail]);
      }
      const mesh = justicePalaceV183Boxes(rows, true);
      mesh.name = `Stadtbahn native exact-course accents ${key}`;
      mesh.userData.cartographicOverlay = true;
      root.add(mesh);
    } else {
      const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
      const lines = new LineSegments(geometry, material);
      lines.name = `Stadtbahn source course ${key}`; lines.renderOrder = 100;
      lines.userData.cartographicOverlay = true; root.add(lines);
    }
  }
  return root;
}

/** Source-identifiable accents; one local batch per station supports culling. */
export function createRailStationsV190(native = false): Group {
  const root = new Group(); root.name = RAIL_STATIONS_V190_GROUP;
  root.userData = { textureFree: true, boundedOstkreuzProxyReplacement: true, sourceGeometryRetained: true,
    nativeMinecraft: native, blockNative: native, keepInMinecraft: native,
    fullStaticDetailOnTouch: true, sourceSha256: source.sourceSha256, sourceStatus: source.policy,
    ringStationCount: 27, stadtbahnStationCount: 14, uniqueStationCount: 39,
    surveyedRailwayElevation: false, preservedHeroNames: source.stations.filter(s => s.heroRetained).map(s => s.name) };
  root.add(routeInk(native));
  root.add(createOstkreuzV190(native));
  for (const station of source.stations) {
    if (station.heroRetained) continue;
    const group = new Group(); group.name = `Bahnhof ${station.name} source platforms and canopy accents`;
    group.userData = { stationName: station.name, anchorOsmId: station.anchor,
      platformIds: station.platformIds, textureFree: true, additiveOnly: true };
    const platforms = source.platforms.filter(p => p.station === station.name);
    const rows: Rows = [], caps: BufferGeometry[] = [];
    for (const p of platforms) {
      if (native) nativePlatform(rows, p); else caps.push(platformGeometry(p));
      for (const ring of p.rings) for (let i = 1; i < ring.length; i++) {
        beam(rows, native, ring[i - 1], ring[i], p.y - .18, .22, .36, C.edge);
        beam(rows, native, ring[i - 1], ring[i], p.y + .012, .30, .035, C.cream);
      }
    }
    const passenger = platforms.find(p => p.sourceTags.light_rail === "yes") ?? platforms[0];
    if (passenger) addFurniture(rows, native, passenger, station.name);
    for (const roof of source.roofs.filter(r => r.station === station.name && station.name !== "Ostkreuz")) {
      // A shallow edge accent on each exact retained roof; no second shell.
      // The source's generic roof envelope is retained, including its limits.
      for (const ring of roof.rings) for (let i = 1; i < ring.length; i++)
        beam(rows, native, ring[i - 1], ring[i], roof.y + .08, .18, .20, C.steel);
      if (station.name === "Westkreuz" || station.name === "Südkreuz") {
        const f = roof.frame, n = Math.max(1, Math.floor(f.length / 10));
        for (let i = 1; i < n; i++) {
          const u = -f.length / 2 + f.length * i / n;
          const a = point(f, u, -f.width * .45), b = point(f, u, f.width * .45);
          if (contains(roof.rings, ...a) && contains(roof.rings, ...b))
            beam(rows, native, a, b, roof.y + .12, .13, .20, C.steel);
        }
      }
    }
    const extra = refinements.stations.find(s => s.name === station.name);
    if (extra) {
      group.userData.ringRefinementV205 = true;
      for (const marker of extra.markers) {
        const { x, z, y } = marker;
        const dx = native ? 1 : marker.dx, dz = native ? 0 : marker.dz, yaw = -Math.atan2(dz, dx);
        box(rows, native, x, y + 1.55, z, .10, 3.1, .10, 0, C.steel);
        box(rows, native, x, y + 3, z, .78, .78, .16, yaw, C.green);
        // Block-drawn S on both faces. No glyph/texture dependency and no mark
        // on a regional platform: generation requires light_rail=yes.
        for (const side of [-1, 1]) {
          const face = .11;
          for (const offset of [-.22, 0, .22]) box(rows, native, x - dz * face * side, y + 3 + offset,
            z + dx * face * side, .39, .065, .035, yaw, C.cream);
          for (const sign of [-1, 1]) box(rows, native, x + dx * sign * side * .18 - dz * face * side, y + 3 - sign * .11,
            z + dz * sign * side * .18 + dx * face * side, .065, .22, .035, yaw, C.cream);
        }
      }
      const roofs: BufferGeometry[] = [];
      for (const canopy of extra.canopies) {
        if (native) rows.push(...canopy.native); else roofs.push(platformGeometry({ rings: canopy.rings, y: canopy.y }));
      }
      if (roofs.length) {
        const geometry = mergeGeometries(roofs, false)!; roofs.forEach(g => g.dispose());
        const day = new MeshBasicMaterial({ color: 0x909c96, side: DoubleSide });
        const night = new MeshStandardMaterial({ color: 0x909c96, side: DoubleSide, roughness: .9 });
        const mesh = new Mesh(geometry, day); mesh.name = `${station.name} source-only missing canopy planes v205`;
        mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true, sourceIds: extra.canopies.map(c => c.id) };
        group.add(mesh);
      }
    }
    if (caps.length) {
      const geometry = mergeGeometries(caps, false)!; for (const cap of caps) cap.dispose();
      const day = new MeshBasicMaterial({ color: C.pavement, side: DoubleSide });
      const night = new MeshStandardMaterial({ color: C.pavement, side: DoubleSide, roughness: .95 });
      const mesh = new Mesh(geometry, day); mesh.name = `${station.name} complete source platform surfaces`;
      mesh.userData = { dayMaterial: day, nightMaterial: night, textureFree: true };
      group.add(mesh);
    }
    const accents = justicePalaceV183Boxes(rows, native); accents.name = `${station.name} platform edges, source-roof frames and name sign`;
    accents.userData.stationName = station.name;
    group.add(accents); root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}

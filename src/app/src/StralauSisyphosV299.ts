import {
  BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4,
  MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/stralauSisyphosV299.json";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
export type StralauRowV299 = { p: Point; s: Point; yaw: number; tone: number; role: string; site: string };
export const STRALAU_SISYPHOS_V299_PROFILE = {
  fullStaticDetailOnTouch: true, textureFree: true, newTourStops: 0,
  independentOrthogonalNative: true, offlinePacketOwned: true,
  sourceFile: "stralau-sisyphos-v299-source.json.gz",
  estimatePolicy: data.estimatePolicy,
  camera: { stralau: [7010, 65, 2790], sisyphos: [8010, 20, 3080], marina: [7890, 22, 3375] },
  gateNode: "11100819930", gate: [8054.054, 3046.112],
  operator: "Sisyphos Event GmbH", address: "Hauptstraße 15, Rummelsburg",
  openingClaim: "Event-dependent; no permanent 24/7 assertion",
  waterY: data.waterY,
} as const;

export function stralauContainsV299(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Authoring source for bounded offline packets. No animation, texture, runtime
 * terrain rebuilding or persistent city-sized data copy is introduced. */
export function stralauGeometryV299(native = false): { rows: StralauRowV299[]; roles: Record<string, number> } {
  const rows: StralauRowV299[] = [];
  let site = "";
  const raw = (p: Point, s: Point, tone: number, role: string, yaw = 0) => {
    if (![...p, ...s, yaw].every(Number.isFinite) || s.some(v => v <= 0)) throw Error("Invalid Stralau fitting");
    rows.push({ p, s, yaw, tone, role, site });
  };
  const box = (p: Point, s: Point, tone: number, role: string, yaw = 0) => {
    if (!native || Math.abs(Math.sin(yaw) * Math.cos(yaw)) < 1e-8) {
      raw(p, native && Math.abs(Math.sin(yaw)) > .5 ? [s[2], s[1], s[0]] : s, tone, role, native ? 0 : yaw); return;
    }
    // Independent cardinal segments follow the full oriented member rather
    // than retaining a rotated smooth primitive in the native family.
    const c = Math.cos(yaw), d = -Math.sin(yaw);
    const n = Math.max(1, Math.ceil(s[0] / .8)), m = Math.max(1, Math.ceil(s[2] / .8));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const u = (i + .5) * s[0] / n - s[0] / 2, v = (j + .5) * s[2] / m - s[2] / 2;
      raw([p[0] + c * u - d * v, p[1], p[2] + d * u + c * v],
        [Math.abs(c) * s[0] / n + Math.abs(d) * s[2] / m, s[1], Math.abs(d) * s[0] / n + Math.abs(c) * s[2] / m], tone, role);
    }
  };
  const frame = (a: readonly number[], b: readonly number[]) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    return { length, yaw: -Math.atan2(dz, dx), at: (u: number, y: number, v = 0): Point => [a[0] + dx * u - dz * v, y, a[1] + dz * u + dx * v] };
  };
  const line = (a: Point, b: Point, thickness: number, tone: number, role: string) => {
    const length = Math.hypot(...a.map((v, i) => b[i] - v));
    const n = Math.max(1, Math.ceil(length / (native ? .28 : .20)));
    for (let i = 0; i < n; i++) {
      const p = a.map((v, j) => v + (b[j] - v) * (i + .5) / n) as Point;
      raw(p, [Math.max(thickness, Math.abs(b[0] - a[0]) / n), Math.max(thickness, Math.abs(b[1] - a[1]) / n), Math.max(thickness, Math.abs(b[2] - a[2]) / n)], tone, role);
    }
  };
  const text = (value: string, f: ReturnType<typeof frame>, u: number, y: number, cap: number, out: number, tone: number, role: string) => {
    const paths = letteringStrokePaths(value, cap), xs = paths.flat().map(p => p[0]), mid = (Math.max(...xs) + Math.min(...xs)) / 2;
    for (const path of paths) for (let i = 1; i < path.length; i++) line(f.at(u + path[i - 1][0] - mid, y + path[i - 1][1], out), f.at(u + path[i][0] - mid, y + path[i][1], out), cap * .10, tone, role);
  };
  const panel = (f: ReturnType<typeof frame>, u: number, y: number, width: number, height: number, out: number, tone: number, role: string, depth = .12) => box(f.at(u, y, out), [width, height, depth], tone, role, f.yaw);

  // Complete measured bodies remain packet-owned. These exterior fittings use
  // exact mapped edges, with explicitly estimated bay/storey sections.
  for (const feature of data.features) {
    if (feature.osmId === "1312237093") continue;
    site = "owner-" + feature.osmId;
    const palm = feature.osmId === "141612818", flask = feature.osmId === "189065406", glass = feature.osmId === "141639586", church = feature.osmId === "32702267", nhow = feature.osmId === "86813081";
    const brick = palm ? 0x9c694f : flask ? 0xa78063 : glass ? 0xa47760 : 0xd0c9b8;
    const floorPitch = palm ? 3.6 : church ? 4.2 : flask ? 3.3 : 3.2;
    for (const wall of feature.walls) {
      const f = frame(wall.a, wall.b), sign = wall.sign, out = sign * (native ? 1.18 : .22);
      const fits = (u: number, y: number, width: number, height: number) => [-.5, .5].every(du => [-.5, .5].every(dy => stralauContainsV299(wall.profile, u + du * width, y + dy * height)));
      if (f.length < 6 || f.length > 125) continue;
      const bays = Math.max(1, Math.floor(f.length / (church ? 5.2 : nhow ? 3.4 : 3.1))), pitch = f.length / bays;
      const top = Math.max(...wall.profile.map(p => p[1])) - .4;
      const bottom = Math.min(...wall.profile.map(p => p[1]));
      if (church && top > 20) {
        const u = f.length / 2, y = 14.2;
        if (fits(u, y, 1.4, 2.8)) {
          panel(f, u, y, 1.25, 2.6, out, 0x3e4944, "dorfkirche-bell-opening");
          for (let j = 0; j < 8; j++) panel(f, u, y - 1.1 + j * .30, 1.23, .09, out + sign * .10, 0xa49a80, "dorfkirche-bell-louvre");
        }
        const cy = 18.7;
        if (fits(u, cy, 1.2, 1.2)) {
          for (let j = 0; j < 10; j++) {
            const dy = (j + .5) * 1.1 / 10 - .55;
            panel(f, u, cy + dy, 2 * Math.sqrt(Math.max(0, .55 * .55 - dy * dy)), .12, out + sign * .10, 0xe2dfcd, "dorfkirche-clock-disc");
          }
          panel(f, u, cy + .18, .055, .42, out + sign * .19, 0x3e4944, "dorfkirche-clock-hand");
          panel(f, u + .14, cy, .33, .055, out + sign * .19, 0x3e4944, "dorfkirche-clock-hand");
        }
        continue;
      }
      for (let y = church ? Math.max(9, bottom + 2.5) : Math.max(5.3, bottom + 1.7); y + 1.0 < top; y += floorPitch) {
        for (let i = 0; i < bays; i++) {
          const u = (i + .5) * pitch;
          if (nhow && (i + Math.round(y)) % 5 === 0) continue;
          const width = Math.min(pitch * (flask ? .83 : .65), church ? 1.35 : 2.3), height = church ? 3.7 : palm ? 2.3 : 1.95;
          if (!fits(u, y, width + .27, height + (palm || church ? .7 : .3))) continue;
          panel(f, u, y, width, height, out, 0x526b70, "source-edge-window-glazing");
          panel(f, u, y - height / 2 - .10, width + .26, .17, out + sign * .05, brick, "source-edge-window-sill");
          for (const side of [-1, 1]) panel(f, u + side * width / 2, y, .10, height, out + sign * .06, church ? 0xc3bda8 : 0xd1ccbb, "window-jamb");
          if (palm || church) for (let j = 0; j < 10; j++) {
            const t = j * Math.PI / 9;
            panel(f, u + Math.cos(t) * (width / 2 + .08), y + height / 2 + Math.sin(t) * (church ? .75 : .26), .13, .15, out + sign * .04, brick, "arched-masonry-window-head");
          }
          if (glass) { panel(f, u, y, .06, height, out + sign * .09, 0xd0c7b4, "glashuette-industrial-window-mullion"); panel(f, u, y, width, .08, out + sign * .09, 0xd0c7b4, "glashuette-industrial-window-transom"); }
        }
        if (flask && fits(f.length / 2, y - 1.45, f.length - .1, .32)) panel(f, f.length / 2, y - 1.45, f.length - .1, .32, out, 0xb9b3a2, "flaschenturm-concrete-floor-band");
      }
      if ((palm || flask || glass) && fits(f.length / 2, top - .15, f.length - .1, .28)) panel(f, f.length / 2, top - .15, f.length - .1, .28, out, brick, "industrial-source-eaves-course");
      if (glass) for (let u = .2; u < f.length; u += 5.7) if (fits(u, bottom + 4, .16, 7.5)) panel(f, u, bottom + 4, .16, 7.5, out + sign * .08, 0x4e5550, "glashuette-visible-steel-frame");
    }
  }

  // Public Hauptstraße gate: exact OSM gate node, reference-estimated width.
  // Retained industrial roofs and the actual open court are left intact.
  site = "sisyphos";
  const gate = frame([8049.55, 3039.32], [8058.56, 3052.91]), center = gate.length / 2;
  for (const u of [center - 4.5, center + 4.5]) panel(gate, u, 5.4, .70, 4.8, 0, 0x454846, "sisyphos-dark-brick-gate-pier", .75);
  panel(gate, center, 4.8, 8.2, 3.5, 0, 0x7a8782, "sisyphos-paired-iron-gate", .14);
  for (let i = 0; i <= 12; i++) line(gate.at(center - 4.1 + i * 8.2 / 12, 3.05, .14), gate.at(center, 6.58, .14), .045, 0x7e624c, "sisyphos-gate-radial-ironwork");
  for (let j = 0; j < 26; j++) {
    const u = center - 4.8 + j * 9.6 / 25, q = (u - center) / 4.8, y = 7.3 + .9 * Math.sqrt(Math.max(0, 1 - q * q));
    panel(gate, u, y, .43, .62, 0, 0x9e6041, "sisyphos-rusted-arched-banner", .14);
  }
  text("SISYPHOS", gate, center, 7.38, .48, .18, 0x3c4039, "sisyphos-geometric-name");
  // Two independently drawn duck silhouettes face beak-to-beak. Their bodies,
  // curved necks, wings, feet and bills remain geometry rather than image pixels.
  for (const side of [-1, 1]) {
    const at = (u: number, y: number, depth = .25) => gate.at(center + side * u, y, depth);
    for (let j = 0; j < 14; j++) {
      const t = (j + .5) / 14, y = 3.85 + t * 1.15, w = 2.8 * Math.sqrt(Math.max(0, 1 - ((t - .45) / .65) ** 2));
      box(at(2.1, y), [w, .10, .12], 0x9f7757, "sisyphos-duck-body", gate.yaw);
    }
    const curve = [[1.8, 4.6], [1.2, 5.05], [1.0, 5.8], [.8, 6.15], [.48, 6.25], [.22, 6.05]];
    for (let j = 1; j < curve.length; j++) line(at(...curve[j - 1] as [number, number]), at(...curve[j] as [number, number]), .29, 0x9f7757, "sisyphos-duck-curved-neck");
    box(at(.14, 5.96), [.35, .13, .15], 0xb28b65, "sisyphos-duck-bill", gate.yaw);
    box(at(.53, 6.13, .34), [.075, .075, .075], 0x303c39, "sisyphos-duck-eye");
    for (const u of [1.65, 2.55]) { line(at(u, 4.0), at(u + .25, 3.55), .10, 0x9f7757, "sisyphos-duck-leg"); box(at(u + .35, 3.54), [.45, .10, .12], 0x9f7757, "sisyphos-duck-foot", gate.yaw); }
  }
  // Red/cream scalloped frontage remains outside the real street; no gate is
  // relocated to the Peninsula and no imaginary continuous opening is claimed.
  for (const side of [-1, 1]) for (let j = 0; j < 13; j++) {
    const u = center + side * (5.2 + (j + .5) * .55), height = 3.3 + .45 * Math.cos(j * Math.PI / 12);
    panel(gate, u, 3 + height / 2, .55, height, .2, j % 2 ? 0xd8d3c1 : 0xb95046, "sisyphos-red-cream-frontage", .16);
  }

  // Only mapped dock courses are added; every water footprint remains source
  // water, not a synthetic lawn/house infill or named private home.
  site = "citymarina";
  const waterY = data.waterY;
  for (const pier of data.piers) for (let i = 1; i < pier.points.length; i++) {
    const f = frame(pier.points[i - 1], pier.points[i]);
    box(f.at(f.length / 2, waterY + .55), [f.length, .22, 1.25], 0x8e806c, "mapped-citymarina-pier", f.yaw);
    for (let u = 2; u < f.length; u += 7.5) raw(f.at(u, waterY + 1.05), [.12, .8, .12], 0xb3b8ad, "marina-berth-post");
  }
  const boat = (a: [number, number], b: [number, number], width: number, label: string, cabinTone: number) => {
    const f = frame(a, b), y = waterY + .65;
    box(f.at(f.length / 2, waterY + .08), [f.length - 1.6, .6, width], 0x3d4b47, label + "-floating-hull", f.yaw);
    for (const end of [0, 1]) for (let j = 0; j < 4; j++) box(f.at(end ? f.length - 1.6 + j * .4 : 1.6 - j * .4, waterY + .08), [.42, .6, width * (1 - j * .16)], 0x3d4b47, label + "-tapered-bow", f.yaw);
    box(f.at(f.length / 2, y), [f.length, .16, width], 0xb7aa8c, label + "-timber-deck", f.yaw);
    const cabinLength = f.length * .67;
    box(f.at(f.length / 2, y + 1.3), [cabinLength, 2.45, width * .83], cabinTone, label + "-cabin", f.yaw);
    box(f.at(f.length / 2, y + 2.6), [cabinLength + .26, .18, width * .90], 0x7a827a, label + "-flat-roof", f.yaw);
    for (const side of [-1, 1]) {
      for (let u = (f.length - cabinLength) / 2 + 1; u < (f.length + cabinLength) / 2 - .6; u += 1.6) panel(f, u, y + 1.45, 1.34, 1.65, side * (width * .42 + .05), 0x426b72, label + "-cabin-glazing");
      for (let u = .5; u < f.length; u += 1.3) raw(f.at(u, y + .6, side * width / 2), [.06, 1.0, .06], 0xb6bdb1, label + "-deck-rail-post");
      box(f.at(f.length / 2, y + 1.08, side * width / 2), [f.length - .25, .06, .06], 0xb6bdb1, label + "-deck-handrail", f.yaw);
    }
  };
  // Current public operator confirms three floating apartment boats here. The
  // berth-row offsets and small hull/cabin sections are DOP/reference estimates,
  // not an assertion of private occupants or permanently assigned individual berths.
  for (let i = 0; i < 3; i++) boat([7880 + i * 13, 3296 + i * 14], [7888 + i * 13, 3305 + i * 14], 4.0, "public-floating-apartment", 0xd5d1bd);
  site = "stralau-public-barge";
  const barge = data.features.find(f => f.osmId === "1312237093");
  if (barge) {
    const r = barge.ring, edges = r.map((a, i) => ({ a, b: r[(i + 1) % r.length], l: Math.hypot(r[(i + 1) % r.length][0] - a[0], r[(i + 1) % r.length][1] - a[1]) })).sort((a, b) => b.l - a.l);
    const f = frame(edges[0].a, edges[0].b), cx = r.reduce((s, p) => s + p[0] / r.length, 0), cz = r.reduce((s, p) => s + p[1] / r.length, 0);
    const a = f.at(f.length / 2, 0), d = [edges[0].b[0] - edges[0].a[0], edges[0].b[1] - edges[0].a[1]];
    const len = Math.hypot(...d), dx = d[0] / len, dz = d[1] / len;
    void a;
    boat([cx - dx * len / 2, cz - dz * len / 2], [cx + dx * len / 2, cz + dz * len / 2], 6.4, "mapped-public-event-barge", 0x887e69);
  }
  if (rows.length > (native ? 80000 : 20000)) throw Error("Stralau finite authoring budget exceeded");
  const roles: Record<string, number> = {};
  for (const r of rows) roles[r.role] = (roles[r.role] ?? 0) + 1;
  return { rows, roles };
}

/** QA/authoring factory; production bakes the identical rows into bounded
 * packets, so a second Required-world model is never attached. */
export function createStralauSisyphosV299(native = false, _options: { mobileLike?: boolean } = {}): Group {
  const model = stralauGeometryV299(native), root = new Group();
  const geometry = new BoxGeometry(1, 1, 1); geometry.deleteAttribute("uv");
  const day = new MeshBasicMaterial({ color: 0xffffff }), night = new MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
  const mesh = new InstancedMesh(geometry, day, model.rows.length), matrices = new Float32Array(model.rows.length * 16), colors = new Float32Array(model.rows.length * 3);
  const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3(), c = new Color();
  model.rows.forEach((r, i) => { m.compose(p.set(...r.p), q.setFromAxisAngle(new Vector3(0, 1, 0), r.yaw), s.set(...r.s)); m.toArray(matrices, i * 16); c.setHex(r.tone); c.toArray(colors, i * 3); });
  mesh.instanceMatrix = new InstancedBufferAttribute(matrices, 16); mesh.instanceColor = new InstancedBufferAttribute(colors, 3);
  mesh.name = "Stralau and Sisyphos complete source-bound authoring rows v299";
  mesh.userData = { dayMaterial: day, nightMaterial: night, nativeMinecraft: native, blockNative: native, keepInMinecraft: native };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  root.name = "Stralau Sisyphos v299 authoring proof"; root.userData = { ...STRALAU_SISYPHOS_V299_PROFILE, nativeMinecraft: native, blockNative: native, keepInMinecraft: native, roles: model.roles, instanceCount: model.rows.length };
  return freezeStaticSceneTransforms(root);
}

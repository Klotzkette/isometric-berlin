import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import data from "./data/southFidelityV294.json";
import concert from "./data/concertHallsSource.json";
import station from "./data/schlesischesTorV267.json";
import { createMauerContextV294 } from "./MauerContextV294";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Point = [number, number, number];
type Row = { p: Point; s: Point; tone: number; yaw: number; role: string; site: string; q?: [number,number,number,number] };
type Tri = { p: number[][]; tone: number; role: string; site: string };
const CREAM = 0xd8d5c7, DARK = 0x46574f, GLASS = 0x506b70, SILVER = 0xb8c5bd;

export const SOUTH_FIDELITY_V294_PROFILE = {
  fullStaticDetailOnTouch: true, textureFree: true, independentOrthogonalNative: true,
  retainedSourceOwners: data.nkzOwners.map(s => s.owner), newTourStops: 0,
  sourceReceipt: "south-fidelity-v294-source.json.gz",
  passage: data.passage,
  sites: ["Technikmuseum C47", "Schlesisches Tor", "Kottbusser Tor", "Zentrum Kreuzberg",
    "Möbel Olfe", "Hermannplatz", "Huxleys Neue Welt", "Hasenheide", "Winterfeldtplatz",
    "Nollendorfplatz", "Metropol", "former Mercedes frontage", "former PwC / Forum Tower",
    "Atrium Tower", "Spielbank", "Theater am Potsdamer Platz", "Philharmonie"],
  cameras: {
    nkz: { position: [3163, 18, 2220], target: [3143, 16, 2158] },
    nollendorf: { position: [-1355, 49, 2080], target: [-1281, 19, 2142] },
    winterfeldt: { position: [-1270, 41, 2390], target: [-1212, 7, 2470] },
    hasenheide: { position: [3025, 55, 4080], target: [2963, 5, 4009] },
    potsdamer: { position: [105, 43, 1280], target: [13, 17, 1302] },
  },
  estimatePolicy: "Retained source plans/roof sheets remain exact. Small sections, source-edge facade subdivisions, garden/stall fittings, Nollendorf dome sections and Adalbert passage width/soffit are documented display estimates. No proposed rehabilitation render is treated as completed construction.",
} as const;

export function southFidelityGeometryV294(native = false) {
  const rows: Row[] = [], triangles: Tri[] = [];
  let site = "";
  const raw = (p: Point, s: Point, tone: number, role: string, yaw = 0) => {
    if (![...p, ...s, yaw].every(Number.isFinite) || s.some(v => v <= 0)) throw Error("Invalid south fitting");
    rows.push({ p, s, tone, role, yaw, site });
  };
  const box = (p: Point, s: Point, tone: number, role: string, yaw = 0) => {
    if (!native) { raw(p, s, tone, role, yaw); return; }
    const dx = Math.cos(yaw), dz = -Math.sin(yaw);
    if (Math.abs(dx * dz) < 1e-8) { raw(p, Math.abs(dx) > .5 ? s : [s[2], s[1], s[0]], tone, role); return; }
    const n = Math.max(1, Math.ceil(s[0] / .85)), m = Math.max(1, Math.ceil(s[2] / .85));
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const u = (i + .5) * s[0] / n - s[0] / 2, v = (j + .5) * s[2] / m - s[2] / 2;
      raw([p[0] + dx * u - dz * v, p[1], p[2] + dz * u + dx * v],
        [Math.abs(dx) * s[0] / n + Math.abs(dz) * s[2] / m, s[1], Math.abs(dz) * s[0] / n + Math.abs(dx) * s[2] / m], tone, role);
    }
  };
  const line = (a: Point, b: Point, width: number, tone: number, role: string) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    if (Math.abs(dy) < 1e-8) { box([(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2], [len, width, width], tone, role, -Math.atan2(dz, dx)); return; }
    if (!native) { const q = new Quaternion().setFromUnitVectors(new Vector3(1,0,0),new Vector3(dx,dy,dz).normalize()); raw([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],[len,width,width],tone,role); rows.at(-1)!.q=q.toArray() as [number,number,number,number]; return; }
    const count = Math.max(1, Math.ceil(len / .65));
    for (let j = 0; j < count; j++) {
      const t = (j + .5) / count;
      raw([a[0] + dx * t, a[1] + dy * t, a[2] + dz * t], [Math.max(width, Math.abs(dx) / count), Math.max(width, Math.abs(dy) / count), Math.max(width, Math.abs(dz) / count)], tone, role);
    }
  };
  const text = (value: string, center: Point, cap: number, yaw: number, tone: number, role: string) => {
    const paths = letteringStrokePaths(value, cap), all = paths.flat();
    const mid = (Math.min(...all.map(p => p[0])) + Math.max(...all.map(p => p[0]))) / 2;
    const at = (p: readonly number[]): Point => [center[0] + Math.cos(yaw) * (p[0] - mid), center[1] + p[1], center[2] - Math.sin(yaw) * (p[0] - mid)];
    for (const path of paths) for (let i = 1; i < path.length; i++) line(at(path[i - 1]), at(path[i]), Math.max(.035, cap * .10), tone, role);
  };
  const frame = (a: readonly number[], b: readonly number[]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    return { len, dx, dz, yaw: -Math.atan2(dz, dx), at: (u: number, y: number, v = 0): Point => [a[0] + dx * u - dz * v, y, a[1] + dz * u + dx * v] };
  };
  const panel = (a: readonly number[], b: readonly number[], y: number, w: number, h: number, v: number, tone: number, role: string) => {
    const f = frame(a, b); box(f.at(f.len / 2, y, v), [w, h, .12], tone, role, f.yaw);
  };
  // Every original measured NKZ sheet is retained in evidence. The complete
  // representation corrects only the mapped road's false ground-filled body.
  site = "nkz";
  for (const shell of data.nkzShells) {
    if (native) for (const r of shell.blocks) raw(r.slice(0, 3) as Point, r.slice(3, 6) as Point, r[6], "nkz-independent-source-skin");
    else for (const t of shell.triangles) triangles.push({ ...t, site });
  }
  for (const osm of ["62182568", "62182562", "16213839"] as const) {
    const ring = data.plans[osm];
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], f = frame(a, b);
      if (f.len < 10) continue;
      // Distinct continuous access galleries have mustard recesses and concrete
      // balustrades. Unknown exact pitches are explicitly estimated.
      const out = (area > 0 ? -1 : 1) * (native ? .85 : .22);
      for (const y of [12.0, 21.0, 30.0]) {
        panel(a, b, y, f.len - .4, 1.05, out, 0xa98f50, "nkz-mustard-access-gallery-recess");
        panel(a, b, y - .70, f.len - .4, .35, out * 1.1, 0xcacbc4, "nkz-gallery-concrete-parapet");
        for (let u = 1.5; u < f.len - 1; u += 4.2) box(f.at(u, y, out * 1.2), [.15, 1.1, .17], 0xcacbc4, "nkz-gallery-open-pier", f.yaw);
      }
      for (let u = 1.8; u < f.len - 1; u += 4.2) for (const y of [8.3, 17.3, 26.3, 35.3]) {
        if (osm === "62182568" && y > 32) continue;
        const p = f.at(u, y, out * 1.4); box(p, [1.05, 1.45, .10], 0x435b61, "nkz-small-square-window", f.yaw);
        box([p[0], y - .8, p[2]], [1.25, .14, .16], 0xd5d6ce, "nkz-window-concrete-sill", f.yaw);
      }
    }
  }
  // The named bar is in the western low frontage, with its public entry toward
  // Dresdener Straße; it is distinct from the bridge-high housing above.
  site = "moebel-olfe";
  const olfe = frame(data.plans["37853280"].at(-3)!, data.plans["37853280"].at(-2)!);
  const olfeOut = native ? .96 : .24;
  for (let j = 0; j < 5; j++) {
    const p = olfe.at((j + .5) * olfe.len / 5, 4.5, olfeOut);
    box(p, [olfe.len / 5 - .12, 2.8, .11], 0x374743, "olfe-low-shop-glazing", olfe.yaw);
    box([p[0], 6.0, p[2]], [olfe.len / 5, .18, .19], 0xb4a78e, "olfe-low-lintel", olfe.yaw);
  }
  text("MÖBEL OLFE", olfe.at(olfe.len / 2, 6.4, olfeOut + .13), .72, olfe.yaw, 0xc5a949, "olfe-geometric-frontage-name");

  // Retained complete OSM U1 courses bridge the previously undetailed gap from
  // v238's x3270 endpoint to the v267 western excerpt. Every road stays below.
  site = "schlesisches-tor";
  for (const track of data.tracks) {
    let walked = 0, nextSupport = 15;
    for (let i = 1; i < track.points.length; i++) {
      const a = track.points[i - 1], b = track.points[i], f = frame(a, b);
      if (f.len < .01) continue;
      box(f.at(f.len / 2, 8.72), [f.len, .42, 2.85], DARK, "u1-source-course-elevated-deck", f.yaw);
      for (const v of [-.7175, .7175]) line(f.at(0, 9.04, v), f.at(f.len, 9.04, v), .09, 0x9aa69f, "u1-1435mm-elevated-rail");
      for (const v of [-1.48, 1.48]) {
        line(f.at(0, 8.12, v), f.at(f.len, 8.12, v), .14, DARK, "u1-bottom-lattice-chord");
        line(f.at(0, 8.89, v), f.at(f.len, 8.89, v), .14, DARK, "u1-top-lattice-chord");
        for (let u = 0; u < f.len - 4; u += 4) {
          line(f.at(u, 8.15, v), f.at(u + 4, 8.86, v), .11, DARK, "u1-lattice-cross-brace");
          line(f.at(u, 8.86, v), f.at(u + 4, 8.15, v), .11, DARK, "u1-lattice-cross-brace");
        }
      }
      while (nextSupport < walked + f.len) {
        const u = nextSupport - walked;
        raw(f.at(u, 5.47), [.25, 4.94, .25], DARK, "u1-slender-median-pier");
        box(f.at(u, 8.15), [.50, .44, 2.8], DARK, "u1-pier-crosshead", f.yaw);
        nextSupport += 36;
      }
      walked += f.len;
    }
  }
  // Small joint plates/cap bolts articulate the already retained station arches
  // and western truss, with no repeated second facade or changed source roofs.
  const [sx, sz] = station.direction;
  for (const u of [-24, -12, 0, 12, 24]) for (const side of [-1, 1]) {
    const x = station.centre[0] + sx * u - sz * side * 8.5, z = station.centre[1] + sz * u + sx * side * 8.5;
    box([x, 8.1, z], [.5, .75, .12], 0x536e5c, "schlesisches-station-riveted-joint-plate", -Math.atan2(sz, sx));
    for (const y of [7.87, 8.3]) raw([x, y, z], [.10, .10, .18], 0x9ba494, "schlesisches-visible-rivet");
  }
  site = "kottbusser-tor";
  const kotti = frame([3077, 2289], [3196, 2279.3]);
  for (let u = 3; u < 117; u += 7.5) for (const side of [-1, 1]) {
    box(kotti.at(u, 14.15, side * 7.3), [.15, 2.2, .20], 0xb7c0bb, "kotti-light-grey-hall-mullion", kotti.yaw);
    box(kotti.at(u, 12.87, side * 7.3), [2.2, .17, .20], 0x939f9b, "kotti-open-glazing-bottom-rail", kotti.yaw);
  }
  for (const u of [25, 87]) { box(kotti.at(u, 13.6, 7.6), [10.5, .85, .12], 0x284b70, "kotti-platform-name-board", kotti.yaw); text("KOTTBUSSER TOR", kotti.at(u, 13.38, 7.72), .40, kotti.yaw, CREAM, "kotti-geometric-name"); }

  site = "metropol";
  const mf = frame([-1335.8, 2175.4], [-1308.8, 2177.1]);
  const mbox = (u: number, y: number, w: number, h: number, depth: number, tone: number, role: string, v = -.42) => box(mf.at(u, y, v), [w, h, depth], tone, role, mf.yaw);
  // The original monumental head, triangular gable, strong side pylons and
  // Korbbogen are distinct from a repeated residential window arrangement.
  for (const u of [1.7, 25.3]) { mbox(u, 18.4, 2.4, 23.0, .36, 0xc5bca6, "metropol-stone-side-pylon"); mbox(u, 30.3, 3.0, .55, .55, CREAM, "metropol-pylon-cap"); }
  for (let j = 0; j < 30; j++) {
    const angle = Math.PI * j / 29, u = mf.len / 2 + Math.cos(angle) * 8.3, y = 15.0 + Math.sin(angle) * 5.3;
    mbox(u, y, .46, .46, .34, 0xd4cdbb, "metropol-korbbogen-stone-surround", -.70);
  }
  mbox(mf.len / 2, 12.2, 15.9, 5.5, .14, 0x45656b, "metropol-central-restored-glazing", -.55);
  for (let u = 6.1; u <= 21.2; u += 2.5) mbox(u, 12.2, .13, 5.55, .24, CREAM, "metropol-central-glass-mullion", -.72);
  for (const side of [-1, 1]) line(mf.at(mf.len / 2, 33.3, -.66), mf.at(mf.len / 2 + side * 11.4, 26.8, -.66), .40, 0xd3cab6, "metropol-triangular-gable-frame");
  for (const u of [3.8, 23.2]) { mbox(u, 22.8, .55, 2.2, .32, 0xb0a38c, "metropol-dancing-relief-body", -.8); mbox(u, 24.25, .55, .60, .34, 0xb0a38c, "metropol-dancing-relief-head", -.8); for (const side of [-1, 1]) line(mf.at(u, 23.3, -.8), mf.at(u + side * .85, 23.8, -.8), .20, 0xb0a38c, "metropol-dancing-relief-arms"); }
  mbox(mf.len / 2, 6.3, 15.6, 1.0, .13, 0x343e3c, "metropol-entrance-lintel", -.76);
  text("METROPOL", mf.at(mf.len / 2, 6.06, -.86), .63, mf.yaw, CREAM, "metropol-current-geometric-name");

  site = "nollendorfplatz";
  // Reconstructed open steel-profile cupola; no invented solid glazed dome.
  const nc: Point = [-1267.5, 17.2, 2117.0];
  for (let meridian = 0; meridian < 16; meridian++) {
    const a = meridian * Math.PI / 8;
    for (let j = 0; j < 14; j++) {
      const at = (i: number): Point => { const t = i * Math.PI / 28; return [nc[0] + Math.cos(a) * 10.1 * Math.cos(t), nc[1] + 10.4 * Math.sin(t), nc[2] + Math.sin(a) * 9.3 * Math.cos(t)]; };
      line(at(j), at(j + 1), .15, 0x53695d, "nollendorf-open-steel-dome-rib");
    }
  }
  for (const t of [0, Math.PI / 9, Math.PI / 5, Math.PI / 3]) for (let j = 0; j < 48; j++) {
    const at = (i: number): Point => [nc[0] + 10.1 * Math.cos(t) * Math.cos(i * Math.PI / 24), nc[1] + 10.4 * Math.sin(t), nc[2] + 9.3 * Math.cos(t) * Math.sin(i * Math.PI / 24)];
    line(at(j), at(j + 1), .15, 0x53695d, "nollendorf-open-dome-ring");
  }
  raw([nc[0], 28.15, nc[2]], [.28, 1.5, .28], 0x53695d, "nollendorf-dome-crown");
  const nf = frame([-1293.2, 2110.2], [-1278.2, 2115.9]);
  panel([-1293.2, 2110.2], [-1278.2, 2115.9], 7.2, nf.len, 1.05, -1.0, 0x244e79, "nollendorf-entrance-name-board");
  text("NOLLENDORFPLATZ", nf.at(nf.len / 2, 7.05, -1.12), .37, nf.yaw, CREAM, "nollendorf-entrance-geometric-name");

  site = "winterfeldtplatz";
  // An illustrative market scene on the mapped hard square; leave the central
  // axis and all boundary approaches open. It is not a claim of daily trading.
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const z = 2414 + i * 11.5;
    const ring = data.plans["168901481"], xs = ring.flatMap((a,j) => {const b=ring[(j+1)%ring.length];return (a[1]>z)!==(b[1]>z)?[a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1])]:[];});
    const x = side < 0 ? Math.min(...xs)+7 : Math.max(...xs)-7;
    if(![-2.55,2.55].every(dx=>[-1.45,1.45].every(dz=>southFidelityContainsV294(ring,x+dx,z+dz))))continue;
    box([x, 4.6, z], [4.8, .16, 2.6], 0xad9270, "winterfeldt-market-counter");
    for (const dx of [-2.1, 2.1]) for (const dz of [-1.1, 1.1]) raw([x + dx, 4.5, z + dz], [.09, 3.0, .09], SILVER, "winterfeldt-market-canopy-post");
    box([x, 6.05, z], [5.1, .12, 2.9], i % 2 ? 0xe3ddc8 : 0x5c7964, "winterfeldt-market-awning");
    for (let j = 0; j < 4; j++) box([x - 1.6 + j * 1.0, 4.82, z], [.8, .32, 1.7], [0x947b4b, 0x688145, 0xb77d3c, 0xa65c4b][j], "winterfeldt-produce-crate");
  }

  site = "hasenheide";
  const garden = data.plans["217402343"];
  // Clipped low rose beds and actual garden-boundary edging never fill the
  // park's broad open lawns, pond or its paths with generic houses/vegetation.
  for (let i = 0; i < garden.length; i++) { const a = garden[i], b = garden[(i + 1) % garden.length]; const f = frame(a, b); box(f.at(f.len / 2, 3.10), [f.len, .12, .14], 0xaaa891, "hasenheide-mapped-rose-garden-edge", f.yaw); }
  for (let x = 2941; x <= 2981; x += 10) for (let z = 4027; z <= 4057; z += 10) {
    if (!southFidelityContainsV294(garden, x, z)) continue;
    box([x, 3.30, z], [4.6, .54, 3.0], 0x66824d, "hasenheide-bounded-rose-bed");
    for (const dx of [-1.2, 0, 1.2]) raw([x + dx, 3.65, z], [.38, .23, .38], 0xb16c77, "hasenheide-rose-recognition");
  }
  const cinema = data.plans["217402355"];
  for (let row = 0; row < 9; row++) {
    const z = 3988 + row * 2.6, width = 19 + row * 1.8;
    for (const side of [-1, 1]) {
      const x = 2958 + side * (width / 4 + 1.2);
      if (!southFidelityContainsV294(cinema, x - width / 4, z) || !southFidelityContainsV294(cinema, x + width / 4, z)) continue;
      box([x, 3.52, z], [width / 2 - 2.4, .15, .55], 0x8e7660, "hasenheide-naturtheater-seat-row");
      for (const dx of [-width / 5, width / 5]) raw([x + dx, 3.29, z], [.14, .5, .35], 0x626b5b, "hasenheide-naturtheater-seat-foot");
    }
  }
  box([2955.6, 3.20, 3978.4], [18, .35, 4.5], 0x77786d, "hasenheide-naturtheater-stage");
  for (const x of [2947.1, 2964.1]) raw([x, 6.2, 3977.2], [.22, 6.0, .22], 0x6d7668, "hasenheide-open-cinema-screen-post");
  box([2955.6, 6.3, 3977.2], [16.5, 5.2, .16], 0xd0d1bd, "hasenheide-cinema-screen");
  for (const [x,z] of [[2941,4094],[2955,4100],[2963,4091]]) {
    raw([x, 3.65, z], [1.3,.14,1.3], 0x8b765b, "hasenschaenke-terrace-table"); raw([x,3.3,z],[.15,.6,.15],DARK,"hasenschaenke-table-foot");
  }

  site = "huxleys";
  // Shallow applied surrounds follow the retained measured north frontage.
  for (const p of data.huxleys.parts) for (const surface of p.surfaces) {
    if (surface.kind !== "WallSurface") continue;
    const r = surface.rings[0], a = r.reduce((a,b) => a[0] < b[0] ? a : b), b = r.reduce((a,b) => a[0] > b[0] ? a : b);
    const f = frame([a[0], a[2]], [b[0], b[2]]);
    if (f.len < 7 || Math.abs(f.dz) > .20 || Math.max(a[2], b[2]) > 3650) continue;
    const top = Math.max(...r.map(v => v[1])) - data.huxleys.sourceGroundY + 3;
    for (const y of [7.4, 11.1, 14.8]) if (y + 1.5 < top) for (let u = 1.5; u < f.len - 1; u += 3.3) {
      const c = f.at(u, y + 1.32, -(native ? .96 : .34)); box(c, [1.95, .26, .19], 0xd2c7af, "huxleys-measured-front-stucco-lintel", f.yaw);
      for (const side of [-1, 1]) box(f.at(u + side * .93, y, -(native ? .96 : .34)), [.12, 2.4, .20], 0xc6bba4, "huxleys-front-stucco-jamb", f.yaw);
    }
  }

  site = "hermannplatz";
  // Current postwar Karstadt source exterior remains. Only the public cornice
  // and ground arcade details are strengthened; no lost historic towers return.
  const hr = data.plans["24315001"];
  const edges = hr.map((a,i)=>({a,b:hr[(i+1)%hr.length]})).filter(({a,b})=>Math.hypot(b[0]-a[0],b[1]-a[1])>50);
  const he = edges.reduce((a,b)=>(a.a[0]+a.b[0])>(b.a[0]+b.b[0])?a:b);
  const hf = frame(he.a,he.b);
  const htest=hf.at(hf.len/2,0,.3),hout=southFidelityContainsV294(hr,htest[0],htest[2])?-1:1;
  for (let u = 4; u < hf.len - 4; u += 8) {
    box(hf.at(u, 7.1, hout*(native?.94:.24)), [.32, 6.2, .36], 0xafa996, "hermannplatz-postwar-arcade-pier", hf.yaw);
    box(hf.at(u, 10.4, hout*(native?.94:.24)), [4.6, .20, .42], 0xc2baaa, "hermannplatz-stone-arcade-cap", hf.yaw);
  }

  // Source-edge secondary sunshade members are added between, rather than
  // replacing, earlier full window/glazing grids and measured roofs.
  for (const core of data.core) {
    site = core.key;
    for (const p of core.originalPrisms) {
      const ring = p.ring.map(([x,z]) => [x / 10,z / 10]), high = (p.y0_dm + p.h_dm) / 10;
      const boundary = data.plans[core.osm.slice(4) as "13759929" | "216503834" | "22989988" | "143429088"];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], f = frame(a, b);
        if (f.len < 6 || high < 14) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        if (Math.min(...boundary.map((q,j) => southFidelitySegmentDistanceV294(mx,mz,q,boundary[(j+1)%boundary.length]))) > .55) continue;
        const area = ring.reduce((sum,a,j) => { const b=ring[(j+1)%ring.length]; return sum+a[0]*b[1]-b[0]*a[1]; },0), out = (area > 0 ? -1 : 1) * (native ? .93 : .29);
        const tone = core.key === "forumTower" ? 0xc7c7b7 : 0xb48a69;
        for (let y = Math.max(8,p.y0_dm / 10 + 3); y < high - 1; y += core.key === "forumTower" ? 3.7 : 4.3)
          box(f.at(f.len / 2, y, out), [f.len - .15, .10, .26], tone, core.key + "-source-bound-secondary-sunshade", f.yaw);
        if (core.key === "theatreCasino" || core.key === "theatreNorth") for (let u=1.5;u<f.len-1;u+=4.5) box(f.at(u,11,out),[.13,10,.20],0x818d87,"theatre-casino-exposed-foyer-frame",f.yaw);
      }
    }
  }
  site = "atrium-tower";
  // The v266 green crown and full tower remain; small visible secondary frame
  // connectors are source-anchored on the already authored crown's four faces.
  for (const x of [58.8, 63.9]) for (const z of [1480.25, 1485.35]) for (const y of [100.8, 104.4, 108]) raw([x,y,z],[.22,.22,.22],0xc9d0c4,"atrium-green-crown-visible-fastener");
  site = "philharmonie";
  for (const [x,y,z,height,yaw] of concert.goldJoints) {
    for (const side of [-1,1]) box([x + Math.sin(yaw)*.08,y + side*(height/2-.12),z + Math.cos(yaw)*.08],[.14,.14,.08],0x8c7b4c,"philharmonie-source-panel-end-fastener",yaw);
  }
  for (const [x,y,z,width,height,yaw] of concert.foyerWindows) {
    if (width < 1.2 || height < 1.5) continue;
    box([x,y-.28,z],[width-.2,.055,.20],0xb6c4c0,"philharmonie-foyer-secondary-glazing-bar",yaw);
  }
  const roles: Record<string,number> = {};
  for (const r of [...rows,...triangles]) roles[r.role]=(roles[r.role]??0)+1;
  return { rows, triangles, roles };
}

export function southFidelityContainsV294(ring: readonly (readonly number[])[], x: number, z: number): boolean {
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;
}
export function southFidelitySegmentDistanceV294(x:number,z:number,a:readonly number[],b:readonly number[]):number {
  const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}

export function createSouthFidelityV294(native = false, options: { mobileLike?: boolean; diagnostics?: boolean } = {}): Group {
  const root=new Group();root.name="Southern named-site source architecture and open elevated railway v294";
  const model=southFidelityGeometryV294(native),geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
  const day=new MeshBasicMaterial(),night=new MeshStandardMaterial({roughness:.86});
  const mesh=new InstancedMesh(geometry,day,0),matrices=new Float32Array(model.rows.length*16),colors=new Float32Array(model.rows.length*3);
  const matrix=new Matrix4(),q=new Quaternion(),axis=new Vector3(0,1,0),p=new Vector3(),s=new Vector3(),tint=new Color();
  model.rows.forEach((r,i)=>{matrix.compose(p.set(...r.p),r.q?q.fromArray(r.q):q.setFromAxisAngle(axis,r.yaw),s.set(...r.s));matrix.toArray(matrices,i*16);tint.setHex(r.tone).toArray(colors,i*3);});
  mesh.count=model.rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);
  if(model.triangles.length){const positions=new Float32Array(model.triangles.length*9),color=new Float32Array(positions.length);let at=0;
    for(const t of model.triangles){tint.setHex(t.tone);for(const p of t.p){positions.set(p,at);tint.toArray(color,at);at+=3;}}
    const g=new BufferGeometry();g.setAttribute("position",new BufferAttribute(positions,3));g.setAttribute("color",new BufferAttribute(color,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const d=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),n=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.86}),m=new Mesh(g,d);m.userData={dayMaterial:d,nightMaterial:n,textureFree:true};root.add(m);
  }
  root.userData={...SOUTH_FIDELITY_V294_PROFILE,southFidelityV294:true,completeNkzOwners:true,sourceGeometryRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,instances:model.rows.length,triangles:model.triangles.length,roles:model.roles};
  root.add(createMauerContextV294(native,options));
  if(options.diagnostics)root.userData.records=model;
  return freezeStaticSceneTransforms(root);
}

export function hasCompleteSouthFidelityV294(root:Group):boolean {
  const roles=root.userData.roles as Record<string,number>|undefined;
  const shellComplete=root.userData.nativeMinecraft===true ? (roles?.["nkz-independent-source-skin"]??0)>100 : (roles?.["nkz-complete-retained-roof"]??0)>8&&(roles?.["nkz-complete-retained-wall-complement"]??0)>50;
  return root.userData.southFidelityV294===true && root.userData.completeNkzOwners===true && root.children.some(c=>c.userData.mauerContextV294===true&&c.userData.nativeMinecraft===root.userData.nativeMinecraft) && shellComplete && root.children.some(c=>c instanceof InstancedMesh&&c.count>1000) && (root.userData.nativeMinecraft===true || root.children.some(c=>c instanceof Mesh&&!(c instanceof InstancedMesh)&&c.geometry.getAttribute("position").count>100));
}

/** Granular physical structures match their represented geometry. Decorative
 * facade relief is never a whole-footprint ground obstacle. */
export function southFidelitySolidsV294(native=false) {
  const rows=southFidelityGeometryV294(native).rows.filter(r=>r.role.startsWith("u1-")&&["u1-source-course-elevated-deck","u1-slender-median-pier","u1-pier-crosshead"].includes(r.role)||r.role.startsWith("winterfeldt-market-")||r.role==="hasenheide-cinema-screen"||r.role==="hasenheide-naturtheater-stage");
  return rows.map(r=>{const[x,y,z]=r.p,[w,h,d]=r.s,c=Math.cos(r.yaw),s=Math.sin(r.yaw);return{ring:[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+c*u+s*v,z-s*u+c*v]),holes:[],minY:y-h/2,maxY:y+h/2,sourceId:"south-v294-"+r.role};});
}

export function southFidelityNkzSolidsV294() { return data.nkzShells.flatMap(s=>s.solids.map(p=>({...p,sourceId:s.owner}))); }

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
} from "three";
import { attachWorldSpaceDetail } from "./attachWorldSpaceDetail";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";
import { retailHostV378 } from "./retailV378Index";
import type {
  SurroundingChunkGeometry,
  SurroundingPolygon,
} from "./SurroundingCityGeometry";

type XY = [number, number];
type XYZ = [number, number, number];
type Rings = XY[][];
type Face = { centre: XY; axis: XY; length: number; entrance: string | null };
type Shell = {
  id: string;
  kind: string;
  height: number;
  rings: Rings;
  walls: [XY, XY][];
};
type Mode = {
  shells: Shell[];
  doors: [string, XY, XY, string, number][];
  front: Face | null;
};
type Site = {
  id: string;
  brand: string;
  name: string;
  studio: boolean;
  previousFacade: boolean;
  height: number;
  modes: { drawn: Mode; minecraft: Mode | null };
  parking: Rings[];
  court: Rings[];
  bays: Rings[];
  aisles: XY[][];
  solar: Rings[];
  portal?: [XY, XY][];
  identity?: Face;
};
const banks = {
  West: () => import("./data/retailSitesV378West.json"),
  NorthEast: () => import("./data/retailSitesV378NorthEast.json"),
  SouthEast: () => import("./data/retailSitesV378SouthEast.json"),
};
// The three values are the cladding, sign ground and inscription. Colours are drawn approximations.
const brandColours: Record<string, [number, number, number]> = {
  IKEA: [0x17558a, 0x145a96, 0xf4ca30],
  BAUHAUS: [0xb9bec0, 0xb63837, 0xf2eee2],
  OBI: [0xc3c2b9, 0xe47734, 0x272d2c],
  HELLWEG: [0xbcbdb1, 0xa33135, 0xf2ebdc],
  HORNBACH: [0xc0b7a3, 0xd5803c, 0x2e3334],
  toom: [0xc4c5b7, 0xa43a3b, 0xf3f0e4],
  "Globus Baumarkt": [0xbabcb6, 0xc56835, 0xfcf1d4],
  "Holz Possling": [0xb7ada0, 0x426553, 0xf0e6c9],
};

type Batch = ReturnType<typeof makeBatch>;
function makeBatch(ox: number, oz: number) {
  const positions: number[] = [],
    colours: number[] = [],
    indices: number[] = [];
  const palette = new Map<number, Color>();
  function vertex(p: XYZ, colour: number) {
    let c = palette.get(colour);
    if (!c) {
      c = new Color(colour);
      palette.set(colour, c);
    }
    const i = positions.length / 3;
    positions.push(p[0] - ox, p[1], p[2] - oz);
    colours.push(c.r, c.g, c.b);
    return i;
  }
  function quad(a: XYZ, b: XYZ, c: XYZ, d: XYZ, colour: number) {
    const start = vertex(a, colour);
    vertex(b, colour);
    vertex(c, colour);
    vertex(d, colour);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  function polygon(rings: Rings, y: number, colour: number) {
    const vectors = rings.map((r) =>
      r.map(([x, z]) => new Vector2(x - ox, z - oz)),
    );
    const triangles = ShapeUtils.triangulateShape(vectors[0], vectors.slice(1));
    const start = positions.length / 3;
    for (const ring of rings)
      for (const [x, z] of ring) vertex([x, y, z], colour);
    for (const [a, b, c] of triangles)
      indices.push(start + a, start + c, start + b);
  }
  function band(a: XY, b: XY, halfWidth: number, y: number, colour: number) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.01) return;
    const x = (-dz / len) * halfWidth,
      z = (dx / len) * halfWidth;
    quad(
      [a[0] + x, y, a[1] + z],
      [b[0] + x, y, b[1] + z],
      [b[0] - x, y, b[1] - z],
      [a[0] - x, y, a[1] - z],
      colour,
    );
  }
  return { positions, colours, indices, quad, polygon, band };
}
function facadePlane(batch: Batch, center: XY, axis: XY) {
  const point = (u: number, y: number, out: number): XYZ => [
    center[0] + u * axis[0] + out * axis[1],
    y,
    center[1] + u * axis[1] - out * axis[0],
  ];
  const panel = (
    l: number,
    r: number,
    lo: number,
    hi: number,
    out: number,
    colour: number,
  ) =>
    batch.quad(
      point(l, lo, out),
      point(r, lo, out),
      point(r, hi, out),
      point(l, hi, out),
      colour,
    );
  const cap = (
    l: number,
    r: number,
    y: number,
    depth: number,
    colour: number,
  ) =>
    batch.quad(
      point(l, y, 0.03),
      point(r, y, 0.03),
      point(r, y, depth),
      point(l, y, depth),
      colour,
    );
  return { point, panel, cap };
}
function warehouse(batch: Batch, shell: Shell, clad: number, ground: number) {
  const eaves = ground + shell.height,
    glass = shell.kind === "greenhouse",
    roofOnly = shell.kind === "roof";
  const top = glass ? 0xb3c7c0 : roofOnly ? 0xa6aaa4 : 0xbfc1bb;
  batch.polygon(shell.rings, eaves, top);
  for (const [a, b] of shell.walls) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const { panel, cap } = facadePlane(batch, a, [dx / len, dz / len]);
    if (roofOnly) {
      panel(0, len, eaves - 0.27, eaves, 0.025, 0x9a9f98);
      continue;
    }
    const tone = glass ? 0x91a9a4 : clad;
    panel(0, len, ground, eaves, 0, tone);
    panel(
      0,
      len,
      ground,
      ground + Math.min(0.55, shell.height * 0.1),
      0.04,
      0x817d73,
    );
    panel(0, len, eaves - 0.28, eaves + 0.08, 0.05, 0xaeb5b0);
    cap(0, len, eaves + 0.08, 0.11, 0xc8cdc5);
    if (glass) {
      for (let at = 2.4; at < len - 0.1; at += 2.4)
        panel(
          at - 0.05,
          at + 0.05,
          ground + 0.3,
          eaves - 0.23,
          0.065,
          0xc2cac5,
        );
      panel(
        0,
        len,
        ground + shell.height * 0.5,
        ground + shell.height * 0.5 + 0.08,
        0.055,
        0xb9c2bd,
      );
    } else if (len > 12) {
      for (let at = 6; at < len - 0.1; at += 6)
        panel(
          at - 0.035,
          at + 0.035,
          ground + 0.6,
          eaves - 0.3,
          0.035,
          0x818e92,
        );
    }
  }
}
// Source photographs show a yellow glazed entry on the two new IKEA envelopes.
// Each strip terminates at an actual OSM wall edge, including the returns at the entrance.
function ikeaEntrance(
  batch: Batch,
  edges: [XY, XY][],
  ground: number,
  height: number,
  waltersdorf: boolean,
) {
  const yellow = 0xe4bc36;
  for (const [a, b] of edges) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const plane = facadePlane(batch, a, [dx / len, dz / len]);
    const top = ground + height - 0.37;
    plane.panel(0, len, ground + 0.18, top, 0.082, yellow);
    const rows = waltersdorf
      ? [
          [0.08, 0.31],
          [0.45, 0.62],
          [0.77, 0.91],
        ]
      : [
          [0.1, 0.58],
          [0.72, 0.9],
        ];
    for (const [lo, hi] of rows) {
      const bottom = ground + height * lo,
        above = ground + height * hi;
      plane.panel(0.13, len - 0.13, bottom, above, 0.115, 0x708f9d);
      for (let u = 0.21; u < len - 0.12; u += 2.25)
        plane.panel(u - 0.045, u + 0.045, bottom, above, 0.132, 0xd1d2c3);
      plane.panel(
        0.13,
        len - 0.13,
        bottom + (above - bottom) * 0.56,
        bottom + (above - bottom) * 0.56 + 0.065,
        0.135,
        0xaeb8b5,
      );
    }
    plane.cap(
      0,
      len,
      ground + height * 0.35,
      waltersdorf ? 1.08 : 1.65,
      yellow,
    );
  }
}
function doorway(
  batch: Batch,
  door: Mode["doors"][number],
  ground: number,
  studio: boolean,
) {
  const [, centre, dir, role, available] = door;
  const service = role === "service" || role === "garage" || role === "loading";
  const publicDoor = role === "main" || role === "shop" || role === "yes";
  const width = Math.min(
    Math.max(1.12, available * 0.82),
    service ? 3.5 : publicDoor ? 3.6 : 1.4,
  );
  const height = service ? 3.4 : 2.8;
  const plane = facadePlane(batch, centre, dir);
  const { panel, cap } = plane;
  panel(
    -width / 2 - 0.1,
    width / 2 + 0.1,
    ground + 0.02,
    ground + height + 0.11,
    0.12,
    0x4e5757,
  );
  panel(
    -width / 2 + 0.08,
    width / 2 - 0.08,
    ground + 0.09,
    ground + height - 0.04,
    0.14,
    service ? 0x9da5a1 : publicDoor ? 0x8da9ac : 0x768887,
  );
  if (service) {
    for (let y = 0.45; y < height - 0.2; y += 0.42)
      panel(
        -width / 2 + 0.08,
        width / 2 - 0.08,
        ground + y,
        ground + y + 0.045,
        0.17,
        0x707e7d,
      );
  } else {
    panel(-0.04, 0.04, ground + 0.06, ground + height - 0.03, 0.16, 0x596a6b);
    panel(
      -width / 2 + 0.08,
      width / 2 - 0.08,
      ground + height - 0.51,
      ground + height - 0.44,
      0.16,
      0x637475,
    );
  }
  if (publicDoor && !studio) {
    cap(-width * 0.72, width * 0.72, ground + height + 0.28, 0.83, 0xc4c6bb);
    panel(
      -width * 0.72,
      width * 0.72,
      ground + height + 0.12,
      ground + height + 0.28,
      0.83,
      0x7f8b89,
    );
  }
}
function sign(
  batch: Batch,
  site: Site,
  front: Face,
  ground: number,
  colours: [number, number, number],
) {
  const text =
    site.brand === "Globus Baumarkt" ? "GLOBUS" : site.brand.toUpperCase();
  const maxWidth = Math.min(
    site.studio ? 6 : 24,
    Math.max(1.4, front.length * 0.77),
  );
  const natural = site.studio
    ? 0.62
    : Math.min(2.65, Math.max(0.95, site.height * 0.2));
  const capHeight = Math.min(
    natural,
    maxWidth / (letteringLayout(text, 1).totalWidthM + 1.0),
  );
  const layout = letteringLayout(text, capHeight),
    w = layout.totalWidthM / 2 + capHeight * 0.35;
  const baseline =
    ground + (site.studio ? 3.05 : Math.max(3.4, site.height * 0.7));
  const plane = facadePlane(batch, front.centre, front.axis);
  plane.panel(
    -w,
    w,
    baseline - capHeight * 0.17,
    baseline + capHeight * 1.15,
    0.21,
    colours[1],
  );
  for (const path of letteringStrokePaths(text, capHeight)) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy);
      if (!len) continue;
      const half = capHeight * 0.076,
        nx = (-dy / len) * half,
        ny = (dx / len) * half;
      batch.quad(
        plane.point(-a[0] - nx, baseline + a[1] + ny, 0.235),
        plane.point(-b[0] - nx, baseline + b[1] + ny, 0.235),
        plane.point(-b[0] + nx, baseline + b[1] - ny, 0.235),
        plane.point(-a[0] + nx, baseline + a[1] - ny, 0.235),
        colours[2],
      );
    }
  }
}
function local(rings: Rings, ox: number, oz: number): SurroundingPolygon {
  const points = rings.map((ring) => ring.map(([x, z]) => [x - ox, z - oz]));
  return { ring: points[0], holes: points.slice(1) };
}

/** Append one separately unloadable retail site. All surfaces are in the map's original world frame. */
export async function attachRetailV378(
  entry: SurroundingChunkGeometry,
  id: string,
  native: boolean,
  signal: AbortSignal,
) {
  const host = retailHostV378(id);
  if (!host) return;
  signal.throwIfAborted();
  const rows = (await banks[host.zone]()).default as unknown as Site[];
  signal.throwIfAborted();
  const site = rows.find((s) => s.id === id);
  if (!site) throw new Error("Missing retail packet " + id);
  const survey = (native ? site.modes.minecraft : null) ?? site.modes.drawn;
  const [x0, z0, x1, z1] = host.bounds,
    ox = Math.round((x0 + x1) / 2),
    oz = Math.round((z0 + z1) / 2);
  const batch = makeBatch(ox, oz);
  const ground = entry.nav.groundY;
  const colours = brandColours[site.brand];
  for (const ring of site.court) batch.polygon(ring, ground + 0.062, 0xbdbab1);
  for (const ring of site.parking)
    batch.polygon(ring, ground + 0.086, 0x919594);
  for (const line of site.aisles)
    for (let i = 1; i < line.length; i++)
      batch.band(line[i - 1], line[i], 2.15, ground + 0.105, 0x727977);
  for (const bay of site.bays)
    for (const ring of bay)
      for (let i = 0; i < ring.length; i++)
        batch.band(
          ring[i],
          ring[(i + 1) % ring.length],
          0.063,
          ground + 0.13,
          0xcecfc5,
        );
  for (const shell of survey.shells)
    warehouse(batch, shell, site.studio ? 0xb9bab0 : colours[0], ground);
  if (site.portal)
    ikeaEntrance(
      batch,
      site.portal,
      ground,
      site.height,
      id === "retail-v378-way-23492662",
    );
  for (const rings of site.solar)
    batch.polygon(rings, ground + site.height + 0.13, 0x526375);
  for (const door of survey.doors) doorway(batch, door, ground, site.studio);
  // The shop in Hallen am Borsigturm is a mapped indoor unit on level 1.
  // Keep the neutral shopping-centre entrance visible from the exterior camera.
  if (
    survey.front &&
    !site.previousFacade &&
    id !== "retail-v378-way-1556420080"
  )
    sign(batch, site, site.identity ?? survey.front, ground, colours);
  const [ex, , ez] = entry.origin;
  if (!batch.indices.length) return;
  const geometry = new BufferGeometry();
  geometry.setIndex(batch.indices);
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(batch.positions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(batch.colours), 3),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const night = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
    side: DoubleSide,
  });
  const day = native
    ? night
    : new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new Mesh(geometry, day);
  mesh.name = "Kartierter Einzelhandel · " + site.name;
  mesh.userData = {
    dayMaterial: day,
    nightMaterial: night,
    keepInMinecraft: true,
    retailSiteV378: site.id,
    retailShellsV378: survey.shells.map((s) => s.id),
  };
  mesh.position.set(ox, 0, oz);
  attachWorldSpaceDetail(entry, mesh);
  for (const rings of [...site.parking, ...site.court])
    entry.nav.ground.push(local(rings, ex, ez));
  for (const rings of site.parking)
    (entry.nav.roads ??= []).push(local(rings, ex, ez));
  for (const shell of survey.shells)
    if (shell.kind !== "roof")
      entry.nav.buildings.push({
        ...local(shell.rings, ex, ez),
        sourceId: "retail-v378:" + shell.id,
        height: shell.height,
        minHeight: 0,
      });
  entry.root.userData.retailSiteV378 = id;
}

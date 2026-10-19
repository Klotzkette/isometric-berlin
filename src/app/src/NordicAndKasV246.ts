import { BufferGeometry, Color, Float32BufferAttribute, Group, Uint8BufferAttribute } from "three";
import { type Builder, createBuilder, finishDrawnGroup } from "./drawnKit";
import source from "./data/nordicAndKasV246.json";

type Point = readonly [number, number];
type Face = { owner: string; osmWayId: string; style: string; edge: number; a: number[]; b: number[]; low: number; high: number; normal: number[] };
type Emission = { owner: string; role: string; vertices: number[]; color: number; double: boolean };

export const NORDIC_KAS_V246_PROFILE = {
  name: "Nordic embassies and Konrad-Adenauer-Stiftung source-bound details v246",
  nordicSite: "25999438",
  nordicHouses: ["26746070", "37428406", "26746069", "26746068", "26746067", "26746071"],
  kasOfficeOwners: ["33135651", "609711202"],
  retainedAcademy: "33755520",
  retainedCdu: "25999445",
  policy: "Retain all city shells, roofs, courts, navigation and v237 fittings. Only replace the old 26-box Nordic plaza arc. Source-ring copper screen and shallow source-wall material recognition; small subdivisions are estimates. Independent orthogonal native faces follow delivered columns. Equal full mobile detail.",
} as const;

/** Finite recipe, also exposed for independent source-plane and native audits. */
export function nordicKasEmissionsV246(native = false): Emission[] {
  const output: Emission[] = [];
  const quad = (owner: string, role: string, vertices: number[], color: number, reverse = false, double = false) => {
    output.push({ owner, role, vertices: reverse ? [2, 1, 0, 3].flatMap(i => vertices.slice(i * 3, i * 3 + 3)) : vertices, color, double });
  };
  const strip = (owner: string, role: string, a: Point, b: Point, low: number, high: number, color: number, double = false) => {
    const v = [a[0], low, a[1], b[0], low, b[1], b[0], high, b[1], a[0], high, a[1]];
    // Source rings are CCW in XZ; reverse this winding to face outwards.
    quad(owner, role, v, color, true, double);
  };
  const nativeFace = (a: Point, b: Point, normal: Point, low: number, high: number, out: number): [Point, Point][] => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const tangent: Point = [dx / length, dz / length];
    const axis = Math.abs(normal[0]) >= Math.abs(normal[1]) ? 0 : 1;
    const sign = normal[axis] > 0 ? 1 : -1;
    const slices = Math.max(1, Math.ceil(length / 1.8));
    const result: [Point, Point][] = [];
    for (let i = 0; i < slices; i++) {
      const q: [number, number] = [a[0] + dx * (i + .5) / slices, a[1] + dz * (i + .5) / slices];
      const hits = source.nativeCells.filter(c => c[2] <= low && c[3] >= high &&
        Math.abs((c[0] - q[0]) * tangent[0] + (c[1] - q[1]) * tangent[1]) <= length / slices / 2 + 2.2 &&
        Math.abs((c[0] - q[0]) * normal[0] + (c[1] - q[1]) * normal[1]) <= 4.4);
      if (!hits.length) continue;
      const face = (sign > 0 ? Math.max(...hits.map(c => c[axis])) : Math.min(...hits.map(c => c[axis]))) + sign * (source.nativeCellM / 2 + out);
      const half = length / slices * Math.abs(tangent[1 - axis]) / 2;
      q[axis] = face;
      result.push(axis === 0 ? [[q[0], q[1] - half], [q[0], q[1] + half]] : [[q[0] - half, q[1]], [q[0] + half, q[1]]]);
    }
    return result;
  };
  const panel = (f: Face, role: string, along: number, y: number, width: number, height: number, out: number, color: number) => {
    const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], length = Math.hypot(dx, dz);
    if (width <= 0 || height <= 0 || along - width / 2 < .015 || along + width / 2 > length - .015 || y - height / 2 < f.low + .025 || y + height / 2 > f.high - .15) return;
    const at = (u: number, depth: number): Point => [f.a[0] + dx / length * u + f.normal[0] * depth, f.a[1] + dz / length * u + f.normal[1] * depth];
    if (native) {
      for (const [a, b] of nativeFace(at(along - width / 2, 0), at(along + width / 2, 0), f.normal as unknown as Point, y - height / 2, y + height / 2, out + .03)) {
        // Both sides make orientation independent of the orthogonal axis.
        strip(f.owner, role, a, b, y - height / 2, y + height / 2, color, true);
      }
    } else strip(f.owner, role, at(along - width / 2, out), at(along + width / 2, out), y - height / 2, y + height / 2, color);
  };

  // The mapped path is open on Rauchstraße: never draw a fourth wall across
  // the public entrance/plaza. All 51 source segments retain their endpoints.
  for (const c of source.copper) {
    const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], length = Math.hypot(dx, dz);
    // The retained site ring is counter-clockwise in the XZ source plane.
    const n: Point = [dz / length, -dx / length];
    const segments: [Point, Point][] = [];
    if (!native) segments.push([[c.a[0] + n[0] * .14, c.a[1] + n[1] * .14], [c.b[0] + n[0] * .14, c.b[1] + n[1] * .14]]);
    else {
      // A rectilinear path follows the same boundary independently. Where the
      // source body has 4m columns, push the screen in front of that envelope.
      const steps = Math.max(1, Math.ceil(length / 2));
      for (let i = 0; i < steps; i++) {
        const a: Point = [c.a[0] + dx * i / steps, c.a[1] + dz * i / steps];
        const b: Point = [c.a[0] + dx * (i + 1) / steps, c.a[1] + dz * (i + 1) / steps];
        const actual = nativeFace(a, b, n, 5.4, 5.5, .17);
        if (actual.length) segments.push(...actual);
        else {
          // Freestanding spans between houses have no underlying column.
          const ax = Math.round(a[0] * 2) / 2 + n[0] * .18, az = Math.round(a[1] * 2) / 2 + n[1] * .18;
          const bx = Math.round(b[0] * 2) / 2 + n[0] * .18, bz = Math.round(b[1] * 2) / 2 + n[1] * .18;
          if (Math.abs(bx - ax) > .01) segments.push([[ax, az], [bx, az]]);
          if (Math.abs(bz - az) > .01) segments.push([[bx, az], [bx, bz]]);
        }
      }
    }
    for (let row = 0; row < 48; row++) {
      const y = 5.25 + row * 14.9 / 48;
      for (const [a, b] of segments) strip("25999438", "copper-lamella", a, b, y, y + .245, row % 5 === 0 ? 0x659985 : 0x70a28e, true);
    }
  }
  for (const f of source.faces) {
    const width = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), h = f.high - f.low;
    const p = (role: string, u: number, y: number, w: number, height: number, out: number, color: number) => panel(f, role, u, f.low + y, w, height, out, color);
    if (f.style.startsWith("kas")) {
      // Keep the full v237 opening rhythm. The new travertine field sits behind
      // its 0.15m glass, 0.19m mullions and 0.23m mapped door detailing.
      const tone = f.style === "kas-office" ? 0xcec0b6 : 0xd0cdc6;
      p("kas-travertine-field", width / 2, (h - .6) / 2, width - .08, h - .7, .035, tone);
      p("kas-flat-coping", width / 2, h - .32, width - .10, .12, .29, 0xb9b7af);
      for (let y = .7; y < h - .8; y += 1.05) p("kas-stone-course", width / 2, y, width - .10, .022, .065, 0xb8b0a4);
      const pitch = (h / 5 > 2.3 && h / 5 < 5.5) ? h / 5 : 3.1;
      const ph = Math.min(2.3, pitch - Math.min(1.05, pitch * .28) - .65);
      const bays = Math.max(1, Math.floor((width - 1.95) / 3.6 + 1));
      const first = (width - (bays - 1) * 3.6) / 2;
      const floors = Math.max(0, Math.floor((h - .8 - 1.05 - ph - .55) / pitch + 1));
      for (let level = 0; level < floors; level++) for (let bay = 0; bay < bays; bay++) {
        const u = first + bay * 3.6, y = Math.min(1.05, pitch * .28) + level * pitch + ph / 2;
        for (const edge of [-1, 1]) p("kas-stone-reveal", u + edge * .69, y, .085, ph + .32, .115, 0xe0d6c7);
        p("kas-stone-lintel", u, y + ph / 2 + .12, 1.46, .085, .115, 0xe0d6c7);
      }
      continue;
    }
    const stone = f.style === "iceland" ? 0x9d6253 : f.style === "felleshus" ? 0xac8b61 : f.style === "finland" ? 0xa8906d : f.style === "sweden" ? (f.normal[0] < -.5 ? 0x464d4c : 0xd9d6c9) : 0xa9bdb8;
    p("national-material", width / 2, (h - .3) / 2, width - .07, h - .4, .04, stone);
    if (f.style === "norway" && width < 4.5 && f.normal[1] > .6) {
      p("norwegian-granite-monolith", width / 2, (h - .2) / 2, width - .08, h - .3, .14, 0xa59d89);
      continue;
    }
    if (f.style === "iceland") {
      for (let y = .8; y < h - .5; y += 1.0) p("rhyolite-course", width / 2, y, width - .10, .025, .07, 0x805547);
      for (let y = 2.2; y < h - 1; y += 3.35) for (let u = 1.5; u < width - .7; u += 2.6) p("iceland-glazing", u, y, 1.05, 1.85, .105, 0x78918e);
      continue;
    }
    for (let level = 0; level < 4; level++) {
      const y = 1.85 + level * (h - 1.0) / 4;
      const ph = f.style === "felleshus" ? .75 : 2.35;
      p("national-glazing-band", width / 2, y, width - .3, ph, .09, f.style === "norway" ? 0xadc5bd : 0x829d9b);
      for (let u = .8; u < width - .3; u += 2.1) p("national-glazing-mullion", u, y, .055, ph, .14, 0xd1d5c8);
    }
    if (f.style === "finland") {
      // Larch screens, with alternating open shutter bays revealing glazing.
      for (let u = .22; u < width - .18; u += .36) if (Math.floor(u / 2.5) % 3 !== 1) p("finnish-larch-screen", u, (h - .4) / 2, .085, h - .5, .18, 0xb29a70);
    } else if (f.style === "felleshus") {
      for (let y = .35; y < h - .2; y += .24) {
        if ([0, 1, 2, 3].some(i => Math.abs(y - (1.85 + i * (h - 1) / 4)) < .42)) continue;
        p("felleshus-maple-course", width / 2, y, width - .12, .025, .08, 0x8f7654);
      }
    } else if (f.style === "denmark") {
      // Metal sun-screen cadence; no photographic perforation texture.
      for (let u = .4; u < width - .3; u += .8) p("danish-metal-screen", u, (h - .4) / 2, .07, h - .5, .18, 0xc3cbc6);
    } else if (f.style === "sweden" || f.style === "norway") {
      for (let y = .65; y < h - .3; y += .62) p("frosted-glass-sunshade", width / 2, y, width - .12, .045, .17, 0xc4d1c8);
    }
  }
  return output;
}

export function addNordicAndKasV246(builder: Builder, native = false): void {
  const items = nordicKasEmissionsV246(native);
  // One bounded typed batch, not thousands of temporary BufferGeometry objects.
  // Opposite faces share the same four vertices, preserving both visible sides.
  const positions = new Float32Array(items.length * 12);
  const colors = new Uint8Array(items.length * 12);
  const indices: number[] = [];
  const palette = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i], vertex = i * 4;
    positions.set(item.vertices, i * 12);
    let rgb = palette.get(item.color);
    if (!rgb) {
      const c = new Color(item.color);
      rgb = [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
      palette.set(item.color, rgb);
    }
    for (let v = 0; v < 4; v++) colors.set(rgb, i * 12 + v * 3);
    for (const offset of [0, 1, 2, 0, 2, 3]) indices.push(vertex + offset);
    if (item.double) for (const offset of [2, 1, 0, 3, 2, 0]) indices.push(vertex + offset);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Uint8BufferAttribute(colors, 3, true));
  geometry.setIndex(indices);
  builder.parts.push(geometry);
}

export function createMinecraftNordicAndKasV246(): Group {
  const builder = createBuilder();
  addNordicAndKasV246(builder, true);
  const group = finishDrawnGroup(builder, { name: "Minecraft " + NORDIC_KAS_V246_PROFILE.name })!;
  group.userData = { ...NORDIC_KAS_V246_PROFILE, keepInMinecraft: true, native: true };
  return group;
}

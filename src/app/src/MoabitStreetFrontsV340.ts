import { Group } from "three";
import data from "./data/moabitStreetFrontsV340.json";
import { GendarmenmarktFacadeBuilder, perimeterEdgeLength, perimeterFacadePoint, type PerimeterFacadeEdge } from "./GendarmenmarktFacadeBuilder";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import type { PrismBuilding } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";

type Style = "genaehr-left" | "genaehr-right" | "mueller-pair" | "gottlob" | "lande" | "kirch" | "perleberger";
type NativeFace = readonly [x: number, z: number, dx: number, dz: number, bottomDm: number, topDm: number, kind: number, edge: number, along: number];
type Source = {
  address: string;
  prism: PrismBuilding;
  style: Style;
  side: number;
  faces: readonly (readonly [edge: number, roads: readonly number[], bays: number])[];
  native: readonly NativeFace[];
};
type Face = {
  length: number;
  base: number;
  top: number;
  bays: number[];
  windowRows?: { centre: number; height: number }[];
  member: (u: number, y: number, w: number, h: number, d: number, c: number, out?: number, glass?: boolean) => void;
};
const sites = data.sites as unknown as readonly Source[];
const sourceIds = new Set(sites.map(s => s.prism.id));
const fingerprints = new Map(sites.map(s => [s.prism.id, JSON.stringify(s.prism)]));
const colours: Record<Style, { trim: number; wall: number; dark: number; panes: number }> = {
  "genaehr-left": { trim: 0xdeceaf, wall: 0xc0ad8d, dark: 0x8b735c, panes: 0x445a5b },
  "genaehr-right": { trim: 0xd4cab1, wall: 0xb4a88d, dark: 0x837965, panes: 0x465658 },
  "mueller-pair": { trim: 0xdcd1b9, wall: 0xb4a28b, dark: 0x87735f, panes: 0x43585a },
  gottlob: { trim: 0x8f4b3d, wall: 0xe0d9bd, dark: 0x746c5b, panes: 0x344e53 },
  lande: { trim: 0xd5c0a2, wall: 0xc4b093, dark: 0x4b515c, panes: 0x48595b },
  kirch: { trim: 0xc6bdb0, wall: 0xb7ada1, dark: 0x404849, panes: 0x566967 },
  perleberger: { trim: 0xe2ceb0, wall: 0xc4b096, dark: 0x8a7663, panes: 0x465b5d },
};
const IRON = 0x465453;
const BRONZE = 0x575146;

function isSourceRecord(building: unknown): building is PrismBuilding {
  return !!building && typeof building === "object" && "id" in building &&
    typeof building.id === "string" && sourceIds.has(building.id) &&
    JSON.stringify(building) === fingerprints.get(building.id);
}

function nativeInspectedRows(payload: VoxelPayload | undefined) {
  if (!payload?.building_rows || payload.cell_m !== 4 || payload.schema_version !== 2 ||
    Object.entries(data.grid).some(([k, n]) => payload.grid[k as keyof VoxelPayload["grid"]] !== n) ||
    JSON.stringify(payload.classes) !== JSON.stringify(data.classes)) return null;
  const { min_x_idx: x0, min_z_idx: z0 } = payload.grid;
  return (x: number, z: number) => payload.building_rows?.[z - z0]
    ?.filter(([start, width]) => x >= x0 + start && x < x0 + start + width) ?? [];
}

function nativeFacesKnown(site: Source, inspect: NonNullable<ReturnType<typeof nativeInspectedRows>>): boolean {
  return site.native.every(([x, z, dx, dz, bottom, top, kind]) => {
    const row = inspect(x, z);
    return row.length === 1 && row[0][2] === bottom && row[0][3] === top && row[0][4] === kind &&
      inspect(x + dx, z + dz).length === 0;
  });
}

function drawnFace(builder: GendarmenmarktFacadeBuilder, site: Source, edge: number, bays: number): Face {
  const { prism } = site;
  const source: PerimeterFacadeEdge = {
    startXZ: prism.ring[edge].map(n => n / 10),
    endXZ: prism.ring[(edge + 1) % prism.ring.length].map(n => n / 10),
    outwardSide: site.side, wallBaseY: prism.y0_dm / 10,
    wallTopY: (prism.y0_dm + prism.h_dm) / 10, street: site.address, prismId: prism.id,
  };
  const length = perimeterEdgeLength(source);
  const base = source.wallBaseY;
  // The retained generic Drawn roof can rise up to 5 m; keep the fittings
  // inside its wall section on hip/gable inputs. The source roof stays intact.
  const roofReserve = [3100, 3200, 3300, 3400].includes(prism.roof ?? 0) ? 5.05 : .16;
  const top = source.wallTopY - roofReserve;
  const yaw = -Math.atan2(source.endXZ[1] - source.startXZ[1], source.endXZ[0] - source.startXZ[0]);
  return {
    length, base, top, bays: Array.from({ length: bays }, (_, i) => length * (i + .5) / bays),
    member(u, y, w, h, d, c, out = .14, glass = false) {
      if (u - w / 2 < .045 || u + w / 2 > length - .045 || y - h / 2 < base + .035 || y + h / 2 > top) return;
      builder.box(perimeterFacadePoint(source, u, y, out), [w, h, d], c, yaw, glass ? "glass" : "stone");
    },
  };
}

function nativeFace(builder: GendarmenmarktFacadeBuilder, site: Source, row: NativeFace): Face {
  const [x, z, dx, dz, low, high] = row;
  const cx = x * 4 + 2 + dx * 2, cz = z * 4 + 2 + dz * 2;
  const base = low / 10, top = high / 10 - .18;
  // These exact owners either carry the retained five-floor tag at a
  // compatible original decimal-metre height or use the native fallback.
  const originalPitch = site.prism.h_dm / 50;
  const mapped = originalPitch >= 2.3 && originalPitch <= 5.5;
  const pitch = mapped ? originalPitch : 4;
  const sill = Math.min(1.05, pitch * .28);
  const height = mapped ? Math.min(2.3, pitch - sill - .65) : 2.75;
  const first = mapped ? base + sill + height / 2 : Math.ceil((base + 2) / 4) * 4;
  const windowRows: NonNullable<Face["windowRows"]> = [];
  for (let y = first; y + 1.2 <= high / 10; y += pitch) {
    if (y + height / 2 + .12 <= top) windowRows.push({ centre: y, height });
  }
  return {
    length: 4, base, top, bays: [2], windowRows,
    member(u, y, w, h, d, c, out = .14, glass = false) {
      if (u - w / 2 < .045 || u + w / 2 > 3.955 || y - h / 2 < base + .035 || y + h / 2 > top) return;
      builder.box([cx - dz * (u - 2) + dx * out, y, cz + dx * (u - 2) + dz * out],
        dx ? [d, h, w] : [w, h, d], c, 0, glass ? "glass" : "stone");
    },
  };
}

const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

function detailFront(face: Face, site: Source, edge: number, part: number, count: number, fraction?: number): void {
  const { base, top, length, bays, member, windowRows } = face;
  const { style } = site;
  const paint = colours[style];
  const native = fraction !== undefined;
  const center = (part + .5) / count;
  const short = site.prism.h_dm <= 100;
  const storeys = short ? 3 : 5;
  const bayWidth = length / bays.length;
  const pitch = (top - base - .50) / storeys;
  const wallWidth = length - .16;
  const width = Math.min(1.53, bayWidth * .65);
  const openingRows = windowRows ?? Array.from({ length: storeys - 1 }, (_, index) =>
    ({ centre: base + (index + 1.49) * pitch, height: Math.min(2.14, pitch * .65) }));
  const band = (y: number, h: number, d: number, colour = paint.trim, out = .14) => member(length / 2, y, wallWidth, h, d, colour, out);

  // The infill sits close to the retained wall. Door-sized gaps stay in the
  // base treatment, and the rail/door decorations begin above existing paths.
  if (style === "gottlob") {
    for (let i = 1; i < storeys; i++) {
      member(length / 2, base + (i + .5) * pitch, wallWidth, pitch - .14, .08, paint.wall, .076);
      band(base + i * pitch, .20, .24, paint.trim);
    }
    band(base + .34, .24, .25, paint.dark);
  }
  if (style === "perleberger" || style.startsWith("genaehr")) {
    const rows = style === "perleberger" ? storeys * 3 : 3;
    for (let i = 1; i <= rows; i++) {
      const y = base + i * pitch / 3;
      if (i <= 3) {
        for (let n = 0; n <= bays.length; n++) {
          const gap = Math.min(.68, bayWidth * .45);
          const u = clamp(n * bayWidth, gap / 2 + .08, length - gap / 2 - .08);
          member(u, y, gap, .065, .16, paint.dark, .145);
        }
      } else if (i % 3 === 0) band(y, .12, .14, paint.dark, .115);
    }
  }
  if (style === "lande") {
    band(base + .40, .3, .22, paint.dark);
    for (let n = 1; n < bays.length; n++) member(n * bayWidth, base + .8, .26, 1.28, .12, paint.dark, .10);
  }
  if (style !== "kirch") {
    band(top - .26, .19, .38);
    band(top - .49, .1, .22, paint.dark, .17);
    band(base + pitch + .08, .135, .26);
  }
  if (style === "perleberger" || style === "mueller-pair") {
    for (let i = 1; i <= Math.min(16, Math.floor(length)); i++) {
      member(length * i / (Math.min(16, Math.floor(length)) + 1), top - .46, .15, .23, .29, paint.trim, .265);
    }
  }
  for (let i = 0; i < bays.length; i++) {
    const u = bays[i];
    const global = native ? fraction : (part + (i + .5) / bays.length) / count;
    const inner = global > .36 && global < .64;
    const bayOnSide = global > .15 && global < .36 || global > .64 && global < .85;
    for (const [index, row] of openingRows.entries()) {
      const level = index + 1;
      const { centre: y, height } = row;
      const head = y + height / 2;
      const sill = y - height / 2;
      const broad = style === "gottlob" && bayOnSide || style === "lande" && bayOnSide || style === "perleberger" && edge === 6;
      const paneWidth = native ? 1.55 : width * (broad ? 1.12 : 1);
      const projecting = broad ? .25 : .095;
      // Frame overlays are attached slightly forward of the existing wall.
      // The old drawing remains in its batch, including side and courtyard ink.
      member(u, y, paneWidth, height, .065, paint.panes, .16 + projecting, true);
      member(u, y, .071, height, .09, paint.trim, .22 + projecting);
      member(u, y - height * .08, paneWidth, .075, .08, paint.trim, .22 + projecting);
      member(u, sill - .08, paneWidth + .20, .14, .25, paint.trim, .20 + projecting);
      if (style !== "kirch") {
        for (const side of [-1, 1]) {
          const jamb = u + side * (paneWidth / 2 + .085);
          member(jamb, y, style === "gottlob" ? .20 : .13, height + .06, .16, paint.trim, .205 + projecting);
          if (level === 1 && (broad || style === "genaehr-left")) {
            member(jamb, head + .025, .22, .32, .25, paint.trim, .25 + projecting);
          }
        }
        const tiered = style === "gottlob" || style === "perleberger" && (level === 2 || edge === 6) ||
          style.startsWith("genaehr") && (level === 1 || inner);
        member(u, head + .11, paneWidth + .30, .135, .28, paint.trim, .21 + projecting);
        if (tiered) {
          member(u, head + .22, paneWidth * .78, .09, .23, paint.trim, .212 + projecting);
          member(u, head + .30, paneWidth * .48, .08, .17, paint.trim, .214 + projecting);
        } else if (style === "lande" || style === "mueller-pair") {
          member(u, head + .21, .26, .12, .21, style === "lande" ? BRONZE : paint.trim, .22 + projecting);
        }
      }
      const wroughtIron = style === "kirch" && (part === 1 || part === 3) ||
        (style === "lande" || style === "mueller-pair") && bayOnSide && level <= 2;
      if (wroughtIron) {
        const railWidth = Math.max(.7, paneWidth + .15);
        const railOut = native ? .37 : .53;
        member(u, sill - .15, railWidth + .10, .105, .32, paint.trim, railOut - .08);
        member(u, sill + .77, railWidth, .07, .075, IRON, railOut);
        member(u, sill + .07, railWidth, .07, .075, IRON, railOut);
        const bars = native ? 4 : 6;
        for (let b = 0; b <= bars; b++) member(u + railWidth * (b / bars - .5),
          sill + .42, .055, .72, .06, IRON, railOut);
      }
      if (style === "gottlob" && broad) {
        member(u, sill - .04, paneWidth + .31, .18, .24, paint.trim, .30);
      }
    }
  }

  // Shallow gable relief stays under the retained roof edge. The present
  // source data does not transfer the measured whole roof or hidden masses.
  if ((style === "gottlob" || style === "lande" || style === "genaehr-left") && center >= .39 && center <= .61) {
    const w = Math.min(2.55, length * .60), steps = style === "gottlob" ? 4 : 3;
    for (let i = 0; i < steps; i++) member(length / 2, top - .71 + i * .13,
      w * (1 - .19 * i), .116, .24, paint.trim, .25);
    if (style === "lande") member(length / 2, top - .69, .21, .29, .15, BRONZE, .39);
  }
}

export function createMoabitStreetFrontsV340(buildings: readonly unknown[], native: boolean, payload?: VoxelPayload): Group | null {
  const inspect = native ? nativeInspectedRows(payload) : null;
  if (native && !inspect) return null;
  const ready = new Map<string, number>(), occurrences = new Map<string, number>();
  for (const record of buildings) {
    if (!record || typeof record !== "object" || !("id" in record) || typeof record.id !== "string" || !sourceIds.has(record.id)) continue;
    occurrences.set(record.id, (occurrences.get(record.id) ?? 0) + 1);
    if (isSourceRecord(record)) ready.set(record.id, (ready.get(record.id) ?? 0) + 1);
  }
  const builder = new GendarmenmarktFacadeBuilder(native);
  const addresses: string[] = [];
  const admittedIds: string[] = [];
  let faceCount = 0;
  for (const site of sites) {
    const id = site.prism.id;
    if (ready.get(id) !== 1 || occurrences.get(id) !== 1) continue;
    if (inspect) {
      if (!site.native.length || !nativeFacesKnown(site, inspect)) continue;
      for (const row of site.native) {
        const edge = row[7], part = site.faces.findIndex(face => face[0] === edge);
        detailFront(nativeFace(builder, site, row), site, edge, part, site.faces.length, row[8]);
      }
      faceCount += site.native.length;
    } else {
      for (const [part, [edge, , bays]] of site.faces.entries()) {
        detailFront(drawnFace(builder, site, edge, bays), site, edge, part, site.faces.length);
      }
      faceCount += site.faces.length;
    }
    addresses.push(site.address);
    admittedIds.push(id);
  }
  if (!addresses.length) return null;
  const root = builder.finish("Moabit — individual historic street fronts");
  if (!root.children.length) return null;
  root.userData = { ...root.userData, sourceAddresses: addresses, sourcePrismIds: admittedIds, sourceFaceCount: faceCount };
  return freezeStaticSceneTransforms(root);
}

import fronts from "./data/lehrterKulturhausFrontsV366.json";
import {
  GendarmenmarktFacadeBuilder,
  perimeterEdgeLength,
  perimeterFacadePoint,
  type PerimeterFacadeEdge,
} from "./GendarmenmarktFacadeBuilder";
import type { PrismBuilding } from "./IsometricCityWorld";
import { letteringStrokePaths } from "./drawnLettering";
import { LEHRTER_BRICK, lehrterKulturhausOwnerV366 } from "./lehrterKulturhausProfileV366";
import type { VoxelPayload } from "./terrainPayload";

const DARK_BRICK = 0x784b40,
  RED_HEADER = 0xaf7160,
  SILTSTONE = 0xcabbab;
const BASE = 0x706960,
  GLASS = 0x56676a,
  GREEN_FRAME = 0x495b54;
type Picture = "stone" | "glass" | "segmental-glass";
type Front = (typeof fronts)[number];
type DetailFace = {
  native: boolean;
  span: number;
  height: number;
  add(
    u: number,
    y: number,
    w: number,
    h: number,
    color: number,
    offset: number,
    depth: number,
    kind?: Picture
  ): void;
};

function surface(builder: GendarmenmarktFacadeBuilder, edge: PerimeterFacadeEdge): DetailFace {
  const span = perimeterEdgeLength(edge);
  const yaw = -Math.atan2(edge.endXZ[1] - edge.startXZ[1], edge.endXZ[0] - edge.startXZ[0]);
  return {
    native: builder.minecraft,
    span,
    height: edge.wallTopY - edge.wallBaseY,
    add(u, y, w, h, color, offset, depth, kind = "stone") {
      if (w < 0.025 || h < 0.025) return;
      const p = perimeterFacadePoint(edge, u, edge.wallBaseY + y, offset);
      if (builder.minecraft) {
        const alongX = Math.abs(edge.endXZ[0] - edge.startXZ[0]) > 0;
        builder.box(
          p,
          alongX ? [w, h, depth] : [depth, h, w],
          color,
          0,
          kind === "stone" ? "stone" : "glass"
        );
      } else builder.box(p, [w, h, depth], color, yaw, kind);
    },
  };
}

function decorate(face: DetailFace, style: string, bays: number): void {
  const { span, height, add } = face;
  const court = style.startsWith("court"),
    music = style.startsWith("music");
  const floors = court ? 3 : 4;
  const cap = height - 0.16,
    plinth = 0.46;
  const floorPitch = (cap - plinth - 0.65) / floors;
  const bayPitch = span / bays;
  const band = (y: number, h: number, col: number) => add(span / 2, y, span - 0.025, h, col, 0.245, 0.092);
  // An opaque thin brick face covers the old generic pane grid only on
  // this documented exterior. Native dimensions use its actual cell plane.
  add(span / 2, height / 2, span - 0.01, height - 0.06, LEHRTER_BRICK, 0.16, 0.09);
  band(plinth / 2, plinth, BASE);
  band(cap, 0.17, DARK_BRICK);
  band(cap - 0.22, 0.085, RED_HEADER);
  if (music) band(plinth + floorPitch + 0.44, 0.18, DARK_BRICK);
  if (music && style !== "music-front") band(cap - 0.82, 0.77, 0xd8c5ab);
  if (court) band(plinth + 0.66, 0.19, RED_HEADER);
  for (let bay = 0; bay < bays; bay++) {
    const u = (bay + 0.5) * bayPitch;
    const w = Math.min(bayPitch * 0.53, style === "court-end" ? 2.08 : 1.38);
    const window = (
      center: number,
      width: number,
      h: number,
      arched: boolean,
      barred: boolean,
      outset = 0
    ) => {
      const off = 0.26 + outset,
        frame = music ? GREEN_FRAME : DARK_BRICK;
      // Horizontal bands share their material with the surround and recess.
      const kind = arched && !face.native ? "segmental-glass" : "glass";
      add(u, center + 0.065, width + 0.21, h + 0.27, RED_HEADER, off + 0.03, 0.09, "stone");
      add(u, center, width, h, GLASS, off + 0.106, 0.067, kind);
      add(u, center - h / 2 - 0.05, width + 0.2, 0.104, DARK_BRICK, off + 0.14, 0.17);
      add(u, center + h * 0.2, width - 0.055, 0.058, frame, off + 0.152, 0.046);
      if (width > 1.15 || barred) add(u, center - 0.04, 0.065, h - 0.16, frame, off + 0.15, 0.045);
      if (barred && h > 0.6) {
        for (const fraction of [-0.27, 0.27])
          add(u + width * fraction, center - 0.03, 0.035, h - 0.16, frame, off + 0.168, 0.035);
        add(u, center - 0.1, width - 0.05, 0.035, frame, off + 0.168, 0.035);
      }
    };
    if (style !== "court-entry") window(0.69, Math.min(0.97, w * 0.83), 0.53, true, true);
    for (let level = 0; level < floors; level++) {
      const header = plinth + floorPitch * (level + 1) + 0.3;
      if (style === "court-entry" && level === 0) {
        const door = Math.min(2.45, span * 0.78);
        add(u, 2.0, door + 0.34, 3.94, SILTSTONE, 0.33, 0.18);
        add(u, 1.85, door, 3.64, 0x695b50, 0.46, 0.16, face.native ? "glass" : "segmental-glass");
        add(u, 1.75, 0.07, 3.35, DARK_BRICK, 0.57, 0.07);
        continue;
      }
      // Renner's post-conversion photos show groups of taller studio windows
      // between retained short upper openings, with a common arch spring line.
      const short = music && level > 0 && style !== "music-end" && bay % 3 !== 0;
      const h = short
        ? Math.min(1.15, floorPitch * 0.33)
        : Math.min(court && level === 2 ? 3.2 : 2.35, floorPitch * 0.64);
      const arched = music || (court && level === 2) || level === 0;
      const oriel = style === "oriel" && bay === bays - 1 && level === 1;
      if (oriel) {
        add(u, header - h / 2, w + 0.64, h + 0.6, 0xb68171, 0.54, 0.57);
        add(u, header + 0.4, w + 0.91, 0.18, 0x68716d, 0.58, 0.77);
      }
      if (style === "court-end" && level === 2 && !face.native)
        add(u, header + 0.08, w + 0.58, 0.14, SILTSTONE, 0.29, 0.09);
      window(header - h / 2, w, h, arched, music && short, oriel ? 0.58 : 0);
    }
  }
}

function columnMatches(payload: VoxelPayload, x: number, z: number, expected?: number[]): boolean {
  const col = x - payload.grid.min_x_idx;
  const rows =
    payload.building_rows?.[z - payload.grid.min_z_idx]?.filter(([s, n]) => col >= s && col < s + n) ?? [];
  return expected === undefined
    ? rows.length === 0
    : rows.length === 1 && expected.every((value, i) => rows[0][i + 2] === value);
}

function drawnEdge(prism: PrismBuilding, front: Front, lo: number, hi: number): PerimeterFacadeEdge {
  const p = prism.ring[front.edge],
    q = prism.ring[(front.edge + 1) % prism.ring.length];
  const dx = q[0] - p[0],
    dz = q[1] - p[1],
    len = Math.hypot(dx, dz);
  const at = (u: number) => [p[0] / 10 + (dx / len) * u, p[1] / 10 + (dz / len) * u];
  // For the two surveyed roofs these are the exact GML wall tops. For the
  // court, fittings stop below the lower verified eave of the main roof.
  const height = prism.id === "mO1M4nzw" ? 16.871 : prism.id === "24ruzruS" ? 17.339 : 14.332;
  return {
    startXZ: at(lo),
    endXZ: at(hi),
    outwardSide: front.side,
    wallBaseY: prism.y0_dm / 10,
    wallTopY: prism.y0_dm / 10 + height,
    prismId: prism.id,
    street: "Lehrter Straße",
  };
}

function gate(
  builder: GendarmenmarktFacadeBuilder,
  a: number[],
  b: number[],
  base: number,
  artSign: boolean,
  payload?: VoxelPayload
): boolean {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 7 || length > 11.5) return false;
  const axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const normal = [-axis[1], axis[0]];
  const edge: PerimeterFacadeEdge = {
    startXZ: a,
    endXZ: b,
    wallBaseY: base,
    wallTopY: base + 5.45,
    outwardSide: 1,
    prismId: "JuHnDm1r",
    street: "Lehrter Straße",
  };
  const half = Math.min(length * 0.192, 1.95),
    spring = 3.02,
    rise = 0.87,
    top = 5.36;
  const pieces = Math.ceil(length / (builder.minecraft ? 0.37 : 0.16)),
    step = length / pieces;
  const yaw = -Math.atan2(axis[1], axis[0]);
  const put = (u: number, y: number, w: number, h: number, d: number, out: number, c: number) => {
    const pt = perimeterFacadePoint(edge, u, base + y, out);
    if (builder.minecraft) {
      if (payload && !columnMatches(payload, Math.floor(pt[0] / 4), Math.floor(pt[2] / 4))) return;
      builder.box(
        pt,
        [Math.abs(axis[0]) * w + Math.abs(normal[0]) * d, h, Math.abs(axis[1]) * w + Math.abs(normal[1]) * d],
        c
      );
    } else builder.box(pt, [w, h, d], c, yaw);
  };
  // Pier and arch follow the two retained street-wall ends; the opening
  // is kept empty all the way down to the historic threshold.
  for (let i = 0; i < pieces; i++) {
    const u = (i + 0.5) * step,
      delta = Math.abs(u - length / 2);
    const opening = delta < half ? spring + rise * Math.sqrt(1 - (delta / half) ** 2) : 0;
    put(u, (opening + top) / 2, step + 0.004, top - opening, 0.33, 0, LEHRTER_BRICK);
    if (opening) put(u, opening + 0.135, step + 0.002, 0.27, 0.39, 0.015, RED_HEADER);
    if (delta > half && delta < half + 0.29) put(u, spring / 2, step + 0.003, spring, 0.42, 0.03, RED_HEADER);
  }
  if (artSign) {
    for (const path of letteringStrokePaths("KUNST", 0.54))
      for (let k = 1; k < path.length; k++) {
        const [x0, y0] = path[k - 1],
          [x1, y1] = path[k];
        if (!builder.minecraft) {
          builder.beam(
            perimeterFacadePoint(edge, length / 2 + x0, base + 4.63 + y0, 0.22),
            perimeterFacadePoint(edge, length / 2 + x1, base + 4.63 + y1, 0.22),
            0.049,
            0x90cea8
          );
        } else {
          const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.075));
          for (let j = 0; j <= n; j++)
            put(
              length / 2 + x0 + ((x1 - x0) * j) / n,
              4.63 + y0 + ((y1 - y0) * j) / n,
              0.082,
              0.082,
              0.065,
              0.22,
              0x90cea8
            );
        }
      }
  }
  return true;
}

export function appendLehrterKulturhausV366(
  builder: GendarmenmarktFacadeBuilder,
  buildings: readonly unknown[],
  native: boolean,
  payload?: VoxelPayload
): string[] {
  if (
    native !== builder.minecraft ||
    (native &&
      (!payload?.building_rows ||
        payload.cell_m !== 4 ||
        payload.schema_version !== 2 ||
        payload.classes[3] !== "concrete"))
  )
    return [];
  const byId = new Map<string, PrismBuilding>(),
    duplicates = new Set<string>();
  const ids = new Set(["mO1M4nzw", "24ruzruS", "ia66KyBc", "JuHnDm1r", "Od9FgiX1", "7s8cBB6l", "TluIell9"]);
  const seen = new Set<string>();
  for (const part of buildings) {
    if (
      !part ||
      typeof part !== "object" ||
      !("id" in part) ||
      typeof part.id !== "string" ||
      !ids.has(part.id)
    )
      continue;
    if (seen.has(part.id)) duplicates.add(part.id);
    seen.add(part.id);
    if (lehrterKulturhausOwnerV366(part)) byId.set(part.id, part as PrismBuilding);
  }
  duplicates.forEach((id) => byId.delete(id));
  const admitted = new Set<string>(),
    used = new Set<string>();
  for (const front of fronts) {
    const part = byId.get(front.owner);
    if (!part) continue;
    for (const [lo, hi] of front.spans) {
      if (!native) {
        decorate(surface(builder, drawnEdge(part, front, lo, hi)), front.style, front.bays);
        admitted.add(part.id);
      }
    }
    if (native && payload) {
      for (const [x, z, dx, dz, low, high, kind] of front.native) {
        const key = [x, z, dx, dz].join(",");
        if (
          used.has(key) ||
          !columnMatches(payload, x, z, [low, high, kind]) ||
          !columnMatches(payload, x + dx, z + dz)
        )
          continue;
        const cx = x * 4 + 2 + dx * 2,
          cz = z * 4 + 2 + dz * 2;
        const edge = {
          startXZ: [cx - dz * 2, cz + dx * 2],
          endXZ: [cx + dz * 2, cz - dx * 2],
          outwardSide: 1,
          wallBaseY: low / 10,
          wallTopY: high / 10,
          prismId: part.id,
          street: "Lehrter Straße",
        };
        decorate(surface(builder, edge), front.style, front.style === "music-yard" ? 2 : 1);
        used.add(key);
        admitted.add(part.id);
      }
    }
  }
  const admin = byId.get("mO1M4nzw"),
    music = byId.get("24ruzruS"),
    court = byId.get("7s8cBB6l");
  const point = (p: PrismBuilding, i: number) => p.ring[i].map((v) => v / 10);
  if (
    admin &&
    music &&
    byId.has("JuHnDm1r") &&
    admitted.has(admin.id) &&
    admitted.has(music.id) &&
    gate(builder, point(admin, 19), point(music, 9), admin.y0_dm / 10, true, payload)
  )
    admitted.add("JuHnDm1r");
  if (
    music &&
    court &&
    byId.has("Od9FgiX1") &&
    admitted.has(court.id) &&
    admitted.has(music.id) &&
    gate(builder, point(music, 8), point(court, 1), music.y0_dm / 10, false, payload)
  )
    admitted.add("Od9FgiX1");
  return [...admitted];
}

export { applyLehrterClinkerV366 } from "./lehrterClinkerV366";

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  ARCHITECTURAL_EDGE_THRESHOLD_DEGREES,
  markArchitecturalInk,
} from "./architecturalInk";
import { type VoxelPayload, worldGroundSampler } from "./MinecraftVoxelWorld";
import type { StreetDetailsPayload } from "./TrafficSignals";

/**
 * The three `amenity=fuel` sites in the bounds, drawn as forecourts.
 *
 * OSM maps the position, the brand and the fuel grades. Only the Shell on
 * Paulstraße carries a footprint; the Aral and the Esso are single nodes,
 * so the exporter turns the nearest frontage road a quarter turn to get
 * the axis a canopy would stand on. Canopy, pump islands and price totem
 * are a standard German forecourt rather than surveyed geometry, so the
 * group is flagged extrapolated.
 */

const DECK = 0xf0ede4;
const SOFFIT = 0xe4e0d4;
const POST = 0xb9b5aa;
const KERB = 0xcfcabc;
const DISPENSER = 0xdedad0;
const TOTEM_FACE = 0xf6f4ec;

/** Fascia colours from the brands' own liveries. */
const BRAND_COLORS: Record<string, number> = {
  Aral: 0x0a4f9c,
  Esso: 0xd8382c,
  Shell: 0xf2c318,
};
const BRAND_FALLBACK = 0xa8a49a;

const CANOPY_TOP_M = 5.4;
const CANOPY_THICKNESS_M = 0.9;
const FASCIA_HEIGHT_M = 0.55;
const POST_SIZE_M = 0.55;
const CANOPY_MIN_LENGTH_M = 14;
const CANOPY_MAX_LENGTH_M = 20;
const CANOPY_MIN_DEPTH_M = 11;
const CANOPY_MAX_DEPTH_M = 15;

type Builder = {
  edges: BufferGeometry[];
  parts: BufferGeometry[];
};

function box(
  builder: Builder,
  color: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotationY: number,
  inked = true,
): void {
  const geometry = new BoxGeometry(sx, sy, sz);
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  geometry.translate(cx, cy, cz);
  geometry.deleteAttribute("uv");
  const paint = new Color(color);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    colors[index * 3] = paint.r;
    colors[index * 3 + 1] = paint.g;
    colors[index * 3 + 2] = paint.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  builder.parts.push(geometry);
  if (inked) {
    builder.edges.push(
      new EdgesGeometry(geometry, ARCHITECTURAL_EDGE_THRESHOLD_DEGREES),
    );
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function buildStation(
  builder: Builder,
  station: NonNullable<StreetDetailsPayload["fuel_stations"]>[number],
  ground: number,
): void {
  const cx = station.x_dm / 10;
  const cz = station.z_dm / 10;
  const [ax, az] = station.axis;
  // Unit normal of the forecourt axis, so `at` can address the whole slab.
  const nx = -az;
  const nz = ax;
  const rotation = Math.atan2(az, ax);
  const at = (along: number, across: number): [number, number] => [
    cx + ax * along + nx * across,
    cz + az * along + nz * across,
  ];
  const length = clamp(
    station.w_dm / 10,
    CANOPY_MIN_LENGTH_M,
    CANOPY_MAX_LENGTH_M,
  );
  const depth = clamp(station.d_dm / 10, CANOPY_MIN_DEPTH_M, CANOPY_MAX_DEPTH_M);
  const brand = BRAND_COLORS[station.name] ?? BRAND_FALLBACK;

  // Deck: a pale soffit slab with the brand's fascia band wrapped round it,
  // which is what makes a filling station readable from across a street.
  const soffitY = CANOPY_TOP_M - CANOPY_THICKNESS_M;
  box(
    builder, SOFFIT,
    cx, ground + soffitY + 0.16, cz,
    length, 0.32, depth,
    rotation,
  );
  box(
    builder, brand,
    cx, ground + soffitY + 0.32 + FASCIA_HEIGHT_M / 2, cz,
    length + 0.3, FASCIA_HEIGHT_M, depth + 0.3,
    rotation,
  );
  box(
    builder, DECK,
    cx, ground + CANOPY_TOP_M - 0.11, cz,
    length + 0.3, 0.22, depth + 0.3,
    rotation,
  );

  // Four columns, set in from the corners the way the deck cantilevers.
  for (const alongSide of [-1, 1]) {
    for (const acrossSide of [-1, 1]) {
      const [px, pz] = at(
        (alongSide * (length - 4.4)) / 2,
        (acrossSide * (depth - 4.4)) / 2,
      );
      box(
        builder, POST,
        px, ground + soffitY / 2, pz,
        POST_SIZE_M, soffitY, POST_SIZE_M,
        rotation,
      );
    }
  }

  // Two pump islands under the deck, each with a dispenser at either end.
  for (const side of [-1, 1]) {
    const across = (side * depth) / 4;
    const [kx, kz] = at(0, across);
    box(
      builder, KERB,
      kx, ground + 0.17, kz,
      length - 6, 0.34, 1.7,
      rotation,
    );
    for (const end of [-1, 1]) {
      const [dx, dz] = at((end * (length - 6)) / 4, across);
      box(
        builder, DISPENSER,
        dx, ground + 0.34 + 0.85, dz,
        0.62, 1.7, 0.98,
        rotation,
      );
      box(
        builder, brand,
        dx, ground + 0.34 + 1.62, dz,
        0.68, 0.24, 1.04,
        rotation,
        false,
      );
    }
  }

  // Price totem at the entrance corner: post, brand board, price face.
  const [tx, tz] = at(length / 2 + 2.6, depth / 2 - 1.2);
  box(builder, POST, tx, ground + 2.1, tz, 0.34, 4.2, 0.34, rotation);
  box(
    builder, brand,
    tx, ground + 4.2 + 1.3, tz,
    2.3, 2.6, 0.38,
    rotation,
  );
  box(
    builder, TOTEM_FACE,
    tx + nx * 0.24, ground + 4.2 + 1.05, tz + nz * 0.24,
    1.9, 1.7, 0.12,
    rotation,
    false,
  );
}

export function createFuelStations(
  street: StreetDetailsPayload,
  ground: VoxelPayload,
): Group | null {
  const stations = street.fuel_stations;
  if (!stations || stations.length === 0) {
    return null;
  }
  const sample = worldGroundSampler(ground);
  const builder: Builder = { edges: [], parts: [] };
  for (const station of stations) {
    const y = sample(station.x_dm / 10, station.z_dm / 10);
    if (y === null) {
      continue;
    }
    buildStation(builder, station, y);
  }
  if (builder.parts.length === 0) {
    return null;
  }
  const group = new Group();
  group.name = "OSM filling stations";
  // Positions and brands are surveyed; the forecourt kit is not.
  group.userData.extrapolated = true;

  const merged = mergeGeometries(builder.parts, false);
  if (merged) {
    const dayMaterial = new MeshBasicMaterial({ vertexColors: true });
    const nightMaterial = new MeshStandardMaterial({
      flatShading: true,
      metalness: 0,
      roughness: 0.9,
      vertexColors: true,
    });
    const mesh = new Mesh(merged, dayMaterial);
    mesh.name = "filling station bodies";
    mesh.userData.dayMaterial = dayMaterial;
    mesh.userData.nightMaterial = nightMaterial;
    group.add(mesh);
    for (const part of builder.parts) {
      part.dispose();
    }
  }
  const inkGeometry = mergeGeometries(builder.edges, false);
  if (inkGeometry) {
    const ink = new LineSegments(
      inkGeometry,
      markArchitecturalInk(new LineBasicMaterial(), "detail"),
    );
    ink.name = "filling station ink lines";
    ink.renderOrder = 2;
    group.add(ink);
    for (const edge of builder.edges) {
      edge.dispose();
    }
  }
  return group;
}

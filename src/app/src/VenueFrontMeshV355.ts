import { civicPlateMeshV350, type CivicPlateV350, type WallPlateStyle } from "./CivicFacilitiesV350";
import type { NeighbourhoodPlanV300, NeighbourhoodSourceV300 } from "./NeighbourhoodPacketV300";
import type { SurroundingPackedMesh } from "./SurroundingCityGeometry";
import { surroundingPacketFingerprint } from "./surroundingPacketFingerprint";

export const VENUE_FRONTS_KIND_V355 = "venue-fronts-v355";
export const VENUE_FRONTS_KIND_V356 = "venue-fronts-v356";
export const VENUE_FRONTS_KIND_V357 = "venue-fronts-v357";
const categories = ["FINANZAMT", "BURGERAMT", "POLIZEI", "AUTOHAUS", "EINKAUFSCENTER", "DONER", "CLUB", "KNEIPE", "RESTAURANT", "UNTERNEHMEN", "KRANKENKASSE"];
function linear(rgb: number[]): number[] {
  return rgb.map(value => {
    const srgb = value / 255;
    return Math.round(255 * (srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4));
  });
}
const palette = [
  { background: linear([218, 212, 196]), title: linear([63, 47, 38]), name: linear([35, 39, 37]) },
  { background: linear([226, 228, 225]), title: linear([48, 60, 62]), name: linear([35, 39, 37]) },
  { background: linear([44, 71, 110]), title: linear([245, 245, 236]), name: linear([228, 233, 240]) },
  { background: linear([48, 56, 61]), title: linear([244, 246, 241]), name: linear([225, 229, 229]) },
  { background: linear([224, 216, 196]), title: linear([80, 57, 41]), name: linear([49, 45, 40]) },
  { background: linear([236, 225, 207]), title: linear([92, 54, 41]), name: linear([52, 39, 31]) },
  { background: linear([48, 45, 53]), title: linear([223, 218, 228]), name: linear([241, 239, 241]) },
  { background: linear([74, 53, 44]), title: linear([230, 218, 194]), name: linear([243, 228, 201]) },
  { background: linear([111, 54, 43]), title: linear([241, 222, 188]), name: linear([248, 233, 205]) },
  { background: linear([60, 66, 73]), title: linear([228, 234, 236]), name: linear([246, 246, 243]) },
  { background: linear([224, 231, 219]), title: linear([42, 77, 63]), name: linear([35, 57, 48]) },
];

export type VenuePlate = CivicPlateV350;
export type VenuePanel = {
  anchor: VenuePlate;
  height: number;
  finish: "horizontal-lamellae" | "vertical-lamellae" | "glazing" | "panel";
  fill: [number, number, number];
  frame: [number, number, number];
  count: number;
};

/** Same dimensions in the two modes, on independently supported wall spans. */
export function appendVenuePanelsV355(
  mesh: SurroundingPackedMesh, panels: readonly VenuePanel[], native: boolean,
): SurroundingPackedMesh {
  if (!panels.length) return mesh;
  if (panels.length > 32) throw new Error("Too many facade panels");
  const unpack = (data: string) => Uint8Array.from(atob(data), char => char.charCodeAt(0));
  const positions = Array.from(new Uint16Array(unpack(mesh.positions).buffer));
  const colours = Array.from(unpack(mesh.colors));
  const indices = Array.from(new Uint32Array(unpack(mesh.indices).buffer));
  const encode = (bytes: Uint8Array) => {
    let output = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      output += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(output);
  };
  for (const { anchor, height, finish, fill, frame, count } of panels) {
    const [x, y, z, dx, dz, nx, nz, width] = anchor;
    if (!Number.isInteger(count) || count < 1 || count > 64 ||
        width < 70 || width > 10000 || height < 40 || height > 1500 ||
        !["horizontal-lamellae", "vertical-lamellae", "glazing", "panel"].includes(finish) ||
        ![...fill, ...frame].every(value => Number.isInteger(value) && value >= 0 && value <= 255) ||
        Math.abs(Math.hypot(dx, dz) - 1e6) > 2 || Math.abs(Math.hypot(nx, nz) - 1e6) > 2 ||
        Math.abs(dx * nx + dz * nz) > 2e6 || (native && ![0, 1e6, -1e6].includes(dx))) {
      throw new Error("Invalid photo-referenced facade panel");
    }
    const quad = (left: number, bottom: number, right: number, top: number, depth: number, rgb: number[]) => {
      const start = positions.length / 3;
      for (const [u, v] of [[left, bottom], [right, bottom], [right, top], [left, top]]) {
        const p = [x + (dx * u + nx * depth) / 1e6, y + v, z + (dz * u + nz * depth) / 1e6].map(Math.round);
        if (p.some(value => !Number.isInteger(value) || value < 0 || value > 65535)) {
          throw new Error("Facade panel escaped its packet");
        }
        positions.push(...p);
        colours.push(...rgb);
      }
      if (dx * nz - dz * nx > 0) indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      else indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
    };
    const background = linear(fill), trim = linear(frame);
    const w = width / 2, h = height / 2;
    quad(-w, -h, w, h, 2, background);
    if (finish === "horizontal-lamellae") {
      const pitch = height / count;
      for (let i = 0; i < count; i++) {
        const bottom = -h + i * pitch + pitch * 0.18;
        quad(-w, bottom, w, bottom + pitch * 0.64, 5, trim);
      }
    } else {
      const pitch = width / count;
      const trimWidth = Math.min(finish === "glazing" ? 12 : 5, pitch * 0.16);
      for (let i = 1; i < count; i++) {
        const left = -w + i * pitch - trimWidth / 2;
        quad(left, -h, left + trimWidth, h, 5, trim);
      }
      quad(-w, -h, w, -h + 5, 5, trim);
      quad(-w, h - 5, w, h, 5, trim);
      if (finish === "glazing") quad(-w, -4, w, 4, 6, trim);
    }
  }
  return {
    ...mesh,
    positions: encode(new Uint8Array(new Uint16Array(positions).buffer)),
    colors: encode(new Uint8Array(colours)),
    indices: encode(new Uint8Array(new Uint32Array(indices).buffer)),
  };
}
export type VenueFrontPlan = Omit<NeighbourhoodPlanV300, "append" | "appendFingerprint"> & {
  plates: VenuePlate[];
  panels?: VenuePanel[];
};
export type VenueFrontRecipes = {
  schemaVersion: 1;
  keys: string[];
  packets: Record<string, VenueFrontPlan>;
};

export function venueFrontSourceV355(
  compact: VenueFrontRecipes, kind = VENUE_FRONTS_KIND_V355,
): NeighbourhoodSourceV300 {
  const style: WallPlateStyle = { kind, categories, palette: category => palette[category] };
  const keys = compact.keys;
  if (compact.schemaVersion !== 1 || keys.length > 32 || new Set(keys).size !== keys.length ||
      Object.keys(compact.packets).length !== keys.length) {
    throw new Error("Invalid venue fronts catalogue");
  }
  const packets: Record<string, NeighbourhoodPlanV300> = {};
  for (const key of keys) {
    if (!Object.hasOwn(compact.packets, key)) throw new Error("Missing venue plan");
    let cached: WeakRef<NeighbourhoodPlanV300> | undefined;
    Object.defineProperty(packets, key, {
      enumerable: true,
      get() {
        const previous = cached?.deref();
        if (previous) return previous;
        const { plates, panels = [], ...guards } = compact.packets[key];
        if ((!plates.length && !panels.length) || plates.length > 20 || guards.retire.length) {
          throw new Error("Venue fronts require a bounded additive plan");
        }
        const native = key.startsWith("minecraft:");
        const append = appendVenuePanelsV355(civicPlateMeshV350(plates, native, style), panels, native);
        const fingerprint = surroundingPacketFingerprint(append);
        for (;;) {
          const result = fingerprint.next();
          if (!result.done) continue;
          const plan = { ...guards, append, appendFingerprint: result.value };
          cached = new WeakRef(plan);
          return plan;
        }
      },
    });
  }
  return { schemaVersion: 1, keys: keys.slice(), packets };
}

import source from "./gripsHansaplatzSource.json";
import {
  bebelplatzPartContains,
  bebelplatzPartRoofAt,
  type BebelplatzSourcePart,
} from "./bebelplatzBuildingProfile";

export const GRIPS_HANSAPLATZ_SOURCE = source;
export const GRIPS_HANSAPLATZ_PRISM_IDS = new Set(source.replaced_prism_ids);
export const GRIPS_HANSAPLATZ_GROUND_Y = 5.2;
export type GripsPart = BebelplatzSourcePart & {
  role: string;
  parentId: string;
  openBelow: boolean;
};
export type GripsAxis = {
  a: readonly [number, number];
  b: readonly [number, number];
  side: number;
};
export const GRIPS_THEATRE_WEST: GripsAxis = {
  a: [-2057.769, -6.982],
  b: [-2059.847, -26.914],
  side: 1,
};
export const GRIPS_THEATRE_SOUTH: GripsAxis = {
  a: [-2016.461, -11.542],
  b: [-2047.049, -8.404],
  side: 1,
};
export const GRIPS_ENTRANCE: GripsAxis = {
  a: [-2018.509, -31.343],
  b: [-2016.461, -11.542],
  side: 1,
};
export const GRIPS_U9_WEST: GripsAxis = {
  a: [-2007.351, 9.45],
  b: [-2009.683, -13.073],
  side: 1,
};

/** Every original sheet remains in the JSON; only covered-space display walls change. */
export const GRIPS_HANSAPLATZ_PARTS: GripsPart[] = source.buildings.flatMap(
  (building) =>
    building.parts.map((part) => {
      const shift = building.display_y_translation_m;
      const openBelow =
        ["canopy", "bridge", "station"].includes(building.role) ||
        (building.role === "arcades" && part.height_m < 5.5);
      const top = part.top_y_m + shift;
      const roofMinimum = Math.min(
        ...part.surfaces
          .filter((s) => s.kind === "RoofSurface")
          .flatMap((s) => s.rings.flatMap((r) => r.map((p) => p[1] + shift))),
      );
      const base = openBelow
        ? roofMinimum - (building.role === "bridge" ? 3.05 : 0.26)
        : part.ground_y_m + shift;
      const surfaces = part.surfaces
        .filter(
          (s) =>
            !openBelow ||
            building.role === "bridge" ||
            s.kind === "RoofSurface",
        )
        .map((s) => ({
          ...s,
          rings: s.rings.map((r) =>
            r.map(([x, y, z]) => [
              x,
              openBelow && s.kind !== "RoofSurface"
                ? Math.max(base, y + shift)
                : y + shift,
              z,
            ]),
          ),
        }));
      return {
        ...part,
        surfaces,
        ground_y_m: base,
        top_y_m: top,
        role: building.role,
        parentId: building.parent_id,
        openBelow,
      };
    }),
);
const PARTS_BY_ID = new Map(
  GRIPS_HANSAPLATZ_PARTS.map((p) => [p.id.slice(-8), p]),
);
export function gripsHansaplatzPartForPrism(id: string): GripsPart | undefined {
  return PARTS_BY_ID.get(id);
}
export function gripsHansaplatzRoofAt(
  part: GripsPart,
  x: number,
  z: number,
): number | null {
  return bebelplatzPartRoofAt(part, x, z);
}
export function isGripsHansaplatzReplacementColumn(
  x: number,
  z: number,
): boolean {
  if (x < -2061 || x > -1928 || z < -66 || z > 11) return false;
  return GRIPS_HANSAPLATZ_PARTS.some((p) => bebelplatzPartContains(p, x, z));
}
export function gripsAxisLength(a: GripsAxis): number {
  return Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]);
}
export function gripsAxisPoint(
  a: GripsAxis,
  u: number,
  y: number,
  out = 0,
): [number, number, number] {
  const dx = a.b[0] - a.a[0],
    dz = a.b[1] - a.a[1],
    l = gripsAxisLength(a);
  return [
    a.a[0] + (u * dx + out * dz * a.side) / l,
    y,
    a.a[1] + (u * dz - out * dx * a.side) / l,
  ];
}
export function gripsPartAxes(p: GripsPart): GripsAxis[] {
  let area = 0;
  p.ring.forEach((a, i) => {
    const b = p.ring[(i + 1) % p.ring.length];
    area += a[0] * b[1] - b[0] * a[1];
  });
  return p.ring.map((a, i) => ({
    a: a as [number, number],
    b: p.ring[(i + 1) % p.ring.length] as [number, number],
    side: area > 0 ? 1 : -1,
  }));
}
/** Slender arcade supports, shared with collision; no blanket courtyard block. */
export const GRIPS_ARCADE_POSTS: [number, number, number][] = [];
for (const p of GRIPS_HANSAPLATZ_PARTS.filter(
  (p) => p.openBelow && p.role !== "bridge",
)) {
  for (const a of gripsPartAxes(p)) {
    const l = gripsAxisLength(a);
    if (l < 4) continue;
    const n = Math.max(1, Math.floor(l / 5.5));
    for (let i = 0; i <= n; i++) {
      const [x, , z] = gripsAxisPoint(a, 0.4 + ((l - 0.8) * i) / n, 0, -0.12);
      if (
        GRIPS_HANSAPLATZ_PARTS.some(
          (other) =>
            other !== p &&
            !other.openBelow &&
            bebelplatzPartContains(other, x, z),
        )
      )
        continue;
      if (p.role === "station" && x > -2005.2 && x < -1998.5) continue;
      if (GRIPS_ARCADE_POSTS.some((q) => Math.hypot(q[0] - x, q[1] - z) < 0.7))
        continue;
      GRIPS_ARCADE_POSTS.push([
        x,
        z,
        (gripsHansaplatzRoofAt(p, x, z) ?? p.ground_y_m + 0.26) - 0.26,
      ]);
    }
  }
}
export function gripsHansaplatzSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  if (x < -2061 || x > -1928 || z < -66 || z > 11 || y < 5.2) return false;
  if (
    GRIPS_ARCADE_POSTS.some(
      ([a, b, top]) => y < top && Math.hypot(x - a, z - b) < 0.09 + radius,
    )
  )
    return true;
  // The station's photographed long western glass-block wall; the mapped
  // three stair approaches on its south end remain outside this narrow wall.
  const a = GRIPS_U9_WEST,
    dx = a.b[0] - a.a[0],
    dz = a.b[1] - a.a[1],
    l = gripsAxisLength(a);
  const u = ((x - a.a[0]) * dx + (z - a.a[1]) * dz) / l;
  const out = ((x - a.a[0]) * dz - (z - a.a[1]) * dx) / l;
  return y < 8.45 && u > 0 && u < l && Math.abs(out) < 0.15 + radius;
}

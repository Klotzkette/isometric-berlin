import type { DbTowerBlock } from "./DbTowerArchitecture";
import { DB_TOWER_PROFILE as P, DB_TOWER_SOURCE as S, dbTowerPartContains } from "./dbTowerProfile";

type Point = [number, number, number];

/** The 2025 DB283779 exterior shows slender cross-bracing behind the glass
 * crown. Sections and bay grouping are photo-informed estimates; the complete
 * existing source shell, crown glazing and logo remain their original owners. */
export function planDbTowerCrownV348(native = false): DbTowerBlock[] {
  // Construction-only admission, on the very same source used by the parent
  // factory. No cached positive result, persistent root or previous-owner cut.
  const text = JSON.stringify(S);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  if (text.length !== 19829 || hash !== 131521907 ||
    JSON.stringify([P.parentId, P.ground, P.sourceOffsetY, P.mainTop, P.crownBottom, P.crownTop, P.top]) !==
    '["DEBE01YYK0002KhX",5.3,0.377,99.329,99.329,108.078,108.493]') return [];

  const part = S.parts.find(p => p.id === "DEBE3DlYxpXBjoqL")!;
  const blocks: DbTowerBlock[] = [];
  const point = (index: number, y: number, out = -.34): Point => {
    const a = part.ring[index], b = part.ring[(index + 1) % part.ring.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    let nx = -dz / length, nz = dx / length;
    if (dbTowerPartContains(part, a[0] + dx / 2 + nx * .025, a[1] + dz / 2 + nz * .025)) {
      nx = -nx; nz = -nz;
    }
    // Keep the steel behind the existing glass, within the main roof outline.
    return [a[0] + dx / length * .04 + nx * out, y, a[1] + dz / length * .04 + nz * out];
  };
  const add = (position: Point, size: Point, yaw: number, tilt = 0) => {
    blocks.push({ position, size, yaw, tilt, color: 0x809399, family: "frame",
      role: "v348 crown steel brace and tie", floor: -1, normal: [0, 0] });
  };
  const beam = (a: Point, b: Point) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    if (!native) {
      add([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
        [Math.hypot(dx, dy, dz), .13, .13], -Math.atan2(dz, dx), Math.atan2(dy, Math.hypot(dx, dz)));
      return;
    }
    // Independent cardinal staircase along the structural axis, never rotated
    // copies of the Drawn beams. Both device profiles use the complete result.
    const count = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / .42);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count;
      add([a[0] + dx * t, a[1] + dy * t, a[2] + dz * t],
        [Math.abs(dx) / count + .13, Math.abs(dy) / count + .13, Math.abs(dz) / count + .13], 0);
    }
  };
  // Only the clearly open central curved crown is refined. The sign, terminal
  // returns and set-back plant volumes are left alone; no chimney is inferred.
  const lower = P.crownBottom + .24, upper = P.crownTop - .24;
  for (let first = 6; first <= 33; first += 3) {
    const a = point(first, lower), b = point(first + 3, upper);
    beam(a, b);
    beam([a[0], upper, a[2]], [b[0], lower, b[2]]);
  }
  for (let index = 6; index <= 36; index += 3) {
    for (const y of [lower, upper]) beam(point(index, y), point(index, y, .21));
  }
  return blocks;
}

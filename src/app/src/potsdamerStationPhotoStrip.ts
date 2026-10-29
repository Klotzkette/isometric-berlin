import { POTSDAMER_STATION_PHOTO_STRIP_RECEIPT as strip } from "./potsdamerStationPhotoOwnership";

type Point = [number, number, number];
export type StationStripMember = { role: string; a: Point; b: Point; thickness: number; corner?: number };

/** Original source XZ anchors; the low datum, slender profiles, six supports
 * and alignment to the neighbouring roof are bounded display interpretations. */
export function potsdamerStationStripPhotoMembers(): StationStripMember[] {
  const ring = strip.fullSourceRingWorldM, rows: StationStripMember[] = [];
  const thickness = .12, low = strip.groundYM, top = strip.alignedRoofYM - thickness / 2;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    rows.push({ role: "east-strip-corner-post", a: [a[0], low, a[1]],
      b: [a[0], top, a[1]], thickness, corner: i });
    for (const [role, y] of [["east-strip-lower-edge", low + thickness / 2],
      ["east-strip-upper-edge", top]] as const) {
      rows.push({ role, a: [a[0], y, a[1]], b: [b[0], y, b[1]], thickness });
    }
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 5) {
      const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
      rows.push({ role: "east-strip-intermediate-post", a: [x, low, z],
        b: [x, top, z], thickness });
    }
  }
  return rows;
}

/** Independent world-axis-aligned metre courses, never rotated smooth beams.
 * Exact source corner anchors remain in each vertical support stack. */
export function potsdamerStationStripPhotoNativeBlocks(): {
  position: Point; size: Point; color: number; role: string;
}[] {
  const blocks: { position: Point; size: Point; color: number; role: string }[] = [];
  for (const member of potsdamerStationStripPhotoMembers()) {
    const { a, b, thickness } = member;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz)));
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count;
      blocks.push({ role: member.role,
        position: [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t],
        size: [Math.abs(dx) / count + thickness,
          Math.abs(dy) > 0 ? Math.abs(dy) / count : thickness,
          Math.abs(dz) / count + thickness], color: 0x42474a });
    }
  }
  return blocks;
}

/** Granular collision follows only represented steel. The separate drawn
 * thin glass roof is registered by its full original four-vertex ring. */
export function potsdamerStationStripPhotoSolids(native = false): {
  ring: [number, number][]; minY: number; maxY: number;
}[] {
  if (native) return potsdamerStationStripPhotoNativeBlocks().map(({ position: [x, y, z], size: [w, h, d] }) => ({
    ring: [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]] as [number, number][],
    minY: y - h / 2, maxY: y + h / 2,
  }));
  return potsdamerStationStripPhotoMembers().map(({ a, b, thickness }) => {
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz), half = thickness / 2;
    if (length < 1e-9) return {
      ring: [[a[0] - half, a[2] - half], [a[0] + half, a[2] - half],
        [a[0] + half, a[2] + half], [a[0] - half, a[2] + half]] as [number, number][],
      minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]),
    };
    const nx = -dz / length * half, nz = dx / length * half;
    return { ring: [[a[0] + nx, a[2] + nz], [b[0] + nx, b[2] + nz],
      [b[0] - nx, b[2] - nz], [a[0] - nx, a[2] - nz]],
      minY: a[1] - half, maxY: a[1] + half };
  });
}

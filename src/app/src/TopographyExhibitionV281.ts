import type { TopographyBlock } from "./TopographyTerrorArchitecture";

// Official exhibition text and gallery: topographie.de/ausstellungen/berlin-1933-1945.
// Five differently coloured chapters and mostly glass panels are documented.
// Panel centres/widths retain the existing 24 authored samples of OSM 281621233;
// microdimensions, chapter boundaries and these approximate hues are estimates.
// Glass is genuinely open between its edges: no opaque pane or copied content.
export const TOPOGRAPHY_EXHIBITION_CHAPTERS_V281 = [0xbac542, 0xc9984f, 0xb26e53, 0xa26f83, 0x719ead] as const;
export const TOPOGRAPHY_EXHIBITION_ROLE_V281 = "open exhibition ";
type Triple = [number, number, number];

export function planTopographyExhibitionV281(center: Triple, width: number, yaw: number, minecraft: boolean, index: number): TopographyBlock[] {
  const blocks: TopographyBlock[] = [], chapter = [0, 5, 10, 15, 20].indexOf(index);
  const add = (position: Triple, size: Triple, color: number, role: string, angle: number) => blocks.push({ position, size, color, role: TOPOGRAPHY_EXHIBITION_ROLE_V281 + role, yaw: angle, glass: false, solid: false });
  if (minecraft) {
    // Independent cardinal iron bars and document blocks; no rotated drawn mesh,
    // scaled board plane, translucent wall or mobile-specific loss of detail.
    const w = Math.floor(width * 8) / 8, h = 1.25, t = .0625;
    const voxel = (x: number, y: number, sx: number, sy: number, color: number, role: string) => add([center[0] + x, center[1] + y, center[2]], [sx, sy, .0625], color, role, 0);
    for (const side of [-1, 1]) {
      voxel(side * (w - t) / 2, 0, t, h, 0xb8c4c5, "frame upright");
      voxel(0, side * (h - t) / 2, w - 2 * t, t, 0xb8c4c5, "frame rail");
      voxel(side * w * .375, .75, t, .25, 0xcbd5d2, "suspension rod");
    }
    voxel(-w * .25, .1875, .5, chapter >= 0 ? .5 : .3125, chapter >= 0 ? TOPOGRAPHY_EXHIBITION_CHAPTERS_V281[chapter] : 0xc2c2b9, chapter >= 0 ? "chapter marker" : "abstract document field");
    voxel(w * .25, -.25, .4375, .25, 0x8b9390, "abstract document field");
    return blocks;
  }
  const co = Math.cos(yaw), si = Math.sin(yaw), h = 1.3, t = .022;
  const pane = (x: number, y: number, sx: number, sy: number, color: number, role: string, depth = .028) => add([center[0] + co * x, center[1] + y, center[2] - si * x], [sx, sy, depth], color, role, yaw);
  for (const side of [-1, 1]) {
    pane(side * (width - t) / 2, 0, t, h, 0xb8c4c5, "frame upright");
    pane(0, side * (h - t) / 2, width - 2 * t, t, 0xcbd5d2, "frame rail");
    pane(side * width * .36, .79, .014, .28, 0xcbd5d2, "suspension rod", .014);
  }
  pane(-width * .25, .20, width * .28, chapter >= 0 ? .52 : .30, chapter >= 0 ? TOPOGRAPHY_EXHIBITION_CHAPTERS_V281[chapter] : 0xc2c2b9, chapter >= 0 ? "chapter marker" : "abstract document field", .018);
  pane(width * .24, -.24, width * .25, .24, 0x8b9390, "abstract document field", .018);
  return blocks;
}

import type { SpawnCategory } from "../spawns";

const COLORS = ["#2f783d", "#78b64b", "#d7bd65", "#c56745", "#6bb5c5", "#f2dfb0"];

function encode(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Hand-pixelled, trademark-free sprite bodies on a 16×16 block grid.
 * Every shape is an axis-aligned `<rect>` snapped to whole pixels — no
 * `<path>`, no diagonals, no curves, no gradients — so the sprites keep
 * a visible 1 px block grid when scaled up with `crispEdges`.
 */
export function minecraftSpriteDataUri(
  category: SpawnCategory,
  variant: number,
): string {
  const accent = COLORS[variant % COLORS.length];
  const common =
    'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"';
  const bodies: Record<SpawnCategory, string> = {
    // House with a stepped roof, plastered wall, window and door.
    village:
      `<rect fill="#2b211b" x="5" y="1" width="6" height="2"/>` +
      `<rect fill="${accent}" x="3" y="3" width="10" height="2"/>` +
      `<rect fill="${accent}" x="1" y="5" width="14" height="2"/>` +
      `<rect fill="#e8d1ae" x="3" y="7" width="10" height="8"/>` +
      `<rect fill="#2b211b" x="4" y="8" width="2" height="2"/>` +
      `<rect fill="#69452e" x="7" y="10" width="3" height="5"/>`,
    // Market tent as a stepped pyramid of stacked rects with an entrance.
    tent:
      `<rect fill="#302720" x="7" y="2" width="2" height="2"/>` +
      `<rect fill="${accent}" x="5" y="4" width="6" height="3"/>` +
      `<rect fill="${accent}" x="3" y="7" width="10" height="3"/>` +
      `<rect fill="${accent}" x="1" y="10" width="14" height="4"/>` +
      `<rect fill="#302720" x="1" y="14" width="14" height="1"/>` +
      `<rect fill="#f4e4bd" x="6" y="10" width="4" height="5"/>`,
    // Crop plot: grass strip, dark soil, chunky crop-row columns.
    field:
      `<rect fill="#8bc665" x="1" y="2" width="14" height="2"/>` +
      `<rect fill="#315d31" x="1" y="4" width="14" height="10"/>` +
      `<rect fill="${accent}" x="2" y="5" width="2" height="8"/>` +
      `<rect fill="${accent}" x="6" y="5" width="2" height="8"/>` +
      `<rect fill="${accent}" x="10" y="5" width="2" height="8"/>` +
      `<rect fill="#f2dfb0" x="13" y="5" width="2" height="8"/>`,
    // Tiny Berliner: hair block, face with 1 px eyes, tunic, arms, legs.
    npc:
      `<rect fill="#26342e" x="5" y="1" width="6" height="2"/>` +
      `<rect fill="#d8b08a" x="5" y="3" width="6" height="4"/>` +
      `<rect fill="#26342e" x="6" y="4" width="1" height="1"/>` +
      `<rect fill="#26342e" x="9" y="4" width="1" height="1"/>` +
      `<rect fill="${accent}" x="4" y="7" width="8" height="5"/>` +
      `<rect fill="#d8b08a" x="2" y="7" width="2" height="4"/>` +
      `<rect fill="#d8b08a" x="12" y="7" width="2" height="4"/>` +
      `<rect fill="#2b211b" x="5" y="12" width="2" height="3"/>` +
      `<rect fill="#2b211b" x="9" y="12" width="2" height="3"/>`,
    // Generic blocky quadruped: body, boxy head, snout marking, legs.
    animal:
      `<rect fill="#f2efd8" x="1" y="6" width="10" height="6"/>` +
      `<rect fill="#d1d0bd" x="11" y="4" width="4" height="5"/>` +
      `<rect fill="${accent}" x="11" y="7" width="4" height="2"/>` +
      `<rect fill="#313733" x="12" y="5" width="1" height="1"/>` +
      `<rect fill="#313733" x="2" y="12" width="2" height="3"/>` +
      `<rect fill="#313733" x="8" y="12" width="2" height="3"/>`,
    // Spree boat: mast, stepped block sail, two-step hull.
    boat:
      `<rect fill="${accent}" x="7" y="1" width="2" height="9"/>` +
      `<rect fill="#f2dfb0" x="9" y="2" width="5" height="2"/>` +
      `<rect fill="#f2dfb0" x="9" y="4" width="4" height="2"/>` +
      `<rect fill="#f2dfb0" x="9" y="6" width="3" height="2"/>` +
      `<rect fill="#7a4c2c" x="1" y="10" width="14" height="3"/>` +
      `<rect fill="#5d3a22" x="3" y="13" width="10" height="2"/>`,
  };
  return encode(`<svg ${common}>${bodies[category]}</svg>`);
}

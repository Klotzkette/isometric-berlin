import type { SpawnCategory } from "../spawns";

const COLORS = ["#2f783d", "#78b64b", "#d7bd65", "#c56745", "#6bb5c5", "#f2dfb0"];

function encode(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
export function minecraftSpriteDataUri(
  category: SpawnCategory,
  variant: number,
): string {
  const accent = COLORS[variant % COLORS.length];
  const common = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges"';
  const bodies: Record<SpawnCategory, string> = {
    village: `<path fill="#2b211b" d="M3 10 12 3l9 7v11H3z"/><path fill="${accent}" d="m5 10 7-5 7 5v3H5z"/><path fill="#e8d1ae" d="M6 12h12v9H6z"/><path fill="#69452e" d="M10 15h4v6h-4z"/>`,
    tent: `<path fill="#302720" d="m2 20 10-17 10 17z"/><path fill="${accent}" d="m5 19 7-13 7 13z"/><path fill="#f4e4bd" d="m12 6 2 13h-4z"/>`,
    field: `<path fill="#315d31" d="M2 7h20v14H2z"/><path fill="${accent}" d="M3 8h3v12H3zm6 0h3v12H9zm6 0h3v12h-3z"/><path fill="#8bc665" d="M2 4h20v3H2z"/>`,
    npc: `<path fill="#26342e" d="M8 2h8v7H8z"/><path fill="${accent}" d="M6 9h12v9H6z"/><path fill="#d8b08a" d="M9 4h6v5H9z"/><path fill="#2b211b" d="M7 18h4v5H7zm6 0h4v5h-4z"/>`,
    animal: `<path fill="#f2efd8" d="M4 8h14v10H4z"/><path fill="#d1d0bd" d="M17 10h5v7h-5z"/><path fill="#313733" d="M6 18h3v5H6zm7 0h3v5h-3z"/><path fill="${accent}" d="M19 12h2v2h-2z"/>`,
    boat: `<path fill="#7a4c2c" d="M2 13h20l-4 7H6z"/><path fill="${accent}" d="M11 3h2v10h-2z"/><path fill="#f2dfb0" d="M13 4v7h7z"/>`,
  };
  return encode(`<svg ${common}>${bodies[category]}</svg>`);
}

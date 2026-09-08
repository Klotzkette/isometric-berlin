import source from "./rohwedderHausPrisms.json";

export const ROHWEDDER_HAUS_SOURCE = source;
export const ROHWEDDER_HAUS_IDS: ReadonlySet<string> = new Set(source.buildings.map(p => p.id));
export const ROHWEDDER_HAUS_GROUP = "Detlev Rohwedder Haus source-bound architecture";
export const MINECRAFT_ROHWEDDER_HAUS_GROUP = "Minecraft Detlev Rohwedder Haus architecture";
export const ROHWEDDER_HAUS_PRISM_TONES: Readonly<Record<string, number>> = Object.fromEntries(source.buildings.map(p => [p.id, 0xc9c6b5]));
export const ROHWEDDER_HAUS_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(source.buildings.map(p => [p.id, 0x868984]));
export const ROHWEDDER_HAUS_PROFILE = {
  name: "Detlev-Rohwedder-Haus / Bundesministerium der Finanzen", address: "Wilhelmstraße 97, Berlin",
  parent: source.parent, osm: source.osmIdentity, architect: "Ernst Sagebiel", completed: 1936,
  sources: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095987",
    "https://www.bundesfinanzministerium.de/Web/DE/Ministerium/Geschichte/geschichte.html",
    "https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Video-Textfassungen/Geschichte/textfassung-detlev-rohwedder-haus.html",
  ],
  sourceStatus: "All 21 original main and service LoD2 records, heights and open courtyards retained. Five northwest parts keep their legacy Bundesrechnungshof source name. The measured central Ehrenhof risalit K0001yJa remains despite the OSM courtyard omission. LDA shell-limestone evidence is preferred over the OSM marble material tag, which remains recorded. Window rhythm, tall hall openings, stone joints, arcade depth, fence height, roof lanterns and materials are photo-proportioned procedural recognition details, not a facade survey. No historical removed emblems or photographic mural reproduction.",
  references: [
    ["Berlin, Mitte, Wilhelmstraße, Detlev-Rohwedder-Haus.jpg", "Jörg Zägel", "CC BY-SA 3.0"],
    ["Berlin-Detlev-Rohwedder-Haus-Bundesfinanzministerium-02-2023-gje X.jpg", "Gerd Eichmann", "CC BY 4.0"],
    ["Detlev-Rohwedder-Haus Luftaufnahme.jpg", "Gavailer", "CC BY-SA 4.0"],
    ["Detlev-Rohwedder-Haus exterior 2.JPG", "BrokenSphere", "CC BY-SA 3.0"],
    ["Rohwedder-Haus Fenstergitter 2013-08-29 ama fec (2).JPG", "Monika Angela Arnold (=44penguins)", "CC BY-SA 2.5"],
    ["Federal Ministry of Finance.jpg", "Magnus Manske", "CC BY-SA 3.0"],
    ["Panoramafoto Reichsluftfahrtministerium 2017.jpg", "Maddriver371", "CC BY-SA 4.0"],
  ],
} as const;

type Outline = { ring: number[][]; holes?: number[][][] };
function inRing(ring: number[][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
export function rohwedderPrismContains(p: Outline, x: number, z: number): boolean {
  return inRing(p.ring, x * 10, z * 10) && !(p.holes ?? []).some(h => inRing(h, x * 10, z * 10));
}
/** Remove only vertical rounding above the retained source roofs. */
export function rohwedderHausColumnTopAt(x: number, z: number, top: number, cell = 4): number {
  if (x < 697 || x > 911 || z < 1025 || z > 1294) return top;
  const parts = source.buildings.filter(p => rohwedderPrismContains(p, x, z));
  if (!parts.length) return top;
  const sourceTop = Math.max(...parts.map(p => (p.y0_dm + p.h_dm) / 10));
  const rounded = Math.max(...parts.map(p => p.y0_dm / 10 + Math.ceil(p.h_dm / (10 * cell)) * cell));
  // Coarse columns share local ground samples, which can differ by several
  // decimetres from an individual LoD2 part's base. Keep taller foreign solids.
  return top <= rounded + .6 ? Math.min(top, sourceTop) : top;
}

/** Exact OSM fence axis; local 4.8 m height is a photographed display estimate. */
export function rohwedderHausFenceSolidAt(x: number, z: number, footY: number, height = 1.8): boolean {
  if (footY >= 9.8 || footY + height <= 5) return false;
  const points = source.entranceFence.points;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < .19) return true;
  }
  return false;
}

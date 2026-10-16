import source from "./luisenCorridorSource.json";

export const LUISEN_CORRIDOR_SOURCE = source;
export const LUISEN_CORRIDOR_IDS: ReadonlySet<string> = new Set(source.prisms.map(p => p.id));
export const LUISEN_CORRIDOR_GROUP = "Luisen Schumann Reinhardt architecture";
export const MINECRAFT_LUISEN_CORRIDOR_GROUP = "Minecraft Luisen Schumann Reinhardt architecture";
export const LUISEN_CORRIDOR_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  source.profiles.flatMap(p => p.ids.map(id => [id, p.tone])),
);
export const LUISEN_CORRIDOR_ROOF_TONES: Readonly<Record<string, number>> = Object.fromEntries(
  source.profiles.flatMap(p => p.ids.map(id => [id, p.style === "balconies" || p.style === "patent" ? 0x975e48 : 0x697173])),
);
// Exact exterior edges only. Photo counts/proportions do not alter measured
// source bodies, roof envelopes, courtyard windows or neighbouring owners.
export const LUISEN_STREET_REFINEMENTS_V218 = [
  { sourceId: "12KXkIon", a: [880.5, -464.2], kind: "reinhardt19", bays: 8, entranceBay: 4 },
  { sourceId: "pg7QUvEX", a: [901.2, -469.2], kind: "reinhardt19", bays: 2, entranceBay: -1 },
  { sourceId: "JtV0i0Yb", a: [565.1, -511.4], kind: "schumann19", corner: "start" },
  { sourceId: "JtV0i0Yb", a: [594.1, -518.3], kind: "schumann19", corner: "end" },
] as const;
export const REINHARDT19_STREET_EAVES_V218 = source.facadeTops["12KXkIon"];
// Only the exposed Luisen-facing edge of the retained corner wedge. Its
// diagonal NOebyeyV neighbour is an internal source join, not another facade.
export const LUISEN_STREET_REFINEMENTS_V219 = [
  { sourceId: "K6XkZ7CC", a: [581.7, -308.4], kind: "mori39-corner" },
] as const;
export const LUISEN_CORRIDOR_EVIDENCE = {
  geometry: "120 exact committed LoD2 parts; 65 exact OSM road axes. Bodies, holes, roofs and height envelopes remain unchanged.",
  facade: "Photo-guided material and facade families. Window dimensions, bay subdivisions, shallow mouldings and balcony rails are procedural display approximations, not surveyed individual openings.",
  sources: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095859%2CT",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095894",
    "https://manila.diplo.de/ph-de/willkommen/laenderinfos/vertretungen-in-deutschland",
    "https://www.ogai.hu-berlin.de/contact-en",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095888",
  ],
  refinementV218: "Four exact exterior edges: Reinhardtstraße 19 ten-axis street front, panelled entry and restrained courses; Schumannstraße 19 corner glazing and metal balcony frames. Photographed facade interpretation, not an aperture survey. See docs/luisen-corridor-v218.md.",
  refinementV219: "Luisenstraße 39: one exact corner-wedge exterior edge replaces three inaccurate generic upper window groups with a blank lower corner and two alternating brick-colour fields, following the already credited Jörg Zägel Commons photograph. Source envelope and every other edge remain intact. See docs/luisen-corridor-v219.md.",
} as const;

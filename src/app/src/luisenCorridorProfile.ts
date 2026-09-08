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
export const LUISEN_CORRIDOR_EVIDENCE = {
  geometry: "120 exact committed LoD2 parts; 65 exact OSM road axes. Bodies, holes, roofs and height envelopes remain unchanged.",
  facade: "Photo-guided material and facade families. Window dimensions, bay subdivisions, shallow mouldings and balcony rails are procedural display approximations, not surveyed individual openings.",
  sources: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095859%2CT",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095894",
    "https://manila.diplo.de/ph-de/willkommen/laenderinfos/vertretungen-in-deutschland",
    "https://www.ogai.hu-berlin.de/contact-en",
  ],
} as const;

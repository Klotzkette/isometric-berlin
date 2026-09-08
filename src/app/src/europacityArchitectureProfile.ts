import source from "./europacityArchitectureSource.json";
export const EUROPACITY_ARCHITECTURE_SOURCE = source;
export const EUROPACITY_ARCHITECTURE_IDS: ReadonlySet<string> = new Set(source.prisms.map(p => p.id));
export const EUROPACITY_ARCHITECTURE_GROUP = "Heidestrasse and Otto Weidt architecture";
export const MINECRAFT_EUROPACITY_ARCHITECTURE_GROUP = "Minecraft Heidestrasse and Otto Weidt architecture";
export const EUROPACITY_ARCHITECTURE_TONES: Readonly<Record<string, number>> = Object.fromEntries(source.profiles.flatMap(p => p.ids.map(id => [id, p.tone])));
export const EUROPACITY_ARCHITECTURE_EVIDENCE = {
  geometry: "140 exact committed LoD2 and OSM building parts. No footprint, court, source roof or measured envelope is replaced.",
  subdivisions: "Facade bays, frames, loggia rails and material seams are non-surveyed procedural display subdivisions, with separate full/mobile budgets.",
  sources: [
    "https://www.ksp-engel.com/projekte/kpmg-headquarters-berlin",
    "https://www.caimmo.com/de/portfolio/projekt/buerogebaeude-heidestrasse-58/",
    "https://www.autobahn.de/impressum",
    "https://www.staab-architekten.com/de/projects/859-geschaftshaus-am-otto-weidt-platz-berlin",
    "https://www.rohdecan.de/de/02-PROJEKTE//180707-B13",
    "https://gruentuchernst.de/projekte/p387-europacity/",
    "https://www.buwog.de/wohnbauprojekte/49",
    "https://lorenzenmayer.de/projekt/heidestrasse/",
    "https://ckrs-architekten.de/fassade-qh-spring/",
    "https://www.taurecon.com/dm-drogerie-markt-mietet-im-quartier-heidestrasse/",
    "https://www.collignonarchitektur.com/en/projects/colonnades-quartier-heidestrasse",
    "https://www.em2n.ch/en/work/quartier-heidestrasse-qh-track.html",
    "https://www.hemmerlein-sichtbeton.de/referenzen/qh-track-berlin-01102023/",
    "https://commons.wikimedia.org/wiki/File:Berlin_20260711_Quartier_Heidestra%C3%9Fe_01.jpg",
    "https://commons.wikimedia.org/wiki/File:Berlin-Moabit_Otto-Weidt-Platz.jpg",
    "https://commons.wikimedia.org/wiki/File:Golda-Meir-Steg_Berlin_1v5.jpg",
    "https://commons.wikimedia.org/wiki/File:Golda-Meir-Steg_Berlin_2v5.jpg",
  ],
} as const;

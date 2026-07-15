import type { Language } from "./localization";

type DiscoveryNote = Record<Language, string>;

export const DISCOVERY_NOTES: Record<string, DiscoveryNote> = {
  "Berlin Hauptbahnhof": {
    de: "Der Anschlusszug wartet im Paralleluniversum.",
    en: "The connecting train is waiting in a parallel universe.",
  },
  Bundeskanzleramt: {
    de: "Die Waschmaschine läuft heute im Politik-Sparprogramm.",
    en: "The washing machine is running the politics economy cycle.",
  },
  "Brandenburger Tor": {
    de: "Die Quadriga hat weiterhin keinen Blinker.",
    en: "The Quadriga still has no turn signals.",
  },
  "Carillon im Tiergarten": {
    de: "68 Glocken, null Schlummertasten.",
    en: "Sixty-eight bells, zero snooze buttons.",
  },
  "Reichstagsgebäude": {
    de: "Transparenz ist hier wörtlich verbaut.",
    en: "Transparency is quite literally built in here.",
  },
  "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)": {
    de: "Unterirdisch, aber nicht geheim.",
    en: "Underground, but not secret.",
  },
  "TIPI am Kanzleramt": {
    de: "Nur heute Abend. Morgen steht dort wieder: nur heute Abend.",
    en: "Tonight only. Tomorrow it will say: tonight only.",
  },
};

export function discoveryNoteFor(
  landmarkName: string,
  language: Language,
): string | null {
  return DISCOVERY_NOTES[landmarkName]?.[language] ?? null;
}

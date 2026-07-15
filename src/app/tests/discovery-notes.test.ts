import { describe, expect, test } from "bun:test";

import { DISCOVERY_NOTES, discoveryNoteFor } from "../src/discoveryNotes";

describe("discovery notes", () => {
  test("keeps every note bilingual and concise", () => {
    expect(Object.keys(DISCOVERY_NOTES)).toHaveLength(7);
    for (const note of Object.values(DISCOVERY_NOTES)) {
      expect(note.de.length).toBeGreaterThan(12);
      expect(note.en.length).toBeGreaterThan(12);
      expect(note.de.length).toBeLessThan(100);
      expect(note.en.length).toBeLessThan(100);
    }
  });

  test("returns the selected language without inventing unknown notes", () => {
    expect(discoveryNoteFor("Carillon im Tiergarten", "de")).toContain(
      "68 Glocken",
    );
    expect(discoveryNoteFor("Carillon im Tiergarten", "en")).toContain(
      "bells",
    );
    expect(discoveryNoteFor("Unbekannter Ort", "de")).toBeNull();
  });
});

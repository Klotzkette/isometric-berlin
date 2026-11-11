import { describe, expect, test } from "bun:test";
import { directStartupMode, modeLinkFor } from "../src/modeLinks";
import type { VisualMode } from "../src/visualMode";

const modes: VisualMode[] = ["day", "night", "snowstorm", "schwellenraum", "flood", "minecraft"];

describe("shareable mode entry points", () => {
  test.each(modes)("%s links round-trip directly under a hosting subpath", (mode) => {
    const link = new URL(modeLinkFor("https://example.org/isometric-berlin/?theme=night&debug=1#landmark=reichstag", mode, "de"));
    expect(link.origin + link.pathname).toBe("https://example.org/isometric-berlin/");
    expect(link.searchParams.get("lang")).toBe("de");
    expect(link.searchParams.has("debug")).toBeFalse();
    expect(link.hash).toBe("");
    expect(directStartupMode(link.search)).toBe(mode);
  });

  test("ordinary and invalid links leave the mode chooser in control", () => {
    for (const search of ["", "?lang=en", "?theme=", "?theme=invalid", "?theme=Night", "?theme=%3Cscript%3E"]) {
      expect(directStartupMode(search)).toBeNull();
    }
  });

  test("local-download links stay on the local viewer", () => {
    const link = modeLinkFor("http://127.0.0.1:8765/folder/index.html?utm_source=test", "flood", "en");
    expect(link).toBe("http://127.0.0.1:8765/folder/index.html?theme=flood&lang=en");
  });
});

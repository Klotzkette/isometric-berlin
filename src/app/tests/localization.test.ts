import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UI_COPY } from "../src/localization";
import { StartupModeSelection } from "../src/StartupModeSelection";

describe("bilingual viewer copy", () => {
  test("keeps the German UI free of the false-friend landmark wording", () => {
    const germanCopy = Object.values(UI_COPY.de).join(" ");

    expect(germanCopy).toContain("Sehenswürdigkeiten");
    expect(germanCopy).not.toContain("Landmark");
  });

  test("provides every German key in English", () => {
    expect(Object.keys(UI_COPY.en).sort()).toEqual(
      Object.keys(UI_COPY.de).sort(),
    );
  });

  test("names the existing dream mode in both startup choosers and sharing controls", () => {
    for (const language of ["de", "en"] as const) {
      const copy = UI_COPY[language];
      const markup = renderToStaticMarkup(createElement(StartupModeSelection, {
        initialMode: "schwellenraum", language, backdropUrl: "",
        onLanguageChange() {}, onStart() {},
      }));
      expect(markup.match(/type="radio"/g)).toHaveLength(6);
      const choice = markup.split("</label>").find(label => label.includes('value="schwellenraum"'));
      expect(choice).toContain("checked");
      expect(choice).toContain(`<strong>${copy.schwellenraum}</strong>`);
      expect(choice).toContain(copy.videogameMode);
      expect(choice).toContain("Dreamcore");
      expect(markup).toContain(language === "de"
        ? `aria-label="${copy.schwellenraum} direkt öffnen"`
        : `aria-label="Open ${copy.schwellenraum} directly"`);
    }
  });

  test("localizes isometric camera controls without a flat-map action", () => {
    expect(UI_COPY.en.viewTransform).toBe("Rotate and tilt view");
    expect(UI_COPY.en.trueUnderside).toContain("Tiergarten tunnel");
    expect(UI_COPY.de.tiltUp).toBe("Nach oben schauen");
    expect(UI_COPY.de.tiltDown).toBe("Nach unten schauen");
    for (const copy of Object.values(UI_COPY)) {
      expect(Object.values(copy).join(" ")).not.toContain("2D");
      expect(copy).not.toHaveProperty("switchToMap");
      expect(copy).not.toHaveProperty("useMapFallback");
    }
  });

  test("labels contextual rain and snowfall controls in both languages", () => {
    expect(UI_COPY.de.rainOn).toContain("Regen");
    expect(UI_COPY.de.snowfallOn).toContain("Schneefall");
    expect(UI_COPY.en.rainOff).toBe("Turn rain off");
    expect(UI_COPY.en.snowfallOff).toBe("Turn snowfall off");
    expect(UI_COPY.en.snowfallActive).not.toBe(UI_COPY.en.snowfallOn);
  });
});

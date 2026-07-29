import { describe, expect, test } from "bun:test";

import { UI_COPY } from "../src/localization";

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

  test("localizes the complete 3D view-switch and underside controls", () => {
    expect(UI_COPY.en.switchToMap).toBe(
      "Switch to the high-resolution detail map",
    );
    expect(UI_COPY.en.switchToThreeD).toBe(
      "Switch to the free official 3D view",
    );
    expect(UI_COPY.en.viewTransform).toBe("Rotate and flip view");
    expect(UI_COPY.en.trueUnderside).toContain("Tiergarten tunnel");
    expect(UI_COPY.en.flipHorizontal).not.toBe(UI_COPY.de.flipHorizontal);
    expect(UI_COPY.en.flipVertical).not.toBe(UI_COPY.de.flipVertical);
  });
});

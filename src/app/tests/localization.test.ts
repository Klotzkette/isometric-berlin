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
});

import { expect, test } from "bun:test";
import { amenityFurnitureV332 } from "../src/PublicAmenityFurnitureV332";

test("public street-box recognition keeps operator colour, support and immutable rows", () => {
  for (const native of [false, true]) {
    const yellow = amenityFurnitureV332("postbox", "deutsche-post", "", native);
    const green = amenityFurnitureV332("postbox", "pin-mail", "", native);
    expect(yellow).toBe(amenityFurnitureV332("postbox", "deutsche-post", "", native));
    expect(yellow.some(row => row[6] === 0xffc828 && row[1] > 1)).toBe(true);
    expect(green.some(row => row[6] === 0x71ab47 && row[4] > 1)).toBe(true);
    expect(Object.isFrozen(yellow) && yellow.every(Object.isFrozen)).toBe(true);
    expect(amenityFurnitureV332("postbox", "deutsche-post", "wall", native)).toHaveLength(0);
    expect(amenityFurnitureV332("postbox", "", "", native)).toHaveLength(0);
  }
});

test("verified toilet variants alone yield bounded, grounded cardinal profiles", () => {
  const variants = [
    "Berliner Toilette mit 1 Platz", "Berliner Toilette 1 Platz mit 2 Pissoirs",
    "Berliner Toilette mit 2 Plätzen", "Berliner Toilette 2 Plätze mit 2 Pissoirs",
    "Berliner Toilette 1 Platz mit Kiosk",
  ];
  for (const native of [false, true]) {
    const profiles = variants.map(variant =>
      amenityFurnitureV332("toilet", "berliner-toilette", variant, native));
    expect(profiles.map(p => p.length)).toEqual([7, 9, 11, 13, 9]);
    for (const boxes of profiles) {
      expect(Math.min(...boxes.map(([, y, , , h]) => y - h / 2))).toBeCloseTo(0);
      expect(boxes.every(row => row.every(Number.isFinite) &&
        row[3] > 0 && row[4] > 0 && row[5] > 0)).toBe(true);
    }
    expect(amenityFurnitureV332("toilet", "berliner-toilette", "WC im Gebäude", native)).toHaveLength(0);
    expect(amenityFurnitureV332("toilet", "cafe-achteck", "", native)).toHaveLength(0);
  }
});

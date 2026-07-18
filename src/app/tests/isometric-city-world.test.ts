import { describe, expect, test } from "bun:test";

import { Box3, LineSegments, Mesh, Vector3 } from "three";

import {
  type PrismPayload,
  createIsometricCity,
  ISO_EDGE_THRESHOLD_DEGREES,
  ISO_INK_COLOR,
} from "../src/IsometricCityWorld";
import prismPayload from "../public/mesh/regierungsviertel/lod2-prisms.json";

const payload = prismPayload as unknown as PrismPayload;

describe("drawn isometric city (LoD2 prisms)", () => {
  const city = createIsometricCity(payload, null);
  const bodies = city.getObjectByName("LoD2 prism buildings") as Mesh;
  const ink = city.getObjectByName("LoD2 prism ink lines") as LineSegments;

  test("merges thousands of surveyed footprints into prisms with ink lines", () => {
    expect(payload.buildings.length).toBeGreaterThan(2000);
    expect(bodies).toBeInstanceOf(Mesh);
    expect(ink).toBeInstanceOf(LineSegments);
    expect(ISO_EDGE_THRESHOLD_DEGREES).toBeGreaterThan(0);
    // Near-black ink, flat vertex-coloured bodies.
    expect(ISO_INK_COLOR).toBeLessThan(0x404040);
    expect(bodies.geometry.getAttribute("color")).toBeDefined();
  });

  test("keeps the Reichstag as a tall prism with courtyard holes", () => {
    const reichstag = payload.buildings.filter((building) => {
      const xs = building.ring.map(([x]) => x / 10);
      const zs = building.ring.map(([, z]) => z / 10);
      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const cz = zs.reduce((a, b) => a + b, 0) / zs.length;
      return cx >= 260 && cx <= 372 && cz >= -34 && cz <= 115;
    });
    expect(reichstag.length).toBeGreaterThan(0);
    expect(Math.max(...reichstag.map((b) => b.h_dm))).toBeGreaterThanOrEqual(240);
    expect(
      reichstag.some((building) => (building.holes ?? []).length >= 1),
    ).toBe(true);
  });

  test("city geometry spans the quarter and sits above ground", () => {
    const bounds = new Box3().setFromObject(bodies);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(800);
    expect(size.z).toBeGreaterThan(800);
    expect(bounds.min.y).toBeGreaterThan(-10);
    expect(bounds.max.y).toBeLessThan(200);
  });
});

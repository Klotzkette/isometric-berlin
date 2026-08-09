import { describe, expect, test } from "bun:test";
import { Box3, LineSegments, Mesh, Vector3 } from "three";

import {
  QUADRIGA_DIMENSIONS,
  QUADRIGA_GEOMETRY_STATUS,
  QUADRIGA_PALETTES,
  QUADRIGA_WIND_SLOTS,
  createQuadriga,
  setQuadrigaMode,
  type QuadrigaMode,
} from "../src/Quadriga";
import {
  IRON_CROSS_PROFILE,
  ironCrossOutline,
  oakWreathLeaves,
  outlineArea,
} from "../src/quadrigaProfile";

const MODES: QuadrigaMode[] = ["day", "night", "winter"];

describe("Iron Cross outline", () => {
  test("is a closed cross pattée with four flared arms", () => {
    const span = 1;
    const outline = ironCrossOutline(span);
    // Four arms, each walked out one flank, across the tip and back.
    expect(outline).toHaveLength(4 * (2 * IRON_CROSS_PROFILE.flankSteps + 2));
    // Tip to tip is exactly the span, on both axes.
    const xs = outline.map(([x]) => x);
    const ys = outline.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(span, 12);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(span, 12);
  });

  test("has fourfold rotational symmetry to floating-point exactness", () => {
    // A cross pattée is a defined figure. If the four arms are not
    // identical the emblem is wrong, and at this zoom that shows.
    const outline = ironCrossOutline(0.86);
    const perArm = outline.length / 4;
    for (let arm = 1; arm < 4; arm += 1) {
      const angle = (arm * Math.PI) / 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      for (let index = 0; index < perArm; index += 1) {
        const [x0, y0] = outline[index];
        const [x1, y1] = outline[arm * perArm + index];
        expect(x1).toBeCloseTo(x0 * cosine - y0 * sine, 12);
        expect(y1).toBeCloseTo(x0 * sine + y0 * cosine, 12);
      }
    }
  });

  test("flanks are concave, which is what separates it from a plus sign", () => {
    // Walking one flank from waist to tip, the half-width must stay BELOW
    // the straight line between its ends. A straight taper reads as a
    // generic flared cross; the pinch is the Iron Cross.
    const span = 1;
    const { armLength, flankSteps, tipHalfWidth, waistHalfWidth } =
      IRON_CROSS_PROFILE;
    const outline = ironCrossOutline(span);
    let strictlyInside = 0;
    for (let step = 1; step < flankSteps; step += 1) {
      const [x, y] = outline[step];
      const t = (x - waistHalfWidth * span) / (armLength * span - waistHalfWidth * span);
      const straight = -(waistHalfWidth + t * (tipHalfWidth - waistHalfWidth)) * span;
      expect(Math.abs(y)).toBeLessThan(Math.abs(straight));
      strictlyInside += 1;
    }
    expect(strictlyInside).toBe(flankSteps - 1);
  });

  test("scales exactly linearly, so a size change cannot deform it", () => {
    const unit = ironCrossOutline(1);
    const big = ironCrossOutline(0.86);
    expect(outlineArea(big)).toBeCloseTo(outlineArea(unit) * 0.86 * 0.86, 12);
  });

  test("the oak wreath alternates its leaves in and out", () => {
    const leaves = oakWreathLeaves(0.5);
    expect(leaves).toHaveLength(22);
    expect(leaves[0].radius).toBeGreaterThan(leaves[1].radius);
    expect(Math.sign(leaves[0].tilt)).toBe(-Math.sign(leaves[1].tilt));
  });
});

describe("Quadriga model", () => {
  const group = createQuadriga();

  function meshNamed(name: string): Mesh {
    const found = group.getObjectByName(name);
    expect(found).toBeInstanceOf(Mesh);
    return found as Mesh;
  }

  test("declares what it is and is not", () => {
    // Nothing here is surveyed. The status string says so, in the same
    // place every other reference-based model in this project says it.
    expect(group.userData.geometryStatus).toBe(QUADRIGA_GEOMETRY_STATUS);
    expect(QUADRIGA_GEOMETRY_STATUS).toContain("surveyed measurement");
  });

  test("stands at the documented overall size", () => {
    const box = new Box3().setFromObject(group);
    const size = box.getSize(new Vector3());
    // About 6 m high and 6 m long, four horses abreast.
    expect(size.y).toBeGreaterThan(5.4);
    expect(size.y).toBeLessThan(6.6);
    expect(size.x).toBeGreaterThan(5.2);
    expect(size.x).toBeLessThan(6.8);
    expect(size.z).toBeGreaterThan(3.2);
    expect(size.z).toBeLessThan(4.6);
    // It stands ON the plinth: nothing hangs below y = 0 but the wheels'
    // own tolerance.
    expect(box.min.y).toBeGreaterThan(-0.05);
  });

  test("separates the sway parts from the static body", () => {
    // Wind must be able to lift a mane without dragging the horse with
    // it, so those parts are their own meshes with a stated pivot.
    for (const slot of ["mane", "tail", "robe"] as const) {
      const mesh = meshNamed(
        slot === "mane"
          ? "Quadriga manes"
          : slot === "tail"
            ? "Quadriga tails"
            : "Quadriga robe folds",
      );
      expect(mesh.userData.windSlot).toBe(slot);
      const wind = QUADRIGA_WIND_SLOTS[slot];
      expect(wind.maxDegrees).toBeGreaterThan(0);
      expect(wind.pivot).toHaveLength(3);
    }
    expect(meshNamed("Quadriga bodies").userData.windSlot).toBeUndefined();
  });

  test("snow lies only in winter, and only on upward faces", () => {
    const snow = meshNamed("Quadriga snow caps");
    expect(snow.visible).toBe(false);
    setQuadrigaMode(group, "winter");
    expect(snow.visible).toBe(true);
    // Caps sit above the chariot floor: none of them is under the car.
    const box = new Box3().setFromObject(snow);
    expect(box.min.y).toBeGreaterThan(QUADRIGA_DIMENSIONS.chariotFloorY);
    setQuadrigaMode(group, "day");
    expect(snow.visible).toBe(false);
  });

  test("every mode has a colour for every part, and they differ", () => {
    const keys = Object.keys(QUADRIGA_PALETTES.day) as Array<
      keyof (typeof QUADRIGA_PALETTES)["day"]
    >;
    for (const mode of MODES) {
      for (const key of keys) {
        const value = QUADRIGA_PALETTES[mode][key];
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffff);
      }
    }
    // Winter is genuinely colder than day: less red than blue in the
    // bronze, where day is warmer.
    const dayBronze = QUADRIGA_PALETTES.day.bronze;
    const winterBronze = QUADRIGA_PALETTES.winter.bronze;
    expect((dayBronze >> 16) & 255).toBeGreaterThan(dayBronze & 255);
    expect((winterBronze >> 16) & 255).toBeLessThan(winterBronze & 255);
  });

  test("switching mode repaints the vertices, it does not rebuild", () => {
    const bodies = meshNamed("Quadriga bodies");
    const before = bodies.geometry;
    const colour = bodies.geometry.getAttribute("color");
    const daySample = colour.getX(0);
    setQuadrigaMode(group, "night");
    expect(bodies.geometry).toBe(before);
    expect(bodies.geometry.getAttribute("color").getX(0)).not.toBeCloseTo(
      daySample,
      6,
    );
    // Night is the lit material; day and winter are flat paint.
    expect((bodies.material as { type: string }).type).toBe(
      "MeshStandardMaterial",
    );
    setQuadrigaMode(group, "day");
    expect((bodies.material as { type: string }).type).toBe(
      "MeshBasicMaterial",
    );
    expect(bodies.geometry.getAttribute("color").getX(0)).toBeCloseTo(
      daySample,
      6,
    );
  });

  test("the ink follows the mode like the rest of the drawn city", () => {
    const ink = group.getObjectByName("Quadriga ink lines") as LineSegments;
    expect(ink).toBeInstanceOf(LineSegments);
    for (const mode of MODES) {
      setQuadrigaMode(group, mode);
      expect(
        (ink.material as { color: { getHex: () => number } }).color.getHex(),
      ).toBe(QUADRIGA_PALETTES[mode].ink);
    }
    setQuadrigaMode(group, "day");
  });

  test("carries enough geometry to survive a close-up", () => {
    // The point of this model is that it holds together when the camera
    // goes all the way in. Four heads with nostrils, eyes and ears, eight
    // spokes per wheel and three feather courses per wing is not
    // something a few hundred triangles can carry.
    let triangles = 0;
    group.traverse((object) => {
      if (object instanceof Mesh) {
        triangles += object.geometry.getAttribute("position").count / 3;
      }
    });
    expect(triangles).toBeGreaterThan(4_000);
    // …but it is still one landmark, not a photogrammetry tile.
    expect(triangles).toBeLessThan(60_000);
  });
});

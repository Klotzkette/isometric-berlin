import { describe, expect, test } from "bun:test";
import { Path, Shape, ShapeGeometry, Vector2 } from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tessellatePlanarPlate } from "../src/tessellatePlanarPlate";

const ring = (points: number[][]) => points.map(([x, y]) => new Vector2(x, y));
const lawn = new Shape(ring([[-137.12, -25.125], [6.321, -91], [117, 0], [78, 130], [-21, 89]]));
lawn.holes.push(new Path(ring([[1.00002, 1], [30, 2], [5, 21]])));
const narrow = new Shape(ring([[0, -0], [128, 0], [128, 0.00004], [0, 0.00003]]));
const angled = new Shape(ring([[-90, -122], [14, -7], [-90, 108]]));
const tie = new Shape(ring([[-6, 0], [0, 8], [6, 0]]));

describe("planar terrain tessellation matches Three r185's final vertex order and storage", () => {
  for (const [name, shapes, edge, depth] of [
    ["hole, separated components and negative coordinates", [lawn, angled], 16, 12],
    ["tolerance collisions and signed zero", [narrow], 32, 12],
    ["iteration cutoff", [lawn, narrow], 1, 3],
    ["equal sides at the cutoff", [tie], 10, 12],
    ["equal sides below the cutoff", [tie], 9.99999, 12],
    ["unsplit first pass", [angled], 1000, 12],
    ["empty shape", [], 64, 12],
  ] as const) {
    test(name, () => {
      const source = new ShapeGeometry([...shapes]);
      source.deleteAttribute("uv");
      const temporary = new TessellateModifier(edge, depth).modify(source);
      const reference = mergeVertices(temporary, 1e-4);
      const actual = tessellatePlanarPlate(source, edge, depth);
      for (const [before, after] of [
        [reference.getAttribute("position").array, actual.getAttribute("position").array],
        [reference.index!.array, actual.index!.array],
      ]) {
        expect(after.constructor).toBe(before.constructor);
        expect(Buffer.from(after.buffer, after.byteOffset, after.byteLength)
          .equals(Buffer.from(before.buffer, before.byteOffset, before.byteLength))).toBe(true);
      }
      expect(actual.groups).toEqual(reference.groups);
      expect(actual.drawRange).toEqual(reference.drawRange);
      source.dispose();
      temporary.dispose();
      reference.dispose();
      actual.dispose();
    });
  }
});

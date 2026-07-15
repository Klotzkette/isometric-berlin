import { describe, expect, test } from "bun:test";
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import {
  markWindFlag,
  updateWindFlags,
  windFlagMatrixCount,
} from "../src/WindFlags";

describe("shared flag wind field", () => {
  test("keeps the pole edge fixed while moving the free edge", () => {
    const geometry = new PlaneGeometry(6, 2, 12, 2);
    geometry.translate(3, 0, 0);
    const flag = new Mesh(geometry, new MeshBasicMaterial());
    const root = new Group();
    root.add(flag);
    markWindFlag(flag, 6, { amplitudeM: 0.5, phase: 0.42 });

    const positions = geometry.getAttribute("position");
    const poleVertices: number[] = [];
    const freeVertices: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getX(index)) < 0.001) {
        poleVertices.push(index);
      }
      if (Math.abs(positions.getX(index) - 6) < 0.001) {
        freeVertices.push(index);
      }
    }
    updateWindFlags(root, 1.7);
    expect(poleVertices.every((index) => Math.abs(positions.getZ(index)) < 1e-6)).toBe(
      true,
    );
    expect(freeVertices.some((index) => Math.abs(positions.getZ(index)) > 0.05)).toBe(
      true,
    );
    expect(windFlagMatrixCount(root)).toBe(1);
  });
});

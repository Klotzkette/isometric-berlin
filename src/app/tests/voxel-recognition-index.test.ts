import { expect, test } from "bun:test";
import {
  VOXEL_RECOGNITION_AREAS,
  voxelRecognitionAreaAt,
} from "../src/MinecraftVoxelWorld";

function reference(x: number, z: number) {
  for (const area of VOXEL_RECOGNITION_AREAS) {
    const radians = (area.rotationDegrees * Math.PI) / 180;
    const cosine = Math.cos(radians),
      sine = Math.sin(radians);
    const dx = x - area.center[0],
      dz = z - area.center[1];
    if (
      Math.abs(dx * cosine - dz * sine) <= area.widthM / 2 + area.paddingM &&
      Math.abs(dx * sine + dz * cosine) <= area.depthM / 2 + area.paddingM
    )
      return area;
  }
  return null;
}

test("spatial lookup preserves original priority over the entire presentation bounds", () => {
  for (let x = -6500; x <= 6500; x += 29) {
    for (let z = -6500; z <= 6500; z += 31) {
      expect(voxelRecognitionAreaAt(x, z)).toBe(reference(x, z));
    }
  }
});

test("rotated boundaries, corners, overlaps and bucket edges keep exact membership", () => {
  for (const area of VOXEL_RECOGNITION_AREAS) {
    const radians = (area.rotationDegrees * Math.PI) / 180;
    const cosine = Math.cos(radians),
      sine = Math.sin(radians);
    for (const offset of [-1e-8, 0, 1e-8]) {
      for (let t = -1; t <= 1; t += 0.125) {
        for (const side of [-1, 1]) {
          const w = area.widthM / 2 + area.paddingM + offset;
          const d = area.depthM / 2 + area.paddingM + offset;
          for (const [lx, lz] of [
            [side * w, t * d],
            [t * w, side * d],
          ]) {
            const x = area.center[0] + lx * cosine + lz * sine;
            const z = area.center[1] - lx * sine + lz * cosine;
            expect(voxelRecognitionAreaAt(x, z)).toBe(reference(x, z));
          }
        }
      }
    }
  }
  for (let x = -512; x <= 2048; x += 128) {
    for (let z = -1024; z <= 1536; z += 128) {
      expect(voxelRecognitionAreaAt(x, z)).toBe(reference(x, z));
    }
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(voxelRecognitionAreaAt(value, 0)).toBeNull();
  }
});

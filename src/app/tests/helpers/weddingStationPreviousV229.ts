import { expect } from "bun:test";
import type { Object3D } from "three";
import { weddingMoabitSourceV229 } from "../../src/weddingMoabitV229Profile";

/** Reverse only v229's independently recorded rigid Wedding station lift.
 * Keep every live rail vertex, instance and unrelated transform in the old hash. */
export function restoreWeddingStationPreviousV229(root: Object3D): () => void {
  const proof = weddingMoabitSourceV229().stationCorrection;
  const matches: Object3D[] = [];
  root.traverse(object => {
    if (object.userData.stationName === "Wedding" && object.userData.anchorOsmId === proof.anchor &&
        object.userData.platformIds?.includes(proof.platform)) matches.push(object);
  });
  expect(matches).toHaveLength(1);
  const station = matches[0], matrix = station.matrix.clone(), position = station.position.clone();
  const world = station.matrixWorld.clone(), worldNeedsUpdate = station.matrixWorldNeedsUpdate;
  expect(station.userData.weddingHeightV229).toBeTrue();
  expect(proof.deltaY).toBe(6.5);
  expect(proof.newPlatformY - proof.oldPlatformY).toBeCloseTo(proof.deltaY, 12);
  expect(position.toArray()).toEqual([0, proof.deltaY, 0]);
  expect(matrix.elements).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, proof.deltaY, 0, 1]);
  station.position.y -= proof.deltaY; station.updateMatrix();
  return () => {
    station.position.copy(position); station.matrix.copy(matrix); station.matrixWorld.copy(world);
    station.matrixWorldNeedsUpdate = worldNeedsUpdate;
  };
}

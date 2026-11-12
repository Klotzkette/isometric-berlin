import { describe, expect, test } from "bun:test";
import { InstancedMesh, PerspectiveCamera } from "three";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "../src/HbfCirculationV291";
import { hbfLiftCabinPosition, hbfLiftLanding, hbfLiftLandingNear, hbfLiftLandings } from "../src/HbfLiftAccess";
import { createHbfNativeMovingFixturesV291, createHbfStationRuntimeV291 } from "../src/HbfStationMotionV291";
import { hauptbahnhofGroundAt, hauptbahnhofSolidAt } from "../src/HauptbahnhofNavigation";

describe("Hauptbahnhof public panoramic lift travel", () => {
  test("all 30 landings provide continuous approach and clear exit in both model families", () => {
    expect(hbfLiftLandings).toHaveLength(30);
    for (const { shaftIndex, levelIndex, point: [x, y, z] } of hbfLiftLandings) {
      expect(hbfLiftLandingNear(x, y, z)).toMatchObject({ shaftIndex, levelIndex });
      const shaft = HBF_CIRCULATION_V291.shafts[shaftIndex];
      const outside = Math.sign(shaft.x);
      for (const mode of ["day", "minecraft"] as const) for (const distance of [3, 3.3, 3.6, 3.9]) {
        const [lx, ly, lz] = hbfLocalToWorldV291([
          shaft.x + outside * distance, HBF_CIRCULATION_V291.levels[levelIndex].topLocalY, shaft.z,
        ]);
        expect(hauptbahnhofGroundAt(mode, lx, lz, ly)).toBeCloseTo(ly, 6);
        for (const height of [.4, .95, 1.5]) expect(hauptbahnhofSolidAt(mode, lx, ly + height, lz, .33)).toBeFalse();
      }
    }
    expect(hbfLiftLandingNear(0, 5, 0)).toBeNull();
  });

  test("an active cabin carries the visitor to the selected stop and resumes from that level", () => {
    const runtime = createHbfStationRuntimeV291();
    const root = createHbfNativeMovingFixturesV291();
    const cabin = root.getObjectByName("Minecraft Hauptbahnhof six moving lift cabins") as InstancedMesh;
    const shaftIndex = 3, from = 2, to = 4;
    const camera = new PerspectiveCamera();
    camera.position.set(...hbfLiftLanding(shaftIndex, from));
    camera.updateMatrixWorld(true);
    runtime.register(root);
    runtime.update(0, camera, true, false, false);
    expect(runtime.hasLiftCabins(true)).toBeTrue();
    expect(runtime.requestLiftRide(shaftIndex, from, from)).toBeFalse();
    expect(runtime.requestLiftRide(shaftIndex, from, to)).toBeTrue();
    expect(runtime.requestLiftRide(0, from, to)).toBeFalse();
    const before = runtime.liftCabinFloor(shaftIndex);
    runtime.update(5_000, camera, true, false, true);
    expect(runtime.liftCabinFloor(shaftIndex)).toBe(before);
    let timestamp = 5_000;
    for (; timestamp < 45_000 && runtime.liftRide?.phase !== "arrived"; timestamp += 50) {
      runtime.update(timestamp, camera, true, false, false);
      const floor = runtime.liftCabinFloor(shaftIndex);
      const worldY = hbfLiftCabinPosition(shaftIndex, floor)[1];
      expect(cabin.instanceMatrix.array[shaftIndex * 32 + 13] + .08).toBeCloseTo(worldY, 4);
    }
    expect(runtime.liftRide?.phase).toBe("arrived");
    expect(runtime.liftCabinFloor(shaftIndex)).toBeCloseTo(HBF_CIRCULATION_V291.levels[to].topLocalY, 6);
    runtime.cancelLiftRide();
    runtime.update(timestamp, camera, true, false, false);
    expect(runtime.liftCabinFloor(shaftIndex)).toBeCloseTo(HBF_CIRCULATION_V291.levels[to].topLocalY, 6);
  });

  test("reduced motion completes trips without leaving a cabin in the shaft", () => {
    const runtime = createHbfStationRuntimeV291();
    runtime.register(createHbfNativeMovingFixturesV291());
    const camera = new PerspectiveCamera();
    camera.position.set(...hbfLiftLanding(1, 2));
    camera.updateMatrixWorld(true);
    runtime.update(0, camera, true, true, false);
    expect(runtime.requestLiftRide(1, 2, 0)).toBeTrue();
    runtime.update(17, camera, true, true, false);
    runtime.update(34, camera, true, true, false);
    expect(runtime.liftRide?.phase).toBe("arrived");
    expect(runtime.liftCabinFloor(1)).toBeCloseTo(HBF_CIRCULATION_V291.levels[0].topLocalY, 6);
    expect(runtime.elapsedSeconds).toBe(0);
  });
});

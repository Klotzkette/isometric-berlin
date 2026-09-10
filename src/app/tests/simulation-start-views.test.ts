import { describe, expect, test } from "bun:test";
import { MathUtils, Spherical, Vector3 } from "three";
import { SIMULATION_START_SIGHT_NAMES } from "../src/viewNavigation";
import { SIMULATION_START_VIEWS, simulationStartCamera } from "../src/simulationStartViews";

describe("source-bound opening cameras", () => {
  test("every rotating opening has a finite physical pose and an explicit lens", () => {
    for (const name of SIMULATION_START_SIGHT_NAMES) {
      const view = SIMULATION_START_VIEWS[name];
      const camera = simulationStartCamera(name)!;
      expect(camera).not.toBeNull();
      expect(camera.fov_degrees).toBeGreaterThanOrEqual(16);
      expect(camera.fov_degrees).toBeLessThanOrEqual(39);
      const position = new Vector3(...camera.target_world).add(new Vector3().setFromSpherical(
        new Spherical(camera.distance_m, MathUtils.degToRad(camera.polar_degrees), MathUtils.degToRad(camera.azimuth_degrees)),
      ));
      for (let i = 0; i < 3; i++) expect(position.getComponent(i)).toBeCloseTo(view.position[i], 8);
      expect(camera.distance_m).toBeGreaterThan(15);
      expect(camera.distance_m).toBeLessThan(200);
    }
    expect(simulationStartCamera("Luiseninsel")).toBeNull();
    // The ordinary Pariser-Platz focus still belongs to the Academy facade.
    expect(simulationStartCamera("Pariser Platz")).toBeNull();
  });

  test("the gate is viewed westwards from within Pariser Platz", () => {
    const { position, target } = SIMULATION_START_VIEWS["Brandenburger Tor"];
    expect(position[0]).toBeGreaterThan(453);
    expect(position[0]).toBeLessThan(544);
    expect(position[2]).toBeGreaterThan(240);
    expect(position[2]).toBeLessThan(348);
    expect(target[0]).toBeLessThan(position[0]);
    expect(target[1]).toBeGreaterThan(15);
    expect(target[1]).toBeLessThan(22);
  });

  test("Washingtonplatz camera faces the station's southern glass entrance", () => {
    const { position, target } = SIMULATION_START_VIEWS["Berlin Hauptbahnhof"];
    const angle = MathUtils.degToRad(21.82);
    const local = (point: readonly number[]) => {
      const x = point[0] + 119.936, z = point[2] + 683.307;
      return [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];
    };
    const cameraLocal = local(position), targetLocal = local(target);
    expect(Math.abs(cameraLocal[0])).toBeLessThan(10);
    expect(cameraLocal[1]).toBeGreaterThan(140);
    expect(cameraLocal[1]).toBeLessThan(190);
    expect(Math.abs(targetLocal[0])).toBeLessThan(1);
    expect(targetLocal[1]).toBeCloseTo(90, 1);
  });

  test("the other public approaches face the architecture; Goldelse is at statue height", () => {
    const reichstag = SIMULATION_START_VIEWS["Reichstagsgebäude"];
    expect(reichstag.position[0]).toBeLessThan(200);
    expect(reichstag.target[0]).toBeGreaterThan(300);
    const chancellery = SIMULATION_START_VIEWS["Bundeskanzleramt"];
    expect(chancellery.position[0]).toBeGreaterThan(-37);
    expect(chancellery.target[0]).toBeLessThan(-150);
    const statue = SIMULATION_START_VIEWS["Siegessäule"];
    expect(statue.target[1]).toBeGreaterThan(60.78);
    expect(statue.target[1]).toBeLessThan(69.1);
    expect(statue.position[0]).toBeLessThan(statue.target[0]);
    expect(statue.position[1]).toBeLessThan(80);
  });
});

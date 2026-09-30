import { describe, expect, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";

describe("sunlight-dependent landmark response in the real isometric mode path", () => {
  test("day/snow/night/dream relight the existing surface without rebuilding geometry", () => {
    const city = new Group(), landmark = new Group();
    const calls: { sun: number[]; daylight: number }[] = [];
    landmark.userData.setFernsehturmLighting = (sun: Vector3, daylight: number) =>
      calls.push({ sun: sun.toArray(), daylight });
    const day = new MeshBasicMaterial(), night = new MeshStandardMaterial();
    const geometry = new BoxGeometry();
    const mesh = new Mesh(geometry, day);
    mesh.userData.dayMaterial = day; mesh.userData.nightMaterial = night;
    landmark.add(mesh); city.add(landmark);
    setIsoNightPresentation(city, false, true, "day");
    expect(calls.at(-1)!.daylight).toBe(1);
    expect(calls.at(-1)!.sun).toEqual(new Vector3(-760,980,720).normalize().toArray());
    setIsoNightPresentation(city, true, true, "night");
    expect(calls.at(-1)!.daylight).toBe(0);
    expect(mesh.material).toBe(night);
    setIsoNightPresentation(city, true, false, "night");
    expect(calls.at(-1)!.daylight).toBe(0);
    setIsoNightPresentation(city, false, true, "snowstorm");
    expect(calls.at(-1)!.daylight).toBe(0);
    setIsoNightPresentation(city, false, true, "schwellenraum");
    expect(calls.at(-1)!.daylight).toBe(.45);
    setIsoNightPresentation(city, false, true, "day");
    expect(calls.at(-1)!.daylight).toBe(1);
    expect(mesh.material).toBe(day);
    expect(mesh.geometry).toBe(geometry);
    expect(landmark.children).toEqual([mesh]);
    expect(calls).toHaveLength(6);
    geometry.dispose(); day.dispose(); night.dispose();
  });
});

import { describe, expect, test } from "bun:test";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
} from "three";

import voxelPayload from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  PARISER_PLATZ_WATER_MESH_NAME,
  createCentralCivicDetails,
} from "../src/CentralCivicDetails";
import {
  CITY_RECOGNITION_SMALL_WATER_MESH_NAME,
  createCityRecognitionRefinements,
} from "../src/CityRecognitionRefinements";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  installSchwellenraumWaterAtmosphere,
  isSchwellenraumWaterSurface,
} from "../src/visual-modes/schwellenraum/waterAtmosphere";

const payload = voxelPayload as unknown as VoxelPayload;
const centralLandmarkNames = [
  "Tramhaltestelle S+U Hauptbahnhof",
  "S15-Station Berlin Hauptbahnhof",
  "Oggi's Gemüsekebab",
  "Taxistand Washingtonplatz",
  "Futurium",
  "Bundesministerium für Forschung, Technologie und Raumfahrt",
  "Parlament der Bäume gegen Krieg und Gewalt",
  "Berliner Ensemble",
  "Bahnhof Berlin Friedrichstraße",
  "Bundesministerium der Finanzen / Detlev-Rohwedder-Haus",
  "Gropius Bau",
  "Abgeordnetenhaus von Berlin",
  "Topographie des Terrors",
  "Bundesministerium für Bildung, Familie, Senioren, Frauen und Jugend",
  "Pariser Platz",
  "Reichstagsvorfeld / Berlin-Pavillon",
] as const;
const centralLandmarks = centralLandmarkNames.map((name, index) => ({
  name,
  world: [index * 280, 4, (index % 3) * 320] as [number, number, number],
}));

function requiredMesh(root: Group, name: string): Mesh {
  const object = root.getObjectByName(name);
  expect(object, name).toBeInstanceOf(Mesh);
  if (!(object instanceof Mesh)) throw new Error(`Missing mesh: ${name}`);
  return object;
}

function expectBounds(
  mesh: Mesh,
  minimum: readonly [number, number, number],
  maximum: readonly [number, number, number],
): void {
  const bounds = new Box3().setFromObject(mesh);
  minimum.forEach((value, axis) =>
    expect(bounds.min.getComponent(axis)).toBeCloseTo(value, 5),
  );
  maximum.forEach((value, axis) =>
    expect(bounds.max.getComponent(axis)).toBeCloseTo(value, 5),
  );
}

function countColourVertices(root: Group, hex: number): number {
  const target = new Color(hex);
  let count = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const colours = object.geometry.getAttribute("color");
    if (!colours) return;
    for (let index = 0; index < colours.count; index += 1) {
      if (
        Math.abs(colours.getX(index) - target.r) < 0.00001 &&
        Math.abs(colours.getY(index) - target.g) < 0.00001 &&
        Math.abs(colours.getZ(index) - target.b) < 0.00001
      ) {
        count += 1;
      }
    }
  });
  return count;
}

function expectMaterialRoundtrip(root: Group, mesh: Mesh): void {
  const dayMaterial = mesh.userData.dayMaterial;
  const nightMaterial = mesh.userData.nightMaterial;
  expect(dayMaterial).toBeInstanceOf(MeshBasicMaterial);
  expect(nightMaterial).toBeInstanceOf(MeshStandardMaterial);
  expect(dayMaterial.vertexColors).toBeTrue();
  expect(dayMaterial.transparent).toBeFalse();
  expect(dayMaterial.depthWrite).toBeTrue();
  expect(dayMaterial.opacity).toBe(1);
  expect(nightMaterial.vertexColors).toBeTrue();
  expect(nightMaterial.flatShading).toBeTrue();
  expect(nightMaterial.roughness).toBe(0.9);
  expect(nightMaterial.transparent).toBeFalse();
  expect(nightMaterial.depthWrite).toBeTrue();
  expect(nightMaterial.opacity).toBe(1);
  expect(mesh.material).toBe(dayMaterial);

  setIsoNightPresentation(root, true, true, "night");
  expect(mesh.material).toBe(nightMaterial);
  setIsoNightPresentation(root, false, true, "day");
  expect(mesh.material).toBe(dayMaterial);
}

function expectAtmosphereUsesTopFacesOnly(root: Group, mesh: Mesh): void {
  const normals = mesh.geometry.getAttribute("normal");
  let topCount = 0;
  let nonTopCount = 0;
  for (let index = 0; index < normals.count; index += 1) {
    if (normals.getY(index) >= 0.55) topCount += 1;
    else nonTopCount += 1;
  }
  expect(topCount).toBeGreaterThan(0);
  expect(nonTopCount).toBeGreaterThan(0);

  expect(installSchwellenraumWaterAtmosphere(root)).toBe(1);
  const overlay = mesh.children.find(
    (child) => child.userData.schwellenraumWaterAtmosphere === true,
  );
  expect(overlay).toBeInstanceOf(Mesh);
  if (!(overlay instanceof Mesh)) throw new Error("Missing water overlay");
  expect(overlay.geometry).toBe(mesh.geometry);
  expect(overlay.material).toBeInstanceOf(ShaderMaterial);
  const material = overlay.material as ShaderMaterial;
  expect(material.fragmentShader).toContain("if (vWaterUp < 0.55) discard");
  expect(material.vertexShader).toContain(
    "vWaterUp = normalize(mat3(modelMatrix) * localNormal).y",
  );
}

describe("authored small-water Schwellenraum surface batches", () => {
  test("isolates the two Pariser-Platz fountain tops without changing their authored shape", () => {
    const root = createCentralCivicDetails(centralLandmarks);
    const water = requiredMesh(root, PARISER_PLATZ_WATER_MESH_NAME);
    const main = requiredMesh(root, "Central transit and civic details bodies");
    const marked: Mesh[] = [];
    root.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.userData.schwellenraumWaterSurface === true
      ) {
        marked.push(object);
      }
    });

    expect(marked).toEqual([water]);
    expect(isSchwellenraumWaterSurface(water)).toBeTrue();
    expect(water.geometry.getAttribute("position").count).toBe(488);
    expect(water.geometry.index?.count).toBe(960);
    expect(main.geometry.getAttribute("position").count).toBe(95_222);
    expect(main.geometry.index?.count).toBe(154_524);
    expect(
      main.geometry.getAttribute("position").count +
        water.geometry.getAttribute("position").count,
    ).toBe(95_710);
    expect((main.geometry.index?.count ?? 0) + (water.geometry.index?.count ?? 0)).toBe(
      155_484,
    );
    expect(countColourVertices(root, 0x77b7c8)).toBe(488);
    expect(water.parent?.children).toHaveLength(1);
    expectBounds(
      water,
      [489.0799865722656, 5.28000020980835, 249.77999877929688],
      [505.82000732421875, 5.380000114440918, 339.2200012207031],
    );
    expectMaterialRoundtrip(root, water);
    expectAtmosphereUsesTopFacesOnly(root, water);
  });

  test("shares one root batch for Triton and Hansabibliothek water without duplicating either", () => {
    const root = createCityRecognitionRefinements(payload);
    const water = requiredMesh(
      root,
      CITY_RECOGNITION_SMALL_WATER_MESH_NAME,
    );
    const tiergarten = requiredMesh(
      root,
      "Tiergarten bridge and memorial fine details bodies",
    );
    const west = requiredMesh(
      root,
      "Bellevue and Hansaviertel fine details bodies",
    );
    const marked: Mesh[] = [];
    root.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.userData.schwellenraumWaterSurface === true
      ) {
        marked.push(object);
      }
    });

    expect(root.children).toHaveLength(5);
    expect(root.userData.batchCount).toBe(5);
    expect(marked).toEqual([water]);
    expect(isSchwellenraumWaterSurface(water)).toBeTrue();
    expect(water.geometry.getAttribute("position").count).toBe(220);
    expect(water.geometry.index?.count).toBe(420);
    expect(tiergarten.geometry.getAttribute("position").count).toBe(1_919);
    expect(tiergarten.geometry.index?.count).toBe(2_976);
    expect(west.geometry.getAttribute("position").count).toBe(3_480);
    expect(west.geometry.index?.count).toBe(5_784);
    expect(
      tiergarten.geometry.getAttribute("position").count +
        west.geometry.getAttribute("position").count +
        water.geometry.getAttribute("position").count,
    ).toBe(5_619);
    expect(
      (tiergarten.geometry.index?.count ?? 0) +
        (west.geometry.index?.count ?? 0) +
        (water.geometry.index?.count ?? 0),
    ).toBe(9_180);
    expect(countColourVertices(root, 0x7eb3bf)).toBe(220);
    expect(water.parent?.parent).toBe(root);
    expect(water.parent?.children).toHaveLength(1);
    expectBounds(
      water,
      [-1947.77392578125, 5.110000133514404, 160.8748016357422],
      [-830.239990234375, 5.460000038146973, 188.74000549316406],
    );
    expectMaterialRoundtrip(root, water);
    expectAtmosphereUsesTopFacesOnly(root, water);
  });
});

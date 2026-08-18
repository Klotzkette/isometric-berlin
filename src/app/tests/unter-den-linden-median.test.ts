import { describe, expect, test } from "bun:test";
import { Group } from "three";

import surfacePayload from "../public/mesh/regierungsviertel/surface-polygons.json";
import type { SurfacePayload } from "../src/IsometricCityWorld";
import {
  UNTER_DEN_LINDEN_MEDIAN_SOURCE_NAME,
  deriveUnterDenLindenMedianSamples,
  installUnterDenLindenMedianRefinement,
} from "../src/visual-modes/schwellenraum/unterDenLindenMedian";

const surfaces = surfacePayload as unknown as SurfacePayload;

describe("Unter den Linden source-bound Schwellenraum median", () => {
  test("derives its complete plan geometry from paired committed OSM lane records", () => {
    const sourceRecords = surfaces.lane_markings?.filter(
      (marking) => marking.name === UNTER_DEN_LINDEN_MEDIAN_SOURCE_NAME,
    );
    expect(sourceRecords?.length ?? 0).toBeGreaterThan(20);

    const samples = deriveUnterDenLindenMedianSamples(surfaces);
    expect(samples.length).toBeGreaterThan(100);
    expect(Math.min(...samples.map((sample) => sample.x))).toBeGreaterThanOrEqual(
      620,
    );
    expect(Math.max(...samples.map((sample) => sample.x))).toBeLessThanOrEqual(
      1820,
    );
    for (const sample of samples) {
      expect(sample.highInnerZ - sample.lowInnerZ).toBeGreaterThanOrEqual(2.4);
      expect(sample.highInnerZ - sample.lowInnerZ).toBeLessThanOrEqual(34);
    }
  });

  test("keeps mapped intersections open instead of bridging data gaps", () => {
    const samples = deriveUnterDenLindenMedianSamples(surfaces);
    const gaps = samples
      .slice(1)
      .map((sample, index) => sample.x - samples[index].x)
      .filter((gap) => gap > 4.01);
    expect(gaps.length).toBeGreaterThan(0);
  });

  test("installs static terrain-following chunks with source metadata", () => {
    const root = new Group();
    const terrainAt = (x: number, z: number) => 4 + x * 0.0002 + z * 0.0001;
    const installed = installUnterDenLindenMedianRefinement(
      root,
      surfaces,
      terrainAt,
    );
    expect(installed).toBeGreaterThan(4);
    expect(installUnterDenLindenMedianRefinement(root, surfaces, terrainAt)).toBe(
      0,
    );
    expect(root.children).toHaveLength(installed);
    for (const chunk of root.children) {
      expect(chunk.userData.sourceName).toBe(
        UNTER_DEN_LINDEN_MEDIAN_SOURCE_NAME,
      );
      expect(chunk.userData.schwellenraumStatic).toBeTrue();
      expect(chunk.userData.schwellenraumPraesentation).toBeTrue();
      expect(chunk.userData.schutzradiusM).toBeGreaterThan(0);
      expect(chunk.children.some((child) => child.name.includes("veil"))).toBeTrue();
      expect(
        chunk.children.every(
          (child) => child.userData.schwellenraumStatic === true,
        ),
      ).toBeTrue();
    }
  });
});

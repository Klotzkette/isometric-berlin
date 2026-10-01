import { expect, test } from "bun:test";
import { CONCERT_HALL_SOURCE_BOUNDS } from "../src/concertHallsProfile";
import { kulturforumMuseumInside } from "../src/kulturforumMuseumsProfile";
import { compilePedestrianObstacles, pedestrianPointIsBlocked, PEDESTRIAN_EYE_HEIGHT_M } from "../src/pedestrianNavigation";
import type { VisualMode } from "../src/visualMode";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";

test("concert canopies remain open and collision follows the active mode's underside", () => {
  let checked = 0;
  for (const { part, minX, maxX, minZ, maxZ } of CONCERT_HALL_SOURCE_BOUNDS) {
    if (part.solidBaseY === part.groundY) continue;
    const building = prisms.buildings.find(p => p.id === part.shortId)!;
    let mode: VisualMode = "day";
    const index = compilePedestrianObstacles({ buildings: [building] }, () => mode);
    const nativeBottom = Math.floor((part.solidBaseY - part.groundY) / 2) * 2 + part.groundY;
    const point: number[] = [];
    for (let x = minX + .5; x < maxX && !point.length; x += 1) {
      for (let z = minZ + .5; z < maxZ; z += 1) {
        if (!kulturforumMuseumInside(building.ring, x * 10, z * 10)) continue;
        if ((building.holes ?? []).some(r => kulturforumMuseumInside(r, x * 10, z * 10))) continue;
        point.push(x, z); break;
      }
    }
    expect(point).toHaveLength(2);
    for (const next of ["day", "minecraft", "schwellenraum", "minecraft", "night"] as const) {
      mode = next;
      expect(pedestrianPointIsBlocked(point[0], point[1], part.groundY, index)).toBeFalse();
      const betweenUndersides = (nativeBottom + part.solidBaseY) / 2 - PEDESTRIAN_EYE_HEIGHT_M;
      expect(pedestrianPointIsBlocked(point[0], point[1], betweenUndersides, index)).toBe(mode === "minecraft");
    }
    checked++;
  }
  expect(checked).toBe(2);
});

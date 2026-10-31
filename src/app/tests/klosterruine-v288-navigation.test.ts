import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  compilePedestrianObstacles, createPedestrianEnvironment, pedestrianPointIsBlocked,
  type PedestrianObstacleIndex, type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";
import { berlinKlosterruineSolidsV288 } from "../src/BerlinKlosterruineV288Navigation";
import { preloadAltMitteV169NativeNavigation } from "../src/altMitteV169Profile";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import type { VisualMode } from "../src/visualMode";

const prisms = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
await preloadAltMitteV169NativeNavigation();
const all = (index: PedestrianObstacleIndex) => [...new Set([...index.cells.values()].flat())];
const isRuin = (p: { sourceId?: string }) => p.sourceId?.startsWith("klosterruine-v288-") === true;
const sourceShapeDigest = (index: PedestrianObstacleIndex) => {
  const hash = createHash("sha256");
  // Additional occupied cells may change traversal order, never old solids.
  for (const record of all(index).filter(p => !isRuin(p)).map(p => JSON.stringify(p)).sort()) hash.update(record).update("\n");
  return hash.digest("hex");
};
const drawnPier = [2766.38761998, 7.7, 115.80977877] as const;
const nativePier = [2788.4000000000055, 7.7, 108.39999999999999] as const;
const openings = [[2768.39990448, 7.7, 120.60333824], [2769.74697527, 7.7, 114.48717977], [2780, 7.7, 119]] as const;
const blocked = (index: PedestrianObstacleIndex, [x, y, z]: readonly [number, number, number]) => pedestrianPointIsBlocked(x, z, y, index);

test("additive ruin navigation defaults inactive and retains every old source obstacle", () => {
  const before = JSON.stringify(prisms);
  const baseline = compilePedestrianObstacles(prisms);
  const inactive = compilePedestrianObstacles(prisms, () => "day", { klosterruineV288: false });
  expect(all(inactive).some(isRuin)).toBe(false);
  expect(sourceShapeDigest(inactive)).toBe(sourceShapeDigest(baseline));
  const admitted = compilePedestrianObstacles(prisms, () => "day", { klosterruineV288: true });
  const additions = all(admitted).filter(isRuin);
  expect(additions).toHaveLength(berlinKlosterruineSolidsV288().length + berlinKlosterruineSolidsV288(true).length);
  expect(sourceShapeDigest(admitted)).toBe(sourceShapeDigest(baseline));
  expect(JSON.stringify(prisms)).toBe(before);
});

test("real opaque pier blocks walking while the west portal, nave arcade and interior stay open", () => {
  let mode: VisualMode = "day";
  const baseline = compilePedestrianObstacles(prisms, () => mode);
  const added = compilePedestrianObstacles(prisms, () => mode, { klosterruineV288: true });
  expect(blocked(baseline, drawnPier)).toBe(false);
  expect(blocked(added, drawnPier)).toBe(true);
  for (const next of ["day", "minecraft"] as const) {
    mode = next;
    for (const point of openings) {
      expect(blocked(baseline, point)).toBe(false);
      expect(blocked(added, point)).toBe(false);
    }
  }
  mode = "minecraft";
  expect(blocked(baseline, nativePier)).toBe(false);
  expect(blocked(added, nativePier)).toBe(true);
  // The earlier native body at this point remains active independently.
  expect(blocked(baseline, drawnPier)).toBe(true);
  expect(blocked(added, drawnPier)).toBe(true);
});

test("live model presence and visual mode select only the matching masonry representation", () => {
  let active = false, mode: VisualMode = "day";
  const index = compilePedestrianObstacles(prisms, () => mode, { klosterruineV288: () => active });
  const walls = all(index).filter((p): p is PedestrianPolygonObstacle => p.kind === "polygon" && isRuin(p));
  expect(walls.every(p => p.topAt!(0, 0) === -Infinity)).toBe(true);
  active = true;
  expect(walls.filter(p => p.topAt!(0, 0) !== -Infinity)).toHaveLength(berlinKlosterruineSolidsV288().length);
  expect(blocked(index, drawnPier)).toBe(true);
  expect(blocked(index, nativePier)).toBe(false);
  mode = "minecraft";
  expect(walls.filter(p => p.topAt!(0, 0) !== -Infinity)).toHaveLength(berlinKlosterruineSolidsV288(true).length);
  expect(blocked(index, nativePier)).toBe(true);
  active = false;
  expect(walls.every(p => p.topAt!(0, 0) === -Infinity)).toBe(true);
  expect(blocked(index, nativePier)).toBe(false);
});

test("environment forwards the live required-model callback", async () => {
  const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
  let active = false, mode: VisualMode = "day";
  const environment = createPedestrianEnvironment(ground, { water: [] }, null, prisms, undefined, { klosterruineV288: () => active });
  environment.visualMode = () => mode;
  expect(blocked(environment.obstacles!, drawnPier)).toBe(false);
  active = true; expect(blocked(environment.obstacles!, drawnPier)).toBe(true);
  mode = "minecraft"; expect(blocked(environment.obstacles!, nativePier)).toBe(true);
  active = false; expect(blocked(environment.obstacles!, nativePier)).toBe(false);
});

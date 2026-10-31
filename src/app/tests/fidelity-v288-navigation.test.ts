import { expect, test } from "bun:test";
import { compilePedestrianObstacles, createPedestrianEnvironment, type PedestrianPolygonObstacle } from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";
import type { VoxelPayload } from "../src/terrainPayload";
import type { VisualMode } from "../src/visualMode";
import historic from "../src/data/berlinHistoricCoreV288Ownership.json";
import corridor from "../src/data/potsdamerCorridorV288Owners.json";
import { berlinHistoricDomSolidsV288 } from "../src/BerlinHistoricCoreV288Navigation";
import { potsdamerCorridorSolidsV288 } from "../src/PotsdamerCorridorV288Navigation";

const buildings = [...historic.nearbyPrisms, ...corridor.oldPrisms, ...corridor.retainedPrisms] as PrismPayload["buildings"];
const prisms = { buildings };
const old = [...historic.legacyPrisms, ...corridor.oldPrisms];
const solids = [...berlinHistoricDomSolidsV288(), ...potsdamerCorridorSolidsV288()];
const polygons = (index: ReturnType<typeof compilePedestrianObstacles>) =>
  [...new Set([...index.cells.values()].flat())].filter((p): p is PedestrianPolygonObstacle => p.kind === "polygon");

test("v288 replacement navigation retains the exact old five/six fallback obstacles until model admission", () => {
  const baseline = polygons(compilePedestrianObstacles(prisms));
  const inactive = polygons(compilePedestrianObstacles(prisms, () => "day", { historicDomV288: false, potsdamerCorridorV288: false }));
  for (const source of old) {
    const before = baseline.find(p => p.sourceId === source.id)!, after = inactive.find(p => p.sourceId === source.id)!;
    expect(after).toEqual(before); expect(after.ring).toEqual(source.ring); expect(after.holes).toEqual(source.holes);
    expect(after.maxY).toBe((source.y0_dm + source.h_dm) / 10); expect(after.topAt).toBeUndefined();
  }
  for (const solid of solids) expect(inactive.some(p => p.sourceId === solid.sourceId)).toBe(false);
});

test("live admission toggles complete roof-aware source solids and restores all old heights without recompiling", () => {
  let admitted = false, mode: VisualMode = "day";
  const sourceBefore = JSON.stringify(prisms);
  const index = compilePedestrianObstacles(prisms, () => mode, {
    historicDomV288: () => admitted, potsdamerCorridorV288: () => admitted,
  });
  const all = polygons(index);
  for (const source of old) {
    const obstacle = all.find(p => p.sourceId === source.id)!;
    const priorTop = (source.y0_dm + source.h_dm) / 10;
    expect(obstacle.topAt!(0, 0)).toBe(priorTop);
    admitted = true; expect(obstacle.topAt!(0, 0)).toBe(-Infinity);
    admitted = false; expect(obstacle.topAt!(0, 0)).toBe(priorTop);
  }
  for (const solid of solids) {
    const found = all.filter(p => p.sourceId === solid.sourceId);
    expect(found).toHaveLength(1);
    const obstacle = found[0];
    expect(obstacle.ring).toBe(solid.ring); expect(obstacle.holes).toBe(solid.holes);
    expect(obstacle.minY).toBe(solid.minY); expect(obstacle.maxY).toBe(solid.maxY);
    const [x, z] = solid.ring[0];
    expect(obstacle.topAt!(x, z)).toBe(-Infinity);
    admitted = true;
    for (const next of ["day", "minecraft"] as const) {
      mode = next; expect(obstacle.topAt!(x, z)).toBe(solid.topAt(x, z) ?? -Infinity);
    }
    for (const hole of solid.holes) {
      const hx = hole.reduce((n, p) => n + p[0], 0) / hole.length;
      const hz = hole.reduce((n, p) => n + p[1], 0) / hole.length;
      expect(obstacle.topAt!(hx, hz)).toBe(-Infinity);
    }
    admitted = false;
  }
  expect(JSON.stringify(prisms)).toBe(sourceBefore);
});

test("changed or incomplete owner receipts cannot retire their original obstacles", () => {
  for (const historicFamily of [false, true]) {
    const changed = structuredClone(prisms);
    const id = historicFamily ? historic.legacyPrisms[0].id : corridor.oldPrisms[0].id;
    changed.buildings.find(p => p.id === id)!.h_dm++;
    const all = polygons(compilePedestrianObstacles(changed, () => "day", { historicDomV288: true, potsdamerCorridorV288: true }));
    const selected = historicFamily ? historic.legacyPrisms : corridor.oldPrisms;
    for (const source of selected) expect(all.find(p => p.sourceId === source.id)?.topAt).toBeUndefined();
    const selectedSolids = historicFamily ? berlinHistoricDomSolidsV288() : potsdamerCorridorSolidsV288();
    for (const solid of selectedSolids) expect(all.some(p => p.sourceId === solid.sourceId)).toBe(false);
  }
  const all = polygons(compilePedestrianObstacles({ buildings: [buildings.find(p => p.id === corridor.oldPrisms[0].id)!] }, () => "day", { potsdamerCorridorV288: true }));
  expect(all.find(p => p.sourceId === corridor.oldPrisms[0].id)?.topAt).toBeUndefined();
});

test("environment creation forwards live model admission rather than freezing its initial value", async () => {
  const ground = await Bun.file(new URL("../public/mesh/regierungsviertel/ground-context.json", import.meta.url)).json() as VoxelPayload;
  let active = false;
  const env = createPedestrianEnvironment(ground, { water: [] }, null, prisms, undefined, { historicDomV288: () => active, potsdamerCorridorV288: () => active });
  const all = polygons(env.obstacles!);
  for (const source of old) {
    const p = all.find(p => p.sourceId === source.id)!;
    expect(p.topAt!(0, 0)).toBe((source.y0_dm + source.h_dm) / 10);
    active = true; expect(p.topAt!(0, 0)).toBe(-Infinity); active = false;
  }
});

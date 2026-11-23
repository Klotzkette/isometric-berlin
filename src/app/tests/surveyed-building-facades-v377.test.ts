import { expect, test } from "bun:test";
import { surroundingPacketFingerprint } from "../src/surroundingPacketFingerprint";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { Box3, Color, FrontSide, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import {
  createSurveyedBuildingFacadesV377, verifiedSplitFacadePacketV377, type FacadeCatalogV377,
} from "../src/surveyedBuildingFacadesV377";

const profile = [{ kind: "window" as const, x: [0, 1], y: [.1, .9], columns: 12, rows: 4, color: 0x83969a }];
const fixture: FacadeCatalogV377 = { profiles: [profile, []], tiles: {
  "drawn:west": [{ id: "house", owner: "wing", faces: [
    [200, 150, 206, 158, 10, 26, 0.25, .75, 0, 1, 0],
    [206, 158, 210, 145, 10, 32, 0, 1, 0, 1, 1],
  ] }],
  "minecraft:west": [{ id: "house", owner: "vox", faces: [
    [208, 154, 216, 154, 12, 20, 0, .5, 0, .5, 0],
  ] }],
} };
const owners = new Set(["wing", "vox"]);

test("a sloped frontage in plan has outward normals, correct roof clearance and continuous bays", () => {
  const root = createSurveyedBuildingFacadesV377("west", false, [200, 10, 150], owners, fixture)!;
  const p = root.geometry.getAttribute("position"), n = root.geometry.getAttribute("normal");
  const uv = root.geometry.getAttribute("facadeUv"), measure = root.geometry.getAttribute("facadeSize");
  expect(p.count).toBe(4);
  expect(n.getX(0)).toBeCloseTo(-.8, 2);
  expect(n.getZ(0)).toBeCloseTo(.6, 2);
  expect(p.getY(0)).toBeCloseTo(1.6);
  expect(p.getY(2)).toBeCloseTo(14.4);
  expect(uv.getX(0)).toBe(3);
  expect(uv.getX(2)).toBe(9);
  expect(uv.getY(2)).toBe(4);
  expect(measure.getX(0)).toBeCloseTo(20 / 12);
  expect(root.userData.facadeOwnersV377).toEqual([{ id: "house", start: 0, count: 6 }]);
  expect(root.geometry.index?.count).toBe(6);
  expect(root.material).toBeInstanceOf(MeshBasicMaterial);
  expect(root.userData.nightMaterial).toBeInstanceOf(MeshStandardMaterial);
  expect(root.userData.dayMaterial.side).toBe(FrontSide);
});

test("source ownership, blind elevations and the separately mapped block variant remain distinct", () => {
  expect(createSurveyedBuildingFacadesV377("east", false, [], owners, fixture)).toBeUndefined();
  expect(createSurveyedBuildingFacadesV377("west", false, [], new Set(["other"]), fixture)).toBeUndefined();
  const root = createSurveyedBuildingFacadesV377("west", true, [0, 0, 0], owners, fixture)!;
  expect(root.material).toBeInstanceOf(MeshStandardMaterial);
  const b = new Box3().setFromObject(root);
  expect(b.min.x).toBe(208);
  expect(b.max.x).toBe(216);
  expect(b.min.z).toBeCloseTo(154.035, 3);
  expect(b.max.z).toBeCloseTo(154.035, 3);
  expect(b.max.y).toBe(20);
  const normal = new Vector3().fromBufferAttribute(root.geometry.getAttribute("normal"), 0);
  expect(normal.toArray()).toEqual([0, 0, 1]);
});

test("verified architectural grids use a bounded pair of triangles per strip even on a very large public building", () => {
  const heavy = { ...fixture, profiles: [[{...profile[0], rows: 140, columns: 210}]] };
  const root = createSurveyedBuildingFacadesV377("west", false, [0, 0, 0], owners, heavy)!;
  expect(root.geometry.index?.count).toBe(6);
  expect(root.geometry.getAttribute("facadeUv").getY(2)).toBe(140);
  expect(root.geometry.getAttribute("facadeUv").getX(2)).toBe(157.5);
  expect(root.material.transparent).toBe(true);
});

test("a legacy split native wall requires the exact physical packet hash when its navigation owner lives in a neighbour", () => {
  const sha = "e".repeat(64);
  const tile = fixture.tiles["minecraft:west"][0];
  const split = { ...fixture, tiles: { "minecraft:west": [{ ...tile, tileSha256: sha }] } };
  expect(createSurveyedBuildingFacadesV377("west", true, [0, 0, 0], owners, split)).toBeUndefined();
  expect(createSurveyedBuildingFacadesV377("west", true, [0, 0, 0], new Set(), split, "0".repeat(64))).toBeUndefined();
  expect(createSurveyedBuildingFacadesV377("west", true, [0, 0, 0], new Set(), split, sha)?.isMesh).toBe(true);
});

test("a measured door stays in front of the window, pier and material field even if source observations arrive in reverse order", () => {
  const order = ["entrance", "window", "pier", "spandrel", "brick"] as const;
  const source = { ...fixture, profiles: [order.map(kind => ({ ...profile[0], kind }))] };
  const root = createSurveyedBuildingFacadesV377("west", false, [200, 0, 150], owners, source)!;
  const index = root.geometry.index!, design = root.geometry.getAttribute("facadeDesign");
  const layers = [];
  for (let i = 0; i < index.count; i += 6) layers.push(design.getX(index.getX(i)));
  expect(layers).toEqual([7, 6, 5, 0, 4]);
  expect(root.userData.facadeOwnersV377).toEqual([{ id: "house", start: 0, count: 30 }]);
});

test("native split-wall admission checks decoded coordinates, indices and colours independently of compression", () => {
  const part = { kind: "city", positions: "AAAA", colors: "AABA", indices: "AAAB", positionType: "u16cm" as const };
  function finish<T>(steps: Generator<void, T>): T { for (;;) { const next = steps.next(); if (next.done) return next.value; } }
  const fingerprint = finish(surroundingPacketFingerprint(part));
  const key = "minecraft:split", sourceSha = "a".repeat(64);
  const source = { ...fixture, splitPackets: { [key]: { sourceSha, origin: [2, 3, 4], parts: [[0, fingerprint]] } } };
  const chunk: Pick<SurroundingCityChunk, "meshes" | "origin"> = { origin: [2, 3, 4], meshes: [part] };
  expect(finish(verifiedSplitFacadePacketV377(key, chunk, source))).toBe(sourceSha);
  expect(finish(verifiedSplitFacadePacketV377(key, { ...chunk, origin: [2, 3, 5] }, source))).toBeUndefined();
  for (const field of ["positions", "indices", "colors"] as const) {
    expect(finish(verifiedSplitFacadePacketV377(key, { ...chunk, meshes: [{ ...part, [field]: "ABAA" }] }, source))).toBeUndefined();
  }
});

test("dark surveyed finishes survive conversion to linear WebGL channels", () => {
  for (const tone of [0x06090b, 0x0e1b1f, 0x1b0d24, 0x92524d, 0xacc0d5]) {
    const source = { ...fixture, profiles: [[{ ...profile[0], color: tone }]] };
    const mesh = createSurveyedBuildingFacadesV377("west", false, [0, 0, 0], owners, source)!;
    const color = new Color().fromBufferAttribute(mesh.geometry.getAttribute("color"), 0);
    expect(color.getHex()).toBe(tone);
  }
});

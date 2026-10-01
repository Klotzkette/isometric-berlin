import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Group, InstancedMesh, Mesh } from "three";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { createUlapQuarter, createMinecraftUlapQuarter } from "../src/UlapQuarter";
import { createMoabitGuardHouses, createMinecraftMoabitGuardHouses } from "../src/MoabitGuardHouses";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { ULAP_QUARTER_SOURCE as S, ULAP_QUARTER_IDS, ULAP_URANIA_PARENT,
  isUlapQuarterColumn } from "../src/ulapQuarterProfile";

function measure(root: Group) {
  const hash = createHash("sha256"); let bytes = 0, draws = 0, instances = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    draws++; expect(object.matrixAutoUpdate).toBeFalse();
    expect(object.userData.dayMaterial.map).toBeNull(); expect(object.userData.nightMaterial.map).toBeNull();
    for (const attr of Object.values(object.geometry.attributes)) {
      expect(Array.from(attr.array).every(Number.isFinite)).toBeTrue(); bytes += attr.array.byteLength;
      hash.update(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
    }
    bytes += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) {
      instances += object.count;
      for (const a of [object.instanceMatrix, object.instanceColor!]) {
        bytes += a.array.byteLength; expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
        hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
      }
    }
  });
  return { draws, bytes, instances, hash: hash.digest("hex") };
}

test("current ULAP buildings retain all source parts without rebuilding the former laboratory", () => {
  expect(S.parts).toHaveLength(34); expect(ULAP_QUARTER_IDS.size).toBe(34);
  expect(new Set(S.parts.map(p => p.parent)).size).toBe(6);
  expect(S.excluded_source_parts).toHaveLength(19);
  expect(S.parts.some(p => p.parent === "DEBE01YYK0002Kui")).toBeFalse();
  for (const p of S.parts) {
    expect(p.viewerPrism).toEqual(prisms.buildings.find(b => b.id === p.viewerPrism.id));
    expect(p.roof_surfaces_world_m.length).toBeGreaterThan(0);
  }
  expect(isUlapQuarterColumn(-591, -590)).toBeTrue();
  expect(isUlapQuarterColumn(-630, -566)).toBeTrue();
  expect(isUlapQuarterColumn(-329, -906)).toBeFalse();
  expect(isUlapQuarterColumn(-600, -550)).toBeFalse();
});

test("Urania keeps its windowless curved upper hall and silver roof edge", () => {
  const root = createUlapQuarter(false, true), records = root.userData.detailRecords;
  for (const p of S.parts.filter(p => p.parent === ULAP_URANIA_PARENT)) {
    const own = records.filter((r: { id: string }) => r.id === p.viewerPrism.id);
    expect(own.some((r: { role: string }) => r.role === "urania-blind-brick")).toBeTrue();
    expect(own.some((r: { role: string }) => r.role === "urania-silver-cap")).toBeTrue();
    expect(own.some((r: { role: string }) => r.role.startsWith("office-window"))).toBeFalse();
    for (const r of own.filter((r: { role: string }) => r.role === "urania-service-opening"))
      expect(r.position[1] + r.size[1] / 2).toBeLessThan(p.viewerPrism.y0_dm / 10 + 3.1);
  }
});

test("ULAP adds one bounded batch per style with full mobile parity and no runtime images", () => {
  const drawn = measure(createUlapQuarter()), native = measure(createMinecraftUlapQuarter());
  expect(measure(createUlapQuarter(true))).toEqual(drawn);
  expect(measure(createMinecraftUlapQuarter(true))).toEqual(native);
  expect(drawn.draws).toBe(1); expect(native.draws).toBe(1);
  expect(drawn.bytes).toBeLessThan(700_000); expect(native.bytes).toBeLessThan(900_000);
  expect(createUlapQuarter().userData.detailRecords).toBeUndefined();
  expect(createMinecraftUlapQuarter().userData.hiddenSolidInfill).toBeFalse();
  console.log("ULAP quarter budgets", { drawn, native });
});

test("native current buildings retain source heights through thin surface roofs", () => {
  const root = createMinecraftUlapQuarter(false, true), records = root.userData.detailRecords;
  for (const p of S.parts) {
    const roof = records.filter((r: { id: string; role: string }) =>
      r.id === p.viewerPrism.id && r.role === "native-source-roof");
    expect(roof.length).toBeGreaterThan(0);
    for (const r of roof) {
      expect(r.position[1] + r.size[1] / 2).toBeLessThanOrEqual((p.viewerPrism.y0_dm + p.viewerPrism.h_dm) / 10 + .001);
      expect(r.size[1]).toBeLessThanOrEqual(2.601);
    }
  }
});

test("new ULAP and guard-house batches participate in reversible shared night presentation", () => {
  for (const create of [createUlapQuarter, createMinecraftUlapQuarter,
    createMoabitGuardHouses, createMinecraftMoabitGuardHouses]) {
    const root = create(), mesh = root.children[0] as Mesh;
    const before = measure(root);
    expect(mesh.userData.civicBuildingDetail).toBeTrue();
    setIsoNightPresentation(root, true, true);
    expect(mesh.material).toBe(mesh.userData.nightMaterial);
    setIsoNightPresentation(root, true, false);
    expect(mesh.material).toBe(mesh.userData.nightMaterial);
    setIsoNightPresentation(root, false, true, "day");
    expect(mesh.material).toBe(mesh.userData.dayMaterial);
    expect(measure(root)).toEqual(before);
  }
});

import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Group, InstancedMesh, Mesh } from "three";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";
import { createMoabitGuardHouses, createMinecraftMoabitGuardHouses } from "../src/MoabitGuardHouses";
import { MOABIT_GUARD_HOUSE_SOURCE as S, MOABIT_GUARD_HOUSE_IDS, isMoabitGuardHouseColumn, moabitGuardHouseRoofCode } from "../src/moabitGuardHouseProfile";

function measure(root: Group) {
  const hash = createHash("sha256"); let bytes = 0, draws = 0, instances = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    draws++;
    expect(object.matrixAutoUpdate).toBeFalse();
    expect(object.userData.dayMaterial.map).toBeNull();
    expect(object.userData.nightMaterial.map).toBeNull();
    for (const attr of Object.values(object.geometry.attributes)) {
      expect(Array.from(attr.array).every(Number.isFinite)).toBeTrue();
      bytes += attr.array.byteLength;
      hash.update(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength));
    }
    bytes += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) {
      instances += object.count;
      for (const a of [object.instanceMatrix, object.instanceColor!]) {
        bytes += a.array.byteLength;
        hash.update(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength));
      }
    }
  });
  return { draws, bytes, instances, hash: hash.digest("hex") };
}

test("three historic houses retain all five exact source prisms and independent identities", () => {
  expect(S.houses.map(h => h.address)).toEqual(["Lehrter Straße 5B", "Lehrter Straße 5C", "Lehrter Straße 5D"]);
  expect(S.houses.map(h => h.osm_way)).toEqual(["157673512", "157673507", "157673508"]);
  expect(MOABIT_GUARD_HOUSE_IDS.size).toBe(5);
  for (const h of S.houses) for (const p of h.parts) {
    expect(p.previous_prism).toEqual(prisms.buildings.find(b => b.id === p.previous_prism.id));
    expect(p.roof_surfaces_world_m.length).toBeGreaterThan(0);
    const x = p.previous_prism.ring.reduce((n, v) => n + v[0] / 10, 0) / p.previous_prism.ring.length;
    const z = p.previous_prism.ring.reduce((n, v) => n + v[1] / 10, 0) / p.previous_prism.ring.length;
    expect(isMoabitGuardHouseColumn(x, z)).toBeTrue();
  }
  // The park, cell and independent allotment structures must remain eligible.
  for (const p of [[-329, -906], [-377, -936], [-391, -975], [-380, -985]])
    expect(isMoabitGuardHouseColumn(p[0], p[1])).toBeFalse();
  expect(moabitGuardHouseRoofCode("K0002Sjv", 5000)).toBe(3200);
  expect(moabitGuardHouseRoofCode("other", 5000)).toBe(5000);
});

test("park-facing prison facades stay blind while exterior faces retain four-storey window rhythms", () => {
  const root = createMoabitGuardHouses(false, true), records = root.userData.facadeRecords;
  for (const house of S.houses) {
    const ids = new Set(house.parts.map(p => p.previous_prism.id));
    const own = records.filter((r: { partId: string }) => ids.has(r.partId));
    expect(own.some((r: { parkFacing: boolean; role: string }) => r.parkFacing && r.role === "brick-surface")).toBeTrue();
    expect(own.filter((r: { parkFacing: boolean; role: string }) => r.parkFacing && r.role.startsWith("window"))).toHaveLength(0);
    const glass = own.filter((r: { role: string }) => r.role === "window-glass");
    expect(glass.length).toBeGreaterThanOrEqual(12);
    expect(new Set(glass.filter((r: { partId: string }) => r.partId === house.parts[0].previous_prism.id)
      .map((r: { position: number[] }) => r.position[1])).size).toBe(4);
    expect(own.some((r: { role: string }) => r.role === "attic-corbel")).toBeTrue();
  }
});

test("mobile keeps full drawn detail and each style uses one fixed texture-free batch", () => {
  const drawn = measure(createMoabitGuardHouses());
  const native = measure(createMinecraftMoabitGuardHouses());
  expect(measure(createMoabitGuardHouses(true))).toEqual(drawn);
  expect(measure(createMinecraftMoabitGuardHouses(true))).toEqual(native);
  expect(drawn.draws).toBe(1); expect(native.draws).toBe(1);
  expect(drawn.bytes).toBeLessThan(220_000); expect(native.bytes).toBeLessThan(125_000);
  expect(createMoabitGuardHouses().userData.facadeRecords).toBeUndefined();
  expect(createMinecraftMoabitGuardHouses().userData.hiddenSolidInfill).toBeFalse();
  console.log("Moabit guard-house budgets", { drawn, native });
});

test("native houses have roof surfaces and hollow interiors without smooth duplicate shells", () => {
  const root = createMinecraftMoabitGuardHouses(false, true);
  expect(root.userData.surfaceOnly).toBeTrue();
  expect(root.userData.keepInMinecraft).toBeTrue();
  expect(root.children).toHaveLength(1);
  expect(root.children[0] instanceof InstancedMesh).toBeTrue();
  const records = root.userData.facadeRecords;
  for (const house of S.houses) for (const part of house.parts) {
    const roof = records.filter((r: { partId: string; role: string }) =>
      r.partId === part.previous_prism.id && r.role === "native-roof-surface");
    expect(roof.length).toBeGreaterThan(0);
    for (const r of roof) {
      expect(r.position[1] + r.size[1] / 2).toBeLessThanOrEqual((part.previous_prism.y0_dm + part.previous_prism.h_dm) / 10 + .001);
      expect(r.size[1]).toBeLessThanOrEqual(2.8001);
    }
  }
});

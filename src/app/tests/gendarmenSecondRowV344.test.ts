import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Group, InstancedMesh, Matrix4 } from "three";
import { createAltMitteCoreV169FromSource, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { createGendarmenSecondRowV344, gendarmenSecondRowPanelsV344 } from "../src/GendarmenSecondRowV344";
import data from "../src/data/gendarmenSecondRowV344.json";
import { disposeSurroundingCityRoot } from "../src/disposeSurroundingCityRootV323";

const root = resolve(import.meta.dir, "../../..");
function world(native: boolean): Group {
  const ids = new Set(data.buildings.flatMap(site => (native && site.nativeFronts ? site.nativeFronts : site.fronts)
    .flatMap(front => (native ? front.nativeReceipts : front.drawnReceipts).map(r => r.packetId))));
  const dir = resolve(import.meta.dir, `../src/data/altMitteV169${native ? "Native" : "Drawn"}`);
  const chunks = readdirSync(dir).map(file => JSON.parse(readFileSync(resolve(dir, file), "utf8")))
    .filter(packet => ids.has(packet.id)).map(packet => ({ id: packet.id, packet }));
  const payload = { schemaVersion: 1, sourceParents: data.buildings.map(b => b.owner),
    drawnChunks: native ? [] : chunks, minecraftChunks: native ? chunks : [] } as AltMitteCoreV169Source;
  const group = new Group();
  group.add(createAltMitteCoreV169FromSource(payload, native, { schlossplatzV239: true, sourceQuartersV303: true }));
  return group;
}

describe("Gendarmenmarkt second row source-hosted architecture v344", () => {
  test("the eight named active source families and packet receipts are unchanged", () => {
    expect(data.buildings).toHaveLength(8);
    expect(new Set(data.buildings.map(b => b.owner)).size).toBe(8);
    for (const source of data.sources) {
      expect(createHash("sha256").update(readFileSync(resolve(root, source.path))).digest("hex")).toBe(source.sha256);
    }
    expect(data.buildings.some(b => ["DEBE01YYK00004wE", "DEBE01YYK00002LK", "DEBE01YYK0000AjP"].includes(b.owner))).toBe(false);
  });
  test("missing declarations cannot produce floating decoration", () => {
    const empty = new Group();
    empty.userData.sourceParents = data.buildings.map(b => b.owner);
    for (const native of [false, true]) expect(createGendarmenSecondRowV344(empty, native).children).toHaveLength(0);
  });
  test("photographic recognition stays within measured wall and eave bounds", () => {
    for (const site of data.buildings) for (const front of site.fronts) {
      const length = Math.hypot(front.endXZ[0] - front.startXZ[0], front.endXZ[1] - front.startXZ[1]);
      for (const p of gendarmenSecondRowPanelsV344(site, front)) {
        expect(p.u - p.w / 2).toBeGreaterThanOrEqual(0);
        expect(p.u + p.w / 2).toBeLessThanOrEqual(length + .00001);
        expect(p.y - p.h / 2).toBeGreaterThanOrEqual(front.wallBaseY);
        expect(p.y + p.h / 2).toBeLessThanOrEqual(front.wallTopY);
      }
    }
  });
  for (const native of [false, true]) test(`${native ? "Native" : "Drawn"}: all eight families attach to the actual decoded resident world`, () => {
    const host = world(native), detail = createGendarmenSecondRowV344(host, native);
    expect(detail.userData.admitted).toHaveLength(8);
    expect(detail.userData.instances).toBeGreaterThan(1000);
    expect(detail.userData.instanceBytes).toBeLessThan(900_000);
    expect(detail.userData.fullAndMobileIdentical).toBe(true);
    expect(detail.userData.replacementOwners).toEqual([]);
    if (native) {
      const matrix = new Matrix4();
      for (const mesh of detail.children as InstancedMesh[]) for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        for (const index of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[index]).toBe(0);
      }
      expect(detail.userData.nativeFaces).toBeGreaterThan(100);
    }
    host.position.x = 1; host.updateMatrix();
    expect(createGendarmenSecondRowV344(host, native).children).toHaveLength(0);
    disposeSurroundingCityRoot(detail); disposeSurroundingCityRoot(host);
  });
});

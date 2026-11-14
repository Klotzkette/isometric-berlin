import { describe, expect, test } from "bun:test";
import streetsData from "../src/data/districtStreets.json";
import payload from "../src/data/mitteRoadsV343.json";
import type { StreetSource } from "../src/DistrictStreets";
import { createMitteRoadDetailsV343, getMitteRoadTransactionV343 } from "../src/mitteRoadsV343";
import { Mesh } from "three";
import { appendReichstagPublicRealmV256 } from "../src/ReichstagPublicRealmV256";
import realm from "../src/data/reichstagPublicRealmV256.json";

const streets = streetsData as unknown as StreetSource;

describe("surveyed Kanzleramt street transaction", () => {
  test("complete original ownership admits without modifying source", () => {
    const before = JSON.stringify(streets);
    const transaction = getMitteRoadTransactionV343(streets)!;
    expect(transaction).not.toBeNull();
    expect(transaction.surfaceRemovals.get("asphalt")?.size).toBe(417);
    expect(transaction.surfaceRemovals.get("paving")?.size).toBe(1035);
    expect(JSON.stringify(streets)).toBe(before);
  });
  test("changed affected face position, index, or complete curb rejects whole family", () => {
    const face = payload.surfacePatches[0].faces[0];
    const positionEdit = structuredClone(streets);
    const surface = positionEdit.surfaces.find(row => row.kind === payload.surfacePatches[0].kind)!;
    const bytes = Buffer.from(surface.positions_cm_b64, "base64");
    const id = (face[1] as number[])[0];
    bytes.writeInt32LE(bytes.readInt32LE(id * 8) + 1, id * 8);
    surface.positions_cm_b64 = bytes.toString("base64");
    expect(getMitteRoadTransactionV343(positionEdit)).toBeNull();
    const indexEdit = structuredClone(streets);
    const indexed = indexEdit.surfaces.find(row => row.kind === payload.surfacePatches[0].kind)!;
    const indices = Buffer.from(indexed.indices_b64, "base64");
    indices.writeUInt32LE(id + 1, (face[0] as number) * 12);
    indexed.indices_b64 = indices.toString("base64");
    expect(getMitteRoadTransactionV343(indexEdit)).toBeNull();
    const curbEdit = structuredClone(streets);
    curbEdit.curbs_m[payload.curbReplacements[0].index][0][0] += .01;
    expect(getMitteRoadTransactionV343(curbEdit)).toBeNull();
  });
  test("missing, duplicate and malformed owners retain old street family", () => {
    const missing = { ...streets, surfaces: streets.surfaces.filter(row => row.kind !== "asphalt") };
    expect(getMitteRoadTransactionV343(missing)).toBeNull();
    expect(getMitteRoadTransactionV343({ ...streets, surfaces: [...streets.surfaces, streets.surfaces[0]] })).toBeNull();
    expect(getMitteRoadTransactionV343(streets, { ...payload, supplement: null })).toBeNull();
    expect(getMitteRoadTransactionV343(streets, { ...payload, surfaces: [] })).toBeNull();
  });
  test("unrelated owners and source arrays remain intact", () => {
    const unrelated = structuredClone(streets);
    const affected = new Set(payload.curbReplacements.map(row => row.index));
    const index = unrelated.curbs_m.findIndex((_, n) => !affected.has(n));
    unrelated.curbs_m[index][0][0] += .01;
    expect(getMitteRoadTransactionV343(unrelated)).not.toBeNull();
  });
  test("same transaction replaces only complete old kerb joints; fallback and Native keep all", () => {
    const transaction = getMitteRoadTransactionV343(streets)!;
    expect(transaction.jointRemovals.size).toBe(126);
    for (const native of [false, true]) for (const admitted of [false, true]) {
      const emitted: number[][] = [];
      appendReichstagPublicRealmV256({ native, box(p, size, color, yaw = 0) {
        emitted.push([...p, ...size, yaw, color]);
      } }, () => 0, admitted ? transaction : null);
      const original = native ? realm.nativeRows : realm.boxes;
      const expected = original.filter((_, index) => native || !admitted || !transaction.jointRemovals.has(index));
      expect(emitted).toEqual(expected.map(row => native ? [...row.slice(0, 6), 0, row[6]] : row));
      // All 20 original fountain strips and every outside kerb joint survive.
      expect(emitted.slice(0, native ? realm.counts.nativeFountainMembers : realm.counts.drawnFountainMembers))
        .toEqual(expected.slice(0, native ? realm.counts.nativeFountainMembers : realm.counts.drawnFountainMembers)
          .map(row => native ? [...row.slice(0, 6), 0, row[6]] : row));
    }
    const changed = structuredClone(payload);
    changed.jointReplacements[0].original[0] += .01;
    expect(getMitteRoadTransactionV343(streets, changed)).toBeNull();
  });
  test("all surfaces retain DGM heights, bounded indexed geometry and day/night state", () => {
    const transaction = getMitteRoadTransactionV343(streets)!;
    const group = createMitteRoadDetailsV343((x, z) => 3 + x * .001 + z * .002, transaction);
    expect(group.children.length).toBe(payload.surfaces.length + 1);
    for (const [index, object] of group.children.entries()) {
      expect(object.userData.dayMaterial).toBeDefined();
      expect(object.userData.nightMaterial).toBeDefined();
      expect(object.matrixAutoUpdate).toBe(false);
      if (!(object instanceof Mesh)) continue;
      const positions = object.geometry.getAttribute("position");
      expect(positions.count).toBeGreaterThan(0);
      for (let n = 0; n < positions.count; n++) {
        const x = positions.getX(n), y = positions.getY(n), z = positions.getZ(n);
        expect(y).toBeCloseTo(3 + x * .001 + z * .002 + payload.surfaces[index].lift, 4);
      }
    }
  });
});

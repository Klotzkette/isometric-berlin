import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { appendUnityVisitorV256, UNITY_VISITOR_V256 as profile } from "../src/UnityVisitorV256";

test("unity plaque remains low and centered on the retained flag; existing visitor owner only", () => {
  for (const native of [false, true]) {
    const boxes: { p: number[]; size: number[]; yaw: number }[] = [], beams: number[][] = [];
    const receipt = appendUnityVisitorV256({
      native,
      box(p, size, _color, yaw = 0) { boxes.push({ p, size, yaw }); },
      beam(a, b) { beams.push([...a, ...b]); },
    }, () => 4.18);
    expect(receipt.sourceOwner).toBe("DEBE01YYK0002TmN");
    expect(receipt.containerJoints).toBe(native ? 30 : 42);
    expect(profile.poleHeightM).toBe(28.5);
    expect(profile.flagAreaM2).toBe(60);
    expect(boxes[0].p).toEqual([profile.flagAnchor[0], 4.193, profile.flagAnchor[1]]);
    expect(boxes[0].size[1]).toBeLessThan(.04);
    expect(boxes.length).toBeLessThan(1700);
    expect(beams.length).toBeLessThan(400);
    if (native) {
      expect(boxes.every(b => b.yaw === 0)).toBeTrue();
      // Native roof fittings follow source voxel faces as independent boxes.
      expect(beams).toHaveLength(0);
    }
    expect([...boxes.flatMap(b => [...b.p, ...b.size]), ...beams.flat()].every(Number.isFinite)).toBeTrue();
  }
});

test("visitor fittings follow the retained rendered prism while preserving measured source height", () => {
  const payload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url), "utf8"));
  const prism = payload.buildings.find((building: { id: string }) => building.id === "K0002TmN");
  expect(prism).toBeDefined();
  expect(profile.source.heightM).toBe(3.005);
  expect(profile.source.renderedGroundY).toBe(prism.y0_dm / 10);
  expect(profile.source.renderedHeightM).toBe(prism.h_dm / 10);
  for (const native of [false]) {
    const joints: { p: number[]; size: number[] }[] = [], coping: number[][] = [];
    appendUnityVisitorV256({
      native,
      box(p, size) { if (size[1] > 1) joints.push({ p, size }); },
      beam(a, b, width) { if (width === .12) coping.push([...a, ...b]); },
    }, () => 4.18);
    expect(joints.length).toBeGreaterThan(30);
    expect(joints.every(joint => joint.p[1] === 6.5 && joint.size[1] === 2.8)).toBeTrue();
    expect(coping).toHaveLength(profile.source.ring.length - 1);
    expect(coping.every(edge => edge[1] === 7.93 && edge[4] === 7.93)).toBeTrue();
  }
});

test("native visitor trim follows every exposed source column face and its actual top", () => {
  const payload = JSON.parse(readFileSync(new URL("../public/mesh/regierungsviertel/minecraft-voxels.json", import.meta.url), "utf8"));
  const columns = profile.nativeSource.columns;
  expect(columns).toHaveLength(43);
  for (const [x, z, y0, y1, classId] of columns) {
    const row = payload.building_rows[z - payload.grid.min_z_idx];
    expect(row.some(([start, count, lo, hi, kind]: number[]) =>
      x >= start + payload.grid.min_x_idx && x < start + payload.grid.min_x_idx + count &&
      lo === y0 && hi === y1 && kind === classId)).toBeTrue();
  }
  const coping: { p: number[]; size: number[] }[] = [], joints: number[][] = [];
  appendUnityVisitorV256({
    native: true,
    box(p, size) {
      if (size[1] === .14) coping.push({ p, size });
      if (size[1] > 1) joints.push(p);
    },
    beam() { throw new Error("Native fittings must be independent unrotated boxes"); },
  }, () => 5);
  expect(coping).toHaveLength(30);
  expect(joints).toHaveLength(30);
  for (let i = 0; i < coping.length; i++) {
    const [x, z, y0, top, alongX] = profile.nativeSource.exposedEdges[i];
    expect(coping[i].p).toEqual([x, top - .07, z]);
    expect(coping[i].size).toEqual(alongX ? [4, .14, .12] : [.12, .14, 4]);
    expect(joints[i]).toEqual([x, (y0 + top) / 2, z]);
  }
});

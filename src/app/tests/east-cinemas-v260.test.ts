import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { appendEastCinemasV260, EAST_CINEMAS_V260 as source } from "../src/EastCinemasV260";
import { eastCinemasSolidAtV260, eastCinemasWalkableInteriorV260, transferEastCinemasNavigationV260 } from "../src/eastCinemasV260Navigation";
import { transferExactPacketTriangles } from "../src/exactPacketTransfer";
import receipt from "../src/data/eastCinemasV260Ownership.json";
import { letteringStrokePaths } from "../src/drawnLettering";

function collect(minecraft: boolean) {
  const boxes: number[][] = [], lines: number[][] = [], rounds: number[][] = [];
  const stats = appendEastCinemasV260({ minecraft,
    box: (p, s, c, a = 0) => boxes.push([...p, ...s, c, a]),
    line: (a, b, w, c = 0) => lines.push([...a, ...b, w, c]),
    round: (p, s, c = 0) => rounds.push([...p, ...s, c]),
  });
  return { boxes, lines, rounds, stats };
}
const p = source.sites.international;
function at(u: number, depth: number): [number, number] {
  const dx = p.frontB[0] - p.frontA[0], dz = p.frontB[1] - p.frontA[1], length = Math.hypot(dx, dz);
  return [p.frontA[0] + dx * u / length + p.inward[0] * depth,
    p.frontA[1] + dz * u / length + p.inward[1] * depth];
}

test("all source bytes survive; two sites keep independent finite complete native detail", () => {
  for (const [path, expected] of Object.entries(source.sourcePackets)) {
    expect(createHash("sha256").update(readFileSync(new URL(`../../../${path}`, import.meta.url))).digest("hex")).toBe(expected);
  }
  const d = collect(false), n = collect(true);
  expect(d.boxes.length).toBeGreaterThan(300); expect(d.boxes.length).toBeLessThan(1200);
  expect(n.boxes.length).toBeGreaterThan(d.boxes.length); expect(n.boxes.length).toBeLessThan(20000);
  expect(n.lines).toEqual([]); expect(n.rounds).toEqual([]);
  expect(n.boxes.every(r => r[7] === 0)).toBe(true);
  for (const r of [...d.boxes, ...n.boxes]) {
    expect(r.every(Number.isFinite)).toBe(true); expect(Math.min(...r.slice(3, 6))).toBeGreaterThan(0);
    expect(r[0]).toBeGreaterThan(3445); expect(r[0]).toBeLessThan(3533);
    expect(r[2]).toBeGreaterThan(-148); expect(r[2]).toBeLessThan(34);
  }
  expect(d.stats.fullStaticDetailOnTouch).toBe(true);
  expect(d.stats.descriptorCountAdded).toBe(0); expect(d.stats.drawCallsAdded).toBe(0);
  expect(collect(false)).toEqual(d); expect(collect(true)).toEqual(n);
});

test("Moskau roof labels and International glyphs read left to right from the street", () => {
  const lines = collect(false).lines;
  const north = source.sites.moskau.faces.find(f => f.part === "DEBE3DUQ9zttyhg5" && f.index === 11)!;
  const west = source.sites.moskau.faces.find(f => f.part === "DEBE3DPNUb0lyc6p" && f.index === 10)!;
  const front = { a: p.frontA, b: p.frontB, normal: p.inward.map(v => -v) };
  const cases = [
    { f: north, text: "MOSKAU", u: 7.1, y: 13.35, height: 1.22, out: .25 },
    { f: west, text: "CAFE RESTAURANT", u: 13, y: 13.05, height: .62, out: .24 },
    // The asymmetric R also guards the already-correct International basis.
    { f: front, text: "R", u: Math.hypot(p.frontB[0] - p.frontA[0], p.frontB[1] - p.frontA[1]) / 2 - 2 * 2.05,
      y: 18.35, height: .9, out: .38 },
  ];
  for (const { f, text, u, y, height, out } of cases) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const cx = f.a[0] + (f.b[0] - f.a[0]) * u / len + f.normal[0] * out;
    const cz = f.a[1] + (f.b[1] - f.a[1]) * u / len + f.normal[1] * out;
    const paths = letteringStrokePaths(text, height), xs = paths.flat().map(v => v[0]);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2, halfWidth = (Math.max(...xs) - Math.min(...xs)) / 2;
    const projected = lines.filter(r => r[7] === 0xbea265).map(r => [r.slice(0, 3), r.slice(3, 6)])
      .filter(ends => ends.every(v => Math.abs((v[0] - cx) * f.normal[0] + (v[2] - cz) * f.normal[1]) < 1e-7))
      .map(ends => ends.map(v => [(v[0] - cx) * f.normal[1] - (v[2] - cz) * f.normal[0], v[1] - y]))
      .filter(ends => ends.every(v => Math.abs(v[0]) <= halfWidth + 1e-7 && v[1] >= -1e-7 && v[1] <= height + 1e-7));
    const expected = paths.flatMap(path => path.slice(1).map((v, i) => [[path[i][0] - mid, path[i][1]], [v[0] - mid, v[1]]]));
    expect(projected).toHaveLength(expected.length);
    projected.flat(2).forEach((value, i) => expect(value).toBeCloseTo(expected.flat(2)[i], 7));
  }
});

test("source-bound nine metre opening agrees with drawn and independent native solids", () => {
  for (const native of [false, true]) for (const u of [4, 17, 30]) {
    const [x, z] = at(u, 4);
    expect(eastCinemasSolidAtV260(x, 5, z, .2, native)).toBe(false);
    expect(eastCinemasWalkableInteriorV260(x, 5, z, p.parent, native)).toBe(true);
    expect(eastCinemasWalkableInteriorV260(x, 5, z, "neighbour", native)).toBe(false);
    expect(eastCinemasWalkableInteriorV260(x, 5, z, undefined, native)).toBe(false);
    expect(eastCinemasSolidAtV260(x, 12, z, .2, native)).toBe(true);
    const [rx, rz] = at(u, 12);
    expect(eastCinemasSolidAtV260(rx, 5, rz, .2, native)).toBe(true);
  }
  const original = receipt.navigationRecords[0].original;
  const unrelated = { ...original, sourceId: "unrelated-owner" };
  const nav = { ground: [], water: [], buildings: [original, unrelated], groundY: 3 };
  const fixed = transferEastCinemasNavigationV260("6_-1", nav);
  expect(fixed.buildings).toHaveLength(3);
  expect(fixed.buildings[0].minHeight).toBe(6);
  expect(fixed.buildings[1].height).toBe(6);
  expect(fixed.buildings[2]).toBe(unrelated);
  expect(nav.buildings).toEqual([original, unrelated]);
  expect(transferEastCinemasNavigationV260("other", nav)).toBe(nav);
  const changed = { ...nav, buildings: [{ ...original, height: original.height + .01 }] };
  expect(transferEastCinemasNavigationV260("6_-1", changed)).toBe(changed);
});

test("exact immutable packet receipts change only the audited International indices", () => {
  for (const native of [false, true]) {
    const mode = native ? "minecraft" : "drawn";
    const packet = JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/6_-1.${mode}.json.gz`, import.meta.url))).toString());
    for (const mesh of packet.meshes) {
      const raw = Buffer.from(mesh.indices, "base64");
      const before = new Uint32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
      const after = before.slice();
      const gen = transferExactPacketTriangles(receipt.records, "6_-1", native, mesh, after, 0);
      let r = gen.next(); while (!r.done) r = gen.next();
      if (!r.value) { expect(after).toEqual(before); continue; }
      const selected = new Set(receipt.records.filter(r => r.mode === mode).flatMap(r => r.triangles));
      for (let i = 0; i < before.length; i += 3) {
        if (selected.has(i / 3)) expect(Array.from(after.slice(i, i + 3))).toEqual([before[i], before[i], before[i]]);
        else expect(Array.from(after.slice(i, i + 3))).toEqual(Array.from(before.slice(i, i + 3)));
      }
    }
  }
});

test("only the exactly receipted old lower edge yields at the new recess", async () => {
  const { eastCinemasPreviousEdgesV260 } = await import("../src/eastCinemasV260Previous");
  const old = (await import("../src/data/altMitteEdgesV186.json")).default.cells.find(c => c.cell === "6:-1")!.rows;
  const next = eastCinemasPreviousEdgesV260("6:-1", old);
  expect(next.filter((r, i) => r !== old[i])).toHaveLength(1);
  expect(next[49][3]).toBeLessThan(old[49][3]);
  expect(next[49][3]).toBeGreaterThan(old[49][3] - 1);
  for (const sign of [-1, 1]) {
    const row = next[49], x = row[0] + Math.cos(row[6]) * row[3] / 2 * sign,
      z = row[2] - Math.sin(row[6]) * row[3] / 2 * sign;
    expect((x - p.frontA[0]) * p.inward[0] + (z - p.frontA[1]) * p.inward[1]).toBeGreaterThanOrEqual(8.999999);
  }
  expect(eastCinemasPreviousEdgesV260("other", old)).toBe(old);
});

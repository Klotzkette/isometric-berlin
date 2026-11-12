import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { appendOderbergerFacades, ODERBERGER_FRONTS } from "../src/OderbergerFacades";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const folder = new URL("../public/mesh/surrounding-berlin-v159/", import.meta.url);

test("Oderberger reliefs use the existing visible source frontage in each family", () => {
  for (const site of Object.values(ODERBERGER_FRONTS)) for (const mode of ["drawn", "minecraft"]) {
    const packet = JSON.parse(gunzipSync(readFileSync(new URL(`${site.tile}.${mode}.json.gz`, folder))).toString()) as SurroundingCityChunk;
    const [ox, oy, oz] = packet.origin;
    const owner = packet.nav.buildings.find(building => building.sourceId === site.owner)!;
    expect(owner).toBeDefined();
    const footprint = owner.ring.map(([x, z]) => [Math.round((ox + x) * 100), Math.round((oz + z) * 100)]);
    const [ax, az, bx, bz] = site.front;
    const [dx, dz] = [bx - ax, bz - az];
    const length = Math.hypot(dx, dz);
    const run = mode === "minecraft" ? site.native : footprint.map(([x, z]) => [x / 100, z / 100]).filter(([x, z]) => {
      const cross = ((x - ax) * dz - (z - az) * dx) / length;
      const along = ((x - ax) * dx + (z - az) * dz) / length;
      return Math.abs(cross) < .013 && along >= -.013 && along <= length + .013;
    });
    if (mode === "drawn") {
      expect(run.length).toBeGreaterThanOrEqual(3);
      expect(run).toContainEqual([ax, az]);
      expect(run).toContainEqual([bx, bz]);
    }
    const city = packet.meshes.find(mesh => mesh.kind === "city")!;
    const raw = Uint8Array.fromBase64(city.positions);
    const vertices = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
    const floor = Math.round((packet.nav.groundY + owner.minHeight - oy) * 100);
    const top = Math.round((packet.nav.groundY + owner.height - oy) * 100);
    const floorAndTop = new Set<string>();
    for (let i = 0; i < vertices.length; i += 3) {
      const y = vertices[i + 1];
      if (y === floor || y === top) floorAndTop.add(`${vertices[i]}:${y}:${vertices[i + 2]}`);
    }
    for (const [x, z] of run) {
      expect(footprint).toContainEqual([Math.round(x * 100), Math.round(z * 100)]);
      const xWord = Math.round((x - ox) * 100);
      const zWord = Math.round((z - oz) * 100);
      expect(floorAndTop.has(`${xWord}:${floor}:${zWord}`)).toBe(true);
      expect(floorAndTop.has(`${xWord}:${top}:${zWord}`)).toBe(true);
    }
  }
});

test("existing facade batches get nine lower bath windows and five red fire-engine gates", () => {
  for (const native of [false, true]) {
    const rows: number[][] = [];
    const arches: number[][] = [];
    appendOderbergerFacades(rows, arches, native);
    if (!native) {
      expect(rows.filter(row => row.at(-1) === 0xa82d27)).toHaveLength(5);
      expect(arches.filter(row => row[0] > 2600 && Math.abs(row[1] - 6.22) < .001 && row.at(-1) === 0x54666a)).toHaveLength(9);
      expect(arches.filter(row => row.at(-1) === 0x333d3c)).toHaveLength(1);
    } else {
      expect(arches).toHaveLength(0);
      expect(rows.filter(row => row.at(-1) === 0xa82d27).length).toBeGreaterThan(5);
    }
    expect((rows.length + arches.length) * 76).toBeLessThan(native ? 118_000 : 32_000);
    for (const row of [...rows, ...arches]) {
      expect(row).toHaveLength(native ? 7 : 8);
      expect(row.every(Number.isFinite)).toBe(true);
      expect(row[1] - row[4] / 2).toBeGreaterThanOrEqual(3);
      expect(row[1] + row[4] / 2).toBeLessThan(22);
    }
  }
});

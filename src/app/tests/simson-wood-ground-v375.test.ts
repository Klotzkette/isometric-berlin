import { expect, test } from "bun:test";
import { BoxGeometry, Color, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { gunzipSync } from "node:zlib";
import { cutSimsonWoodGroundV375 } from "../src/SimsonWoodGroundV375";
import cuts from "../src/data/simsonWoodRasterV375.json";
import groundData from "../public/mesh/regierungsviertel/ground-context.json";
import type { VoxelPayload } from "../src/terrainPayload";

const ground = groundData as VoxelPayload;
const encoded = gunzipSync(Buffer.from(cuts.hosts, "base64"));
const hosts = new Float32Array(encoded.buffer, encoded.byteOffset, encoded.byteLength / 4);
const rows: number[][] = [];
for (let r = 0; r < hosts.length; r += 7) rows.push(Array.from(hosts.subarray(r, r + 7)));
const partial = rows.find(row => row[6] > 0)!;
const paint = new Color().setRGB(0.27, 0.53, 0.19);
const sentinel = [10000, 10000, 10004, 10004, 20, 3, 0];

function slabsFor(...records: number[][]): InstancedMesh {
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), records.length);
  mesh.name = "Drawn ground slabs";
  mesh.userData.dayMaterial = mesh.material;
  mesh.userData.nightMaterial = new MeshStandardMaterial();
  mesh.userData.roadGroundCellsV343 = 1;
  records.forEach(([west, north, east, south, top, depth], i) => {
    mesh.setMatrixAt(i, new Matrix4().makeScale(east - west, depth, south - north)
      .setPosition((west + east) / 2, top - depth / 2, (north + south) / 2));
    mesh.setColorAt(i, paint);
  });
  return mesh;
}

test("actual woodland hosts retain their original bottom, residual paint and external walls", () => {
  const slabs = slabsFor(partial, sentinel);
  const matrix = slabs.instanceMatrix, colours = slabs.instanceColor;
  const original = matrix.array.slice();
  const retained = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  slabs.add(retained);
  cutSimsonWoodGroundV375(slabs, ground);
  expect(slabs.instanceMatrix).toBe(matrix);
  expect(slabs.instanceColor).toBe(colours);
  expect(slabs.count).toBe(2);
  expect(matrix.array[13] + matrix.array[5] / 2).toBeCloseTo(original[13] + original[5] / 2 - 0.7, 5);
  expect(matrix.array[13] - matrix.array[5] / 2).toBeCloseTo(original[13] - original[5] / 2, 5);
  for (let j = 0; j < 16; j++) if (j !== 5 && j !== 13) expect(matrix.array[j]).toBe(original[j]);
  expect(matrix.array.slice(16)).toEqual(original.slice(16));
  expect(slabs.children[0]).toBe(retained);
  const rest = slabs.children[1] as Mesh;
  const p = rest.geometry.getAttribute("position"), n = rest.geometry.getAttribute("normal");
  const colors = rest.geometry.getAttribute("color");
  let topTriangles = 0;
  for (let i = 0; i < p.count; i += 3) {
    expect(colors.getX(i)).toBeCloseTo(paint.r, 6);
    expect(colors.getY(i)).toBeCloseTo(paint.g, 6);
    expect(colors.getZ(i)).toBeCloseTo(paint.b, 6);
    if (n.getY(i) > .99) {
      topTriangles++;
      expect(p.getY(i)).toBeCloseTo(partial[4], 5);
    } else {
      expect(Math.abs(n.getY(i))).toBe(0);
      expect(Math.abs(n.getX(i)) + Math.abs(n.getZ(i))).toBeCloseTo(1, 6);
      for (let j = i; j < i + 3; j++) {
        const onBoundary = [partial[0],partial[2]].includes(p.getX(j)) ||
          [partial[1],partial[3]].includes(p.getZ(j));
        expect(onBoundary).toBe(true);
      }
    }
  }
  expect(topTriangles).toBe(partial[6]);
  expect(rest.userData.dayMaterial.vertexColors).toBe(true);
  expect(rest.userData.nightMaterial.vertexColors).toBe(true);
  const updated = matrix.array.slice();
  cutSimsonWoodGroundV375(slabs, ground);
  expect(matrix.array).toEqual(updated);
  expect(slabs.children).toHaveLength(2);
});

test("ambiguous, previously modified and unverified hosts keep their original matrices", () => {
  const changed = [...partial];
  changed[4] += 1;
  const duplicates = slabsFor(partial, partial, changed);
  const before = duplicates.instanceMatrix.array.slice();
  cutSimsonWoodGroundV375(duplicates, ground);
  expect(duplicates.instanceMatrix.array).toEqual(before);
  expect(duplicates.children).toHaveLength(0);
  const missing = slabsFor(partial);
  const old = missing.instanceMatrix.array.slice();
  delete missing.userData.roadGroundCellsV343;
  cutSimsonWoodGroundV375(missing, ground);
  missing.userData.roadGroundCellsV343 = 1;
  cutSimsonWoodGroundV375(missing, {...ground, cell_m: 8});
  expect(missing.instanceMatrix.array).toEqual(old);
});


test("the baked patch matches the original captured terrain matrices only", async () => {
  const archive = await Bun.file(new URL("../../../geo_data/regierungsviertel/simson-paths-v375-source.json.gz", import.meta.url)).arrayBuffer();
  const captured: number[][] = JSON.parse(gunzipSync(Buffer.from(archive)).toString()).baseline.rows;
  const key = (row: number[]) => row.slice(0, 6).map(Math.fround).join(",");
  const audited = new Set(rows.map(key));
  const slabs = slabsFor(...captured), before = slabs.instanceMatrix.array.slice();
  cutSimsonWoodGroundV375(slabs, ground);
  let matches = 0;
  for (let i = 0; i < captured.length; i++) {
    const m = i * 16;
    if (audited.has(key(captured[i]))) {
      expect(slabs.instanceMatrix.array[m + 13]).toBeCloseTo(before[m + 13] - 0.35, 5);
      matches++;
    } else expect(slabs.instanceMatrix.array.slice(m, m + 16)).toEqual(before.slice(m, m + 16));
  }
  expect(matches).toBe(rows.length);
});

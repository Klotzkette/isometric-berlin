import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BoxGeometry, BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import detail from "../src/data/albrechtstrasseV248Details.json";
import evidence from "../../../geo_data/regierungsviertel/albrechtstrasse-v248-evidence.json";

function oldWalls(family: string): Mesh {
  const packet = JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/ring182--7_13.${family}.json.gz`, import.meta.url))).toString());
  const packed = packet.meshes.find((m: any) => m.kind === "city");
  const positionBytes = Buffer.from(packed.positions, "base64"), indexBytes = Buffer.from(packed.indices, "base64");
  const positions = new Float32Array(positionBytes.length / 2), indices = new Uint32Array(indexBytes.length / 4);
  for (let i = 0; i < positions.length; i++) positions[i] = positionBytes.readUInt16LE(i * 2) / 100 + packet.origin[i % 3];
  for (let i = 0; i < indices.length; i++) indices[i] = indexBytes.readUInt32LE(i * 4);
  const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(positions, 3)); g.setIndex(new BufferAttribute(indices, 1));
  return new Mesh(g, new MeshBasicMaterial({ side: DoubleSide }));
}

function batch(rows: number[][], native: boolean): InstancedMesh {
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ side: DoubleSide }), rows.length), m = new Matrix4();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]; m.identity(); if (!native) m.makeRotationY(r[6]);
    m.scale(new Vector3(r[3], r[4], r[5])).setPosition(r[0], r[1], r[2]); mesh.setMatrixAt(i, m);
  }
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.updateMatrixWorld(true); return mesh;
}

function dispose(mesh: Mesh): void { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }

describe("Albrechtstraße 131 v248 visible source-bound fittings", () => {
  for (const [family, rows] of [["drawn", detail.boxes], ["minecraft", detail.nativeRows]] as const) {
    test(`${family}: glazing faces outward and rays reach the exact prior source wall behind it`, () => {
      const old = oldWalls(family), additions = batch(rows, family === "minecraft"), records = evidence.families[family];
      const ray = new Raycaster(); let samples = 0;
      for (let i = 0; i < rows.length; i++) {
        if (records.rows[i].kind !== "glass") continue;
        const r = rows[i], e = records.edges[records.rows[i].edge];
        const normal = new Vector3(e.normal[0], 0, e.normal[1]);
        const center = new Vector3(r[0], r[1], r[2]);
        ray.set(center.clone().addScaledVector(normal, 2), normal.clone().negate());
        const sourceHits = ray.intersectObject(old, false), detailHits = ray.intersectObject(additions, false);
        expect(sourceHits.length).toBeGreaterThan(0); expect(detailHits.length).toBeGreaterThan(0);
        expect(sourceHits[0].distance).toBeCloseTo(2.13, 2);
        expect(detailHits[0].distance).toBeLessThan(sourceHits[0].distance - .07);
        const point = center.clone().addScaledVector(normal, -.13);
        expect(sourceHits[0].point.distanceTo(point)).toBeLessThan(.002);
        samples++;
      }
      expect(samples).toBeGreaterThan(35);
      expect(rows.length * 76).toBeLessThanOrEqual(family === "drawn" ? 18_000 : 13_000);
      if (family === "minecraft") {
        const matrix = new Matrix4();
        for (let i = 0; i < rows.length; i++) {
          additions.getMatrixAt(i, matrix);
          for (const k of [1, 2, 4, 6, 8, 9]) expect(matrix.elements[k]).toBe(0);
        }
      }
      dispose(old); dispose(additions);
    });
  }
});

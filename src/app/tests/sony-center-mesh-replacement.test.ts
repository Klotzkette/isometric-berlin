import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Group, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import {
  meshReplacementsFor,
  stripReplacedGeometry,
  triangleMatchesReplacement,
} from "../src/meshReplacements";

(globalThis as { self?: typeof globalThis }).self ??= globalThis;

describe("Sony Center source-mesh replacement", () => {
  test("removes the old canopy from interaction and settled tiles", async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const fileName of [
      "tile-3894_58189.glb",
      "surface-detail-3894_58189.glb",
    ]) {
      const path = join(
        import.meta.dir,
        "..",
        "public",
        "mesh",
        "regierungsviertel",
        fileName,
      );
      const buffer = await readFile(path);
      const gltf = await new Promise<{ scene: Group }>((resolve, reject) =>
        loader.parse(
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.length,
          ),
          "",
          resolve,
          reject,
        ),
      );
      const replacements = meshReplacementsFor(fileName);
      expect(replacements).toHaveLength(1);
      expect(stripReplacedGeometry(gltf.scene, replacements)).toBeGreaterThan(
        fileName.startsWith("surface") ? 4_000 : 1_300,
      );

      const vertices: [Vector3, Vector3, Vector3] = [
        new Vector3(),
        new Vector3(),
        new Vector3(),
      ];
      let replacedTrianglesRemaining = 0;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const position = object.geometry.getAttribute("position");
        const index = object.geometry.getIndex();
        if (!position || !index) return;
        for (let cursor = 0; cursor < index.count; cursor += 3) {
          for (let corner = 0; corner < 3; corner += 1) {
            vertices[corner]
              .fromBufferAttribute(position, index.getX(cursor + corner))
              .applyMatrix4(object.matrixWorld);
          }
          if (triangleMatchesReplacement(vertices, replacements[0])) {
            replacedTrianglesRemaining += 1;
          }
        }
      });
      expect(replacedTrianglesRemaining).toBe(0);
    }
  }, 240_000);

  test("does not alter unrelated mesh tiles", () => {
    expect(meshReplacementsFor("tile-3890_58200.glb")).toEqual([]);
    expect(stripReplacedGeometry(new Group(), [])).toBe(0);
  });
});

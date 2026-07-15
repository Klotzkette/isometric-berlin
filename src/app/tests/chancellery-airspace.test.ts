import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { Box3, Group, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import {
  type ArchitecturalSignature,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import { createCulturalLandmarks } from "../src/CulturalLandmarks";
import {
  MESH_SKY_ARTEFACTS,
  skyArtefactsFor,
  stripSkyArtefacts,
} from "../src/meshArtefacts";
import { createMemorialLandmarks } from "../src/MemorialLandmarks";
import sceneManifest from "../public/mesh/regierungsviertel/scene.json";

// The meshopt WASM shim expects a `self` global outside the browser.
(globalThis as { self?: typeof globalThis }).self ??= globalThis;

// Scene anchor of the Bundeskanzleramt in the shipped scene manifest.
const CHANCELLERY_WORLD = new Vector3(-153.997, 8, -144.253);
// LoD2 roof datum of the leadership cube is 36 m; any programmatic mesh
// hovering above the roofline near the building is a visual artefact
// (regression guard for the "dark cloud over the Chancellery" defect).
const ROOFLINE_Y = 38;
const RADIUS_M = 40;

type SceneLandmark = { name: string; world: [number, number, number] };

const manifest = sceneManifest as unknown as {
  architectural_signatures?: ArchitecturalSignature[];
  landmarks: SceneLandmark[];
};

type Offender = { name: string; center: Vector3 };

function offendersIn(root: Group): Offender[] {
  root.updateMatrixWorld(true);
  const offenders: Offender[] = [];
  root.traverse((object) => {
    if (!(object as Mesh).isMesh) {
      return;
    }
    const bounds = new Box3().setFromObject(object);
    if (bounds.isEmpty()) {
      return;
    }
    const center = bounds.getCenter(new Vector3());
    const horizontal = Math.hypot(
      center.x - CHANCELLERY_WORLD.x,
      center.z - CHANCELLERY_WORLD.z,
    );
    const isFlagOrPole = /flag|pole|mast/i.test(object.name);
    if (horizontal <= RADIUS_M && bounds.min.y > ROOFLINE_Y && !isFlagOrPole) {
      offenders.push({ center, name: object.name || object.type });
    }
  });
  return offenders;
}

describe("Chancellery airspace stays clear of floating artefacts", () => {
  test("no programmatic mesh hovers above the Chancellery roofline", () => {
    const roots: Group[] = [
      createCivicLandmarks(manifest.landmarks),
      createMemorialLandmarks(manifest.landmarks),
      createCulturalLandmarks(manifest.landmarks),
    ];
    for (const signature of manifest.architectural_signatures ?? []) {
      roots.push(createArchitecturalSignature(signature));
    }
    const offenders = roots.flatMap((root) => offendersIn(root));
    expect(
      offenders.map(
        (offender) =>
          `${offender.name} @ (${offender.center.x.toFixed(1)}, ${offender.center.y.toFixed(1)}, ${offender.center.z.toFixed(1)})`,
      ),
    ).toEqual([]);
  });

  test("the sky-artefact filter clears the dark blob from both Chancellery tiles", async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const artefactBox = MESH_SKY_ARTEFACTS[0].box;
    for (const fileName of [
      "tile-3890_58200.glb",
      "surface-detail-3890_58200.glb",
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
      const artefacts = skyArtefactsFor(fileName);
      expect(artefacts.length).toBeGreaterThan(0);
      const removed = stripSkyArtefacts(gltf.scene, artefacts);
      // The committed tiles contain the blob, so the filter must remove
      // a non-trivial triangle count — and afterwards no rendered
      // triangle may keep a vertex inside the artefact volume.
      expect(removed).toBeGreaterThan(20);
      const vertex = new Vector3();
      gltf.scene.updateMatrixWorld(true);
      let insideAfter = 0;
      gltf.scene.traverse((object) => {
        if (!(object instanceof Mesh)) {
          return;
        }
        const index = object.geometry.getIndex();
        const position = object.geometry.getAttribute("position");
        if (!index || !position) {
          return;
        }
        for (let cursor = 0; cursor < index.count; cursor += 1) {
          vertex
            .fromBufferAttribute(position, index.getX(cursor))
            .applyMatrix4(object.matrixWorld);
          if (artefactBox.containsPoint(vertex)) {
            insideAfter += 1;
          }
        }
      });
      expect(insideAfter).toBe(0);
    }
  }, 240_000);

  test("files without registered artefacts are left untouched", () => {
    expect(skyArtefactsFor("tile-3894_58196.glb")).toEqual([]);
    const untouched = stripSkyArtefacts(new Group(), skyArtefactsFor("x.glb"));
    expect(untouched).toBe(0);
  });
});

import { describe, expect, test } from "bun:test";

import { Box3, Group, Mesh, Vector3 } from "three";

import {
  type ArchitecturalSignature,
  createArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import { createCivicLandmarks } from "../src/CivicLandmarks";
import { createCulturalLandmarks } from "../src/CulturalLandmarks";
import { createMemorialLandmarks } from "../src/MemorialLandmarks";
import sceneManifest from "../public/mesh/regierungsviertel/scene.json";

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

});

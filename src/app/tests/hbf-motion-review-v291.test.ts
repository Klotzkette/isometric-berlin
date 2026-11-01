import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh, PerspectiveCamera, Raycaster, Vector3 } from "three";
import { createArchitecturalSignature, type HauptbahnhofModelSignature } from "../src/ArchitecturalLandmarks";
import { HAUPTBAHNHOF_ACCESS } from "../src/HauptbahnhofAccessProfile";
import { HBF_CIRCULATION_V291, hbfLocalToWorldV291 } from "../src/HbfCirculationV291";
import { createHbfNativeMovingFixturesV291, createHbfStationRuntimeV291 } from "../src/HbfStationMotionV291";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";

const scene = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json() as { architectural_signatures: HauptbahnhofModelSignature[] };
const signature = scene.architectural_signatures.find(({ kind }) => kind === "hauptbahnhof_model")!;
const camera = (local: readonly [number, number, number]): PerspectiveCamera => {
  const result = new PerspectiveCamera(65, 1.4, .05, 1000);
  result.position.set(...hbfLocalToWorldV291(local));
  result.lookAt(...hbfLocalToWorldV291([0, 3, 0]));
  result.updateMatrixWorld(true);
  return result;
};

describe("independent real-fixture motion review v291", () => {
  test("Worker-cloned, frozen drawn station opens all12 facade apertures for flight and walking cameras", () => {
    const original = createArchitecturalSignature(signature);
    const transferred = serializeObject3DForTransfer(original).object;
    const root = deserializeTransferredObject3D(structuredClone(transferred));
    const runtime = createHbfStationRuntimeV291();
    runtime.register(root);
    expect(runtime.size).toBe(1);
    const meshes: Mesh[] = [];
    root.traverse((object) => { if (object instanceof Mesh) meshes.push(object); });
    root.updateMatrixWorld(true);
    const angle = HBF_CIRCULATION_V291.frame.rotationDegrees * Math.PI / 180;
    for (const side of [-1, 1] as const) {
      const closed = new Raycaster(new Vector3(...hbfLocalToWorldV291([2.045, 1.9, side * 93])), new Vector3(-side * Math.sin(angle), 0, -side * Math.cos(angle)), 0, 6);
      expect(closed.intersectObjects(meshes, false).length).toBeGreaterThan(0);
      // Only a Camera is provided: there is no pedestrian-enabled flag for a
      // flight approach to accidentally omit. At the threshold access is instant.
      runtime.update(side < 0 ? 0 : 1000, camera([1.745, side < 0 ? 8 : 1.9, side * 93]), false, false, false);
      root.updateMatrixWorld(true);
      for (const x of HAUPTBAHNHOF_ACCESS.doorCentresLocalX) for (const offset of [-.43, 0, .43]) {
        const ray = new Raycaster(new Vector3(...hbfLocalToWorldV291([x + offset, 1.9, side * 93])), new Vector3(-side * Math.sin(angle), 0, -side * Math.cos(angle)), 0, 6);
        expect(ray.intersectObjects(meshes, false)).toHaveLength(0);
      }
    }
    for (const mesh of meshes) if (mesh.userData.hbfMotionV291?.kind === "lift" && !(mesh instanceof InstancedMesh)) {
      expect(mesh.matrixAutoUpdate).toBeFalse();
      expect(mesh.matrix.elements[13]).toBeCloseTo(mesh.position.y, 8);
    }
    runtime.dispose();
  });

  test("actual native fixtures use20Hz steps, pause hidden/offscreen, share one family clock and release permanently", () => {
    const root = freezeStaticSceneTransforms(createHbfNativeMovingFixturesV291());
    const runtime = createHbfStationRuntimeV291();
    runtime.register(root);
    runtime.register(root);
    expect(runtime.size).toBe(1);
    const steps: InstancedMesh[] = [];
    root.traverse((object) => { if (object instanceof InstancedMesh && object.userData.hbfMotionV291?.kind === "escalator") steps.push(object); });
    expect(steps).toHaveLength(16);
    const inside = camera([0, 3, 0]);
    runtime.update(0, inside, true, false, false);
    const version = steps[0].instanceMatrix.version;
    const before = new Float32Array(steps[0].instanceMatrix.array);
    expect(runtime.update(25, inside, true, false, false)).toBeFalse();
    expect(steps[0].instanceMatrix.version).toBe(version);
    expect(runtime.update(50, inside, true, false, false)).toBeTrue();
    expect(steps[0].instanceMatrix.array).not.toEqual(before);
    const elapsed = runtime.elapsedSeconds;
    root.visible = false;
    expect(runtime.update(3000, inside, true, false, false)).toBeFalse();
    expect(runtime.elapsedSeconds).toBe(elapsed);
    root.visible = true;
    runtime.update(5000, inside, true, false, false);
    expect(runtime.elapsedSeconds).toBe(elapsed);
    expect(runtime.update(8000, camera([5000, 3, 0]), true, false, false)).toBeFalse();
    expect(runtime.elapsedSeconds).toBe(elapsed);
    runtime.update(10000, inside, true, true, false);
    expect(runtime.elapsedSeconds).toBe(elapsed);
    runtime.update(11000, inside, false, false, false);
    expect(runtime.elapsedSeconds).toBe(elapsed);
    runtime.update(12000, inside, true, false, false);
    expect(runtime.elapsedSeconds).toBe(elapsed);
    runtime.release(root);
    expect(runtime.size).toBe(0);
    const retiredVersion = steps[0].instanceMatrix.version;
    runtime.update(12050, inside, true, false, false);
    expect(steps[0].instanceMatrix.version).toBe(retiredVersion);
    runtime.dispose();
    runtime.register(root);
    expect(runtime.size).toBe(0);
  });

  test("functional door interpolation does not upload every escalator between20Hz fixture ticks", () => {
    const root = createHbfNativeMovingFixturesV291();
    const runtime = createHbfStationRuntimeV291();
    runtime.register(root);
    let steps: InstancedMesh | undefined;
    root.traverse((object) => { if (!steps && object instanceof InstancedMesh && object.userData.hbfMotionV291?.kind === "escalator") steps = object; });
    runtime.update(0, camera([0, 3, 0]), true, false, false);
    const version = steps!.instanceMatrix.version;
    runtime.update(25, camera([1.745, 2, 105]), true, false, false);
    expect(steps!.instanceMatrix.version).toBe(version);
    runtime.dispose();
  });

  test("a family selected while suspended resumes at the shared paused pose even with reduced motion", () => {
    const nativeRoot = createHbfNativeMovingFixturesV291();
    const drawnRoot = createArchitecturalSignature(signature)!;
    const runtime = createHbfStationRuntimeV291();
    runtime.register(nativeRoot);
    runtime.register(drawnRoot);
    let steps: InstancedMesh | undefined;
    nativeRoot.traverse((object) => { if (!steps && object instanceof InstancedMesh && object.userData.hbfMotionV291?.kind === "escalator") steps = object; });
    const initialX = steps!.instanceMatrix.array[12];
    const inside = camera([0, 3, 0]);
    runtime.update(0, inside, false, false, false);
    for (let t = 50; t <= 1000; t += 50) runtime.update(t, inside, false, false, false);
    expect(runtime.elapsedSeconds).toBeGreaterThan(.9);
    runtime.update(1100, inside, true, true, true);
    const elapsed = runtime.elapsedSeconds;
    runtime.update(5000, inside, true, true, false);
    expect(runtime.elapsedSeconds).toBe(elapsed);
    expect(steps!.instanceMatrix.array[12]).not.toBe(initialX);
    runtime.dispose();
  });
});

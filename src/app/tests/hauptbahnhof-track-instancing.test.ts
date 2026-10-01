import { describe, expect, test } from "bun:test";
import {
  BoxGeometry, EdgesGeometry, Group, InstancedMesh, LineBasicMaterial,
  LineSegments, Matrix4, Mesh, MeshStandardMaterial, Vector3,
} from "three";
import {
  createArchitecturalSignature, HAUPTBAHNHOF_TRACK_INSTANCE_CELL_M,
  HAUPTBAHNHOF_TRACK_REPEAT_NAMES, instanceHauptbahnhofTrackRepeats,
  type ArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import { interleaveStaticGeometry } from "../src/interleaveStaticGeometry";

const manifest = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json();

describe("Hauptbahnhof opaque track repetition", () => {
  test("retains all 364 source parts and all 76 original outline objects in bounded cells", () => {
    const signature = (manifest.architectural_signatures as ArchitecturalSignature[])
      .find(item => item.id === "hauptbahnhof-model")!;
    const station = createArchitecturalSignature(signature)!;
    for (const [name, count] of HAUPTBAHNHOF_TRACK_REPEAT_NAMES.map((name, i) => [name, [288, 40, 36][i]] as const)) {
      const batches = station.children.filter(object => object.name === name) as Mesh[];
      expect(batches.reduce((sum, batch) => sum + (batch instanceof InstancedMesh ? batch.count : 1), 0)).toBe(count);
      expect(batches.length).toBeLessThanOrEqual(10);
      for (const batch of batches) {
        if (!(batch instanceof InstancedMesh)) {
          expect(batch.geometry.index!.count).toBe(36);
          expect(batch.castShadow && batch.receiveShadow).toBeTrue();
          continue;
        }
        const positions: number[] = [];
        const matrix = new Matrix4();
        for (let i = 0; i < batch.count; i++) {
          batch.getMatrixAt(i, matrix);
          positions.push(matrix.elements[12]);
        }
        expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(HAUPTBAHNHOF_TRACK_INSTANCE_CELL_M);
        expect(batch.userData.stationTrackSourceParts).toBe(batch.count);
        expect(batch.castShadow && batch.receiveShadow).toBeTrue();
        expect(batch.geometry.index!.count * batch.count).toBe(36 * batch.count);
      }
    }
    expect(station.children.filter(object => object.name === "Hauptbahnhof upper platform model edges")).toHaveLength(40);
    expect(station.children.filter(object => object.name === "Hauptbahnhof east-west elevated track deck model edges")).toHaveLength(36);
  });

  test("keeps exact source attributes, GPU matrices, corner positions, materials and ink through mobile packing", () => {
    const root = new Group();
    root.position.set(23, -7, 61);
    root.rotation.y = 0.47;
    const material = new MeshStandardMaterial({ color: 0x74868b, metalness: 0.78 });
    const originals: Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const box = new Mesh(new BoxGeometry(12.211666666666666, 0.16, 0.14), material);
      box.name = HAUPTBAHNHOF_TRACK_REPEAT_NAMES[0];
      box.position.set(-19 + i * 5, 10.48, -12 + i * 2);
      box.rotation.y = -0.006 * i;
      box.castShadow = box.receiveShadow = true;
      root.add(box);
      originals.push(box);
    }
    const ink = new LineSegments(new EdgesGeometry(originals[0].geometry), new LineBasicMaterial());
    ink.name = "untouched source outline";
    ink.position.set(1, 2, 3);
    root.add(ink);
    root.updateMatrixWorld();
    const sourceGeometry = originals[0].geometry;
    const attributes = Object.fromEntries(Object.entries(sourceGeometry.attributes)
      .map(([name, attribute]) => [name, Array.from(attribute.array)]));
    const matrices = originals.map(object => Array.from(new Float32Array(object.matrix.elements)));
    const inkGeometry = ink.geometry, inkMaterial = ink.material, inkPose = ink.matrixWorld.clone();
    instanceHauptbahnhofTrackRepeats(root);
    const batches = root.children.filter(object => object instanceof InstancedMesh) as InstancedMesh[];
    expect(batches).toHaveLength(2);
    const instanceStorage = batches.map(batch => batch.instanceMatrix);
    interleaveStaticGeometry(root);
    root.updateMatrixWorld();
    const actualMatrices: number[][] = [];
    batches.forEach((batch, batchIndex) => {
      expect(batch.material).toBe(material);
      expect(batch.instanceMatrix).toBe(instanceStorage[batchIndex]);
      for (const [name, values] of Object.entries(attributes)) {
        const attribute = batch.geometry.getAttribute(name);
        const packed: number[] = [];
        for (let i = 0; i < attribute.count; i++)
          for (let component = 0; component < attribute.itemSize; component++)
            packed.push(attribute.getComponent(i, component));
        expect(packed).toEqual(values);
      }
      for (let i = 0; i < batch.count; i++) {
        const instance = new Matrix4();
        batch.getMatrixAt(i, instance);
        actualMatrices.push(instance.elements.slice());
        const sourceIndex = matrices.findIndex(matrix => matrix.every((value, component) => value === instance.elements[component]));
        expect(sourceIndex).toBeGreaterThanOrEqual(0);
        const sourceGpuMatrix = new Matrix4().fromArray(matrices[sourceIndex]);
        const sourcePosition = originals[sourceIndex].geometry.getAttribute("position");
        const position = batch.geometry.getAttribute("position");
        for (let vertex = 0; vertex < position.count; vertex++) {
          const expected = new Vector3().fromBufferAttribute(sourcePosition, vertex).applyMatrix4(sourceGpuMatrix).applyMatrix4(root.matrixWorld);
          const actual = new Vector3().fromBufferAttribute(position, vertex).applyMatrix4(instance).applyMatrix4(batch.matrixWorld);
          expect(actual.toArray()).toEqual(expected.toArray());
        }
      }
    });
    expect(actualMatrices).toEqual(matrices);
    expect(ink.parent).toBe(root);
    expect(ink.geometry).toBe(inkGeometry);
    expect(ink.material).toBe(inkMaterial);
    expect(ink.matrixWorld.elements).toEqual(inkPose.elements);
  });

  test("preserves annotated or transparent objects instead of absorbing their semantics", () => {
    const root = new Group();
    for (let i = 0; i < 2; i++) {
      const object = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ transparent: i === 1 }));
      object.name = HAUPTBAHNHOF_TRACK_REPEAT_NAMES[0];
      if (i === 0) object.userData.nightOnly = true;
      root.add(object);
    }
    const originals = root.children.slice();
    instanceHauptbahnhofTrackRepeats(root);
    expect(root.children).toEqual(originals);
    expect(root.children.some(object => object instanceof InstancedMesh)).toBeFalse();
  });
});

import { describe, expect, spyOn, test } from "bun:test";
import { Group, InstancedMesh, Matrix4, Mesh, Object3D, Scene } from "three";
import {
  createArchitecturalSignature,
  type ArchitecturalSignature,
} from "../src/ArchitecturalLandmarks";
import { updateWindFlags } from "../src/WindFlags";

const manifest = await Bun.file(new URL("../public/mesh/regierungsviertel/scene.json", import.meta.url)).json();
const signatures = manifest.architectural_signatures as ArchitecturalSignature[];

function objects(root: Object3D): Object3D[] {
  const result: Object3D[] = [];
  root.traverse(object => result.push(object));
  return result;
}

describe("static architectural signature transforms", () => {
  test("all five landmarks keep exact world poses beneath a moving parent", () => {
    expect(signatures).toHaveLength(5);
    for (const signature of signatures) {
      const root = createArchitecturalSignature(signature)!;
      const reference = root.clone(true);
      reference.traverse(object => { object.matrixAutoUpdate = true; });
      const parent = new Group(), referenceParent = new Group();
      parent.add(root);
      referenceParent.add(reference);
      const children = objects(root), referenceChildren = objects(reference);
      for (const pose of [0, 1]) {
        for (const wrapper of [parent, referenceParent]) {
          wrapper.position.set(27 + pose * 12, 8 - pose * 3, -43);
          wrapper.rotation.set(0.12, 0.43 + pose * 0.31, -0.07);
          wrapper.scale.set(1.4, 0.9, 1.1);
          wrapper.updateMatrixWorld();
        }
        children.forEach((object, index) => {
          expect(object.matrixWorld.elements).toEqual(referenceChildren[index].matrixWorld.elements);
          expect(object.matrixWorldAutoUpdate).toBeTrue();
        });
      }
    }
  });

  test("station architecture stops composing unchanged local matrices", () => {
    const station = createArchitecturalSignature(signatures.find(item => item.id === "hauptbahnhof-model")!)!;
    const scene = new Scene();
    scene.matrixAutoUpdate = false;
    scene.add(station);
    scene.updateMatrixWorld();
    const column = objects(station).find(object => object instanceof Mesh && !object.userData.windFlag)!;
    const local = column.matrix.clone(), world = column.matrixWorld.clone();
    const compose = spyOn(column, "updateMatrix");
    try {
      for (let frame = 0; frame < 60; frame++) scene.updateMatrixWorld();
      expect(compose).not.toHaveBeenCalled();
      expect(column.matrix.equals(local)).toBeTrue();
      expect(column.matrixWorld.equals(world)).toBeTrue();
    } finally { compose.mockRestore(); }
  });

  test("cloth and instance flags keep animating without replacing their buffers", () => {
    const parliament = createArchitecturalSignature(signatures.find(item => item.id === "reichstag-model")!)!;
    const parent = new Group();
    parent.position.set(9, 3, -17);
    parent.rotation.y = 0.4;
    parent.add(parliament);
    const flags = objects(parliament).filter(object => object.userData.windFlag || object.userData.windFlagInstances) as Mesh[];
    expect(flags.length).toBeGreaterThan(0);
    updateWindFlags(parliament, 0.3);
    const buffers = flags.map(flag => flag instanceof InstancedMesh
      ? flag.instanceMatrix : flag.geometry.getAttribute("position"));
    const before = buffers.map(attribute => Array.from(attribute.array));
    updateWindFlags(parliament, 1.7);
    flags.forEach((flag, index) => {
      const attribute = flag instanceof InstancedMesh ? flag.instanceMatrix : flag.geometry.getAttribute("position");
      expect(attribute).toBe(buffers[index]);
      expect(Array.from(attribute.array)).not.toEqual(before[index]);
      expect(flag.matrixAutoUpdate).toBeTrue();
    });
    const flag = flags[0];
    flag.position.y += 0.5;
    parent.updateMatrixWorld();
    const expected = new Matrix4().multiplyMatrices(flag.parent!.matrixWorld,
      new Matrix4().compose(flag.position, flag.quaternion, flag.scale));
    expect(flag.matrixWorld.elements).toEqual(expected.elements);
  });
});

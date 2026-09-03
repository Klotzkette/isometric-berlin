import { describe, expect, spyOn, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from "three";
import { freezeStaticSceneTransforms } from "../src/staticSceneTransforms";
import { deserializeTransferredObject3D, serializeObject3DForTransfer } from "../src/transferableObject3D";

describe("immutable scene transforms", () => {
  test("retains exact local poses, parent motion and late animated children", () => {
    const scene = new Scene();
    scene.matrixAutoUpdate = false;
    const city = new Group();
    city.position.set(40, 2, -8);
    const house = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    house.position.set(3, 5, 6);
    house.rotation.y = 0.7;
    house.scale.set(2, 4, 3);
    city.add(house);
    city.updateMatrixWorld(true);
    const original = house.matrixWorld.clone();
    freezeStaticSceneTransforms(city);
    scene.add(city);
    const moving = new Group();
    city.add(moving);
    scene.updateMatrixWorld();
    expect(house.matrixWorld.equals(original)).toBeTrue();

    const composeHouse = spyOn(house, "updateMatrix");
    try {
      for (let frame = 0; frame < 60; frame += 1) {
        moving.position.x = frame;
        scene.updateMatrixWorld();
      }
      expect(composeHouse).not.toHaveBeenCalled();
      expect(moving.getWorldPosition(new Vector3()).x).toBe(99);
      expect(house.matrixWorld.equals(original)).toBeTrue();
    } finally {
      composeHouse.mockRestore();
    }

    const parent = new Group();
    scene.add(parent);
    parent.add(city);
    parent.position.x = 17;
    scene.updateMatrixWorld();
    expect(house.matrixWorld.elements[12]).toBe(original.elements[12] + 17);
    expect(house.matrixWorldAutoUpdate).toBeTrue();
  });

  test("does not overwrite explicitly authored matrices and survives transfer", () => {
    const root = new Group();
    root.matrixAutoUpdate = false;
    root.matrix.makeTranslation(11, 12, 13);
    freezeStaticSceneTransforms(root);
    const wire = serializeObject3DForTransfer(root);
    const restored = deserializeTransferredObject3D(structuredClone(wire.object));
    expect(restored.matrixAutoUpdate).toBeFalse();
    expect(restored.matrix.equals(root.matrix)).toBeTrue();
    restored.updateMatrixWorld();
    expect(restored.getWorldPosition(new Vector3()).toArray()).toEqual([11, 12, 13]);
  });
});

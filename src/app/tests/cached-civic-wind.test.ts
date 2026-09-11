import { describe, expect, spyOn, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import {
  collectCivicWindFlagTargets, markWindFlag, markWindFlagInstances,
  setWindFlagWinterPresentation, updateCivicWindFlags, updateWindFlags,
} from "../src/WindFlags";
import { updateSchwellenraumMovingFlags } from "../src/visual-modes/schwellenraum/motion";

function flag(kind: "germany" | "other" = "germany") {
  const geometry = new PlaneGeometry(4, 2, 4, 2);
  geometry.translate(2, 0, 0);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  markWindFlag(mesh, 4, { kind, phase: 0.42 });
  return mesh;
}

function fixture() {
  const roots = [new Group(), new Group()];
  const cloth = flag();
  const hidden = flag();
  hidden.visible = false;
  hidden.material.visible = false;
  const decorative = flag("other");
  const marks = new InstancedMesh(new BoxGeometry(0.2, 0.3, 0.1), new MeshBasicMaterial(), 2);
  markWindFlagInstances(marks, [
    { position: [1, 2, 3], rotation: [0.1, 0.2, 0.3], scale: [1.2, 0.7, 1], xFromPoleM: 1 },
    { position: [4, 2, 3], xFromPoleM: 4 },
  ], 4, { kind: "european-union", phase: 0.42 });
  roots[0].add(cloth, decorative);
  const nested = new Group();
  nested.add(hidden, marks);
  roots[1].add(nested);
  for (const root of roots) setWindFlagWinterPresentation(root, true);
  const targets = collectCivicWindFlagTargets(roots);
  const snapshot = () => {
    const values: number[][] = [];
    for (const root of roots) root.traverse((object) => {
      if (object instanceof Mesh) values.push(Array.from(object.geometry.getAttribute("position").array));
      if (object instanceof InstancedMesh) values.push(Array.from(object.instanceMatrix.array));
    });
    return values;
  };
  return { roots, cloth, hidden, decorative, marks, targets, snapshot };
}

describe("cached civic wind updates", () => {
  test("matches the full traversal byte-for-byte for cloth, artwork and winter icicles", () => {
    const reference = fixture();
    const cached = fixture();
    const decorative = Array.from(cached.decorative.geometry.getAttribute("position").array);
    for (const elapsed of [0.9, 1.7, 2.3, 18.5]) {
      updateCivicWindFlags(reference.roots, elapsed);
      updateSchwellenraumMovingFlags(cached.roots, elapsed, cached.targets);
      expect(cached.snapshot()).toEqual(reference.snapshot());
      expect(cached.roots.map((root) => root.userData.windFlagsAppliedAtByContract))
        .toEqual(reference.roots.map((root) => root.userData.windFlagsAppliedAtByContract));
    }
    expect(Array.from(cached.decorative.geometry.getAttribute("position").array)).toEqual(decorative);
    expect(cached.hidden.visible).toBeFalse();
    expect(cached.hidden.material.visible).toBeFalse();
  });

  test("performs no root traversal and retains timestamp/whole-pose cache ownership", () => {
    const cached = fixture();
    const walks = cached.roots.map((root) => spyOn(root, "traverse"));
    try {
      updateCivicWindFlags(cached.roots, 1.7, cached.targets);
      const positions = cached.cloth.geometry.getAttribute("position");
      const version = positions.version;
      const instanceVersion = cached.marks.instanceMatrix.version;
      updateCivicWindFlags(cached.roots, 1.7, cached.targets);
      expect(positions.version).toBe(version);
      expect(cached.marks.instanceMatrix.version).toBe(instanceVersion);
      for (const walk of walks) expect(walk).not.toHaveBeenCalled();
    } finally {
      for (const walk of walks) walk.mockRestore();
    }
    for (const root of cached.roots) updateWindFlags(root, 0.9);
    updateCivicWindFlags(cached.roots, 1.7, cached.targets);
    expect(cached.roots[0].userData.windFlagsAppliedAtByContract.all).toBeUndefined();
    const reference = fixture();
    updateCivicWindFlags(reference.roots, 1.7);
    expect(Array.from(cached.cloth.geometry.getAttribute("position").array))
      .toEqual(Array.from(reference.cloth.geometry.getAttribute("position").array));
  });

  test("ignores detached targets and collects newly attached flags at the current phase", () => {
    const cached = fixture();
    updateCivicWindFlags(cached.roots, 1.7, cached.targets);
    cached.cloth.removeFromParent();
    cached.cloth.geometry.dispose();
    const removedVersion = cached.cloth.geometry.getAttribute("position").version;
    updateCivicWindFlags(cached.roots, 2.3, cached.targets);
    expect(cached.cloth.geometry.getAttribute("position").version).toBe(removedVersion);
    const added = flag();
    cached.roots[0].add(added);
    const refreshed = collectCivicWindFlagTargets(cached.roots);
    expect(refreshed.some((target) => target.mesh === cached.cloth)).toBeFalse();
    expect(refreshed.some((target) => target.mesh === added)).toBeTrue();
    updateCivicWindFlags(cached.roots, 3.1, refreshed);
    const reference = flag();
    updateCivicWindFlags([reference], 3.1);
    expect(Array.from(added.geometry.getAttribute("position").array))
      .toEqual(Array.from(reference.geometry.getAttribute("position").array));
  });
});

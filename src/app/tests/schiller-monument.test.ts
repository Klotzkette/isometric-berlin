import { describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, Group, InstancedMesh, Material, Mesh } from "three";
import { createSchillerMonument } from "../src/SchillerMonument";
import { createGendarmenmarktArchitecture, createMinecraftGendarmenmarktArchitecture } from "../src/GendarmenmarktArchitecture";
import { setIsoNightPresentation } from "../src/IsometricCityWorld";
import { isSchwellenraumGeschuetzt } from "../src/visual-modes/schwellenraum/presentation";

function measure(root: Group) {
  let bytes = 0, draws = 0, instances = 0;
  const geometries = new Set<BufferGeometry>();
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    draws++;
    expect(o.matrixAutoUpdate).toBeFalse();
    expect(o.userData.dayMaterial).toBeInstanceOf(Material);
    expect(o.userData.nightMaterial).toBeInstanceOf(Material);
    expect(o.userData.dayMaterial.map).toBeNull();
    expect(o.userData.nightMaterial.map).toBeNull();
    if (!geometries.has(o.geometry)) {
      geometries.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) {
        bytes += a.array.byteLength;
        expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
      }
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof InstancedMesh) {
      instances += o.count;
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
    }
  });
  return { bytes, draws, instances };
}

describe("source-bound Schiller monument", () => {
  test("replaces the old silhouette exactly once in both Gendarmenmarkt representations", () => {
    for (const minecraft of [false, true]) {
      const root = minecraft ? createMinecraftGendarmenmarktArchitecture() : createGendarmenmarktArchitecture();
      const names: string[] = [];
      root.traverse(o => { if (o.name === "Schillerdenkmal — Reinhold Begas") names.push(o.name); });
      expect(names).toHaveLength(1);
      const schiller = root.getObjectByName(names[0])!;
      expect(schiller.parent).toBe(root);
      expect(isSchwellenraumGeschuetzt(schiller)).toBeTrue();
    }
  });
  test("retains the exact mapped anchor and a human-scale monument within a bounded texture-free budget", () => {
    for (const minecraft of [false, true]) {
      const root = createSchillerMonument(minecraft);
      const box = new Box3().setFromObject(root);
      expect((box.min.x + box.max.x) / 2).toBeCloseTo(1425.438, 2);
      expect((box.min.z + box.max.z) / 2).toBeCloseTo(617.052, 2);
      expect(box.min.y).toBeGreaterThanOrEqual(5.2);
      expect(box.max.y - box.min.y).toBeGreaterThan(6);
      expect(box.max.y - box.min.y).toBeLessThan(7);
      const budget = measure(root);
      expect(budget.bytes).toBeLessThan(minecraft ? 90_000 : 450_000);
      expect(budget.draws).toBe(minecraft ? 1 : 5);
      expect(budget.instances).toBeLessThan(minecraft ? 1100 : 2200);
      if (minecraft) root.traverse(o => {
        if (o instanceof Mesh) {
          expect(o).toBeInstanceOf(InstancedMesh);
          expect(o.geometry.getAttribute("position").count).toBe(24);
        }
      });
    }
  });
  test("returns from Night, Snow and Schwellenraum without changing any sculpture vertices", () => {
    const root = createSchillerMonument();
    const originals = new Map<Mesh, number[]>();
    root.traverse(o => { if (o instanceof Mesh) originals.set(o, Array.from(o.geometry.attributes.position.array)); });
    for (const mode of ["night", "snowstorm", "schwellenraum", "day"] as const) {
      setIsoNightPresentation(root, mode === "night", true, mode);
      for (const [mesh, positions] of originals) {
        expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(positions);
        expect(mesh.material).toBe(mode === "night" ? mesh.userData.nightMaterial : mesh.userData.dayMaterial);
        expect(mesh.visible).toBeTrue();
      }
    }
  });
});

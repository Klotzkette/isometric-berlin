import { expect, test } from "bun:test";
import { Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import {
  createPotsdamerTrafficTower, setPotsdamerTrafficTowerPresentation,
  updatePotsdamerTrafficTower,
} from "../src/PotsdamerTrafficTower";
import { applySignatureLightingPresentation } from "../src/ThreeViewer";
import { applyMinecraftVisibility, restoreMinecraftVisibility } from "../src/MinecraftVisibility";
import { POTSDAMER_TOWER_DRAWN_NAME, POTSDAMER_TOWER_MINECRAFT_NAME } from "../src/potsdamerTrafficTowerProfile";
import { objectMaterialsIncludingTransferredAlternates } from "../src/transferableObject3D";
import { isInterimOfficeFootprintSuppressed, type PrismBuilding } from "../src/IsometricCityWorld";
import {
  INTERIM_OFFICE_FOOTPRINT_RING as ring,
  INTERIM_OFFICE_SUPPRESSION_MARGIN_M as margin,
  INTERIM_OFFICE_SUPPRESSION_OVERLAP_FRACTION as fraction,
} from "../src/SpreebogenOffice";
import type { VisualMode } from "../src/visualMode";

for (const mobileLike of [false, true]) {
  test(`${mobileLike ? "mobile" : "desktop"} tower: first night, moonlight and cold Minecraft retain correct lamp/material state`, () => {
    const tower = createPotsdamerTrafficTower(undefined, { mobileLike });
    const roots = { signatures: new Group().add(tower), civicDetails: new Group(), centralDetails: new Group(), cityStaffage: new Group() };
    const batches: InstancedMesh[] = [];
    const bodies: Mesh[] = [];
    tower.traverse(object => {
      if (object instanceof InstancedMesh && object.name === "traffic tower animated lamps") batches.push(object);
      else if (object instanceof Mesh) bodies.push(object);
    });
    const initialColors = batches.map(mesh => Array.from(mesh.instanceColor!.array));
    const initialMatrices = batches.map(mesh => Array.from(mesh.instanceMatrix.array));
    const apply = (mode: VisualMode, lightsOn = true) => {
      restoreMinecraftVisibility(roots);
      applySignatureLightingPresentation(roots.signatures, mode, lightsOn);
      updatePotsdamerTrafficTower(tower, 0, false, mode !== "night" || lightsOn);
      applyMinecraftVisibility(roots, mode === "minecraft");
      setPotsdamerTrafficTowerPresentation(tower, mode);
    };
    try {
      // Cold Minecraft precedes either drawn world being built.
      for (const mode of ["minecraft", "day", "night"] as const) {
        apply(mode);
        expect(tower.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME)!.visible).toBe(mode !== "minecraft");
        expect(tower.getObjectByName(POTSDAMER_TOWER_MINECRAFT_NAME)!.visible).toBe(mode === "minecraft");
        for (const body of bodies) {
          expect(body.material).toBe(mode === "night" ? body.userData.nightMaterial : body.userData.dayMaterial);
          expect(body.material).toBeInstanceOf(mode === "night" ? MeshStandardMaterial : MeshBasicMaterial);
        }
        for (const [index, mesh] of batches.entries()) {
          expect(mesh.material).toBe(mesh.userData.dayMaterial);
          expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0xffffff);
          expect(Array.from(mesh.instanceColor!.array)).toEqual(initialColors[index]);
        }
      }
      apply("night", false);
      const darkColors = batches.map(mesh => Array.from(mesh.instanceColor!.array));
      for (const [index, mesh] of batches.entries()) {
        // No lens keeps a bright self-lit channel with artificial lights off.
        expect(Math.max(...mesh.instanceColor!.array)).toBeLessThan(.06);
        expect(darkColors[index]).not.toEqual(initialColors[index]);
      }
      expect(updatePotsdamerTrafficTower(tower, 18, false, false)).toBeFalse();
      for (const mode of ["night", "schwellenraum", "snowstorm", "minecraft", "day"] as const) {
        apply(mode);
        for (const [index, mesh] of batches.entries()) {
          expect(Array.from(mesh.instanceColor!.array)).toEqual(initialColors[index]);
          expect(Array.from(mesh.instanceMatrix.array)).toEqual(initialMatrices[index]);
        }
      }
    } finally {
      const geometries = new Set(bodies.map(body => body.geometry));
      const materials = new Set(bodies.flatMap(objectMaterialsIncludingTransferredAlternates));
      for (const batch of batches) {
        batch.dispose(); geometries.add(batch.geometry);
        for (const material of objectMaterialsIncludingTransferredAlternates(batch)) materials.add(material);
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  });
}

test("office bounds rejection preserves the full footprint and exact margin around every edge", () => {
  // Independent winding-angle + segment-distance oracle exercises thin source
  // footprints around both sides of every measured edge and each bbox corner.
  function insideOrNear(x: number, z: number): boolean {
    let winding = 0;
    let minimum = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
      winding += Math.atan2((ax - x) * (bz - z) - (az - z) * (bx - x),
        (ax - x) * (bx - x) + (az - z) * (bz - z));
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      minimum = Math.min(minimum, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return Math.abs(winding) > Math.PI || minimum <= margin;
  }
  let comparisons = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az), nx = (bz - az) / length, nz = -(bx - ax) / length;
    for (const t of [0, .25, .5, .75, 1]) {
      for (const offset of [-100, -margin - .001, -margin + .001, 0, margin - .001, margin + .001, 100]) {
        const x = ax + t * (bx - ax) + offset * nx, z = az + t * (bz - az) + offset * nz;
        const building: PrismBuilding = { id: "boundary-probe", class: 0, h_dm: 100, y0_dm: 0,
          ring: [[x * 10, z * 10], [(x + .0001) * 10, z * 10], [x * 10, (z + .0001) * 10]] };
        const count = building.ring.filter(([px, pz]) => insideOrNear(px / 10, pz / 10)).length;
        expect(isInterimOfficeFootprintSuppressed(building)).toBe(count / building.ring.length >= fraction);
        comparisons += 1;
      }
    }
  }
  expect(comparisons).toBeGreaterThan(300);
});

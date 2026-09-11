import { describe, expect, test } from "bun:test";
import { Box3, BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import source from "../src/schlossNaturkundeSource.json";
import { createSchlossNaturkundeShells, createMinecraftSchlossNaturkundeShells } from "../src/SchlossNaturkundeShells";
import { createSchlossNaturkundeFacades, createMinecraftSchlossNaturkundeFacades, SCHLOSS_NATURKUNDE_FACADE_PROFILE, naturkundeFrontOffsetAt } from "../src/SchlossNaturkundeFacades";
import { SCHLOSS_NATURKUNDE_PRISM_IDS, schlossNaturkundePartRoofAt, isSchlossNaturkundeReplacementColumn } from "../src/schlossNaturkundeProfile";

function budget(root: Group) {
  let draws = 0, instances = 0, bytes = 0;
  const seen = new Set<BufferGeometry>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    draws++;
    expect(o.matrixAutoUpdate).toBeFalse();
    expect(o.userData.dayMaterial.map).toBeNull();
    expect(o.userData.nightMaterial.map).toBeNull();
    if (!seen.has(o.geometry)) {
      seen.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) { bytes += a.array.byteLength; expect(Array.from(a.array).every(Number.isFinite)).toBeTrue(); }
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
    if (o instanceof InstancedMesh) {
      instances += o.count;
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
    }
  });
  return { draws, instances, bytes };
}
describe("Schloss and Naturkunde retained architecture", () => {
  test("the museum entrance stays in front of the projecting source risalit", () => {
    const a = SCHLOSS_NATURKUNDE_FACADE_PROFILE.naturkunde.front;
    const dx = a.end[0] - a.start[0], dz = a.end[1] - a.start[1], l = Math.hypot(dx, dz);
    expect(naturkundeFrontOffsetAt(l / 2)).toBeGreaterThan(2.6);
    expect(naturkundeFrontOffsetAt(10)).toBeLessThan(.3);
    const facade = createSchlossNaturkundeFacades(), root = new Group();
    root.add(createSchlossNaturkundeShells(), facade); root.updateMatrixWorld(true);
    const normal = new Vector3(-dz / l, 0, dx / l);
    const origin = new Vector3((a.start[0] + a.end[0]) / 2, 8.55, (a.start[1] + a.end[1]) / 2).addScaledVector(normal, 20);
    const hit = new Raycaster(origin, normal.clone().negate()).intersectObject(root, true)[0];
    expect(hit).toBeDefined();
    expect(hit.object.parent).toBe(facade);
  });
  test("native cornices remain narrow instead of expanding to their world bounding boxes", () => {
    const root = createMinecraftSchlossNaturkundeFacades(), matrix = new Matrix4(), scale = new Vector3();
    let longCornices = 0;
    root.traverse(o => {
      if (!(o instanceof InstancedMesh)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix);
        if (Math.max(scale.x, scale.z) < 50) continue;
        longCornices++;
        expect(Math.min(scale.x, scale.z)).toBeLessThan(2);
      }
    });
    expect(longCornices).toBeGreaterThan(10);
  });
  test("keeps all exact sources, correct identities and local vertical datum", () => {
    expect(source.profiles.schloss.parts).toHaveLength(17);
    expect(source.profiles.naturkunde.parts).toHaveLength(4);
    expect(SCHLOSS_NATURKUNDE_PRISM_IDS.size).toBe(5);
    expect(SCHLOSS_NATURKUNDE_PRISM_IDS.has("-3007958")).toBeTrue();
    expect(SCHLOSS_NATURKUNDE_PRISM_IDS.has("A8mGJ9k2")).toBeTrue();
    expect(source.profiles.naturkunde.display_y_translation_m).toBe(2.166);
    expect(SCHLOSS_NATURKUNDE_FACADE_PROFILE.schloss.baroqueFronts).toBe(3);
    expect(SCHLOSS_NATURKUNDE_FACADE_PROFILE.schloss.modernFronts).toBe(1);
    expect(SCHLOSS_NATURKUNDE_FACADE_PROFILE.naturkunde.centralBays).toBe(3);
    expect(SCHLOSS_NATURKUNDE_FACADE_PROFILE.naturkunde.portraitFields).toBe(3);
  });
  test("adds the copper dome only once and completes the documented overall silhouette", () => {
    const root = createSchlossNaturkundeFacades();
    expect(new Box3().setFromObject(root).max.y).toBeCloseTo(75.236, 3);
    expect(root.children.filter((o) => o.name.endsWith(" dome"))).toHaveLength(1);
    const dome = source.profiles.schloss.parts[0];
    expect(schlossNaturkundePartRoofAt(dome, 1979.43, 278)).toBeCloseTo(64.87, 3);
    expect(schlossNaturkundePartRoofAt(dome, 1988, 278)).toBeLessThan(64);
    expect(schlossNaturkundePartRoofAt(dome, 2050, 278)).toBeNull();
    expect(isSchlossNaturkundeReplacementColumn(1979.43, 278)).toBeTrue();
    expect(isSchlossNaturkundeReplacementColumn(1900, 100)).toBeFalse();
  });
  test("keeps complete static facades and original source sheets in bounded GPU memory", () => {
    const shell = budget(createSchlossNaturkundeShells()), facade = budget(createSchlossNaturkundeFacades());
    expect(shell.draws).toBe(2); expect(shell.bytes).toBeLessThan(350_000);
    expect(facade.draws).toBe(5); expect(facade.instances).toBeGreaterThan(2900);
    expect(facade.bytes).toBeLessThan(280_000);
  });
  test("Minecraft uses two native surface batches with no smooth duplicate or hidden fill", () => {
    const shellRoot = createMinecraftSchlossNaturkundeShells(), facadeRoot = createMinecraftSchlossNaturkundeFacades();
    const shell = budget(shellRoot), facade = budget(facadeRoot);
    expect(shellRoot.userData.surfaceOnly).toBeTrue();
    expect(shellRoot.userData.hiddenSolidInfill).toBeFalse();
    expect(facadeRoot.userData.blockNative).toBeTrue();
    expect(shell.draws).toBe(1); expect(facade.draws).toBe(1);
    expect(shell.bytes).toBeLessThan(850_000); expect(facade.bytes).toBeLessThan(200_000);
    expect(new Box3().setFromObject(facadeRoot).max.y).toBeCloseTo(75.236, 3);
    expect(shellRoot.children.every((o) => (o as Mesh).geometry.getAttribute("position").count === 24)).toBeTrue();
  });
});

import { expect, test } from "bun:test";
import { Group, InstancedMesh, PerspectiveCamera, Vector3 } from "three";
import { createPotsdamerTrafficTower, setPotsdamerTrafficTowerPresentation } from "../src/PotsdamerTrafficTower";
import { updateVisiblePotsdamerTrafficTower } from "../src/potsdamerTrafficTowerMotion";
import { POTSDAMER_TRAFFIC_TOWER_PROFILE as P, POTSDAMER_TOWER_DRAWN_NAME, POTSDAMER_TOWER_MINECRAFT_NAME } from "../src/potsdamerTrafficTowerProfile";
import { applySignatureLightingPresentation } from "../src/ThreeViewer";
import { applyMinecraftVisibility, restoreMinecraftVisibility } from "../src/MinecraftVisibility";

function view() {
  const tower = createPotsdamerTrafficTower();
  const camera = new PerspectiveCamera(39, 1, .25, 18000);
  const focus = new Vector3(P.worldXZ[0], P.groundYM + P.signalCentreM, P.worldXZ[1]);
  camera.position.copy(focus).add(new Vector3(12, 5, 22));
  camera.lookAt(focus); camera.updateMatrixWorld();
  const scratch = new Vector3();
  return { tower, camera, update: (time: number, hidden = false, underside = false, reduced = false, lights = true) =>
    updateVisiblePotsdamerTrafficTower(tower, camera, time, reduced, lights, hidden, underside, scratch) };
}

test("a visible phase boundary wakes a still view once, with no per-frame colour upload", () => {
  const f = view();
  expect(f.update(0)).toBeFalse();
  expect(f.update(16)).toBeTrue();
  expect(f.update(16.01)).toBeFalse();
  expect(f.update(18)).toBeTrue();
  expect(f.update(18.5)).toBeFalse();
  expect(f.update(32)).toBeTrue();
  expect(f.update(36)).toBeTrue();
});

test("hidden, underground and off-screen towers cannot request redraws; returning catches up", () => {
  const f = view();
  expect(f.update(16, true)).toBeFalse();
  expect(f.update(16, false, true)).toBeFalse();
  f.camera.rotateY(Math.PI); f.camera.updateMatrixWorld();
  expect(f.update(16)).toBeFalse();
  f.camera.rotateY(Math.PI); f.camera.updateMatrixWorld();
  expect(f.update(16)).toBeTrue();
  f.tower.visible = false;
  expect(f.update(18)).toBeFalse();
  f.tower.visible = true;
  expect(f.update(18)).toBeTrue();
});

test("reduced motion and lights-off settle after one update", () => {
  const f = view();
  expect(f.update(0, false, false, true)).toBeTrue();
  expect(f.update(32, false, false, true)).toBeFalse();
  expect(f.update(32, false, false, false, false)).toBeTrue();
  expect(f.update(72, false, false, false, false)).toBeFalse();
});

test("native blocks survive the production signature filter and drawn/night materials restore", () => {
  const tower = createPotsdamerTrafficTower();
  const roots = { signatures: new Group().add(tower), civicDetails: new Group(), centralDetails: new Group(), cityStaffage: new Group() };
  for (const mode of ["day", "minecraft", "night", "snowstorm", "schwellenraum", "minecraft", "day"] as const) {
    restoreMinecraftVisibility(roots);
    applySignatureLightingPresentation(roots.signatures, mode);
    applyMinecraftVisibility(roots, mode === "minecraft");
    setPotsdamerTrafficTowerPresentation(tower, mode);
    expect(tower.visible).toBeTrue();
    const drawn = tower.getObjectByName(POTSDAMER_TOWER_DRAWN_NAME)!;
    const blocks = tower.getObjectByName(POTSDAMER_TOWER_MINECRAFT_NAME)!;
    expect(drawn.visible).toBe(mode !== "minecraft");
    expect(blocks.visible).toBe(mode === "minecraft");
    let lenses = 0;
    roots.signatures.traverseVisible(object => {
      if (object instanceof InstancedMesh && object.name === "traffic tower animated lamps") lenses += object.count;
    });
    expect(lenses).toBe(15);
  }
});

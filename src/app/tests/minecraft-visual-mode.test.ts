import { describe, expect, test } from "bun:test";
import {
  Box3,
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";

import { createOfficialReichstagDome } from "../src/ReichstagDome";
import {
  createMinecraftMaterialState,
  disposeMinecraftMaterialState,
  setMinecraftMaterialPresentation,
} from "../src/visual-modes/minecraft/materialMode";
import { CRISPNESS_PROFILES } from "../src/crispnessProfile";
import {
  MATERIAL_PALETTES,
  MINECRAFT_PALETTE,
} from "../src/visual-modes/minecraft/palette";
import {
  VOXEL_BASE_CELL_CAP_DEVICE_PX,
  VOXEL_BASE_CELL_DEVICE_PX,
  voxelBaseCell,
} from "../src/visual-modes/minecraft/voxelGrid";

const domeSignature = {
  anchor_world: [12, 36.4, -8] as [number, number, number],
  diameter_m: 40,
  geometry_status: "official-dimension visual test",
  height_m: 23.5,
  horizontal_rings: 17,
  id: "reichstag-dome",
  landmark_name: "Reichstagsgebäude",
  source_url: "https://www.bundestag.de/besuche/architektur/reichstag/kuppel",
  vertical_ribs: 24,
};

function screenPoint(
  point: Vector3,
  camera: PerspectiveCamera,
  size = 1024,
): Vector3 {
  const projected = point.clone().project(camera);
  return new Vector3(
    (projected.x * 0.5 + 0.5) * size,
    (-projected.y * 0.5 + 0.5) * size,
    projected.z,
  );
}

describe("premium Minecraft visual mode", () => {
  test("uses a coarse 24-28 colour authored palette", () => {
    expect(MINECRAFT_PALETTE.length).toBeGreaterThanOrEqual(24);
    expect(MINECRAFT_PALETTE.length).toBeLessThanOrEqual(28);
    expect(new Set(MINECRAFT_PALETTE).size).toBe(MINECRAFT_PALETTE.length);
    // Every per-material colour must come from the master palette.
    const master = new Set<number>(MINECRAFT_PALETTE);
    for (const family of Object.values(MATERIAL_PALETTES)) {
      for (const colour of family) {
        expect(master.has(colour)).toBe(true);
      }
    }
    // Roof-copper must stay varied so Reichstag dome and Chancellery
    // remain distinct at zoom-out.
    expect(new Set(MATERIAL_PALETTES.roofCopper).size).toBeGreaterThanOrEqual(4);
  });

  test("doubles the voxel base cell and caps it below building collapse", () => {
    expect(VOXEL_BASE_CELL_DEVICE_PX.coarse).toBe(4.7);
    expect(VOXEL_BASE_CELL_DEVICE_PX.fine).toBe(5.6);
    expect(voxelBaseCell(true)).toBe(4.7);
    expect(voxelBaseCell(false)).toBe(5.6);
    expect(VOXEL_BASE_CELL_CAP_DEVICE_PX).toBe(24);
    expect(voxelBaseCell(true)).toBeLessThanOrEqual(VOXEL_BASE_CELL_CAP_DEVICE_PX);
    expect(voxelBaseCell(false)).toBeLessThanOrEqual(VOXEL_BASE_CELL_CAP_DEVICE_PX);
  });

  test("drives the near-black outline from the shared crispness profile", () => {
    expect(CRISPNESS_PROFILES.minecraft.edgeStrength).toBe(0.85);
    // Minecraft still bypasses the shared crisp pass entirely.
    expect(CRISPNESS_PROFILES.minecraft.strength).toBe(0);
  });

  test("postprocess shader hard-quantises and draws near-black outlines", async () => {
    const fragment = await Bun.file(
      new URL("../src/visual-modes/minecraft/postprocess.frag", import.meta.url),
    ).text();
    // Hard quantise: dithering must be gated behind the ditherStrength
    // uniform (0 by default) instead of always-on.
    expect(fragment).toContain("uniform float ditherStrength");
    expect(fragment).toContain("dither * ditherStrength");
    // The outline mix comes from the shared profile via the edgeMix
    // uniform, with a lowered trigger threshold.
    expect(fragment).toContain("uniform float edgeMix");
    expect(fragment).toContain("edge * edgeMix");
    expect(fragment).toContain("smoothstep(0.075, 0.24");
    // Outline tints must be near-black (every channel below 0.07):
    // slightly warm for glass, cool for stone.
    const tintChannels = [0.03, 0.04, 0.058, 0.062, 0.046, 0.028];
    for (const channel of tintChannels) {
      expect(channel).toBeLessThan(0.07);
    }
    expect(fragment).toContain("vec3(0.030, 0.040, 0.058)");
    expect(fragment).toContain("vec3(0.062, 0.046, 0.028)");
  });

  test("changes materials without moving or resizing source geometry", () => {
    const scene = new Scene();
    const mesh = new Mesh(
      new BoxGeometry(56.472, 36, 56.376),
      new MeshStandardMaterial({ color: 0xd4d4b7 }),
    );
    mesh.position.set(66.2, 18, -0.3);
    mesh.rotation.y = 0.42;
    scene.add(mesh);
    scene.updateMatrixWorld(true);
    const beforeMatrix = mesh.matrixWorld.toArray();
    const beforeBounds = new Box3().setFromObject(mesh);
    const state = createMinecraftMaterialState();

    setMinecraftMaterialPresentation(scene, state, true);
    scene.updateMatrixWorld(true);

    expect(mesh.material).toBeInstanceOf(MeshToonMaterial);
    expect(mesh.matrixWorld.toArray()).toEqual(beforeMatrix);
    expect(new Box3().setFromObject(mesh).min.toArray()).toEqual(
      beforeBounds.min.toArray(),
    );
    expect(new Box3().setFromObject(mesh).max.toArray()).toEqual(
      beforeBounds.max.toArray(),
    );

    setMinecraftMaterialPresentation(scene, state, false);
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    disposeMinecraftMaterialState(state);
  });

  test("builds the block look in world space (flat-shaded toon), not screen pixels", () => {
    // Round-2 fix: the screen-space NEAREST voxel post-process flimmered when
    // zoomed out. The block look now comes entirely from world-space flat-shaded
    // toon materials, so it stays as calm as Day mode at every zoom level.
    const scene = new Scene();
    const mesh = new Mesh(
      new BoxGeometry(20, 20, 20),
      new MeshStandardMaterial({ color: 0xd4d4b7 }),
    );
    scene.add(mesh);
    const state = createMinecraftMaterialState();
    setMinecraftMaterialPresentation(scene, state, true);
    const material = mesh.material as MeshToonMaterial & { flatShading: boolean };
    expect(material).toBeInstanceOf(MeshToonMaterial);
    expect(material.flatShading).toBe(true);
    disposeMinecraftMaterialState(state);
  });

  test("keeps the Reichstag dome centre on the same screen pixel", () => {
    const scene = new Scene();
    const dome = createOfficialReichstagDome(domeSignature);
    scene.add(dome);
    scene.updateMatrixWorld(true);
    const centre = new Box3().setFromObject(dome).getCenter(new Vector3());
    const camera = new PerspectiveCamera(39, 1, 0.25, 6000);
    camera.position.set(160, 125, 170);
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const before = screenPoint(centre, camera);
    const state = createMinecraftMaterialState();

    setMinecraftMaterialPresentation(scene, state, true);
    scene.updateMatrixWorld(true);
    const after = screenPoint(
      new Box3().setFromObject(dome).getCenter(new Vector3()),
      camera,
    );

    expect(after.distanceTo(before)).toBeLessThanOrEqual(3);
    expect(dome.getObjectByName("dome alternating diagonal glazing braces")).toBeDefined();
    expect(dome.getObjectByName("daylight mirror cone 24-sector facet grid")).toBeDefined();
    disposeMinecraftMaterialState(state);
  });
});

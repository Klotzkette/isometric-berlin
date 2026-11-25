import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Group, InstancedMesh, type Object3D } from "three";
import { preloadAltMitteNativeV169Source } from "../src/AltMitteNativeCoreV169";
import { restoreFidelityGroundSlabsV296 } from "../src/FidelityGroundOpeningsV296";
import { buildMinecraftVoxelWorldSteps } from "../src/MinecraftVoxelWorld";
import { prepareNordbahnhofNative } from "../src/NordbahnhofPublicAccess";
import { prepareNorthCoreActualTerrainV310Steps } from "../src/NorthCoreActualTerrainV310";
import { createPotsdamerPavilionRoutes } from "../src/PotsdamerPavilionRoutes";
import { cutUbahnPresentationV261 } from "../src/UbahnSurfaceAperturesV261";
import { cutUbahnPresentationV281 } from "../src/UbahnSurfaceAperturesV281";
import { cutRosenthalerPresentationV228 } from "../src/RosenthalerSurfaceAperturesV228";
import { cutPotsdamerPassarelleGround } from "../src/PotsdamerSouthGround";

const json = (path: string) => Bun.file(new URL(path, import.meta.url)).json();
function finish<T>(steps: Generator<void, T>): T {
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

test("settled native ground preserves every v310 Humboldthain row through the station and memorial cuts", async () => {
  const [payload, prisms, scene, base, bridge, actual] = await Promise.all([
    json("../public/mesh/regierungsviertel/minecraft-voxels.json"),
    json("../public/mesh/regierungsviertel/lod2-prisms.json"),
    json("../public/mesh/regierungsviertel/scene.json"),
    json("../src/data/coreTerrainContactV307.json"),
    json("../src/data/gesundbrunnenBridgeCoreV309Delta.json"),
    json("../src/data/coreTerrainActualV310.json"),
  ]);
  await preloadAltMitteNativeV169Source();
  const world = new Group();
  const steps = buildMinecraftVoxelWorldSteps(world, payload, null, scene.tiergartentunnel, {
    includeLegacyMonbijou: false, sourcePrisms: prisms.buildings,
  });
  // Stop at the real ground publication, before allocating city buildings and trees.
  let mesh: Object3D | undefined;
  while (!(mesh = world.children.find(child => child.name === "Voxel ground runs"))) {
    if (steps.next().done) throw Error("Missing native ground owner");
  }
  steps.return(world);
  if (!(mesh instanceof InstancedMesh) || !mesh.instanceColor) throw Error("Missing native terrain paint");
  const fidelity = world.children.find(child => child.userData.courtsParkV293)?.userData;
  expect(fidelity?.parliamentaryDiningV296).toBe(true);
  expect(fidelity?.waterfrontV296).toBe(true);
  world.clear();
  world.add(mesh);
  restoreFidelityGroundSlabsV296(mesh, { native: true, dining: true, waterfront: true });
  expect(createPotsdamerPavilionRoutes(true).cutGround(world)).toBe(true);
  expect(cutPotsdamerPassarelleGround(world, true)).toBe(true);
  expect(prepareNordbahnhofNative(prisms.buildings, payload)?.plan.cutGround(world)).toBe(true);

  const prepare = () => finish(prepareNorthCoreActualTerrainV310Steps(world, true, true, base, bridge, actual));
  // The complete RequiredSiteEnvelopes client cuts run after the station openings.
  expect(prepare()).toBeNull();
  cutUbahnPresentationV261(world, true);
  cutUbahnPresentationV281(world, true);
  cutRosenthalerPresentationV228(world, true);
  const matrix = mesh.instanceMatrix.array, paint = mesh.instanceColor.array;
  // Combined full matrix/RGB SHA measured before retirement in the real browser.
  expect(createHash("sha256").update(matrix).update(paint).digest("hex"))
    .toBe("1b452eb8c40422b2e71e9115769e9cdc65e4506ceea8c02a02b73749f881dd6d");
  const local = createHash("sha256");
  // Ordered Float32 matrix and RGB words from the archived complete v310 source survey.
  for (const ordinal of actual.variants.minecraft.retire) {
    local.update(matrix.subarray(ordinal * 16, (ordinal + 1) * 16));
    local.update(paint.subarray(ordinal * 3, (ordinal + 1) * 3));
  }
  expect(actual.variants.minecraft.retire).toHaveLength(784);
  expect(local.digest("hex")).toBe("b813977e824e86201dee36657ea671c0e20c949d423272c7ad101586ead0be71");

  const transaction = prepare();
  expect(transaction?.commit(true)).toBe(true);
  expect(transaction?.complete()).toBe(true);
  transaction!.rollback();
  expect(mesh.instanceMatrix.array).toBe(matrix);
  // A change even outside the field must still fail the complete-source guard.
  paint[0] += 0.01;
  expect(prepare()).toBeNull();
}, 60000);

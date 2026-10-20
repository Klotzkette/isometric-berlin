import { describe, expect, test } from "bun:test";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import groundJson from "../public/mesh/regierungsviertel/ground-context.json";
import sceneJson from "../public/mesh/regierungsviertel/scene.json";
import { createGroundSlabs, type VoxelPayload } from "../src/MinecraftVoxelWorld";
import { restoreHbfNorthRailGroundOwnership } from "../src/HbfNorthRailGroundOwnership";
import { HAUPTBAHNHOF_ACCESS } from "../src/HauptbahnhofAccessProfile";
import { HAUPTBAHNHOF_INTERIOR_LEVELS } from "../src/ArchitecturalLandmarks";
import { hauptbahnhofGroundAt } from "../src/HauptbahnhofNavigation";
import { ISO_GROUND_SHADES } from "../src/IsometricCityWorld";

const ground = groundJson as VoxelPayload;
const world = ([x,y,z]: number[]) => {
  const yaw = 21.82 * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
  return new Vector3(-119.936 + c*x + s*z, 4.575+y, -683.307-s*x+c*z);
};
const ray = () => {
  const from = world([0,7,-68]), to = world([9.5,-14.055,-81.8]);
  return new Raycaster(from, to.clone().sub(from).normalize(), 0, from.distanceTo(to));
};
const makeSlabs = () => {
  const slabs = createGroundSlabs(ground, "Drawn ground slabs", ISO_GROUND_SHADES, {
    emissive: 0, parkRelief: "drawn", skipClasses: ["asphalt"], skipBridge: true, skipWater: true,
    // Retain every actual source cell near this bounded station, avoiding a
    // city-sized regression fixture without altering its original run heights.
    skipAtWorld: (x,z) => x < -180 || x > -60 || z < -790 || z > -570,
  });
  slabs.userData.nightMaterial = slabs.material;
  slabs.userData.dayMaterial = new MeshBasicMaterial({color: 0xffffff});
  slabs.material = slabs.userData.dayMaterial;
  slabs.updateMatrixWorld(true);
  return slabs;
};

describe("Hbf existing drawn atrium ground ownership", () => {
  test("pins the exact existing model frame, level edges and entrance landing", () => {
    const station = sceneJson.architectural_signatures.find(s => s.kind === "hauptbahnhof_model")!;
    expect(station.anchor_world).toEqual([-119.936,4.575,-683.307]);
    expect(station.rotation_y_degrees).toBe(21.82);
    expect(HAUPTBAHNHOF_ACCESS.groundAtriumHalfWidthM).toBe(9.5);
    expect(HAUPTBAHNHOF_ACCESS.foyerInnerLocalZ).toBe(82);
    expect(HAUPTBAHNHOF_INTERIOR_LEVELS[2].elevationM).toBe(0);
  });

  test("removes the identified green occluder from the gallery-to-platform sight ray", () => {
    const slabs = makeSlabs();
    const before = ray().intersectObject(slabs, true)[0];
    expect(before.object.name).toBe("Drawn ground slabs");
    expect(before.faceIndex).toBe(4);
    expect(before.point.distanceTo(new Vector3(-144.093787275,5.200000048,-751.383340055))).toBeLessThan(0.00001);
    restoreHbfNorthRailGroundOwnership(slabs, ground, true);
    slabs.updateMatrixWorld(true);
    expect(ray().intersectObject(slabs, true)).toHaveLength(0);
    expect(slabs.children).toHaveLength(1);
    expect(slabs.children[0].userData.hbfAtriumGroundOwnershipV252).toBeTrue();
    // Both rendered fragments use the same existing complement material pair.
    const materials = new Set<unknown>();
    slabs.children[0].traverse(o => { if(o instanceof Mesh) materials.add(o.material); });
    expect(materials.size).toBe(1);
  });

  test("native keeps the same ground and hall, while drawn walking already resolves actual lower floors", () => {
    const native = makeSlabs(), before = Array.from(native.instanceMatrix.array);
    restoreHbfNorthRailGroundOwnership(native, ground);
    expect(Array.from(native.instanceMatrix.array)).toEqual(before);
    expect(ray().intersectObject(native, true).length).toBeGreaterThan(0);
    for (const side of [-1,1]) for (const mode of ["day","night","snowstorm"] as const) {
      const gap = world([0,0,side*60]);
      expect(hauptbahnhofGroundAt(mode,gap.x,gap.z,4.825)).toBeCloseTo(-10.425,5);
      for(const [x,z,y] of [[12,60,.25],[0,49.5,.25],[0,85,.25],[0,71,-5.15],[9.5,81.8,-14.055]]) {
        const support=world([x,y,side*z]);
        expect(hauptbahnhofGroundAt(mode,support.x,support.z,support.y)).toBeCloseTo(support.y,5);
      }
      expect(hauptbahnhofGroundAt("minecraft",gap.x,gap.z)).toBeCloseTo(5.895,5);
    }
  });
});

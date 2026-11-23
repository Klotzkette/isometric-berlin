import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Vector3, type Object3D } from "three";
import scene from "../public/mesh/regierungsviertel/scene.json";
import parkData from "../public/mesh/regierungsviertel/park-details.json";
import voxelData from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  createMitteCanopiesV376, earlyCanopiesV376, isKochChestnutV376,
  withCanopyParkV376, withCanopyVoxelsV376, retainMitteCanopyCellV376,
} from "../src/MitteCanopyV376";
import { createParkDetails, createParkTreeStand, decodeTrees, type ParkDetailsPayload } from "../src/ParkDetails";
import type { TunnelPortalPayload } from "../src/TunnelPortals";
import { minecraftVoxelTreeRetained, type VoxelPayload } from "../src/terrainPayload";
import {
  addFirstParkTreeObstacles, createPedestrianParkTreeSolidTester, pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";

const park = parkData as unknown as ParkDetailsPayload;
const raw = voxelData as unknown as VoxelPayload;
const tunnel = scene.tiergartentunnel as unknown as TunnelPortalPayload;
const first = earlyCanopiesV376();

test("the original park adopts every early tree at the three additional municipal stands once", () => {
  expect(first.map(s => s.length)).toEqual([483,39,141,96,181,53]);
  const root = createMitteCanopiesV376(tunnel, false);
  expect(root.children.map(g => g.userData.treeCount)).toEqual([483,39,141,96,181,53]);
  const published = withCanopyParkV376(park);
  expect(withCanopyParkV376(published)).toBe(published);
  const byId = new Map(decodeTrees(published.trees, published.tree_vocabulary).map(t => [t.id,t]));
  expect(byId.size).toBe(published.trees.length);
  for (const t of first.flat()) expect(byId.get(t.id)).toEqual(t);
  for (const [i, group] of root.children.slice(3).entries()) {
    const crowns = group.getObjectByName("Mobile park instanced one-crown tree anchors") as InstancedMesh;
    expect(crowns.count).toBe(first[i + 3].length);
  }
});

function crownSize(root: Object3D, ground: number) {
  const matrix = new Matrix4(), point = new Vector3();
  let loX = Infinity, loZ = Infinity, hiX = -Infinity, hiZ = -Infinity, hiY = -Infinity;
  root.traverse(mesh => {
    if (!(mesh instanceof InstancedMesh) || !mesh.name.includes("dense beech and chestnut crowns")) return;
    const vertices = mesh.geometry.getAttribute("position");
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      for (let j = 0; j < vertices.count; j++) {
        point.fromBufferAttribute(vertices, j).applyMatrix4(matrix);
        loX = Math.min(loX, point.x); hiX = Math.max(hiX, point.x);
        loZ = Math.min(loZ, point.z); hiZ = Math.max(hiZ, point.z);
        hiY = Math.max(hiY, point.y);
      }
    }
  });
  return [hiY - ground, Math.max(hiX - loX, hiZ - loZ)];
}

test("all 19 first and complete individual five-lobed crowns fit the municipal heights and diameters", () => {
  const koch = first[1].filter(isKochChestnutV376);
  expect(koch).toHaveLength(19);
  for (const tree of koch) {
    const initial = createParkTreeStand([tree],tunnel,false);
    const attached = createParkDetails({
      ...park, paths: [], trees: [tree], playgrounds: [], hedges: [], street_lights: [], shrub_patches: [], wall_traces: [],
    }, { detailProfile: "mobile", settledDetail: false, tunnel });
    for (const stage of [initial,attached]) {
      const [height, diameter] = crownSize(stage,tree.position[1]);
      expect(height).toBeCloseTo(tree.height_m,2);
      expect(diameter).toBeCloseTo(tree.crown_radius_m * 2,2);
    }
  }
  expect(isKochChestnutV376({...koch[0], position: [0,0,0]})).toBeFalse();
});

test("native admission retains the exact 19 chestnut cells and applies their measured block dimensions", () => {
  const voxels = withCanopyVoxelsV376(raw);
  const chestnuts = first[1].filter(isKochChestnutV376);
  const actual = chestnuts.map(t => t.nativeTreeBlock!);
  for (const [profile, oldCount] of [["full",7],["mobile",2]] as const) {
    expect(actual.filter(([x,z]) => minecraftVoxelTreeRetained(x,z,profile))).toHaveLength(oldCount);
    expect(actual.filter(([x,z]) => minecraftVoxelTreeRetained(x,z,profile,voxels.retainSurveyTree))).toHaveLength(19);
  }
  for (const t of chestnuts) {
    const [cx,cz] = t.nativeTreeBlock!;
    const fit = voxels.surveyedNativeCrown!(cx,cz)!;
    expect([fit.x,fit.z,fit.stemRadius,fit.height,fit.diameter]).toEqual(
      [t.position[0],t.position[2],t.trunk_radius_m!,t.height_m,2*t.crown_radius_m]);
  }
  const [cx,cz] = actual[0];
  const altered = {...raw, tree_rows: [...raw.tree_rows!]};
  const dz = cz - raw.grid.min_z_idx;
  altered.tree_rows[dz] = altered.tree_rows[dz].filter(([ox]) => ox !== cx - raw.grid.min_x_idx);
  expect(withCanopyVoxelsV376(altered).retainSurveyTree!(cx,cz)).toBeFalse();
});

test("pedestrian collision follows the fitted square and releases the displaced raster centre", () => {
  const tree = first[1].find(t => t.position[0] === 483.4)!;
  const [cx,cz,y] = tree.nativeTreeBlock!;
  const env: PedestrianEnvironment = {
    bounds: { minX:-2000, minZ:-2000, maxX:2000, maxZ:2000 }, groundAt: () => y/10,
    parkTreeSolidAt: createPedestrianParkTreeSolidTester(4,"mobile",() => true,retainMitteCanopyCellV376),
  };
  addFirstParkTreeObstacles(env,[tree],tunnel);
  expect(pedestrianPointIsBlocked(tree.position[0],tree.position[2],y/10,env.obstacles,env)).toBeTrue();
  expect(pedestrianPointIsBlocked(cx*4+2,cz*4+2,y/10,env.obstacles,env)).toBeFalse();
});

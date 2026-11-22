import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4 } from "three";
import scene from "../public/mesh/regierungsviertel/scene.json";
import parkSource from "../public/mesh/regierungsviertel/park-details.json";
import voxelSource from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import {
  createEarlyMitteTreesV375,
  earlyMitteTreeStandsV375,
  matchesMitteTreeSceneV375,
  withMitteNativeTreesV375,
  withMitteSurveyTreesV375,
} from "../src/MitteTreesV375";
import { decodeTrees, type ParkDetailsPayload } from "../src/ParkDetails";
import {
  addFirstParkTreeObstacles,
  addPedestrianParkObstacles,
  createPedestrianParkTreeSolidTester,
  pedestrianPointIsBlocked,
  type PedestrianEnvironment,
} from "../src/pedestrianNavigation";
import { minecraftVoxelTreeRetained, type VoxelPayload } from "../src/terrainPayload";
import type { TunnelPortalPayload } from "../src/TunnelPortals";

const tunnel = scene.tiergartentunnel as unknown as TunnelPortalPayload;
const park = parkSource as unknown as ParkDetailsPayload;
const voxel = voxelSource as unknown as VoxelPayload;
const stands = earlyMitteTreeStandsV375();
const published = withMitteSurveyTreesV375(park);

test("first publication contains every surveyed Tiergarten and Robert-Koch-Platz stem on touch", () => {
  expect(matchesMitteTreeSceneV375(scene)).toBeTrue();
  expect(matchesMitteTreeSceneV375({ ...scene, landmarks: [] })).toBeFalse();
  const group = createEarlyMitteTreesV375(tunnel, false);
  expect(group.children.map((child) => child.userData.treeCount)).toEqual([483, 39, 141]);
  const matrix = new Matrix4();
  group.children.forEach((child, index) => {
    const trunks = child.children.find(
      (o) => o instanceof InstancedMesh && /tree trunks/i.test(o.name),
    ) as InstancedMesh;
    expect(trunks.count).toBe(stands[index].length);
    stands[index].forEach((tree, i) => {
      trunks.getMatrixAt(i, matrix);
      expect(matrix.elements[12]).toBeCloseTo(tree.position[0], 3);
      expect(matrix.elements[14]).toBeCloseTo(tree.position[2], 3);
      const baseY = matrix.elements[13] - matrix.elements[5] / 2;
      expect(baseY).toBeCloseTo(tree.position[1], 3);
    });
  });
  const rootContact = group.getObjectByName(
    "Source tree root contact with arrival terrain",
  ) as InstancedMesh;
  expect(rootContact.count).toBe(81);
  let foundArrival = false;
  for (let i = 0; i < rootContact.count; i++) {
    rootContact.getMatrixAt(i, matrix);
    if (
      Math.abs(matrix.elements[12] - 266.33) < 0.001 &&
      Math.abs(matrix.elements[14] - 210.13) < 0.001
    ) {
      expect(matrix.elements[13] - matrix.elements[5] / 2).toBeCloseTo(4.4, 3);
      expect(matrix.elements[13] + matrix.elements[5] / 2).toBeCloseTo(4.92, 3);
      foundArrival = true;
    }
  }
  expect(foundArrival).toBeTrue();
  const chestnut = stands[1].find((t) => t.position[0] === 502.99 && t.position[2] === -1012.49)!;
  expect([chestnut.height_m, chestnut.crown_radius_m, chestnut.species]).toEqual([
    26,
    9,
    "Gemeine Rosskastanie",
  ]);
  expect(
    stands[0].some((t) => t.position[0] === 297.23 && t.species === "Kaiser-Linde"),
  ).toBeTrue();
  expect(
    group.children.every((stand) =>
      stand.children.some((o) => o instanceof InstancedMesh && /crowns/i.test(o.name)),
    ),
  ).toBeTrue();
});

test("first and final stems meet their actual drawn ground without altering the surveyed crown height", () => {
  const cases = [
    [336.21, 250.92, 5.22],
    [344.21, 245.95, 5.22],
    [304.32, 204.49, 4.813],
    [504.25, -997.26, 5.3],
  ];
  for (const [x, z, ground] of cases) {
    const first = stands.flat().find((tree) => tree.position[0] === x && tree.position[2] === z)!;
    expect(first.position[1]).toBeCloseTo(ground, 3);
    const index = Number(first.id.slice(5));
    expect(published.trees[index].position).toEqual(first.position);
    expect((park.trees[index] as { h: number }).h).toBe(first.height_m);
  }
});

test("the full park owns the same trees exactly once, with repeatable municipal gap fusion", () => {
  expect(published.trees.length - park.trees.length).toBe(141);
  const fullTrees = decodeTrees(published.trees, published.tree_vocabulary);
  const byId = new Map(fullTrees.map((tree) => [tree.id, tree]));
  for (const tree of stands.flat()) expect(byId.get(tree.id)).toEqual(tree);
  expect(withMitteSurveyTreesV375(published)).toBe(published);
  const candidate = stands[2][0];
  const newer = {
    ...candidate,
    id: "updated-survey",
    position: [candidate.position[0] + 2.5, candidate.position[1], candidate.position[2]] as [
      number,
      number,
      number,
    ],
  };
  const merged = withMitteSurveyTreesV375({ ...park, trees: [...park.trees, newer] });
  expect(merged.trees.length).toBe(published.trees.length);
  expect(merged.trees.some((tree) => "id" in tree && tree.id === candidate.id)).toBeFalse();
});

test("native additions occupy clear, previously empty cells and preserve all existing voxel rows", () => {
  const completed = withMitteNativeTreesV375(voxel);
  const native = stands[2].filter((t) => t.nativeTreeBlock);
  expect(native.length).toBe(105);
  let appended = 0;
  completed.tree_rows!.forEach((row, i) => {
    const old = voxel.tree_rows![i];
    if (row === old) return;
    expect(row.slice(0, old.length)).toEqual(old);
    expect(new Set(row.map((t) => t[0])).size).toBe(row.length);
    appended += row.length - old.length;
  });
  expect(appended).toBe(native.length);
  expect(withMitteNativeTreesV375(completed).tree_rows).toEqual(completed.tree_rows);
});

test("early and complete pedestrian indices share source IDs; smooth and block trunks follow visible families", () => {
  let native = false;
  const environment: PedestrianEnvironment = {
    bounds: { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 },
    groundAt: () => 5,
    parkTreeSolidAt: createPedestrianParkTreeSolidTester(4, "mobile", () => native),
  };
  const tree = stands[2].find((tree) => {
    if (!tree.nativeTreeBlock) return false;
    const [cx, cz] = tree.nativeTreeBlock;
    return (
      minecraftVoxelTreeRetained(cx, cz, "mobile") &&
      Math.max(Math.abs(cx * 4 + 2 - tree.position[0]), Math.abs(cz * 4 + 2 - tree.position[2])) >
        1.6
    );
  })!;
  const blocked = (x: number, z: number) =>
    pedestrianPointIsBlocked(x, z, tree.position[1], environment.obstacles, environment);
  const [cx, cz] = tree.nativeTreeBlock!;
  const [x, , z] = tree.position;
  addFirstParkTreeObstacles(environment, [tree], tunnel);
  expect(blocked(x, z)).toBeTrue();
  expect(blocked(cx * 4 + 2, cz * 4 + 2)).toBeFalse();
  native = true;
  expect(blocked(x, z)).toBeFalse();
  expect(blocked(cx * 4 + 2, cz * 4 + 2)).toBeTrue();
  const count = environment.obstacles!.obstacleCount;
  addFirstParkTreeObstacles(environment, [tree], tunnel);
  addPedestrianParkObstacles(
    environment,
    {
      ...park,
      trees: [tree],
      paths: [],
      street_lights: [],
      shrub_patches: [],
      hedges: [],
      playgrounds: [],
      wall_traces: [],
    },
    tunnel,
  );
  expect(environment.obstacles!.obstacleCount).toBe(count);
  expect(environment.obstacles!.treeCount).toBe(1);
});

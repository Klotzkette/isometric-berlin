import { expect, test } from "bun:test";
import { BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from "three";
import parkJson from "../public/mesh/regierungsviertel/park-details.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";
import { admitChancelleryTreeBranchesV287, bakeChancelleryNativeTreeBranchesV287, bakeChancelleryTreeBranchesV287, CHANCELLERY_TREE_BRANCH_PROFILE_V287 as profile, createChancelleryTreeBranchesV287 } from "../src/ChancelleryTreesV287";
import { createParkDetails, createParkDetailsCooperative, decodeTrees, type ParkDetailsPayload, type ParkTree } from "../src/ParkDetails";
import { forEachVoxelTreeBlock, minecraftVoxelTreeRetained, type VoxelPayload, type VoxelTreeBlock } from "../src/terrainPayload";
import { disposeStaticAudit, staticGeometryAudit } from "./helpers/staticGeometryAudit";

const source = parkJson as unknown as ParkDetailsPayload;
const voxelSource = voxelJson as unknown as VoxelPayload;
const originals = (): ParkTree[] => JSON.parse(JSON.stringify(profile.trees.map(entry => entry.previousTree)));
const tuples = (): VoxelTreeBlock[] => JSON.parse(JSON.stringify(profile.trees.map(entry => entry.nativeParent)));
const payload = (trees: ParkTree[]): ParkDetailsPayload => ({ schema_version: 7, source: { attribution: "retained source", geometry_status: "test", name: "test" }, paths: [], playgrounds: [], street_lights: [], trees });
const fixture = (): VoxelPayload => ({ ...voxelSource, tree_rows: undefined, trees: tuples() });
const familyName = "Chancellery Forum five retained-tree low forks v287";

test("five exact delivered catalogue trees and exclusive native source parents agree with the frozen receipts", () => {
  const trees = decodeTrees(source.trees, source.tree_vocabulary);
  expect(admitChancelleryTreeBranchesV287(trees)).toBeTrue();
  expect(profile.trees).toHaveLength(5);
  for (const receipt of profile.trees) {
    const matches = trees.filter(tree => tree.id === receipt.previousTree.id);
    expect(matches).toEqual([receipt.previousTree]);
    const [ix, iz] = receipt.nativeParent;
    const parents = trees.filter(tree => Math.floor(tree.position[0] / 4) === ix && Math.floor(tree.position[2] / 4) === iz);
    expect(parents.map(tree => tree.id)).toEqual([receipt.previousTree.id]);
    const native: VoxelTreeBlock[] = [];
    forEachVoxelTreeBlock(voxelSource, (x, z, y, h) => { if (x === ix && z === iz) native.push([x, z, y, h]); });
    expect(native).toEqual([receipt.nativeParent]);
  }
});

test("drawn admission is a complete exact family; changed, missing, duplicate, accessor or unknown-key parents add nothing", () => {
  expect(admitChancelleryTreeBranchesV287(originals())).toBeTrue();
  for (let index = 0; index < profile.trees.length; index++) {
    const missing = originals(); missing.splice(index, 1);
    const moved = originals(); moved[index].position[0] += .001;
    const height = originals(); height[index].height_m += .001;
    const species = originals(); species[index].species = "other source species";
    const radius = originals(); radius[index].crown_radius_m += .001;
    const duplicate = [...originals(), originals()[index]];
    const extra = originals(); (extra[index] as any).newAttribute = "changed source";
    const accessor = originals(); Object.defineProperty(accessor[index], "variant", { get: () => profile.trees[index].previousTree.variant, enumerable: true });
    const differentIdSamePoint = [...originals(), { ...originals()[index], id: "foreign-same-point" }];
    for (const variant of [missing, moved, height, species, radius, duplicate, extra, accessor, differentIdSamePoint]) {
      expect(admitChancelleryTreeBranchesV287(variant)).toBeFalse();
      expect(bakeChancelleryTreeBranchesV287(variant)).toBeNull();
      expect(createChancelleryTreeBranchesV287(variant)).toBeNull();
    }
  }
  const foreign = { ...originals()[0], id: "unrelated", position: [1000, 5, 1000] as [number, number, number] };
  expect(admitChancelleryTreeBranchesV287([...originals(), foreign])).toBeTrue();
});

test("additive drawn limbs remain supported by each retained central trunk and entirely within its source-height/crown-radius envelope", () => {
  const trees = originals(), before = JSON.stringify(trees), baked = bakeChancelleryTreeBranchesV287(trees)!;
  expect(baked.metadata).toMatchObject({ treeCount: 5, memberCount: 50, originalGeometryRetained: true, native: false });
  expect(baked.matrices.byteLength + baked.colors.byteLength).toBe(3800);
  const box = new BoxGeometry(), matrix = new Matrix4(), vertex = new Vector3(), ends = [new Vector3(0, -.5, 0), new Vector3(0, .5, 0)];
  const connections: Vector3[][] = Array.from({ length: 5 }, () => []);
  for (let i = 0; i < 50; i++) {
    matrix.fromArray(baked.matrices, i * 16);
    const t = trees[baked.metadata.memberTreeIndices[i]], [x, y, z] = t.position;
    for (let j = 0; j < box.attributes.position.count; j++) {
      vertex.fromBufferAttribute(box.attributes.position, j).applyMatrix4(matrix);
      expect(Math.hypot(vertex.x - x, vertex.z - z)).toBeLessThan(t.crown_radius_m);
      expect(vertex.y).toBeGreaterThan(y + .5);
      expect(vertex.y).toBeLessThan(y + t.height_m);
    }
    const [a, b] = ends.map(end => end.clone().applyMatrix4(matrix));
    // Every branch starts either at the retained trunk axis or at an earlier
    // exact limb endpoint; there are no detached second trunks/tree bases.
    const connected = Math.hypot(a.x - x, a.z - z) < .0001 || connections[baked.metadata.memberTreeIndices[i]].some(point => point.distanceTo(a) < .0001);
    expect(connected).toBeTrue(); connections[baked.metadata.memberTreeIndices[i]].push(b);
  }
  expect(JSON.stringify(trees)).toBe(before); box.dispose();
});

test("native full/mobile follow the original filtered parent set and add only connected independent orthogonal branches", () => {
  for (const [detail, expectedTrees] of [["full", 3], ["mobile", 1]] as const) {
    const visible = tuples().filter(tuple => minecraftVoxelTreeRetained(tuple[0], tuple[1], detail));
    const baked = bakeChancelleryNativeTreeBranchesV287(voxelSource, visible)!;
    expect(baked.metadata.treeCount).toBe(expectedTrees);
    expect(baked.metadata.memberCount).toBe(expectedTrees * 16);
    expect(baked.metadata.nativeParents).toEqual(profile.trees.filter(receipt => visible.some(tuple => tuple[0] === receipt.nativeParent[0] && tuple[1] === receipt.nativeParent[1])).map(receipt => [...receipt.nativeParent]));
    expect(baked.metadata.memberCount).toBeLessThan(200);
    for (let i = 0; i < baked.metadata.memberCount; i++) {
      const matrix = Array.from(baked.matrices.slice(i * 16, i * 16 + 16));
      for (const offDiagonal of [1, 2, 3, 4, 6, 7, 8, 9, 11]) expect(matrix[offDiagonal]).toBe(0);
      expect(matrix.every(Number.isFinite)).toBeTrue();
      const receipt = profile.trees[baked.metadata.memberTreeIndices[i]], parent = receipt.nativeParent;
      const x = (parent[0] + .5) * 4, z = (parent[1] + .5) * 4, y = parent[2] / 10;
      expect(Math.hypot(Math.abs(matrix[12] - x) + matrix[0] / 2, Math.abs(matrix[14] - z) + matrix[10] / 2)).toBeLessThan(receipt.previousTree.crown_radius_m);
      expect(matrix[13] - matrix[5] / 2).toBeGreaterThan(y);
      expect(matrix[13] + matrix[5] / 2).toBeLessThan(y + parent[3] / 10);
    }
  }
  expect(bakeChancelleryNativeTreeBranchesV287(voxelSource, [])).toBeNull();
  expect(bakeChancelleryNativeTreeBranchesV287(voxelSource, tuples())!.metadata.memberCount).toBe(80);
});

test("native complete source-family admission rejects changed/missing/duplicate owners and never restores filtered trees", () => {
  const all = tuples(), before = JSON.stringify(all);
  for (let index = 0; index < 5; index++) {
    const changed = fixture(); changed.trees![index][3] += 1;
    const missing = fixture(); missing.trees!.splice(index, 1);
    const duplicate = fixture(); duplicate.trees!.push([...all[index]] as VoxelTreeBlock);
    for (const bad of [changed, missing, duplicate]) expect(bakeChancelleryNativeTreeBranchesV287(bad, all)).toBeNull();
    const badVisible = tuples(); badVisible[index][2] += 1;
    expect(bakeChancelleryNativeTreeBranchesV287(fixture(), badVisible)).toBeNull();
  }
  expect(bakeChancelleryNativeTreeBranchesV287({ ...fixture(), cell_m: 2 }, all)).toBeNull();
  expect(bakeChancelleryNativeTreeBranchesV287(fixture(), [...all, all[0]])).toBeNull();
  expect(bakeChancelleryNativeTreeBranchesV287(fixture(), [all[0]])!.metadata.sourceGisIds).toEqual([profile.trees[0].gisId]);
  expect(JSON.stringify(all)).toBe(before);
});

test("ParkDetails appends equal full/touch forks while retaining every original tree and unrelated geometry byte", () => {
  const trees = originals(), originalBytes = JSON.stringify(trees);
  const active = createParkDetails(payload(trees));
  const touch = createParkDetails(payload(originals()), { detailProfile: "mobile" });
  const baselineTrees = originals(); (baselineTrees[0] as any).guardOnlyExtra = true;
  const baseline = createParkDetails(payload(baselineTrees));
  const detail = active.getObjectByName(familyName)!;
  expect(detail).toBeDefined();
  expect(active.userData.treeCount).toBe(5); expect(active.userData.genericTreeCount).toBe(5);
  expect(staticGeometryAudit(active)).toEqual(staticGeometryAudit(touch));
  expect(staticGeometryAudit(detail).budget).toMatchObject({ instances: 50, draws: 1 });
  expect(staticGeometryAudit(detail).budget.bytes).toBeLessThan(5000);
  detail.traverse(object => {
    expect(object.matrixAutoUpdate).toBeFalse();
    if (object instanceof Mesh) {
      expect(object.geometry.getAttribute("uv")).toBeUndefined();
      expect((object.material as MeshStandardMaterial).map).toBeNull();
      if (object instanceof InstancedMesh) expect(Array.from(object.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
    }
  });
  active.remove(detail);
  expect(staticGeometryAudit(active)).toEqual(staticGeometryAudit(baseline));
  expect(JSON.stringify(trees)).toBe(originalBytes);
  disposeStaticAudit(detail); disposeStaticAudit(active); disposeStaticAudit(touch); disposeStaticAudit(baseline);
});

test("tunnel-filtered owners cannot be revived by the five-tree branch adapter", () => {
  const tree = originals()[0], [x, y, z] = tree.position;
  const root = createParkDetails(payload(originals()), { tunnel: { clear_height_m: 5, clear_width_each_direction_m: 2, points: [[x, y, z - 12], [x, y, z + 12]], portal_approaches: { minna_cauer: { geometry_status: "test exact filtered tree", label: "test", structure: "open_cut", carriageways: [{ id: "test", lane_count: 1, osm_way_ids: ["test"], points: [[x, y, z - 12], [x, y, z + 12]], widths_m: [2, 2] }] } } } });
  expect(root.userData.suppressedTunnelApproachTreeCount).toBe(1);
  expect(root.userData.treeCount).toBe(4);
  expect(root.getObjectByName(familyName)).toBeUndefined(); disposeStaticAudit(root);
});

test("cooperative ParkDetails only publishes the complete bounded additive five-tree family", async () => {
  let unpublished: ReturnType<typeof createParkDetails> | undefined, observed = 0;
  const root = await createParkDetailsCooperative(payload(originals()), {}, { budgetMs: 0, isCancelled: () => false, onRoot: value => { unpublished = value; }, yieldTask: async () => {
    const detail = unpublished?.getObjectByName(familyName); if (!detail) return;
    observed++; expect(detail.userData).toMatchObject({ treeCount: 5, memberCount: 50 });
    expect((detail.children[0] as InstancedMesh).count).toBe(50);
    expect(unpublished!.userData.treeCount).toBe(5);
  } });
  expect(observed).toBeGreaterThan(0);
  const sync = createParkDetails(payload(originals()));
  expect(staticGeometryAudit(root)).toEqual(staticGeometryAudit(sync)); disposeStaticAudit(root); disposeStaticAudit(sync);
});

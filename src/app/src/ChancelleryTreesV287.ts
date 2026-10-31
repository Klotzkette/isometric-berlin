import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { ParkTree } from "./ParkDetails";
import type { VoxelPayload, VoxelTreeBlock } from "./terrainPayload";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Vec = [number, number, number];
/** These delivered viewer tuples are rounded source coordinates, not new tree
 * placements. GIS identities were checked against official_details.gpkg/trees.
 * Crown diameters are absent in that catalogue; the retained viewer radii are
 * existing generation fallbacks. Individual forks are photo-guided estimates. */
export const CHANCELLERY_TREE_BRANCH_PROFILE_V287 = {
  source: "Geoportal Berlin Baumbestand / official_details.gpkg, trees",
  licence: "dl-de/zero-2-0",
  evidence: "chancellery-owner-photos-v287",
  geometryStatus: "Exact retained catalogue positions, species, measured heights and circumference-derived trunk radii; existing crown-radius fallbacks retained. Added low forks, their count, directions and sections are photo-guided display estimates, not measured individual branches.",
  originalGeometryRetained: true,
  addedTreeBases: 0,
  addedCrowns: 0,
  fullStaticDetailOnTouch: true,
  textureFree: true,
  nativeCellM: 4,
  maxDrawnInstances: 60,
  maxNativeInstances: 100,
  trees: [
    { gisId: "00008100_0015baf1", botanical: "Pterocarya fraxinifolia", circumferenceCm: 403,
      nativeParent: [-5, -41, 52, 80],
      previousTree: { catalogue: "anlagenbaum", crown_radius_m: 2.17, height_m: 7, id: "tree-13058", leaf_type: null, position: [-19.06, 5.168, -162.91], source: "berlin_official", species: "Flügelnuss", tree_group: "Laubbäume", trunk_radius_m: .641, variant: 2 } },
    { gisId: "00008100_0015baf5", botanical: "Sophora japonica", circumferenceCm: 91,
      nativeParent: [-4, -33, 51, 80],
      previousTree: { catalogue: "anlagenbaum", crown_radius_m: 2.4, height_m: 8, id: "tree-13062", leaf_type: null, position: [-14.93, 5.098, -130.86], source: "berlin_official", species: "Japanischer Schnurbaum", tree_group: "Laubbäume", trunk_radius_m: .145, variant: 0 } },
    { gisId: "00008100_0015baf6", botanical: "Sophora japonica", circumferenceCm: 132,
      nativeParent: [-7, -32, 51, 120],
      previousTree: { catalogue: "anlagenbaum", crown_radius_m: 2.61, height_m: 9, id: "tree-13063", leaf_type: null, position: [-24.18, 5.092, -125.18], source: "berlin_official", species: "Japanischer Schnurbaum", tree_group: "Laubbäume", trunk_radius_m: .21, variant: 2 } },
    { gisId: "00008100_0015b7ef", botanical: "Sophora japonica", circumferenceCm: 100,
      nativeParent: [22, -31, 51, 120],
      previousTree: { catalogue: "anlagenbaum", crown_radius_m: 2.7, height_m: 9, id: "tree-12809", leaf_type: null, position: [90.13, 5.11, -122.28], source: "berlin_official", species: "Japanischer Schnurbaum", tree_group: "Laubbäume", trunk_radius_m: .159, variant: 1 } },
    { gisId: "00008100_0015b7f1", botanical: "Sophora japonica", circumferenceCm: 79,
      nativeParent: [24, -30, 51, 80],
      previousTree: { catalogue: "anlagenbaum", crown_radius_m: 2.56, height_m: 8, id: "tree-12810", leaf_type: null, position: [96.93, 5.122, -116.42], source: "berlin_official", species: "Japanischer Schnurbaum", tree_group: "Laubbäume", trunk_radius_m: .126, variant: 0 } },
  ],
} as const;
const PROFILE = CHANCELLERY_TREE_BRANCH_PROFILE_V287;
type Receipt = typeof PROFILE.trees[number];
const keys = Object.keys(PROFILE.trees[0].previousTree);
const bark = [0x7b6549, 0x836d50, 0x705b43];

function data(value: object, key: PropertyKey): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor && descriptor.enumerable ? descriptor.value : undefined;
}
function exactArray(value: unknown, expected: readonly number[]): boolean {
  return Array.isArray(value) && value.length === expected.length &&
    Reflect.ownKeys(value).length === expected.length + 1 &&
    expected.every((coordinate, index) => data(value, String(index)) === coordinate);
}
function sameTree(value: object, receipt: Receipt): boolean {
  const ownKeys = Reflect.ownKeys(value), expected = receipt.previousTree;
  return ownKeys.length === keys.length && ownKeys.every(key => typeof key === "string" && keys.includes(key)) &&
    keys.every(key => key === "position" ? exactArray(data(value, key), expected.position) :
      data(value, key) === expected[key as keyof typeof expected]);
}
/** Complete five-parent admission after the host's construction/tunnel filters.
 * Missing/changed/duplicate records add nothing; all original trees always stay. */
export function admitChancelleryTreeBranchesV287(trees: readonly unknown[]): boolean {
  const found = new Set<string>();
  try {
    for (const value of trees) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const id = data(value, "id"), position = data(value, "position");
      const receipt = PROFILE.trees.find(entry => entry.previousTree.id === id ||
        (Array.isArray(position) && data(position, "0") === entry.previousTree.position[0] && data(position, "2") === entry.previousTree.position[2]));
      if (!receipt) continue;
      if (found.has(receipt.gisId) || !sameTree(value, receipt)) return false;
      found.add(receipt.gisId);
    }
  } catch { return false; }
  return found.size === PROFILE.trees.length;
}

type Member = { a: Vec; b: Vec; width: number; color: number; treeIndex: number };
type Box = { position: Vec; size: Vec; color: number; treeIndex: number };
function drawnMembers(): Member[] {
  const result: Member[] = [];
  PROFILE.trees.forEach((receipt, treeIndex) => {
    const t = receipt.previousTree, [x, y, z] = t.position, r = t.crown_radius_m, h = t.height_m;
    const yaw = t.variant * Math.PI * 2 / 7 + .23, wingnut = treeIndex === 0;
    const at = (radius: number, level: number, angle: number): Vec => [x + Math.cos(angle) * radius, y + level, z + Math.sin(angle) * radius];
    // Four supported low forks grow from the retained central trunk. No new
    // base, crown, height shift or camera-dependent visibility clearing occurs.
    for (let arm = 0; arm < 4; arm++) {
      const angle = yaw + arm * Math.PI / 2 + (arm % 2 ? .18 : -.12);
      const a = at(0, h * (wingnut ? .14 : .21), angle);
      const b = at(r * (.46 + .035 * (arm % 2)), h * (.40 + .016 * (arm % 2)), angle);
      const c = at(r * (.70 + .035 * (arm % 2)), h * (.60 + .018 * (arm % 2)), angle + (arm % 2 ? .13 : -.12));
      const width = wingnut ? .32 : Math.max(.13, t.trunk_radius_m * .9);
      result.push({ a, b, width, color: bark[t.variant], treeIndex });
      result.push({ a: b, b: c, width: width * .72, color: bark[t.variant], treeIndex });
      if (arm % 2 === 0) result.push({ a: b, b: at(r * .64, h * .56, angle + .36), width: width * .5, color: bark[t.variant], treeIndex });
    }
  });
  return result;
}
function bake(members: Member[] | Box[], native: boolean, retained: readonly Receipt[]) {
  if (members.length > (native ? PROFILE.maxNativeInstances : PROFILE.maxDrawnInstances)) throw new Error("Chancellery fork allowance exceeded");
  const matrices = new Float32Array(members.length * 16), colors = new Float32Array(members.length * 3);
  const matrix = new Matrix4(), quaternion = new Quaternion(), up = new Vector3(0, 1, 0), color = new Color();
  members.forEach((member, index) => {
    if ("a" in member) {
      const a = new Vector3(...member.a), b = new Vector3(...member.b), direction = b.clone().sub(a);
      quaternion.setFromUnitVectors(up, direction.clone().normalize());
      matrix.compose(a.add(b).multiplyScalar(.5), quaternion, new Vector3(member.width, direction.length(), member.width));
    } else matrix.makeScale(...member.size).setPosition(...member.position);
    matrix.toArray(matrices, index * 16); color.setHex(member.color).toArray(colors, index * 3);
  });
  return { matrices, colors, metadata: {
    profile: PROFILE, native, keepInMinecraft: native, blockNative: native,
    fullStaticDetailOnTouch: true, textureFree: true, originalGeometryRetained: true,
    treeCount: retained.length, memberCount: members.length,
    sourceGisIds: retained.map(receipt => receipt.gisId),
    catalogueAnchors: retained.map(receipt => [...receipt.previousTree.position]),
    nativeParents: native ? retained.map(receipt => [...receipt.nativeParent]) : [],
    memberTreeIndices: members.map(member => member.treeIndex),
    nativePositionStatus: native ? "Branches connect to retained voxel-cell trunk centres, not additional precise-position trunks" : undefined,
  } };
}

/** Unit-box matrices/linear colours can be appended to an existing static batch.
 * This function neither edits its source inventory nor allocates GPU resources. */
export function bakeChancelleryTreeBranchesV287(trees: readonly unknown[]) {
  return admitChancelleryTreeBranchesV287(trees) ? bake(drawnMembers(), false, PROFILE.trees) : null;
}

/** Validate every original source cell before intersecting it with the host's
 * already filtered/thinned parents. The five audited cells have one exclusive
 * original catalogue parent each. Foreign/changed/duplicate cells fail closed;
 * absent visible parents remain absent, including existing mobile thinning. */
export function bakeChancelleryNativeTreeBranchesV287(payload: VoxelPayload, visibleParents: readonly VoxelTreeBlock[]) {
  if (payload.cell_m !== PROFILE.nativeCellM) return null;
  const found = new Set<string>(), visible = new Set<string>();
  const check = (tuple: readonly number[], seen: Set<string>): boolean => {
    const receipt = PROFILE.trees.find(entry => entry.nativeParent[0] === tuple[0] && entry.nativeParent[1] === tuple[1]);
    if (!receipt) return true;
    if (seen.has(receipt.gisId) || !exactArray(tuple, receipt.nativeParent)) return false;
    seen.add(receipt.gisId); return true;
  };
  try {
    if (payload.tree_rows) {
      for (let z = 0; z < payload.tree_rows.length; z++) for (const row of payload.tree_rows[z]) {
        if (!check([payload.grid.min_x_idx + row[0], payload.grid.min_z_idx + z, row[1], row[2]], found)) return null;
      }
    } else for (const tuple of payload.trees ?? []) if (!check(tuple, found)) return null;
    if (found.size !== PROFILE.trees.length) return null;
    for (const tuple of visibleParents) if (!check(tuple, visible)) return null;
  } catch { return null; }
  const retained = PROFILE.trees.filter(receipt => visible.has(receipt.gisId));
  if (!retained.length) return null;
  const members: Box[] = [];
  for (const receipt of retained) {
    const treeIndex = PROFILE.trees.indexOf(receipt), [ix, iz, y0dm, hdm] = receipt.nativeParent;
    const x = (ix + .5) * 4, z = (iz + .5) * 4, y = y0dm / 10;
    const trunkHeight = Math.max(2, Math.max(4, hdm / 10) - 6), run = receipt.previousTree.crown_radius_m * .70;
    // Independent cardinal stair limbs join the existing broad block trunk
    // below its unchanged crown; no rotated smooth member is reused here.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let step = 0; step < 4; step++) {
      const a = step / 4, b = (step + 1) / 4, t = (a + b) / 2;
      const low = trunkHeight * (.34 + .49 * a), high = trunkHeight * (.34 + .49 * b);
      members.push({ position: [x + dx * run * t, y + (low + high) / 2, z + dz * run * t],
        size: [Math.abs(dx) * run / 4 + .30, high - low + .30, Math.abs(dz) * run / 4 + .30],
        color: bark[receipt.previousTree.variant], treeIndex });
    }
  }
  return bake(members, true, retained);
}

/** Compact drawn host adapter. Existing cylinder/crown batches remain byte for
 * byte intact; only one bounded texture-free unit-box draw is appended. */
export function createChancelleryTreeBranchesV287(trees: readonly ParkTree[]): Group | null {
  const baked = bakeChancelleryTreeBranchesV287(trees);
  if (!baked) return null;
  const root = new Group(); root.name = "Chancellery Forum five retained-tree low forks v287";
  root.userData = baked.metadata;
  const geometry = new BoxGeometry(); geometry.deleteAttribute("uv");
  const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({ color: 0xffffff, roughness: .98 }), 0);
  mesh.count = baked.colors.length / 3;
  mesh.instanceMatrix = new InstancedBufferAttribute(baked.matrices, 16);
  mesh.instanceColor = new InstancedBufferAttribute(baked.colors, 3);
  mesh.name = "Photo-guided low forks on retained catalogue trunks";
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData = { textureFree: true, fullStaticDetailOnTouch: true, originalGeometryRetained: true };
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
  freezeStaticSceneTransforms(root); return root;
}

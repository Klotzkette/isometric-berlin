import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4 } from "three";
import {
  createParkTreeStand,
  decodeTrees,
  type CompactParkTree,
  type ParkDetailsPayload,
  type ParkTree,
  type TreeVocabulary,
} from "./ParkDetails";
import type { TunnelPortalPayload } from "./TunnelPortals";
import type { VoxelPayload, VoxelTreeBlock } from "./terrainPayload";
import data from "./data/mitteTreesV375.json";

type FirstTree = CompactParkTree & { y?: number; firstY?: number };

const source = data as unknown as {
  vocabulary: TreeVocabulary;
  focus: FirstTree[][];
  additions: CompactParkTree[];
  nativeBlocks: Record<string, VoxelTreeBlock>;
};

export function matchesMitteTreeSceneV375(scene: {
  park_details?: { file: string };
  landmarks: { name: string; world: number[] }[];
}): boolean {
  const gate = scene.landmarks.find((landmark) => landmark.name === "Brandenburger Tor");
  return (
    scene.park_details?.file === "park-details.json" &&
    !!gate &&
    Math.abs(gate.world[0] - 417.9) < 1 &&
    Math.abs(gate.world[2] - 300.45) < 1
  );
}

function surveyedAdditions(): ParkTree[] {
  return decodeTrees(source.additions, source.vocabulary).map((tree) => ({
    ...tree,
    drawnOnly: true,
    nativeTreeBlock: source.nativeBlocks[tree.id],
  }));
}

/** Apply measured surface contact only to the original source point and datum. */
function groundedTree<T extends CompactParkTree | ParkTree>(tree: T, anchor: FirstTree): T {
  const [x, y, z] = tree.position;
  if (
    anchor.y === undefined ||
    anchor.y === y ||
    anchor.position[0] !== x ||
    anchor.position[1] !== y ||
    anchor.position[2] !== z
  )
    return tree;
  return { ...tree, position: [x, anchor.y, z] };
}

export function earlyMitteTreeStandsV375(): ParkTree[][] {
  return [
    ...source.focus.map((stand) =>
      decodeTrees(
        stand.map((tree) => groundedTree(tree, tree)),
        source.vocabulary,
      ),
    ),
    surveyedAdditions(),
  ];
}

/** Preserve all source rows and their ordering, adding solely previously empty admissible cells. */
export function withMitteNativeTreesV375(payload: VoxelPayload): VoxelPayload {
  if (!payload.tree_rows || payload.cell_m !== 4) return payload;
  const rows = [...payload.tree_rows];
  for (const [cx, cz, yDm, heightDm] of Object.values(source.nativeBlocks)) {
    const x = cx - payload.grid.min_x_idx;
    const z = cz - payload.grid.min_z_idx;
    if (x < 0 || x >= payload.grid.cols || z < 0 || z >= rows.length) continue;
    if (rows[z].some(([offset]) => offset === x)) continue;
    if (rows[z] === payload.tree_rows[z]) rows[z] = [...rows[z]];
    rows[z].push([x, yDm, heightDm]);
  }
  return { ...payload, tree_rows: rows };
}

/** A later lawn or path can sit above the arrival slab. Keep only its exposed root
 * length visible between stages, with the original trunk top, bark and crown intact. */
function addFirstGroundContacts(stand: Group, anchors: FirstTree[]): void {
  const contacts = new Map(
    anchors
      .filter((t) => t.firstY !== undefined)
      .map((t) => [`${t.position[0]},${t.position[2]}`, t.firstY!]),
  );
  if (!contacts.size) return;
  const stem = stand.children.find(
    (mesh) => mesh instanceof InstancedMesh && mesh.name === "OSM instanced granular tree trunks",
  ) as InstancedMesh | undefined;
  if (!stem) return;
  // The authored seven-sided cylinder has a bottom radius of 1.18. Open sides
  // meet its existing bottom without a second horizontal cap or depth overlap.
  const roots = new InstancedMesh(
    new CylinderGeometry(1.18, 1.18, 1, 7, 1, true),
    stem.material,
    contacts.size,
  );
  roots.name = "Source tree root contact with arrival terrain";
  roots.receiveShadow = stem.receiveShadow;
  const m = new Matrix4();
  const color = new Color();
  let count = 0;
  for (let i = 0; i < stem.count; i++) {
    stem.getMatrixAt(i, m);
    const e = m.elements;
    const x = Math.round(e[12] * 100) / 100;
    const z = Math.round(e[14] * 100) / 100;
    const bottom = contacts.get(`${x},${z}`);
    if (bottom === undefined) continue;
    const top = e[13] - e[5] / 2;
    if (top <= bottom) continue;
    e[5] = top - bottom;
    e[13] = (top + bottom) / 2;
    roots.setMatrixAt(count, m);
    stem.getColorAt(i, color);
    roots.setColorAt(count++, color);
  }
  roots.count = count;
  roots.computeBoundingBox();
  roots.computeBoundingSphere();
  roots.matrixAutoUpdate = false;
  stand.add(roots);
}

/** Publish real full-quality source crowns with the first city, ahead of the large park job. */
export function createEarlyMitteTreesV375(
  tunnel: TunnelPortalPayload,
  settledDetail: boolean,
): Group {
  const root = new Group();
  root.name = "Mitte source trees awaiting the complete park";
  const names = [
    "Östlicher Großer Tiergarten",
    "Robert-Koch-Platz",
    "Weitere vermessene Bäume in Mitte",
  ];
  const stands = earlyMitteTreeStandsV375();
  for (let i = 0; i < stands.length; i++) {
    const group = createParkTreeStand(stands[i], tunnel, settledDetail);
    if (i < source.focus.length) addFirstGroundContacts(group, source.focus[i]);
    group.name = names[i];
    root.add(group);
  }
  root.userData.treeCount = root.children.reduce(
    (count, stand) => count + stand.userData.treeCount,
    0,
  );
  return root;
}

/** Existing focus trees already belong to the full park. Only add measured, previously absent trees. */
export function withMitteSurveyTreesV375(park: ParkDetailsPayload): ParkDetailsPayload {
  const additions = surveyedAdditions();
  const grid = new Map<string, typeof additions>();
  const cell = (n: number) => Math.floor(n / 4);
  for (const tree of additions) {
    const [x, , z] = tree.position;
    const key = `${cell(x)},${cell(z)}`;
    const bucket = grid.get(key) ?? [];
    bucket.push(tree);
    grid.set(key, bucket);
  }
  const represented = new Set<string>();
  for (const tree of park.trees) {
    const [x, , z] = tree.position;
    // Restrict the lookup to the municipal survey; keep the normal city scan cheap.
    if (x < -603 || x > 1303 || z < -1403 || z > 703) continue;
    for (let cx = cell(x - 3); cx <= cell(x + 3); cx++) {
      for (let cz = cell(z - 3); cz <= cell(z + 3); cz++) {
        for (const candidate of grid.get(`${cx},${cz}`) ?? []) {
          if (Math.hypot(x - candidate.position[0], z - candidate.position[2]) <= 3) {
            represented.add(candidate.id);
          }
        }
      }
    }
  }
  let rows = park.trees;
  for (const stand of source.focus) {
    for (const anchor of stand) {
      const index = Number(anchor.i?.slice(5));
      const old = rows[index];
      if (!old) continue;
      const grounded = groundedTree(old, anchor);
      if (old === grounded) continue;
      if (rows === park.trees) rows = [...park.trees];
      rows[index] = grounded;
    }
  }
  const absent = additions.filter((tree) => !represented.has(tree.id));
  if (!absent.length && rows === park.trees) return park;
  return { ...park, trees: absent.length ? [...rows, ...absent] : rows };
}

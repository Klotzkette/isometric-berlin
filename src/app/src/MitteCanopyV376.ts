import type { Group } from "three";
import packet from "./data/mitteCanopyV376.json";
import {
  createEarlyMitteTreesV375, earlyMitteTreeStandsV375,
  withMitteNativeTreesV375, withMitteSurveyTreesV375,
} from "./MitteTreesV375";
import { createParkTreeStand, decodeTrees, type ParkTree, type ParkDetailsPayload } from "./ParkDetails";
import type { SurveyedNativeCrown, VoxelPayload, VoxelTreeBlock } from "./terrainPayload";
import type { TunnelPortalPayload } from "./TunnelPortals";

const [chestnutRows, ...parkRows] = packet.groups;
const names = ["Invalidenpark", "Geschichtspark Moabit", "Agnes-Sorma-Park"];
const chestnuts = new Map<string, SurveyedNativeCrown>();
for (const [i,x,z,stemRadius,height,diameter] of chestnutRows) {
  chestnuts.set(`tree-${i}`, { x,z,stemRadius,height,diameter });
}
const anchors = new Map<number, number[]>();
for (const rows of parkRows) for (const row of rows) anchors.set(row[0], row);
const blocks = new Map<string, VoxelTreeBlock>();
const cells = new Map<number, Set<number>>();
for (const [i, x, z, y, h] of packet.native) {
  blocks.set(`tree-${i}`, [x, z, y, h]);
  const row = cells.get(z) ?? new Set<number>();
  row.add(x);
  cells.set(z, row);
}

export function retainMitteCanopyCellV376(x: number, z: number): boolean {
  return cells.get(z)?.has(x) === true;
}

/** A source tree gets a separate collision shape for its own confirmed native trunk. */
function withBlock(tree: ParkTree): ParkTree {
  const block = blocks.get(tree.id);
  if (!block) return tree;
  return { ...tree, drawnOnly: true, nativeTreeBlock: block, nativeCrown: chestnuts.get(tree.id) };
}

function arrivalParkStands(): ParkTree[][] {
  const words = packet.vocabulary;
  return parkRows.map(rows => rows.map(([i,x,y,z,h,cr,tr,v,c,sp,g,lt]): ParkTree => ({
    id: `tree-${i}`, position: [x,y,z], height_m: h, crown_radius_m: cr, trunk_radius_m: tr,
    variant: v, source: "berlin_official", catalogue: words.catalogue[c],
    species: words.species[sp], tree_group: words.tree_group[g], leaf_type: words.leaf_type[lt],
  })));
}

export function earlyCanopiesV376(): ParkTree[][] {
  return [...earlyMitteTreeStandsV375(), ...arrivalParkStands()].map(stand => stand.map(withBlock));
}

export function createMitteCanopiesV376(tunnel: TunnelPortalPayload, settled: boolean): Group {
  const focus = earlyMitteTreeStandsV375().map(stand => stand.map(withBlock));
  const root = createEarlyMitteTreesV375(tunnel, settled, focus);
  arrivalParkStands().forEach((trees, i) => {
    const stand = createParkTreeStand(trees, tunnel, false, true);
    stand.name = names[i];
    root.add(stand);
    root.userData.treeCount += stand.userData.treeCount;
  });
  return root;
}

export function isKochChestnutV376(tree: ParkTree): boolean {
  const fit = chestnuts.get(tree.id);
  return !!fit && tree.species === "Gemeine Rosskastanie" &&
    fit.x === tree.position[0] && fit.z === tree.position[2];
}

export function withCanopyParkV376(payload: ParkDetailsPayload): ParkDetailsPayload {
  const park = withMitteSurveyTreesV375(payload);
  let trees = park.trees;
  for (const [id, block] of blocks) {
    const index = Number(id.slice(5));
    const original = trees[index];
    const row = anchors.get(index);
    const fit = chestnuts.get(id);
    if (!original || original.position[0] !== (fit?.x ?? row?.[1]) ||
        original.position[2] !== (fit?.z ?? row?.[3])) continue;
    if ("nativeTreeBlock" in original && original.nativeTreeBlock === block) continue;
    const actual = "h" in original
      ? decodeTrees([{ ...original, i: id }], park.tree_vocabulary)[0]
      : original;
    if (actual.id !== id) continue;
    if (trees === park.trees) trees = trees.slice();
    trees[index] = withBlock(actual);
  }
  return trees === park.trees ? park : { ...park, trees };
}

export function withCanopyVoxelsV376(payload: VoxelPayload): VoxelPayload {
  const result = withMitteNativeTreesV375(payload);
  if (payload.cell_m !== 4 || !result.tree_rows) return result;
  // Verify the original native datum and height as well as the cell before
  // enabling an exception to the normal city-wide density policy.
  const confirmed = new Map<number, Map<number, SurveyedNativeCrown | undefined>>();
  for (const [id, [cx,cz,y,h]] of blocks) {
    const ox = cx - result.grid.min_x_idx;
    const row = result.tree_rows[cz - result.grid.min_z_idx];
    if (!row?.some(([x, base, height]) => x === ox && base === y && height === h)) continue;
    const admitted = confirmed.get(cz) ?? new Map();
    admitted.set(cx, chestnuts.get(id));
    confirmed.set(cz, admitted);
  }
  return {
    ...result,
    retainSurveyTree: (x,z) => confirmed.get(z)?.has(x) === true,
    surveyedNativeCrown: (x,z) => confirmed.get(z)?.get(x),
  };
}

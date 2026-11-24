import type { Group } from "three";
import { createParkTreeStand, type ParkDetailsPayload, type ParkTree } from "./ParkDetails";
import type { TunnelPortalPayload } from "./TunnelPortals";
import type { SurveyedNativeCrown, VoxelPayload, VoxelTreeBlock } from "./terrainPayload";
import * as prior from "./MitteCanopyV376";
import data from "./data/lindenFrontTreesV383.json";

interface RegisteredTree {
  grove: boolean;
  index: number;
  before: [number,number,number];
  block: VoxelTreeBlock;
  tree: ParkTree;
}

let avenue: RegisteredTree[] | undefined;
function trees(): RegisteredTree[] {
  return avenue ??= data.rows.map(([index,oldX,oldZ,base,ground,heightDm,x,z,height,diameter,girth,species,variant,inGrove]) => {
    const crown: SurveyedNativeCrown = { x:x/100,z:z/100,height,diameter,stemRadius:girth/(200*Math.PI) };
    const block: VoxelTreeBlock = [Math.floor(oldX/400),Math.floor(oldZ/400),ground,heightDm];
    return {index, grove:inGrove===1, before:[oldX/100, base/1000, oldZ/100], block, tree:{
      id:`tree-${index}`, position:[crown.x,base/1000,crown.z], source:"berlin_official",catalogue:inGrove ? "anlagenbaum" : "strassenbaum",
      species:data.species[species], tree_group:"Laubbäume",leaf_type:"broadleaved",variant,
      trunk_radius_m:crown.stemRadius, height_m:height,crown_radius_m:diameter/2,
      drawnOnly:true,nativeTreeBlock:block,nativeCrown:crown,
    }};
  });
}

let cells: Map<number,Set<number>> | undefined;
function lindenCell(x:number,z:number) {
  if (x<130 || x>420 || z<24 || z>80) return false;
  if (!cells) {
    cells = new Map();
    for (const {block:[cx,cz]} of trees()) {
      const row=cells.get(cz);
      if (row) row.add(cx); else cells.set(cz,new Set([cx]));
    }
  }
  return cells.get(z)?.has(x) === true;
}

export function retainMitteCanopyCellV376(x:number,z:number): boolean {
  return prior.retainMitteCanopyCellV376(x,z) || lindenCell(x,z);
}

export function earlyCanopiesV376(): ParkTree[][] {
  return [...prior.earlyCanopiesV376(), trees().filter(v=>!v.grove).map(v=>v.tree), trees().filter(v=>v.grove).map(v=>v.tree)];
}

export function createMitteCanopiesV376(tunnel:TunnelPortalPayload, settled:boolean): Group {
  const root=prior.createMitteCanopiesV376(tunnel,settled);
  // Short independently culled blocks keep a distant stretch from forcing a whole boulevard draw.
  const blocks=new Map<number, ParkTree[]>();
  for (const {tree} of trees()) {
    const key=Math.floor(tree.position[0]/240), block=blocks.get(key);
    if (block) block.push(tree); else blocks.set(key,[tree]);
  }
  for (const block of blocks.values()) {
    const stand=createParkTreeStand(block,tunnel,false,true);
    stand.name=block[0].catalogue==="anlagenbaum" ? "Neue Wache · Kastanienwäldchen" : "Unter den Linden · kartierte Alleebäume";
    root.add(stand);
    root.userData.treeCount+=stand.userData.treeCount;
  }
  return root;
}

export function withCanopyParkV376(payload:ParkDetailsPayload): ParkDetailsPayload {
  const park=prior.withCanopyParkV376(payload);
  let output=park.trees;
  for (const {index,before,tree} of trees()) {
    const old=output[index];
    if (!old || old===tree || old.position.some((v,i)=>v!==before[i])) continue;
    const previousId = "h" in old ? old.i : old.id;
    if (previousId !== undefined && previousId !== tree.id) continue;
    if (output===park.trees) output=output.slice();
    output[index]=tree;
  }
  return output===park.trees ? park : {...park,trees:output};
}

export function withCanopyVoxelsV376(payload:VoxelPayload): VoxelPayload {
  const result=prior.withCanopyVoxelsV376(payload);
  if (!result.tree_rows || result.cell_m!==4) return result;
  const confirmed=new Map<number,Map<number,SurveyedNativeCrown>>();
  for (const {block:[cx,cz,y,h],tree} of trees()) {
    const matches=result.tree_rows[cz-result.grid.min_z_idx]?.some(([x,base,high])=>
      x+result.grid.min_x_idx===cx && base===y && high===h);
    if (!matches) continue;
    const row=confirmed.get(cz) ?? new Map<number,SurveyedNativeCrown>();
    row.set(cx,tree.nativeCrown!);
    confirmed.set(cz,row);
  }
  return {...result,
    retainSurveyTree:(x,z)=>confirmed.get(z)?.has(x)===true || result.retainSurveyTree?.(x,z)===true,
    surveyedNativeCrown:(x,z)=>confirmed.get(z)?.get(x) ?? result.surveyedNativeCrown?.(x,z),
  };
}

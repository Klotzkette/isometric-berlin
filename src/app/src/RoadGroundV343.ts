import { decodeBase64Bytes } from "./decodeBase64Bytes";
import type { Group, InstancedMesh } from "three";
import type { VoxelPayload } from "./terrainPayload";
import { restoreDrawnWaterBoundary } from "./drawnWaterBoundary";
import { canonicalMitteRoadTransactionV343 } from "./mitteRoadsV343";
import type { StreetSource } from "./DistrictStreets";
import district from "./data/districtStreets.json";
import eastern from "./data/schlossEastStreets.json";
import ownership from "./data/roadGroundV343.json";
import { preparedKulturforumPlazaV343 } from "./KulturforumPlazaV343";
import { disposeSurroundingCityRoot } from "./disposeSurroundingCityRootV323";

/** Exact encoded street identity; evaluated once and only by Drawn ground. */
export function roadGroundSourceGuardV343(streets: Pick<StreetSource,"surfaces">): number {
  let value = 2166136261;
  for (const surface of streets.surfaces) {
    if (!["asphalt", "paving", "sidewalk", "gravel"].includes(surface.kind)) continue;
    for (const text of [surface.kind, surface.positions_cm_b64, surface.indices_b64]) {
      for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
    }
  }
  return value;
}

let admitted: boolean | undefined;
function sourcesAdmitted(): boolean {
  if (admitted !== undefined) return admitted;
  const sources = [district, eastern] as unknown as StreetSource[];
  const transaction = canonicalMitteRoadTransactionV343();
  admitted = !!transaction && transaction.payload.sourceSha256 === ownership.mitteSourceSha256 &&
    sources.every((source, i) => roadGroundSourceGuardV343(source) === ownership.roadGuards[i]);
  return admitted;
}

function decoded(value: string): ArrayBuffer {
  return decodeBase64Bytes(value).buffer;
}

/** Every original host needed by the new full-footprint plaza must still be
 * present, cardinal, raster-aligned and at its audited final top. This runs
 * before the first mutation, so a missing host cannot leave a partial swap. */
function completePlazaHosts(slabs: InstancedMesh, ground: VoxelPayload): boolean {
  const cells=new Uint32Array(decoded(ownership.cells_u32));
  const spans=new Uint32Array(decoded(ownership.spans_u32));
  const tops=new Float32Array(decoded(ownership.tops_f32));
  const pending=new Set<number>(ownership.plazaRecords);
  const rows=new Map<number,number[]>();
  for(const record of pending){
    const row=cells[record*6+1], entries=rows.get(row)??[];
    if(!rows.has(row))rows.set(row,entries);entries.push(record);
  }
  const m=slabs.instanceMatrix.array,cell=ground.cell_m;
  for(let i=0;i<slabs.count&&pending.size;i++){
    const o=i*16,rx=(m[o+12]-m[o]/2)/cell-ground.grid.min_x_idx;
    const rz=(m[o+14]-m[o+10]/2)/cell-ground.grid.min_z_idx;
    const width=m[o]/cell, entries=rows.get(Math.round(rz));
    if(!entries||Math.abs(rz-Math.round(rz))>1e-6||Math.abs(rx-Math.round(rx))>1e-6||
        Math.abs(width-Math.round(width))>1e-6||m[o+5]!==3||m[o+10]!==cell||m[o+15]!==1||
        [1,2,3,4,6,7,8,9,11].some(n=>m[o+n]!==0))continue;
    const top=m[o+13]+m[o+5]/2;
    for(const record of entries){const start=cells[record*6];
      if(start>=rx&&start+spans[record]<=rx+width&&Math.abs(tops[record]-top)<=.00002)pending.delete(record);
    }
  }
  return pending.size===0&&ownership.plazaRecords.length>0;
}

/**
 * Retire proved street occlusions and the exact complete prepared plaza owner.
 * The existing bounded writer preserves each final source run's paint,
 * top, bottom, outside complement and all previously authored children. Exact
 * source-span/top guards reject missing or differently graded hosts. No road
 * vertex, measured terrain sample, Native cell or navigation height is moved.
 */
export function restoreRoadGroundV343(slabs: InstancedMesh, ground: VoxelPayload, plaza?: Group | null): boolean {
  // Repeated admission must not dispose an already attached replacement.
  if(plaza?.parent)return false;
  const reject=()=>{if(plaza)disposeSurroundingCityRoot(plaza);return false;};
  const replacement=preparedKulturforumPlazaV343(plaza??undefined);
  if (ground.cell_m !== ownership.cell_m ||
      Object.entries(ownership.grid).some(([key,value]) => ground.grid[key as keyof typeof ground.grid] !== value) ||
      !replacement||replacement.sourceSha256!==ownership.plazaSourceSha256||
      !sourcesAdmitted()||!completePlazaHosts(slabs,ground)) return reject();
  const previous = new Set(slabs.children);
  const previousWaterCount = slabs.userData.exactWaterBoundaryCells;
  restoreDrawnWaterBoundary(slabs, ground, { ...ownership, depth_m: 3 });
  let applied = false;
  for (const root of slabs.children) {
    if (previous.has(root)) continue;
    root.name = "Exact original land outside proven street occlusions v343";
    root.traverse(object => {
      object.userData.roadGroundV343 = true;
      if (object !== root) object.name = `Retained road-edge land v343 ${object.name.split(" ").at(-1)}`;
    });
    root.userData.correctionPolicy = "Proven road occlusions and exact prepared plaza ownership; complete original outside XYZ and paint";
    applied = true;
  }
  if (applied) slabs.userData.roadGroundCellsV343 = slabs.userData.exactWaterBoundaryCells;
  if (previousWaterCount === undefined) delete slabs.userData.exactWaterBoundaryCells;
  else slabs.userData.exactWaterBoundaryCells = previousWaterCount;
  if(!applied)return reject();
  slabs.add(plaza!);
  return true;
}

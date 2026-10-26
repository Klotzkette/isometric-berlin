import data from "./data/tierparkV276.json";
import { tierparkGroundGuardV255 } from "./TierparkV255";
import type { SurroundingBuilding, SurroundingCityChunk, SurroundingPackedMesh } from "./SurroundingCityGeometry";

export type TierparkSourceV276 = {
  schemaVersion: number;
  ids: string[];
  packets: Record<string, {
    origin: number[]; guard: number; meshGuard: number; baseMeshCount: number;
    mesh: SurroundingPackedMesh;
    solids: SurroundingBuilding[];
  }>;
};
const source = data as TierparkSourceV276;
const known = /* @__PURE__ */ (() => new Set(source.ids))();
const KIND = "tierpark-v276";

/** Bind facade attachments to the actual old rendered walls, in both modes. */
export function tierparkMeshGuardV276(meshes: SurroundingPackedMesh[]): number {
  let value = 2166136261;
  for (const mesh of meshes) for (const key of ["kind", "positionType", "positions", "colors", "indices"] as const) {
    const text = `${mesh[key] ?? ""}|`;
    for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return value;
}

/** Static recognition inside exact mapped enclosures and on existing walls.
 * The existing cooperative packet decoder owns upload, cancellation/disposal.
 * Mobile uses the same complete family. No texture, animation or extra loader. */
export function* prepareTierparkV276(
  chunk: SurroundingCityChunk, id: string, native = false,
  evidence: TierparkSourceV276 = source,
): Generator<void, SurroundingCityChunk> {
  const key = `${native ? "minecraft" : "drawn"}:${id}`;
  if ((evidence === source && !known.has(key)) || chunk.meshes.some(m => m.kind === KIND)) return chunk;
  if (!Object.prototype.hasOwnProperty.call(evidence.packets, key)) return chunk;
  const plan = evidence.packets[key];
  if (evidence.schemaVersion !== 1 || plan.mesh.kind !== KIND || plan.origin.length !== 3 ||
      chunk.origin.some((v, i) => v !== plan.origin[i]) || chunk.nav.groundY !== 3 ||
      tierparkGroundGuardV255(chunk.nav.ground) !== plan.guard ||
      plan.solids.length > 100 || plan.baseMeshCount < 1 || plan.baseMeshCount > chunk.meshes.length ||
      tierparkMeshGuardV276(chunk.meshes.slice(0, plan.baseMeshCount)) !== plan.meshGuard) return chunk;
  yield;
  return { ...chunk, meshes: [...chunk.meshes, plan.mesh], nav: plan.solids.length ?
    { ...chunk.nav, buildings: [...chunk.nav.buildings, ...plan.solids] } : chunk.nav };
}

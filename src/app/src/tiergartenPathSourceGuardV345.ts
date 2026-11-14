import type { SurfacePayload } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";

/** Canonical numeric source identity without retaining a second JSON string. */
export function tiergartenPathSourceGuardV345(ground: VoxelPayload, surfaces: SurfacePayload): number {
  let hash = 2166136261;
  const number = new DataView(new ArrayBuffer(8));
  const byte = (value: number) => { hash = Math.imul(hash ^ value, 16777619) >>> 0; };
  const text = (value: string) => { for (let i=0;i<value.length;i++) { byte(value.charCodeAt(i)&255); byte(value.charCodeAt(i)>>>8); } byte(0); };
  const visit = (value: unknown): void => {
    if (typeof value === "number") { byte(1); number.setFloat64(0,value,true); for(let i=0;i<8;i++)byte(number.getUint8(i)); }
    else if (typeof value === "string") { byte(2);text(value); }
    else if (Array.isArray(value)) { byte(3); for(const item of value)visit(item);byte(4); }
    else if (value && typeof value === "object") { byte(5); for(const key of Object.keys(value).sort()){text(key);visit((value as Record<string,unknown>)[key]);}byte(6); }
    else { byte(7);text(String(value)); }
  };
  visit({cell:ground.cell_m,grid:ground.grid,height:ground.ground_height,roads:surfaces.roads,parks:surfaces.parks});
  return hash;
}

import scope from "./data/districtHouseScopeV226.json";
import {
  DISTRICT_HOUSE_REGIONS_V225, districtHouseRegionInScopeV225,
  districtHouseOwnerV225, shadeDistrictHousePanesV225,
} from "./districtHousePresentationV225";

// The five prior scopes and every colour/protection recipe remain unchanged.
export { DISTRICT_HOUSE_ROOF_V225 as DISTRICT_HOUSE_ROOF_V226,
  DISTRICT_HOUSE_ROOF_HEX_V225 as DISTRICT_HOUSE_ROOF_HEX_V226 } from "./districtHousePresentationV225";
export const DISTRICT_HOUSE_REGIONS_V226 = [...DISTRICT_HOUSE_REGIONS_V225, ...scope.regions];

export function districtHouseRegionV226(x: number, z: number): number {
  return districtHouseRegionInScopeV225(DISTRICT_HOUSE_REGIONS_V226, x, z);
}

export function districtHouseOwnerV226(sourceId: string, ring: readonly (readonly number[])[], originX: number, originZ: number, scale = 1): boolean {
  return districtHouseOwnerV225(sourceId, ring, originX, originZ, scale, districtHouseRegionV226);
}

export function shadeDistrictHousePanesV226(
  kind: string, vertices: Uint16Array, indices: Uint16Array | Uint32Array,
  start: number, count: number, originX: number, originZ: number, native: boolean,
): Generator<void, number> {
  return shadeDistrictHousePanesV225(kind, vertices, indices, start, count, originX, originZ, native, districtHouseRegionV226);
}

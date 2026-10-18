import { shadeDistrictHousePanesV225 } from "./districtHousePresentationV225";

/** Existing peripheral packets only. Never changes the core or landmark paint;
 * the decoder still requires exact original generic colour and unique ownership.
 * Roof separation is illustrative, not a newly asserted roof material. */
export function refineOuterRoofsV230(id: string): boolean {
  return /^(outer187-|east200-|north190-|marzahn230-)/.test(id);
}

/** Reuse existing colour cells; retain every pane, sill and edge coordinate. */
export function shadeOuterHousePanesV230(
  kind: string, vertices: Uint16Array, indices: Uint16Array | Uint32Array,
  start: number, count: number, originX: number, originZ: number, native: boolean,
): Generator<void, number> {
  return shadeDistrictHousePanesV225(kind === "outer-facades-v230" ? "district-facades-v188" : "unmatched",
    vertices, indices, start, count, originX, originZ, native, () => 0);
}

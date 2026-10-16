import source from "./data/nationalgalerieApronV221Source.json";

/** Exact connected OSM paving complement; original LoD2 terrace stays intact. */
export const NATIONALGALERIE_APRON_V221_RING = source.ringXZ.map(
  ([x, z]) => [x, z] as const,
);
export const NATIONALGALERIE_APRON_V221 = {
  sourceKey: source.sourceKey,
  source: source.source,
  areaM2: source.areaM2,
  groundY: source.groundY,
  terraceTopY: source.terraceTopY,
  walkY: source.walkY,
  nativeRowPitchM: .25,
  verticalStatus: source.verticalStatus,
} as const;

export function nationalgalerieApronContainsV221(x: number, z: number): boolean {
  const ring = NATIONALGALERIE_APRON_V221_RING;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < 1e-7) return true;
    if ((a[1] > z) !== (b[1] > z) && x < a[0] + (z - a[1]) * dx / dz) inside = !inside;
  }
  return inside;
}

/** The original nine-metre OSM extrusions at the two mapped candelabra. */
type Prism = { id?: string; ring?: unknown; holes?: unknown; h_dm?: number;
  y0_dm?: number; class?: number; roof?: number; tone?: unknown };
const rings: Record<string,string> = {
  "06961073": "[[-27875,5918],[-27872,5966],[-27928,5969],[-27931,5922]]",
  "14399857": "[[-27959,5540],[-27962,5508],[-27921,5505],[-27918,5536]]",
};
export function isCharlottenburgerCandelabrumV379(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Prism;
  return (p.id === "06961073" || p.id === "14399857") && p.y0_dm === 52 &&
    p.h_dm === 90 && p.class === 0 && p.roof === 9999 && p.tone === undefined &&
    Array.isArray(p.holes) && p.holes.length === 0 && JSON.stringify(p.ring) === rings[p.id];
}
export function isCharlottenburgerCandelabrumCellV379(x: number,z: number,low: number,high: number,kind: number): boolean {
  return x === -698 && z === 148 && low === 52 && high === 172 && kind === 3;
}
export function charlottenburgerCandelabrumSourcePairV379(prisms: readonly unknown[] | undefined) {
  const found = prisms?.filter(isCharlottenburgerCandelabrumV379) as Prism[] | undefined;
  return found?.length === 2 && found[0].id !== found[1].id;
}

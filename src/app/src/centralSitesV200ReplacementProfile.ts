import evidence from "./data/centralSitesV200Replacement.json";

/** Complete LoD2 families, within the retained 0.25 m source quantization allowance. */
export const CENTRAL_SITES_V200_REPLACED_PRISM_IDS: ReadonlySet<string> = new Set(
  evidence.replacements.map(p => p.prismId),
);
const columns = new Map(evidence.replacements.flatMap(p => p.columns.map(
  ([x, z, bottom, top]) => [`${x},${z}`, [bottom, top]] as const,
)));

/** Exact old four-metre cells and vertical signature, before terrain translation. */
export function isCentralSitesV200ReplacedColumn(x: number, z: number, bottom: number, top: number): boolean {
  const range = columns.get(`${x},${z}`);
  return range !== undefined && Math.abs(bottom - range[0]) < 1e-6 && Math.abs(top - range[1]) < 1e-6;
}

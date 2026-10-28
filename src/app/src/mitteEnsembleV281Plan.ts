import source from "./friedrichstrasseArchitectureSource.json";
import type { FriedrichstrasseBlock } from "./FriedrichstrasseArchitecture";

const roles = new Set([
  "exposed window glazing", "window reveal", "projecting sill", "central mullion",
  "window transom", "source eaves cornice",
]);
const faces = [
  { id: "YCHo1QS2", a: [965.3, -393.1], b: [974.6, -373.6] },
  { id: "K0000BQ7", a: [1021.7, -294.5], b: [1021.7, -291.1] },
] as const;

export function verifyEnsembleFrontagesSourceV281(candidate: unknown): boolean {
  try {
    const text=JSON.stringify(candidate); let hash=2166136261;
    for (let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
    return hash===2434103950;
  } catch { return false; }
}
const sourceVerified=verifyEnsembleFrontagesSourceV281(source);
export function mitteEnsembleV281Enabled(): boolean { return sourceVerified; }

/** The previous front gold screen and every unrelated authored feature survive.
 * This filter only retires the two exact formerly generic wall grids replaced by
 * the required v281 source-plane layer. It never changes a source prism/roof.
 */
export function refineEnsembleFrontagesV281<T extends FriedrichstrasseBlock>(blocks: T[]): T[] {
  if (!sourceVerified) return blocks;
  return blocks.filter(block => !faces.some(face => {
    if (block.sourceId !== face.id || !roles.has(block.role)) return false;
    const part = source.prisms.find(p => p.id === face.id);
    // Fail closed if either measured edge has changed since the audited source.
    const edge = part?.ring.findIndex((p, i, ring) =>
      Math.hypot(p[0] / 10 - face.a[0], p[1] / 10 - face.a[1]) < .001 &&
      Math.hypot(ring[(i + 1) % ring.length][0] / 10 - face.b[0], ring[(i + 1) % ring.length][1] / 10 - face.b[1]) < .001);
    if (edge === undefined || edge < 0) return false;
    const dx=face.b[0]-face.a[0], dz=face.b[1]-face.a[1], len=Math.hypot(dx,dz);
    const nx=dz/len, nz=-dx/len;
    if (Math.hypot(block.normal[0]-nx,block.normal[1]-nz) > .001) return false;
    const x=block.position[0]-face.a[0], z=block.position[2]-face.a[1];
    const along=(x*dx+z*dz)/len, outward=x*nx+z*nz;
    return along >= -.2 && along <= len+.2 && outward >= -.01 && outward <= 4.2;
  }));
}

/** Complete, source-guarded replacement of the one former railway house. */
import type { Group } from 'three';
import data from './data/parisMoskauV354.json';
import { decodeLosslessGzipJson } from './losslessGzipBase85';
import { completePackedRootV307, createPackedRootV307, type RequiredPackedV307 } from './requiredPackedRootV307';
import type { VoxelPayload } from './MinecraftVoxelWorld';

type Prism = { id: string; ring: readonly (readonly number[])[]; holes?: readonly (readonly (readonly number[])[])[]; y0_dm: number; h_dm: number; class?: number; roof?: number; tone?: readonly number[] };
const owner = Symbol('Paris-Moskau complete source-bound house v354');
const drawnRoots = new WeakSet<Group>();
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Match the complete source record, not only a convenient centre or name. */
export function isParisMoskauPrismV354(p: Prism): boolean {
 const q = data.sourcePrism;
 return p.id === q.id && p.y0_dm === q.y0_dm && p.h_dm === q.h_dm && p.class === q.class && p.roof === q.roof && equal(p.ring, q.ring) && equal(p.holes ?? [], q.holes) && equal(p.tone, q.tone);
}

function columnsMatch(payload: VoxelPayload): boolean {
 if (payload.cell_m !== 4) return false;
 const found: number[][] = [];
 if (payload.building_rows) {
  for (const z of [-106, -105]) {
   for (const [offset, length, lo, hi, klass] of payload.building_rows[z - payload.grid.min_z_idx] ?? []) {
    const start = offset + payload.grid.min_x_idx;
    for (let x = Math.max(-118, start); x <= Math.min(-116, start + length - 1); x++) found.push([x,z,lo,hi,klass]);
   }
  }
 } else {
  for (const q of payload.buildings ?? []) if (q[0] >= -118 && q[0] <= -116 && q[1] >= -106 && q[1] <= -105) found.push([...q]);
 }
 return found.length === data.nativeColumns.length && data.nativeColumns.every(q => found.filter(p => equal(p,q)).length === 1);
}

export type ParisMoskauAdmissionV354 = {
 group: Group;
 replacesPrism: (p: Prism) => boolean;
 replacesColumn: (x: number,z: number,lo: number,hi: number,klass: number) => boolean;
};

/** The recognition factory receives the actual locally built core world. A
 * copied label, missing child, disposed mesh or failed source never hides the
 * original authored fallback. Initial-source priority keeps this house out of
 * the disposable Worker district stream on both device profiles. */
export function hasParisMoskauDrawnOwnerV354(world?: Group | null): boolean {
 return !!world && world.children.some(child => drawnRoots.has(child as Group) && child.parent === world && completePackedRootV307(child as Group,owner,false));
}

/** Old source is retained if it changes or a complete independent model cannot
 * be admitted. The model is attached to the existing city owner, no controller,
 * fetch, timer, terrain, navigation replacement or mobile detail reduction. */
export function prepareParisMoskauV354(prisms: readonly Prism[], native = false, voxels?: VoxelPayload): ParisMoskauAdmissionV354 | null {
 const matches = prisms.filter(p => p.id === data.sourcePrism.id);
 if (matches.length !== 1 || !isParisMoskauPrismV354(matches[0]) || native && (!voxels || !columnsMatch(voxels))) return null;
 const source = native ? data.minecraft : data.drawn;
 if (source.payload.length > 350_000 || source.decodedBytes > 1_500_000) throw Error('Paris-Moskau source exceeds finite bound');
 const part = decodeLosslessGzipJson(source.payload, source.decodedBytes) as RequiredPackedV307;
 if (part.native !== native || part.triangles !== source.triangles || part.origin.length !== 3 || !equal(part.origin,[-480,0,-440]) || part.vertices > 40_000) throw Error('Incomplete Paris-Moskau exterior');
 const group = createPackedRootV307(owner,'Restaurant Paris-Moskau v354',native,[part],{
  sourceId: data.sourcePrism.id, sourcePrism: data.sourcePrism,
  geometryStatus: 'Measured LoD2 envelope; primary-photo estimated timber, loggia, apertures, roofs and awning. Independent cardinal Native; unchanged original navigation.',
  sources: ['https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050226','https://www.paris-moskau.de/'],
 });
 if (!native) drawnRoots.add(group);
 const complete = () => group.parent !== null && completePackedRootV307(group,owner,native);
 return { group,
  replacesPrism: p => !native && isParisMoskauPrismV354(p) && complete(),
  replacesColumn: (x,z,lo,hi,klass) => native && x >= -118 && x <= -116 && z >= -106 && z <= -105 && complete() && data.nativeColumns.some(q => equal(q,[x,z,lo,hi,klass])),
 };
}

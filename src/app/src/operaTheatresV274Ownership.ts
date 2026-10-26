import source from './data/operaTheatresV274Ownership.json';
import nav from './data/operaTheatresV274Navigation.json';
import { transferExactPacketLines, transferExactPacketTriangles } from './exactPacketTransfer';
import type { SurroundingPackedLines, SurroundingPackedMesh, SurroundingNavigation } from './SurroundingCityGeometry';

const tiles = new Set(source.records.map(r => r.tile));
/** Call only once all 71 source parts have loaded successfully. Changed packets stay. */
export function* transferOperaTheatreTrianglesV274(enabled: boolean, tile: string, native: boolean, part: SurroundingPackedMesh, indices: Uint16Array | Uint32Array, offset: number): Generator<void, number> {
  if (!enabled || part.kind !== 'city' || !tiles.has(tile)) return 0;
  return yield* transferExactPacketTriangles(source.records, tile, native, part, indices, offset);
}
export function* transferOperaTheatreLinesV274(enabled: boolean, tile: string, part: SurroundingPackedLines, values: Uint16Array, stride: number): Generator<void, number> {
  if (!enabled || !tiles.has(tile)) return 0;
  return yield* transferExactPacketLines(source.lineRecords, tile, part, values, stride);
}

type PriorNav = { sourceId?: string; ring: readonly (readonly number[])[]; holes: readonly (readonly (readonly number[])[])[]; height: number; minHeight: number; heightSource?: string; groundOffset?: number };
const navTuple = (p: PriorNav) => JSON.stringify([p.sourceId, p.ring, p.holes, p.height, p.minHeight, p.heightSource, p.groundOffset ?? 0]);
/** A different height, footprint, courtyard, datum, owner or tile never yields. */
export function isOperaTheatrePreviousNavigationV274(enabled: boolean, tile: string, native: boolean, row: PriorNav, groundY: number): boolean {
  if (!enabled || !tiles.has(tile)) return false;
  const mode = native ? 'minecraft' : 'drawn';
  return source.navigationRecords.some(r => r.tile === tile && r.mode === mode && r.groundY === groundY && navTuple(r.original) === navTuple(row));
}

type Prism = { id: string; ring: readonly (readonly number[])[]; holes: readonly (readonly (readonly number[])[])[]; y0_dm: number; h_dm: number; class: number; roof: number; tone?: readonly number[] };
const prismTuple = (p: Prism) => JSON.stringify([p.id, p.ring, p.holes, p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);
/** Six exact Schiller fallback records; the neighbouring prism 49449347 is retained. */
export function isOperaTheatrePreviousPrismV274(enabled: boolean, value: unknown): boolean {
  if (!enabled || !value || typeof value !== "object") return false;
  const prism = value as Prism;
  return nav.legacyPrisms.some(p => p.id === prism.id && prismTuple(p) === prismTuple(prism));
}

const oldBoxes = new Map(source.previousBoxes.map(([index, row]) => [index as number, JSON.stringify(row)]));
const oldSegments = new Map(source.previousSegments.map(([index, row]) => [index as number, JSON.stringify(row)]));
/** Receipts refer to original v182 row indices. Compose predicates before filtering. */
export function operaTheatresV274PreviousFilters(enabled = true) {
  return {
    box: (row: readonly number[], index: number) => !enabled || oldBoxes.get(index) !== JSON.stringify(row),
    segment: (row: readonly number[], index: number) => !enabled || oldSegments.get(index) !== JSON.stringify(row),
  };
}

/** Column receipts exclude every pre-existing shared neighbour cell. New or
 * changed nearby owners fail closed as well. No world rectangle is erased. */
export function createOperaTheatresColumnTesterV274(prisms: readonly unknown[] | undefined, cell: number) {
  const no = (_x:number,_z:number,_lo:number,_hi:number,_kind:number) => false;
  if (!prisms || cell !== source.cellM) return no;
  if (nav.legacyPrisms.some(p => prisms.filter(r => (r as Prism)?.id === p.id).length !== 1 || !prisms.some(r => (r as Prism)?.id === p.id && isOperaTheatrePreviousPrismV274(true,r)))) return no;
  const neighbours = new Map(source.neighbours.map(p => [p.id,prismTuple(p)]));
  const foreign = prisms.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || isOperaTheatrePreviousPrismV274(true,raw)) return [];
    const p = raw as Prism;
    if (!Array.isArray(p.ring)) return [];
    const b={minX:Math.min(...p.ring.map(v=>v[0]))/10,maxX:Math.max(...p.ring.map(v=>v[0]))/10,minZ:Math.min(...p.ring.map(v=>v[1]))/10,maxZ:Math.max(...p.ring.map(v=>v[1]))/10};
    if (b.maxX<source.bounds[0]||b.minX>source.bounds[2]||b.maxZ<source.bounds[1]||b.minZ>source.bounds[3]||neighbours.get(p.id)===prismTuple(p)) return [];
    return [b];
  });
  const keys = new Set(source.columns.filter(c=>!foreign.some(b=>b.maxX>=c[0]*cell&&b.minX<=(c[0]+1)*cell&&b.maxZ>=c[1]*cell&&b.minZ<=(c[1]+1)*cell)).map(c=>c.join('/')));
  return (x:number,z:number,lo:number,hi:number,kind:number) => keys.has([x,z,lo,hi,kind].join('/'));
}
/** The complete measured bodies are registered in the required pedestrian index.
 * Drop an old streamed collision only when that packet's full geometry transfer succeeded. */
export function operaTheatreNavigationV274(enabled:boolean,tile:string,native:boolean,original:SurroundingNavigation,transferredTriangles:number):SurroundingNavigation {
  const expected=source.records.filter(r=>r.tile===tile&&r.mode===(native?'minecraft':'drawn')).reduce((n,r)=>n+r.triangles.length,0);
  if (!enabled||expected===0||expected!==transferredTriangles) return original;
  const buildings=original.buildings.filter(row=>!isOperaTheatrePreviousNavigationV274(true,tile,native,row,original.groundY));
  return buildings.length===original.buildings.length?original:{...original,buildings};
}

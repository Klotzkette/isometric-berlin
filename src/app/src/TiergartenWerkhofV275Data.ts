import source from './data/tiergartenWerkhofV275.json';

/** Finite construction data only; no city-wide lookup or texture is introduced. */
export const TIERGARTEN_WERKHOF_V275_DATA = source;
export const TIERGARTEN_WERKHOF_V275_COUNTS = Object.freeze(source.counts);
export const TIERGARTEN_WERKHOF_V275_SOURCE_IDS: ReadonlySet<string> = new Set(source.parts.map(part => part.sourceId));

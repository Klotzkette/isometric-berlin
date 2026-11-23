import legacy from "./data/zooWestV379Legacy.json";

// These are exact source indexes of v165 wall boxes/native rows in the old glass
// house or Antilopenhaus. Other buildings and every shared habitat ground survive.
function indices(runs: number[][]) {
  const set = new Set<number>();
  for (const [first,last] of runs) for (let index=first; index<=last; index++) set.add(index);
  return set;
}
export const replacedZooPartsV379 = new Set(legacy.parts);
export const replacedZooFacadeBoxesV379 = indices(legacy.facades);
export const replacedZooRowsV379 = indices(legacy.rows);
export const zooAnimalFeetV379: Readonly<Record<string, number[]>> = legacy.animals;

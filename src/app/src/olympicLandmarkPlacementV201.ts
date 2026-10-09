/** Restore measured source height above the plaza; keep every authored arena row. */
export function olympicStadiumYV201(y:number):number {
  return y>=3.55 ? y+33.45 : 23.05+(y+12.667)*(37-23.05)/(3.55+12.667);
}
export const OLYMPIC_STADIUM_DATUM_V201=33.45;
export const OLYMPIC_GLOCKENTURM_DATUM_V201=34.676;

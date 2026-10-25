import profilePrevious from './data/feuerwacheKreuzbergV267PreviousProfiles.json';
const OWNER = 'DEBE02YY40000Avj';

/** Only the exact v185 upper course of this owner was tied to the old false
 * 15.5m whole-parent cap. Retain all lower courses, positions, widths and counts. */
export function correctFeuerwacheProfilesV267<T extends readonly number[][]>(rows: T,native=false): T | number[][] {
  if(profilePrevious.owner!==OWNER)return rows;
  const records=profilePrevious.records.filter(r=>r.native===native && r.owner===OWNER);
  if(!records.length || records.some(r=>JSON.stringify(rows[r.index])!==JSON.stringify(r.before)))return rows;
  const corrected=rows.slice();
  for(const r of records)corrected[r.index]=[...r.after];
  return corrected;
}

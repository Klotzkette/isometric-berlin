import data from './data/bayerCampusV277Legacy.json';

/** Full exact old tuples, including site and role, not a bounding-box filter.
 * Native and drawn receipts were independently captured from the unchanged v210
 * generator. A changed row at the same index remains visible. */
export function retainWeddingRowsV277(rows: (number | string)[][], native: boolean,
  active = false): (number | string)[][] {
  if (!active) return rows;
  const text = atob(native ? data.native : data.drawn), raw = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) raw[i] = text.charCodeAt(i);
  const receipt = new Float64Array(raw.buffer), width = native ? 9 : 13, numeric = native ? 7 : 11;
  const retire = new Set<number>();
  for (let i = 0; i < receipt.length; i += width) {
    const index = receipt[i], row = rows[index];
    if (!row || row.length !== numeric + 2 || row[numeric] !== 'bayer' || row[numeric + 1] !== data.roles[receipt[i + width - 1]]) continue;
    let exact = true;
    for (let k = 0; k < numeric; k++) if (!Object.is(row[k], receipt[i + k + 1])) { exact = false; break; }
    if (exact) retire.add(index);
  }
  return rows.filter((_row, index) => !retire.has(index));
}

import source from "./data/eastCinemasV260.json";

// Exact complete v186 lower side-edge row. Its last 0.7 m crosses the newly
// evidenced cinema recess. Retain its full rear complement and unchanged ink.
const previous = [3520.206, 3.3, -111.545, 37.243, .25, .16, -2.047788, 11644834, -1];
export function eastCinemasPreviousEdgesV260(cell: string, rows: readonly number[][]): number[][] {
  if (cell !== "6:-1") return rows as number[][];
  const p = source.sites.international;
  return rows.map(row => {
    if (row.length !== previous.length || !row.every((v, i) => v === previous[i])) return row;
    const dx = Math.cos(row[6]), dz = -Math.sin(row[6]);
    const depth = (row[0] - p.frontA[0]) * p.inward[0] + (row[2] - p.frontA[1]) * p.inward[1];
    const along = dx * p.inward[0] + dz * p.inward[1];
    const low = -row[3] / 2, high = Math.min(row[3] / 2, (p.cantileverM - depth) / along);
    const center = (low + high) / 2;
    return [row[0] + dx * center, row[1], row[2] + dz * center, high - low, ...row.slice(4)];
  });
}

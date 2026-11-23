type RoofRows = Map<number, Map<number, number>>;
type SourceRows = () => readonly (readonly number[])[];

function rowFor(rows: RoofRows, z: number): Map<number, number> {
  let row = rows.get(z);
  if (!row) {
    row = new Map();
    rows.set(z, row);
  }
  return row;
}

/** Keep the derived walking index local to the first native roof query for
 * this site. Numeric keys avoid formatting coordinates on every footstep. */
function lookup(build: () => RoofRows): (x: number, z: number) => number | null {
  let rows: RoofRows | undefined;
  return (x, z) => {
    rows ??= build();
    return rows.get(z)?.get(x) ?? null;
  };
}

/** Some catalogues store grid indices directly, others store metre coordinates. */
export function nativeRoofCellLookup(source: SourceRows, cellSize?: number) {
  return lookup(() => {
    const rows: RoofRows = new Map();
    for (const [x, z, height] of source()) {
      const cellX = cellSize === undefined ? x : Math.floor(x / cellSize);
      const cellZ = cellSize === undefined ? z : Math.floor(z / cellSize);
      rowFor(rows, cellZ).set(cellX, height);
    }
    return rows;
  });
}

export function nativeRoofRunLookup(source: SourceRows, offsetAt?: (x: number, z: number) => number) {
  return lookup(() => {
    const rows: RoofRows = new Map();
    for (const [start, end, z, height] of source()) {
      const row = rowFor(rows, z);
      for (let x = start; x < end; x++) row.set(x, height);
    }
    // Published runs can overlap. Apply the terrain correction once to each
    // surviving height, preserving the original last-record-wins order.
    if (offsetAt) {
      for (const [z, row] of rows) {
        for (const [x, height] of row) row.set(x, height + offsetAt(x + 0.5, z + 0.5));
      }
    }
    return rows;
  });
}

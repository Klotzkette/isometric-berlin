import { surroundingPolygonBounds, surroundingPolygonContains, type SurroundingPolygon } from "./SurroundingCityGeometry";

/** Keep large, irregular source polygons once rather than allocating one
 * entry for every cell in their bounding rectangle. Exact rings and holes
 * still decide membership at seams, shores and excluded garden parcels. */
export function indexSurroundingFootprintV379(polygons: readonly SurroundingPolygon[], end = polygons.length) {
  const cell = 512;
  const cells = new Map<number, Map<number, SurroundingPolygon[]>>();
  const wide: SurroundingPolygon[] = [];
  for (let i = 0; i < end; i++) {
    const p = polygons[i], [west, north, east, south] = surroundingPolygonBounds(p);
    const x0 = Math.floor(west / cell), z0 = Math.floor(north / cell);
    const x1 = Math.floor(east / cell), z1 = Math.floor(south / cell);
    if (![x0,x1,z0,z1].every(Number.isSafeInteger) || (x1 - x0 + 1) * (z1 - z0 + 1) > 16) { wide.push(p); continue; }
    for (let x = x0; x <= x1; x++) {
      let column = cells.get(x);
      if (!column) { column = new Map(); cells.set(x,column); }
      for (let z = z0; z <= z1; z++) {
        const bucket = column.get(z);
        if (bucket) bucket.push(p); else column.set(z,[p]);
      }
    }
  }
  return (x: number,z: number): boolean => {
    const bucket = cells.get(Math.floor(x/cell))?.get(Math.floor(z/cell));
    if (bucket) for (const p of bucket) if (surroundingPolygonContains(p,x,z)) return true;
    for (const p of wide) if (surroundingPolygonContains(p,x,z)) return true;
    return false;
  };
}

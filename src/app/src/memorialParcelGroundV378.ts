import data from "./data/memorialParcelsV378.json";

type Point = number[];
export interface MemorialParcelV378 {
  id: string;
  center: Point;
  bounds: Point;
  groundY: number;
  land: Point[];
  paths: { width: number; points: Point[] }[];
  wall?: Point[];
  gate?: Point[];
  plaque?: Point;
}

export const memorialParcelsV378: MemorialParcelV378[] = data.sites;

export function memorialParcelGroundV378(x: number, z: number): number | null {
  for (const site of memorialParcelsV378) {
    const [west,north,east,south] = site.bounds;
    if (x < west || z < north || x > east || z > south) continue;
    let inside = false;
    for (let i = 0, j = site.land.length-1; i < site.land.length; j = i++) {
      const [ax,az] = site.land[i], [bx,bz] = site.land[j];
      if ((az>z) !== (bz>z) && x < (bx-ax)*(z-az)/(bz-az)+ax) inside = !inside;
    }
    if (inside) return site.groundY;
  }
  return null;
}

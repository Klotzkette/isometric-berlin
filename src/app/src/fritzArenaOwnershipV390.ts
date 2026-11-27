import receipt from "./data/fritzArenaOwnersV390.json";
import { inWeddingRingV229, weddingMoabitGroundV229 } from "./weddingMoabitV229Profile";

type ArenaPrism = { id: string; ring: number[][]; holes?: number[][][]; y0_dm: number; h_dm: number };
const owners = new Map(receipt.owners.map(row => [row.id, JSON.stringify(row)]));

export function isFritzArenaPrismV390(prism: ArenaPrism): boolean {
  const original = owners.get(prism.id);
  return original !== undefined && JSON.stringify(prism) === original;
}

/** The old 30 cm arena outline became a four-metre block across the football
 * field. Remove only its captured source columns and the refitted northern
 * terrace. A newly overlapping building keeps its cells. */
export function fritzArenaColumnsV390(prisms: readonly ArenaPrism[] | undefined, cell: number) {
  if (cell !== 4 || !prisms || prisms.filter(isFritzArenaPrismV390).length !== owners.size) return () => false;
  const protectedRings: ArenaPrism[] = [];
  const rows = new Map<number, number[][]>();
  for (const row of receipt.columns) {
    const line = rows.get(row[0]);
    if (line) line.push(row);
    else rows.set(row[0], [row]);
  }
  for (const prism of prisms) {
    if (owners.has(prism.id)) continue;
    // Reject by the complete extents, including buildings crossing the area
    // whose first measured corner happens to fall outside it.
    let west = Infinity, east = -Infinity, north = Infinity, south = -Infinity;
    for (const [x, z] of prism.ring) {
      west = Math.min(west, x); east = Math.max(east, x);
      north = Math.min(north, z); south = Math.max(south, z);
    }
    if (west <= -6650 && east >= -8900 && north <= -11600 && south >= -13400) protectedRings.push(prism);
  }
  return (x: number, z: number, bottom: number, top: number, kind: number): boolean => {
    if (bottom !== 52 || top !== 92 || x < -226 || x > -168 || z < -340 || z > -283) return false;
    if (!rows.get(z)?.some(row => x >= row[1] && x <= row[2] && kind === row[3])) return false;
    const px = (x + .5) * 40, pz = (z + .5) * 40;
    return !protectedRings.some(p => inWeddingRingV229(p.ring,px,pz)
      && !p.holes?.some(h => inWeddingRingV229(h,px,pz)));
  };
}

/** Local height of a retained tread on the uncovered north terrace. Keep the
 * passage bands between seating bays open in both geometry families. */
export function fritzNorthTerraceTopV390(x:number,z:number,native:boolean):number {
  if(native){x=Math.floor(x)+.5;z=Math.floor(z)+.5;}
  const dx=x+793.056,dz=z+1256.614;
  const u=dx*.90013942-dz*.43560190, v=dx*.43560190+dz*.90013942;
  const distance=-45-v,tier=Math.floor(distance/1.35);
  if(tier<0||tier>=8||distance-tier*1.35>1.29||
    ![[-49,-26],[-24,-1],[1,23],[25,52]].some(([a,b])=>u>=a&&u<=b))return -Infinity;
  return weddingMoabitGroundV229(x,z,native)+.26+tier*.31;
}

import source from "./data/monbijouBathV167Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export function monbijouBathV167WaterAt(x:number,z:number):boolean {
  if (x<1705 || x>1733 || z< -405 || z> -376) return false;
  return source.pools.some(pool=>pointInWorldRing(x,z,pool.ring as unknown as WorldRing));
}

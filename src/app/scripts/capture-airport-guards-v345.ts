/** Record the complete existing v194 render arrays, before new v345 fittings.
 * Run only after the independently pinned source generator/receipt tests pass. */
import { writeFileSync } from "node:fs";
import { InstancedMesh } from "three";
import { createAirportsV194 } from "../src/AirportsV194";
function hash(a: ArrayBufferView): number[] {
  let h=2166136261;
  for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;
  return [a.byteLength,h];
}
const pins=[false,true].map(native=>createAirportsV194(native).children.map(child=>{
  const m=child as InstancedMesh;
  return {count:m instanceof InstancedMesh?m.count:null,arrays:[...["position","normal","color"].map(k=>m.geometry.getAttribute(k)?.array),m.geometry.index?.array,m.instanceMatrix?.array,m.instanceColor?.array].map(a=>a?hash(a):null)};
}));
writeFileSync(new URL("../src/data/airportExteriorsV345Guards.json",import.meta.url),JSON.stringify(pins)+"\n");

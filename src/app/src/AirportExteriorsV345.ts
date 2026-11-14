import { Group, InstancedMesh, Mesh, type TypedArray } from "three";
import source from "./data/airportExteriorsV345.json";
import guards from "./data/airportExteriorsV345Guards.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const AIRPORT_EXTERIORS_V345_PROFILE = Object.freeze({
  sourceOwners: ["relation/13234", "way/24378140", "DEBE07YY9000088X"],
  budgetBytes: 600_000,
  combinedAirportBudgetBytes: 1_800_000,
  cameras: {
    tegel: {position:[-5280,25,-3930],target:[-5355,9,-4010],spanM:160},
    tempelhof: {position:[1250,27,4390],target:[1100,18,4310],spanM:200},
  },
});

function matches(a: TypedArray | undefined, pin: number[] | null): boolean {
  if (pin === null) return a === undefined;
  if (!a || a.byteLength !== pin[0]) return false;
  let h = 2166136261;
  for (const b of new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h === pin[1];
}
const identity = (o: Group | Mesh): boolean => o.position.x === 0 && o.position.y === 0 && o.position.z === 0 &&
  o.quaternion.x === 0 && o.quaternion.y === 0 && o.quaternion.z === 0 && o.quaternion.w === 1 &&
  o.scale.x === 1 && o.scale.y === 1 && o.scale.z === 1 &&
  o.matrix.elements.every((n,i)=>n===(i%5===0?1:0));

/** Construction-time transaction on the complete retained airport owner.
 * No source instance is retired. A mismatched or partial owner receives no
 * floating facade marks. Called before the existing static lifecycle parks arrays.
 */
export function addAirportExteriorsV345(airport: Group, native = false): boolean {
  const pins = guards[native ? 1 : 0];
  if (!identity(airport) || airport.children.length !== pins.length) return false;
  for (let i=0; i<pins.length; i++) {
    const m=airport.children[i];
    if (!(m instanceof Mesh) || !identity(m) || m.geometry.getAttribute("uv") !== undefined) return false;
    const p=pins[i], instance=m instanceof InstancedMesh ? m : undefined;
    if ((instance?.count ?? null) !== p.count) return false;
    const arrays=[...["position","normal","color"].map(k=>m.geometry.getAttribute(k)?.array),m.geometry.index?.array,instance?.instanceMatrix.array,instance?.instanceColor?.array];
    if (arrays.some((a,j)=>!matches(a,p.arrays[j]))) return false;
  }
  const root=new Group(); root.name="Tegel concrete glazing reveals and Tempelhof hangar steelwork v345";
  root.userData={textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native,
    airportExteriorsV345:true,sourceGeometryRetained:true,additiveOnly:true};
  const rows=native ? source.blocks : source.boxes;
  for (const site of ["tegel","tempelhof"] as const) {
    const local=rows.filter(r=>site==="tegel" ? r[0]<0 : r[0]>0);
    const mesh=justicePalaceV183Boxes(local,native);
    mesh.name=site==="tegel" ? "Tegel retained facade lintels, sills and glazing gaskets" : "Tempelhof retained hangar panel transoms and lower metal fields";
    root.add(mesh);
  }
  airport.add(freezeStaticSceneTransforms(root));
  return true;
}

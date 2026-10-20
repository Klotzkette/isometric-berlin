import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import data from "./data/lennonV250.json";
import old185 from "./data/schoolsV185.json";
import old205 from "./data/schoolsPlacesV205.json";
import old230 from "./data/centralNamedV230.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Members = { owner: string; boxes: number[][]; rods: number[][]; nativeRows: number[][] };
type Version = "v205" | "v230";

/** Exact numeric authored-row receipt; no measured city sheet is eligible. */
export function lennonV250Fingerprint(rows: readonly number[][]): number[] {
  let a = 2166136261, b = 5381;
  const feed = (s: string) => { for (let i=0;i<s.length;i++) { a=Math.imul(a^s.charCodeAt(i),16777619)>>>0; b=(Math.imul(b,33)^s.charCodeAt(i))>>>0; } };
  rows.forEach((row,i)=> { if(i)feed(";"); row.forEach((v,j)=>{if(j)feed(",");feed(v.toFixed(6));}); });
  return [rows.length,a,b];
}
const same = (a: readonly number[], b: readonly number[]) => a.length===b.length && a.every((v,i)=>v===b[i]);
function matches(entry: Members | undefined, version: Version): boolean {
  return !!entry && entry.owner===data.owner && (["boxes","rods","nativeRows"] as const)
    .every(key=>same(lennonV250Fingerprint(entry[key]),data.previous[version][key]));
}

// Only booleans survive this audit. No decoded old/new member arrays are cached
// on module state or scene metadata; construction remains reclaimable.
let available: boolean | undefined;
export function canRefineLennonV250(): boolean {
  if(available!==undefined)return available;
  const s=old185.schools.find(s=>s.owner===data.owner);
  available=!!s && same(lennonV250Fingerprint(old185.boxes.slice(s.firstBox,s.firstBox+s.boxCount)),data.previous.v185.boxes)
    && same(lennonV250Fingerprint(old185.nativeRows.slice(s.firstNative,s.firstNative+s.nativeCount)),data.previous.v185.nativeRows)
    && matches(old205.schools.find(s=>s.owner===data.owner),"v205")
    && matches(old230.sites.find(s=>s.owner===data.owner),"v230");
  return available;
}

/** A changed/unrelated entry fails open, retaining its entire older detail. */
export function replacesLennonV250(entry: Members, version: Version): boolean {
  return canRefineLennonV250() && matches(entry,version);
}

/** One existing school slot replaces its three obsolete authored accents.
 * Complete measured body, roof, court and navigation remain in their old owners. */
export function createLennonV250(native = false): InstancedMesh {
  if(!canRefineLennonV250())throw new Error("Lennon v250 exact authored correction receipt changed");
  const rows=(native?data.nativeRows:data.boxes).map(r=>[
    r[0]/1000+data.origin[0],r[1]/1000,r[2]/1000+data.origin[2],
    r[3]/1000,r[4]/1000,r[5]/1000,...(native?[]:[r[6]/1e6]),data.colors[r.at(-1)!],
  ]);
  const mesh=justicePalaceV183Boxes(rows,native);
  if(!native) {
    const rods=data.rods;
    const matrices=new Float32Array((rows.length+rods.length)*16),colors=new Float32Array((rows.length+rods.length)*3);
    matrices.set(mesh.instanceMatrix.array);colors.set(mesh.instanceColor!.array);
    const a=new Vector3(),b=new Vector3(),direction=new Vector3(),up=new Vector3(0,1,0),size=new Vector3(),rotation=new Quaternion(),matrix=new Matrix4(),color=new Color();
    rods.forEach((r,i)=>{
      a.set(r[0]/1000+data.origin[0],r[1]/1000,r[2]/1000+data.origin[2]);
      b.set(r[3]/1000+data.origin[0],r[4]/1000,r[5]/1000+data.origin[2]);
      direction.subVectors(b,a);const length=direction.length();rotation.setFromUnitVectors(up,direction.normalize());
      matrix.compose(a.add(b).multiplyScalar(.5),rotation,size.set(r[6]/1000,length,r[6]/1000));
      matrix.toArray(matrices,(rows.length+i)*16);color.setHex(data.colors[r[7]]).toArray(colors,(rows.length+i)*3);
    });
    mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=rows.length+rods.length;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
  }
  mesh.name="John-Lennon-Gymnasium: four-storey plaster street front v250";
  mesh.userData={...mesh.userData,lennonV250:true,sourceOwner:data.owner,sourceGeometryRetained:true,
    fullStaticDetailOnTouch:true,exactAuthoredCorrection:true,occupiedLevels:4,centralPortals:3,
    blockNative:native,nativeMinecraft:native,noHiddenSolidInfill:true};
  return freezeStaticSceneTransforms(mesh);
}

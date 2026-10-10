import { Color, Group, InstancedMesh, Matrix4, Vector3 } from "three";
import receipt from "./data/neukoellnPlacesV210Ownership.json";

export const NEUKOELLN_V185_LEGACY_RECEIPTS_V210 = receipt.legacyDetailRecords;
function matrixFor(row: readonly number[], native: boolean): Float32Array {
  const matrix = new Matrix4();
  if(native) matrix.makeScale(row[3],row[4],row[5]);
  else matrix.makeRotationY(row[6]).scale(new Vector3(row[3],row[4],row[5]));
  matrix.setPosition(row[0],row[1],row[2]);return new Float32Array(matrix.elements);
}
/** Guard all three original drawn rows / eighteen native rows and their colours.
 * Only the obsolete upper strip moves; old source JSON and other rows stay exact.
 * reverse=true recreates the original float32 bytes for preservation audits. */
export function transferNeukoellnLegacyV185V210(root: Group, native = false, reverse = false): Group {
  const record = receipt.legacyDetailRecords.find(r=>r.mode===(native?"minecraft":"drawn"))!;
  const from=reverse?record.replacement:record.original, to=reverse?record.original:record.replacement;
  const expectedCount=native?10018:2788;
  const candidates: InstancedMesh[]=[];
  root.traverse(child=>{if(child instanceof InstancedMesh && child.count===expectedCount)candidates.push(child);});
  if(candidates.length!==1) return root;
  const mesh=candidates[0], buffer=mesh.instanceMatrix.array as Float32Array;
  const colors=mesh.instanceColor?.array; if(!colors)return root;
  const tint=new Color();
  const matches=from.every((row,i)=>{
    const matrix=matrixFor(row,native), color=new Float32Array(tint.setHex(row[native?6:7]).toArray());
    return matrix.every((v,k)=>buffer[(record.first+i)*16+k]===v) && color.every((v,k)=>colors[(record.first+i)*3+k]===v);
  });
  if(!matches)return root;
  to.forEach((row,i)=>buffer.set(matrixFor(row,native),(record.first+i)*16));
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
  root.userData.neukoellnLegacyCorniceV210=!reverse;return root;
}

import { Color, Group, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import source from "./data/centralNamedV230.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Five bounded central-site accents; source bodies and prior aperture axes survive. */
export function createCentralNamedV230(native = false): Group {
  const root = new Group();
  root.name = native ? "Central named sites v230 independent native recognition" : "Central named sites v230 source-bound recognition";
  root.userData = {centralNamedV230:true,requiredBeforeNavigation:true,textureFree:true,additiveOnly:true,sourceGeometryRetained:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,noHiddenSolidInfill:true};
  for (const site of source.sites) {
    const group = new Group();
    group.name = `${site.key}: ${site.name}`;
    group.userData = {...root.userData,siteKey:site.key,sourceOwner:site.owner};
    const rows = (native ? site.nativeRows : site.boxes).map(r=>[...r]);
    const rods = native ? [] : site.rods.map(r=>[...r]);
    const mesh=justicePalaceV183Boxes(rows,native);
    if (rods.length) {
      const matrices=new Float32Array((rows.length+rods.length)*16),colors=new Float32Array((rows.length+rods.length)*3);
      matrices.set(mesh.instanceMatrix.array);colors.set(mesh.instanceColor!.array);
      const a=new Vector3(),b=new Vector3(),direction=new Vector3(),up=new Vector3(0,1,0),size=new Vector3(),rotation=new Quaternion(),matrix=new Matrix4(),color=new Color();
      rods.forEach((r,i)=>{
        a.fromArray(r);b.fromArray(r,3);direction.subVectors(b,a);
        const length=direction.length();rotation.setFromUnitVectors(up,direction.normalize());
        matrix.compose(a.add(b).multiplyScalar(.5),rotation,size.set(r[6],length,r[6]));
        matrix.toArray(matrices,(rows.length+i)*16);color.setHex(r[7]).toArray(colors,(rows.length+i)*3);
      });
      mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=rows.length+rods.length;
      mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
    mesh.name=`${site.key}: exact-count recognition members`;
    mesh.userData={...mesh.userData,...group.userData};
    group.add(mesh);
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}

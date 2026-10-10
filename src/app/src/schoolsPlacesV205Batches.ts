import { Color, Group, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";
import source from "./data/schoolsPlacesV205.json";

type Refinement = typeof source.schools[number] | typeof source.places[number];

/** One exact-count cube batch per site; full detail on mobile, no new shell. */
export function appendSchoolPlaceV205(root: Group, kind: "schools" | "places", native: boolean): void {
  for (const entry of source[kind] as Refinement[]) {
    const rows = (native ? entry.nativeRows : entry.boxes).map(r => [...r]);
    const rods: number[][] = native ? [] : entry.rods.map(r => [...r]);
    for (const label of entry.labels) {
      const { center: c, direction: d } = label;
      for (const path of letteringStrokePaths(label.text, label.height)) for (let i=1;i<path.length;i++) {
        const a = [c[0]+d[0]*path[i-1][0],c[1]+path[i-1][1],c[2]+d[2]*path[i-1][0]];
        const b = [c[0]+d[0]*path[i][0],c[1]+path[i][1],c[2]+d[2]*path[i][0]];
        if (!native) rods.push([...a,...b,.055,label.color]);
        else {
          // Offset lettering past the native source skin, matching the face.
          const nx=label.normal[0],nz=label.normal[2];
          const steps=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))/.13));
          for(let j=0;j<steps;j++) {
            const t=(j+.5)/steps;
            rows.push([a[0]+(b[0]-a[0])*t+nx*.95,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+nz*.95,.12,.12,.12,label.color]);
          }
        }
      }
    }
    const mesh=justicePalaceV183Boxes(rows,native);
    if (rods.length) {
      const matrices=new Float32Array((rows.length+rods.length)*16),colors=new Float32Array((rows.length+rods.length)*3);
      matrices.set(mesh.instanceMatrix.array);colors.set(mesh.instanceColor!.array);
      const a=new Vector3(),b=new Vector3(),direction=new Vector3(),up=new Vector3(0,1,0),size=new Vector3(),rotation=new Quaternion(),matrix=new Matrix4(),color=new Color();
      rods.forEach((row,i)=>{
        a.fromArray(row);b.fromArray(row,3);direction.subVectors(b,a);
        const length=direction.length();rotation.setFromUnitVectors(up,direction.normalize());
        matrix.compose(a.add(b).multiplyScalar(.5),rotation,size.set(row[6],length,row[6]));
        matrix.toArray(matrices,(rows.length+i)*16);color.setHex(row[7]).toArray(colors,(rows.length+i)*3);
      });
      mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=rows.length+rods.length;
      mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
    mesh.name=`${entry.name}: source-bound window heads and material profiles v205`;
    mesh.userData={...mesh.userData,sourceOwner:entry.owner,schoolPlaceV205:true,sourceGeometryRetained:true,fullStaticDetailOnTouch:true,additiveOnly:true};
    root.add(mesh);
  }
  freezeStaticSceneTransforms(root);
}

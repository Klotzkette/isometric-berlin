import { Color, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringStrokePaths } from "./drawnLettering";
interface Letter {text:string;center:number[];direction:number[];normal:number[];height:number;color:number}
/** A handful of original procedural BEHALA strokes, no atlas or retained strings. */
export function westernIndustrialLetteringV230(labels: readonly Letter[], native: boolean) {
  const rows:number[][]=[],rods:number[][]=[];
  for(const label of labels) {
    const {center:c,direction:d,normal:n}=label;
    for(const path of letteringStrokePaths(label.text,label.height))for(let i=1;i<path.length;i++){
      const a=[c[0]+d[0]*path[i-1][0],c[1]+path[i-1][1],c[2]+d[2]*path[i-1][0]];
      const b=[c[0]+d[0]*path[i][0],c[1]+path[i][1],c[2]+d[2]*path[i][0]];
      if(!native)rods.push([...a,...b,.07,label.color]);
      else {
        const count=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))/.18));
        for(let k=0;k<count;k++){
          const t=(k+.5)/count;
          rows.push([a[0]+(b[0]-a[0])*t+n[0]*1.2,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+n[2]*1.2,.16,.16,.16,label.color]);
        }
      }
    }
  }
  const mesh=justicePalaceV183Boxes(rows,native);mesh.name="BEHALA source-bound lettering";
  if(rods.length){
    const matrices=new Float32Array(rods.length*16),colors=new Float32Array(rods.length*3);
    const a=new Vector3(),b=new Vector3(),direction=new Vector3(),up=new Vector3(0,1,0),size=new Vector3(),rotation=new Quaternion(),matrix=new Matrix4(),color=new Color();
    rods.forEach((r,i)=>{
      a.fromArray(r);b.fromArray(r,3);direction.subVectors(b,a);const length=direction.length();
      rotation.setFromUnitVectors(up,direction.normalize());
      matrix.compose(a.add(b).multiplyScalar(.5),rotation,size.set(r[6],length,r[6]));
      matrix.toArray(matrices,i*16);color.setHex(r[7]).toArray(colors,i*3);
    });
    mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=rods.length;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
  }
  return mesh;
}

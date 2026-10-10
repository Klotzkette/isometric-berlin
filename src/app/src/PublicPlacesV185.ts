import { appendSchoolPlaceV205 } from "./schoolsPlacesV205Batches";
import { Color, Group, InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import drawn from "./data/publicPlacesV185.json";
import native from "./data/publicPlacesV185Native.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Small independent members; old source models and their navigation stay live. */
export function createPublicPlacesV185(minecraft = false): Group {
  const root = new Group();
  root.name = "Ackerhalle, Rosenthaler Platz and Otto-Weidt-Platz refinements v185";
  root.userData = { additiveOnly: true, textureFree: true, nativeMinecraft: minecraft,
    keepInMinecraft: minecraft, fullStaticDetailOnTouch: true, sourceGeometryRetained: true };
  const rows = (minecraft ? native.boxes : drawn.boxes).map(row => [...row]);
  const rods: number[][] = minecraft ? [] : drawn.rods.map(row => [...row]);
  const a = new Vector3(), b = new Vector3();
  for (const label of drawn.labels) {
    const d = label.direction, c = label.center;
    for (const path of letteringStrokePaths(label.text, label.height)) {
      for (let i = 1; i < path.length; i++) {
        a.set(c[0]+d[0]*path[i-1][0],c[1]+path[i-1][1],c[2]+d[2]*path[i-1][0]);
        b.set(c[0]+d[0]*path[i][0],c[1]+path[i][1],c[2]+d[2]*path[i][0]);
        if (!minecraft) rods.push(...[[...a.toArray(),...b.toArray(),.065,label.color]]);
        else {
          const count = Math.max(1,Math.ceil(a.distanceTo(b)/.12));
          for(let j=0;j<count;j++) {
            const t=(j+.5)/count;
            rows.push([a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t,.12,.12,.12,label.color]);
          }
        }
      }
    }
  }
  const mesh = justicePalaceV183Boxes(rows,minecraft);
  if (rods.length) {
    const count=rows.length+rods.length;
    const matrices=new Float32Array(count*16), colors=new Float32Array(count*3);
    matrices.set(mesh.instanceMatrix.array); colors.set(mesh.instanceColor!.array);
    const matrix=new Matrix4(), rotation=new Quaternion(), size=new Vector3(), up=new Vector3(0,1,0), direction=new Vector3(), color=new Color();
    rods.forEach((row,i)=>{
      a.fromArray(row); b.fromArray(row,3); direction.subVectors(b,a);
      const length=direction.length(); rotation.setFromUnitVectors(up,direction.normalize());
      matrix.compose(a.add(b).multiplyScalar(.5),rotation,size.set(row[6],length,row[6]));
      matrix.toArray(matrices,(i+rows.length)*16);color.setHex(row[7]).toArray(colors,(i+rows.length)*3);
    });
    mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);
    mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.count=count;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();
  }
  mesh.name="Measured facade profiles, terracotta portal strokes and mapped stone seats";
  root.add(mesh);
  appendSchoolPlaceV205(root, "places", minecraft);
  return freezeStaticSceneTransforms(root);
}

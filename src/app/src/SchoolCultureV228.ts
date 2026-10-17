import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedBufferAttribute, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import source from "./data/schoolCultureV228.json";
import { justicePalaceV183Boxes } from "./justicePalaceV183Batches";
import { letteringStrokePaths } from "./drawnLettering";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

/** Five bounded recognition accents; no earlier envelope or pane is removed. */
export function createSchoolCultureV228(native = false): Group {
  const root = new Group();
  root.name = native ? "School culture v228 independent native recognition" : "School culture v228 source-bound recognition";
  root.userData = {schoolCultureV228:true,requiredBeforeNavigation:true,textureFree:true,additiveOnly:true,sourceGeometryRetained:true,fullStaticDetailOnTouch:true,blockNative:native,nativeMinecraft:native,keepInMinecraft:native,noHiddenSolidInfill:true};
  for (const site of source.sites) {
    const group = new Group();
    group.name = `${site.key}: ${site.name}`;
    group.userData = {...root.userData,siteKey:site.key,sourceOwner:site.owner};
    const rows = (native ? site.nativeRows : site.boxes).map(r=>[...r]);
    const rods = native ? [] : site.rods.map(r=>[...r]);
    for (const label of site.labels) {
      const {center:c,direction:d,normal:n}=label;
      for (const path of letteringStrokePaths(label.text,label.height)) for(let i=1;i<path.length;i++) {
        const a=[c[0]+d[0]*path[i-1][0],c[1]+path[i-1][1],c[2]+d[2]*path[i-1][0]];
        const b=[c[0]+d[0]*path[i][0],c[1]+path[i][1],c[2]+d[2]*path[i][0]];
        if (!native) rods.push([...a,...b,.045,label.color]);
        else {
          const steps=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))/.14));
          for(let j=0;j<steps;j++) {
            const t=(j+.5)/steps;
            rows.push([a[0]+(b[0]-a[0])*t+n[0]*1.2,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t+n[2]*1.2,.12,.12,.12,label.color]);
          }
        }
      }
    }
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
    if(!native&&site.sheets.length){
      const p:number[]=[],c:number[]=[],color=new Color();
      for(const s of site.sheets){
        color.setHex(s.color);
        for(const indices of [[0,1,2],[0,2,3]])for(const i of indices){p.push(...s.ring[i]);c.push(color.r,color.g,color.b);}
      }
      const geometry=new BufferGeometry();geometry.setAttribute("position",new Float32BufferAttribute(p,3));geometry.setAttribute("color",new Float32BufferAttribute(c,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
      const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.84,flatShading:true});
      const roof=new Mesh(geometry,day);roof.name=`${site.key}: documented missing roof and layered copper hood`;
      roof.userData={...group.userData,dayMaterial:day,nightMaterial:night,recognitionEstimate:true};group.add(roof);
    }
    root.add(group);
  }
  return freezeStaticSceneTransforms(root);
}

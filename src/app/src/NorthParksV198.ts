import {BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import drawnA from "./data/northParksV198Drawn0.json";
import drawnB from "./data/northParksV198Drawn1.json";
import nativeA from "./data/northParksV198Native0.json";
import nativeB from "./data/northParksV198Native1.json";
import {justicePalaceV183Boxes} from "./justicePalaceV183Batches";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {northParksV198GroundAt} from "./northParksV198Navigation";
export {northParksV198GroundAt} from "./northParksV198Navigation";

/** Source-bound northern parks; independent orthogonal native construction. */
export function createNorthParksV198(native=false):Group {
  const root=new Group();root.name="Schönhausen, mapped Panke and Schönholzer Heide v198";
  root.userData={northParksV198:true,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,keepInMinecraft:native,blockNative:native,additiveOnly:true,groundAt:(x:number,z:number)=>northParksV198GroundAt(x,z,native)};
  for(const model of (native?[nativeA,nativeB]:[drawnA,drawnB]))for(const cell of model.cells){
    if(cell.positions.length){
      const geometry=new BufferGeometry();
      geometry.setAttribute("position",new BufferAttribute(new Float32Array(cell.positions),3));
      geometry.setAttribute("color",new BufferAttribute(new Uint8Array(cell.colors),3,true));
      geometry.setIndex(cell.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
      const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9,flatShading:true});
      const mesh=new Mesh(geometry,day);mesh.name=`North parks v198 ${cell.id}: source terrain, paths and complete roofs`;
      mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,northParksV198:cell.id};root.add(mesh);
    }
    if(cell.boxes.length){const mesh=justicePalaceV183Boxes(cell.boxes,native);
      // Local palette matches the display-byte source surfaces. Reuse the final
      // instance buffer; no second copy or global colour-management override.
      const colors=mesh.instanceColor!.array;
      for(let i=0;i<cell.boxes.length;i++){const rgb=cell.boxes[i][native?6:7];colors[i*3]=((rgb>>16)&255)/255;colors[i*3+1]=((rgb>>8)&255)/255;colors[i*3+2]=(rgb&255)/255;}
      mesh.name=`North parks v198 ${cell.id}: bounded architecture and mapped barriers`;root.add(mesh);}
  }
  return freezeStaticSceneTransforms(root);
}

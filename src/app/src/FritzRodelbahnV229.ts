import {BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from "three";
import source from "./data/fritzRodelbahnV229.json";
import {justicePalaceV183Boxes} from "./justicePalaceV183Batches";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {fritzRodelbahnGroundAtV229} from "./fritzRodelbahnV229Navigation";

/** Mapped grass sled slope, on the existing actual hill rather than a second hill. */
export function createFritzRodelbahnV229(native=false):Group {
  const root=new Group();root.name="Fritz-Schloß-Park: kartierte Rodelbahn";
  root.userData={fritzRodelbahnV229:true,requiredBeforeNavigation:true,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,keepInMinecraft:native,blockNative:native,groundAt:(x:number,z:number)=>fritzRodelbahnGroundAtV229(x,z,native)};
  if(native){
    const rows=source.models[1].boxes!;
    const mesh=justicePalaceV183Boxes(rows,true);mesh.name="Fritz Rodelbahn: independent horizontal grass cells";root.add(mesh);
  }else{
    const model=source.models[0],geometry=new BufferGeometry();
    geometry.setAttribute("position",new BufferAttribute(new Float32Array(model.positions!),3));geometry.setIndex(model.indices!);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({color:0x8D9D6B,side:DoubleSide}),night=new MeshStandardMaterial({color:0x8D9D6B,side:DoubleSide,roughness:1});
    const mesh=new Mesh(geometry,day);mesh.name="Fritz Rodelbahn: exact OSM grass outline following the measured hill";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
  }
  return freezeStaticSceneTransforms(root);
}

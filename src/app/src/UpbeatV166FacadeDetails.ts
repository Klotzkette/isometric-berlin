import { BoxGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import { upbeatV166DetailBoxes } from "./upbeatV166Details";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export const UPBEAT_V166_FACADE_GROUP="Upbeat current facade fluting and terrace detail";
/** Additive detail only: the existing source-bound campus owns every shell. */
export function createUpbeatV166FacadeDetails(_options:{mobileLike?:boolean}={}):Group{
 const rows=upbeatV166DetailBoxes(),root=new Group();root.name=UPBEAT_V166_FACADE_GROUP;
 const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute("uv");
 const day=new MeshBasicMaterial({color:0xffffff}),night=new MeshStandardMaterial({color:0xffffff,roughness:.76,flatShading:true});
 const mesh=new InstancedMesh(geometry,day,0),matrix=new Matrix4(),color=new Color();
 const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
 rows.forEach((r,i)=>{matrix.makeRotationY(r.yaw);matrix.scale(new Vector3(...r.size));matrix.setPosition(...r.position);matrix.toArray(matrices,i*16);color.setHex(r.color).toArray(colors,i*3);});
 mesh.count=rows.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
 mesh.name="Instanced Upbeat fluted metal dark spandrels and lower terrace rails";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,sourceRole:"OSM footprint and retained published tiers; procedural facade relief"};
 root.userData={textureFree:true,additiveFacadeOnly:true,sourceOSMWayId:"1214009386",instances:rows.length};root.add(mesh);return freezeStaticSceneTransforms(root);
}

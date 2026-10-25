import {BufferAttribute,BufferGeometry,DoubleSide,Group,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import data from './data/golgathaV270.json';
import {GOLGATHA_V270_PROFILE} from './golgathaV270Profile';
import {markArchitecturalInk} from './architecturalInk';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';

const decoded=(text:string):ArrayBuffer=>Uint8Array.from(atob(text),c=>c.charCodeAt(0)).buffer;

/** Required complete upper-tower correction plus every clipped lower source
 * complement. Construct the complete group before enabling packet transfers. */
export function createGolgathaV270(native=false):Group{
 const root=new Group();root.name=`Golgathakirche evidenced tower v270${native?' native':''}`;
 for(const [i,p] of (native?data.native:data.drawn).entries()){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Uint16Array(decoded(p.positions)),3));
  geometry.setAttribute('color',new BufferAttribute(new Uint8Array(decoded(p.colors)),3,true));
  geometry.setIndex(new BufferAttribute(new Uint32Array(decoded(p.indices)),1));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
  const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9});
  const mesh=new Mesh(geometry,day);mesh.position.set(...data.origin as [number,number,number]);mesh.scale.setScalar(.01);
  mesh.name=i?'Photo-evidenced belfry, clock gables and slate helm':'Unchanged clipped lower source sheets';
  mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,sourceOwnerIds:['DEBE01YYK000002g'],nativeMinecraft:native,blockNative:native,keepInMinecraft:native};root.add(mesh);
 }
 if(!native&&data.lowerLines.length){
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(data.lowerLines.flat(2)),3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const lines=new LineSegments(geometry,markArchitecturalInk(new LineBasicMaterial(),'silhouette'));
  lines.name='Unchanged lower segments of transferred source ink';root.add(lines);
 }
 root.userData={...GOLGATHA_V270_PROFILE,requiredBeforeNavigation:true,textureFree:true,fullStaticDetailOnTouch:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,originalSourceSheetsRetained:true,sourceXZPreserved:!native};
 return freezeStaticSceneTransforms(root);
}

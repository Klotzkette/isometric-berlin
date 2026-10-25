import {BufferAttribute,BufferGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import data from './data/moabitLandmarksV269.json';
import {MOABIT_LANDMARKS_V269_PROFILE} from './MoabitLandmarksV269Profile';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
const decoded=(text:string):ArrayBuffer=>Uint8Array.from(atob(text),c=>c.charCodeAt(0)).buffer;

/** Required complete two-church replacement. No constructor buffer is retained on roots.
 * Original core owners may yield only after this entire construction succeeds. */
export function createMoabitLandmarksV269(native=false):Group{
 const root=new Group();root.name=`Moabit complete churches v269${native?' native':''}`;
 for(const site of data.sites){
  const p=native?site.native:site.drawn,g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(new Uint16Array(decoded(p.positions)),3));
  g.setAttribute('color',new BufferAttribute(new Uint8Array(decoded(p.colors)),3,true));
  g.setIndex(new BufferAttribute(new Uint32Array(decoded(p.indices)),1));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.88});
  const mesh=new Mesh(g,day);mesh.name=site.name;mesh.position.set(...site.origin as [number,number,number]);mesh.scale.setScalar(.01);
  mesh.userData={dayMaterial:day,nightMaterial:night,requiredBeforeNavigation:true,textureFree:true,sourceSheetsRetained:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,siteKey:site.key};root.add(mesh);
 }
 root.userData={...MOABIT_LANDMARKS_V269_PROFILE,requiredBeforeNavigation:true,sourceSheetsRetained:true,sourceXZPreserved:true,textureFree:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native};
 return freezeStaticSceneTransforms(root);
}

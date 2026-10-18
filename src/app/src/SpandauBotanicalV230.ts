import {BoxGeometry,BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,Quaternion,Vector3} from 'three';
import data from './data/spandauBotanicalV230.json';
import {freezeStaticSceneTransforms} from './staticSceneTransforms';
import {justicePalaceV183Boxes} from './justicePalaceV183Batches';

/** The selected interpretation only: finite source scope, shared static buffers. */
export function createSpandauBotanicalV230(native=false):Group{
 const root=new Group();root.name='Spandau and Botanischer Volkspark source refinements v230';
 root.userData={spandauBotanicalV230:true,textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native};
 const tint=new Color(),matrix=new Matrix4(),a=new Vector3(),b=new Vector3(),d=new Vector3(),up=new Vector3(0,1,0),q=new Quaternion(),scale=new Vector3();
 for(const s of data.sites){
  const group=new Group();group.name=s.key;group.userData={independentCulling:true,keepInMinecraft:native};
  if(native&&s.native.length){const mesh=justicePalaceV183Boxes(s.native,true);mesh.name=s.key+': independent orthogonal surfaces';mesh.userData.fullStaticDetailOnTouch=true;group.add(mesh);}
  if(!native&&s.positions.length){
   const geometry=new BufferGeometry(),colors=new Uint8Array(s.colors.length*3);
   s.colors.forEach((c,i)=>{tint.setHex(c);colors.set([Math.round(tint.r*255),Math.round(tint.g*255),Math.round(tint.b*255)],i*3);});
   geometry.setAttribute('position',new BufferAttribute(new Float32Array(s.positions),3));geometry.setAttribute('color',new BufferAttribute(colors,3,true));
   geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9,flatShading:true});
   const mesh=new Mesh(geometry,day);mesh.name=s.key+': retained measured sheets';mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true};group.add(mesh);
  }
  if(!native&&s.boxes.length){
   const geo=new BoxGeometry(1,1,1);geo.deleteAttribute('uv');
   const day=new MeshBasicMaterial(),night=new MeshStandardMaterial({roughness:.88,flatShading:true}),mesh=new InstancedMesh(geo,day,0);
   const matrices=new Float32Array(s.boxes.length*16),colors=new Float32Array(s.boxes.length*3);
   s.boxes.forEach((r,i)=>{a.fromArray(r);b.fromArray(r,3);d.subVectors(b,a);const length=d.length();q.setFromUnitVectors(up,d.normalize());matrix.compose(a.add(b).multiplyScalar(.5),q,scale.set(r[6],length,r[6]));matrix.toArray(matrices,i*16);tint.setHex(r[7]).toArray(colors,i*3);});
   mesh.count=s.boxes.length;mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);mesh.computeBoundingBox();mesh.computeBoundingSphere();
   mesh.name=s.key+': bounded frames and planting';mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true};group.add(mesh);
  }
  root.add(group);
 }
 return freezeStaticSceneTransforms(root);
}

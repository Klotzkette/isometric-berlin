import {BufferAttribute,InstancedMesh,Mesh,Object3D} from 'three';
import receipt from './data/citadelCrownV230Previous.json';

/** Exact old-source vertices/instances only; fail closed if the owner changes. */
export function applyCitadelCrownV230(root:Object3D,native=false):number{
 if(root.userData.citadelCrownV230)return 0;
 let count=0;
 root.traverse(o=>{
  if(native&&o instanceof InstancedMesh&&o.name==='Zitadelle: independent block surface interpretation'){
   if(o.count!==receipt.nativeCount)return;
   const a=o.instanceMatrix.array;
   if(!receipt.nativeRows.every(([i,x,y,z,w,h,d])=>[a[i*16],a[i*16+5],a[i*16+10],a[i*16+12],a[i*16+13],a[i*16+14]].every((v,j)=>v===Math.fround([w,h,d,x,y,z][j]))))return;
   for(const[i,,y,,,h]of receipt.nativeRows){const top=Math.min(y+h/2,receipt.capY),bottom=y-h/2>=receipt.capY?top-h:y-h/2;a[i*16+5]=top-bottom;a[i*16+13]=(bottom+top)/2;count++;}
   o.instanceMatrix.needsUpdate=true;o.computeBoundingBox();o.computeBoundingSphere();
  }else if(!native&&o instanceof Mesh&&o.name==='Zitadelle: retained source sheets and mapped grounds'){
   const p=o.geometry.getAttribute('position')as BufferAttribute;
   if(p.count!==receipt.drawnVertexCount||!receipt.drawnVertices.every(([i,x,y,z])=>p.getX(i)===Math.fround(x)&&p.getY(i)===Math.fround(y)&&p.getZ(i)===Math.fround(z)))return;
   for(const[i]of receipt.drawnVertices){p.setY(i,receipt.capY);count++;}
   p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  }
 });
 if(count)root.userData.citadelCrownV230=true;
 return count;
}

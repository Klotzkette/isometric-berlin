import {Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Mesh} from 'three';
/** Extract the retained Dom and bowl contributions; Altes lies entirely west of x=1950. */
export function domAndBowlContributions(root:Group):Group {
 const kept=new Group();kept.name='Unchanged Berliner Dom and granite bowl';
 for(const child of root.children){
  if(child.name.startsWith('Berliner Dom')||child.name.startsWith('Granitschale')){const clone=child.clone();clone.userData=child.userData;kept.add(clone);}
  else if(child instanceof InstancedMesh){
   const matrix=new Matrix4(),matrices:number[]=[],colors:number[]=[];
   for(let i=0;i<child.count;i++){
    child.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];
    // The bowl's three supports/viewing steps lie within its explicit 4.42 m
    // disk; distinct Altes sculptures are more than 19 m from this disk.
    if(x<=1950&&Math.hypot(x-1880.092031,z-19.330824)>4.5)continue;
    matrices.push(...matrix.elements);if(child.instanceColor)colors.push(child.instanceColor.getX(i),child.instanceColor.getY(i),child.instanceColor.getZ(i));
   }
   if(!matrices.length)continue;const mesh=new InstancedMesh(child.geometry,child.material,0);mesh.name=child.name;mesh.userData=child.userData;
   mesh.instanceMatrix=new InstancedBufferAttribute(new Float32Array(matrices),16);mesh.instanceColor=colors.length?new InstancedBufferAttribute(new Float32Array(colors),3):null;mesh.count=matrices.length/16;mesh.matrix.copy(child.matrix);mesh.matrixAutoUpdate=false;kept.add(mesh);
  }else if(child instanceof Mesh&&child.name!=='Altes Museum retained LoD2 wings and courts')throw Error('Unexpected shared family mesh '+child.name);
 }return kept;
}

import { createMuseumTriadArchitecture } from '../src/MuseumTriadArchitecture';
import { Mesh, InstancedMesh } from 'three';
export function snapshot(minecraft:boolean,mobileLike:boolean){
 const rows:string[]=[],triangles:string[]=[]; let instances=0;
 createMuseumTriadArchitecture({minecraft,mobileLike}).traverse(o=>{
  if(!(o instanceof Mesh))return;
  const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal'),c=o.geometry.getAttribute('color');
  if(o instanceof InstancedMesh){instances+=o.count;for(let i=0;i<o.count;i++)rows.push(JSON.stringify([p.count,Array.from(o.instanceMatrix.array.slice(i*16,i*16+16)),Array.from(o.instanceColor!.array.slice(i*3,i*3+3))]));}
  else for(let i=0;i<p.count;i+=3)triangles.push(JSON.stringify([Array.from(p.array.slice(i*3,i*3+9)),Array.from(n.array.slice(i*3,i*3+9)),Array.from(c.array.slice(i*3,i*3+9))]));
 });
 return {instances,triangles:triangles.length,instanceHash:new Bun.CryptoHasher('sha256').update(rows.sort().join('\n')).digest('hex'),surfaceHash:new Bun.CryptoHasher('sha256').update(triangles.sort().join('\n')).digest('hex')};
}
if(import.meta.main)console.log(JSON.stringify([false,true].flatMap(minecraft=>[false,true].map(mobileLike=>({minecraft,mobileLike,...snapshot(minecraft,mobileLike)}))),null,2));

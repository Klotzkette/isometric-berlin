import {BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedMesh,Mesh,MeshBasicMaterial,MeshStandardMaterial,type Object3D} from "three";
import type {PrismBuilding} from "./IsometricCityWorld";
import type {VoxelPayload} from "./terrainPayload";
import data from "./data/openSitesV346.json";
import {justicePalaceV183Boxes} from "./justicePalaceV183Batches";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import {staticStorageInfo} from "./losslessStaticStorage";
import {schwellenraumMaterialFor} from "./visual-modes/schwellenraum/materialGrade";
export type OpenSiteKeyV346="hellweg"|"humboldthain";
const signature=(p:any)=>JSON.stringify([p.id,p.ring,p.holes??[],p.y0_dm,p.h_dm,p.class,p.roof,p.tone]);
const siteFor=(key:OpenSiteKeyV346)=>data.sites.find(site=>site.key===key)!;
export function openSiteSourceAdmittedV346(prisms:readonly PrismBuilding[],key:OpenSiteKeyV346,voxels?:VoxelPayload):boolean{
 const site=siteFor(key);const match=prisms.filter(p=>p.id===site.source.id);
 if(match.length!==1||signature(match[0])!==signature(site.source))return false;
 if(!voxels)return true;
 if(voxels.cell_m!==site.cellM)return false;
 // Complete original five-word tuples; no XY-only test and no spatial erasure.
 return site.nativeColumns.every(([x,z,lo,hi,kind])=>voxels.building_rows?.[z-voxels.grid.min_z_idx]?.some(
  ([start,count,a,b,k])=>x-voxels.grid.min_x_idx>=start&&x-voxels.grid.min_x_idx<start+count&&a===lo&&b===hi&&k===kind)??
  voxels.buildings?.some(row=>JSON.stringify(row)===JSON.stringify([x,z,lo,hi,kind])));
}
const decode=(s:string)=>{const raw=atob(s),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return u.buffer;};
function drawnShell(site:typeof data.sites[number]):Mesh{
 const p=new Float32Array(decode(site.drawnPositions)),tones=new Uint32Array(decode(site.drawnColors)),colors=new Float32Array(p.length),color=new Color();
 for(let i=0;i<tones.length;i++){color.setHex(tones[i]);for(let j=0;j<3;j++)color.toArray(colors,i*9+j*3);}
 const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(p,3));geometry.setAttribute("color",new BufferAttribute(colors,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.9,flatShading:true});
 const mesh=new Mesh(geometry,day);mesh.name=`${site.name}: complete official wall and roof sheets`;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};return mesh;
}
/** These are complete new measured bodies, never free-floating fittings tied
 * only to a separately evictable legacy prism. Every old source is retained. */
export function createOpenSitesV346(prisms:readonly PrismBuilding[],voxels?:VoxelPayload):Group{
 const root=new Group(),native=Boolean(voxels);root.name="Measured Hellweg and Humboldthain reception v346";
 const admitted:string[]=[];
 for(const site of data.sites){
  if(!openSiteSourceAdmittedV346(prisms,site.key as OpenSiteKeyV346,voxels))continue;
  const group=new Group();group.name=site.name;
  if(native){const a=new Float32Array(decode(site.nativeBodies)),rows:number[][]=[];for(let i=0;i<a.length;i+=7)rows.push(Array.from(a.slice(i,i+7)));const mesh=justicePalaceV183Boxes(rows,true);mesh.name=`${site.name}: independent one-metre cells, exact equal-height run merging`;group.add(mesh);}
  else group.add(drawnShell(site));
  group.userData={openSiteV346:site.key,sourceId:site.source.id,completeParts:site.parts.map(p=>p.id),sourceGroundY:site.sourceGroundY,displayOffsetY:site.displayOffsetY,sourceXZRetained:true,relativeSourceHeightsRetained:true,olderSourcePreserved:true,blockNative:native,keepInMinecraft:native,nativeMinecraft:native,fullStaticDetailOnTouch:true};
  root.add(group);admitted.push(site.source.id);
 }
 root.userData={openSitesV346:true,sourceIds:admitted,sourceGeometryRetained:true,blockNative:native,keepInMinecraft:native,nativeMinecraft:native,fullStaticDetailOnTouch:true};
 freezeStaticSceneTransforms(root);
 sealComplete(root,native);
 return root;
}

function inRing(r:number[][],x:number,z:number):boolean{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function roofAt(tris:number[][][],x:number,z:number):number|null{
 let height:number|null=null;for(const[a,b,c]of tris){const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;if(Math.min(u,v,1-u-v)>=-1e-6){const y=u*a[1]+v*b[1]+(1-u-v)*c[1];height=height===null?y:Math.max(height,y);}}return height;
}
export function openSiteSolidsV346(key:OpenSiteKeyV346,native=false){
 const site=siteFor(key);return site.parts.map(part=>{
  const cells=native?new Map(part.nativeCells.map(([x,z,t])=>[`${x}/${z}`,t])):null;
  const x0=Math.min(...part.nativeCells.map(p=>p[0])),z0=Math.min(...part.nativeCells.map(p=>p[1])),x1=Math.max(...part.nativeCells.map(p=>p[0]))+1,z1=Math.max(...part.nativeCells.map(p=>p[1]))+1;
  return {sourceId:`open-sites-v346-${part.id}`,ring:native?[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]:part.ring,holes:native?[]:part.holes,minY:part.minY,maxY:native?Math.max(...part.nativeCells.map(p=>p[2])):part.maxY,
   topAt:(x:number,z:number)=>cells?cells.get(`${Math.floor(x)}/${Math.floor(z)}`)??null:inRing(part.ring,x,z)&&!part.holes.some(h=>inRing(h,x,z))?roofAt(part.roofTriangles,x,z):null,
  };
 });
}

const complete=new WeakMap<Group,{native:boolean;valid:()=>boolean}>();
function sealComplete(root:Group,native:boolean):void {
  const nodes:Object3D[]=[];root.traverse(node=>nodes.push(node));
  const checks=nodes.map(node=>{
    const parent=node.parent,matrix=node.matrix.toArray();
    if(!(node instanceof Mesh))return ()=>node.visible&&node.parent===parent&&node.matrix.elements.every((v,i)=>v===matrix[i])&&node.position.x===0&&node.position.y===0&&node.position.z===0&&node.scale.x===1&&node.scale.y===1&&node.scale.z===1&&node.quaternion.x===0&&node.quaternion.y===0&&node.quaternion.z===0&&node.quaternion.w===1;
    const mesh=node,geometry=mesh.geometry,day=mesh.userData.dayMaterial,night=mesh.userData.nightMaterial,grade=schwellenraumMaterialFor(mesh,day);
    const attributes=[...Object.values(geometry.attributes),...(geometry.index?[geometry.index]:[]),...(mesh instanceof InstancedMesh?[mesh.instanceMatrix,...(mesh.instanceColor?[mesh.instanceColor]:[])]:[])];
    const saved=attributes.map(a=>({a,version:a.version,count:a.count,itemSize:a.itemSize,storage:staticStorageInfo(a)}));
    const count=mesh instanceof InstancedMesh?mesh.count:0,index=geometry.index,range=geometry.drawRange.count;
    return ()=>mesh.visible&&mesh.parent===parent&&mesh.geometry===geometry&&geometry.index===index&&geometry.drawRange.start===0&&geometry.drawRange.count===range&&
      [day,night,grade].includes(mesh.material)&&mesh.userData.dayMaterial===day&&mesh.userData.nightMaterial===night&&
      mesh.matrix.elements.every((v,i)=>v===matrix[i])&&mesh.position.x===0&&mesh.position.y===0&&mesh.position.z===0&&mesh.scale.x===1&&mesh.scale.y===1&&mesh.scale.z===1&&mesh.quaternion.x===0&&mesh.quaternion.y===0&&mesh.quaternion.z===0&&mesh.quaternion.w===1&&
      (!(mesh instanceof InstancedMesh)||mesh.count===count)&&saved.every(r=>{const t=staticStorageInfo(r.a);return r.a.version===r.version&&r.a.count===r.count&&r.a.itemSize===r.itemSize&&t.arrayIdentity===r.storage.arrayIdentity&&t.bufferIdentity===r.storage.bufferIdentity&&t.byteLength===r.storage.byteLength&&t.bufferBytes===r.storage.bufferBytes;})&&
      Object.values(geometry.attributes).every(a=>attributes.includes(a))&&Object.keys(geometry.attributes).length===saved.length-(index?1:0)-(mesh instanceof InstancedMesh?(mesh.instanceColor?2:1):0)&&
      (!(mesh instanceof InstancedMesh)||attributes.includes(mesh.instanceMatrix)&&(!mesh.instanceColor||attributes.includes(mesh.instanceColor)));
  });
  // The root may be attached to its family after construction. Its private
  // receipt deliberately checks all descendants, not an editable marker.
  complete.set(root,{native,valid:()=>{const current:Object3D[]=[];root.traverse(n=>current.push(n));return root.visible&&root.matrix.elements.every((v,i)=>v===(i%5===0?1:0))&&root.position.lengthSq()===0&&root.scale.x===1&&root.scale.y===1&&root.scale.z===1&&root.quaternion.x===0&&root.quaternion.y===0&&root.quaternion.z===0&&root.quaternion.w===1&&current.length===nodes.length&&current.every((n,i)=>n===nodes[i])&&checks.slice(1).every(check=>check());}});
  root.traverse(node=>{if(node instanceof Mesh)node.geometry.addEventListener("dispose",()=>complete.delete(root));});
}
export function hasCompleteOpenSitesV346(root:Group,native:boolean):boolean{const r=complete.get(root);return !!r&&r.native===native&&r.valid();}

/** World-owned collision callbacks use the same full source roofs as the visible
 * body. Disposed, detached, hidden or changed models immediately yield nothing. */
export function createOpenSitesNavigationV346(world:Group,model:Group,native:boolean){
 const admitted=new Set(model.children.map(child=>child.userData.openSiteV346));
 const solids=data.sites.filter(site=>admitted.has(site.key)).flatMap(site=>openSiteSolidsV346(site.key as OpenSiteKeyV346,native)).map(solid=>({
  ...solid,x0:Math.min(...solid.ring.map(p=>p[0])),x1:Math.max(...solid.ring.map(p=>p[0])),z0:Math.min(...solid.ring.map(p=>p[1])),z1:Math.max(...solid.ring.map(p=>p[1])),
 }));
 const candidates=(x:number,z:number,r=0)=>solids.filter(s=>x+r>=s.x0&&x-r<=s.x1&&z+r>=s.z0&&z-r<=s.z1);
 const visible=()=>world.visible&&model.parent===world&&hasCompleteOpenSitesV346(model,native);
 return {
  groundAt:(x:number,z:number,current?:number):number|null=>{
   const selected=candidates(x,z);if(!selected.length||!visible())return null;
   let top:number|null=null;for(const s of selected){const y=s.topAt(x,z);if(y!==null&&(current===undefined||current>=y-.65)&&(top===null||y>top))top=y;}return top;
  },
  solidAt:(x:number,y:number,z:number,r=0):boolean=>{
   const selected=candidates(x,z,r);if(!selected.length||!visible())return false;
   return selected.some(s=>y>=s.minY-.02&&y<s.maxY+.26&&[[x,z],...(r>0?[[x-r,z],[x+r,z],[x,z-r],[x,z+r]]:[])].some(([px,pz])=>{const top=s.topAt(px,pz);return top!==null&&y<top-.015;}));
  },
 };
}

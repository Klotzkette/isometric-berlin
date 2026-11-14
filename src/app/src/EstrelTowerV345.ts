import {BufferAttribute,BufferGeometry,Color,DoubleSide,Group,InstancedMesh,Mesh,MeshBasicMaterial,MeshStandardMaterial,Object3D} from "three";
import {GendarmenmarktFacadeBuilder,type PerimeterFacadeEdge,perimeterEdgeLength} from "./GendarmenmarktFacadeBuilder";
import {freezeStaticSceneTransforms} from "./staticSceneTransforms";
import data from "./data/estrelTowerV345.json";

import {estrelNativeCellsV345,estrelRoofYV345,estrelRoofTrianglesV345,type EstrelPartV345 as Part} from "./EstrelTowerV345Navigation";
import {staticStorageInfo} from "./losslessStaticStorage";
import {schwellenraumMaterialFor} from "./visual-modes/schwellenraum/materialGrade";
export {estrelRoofYV345,estrelTowerSolidsV345} from "./EstrelTowerV345Navigation";
const BASE=data.groundY,GLASS=0x667b7f,FRAME=0xb5bfbd,DARK=0x394a50;

function edges(part:Part):PerimeterFacadeEdge[]{
  const area=part.ring.reduce((n,a,i)=>{const b=part.ring[(i+1)%part.ring.length];return n+a[0]*b[1]-b[0]*a[1];},0);
  return part.ring.map((a,i)=>({startXZ:a,endXZ:part.ring[(i+1)%part.ring.length],outwardSide:area>0?-1:1,
    wallBaseY:BASE,wallTopY:BASE+part.height,street:"Estrel Tower, Sonnenallee 228",prismId:part.id}));
}

/** A finite current OSM building-part model, corroborated by the architect's
 * built August 2026 exterior. No old hotel or source packet is retired. */
export function createEstrelTowerV345(native=false):Group {
  const root=new Group(),b=new GendarmenmarktFacadeBuilder(native,false,0),positions:number[]=[],colors:number[]=[];
  const color=new Color();
  const tri=(a:number[],c:number[],d:number[],tone:number)=>{color.setHex(tone);for(const p of[a,c,d]){
    positions.push(...p);colors.push(color.r,color.g,color.b);
  }};
  for(const part of data.parts){
    const tower=part.kind==="tower",atrium=part.kind==="atrium",podium=part.kind==="podium",canopy=part.kind==="canopy",plinth=part.kind==="plinth",glass=atrium?0x8b9b9a:canopy?0x91a8a6:plinth?0xaeb4ad:podium?0xbcc2be:GLASS;
    if(!native){
      const top=part.ring.map(([x,z])=>[x,estrelRoofYV345(part,x,z),z]);
      const roofTriangles=estrelRoofTrianglesV345(part);
      roofTriangles.forEach(([a,c,d],i)=>{
        if(!atrium){tri(a,c,d,podium?0xb0b8b5:plinth?0xb6bcb5:canopy?0x91a8a6:0x879492);return;}
        const n=4,p=(u:number,v:number)=>a.map((x,k)=>x+(c[k]-x)*u/n+(d[k]-x)*v/n);
        for(let u=0;u<n;u++)for(let v=0;v<n-u;v++){
          tri(p(u,v),p(u+1,v),p(u,v+1),(u+v+i)%2?0x8ca3a0:0x5d7a7d);
          if(u+v<n-1)tri(p(u+1,v),p(u+1,v+1),p(u,v+1),(u+v+i)%2?0x5d7a7d:0x8ca3a0);
        }
      });
      if(canopy)for(const [a,c,d]of estrelRoofTrianglesV345(part,true))tri(a,d,c,0x738b90);
      edges(part).forEach((e,i)=>{
        const a=e.startXZ,c=e.endXZ,ta=top[i],tc=top[(i+1)%top.length],length=perimeterEdgeLength(e);
        const lowA=canopy?ta[1]-.18:BASE,lowC=canopy?tc[1]-.18:BASE;
        tri([a[0],lowA,a[1]],[c[0],lowC,c[1]],tc,glass);tri([a[0],lowA,a[1]],tc,ta,glass);
        if(canopy||plinth){b.beam([ta[0],ta[1]+.025,ta[2]],[tc[0],tc[1]+.025,tc[2]],canopy?.10:.12,canopy?FRAME:0xc4c8bf);return;}
        const bays=Math.max(1,Math.round(length/(tower?1.75:podium?1.2:2.5)));
        for(let bay=0;bay<=bays;bay++){
          const u=length*bay/bays,x=a[0]+(c[0]-a[0])*bay/bays,z=a[1]+(c[1]-a[1])*bay/bays;
          const top=estrelRoofYV345(part,x,z)-.10;
          b.face(e,u,(BASE+top)/2,podium?.045:.07,top-BASE,podium?.075:.16,podium?0xa2aca9:FRAME,.12);
        }
        if(podium)b.face(e,length/2,BASE+.65,length,1.3,.06,0x5b6669,.13);
        const floorHeight=tower?3.6:3.8;
        if(!podium)for(let y=BASE+floorHeight;y<BASE+part.height;y+=floorHeight){
          // Each short transom terminates below the sloping roof, including
          // the upper triangular face; no rectangular facade floats above it.
          for(let bay=0;bay<bays;bay++){
            const f=(bay+.5)/bays,u=length*f,x=a[0]+(c[0]-a[0])*f,z=a[1]+(c[1]-a[1])*f;
            if(y+.12<estrelRoofYV345(part,x,z)-.5)b.face(e,u,y,length/bays,.11,.12,DARK,.15);
          }
        }
        // Photograph: paired slender aluminium ribbons change lean over
        // several storeys. Their pitch is an explicit visual estimate.
        if(tower)for(let bay=1;bay<bays;bay++)for(let y=BASE+4;y<BASE+150;y+=10.8){
          const u=length*bay/bays,lean=(Math.floor((y-BASE)/10.8)%2?-.30:.30);
          for(const sign of[-1,1]){
            const lower=b.point(e,u+sign*.10-lean,y,.23),upper=b.point(e,u+sign*.10+lean,y+10.8,.23);
            const cap=estrelRoofYV345(part,upper[0],upper[2])-.25;
            if(y+.2>=cap)continue;
            if(upper[1]>cap){const f=(cap-y)/10.8;upper[0]=lower[0]+(upper[0]-lower[0])*f;upper[2]=lower[2]+(upper[2]-lower[2])*f;upper[1]=cap;}
            b.beam(lower,upper,.055,0xc1c9c6);
          }
        }
        b.beam([ta[0],ta[1]+.04,ta[2]],[tc[0],tc[1]+.04,tc[2]],.18,FRAME);
      });
    }else{
      // Independently sample the actual footprint. No rotated Drawn panels
      // or multi-storey diagonal beams are used in Native.
      const cell=2,cells=estrelNativeCellsV345(part);
      for(const key of cells){
        const [ix,iz]=key.split("/").map(Number),x=(ix+.5)*cell,z=(iz+.5)*cell,top=estrelRoofYV345(part,x,z);
        const bottom=canopy?top-.18:BASE;
        b.box([x,(bottom+top)/2,z],[cell,top-bottom,cell],glass);
        b.box([x,top+.035,z],[cell,.07,cell],podium?0xb0b8b5:plinth?0xb6bcb5:canopy?0x91a8a6:atrium?((ix+iz)%2?0x8ca3a0:0x5d7a7d):0x879492);
        for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]])if(!cells.has(`${ix+dx}/${iz+dz}`)){
          const cx=x+dx*(cell/2+.045),cz=z+dz*(cell/2+.045);
          if(canopy||plinth){b.box([cx,top+.025,cz],[dx?.10:cell,.10,dx?cell:.10],canopy?FRAME:0xc4c8bf);continue;}
          b.box([cx,(BASE+top)/2,cz],[dx?.09:.07,top-BASE,dx?.07:.09],podium?0xa2aca9:FRAME);
          if(podium)b.box([cx,BASE+.65,cz],[dx?.09:cell,1.3,dx?cell:.09],0x5b6669);
          if(!podium)for(let y=BASE+3.6;y<top-.3;y+=3.6)b.box([cx,y,cz],[dx?.12:cell,.11,dx?cell:.12],DARK);
          if(tower)for(let y=BASE+4;y<Math.min(top-1,BASE+161);y+=1.8){
            const lean=(Math.floor((y-BASE)/10.8)%2?-.22:.22);
            b.box([cx+(dx?0:lean),y,cz+(dz?0:lean)],[dx?.16:.065,1.8,dx?.065:.16],0xc1c9c6);
          }
        }
      }
    }
  }
  if(positions.length){
    const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array(positions),3));
    geometry.setAttribute("color",new BufferAttribute(new Float32Array(colors),3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide}),night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.60});
    const mesh=new Mesh(geometry,day);mesh.name="Estrel exact mapped tower and podium sloping envelopes";mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true};root.add(mesh);
  }
  root.add(b.finish("Estrel aluminium fins, curtain wall grid and independent Native body v345"));
  root.name="Estrel Tower and mapped podium v345";
  root.userData={estrelTowerV345:true,sourceParts:data.parts.map(p=>p.id),sourceHeightM:176,sourceFootprintsRetained:true,
    documentedSoftOpening:"2026-12-01",openOnAuditDate:false,fullStaticDetailOnTouch:true,textureFree:true,
    nativeMinecraft:native,blockNative:native,keepInMinecraft:native,facadePitchEstimated:true,groundDatumEstimated:true};
  freezeStaticSceneTransforms(root);
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
  return root;
}

const complete=new WeakMap<Group,{native:boolean;valid:()=>boolean}>();
export function hasCompleteEstrelTowerV345(root:Group,native:boolean):boolean{const r=complete.get(root);return !!r&&r.native===native&&r.valid();}

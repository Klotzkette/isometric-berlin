import {
  BoxGeometry, BufferGeometry, Color, EdgesGeometry, ExtrudeGeometry,
  Float32BufferAttribute, Group, InstancedMesh, Matrix4, MeshBasicMaterial,
  Shape, Vector3,
} from "three";
import { createBuilder, finishDrawnGroup, paintGeometry, type Builder } from "./drawnKit";
import { fitZollpackhofRoof, zollpackhofHipRoof } from "./zollpackhofRoof";
import { pointInWorldRing } from "./chancelleryExtensionProfile";
import { ZOLLPACKHOF_PARTS, ZOLLPACKHOF_PROFILE } from "./zollpackhofProfile";

type Point = [number, number, number];
type Part = { p: Point; size: Point; yaw: number; color: number; arch?: boolean };
const C = { plaster:0xe9e2d1, trim:0xf1ebda, roof:0xa55b3c, tile:0x8f4a33,
  glass:0x31454b, frame:0x39413f, metal:0x8e9d91, stone:0xb3a68d, light:0xe8c78e };

function facadeParts(): {parts: Part[]; counts: Record<string, number>} {
  const parts: Part[] = [];
  const counts = { archedEntrance:1, archedWindows:0, dormers:0, lamps:0, sourceParts:2 };
  ZOLLPACKHOF_PARTS.forEach((profile, buildingIndex) => {
    const ring = profile.ring;
    let area = 0;
    ring.forEach(([x,z],i) => {const next=ring[(i+1)%ring.length]; area+=x*next[1]-next[0]*z;});
    const flip = area >= 0 ? 1 : -1;
    ring.forEach(([x,z],i) => {
      const next=ring[(i+1)%ring.length];
      const length=Math.hypot(next[0]-x,next[1]-z);
      if(length<2) return;
      const ux=(next[0]-x)/length, uz=(next[1]-z)/length;
      const nx=uz*flip, nz=-ux*flip, yaw=-Math.atan2(uz,ux);
      const add=(along:number,y:number,out:number,width:number,height:number,depth:number,color:number,arch=false) =>
        parts.push({p:[x+ux*along+nx*out,profile.groundY+y,z+uz*along+nz*out],size:[width,height,depth],yaw,color,arch});
      const eave=profile.wallHeightM;
      add(length/2,0.18,0.1,length,0.32,0.18,C.stone);
      add(length/2,eave-0.2,0.14,length+0.1,0.22,0.3,C.trim);
      add(length/2,eave+0.08,0.19,length+0.15,0.11,0.16,C.metal);
      // Street entrance and the adjacent remise follow the photographed order.
      // The remaining source walls retain restrained glazing, not blank boxes.
      const entrance = buildingIndex===0 && i===profile.frontEdge;
      const bays=Math.max(1,Math.floor((length-1.5)/3.35));
      for(let bay=0;bay<bays;bay+=1) {
        const along=(bay+0.5)*length/bays;
        if(entrance && Math.abs(along-length/2)<4) continue;
        const wide = buildingIndex===0 && i!==profile.frontEdge;
        const width=wide?2.05:1.05, height=wide?2.7:2.3;
        add(along,0.8+height/2,0.11,width+0.22,height+0.2,0.2,C.trim,true);
        add(along,0.8+height/2,0.24,width,height,0.12,C.glass,true);
        add(along,1.8,0.32,0.075,2.0,0.08,C.frame);
        add(along,1.75,0.32,width,0.075,0.08,C.frame);
        add(along,0.78,0.24,width+0.3,0.14,0.26,C.stone);
        counts.archedWindows+=1;
      }
      if (i===profile.frontEdge) {
        // Narrow projecting metal dormers retain a block-readable pitched cap.
        const offsets=entrance?[]:[0.27,0.7];
        for(const fraction of offsets) {
          add(length*fraction,eave+0.9,0.04,1.5,1.7,0.8,C.metal);
          add(length*fraction,eave+0.83,0.5,0.95,1.35,0.12,C.glass);
          add(length*fraction,eave+1.78,0.13,1.78,0.18,1.05,C.metal);
          counts.dormers+=1;
        }
      }
      if(entrance) {
        const centre=length/2;
        add(centre,1.85,0.16,5.3,3.7,0.2,C.trim,true);
        add(centre,1.8,0.3,4.9,3.5,0.14,C.glass,true);
        for(const d of [-1.55,0,1.55]) add(centre+d,1.45,0.41,0.1,2.8,0.1,C.frame);
        add(centre,2.6,0.41,4.7,0.11,0.1,C.frame);
        // Large semicircular roof window, independent of the main door arch.
        add(centre,eave+1.0,0.1,3.6,2.1,0.32,C.metal,true);
        add(centre,eave+0.91,0.3,3.05,1.65,0.13,C.glass,true);
        add(centre,eave+0.78,0.4,0.1,1.35,0.1,C.frame);
        counts.dormers+=1;
        for(const side of [-1,1]) {
          add(centre+side*3.1,2.35,0.37,0.13,0.62,0.3,C.frame);
          add(centre+side*3.1,2.55,0.51,0.38,0.48,0.36,C.light);
          add(centre+side*3.1,2.86,0.51,0.52,0.13,0.45,C.frame);
          counts.lamps+=1;
        }
        // Three low approach steps do not create a facade-wide barrier.
        for(let step=0;step<3;step+=1) add(centre,0.055+step*0.08,
          0.65-step*0.2,6.3,0.11+step*0.16,1.35-step*0.4,C.stone);
      }
      if(length>6) add(0.38,eave/2,0.28,0.1,eave,0.12,C.metal);
    });
  });
  return {parts,counts};
}

function pushGeometry(builder:Builder, geometry:BufferGeometry, color:number, ink=true):void {
  paintGeometry(geometry,color);
  if(!geometry.index) geometry.setIndex(Array.from({length:geometry.getAttribute("position").count},(_,i)=>i));
  builder.parts.push(geometry);
  if(ink) builder.edges.push(new EdgesGeometry(geometry,25));
}
function archGeometry(width:number,height:number,depth:number):BufferGeometry {
  const shape=new Shape(), radius=width/2, spring=height/2-radius;
  shape.moveTo(-radius,-height/2); shape.lineTo(radius,-height/2);
  shape.lineTo(radius,spring);
  // Elliptical upper profile also keeps the broad door below the eaves.
  const rise=Math.min(radius,height*0.46);
  for(let i=0;i<=12;i+=1) {
    const a=i*Math.PI/12;
    shape.lineTo(Math.cos(a)*radius,height/2-rise+Math.sin(a)*rise);
  }
  shape.closePath();
  const geometry=new ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:12});
  geometry.translate(0,0,-depth/2);return geometry;
}

export function createZollpackhofDetails():Group {
  const builder=createBuilder();
  for(const profile of ZOLLPACKHOF_PARTS) {
    const shape=new Shape();
    profile.ring.forEach(([x,z],i)=>i===0?shape.moveTo(x,-z):shape.lineTo(x,-z));
    shape.closePath();
    const body=new ExtrudeGeometry(shape,{depth:profile.wallHeightM,bevelEnabled:false});
    body.rotateX(-Math.PI/2);body.translate(0,profile.groundY,0);
    pushGeometry(builder,body,C.plaster);
    const rect=fitZollpackhofRoof(profile.ring.map(([x,z])=>[x,z]));
    if(rect) {
      const eave=profile.groundY+profile.wallHeightM;
      const triangles=zollpackhofHipRoof(rect,eave,eave+profile.roofRiseM);
      if(triangles) {
        const geometry=new BufferGeometry();
        geometry.setAttribute("position",new Float32BufferAttribute(triangles,3));
        pushGeometry(builder,geometry,C.roof);
      }
    }
  }
  const {parts,counts}=facadeParts();
  for(const part of parts) {
    const g=part.arch?archGeometry(...part.size):new BoxGeometry(...part.size);
    g.rotateY(part.yaw);g.translate(...part.p);pushGeometry(builder,g,part.color,part.arch===true);
  }
  const group=finishDrawnGroup(builder,{name:"Zollpackhof source-plan architecture"})!;
  Object.assign(group.userData,{profile:ZOLLPACKHOF_PROFILE,detailCounts:counts,
    sourcePrismIds:ZOLLPACKHOF_PARTS.map(({id})=>id),replacesLoD2:true,textureFree:true,
    staticAllModes:true,staticAntiFlicker:true});
  return group;
}

export function createMinecraftZollpackhofDetails():Group {
  const blocks:Part[]=[];
  for(const profile of ZOLLPACKHOF_PARTS) {
    const rect=fitZollpackhofRoof(profile.ring.map(([x,z])=>[x,z]));if(!rect) continue;
    const [ux,uz]=rect.axis, [cx,cz]=rect.center, q=1.2;
    // Exact wall-plane strips keep inset glazing visible. Cell-centred outer
    // columns would protrude through the photographed doors and windows.
    const ring=profile.ring;
    let area=0;ring.forEach(([x,z],i)=>{const n=ring[(i+1)%ring.length];area+=x*n[1]-n[0]*z;});
    const flip=area>=0?1:-1;
    ring.forEach(([x,z],i)=>{
      const n=ring[(i+1)%ring.length],length=Math.hypot(n[0]-x,n[1]-z);
      if(length<0.3)return;
      const dx=(n[0]-x)/length,dz=(n[1]-z)/length, count=Math.ceil(length/q);
      for(let b=0;b<count;b+=1){const along=(b+0.5)*length/count;
        blocks.push({p:[x+dx*along-dz*flip*0.18,profile.groundY+profile.wallHeightM/2,z+dz*along+dx*flip*0.18],
          size:[length/count,profile.wallHeightM,0.36],yaw:-Math.atan2(dz,dx),color:C.plaster});
      }
    });
    for(let u=-rect.halfLength+q/2;u<rect.halfLength;u+=q) {
      for(let v=-rect.halfWidth+q/2;v<rect.halfWidth;v+=q) {
        const x=cx+ux*u-uz*v,z=cz+uz*u+ux*v;
        if(!pointInWorldRing(x,z,profile.ring)) continue;
        const edge=Math.min(rect.halfLength-Math.abs(u),rect.halfWidth-Math.abs(v));
        const roofY=profile.groundY+profile.wallHeightM+
          Math.floor(Math.min(1,edge/rect.halfWidth)*profile.roofRiseM/0.5)*0.5;
        const roofBase=profile.groundY+profile.wallHeightM;
        const roofHeight=roofY-roofBase+0.55;
        blocks.push({p:[x,roofBase+roofHeight/2,z],size:[q,roofHeight,q],yaw:-Math.atan2(uz,ux),color:C.roof});
      }
    }
  }
  const {parts,counts}=facadeParts();
  for(const part of parts) {
    if(!part.arch) {blocks.push(part);continue;}
    // Block steps retain the round-headed silhouette without smooth doubles.
    for(let step=0;step<3;step+=1) blocks.push({...part,arch:false,
      p:[part.p[0],part.p[1]-part.size[1]/2+part.size[1]/6+step*part.size[1]/3,part.p[2]],
      size:[part.size[0]*(step===2?0.64:1),part.size[1]/3,part.size[2]]});
  }
  const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial({vertexColors:true}),blocks.length);
  const matrix=new Matrix4(),size=new Vector3(),color=new Color();
  blocks.forEach((part,i)=>{matrix.makeRotationY(part.yaw);matrix.scale(size.set(...part.size));
    matrix.setPosition(...part.p);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(part.color));});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.name="Zollpackhof block-native architecture";
  mesh.userData.approxInstanceTransferBytes=blocks.length*76;
  const group=new Group();group.name="Minecraft Zollpackhof";group.add(mesh);
  Object.assign(group.userData,{profile:ZOLLPACKHOF_PROFILE,detailCounts:counts,blocks:blocks.length,
    textureFree:true,staticAllModes:true,drawCalls:1});return group;
}

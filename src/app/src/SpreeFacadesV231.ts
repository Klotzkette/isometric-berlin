import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from "three";
import source from "./data/spreeFacadesV231.json";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

type Block = { position: [number,number,number]; size:[number,number,number]; yaw:number; color:number; role:string; owner:string };
const C = { stone:0xd8d1bd, sash:0xe3dfd1, glass:0x658083, wood:0x998166, iron:0x484f50 };
/** Measured wall planes; nine named facade recipes replace their audited old
 * openings. Ordinary fronts retain the old centres and glazing unchanged. */
export function planSpreeFacadesV231(native=false): Block[] {
 const blocks:Block[]=[];
 for(const site of source.sites) for(const wall of site.walls) {
  const {a,normal:n,tangent:t,length:L,base,eave,role}=wall;
  const yaw=-Math.atan2(t[1],t[0]);
  const emit=(u:number,y:number,w:number,h:number,depth:number,out:number,color:number,role:string)=>{
   if(w<=0 || h<=0)return;
   if(native) {
    // Independent orthogonal strips follow the same outside 2m source cells.
    const steps=Math.max(1,Math.ceil(w/.5));
    for(let j=0;j<steps;j++) {
     const along=u-w/2+(j+.5)*w/steps;let x=a[0]+t[0]*along,z=a[1]+t[1]*along;
     const xFace=Math.abs(n[0])>=Math.abs(n[1]);
     if(xFace)x=(n[0]<0?Math.floor(x/2):Math.ceil(x/2))*2+Math.sign(n[0])*out;
     else z=(n[1]<0?Math.floor(z/2):Math.ceil(z/2))*2+Math.sign(n[1])*out;
     const width=w/steps*(xFace?Math.abs(t[1]):Math.abs(t[0]))+.012;
     blocks.push({position:[x,y,z],size:xFace?[depth,h,width]:[width,h,depth],yaw:0,color,role,owner:site.owner});
    }
   } else blocks.push({position:[a[0]+t[0]*u+n[0]*out,y,a[1]+t[1]*u+n[1]*out],size:[w,h,depth],yaw,color,role,owner:site.owner});
  };
  const pane=(u:number,y:number,w:number,h:number,wood=false,door=false)=>{
   if(u-w/2<.12 || u+w/2>L-.12 || y-h/2<base+.12 || y+h/2>eave-.1)return;
   const trim=wood?C.wood:C.stone;
   emit(u,y,w+.25,h+.25,.13,.15,trim,"measured-plane reveal");
   emit(u,y,w,h,.055,.235,door?C.wood:C.glass,door?"portal":"named glazing");
   for(const q of [-1,1]) emit(u+q*w/2,y,.075,h,.08,.28,wood?C.wood:C.sash,"jamb");
   for(const q of [-1,1]) emit(u,y+q*h/2,w,.075,.08,.28,wood?C.wood:C.sash,"head and sill frame");
   if(!wood) {
    emit(u,y,.07,h,.07,.28,C.sash,"central sash");
    emit(u,y+h*.16,w,.06,.07,.28,C.sash,"transom");
   } else emit(u+w*.30,y,.18,h,.08,.29,C.wood,"wooden daylight panel");
   emit(u,y-h/2-.13,w+.45,.12,.30,.22,trim,"projecting sill");
  };
  if(role==='existing-rhythm') {
   // No new pane, backdrop or axis. Only the extant v169 opening is framed.
   if(!native && 'panes' in wall) for(const [u,y] of wall.panes ?? []) {
    for(const sign of [-1,1]) emit(u+sign*.67,y,.065,1.85,.06,.17,C.sash,"retained opening jamb");
    emit(u,y+.22,1.25,.055,.05,.17,C.sash,"retained opening transom");
    emit(u,y-.96,1.72,.10,.28,.20,C.stone,"retained opening sill");
   }
   emit(L/2,eave-.16,L-.2,.18,.26,.15,C.stone,"source eave course");
   emit(L/2,base+.43,L-.2,.22,.16,.09,C.stone,"source plinth course");
   continue;
  }
  if(role.startsWith('bastian')) {
   const floors=role==='bastian-attic'?1:role==='bastian-east'?4:3;
   const pitch=(eave-base)/floors;
   for(let f=0;f<floors;f++) {
    const fractions=L<10?[.5]:f%2?[.23,.76]:[.20,.64];
    for(const fraction of fractions) pane(L*fraction,base+pitch*(f+.5),Math.min(4.9,L*.23),Math.min(4.05,pitch-.8),true);
    if(f>0)emit(L/2,base+pitch*f,L-.15,.13,.12,.09,C.stone,"reconstituted stone course");
   }
  } else if(role.startsWith('magnus')) {
   const bays=role==='magnus-center'?3:role==='magnus-extension'?4:2;
   for(let b=0;b<bays;b++)for(let floor=0;floor<2;floor++) {
    const u=L*(b+.5)/bays,door=role==='magnus-center'&&b===1&&floor===0;
    pane(u,base+(floor?8.65:4.55),Math.min(1.75,L/bays*.56),floor?2.5:3.25,false,door);
   }
   emit(L/2,base+2.35,L-.1,.22,.22,.14,C.stone,"high basement stringcourse");
   if(role==='magnus-center')for(const u of [.04,.35,.65,.96]) {
    emit(L*u,base+7.1,.40,8.0,.22,.18,C.stone,"colossal pilaster");
    emit(L*u,base+11.0,.72,.32,.32,.20,C.stone,"pilaster capital");
    emit(L*u,base+3.12,.65,.28,.30,.20,C.stone,"pilaster foot");
   }
  } else if(role==='simon-front') {
   for(let floor=0;floor<4;floor++)for(let b=0;b<7;b++)pane(L*(b+.5)/7,base+1.95+floor*3.65,1.60,floor===3?1.9:2.45);
   for(const y of [base+3.6,base+7.3,base+11.0])emit(L/2,y,L-.1,.16,.28,.16,C.stone,"classical stringcourse");
   for(const u of [.03,.97])emit(L*u,base+7.6,.65,14.7,.22,.13,C.stone,"corner pilaster");
  }
  emit(L/2,eave-.13,L-.12,.22,.30,.14,C.stone,"measured eave cornice");
 }
 return blocks;
}

export function createSpreeFacadesV231(native=false,diagnostics=false): Group {
 const root=new Group();root.name="Spree public street facades v231"+(native?" native":"");
 const plan=planSpreeFacadesV231(native);
 root.userData={spreeFacadesV231:true,nativeMinecraft:native,blockNative:native,keepInMinecraft:native,fullStaticDetailOnTouch:true,sourceBodiesRetained:true,textureFree:true};
 if(diagnostics)root.userData.blocks=plan;
 const cube=new BoxGeometry(1,1,1);cube.deleteAttribute("uv");
 const day=new MeshStandardMaterial({color:0xffffff,roughness:.83}),night=new MeshStandardMaterial({color:0x8b94a1,roughness:.83});
 // One independently culled mesh per finite source family. No per-house lights.
 for(const owner of new Set(plan.map(b=>b.owner))) {
  const blocks=plan.filter(b=>b.owner===owner),mesh=new InstancedMesh(cube,day,blocks.length),matrix=new Matrix4(),scale=new Vector3(),color=new Color();
  blocks.forEach((b,i)=>{matrix.makeRotationY(b.yaw).scale(scale.set(...b.size)).setPosition(...b.position);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(b.color));});
  mesh.name=`Spree facade ${owner}`;mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;mesh.computeBoundingBox();mesh.computeBoundingSphere();root.add(mesh);
 }
 return freezeStaticSceneTransforms(root);
}

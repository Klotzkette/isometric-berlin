import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { WELT_BALLOON_PROFILE as P } from './expandedCityProfiles';
import { freezeStaticSceneTransforms } from './staticSceneTransforms';

/** Exact existing scene landmark; retained pose/profile, estimated annulus width. */
export const WELT_BALLOON_V281 = Object.freeze({
  anchor: [968.1457638457068, 8, 1241.5250578913838] as const,
  innerGondolaRadius: 1.65,
  interpretation: 'Operator envelope/gondola diameters; retained 91 m presentation centre and 34 m total height. Inner opening, fittings and cable strokes are public-reference estimates, not a dimensional survey.',
});
type Point = readonly [number, number, number];
type Row = [number, number, number, number, number, number, number];
const WHITE=0xf7f7f2, BLACK=0x111416, STEEL=0xc9cdd0, CABLE=0x737b7c, BLUE=0x243b55;

/** Four closed annular surfaces; the centre is never covered by a triangle. */
export function createWeltGondolaFloorV281(outer=P.gondolaDiameterM/2, inner=WELT_BALLOON_V281.innerGondolaRadius, height=.28) {
  const positions:number[]=[], n=48;
  const point=(r:number,a:number,y:number)=>[r*Math.cos(a),y,r*Math.sin(a)];
  const quad=(a:number[],b:number[],c:number[],d:number[])=>positions.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<n;i++) {
    const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
    const it=point(inner,a,height/2),jt=point(inner,b,height/2),ot=point(outer,a,height/2),pt=point(outer,b,height/2);
    const ib=point(inner,a,-height/2),jb=point(inner,b,-height/2),ob=point(outer,a,-height/2),pb=point(outer,b,-height/2);
    quad(it,jt,pt,ot);quad(ib,ob,pb,jb);quad(ot,pt,pb,ob);quad(it,ib,jb,jt);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setIndex(Array.from({length:positions.length/3},(_,i)=>i));g.computeVertexNormals();
  return g;
}

/** Independent cardinal volume recipe; no sampled drawn geometry or rotation. */
export function weltBalloonNativeRowsV281(anchor:Point=WELT_BALLOON_V281.anchor):Row[] {
  const rows:Row[]=[],[cx,ground,cz]=anchor,r=P.envelopeDiameterM/2,cy=ground+P.envelopeCenterAboveGroundM;
  const bottom=cy+r-P.totalHeightM,top=bottom+2.45;
  const box=(c:number,x:number,y:number,z:number,w:number,h:number,d:number)=>{if(w>1e-8&&h>1e-8&&d>1e-8)rows.push([cx+x,y,cz+z,w,h,d,c]);};
  // The signed steps stay world-cardinal, including the thin suspension net.
  const line=(c:number,a:Point,b:Point,w:number)=>{
    const delta=b.map((v,i)=>v-a[i]);
    const moving=delta.filter(v=>Math.abs(v)>1e-8).length;
    if(moving===1){const dims=delta.map(v=>Math.max(Math.abs(v),w));box(c,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,...dims as [number,number,number]);return;}
    const n=Math.max(1,Math.ceil(Math.max(...delta.map(Math.abs))/.4));let q=[...a];
    for(let k=1;k<=n;k++){const next=a.map((v,i)=>v+delta[i]*k/n);for(let axis=0;axis<3;axis++){
      const end=[...q];end[axis]=next[axis];const dims=[w,w,w];dims[axis]=Math.abs(end[axis]-q[axis])+w;
      box(c,(q[0]+end[0])/2,(q[1]+end[1])/2,(q[2]+end[2])/2,...dims as [number,number,number]);q=end;
    }}
  };
  const ring=(outer:number,inner:number,y:number,h:number,c:number,step=.2)=>{
    const n=Math.ceil(outer/step);
    for(let iz=-n;iz<n;iz++){let start:number|null=null;
      for(let ix=-n;ix<=n;ix++){
        const x=(ix+.5)*step,z=(iz+.5)*step;
        const far=Math.hypot(Math.abs(x)+step/2,Math.abs(z)+step/2);
        const near=Math.hypot(Math.max(0,Math.abs(x)-step/2),Math.max(0,Math.abs(z)-step/2));
        const hit=ix<n&&far<=outer+.000001&&near>=inner;
        if(hit&&start===null)start=ix;
        if(!hit&&start!==null){box(c,(start+ix)*step/2,y,z,(ix-start)*step,h,step);start=null;}
      }
    }
  };
  // Thirty equal layers retain the exact diameter at cardinal silhouette axes.
  const cell=P.envelopeDiameterM/30,skin:Row[]=[];
  for(let iy=0;iy<30;iy++)for(let iz=0;iz<30;iz++){
    const y=-r+(iy+.5)*cell,z=-r+(iz+.5)*cell,span=Math.sqrt(Math.max(0,r*r-y*y-z*z));
    if(y*y+z*z>r*r)continue;
    const first=Math.max(0,Math.ceil((r-span)/cell-.5)),last=Math.min(29,Math.floor((r+span)/cell-.5));
    if(last<first)continue;
    const tone=Math.abs(y)>=2.95&&Math.abs(y)<=5.6?P.envelopeBlueStripeColor:WHITE;
    box(tone,-r+(first+last+1)*cell/2,cy+y,z,(last-first+1)*cell,cell,cell);skin.push(rows.at(-1)!);
  }
  // Four black pixel words lie on the actual stepped skin, not floating signs.
  const glyphs=['10001/10001/10001/10101/10101/11011/10001','11111/10000/10000/11110/10000/10000/11111','10000/10000/10000/10000/10000/10000/11111','11111/00100/00100/00100/00100/00100/00100'];
  const pixel=.44;
  for(let face=0;face<P.repeatedWordCount;face++)glyphs.forEach((glyph,letter)=>glyph.split('/').forEach((bits,row)=>[...bits].forEach((bit,col)=>{
    if(bit!=='1')return;
    const u=(letter*6+col-11)*pixel,y=cy+(3-row)*pixel,axis=face%2===0?2:0,sign=face<2?1:-1;
    let surface=-Infinity;
    for(const b of skin){const transverse=axis===2?b[0]-cx:b[2]-cz,half=axis===2?b[3]/2:b[5]/2;
      if(Math.abs(y-b[1])<=cell/2+pixel/2&&Math.abs(u-transverse)<=half+pixel/2)
        surface=Math.max(surface,sign*(b[axis]-(axis===0?cx:cz))+b[axis+3]/2);
    }
    const s=sign*(surface+.02);
    box(BLACK,axis===2?sign*u:s,y,axis===2?s:-sign*u,axis===2?pixel:.04,pixel,axis===2?.04:pixel);
  })));
  const outer=P.gondolaDiameterM/2,inner=WELT_BALLOON_V281.innerGondolaRadius;
  ring(outer,inner,bottom+.2,.28,BLUE,.1);
  ring(outer,outer-.22,bottom+.62,.58,BLUE,.08);
  ring(inner+.18,inner,bottom+.62,.58,STEEL,.08);
  // Thin orthogonal chords follow both rings, leaving the tether opening clear.
  for(const radius of [outer-.1,inner+.08]){
    for(const y of [bottom+.88,top])for(let i=0;i<48;i++){
      const a=i*Math.PI/24,b=(i+1)*Math.PI/24;
      line(STEEL,[radius*Math.cos(a),y,radius*Math.sin(a)],[radius*Math.cos(b),y,radius*Math.sin(b)],.1);
    }
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
      line(STEEL,[radius*Math.cos(a),bottom+.88,radius*Math.sin(a)],[radius*Math.cos(a),top,radius*Math.sin(a)],.08);
      line(CABLE,[radius*Math.cos(a),bottom+.95,radius*Math.sin(a)],[radius*Math.cos(b),top-.08,radius*Math.sin(b)],.035);
    }
  }
  const suspensionY=cy-r*.72,suspensionRadius=Math.sqrt(r*r-(suspensionY-cy)**2);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;
    line(CABLE,[suspensionRadius*Math.cos(a),suspensionY,suspensionRadius*Math.sin(a)],[(outer-.12)*Math.cos(a),top,(outer-.12)*Math.sin(a)],P.displayCableStrokeM);
  }
  box(BLACK,0,(ground+.8+bottom)/2,0,P.displayCableStrokeM,bottom-ground-.8,P.displayCableStrokeM);
  ring(6.5,0,ground+.05,.1,0xc9c8c0,.25);
  box(0x4d5556,2.5,ground+.72,1.7,3.2,1.35,2.2);
  box(0x252b2d,2.5,ground+.78,1.7,1.65,1.4,1.4);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(0x8a8e8b,6.2*Math.cos(a),ground+.55,6.2*Math.sin(a),.16,1.1,.16);}
  return rows;
}

export function createMinecraftWeltBalloonV281(options:{mobileLike?:boolean;anchor?:Point}={}) {
  const root=new Group(),rows=weltBalloonNativeRowsV281(options.anchor),matrix=new Matrix4(),color=new Color();
  root.name='WELT Balloon independent cardinal ring gondola — v281';
  const geometry=new BoxGeometry(1,1,1);geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');
  const dayMaterial=new MeshBasicMaterial(),nightMaterial=new MeshStandardMaterial({roughness:.8,flatShading:true});
  const mesh=new InstancedMesh(geometry,dayMaterial,0);mesh.count=rows.length;
  const matrices=new Float32Array(rows.length*16),colors=new Float32Array(rows.length*3);
  rows.forEach(([x,y,z,w,h,d,c],i)=>{matrix.makeScale(w,h,d);matrix.setPosition(x,y,z);matrix.toArray(matrices,i*16);color.setHex(c).toArray(colors,i*3);});
  mesh.instanceMatrix=new InstancedBufferAttribute(matrices,16);mesh.instanceColor=new InstancedBufferAttribute(colors,3);
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  mesh.name='WELT cardinal envelope, four words, open ring gondola, suspension and winch';
  mesh.userData={dayMaterial,nightMaterial,textureFree:true,nativeMinecraft:true,keepInMinecraft:true,blockNative:true};
  root.userData={...mesh.userData,profile:P,fullStaticDetailOnTouch:true,interpretation:WELT_BALLOON_V281.interpretation};
  root.add(mesh);return freezeStaticSceneTransforms(root);
}

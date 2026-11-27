import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial,
} from "three";
import { decodeBase64Bytes } from "./decodeBase64Bytes";
import data from "./data/fritzSportparkV390.json";

function words(value: string): Int16Array {
  const bytes = decodeBase64Bytes(value);
  return new Int16Array(bytes.buffer,bytes.byteOffset,bytes.length/2);
}

class PaintedGeometry {
  positions: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  vertex(x: number, y: number, z: number, color: Color): number {
    this.positions.push(x,y,z);
    this.colors.push(Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255));
    return this.positions.length/3-1;
  }
  rectangle(x: number, z: number, width: number, depth: number, y: number, color: Color) {
    const i=this.vertex(x,y,z,color);
    this.vertex(x,y,z+depth,color); this.vertex(x+width,y,z+depth,color); this.vertex(x+width,y,z,color);
    this.indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  box(x: number,y: number,z: number,rx: number,ry: number,rz: number,color: Color) {
    const i=this.positions.length/3;
    const shade=color.clone().multiplyScalar(.82);
    for (const yy of [-ry,ry]) for (const [dx,dz] of [[-rx,-rz],[-rx,rz],[rx,rz],[rx,-rz]]) {
      this.vertex(x+dx,y+yy,z+dz,yy>0?color:shade);
    }
    this.indices.push(i+4,i+5,i+6,i+4,i+6,i+7);
    for(let s=0;s<4;s++){const a=i+s,b=i+(s+1)%4;this.indices.push(a,b,b+4,a,b+4,a+4);}
  }
  finish(name: string, native: boolean): Mesh {
    const geometry=new BufferGeometry();
    geometry.setAttribute("position",new Float32BufferAttribute(this.positions,3));
    geometry.setAttribute("color",new BufferAttribute(Uint8Array.from(this.colors),3,true));
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const day=new MeshBasicMaterial({vertexColors:true,side:DoubleSide});
    const night=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:.97});
    const mesh=new Mesh(geometry,day);
    mesh.name=name;mesh.userData={dayMaterial:day,nightMaterial:night,textureFree:true,fullStaticDetailOnTouch:true,blockNative:native,keepInMinecraft:native};
    return mesh;
  }
}

function sportSurfaces(native: boolean) {
  const buffer=new PaintedGeometry(), palette=data.paint.map(hex=>new Color(hex));
  const [x,z]=data.origin;
  if (native) {
    const runs=words(data.native);
    for(let i=0;i<runs.length;i+=5) {
      const west=x+runs[i],north=z+runs[i+1],width=runs[i+2],top=runs[i+3]/100,paint=runs[i+4];
      if (paint >= 6) {
        buffer.box(west+width/2,top-.15,north+.5,width/2,.15,.5,palette[paint]);
      } else {
        buffer.rectangle(west,north,width,1,top,palette[paint]);
      }
    }
  } else {
    const vertices=words(data.vertices), indices=words(data.indices);
    for(let i=0;i<vertices.length;i+=4) {
      buffer.vertex(x+vertices[i]/10,vertices[i+1]/100,z+vertices[i+2]/10,palette[vertices[i+3]]);
    }
    for (const index of indices) buffer.indices.push(index);
  }
  return buffer.finish("SportPark Poststadion: Spielfelder, Ascheplätze, Laufbahn und Gegentribüne",native);
}

/** Crown heights and radii come from the survey. The loft is a display fit;
 * no species is inferred from the shape of a crown in the aerial image. */
function addCrown(buffer: PaintedGeometry,x:number,y:number,z:number,h:number,r:number,phase:number,native:boolean,conifer:boolean) {
  const leaf=new Color(conifer?0x4b6553:[0x617947,0x586f43,0x71834f,0x536e46][phase%4]), bark=new Color(0x76654f);
  buffer.box(x,y+.26*h,z,Math.min(.31,.10+r*.024),h*.26,Math.min(.31,.10+r*.024),bark);
  if(native) {
    buffer.box(x,y+.62*h,z,r*.88,h*.22,r*.85,leaf);
    buffer.box(x,y+.90*h,z,r*.61,h*.10,r*.63,leaf.clone().multiplyScalar(1.08));
    return;
  }
  const first=buffer.positions.length/3, sides=9;
  for(const [f,radius,bright] of [[.39,.36,.72],[.57,.92,.87],[.77,1,1],[.92,.65,1.08]]) {
    for(let s=0;s<sides;s++) {
      const a=s*2*Math.PI/sides+phase*.53, d=(conifer?Math.max(.18,1.47-f):radius)*r*(1+.09*Math.sin(a*3+phase));
      const color=leaf.clone().multiplyScalar(bright*(.95+.06*Math.cos(a-.8)));
      buffer.vertex(x+d*Math.cos(a),y+h*(f+.025*Math.sin(a*3)),z+d*Math.sin(a),color);
    }
  }
  const cap=buffer.vertex(x,y+h,z,leaf.clone().multiplyScalar(1.09));
  for(let s=0;s<sides;s++) {
    const next=(s+1)%sides;
    for(let j=0;j<3;j++){
      const a=first+j*sides+s,b=first+j*sides+next;buffer.indices.push(a,a+sides,b,b,a+sides,b+sides);
    }
    buffer.indices.push(first+3*sides+s,cap,first+3*sides+next);
  }
}

export function addFritzSportparkV390(root:Group,native:boolean):void {
  const trees=new PaintedGeometry(), crowns=words(data.crowns);
  for(let i=0;i<crowns.length;i+=7){
    if(native && (crowns[i+6]&1)) continue;
    const x=data.origin[0]+crowns[i]/10,z=data.origin[1]+crowns[i+1]/10;
    addCrown(trees,x,crowns[i+(native?3:2)]/10,z,crowns[i+4]/10,crowns[i+5]/10,i/7,native,(crowns[i+6]&2)!==0);
  }
  root.add(sportSurfaces(native),trees.finish("Fritz-Schloß-Park: Anlagenbäume am Trümmerberg und Sportgelände",native));
}

import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2 } from "three";
import { letteringLayout, letteringStrokePaths } from "./drawnLettering";

export type MarkerKindV378 = "mendelssohn" | "columbiadamm";
export type SolidRingV378 = { x: number; z: number; width: number; depth: number; low: number; high: number };
type Point = [number, number, number];

/** Faceted stone, measured steps and line-cut lettering in local metres. */
function stonework(native: boolean, nativeLetterYaw=0) {
  const vertices: number[] = [], colors: number[] = [], solids: SolidRingV378[] = [];
  const tint = new Color();
  function face(a: Point, b: Point, c: Point, color: number) {
    tint.setHex(color);
    for (const point of [a,b,c]) {
      vertices.push(...point);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  function profile(outline: number[][], front: number, back: number, color: number) {
    const triangles = ShapeUtils.triangulateShape(outline.map(([x,y]) => new Vector2(x,y)), []);
    const at = (i: number, z: number): Point => [outline[i][0], outline[i][1], z];
    for (const [a,b,c] of triangles) {
      face(at(a,front), at(b,front), at(c,front), color);
      face(at(c,back), at(b,back), at(a,back), color);
    }
    for (let a=0; a<outline.length; a++) {
      const b=(a+1)%outline.length;
      face(at(a,back), at(b,back), at(b,front), color);
      face(at(a,back), at(b,front), at(a,front), color);
    }
  }
  function box(x:number, y:number, z:number, w:number, h:number, d:number, color:number, solid=false) {
    profile([[x-w/2,y],[x+w/2,y],[x+w/2,y+h],[x-w/2,y+h]], z+d/2,z-d/2,color);
    if (solid) solids.push({x,z,width:w,depth:d,low:y,high:y+h});
  }
  function label(text:string, x:number,y:number,z:number,cap:number,maxWidth:number,color:number) {
    const letters=text.normalize("NFD").replace(/\p{M}/gu,"");
    const size=Math.min(cap,cap*maxWidth/letteringLayout(letters,cap).totalWidthM);
    const layout=letteringLayout(letters,size),width=size*.115;
    const paths=letteringStrokePaths(letters,size);
    Array.from(text).forEach((ch,i)=>{
      const mid=layout.glyphs[i].leftM+layout.glyphs[i].advanceM/2-layout.totalWidthM/2;
      if(ch==="Ç") paths.push([[mid,0],[mid+.10*size,-.13*size],[mid-.08*size,-.24*size]]);
      if(ch==="É") paths.push([[mid-.09*size,.12*size+size],[mid+.11*size,.30*size+size]]);
      if(ch==="À") paths.push([[mid+.09*size,.12*size+size],[mid-.11*size,.30*size+size]]);
    });
    for (const path of paths) for (let i=1;i<path.length;i++) {
      const a=path[i-1], b=path[i], dx=b[0]-a[0], dy=b[1]-a[1], length=Math.hypot(dx,dy);
      if (!length) continue;
      if (native) {
        // Collinear strokes become one surface rectangle. Only the two
        // possible outward voxel faces carry lettering, never twelve hidden faces.
        const count=Math.max(1,Math.ceil(Math.min(Math.abs(dx),Math.abs(dy))/(size*.14)));
        const c=Math.cos(nativeLetterYaw),s=Math.sin(nativeLetterYaw);
        for(let k=0;k<count;k++){
          const t=(k+.5)/count,localX=x+a[0]+t*dx;
          const h=width+Math.abs(dy)/count,w=width+Math.abs(dx)/count;
          const cx=localX*c+z*s,cz=-localX*s+z*c,cy=y+a[1]+t*dy;
          const x0=cx-w*Math.abs(c)/2,x1=cx+w*Math.abs(c)/2;
          const z0=cz-w*Math.abs(s)/2,z1=cz+w*Math.abs(s)/2;
          if(Math.abs(c)>.001){
            const front=c>=0?z1:z0;
            const a:Point=[x0,cy-h/2,front],b:Point=[x1,cy-h/2,front],d:Point=[x0,cy+h/2,front],e:Point=[x1,cy+h/2,front];
            face(a,b,e,color);face(a,e,d,color);
          }
          if(Math.abs(s)>.001){
            const front=s>=0?x1:x0;
            const a:Point=[front,cy-h/2,z0],b:Point=[front,cy-h/2,z1],d:Point=[front,cy+h/2,z0],e:Point=[front,cy+h/2,z1];
            face(a,b,e,color);face(a,e,d,color);
          }
        }
      } else {
        const ux=-dy/length*width/2,uy=dx/length*width/2;
        const p:Point=[x+a[0]+ux,y+a[1]+uy,z],q:Point=[x+a[0]-ux,y+a[1]-uy,z];
        const r:Point=[x+b[0]-ux,y+b[1]-uy,z],s:Point=[x+b[0]+ux,y+b[1]+uy,z];
        face(p,q,r,color);face(p,r,s,color);
      }
    }
  }
  function finish() {
    const geometry=new BufferGeometry();
    geometry.setAttribute("position",new Float32BufferAttribute(vertices,3));
    geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return {geometry,solids};
  }
  return {box, profile, label, finish};
}

export function graveMarkerGeometryV378(kind: MarkerKindV378, native: boolean) {
  const m=stonework(native);
  if(kind==="mendelssohn"){
    // Simple white marble Latin cross, stepped foot, and the separately
    // photographed dark cemetery identification plaque at the edge of the ivy.
    m.box(0,0,0,.75,.12,.55,0xbcb9ac,true);
    m.box(0,.12,0,.60,.11,.42,0xd1cdc0,true);
    m.box(0,.23,0,.47,.29,.33,0xe0dcd0,true);
    m.box(0,.52,0,.39,.08,.28,0xd3cfbf,true);
    m.box(0,.60,0,.18,1.07,.14,0xe3e1d6,true);
    m.box(0,1.67,0,.80,.18,.14,0xe5e3d8,true);
    m.box(0,1.85,0,.18,.27,.14,0xe3e1d6,true);
    m.box(.26,.02,.80,.035,.26,.035,0x474b46);
    m.box(.26,.27,.80,.51,.26,.018,0x34444c,true);
    m.label("JACOB LUDWIG FELIX",.26,.44,.811,.026,.47,0xe7e6da);
    m.label("MENDELSSOHN BARTHOLDY",.26,.385,.811,.028,.47,0xf1ede2);
    m.label("1809 - 1847",.26,.317,.811,.028,.36,0xe3dfd4);
  }else{
    // The catalogued height from plinth base to the top of the cross is 3 m.
    m.box(0,0,0,1.12,.10,1.12,0x9f9680,true);
    m.box(0,.10,0,1.02,.18,1.02,0xa59a82,true);
    m.box(0,.28,0,.91,.64,.91,0x9c957c,true);
    m.box(0,.92,0,1.00,.08,1.00,0xb0a68e,true);
    m.box(0,1.00,0,.87,.13,.87,0xa69b82,true);
    m.box(0,1.13,0,.60,.12,.60,0xb3a88e,true);
    m.box(0,1.25,0,.46,.13,.43,0xb9ad92,true);
    m.box(0,1.38,0,.27,.99,.25,0xbeb499,true);
    m.box(0,2.37,0,1.04,.25,.25,0xc0b69c,true);
    m.box(0,2.62,0,.27,.38,.25,0xbdb296,true);
    // Shallow circlet in the public sculpture photograph. All members
    // and proportions below the catalogued height are interpretations.
    const ringColor=0xa39a80;
    for(let i=0;i<28;i++) {
      const a=i*2*Math.PI/28,b=(i+1)*2*Math.PI/28;
      const xx=(t:number,r:number)=>r*Math.cos(t), yy=(t:number,r:number)=>2.50+r*Math.sin(t);
      if(native) m.box(xx(a,.166),yy(a,.166)-.025,.137,.041,.05,.022,ringColor);
      else m.profile([[xx(a,.145),yy(a,.145)],[xx(a,.19),yy(a,.19)],[xx(b,.19),yy(b,.19)],[xx(b,.145),yy(b,.145)]],.151,.126,ringColor);
    }
    m.box(0,1.64,.135,.035,.79,.021,0xa69c83);
    m.box(0,2.50,.137,.22,.037,.022,0xa69c83);
    m.label("À LA MÉMOIRE",0,.77,.457,.048,.69,0xe7ca8a);
    m.label("DES SOLDATS FRANÇAIS",0,.63,.457,.048,.77,0xe7ca8a);
    m.label("DÉCEDES À BERLIN",0,.49,.457,.048,.72,0xe7ca8a);
    m.label("1870-71",0,.36,.457,.05,.42,0xe7ca8a);
  }
  return m.finish();
}

/** The standard CWGC headstone is 813 by 381 by 76 mm; the buried length
 * and visible height vary. The depiction omits unmeasured coats of arms. */
export function cwgcHeadstoneGeometryV378(native: boolean) {
  const m=stonework(native), half=.1905;
  if(native){
    m.box(0,0,0,.381,.68,.076,0xd9d3be);
    m.box(0,.68,0,.31,.042,.076,0xd9d3be);
    m.box(0,.722,0,.20,.028,.076,0xd9d3be);
  }else{
    const outline:number[][]=[[-half,0],[half,0],[half,.68]];
    for(let i=1;i<=12;i++){
      const angle=Math.PI*i/12;
      outline.push([half*Math.cos(angle),.68+.07*Math.sin(angle)]);
    }
    m.profile(outline,.038,-.038,0xd9d3be);
  }
  return m.finish().geometry;
}

/** These two faces belong to the existing V347 stones. The wording follows
 * photographs of the present memorials, including Hoffmann's original W. */
export function historicGraveScriptV378(key:"fontane"|"hoffmann",native:boolean){
  const yaw=key==="fontane"?.758:-.048;
  const m=stonework(native,yaw),offset=native?.041:.008;
  if(key==="fontane"){
    const z=-1.135+offset,gold=0xd5b675;
    m.label("THEODOR FONTANE",-.56,.79,z,.083,.85,gold);
    m.label("GEB. 30. DECEMBER 1819",-.56,.57,z,.046,.77,gold);
    m.label("GEST. 20. SEPTEMBER 1898",-.56,.43,z,.044,.79,gold);
    m.label("EMILIE FONTANE",.56,.80,z,.083,.83,gold);
    m.label("GEB. ROUANET-KUMMER",.56,.66,z,.049,.79,gold);
    m.label("GEB. 14. NOVEMBER 1824",.56,.53,z,.043,.77,gold);
    m.label("GEST. 18. FEBRUAR 1902",.56,.41,z,.043,.78,gold);
  }else{
    const z=-.915+offset,ink=0x47433c;
    m.label("E.T.W. HOFFMANN",0,1.21,z,.074,.74,ink);
    m.label("DEN 24. JANUAR 1776",0,.99,z,.045,.70,ink);
    m.label("DEN 25. JUNI 1822",0,.83,z,.045,.69,ink);
    m.label("ALS DICHTER",0,.60,z,.040,.50,ink);
    m.label("ALS TONKÜNSTLER",0,.49,z,.040,.53,ink);
    m.label("ALS MALER",0,.38,z,.040,.41,ink);
  }
  return {geometry:m.finish().geometry,yaw:native?0:yaw};
}

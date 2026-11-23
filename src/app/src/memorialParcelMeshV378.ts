import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, ShapeUtils, Vector2 } from "three";
import { letteringStrokePaths } from "./drawnLettering";
import type { MemorialParcelV378 } from "./memorialParcelGroundV378";
import type { MemorialPlotSolidV378 } from "./memorialsV378Plots";

type Point = [number,number,number];

/** The contemporary access surfaces and the photographed plaque on its brick
 * wall. Ground, visible masonry and collision all use the same local basis. */
export function buildMemorialParcelV378(site: MemorialParcelV378, native: boolean) {
  const vertices:number[] = [], colours:number[] = [], solids:MemorialPlotSolidV378[] = [];
  const tint = new Color(), [cx,cz]=site.center;
  const local=(x:number,y:number,z:number):Point => [x-cx,y,z-cz];
  function triangle(a:Point,b:Point,c:Point,colour:number) {
    tint.setHex(colour);
    for (const p of [a,b,c]) {vertices.push(...p);colours.push(tint.r,tint.g,tint.b);}
  }
  function quad(a:Point,b:Point,c:Point,d:Point,colour:number) {
    triangle(a,b,c,colour);triangle(a,c,d,colour);
  }
  function beam(x:number,z:number,ux:number,uz:number,w:number,d:number,low:number,h:number,col:number,solid=false) {
    const at=(u:number,v:number,y:number):Point=>local(x+ux*u-uz*v,y,z+uz*u+ux*v);
    const top=low+h,a=at(-w/2,-d/2,top),b=at(-w/2,d/2,top),c=at(w/2,d/2,top),e=at(w/2,-d/2,top);
    quad(a,b,c,e,col);
    quad(at(-w/2,-d/2,low),at(-w/2,d/2,low),b,a,col);
    quad(at(w/2,d/2,low),at(w/2,-d/2,low),e,c,col);
    quad(at(-w/2,d/2,low),at(w/2,d/2,low),c,b,col);
    quad(at(w/2,-d/2,low),at(-w/2,-d/2,low),a,e,col);
    if (solid) solids.push({x,z,y:site.groundY,width:w,depth:d,cos:ux,sin:-uz,low,high:top});
  }
  const outline=site.land.map(([x,z])=>new Vector2(x-cx,z-cz));
  for (const [a,b,c] of ShapeUtils.triangulateShape(outline,[])) {
    const p=(i:number):Point=>[outline[i].x,0,outline[i].y];
    triangle(p(c),p(b),p(a),site.id==="heiligensee"?0x72835c:0xa69c90);
  }
  for (const path of site.paths) {
    // Retain the source bends with overlapping triangles at the joins.
    for (let i=1;i<path.points.length;i++) {
      const [x,z]=path.points[i-1], [bx,bz]=path.points[i],dx=bx-x,dz=bz-z,l=Math.hypot(dx,dz);
      if(l<.02)continue;
      const nx=-dz/l*path.width/2,nz=dx/l*path.width/2, y=.027;
      quad(local(x+nx,y,z+nz),local(bx+nx,y,bz+nz),local(bx-nx,y,bz-nz),local(x-nx,y,z-nz),0xb2a79a);
    }
  }
  if (site.gate && site.id==="heiligensee") {
    // Activate only the two gate jambs. Both sides of the mapped opening
    // stay clear for a pedestrian entering the public cemetery.
    for (const [x,z] of site.gate) beam(x,z,1,0,.2,.2,0,1.47,0x555755,true);
  }
  if (site.wall && site.plaque) {
    const [[ax,az],[bx,bz]]=site.wall, [px,pz]=site.plaque;
    const l=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/l,uz=(bz-az)/l;
    const nx=-uz,nz=ux;
    beam((ax+bx)/2,(az+bz)/2,ux,uz,l,.32,0,1.47,0x995638,true);
    const courses=native?7:15;
    for(let row=1;row<courses;row++){
      beam((ax+bx)/2,(az+bz)/2,ux,uz,l,.325,row*1.47/courses,.009,0xc69977);
    }
    // The street-facing side of this short wall is (+normal) in the source.
    const face=.181, labelFace=.204;
    beam(px+nx*face,pz+nz*face,ux,uz,.76,.033,.56,.64,0x726244);
    function letterLine(text:string, y:number, cap:number) {
      const board=(u:number,v:number):Point=>local(px+ux*u+nx*labelFace,v,pz+uz*u+nz*labelFace);
      const stroke=cap*.074;
      for(const path of letteringStrokePaths(text,cap))for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if(length<1e-6)continue;
        const ex=-dy*stroke/length,ey=dx*stroke/length;
        quad(board(a[0]+ex,y+a[1]+ey),board(b[0]+ex,y+b[1]+ey),board(b[0]-ex,y+b[1]-ey),board(a[0]-ex,y+a[1]-ey),0xd5c8a5);
      }
    }
    letterLine("AN DIESER STELLE BEFAND SICH",1.025,.022);
    letterLine("VON 1946 - 1952 EIN FRIEDHOF",.976,.023);
    letterLine("DER FRANZÖSISCHEN ALLIIERTEN.",.927,.023);
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute("position",new Float32BufferAttribute(vertices,3));
  geometry.setAttribute("color",new Float32BufferAttribute(colours,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new Mesh(geometry,new MeshStandardMaterial({vertexColors:true,roughness:.94,side:DoubleSide}));
  mesh.position.set(cx,site.groundY,cz);
  mesh.name=site.id==="heiligensee"?"Cimetière française · Zugang am Friedhof Heiligensee":"Gedenktafel für den früheren französischen Ehrenfriedhof Frohnau";
  return {mesh,solids};
}

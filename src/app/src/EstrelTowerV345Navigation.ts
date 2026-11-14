import {ShapeUtils,Vector2} from "three";
import data from "./data/estrelTowerV345.json";
export type EstrelPartV345=typeof data.parts[number];
export function estrelRoofYV345(part:EstrelPartV345,x:number,z:number):number {
  if(part.roofHeight===0)return data.groundY+part.height;
  const a=part.roofDirection*Math.PI/180,dx=Math.sin(a),dz=-Math.cos(a);
  const values=part.ring.map(([x,z])=>x*dx+z*dz),lo=Math.min(...values),hi=Math.max(...values);
  return data.groundY+part.height-part.roofHeight*Math.max(0,Math.min(1,(x*dx+z*dz-lo)/(hi-lo)));
}
function inside(x:number,z:number,ring:number[][]):boolean {
  let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }return result;
}
/** The same independently sampled two-metre cells own Native body and walking. */
export function estrelNativeCellsV345(part:EstrelPartV345):Set<string>{
  const ring=part.ring,minX=Math.floor(Math.min(...ring.map(p=>p[0]))/2),maxX=Math.ceil(Math.max(...ring.map(p=>p[0]))/2);
  const minZ=Math.floor(Math.min(...ring.map(p=>p[1]))/2),maxZ=Math.ceil(Math.max(...ring.map(p=>p[1]))/2);
  const cells=new Set<string>();for(let x=minX;x<maxX;x++)for(let z=minZ;z<maxZ;z++)if(inside((x+.5)*2,(z+.5)*2,ring))cells.add(`${x}/${z}`);return cells;
}
/** Triangulate the complete actual ring, including the narrow concave plinth. */
export function estrelRoofTrianglesV345(part:EstrelPartV345,under=false):number[][][]{
 const ring=part.ring,points=ring.map(([x,z])=>new Vector2(x,z));
 return ShapeUtils.triangulateShape(points,[]).map(ids=>ids.map(i=>{
  const [x,z]=ring[i];return[x,estrelRoofYV345(part,x,z)-(under?.18:0),z];
 }));
}
export function estrelTowerSolidsV345(native=false){
  return data.parts.flatMap(part=>native?[...estrelNativeCellsV345(part)].map(key=>{
    const [ix,iz]=key.split("/").map(Number),x=ix*2,z=iz*2,roof=estrelRoofYV345(part,x+1,z+1),top=roof+.07;
    const bottom=part.kind==="canopy"?roof-.18:data.groundY;
    return {ring:[[x,z],[x+2,z],[x+2,z+2],[x,z+2]],holes:[]as number[][][],minY:bottom,maxY:top,sourceId:`estrel-v345-way-${part.id}-cell-${key}`,topAt:()=>top,bottomAt:()=>bottom,roofTriangles:[]as number[][][],bottomRoofTriangles:[]as number[][][]};
  }):[{ring:part.ring,holes:[]as number[][][],minY:part.kind==="canopy"?data.groundY+part.height-part.roofHeight-.18:data.groundY,maxY:data.groundY+part.height,sourceId:`estrel-v345-way-${part.id}`,topAt:(x:number,z:number)=>estrelRoofYV345(part,x,z),bottomAt:(x:number,z:number)=>part.kind==="canopy"?estrelRoofYV345(part,x,z)-.18:data.groundY,roofTriangles:estrelRoofTrianglesV345(part),bottomRoofTriangles:part.kind==="canopy"?estrelRoofTrianglesV345(part,true):[]}]);
}

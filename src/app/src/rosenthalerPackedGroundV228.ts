import source from "./data/rosenthalerV228Ground.json";
import { rosenthalerGroundComplementV228 } from "./RosenthalerSurfaceAperturesV228";

type Index = Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
type Receipt = { origin:number[]; vertexCount:number; indexCount:number; triangles:number[][] };
/** Only independently matched low ground triangles in the four retained source
 * packets. Mixed building/ground arrays stay quantized and interleaved; no
 * generic geometry traversal or conversion to float world buffers occurs. */
export function* cutRosenthalerPackedGroundV228(id:string,native:boolean,origin:readonly number[],vertices:Uint16Array,indices:Index):Generator<void,{vertices:Uint16Array<ArrayBuffer>;indices:Index;changed:number}|null> {
  if(id!=="3_-3"&&id!=="4_-3")return null;
  const receipt=(source as Record<string,Receipt>)[`${id}.${native?"minecraft":"drawn"}`];
  if(!receipt||receipt.vertexCount*6!==vertices.length||receipt.indexCount!==indices.length||receipt.origin.some((v,i)=>v!==origin[i]))return null;
  // Validate every referenced index/position/color before changing any byte.
  // The release test also verifies the compressed source packet SHA-256.
  for(const row of receipt.triangles)for(let j=0;j<3;j++){
    const vertex=indices[row[0]+j];if(vertex!==row[1+j])return null;
    for(let k=0;k<3;k++)if(vertices[vertex*6+k]!==row[4+j*3+k]||vertices[vertex*6+3+k]!==row[13+j*3+k]*257)return null;
  }
  const changes=new Map<number,number[][]>();let added=0,checked=0;
  for(const row of receipt.triangles){
    const poly=row.slice(1,4).map(i=>[vertices[i*6]*.01+origin[0],vertices[i*6+1]*.01+origin[1],vertices[i*6+2]*.01+origin[2],vertices[i*6+3],vertices[i*6+4],vertices[i*6+5]]);
    const pieces=rosenthalerGroundComplementV228(poly,native);
    if(pieces){const triangles:number[][]=[];for(const p of pieces)for(let j=1;j+1<p.length;j++)triangles.push(p[0],p[j],p[j+1]);changes.set(row[0],triangles);added+=triangles.length;}
    if(++checked%32===0)yield;
  }
  if(!changes.size)return null;
  const output=new Uint16Array(vertices.length+added*6);output.set(vertices);
  const count=indices.length-changes.size*3+added;
  const next:Index=output.length/6<=65535?new Uint16Array(count):new Uint32Array(count);
  let cursor=0,vertex=vertices.length/6;
  // Copy whole unchanged spans, avoiding a full JS scan of a large tile.
  let previous=0;
  for(const [offset,triangles] of changes){
    next.set(indices.subarray(previous,offset),cursor);cursor+=offset-previous;
    for(const point of triangles){
      for(let k=0;k<3;k++)output[vertex*6+k]=Math.round((point[k]-origin[k])*100);
      for(let k=3;k<6;k++)output[vertex*6+k]=Math.round(point[k]);
      next[cursor++]=vertex++;
    }
    previous=offset+3;
  }
  next.set(indices.subarray(previous),cursor);
  return {vertices:output,indices:next,changed:changes.size};
}

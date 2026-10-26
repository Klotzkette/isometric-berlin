import data from './data/zooWestV276.json';
import type { TiergartenWerkhofSolidV275 } from './tiergartenWerkhofV275Profile';

function roofAt(triangles:number[][][],x:number,z:number):number|null{
  let roof:number|null=null;
  for(const [a,b,c]of triangles){const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-9)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;if(Math.min(u,v,1-u-v)>=-1e-6)roof=Math.max(roof??-Infinity,u*a[1]+v*b[1]+(1-u-v)*c[1]);}
  return roof;
}
/** Complete restaurants, native actual-cell roofs, open canopy slabs and posts. */
export function zooWestSolidsV276(native=false):TiergartenWerkhofSolidV275[]{
 return data.parts.flatMap(p=>{
  const cells=native?new Map(p.nativeCells.map(([x,z,y])=>[`${x}:${z}`,y])):null;
  const topAt=(x:number,z:number)=>cells?cells.get(`${Math.floor(x)}:${Math.floor(z)}`)??null:roofAt(p.roofTriangles,x,z);
  const roof:TiergartenWerkhofSolidV275={sourceId:p.sourceId,ring:native?p.nativeRing:p.ring,holes:native?p.nativeHoles:p.holes,minY:p.openCanopy?Math.min(...p.roofTriangles.flat().map(v=>v[1]))-.2:p.minY,maxY:native?Math.max(...p.nativeCells.map(c=>c[2])):p.maxY,topAt,bottomAt:p.openCanopy?(x,z)=>(topAt(x,z)??p.maxY)-.2:undefined};
  const posts:TiergartenWerkhofSolidV275[]=p.posts.map(([x,y,z,w,h,d])=>({sourceId:p.sourceId,ring:[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],holes:[],minY:y-h/2,maxY:y+h/2,topAt:(xx,zz)=>Math.abs(xx-x)<=w/2&&Math.abs(zz-z)<=d/2?y+h/2:null}));
  return [roof,...posts];
 });
}

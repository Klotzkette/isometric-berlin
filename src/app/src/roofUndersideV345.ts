/** Optional paired underside only; historical solid-building defaults stay unchanged. */
export function validRoofUndersideV345(building:{roofTriangles?:number[][][];bottomRoofTriangles?:number[][][]}):boolean{
 const bottom=building.bottomRoofTriangles;if(bottom===undefined)return true;
 const top=building.roofTriangles;
 return Array.isArray(bottom)&&bottom.length>0&&bottom.length<=100000&&Array.isArray(top)&&top.length===bottom.length&&bottom.every((triangle,i)=>{
  const upper=top[i];if(!Array.isArray(triangle)||triangle.length!==3||!Array.isArray(upper)||upper.length!==3)return false;
  if(!triangle.every((p,j)=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&Array.isArray(upper[j])&&upper[j].length===3&&upper[j].every(Number.isFinite)&&p[0]===upper[j][0]&&p[2]===upper[j][2]&&p[1]<=upper[j][1]))return false;
  const[a,b,c]=triangle;return Math.abs((b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]))>1e-9;
 });
}
/** Same local projection and nearest roof-edge clearance as the existing upper roof. */
export function roofUndersideAtV345(triangles:number[][][],x:number,z:number,radius:number):number|null{
 if(![x,z,radius].every(Number.isFinite)||radius<0)return null;
 let lower=Infinity,edge=Infinity,nearest=Infinity;
 for(const[a,b,c]of triangles){
  const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
  if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)lower=Math.min(lower,u*a[1]+v*b[1]+(1-u-v)*c[1]);
  else if(radius>0)for(const[p,q]of[[a,b],[b,c],[c,a]]){
   const dx=q[0]-p[0],dz=q[2]-p[2],length=dx*dx+dz*dz;
   const t=length>0?Math.max(0,Math.min(1,((x-p[0])*dx+(z-p[2])*dz)/length)):0;
   const distance=(x-p[0]-t*dx)**2+(z-p[2]-t*dz)**2;if(distance>=radius*radius)continue;
   const height=p[1]+t*(q[1]-p[1]);
   if(distance<nearest-1e-10){nearest=distance;edge=height;}else if(Math.abs(distance-nearest)<1e-10)edge=Math.min(edge,height);
  }
 }
 return lower!==Infinity?lower:edge!==Infinity?edge:null;
}

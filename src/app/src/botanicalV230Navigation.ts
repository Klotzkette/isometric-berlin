import data from './data/botanicalV230Navigation.json';
type Polygon=number[][][];
function ringHas(r:number[][],x:number,z:number):boolean{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[a,b]=r[i],[c,d]=r[j];if((b>z)!==(d>z)&&x<(c-a)*(z-b)/(d-b)+a)hit=!hit;}return hit;}
function polygonHas(p:Polygon,x:number,z:number):boolean{return ringHas(p[0],x,z)&&!p.slice(1).some(r=>ringHas(r,x,z));}
function bounded(x:number,z:number):boolean{return x>=1338&&x<=2247&&z>=-9855&&z<=-9250;}
function rowHas(r:number[],x:number,z:number):boolean{return Math.abs(x-r[0])<=r[3]/2&&Math.abs(z-r[2])<=r[5]/2;}
/** Only the finite newly mapped park; existing city ground is never overridden. */
export function botanicalV230GroundAt(x:number,z:number,native=false):number|null{
 if(!bounded(x,z))return null;const d=data;let y:number|null=null;
 if(native){for(const r of d.nativeGround)if(rowHas(r,x,z))y=Math.max(y??-Infinity,r[1]+r[4]/2);return y;}
 for(const p of d.groundLayers)if(polygonHas(p.rings,x,z))y=Math.max(y??-Infinity,p.y);return y;
}
export function botanicalV230WaterAt(x:number,z:number,native=false):number|null{
 if(!bounded(x,z))return null;const d=data;return(native?d.nativeWater.some(r=>rowHas(r,x,z)):d.water.some(p=>polygonHas(p,x,z)))?2.96:null;
}
function roofY(t:number[],x:number,z:number):number|null{
 const ax=t[0],az=t[2],bx=t[3],bz=t[5],cx=t[6],cz=t[8],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
 if(Math.abs(den)<1e-8)return null;const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;
 return u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6?u*t[1]+v*t[4]+(1-u-v)*t[7]:null;
}
function near(bounds:number[],x:number,z:number,r=.8):boolean{return x>=bounds[0]-r&&x<=bounds[2]+r&&z>=bounds[1]-r&&z<=bounds[3]+r;}
/** Falling onto an actual roof is supported; walkers underneath never teleport. */
export function botanicalV230FloorAt(x:number,z:number,feet:number,native=false):number|null{
 if(!bounded(x,z))return null;let y:number|null=null;
 for(const s of data.solids){if(!near(s.bounds,x,z))continue;
  if(native){for(const r of s.native){const top=r[1]+r[4]/2;if(top<=feet+.35&&rowHas(r,x,z))y=Math.max(y??-Infinity,top);}}
  else for(const t of s.roof){const top=roofY(t,x,z);if(top!==null&&top<=feet+.35)y=Math.max(y??-Infinity,top);}
 }return y;
}
/** Native collision uses the same finite raster blocks that are actually drawn. */
export function botanicalV230SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean{
 if(!bounded(x,z))return false;
 return data.solids.some(s=>near(s.bounds,x,z,radius+.8)&&(native?s.native.some(r=>Math.abs(x-r[0])<=r[3]/2+radius&&Math.abs(z-r[2])<=r[5]/2+radius&&Math.abs(y-r[1])<=r[4]/2):y>=s.bottom-.21&&y<=s.top&&[[x,z],[x+radius,z],[x-radius,z],[x,z+radius],[x,z-radius]].some(([a,b])=>polygonHas(s.rings,a,b)&&s.roof.some(t=>{const top=roofY(t,a,b);return top!==null&&y<=top;}))));
}

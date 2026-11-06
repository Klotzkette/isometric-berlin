/** Granular public-building solids; no old owner changes occur here. */
import type{Group}from"three";
import data from"./data/youthTheatresV322.json";
import{hasCompleteArchenholdV322}from"./ArchenholdV322";
import{hasCompleteYouthTheatresV322}from"./YouthTheatresV322";
type Solid={ring:number[][];holes:number[][][];bottom:number;top:number;roof:number[][][];roofShell?:boolean};
type Primitive={center:number[];basis:number[][];size:number[]};
function inside(r:number[][],x:number,z:number):boolean{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function near(r:number[][],x:number,z:number,d:number):boolean{return r.some((a,i)=>{const b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return(x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2<=d*d;});}
function contains(p:Solid,x:number,z:number,r=0):boolean{return inside(p.ring,x,z)&&!p.holes.some(h=>inside(h,x,z)&&!near(h,x,z,r))||r>0&&near(p.ring,x,z,r);}
function height(t:number[][],x:number,z:number):number|null{const[a,b,c]=t,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)return null;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;}
export function youthTheatresNavigationV322(root:Group,native=false,site:"archenhold"|"atze"|"parkaue"|"strahl"="archenhold"):{solidAt:(x:number,y:number,z:number,radius?:number)=>boolean;groundAt:(x:number,z:number,currentY?:number)=>number|null}|null{
 const gate=()=>site==="archenhold"?hasCompleteArchenholdV322(root,native):hasCompleteYouthTheatresV322(root,native);if(!gate())return null;
 const source=data.navigation[site],rows=(native?source.native:source.drawn)as Solid[],primitives=(site==="archenhold"?(native?data.navigation.archenhold.nativePrimitives:data.navigation.archenhold.drawnPrimitives):[])as Primitive[];
 const points=rows.flatMap(p=>p.ring.map(v=>[v[0],v[1]]));for(const p of primitives){const half=[0,2].map(k=>p.basis.reduce((n,a,j)=>n+Math.abs(a[k])*p.size[j]/2,0));for(const sign of[-1,1])points.push([p.center[0]+sign*half[0],p.center[2]+sign*half[1]]);}const bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];const range=(x:number,z:number,r=0)=>x+r>=bounds[0]&&x-r<=bounds[2]&&z+r>=bounds[1]&&z-r<=bounds[3];
 return{solidAt(x,y,z,radius=0){if(!range(x,z,radius)||!gate())return false;for(const p of rows){if(y<p.bottom-.01||y>p.top+.01||!contains(p,x,z,radius))continue;const roofs=p.roof.map(t=>height(t,x,z)).filter((v):v is number=>v!==null);if(!roofs.length||y<Math.max(...roofs)-.01&&(!p.roofShell||y>=Math.max(...roofs)-.14))return true;}return primitives.some(p=>{const d=[x-p.center[0],y-p.center[1],z-p.center[2]];return p.basis.every((a,i)=>Math.abs(a.reduce((n,v,j)=>n+v*d[j],0))<=p.size[i]/2+radius);});},groundAt(x,z,currentY){if(!range(x,z)||!gate())return null;let best:number|null=null;for(const p of rows){if(!contains(p,x,z))continue;const roofs=p.roof.length?p.roof.map(t=>height(t,x,z)).filter((v):v is number=>v!==null):[p.top];for(const h of roofs)if((currentY===undefined||h>=currentY-1&&h<=currentY+.65)&&(best===null||h>best))best=h;}return best;}};
}
export const archenholdNavigationV322=(root:Group,native=false)=>youthTheatresNavigationV322(root,native,"archenhold");

/** All three actual new theatre envelopes, bounded before any private gate. */
export function requiredYouthTheatresNavigationV322(root:Group,native=false){const sites=(["atze","parkaue","strahl"]as const).map(site=>youthTheatresNavigationV322(root,native,site));if(sites.some(s=>!s))return null;return{solidAt:(x:number,y:number,z:number,radius=0)=>sites.some(s=>s!.solidAt(x,y,z,radius)),groundAt:(x:number,z:number,currentY?:number)=>{const heights=sites.map(s=>s!.groundAt(x,z,currentY)).filter((h):h is number=>h!==null);return heights.length?Math.max(...heights):null;}};}

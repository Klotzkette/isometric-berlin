import data from "./data/fritzRodelbahnV229Navigation.json";
function inside(ring:number[][],x:number,z:number):boolean {
  let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }return yes;
}
/** Same actual delivered backing: continuous drawn ground and independent native cells. */
export function fritzRodelbahnGroundAtV229(x:number,z:number,native=false):number|null {
  const [w,n,e,s]=data.bounds;
  if(x<w-4||x>e+4||z<n-4||z>s+4)return null;
  if(native){x=Math.floor(x/4)*4+2;z=Math.floor(z/4)*4+2;}
  if(!data.footprint.some(p=>inside(p.ring,x,z)&&!p.holes.some(h=>inside(h,x,z))))return null;
  const g=data.ground,u=(x-g.origin[0])/g.step,v=(z-g.origin[1])/g.step,r=g.heights;
  if(native)return r[Math.floor(v)][Math.floor(u)]/10+data.nativeLift;
  const i=Math.floor(u-.5),j=Math.floor(v-.5),a=u-.5-i,b=v-.5-j;
  return ((r[j][i]*(1-a)+r[j][i+1]*a)*(1-b)+(r[j+1][i]*(1-a)+r[j+1][i+1]*a)*b)/10+data.lift;
}

import nav from './data/waldbuehneV201Navigation.json';

function inside(x:number,z:number,ring:readonly number[][]):boolean {
  let yes=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
function triangleY(t:readonly number[][],x:number,z:number):number|null {
  const [a,b,c]=t;
  const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(d)<1e-9)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
  return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7?u*a[1]+v*b[1]+(1-u-v)*c[1]:null;
}
const nativeFloors = new Map(nav.nativeFloors.map(r=>[`${r[0]},${r[1]}`,r[2]]));
function nearby(x:number,z:number):boolean {const b=nav.bounds;return x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3];}
/** Sloping source roof sheets are the traversable seating surface, not buildings. */
export function waldbuehneGroundAt(x:number,z:number,native=false):number|null {
  if(!Number.isFinite(x)||!Number.isFinite(z)||!nearby(x,z))return null;
  if(!native&&inside(x,z,nav.deck.ring))return nav.deck.y;
  if(native)return nativeFloors.get(`${Math.floor(x)},${Math.floor(z)}`)??null;
  let result:number|null=null;
  for(const t of nav.floorTriangles){const y=triangleY(t,x,z);if(y!==null)result=result===null?y:Math.max(result,y);}
  return result;
}
/** Only the thin tent membrane and its two supports are solids; the bowl is open. */
export function waldbuehneSolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  if(![x,y,z,radius].every(Number.isFinite)||!nearby(x,z))return false;
  const r=Math.max(0,radius);
  for(const leg of nav.legs){if(y>=leg[1]&&y<=leg[4]&&Math.hypot(x-leg[0],z-leg[2])<=r+(native?.2:leg[6]/2))return true;}
  for(const t of nav.roofTriangles){const roof=triangleY(t,native?Math.floor(x)+.5:x,native?Math.floor(z)+.5:z);if(roof!==null&&Math.abs(y-(native?Math.round(roof*4)/4:roof))<=r+.15)return true;}
  return false;
}

import navigation from './data/wuhlheideV201Navigation.json';

function inside(x: number,z: number,ring: readonly number[][]): boolean {
  let yes=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
/** Only the raised playing deck overrides the shared measured ground field. */
export function wuhlheideGroundAt(x:number,z:number,_native=false):number|null {
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  return inside(x,z,navigation.stage.ring)?navigation.stage.topY:null;
}
/** The earthwork is traversable ground, never the previous solid9m building. */
export function wuhlheideSolidAt(x:number,y:number,z:number,radius=0,_native=false):boolean {
  if(![x,y,z,radius].every(Number.isFinite))return false;
  const b=navigation.bounds;
  if(x<b[0]-radius||x>b[2]+radius||z<b[1]-radius||z>b[3]+radius)return false;
  if(y>=navigation.roof.bottomY&&y<=navigation.roof.topY&&inside(x,z,navigation.roof.ring))return true;
  for(const leg of navigation.legs){
    if(y<leg.a[1]||y>leg.b[1])continue;
    const t=(y-leg.a[1])/(leg.b[1]-leg.a[1]);
    const px=leg.a[0]+t*(leg.b[0]-leg.a[0]),pz=leg.a[2]+t*(leg.b[2]-leg.a[2]);
    if(Math.hypot(x-px,z-pz)<=Math.max(0,radius)+leg.radius)return true;
  }
  return false;
}

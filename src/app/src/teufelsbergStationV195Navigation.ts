import source from "./data/teufelsbergStationV195.json";
type Ring = readonly (readonly number[])[];
function inside(x:number,z:number,r:Ring):boolean {
  let value=false;
  for(let i=0,j=r.length-1;i<r.length;j=i++) {
    const a=r[i],b=r[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])value=!value;
  }
  return value;
}
function nearby(x:number,z:number,radius:number):boolean {
  return x>=-9026-radius&&x<=-8866+radius&&z>=2092-radius&&z<=2291+radius;
}
/** Source block volumes retain holes; only represented central-tower members collide. */
export function teufelsbergStationV195SolidAt(x:number,y:number,z:number,radius=0,native=false):boolean {
  if(!nearby(x,z,radius))return false;
  if(native) {
    for(const r of source.blocks) {
      if(Math.abs(x-r[0])<=r[3]/2+radius&&Math.abs(y-r[1])<=r[4]/2&&Math.abs(z-r[2])<=r[5]/2+radius)return true;
    }
    return false;
  }
  for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]) {
    const px=x+dx,pz=z+dz;
    for(const p of source.navigation) {
      if(y>=p.minY&&y<=p.maxY&&inside(px,pz,p.rings[0])&&!p.rings.slice(1).some(h=>inside(px,pz,h)))return true;
    }
    for(const d of source.radomes) {
      const distance=Math.hypot(px-d.centre[0],y-d.centre[1],pz-d.centre[2]);
      if(y>=d.baseY&&y<=d.topY&&distance>=d.radius-.28&&distance<=d.radius+.08)return true;
    }
  }
  for(const r of source.boxes) {
    const dx=x-r[0],dz=z-r[2],c=Math.cos(r[6]),s=Math.sin(r[6]);
    if(Math.abs(dx*c-dz*s)<=r[3]/2+radius&&Math.abs(dx*s+dz*c)<=r[5]/2+radius&&Math.abs(y-r[1])<=r[4]/2)return true;
  }
  return false;
}

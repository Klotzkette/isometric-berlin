import profile from "./data/wasserturmParkWalkV381.json";
import {gunzipSync} from "three/examples/jsm/libs/fflate.module.js";
import {decodeBase64Bytes} from "./decodeBase64Bytes";

let grid:Uint16Array|undefined;
function inParcel(x:number,z:number) {
  let result=false;
  for(let i=0,j=profile.ring.length-1;i<profile.ring.length;j=i++) {
    const a=profile.ring[i],b=profile.ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}

export function wasserturmParkGroundV381(x:number,z:number,native=false):number|undefined {
  if(x<3108.25||x>3282.75||z< -1670.92||z> -1480.57||!inParcel(x,z)) return;
  for(const [ax,az,bx,bz,w,y] of native?profile.steps.native:profile.steps.drawn) {
    if(x<Math.min(ax,bx)-w/2||x>Math.max(ax,bx)+w/2||z<Math.min(az,bz)-w/2||z>Math.max(az,bz)+w/2) continue;
    const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz;
    const t=((x-ax)*dx+(z-az)*dz)/len;
    if(t>=0&&t<=1&&Math.abs((x-ax)*dz-(z-az)*dx)<=w*.5*Math.sqrt(len))return y;
  }
  if(!grid) {
    const data=gunzipSync(decodeBase64Bytes(profile.cm));
    grid=new Uint16Array(data.buffer,data.byteOffset,data.length/2);
  }
  const u=(x-profile.x)/profile.step,v=(z-profile.z)/profile.step;
  const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,idx=j*profile.nx+i;
  const nw=grid[idx]*.01,ne=grid[idx+1]*.01,sw=grid[idx+profile.nx]*.01,se=grid[idx+profile.nx+1]*.01;
  if(native)return Math.floor((grid[idx]+grid[idx+profile.nx+1]+25)/50)/4;
  return a>=b?nw*(1-a)+ne*(a-b)+se*b:nw*(1-b)+sw*(b-a)+se*a;
}

type SolidIndex={words:Int16Array; cells:Map<number,number[]>};
const obstacleIndex:(SolidIndex|undefined)[]=[];
function solids(native:boolean) {
  const k=Number(native);
  if(obstacleIndex[k])return obstacleIndex[k]!;
  const raw=gunzipSync(decodeBase64Bytes(native?profile.solids.native:profile.solids.drawn));
  const words=new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),cells=new Map<number,number[]>();
  for(let i=0;i<words.length;i+=7){
    const margin=words[i+4]/2+200;
    const left=Math.floor((Math.min(words[i],words[i+2])-margin)/800),right=Math.floor((Math.max(words[i],words[i+2])+margin)/800);
    const top=Math.floor((Math.min(words[i+1],words[i+3])-margin)/800),bottom=Math.floor((Math.max(words[i+1],words[i+3])+margin)/800);
    for(let zz=top;zz<=bottom;zz++)for(let xx=left;xx<=right;xx++){
      const key=zz*64+xx;const group=cells.get(key);if(group)group.push(i);else cells.set(key,[i]);
    }
  }
  return obstacleIndex[k]={words,cells};
}

function parkRoof(x:number,z:number,native:boolean,margin=0) {
  for(const roof of profile.roofs){
    const dx=x-roof.x,dz=z-roof.z,range=Math.hypot(dx,dz);
    if(range>roof.radius*1.44+margin)continue;
    const [low,peak]=roof.levels[Number(native)];
    if(roof.standpipe){
      if(native && Math.max(Math.abs(dx),Math.abs(dz))>2.74+margin)continue;
      if(!native){
        let inside=false;
        for(let i=0,j=roof.ring.length-1;i<roof.ring.length;j=i++){
          const a=roof.ring[i],b=roof.ring[j];
          if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
        }
        if(!inside)continue;
      }
      return {low,high:peak};
    }
    const half=Math.PI/roof.shape;
    const angle=((Math.atan2(dz,dx)-roof.phase+Math.PI*4)%(2*half))-half;
    const radial=range*Math.cos(angle)/Math.cos(half);
    if(radial>roof.radius*1.11+margin)continue;
    const high=radial<.34?peak:peak-.4-.85*Math.min(1,Math.max(0,(radial-.36)/(roof.radius*1.11-.36)));
    return {low,high};
  }
}

export function wasserturmParkRoofV381(x:number,z:number,feet:number,native=false) {
  const roof=parkRoof(x,z,native);
  return roof && roof.high<=feet+.45 ? roof.high : undefined;
}
export function wasserturmParkSolidV381(x:number,y:number,z:number,radius=0,native=false) {
  if(x<3106||x>3285||z< -1674||z> -1478)return false;
  const roof=parkRoof(x,z,native,radius);
  if(roof&&y>roof.low+.04&&y<roof.high)return true;
  const cx=(x-profile.x)*100,cz=(z-profile.z)*100;
  const {words,cells}=solids(native);
  for(const i of cells.get(Math.floor(cz/800)*64+Math.floor(cx/800))??[]){
    if(y*100<=words[i+5]+3||y*100>=words[i+6])continue;
    const ax=words[i],az=words[i+1],dx=words[i+2]-ax,dz=words[i+3]-az;
    const l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((cx-ax)*dx+(cz-az)*dz)/l)):0;
    if(Math.hypot(cx-ax-t*dx,cz-az-t*dz)<words[i+4]*.5+radius*100)return true;
  }
  return false;
}

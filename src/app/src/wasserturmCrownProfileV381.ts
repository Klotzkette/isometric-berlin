export const towerBodyCutV381=31.62;
export const towerCenterV381=[3236.36,-1629.52] as const;

/** Nav reads the same bDOM-reconstructed cone as the drawn and block roofs. */
export function towerCrownRoofV381(x:number,z:number,native=false):number|undefined {
  let dx=x-towerCenterV381[0],dz=z-towerCenterV381[1];
  if(Math.abs(dx)>12||Math.abs(dz)>12)return;
  if(native){
    dx=(Math.floor(dx*2)+.5)*.5;dz=(Math.floor(dz*2)+.5)*.5;
    const r=Math.hypot(dx,dz);
    if(r>11.76)return;
    const y=r<=1.02?49.38:r<=9.12?43.42-(r-1.02)*.652:32.33;
    return Math.round(y*4)/4;
  }
  const r=Math.hypot(dx,dz),angle=(Math.atan2(dz,dx)+Math.PI*2)%(Math.PI*2);
  const polyRadius=(n:number,phase=0)=>{
    const half=Math.PI/n;
    const a=((angle-phase+4*Math.PI)%(2*half))-half;
    return r*Math.cos(a)/Math.cos(half);
  };
  if(polyRadius(60)>11.76)return;
  if(polyRadius(16)<=1.01)return 49.38;
  const radial=polyRadius(20,Math.PI/20);
  if(radial>9.18)return 32.33;
  return 43.42-(Math.max(1.02,radial)-1.02)*(43.42-38.14)/(9.18-1.02);
}

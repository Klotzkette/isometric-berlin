import field from "./data/teufelsbergTerrainV195.json";
/** Local measured replacement, null outside: NHN minus33 as baseline offset. */
export function teufelsbergTerrainOffsetV195(x:number,z:number,native=false):number|null {
  if(native){x=Math.floor(x/8)*8+4;z=Math.floor(z/8)*8+4;}
  for(let i=field.profiles.length-1;i>=0;i--){
    const p=field.profiles[i],[w,n,e,s]=p.support;
    if(x<=w||x>=e||z<=n||z>=s)continue;
    const u=(x-w)/p.stepM,v=(z-n)/p.stepM,ix=Math.floor(u),iz=Math.floor(v),a=u-ix,b=v-iz;
    const nw=p.offsets[iz][ix],ne=p.offsets[iz][ix+1],sw=p.offsets[iz+1][ix],se=p.offsets[iz+1][ix+1];
    return a>=b?nw*(1-a)+ne*(a-b)+se*b:nw*(1-b)+sw*(b-a)+se*a;
  }
  return null;
}

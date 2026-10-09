import field from "./data/olympicTerrainV201.json";
/** Measured local NHN−33 offset, with a continuous apron to the retained field. */
export function olympicTerrainOffsetV201(x:number,z:number,native=false):number|null {
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  if(native){x=Math.floor(x/8)*8+4;z=Math.floor(z/8)*8+4;}
  const p=field.profiles[0],[w,n,e,s]=p.support;
  if(x<=w||x>=e||z<=n||z>=s)return null;
  const u=(x-w)/p.stepM,v=(z-n)/p.stepM,ix=Math.floor(u),iz=Math.floor(v),a=u-ix,b=v-iz;
  const nw=p.offsets[iz][ix],ne=p.offsets[iz][ix+1],sw=p.offsets[iz+1][ix],se=p.offsets[iz+1][ix+1];
  return a>=b?nw*(1-a)+ne*(a-b)+se*b:nw*(1-b)+sw*(b-a)+se*a;
}

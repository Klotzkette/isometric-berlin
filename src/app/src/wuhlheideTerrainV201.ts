import field from './data/wuhlheideTerrainV201.json';
/** Measured total NHN−33 offset; bounded blend apron returns to old ground. */
export function wuhlheideTerrainOffsetV201(x: number, z: number, native = false): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (native) { const s = field.nativeStepM; x = Math.floor(x/s)*s+s/2; z = Math.floor(z/s)*s+s/2; }
  const p = field.profiles[0], [w,n,e,s] = p.support;
  if (x <= w || x >= e || z <= n || z >= s) return null;
  const u=(x-w)/p.stepM,v=(z-n)/p.stepM,ix=Math.floor(u),iz=Math.floor(v),a=u-ix,b=v-iz;
  const nw=p.offsets[iz][ix],ne=p.offsets[iz][ix+1],sw=p.offsets[iz+1][ix],se=p.offsets[iz+1][ix+1];
  return a>=b ? nw*(1-a)+ne*(a-b)+se*b : nw*(1-b)+sw*(b-a)+se*a;
}

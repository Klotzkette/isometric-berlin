import hosts from "./data/rykeStreetsHostsV381.json";

type Host = { id: string; bounds: [number, number, number, number] };
type View = { position: [number, number, number]; target: [number, number, number]; fov: number };

export const rykeStreetsHostsV381 = hosts as Host[];
export const rykeStreetsViewsV381: Record<string,View> = {
  "Rykestraße": {position:[3255,91,-1714],target:[3321,7,-1776],fov:46},
  "Knaackstraße": {position:[3196,89,-1691],target:[3133,6,-1764],fov:47},
};
export function rykeStreetsOpeningHostV381(name: string): string | undefined {
  const view=rykeStreetsViewsV381[name];
  if (!view) return;
  const [x,,z]=view.target;
  return "ryke381-"+Math.floor(x/512)+"_"+Math.floor(z/512);
}

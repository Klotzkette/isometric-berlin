import index from "./data/wittenbergQuartierIndexV383.json";

type View = {position: [number,number,number]; target: [number,number,number]; fov:number};
export const wittenbergQuartierHostsV383 = index.hosts.map(tile => {
  const bounds = index.bounds[tile as keyof typeof index.bounds];
  return {id:"wit383-"+tile, bounds:bounds as [number,number,number,number]};
});

export const wittenbergQuartierViewsV383: Record<string,View> = {
  "Lebensalterbrunnen am Wittenbergplatz": {position:[-2012,17,1926], target:[-1994.7,8.2,1906.6], fov:47},
  "Nordbrunnen am Wittenbergplatz": {position:[-1938,15.5,1789], target:[-1956.0,8.3,1805.6], fov:46},
  "Tauentzienstraße": {position:[-2312,38,1630],target:[-2264.7,8.1,1674.9],fov:49},
};

export function wittenbergQuartierOpeningHostV383(name:string): string|undefined {
  const view = wittenbergQuartierViewsV383[name];
  if (!view) return;
  const [x,,z] = view.target;
  return "wit383-"+Math.floor(x/512)+"_"+Math.floor(z/512);
}

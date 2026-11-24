export const kreuzbergPlaetzeHostsV380: {id: string; bounds: [number,number,number,number]}[] = [
  {id:"kreuzberg380-moritz",bounds:[2508,1636,2748,1876]},
  {id:"kreuzberg380-rio",bounds:[3375,2070,3539,2234]},
];
export const kreuzbergPlaetzeIdsV380 = new Set(kreuzbergPlaetzeHostsV380.map(site=>site.id));

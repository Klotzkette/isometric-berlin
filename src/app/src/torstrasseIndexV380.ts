import hosts from "./data/torstrasseHostsV380.json";

type Host = {id: string; bounds: [number, number, number, number]};
type View = {position: [number, number, number]; target: [number, number, number]; fov: number};

export const torstrasseHostsV380 = hosts as Host[];
export const torstrasseViewsV380: Record<string, View> = {
  "Torstraße": {position: [1660, 96, -963], target: [1568, 7, -1045], fov: 47},
  "Rosenthaler Platz": {position: [2131, 94, -1074], target: [2058, 7, -1156], fov: 48},
};
export function torstrasseOpeningHostV380(name: string): string | undefined {
  const view = torstrasseViewsV380[name];
  if (!view) return;
  const [x,, z] = view.target;
  return "tor380-" + Math.floor(x / 512) + "_" + Math.floor(z / 512);
}

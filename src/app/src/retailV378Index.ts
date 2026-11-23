import index from "./data/retailHostsV378.json";

type Position = [number, number, number];
export type RetailCameraV378 = {
  position: Position;
  target: Position;
  fov: number;
};
type Host = {
  id: string;
  bounds: [number, number, number, number];
  name: string;
  zone: "West" | "NorthEast" | "SouthEast";
  camera: RetailCameraV378;
};
const sites = index as Host[];
export const retailHostsV378 = sites.map(({ id, bounds }) => ({ id, bounds }));
export const retailViewsV378: Record<string, RetailCameraV378> =
  Object.fromEntries(sites.map((site) => [site.name, site.camera]));
const byId = new Map(sites.map((site) => [site.id, site]));
export const retailHostV378 = (id: string) => byId.get(id);

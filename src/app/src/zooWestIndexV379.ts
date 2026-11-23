import bounds from "./data/zooWestV379Hosts.json";

export const zooWestHostsV379 = Object.entries(bounds).map(([tile, box]) => ({
  id: "zoo-west379-" + tile,
  bounds: box as [number, number, number, number],
}));
export const zooWestIdsV379: ReadonlySet<string> = new Set(zooWestHostsV379.map(host => host.id));

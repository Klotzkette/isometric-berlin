import index from "./data/transportV378Hosts.json";

const airportHosts = new Set([
  "ber236-16_33",
  "ber236-17_33",
  "ber236-17_34",
  "ber236-18_34",
  "ber236-16_34",
  "kladow346--31_9",
  "ring182-3_9",
  "tegel346--14_-9",
  "tegel346--13_-9",
  "tegel346--12_-9",
  "tegel346--12_-10",
  "tegel346--11_-10",
  "tegel346--10_-10",
]);
const routes = index as Record<string, (string | boolean)[]>;
export const isTransportAirportHostV378 = (id: string): boolean => airportHosts.has(id);
export const transportRouteBankV378 = (id: string): string | undefined =>
  routes[id]?.[0] as string | undefined;
export const hasTransportV378 = (id: string): boolean => airportHosts.has(id) || Object.hasOwn(routes, id);
export const transportExteriorHasGroundV378 = (id: string): boolean => routes[id]?.[1] === true;
export const transportExteriorTilesV378 = Object.keys(routes).map((id) => {
  const [ix, iz] = id.slice("transport378-".length).split("_").map(Number);
  // The road/track envelope can extend by half its mapped width beyond its centreline cell.
  const bounds: [number, number, number, number] = [
    ix * 512 - 18,
    iz * 512 - 18,
    (ix + 1) * 512 + 18,
    (iz + 1) * 512 + 18,
  ];
  return { id, bounds };
});

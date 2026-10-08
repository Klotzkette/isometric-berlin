import { STEGLITZ_V182_PARTS } from "../../src/steglitzV182Profile";
import { ALEXANDER_STATIONS_V183_BUILDING_PARTS, ALEXANDER_STATIONS_V183_HALL_SOLIDS } from "../../src/alexanderStationsV183Profile";

// Independently registered outer owners exist even in a local fixture. The
// expected identities come from the complete sources, not a global magic count.
export const persistentPedestrianSourceIds = new Set([
  ...STEGLITZ_V182_PARTS.map(p => p.id),
  ...ALEXANDER_STATIONS_V183_BUILDING_PARTS.map(p => p.id),
  ...ALEXANDER_STATIONS_V183_HALL_SOLIDS.map(p => p.id),
]);

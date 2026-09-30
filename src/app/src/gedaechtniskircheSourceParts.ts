/** Exact committed OSM way 15218373 low wings outside the authored central
 * ruin rectangle. Clipped locally with Shapely; source envelope retained.
 * The narrow source strip crossing the documented open arch is kept as an
 * overhead lintel/roof, preserving its plan/top without closing the passage. */
export const GEDAECHTNISKIRCHE_RETAINED_WINGS = [
  {
    id: "15218373-retained-wing-0",
    ring: [
      [-2505.7, 1524.7],
      [-2505.8, 1525.3],
      [-2505.0, 1525.4],
      [-2504.2, 1525.6],
      [-2504.1, 1525.0],
      [-2503.4, 1525.1],
      [-2503.5, 1526.2],
      [-2502.3, 1526.4],
      [-2502.4, 1528.1],
      [-2502.2, 1529.3],
      [-2501.6, 1530.4],
      [-2500.8, 1531.3],
      [-2499.7, 1531.9],
      [-2498.6, 1532.3],
      [-2497.3, 1532.3],
      [-2496.1, 1532.1],
      [-2495.0, 1531.5],
      [-2494.1, 1530.7],
      [-2493.5, 1529.7],
      [-2493.1, 1528.5],
      [-2491.6, 1528.8],
      [-2491.0, 1525.7],
      [-2489.3, 1526.0],
      [-2487.2552753, 1514.5180843],
      [-2487.6286151, 1514.451784],
      [-2489.4208401, 1524.5438814],
      [-2506.8433711, 1521.4498669],
      [-2507.4, 1524.4],
    ],
    baseY: 5.2,
    topY: 14.2,
  },
  {
    id: "15218373-retained-wing-1",
    ring: [
      [-2485.4, 1504.1],
      [-2485.779894, 1504.0415548],
      [-2485.7926773, 1504.1135379],
      [-2485.4143747, 1504.1807195],
    ],
    baseY: 5.2,
    topY: 14.2,
  },
  {
    id: "15218373-retained-wing-2",
    ring: [
      [-2485.4143747, 1504.1807195],
      [-2485.7926773, 1504.1135379],
      [-2487.6286151, 1514.451784],
      [-2487.2552753, 1514.5180843],
    ],
    baseY: 14.0,
    topY: 14.2,
  },
] as const;
export const GEDAECHTNISKIRCHE_SOURCE_AREA_M2 = 545.73;
export const GEDAECHTNISKIRCHE_RETAINED_WING_AREA_M2 = 112.9650867;

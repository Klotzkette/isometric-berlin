import source from "./bismarckMoltkeSource.json";

export const BISMARCK_MOLTKE_OSM_KEYS = [
  "node/270687313",
  "node/278706862",
] as const;
export const BISMARCK_MOLTKE_PRISM_IDS: ReadonlySet<string> = new Set(
  source.parts.map((p) => p.id),
);
export const BISMARCK_MOLTKE_PROFILES = Object.freeze({
  bismarck: Object.freeze({
    name: "Bismarck-Nationaldenkmal",
    osmKey: BISMARCK_MOLTKE_OSM_KEYS[0],
    worldM: [-1479.688344, 5.2, 300.73664] as const,
    wgs84: [13.3497493, 52.5158896] as const,
    rotationY: 0.11849,
    totalHeightM: 15,
    figureHeightM: 6.6,
    pedestalHeightM: 8.4,
    artist: "Reinhold Begas; panther by August Gaul",
    material: "green-patinated bronze; polished red granite",
    source: "https://bildhauerei-in-berlin.de/bildwerk/bismarck-denkmal-4617/",
    inventory:
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419",
    lostParts: [
      "six lower pedestal reliefs removed in 1958/1960",
      "two original side fountains",
    ],
    retainedGroups: [
      "Atlas and globe at front",
      "Siegfried forging sword at rear",
      "Sibyl reading on sphinx at left",
      "state power and panther at right",
    ],
  }),
  moltke: Object.freeze({
    name: "Moltke-Denkmal",
    osmKey: BISMARCK_MOLTKE_OSM_KEYS[1],
    worldM: [-1420.113409, 5.2, 351.650691] as const,
    wgs84: [13.350644, 52.5154443] as const,
    rotationY: -0.358771,
    totalHeightM: 9.2,
    figureHeightM: 5.5,
    pedestalHeightM: 3.7,
    totalHeightStatus:
      "present-day display estimate; published 11.5 m describes the lost 1905 substructure",
    artist: "Joseph Uphues",
    material: "Laas marble",
    source: "https://bildhauerei-in-berlin.de/bildwerk/moltke-denkmal-5323/",
    inventory:
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419",
    pose: "crossed legs, clasped hands, peaked cap and two-column rear support",
  }),
});

/** Only the exact committed monument columns and their source height bands. */
export function bismarckMoltkeSourceColumnAt(
  x: number,
  z: number,
  y0: number,
  y1: number,
  cellM = 4,
): boolean {
  return (
    Math.abs(cellM - 4) < 1e-6 &&
    source.sourceColumns.some(
      (c) =>
        Math.abs(c[0] - x) < 0.01 &&
        Math.abs(c[1] - z) < 0.01 &&
        Math.abs(c[2] - y0) < 0.01 &&
        Math.abs(c[3] - y1) < 0.01,
    )
  );
}

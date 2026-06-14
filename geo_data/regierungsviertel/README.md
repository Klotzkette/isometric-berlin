# Geo data — Regierungsviertel

Derived, clipped geodata for the MVP area only. Raw city-wide dumps
do **not** belong here — see `.gitignore`.

## Files

- `bounds.geojson` — the MVP polygon (rough rectangle around the
  Government Quarter).
- `buildings.gpkg` *(TODO)* — Berlin LoD2 buildings clipped to bounds.
- `osm.gpkg` *(TODO)* — OSM streets/water/parks/rail clipped to bounds.

## Licensing

- LoD2 buildings: [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0)
  (Geoportal Berlin).
- OSM extracts: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
  © OpenStreetMap contributors.

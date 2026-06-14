# Data

## 3D Buildings — Berlin LoD2

- Source: [Geoportal Berlin — 3D-Gebäudemodelle LoD2](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin)
- Format: CityGML (per Bezirk / city-wide).
- License: [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0)
  (effectively public domain, no attribution required).

LoD2 = building footprints extruded to eaves with differentiated roof
shapes (flat, gable, hip, pyramid, mansard, dome). Enough detail for
recognisable Berlin silhouettes (Reichstag dome, Hauptbahnhof glass
roof would need a manual override / hero tile pass).

## Context — OpenStreetMap

- Source: [openstreetmap.org](https://www.openstreetmap.org)
- License: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- Attribution (required in viewer): "© OpenStreetMap contributors".

Used for: streets, water (Spree), parks (Tiergarten), rail tracks at
Hauptbahnhof, POIs.

## Local storage

Only **clipped, small** derivatives for the Regierungsviertel polygon
are committed to git, under
`geo_data/regierungsviertel/`. Raw whole-city CityGML and OSM pbf
files belong outside the repo (or in object storage).

## Tile generations DB

Each map (`MAP_ID`) lives under `generations/<map-id>/`. The on-disk
schema mirrors the NYC project — a SQLite DB `quadrants.db` with one
row per quadrant containing the orthographic render and the AI tile.
See [`generations/README.md`](../generations/README.md).

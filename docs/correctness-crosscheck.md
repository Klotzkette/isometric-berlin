# Correctness Crosscheck

This note records the public reference sweep used for v0.1.24. It is not
a new raw-data import; it is a provenance and QA pass for the existing
Regierungsviertel viewer and renderer.

## Reference hierarchy

1. **Berlin LoD2 / Geoportal Berlin** remains the geometry anchor. The
   Berlin LoD2 record describes a citywide LoD2 building model whose
   footprints correspond to the building outlines in the cadastral
   register and whose roof shapes are generalized standard roof forms:
   <https://gdi.berlin.de/geonetwork/srv/api/records/3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf>
2. **Berlin Geoinformation / FIS-Broker / Geoportal** remains the official
   map reference for cadastral, geotopographic, DOP, DGM, and city-map
   layers: <https://www.berlin.de/sen/stadt/stadtdaten/geoinformation/>
   and <https://fbinter.stadt-berlin.de/fb/index.jsp>
3. **Berlin 3D / Digitale Innenstadt** is a useful public reference for
   the idea of a Berlin 3D city representation and its relationship to
   2D city-plan geometry: <https://www.berlin.de/sen/stadt/stadtdaten/stadtwissen/digitale-innenstadt/3d-modell/>
4. **OpenStreetMap / Geofabrik Berlin extracts** remain the additive
   source for streets, water, parks, rail, and semantic context. The
   Geofabrik Berlin extract page was checked as the current public OSM
   availability reference: <https://download.geofabrik.de/europe/germany/berlin.html>
5. **Google Maps and Apple Maps** were used only as visual sanity checks
   for relative placement. No geometry, tiles, screenshots, labels, or
   derived assets from either service were copied, stored, or committed.

## Spatial conclusion

The viewer tour order now follows a north-to-south walk through the
Regierungsviertel rather than the incidental order of `landmarks.json`:

1. Berlin Hauptbahnhof
2. Zollpackhof
3. Gustav-Heinemann-Brücke
4. Bundeskanzleramt
5. Marie-Elisabeth-Lüders-Haus
6. Paul-Löbe-Haus
7. Reichstagsgebäude
8. Spreebogen
9. Haus der Kulturen der Welt
10. Brandenburger Tor
11. Max-Liebermann-Haus
12. Botschaft der Vereinigten Staaten von Amerika
13. Tiergartentunnel Südeingang

This is a UI/tour ordering change only. It does not move landmark
coordinates or geometry. The existing placement QA remains responsible
for coordinate correctness against OSM and LoD2.

## Release-readiness guard

v0.1.24 adds `scripts/check_release_readiness.py` and a pytest wrapper so
future releases fail early when:

- project/package/app versions drift apart;
- the README status line is stale;
- required bundled DZI viewer assets are missing;
- Finder-style duplicate copies or hidden package artefacts sneak into
  the bundled static viewer.

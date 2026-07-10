# Correctness Crosscheck

This note records the public reference sweep used for v0.1.24 and the
expanded Wikimedia/landmark sweep used for v0.1.25. It is not a new
authoritative geometry import; it is a provenance and QA pass for the
existing Regierungsviertel viewer and renderer.

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

## v0.1.25 Landmark And Commons Expansion

v0.1.25 expands the committed placement QA from 13 to 26 landmarks. The
new points cover the Humboldthafen / bridge context, Pariser Platz,
Holocaust and Tiergarten memorials, and the southern Tiergarten /
Kemperplatz tunnel context requested for orientation checks. Every
committed point is checked against local OSM name evidence and Berlin
LoD2 building evidence in `geo_data/regierungsviertel/landmark_alignment.json`.

The Wikimedia reference manifest now contains 68 freely licensed
thumbnail references across 23 motif groups. The fetcher rejects
non-free licenses and attribution-required images without author/credit
metadata, and it filters historical/archival/interior/event images that
would distort current exterior material cues. Max-Liebermann-Haus has
two accepted references because the remaining Commons hits were paintings
or memorial plaques rather than usable building views.

## Spatial conclusion

v0.2.4 retains the machine-checked layer of 39 landmarks and 23 relative
relationships without moving the existing points. The four additions are
Schweizerische Botschaft (OSM relation `2886766`), Fahne der Einheit (OSM node
`437140233`), Quadriga mit Victoria (OSM node `3786417057`) and Starbucks
Pariser Platz (OSM node `66917229`). The generated alignment report remains
the current source of truth for status and distances.

The viewer tour order follows a north-to-south walk through the
Regierungsviertel rather than the incidental order of `landmarks.json`:

1. Berlin Hauptbahnhof
2. Humboldthafen
3. Hugo-Preuß-Brücke
4. Rahel-Hirsch-Straße
5. Gustav-Heinemann-Brücke
6. Moltkebrücke
7. Zollpackhof
8. Schweizerische Botschaft
9. Bundeskanzleramt
10. Eduardo-Chillida-Skulptur Berlin
11. Kanzlergarten / Non-Violence-Skulptur
12. Spreebogen
13. Marie-Elisabeth-Lüders-Haus
14. Paul-Löbe-Haus
15. Gedenkort für Polen 1939-1945
16. Reichstagsgebäude
17. Fahne der Einheit
18. Reichstagsvorfeld / Berlin-Pavillon
19. Platz der Republik Heckenbosquets
20. Haus der Kulturen der Welt (Schwangere Auster)
21. TIPI am Kanzleramt
22. Carillon im Tiergarten
23. Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas
24. Sowjetisches Ehrenmal Tiergarten
25. Brandenburger Tor
26. Quadriga mit Victoria
27. Pariser Platz
28. Starbucks Pariser Platz
29. Max-Liebermann-Haus
30. Botschaft der Vereinigten Staaten von Amerika
31. Denkmal für die ermordeten Juden Europas
32. Denkmal für die im Nationalsozialismus verfolgten Homosexuellen
33. Goethe-Denkmal
34. Beethoven-Haydn-Mozart-Denkmal
35. Venusbassin / Goldfischteich
36. Mahnmal für verfolgte Zeugen Jehovas
37. Großer Tiergarten
38. Kemperplatz / Tiergartentunnel
39. Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)

The ordering is a UI/tour concern; coordinate correctness remains the
responsibility of the committed placement QA against OSM and LoD2.

## Release-readiness guard

v0.1.24 adds `scripts/check_release_readiness.py` and a pytest wrapper so
future releases fail early when:

- project/package/app versions drift apart;
- the README status line is stale;
- required bundled DZI viewer assets are missing;
- Finder-style duplicate copies or hidden package artefacts sneak into
  the bundled static viewer.

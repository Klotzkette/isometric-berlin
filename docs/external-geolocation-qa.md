# External Geolocation QA

This note records the July 2026 external map and official-site sanity
check for the Regierungsviertel viewer. It is a QA note, not a new data
license grant.

## Rule

Google Maps, Apple Maps, Bing Maps, and Amap/Alibaba map products are
used only for visual plausibility checks of relative placement. Do not
copy their map tiles, screenshots, meshes, textures, labels, geometries,
or photos into this repository. The committed geometry and visual
references remain based on the permitted source stack in `docs/data.md`:
Berlin LoD2, OSM, optional Berlin official support layers, opt-in
Google 3D Tiles only under the existing env gate, and free-license
Wikimedia media.

Official websites may be used to verify names, addresses, architects,
and broad spatial relationships. Photos on official or tourism pages are
not imported unless their page-level license explicitly permits reuse.
For bundled image references, use the Wikimedia fetcher and keep
per-file attribution.

## Sources Checked

- Berlin.de / visitBerlin pages for the Bundeskanzleramt, Berlin
  Hauptbahnhof, Brandenburger Tor, Tiergarten, and related sights.
- Bundestag / architecture-facing sources for the Jakob-Kaiser-Haus and
  government-quarter context.
- Wikimedia Commons / Wikidata for reusable Commons categories and
  coordinates, especially `Goldfischteich (Großer Tiergarten)` /
  `Venusbassin` (`Q131192370`, OSM way `28873112`).
- Google Maps, Apple Maps, Bing Maps, and Amap/Alibaba search/map views
  only as no-copy cross-checks for north/south/east/west relationships.

## Placement Conclusions

- Berlin Hauptbahnhof is the northern anchor of the v0.1 scene.
- Moving south from Hauptbahnhof, the Bundeskanzleramt sits west of the
  Spree and west/north-west of the Reichstag area, not on the east bank.
- Paul-Löbe-Haus and Marie-Elisabeth-Lüders-Haus form the Bundestag
  band across the Spree; Marie-Elisabeth-Lüders-Haus is the eastern
  Spree-side counterweight.
- Reichstagsgebäude is south of Paul-Löbe-Haus and north-west of
  Brandenburger Tor / Pariser Platz.
- Brandenburger Tor faces Pariser Platz; Max-Liebermann-Haus and the
  U.S. Embassy sit on the Pariser-Platz edge, while the Holocaust
  memorial lies south of it.
- In the eastern Tiergarten, the Beethoven-Haydn-Mozart-Denkmal sits at
  the Goldfischteich / Venusbassin area; Goethe-Denkmal is farther east,
  and the Soviet War Memorial is north of those park features on Straße
  des 17. Juni.

## Rendering Implications

- Keep building geometry anchored to LoD2; use OSM for water, parks,
  paths, bridge, rail, and POI semantics.
- Use Wikimedia Commons only as licensed material/colour reference and
  keep the attribution manifest packaged.
- Represent Tiergarten as a layered park surface: green landcover,
  visible footpath network from OSM, small deterministic tree/shrub
  texture, and water ripples on Spree/pond polygons.
- Use the Venusbassin / Goldfischteich landmark as a QA marker for the
  Beethoven-Haydn-Mozart-Denkmal surroundings.

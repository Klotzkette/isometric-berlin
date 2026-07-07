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

## July 2026 Expanded Landmark Sweep

Additional source candidates were checked for the owner-requested
Reichstag / Kanzleramt details. These are additive QA/reference leads,
not permission to copy restricted material:

- TIPI am Kanzleramt: official TIPI address (`Große Querallee, 10557
  Berlin`), visitBerlin context, and Wikimedia Commons
  `File:Tipi am Kanzleramt.jpg` / `Category:Tipi am Kanzleramt`.
- Bundeskanzleramt forecourt art: Berlin.de and Bundesregierung
  architecture notes for Eduardo Chillida's 5.5 m sculpture `Berlin`,
  plus Wikimedia Commons `Category:Berlin by Chillida` and related
  Commons files.
- Kanzlerpark / Kanzlergarten: Wikimedia Commons
  `Category:Kanzlerpark (Berlin)` and the Bundeskanzleramt architecture
  context confirm the garden/park west of the Chancellery complex;
  bundled output may use only files with retained free-license metadata.
- Reichstag dome and plenary: Wikimedia Commons
  `Category:Reichstag dome`, `Category:Interior of the Reichstag dome`,
  and freely licensed Bundestag plenary-chamber views. These are used
  only as visual-reference search targets unless each selected file has
  acceptable license and attribution metadata.
- Reichstag forecourt: Bundestag visitor-service notes, Berlin.de QA
  pages, and the public `Platz der Republik` description. The open lawn
  and hedge-bosquet treatment is represented as an approximate landmark
  cue; hard geometry still comes from LoD2/OSM.
- Carillon / HKW / TIPI context: geotagged Wikimedia Commons Carillon
  files place the bell tower between HKW, TIPI, and the Chancellery /
  Tiergarten band.
- Zeugen-Jehovas-Mahnmal: 2026 public reports by Kulturstaatsminister,
  RBB, WDR, and ALST place the new bronze memorial at or near the
  Goldfischteich. The current point is approximate until a stable OSM /
  Wikidata geometry exists.
- Gedenkort fuer Polen 1939-1945: Deutsch-Polnisches Haus, Stiftung
  Denkmal, Berlin.de, and Kulturstaatsminister sources place the
  temporary memorial on Heinrich-von-Gagern-Strasse / former Kroll-Oper
  grounds near Bundestag and Chancellery. Current point is approximate.
- Tunnel Tiergarten Spreebogen: public route descriptions, portal
  coordinates, local OSM context, Wikimedia/Commons metadata and
  DAUB/STUVA cross-section facts are used as an open-data engineered
  approximation. It is drawn as a two-tube underground cutaway volume
  with lighting and ventilation cues, but is still not official surveyed
  as-built geometry.
- Luiseninsel / Koenigin-Luise-Denkmal: public references and coordinates
  place it west of the current v0.1 image frame; keep as a future bounds
  expansion candidate rather than an off-canvas marker.

Commercial maps, social-media posts, official press photos, and tourism
images without a clear free license may be inspected for orientation and
visual plausibility only. Do not commit those images, screenshots,
derived textures, or traced map geometry.

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
- TIPI am Kanzleramt sits in the Tiergarten band between the Chancellery
  and Haus der Kulturen der Welt, south-west of the Chancellery complex.
- The Chillida sculpture belongs to the Chancellery forecourt context,
  not the Bundestag band or Pariser Platz.
- Kanzlergarten / Kanzlerpark sits west of the Chancellery complex
  across the Spree context and is part of the Chancellery landscape /
  sculpture QA layer, not a replacement for park polygons from OSM.
- The Reichstag forecourt / Berlin Pavilion / Platz der Republik cues
  sit south of Scheidemannstraße and north-west of Brandenburger Tor.
- Carillon sits between HKW / TIPI and the Chancellery/Tiergarten band.
- Zeugen-Jehovas-Mahnmal belongs to the Goldfischteich / Venusbassin
  cluster; it should render as a small bronze/purple-triangle cue.
- Gedenkort fuer Polen belongs between Reichstag and Chancellery, at the
  former Kroll-Oper / Heinrich-von-Gagern-Strasse context.
- Tiergartentunnel should visually connect the north portals near
  Hauptbahnhof / Minna-Cauer-Strasse through the Spreebogen and
  Tiergarten toward Kemperplatz, then continue out of frame southward.
  The viewer should show an underground body rather than only a map
  line, because the owner wants the tunnel visibly carried under the
  surface.

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
- Keep explicit render cues for TIPI, Chillida, Reichstagskuppel /
  Plenarsaal, Sinti/Roma memorial, Kanzlergarten, HKW, Max-Liebermann-
  Haus, Carillon, Zeugen-Jehovas-Mahnmal, Gedenkort fuer Polen,
  Tiergartentunnel, and Platz-der-Republik hedges small but
  recognizable; they should orient the viewer without overriding source
  geometry.

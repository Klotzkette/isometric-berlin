# NOTICE

This project, **Isometric Berlin**, is an independent, derivative work
inspired by **Isometric NYC** by Andy Coenen.

## Upstream

- Repository: <https://github.com/cannoneyed/isometric-nyc>
- Website: <https://isometric.nyc>
- Write-up: <https://cannoneyed.com/projects/isometric-nyc>
- License: MIT, © 2025 Andy Coenen

The project scaffolding (directory layout, agent-guidance files,
documentation structure, `pyproject.toml` shape) follows the upstream
NYC project. All Berlin-specific code, data, models, and rendered
tiles are produced independently for this repository.

## Data sources used by this project (additive fusion)

Per owner policy this project uses **additive data fusion** across
all permitted sources (see [`docs/data.md`](docs/data.md) and
[`AGENTS.md`](AGENTS.md) §4):

- **3D building models (LoD2) — Berlin:**
  [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin),
  licensed under
  [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0).
  No attribution legally required; provided here for transparency.

- **ALKIS / DOP / DGM (optional support layers) — Berlin:**
  Geoportal Berlin, dl-de/zero-2-0.

- **Berlin tree catalogues, public lighting and 1989 Wall route:**
  bounded official WFS extracts from Geoportal Berlin, licensed under
  dl-de/zero-2-0. These anchor individual tree dimensions where recorded,
  lamp positions/types and the Vorderlandmauer trace.

- **Berlin 3D Mesh Model 2025:** official photogrammetric geometry and
  aerial textures from the June 2025 survey, downloaded from the
  [Berlin 3D Downloadportal](https://www.businesslocationcenter.de/berlin3d-downloadportal/).
  Use and modification are permitted under the portal's
  [license terms](https://www.businesslocationcenter.de/berlin3d-downloadportal/resources/terms/terms.de.html).
  Required provider credit: **Berlin Partner für Wirtschaft und
  Technologie GmbH**. Raw OBJ/texture archives remain gitignored; the
  repository contains only bounded, compressed WebGL derivatives.

- **OpenStreetMap:** © OpenStreetMap contributors, licensed under the
  [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  See <https://www.openstreetmap.org/copyright>.

- **Pariser-Platz civic architecture (factual and architectural evidence):**
  the [Stiftung Brandenburger Tor](https://stiftungbrandenburgertor.de/max-liebermann-haus/)
  documents the Max-Liebermann-Haus critical reconstruction;
  [2Portzamparc](https://www.2portzamparc.com/en/projects/french-embassy-berlin/)
  and [Borgert Architekten](https://www.borgert-architekten.de/projekte/franzosische-botschaft)
  document the French Embassy facade system;
  [Moore Ruble Yudell](https://www.moorerubleyudell.com/project/united-states-embassy-berlin/)
  documents the US Embassy; and the
  [Akademie der Künste](https://adk.de/besuch/veranstaltungsorte/pariser-platz),
  its [institutional history](https://adk.de/ueber-uns/akademie-geschichte)
  and [Baunetz Wissen](https://www.baunetzwissen.de/fassade/objekte/kultur-bildung/akademie-der-kuenste-in-berlin-70588)
  document the Akademie facade and visible circulation. Berlin LoD2 and OSM
  remain the metric and identity anchors. Four free Wikimedia files were used
  only for visual QA: Roy Zuo,
  [*Max-Liebermann-Haus und Palais am Pariser Platz, 24-05-2025.jpg*](https://commons.wikimedia.org/wiki/File%3AMax-Liebermann-Haus_und_Palais_am_Pariser_Platz%2C_24-05-2025.jpg)
  (CC BY-SA 4.0); Geoprofi Lars,
  [*Französische Botschaft Berlin.jpg*](https://commons.wikimedia.org/wiki/File%3AFranz%C3%B6sische_Botschaft_Berlin.jpg)
  (CC BY-SA 4.0); Schlaier,
  [*US Amerikanische Botschaft Berlin Embassy of the United States in Berlin.JPG*](https://commons.wikimedia.org/wiki/File%3AUS_Amerikanische_Botschaft_Berlin_Embassy_of_the_United_States_in_Berlin.JPG)
  (public domain); and Manfred Brückels,
  [*Akademie der Kuenste Berlin 2.jpg*](https://commons.wikimedia.org/wiki/File%3AAkademie_der_Kuenste_Berlin_2.jpg)
  (CC BY-SA 3.0). No photograph is bundled, projected, traced or used as a
  facade texture.

- **Center / former Sony Center and TIPI am Kanzleramt (architectural
  evidence):** the
  [Arup Journal engineering report](https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2000-issue-2.pdf),
  [JAHN project page](https://jahn.studio/work/sony-center/) and the 24-part
  attributed OSM plan bound the Forum roof; local membrane curvature and
  uncited component spacing remain display reconstruction. The
  [TIPI venue page](https://www.tipi-am-kanzleramt.de/de/theater/tipi-am-kanzleramt.html)
  and its
  [July 2024 technical information](https://www.tipi-am-kanzleramt.de/_Resources/Persistent/0/1/3/9/0139b75bd22d148179852011cf066a1968138877/TIPI_Technikinfo_07_2024.pdf)
  supply the published auditorium envelope. The TIPI visual QA files and
  credits are recorded in the Wikimedia manifest; no source photograph is
  bundled or projected. `PIGOR & EICHHORN` is fictional viewer display text
  authored by the user/project owner, not by the venue; the accompanying
  `NUR HEUTE ABEND` line is also presentation text. Neither is attributed to
  the venue or presented as a current programme.

- **Berliner Ensemble roof sign and current public art (factual and visual
  evidence):** the
  [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011192),
  [theatre history](https://www.berliner-ensemble.de/index.php/das-theater-am-schiffbauerdamm)
  and [roof-sign account](https://www.berliner-ensemble.de/magazin/berlin-leuchtet)
  supplement the LoD2/OSM building anchors. The Brecht monument uses the
  [Deutsche Digitale Bibliothek record](https://www.deutsche-digitale-bibliothek.de/item/5ALSSIMTMT2PKBR7UXTZZASRRBP7K366),
  [DEFA Stiftung film record](https://www.defa-stiftung.de/en/films/film-search/bertolt-brecht-platz/)
  and [Bildhauerei in Berlin inventory](https://bildhauerei-in-berlin.de/bildwerk/bertolt-brecht-denkmal-5412/).
  Manfred Brückels' Commons photograph
  [*Bertolt Brecht, Skulptur von Fritz Cremer am BE in Berlin.jpg*](https://commons.wikimedia.org/wiki/File%3ABertolt_Brecht%2C_Skulptur_von_Fritz_Cremer_am_BE_in_Berlin.jpg)
  (CC BY-SA 3.0) was used only as a visual reference. The current Helene Weigel
  work follows the Berliner Ensemble's
  [project page](https://www.berliner-ensemble.de/eine-skulptur-fuer-helene-weigel)
  and [unveiling account](https://www.berliner-ensemble.de/magazin/helene-weigel-hat-einen-neuen-platz).
  Press photographs by Moritz Haase were inspected only on those source pages;
  no press image, portrait crop or derived texture is bundled. All displayed
  sculptural shapes remain procedural recognition geometry, not survey meshes.

- **CSD memorial place at Ahornsteig (factual and visual evidence):**
  [Bezirksamt Mitte](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1699951.php)
  and the
  [Berlin.de state portal](https://www.berlin.de/aktuelles/10556192-958090-ahornbaum-und-regenbogenbank-erinnern-an.html)
  document the newly planted French maple, protective metal grid and
  rainbow-coloured bench; the
  [rbb24 report](https://www.rbb24.de/panorama/beitrag/2026/08/berlin-anschlag-csd-baumpflanzung-gedenkort.html)
  and owner-supplied press screenshots only bound the current visual reading.
  Exact ensemble placement comes from
  [OSM node 14076715427](https://www.openstreetmap.org/node/14076715427) under
  the ODbL attribution above. Local part dimensions and arrangements are
  explicitly non-surveyed display estimates. No page photograph, press image,
  supplied screenshot or texture derived from one is bundled in the project.

- **Invalidenfriedhof and Gedenkstätte Günter Litfin (factual and visual
  evidence):** Berlin monument records document the
  [Invalidenfriedhof ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010206),
  [Invalidenfriedhof Wall remains](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/invalidenfriedhof-648151.php)
  and the
  [Führungsstelle Kieler Eck](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/fuehrungsstelle-kieler-eck-649714.php).
  The [Stiftung Berliner Mauer](https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin)
  supplies the memorial context; the public
  [Auguste-Viktoria bell text](https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/augusta-viktoria-glocke)
  supplies its documented diameter and mass. Plan anchors remain attributed
  OSM and official LoD2 data. Supplied cemetery and watchtower photographs
  only bound recognition forms; no supplied photograph, crop,
  tracing or derived texture is bundled.

- **Goethe- and Lessing-Denkmal in the Großer Tiergarten (factual and visual
  evidence):** the Berlin monument database records both works as parts
  [`09046318,T,028` and `09046318,T,027`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318).
  The Bildhauerei in Berlin inventories for the
  [Goethe-Denkmal](https://bildhauerei-in-berlin.de/bildwerk/goethedenkmal-5168/)
  and
  [Lessing-Denkmal](https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/)
  supply the documented dimensions, materials, sculptural programmes,
  inscriptions, restoration histories and enclosure status. Exact plan anchors
  remain OSM nodes `278738513` and `884700390`. The three already recorded
  Goethe Commons files remain visual QA references. Lessing additionally uses
  Dosseman's
  [*Lessing monument in Berlin Tiergarten 9593.jpg*](https://commons.wikimedia.org/wiki/File%3ALessing_monument_in_Berlin_Tiergarten_9593.jpg)
  (CC BY-SA 4.0), and Manfred Brueckels'
  [*Lessing Tiergarten 3K.jpg*](https://commons.wikimedia.org/wiki/File%3ALessing_Tiergarten_3K.jpg)
  and
  [*Lessing Tiergarten 4K.jpg*](https://commons.wikimedia.org/wiki/File%3ALessing_Tiergarten_4K.jpg)
  (both CC BY-SA 3.0), only to check the current front, Kleist side/basin and
  rear criticism-group readings, including the current protective fence's
  eight-segment chamfered outline. All three Lessing records are attribution
  only; no source photograph, thumbnail, crop, tracing or derived texture is
  bundled or loaded by the viewer.

- **Passenger-rail route validation:** official BVG and S-Bahn Berlin route
  pages are used only to validate the displayed U5 and shared North-South
  S-Bahn station sequence. Track, platform and entrance plan geometry remains
  the attributed OSM extract; inferred depths and sections are marked as
  schematic in `docs/underground-network.md`.

- **Berlin passenger-vessel dimensions:** the static Spree display models use
  length, beam, draught, build year and vessel type published in
  [Reederei Riedel's fleet catalogue](https://reederei-riedel.de/flotte?lang=en).
  Their positions come from the attributed OSM waterways and are explicitly
  display compositions rather than live AIS observations. No fleet photograph,
  texture or livery artwork is bundled.

- **Google Maps Platform / Photorealistic 3D Tiles (opt-in, additive):**
  Only used when the three opt-in env vars are set
  (`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_3D_TILES_ENABLED=true`,
  `GOOGLE_MAPS_TERMS_ACCEPTED=true`). Subject to the
  [Google Maps Platform Terms of Service](https://cloud.google.com/maps-platform/terms)
  and the
  [Photorealistic 3D Tiles policies](https://developers.google.com/maps/documentation/tile/policies).

- **Wikimedia Commons / Wikipedia media (additive visual references):**
  Small free-license thumbnails may be used for landmark facade,
  roof, glass, stone, vegetation, and colour reference. Per-image
  title, URL, author/artist, credit, license, and license URL are
  recorded in
  `geo_data/regierungsviertel/wikimedia_references.json` and
  `references/wikimedia/README.md`. Derivative public artefacts must
  preserve the relevant per-file attribution and license obligations.

- **Bildhauerei in Berlin (Kindertransport memorial visual references):**
  five 2021 inventory photographs by Pauline Ahrens, licensed CC BY 4.0,
  bound the display-only proportions and material reading of the memorial at
  Bahnhof Friedrichstraße. The photographs and textures are not bundled. The
  source page and per-file credits are recorded in
  `src/app/public/dzi/regierungsviertel/visual_reference_attribution.json`.

- **Reichstag dome dimensions:** the procedural glass/steel signature uses
  the diameter, height, rib and ring counts published on the
  [Deutscher Bundestag architecture page](https://www.bundestag.de/besuche/architektur/reichstag/kuppel).
  No Bundestag photograph or other media asset is copied into the viewer.

## Required attribution

Any public-facing deliverable (web viewer, exported PNGs in a published
gallery, video clips, etc.) **must** display, at minimum:

> © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)

If Google Maps Platform content was used in producing the artefact,
**also** display the Google attribution required by the Google Maps
Platform Terms (typically a visible "Google" / "Google Maps" credit
and any product-specific notices per the Photorealistic 3D Tiles
policies).

If Wikimedia Commons media was directly used as a texture source,
visual derivative, or published reference plate, also include the
relevant per-file Wikimedia attribution and license notices from
`geo_data/regierungsviertel/wikimedia_references.json`.

When the Kindertransport memorial reconstruction is displayed, also display:

> Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)

When the Berlin 3D Mesh viewer is used, also display:

> 3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH

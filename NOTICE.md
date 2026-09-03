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

- **Spreebogenpark, Gustav-Heinemann-Brücke, Hugo-Preuß-Brücke and Potsdamer
  Platz public realm (factual and metric evidence):** exact plan axes come
  from attributed OSM ways `34834265`, `1128036906`, `4395332`, `15405394`
  and `26109166`. The
  [Berlin Spreeweg flyer](https://www.berlin.de/sen/uvk/_assets/natur-gruen/landschaftsplanung/20-gruene-hauptwege/weg-1/flyer_flanieren_entlang_der_stadtspree.pdf)
  describes the Spreebogenpark landscape; the
  [Max Dudler project record](https://www.maxdudler.de/en/projects/0102-gustay-heinemann-bruecke/?cid=4&orderby=location)
  supplies the Gustav-Heinemann structural dimensions; and Berlin's
  [bridge inventory](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf)
  supplies both bridge envelopes. Berlin Mitte's
  [Potsdamer Platz renewal page](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/planung-entwurf-neubau/quartier-am-potsdamer-platz-1135231.php)
  and the official
  [public-lighting WFS](https://gdi.berlin.de/services/wfs/beleuchtung)
  anchor the current pedestrian corridor. Local support spacing, Gartenspur
  rhythm, paving subdivisions and furniture are procedural display
  reconstructions, not fixture surveys. No source photograph or texture is
  bundled.

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
  document the Akademie facade and visible circulation. The
  [European Commission representation](https://germany.representation.ec.europa.eu/uber-uns/europaisches-haus_de)
  identifies the European House at Unter den Linden 78, separately from the
  Starbucks corner at number 80. Berlin LoD2 and OSM
  remain the metric and identity anchors. Five free Wikimedia files were used
  only for visual QA: Roy Zuo,
  [*Max-Liebermann-Haus und Palais am Pariser Platz, 24-05-2025.jpg*](https://commons.wikimedia.org/wiki/File%3AMax-Liebermann-Haus_und_Palais_am_Pariser_Platz%2C_24-05-2025.jpg)
  (CC BY-SA 4.0); Geoprofi Lars,
  [*Französische Botschaft Berlin.jpg*](https://commons.wikimedia.org/wiki/File%3AFranz%C3%B6sische_Botschaft_Berlin.jpg)
  (CC BY-SA 4.0); Schlaier,
  [*US Amerikanische Botschaft Berlin Embassy of the United States in Berlin.JPG*](https://commons.wikimedia.org/wiki/File%3AUS_Amerikanische_Botschaft_Berlin_Embassy_of_the_United_States_in_Berlin.JPG)
  (public domain); and Manfred Brückels,
  [*Akademie der Kuenste Berlin 2.jpg*](https://commons.wikimedia.org/wiki/File%3AAkademie_der_Kuenste_Berlin_2.jpg)
  (CC BY-SA 3.0); and Roy Zuo,
  [*Europäisches Haus, Unter den Linden 78, 24-05-2025.jpg*](https://commons.wikimedia.org/wiki/File:Europ%C3%A4isches_Haus,_Unter_den_Linden_78,_24-05-2025.jpg)
  (CC BY-SA 4.0). No photograph is bundled, projected, traced or used as a
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

- **Sony Center surroundings and Beisheim ensemble:** thin facade details
  retain the attributed Berlin LoD2 bodies and exterior edges. The
  [JAHN project description](https://jahn.studio/work/sony-center/) supports
  the Filmhaus atrium, office curtain walls and Esplanade balcony/glass-bay
  reading. The [Beisheim architecture account](https://www.beisheim-center.de/de/background)
  supports the distinct Ritz-Carlton, office, Marriott and Parkside facades.
  Window spacing and local projections are procedural display approximations.
  External visual QA credits: Raimond Spekking,
  [Beisheim Center, Berlin-1776.jpg](https://commons.wikimedia.org/wiki/File:Beisheim_Center,_Berlin-1776.jpg)
  (CC BY-SA 4.0); Dosseman,
  [Bellevuestraße 2 9596.jpg](https://commons.wikimedia.org/wiki/File:Bellevuestra%C3%9Fe_2_9596.jpg)
  (CC BY-SA 4.0); Bukk,
  [Berlin Kemperplatz.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Kemperplatz.jpg)
  (public domain); Lukas Beck,
  [Potsdamer Straße, 2021-12-18](https://commons.wikimedia.org/wiki/File:Berlin_Potsdamer_Platz_lub_2021-12-18_img10_Potsdamer_Stra%C3%9Fe.jpg)
  (CC BY 4.0). Per-file notices are mirrored in the public attribution manifest;
  no photograph, crop or photo texture is bundled or fetched by the viewer.

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
  The Bildhauerei-in-Berlin record supplies the six-metre circular sett stage,
  seated bronze on the open bench and three black-stone steles, and separates
  Fritz Cremer's sculpture, Peter Flierl's installation design and Carlo
  Wloch's stonework/steles. The monument's poem and quotations remain identified
  only as site facts: no copyrighted poem or quotation is reproduced, and the
  procedural stele incisions are deliberately non-legible.

- **Weidendammer Brücke (factual, metric and cultural evidence):** exact plan
  centre and bearing come from OSM bridge way
  [`6228081`](https://www.openstreetmap.org/way/6228081) under the ODbL
  attribution above. The official
  [Masterplan Brücken inventory](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf)
  (data status June 2025) controls the current 69.48 x 25.17 m envelope, while
  [Landesdenkmalamt object `09030074`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030074)
  controls the protected three-opening system, two granite-clad piers,
  neo-Baroque railing/lamp ornament and paired forged eagles. Local rail-field,
  feather and present-day love-lock placement is deterministic procedural
  recognition geometry, not a fixture or lock-by-lock survey. The cultural
  association with Wolf Biermann's *Ballade vom preußischen Ikarus* follows a
  [documented bridge account](https://www.tagesspiegel.de/kultur/die-weidendammer-brucke-ein-konstrukt-aus-liebe-luft-und-eisenguss-2538784.html)
  and is retained as a factual reference; no song lyric is reproduced. No bridge photograph,
  plan image, portrait, canvas asset or derived texture is bundled or loaded.

- **Sandkrugbrücke (metric and structural evidence):** exact deck axes come
  from OSM ways [`36260393`](https://www.openstreetmap.org/way/36260393) and
  [`248010193`](https://www.openstreetmap.org/way/248010193) under the ODbL
  attribution above. The official
  [Masterplan Brücken inventory](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf)
  fixes structure `BW 3446035` and its current 32.6 x 28.8 m envelope. The
  [Grassl project record](https://www.grassl-ing.de/project/sandkrugbruecke_42.html)
  supplies the published five-stem steel-frame system, design dimensions,
  clear span, roadway width, structural depth and lamp count. Member sections,
  cross-girder spacing and rail subdivisions are procedural recognition
  geometry; no source photograph, drawing or texture is bundled or loaded.

- **Konrad-Adenauer-Haus (factual and architectural evidence):** exact plan
  geometry and glass material come from
  [OSM way `25999445`](https://www.openstreetmap.org/way/25999445) under the
  ODbL attribution above. The
  [building archive](https://www.konrad-adenauer.de/seite/gebaeude/), the
  [current CDU account](https://www.cdu.de/aktuelles/cdu-deutschlands/das-konrad-adenauer-haus-feiert-den-25-geburtstag/)
  and the [CDU archive](https://archiv.cdu.de/node/1151) document the six-storey
  elliptical inner body, transparent winter garden and ship-like composition.
  Local floor bands, deck taper and frame spacing are deterministic,
  non-surveyed recognition geometry. No page image, political logo, lettering
  or photographic texture is bundled or loaded.

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

- **Heidestrasse / B96 street-edge owner references (visual evidence only):**
  three owner-supplied August 2026 street views bound the visible facade
  hierarchy of the KPMG/EINZ tower, the green FUNBOX reception dome and ticket
  entrance, and the low Oggi's/Mubis food-stall frontage. Berlin LoD2 and the
  existing OSM/landmark anchors remain the metric authority for buildings,
  roads and placement. Local fins, pilotis, awnings, signs, hoarding panels and
  planted-roof subdivisions are procedural display estimates rather than
  surveyed geometry. No supplied photograph, crop, event artwork, tracing or
  photographic texture is bundled or loaded by the viewer.

- **Kaiser-Wilhelm-Gedächtniskirche owner reference (visual evidence only):**
  one owner-supplied portrait street photograph bounds the recognisable gold
  clock, triple belfry opening, open lower arch, weathered ruin colour and
  green-grey broken crown. The official church descriptions and existing OSM
  building-part anchors remain the authority for ensemble layout, heights and
  diameters; unmeasured arch, clock, buttress, crown and grid subdivisions are
  procedural display estimates. No supplied photograph, crop, tracing or
  photographic texture is bundled or loaded by the viewer.

- **Europa-Center owner references (visual evidence only):** two
  owner-supplied street photographs bound the current dark curtain-wall
  reading, aluminium grid, turquoise Breitscheidplatz office band, red rooftop
  signs, mast and three-spoke star pose. The
  [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096462)
  supplies the protected ensemble, steel-frame/curtain-wall construction,
  equal horizontal facade rows, aluminium profiles, two-storey base,
  elevated three-storey office band, 103 m overall height and ten-metre star.
  The Europa-Center owner's
  [opening record](https://europa-center-berlin.de/timeline/eroeffnung/),
  [history](https://europa-center-berlin.de/information/historie/) and
  [star account](https://europa-center-berlin.de/timeline/der-punkt-auf-dem-i/)
  document the 86 m office tower, 21 office floors and two rotations per
  minute. OSM ways
  [`1054276972`](https://www.openstreetmap.org/way/1054276972),
  [`26408382`](https://www.openstreetmap.org/way/26408382) and
  [`26408381`](https://www.openstreetmap.org/way/26408381) remain the plan
  anchors. Local facade bays, supports and code-built sign strokes are
  procedural recognition geometry. No supplied photograph, crop, logo art,
  font, tracing or derived texture is bundled or loaded by the viewer.

- **FUNBOX at the Wunderland-Festplatz (factual event evidence):** the official
  [visitBerlin event listing](https://www.visitberlin.de/de/event/funbox)
  supplies the Heidestraße / Minna-Cauer-Straße location, 23 July–20 September
  2026 dates, 4,000-plus-square-metre scale, ten-zone programme and five-metre
  slide. It does not supply a surveyed footprint. The model's fitted envelope,
  individual attraction layout and 2.553 m delivered-road-surface clearance
  are procedural viewer contracts rather than copied event-plan geometry. Page
  photographs, supplied street views and event artwork are not bundled,
  traced, projected or used as textures; no rights to those images are claimed.

- **Geschichtspark Ehemaliges Zellengefängnis Moabit (factual and metric
  evidence):** exact current plan anchors come from OSM park way
  [`498278335`](https://www.openstreetmap.org/way/498278335), wall ways
  [`53178124`](https://www.openstreetmap.org/way/53178124),
  [`105495351`](https://www.openstreetmap.org/way/105495351),
  [`498279237`](https://www.openstreetmap.org/way/498279237) and
  [`498279239`](https://www.openstreetmap.org/way/498279239), Panoptikum way
  [`195086492`](https://www.openstreetmap.org/way/195086492), Klopfzeichen node
  [`2310445137`](https://www.openstreetmap.org/node/2310445137) and information
  node [`5772396362`](https://www.openstreetmap.org/node/5772396362), under the
  ODbL attribution above. Berlin LoD2 object `DEBE01AL2yz00000` remains the
  measured walk-in-cell shell. The
  [Landesdenkmalamt record `09050274`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050274)
  documents the protected prison remains, while the official
  [Berlin park account](https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html)
  documents the present-day entrances and interpretive programme. The official
  [explanatory landscape-plan PDF](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2459_zellengefaengnis-erlaeuterung.pdf)
  is all-rights-reserved textual evidence only: no plan line, page image,
  photograph or other protected artwork is copied, traced, bundled or used as
  a texture. Brick coursing, mortar, local trace widths, board dimensions and
  planting intervals are code-authored, non-surveyed recognition details.
  No Wikimedia image was used for this revision, so no new Commons media credit
  is required.

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
  tracing or derived texture is bundled. Within the ensemble, exact
  [OSM node `273120316`](https://www.openstreetmap.org/node/273120316) anchors
  the Scharnhorst grave. The
  [Berlin-Lexikon record](https://berlingeschichte.de/lexikon/mitte/i/invalidenfriedhof.htm)
  supplies the published 5.60 m overall height. The
  [Staatliche Museen Schinkel portal](https://schinkel.smb.museum/image_orte.php?id=28)
  and monument record document form, native-granite supports,
  Carrara-marble sarcophagus, bronze lion, iron enclosure, authorship and
  conservation context. Karl Friedrich Schinkel designed the
  architecture, Friedrich Tieck the relief frieze, Christian Daniel Rauch
  modelled the lion and Theodor Kalide executed it; the Royal Prussian Iron
  Foundry in Berlin cast the bronze. The portal identifies the
  current sarcophagus and relief frieze as conservation copies. Unpublished
  part subdivisions remain procedural. The supplied close field view only
  bounds the lion's raised-head silhouette, green patina and bronze top plate;
  no new photograph or page medium is redistributed for this refinement.

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

- **Richard-Wagner-Denkmal in the Großer Tiergarten (factual and visual
  evidence):** exact plan placement comes from
  [OSM node `243487615`](https://www.openstreetmap.org/node/243487615) under
  the ODbL attribution above. The Berlin monument database records the work as
  part object
  [`09046318,T,041`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318),
  and the
  [Bildhauerei in Berlin inventory](https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/)
  supplies the published dimensions, materials, sculptural programme and
  protective-shelter history. Berlin LoD2 object `DEBE00YYSR00009n` /
  `SR00009n` remains attributed footprint evidence for that shelter but is not
  presented as a closed occupied building. Local figure segmentation, canopy
  section, member spacing, presentation orientation and collision volumes are
  procedural, non-surveyed display reconstructions. The
  [Wikimedia Commons category](https://commons.wikimedia.org/wiki/Category:Richard-Wagner-Denkmal_(Berlin))
  is reference-only visual QA; no source photograph, thumbnail, crop or
  photographic texture is bundled or loaded by the viewer.

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

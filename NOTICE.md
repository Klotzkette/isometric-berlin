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

- **Pariser Platz and western Unter den Linden (v1.0.30):** retained ALKIS
  cadastral parcels anchor the western public-space envelope; OSM road,
  sidewalk, plaza, grass and gravel features determine the source partition.
  Eastern pavement infill, continuous widths where tags are absent, kerb
  dimensions and colours are documented display reconstruction. Original
  source data and authored gardens are retained; no photograph is added.
  See [evidence and validation](docs/brandenburg-approach-v130-review.md).

Per owner policy this project uses **additive data fusion** across
all permitted sources (see [`docs/data.md`](docs/data.md) and
[`AGENTS.md`](AGENTS.md) §4):

- **Humboldthafen, economic ministry and Invalidenfriedhof (v1.0.14):**
  original LoD2 and OSM records remain retained. The first scene uses the correct
  harbour footprints; H3's measured inner wall and lower source roofs resolve its
  covered courtyard. PBP's built-project account and official DOP 2025 support
  the interpretation. Original ministry wall/roof surfaces and the official
  aerial guide its historic and modern roofs and solar strip; unpublished roof
  subdivisions and module spacing remain display estimates. Minecraft restores
  29 existing mapped grave markers, while the detailed Scharnhorst tomb remains
  intact. No new photograph or runtime texture is bundled. See the
  [harbour source contract](docs/humboldthafen-buildings-refinement.md),
  [ministry source contract](docs/economic-ministry-refinement-v114.md),
  [release review](docs/release-v1.0.14-review.md) and
  [cemetery audit](docs/invalidenfriedhof-audit-v114.md).

- **Potsdamer Platz traffic tower (v1.0.12):** the retained OSM way
  `241572310` and its original perimeter anchor the modern replica. Berlin's
  transport history and the sculpture inventory support the 8.50 m height,
  five supports, glazed cabin, clocks and horizontal signals. Local dimensions,
  orientation and the slow light cycle are explicitly approximate display
  choices. Three external CC BY-SA 4.0 photographs by BugWarp and Luis Alvaz
  are individually credited in both manifests; no photograph is bundled.
  See [evidence and signal uncertainty](docs/potsdamer-traffic-tower.md).

- **BahnTower, Musikinstrumentenmuseum and Spreebogen bank (v1.0.11):**
  the original tower prisms, museum parts, mapped park and river records remain
  preserved. Original LoD2 roof planes correct flattened crowns and the museum's
  basement-to-street height error; the separate entrance pavilion is retained.
  Rooflights, facade subdivisions, the geometric DB sign and intermediate
  landscape grades are documented display reconstruction. Four newly inspected
  Commons photographs of the tower are individually credited in both manifests;
  existing licensed museum and park references are reused without bundling photos.
  See [BahnTower evidence](docs/db-tower-refinement.md),
  [museum correction](docs/music-museum-correction-v111.md) and
  [Spreebogen evidence](docs/spreebogen-bank-refinement.md).

- **Friedrichstraße and Schiffbauerdamm architecture (v1.0.10):** all 52
  existing LoD2 prism records remain retained. The 2 March 2026 official tile
  adds the Admiralspalast's 205 original wall/roof surfaces, with explicit
  vertical translations preserving the existing viewer ground. Berlin's
  monument inventory, restoration architects and the building operators
  support facade identities and materials; ordinary bay dimensions and
  ornament are procedural estimates. Eight inspected Commons photographs by
  Matt Cec, Jörg Zägel, Ansgar Koreng, Dguendel and Molgreen are individually
  credited in both manifests. See
  [source and architecture evidence](docs/friedrichstrasse-architecture-refinement.md).

- **Pergamonmuseum, Neues Museum and Alte Nationalgalerie (v1.0.10):** all
  26 official LoD2 parts and the prior OSM records remain retained. The
  Landesdenkmalamt, Staatliche Museen zu Berlin and David Chipperfield
  Architects provide building and restoration evidence. The open
  Nationalgalerie portico, glazed Neues Museum courts, roof ornaments and
  local member sizes are source-labelled procedural additions. Seven
  inspected CC BY-SA 4.0 photographs by HerrAdams, Raimond Spekking, Roy Zuo,
  Ad Meskens and Bahnfrend are credited individually. The misnamed *Berlin
  Neues Museum from Berliner Dom 02.jpg* depicts Alte Nationalgalerie and is
  identified accordingly. See [source conflicts](docs/museum-triad-refinement.md).

- **Berliner Dom, Altes Museum and granite bowl (v1.0.10):** all eighteen
  official LoD2 source parts and prior OSM records remain retained, including
  the separate overlapping portico. The cathedral's architecture account,
  Staatliche Museen zu Berlin, the monument inventory, Bildhauerei in Berlin
  and official DOP 2025 support the bounded procedural subdivisions. The
  Dom's 98 m complete silhouette is a published dimension; intermediate
  cupola and lantern dimensions are display estimates. The bowl at exact
  OSM node `376689138` is red granite, with a published 6.9 m diameter.
  Five references by Alexander Hüsing, Chainwit., Ansgar Koreng,
  Janericloebe and Times are individually credited. The three v1.0.10 groups
  add twenty external reference records (251 total in each manifest);
  photographs, crops and textures are not bundled or loaded. See
  [Dom and museum evidence](docs/dom-altes-museum-refinement.md) and the
  [complete per-file credit catalogue](references/wikimedia/README.md).

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

  The bounded building-attribute supplement in
  `src/app/src/buildingAttributeSource.json` also derives from OpenStreetMap.
  It retains selected public building/roof material, colour and floor-count
  tags with source way identities and retrieval provenance. LoD2 remains the
  geometry authority. Equal floor subdivisions and material-only colour
  swatches are procedural display estimates; mapped counts do not establish
  individual window positions.

- **Heidestraße / Otto-Weidt-Platz (v1.0.9):** 140 retained LoD2 and OSM
  parts receive source-labelled facade subdivisions across 21 groups. KSP
  Engel identifies the older KPMG building at Heidestraße 58; Staab and the
  Autobahn GmbH imprint identify its headquarters at Heidestraße 15. The
  BUWOG, Budapester Höfe and QH buildings remain separate architectural
  families. Floor counts and materials follow the documented source roles;
  windows and loggia members remain procedural, not surveyed. Four inspected
  Commons references by NutzerAusBerlin (CC0), Definitiv (CC BY 4.0) and
  Singlespeedfahrer (CC0) are credited individually in both manifests.
  See [corridor evidence](docs/europacity-architecture-refinement.md).

- **50Hertz and EINZ refinements (v1.0.9):** the original five 50Hertz LoD2
  parts retain metric footprints and maximum heights. Current OSM way
  `1224022429` and 50Hertz's seven-floor announcement supplement the completed
  extension; its prior default 21 m record stays preserved beside an explicitly
  estimated 31 m display height. The two coarse pitched roof envelopes are
  subdivided into the photographed flat plates and bounded service housings.
  LOVE / kadawittfeldarchitektur and Züblin provide architectural and completion
  evidence. Two inspected June 2026 photographs by Roy Zuo (CC BY-SA 4.0)
  are credited in both manifests; no image is bundled. The misplaced EINZ
  podium overlay is removed while its source parts remain. See
  [evidence and source conflicts](docs/fifty-hertz-refinement.md).

- **Bellevue and Großer Stern refinements (v1.0.8):** original Geoportal
  LoD2 wall/roof planes preserve all fourteen palace parts and the permanent
  presidential office footprint. DOP 2025 and the Federal President's
  [palace account](https://www.bundespraesident.de/DE/amt-und-aufgaben/amtssitze/schloss-bellevue/schloss-bellevue_node.html),
  [office account](https://www.bundespraesident.de/DE/amt-und-aufgaben/bundespraesidialamt/gebaeude/gebaeude_node.html)
  and [renovation information](https://www.bundespraesident.de/DE/amt-und-aufgaben/amtssitze/baumassnahmen-am-berliner-amtssitz/baumassnahmen-am-berliner-amtssitz_node.html)
  support the established architectural fabric. The office's coarse conical
  LoD2 roof is subdivided inside its source envelope into the photographed
  glass lantern and outer roof rim. No unverified current scaffold or future
  competition proposal is reproduced.
  Bildhauerei in Berlin's [Bismarck record](https://bildhauerei-in-berlin.de/bildwerk/bismarck-denkmal-4617/)
  and [Moltke record](https://bildhauerei-in-berlin.de/bildwerk/moltke-denkmal-5323/)
  support materials, figures and historic changes; both use exact OSM nodes.
  Lost Bismarck reliefs/fountains remain absent. Moltke's published historic
  11.5 m height is not presented as a current survey: the replacement uses an
  explicitly documented photo-based current pedestal estimate.
  Eight Commons photographs are credited individually in both manifests and
  [the reference catalogue](references/wikimedia/README.md), including
  Achim Raschka's *Siegessäule TopView6.JPG* (CC BY-SA 3.0). Photographs are
  references only; no textures are bundled. See [Bellevue evidence](docs/bellevue-refinement.md)
  and [monument evidence](docs/bismarck-moltke-refinement.md).

- **Abgeordnetenhaus and Gropius Bau architecture:** the
  [Berlin parliament architecture record](https://www.parlament-berlin.de/das-haus/architektur),
  its [building brochure](https://www.parlament-berlin.de/media/download/541),
  the [Landesdenkmalamt Abgeordnetenhaus entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096004)
  and [Gropius Bau entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031246)
  support the facade materials and storey/window order. The Gropius Bau keeps
  all four delivered LoD2 parts and their heights. Abgeordnetenhaus keeps the
  exact main footprint, six courtyard holes and six separate annexes. Its
  official main part incorrectly reports only 3 m height, also confirmed in
  the 2 March 2026 source tile; the replacement wall and centre heights are
  documented photo-proportioned display estimates, not surveyed dimensions.
  Visual references are the parliament's official press facade photograph
  by Peter Thieme and Manfred Brückels's
  [Gropius Bau Berlin 1.jpg](https://commons.wikimedia.org/wiki/File:Gropius_Bau_Berlin_1.jpg)
  (CC BY-SA 3.0; reference-only, credited in both Wikimedia manifests).
  No photograph or texture is bundled. See
  [Abgeordnetenhaus evidence](docs/abgeordnetenhaus-refinement.md) and
  [Gropius Bau evidence](docs/gropius-bau-refinement.md).

- **Jakob-Kaiser-Haus and Marie-Elisabeth-Lüders-Haus architecture:** the
  Bundestag's [Jakob-Kaiser-Haus account](https://www.bundestag.de/besuche/architektur/kaiserhaus/architektur/architektur-198866)
  establishes the eight-house structure, separate northern and southern
  blocks, varied courts and the connections between houses 2/6 and 4/8.
  [gmp's houses 4 and 8 record](https://www.gmp.de/de/projekte/398/jakob-kaiser-haus-abgeordnetenburos-des-deutschen-bundestages-hauser-4-und-8)
  documents limestone, cedar and folding exterior shading. The Bundestag's
  [Marie-Elisabeth-Lüders-Haus account](https://www.bundestag.de/besuche/architektur/luedershaus/architektur)
  supports the library rotunda, circular hearing-room opening, coffered hall
  roof and exterior stair reading; its old extension schedule is not used as
  evidence of present-day construction status. Berlin LoD2 and OSM remain
  the metric and identity anchors. The current LoD2 Jakob-Kaiser-Haus north
  block has incomplete upper-storey coverage on its eastern side, also verified
  in the 2 March 2026 CityGML. Its added upper wing retains the exact eastern
  portion of the existing podium plan and its courtyard hole. The 22 m eaves
  height is a display estimate based on the Bundestag's overall architectural
  description, not a surveyed height for this wing. The original source podium
  remains unchanged, and pedestrian collision follows the displayed supplement.
  External visual QA uses Matthias Süßen's
  [*Jakob-Kaiser-Haus-2025-06-msu-6595.jpg*](https://commons.wikimedia.org/wiki/File:Jakob-Kaiser-Haus-2025-06-msu-6595.jpg)
  and [*Jakob-Kaiser-Haus-2025-06-msu-6620.jpg*](https://commons.wikimedia.org/wiki/File:Jakob-Kaiser-Haus-2025-06-msu-6620.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), plus the
  already credited *Lueders-haus.jpg* and *M E Lueders Haus.jpg* (CC BY-SA 3.0).
  Local facade articulation is procedural, non-surveyed recognition detail;
  no new photograph or photographic texture is bundled or loaded.

- **Humboldthafen building ensemble architecture:** [KSP Engel](https://www.ksp-engel.com/projekte/humboldt-hafen-eins)
  and project manager [KVL](https://www.kvlgroup.com/referenzen/humboldthafen-eins)
  document HumboldtHafenEins's open upper courts, public passage, arcade and
  asymmetric glass-fibre-concrete facade fins. [Schüco's H3B/H4B account](https://www.schueco.com/carboncontrol-lu-de/start/humboldthafen)
  identifies the two seven-storey courtyard buildings and their distinct
  residential and commercial facade systems. These completed buildings remain
  separate from earlier competition alternatives. Exact building footprints,
  courtyard holes and source heights remain attributed Berlin LoD2 geometry;
  window spacing, small projections and material shades are display estimates.
  External visual QA uses Elisauer's
  [*Humboldthafen Berlin Blick vom Futurium.jpg*](https://commons.wikimedia.org/wiki/File:Humboldthafen_Berlin_Blick_vom_Futurium.jpg)
  and BugWarp's
  [*Berlín en agosto de 2024 - BugWarp (50).jpg*](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(50).jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)), and Leonhard
  Lenz's [*Humboldthafen Berlin from Hugo-Preuß-Brücke 2022-10-07 01.jpg*](https://commons.wikimedia.org/wiki/File:Humboldthafen_Berlin_from_Hugo-Preu%C3%9F-Br%C3%BCcke_2022-10-07_01.jpg)
  ([CC0](https://creativecommons.org/publicdomain/zero/1.0/)). Elisauer's
  September 2019 photograph supplies facade cues only, not current construction
  status. All three files are attribution-only references; no photograph,
  crop or image texture is bundled or loaded.

- **Historic Charité Campus Mitte architecture:** the
  [Landesdenkmalamt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011080%2CT)
  documents the historic material palette and building hierarchy. The
  [Charité museum reopening account](https://www.charite.de/service/pressemitteilung/artikel/detail/wieder_geoeffnet_berliner_medizinhistorisches_museum)
  establishes the large display windows and entrance changes made in
  2020–2023. Institutional campus addresses and the attributed OSM museum POI
  distinguish the Pathological Institute, museum and Friedrich-Althoff-Haus;
  Berlin LoD2 supplies their footprints and height envelopes. External visual
  QA uses Leonhard Lenz's
  [*Friedrich-Althoff-Haus Charité Campus Mitte 2024-05-09 01.jpg*](https://commons.wikimedia.org/wiki/File:Friedrich-Althoff-Haus_Charit%C3%A9_Campus_Mitte_2024-05-09_01.jpg),
  and Schibo's [*Charité CCM, Virchowweg 14, 2025.jpg*](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Virchowweg_14,_2025.jpg)
  and [*Charité CCM, Virchowweg 16, 2025.jpg*](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Virchowweg_16,_2025.jpg)
  (all [CC0](https://creativecommons.org/publicdomain/zero/1.0/)). Window arches,
  pale plaster fields, gable articulation and dormer proportions are procedural
  display reconstructions, not facade surveys. Per-file credits accompany the
  viewer; no photograph, campus-map artwork or photographic texture is bundled
  or loaded.

- **Siegessäule shaft and gallery (factual and visual evidence):** the
  [Landesdenkmalamt inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419),
  [official historical panel](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-1084_geschichte-der-siegessaeule.pdf)
  and [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/siegessaeule-4706/)
  support the four-drum shaft, sixty lower trophies, upper laurel, eagle-frieze
  capital and octagonal gallery. Local proportions and carving/rail subdivisions
  remain procedural. The existing BugWarp CC0 photograph is used only for QA;
  no new image asset or texture is distributed. See
  [architecture evidence and limits](docs/siegessaeule-architecture.md).

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

- **Potsdamer Platz / Tilla-Durieux-Park owner panoramas:** three
  owner-supplied Kollhoff observation-deck views bound the local Stabi gold,
  terracotta and grey upper facades, planted roofs, glass roof lights and
  lawn/tree colours. All 20 building groups retain their 276 committed
  Geoportal Berlin LoD2 parts and their original envelopes. Upper-storey
  subdivision, roof-light elevation/camber and service details are procedural
  display estimates, not survey data. No supplied photograph, crop or image
  texture is bundled or loaded. See `docs/potsdamer-panorama.md`.

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

- **Unter den Linden and Wilhelmstraße recognition facades:** Berlin LoD2
  parents `DEBE01YYK00001KP`, `DEBE01YYK00003En`, `DEBE01YYK00001vY`,
  `DEBE01YYK0000A6r` and `DEBE01YYK00002Es` remain the metric building
  anchors. OSM relation `24516`, node `514864739`, way `195071820` and nodes
  `1412218896` and `1665158255` retain the identities of the British Embassy,
  Russian Embassy, Aeroflot / Russian Trade Mission, Cafe Einstein and
  Dussmann. The [Einstein Unter den Linden site](https://www.einstein-udl.com/)
  and [Dussmann imprint](https://www.kulturkaufhaus.de/de/service/impressum)
  support address context. Bay spacing, masonry courses, signs and colour
  fields are bounded procedural display details.
  External visual QA: Jörg Zägel,
  [British Embassy](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Wilhelmstrasse,_Botschaft_Grossbritannien.jpg),
  [Russian Embassy](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_55-65,_Russische_Botschaft.jpg) and
  [Russian Trade Mission](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_51-53,_Handelvertretung_der_Russischen_Foederation.jpg)
  (each CC BY-SA 3.0); JoachimKohler-HB,
  [Dussmann KulturKaufhaus 2026](https://commons.wikimedia.org/wiki/File:Dussmann_Das_Kulturkaufhaus_in_Berlin_(2026).jpg)
  (CC BY-SA 4.0). Per-file credits accompany the viewer. No photograph, crop
  or image texture is bundled or loaded.

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

- **Bode-Museum and Grill Royal / Riverside:** the official Berlin LoD2
  tiles `391_5820` and `390_5820` (source creation 2026-03-02,
  dl-de/zero-2-0) anchor all twelve building parts, both museum dome envelopes
  and five open courts. OSM relation `4211594`, way `105733634` and node
  `2884321484` retain their semantic roles. The
  [Landesdenkmalamt museum description](https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/bode-museum-654566.php),
  [Museumsinsel building account](https://www.museumsinsel-berlin.de/gebaeude/bode-museum/)
  and [Grill Royal](https://www.grillroyal.com/) support recognition and
  address context. Facade subdivisions, dome curvature, furnishings and
  carvings are procedural, non-surveyed display details.
  External visual QA: Gunnar Klack,
  [Grill Royal / Riverside, April 2017](https://commons.wikimedia.org/wiki/File:Grill-Royal-Riverside-Hotel-Friedrichstr-Berlin-Mitte-04-2017.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/));
  C.Mezzo-1, [Bode-Museum](https://commons.wikimedia.org/wiki/File:Bode-Museum.jpg)
  (public domain); Till Niermann,
  [Bode-Museum front detail](https://commons.wikimedia.org/wiki/File:Bode-Museum_front_detail.jpg)
  ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)).
  Per-file credits accompany the viewer. No photograph, crop or texture is
  bundled or loaded; even the two signs use the project's drawn stroke alphabet.

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
  [GRASSL project record](https://www.grassl-ing.de/projekt/sandkrugbruecke_42.html)
  supplies five rows of two-hinged frames, 34.10 m overall length, 32.60 m
  structural span, 29.52 m construction width and 1.10 m structural depth.
  The old 21 m clear opening, 4.93 m clearance and roadway subdivision remain
  explicitly labelled display assumptions. External visual QA uses Lukas
  Beck's [*Berlin Sandkrugbrücke lub 2023-05-11.jpg*](https://commons.wikimedia.org/wiki/File:Berlin_Sandkrugbr%C3%BCcke_lub_2023-05-11.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) and Ansgar
  Koreng's [*Sandkrugbrücke, Berlin-Mitte, 160824, ako.jpg*](https://commons.wikimedia.org/wiki/File:Sandkrugbr%C3%BCcke,_Berlin-Mitte,_160824,_ako.jpg)
  ([CC BY 3.0 DE](https://creativecommons.org/licenses/by/3.0/de/)); these
  photographs support the four lamp masts and horizontal railing reading.
  Member sections, cross-girder spacing and rail subdivisions are procedural
  recognition geometry. Per-file credits accompany the viewer; no source
  photograph, crop, drawing or texture is bundled or loaded.

- **Zollpackhof (source conflict and visual evidence):** the two exact
  Berlin LoD2 footprints under parent `DEBE01YYK0002Tak` remain the metric
  plan anchors. Their 26.046 m and 17.639 m source heights, rechecked in the
  [2 March 2026 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip),
  conflict with the photographed low restaurant and Remise. The replacement
  4.2 m walls and 8.4/7.7 m overall heights are non-surveyed display estimates.
  The [restaurant](https://www.zollpackhof.de/the-restaurant.html) and
  [beer-garden](https://www.zollpackhof.de/the-beergarden.html) operator records
  supply present-day venue context and the chestnut's more-than-150-year age
  statement. Existing credited visual references are Schibo's
  [*Zollpackhof-Berlin.jpg*](https://commons.wikimedia.org/wiki/File:Zollpackhof-Berlin.jpg)
  and Leonhard Lenz's
  [*Zollpackhof Berlin 2024-05-09 01.jpg*](https://commons.wikimedia.org/wiki/File:Zollpackhof_Berlin_2024-05-09_01.jpg)
  (both [CC0](https://creativecommons.org/publicdomain/zero/1.0/)). Window,
  dormer, roof and furniture subdivisions are procedural recognition details.
  No new image asset or photographic texture is added to the viewer.

- **Bundeswirtschaftsministerium (architectural and visual evidence):**
  the ministry's [architecture account](https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Textsammlungen/Ministerium/architektur.html)
  distinguishes the main Invalidenstraße building from the older
  Invalidenhaus wings. Their committed LoD2 plans and heights remain the
  envelopes. Main-house window frames, pilasters and curved pediment cues use
  Bärbel Miemietz's
  [*2022-10-10 Bundesministerium Wirtschaft Klimaschutz 06.jpg*](https://commons.wikimedia.org/wiki/File:2022-10-10_Bundesministerium_Wirtschaft_Klimaschutz_06.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) and Lukas
  Beck's Sandkrugbrücke photograph credited above for external visual QA.
  Local facade subdivisions and projections remain non-surveyed recognition
  geometry. Per-file credits accompany the viewer; no photograph, crop or
  derived texture is bundled or loaded.

- **Konrad-Adenauer-Haus (factual and architectural evidence):** exact plan
  geometry and glass material come from
  [OSM way `25999445`](https://www.openstreetmap.org/way/25999445) under the
  ODbL attribution above. The
  [building archive](https://www.konrad-adenauer.de/seite/gebaeude/), the
  [current CDU account](https://www.cdu.de/aktuelles/cdu-deutschlands/das-konrad-adenauer-haus-feiert-den-25-geburtstag/)
  and the [CDU archive](https://archiv.cdu.de/node/1151) document the six-storey
  elliptical inner body, transparent winter garden and ship-like composition.
  Local floor bands, deck taper and frame spacing are deterministic,
  non-surveyed recognition geometry. v1.0.25 uses Ansgar Koreng's
  [2014 view](https://commons.wikimedia.org/wiki/File%3A141101_Berlin_Konrad-Adenauer-Haus.jpg)
  ([CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/)) and
  Reinhold Möller's
  [2024 view](https://commons.wikimedia.org/wiki/File%3ABerlin_Konrad-Adenauer-Haus-20241207-RM-102533.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) to refine
  the glass grid, office ribbons, upper decks and entrance. Building lettering
  is procedural geometry. No photograph or photographic texture is bundled or
  loaded. See [source contract](docs/cdu-refinement-v125.md).

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

  **v1.0.9 refinement:** Witzleben now follows the inventory's Renaissance
  round-arch cast-iron canopy, tall plinth, female genius and four crowned
  eagles. Winterfeld uses granite and bronze with a Schinkel enclosure;
  Rauch gains neighbouring marble crosses. The bell's three-tier folded
  silver-sheet casing and four continuous legs replace the previous
  misoriented concrete-like form. The two wall traces remain distinct.
  Litfin retains the measured LoD2 envelope while the conflicting 3 × 3 m
  monument-database and 4.2 × 4.2 m current LDA descriptions are recorded;
  the 3.65 m shaft articulation is an explicitly non-surveyed estimate.
  Ten inspected Commons photographs by Assenmacher, Beek100, Neuköllner,
  Singlespeedfahrer, Rodngrt and Sarah Stierch have individual credits and
  licence links in both Wikimedia manifests and the
  [reference catalogue](references/wikimedia/README.md). No photographs are
  bundled. See [cemetery evidence](docs/invalidenfriedhof-v109.md) and
  [Litfin evidence](docs/litfin-watchtower-refinement.md).

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
  remains reference-only visual QA. v1.0.25 additionally credits Flocci Nivis's
  [2022 view](https://commons.wikimedia.org/wiki/File%3A20220812_Richard-Wagner-Denkmal_Berlin.jpg)
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)) and Gunnar Klack's
  [2019 view](https://commons.wikimedia.org/wiki/File%3A2019-05-05-Richard-Wagner-Denkmal-1.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)) for the deep
  protective vault and marble ensemble. No source photograph, thumbnail, crop or
  photographic texture is bundled or loaded. See [source contract](docs/wagner-refinement-v125.md).

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
  the dimensions, structural counts, mirror arrangement and public ramp/platform
  measurements published on the
  [Deutscher Bundestag architecture page](https://www.bundestag.de/besuche/architektur/reichstag/kuppel).
  No Bundestag photograph or other media asset is copied into the viewer.

- **Brandenburg Gate relief dimensions:** the procedural frieze and eastern
  attic use factual counts, dimensions and placement from Bildhauerei in
  Berlin's [metope inventory](https://bildhauerei-in-berlin.de/bildwerk/metopen-triglyphenfries-10441/)
  and [attic relief inventory](https://bildhauerei-in-berlin.de/bildwerk/zug-der-friedensgoettin-10442/).
  Relief poses are simplified display geometry; no inventory photograph or
  texture is bundled. See `docs/reichstag-gate-refinement.md`.

- **Hauptbahnhof public access:** the
  [Deutsche Bahn station plan](https://www.bahnhof.de/downloads/station-plans/1071.pdf)
  validates the north/south entrance and public concourse connection. Individual
  door widths and display floor subdivisions are schematic; the plan itself is
  not bundled.

- **Musikinstrumenten-Museum and Lennéstraße fronts (factual and visual evidence):**
  the [museum's history](https://www.simpk.de/museum/sammlung/geschichte.html),
  [CMS Berlin office](https://cms.law/de/deu/office/berlin) and Collignon's
  [Lennéstraße 3](https://www.collignonarchitektur.com/de/projekte/lennestrasse-3)
  and [Lennéstraße 5](https://www.collignonarchitektur.com/de/projekte/lennestrasse-5)
  records support building identities and architectural context. The delivered
  Berlin LoD2 parts remain the footprint and height authority. External visual
  QA uses Andreas Praefcke's
  [*Berlin Musikinstrumentenmuseum 01.jpg*](https://commons.wikimedia.org/wiki/File:Berlin_Musikinstrumentenmuseum_01.jpg)
  (CC BY 3.0), Magnus Manske's
  [*State Institute for Music Research.jpg*](https://commons.wikimedia.org/wiki/File:State_Institute_for_Music_Research.jpg)
  (CC BY-SA 3.0), Manfred Brückels'
  [*Berlin Tiergartenrand Lennéstr.jpg*](https://commons.wikimedia.org/wiki/File:Berlin_Tiergartenrand_Lenn%C3%A9str.jpg)
  and Fridolin freudenfett / Peter Kuley's
  [*TiergartenLennestraße.jpg*](https://commons.wikimedia.org/wiki/File:TiergartenLennestra%C3%9Fe.jpg)
  (both CC BY-SA 3.0). Facade and rooflight subdivisions remain procedural;
  these photographs are not bundled or loaded by the viewer.

- **Composer monument and Lessing close refinement (visual evidence):** the
  [composer sculpture inventory](https://bildhauerei-in-berlin.de/bildwerk/haydn-mozart-beethoven-denkmal-5236/)
  and [Lessing inventory](https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/)
  establish their documented dimensions and programmes. The previously credited
  composer full view and Beethoven portrait remain references. Daderot's
  [*Mozart … DSC09446.JPG*](https://commons.wikimedia.org/wiki/File:Mozart_-_Beethoven-Haydn-Mozart-Denkmal_-_Berlin,_Germany_-_DSC09446.JPG)
  (public domain) additionally bounds the scroll/hand pose and console carving.
  Current pale scaled roof fields are distinguished from the documented gilt
  ornament programme. The three Lessing references credited above additionally
  guide the four-sided pedestal, hollow basins, pose and bronze groups. The
  existing CC BY-SA 3.0 choice for Lessing 3K/4K is retained; their Commons pages
  also offer CC BY 2.5. No new image is bundled or turned into a texture. See
  [evidence and measured geometry budgets](docs/music-lessing-refinement.md).

- **Soviet memorial Tiergarten positions and vehicle detail (factual and visual
  evidence):** Berlin's [memorial account](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/),
  exact OSM anchors and the attributed official DOP 2025 spring orthophoto
  support site placement. BugWarp's
  [*Berlín en agosto de 2024 … (15).jpg*](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(15).jpg)
  and [*(9).jpg*](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(9).jpg)
  (both CC BY-SA 4.0) support external checks of the tank, gun, plinth and
  running-gear readings. These photographs remain unbundled references;
  local vehicle parts and support dimensions are procedural display estimates.

- **Chancellery entrance and Hauptbahnhof bearing supports (visual evidence):**
  Martin S. Lindner's
  [*Eingangsbereich Bundeskanzleramt.JPG*](https://commons.wikimedia.org/wiki/File:Eingangsbereich_Bundeskanzleramt.JPG)
  (CC BY-SA 3.0 DE) and Rolf Heinrich, Köln's
  [*Bundeskanzleramt Berlin 2013-05-16.JPG*](https://commons.wikimedia.org/wiki/File:Bundeskanzleramt_Berlin_2013-05-16.JPG)
  (CC BY 3.0) guide the entrance grille and lawn fields. Sven Okas's
  [*Hauptbahnhof-berlin-abstuetzung-humboldthafenbruecke-2023.jpg*](https://commons.wikimedia.org/wiki/File:Hauptbahnhof-berlin-abstuetzung-humboldthafenbruecke-2023.jpg)
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), from his
  27 March 2023 S-21 Berlin video, guides the rust-brown bearing braces at
  the eastern rail exit. It is dated structural evidence, not a new condition
  survey. Local member sections and spacing remain display estimates; the
  photographs and video are not bundled, projected or used as textures.

- **Luisenstraße, Schumannstraße and Reinhardtstraße facade evidence:** the
  [Friedrich-Wilhelm-Stadt ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095859%2CT)
  and [Luisenstraße 19 pharmacy record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095894)
  establish the historic building context. The
  [German Foreign Office](https://manila.diplo.de/ph-de/willkommen/laenderinfos/vertretungen-in-deutschland)
  and [Humboldt-Universität](https://www.ogai.hu-berlin.de/contact-en) verify the
  Philippine Embassy and Mori-Ôgai-Gedenkstätte addresses. All 120 selected
  Berlin LoD2 parts and 65 existing OSM road axes remain unchanged; storey,
  window, shallow moulding and colour subdivisions are procedural estimates.
  External visual references are NutzerAusBerlin's July 2026 Luisenstraße and
  former Patentamt photographs, plus Leonhard Lenz's May 2024 Reinhardtstraße
  view (CC0); Fridolin freudenfett's *Mitte Luisenstraße.JPG*, Андрей Романенко's
  Luisenstraße 48–49 / Schumannstraße 19 view and Kvikk's Landesvertretung
  Sachsen-Anhalt photograph (CC BY-SA 4.0); and Jörg Zägel's Luisenstraße 42 and
  39 photographs plus 44penguins / Angela M. Arnold's Philippine Embassy view
  (CC BY-SA 3.0). The Landesvertretung photograph principally depicts number
  18, whose existing dedicated model is refined separately; number 19 is only
  partially visible. The [Luisenstraße 18 monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095966)
  identifies the 1874 closed oriel; the corrected east street facade uses
  three storeys and nine upper bays while retaining all four source parts.
  See [its evidence contract](docs/sachsen-anhalt-facade-refinement.md).
  All nine per-file links and credits are recorded in
  [the reference inventory](references/wikimedia/README.md#v106-external-reference-additions)
  and mirrored in the viewer. No source photograph or texture is bundled.
  See [corridor evidence](docs/luisen-corridor-refinement.md).

- **Deutsches Theater and Kammerspiele facade identity correction:** the
  [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011193)
  and [theatre profile](https://www.deutschestheater.de/das-deutsche-theater/profil)
  supplement exact LoD2 parents `DEBE01YYK00002VR` and `DEBE01YYK000037b`.
  All 27 measured parts remain unchanged. The previous model misidentified
  four main-theatre parts as Kammerspiele and placed the main portico on a
  side wing. The corrected source-bound assignments preserve the ivory main
  theatre, actual Kammerspiele facade, eight upper arched bays and open DT
  rooftop monogram. Leonhard Lenz's
  [*Deutsches Theater Berlin 2024-05-09 01.jpg*](https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_01.jpg)
  and [*03.jpg*](https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_03.jpg)
  (CC0), plus official DOP 2025, guide exterior recognition and orientation.
  Local subdivisions and code-built sign strokes are display estimates;
  no photograph, logo file, proprietary font or texture is bundled. See
  [theatre evidence](docs/deutsches-theater-refinement.md).

- **Heinrich-Böll-Stiftung at Schumannstraße 8:** the
  [foundation's building account](https://www.boell.de/de/das-stiftungshaus-der-schumannstrasse),
  [building brochure](https://www.boell.de/sites/default/files/hbs_neubau_broschure.pdf)
  and [architect's opening speech](https://www.boell.de/de/presse/neubau-4970.html)
  establish the e2a office block, projecting green beletage, recessed glazed
  foyer and seasonally closing atrium roof. Both LoD2 parts under
  `DEBE01YYK00003sO` retain their outlines and maximum heights. The low source
  part incorrectly closes the space below the cantilever; its 8.8 m viewer
  underside is a documented photo-proportioned display estimate. Leonhard
  Lenz's [*Heinrich-Böll-Stiftung building Berlin 2024-05-09 01.jpg*](https://commons.wikimedia.org/wiki/File:Heinrich-Böll-Stiftung_building_Berlin_2024-05-09_01.jpg)
  and [*04.jpg*](https://commons.wikimedia.org/wiki/File:Heinrich-Böll-Stiftung_building_Berlin_2024-05-09_04.jpg)
  (CC0) guide silver profiles and green glazing. Ankermast's
  [*Eingang zum Gebäude der Heinrich-Böll-Stiftung, Berlin.jpg*](https://commons.wikimedia.org/wiki/File:Eingang_zum_Gebäude_der_Heinrich-Böll-Stiftung,_Berlin.jpg)
  (CC BY 4.0) guides the four doors, vertical name, small green mark and number
  8. Photographs, brochure artwork and the DOP raster are reference-only,
  never runtime textures. See [Böll evidence](docs/boell-stiftung-refinement.md).

- **Friedrichstadt-Palast envelope and close facade evidence:** exact OSM way
  `24314976` remains the plan anchor. The
  [Landesdenkmalamt explanatory sheet](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/efriedrichstrasse-107.pdf)
  supplies the 110 × 80 × 20 m main volume and 32 m stage tower, in contrast
  to the source context record's generic 12 m fallback. That source record is
  retained. The [theatre's anniversary account](https://www.palast.berlin/news/der-neue-palast-feiert-40-jahre/)
  supplies the documented glass-block count. John Samuel's
  [*Exterior view of Friedrichstadtpalast, Berlin 02.jpg*](https://commons.wikimedia.org/wiki/File:Exterior_view_of_Friedrichstadtpalast,_Berlin_02.jpg)
  and [*04.jpg*](https://commons.wikimedia.org/wiki/File:Exterior_view_of_Friedrichstadtpalast,_Berlin_04.jpg)
  (CC BY-SA 4.0, 7 May 2024) guide faceted two-storey glazing, narrow coloured
  strips, nested arch mouldings, foyer returns and rooftop sign. Local window
  subdivisions, relief cues and code-built lettering/fan shapes are procedural
  estimates; promotional poster artwork and photographs are not reproduced.
  See [Palast evidence](docs/friedrichstadt-palast-refinement.md).

- **Detlev-Rohwedder-Haus / Federal Ministry of Finance:** the
  [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095987)
  and [ministry's architectural history](https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Video-Textfassungen/Geschichte/textfassung-detlev-rohwedder-haus.html)
  supplement the exact Berlin LoD2 parts and OSM relation `280070`.
  Limestone evidence takes precedence over the conflicting OSM marble tag;
  both sources remain recorded. Window subdivisions, roof equipment, arcade
  depth and fence height are procedural display estimates. Seven credited
  photographs by Jörg Zägel, Gerd Eichmann, Gavailer, BrokenSphere, Monika
  Angela Arnold, Magnus Manske and Maddriver371 guide exterior recognition.
  No historical removed emblems, photograph textures or mural reproductions
  are included. See [source contract](docs/rohwedder-haus-refinement.md).

- **Bundesrat / former Prussian House of Lords:** the
  [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096003),
  [Bundesrat building account](https://www.bundesrat.de/DE/bundesrat/gebaeude/gebaeude-node.html)
  and [BBR art inventory](https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/o-t-plastik)
  supplement all four LoD2 parts under `DEBE01YYK00005AI`. The current front
  retains Otto Lessing's pediment relief and Per Kirkeby's eight bronze works
  in simplified procedural silhouette. Source-absent roof and pediment details
  are labelled display supplements. Photographs by Jörg Zägel, A.Savin,
  Leonhard Lenz and Luis Alvaz plus official DOP 2025 guide the geometry;
  no sculpture scans or photograph textures are distributed. See
  [source contract](docs/bundesrat-refinement.md).

- **Topography of Terror:** the [institution's site history](https://www.topographie.de/ueber-den-ort/geschichte-nach-1945)
  and [site tour](https://www.topographie.de/ausstellungen/gelaenderundgang)
  supplement the exact LoD2 museum and OSM archaeological-site outlines.
  Architecture is credited to Ursula Wilms / Heinle, Wischer und Partner;
  landscape design to Heinz W. Hallmann. The surviving Wall follows official
  Vorderlandmauer line 85 clipped to the OSM remnant's endpoints. Its roughly
  196 m measured route and published approximate 200 m length are kept
  distinct. Current rooftop arrays follow DOP 2025. Photographs by Vedha242424,
  Josef Streichholz, Moleskine, Marco van Oel, Dosseman and Hans G. Oberlack
  guide material and facade recognition. Mauer chips, canopy subdivisions
  and local excavation relief are display estimates. No exhibition texts,
  historical reconstruction plans or photographs are reproduced. See
  [source contract](docs/topography-terror-refinement.md).

- **Kulturforum entrances and neighbouring memorials:** official visitor and
  site plans from the Berliner Philharmoniker and Staatliche Museen establish
  the principal Philharmonie, Kammermusiksaal and Piazzetta entrances. The
  Stiftung Denkmal documents the separate 24 m blue-glass T4 memorial, while
  the Berlin sculpture inventory documents Richard Serra's two 14 × 3.4 m
  Corten-steel plates (the older precise dimension attribution was incorrect).
  Four owner-supplied photos guide the v1.0.23 correction and remain reference-only.
  Plate thickness, curvature, local door widths, mullions, canopies
  and steps remain procedural display fits. No photograph, exhibition text or
  sculpture scan is distributed. See [source contract](docs/kulturforum-memorial-entrances-v115.md).

- **Charlottenburger Tor and Großer Stern tunnel houses:** the
  Charlottenburg-Wilmersdorf district history establishes Bernhard Schaede's
  colonnaded 1907–08 gate, its two principal bronze figures and the published
  34 m road opening. OSM ways `106952577`, `106952579`, `106953928` and
  `106953934` supply the four separate tunnel-house footprints, two-level
  identities and hipped roofs. Portico, pediment, stair and sculptural
  subdivisions remain procedural display fits. No photograph or sculpture
  scan is distributed. See [source contract](docs/charlottenburger-tor-tunnelhouses-v116.md).

All v1.0.7 free-photo links, authors and licences are listed in the
[reference inventory](references/wikimedia/README.md#v107-external-reference-additions)
and mirrored in the packaged viewer attribution manifest.

- **TIPI site (v1.0.22):** exact retained OSM context footprints and official
  [DOP 2025 spring](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
  (Geoportal Berlin, dl-de/zero-2-0) distinguish the real canvas pavilions,
  northern entrance and low service wings from generic fallback-height prisms.
  The aerial remains an unbundled reference. Roof curvature and heights are
  labelled procedural estimates; [source contract](docs/tipi-site-v122.md).

- **Viktoria / Goldelse (v1.0.24):** Friedrich Drake's gilded bronze keeps the
  [Bildhauerei in Berlin inventory](https://bildhauerei-in-berlin.de/bildwerk/siegessaeule-4706/)
  height, shoe length, west orientation and attributes. AlterVista's
  [*Berlin Siegessaeule Victoria.jpg*](https://commons.wikimedia.org/wiki/File:Berlin_Siegessaeule_Victoria.jpg)
  (29 May 2003, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
  guides the frontal feather fan and draped body; the existing BugWarp CC0
  photograph remains the full-height context reference. Anatomy, drapery and
  feather subdivisions are procedural display fits. No image, crop or texture
  is bundled or fetched. See [evidence and budgets](docs/goldelse-v124.md).

- **Humboldt/Bebelplatz (v1.0.31):** bounded original wall/roof surfaces from
  Geoportal Berlin LoD2 tiles `390_5819` and `391_5819` (dl-de/zero-2-0), retained
  OSM identities and the exact Bebelplatz stone-paving polygon (ODbL 1.0).
  [Building evidence](docs/bebelplatz-building-source.md),
  [facade references and individual photo credits](docs/bebelplatz-facades.md),
  [Hedwig dome evidence](docs/hedwig-cathedral.md) and
  [empty-library dimensions and photo credits](docs/bebelplatz-memorial.md)
  distinguish measured envelopes from procedural display subdivisions.
  Reference photographers: Christian Wolf (CC BY-SA 3.0 DE), Ansgar Koreng
  (CC BY 3.0 DE), GFreihalter, Bahnfrend and Yair Haklai (CC BY-SA 4.0),
  Daniel Neugebauer (CC BY-SA 2.5), Stefan Kemmerling / crop Beyond My Ken
  (CC BY-SA 3.0). Full per-file metadata is mirrored in both manifests.
  All photographs remain external references; no image or crop is bundled.

- **Rosengarten and Soviet Memorial (v1.0.34):** retained OpenStreetMap geometry
  (ODbL 1.0), Geoportal Berlin DOP 2025 (dl-de/zero-2-0) and the
  Landesdenkmalamt Tiergarten description guide the mapped planting beds,
  open pergola and street-facing tank bearings. Existing BugWarp tank photo
  references remain external. No photograph or texture is bundled. See
  [Rosengarten evidence](docs/rosengarten-refinement-v134.md) and
  [memorial evidence](docs/soviet-memorial-refinement.md).

- **Bounded urban facade presentation (v1.0.35):** reuses the retained OSM
  building colour/material supplement (ODbL 1.0) and the existing Step-8
  illustration palette. Source tags and illustrative tones remain distinct;
  no new photograph, texture or opening survey is introduced. See
  [scope and evidence](docs/urban-facade-presentation-v135.md).

- **Spree public space (v1.0.37):** retained OpenStreetMap water/road/path
  geometry and a 2026-09-11 Overpass barrier snapshot (ODbL 1.0). Exact mapped
  rail courses are distinguished from unmeasured member dimensions and colours.
  No imagery is bundled. See [source selection and budgets](docs/spree-streets-v137.md).

- **Schloss, Dussmann and Naturkunde (v1.0.37):** complete retained Geoportal
  Berlin LoD2 source sheets and existing OSM identities anchor the buildings.
  The Humboldt Forum architectural backgrounder supplies the 70 m overall
  silhouette; Landesdenkmalamt `09011177,T,002` supplies Naturkunde's facade
  programme. Dome curvature, lantern, window bays and local member dimensions
  are procedural display fits; original source planes remain preserved.
  New external visual references: Falk2 / Falk Arnhold's *L01 490
  Humboldt-Forum.jpg* and AusleseBeeren's *The Dome Of Berlin Palace.jpg*
  (CC BY-SA 4.0), plus Jörg Zägel's *Berlin, Mitte, Invalidenstrasse 43,
  Museum für Naturkunde.jpg* (CC BY-SA 3.0). The existing JoachimKohler-HB
  Dussmann 2026 reference is reused. Individual links, licences, source conflicts
  and measured budgets are in the [source contract](docs/schloss-dussmann-naturkunde-v137.md).
  All three new per-file credits are mirrored in both manifests. No photograph
  or image texture is bundled or loaded.

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

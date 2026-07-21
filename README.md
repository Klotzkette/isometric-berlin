# Isometric Berlin – Regierungsviertel

## Web viewer & Downloads

| What | Link |
|---|---|
| **Open the hosted viewer** | https://klotzkette.github.io/isometric-berlin/ |
| **Download ZIP for Mac/Windows/Linux** | https://github.com/Klotzkette/isometric-berlin/releases/latest/download/isometric-berlin-regierungsviertel-local.zip |
| Versioned v0.16.0 ZIP | https://github.com/Klotzkette/isometric-berlin/releases/download/v0.16.0/isometric-berlin-regierungsviertel-local.zip |
| Latest release page | https://github.com/Klotzkette/isometric-berlin/releases/latest |
| **Public repository / öffentliches Repository** | **https://github.com/Klotzkette/isometric-berlin** |
| Local start instructions | [Run locally / Lokal starten](#run-locally) |
| Package manifest in the ZIP | `package-manifest.json` |

The downloadable viewer is the built React + Three.js/OpenSeadragon app from
`src/app/`. It defaults to the true 3D official-mesh view and works on modern
desktop, phone and tablet browsers. No AI model, Google key or paid service is
needed at runtime. The same functional viewer is deployed on GitHub Pages and
bundled with all required local assets in the release ZIP.

`START-HERE.html` is the zero-server **2D compatibility fallback**, not the
full model. For true 3D on Windows, double-click `start-windows.bat`. On macOS
or Linux, run `python3 serve-local.py` in the extracted folder; it opens the
3D viewer directly. The distinction is explicit in the package so the old
flat renderer cannot be mistaken for current 3D quality.

**Status:** Public open-data project · **Local v0.16.0** · hosted viewer and a
complete local package for macOS, Windows, and Linux.

## What this repository is / Was dieses Repository ist

| English | Deutsch |
|---|---|
| This public repository contains the complete React/Three.js viewer, Python geodata pipeline, bounded Regierungsviertel source manifests, tests, documentation, generated WebGL assets, and reproducible release tooling. | Dieses öffentliche Repository enthält den vollständigen React/Three.js-Viewer, die Python-Geodatenpipeline, begrenzte Quellenmanifeste des Regierungsviertels, Tests, Dokumentation, erzeugte WebGL-Dateien und reproduzierbare Release-Werkzeuge. |
| The live and downloaded viewers need no AI model, account, API key, or paid service. They render bundled static assets directly in a modern browser. | Der Live-Viewer und das Download-Paket benötigen weder KI-Modell noch Konto, API-Key oder Bezahldienst. Sie rendern die mitgelieferten statischen Dateien direkt im modernen Browser. |
| Metric placement comes from Berlin LoD2, the Berlin 3D Mesh, official support layers, and OSM. Procedural recognition details are additive and explicitly documented; an approximation is never described as surveyed geometry. | Die metrische Lage stammt aus Berlin LoD2, dem Berliner 3D-Mesh, amtlichen Zusatzebenen und OSM. Prozedurale Erkennungsdetails sind additiv und ausdrücklich dokumentiert; eine Annäherung wird niemals als vermessene Geometrie ausgegeben. |
| The browser UI contains a GitHub button. It shows this complete repository URL in German and English and provides a stable download action. | Die Browseroberfläche enthält einen GitHub-Knopf. Er zeigt diese vollständige Repository-Adresse auf Deutsch und Englisch und bietet einen stabilen Download an. |

The canonical source and issue history always live at
<https://github.com/Klotzkette/isometric-berlin>. Release archives are
reproducible outputs, not a separate hidden codebase.

## Current Viewer

The current public package is **v0.16.0**, built from `main`. Its full viewer is a progressively
loaded, freely orbitable 3D scene; the double-click HTML remains a clearly
labelled compatibility fallback for browsers that cannot run local modules.

- The metric base comes from 23 bounded tiles of the official Berlin 3D Mesh
  Model 2025, generated from the June 2025 aerial survey and transformed from
  EPSG:25833 without changing horizontal or vertical scale.
- Each context tile retains up to 100,000 faces, raising the official base from
  1,609,984 to 2,299,987 faces without moving its source coordinates. A 58°
  normal crease keeps severe roof and facade folds crisp while preserving
  continuous terrain and vegetation. On desktop, a second background-loaded
  tier retains 6,000,002 official mesh faces while the camera is still; mouse,
  keyboard or UI movement switches immediately to the lighter tier and returns
  only after damping has ended. Two additional 80-triangle crown microclusters
  then appear for each of the 6,893 official Berlin tree points. This produces
  7,102,882 rendered official-source face equivalents in the settled
  presentation. The figure transparently includes GPU instances; it does not
  claim seven million unique surveyed polygons. Touch devices retain the 2.3M
  interaction tier and do not download the desktop-only 6M geometry or render
  the settled-only microcrowns. Source-texture vertex
  colours receive a bounded saturation/contrast lift so grass, water, brick and
  glass remain distinct without inventing textures. A stronger south-west
  key light and reduced ambient fill keep facade folds and tree trunks crisp
  instead of washing them into beige/green. Reichstag,
  Bundeskanzleramt, Hauptbahnhof and Brandenburger Tor receive separate
  high-detail, textured photogrammetry crops masked by official LoD2
  footprints, using up to 1600 px per material segment. Metric recognition
  models now sharpen the silhouettes without replacing that texture: the
  Reichstag has its 138 x 100 m body, west portico, four towers and 40 x 23.5 m
  24-sector dome at the official 24 m roof-terrace datum; its historic facade
  now separates tall arched bays, three-bay tower windows, upper windows and
  west-entrance glass instead of repeating one generic grid. The Chancellery separates its
  36 m cube and three LoD2-aligned 18 m
  office bands; Hauptbahnhof exposes its 321 m glass roof, 180 x 42 m hall and
  46 m frames; the 62.5 x 11 x 26 m Brandenburg Gate has all twelve columns and
  a bronze-green Quadriga.
- Selecting one of the four hero buildings opens a building-specific,
  presentation-quality camera angle and distance before normal free orbiting.
  The Brandenburg Gate is no longer shown as a tiny object in a 250 m view.
- Recognition geometry now follows each building's measured LoD2 local axis,
  not the map's screen axes. This fixes the Hauptbahnhof overlay's former
  21.82° orientation error and moves its anchor from the OSM label point to the
  official hall centre. Camera targets use the model anchors; the Chancellery
  still centres its characteristic 36 m leadership cube rather than the full
  343 m ensemble.
- Model-railway detail is visible at normal viewing distances: Hauptbahnhof has
  four upper tracks, platforms, a stationary ICE and Berlin S-Bahn. Its 541 m
  approach deck now carries ballast, sleepers and viaduct piers beyond the
  321 m glass roof instead of leaving either train on visually floating track;
  the Gate
  has stepped side pavilions, five shaded passages and a more articulated
  Quadriga; the Chancellery has floor plates, facade mullions and its arched
  leadership-window grid; the Reichstag adds roof cornices, portico bases and
  capitals, entrances, three German flags and one EU flag around the official
  dome. All four flags share a subtle reduced-motion-aware wind animation.
- The civic layer adds the LoD2-aligned Swiss Embassy with its historic palace,
  modern extension and Swiss flag, plus the Bundestag's official 28.5 m Unity
  Flag pole and 60 m² German flag. The TIPI uses its published 32 x 26 m
  ellipse and receives structural ribs, golden `PIGOR & EICHHORN` / `NUR HEUTE
  ABEND` bulb lines, 220 rib lights and night-only concert colour. The 42 m
  Carillon exposes all 68 bells below its shallow roof; two small security
  figures mark the Chancellery entrance. An occupied Spree excursion boat adds
  an open upper deck, deckchairs, passengers, drinks, steam and wake.
- Close-up detail now stays sharp without multiplying draw calls: instanced
  roof ribs, sleepers, facade panes, train fittings and balustrade posts are
  combined with batched glass seams, masonry courses, column fluting and
  entablature profiles. All additions remain inside the published metric
  envelopes of the four hero landmarks.
- Day, Night and Minecraft now have separate direct controls. The true 3D scene
  changes sky, fog, directional light and exposure; only the Reichstag's tall
  arched occupied bays emit light at night, while its small upper and tower
  windows remain dark. The 2D fallback receives a restrained night treatment.
- The `Minecraft` visual mode, also available with `M`,
  applies an original 48-colour premium voxel palette, ordered dithering,
  toon materials and restrained animated water/glass highlights without moving a
  single LoD2 anchor or changing camera framing. Deterministic villages,
  market tents, fields, tiny people, animals and boats appear progressively
  only after 20–75 seconds of uninterrupted dwell time and remain under a
  strict mobile density budget.
- Phones and coarse-pointer tablets up to 1024 px use a compact 40 px sight
  status bar, a 56 px bottom action bar,
  a compass sheet and a separate action sheet. The chrome can be hidden with
  its chevron or a three-finger downward swipe; iPhone safe areas, landscape,
  44 px touch targets, reduced motion and momentum-rich pinch/pan/rotate are
  handled explicitly.
- The old always-visible coloured landmark dots are gone. Selecting a landmark
  briefly shows a small ring, which fades after 2.4 seconds so roofs and
  facades remain unobstructed.
- Left mouse drag or one finger orbits; wheel zooms; right mouse drag pans.
  Two-finger swipe flies along the current camera heading, pinch zooms and
  twist rotates; three fingers carry the camera continuously through a genuine
  underside view. Plain arrows translate in the visible screen plane,
  `Shift` + arrows fly forward/backward or strafe, and `Alt`/`Option` + arrows
  orbit and tilt. Camera and target move together, so flight never changes the
  orbit distance accidentally.
- A persistent DE/EN switch translates the application chrome and correctly
  calls the German list `Sehenswürdigkeiten`. Optional music (`B`) starts only
  after an explicit click and synthesizes seven original slow 8-bit ambient
  variations locally with Web Audio; no recording, stream or external asset is
  loaded. Seven brief bilingual discovery notes appear once per selected sight.
- A bounded sharpen/saturation pass runs only after camera motion stops, while
  movement keeps the cheaper direct pipeline. The Chancellery cloud is removed,
  and the Carillon layer now lets the official mesh carry its granite pylons
  instead of drawing a second tower over them.
- The two-tube Tiergartentunnel cutaway has lit fixtures and safety strips,
  road decks and lane marks, ventilation shafts and four-blade fan cues. It is
  hidden in ordinary exterior views and appears automatically only when an
  orbit crosses below ground; the underside control remains a direct tunnel
  preset. Its route is explicitly labelled as an OSM-derived engineering
  approximation, not surveyed tunnel geometry.
- Seven memorials now have close-range recognition geometry. The Holocaust
  field draws all 2,710 officially documented stelae in one instanced call with
  the published 0.95 x 2.38 m cross-section and height bands; the Soviet,
  Sinti/Roma, homosexual-victims, Goethe, composer and 2026 Jehovah's Witnesses
  memorials preserve their defining source-documented forms while the official
  Berlin surface remains visible underneath. The Soviet memorial's two
  Berlin.de-identified T-34/76 vehicles now use longitudinal hulls, sloped
  glacis plates, ten road wheels each, turrets, hatches and 76 mm barrels rather
  than transverse generic boxes; their local spacing remains an approximation.
- Tiergarten detail is no longer only a coarse photogrammetric canopy. A
  compact additive layer combines 6,893 official Berlin tree-catalogue points
  with unmatched OSM evidence into 8,029 individual trees, including measured
  height, crown and trunk dimensions where published. It also adds 1,242
  official public-light positions with night cones, two official
  Vorderlandmauer traces as a granular double row of dark red-brown setts and
  167 OSM park-path sections. Five playground
  footprints are retained; the selectable Luiseninsel playground opposite the
  Philharmonie includes its mapped climbing frames, slide, swings, sandpit,
  water-play point and excavator. Its oblique focus view keeps those small
  devices readable above the coarse source-mesh canopy and restores the normal
  tree presentation as soon as another landmark is selected. Exactly three
  tiny coloured Easter eggs are deterministically hidden beside mapped trees.
- The southern edge now includes a small brick-built LEGO giraffe recognition
  model at the OSM LEGOLAND Discovery Centre point. Its position source and
  Commons visual reference are recorded; its footprint and dimensions are
  explicitly labelled as a display approximation, not a survey.
- The Spree carries a narrow translucent 3D wave surface aligned to the
  committed OSM centreline. Its 0.32 m relief and crest highlights are a
  procedural display treatment, not surveyed hydrodynamic data.
- Assets load progressively with bounded concurrency and an adaptive pixel
  ratio. The 163.5 MiB scene contains 23 interaction GLBs, 23 settled-detail
  GLBs and 22 lazy hero parts; every individual public GLB remains below 5 MiB.
  Both official surface tiers use Meshopt compression with bundled normals.
  Existing GLB normals are reused
  instead of recalculating roughly 2.3 million base triangles at startup.
- Mobile devices retain only the selected high-resolution hero group; desktop
  retains the two most recent. Evicted geometry, materials and textures are
  explicitly released from GPU memory. A failed detail file is retried once
  and no longer disables an otherwise usable base scene. Touch devices release
  inactive 3D when switching to the 2D map, cancel a stale hero queue after a
  new selection and cap moving rendering at 30 fps; desktop retains the warm
  mode switch and 60 fps interaction.
- Disposing the viewer now cancels the remaining 100-item-capable worker queue
  before it can start another GLB. Pointer capture loss and window blur also
  reset three-finger state; global pointer release, hidden-tab recovery and a
  ten-second watchdog prevent a permanently disabled orbit control. Invalid or
  out-of-bounds camera poses recover to the last finite, bounded view.
- Settled 3D uses up to 2.25x desktop / 1.75x mobile device pixels, bounded by
  fixed eight- and 4.8-megapixel budgets so 4K screens and high-DPI phones do
  not over-allocate GPU memory. Orbit gestures temporarily lower the render
  ratio, then restore full sharpness after 140 ms.
  Damping remains at the active frame rate until it has actually stopped; only
  then do static scenes settle to 12 fps on desktop and 10 fps on mobile.
- Repeated tunnel lamps, lane marks, ventilation shafts, fan rings and blades
  are instanced into five draw calls; each fan now has four distinct blades
  instead of two duplicated pairs.
- The local package server uses HTTP/1.1, the correct GLB media type and
  immutable caching for heavy static assets. Reopening 3D reuses the local
  browser cache instead of transferring the 163.5 MiB scene again.
- Release QA verifies the exact byte length and SHA-256 of all 68 scene GLBs in
  the source tree, extracted package, ZIP and static tarball. Both archives now
  reject duplicate, linked, encrypted, hidden and oversized content. The local
  server repeats model verification before opening the browser.
- The 16384×11616, 15-level OpenSeadragon map remains available as a fast
  high-resolution fallback. Its marker layer also shows only the selection.
- The responsive controls were verified at 1280×720 and 390×844: no horizontal
  overflow, full-viewport canvas, 44 px touch targets and visible mobile
  orientation controls.
- LoD2, OSM, ALKIS/DOP/DGM inventories, 40 landmarks, 23 relative-placement
  checks and 110 accepted Wikimedia references remain part of the additive
  evidence pipeline and attribution chain.
- No Google, Apple, Bing, Amap, social-media or restricted-photo content is
  bundled. Those services may be inspected for QA, but are not copied.

## Inhalt & Links

| Area | What to open |
|---|---|
| Data policy and source ranking | [docs/data.md](docs/data.md) |
| External map / official-site QA notes | [docs/external-geolocation-qa.md](docs/external-geolocation-qa.md) |
| Landmark alignment report | [docs/landmark-alignment.md](docs/landmark-alignment.md) |
| Metric precision notes | [docs/metric-precision.md](docs/metric-precision.md) |
| Monument detail status and sources | [docs/monument-detail.md](docs/monument-detail.md) |
| Tiergartentunnel geometry notes | [docs/tiergartentunnel-geometry.md](docs/tiergartentunnel-geometry.md) |
| Viewer and app notes | [docs/app.md](docs/app.md) |
| Deployment and local package notes | [docs/deployment.md](docs/deployment.md) |
| Local package smoke test | [scripts/smoke_local_package.py](scripts/smoke_local_package.py) |
| Documentation index | [docs/README.md](docs/README.md) |
| Regierungsviertel data folder | [geo_data/regierungsviertel/README.md](geo_data/regierungsviertel/README.md) |
| Wikimedia attribution | [references/wikimedia/README.md](references/wikimedia/README.md) |
| Release history | [CHANGELOG.md](CHANGELOG.md) |

## Sehenswürdigkeiten im Paket

The machine-readable source list is
[`geo_data/regierungsviertel/landmarks.geojson`](geo_data/regierungsviertel/landmarks.geojson);
the packaged viewer projection is
[`src/app/public/dzi/regierungsviertel/landmarks.json`](src/app/public/dzi/regierungsviertel/landmarks.json).

| Group | Included landmarks |
|---|---|
| Federal government core | Reichstagsgebäude, Bundeskanzleramt, Paul-Löbe-Haus, Marie-Elisabeth-Lüders-Haus, Reichstagsvorfeld / Berlin-Pavillon, Platz der Republik Heckenbosquets, Kanzlergarten / Non-Violence-Skulptur |
| Hauptbahnhof / Spree / bridges | Berlin Hauptbahnhof, Humboldthafen, Hugo-Preuß-Brücke, Rahel-Hirsch-Straße, Moltkebrücke, Gustav-Heinemann-Brücke, Spreebogen, Zollpackhof |
| Pariser Platz and diplomatic edge | Brandenburger Tor, Quadriga mit Victoria, Pariser Platz, Starbucks Pariser Platz, Max-Liebermann-Haus, Botschaft der Vereinigten Staaten von Amerika |
| Spreebogen diplomacy / civic symbols | Schweizerische Botschaft, Fahne der Einheit |
| Memorials | Denkmal für die ermordeten Juden Europas, Denkmal für die im Nationalsozialismus verfolgten Homosexuellen, Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas, Sowjetisches Ehrenmal Tiergarten, Mahnmal für verfolgte Zeugen Jehovas, Gedenkort für Polen 1939-1945 |
| Tiergarten / culture / park details | Haus der Kulturen der Welt, Großer Tiergarten, Beethoven-Haydn-Mozart-Denkmal, Venusbassin / Goldfischteich, Goethe-Denkmal, TIPI am Kanzleramt, Eduardo-Chillida-Skulptur Berlin, Carillon im Tiergarten |
| Tunnel context | Kemperplatz / Tiergartentunnel, Tiergartentunnel Südeingang, approximate Tiergartentunnel underground reference route |

---

## Credit / Dank

<table>
<tr>
<th width="50%">🇬🇧 English</th>
<th width="50%">🇩🇪 Deutsch</th>
</tr>
<tr>
<td valign="top">

Full credit to **[Andy Coenen](https://cannoneyed.com)**, who invented
this entire idea and executed it for New York City as
**[isometric.nyc](https://isometric.nyc)**.

His open-source codebase
([cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc),
MIT, © 2025 Andy Coenen) and his
[write-up](https://cannoneyed.com/projects/isometric-nyc)
are the basis on which this Berlin project is built. The directory
layout, agent guidance, docs structure, generation DB schema, and
isometric quadrant model are all directly inspired by his work.

This project would not exist without him.

</td>
<td valign="top">

Voller Dank an **[Andy Coenen](https://cannoneyed.com)**, der diese
gesamte Idee erfunden und für New York City als
**[isometric.nyc](https://isometric.nyc)** umgesetzt hat.

Sein Open-Source-Code
([cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc),
MIT, © 2025 Andy Coenen) und sein
[Werkstattbericht](https://cannoneyed.com/projects/isometric-nyc)
sind die Grundlage, auf der dieses Berliner Projekt aufbaut. Die
Verzeichnisstruktur, die Agenten-Anweisungen, die Dokumentation, das
Datenbankschema und das isometrische Quadrantenmodell sind allesamt
direkt von seiner Arbeit inspiriert.

Dieses Projekt würde ohne ihn nicht existieren.

</td>
</tr>
</table>

---

<table>
<tr>
<th width="50%">🇬🇧 English</th>
<th width="50%">🇩🇪 Deutsch</th>
</tr>

<tr>
<td valign="top">

## The Idea

The end goal is a giant, zoomable, SimCity-style isometric map
of Berlin. The current viewer runs from generated open-data map tiles
and the official Berlin photogrammetry mesh; the AI style pass is a later
pipeline step, not a runtime requirement.

This repository is an independent, derivative project inspired by
Andy Coenen's [isometric.nyc](https://isometric.nyc). The approach,
pipeline structure, and several scaffolding files follow Coenen's
[open-source NYC codebase](https://github.com/cannoneyed/isometric-nyc)
(MIT-licensed). All city data, model fine-tunes, and rendered tiles
for Berlin are produced from scratch.

</td>
<td valign="top">

## Die Idee

Das Ziel ist eine riesige, zoombare, isometrische Karte von
Berlin im Stil von SimCity. Der aktuelle Viewer läuft mit erzeugten
Open-Data-Kacheln und dem amtlichen Berliner Photogrammetrie-Mesh; der KI-Stilschritt ist ein
späterer Pipeline-Schritt und keine Laufzeitvoraussetzung.

Dieses Repository ist ein eigenständiges, abgeleitetes Projekt, inspiriert
von Andy Coenens [isometric.nyc](https://isometric.nyc). Der Ansatz, die
Pipeline-Struktur und einige Gerüstdateien orientieren sich an Coenens
[Open-Source-NYC-Codebase](https://github.com/cannoneyed/isometric-nyc)
(MIT-lizenziert). Alle Stadtdaten, Modell-Finetunes und gerenderten
Kacheln für Berlin werden neu erzeugt.

</td>
</tr>

<tr>
<td valign="top">

## MVP Scope: Regierungsviertel

The bounded release covers only the **Government Quarter of Berlin** — a tight
area around the heart of the federal government. The source polygon remains
the hard spatial limit so releases stay reproducible and locally downloadable.

**Bounding area (approximate):**

- **Brandenburger Tor** (south-east corner, Pariser Platz)
- **Reichstag** building
- **Bundeskanzleramt** (Federal Chancellery)
- **Paul-Löbe-Haus** and **Marie-Elisabeth-Lüders-Haus**
  (the "Band des Bundes" along the Spree)
- **Berlin Hauptbahnhof** (Berlin Central Station, north-west corner)
- **Kongresshalle / Haus der Kulturen der Welt** ("Schwangere Auster")
- Eastern strip of the **Tiergarten** down to the
  **Tiergartentunnel entrance** at the **Sony Center / Potsdamer Platz**

Roughly a 2.5 × 1.5 km rectangle (~4 km²). Expected tile count is in
the low hundreds, not the ~40,000 of the NYC map.

</td>
<td valign="top">

## MVP-Umfang: Regierungsviertel

Der begrenzte Release deckt ausschließlich das **Regierungsviertel Berlin**
ab – einen engen Bereich rund um das Herz der Bundesregierung. Das
Quellpolygon bleibt die feste räumliche Grenze, damit Releases reproduzierbar
und lokal herunterladbar bleiben.

**Ausschnitt (ungefähr):**

- **Brandenburger Tor** (Südost-Ecke, Pariser Platz)
- **Reichstagsgebäude**
- **Bundeskanzleramt**
- **Paul-Löbe-Haus** und **Marie-Elisabeth-Lüders-Haus**
  (das „Band des Bundes" entlang der Spree)
- **Berlin Hauptbahnhof** (Nordwest-Ecke)
- **Kongresshalle / Haus der Kulturen der Welt** („Schwangere Auster")
- Östlicher Streifen des **Tiergartens** bis zum Eingang des
  **Tiergartentunnels** am **Sony Center / Potsdamer Platz**

Grob ein Rechteck von 2,5 × 1,5 km (~4 km²). Erwartete Kachelzahl
liegt im niedrigen dreistelligen Bereich, nicht bei den ~40.000 der
NYC-Karte.

</td>
</tr>

<tr>
<td valign="top">

## Data Sources & Licensing

This project uses **additive data fusion** built on open data, with
Google Maps Platform as an **opt-in, additive** source (never a
replacement for Berlin open data or OSM):

| Dataset | Source | License |
|---|---|---|
| 3D building geometry (LoD2) | [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) (effectively public domain) |
| Streets, parks, water, POIs | [OpenStreetMap](https://www.openstreetmap.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Orthophotos / DOP, ALKIS, DGM (optional) | Geoportal Berlin | dl-de/zero-2-0 |
| Individual trees, public lighting, 1989 Wall route | [Geoportal Berlin](https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23) | dl-de/zero-2-0 |
| Landmark facade / material visual references | [Wikimedia Commons / Wikipedia](https://commons.wikimedia.org) | Per file: CC0, public domain, CC BY, CC BY-SA; see `geo_data/regierungsviertel/wikimedia_references.json` |
| Photorealistic 3D Tiles (opt-in) | [Google Maps Platform](https://developers.google.com/maps/documentation/tile/3d-tiles) | [Google Maps Platform ToS](https://cloud.google.com/maps-platform/terms) |

**Required attribution in the viewer:**

> © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia

When Google-derived content is used, the required Google attribution
(e.g. *Imagery © Google · Google Maps Platform*) must additionally be
shown. OSM is share-alike for *derivative databases*, but rendered tile
images are *Produced Works* and may be released under any license, as
long as the attributions above are shown.
Per-file Wikimedia credits are stored in
`src/app/public/dzi/regierungsviertel/wikimedia_attribution.json` and
`references/wikimedia/README.md`.

</td>
<td valign="top">

## Datenquellen & Lizenzen

Dieses Projekt nutzt **additive Datenfusion** auf Basis offener Daten,
mit Google Maps Platform als **optionaler, additiver** Quelle (niemals
als Ersatz für Berliner Open Data oder OSM):

| Datensatz | Quelle | Lizenz |
|---|---|---|
| 3D-Gebäudegeometrie (LoD2) | [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) (faktisch gemeinfrei) |
| Straßen, Parks, Wasser, POIs | [OpenStreetMap](https://www.openstreetmap.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Orthophotos / DOP, ALKIS, DGM (optional) | Geoportal Berlin | dl-de/zero-2-0 |
| Einzelbäume, öffentliche Beleuchtung, Mauerverlauf 1989 | [Geoportal Berlin](https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23) | dl-de/zero-2-0 |
| Fassaden-/Material-Referenzen für Sehenswürdigkeiten | [Wikimedia Commons / Wikipedia](https://commons.wikimedia.org) | Je Datei: CC0, Public Domain, CC BY, CC BY-SA; siehe `geo_data/regierungsviertel/wikimedia_references.json` |
| Photorealistic 3D Tiles (opt-in) | [Google Maps Platform](https://developers.google.com/maps/documentation/tile/3d-tiles) | [Google Maps Platform ToS](https://cloud.google.com/maps-platform/terms) |

**Pflicht-Attributionshinweis im Viewer:**

> © OpenStreetMap-Mitwirkende · 3D-Gebäudemodelle: Geoportal Berlin (dl-de/zero-2-0) · Visuelle Referenzen: Wikimedia Commons/Wikipedia

Bei Verwendung von Google-Inhalten ist zusätzlich der erforderliche
Google-Hinweis (z. B. *Imagery © Google · Google Maps Platform*)
anzuzeigen. OSM hat eine Share-Alike-Klausel für *abgeleitete
Datenbanken*, gerenderte Kachelbilder sind aber *Produced Works* und
dürfen unter beliebiger Lizenz veröffentlicht werden, solange die
obigen Hinweise sichtbar sind.
Die Wikimedia-Credits pro Datei liegen in
`src/app/public/dzi/regierungsviertel/wikimedia_attribution.json` und
`references/wikimedia/README.md`.

</td>
</tr>

<tr>
<td valign="top">

## Run locally

The committed viewer can run from your hard drive with the generated
open-data artefacts. It does **not** need an AI model at runtime. AI is
only needed later if you want to replace the deterministic local
pixel-art pass with a fine-tuned image model.

```bash
python3 scripts/serve_local_viewer.py
```

Open the printed local URL, usually:

```text
http://127.0.0.1:8766/
```

If port `8766` is already busy, the local server automatically uses
the next free port and prints that URL.

Current default data sources are free/open: Berlin LoD2, Berlin 3D Mesh 2025,
OSM, ALKIS, DOP preview, and DGM preview. Google 3D Tiles remain wired as an
optional opt-in source, but are not required and are not fetched unless
you provide a local `.env` with a Maps API key and the opt-in flags.

Landmark placement is checked in
[`docs/landmark-alignment.md`](docs/landmark-alignment.md) against the
local OSM city-map layer and Berlin LoD2 building geometry. The viewer
starts in a north-up true 3D view. It supports free orbit, zoom, pan and a
physical underside camera with the Tiergartentunnel cutaway. Cardinal presets
and a top-down OSM/LoD2 reference map keep orientation reproducible; the static
Deep Zoom image remains available from the mode switch.

To create a downloadable folder and ZIP for another Mac or PC:

```bash
python3 scripts/package_static_site.py
```

The result is written to
`releases/isometric-berlin-regierungsviertel-local/` and
`releases/isometric-berlin-regierungsviertel-local.zip`. Unzip it on
the target computer and start:

- Mac and Windows zero-server fallback: double-click `START-HERE.html`.
- Full local 3D on macOS: open Terminal and run `python3 serve-local.py` from
  the unzipped folder; it opens the 3D viewer directly.
- Full local 3D on Windows: double-click `start-windows.bat`; it opens the 3D
  viewer directly.
- Linux fallback: `./start-linux.sh`.

There is intentionally no `start-mac.command` anymore: downloaded
`.command` files are unsigned executable scripts, so macOS Gatekeeper can
block them before the viewer starts.

</td>
<td valign="top">

## Lokal starten

Der committed Viewer läuft mit den erzeugten Open-Data-Artefakten
direkt von deiner Festplatte. Dafür brauchst du **kein KI-Modell** zur
Laufzeit. KI wird erst später relevant, wenn der deterministische
lokale Pixel-Art-Schritt durch ein feinabgestimmtes Bildmodell ersetzt
werden soll.

```bash
python3 scripts/serve_local_viewer.py
```

Öffne die ausgegebene lokale URL, normalerweise:

```text
http://127.0.0.1:8766/
```

Falls Port `8766` schon belegt ist, nutzt der lokale Server automatisch
den nächsten freien Port und gibt diese URL aus.

Der aktuelle Standard nutzt nur kostenlose/offene Quellen: Berlin LoD2,
Berlin 3D Mesh 2025, OSM, ALKIS, DOP-Preview und DGM-Preview. Google 3D Tiles bleiben
als optionale Opt-in-Verbindung vorbereitet, werden aber nicht benötigt
und nicht abgerufen, solange keine lokale `.env` mit Maps-API-Key und
Opt-in-Flags vorhanden ist.

Die Lage der Sehenswürdigkeiten wird in
[`docs/landmark-alignment.md`](docs/landmark-alignment.md) gegen den
lokalen OSM-Stadtplan-Layer und die Berliner LoD2-Gebäudegeometrie
geprüft. Der Viewer startet mit geographisch Norden oben in echtem 3D. Freies
Drehen, Zoomen, Verschieben und die physische Untersicht mit
Tiergartentunnel-Cutaway sind direkt verfügbar. Kardinal-Presets und die
Top-down-Referenzkarte aus OSM/LoD2 machen den Stadtplan-Abgleich
reproduzierbar; die statische Deep-Zoom-Ansicht bleibt als Modus erhalten.

Ein herunterladbares Paket für einen anderen Mac oder PC erzeugst du so:

```bash
python3 scripts/package_static_site.py
```

Das Ergebnis liegt unter
`releases/isometric-berlin-regierungsviertel-local/` und
`releases/isometric-berlin-regierungsviertel-local.zip`. Auf dem
Zielrechner entpacken und starten:

- Mac und Windows ohne Server: Doppelklick auf `START-HERE.html` öffnet die
  robuste 2D-Fallbackansicht.
- Volles lokales 3D auf macOS: Terminal öffnen und im entpackten Ordner
  `python3 serve-local.py` ausführen; der 3D-Viewer öffnet sich direkt.
- Volles lokales 3D auf Windows: `start-windows.bat` doppelklicken; der
  3D-Viewer öffnet sich direkt.
- Linux-Fallback: `./start-linux.sh`.

Ein `start-mac.command` wird absichtlich nicht mehr ausgeliefert:
heruntergeladene `.command`-Dateien sind unsignierte ausführbare Skripte
und werden von macOS Gatekeeper oft blockiert, bevor der Viewer starten
kann.

</td>
</tr>

<tr>
<td valign="top">

## Pipeline (implemented)

1. **Bounds** — define the Regierungsviertel polygon
   (`geo_data/regierungsviertel/bounds.geojson`).
2. **Geometry** — clip official LoD2 and Berlin 3D Mesh 2025 evidence to
   bounds; emit metric, progressively loaded WebGL surfaces.
3. **OSM context** — extract streets, water, parks, rail (Hauptbahnhof
   tracks), POIs for the same bounds.
4. **Official detail** — clip Berlin tree, public-lighting and Wall-route WFS
   layers and additively fuse them with OSM.
5. **Quadrant grid** — define isometric quadrants
   (target 512×512 px tile quadrants, same as NYC) over the area.
6. **Render** — orthographic/isometric 3D render of each quadrant
   → "whitebox" / textured render PNG.
7. **AI tile generation** — optionally feed each render into a fine-tuned
   `Qwen/Image-Edit` model to produce the pixel-art tile.
8. **DZI export** — assemble tiles into a Deep Zoom pyramid
   (libvips / pyvips).
9. **Viewer** — React + Three.js/OpenSeadragon app for true 3D and the 2D
   compatibility view.

The NYC repo's `src/isometric_nyc/` layout is mirrored as
`src/isometric_berlin/`.

</td>
<td valign="top">

## Pipeline (umgesetzt)

1. **Bounds** — Polygon des Regierungsviertels definieren
   (`geo_data/regierungsviertel/bounds.geojson`).
2. **Geometrie** — amtliche LoD2- und Berlin-3D-Mesh-2025-Evidenz auf das
   Polygon clippen und metrische, progressiv geladene WebGL-Flächen erzeugen.
3. **OSM-Kontext** — Straßen, Wasser, Parks, Schienen (Hauptbahnhof),
   POIs für denselben Bereich extrahieren.
4. **Amtliche Details** — Berliner Baum-, Beleuchtungs- und
   Mauerverlaufs-WFS clippen und additiv mit OSM fusionieren.
5. **Quadrantenraster** — isometrische Quadranten (Ziel 512×512 px,
   wie bei NYC) über das Gebiet legen.
6. **Render** — orthographisch/isometrisches 3D-Rendering je Quadrant
   → „Whitebox"- bzw. texturiertes Render-PNG.
7. **KI-Kachelgenerierung** — optional jedes Render in ein feingetuntes
   `Qwen/Image-Edit`-Modell speisen, das die Pixel-Art-Kachel erzeugt.
8. **DZI-Export** — Kacheln zu einer Deep-Zoom-Pyramide zusammenbauen
   (libvips / pyvips).
9. **Viewer** — React + Three.js/OpenSeadragon für echtes 3D und die
   2D-Kompatibilitätsansicht.

Das Layout `src/isometric_nyc/` aus dem NYC-Repo wird hier als
`src/isometric_berlin/` gespiegelt.

</td>
</tr>

<tr>
<td valign="top">

## Project Structure

```
isometric-berlin/
├── docs/                    # Setup, data, generation, deployment docs
├── geo_data/
│   └── regierungsviertel/   # LoD2 + OSM data for the MVP area
├── generations/             # SQLite DBs of rendered/generated tiles
├── references/              # Style reference images
├── src/
│   ├── app/                 # React + OpenSeadragon viewer
│   └── isometric_berlin/    # Python pipeline
├── inference/               # Modal serving for fine-tuned model
├── pyproject.toml
├── LICENSE                  # MIT
└── README.md
```

## Quickstart

The local open-data viewer is ready to run. It does not need an AI
model or a Google key at runtime.

```bash
# Python env
uv sync

# Local viewer
python3 scripts/serve_local_viewer.py

# Downloadable Mac/Windows/Linux package
cd src/app && bun install && bun run build
cd ../..
python3 scripts/package_static_site.py
```

</td>
<td valign="top">

## Projektstruktur

```
isometric-berlin/
├── docs/                    # Setup, Daten, Generierung, Deployment
├── geo_data/
│   └── regierungsviertel/   # LoD2- und OSM-Daten des MVP-Gebiets
├── generations/             # SQLite-DBs der gerenderten/generierten Tiles
├── references/              # Stilreferenzbilder
├── src/
│   ├── app/                 # React + OpenSeadragon Viewer
│   └── isometric_berlin/    # Python-Pipeline
├── inference/               # Modal-Serving des feingetunten Modells
├── pyproject.toml
├── LICENSE                  # MIT
└── README.md
```

## Schnellstart

Der lokale Open-Data-Viewer ist startklar. Zur Laufzeit brauchst du
kein KI-Modell und keinen Google-Key.

```bash
# Python-Umgebung
uv sync

# Lokaler Viewer
python3 scripts/serve_local_viewer.py

# Download-Paket für Mac/Windows/Linux
cd src/app && bun install && bun run build
cd ../..
python3 scripts/package_static_site.py
```

</td>
</tr>

<tr>
<td valign="top">

## License & Attribution

- **Code:** [MIT License](LICENSE), © 2026 Klotzkette.
- **Inspired by and structurally derived from**
  [cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc)
  (MIT, © 2025 Andy Coenen). Where files retain meaningful portions of
  the original NYC code, the upstream copyright notice is preserved.
- **Geo data:** see *Data Sources & Licensing* above.
- **Generated tiles:** released as Produced Works; downstream license
  TBD per release.

</td>
<td valign="top">

## Lizenz & Namensnennung

- **Code:** [MIT-Lizenz](LICENSE), © 2026 Klotzkette.
- **Inspiriert von und strukturell abgeleitet aus**
  [cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc)
  (MIT, © 2025 Andy Coenen). Wo Dateien wesentliche Anteile des
  ursprünglichen NYC-Codes enthalten, bleibt der ursprüngliche
  Urheberrechtsvermerk erhalten.
- **Geodaten:** siehe *Datenquellen & Lizenzen* oben.
- **Generierte Kacheln:** als Produced Works veröffentlicht;
  nachgelagerte Lizenz wird pro Release festgelegt.

</td>
</tr>

</table>

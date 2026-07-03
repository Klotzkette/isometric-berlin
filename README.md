# Isometric Berlin – Regierungsviertel

> **Direktdownload / Local ZIP:** https://github.com/Klotzkette/isometric-berlin/releases/download/v0.1.35/isometric-berlin-regierungsviertel-local.zip

> **Status:** Local v0.1.35 open-data viewer. `START-HERE.html` is the real click-to-start viewer for Mac and Windows: no Terminal, no `.command`, no Python. It starts with the sharper detail render, has large visible zoom/rotate/swivel buttons, a Pixel-Art toggle, mouse gestures, reproducible Top/North/East/South/West view presets, and an on-map compass/status line. The optional local-server fallback opens `START-HERE.html` directly, flushes the printed URL immediately, and preflights required package files before serving. Release readiness now validates the downloadable ZIP itself, including required DZI tiles, launcher controls, server fallback, and forbidden macOS/duplicate artefacts. Google/Apple map products are used only for visual QA, not copied into committed data.

> **Public repo / Öffentliches Repository:** https://github.com/Klotzkette/isometric-berlin  
> **Download / Lokales Paket:** https://github.com/Klotzkette/isometric-berlin/releases/latest

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

The end goal is a giant, zoomable, SimCity-style isometric pixel-art map
of Berlin. The current v0.1 local viewer already runs from generated
open-data map tiles; the AI style pass is a later pipeline step, not a
runtime requirement.

This repository is an independent, derivative project inspired by
Andy Coenen's [isometric.nyc](https://isometric.nyc). The approach,
pipeline structure, and several scaffolding files follow Coenen's
[open-source NYC codebase](https://github.com/cannoneyed/isometric-nyc)
(MIT-licensed). All city data, model fine-tunes, and rendered tiles
for Berlin are produced from scratch.

</td>
<td valign="top">

## Die Idee

Das Ziel ist eine riesige, zoombare, isometrische Pixel-Art-Karte von
Berlin im Stil von SimCity. Der aktuelle lokale v0.1-Viewer läuft
bereits mit erzeugten Open-Data-Kacheln; der KI-Stilschritt ist ein
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

The first milestone covers only the
**Government Quarter of Berlin** — a tight area around the heart of
the federal government. Nothing else is in scope for v0.1.

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

Der erste Meilenstein deckt ausschließlich das **Regierungsviertel
Berlin** ab – ein enger Bereich rund um das Herz der Bundesregierung.
Mehr ist in v0.1 nicht vorgesehen.

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
| Fassaden-/Material-Referenzen für Landmarken | [Wikimedia Commons / Wikipedia](https://commons.wikimedia.org) | Je Datei: CC0, Public Domain, CC BY, CC BY-SA; siehe `geo_data/regierungsviertel/wikimedia_references.json` |
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

Current default data sources are free/open: Berlin LoD2, OSM, ALKIS,
DOP preview, and DGM preview. Google 3D Tiles remain wired as an
optional opt-in source, but are not required and are not fetched unless
you provide a local `.env` with a Maps API key and the opt-in flags.

Landmark placement is checked in
[`docs/landmark-alignment.md`](docs/landmark-alignment.md) against the
local OSM city-map layer and Berlin LoD2 building geometry. The viewer
starts in a north-up view and labels the key landmarks directly on the
map. It includes buttons for north/east/south/west-up views, 90°
rotation, horizontal mirroring, a vertical 2D flip, and a top-down
OSM/LoD2 reference map for standard city-map checks. A true physical
underside view would require a future multi-camera/3D-renderer export;
the current download is a static Deep Zoom image viewer.

To create a downloadable folder and ZIP for another Mac or PC:

```bash
python3 scripts/package_static_site.py
```

The result is written to
`releases/isometric-berlin-regierungsviertel-local/` and
`releases/isometric-berlin-regierungsviertel-local.zip`. Unzip it on
the target computer and start:

- Mac and Windows, first choice: double-click `START-HERE.html`.
- macOS fallback if your browser blocks local tiles: open Terminal and
  run `python3 serve-local.py` from the unzipped folder.
- Windows fallback: double-click `start-windows.bat`.
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

Der aktuelle Standard nutzt nur kostenlose/offene Quellen: Berlin
LoD2, OSM, ALKIS, DOP-Preview und DGM-Preview. Google 3D Tiles bleiben
als optionale Opt-in-Verbindung vorbereitet, werden aber nicht benötigt
und nicht abgerufen, solange keine lokale `.env` mit Maps-API-Key und
Opt-in-Flags vorhanden ist.

Die Landmarken-Lage wird in
[`docs/landmark-alignment.md`](docs/landmark-alignment.md) gegen den
lokalen OSM-Stadtplan-Layer und die Berliner LoD2-Gebäudegeometrie
geprüft. Der Viewer startet mit geographisch Norden oben und beschriftet
die wichtigsten Landmarken direkt in der Karte. Er enthält Knöpfe für
Nord/Ost/Süd/West-Ansichten, 90°-Drehung, horizontales Spiegeln, ein
vertikales 2D-Klappen und eine Top-down-Referenzkarte aus OSM/LoD2 für
den Standard-Stadtplan-Abgleich. Eine echte physische Ansicht von unten
braucht später einen Multi-Kamera-/3D-Renderer-Export; der aktuelle
Download ist ein statischer Deep-Zoom-Bildviewer.

Ein herunterladbares Paket für einen anderen Mac oder PC erzeugst du so:

```bash
python3 scripts/package_static_site.py
```

Das Ergebnis liegt unter
`releases/isometric-berlin-regierungsviertel-local/` und
`releases/isometric-berlin-regierungsviertel-local.zip`. Auf dem
Zielrechner entpacken und starten:

- Mac und Windows, erster Weg: Doppelklick auf `START-HERE.html`.
- macOS-Fallback, falls dein Browser lokale Kacheln blockiert:
  Terminal öffnen und im entpackten Ordner `python3 serve-local.py`
  ausführen.
- Windows-Fallback: Doppelklick auf `start-windows.bat`.
- Linux-Fallback: `./start-linux.sh`.

Ein `start-mac.command` wird absichtlich nicht mehr ausgeliefert:
heruntergeladene `.command`-Dateien sind unsignierte ausführbare Skripte
und werden von macOS Gatekeeper oft blockiert, bevor der Viewer starten
kann.

</td>
</tr>

<tr>
<td valign="top">

## Pipeline (planned)

1. **Bounds** — define the Regierungsviertel polygon
   (`geo_data/regierungsviertel/bounds.geojson`).
2. **Geometry** — download LoD2 CityGML for the area, clip to bounds,
   convert to a simple per-tile mesh.
3. **OSM context** — extract streets, water, parks, rail (Hauptbahnhof
   tracks), POIs for the same bounds.
4. **Quadrant grid** — define isometric quadrants
   (target 512×512 px tile quadrants, same as NYC) over the area.
5. **Render** — orthographic/isometric 3D render of each quadrant
   → "whitebox" / textured render PNG.
6. **AI tile generation** — feed each render into a fine-tuned
   `Qwen/Image-Edit` model to produce the pixel-art tile.
7. **DZI export** — assemble tiles into a Deep Zoom pyramid
   (libvips / pyvips).
8. **Viewer** — React + OpenSeadragon web app to pan/zoom.

The NYC repo's `src/isometric_nyc/` layout is mirrored as
`src/isometric_berlin/`.

</td>
<td valign="top">

## Pipeline (geplant)

1. **Bounds** — Polygon des Regierungsviertels definieren
   (`geo_data/regierungsviertel/bounds.geojson`).
2. **Geometrie** — LoD2-CityGML für das Gebiet herunterladen, auf das
   Polygon clippen, in ein einfaches Mesh pro Kachel umwandeln.
3. **OSM-Kontext** — Straßen, Wasser, Parks, Schienen (Hauptbahnhof),
   POIs für denselben Bereich extrahieren.
4. **Quadrantenraster** — isometrische Quadranten (Ziel 512×512 px,
   wie bei NYC) über das Gebiet legen.
5. **Render** — orthographisch/isometrisches 3D-Rendering je Quadrant
   → „Whitebox"- bzw. texturiertes Render-PNG.
6. **KI-Kachelgenerierung** — jedes Render in ein feingetuntes
   `Qwen/Image-Edit`-Modell speisen, das die Pixel-Art-Kachel erzeugt.
7. **DZI-Export** — Kacheln zu einer Deep-Zoom-Pyramide zusammenbauen
   (libvips / pyvips).
8. **Viewer** — React + OpenSeadragon Web-App zum Pan/Zoom.

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

# Isometric Berlin – Regierungsviertel

> **Status:** Private scaffold / Privates Gerüst — work in progress.
>
> Inspired by [isometric.nyc](https://isometric.nyc) by [Andy Coenen](https://cannoneyed.com/projects/isometric-nyc) ([cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc), MIT).
> Inspiriert von [isometric.nyc](https://isometric.nyc) von [Andy Coenen](https://cannoneyed.com/projects/isometric-nyc) ([cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc), MIT).

---

<table>
<tr>
<th width="50%">🇬🇧 English</th>
<th width="50%">🇩🇪 Deutsch</th>
</tr>

<tr>
<td valign="top">

## The Idea

A giant, zoomable, SimCity-style isometric pixel-art map of Berlin —
generated tile-by-tile with AI from open city data.

This repository is an independent, derivative project inspired by
Andy Coenen's [isometric.nyc](https://isometric.nyc). The approach,
pipeline structure, and several scaffolding files follow Coenen's
[open-source NYC codebase](https://github.com/cannoneyed/isometric-nyc)
(MIT-licensed). All city data, model fine-tunes, and rendered tiles
for Berlin are produced from scratch.

</td>
<td valign="top">

## Die Idee

Eine riesige, zoombare, isometrische Pixel-Art-Karte von Berlin im Stil
von SimCity – Kachel für Kachel mit KI aus offenen Stadtdaten erzeugt.

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

Unlike the NYC project, this Berlin project deliberately avoids the
Google Maps 3D Tiles API. We use only open data:

| Dataset | Source | License |
|---|---|---|
| 3D building geometry (LoD2) | [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) (effectively public domain) |
| Streets, parks, water, POIs | [OpenStreetMap](https://www.openstreetmap.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Orthophotos / DOP (optional) | Geoportal Berlin | dl-de/zero-2-0 |

**Required attribution in the viewer:**

> © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)

OSM is share-alike for *derivative databases*, but rendered tile
images are *Produced Works* and may be released under any license,
as long as the attribution above is shown.

</td>
<td valign="top">

## Datenquellen & Lizenzen

Anders als das NYC-Projekt verzichtet diese Berliner Variante bewusst
auf die Google Maps 3D Tiles API. Wir nutzen ausschließlich offene
Daten:

| Datensatz | Quelle | Lizenz |
|---|---|---|
| 3D-Gebäudegeometrie (LoD2) | [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) (faktisch gemeinfrei) |
| Straßen, Parks, Wasser, POIs | [OpenStreetMap](https://www.openstreetmap.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Orthophotos / DOP (optional) | Geoportal Berlin | dl-de/zero-2-0 |

**Pflicht-Attributionshinweis im Viewer:**

> © OpenStreetMap-Mitwirkende · 3D-Gebäudemodelle: Geoportal Berlin (dl-de/zero-2-0)

OSM hat eine Share-Alike-Klausel für *abgeleitete Datenbanken*,
gerenderte Kachelbilder sind aber *Produced Works* und dürfen unter
beliebiger Lizenz veröffentlicht werden, solange der obige Hinweis
sichtbar ist.

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

This is a scaffold — most steps are still TODO. See
[`docs/setup.md`](docs/setup.md) for the planned flow.

```bash
# Python env
uv sync

# Bounds editor (TODO)
uv run python -m isometric_berlin.generation.create_bounds

# Web viewer (TODO)
cd src/app && bun install && bun run dev
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

Das hier ist ein Gerüst – die meisten Schritte sind noch TODO.
Siehe [`docs/setup.md`](docs/setup.md) für den geplanten Ablauf.

```bash
# Python-Umgebung
uv sync

# Bounds-Editor (TODO)
uv run python -m isometric_berlin.generation.create_bounds

# Web-Viewer (TODO)
cd src/app && bun install && bun run dev
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

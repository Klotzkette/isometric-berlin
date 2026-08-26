# Data — Additive Source Fusion

This project uses **additive data fusion**, per owner policy. Every
permitted source contributes; the best evidence from each source is
kept per feature / per tile. No source is treated as a replacement
for another. If sources disagree, the conflict is recorded; it is
**not** silently resolved by dropping a source.

## Permitted sources

| ID | Source | Role | License |
|---|---|---|---|
| `lod2` | Berlin LoD2 buildings ([Geoportal Berlin](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin)) | **Authoritative building geometry anchor** | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) |
| `osm` | OpenStreetMap (Overpass / OSMnx) | Streets, water, parks, rail, POIs, semantic context | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| `alkis` | ALKIS parcels (Geoportal Berlin) | Official alignment, parcel context | dl-de/zero-2-0 |
| `dop` | DOP digital orthophotos (Geoportal Berlin) | Orthophoto QA, texture reference | dl-de/zero-2-0 |
| `dgm` | DGM digital terrain model (Geoportal Berlin) | Terrain where useful (Spree bank, station forecourt) | dl-de/zero-2-0 |
| `berlinmesh` | [Berlin 3D Mesh Model 2025](https://www.businesslocationcenter.de/berlin3d-downloadportal/) | Optional archival surface QA; not packaged or rendered by the current viewer | Berlin 3D Downloadportal terms apply whenever fetched locally |
| `berlindetails` | [Berlin tree catalogues](https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23), public lighting and [1989 Wall route](https://daten.berlin.de/datensaetze/verlauf-der-berliner-mauer-1989-wfs-3dcda64c) | Individual tree positions/dimensions, lamp positions/types and the Vorderlandmauer trace | dl-de/zero-2-0 |
| `google3d` | Google Maps Platform Photorealistic 3D Tiles | **Opt-in.** Photorealistic geometry, texture, alignment, visual reference | Google Maps Platform Terms |
| `wikimedia` | Wikimedia Commons / Wikipedia media | Freely licensed landmark facade, roof, glass, stone, vegetation and colour references for visual QA / material cues | Per file: CC0, public domain, CC BY, CC BY-SA, etc.; see manifest |

## Google opt-in flags

Google content is fetched **only** when all three env vars are set:

```
GOOGLE_MAPS_API_KEY=<your-key>
GOOGLE_MAPS_3D_TILES_ENABLED=true
GOOGLE_MAPS_TERMS_ACCEPTED=true
```

If any of these is missing, the Google fetcher exits cleanly with a
no-op and the fusion step records `google3d` as `unavailable` in the
manifest (it does not fail the pipeline).

Strict hygiene rules:

- API keys never enter committed files. Manifest URLs are written
  with `?key={GOOGLE_MAPS_API_KEY}` placeholder syntax, **not** real
  keys.
- Raw Google responses, tile caches, screenshots, and any derived
  meshes/textures live under
  `geo_data/regierungsviertel/raw/google_3d_tiles/` (gitignored) and
  are **not** committed.
- Any artefact that uses or derives from Google content must show the
  appropriate Google attribution per their terms, in addition to the
  OSM/Geoportal Berlin attribution.

## Berlin 3D Mesh terms and derived assets

The official Berlin mesh requires explicit acceptance of the portal terms,
but no API key or payment. Run either with
`BERLIN_3D_MESH_TERMS_ACCEPTED=true` or the explicit `--accept-terms` CLI
flag. Raw OBJ/MTL/JPEG ZIP archives stay under
`geo_data/regierungsviertel/raw/berlin_3d_mesh_2025/` and are gitignored.

The current release commits no derived Berlin-mesh GLB, photograph or texture.
The former 74-file interaction/detail/hero family was removed because no normal
mode displayed it and its transfer, decoding and GPU residency duplicated the
LoD2/procedural world. The fetch/conversion utilities remain available for
optional local archival QA, but their raw and derived outputs stay outside the
release package. LoD2 remains the metric building anchor.

## Wikimedia visual-reference rules

Wikimedia Commons / Wikipedia media is additive only. It is used to
improve visual reference quality for landmark materials and facade QA;
it does not replace LoD2 geometry, OSM semantics, ALKIS/DOP/DGM
official support data, or the Google opt-in source.

Strict hygiene rules:

- Fetch only files with explicit free-license metadata (`CC0`, public
  domain, `CC BY`, `CC BY-SA`). Do not import unclear, all-rights-
  reserved, non-commercial (`NC`), or no-derivatives (`ND`) media.
- Keep per-file title, URL, author/artist, credit, license, and
  license URL in `geo_data/regierungsviertel/wikimedia_references.json`.
- Commit only small thumbnails / atlas files under
  `references/wikimedia/`; do not commit arbitrary web-photo dumps.
- Any public artefact that directly uses or derives textures from
  Wikimedia references must preserve the relevant per-file attribution
  and share-alike obligations where applicable.

## Fused source-stack manifest

The fusion step (pipeline step 6, see `tasks/05-source-fusion-manifest.md`)
writes `geo_data/regierungsviertel/fused_sources.json` with this shape:

```jsonc
{
  "bounds_ref": "geo_data/regierungsviertel/bounds.geojson",
  "generated_at": "2026-06-14T20:49:00Z",
  "sources": {
    "lod2":    { "available": true,  "path": "geo_data/regierungsviertel/buildings.gpkg", "license": "dl-de/zero-2-0" },
    "osm":     { "available": true,  "path": "geo_data/regierungsviertel/osm.gpkg",       "license": "ODbL-1.0" },
    "alkis":   { "available": false, "reason": "not_downloaded" },
    "dop":     { "available": false, "reason": "not_downloaded" },
    "dgm":     { "available": false, "reason": "not_downloaded" },
    "berlinmesh": { "available": true, "path": "geo_data/regierungsviertel/berlin_3d_mesh_sources.json", "license": "Berlin 3D Downloadportal terms; provider attribution required" },
    "berlindetails": { "available": true, "path": "geo_data/regierungsviertel/official_details.gpkg", "license": "dl-de/zero-2-0" },
    "google3d":{ "available": false, "reason": "opt_in_env_missing" },
    "wikimedia": { "available": true, "path": "geo_data/regierungsviertel/wikimedia_references.json", "license": "Various Wikimedia Commons free licenses; see manifest per image" }
  },
  "features": [
    {
      "feature_id": "bld-12345",
      "kind": "building",
      "anchor_source": "lod2",
      "geometry_evidence": [
        { "source": "lod2",    "confidence": 1.0, "ref": "buildings.gpkg#fid=12345" },
        { "source": "google3d","confidence": 0.7, "ref": "raw/google_3d_tiles/tile_42_17.glb" }
      ],
      "semantic_evidence": [
        { "source": "osm", "tags": { "name": "Reichstagsgebäude", "amenity": "parliament" } }
      ],
      "conflicts": []
    }
  ],
  "conflict_log": []
}
```

## Per-feature evidence ranking

When multiple sources provide evidence for the same feature attribute,
use this default ranking unless the feature is explicitly marked as
hero/manual:

| Attribute | Primary | Secondary | Tertiary |
|---|---|---|---|
| Building footprint | `lod2` | `alkis` | `google3d` |
| Building height / roof | `lod2` | `berlinmesh` | `google3d`, `osm` (`building:levels`) |
| Building name / function | `osm` | `alkis` | — |
| Streets, paths, rails | `osm` | `alkis` | — |
| Water (Spree) | `osm` | `alkis` | `dop` |
| Parks (Tiergarten) | `osm` | `dop` | — |
| Individual trees | `berlindetails` | `osm` | `berlinmesh` (surface appearance) |
| Public lighting | `berlindetails` | `osm` | — |
| Berlin Wall ground trace | `berlindetails` | `osm` | `dop` |
| Terrain | `dgm` | `berlinmesh` | `lod2` (ground vertices) |
| Texture / colour reference | `berlinmesh` | `dop` | `wikimedia`, `google3d` |

Rationale: official Berlin data is the anchor for geometry; OSM is the
anchor for semantics; Google is additive — it earns weight where it
provides higher fidelity (e.g. recent textures, complex glass roofs)
but never overrides Berlin LoD2 for footprint or official ALKIS
boundaries.

## Conflict handling

If two sources disagree on a value that matters (e.g. building height
differs by > 2 m between `lod2` and `google3d`), the fusion step:

1. Writes both values into `geometry_evidence` / `semantic_evidence`.
2. Adds an entry to `conflict_log` with `feature_id`, `attribute`,
   `values` per source, and the chosen winner.
3. **Does not delete** the losing value. It remains available for
   downstream QA or for the bounds editor / hero tile workflow.

## Raw download locations (all gitignored)

```
geo_data/regierungsviertel/raw/
├── lod2/              # Berlin LoD2 CityGML downloads
├── osm/               # Overpass query cache
├── alkis/             # ALKIS exports
├── dop/               # DOP orthophoto tiles
├── dgm/               # DGM terrain grids
├── berlin_3d_mesh_2025/ # Official OBJ/texture ZIPs after terms acceptance
├── official_details/  # Official bounded tree/light/Wall WFS responses
└── google_3d_tiles/   # Google manifest + (opt-in) downloaded tile content
```

Small Wikimedia thumbnails and the QA atlas are committed under:

```
references/wikimedia/
```

## CLI summary

```bash
# 2: LoD2
uv run python -m isometric_berlin.data.fetch_lod2 \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/buildings.gpkg

# 3: OSM
uv run python -m isometric_berlin.data.fetch_osm \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --pbf geo_data/regierungsviertel/raw/osm/berlin-latest.osm.pbf \
  --out geo_data/regierungsviertel/osm.gpkg

# 3b: OSM building sidecar only where official LoD2 has no footprint
uv run python -m isometric_berlin.data.fetch_osm_context_buildings \
  --pbf geo_data/regierungsviertel/raw/osm/berlin-latest.osm.pbf \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --official-buildings geo_data/regierungsviertel/buildings.gpkg \
  --out geo_data/regierungsviertel/osm_context_buildings.gpkg

# 4: ALKIS / DOP / DGM (optional)
uv run python -m isometric_berlin.data.fetch_official_support \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --layers alkis,dop,dgm \
  --out-dir geo_data/regierungsviertel/raw/

# 5: Google Photorealistic 3D Tiles (opt-in)
uv run python -m isometric_berlin.data.fetch_google_tiles \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json
# add --download-content only when explicitly approved for the run

# 4a: official Berlin 3D Mesh 2025 (free; portal terms required)
uv run python -m isometric_berlin.data.fetch_berlin_mesh \
  --accept-terms --download-content
uv run python -m isometric_berlin.generation.prepare_webgl_mesh

# 4b: official trees, public lighting and 1989 Wall trace
uv run python -m isometric_berlin.data.fetch_official_details \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/official_details.gpkg

# The canonical file omits optional RTree indexes: its bounded layers are
# scanned once by the payload build, and all source rows remain present.

# Wikimedia visual references (additive, free-license filtered)
uv run python -m isometric_berlin.data.fetch_wikimedia \
  --out geo_data/regierungsviertel/wikimedia_references.json \
  --references-dir references/wikimedia

# 6: Source-fusion manifest
uv run python -m isometric_berlin.data.fuse_sources \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/fused_sources.json
```

## Current OSM extract and Overpass fallback

The committed task-13 refresh reads the local 2026-08-17 Geofabrik Berlin PBF and clips
it to `geo_data/regierungsviertel/bounds.geojson` in EPSG:25833. The same
command can still use OSMnx/Overpass when `--pbf` is omitted. Its effective tag
filter is:

```python
{
  "highway": True,
  "waterway": True,
  "water": True,
  "natural": ["water", "wood", "scrub", "grassland", "tree", "tree_row"],
  "leisure": ["park", "garden", "playground"],
  "playground": True,
  "landuse": ["grass", "forest", "meadow", "recreation_ground"],
  "railway": True,
  "amenity": True,
  "tourism": True,
  "historic": True,
  "memorial": True,
  "memorial:type": True,
  "office": ["diplomatic", "government"],
  "diplomatic": True,
  "government": True,
  "bridge": True,
  "tunnel": True,
  "covered": True,
  "layer": True,
  "service": True,
  "usage": True,
}
```

The Overpass fallback fetches the task-13 polygon in roughly kilometre-wide
tiles, clips them back to the polygon and deduplicates by element/id. The local
PBF path avoids transient Overpass failures and is the reproducible source used
for the current commit.

The normalized raw feature response is cached at
`geo_data/regierungsviertel/raw/osm_overpass.json` (gitignored), and
OSMnx's request cache lives under
`geo_data/regierungsviertel/raw/osmnx_cache/`.

The clipped GeoPackage exposes 41,886 roads, 257 water features, 4,222 parks,
27,312 vegetation features, 865 playground features, 1,906 rail features and
10,644 relevant POIs. It retains equipment type, surface, material, height,
leaf and accessibility attributes. The public viewer does not ship the raw
response: `build_park_details` simplifies this evidence into the compact
`park-details.json` display payload.

The fetch contract also retains `informal=yes` on road/path rows. This is
source evidence for mapped desire paths only; it never authorizes the renderer
to infer an unrecorded shortcut through the park.

The close-view material split follows the documented OSM `surface` semantics
([OSM surface key](https://wiki.openstreetmap.org/wiki/Key:surface),
[fine gravel](https://wiki.openstreetmap.org/wiki/Tag:surface%3Dfine_gravel)).
Berlin's Straßen- und Grünflächenamt describes water-bound path surfaces as
the normal treatment where use permits in large parks including the Großer
Tiergarten, while higher bicycle loads or gradients can require asphalt
([Berlin.de path-surface note](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/planung-entwurf-neubau/artikel.688979.php)).
The Senate's Bremer-Weg bridge record independently documents the local park
walk as an approximately 4.60 m-wide water-bound surface
([Berlin.de bridge record](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/brueckenbau/holzbruecke-bremer-weg-west/)).
These references inform presentation only; per-way OSM geometry, `surface` and
width tags remain the feature-level evidence.

The building sidecar contains 12,856 non-overlapping OSM footprints (12,443 ways
and 413 relations). LoD2 always wins where present. Of the sidecar heights, 261
are explicit, 9,086 come from mapped storeys and 3,509 are marked display
fallbacks; floating `min_height` volumes are excluded. The shared building
loader feeds the overview, drawn prisms and Minecraft without modifying the
canonical official `buildings.gpkg`.

Walking/cycling infrastructure is audited separately from motor traffic.
`surface-polygons.json` schema 10 contains 20,782 bounded above-ground line
parts across `footway`, `cycleway`, `path`, `pedestrian`, `steps` and `track`;
18,848 parts have an explicit OSM `surface` and 2,574 have `width` or
`est_width`. Explicit surface tags resolve to six drawn families (asphalt,
paving, sand/gravel, earth, wood and metal) before any park/class fallback is
considered. The payload's `path_inventory` preserves the source and resolution
counts so missing width evidence is documented rather than presented as a
surveyed kerb line.

Schema 10 keeps the 0.1 m water/road tolerance and separates four water roles:
Spree/canal/harbour polygons (`river`), natural still water (`pond`), built
fountains and reflecting pools (`basin`), and OSM-mapped Tiergarten streams or
ditches (`stream`). Linear streams are clipped to the OSM Großer-Tiergarten
polygon and buffered from mapped width; where width is absent, the payload
records a conservative 1.4 m stream or 0.8 m ditch display width. Existing
water polygons are subtracted so connecting lines cannot double or widen a
pond. The renderer keeps every mapped shoreline and island ring, derives a
robust local level from the official terrain-support samples, and labels its
0.35-1.55 m visible pond depth as unsurveyed presentation geometry.

Schema 10 also samples
road curves at 1.5 m and uses 16 round-buffer segments per quadrant. The viewer
inserts additional 2–2.5 m display points only between the retained exported
vertices. Natural bends can therefore flow continuously while engineered
basin/quay corners remain sharp; the display interpolation does not move a
retained centreline or shoreline vertex and stays inside the mapped extent.

`park-details.json` schema 7 repeats only compact material codes and resolved
centimetre widths for the 3,467 raised close-view ribbons. It preserves every
vertex of the committed 0.35 m OSM geometry and batches by nine close-view
materials: asphalt, paving, setts/cobble, fine gravel, compacted aggregate,
sand, earth, wood and metal. It omits null path names. The same payload
preserves 83 exact OSM Tiergarten scrub polygons with 3,535 deterministic
foliage clusters and 23
mapped hedge objects; the earlier coarse all-area scrub samples are omitted
only inside exact park relation `7643526`. This preserves both the source
distinction and the measured 6 MiB public-payload ceiling without double
drawing the Tiergarten understorey.

Floraplatz's animal inventory combines OSM monument positions with Berlin's
restoration record: two deer, two bison, two elk, one bear and one bull. A
generic Bison node coincident with the more specific `Liegender Bison II` is
treated as one duplicate plinth; no other monument is discarded. Hotel AMANO
Grand Central uses OSM way `237687062` for plan/axis and LoD2 part
`DEBE3DLXM9FjJbtp` for the 27.819 m shell. FUNBOX uses visitBerlin only for
the temporary event's official corner, dates, scale and programme; its local
playfield is a fitted display envelope. The former Moabit prison park uses OSM
way `498278335` for its current envelope, exact mapped walls and Panoptikum for
plan geometry, the retained LoD2 cell for its measured cell shell, and official
Berlin pages for historical and present-day interpretation facts. These
recognition details remain additive and do not override their source geometry.

## FUNBOX and Moabit prison-park evidence contracts

The 2026 FUNBOX event contract separates the published event from its display
fit:

- [visitBerlin's event listing](https://www.visitberlin.de/de/event/funbox)
  publishes the Wunderland-Festplatz at Heidestraße / Minna-Cauer-Straße,
  23 July–20 September 2026 dates, more than 4,000 m², ten connected areas and
  the five-metre slide. It does not provide a surveyed event polygon.
- The viewer therefore treats the local outline and object placement as a
  procedural composition. Its complete drawn and Minecraft envelopes are
  tested against the same delivered OSM-derived Heidestraße,
  Minna-Cauer-Straße and Döberitzer Straße surface polygons used by the viewer.
  The frozen minimum clearance is 2.553 m. This is a payload-to-payload
  contract, not a claim about a surveyed kerb or parcel boundary.
- No event photograph, page image or external texture is bundled, traced or
  projected into the model.

The Geschichtspark Ehemaliges Zellengefängnis Moabit keeps four source roles
separate:

- OSM park way [`498278335`](https://www.openstreetmap.org/way/498278335)
  fixes the current 22-point envelope. Wall ways
  [`53178124`](https://www.openstreetmap.org/way/53178124),
  [`105495351`](https://www.openstreetmap.org/way/105495351),
  [`498279237`](https://www.openstreetmap.org/way/498279237) and
  [`498279239`](https://www.openstreetmap.org/way/498279239) provide 19 exact
  wall plan segments. Exact Panoptikum way
  [`195086492`](https://www.openstreetmap.org/way/195086492), Klopfzeichen node
  [`2310445137`](https://www.openstreetmap.org/node/2310445137) and information
  node [`5772396362`](https://www.openstreetmap.org/node/5772396362) remain
  distinct current-park anchors.
- OSM way `105495351` explicitly records `wall=brick` and `height=4`, so its
  four polyline segments render at 4 m. The official
  [Berlin park account](https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html)
  describes the surviving red-brick walls generally as 5 m high; the remaining
  15 mapped segments use 5 m only as a presentation value. The conflict is
  preserved instead of falsely relabelling every segment as measured.
- Berlin LoD2 object `DEBE01AL2yz00000` / viewer prism `2yz00000` remains the
  present walk-in cell geometry and the existing source voxel remains its
  Minecraft base. The procedural layer does not add a competing cell shell,
  lawn, path network or tree inventory.
- The
  [Landesdenkmalamt record `09050274`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050274)
  documents the protected prison remains, dates and surviving wall/building
  context. Berlin's park account documents the three entrances, four-wing
  interpretive reading, three yards, hedges, Panoptikum marker and walk-in cell.
  It also records the remembrance of opponents imprisoned during National
  Socialism; this is preserved as source context rather than a reconstructed
  Gestapo or prison building.
  The protected explanatory landscape plan is a textual fact source only: it
  is not copied, traced, bundled or used as an image texture. Mortar courses,
  local trace widths, board dimensions and planting intervals are procedural,
  non-surveyed recognition details, not a historical prison reconstruction.

`street-details.json` schema 7 keeps two parallel traffic-signal records. The
raw `traffic_signals_dm` array preserves all 1,328 bounded OSM control nodes;
`traffic_signal_placements` gives each physical viewer mast a deterministic
display anchor. Exactly 1,092 source nodes covered by the same smoothed,
width-resolved, above-ground carriageway polygons as the viewer move to a true
polygon exterior. One additional boundary-noise case moves because its
decimetre-rounded mast would otherwise overlap the delivered road edge. All
1,093 moved poles retain at least 0.5 m clearance after quantisation; the 227
already-safe nodes stay exact. Eight nodes with direct
`crossing:island=yes` node/way evidence remain source-exact as verified refuge
islands and receive a small visible island base; an unverified road-union hole
is never interpreted as an island. Stable OSM keys and source coordinates make
every relocation auditable, and the raw list remains compatible with older
viewers.

Schema 7 also preserves `memorial=*` (and the deprecated
`memorial:type=*` fallback) instead of flattening every `historic=memorial`
point into one object. Every entry retains its stable `osm_element`, `osm_id`
and combined `osm_key`; `schwellenraum_protected` is the reviewed source-side
contract for unchanged Day rendering and indexed navigation exclusion. The
viewer therefore distinguishes Stolpersteine, plaques, statues, sculptures,
steles, busts, stones, war memorials, obelisks, ghost bikes, headstones,
benches and pavement plaques. Stolpersteine use the documented 0.10 m brass
top without an ink halo; a missing subtype yields only a conservative low
marker, never a falsely asserted landmark-sized block.

## Weidendammer Brücke and Brecht evidence contracts

Weidendammer Brücke separates four source roles:

- Exact OSM way [`6228081`](https://www.openstreetmap.org/way/6228081) controls
  the bridge centre and bearing in the committed coordinate frame.
- Berlin's
  [Masterplan Brücken inventory](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf)
  (data status June 2025, bridge 3446013) controls the current 69.48 x 25.17 m
  envelope, 1,749 m² area, steel/light-metal material class and bow-bridge
  construction. It does not provide ornamental part dimensions.
- [Landesdenkmalamt object `09030074`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030074)
  controls the protected three-opening system, two granite-clad piers, ten
  tripartite arch girders and paired forged eagles in the neo-Baroque railing.
  Its historic 22.4 m width remains recorded as a source conflict rather than
  silently replacing the current 25.17 m inventory width.
- Eagle feather segmentation, rail-field rhythm and deterministic love-lock
  placement are procedural, texture-free recognition geometry. The 192/96
  full/mobile lock counts are render budgets, not a current fixture inventory.
  Wolf Biermann's bridge-eagle association is factual cultural context only;
  no lyric, photograph, protected plan, portrait or texture is copied or
  bundled.

The Bertolt Brecht memorial keeps the same separation. Exact OSM node
[`988668382`](https://www.openstreetmap.org/node/988668382) controls placement.
The
[Bildhauerei in Berlin inventory](https://bildhauerei-in-berlin.de/bildwerk/bertolt-brecht-denkmal-5412/),
[Deutsche Digitale Bibliothek record](https://www.deutsche-digitale-bibliothek.de/item/5ALSSIMTMT2PKBR7UXTZZASRRBP7K366)
and [DEFA record](https://www.defa-stiftung.de/en/films/film-search/bertolt-brecht-platz/)
control its identity, 1988 installation and characteristic
six-metre sett platform, open asymmetric bench/seated bronze and three
cylindrical black-stone steles. Credits remain role-specific: installation
design Peter Flierl, sculpture Fritz Cremer, stonework/steles Carlo Wloch.
An attributed CC BY-SA 3.0 Commons image remains visual-reference evidence only;
no image or portrait texture is loaded. The copyrighted poem and quotations
are not reproduced; code-authored incision cues remain non-legible and all
uncited anatomy, joint and spacing values remain non-surveyed.

The release catalogue assigns Richard Wagner, Weidendammer Brücke, Bertolt
Brecht and Scharnhorst to records 90–93. All four shipped landmark payloads are
identical at 93 records; the alignment audit covers 41 relative-placement
contracts and retains three established manual-review anchors. The separately
modelled CSD memorial place remains outside that catalogue.

## Invalidenfriedhof and Kieler Eck evidence contract

The Invalidenfriedhof recognition layer keeps source roles separate:

- Berlin monument object `09010206` documents the protected cemetery ensemble
  and named historic grave monuments.
- OSM way `51804411`, the committed paths and individual grave anchors control
  plan placement and semantics; they do not supply facade or sculpture survey
  geometry. Exact OSM node `273120316` anchors Scharnhorst; OSM node `279219439`
  independently anchors the Hans Carl von Winterfeld monument.
- The
  [Berlin-Lexikon record](https://berlingeschichte.de/lexikon/mitte/i/invalidenfriedhof.htm)
  supplies Scharnhorst's published 5.60 m overall height. The
  [Staatliche Museen Schinkel portal](https://schinkel.smb.museum/image_orte.php?id=28)
  and monument record control its form, native-granite supports, high
  Carrara-marble sarcophagus, bronze lion, iron enclosure, authorship and
  conservation context. Karl Friedrich Schinkel designed the
  architecture, Friedrich Tieck the relief frieze, Christian Daniel Rauch
  modelled the lion and Theodor Kalide executed it; the Royal Prussian Iron
  Foundry in Berlin cast the bronze. The current sarcophagus and
  relief frieze are conservation copies; their presence does not license a
  claim that uncited local part dimensions are surveyed.
- OSM node `7430297888` identifies the Auguste-Viktoria bell, while Berlin
  LoD2 object `DEBE01YYK0001yqp` supplies its official building anchor and
  10.044 m measured building height. The published 1.60 m bell diameter and
  1.8 t mass apply only to the bell, not to uncited frame or spacing
  dimensions.
- Berlin's Wall documentation and monument inventory distinguish the 1902
  canal-side brick cemetery wall from the surviving concrete
  Hinterlandmauer. The committed official Wall layer and OSM wall ways retain
  their separate traces.
- OSM way `31347999`, monument object `09040270,T,010` and Stiftung Berliner
  Mauer documentation independently anchor the former Führungsstelle Kieler
  Eck / Gedenkstätte Günter Litfin. LoD2 object `DEBE01AL1pC0000R` supplies its
  8.946 m measured building height. Its recognition shell must not be merged
  into the cemetery wall, and uncited facade subdivisions must not be
  relabelled as LoD2 survey detail.

Close procedural shapes for the Scharnhorst, Witzleben, Winterfeld, Kessel and
Rauch grave monuments, the bell frame and the watchtower's openings, rails,
plaques and information board are bounded recognition geometry wherever no
published dimension exists. User-supplied photographs remain unbundled visual
references only; they are never source textures or metric evidence. Repeated
members are batched, every visual mode keeps the ensembles static, and
navigation collision is limited to the represented solid geometry so mapped
paths and deliberate open structural bays stay traversable.

Primary public records:

- [Invalidenfriedhof monument ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010206)
- [Berlin Wall remains at Invalidenfriedhof](https://www.berlin.de/mauer/orte/mauerreste/artikel.151178.php)
- [Invalidenfriedhof Wall monument record](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/invalidenfriedhof-648151.php)
- [Führungsstelle Kieler Eck monument record](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/fuehrungsstelle-kieler-eck-649714.php)
- [Gedenkstätte Günter Litfin](https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin)
- [Auguste-Viktoria bell information](https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/augusta-viktoria-glocke)
- [OpenStreetMap watchtower footprint](https://www.openstreetmap.org/way/31347999)
- [OpenStreetMap bell anchor](https://www.openstreetmap.org/node/7430297888)
- [OpenStreetMap Hans Carl von Winterfeld anchor](https://www.openstreetmap.org/node/279219439)
- [OpenStreetMap Scharnhorst anchor](https://www.openstreetmap.org/node/273120316)
- [Schinkel portal: Scharnhorst grave monument](https://schinkel.smb.museum/image_orte.php?id=28)
- [Berlin-Lexikon Invalidenfriedhof record: published Scharnhorst height](https://berlingeschichte.de/lexikon/mitte/i/invalidenfriedhof.htm)

## Federal Ministry for Economic Affairs evidence contract

The canal-side ministry is an additive recognition layer over Berlin LoD2.
LoD2 prisms `yAAWS2KQ`, `-3202585`, `K0000EU2`, `K0000B4S` and `K0000A7g`
remain the geometry and height authority. OSM office way `24911034` fixes the
site identity; OSM building ways `28880802` and `28880803` identify the two
historic Invalidenhaus wings. The official ministry architecture page, Berlin
monument object `09011190` and the federal building documentation establish the
U-shaped historic complex, retained side wings and long replacement building
parallel to the Berlin-Spandauer Schifffahrtskanal. Window bay counts, local
trim projection and entrance subdivision are bounded procedural recognition
geometry, not survey claims. No reference photograph is bundled or projected.

Primary public records:

- [Federal Ministry architecture](https://www.bundeswirtschaftsministerium.de/Navigation/DE/Ministerium/Architektur/architektur.html)
- [Federal building record for Buildings E, F and G](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/gebaude-e-f-und-g-ehem-invalidenhaus)
- [Berlin monument record 09011190](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011190)
- [OpenStreetMap ministry site](https://www.openstreetmap.org/way/24911034)
- [OpenStreetMap south Invalidenhaus wing](https://www.openstreetmap.org/way/28880802)
- [OpenStreetMap north Invalidenhaus wing](https://www.openstreetmap.org/way/28880803)

## Berlin official support layers

Pipeline step 4 keeps official support data additive and scoped to the
Regierungsviertel bounds:

- `alkis`: public ALKIS Flurstücke WFS
  `https://gdi.berlin.de/services/wfs/alkis_flurstuecke`; the clipped
  derived artefact is `geo_data/regierungsviertel/alkis.gpkg`.
- `dop`: DOP 2025 ATOM/WMS
  `https://gdi.berlin.de/data/dop_2025_fruehjahr/atom/` and
  `https://gdi.berlin.de/services/wms/dop_2025_fruehjahr`; the
  derived QA/reference artefact is `dop_preview.png`.
- `dgm`: DGM1 ATOM/WMS
  `https://gdi.berlin.de/data/dgm1/atom/` and
  `https://gdi.berlin.de/services/wms/dgm1`; the derived QA/reference
  artefact is `dgm_preview.png`.

The raw service capabilities and ATOM feeds are cached under
`geo_data/regierungsviertel/raw/{alkis,dop,dgm}/` and gitignored.
Large DOP/DGM ZIP archives are referenced in those manifests, but are
not downloaded or committed by default.

## LoD2 BuildingPart preservation

The step-2 parser keeps complex CityGML buildings segmented. When a
`bldg:Building` contains `bldg:BuildingPart` children, the committed
`buildings.gpkg` stores the deepest parts as separate records with their own
official footprint, roof type and `measuredHeight`; it does not also render a
second, overlapping parent union. `parent_building_id`, `lod2_role`,
`building_name` and `source_creation_date` retain the ensemble relationship
and provenance.

This matters for the Bundeskanzleramt, Paul-Löbe-Haus and
Marie-Elisabeth-Lüders-Haus: their lower wings, central volumes and roof
elements no longer receive one area-derived fallback height. OSM named
building polygons associate the segmented LoD2 families with semantics, but
Berlin LoD2 remains the geometry and height anchor.

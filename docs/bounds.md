# Bounds — central Berlin

The current owner-approved polygon is stored at
[`geo_data/regierungsviertel/bounds.geojson`](../geo_data/regierungsviertel/bounds.geojson).

## Landmarks (must be inside the polygon)

The machine-readable catalogue in `landmarks.geojson` is canonical and
currently contains 93 checked places. It includes the government core and
Pariser Platz; Hauptbahnhof, Hamburger Bahnhof and Europacity; the full
Tiergarten to Charlottenburger Tor; Kulturforum and Potsdamer/Leipziger Platz;
and the southern extension to Anhalter Bahnhof, Kochstraße and the WELT
balloon. The north-east lobe additionally reaches Berliner Ensemble and
Berlin Friedrichstraße; transit/civic anchors cover the Hbf tram and S15,
Futurium, the federal ministries, Gropius Bau, Abgeordnetenhaus and Topography
of Terror. The catalogue also carries both Tiergartentunnel portals and the
approximate underground reference route.

The 89th record is the owner-supplied `Queer Rainbow Memorial Berlin` point at
Ahornsteig. It is retained as an explicit manual-review anchor because the
current bounded OSM extract does not yet contain a corresponding named feature.
Its position must not be confused with surveyed tree or memorial geometry.

The 90th record is the `Richard Wagner` memorial at exact OSM node
`243487615`. Its catalogue anchor is independently checked against the local
OSM extract and the official LoD2 footprint of its protective shelter.

The 91st record is the `Weidendammer Brücke` at the centre of exact OSM bridge
way `6228081`. Its catalogue anchor is independently checked against the local
OSM extract, while Landesdenkmalamt object `09030074` supplies the protected
bridge identity and ornamental-system evidence.

The 92nd record is `Bertolt Brecht` at exact OSM node `988668382`; the 93rd is
the `Scharnhorst-Grabmal` at exact OSM node `273120316`. Their catalogue
anchors remain separate from the surrounding Berliner-Ensemble and
Invalidenfriedhof ensemble focuses.

The separately modelled CSD memorial place at OSM node `14076715427` is not a
94th catalogue record. It remains an uncatalogued current detail distinct from
both the owner-supplied Queer Rainbow Memorial at record 89 and the 93-place
tour inventory.

All four shipped landmark payloads are synchronised at 93 records. The
alignment audit passes 41 relative-placement contracts and retains three
established manual-review anchors.

The preserved task-13 WGS84 extent is approximately `13.314761,52.493209` to
`13.407233,52.550987` (EPSG:25833 `385602.60,5817089.12` to
`391910.58,5823617.37`). Its 30.977 km² polygon is the exact additional 500 m
outward buffer of task-12 in EPSG:25833, with mitred joins and only 0.036 mm of
coordinate-rounding noise after conversion back to CRS84. The new ring adds
11.015 km² (+55.18%) around the prior 19.962 km² scene. The corresponding
historical presentation radius was 6,450 m; it is a viewer/camera envelope, not a claim
that every point in that circle is surveyed.

## Owner-requested v1.0.48 eastern outline extension

The boundary archived as `bounds-v158.geojson` retains the entire task-13 polygon and adds a **0.308 km²**
eastern lobe (total **31.285 km²**) for Bahnhof Alexanderplatz, Fernsehturm and
Rotes Rathaus. The lobe is the union with EPSG:25833 rectangle
`391600,5819770,392305,5820360`. It is a presentation scope, not a surveyed
parcel. The original file is retained as `bounds-task13.geojson`; its existing
pipeline payloads and archival overview keep their original projection.

All eight original building parts lie inside this extension. They appear as
initial vector outlines; the generalized television-tower source is retained
but its display silhouette uses separately documented published dimensions.
Mapped street links are clipped to this scope and subtract exact existing
street ownership. The neutral backing beneath the new outline area makes no
claim to represent a surveyed plaza. There are still **93 tour places**, and
the historical presentation radius was **6,450 m**.

Historical reproduction uses `scripts/build_schloss_east_source.py` and
`scripts/build_schloss_east_streets.py` with the retained source archives/extract.
Run those generators only in the corresponding v158 checkout: the historical
bounds generator writes its older scope and must not overwrite current bounds.

## Owner-requested v1.0.59 surrounding outline extension

The current polygon adds **50.172 km²**, for **81.457 km²** in total. It keeps
the complete detailed v158 city and adds rudimentary source-bound surroundings.
The original terrain grid, overview projection and **93-place tour remain
unchanged**. The surrounding layer must never replace existing source geometry.

The two complete districts use exact official **Moabit** and **Prenzlauer Berg**
polygons from [ALKIS Berlin Ortsteile](https://daten.berlin.de/datensaetze/alkis-berlin-ortsteile-wfs-61bd3084),
retrieved 2026-10-01 under dl-de/zero-2-0. The committed 63 KB
`surrounding-district-boundaries.geojson` retains only those two original
EPSG:25833 features, without simplifying their coordinates. In particular,
Prenzlauer Berg continues well beyond Knaackstraße to its actual eastern edge.

Four explicit CRS84 boxes connect and supplement those districts:

| Presentation scope | West | South | East | North |
| --- | ---: | ---: | ---: | ---: |
| City West, parts of Charlottenburg/Wilmersdorf, Joachim-Friedrich-Straße | 13.282 | 52.485 | 13.360 | 52.530 |
| Northern Schöneberg from Potsdamer Platz | 13.337 | 52.480 | 13.407 | 52.503 |
| Alexanderplatz surroundings, Karl-Marx-Allee and Schlesisches Tor | 13.395 | 52.493 | 13.457 | 52.541 |
| Northern connection between existing city and Prenzlauer Berg | 13.365 | 52.520 | 13.425 | 52.553 |

These are finite presentation windows, not administrative boundaries. Only
Moabit and Prenzlauer Berg are claimed as complete districts. The user's
historical **Stalinallee** is interpreted as today's **Karl-Marx-Allee through
Frankfurter Tor**. East of that junction the street again became Frankfurter
Allee in 1961; see the [Landesdenkmalamt naming history](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085137).

The full named OSM road sets for Joachim-Friedrich-Straße (22 ways), Knaackstraße
(18 road ways) and Karl-Marx-Allee (71 ways) fit inside this scope, including
separately mapped footways. Knaackstraße has two additional named tram-platform
lines, which are not road centre lines. The Schlesisches Tor station uses OSM node `3876481637` at
EPSG:25833 `394207.060,5817886.453`. These checks refer to the 2026-09-29 OSM
extract; roadway widths and building heights without explicit tags must remain
documented display estimates.

The exact union is a single hole-free polygon. Its projected extrema are
`383341.702,5815620.314` to `396333.836,5824374.355`. The viewer rounds outward to
world X `−6160…6840` and Z `−4380…4380`, retaining the 790 m blank paper margin.
The resulting **9,250 m presentation radius** includes every envelope corner.
The far clipping plane is derived from this larger envelope; the original
0.25 m near plane stays unchanged, limiting the relative depth-precision change
to less than 0.0006%. The obsolete
invented eastward straight road is removed in both renderers because actual
mapped roads now own that surrounding area.

Reproduce the polygon and provenance manifest without network access:

```bash
uv run python scripts/build_surrounding_bounds.py
```

`surrounding-bounds-manifest.json` records every input, source licence, exact
scope, area and SHA-256. It is independent of `overview_bounds.geojson`, which
continues to describe the original committed terrain/prism projection.
The same command emits the small `src/app/src/data/surroundingCityScope.json`
with the exact new-minus-v158 footprint, a cheap old-core rejection ring, and
the outer layer's documented flat ground height of 3 m. Navigation can retain
an outer-area walking position during cold start or mode remount before the
chunk manifest arrives; no complete geometry manifest is imported eagerly.
This scope contains no buildings or estimated feature shapes and never
replaces the detailed old city's terrain/collision data.

## Editing

A small Leaflet-based bounds editor (analogous to NYC's
`create_bounds.py`) is available:

```bash
uv run python -m isometric_berlin.generation.create_bounds
```

It starts a local Flask server on `127.0.0.1:8765`, shows OSM raster
tiles with the current polygon and all required context markers, lets you
drag the polygon vertices, and saves back to
`geo_data/regierungsviertel/bounds.geojson`. The polygon is always kept
as a single, closed, simple polygon (no holes, no multipolygons).

The polygon began as a landmark-fitted Regierungsviertel hull and has since
been expanded through explicitly versioned tasks. Task-13 is the second
owner-requested 500 m context ring, now around every task-12 edge, rather than
a blanket Berlin-wide rectangle. `create_bounds --expand-by-m 500` reproduces
the metric operation, prints the old/new/ring measurements and exits. Every
new fetcher and generated extension clips back to the current approved geometry.
Historical generators must use their versioned source scope when reproducing
older payloads; expanding the current presentation never implies rebuilding or
coarsening the existing city.

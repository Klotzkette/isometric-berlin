# U2 Eberswalder Straße and its southern ramp — v238

Step 10, retained coverage only. The approximately 566 m displayed section follows
the two actual U2 tracks from their mapped tunnel endings at 52.538096° N, through
the ramp and viaduct, past Eberswalder Straße to a short northern continuation.
It does not claim completion of the entire 1.7 km elevated line. The complete OSM
courses, including the longer northern tracks and southern tunnel segments, are
retained uncut in `north-elevated-v238-source.json.gz`.

## Sources and limits

* Indexed retained `raw/outer-v159/candidate.gpkg`, derived from the existing
  Berlin OSM PBF, supplies both track centre lines, tunnel/bridge transitions,
  platform 380981354, roof 499263882 and six mapped staircase courses and step
  counts. No new area download or new source coverage is introduced.
* [Berlin Landesdenkmalamt, 09050083](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050083)
  identifies the historic elevated ensemble and its construction phases.
* [Restoration engineer Fischer & Co.](https://fischer-co.berlin/bahnhof-eberswalder-strasse-berlin/)
  documents the approximately 92 × 12.5 m steel hall on sandstone piers. That
  corresponds to the wide southern part of the actual mapped roof, followed by
  its narrower northern canopy; the two widths are preserved.
* [Fischer/Lorenz, Stahlbau 80 (2011), pp. 419–427](https://lorenz-co.de/mehr/Mehr6.pdf),
  particularly page 426, figures 14, 16 and 17, documents the bearing piers,
  curved solid-web frames, central gabled glazed rooflight and glazed entrance.
  Those figures were inspected as construction references; no photography,
  artwork, colour sample or texture is shipped. Paraphrased facts are retained
  in the source receipt.
* [BVG station plan, 3 October 2025](https://www.bvg.de/dam/jcr:f3ba5662-bf34-4120-899d-35af09d0d310/eberswalder-str%20900110006.pdf)
  confirms the two entrances and interchange position.
* Retained official DGM samples in `weinberg-v176/dgm-samples.json` include the
  original NHN datum and archive hashes. The street drops from approximately
  51.4 to 48.4 m NHN northwards through this section.

No railway survey or measured structure heights were available. The surrounding
city is already displayed at Y=3 here, outside the localized Weinberg terrain
support. Accordingly the retained DGM street profile is used to express estimated
rail clearance over that existing display ground: 0.15 m at the mapped tunnel
ending, 1.5 m at the first bridge segment and 5.7 m at the station. Between the
anchors an estimated absolute rail grade is interpolated and converted back to
local street clearance. This is explicitly **not a surveyed rail elevation**.
There is no raised district ground blanket or invented deep tunnel excavation.
The roof rise, cross sections, muted glazing/steel tones, frame spacing and
platform height are restrained recognition estimates. The exact 1.435 m rail
gauge is supplied by the OSM track tags.

## Exact correction and navigation

The existing `OSM-way-499263882` object was a ground-level, three-metre-high solid
because a roof footprint with no height received the generic building fallback.
That incorrect closed body yields only after the complete replacement has been
prepared in its original `5_-5` packet. Exact encoded fingerprints bind 34 drawn
and 424 native original triangles, 12 drawn roof-edge segments and every matching
original navigation row. The complete old assets remain unchanged and hash-bound
in the source receipt. No surrounding house or tram geometry is retired.

The replacement contains the complete source-shaped hall and its glazed rooflight,
separate central platform, rail decks, sandstone piers, curved steel frames,
source-mapped stair flights, handrails and blue geometric U entrance signs. The
north canopy remains open, rather than becoming a second enclosed hall.

The platform extends 9.64 m beyond the original packet's northern edge. That exact
continuation is included in `northrail238-5_-6`, with a thin source-bound walking
surface. All station geometry inside the old packet is atomic. Navigation models
only thin platform/roof/stair bands and narrow piers; it never fills the undercroft.
All ground, road, water and bridge navigation lists of the companions are empty.

## Bounded implementation

`northElevatedV238Replacement.json` supplies the parent-owned named-site atomic
preparer. Two ordinary companion descriptors, `northrail238-5_-5` and
`northrail238-5_-6`, use the existing bounded loading and disposal path. No resident
scene group, runtime geometry builder, texture, tour change or budget increase is
required. Native surfaces are independently generated orthogonal steps, including
track members, station roof and platform; mobile drawn geometry is identical to
desktop drawn geometry.

Combined new geometry occupies 584,964 drawn GPU bytes or 2,349,300 native GPU
bytes before any possible promotion of the old combined tile index width. The
largest new part contains 52,761 vertices and 285,072 indices. Runtime JSON is
3,122,491 bytes including navigation recipes; all companion decoded payloads are
below 12 MiB. Parent integration tests account for complete combined buffers and
index-width promotion.

Rebuild and focused checks:

```sh
PYTHONPATH=.:scripts uv run python -m scripts.build_north_elevated_v238
uv run pytest -q tests/test_north_elevated_v238.py
uv run ruff check scripts/build_north_elevated_v238.py tests/test_north_elevated_v238.py
```

Four tests verify source hashes and complete connected courses, exact retirement
receipts, open undercroft and thin roof navigation, north platform continuity,
independent native axis alignment, bounds/budgets, and deterministic byte replay.
Camera suggestions: hall eye `[2860,20,-2390]`, target `[2818,10,-2470]`; emerging
ramp eye `[2848,10,-2120]`, target `[2814,5,-2200]`.

# Southern neighbourhood accents — v1.0.85

Step 10 adds a modest, texture-free overlay at **Richardplatz in Neukölln**,
Schudomastraße, Wiener Straße, Forster Straße and Görlitzer Park. The user’s
“Richardplatz in Köln” is interpreted as the Berlin square in Neukölln. No
source building, roof, window, street, path, park surface, tree, courtyard,
navigation footprint or earlier detail is replaced or deleted.

## Source and interpretation

- The retained [Geofabrik Berlin extract, 29 September 2026](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
  supplies the exact OSM line courses, tagged road widths, park outline and
  bench points/directions/materials, under ODbL-1.0. The bounded source receipt
  commits the 783 nearby road/path records, including 65 segments belonging to
  the four named streets, and park way **15740772**.
- The source-bound existing v159, v182 and v183 owner caches supply **353**
  nearby LoD2/OSM footprint records. These are exactly the envelopes used by
  the current streamed city. Their IDs, height evidence, courtyard geometry
  and cache hashes remain in `south-kiez-v185-source.json`. Official Berlin
  LoD2 retains dl-de/zero-2-0 attribution.
- Berlin’s [Richardplatz / Rixdorfer Schmiede account](https://www.berlin.de/tourismus-neukoelln/entdecken/artikel.1152599.php)
  confirms the Neukölln location and historic village context. The
  [Görlitzer Park account](https://www.berlin.de/tourismus/parks-und-gaerten/3560154-1740419-goerlitzer-park.html)
  identifies the former railway site. These sources are identity/context
  checks, not geometry derived from photographs or protected landscape plans.

The scope is the four named street courses buffered by 36 m plus the exact
park polygon. It is entirely inside existing authorized city coverage.
Nearby roads outside that authoring scope are read only to preserve junctions.

## What is added

**493 kerb members** follow the unioned mapped carriageway boundaries.
Intersecting road surfaces are unioned before edging; mapped pedestrian
crossings/entrances and building footprints are subtracted. Thus junctions do
not acquire transverse closed kerbs. The displayed road-width estimates remain
the same as the existing exporter, with explicit OSM width evidence retained.

**1,800 park-path edge members** follow the original mapped path union within
Görlitzer Park. Existing path surfaces, park open space and trees remain.
No speculative terrain, restoration of the lost Pamukkale fountain, new water
surface or unrecorded park building is added.

**113 existing street-facing building owners** receive three thin profile
members each: a low plinth, its lip, and an upper facade band. Seventy-nine are
along Wiener/Forster Straße and 34 along Richardplatz/Schudomastraße. Only one
long, clear, outward-facing wall per owner qualifies; no courtyard/party wall
or fabricated opening is introduced. Profile sections, material tones and the
upper band’s placement are restrained **display interpretations**, not a
survey of the specific facade or a measured roof eave. The exact source roof
and parent envelope remain visible.

**39 mapped wooden benches** in Görlitzer Park retain their explicit OSM facing
direction and backrest presence. Unknown section sizes and the 1.8 m display
length are labelled estimates. Benches without a recorded direction or wood
material are not guessed. None is added outside the park.

## Delivery and verification

- Drawn: one final-count instance batch, **2,788 instances**, 211,888 instance
  buffer bytes; derived JSON **163,277 bytes**.
- Minecraft: independent axis-aligned shallow block contours, **10,018 blocks**,
  one batch, 761,368 instance buffer bytes; JSON **499,754 bytes**. Upper
  profiles follow the existing native two-metre envelope rounding and move
  outside its block surface. No smooth duplicate or hidden solid fill.
- All five drawn modes share the same static geometry; touch receives the
  same detail. Both small data payloads belong to the shared lazy landmark
  module, but only the active representation allocates scene/GPU objects.
  No streamed packet, resident budget or loading queue is changed.

`uv run python scripts/build_south_kiez_v185.py` reproduces both small payloads
from the committed source receipt. `--extract` refreshes that receipt only from
the retained raw sources, which remain ignored. Four focused Python tests
check deterministic output, exact owner walls, bounded/open contours and bench
identity; one Bun test checks frozen final-sized buffers and orthogonal native
geometry. Full viewer compilation and screenshot QA belong to release
integration.

Suggested world-frame QA cameras:

| Location | Target | Camera |
| --- | --- | --- |
| Richardplatz | `[4914,3,5090]` | `[5134,140,5310]` |
| Görlitzer Park | `[4482,3,2607]` | `[4752,180,2927]` |
| Forster Straße | `[4111,3,2771]` | `[4300,110,2970]` |

No new photograph, raster, texture, source suppression or attribution licence
is introduced.

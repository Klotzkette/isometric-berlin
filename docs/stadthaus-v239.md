# Altes Stadthaus recognition — v1.0.139 / Step 10

The former v182 tower was an open line drawing: nine horizontal rings, two
sets of thin columns, wire cupola ribs and two small Fortuna blocks. It had
neither a cubic base nor solid central drums. The new bounded model replaces
only those 34 boxes and 410 segments, using original indices plus exact row
values. Every other v182 row remains, including the Stadthaus's 1,116 existing
window boxes and 2,529 measured/façade segments. The original JSON is unchanged.

One required packet, `stadthaus239-5_0`, supplies the complete new tower at the
previous DOP-aligned centre `[2676,317.5]`. The overall top is world Y=83 over
Y=3 ground, retaining Berlin's published 80 m height. The model has a square
base, two closed stone drums with projecting colonnades, broad entablatures,
a closed cupola and a small original abstract Fortuna silhouette. A western
mansard surface follows the retained source plan and excludes all five courts.
Six engaged west-front columns and a triangular pediment connect the facade to
the tower. Shallow surrounds frame 204 existing west-facing window positions;
no earlier windows move or disappear.

## Evidence and limits

- Berlin LoD2 parent `DEBE01YYK00005yc`, tile `LoD2_392_5819.zip`, retains its
  complete 100 wall/roof sheets and five ground-ring holes. The existing body
  and all source roof edges remain rendered. A bounded copy and archive SHA-256
  are in `geo_data/regierungsviertel/stadthaus-v239-source.json.gz`.
- OSM relation `23745` remains the building identity; its original v182
  geographic selection is retained unchanged.
- [LDA monument 09011265](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011265)
  establishes the building identity and west roof reconstruction.
- [LDA restoration record](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/altes-stadthaus-640948.php)
  describes the triangular west pediment, cubic base, two column storeys and
  restored Fortuna. Only the western mansard was restored; the rest of the
  generalized source roof is deliberately retained.
- [Berlin's visitor account](https://www.berlin.de/sehenswuerdigkeiten/3561541-3558930-altes-und-neues-stadthaus.html)
  confirms the 80 m tower and five courtyards and distinguishes Neues Stadthaus.
- Fred Romero, photographs of 17 August 2016,
  [Berlin – Altes Stadthaus](https://commons.wikimedia.org/wiki/File:Berlin_-_Altes_Stadthaus.jpg)
  and [west front detail](https://commons.wikimedia.org/wiki/File:Berlin_-_Altes_Stadthaus_(2).jpg),
  [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), guide an independently
  authored procedural interpretation. No photograph or image texture ships.

The source parent is generalized to a flat roof at Y=30.534 and omits the
published tower. That evidence conflict is retained explicitly. The new tower
radii and floor levels, eight-column rhythm, roof rise (at most 5.5 m above
source), column/pediment dimensions, figure proportions and window fittings
are **display estimates**, not surveyed architectural dimensions. The five
open courts and measured footprint take priority over that interpretation.
No interior or sculpture scan, current exact facade bay survey, or reconstruction
of the separate Neues Stadthaus/Rotes Rathaus is claimed.

## Delivery and verification

Run `uv run python scripts/build_stadthaus_v239.py`. The committed bounded source
supports regeneration without raw archives; initial extraction requires the
existing LoD2 cache. Shared manifests and runtime modules are not changed by
the builder. Its descriptor addition and retirement receipt are integrated by
the release task, with the complete new tower required before the old sketch
yields. Original-index and exact-value matching fails open if a source row changes.

| Representation | Compressed | Decoded | Vertices | Triangles | Geometry GPU bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Drawn | 114,644 | 425,756 | 11,269 | 18,144 | 244,092 |
| Native | 269,767 | 1,103,336 | 29,270 | 46,992 | 633,192 |

Both representations use one texture-free mesh in one existing 512 m packet
cell. The drawn packet is identical on desktop and mobile. Native construction
uses its own orthogonal surface blocks and orthogonal window surrounds, with no
sloped triangle or duplicate smooth tower. Existing streaming, residency and
prefetch limits, source navigation and the 93-place tour remain unchanged.

Five focused tests verify exact old-row ownership, unchanged retained files,
source geometry/height identity, roof/courtyard clipping, a single two-drum
80 m tower, native orthogonality and bounded payloads. An offline rendered
inspection of the complete retained body plus new model confirmed closed drums,
readable pediment and open courts; final browser views belong to release QA.

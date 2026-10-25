# Friedrichshain, Boxhagener Platz and Ostkreuz approaches — Step 10 / v266

This bounded addition fills visible lower-front gaps on existing ordinary houses,
with **75 source-bound shopfront treatments** and **seven mapped wooden benches**
in Boxhagener Platz. The complete Ostkreuz station model, all measured shells,
previous windows, roofs, doors, roads, trees and park surfaces remain unchanged.
No additional doorway survived the complete-wall and previous-window checks;
this revision therefore makes no claim of adding mapped entrances.

| Existing street | Commercial fronts |
| --- | ---: |
| Grünberger Straße | 15 |
| Simon-Dach-Straße | 12 |
| Gabriel-Max-Straße | 12 |
| Gärtnerstraße | 12 |
| Krossener Straße | 11 |
| Sonntagstraße | 10 |
| Lenbachstraße | 2 |
| Simplonstraße | 1 |

The last Sonntagstraße treatment is at `[6500.214, 5, 1721.214]`, on the approach
to Ostkreuz. The station itself needs no repeated replacement: its existing v190
open hall, track grades, platforms and canopies remain the authoritative model.

## Evidence and limits

The retained [29 September 2026 Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
provides mapped commercial-use points, street associations, the exact Boxhagener
Platz polygon **way/237788251**, and bench nodes with explicit wood, direction
and backrest tags. OSM attribution remains © OpenStreetMap contributors,
ODbL-1.0. Existing official Berlin LoD2 source owners and the complete delivered
v188 street-facing walls remain the geometry anchors (dl-de/zero-2-0).

The public [district account of 20 August 2026](https://www.berlin.de/ba-friedrichshain-kreuzberg/aktuelles/pressemitteilungen/2026/pressemitteilung.1705199.php)
identifies the Ostkreuz neighbourhood and its named street connections. Its traffic
changes are contextual evidence only; no proposed layout, plan artwork or new
road marking is inferred from it. No photograph is used or bundled.

A commercial point must fall inside the same retained building owner and match
its exact named street face. Every new front fits an existing delivered wall,
above its retained plinth and below the earlier v188 window row. Mapped entrances
and their independently snapped previous native fittings are protected by clear
spacing. Glazing positions, shallow dark frames, sills, blank fascias, colours
and dimensions are explicit **display estimates**, not measured openings or a
claim about a current named tenant. No additional upper-storey window grid is
created. Two commercial fronts at most are fitted per selected source facade.

Native fronts are independently fitted to actual orthogonal delivered wall
polygons of the same named source owner, with outward orientation verified
against that owner's native footprint. They are not rotated smooth quads.
Where necessary their centre shifts up to one metre along an existing native
wall segment to fit its complete width; the orthogonal plane is at most 1.65 m
from the drawn anchor. Every native rectangle has complete original wall support.

The seven benches retain exact mapped points, explicit wooden material,
backrest presence and their source bearing in drawn modes. Seat length 1.8 m,
slat/support dimensions and neutral brown hue are estimates. Native uses a
separate cardinal interpretation. Both feet require actual delivered ground
triangles independently in both families; each bench is over a metre inside the
original park. Bench placement does not imply fabricated market stalls,
landscape redesign or additional paving. Source ground heights remain unchanged.

`friedrichshain-v266-context.json.gz` freezes the bounded OSM observations and
full park polygon. `friedrichshain-v266-evidence.json.gz` retains source hashes,
original owner/front records, exact mapped IDs, native planes, bench ground
heights and unchanged original packet/companion asset SHA-256 receipts.
`ostkreuzV190.json` is explicitly hashed among the preserved inputs.

## Integration and budgets

Import `prepareFriedrichshainV266` from `FriedrichshainV266.ts` and run it **first
on the original packet**, immediately before `prepareScheunenV265` and before
roof/material/facade preparation. It guards original origin, complete source
mesh encoded bytes and navigation owner/ring/height identity, then appends one
small mesh. Unknown keys return immediately; invalid source or recipe rows fail
closed. Original mesh, line, navigation and origin objects remain identical.

Only six existing descriptors receive additions: `11_1`, `11_2`,
`ring182-11_1`, `ring182-11_2`, `ring182-12_2`, `ring182-12_3`.
The complete recipe is **125,874 bytes**. Its **827 drawn / 628 native boxes**
produce **19,848 / 15,072 vertices** and **29,772 / 22,608 indices** in total.
The per-packet recipe cap is 650 boxes; the existing 16-part, 400,000-vertex and
2,400,000-index limits remain enforced. Construction and source hashing yield to
the existing scheduler. No new scene root, descriptor, material, texture,
animation, decoded cache, coverage, tour stop or live residency/decode/prefetch
allowance is introduced. Drawn detail is identical on mobile and desktop.

## Validation and cameras

Five Python tests pass: original input/packet preservation, commercial owner and
street association, complete actual drawn/native wall coverage, exact park bench
anchors and ground support, and bounded independent recipes. Six Bun tests pass
with **835 assertions**, covering both families in all six packets, unchanged
original object identity, malformed/stale source rejection, idempotence,
cooperative yielding, native orthogonality and the actual streamed construction.
A separate old/new preparation comparison proves that **all fourteen earlier
packet preparers still produce exactly the same geometry and navigation** after
the addition. Scoped Ruff formatting/lint pass. Root integration records final
TypeScript and internal-browser QA.

```sh
uv run --no-sync python -m scripts.build_friedrichshain_v266
uv run --no-sync pytest -q tests/test_friedrichshain_v266.py
cd src/app
bun test tests/friedrichshain-v266.test.ts
```

| Review | Eye | Target | Existing packet |
| --- | --- | --- | --- |
| Sonntagstraße arrival at Ostkreuz | `[6484,8,1733]` | `[6500.214,5,1721.214]` | `ring182-12_3` |
| Boxhagener wooden seating | `[5888,10,1020]` | `[5920,4,998]` | `ring182-11_1` |
| Platz-facing Gärtnerstraße front | `[6027,9,1052]` | `[6049.75,5,1059.08]` | `ring182-11_2` |

Use the internal browser only. Close views best reveal the lower glazing,
frames and wooden slats; no claim of a new surveyed whole-district facade model
is made.

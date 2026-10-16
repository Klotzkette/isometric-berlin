# Explicit sidewalk widths in old Mitte — Step 10

The v126 audit uses the unchanged v169 old-Mitte boundary, excluding Wedding
and Tiergarten. It checks the retained 29 September 2026 Geofabrik Berlin OSM
snapshot against the complete delivered street and path surfaces. The selection
contains 2,447 separately mapped sidewalk ways. Of these, 257 have an explicit
usable width, an eligible paved material and no above/below-ground, covered or
private-access qualification. These are mapped dimensions, not a new survey.

The source distinguishes [separately mapped sidewalks](https://wiki.openstreetmap.org/wiki/Tag:footway%3Dsidewalk)
from crossings and uses the explicit [width value](https://wiki.openstreetmap.org/wiki/Key:width).
The audit does not turn an untagged roadside verge into pavement or infer a
second strip from a road's generic sidewalk tag. Widthless ways retain their
earlier rendering. In particular, the green gaps at the Auguststraße review
camera are not evidence of an omitted measured pavement width in this set.

After subtracting existing surfaces, 22 source ways have missing width
complements totalling **948.038 m²**. They are primarily near Kronenstraße,
Beuthstraße, Hausvogteiplatz, Axel-Springer-Straße, Taubenstraße and Behrenstraße.
The exact source way coordinates and width/material tags are retained. Only
these missing complements are added; all earlier files and geometry remain.

The exclusion audit includes the complete original surface polygons, restored
road triangles, DistrictStreets and SchlossEastStreets, existing ParkDetails
paths, outer resolved road/path surfaces, measured building footprints and
water. SHA-256 receipts identify every input. A 3 cm separation from previous
paving and 8 cm from carriageways avoid coplanar duplicates and preserve open
junctions. These tolerances, the inherited 10 cm drawn paving lift and native
2.5 cm surface lift are display conventions. No new curb or raised road barrier
is inferred. Tiny numerical slivers below 0.5 m² or without a 25 cm-wide
interior are not added.

Drawn triangles split at the original 4 m ground grid and use the same v206
height sampler. An independent test checks every new pavement plane against
the actual original coarse grass runs: no grass occlusion requires cutting or
raising terrain. Native quarter-metre pixels are accepted only when their
entire footprint lies within the missing complement. Horizontal runs stop at
terrain cells, so no native quad crosses a source ground-height step.

| Representation | Geometry | Draw calls | GPU buffers |
| --- | --- | ---: | ---: |
| Drawn, identical on touch/pointer | 1,654 vertices / 1,618 indexed triangles | 8 | 29,556 B |
| Native | 9,844 contained pixels merged into 1,665 quads | 7 | 99,900 B |

The runtime JSON is 87,969 bytes. Both forms are static, texture-free and
independently culled in 512 m cells, with ordinary day/night materials. They
introduce no animation, new residency budget, tour stop or scope expansion.
The new JSON `cells` field is eligible for the existing weak construction cache.

Integration is one optional family, `createAltMitteSidewalksV226(native)`, named
`Source-width Alt-Mitte sidewalk complements v226` (plus ` native`). Its strict
identity marker is `altMitteSidewalksV226: true`. There is no terrain, walking or
traffic hook because it is a thin extension of existing walkable pavement.

Useful review cameras, in viewer X/Z metres, with approximately 65–100 m spans:

- `[1885.33, 876.70]`: source way `605375729`, mapped width 7 m, near Kronenstraße;
  largest missing complement, 316.75 m².
- `[2040.48, 1085.44]`: way `1228398901`, mapped width 6.4 m, near Beuthstraße.
- `[1668.81, 656.18]`: way `1426264398`, mapped width 2 m, near Hausvogteiplatz.
- `[1546.39, 344.12]`: way `1443932516`, mapped width 3.5 m and sett material,
  near Behrenstraße.

Reproduce with `uv run python scripts/build_alt_mitte_sidewalks_v226.py`.
`--extract` rebuilds the bounded source/exclusion receipt from retained raw
inputs; ordinary regeneration needs only committed files. Focused tests:

```sh
uv run pytest tests/test_alt_mitte_sidewalks_v226.py -q
bun test src/app/tests/alt-mitte-sidewalks-v226.test.ts
```

Python independently checks source widths, scope, every exclusion, exact drawn
complement coverage, absence of duplicate fill, each native pixel, unchanged
inputs and actual grass clearance. Bun verifies submitted buffers and terrain,
fixed budgets, texture-free materials and independent disposal. © OpenStreetMap
contributors, ODbL-1.0; retained Berlin LoD2 and ground data: Geoportal Berlin,
dl-de/zero-2-0. No external photograph or imagery is bundled.

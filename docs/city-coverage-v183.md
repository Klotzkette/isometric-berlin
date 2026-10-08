# v1.0.83 — finite southern city coverage and landmark approaches

Step 10 answers the owner's request for visible city blocks from Steglitz through
Friedenau and Schöneberg to Südkreuz. Ordinary mapped buildings and streets now
occupy the actual missing area; empty parks, rail yards, water and open courts
remain empty. The complete previous detailed city and Ringbahn packets remain.

## Exact scope

`bounds-city-v183.geojson` records three finite CRS84 rectangles:

| Requested area | West, south, east, north |
| --- | --- |
| Steglitz–Friedenau–Schöneberg–Südkreuz | 13.305, 52.451, 13.378, 52.493 |
| Schloss Charlottenburg / Tegeler Weg | 13.285, 52.517, 13.307, 52.531 |
| Molecule Man / Treptowers | 13.447, 52.488, 13.462, 52.502 |

Before generation, subtract the exact union of `bounds.geojson` and
`bounds-ring-v182.geojson`. The resulting **10,048,294.592 m²** is independent
of all previously delivered geometry. `bounds-retained-v182.geojson` records
this subtraction input; neither original bounds file is edited. The palace,
Tegeler court and Molecule Man locations partly lie in already represented
areas, so those parts keep their existing owners. Landmark contour/facade work
is additive and does not suppress their generic building shells.

## Retained evidence and representation

The unchanged Geofabrik Berlin extract dated 29 September 2026 supplies mapped
OSM geometry (ODbL-1.0). Available, retained Berlin LoD2 archives supply official
building footprints and measured parent envelopes (dl-de/zero-2-0). Source
archive hashes, height/width decisions and the complete street inventory are
in `city-coverage-v183-manifest.json` and the separate compressed source
inventory. No new citywide download or photographic texture is used.

- **4,517 buildings:** 1,242 official LoD2 owners and 3,275 uncovered OSM owners.
- **7,231 mapped road/path records**, retaining source vertices and continuous
  surface unions before clipping to independent 512 m tiles.
- **86 courtyard holes** across the delivered drawn building records.
- Tagged heights, levels and available LoD2 envelopes take priority. Unknown
  heights, road widths, neutral colours and flat scene y=3 remain explicit
  display estimates. Ordinary roofs/facades are simple massing.
- Subtracting an exact old scope may produce zero-area seam lines beside a
  polygon. The generator removes only these non-surface remnants; all source
  polygons, holes and identities survive.

## Delivery and verification

**67 independent tile pairs / 134 gzip packets** append to the existing shared
manifest and single serial, cancellable loader. Small scope-only navigation
provides ground before a packet arrives. There is no second loading queue or
eager geometry import, and no change to resident CPU/GPU, transfer or decoded
packet budgets.

The supplement occupies **13,839,006 bytes** including its source inventory.
The largest transfer is **465,561 bytes**, and largest decoded packet is
**1,748,762 bytes**. Each family decodes through the production renderer with
every stored position component preserved; constructed geometry remains below
3 MiB per packet.

Tests compare all **480 previous descriptors and both packet SHA-256 values**
against v1.0.82 and retain the exact previous footprint prefix. The only separate
exceptions are 13 packets across nine descriptors for the four documented
[Alexanderplatz/station owner substitutions](alexander-stations-v183.md).
Tests replay their exact source-signature subtraction from the committed v182
inputs in a temporary directory and compare every output byte; simply listing
a changed packet in the audit cannot exempt it. All other earlier packet hashes,
both original bounds files and the previous Ringbahn scope remain exact.
The manifest append is idempotent. New footprints match the metric scope at the
established centimetre storage precision. The new city area and detached lobes
remain navigable before streaming; the original core retains its own ground owner.

Reproduce with `uv run python scripts/build_city_coverage_v183.py --publish`.
Use `--publish-only` to re-publish already verified ignored prepared packets.
All raw PBF/GeoPackage/LoD2 data remain ignored. The new generator never
regenerates v182 packets.

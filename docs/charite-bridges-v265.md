# Charité connecting bridges, v265

The old virology and medical museum belong to Campus Charité Mitte beside
Humboldthafen. They are distinct from the RKI Nordufer site near Nordhafen.
This change is limited to the actual Luisenstraße crossing and two joined
Hufelandweg passage leaves. It creates no speculative road crossings.

## Location and evidence

| Exact leaf | Parent | Location | Treatment |
| --- | --- | --- | --- |
| `EWePLFPr` | `DEBE00YY1Mr0004R` | Luisenstraße, midpoint approximately world `(526,-850)` | Two-level steel/glass enclosure with a clear road beneath |
| `gQwBfdam` | `DEBE01YYK0000AII` | Hufelandweg diagonal passage | Single glazed passage with pale lower panels |
| `4gyC0jjm` | `DEBE01YYK0000AII` | Joined Hufelandweg return | Same passage plus photographed support pair |
| `L2e097lj` | `DEBE01YYK00003w7` | East of the hospital tower | Unchanged; previously mislabelled as the Luisenstraße bridge |

The [Charité announcement of 30 October 2015](https://www.charite.de/service/pressemitteilung/artikel/detail/neue_bruecke_am_campus_charite_mitte)
documents the replacement in transparent steel and glass and an approximately
one-metre increase in road clearance for double-decker buses. Its photograph
is by Charité/Sabine Gudath. The [current campus overview](https://dieneue-charite.de/vision/zukunftsbausteine/campus-charite-mitte)
explicitly confirms two storeys. Future projects shown elsewhere on that page
are not modelled.

The [official Hufelandweg 3 address](https://www.charite.de/service/lageplan/plan/map/ccm_hufelandweg_3/)
and [Schibo's first-hand 2025 photograph](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Hufelandweg_3,_2025.jpg)
identify the lower passage: open undercroft, paired concrete posts, pale
aggregate lower panels, dark frames and narrow upper transoms. The latter
photograph is CC0. Reference photographs were inspected, not bundled as textures.

## Measured plans and clearly bounded estimates

`charite-bridges-v265-evidence.json` retains every original source prism,
complete LoD2 wall/roof/ground sheet, source-archive SHA-256 and creation date.
The old source has full-height ground-to-roof walls; it **does not provide an
accurate open-bridge underside**. A recent file creation date does not prove that
every individual source sheet shows the latest renovation.

All drawn X/Z footprint vertices are retained. Ground remains at the existing
5.2 m display datum. Luisenstraße's 9.7 m underside and 17.5 m roof imply a 4.5 m
road clearance and a 7.8 m two-level enclosure. Hufelandweg's 8.7 m underside and
12.25 m roof imply 3.5 m clear height and a 3.55 m enclosure. These are explicitly
**photograph-based display estimates, not engineering measurements**. The
Hufeland roof follows its translated source top to within 3 cm. Frames, colours,
panel rhythms and support dimensions are also photographic estimates.

Native bridge slabs and cladding are independently generated orthogonal 0.4 m
blocks/strips. They are not rotated drawn geometry. Below the passage only the
two photographed posts are solid; the road surface is not lifted to the roof.

## Transactional source ownership

The exact prior prism tuple must match before the replacement is enabled.
The native audit checks the **whole 4 m cell against every intersecting source
owner**. Twelve exclusively owned columns can transfer; six mixed-owner columns
remain unchanged. Position, lower/upper height and class must all match. New
nearby source geometry invalidates affected receipts conservatively.

The Hufeland leaves also existed in the older Alt-Mitte v169 packets. Omitting
only their ordinary prisms left a second solid body and blocked walking. The
new immutable-packet receipts therefore cover 45 drawn shell triangles, 272
front triangles, 747 native triangles and 40 exclusive ink segments. Every
unselected triangle remains byte-for-byte and in its original order. Changed
encoded packet fingerprints retain the original geometry.

The native v169 merge joined bridge cells with the same parent's two other
parts. Native replacement consequently transfers that complete four-part
parent and republishes **both unchanged non-bridge parts in full** using the
original `native_detail` plus `merge_native_faces` pipeline. Their complete
source sheets, footprints, elevations, appearance bindings and navigation stay
intact. No other family transfers. The retained mesh has 866 triangles and its
lossless JSON is 51,230 bytes, below the existing 64 KiB payload threshold.

The required bridge constructor, including those unchanged native neighbours,
finishes before any prior geometry or navigation retires. The default standalone
builders retain their previous representation. No global packet budgets change.

## Validation and cost

- `uv run --no-sync pytest -q tests/test_charite_bridges_v265.py`: source receipts,
  immutable packets and full original-pipeline reproduction for both neighbours.
- `bun test tests/charite-bridges-v265.test.ts`: exact fingerprints, foreign-owner
  controls, unchanged eastern bridge, changed-source fail-closed controls,
  orthogonal native geometry and exact packet transfer.
- Walking uses the **real core terrain and all source buildings**, with production
  replacement options, in both day and Minecraft. Continuous routes beneath all
  three leaves cross without respawn, roof snapping or raised ground. The support
  pair remains collidable; upper enclosures remain solid.
- Drawn: six meshes, 405 instances, 56 slab triangles, 38,556 attribute bytes.
- Native including both unchanged neighbours: four meshes, 5,427 instances,
  866 retained triangles, 507,708 attribute bytes.

Everything is static and texture-free. There are no media, canvases, animations,
lights, per-frame loops, new entry points or mobile-only reductions.

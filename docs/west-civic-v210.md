# Westend and Deutsche Rentenversicherung — v210

This is a bounded additive recognition pass for the requested West Berlin
sites. It leaves every existing city packet, complete source parent, source
roof, courtyard and street in place. It does not raise any residency budget.

## Correct identities and evidence

* **Blauer Obelisk / Glasnost**, Hella Santarossa, Theodor-Heuss-Platz:
  [the district's fountain inventory](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/brunnen/artikel.118254.php)
  describes seven tapering glass cuboids, a stainless-steel base and a total
  height of 15 m. This is the blue sculpture meant colloquially by “Blaue
  Flamme”; the separate eternal-flame memorial on the square is unchanged.
  The former ten-cube estimate is corrected through an exact row receipt.
* **rbb Fernsehzentrum** is distinct from the adjacent **Haus des Rundfunks**.
  [The operator's site description](https://www.rbb-online.de/unternehmen/der_rbb/struktur/standorte/berlin.html)
  identifies the 7/13/14-storey television wings, pentagonal circulation core,
  silver aluminium cladding and the Poelzig radio building. The generalized
  retained television LoD2 parent does not resolve its tall slabs; the earlier
  two unmeasured outline rectangles now yield to four small source-bound
  interpreted masses with official bDOM roof heights, silver floor bands,
  glazing, an elevated broadcast crown and antenna rods. Poelzig's curved
  Masurenallee facade gains brick piers and pale framed windows on its actual
  source wall planes.
* **Deutsche Rentenversicherung Bund** is identified by its
  [official imprint](https://www.deutsche-rentenversicherung.de/Bund/DE/Service/Footer/Impressum?__site=bund)
  at **Ruhrstraße 2**, also
  [listed in the Berlin monument database](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011534).
  It is neither the separate Hohenzollerndamm high-rise nor DRV
  Berlin-Brandenburg on Spandauer Damm. The older plaster facade receives
  bounded warmer street-facing skins, pale multi-pane windows, cornices and a
  street portal. The much larger shared official parent is retained intact;
  no courtyard or neighbouring wing is replaced. Its coarse roof envelope
  remains source-derived; this pass does not claim to reconstruct every dormer.

The six Commons photo references, authors, direct file pages, licenses and
reference-thumbnail SHA-256 hashes are in
`geo_data/regierungsviertel/west-civic-v210-credits.json` and the source
receipt. These are visual references only: no photo pixels, imagery, texture
maps, remote fonts or new image downloads are used by the viewer.

## Source and interpretation limits

`west-civic-v210-source.json` retains all 725 LoD2 wall/roof sheets from six
parts of three complete parents:

| Site | Complete official parent | Parts / sheets |
| --- | --- | --- |
| Television centre | `DEBE04YY500004sB` | 1 / 194 |
| Haus des Rundfunks | `DEBE04YY500004eY` | 4 / 152 |
| DRV complex | `DEBE04YY500039oj` | 1 / 379 |

Raw source identities are SHA-256-bound to the already retained LoD2 archives.
The original parent minimum elevation is used for normalization (52.859,
52.934 and 35.908 m NHN respectively), matching the earlier city's source
convention rather than a separately rounded ground-surface elevation.

The television roof partitions are visually interpreted from the official
2025 spring orthophoto and clipped to the retained parent footprint. Height
samples are from bounded 1 m EPSG:25833 `b_bdom` GetFeatureInfo probes; all 65
probes are recorded. They provide roof elevation evidence, **not** surveyed
partition outlines. New solids continue down to their own source ground so
the lower generalized roofs cannot leave floating gaps. All old source
geometry remains present underneath and alongside them.

Window counts, section widths, colour values, antenna dimensions and the small
broadcast-crown divisions are procedural visual-reference estimates. The
sculpture's seven tiers and total height are documented; its individual tier
widths are estimates. Street skins are restricted to official wall planes and
outer street-facing boundaries, not interior courtyards. No broad owner,
radius or bbox filter is used.

## Representation, loading and navigation

`WestCivicV210.ts` exposes two disjoint factories:

* `createWestCivicEnvelopesV210(native)` — required before navigation: blue
  artwork plus rbb solid bodies, their crown and their own surface fittings.
* `createWestCivicV210(native)` — optional facade detail for Haus des Rundfunks
  and DRV, plus the precisely bounded mapped plaza context. Neither factory
  repeats anything from the other.

All five groups are independently frustum-culled and frozen. Only the selected
representation is instantiated. Drawn uses 2,494 boxes and 4,125 triangles;
Minecraft uses 12,874 independent axis-aligned instances plus 2,781 merged pavement quads. Its solid boxes keep
real depth; thin rotated facades are split into short stair-step panels, so a
long diagonal window strip never becomes a huge bounding box. The native
artwork retains seven complete cuboids and a complete basin. Native windows
sit outside the voxel wall skin. Both representations are texture-free and
have identical detail on touch devices. The combined derived scene is 1,526,418 bytes of JSON. Drawn geometry/instance
buffers use 639,724 bytes across seven calls; native uses 1,583,800 bytes across
six calls. These are local scene additions, not increases to residency limits.

`westCivicSolidAtV210(x,y,z,radius)` uses exact added body polygons and precise
box-by-box crown/tier/rim solids. There is no tower- or plaza-wide collision
envelope. The taper leaves free air beside the upper tiers, and the adjacent
plaza remains open. Existing source navigation is untouched.

## Exact legacy correction and reverse audit

`westCivicV210Previous.json` stores the unchanged original v182 JSON SHA-256,
original array lengths, and exactly 10 artwork box rows / 100 rbb wire rows
with their original indices. `keepCivicBoxV182V210` and
`keepCivicSegmentV182V210` remove a row only when both index and every value
still match. Any reordered/modified source fails open and stays visible.
The four old basin frame lines and all other entries remain intact. There are
no generic-owner transfers.

`restoreWestCivicPreviousForTestV210(group,native)` is a guarded test-only
reverse operation. It inserts only those receipt rows into the current
filtered buffers, copying every other current value unchanged. It does not
recreate the old family from an old snapshot. It returns a cleanup callback
which restores the original attribute objects, instance count and bounds.
A test deliberately changes a non-receipt vertex and proves the reverse
operation preserves that change. Both original representations reproduce
bit-for-bit when no unrelated mutation is present.

## Reproduction and checks

```
uv run python scripts/build_west_civic_v210.py
uv run pytest -q tests/test_west_civic_v210.py
bun test src/app/tests/west-civic-v210.test.ts
```

The generator normally reads the committed source receipt. Its initial source
bootstrap used retained local archives and narrowly downloaded temporary
reference metadata; raw photographs are never required for reproduction.
Six Python tests cover complete source retention, source-bound heights,
precise receipt rows, street/courtyard separation and sculpture navigation.
Six Bun tests cover both factories, buffers, independent native construction,
exact legacy reversal and navigation. Eight standalone Chrome/WebGL views
(four sites, both representations) were rendered without page errors, then
inspected for the basin, broadcaster crown and facade alignment. Standalone
views include original source shells; integrated-world checks are done by the
release task. They are not an iPhone hardware stability guarantee.

## Theodor-Heuss-Platz ground-context correction

Integrated review revealed that v182 had reused the old v159 `candidate.gpkg`
crop: the west-lobe building source was present, but the plaza roads and park
were missing. A triangle-level audit of `ring182--14_1.drawn.json.gz` found
only the old olive ground at y=3 beneath the blue obelisk. The `outer187` tile
has no overlapping geometry at that point. This was pre-existing missing
context, not a new height/occlusion error.

`build_west_civic_place_v210.py` supplies the fifth, optional group through the
same West factory. `west-civic-place-v210-source.json` retains the complete
selected PBF polygons, line courses, nodes, tags and source SHA. The rendering
mask is exactly mapped place/square **way/377196797 plus eight metres** of its
immediate edge, wholly inside the existing authorized west lobe. Only derived
display geometry is clipped. No city packet or background ground is rewritten.

The context includes park **way/9873833**, nine mapped grass polygons, a flower
bed, mapped internal paths and the surrounding asphalt courses. Missing road
widths use the existing lane/class estimator and are explicitly recorded.
The 55 trees come only from retained mapped tree nodes; crown dimensions are
modest estimates. No new crossings, traffic signs or buildings are invented.

Roads are unioned before making curb edges. Therefore intersections have no
crosswise curb barriers. The scope cut is applied to the original union's
boundary, not to a clipped polygon boundary; its curb strips remain at least
3.9 cm inside the cut boundary, covered by a dedicated regression. Mapped
pedestrian intersections leave curb gaps. Pavement/grass/road polygons form a
partition over the unchanged y=3 base, at y=3.05–3.23. No opaque plaza rectangle
covers neighbouring streets. The native one-metre pavement cells are merged
into axis-aligned quads without changing their selected coverage.

The revised tests also bind the previous published ring182 packet hash,
validate the precise source scope, curb cut-edge clearance and the five
required/optional groups. The release task performs the final integrated
browser review of this last ground-context addition.

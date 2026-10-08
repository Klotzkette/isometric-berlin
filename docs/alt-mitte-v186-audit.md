# Alt-Mitte complete inventory review — v1.0.86

Step 10 reviews **every record in the complete Alt-Mitte source catalogue**,
including existing authored buildings and records that receive no new detail.
This is an inventory, source-envelope and ownership review, not a claim that
every individual window has been compared with a current street photograph.

## Area and source evidence

The selection is the former district Mitte before the 2001 merger, excluding
Wedding and Tiergarten. The unchanged, unsimplified official Ortsteil polygon
covers 10,673,801.728 m². As documented in
[the historical scope review](alt-mitte-v169-scope.md), it conservatively includes
the later 310 m² unbuilt embankment addition near Schillingbrücke. It is not
mislabelled as a recovered survey of the year-2000 boundary. The 35 source
families crossing the selection line remain whole.

The [machine-readable audit](../geo_data/regierungsviertel/alt-mitte-v186-audit.json)
contains one compact row for every source record, with declared columns, source
chunk, retained/rendered ownership, deepest part/polygon counts, maximum part
display height, previous facade count and material evidence. All 45 source
chunk hashes match the frozen catalogue. The audit does not alter those chunks,
their parts, walls, roofs, courtyard holes, street geometry or viewer packets.

| Complete catalogue | Records |
| --- | ---: |
| Official source families | 13,545 |
| Deepest official parts | 26,768 |
| Original official polygons | 369,689 |
| Independent OSM residual records | 2,369 |
| Total catalogue records checked | 15,914 |
| Unclassified records | 0 |

These are **source counts, not a count of occupied houses**. They include 2,599
official small monument-function records corresponding to the already authored
Holocaust stele field. OSM residuals can be fused with or transferred to official
families; adding them to the official total would double-count physical objects.

## Current ownership and existing detail

The resident Day and Minecraft manifests each retain all 3,983 measured core
parents: 78 drawn packet files and 101 native packet files. The surrounding-city
manifest retains the exact 4,423 moved outer-owner identities, including 32
parents assigned to the core whose full source also crosses the old core line.

Four measured outer parents were deliberately transferred in v1.0.83 to the
dedicated Alexanderplatz/Alexa/station models. They remain in this audit but are
excluded from active generic-facade totals. Their
[existing transfer audit](../geo_data/regierungsviertel/alexander-stations-v183-audit.json)
retains the exact owners and triangle-preservation checks; the complete source
sheets remain in `alexanderStationsV183Source.json`. They are not missing data.

The 5,171 retained official families consist of 2,599 stele-field records, 1,359
source-overlap conflicts and 1,213 other authored/glass families. The existing
representations of all three groups remain protected. The 1,359 conflict cases
retain prior visible mass because replacing it with another whole source shell
would duplicate or displace existing geometry. This review does not misrepresent
them as freshly reconstructed measured facades.

| Active generic ownership | Records | With facade quads | Without facade quads |
| --- | ---: | ---: | ---: |
| Measured core | 3,983 | 2,970 | 1,013 |
| Measured outer, after four dedicated transfers | 4,387 | 3,495 | 892 |
| OSM core residual facades | 585 | 451 | 134 |
| OSM outer residual facades | 122 | 96 | 26 |
| Total | 9,077 | 7,012 | 2,065 |

The 2,065 records without generic facade quads are not automatically unfinished
houses. **1,040 official and 127 OSM records have a maximum part/display height
below 4 m**, below the existing facade eligibility threshold. Other exclusions
include narrow walls, party walls, occupied approaches, gables and source holes.
The review does not invent windows on those surfaces merely to raise a coverage
number. The per-record triangle counts come from the original v169 model before
spatial clipping; they are not a second count of current GPU triangles.

## What the sources do and do not establish

Berlin LoD2 establishes source footprints, wall planes, roofs, heights and court
holes. It contains no surveyed window openings or cornice profiles. The generic
v169 window rhythms therefore remain explicitly **procedural estimates**. Each
window/surround/sill rectangle is required to fit entirely inside its source
wall, including gables and holes; approach probes avoid ordinary party walls.
Small buildings are not automatically assigned the same floors as tall ones.

The retained catalogue contains material/colour context on 2,963 records for
`building:colour`, 2,828 for `building:material`, 3,329 for `roof:colour`, and
2,872 for `roof:material`; 7,684 records carry `building:levels`. These are raw
source-tag occurrence counts, including overlap context and repeats across
source families, not independent verified house-colour measurements. Explicit
prior authored colours and glazing remain more specific presentation evidence
than a district-wide fallback palette.

## Efficient improvement boundaries

Both the resident source shell and the separately streamed v169 facade quads
use mesh kind `alt-mitte-v169`. Core drawn packets contain source shells;
external drawn packets contain their facade quads plus complete outer shells.
The earlier v184 generic recolouring selects only mesh kind `city`, which
explains why it did not alter many of these pale Alt-Mitte surfaces.

An inexpensive recognition pass can work with existing facade geometry rather
than adding another full copy of the district. The generic v169 layers are
source-clipped surrounds, glazing, mullions and sills. Their roles were not
stored as packet metadata, so matching must remain conservative: an arbitrary
stone or blue-grey source surface is not automatically a generic window.
Native Minecraft colours have their own baked shading and must be handled as
their own representation. Whole-shell generic overrides must not paint over
dedicated buildings or erase existing mapped material evidence.

The modest v186 renderer/edge changes are documented separately. This audit is
evidence only and neither introduces geometry nor changes release metadata.

## Reproduction and limits

```sh
uv run python scripts/audit_alt_mitte_v186.py
uv run pytest tests/test_alt_mitte_v186_audit.py
```

The script checks all source hashes and identities, exact core resident-parent
sets, outer moved-owner sets and documented later transfers. It inventories
every record but does not claim a photograph survey of every house, a surveyed
window count, or certainty that every current street-facing facade matches the
latest real-world alterations. Those require building-specific evidence rather
than invented decorative detail.

Underlying official data remain Geoportal Berlin / ALKIS and LoD2,
dl-de/zero-2-0; OSM context remains © OpenStreetMap contributors, ODbL 1.0. Source
URLs and their existing archival hashes are retained in
[the complete source manifest](../geo_data/regierungsviertel/alt-mitte-v169/source-manifest.json)
and [source documentation](alt-mitte-v169-sources.md). No new image or texture is
distributed.

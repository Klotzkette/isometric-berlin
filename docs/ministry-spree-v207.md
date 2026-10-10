# Step 10 — Kapelle-Ufer ministry, v1.0.107

The requested modern green ministry is the 2014 Heinle Wischer building at
Kapelle-Ufer 1, historically the Bundesministerium für Bildung und Forschung.
The retained OSM identity is `way/1302352107`, currently named Bundesministerium
für Forschung, Technologie und Raumfahrt. It is distinct from the interim
Bundespräsidialamt/SpreebogenOffice and the separate Education/Family ministry.
No Detlev-Rohwedder-Haus geometry is included in this supplement.

## Complete source family

The unchanged official family `DEBE01YYK00005iG` supplies ten building leaves.
The low front entrance portico is a separate official owner
`DEBE01YYK0001xGY`, with its own measured 8.133 m height and thirteen wall/roof
sheets. It is essential to include this independent entrance owner: decorating
only the main family's recessed lobby leaves its earlier generic front shell
visible. The eleven owners have **138 complete original wall/roof sheets**.
The source receipt keeps every original millimetre vertex, all three main
footprint holes, the exact earlier prism records and each existing display
height translation. No owner, voxel, courtyard or source triangle is suppressed.

The official source is the retained 2 March 2026 Berlin LoD2 tile
`LoD2_389_5820.zip` (dl-de/zero-2-0). Source, prism, native raster and OSM input
hashes are frozen in `src/app/src/data/ministrySpreeV207Evidence.json`.
The approximate site envelope is x=207–367 m, z=−566…−382 m in the established
viewer frame. This adds no geography, city chunk, residency budget or tour stop.

Exact runtime owners:

```
DEBE3DJFYzwKd88t  DEBE3Dl10HCH67YQ  DEBE3DKGGir04pfY
DEBE3DBlrT1zM4av  DEBE3DEBalHQjLM0  DEBE3DQYkj2kXcNG
DEBE3DtlPX6C0SWB  DEBE3DvYGtxhg1Aq  DEBE3Dd2A3JNOhIR
DEBE3DxOdMgSqbjR  DEBE01YYK0001xGY
```

## Recognition details and limits

The drawn supplement follows 110 exposed measured wall planes, subtracting
only occluded portions of the *new attachments*. The complete earlier building
geometry remains rendered. Sage-grey stone, thin floor bands, five tall upper
window rows above the lower storey, narrow pale/mint ventilation panels, bronze
lower window surrounds, entrance glass/green piers and the four measured dark
technical-roof bars provide the building's recognisable structure.

The shallow veneer is 0.335 m beyond its source wall, and frames stay within
0.75 m, clearing earlier generic facade decorations without deleting them.
Heinle Wischer documents photovoltaics on the roof and facade. The 127 small
roof panel divisions are an explicitly approximate reading on the four
existing measured technical-roof surfaces; their footprints are checked
inside those roofs. Equipment layouts and individual panel locations are not
claimed as survey evidence. No new rooftop mass or courtyard canopy is added.

The three freely licensed Fridolin freudenfett Commons photographs dated
9 April 2016 guide material colour, aperture rhythm and entrance appearance.
Their individual CC BY-SA 4.0 metadata is in
[`ministry-spree-v207-sources.json`](ministry-spree-v207-sources.json).
Photographs and architect plans remain reference-only and are not bundled as
textures. Window positions, frame proportions, panel arrangement and night
occupancy are procedural display estimates.

## Native representation and memory

Minecraft retains the original 4 m raster and the complete Alt-Mitte v169
native source shell. The latter uses 2 m surface courses and extends beyond
many raster faces; fitting detail to the raster alone left its windows hidden
behind broad old grey wall strips. The final native attachment follows the
combined exterior of both retained shells on their common 2 m subdivision.

The receipt keeps **559 raw source cells**, of which the existing v169 exact
legacy ownership rule already transfers 149 to its source shell. This rule
uses frozen decimetre rings, bases and tops from navigation packet 000; it does
not use the newer millimetre footprint to decide a transfer. The surviving
410 raster cells and **956 exact native roof-span records** from packets 006
and 007 produce 2,503 combined cells and 2,262 exposed attachment faces. Every selected
cell has positive intersection with an exact named owner footprint. Each
new panel is only a shallow skin on that existing combined exterior. No source
mesh, window, voxel, roof or native wall course is removed or moved. The
largest cell-centre distance to the complete named source footprint is
1.363 m, within its existing native sampling step. Native source input hashes
and individual span indices/coordinates are preserved in the receipt.

Attachment thickness stays within 0.66 m of a retained native face. Five
upper window rows fit the combined native body datum (5.0–32.8 m); that is
an explicitly native display alignment, separate from the unchanged drawn
wall planes. Courtyard centres remain open. The regression checks complete
window prisms, including the slightly wider night pane, against both source
shells, rather than checking just their centres against one raster.

Both pointer and touch use the same complete arrays:

| Representation | Geometry | Stored renderables | Attribute/index bytes |
| --- | --- | ---: | ---: |
| Drawn | 228 veneer triangles, 14,183 boxes, 177 night panes | 3 | 1,115,156 |
| Native | 17,617 orthogonal boxes, 141 night panes | 2 | 1,349,212 |

The night pane batch is hidden in Day and uses the shared `nightOnly` and
`nightEmissive` contracts, so switching artificial lights off hides it.
Instance buffers are allocated at exact size. Per-world geometries and
materials are independent, and transforms are frozen after construction.
There are no textures, frame callbacks, additional navigation barriers or
mobile quality reductions. Runtime payload: 1,897,243 bytes; source evidence:
698,596 bytes before gzip.

## Integration and verification

`createMinistrySpreeV207(native = false)` returns the dedicated static group.
The generated file has only `owners`, `surfaces`, `boxes` and `blocks` plus the
schema version; it requires no global owner filter. The integration replaces
only the former point-anchored research-ministry motif in
`addGreenFederalCampus`. The separate Education/Family ministry stripes and
every other civic model must remain. The full preservation audit belongs to
the root v207 integration.

Generation: `uv run python -m scripts.build_ministry_spree_v207`.
Focused checks: `uv run pytest -q tests/test_ministry_spree_v207.py` (4 passed)
and `bun test tests/ministry-spree-v207.test.ts` under `src/app` (4 passed).
These verify unchanged source hashes, exact per-leaf height translations,
measured-plane clipping, roof panel containment, open court centres, fully visible native
window extents against both retained shells, original column/span receipts, tight GPU buffers, native
axis alignment, independent disposal and the lights-off contract.

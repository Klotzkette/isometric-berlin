# Streets, curbs and paving

This pass corrects demonstrated road-edge defects in the existing core street
coverage, with surveyed detail around the Chancellery and paving accents west
of the Philharmonie. It is not a claim that every street in Berlin has been
resurveyed. The outer city's complete packet inventory remains unchanged.

## Coarse ground crossing smooth roads

The old flat ground-run boxes used a different terrain sampling convention from
the smooth source road triangles. Some grass and plaza-brick tops consequently
stood above the road or walkway, producing steps across an otherwise correct
contour. Applying another curve smoothing pass would not have fixed this.

The audit captures the final production ground instances **after all earlier
exclusions**, then intersects their actual top with the actual rendered street
triangle planes. The final combined correction touches 2,296 runs / 6,623 cells.
It frees 33,175.098226 m² of previously occluded street and walkway, and replaces
3,567.399966 m² of additional original ground inside the complete mapped plaza
described below. Total original ground transferred is 36,742.498192 m². The
complete outside land complement keeps its original colours and heights.

For each affected span, its complete outside land complement retains the exact
old top, bottom and paint. Original road coordinates and their terrain samples
stay intact. Earlier authored child complements remain present. Source guards
and exact host-span/top checks prevent application to different owners. Native
roads and the walking-height model are unchanged. The shared writer also keeps
non-grid-aligned fragments from earlier entrance cuts byte-for-byte rather than
rounding them back onto the coarse grid.

The final close-view regression also covers millimetre-scale protrusions:
four rays through the formerly visible green wedge at the Chancellery junction
must hit the surveyed asphalt before every retained ground fragment. There is
no five-millimetre deadband; on shallow slopes it left a broad visible wedge.

## Chancellery street edges

A finite transaction replaces 417 asphalt and 1,035 paving triangles only where
the current-checked municipal survey supplies real road/walkway geometry. The
complete outside fragments of those triangles are retained. The survey covers
4,763.767344 m² of carriageway and 4,673.508409 m² of adjoining pedestrian ground,
using the existing centimetre encoding (outside-fragment deviation below 15 mm),
with 812.15 m of kerbs and 459 natural-stone joint runs. Existing mapped
crossings remain open. Small kerb height/width and slab modules are explicit
visual conventions, not surveyed measurements.

The source is the Geoportal Berlin Straßenbefahrung 2014. Its specific retained
contours are compared with official DOP 2025 and the owner's street photographs.
The historical road north of the Swiss embassy, now absent, is deliberately
excluded. Old isolated joint marks inside the changed area move with the same
admitted street transaction; fountains and all outside marks remain untouched.
See [the local source and verification notes](mitte-roads-v343.md).

## Philharmonie-West

The completed 2019 redesign takes precedence over the older 2014 road survey.
Fine joints use the supplier's published slab format on 918.276367 m² of already
present paving. An additional 3,581.982352 m² restores the continuous pedestrian
plaza from the complete retained OpenStreetMap relation 9976187, after excluding
existing smooth paths, planted islands, buildings, Serra and T4. Its surface
follows the retained terrain; filtered procedural joints avoid distant shimmer
without adding image files. Six mapped trees retain small open surrounds, with
the conservative one-metre protection distance explicitly marked as an estimate.

The new plaza and its exact original ground replacement are admitted together;
a missing replacement or source host leaves the old ground intact. The earlier
drawn joint detail follows its supporting triangles, and independent cardinal
native details rest on actual block tops with no floating fallback. The material
reference, approximated laying pattern and bounds are documented in
[the paving notes](kulturforum-paving-v343.md).

## Preservation and delivery

All 2,906 surrounding-city descriptors and 5,812 mode packet assets are retained.
The six modes, 93 tour stops, complete mobile detail, existing source data,
streaming/decode/prefetch budgets and the recent first-frame fix remain present.
No photo texture, remote GitHub packet fetch or animation is added.

Verification combines exact source/geometry receipts, untouched outside-owner
checks, previous curb/terrain/entrance regressions, TypeScript compilation,
production build, package validation and the internal browser. Source-history
v343 records the finite delta against published commit
`cceedb466463c5ba2f3eb37a81b01513740544b1` without rewriting older fixtures.

Measured addition on the captured full ground: 179.51 ms for admission, plaza
construction and ownership, plus 70.15 ms exact geometry compaction. The 68
spatial meshes, including the plaza, occupy 9,231,936 geometry bytes after
compaction, with 233,309 vertices. This is a local CPU
measurement, not an end-to-end startup or device-speed guarantee.

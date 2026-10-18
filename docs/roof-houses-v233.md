# Source roofs and gutters — v233 / Step 10

This bounded pass replaces false flat ordinary-house envelopes with **192
complete measured LoD2 houses**, 32 each in current Mitte,
Friedrichshain-Kreuzberg, Charlottenburg-Wilmersdorf and Schöneberg, plus **64 in
Steglitz-Zehlendorf** after the user's place-name clarification. All houses
already existed in source coverage. It does not assert that every house in these
districts has received an individual survey. The shared official selector is
`geo_data/regierungsviertel/house-districts-v233.geojson`, now including all eight
Ortsteile of Steglitz-Zehlendorf. The extension uses only already local original
archives and existing streamed city packets.

The previous 128 owner records and 206 family recipes are preserved exactly.
The additive extension uses different existing packet locations; canonical
hashes of every prior recipe and the full old owner list are stored in the
source receipt and checked during every replay. No old house is reselected.

The selection is distributed spatially across 2,071 eligible pitched-roof
owners, with at most five houses in any original packet. Named/special-use
buildings, existing authored owners, earlier individually fitted facade passes,
ambiguous matches and tile-cut owners are protected. There are 147 affected
existing packet locations, each with separately supplied drawn/native geometry.
The 64 additional houses comprise 32 in Steglitz, 18 in Dahlem, eight in
Lichterfelde, four in Schlachtensee and two in Zehlendorf. The district selector
also includes Lankwitz, Nikolassee and Wannsee, but this retained archive subset
does not supply eligible measured replacements there; none are invented.

## What is measured

All **5,465 original wall and roof sheets**, including their original polygon
holes, leaf parts, millimetre source coordinates, parent IDs and archive
fingerprints, are retained in `roof-house-v233-source.json.gz`. These are from
local Geoportal Berlin `a_lod2` archives, under the existing dl-de/zero-2-0
attribution. No new download or district expansion is needed. Shape and pitch
come from these sheets, never an invented generic gable or dormer.

The projected footprint must match the old envelope within 0.1% or 0.2 m²,
and the source height must match within 12 cm. Every old envelope is independently
reconstructed from its original navigation record, triangulated, and matched
as a complete position-and-colour triangle multiset. This protects unrelated
triangles, including duplicate neighbouring party-wall geometry. Source assets
stay byte-identical. The tiny encoded-identity guards at runtime fail closed
when any source stream or origin changes.

The house receives one rigid vertical shift to its existing ground placement.
No roof vertex changes relative to another source vertex. Final drawn storage
uses the existing packet centimetre precision; the unrounded source is retained.
The old flat-cap outline is retired by an exact segment receipt, avoiding a
floating horizontal line above the actual slope.

## What is illustrative

**571 gutter courses** follow lower horizontal outside roof edges. Ridges,
valleys, internal seams and sloping gable rakes are excluded. The 16 cm width,
14 cm depth and metal tone are restrained display estimates; LoD2 does not
survey rainwater hardware. No downpipe position is claimed.

Unique reciprocal 97% OSM footprint matches may retain mapped roof material or
colour from the existing v232 source context. Otherwise neutral roof/facade
tones and plane shading are illustrative. No material is inferred solely from
the roof angle. Original prior colour receipts for every unrelated house still
see their exact original encoded packets.

Native geometry is independent: the same source roof is sampled on the existing
two-metre orthogonal grid, with measured heights rounded to that native grid.
Every occupied native footprint cell is represented. Only exposed side/step
walls are emitted; hidden internal wall stacks are omitted. Gutters follow its
represented orthogonal roof edges. Native is not a smooth-roof double.

The old conservative navigation envelope remains unchanged. Walking collision
therefore still uses the existing maximum-height house envelope, not a newly
introduced fine pitched-roof walking surface. Public approaches and source
ground/courtyard navigation remain as before.

## Lifetime and budget

`prepareRoofHouseV233` validates, then adds the complete replacement to the same
packet transaction. Old geometry is retired only in final decoded index/line
buffers, after all earlier exact-source transfers and material passes. Original
encoded mesh identity stays intact. Cancellation before publication leaves the
existing house complete. There is no separate transient empty-house state.

The eager packet-key list avoids hydrating geometry for unrelated city packets.
The large `packets` constructor input can use the existing lossless weak JSON
storage; no permanently resident scene, new city request, texture, per-frame
work, increased radius or raised residency limit is introduced. Drawn mobile
and pointer detail are identical.

Total new packed geometry is **24,446 drawn vertices / 19,040 triangles** and
**51,853 native vertices / 53,718 triangles**. Maximum added vertices in one
packet are unchanged at 621 drawn / 1,174 native. Runtime JSON is about 2.35 MB
before build compression, retained full source about 266 KiB gzip. Existing packet geometry
remains below its original 400,000-vertex and 16-part limits, with room reserved
for the parallel door and pavement supplements.

## Verification

Five Python tests verify the full measured source inventory, district bounds,
immutable old hashes, exact multiset transfers, every native footprint cell,
strictly orthogonal native faces, source-bound eaves, bounded packet growth and
unchanged released owner/recipe hashes.
Four Bun tests verify all 294 family transactions, previous byte identities,
unrelated indices/line colours, changed-source rejection, idempotence and
cooperative cancellation. Integrated browser checks belong
to the release, not this isolated geometry audit.

Replay: `uv run python scripts/build_roof_house_v233.py`.
Re-extract from already local original archives only with `--extract`. The
one-time additive extension was extracted with `--append-steglitz-zehlendorf`;
repeating that command is rejected rather than duplicating owner records.

Representative viewer targets (X, Y, Z):

| Area | Owner | Target |
| --- | --- | --- |
| Charlottenburg-Wilmersdorf | DEBE04YY500008UE | −4528.63, 10.16, −1497.14 |
| Friedrichshain-Kreuzberg | DEBE02YY200005Kq | 5815.80, 12.61, 1286.45 |
| Mitte | DEBE01YYK0002RhV | −2285.69, 14.48, −1367.54 |
| Schöneberg | DEBE07YY90002dYr | −624.29, 10.30, 4279.77 |
| Steglitz-Zehlendorf | DEBE06YYB0000EZ1 | −5893.07, 3.00, 6417.80 |

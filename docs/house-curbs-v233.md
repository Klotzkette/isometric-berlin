# Source-supported curb supplement, v233

This is a small supplement to retained street and pavement geometry, not a new
border around every road. The full current Mitte, Friedrichshain-Kreuzberg and
Charlottenburg-Wilmersdorf districts and Schöneberg Ortsteil are selected by
`house-districts-v233.geojson`, intersected with existing coverage. The original
detailed core is excluded because its raised street edges already exist.

## Evidence and limits

The retained source extract comes from the OpenStreetMap Geofabrik Berlin
2026-09-29 dataset (ODbL-1.0). Selection includes complete at-grade
`barrier=kerb` ways of 2–120 metres that explicitly declare `raised`/`regular`
or a positive height. Lowered, flush, rolled, disused and nonpositive curbs are
excluded. The 72 selected original ways and their tags remain in
`house-curbs-v233-source.json.gz`; 43 contribute visible additions after cuts.
This does not claim comprehensive curb coverage or surveyed dimensions.

The original source courses determine position. A 0.22 m drawn width and an
untagged 0.12 m rise above the retained 3.09 m street datum are display estimates.
Explicit 0.05 m source heights stay 0.05 m. Conservative gaps remain at mapped foot/cycle access ways and vehicle
ways. Building and water footprints, existing curb families and the retained
v163 western street corridors are excluded. Previously modelled curbs are not
duplicated. No new curb geometry changes walking collision or navigation.

Every rendered course must also lie on actual near-horizontal ground triangles
of its existing city packet and within that packet's navigation ground. Raised
terrain is excluded. The drawn version follows the source course; the separate
native version follows the same course on a 0.25 m grid. Native square cells
must be entirely inside supported ground and clear of exclusions. Unioning
adjacent cells and removing exactly collinear boundary vertices eliminates
hidden internal faces without changing their footprint.

## Runtime ownership

`prepareHouseCurbsV233(chunk, id, minecraft)` is a cancellable generator that
returns a new chunk with one packed mesh appended. Original mesh objects,
lines and navigation stay unchanged. The source origin and millimetre ground
fingerprint must match; otherwise it safely returns the unmodified chunk.
Repeated preparation is a no-op. The supplement therefore uses the existing
packet loader, bounds, residency and disposal, with no extra manifest entries,
groups, textures, moving objects or budget increases. Drawn mobile and desktop
use the same geometry; the native family has its own packed geometry.
A small eager packet-key list rejects unrelated packets before reading the
packed-data field, allowing that field to use the application's weak cache.

Final footprint: 66 visible courses, about 1,032 m, in 16 existing packet IDs
(32 separate family entries). Drawn data contains 2,984 vertices / 54,792 packed
bytes. Native data contains 4,883 quarter-metre cells, represented by 12,986
vertices / 356,730 packed bytes. The runtime JSON is 554,550 bytes before normal
transport compression. Retained source and evidence files are 145,995 and
11,536 bytes. The evidence records original packet and input hashes, courses,
counts and the output hash.

## Reproduction and validation

```sh
uv run python -m scripts.build_house_curbs_v233
uv run pytest tests/test_house_curbs_v233.py -q
cd src/app
bun test tests/house-curbs-v233.test.ts
```

Use `--extract` to recreate the retained source from the original local GPKGs.
Ordinary builds and tests use the frozen source and existing city packets.
Python checks source eligibility, input identity, exact source-course retention,
exclusion clearance, original ground support and orthogonal native geometry.
The browser-side tests check every family packet, additive immutable behavior,
unknown/mismatched ownership, idempotence, cancellation and the unrelated-packet
lazy-read guard. Three Python tests and four Bun tests (265 assertions) pass;
Ruff is clean.

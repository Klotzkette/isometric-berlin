# Complete mapped BER airport — v1.0.136 / Step 10

This finite supplement completes the existing BER footprint in Brandenburg and
its mapped terminal forecourt/access owners. It adds no surrounding districts.
The frozen OpenStreetMap extract supplies complete rings, holes and axes;
FBB airport/terminal descriptions and the tower architect support interpretation.
All inputs and approximations are recorded in the linked source evidence.

## Airport grounds and architecture

Both retained runways, their current 06/24 designators, taxiways, aprons, mapped
stands, service roads, terminal access and station entrances are represented.
T1, T2, piers, the DFS tower, central parking structures, hangars and other mapped
airport buildings gain source-bound bodies. Existing T1 glazing, roof/column
geometry and runway markings remain. Underground station and pump levels are
not turned into above-ground buildings; construction and ruins remain outlines.

One old coarse Nordpier cap incorrectly covered two lower T2 connectors. An
isolated offline-derived replacement subtracts only those two mapped footprints,
including native roof runs, while retaining the original v205 source file.
These connectors use their tagged minimum and maximum heights. Ordinary facade
subdivisions, unspecified heights/widths and access-deck levels are estimates;
this is an abstracted exterior model, not a survey or an airport interior model.

## Source and preservation

- [Ground/transport evidence](ber-ground-v236.md).
- [Architecture and roof correction](ber-buildings-v236.md).
- [Exact additional flood coverage](ber-flood-v236.md).
- [FBB airport facilities](https://corporate.berlin-airport.de/de/unternehmen-presse/ber/flughafenanlagen.html).
- [FBB terminals](https://ber.berlin-airport.de/de/orientierung/terminals.html).
- [FBB runway renumbering](https://corporate.berlin-airport.de/en/company-media/media-portal/pressemitteilungen/2024-10-01-slb-umbenennung.html).

All 2,012 previously released city descriptors, payload bytes and footprints
are checked against v1.0.135 before the finite addition is published. Negative
controls reject omitted, changed, unreceipted or corrupt data. The older audit
chain independently retains its own complete predecessor checks.

## Runtime and validation

86 additional 512 m tiles use the existing serial cancellable decoder, pooled
materials, bounded residency and offscreen retirement. The metadata descriptor
allowance increases from 2,048 to 2,112; the offscreen retirement threshold stays
at 24 MiB, decoded packets at 12 MiB and lookahead at 4 MiB/two packets. There is no new permanent
airport scene root, texture, animation loop or mobile detail reduction. Each
family is built independently; native faces remain axis-aligned. Existing six
modes, seven rotating flight starts and all 93 tour stops remain intact.

The complete new airport geometry totals 1,516,872 bytes drawn and 15,104,040
bytes native. Largest packet geometry is 1,825,176 bytes; maximum packet counts
are two parts, 68,006 vertices and 252,276 indices. Both families decode without
changing their encoded source, keep native faces orthogonal and free offscreen
geometry through the existing controller. Footprint metadata alone is normalized
to centimetre precision; rendered surfaces and packet navigation retain their
established packet precision. The 2,098-descriptor manifest remains below 2 MiB.

The additional water mask is exactly the prior released extent union the final
BER footprint, adding 1,459,526.236 m². No earlier water coverage is removed.
Its gzip asset remains 883,772 bytes and decoded payload 2,830,948 bytes, below
existing 1/3 MB limits.

The full existing Python regression run completes with 1,423 passes and four
pre-existing skips; two version assertions observed the in-progress version
change in already-imported modules and pass in a fresh final-version run.
The 61 integration/preservation regressions pass again against the final
manifest, including corruption/deletion negative controls. New source, native,
roof-cut and water-coverage checks cover the final geometry. The selected runtime
suite passes 90 tests, including actual decoding of all 172 airport packets.

Production TypeScript and Vite compilation pass. Due to limited local disk
space, the unchanged Vite configuration is built with its public-directory
copy disabled; all public files are then APFS-cloned and individually SHA-256
checked. This changes storage only, not the generated viewer or asset inventory.
The targeted desktop views cover T1, midfield, the northern apron and southern
runway, plus night and native T1. All BER navigation tiles retire after leaving
for the city. Maximum-zoom BER mode cycles pass in Chromium and WebKit with
an iPhone 13 viewport/touch profile: all six modes, followed by return to day,
without JavaScript errors, context loss, crashes or a reset to the chooser.
These are browser-emulation checks, not physical-phone endurance measurements.
The sampled whole-view GPU buffers reach 236.90 MiB in desktop native mode and
64.28 MiB in mobile native mode; these include existing Berlin content and are
not a claimed 24 MiB global cap. Airport geometry follows the unchanged stream
lifetime and totals less than 15 MiB even in its full native representation.

Final-version source, preservation and release reruns resolve the in-flight
version/staging mismatches above: 1,443 distinct Python tests pass with four
pre-existing skips across the full run and final reruns. The final release,
packager and version subset passes 105 tests. Ruff, TypeScript, production
compilation and all 90 selected runtime tests pass.

The complete static package contains 4,540 files and 895,684,508 bytes
(854.191 MiB). Its finite archive-only allowance is 855 MiB; runtime limits are
unchanged. Canonical ZIP readiness and every TAR member's path, size, inventory
and SHA-256 are checked before upload. Disk-saving APFS clones and streamed
archives preserve the complete byte-identical package.

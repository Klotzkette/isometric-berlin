# Steglitz-Zehlendorf house clarification — v1.0.134 / Step 10

The owner clarified “Wuhledorf” as Steglitz and Zehlendorf. The existing v233
ordinary-house treatment now also selects the eight complete official Ortsteile
of Bezirk Steglitz-Zehlendorf: Steglitz, Lichterfelde, Lankwitz, Zehlendorf,
Dahlem, Nikolassee, Wannsee and Schlachtensee. These administrative rings select
existing delivered geometry only; no new city coverage or generic fill is added.
The original sixteen selector features remain unchanged. The additional WFS
response hash and the clarification are retained in house-districts-v233.geojson.

## Architecture and preservation

64 further complete measured LoD2 houses receive their original wall and roof
sheets plus 154 source-aligned eave gutter hints. The resulting 192 houses retain
all previous 128 owners and 206 family recipes exactly. New selection comprises
32 Steglitz, 18 Dahlem, 8 Lichterfelde, 4 Schlachtensee and 2 Zehlendorf houses,
from 734 eligible complete source matches. No missing roof is invented in the
other Ortsteile. The same gutters, source/material distinctions and native grid
rules apply; see [roof evidence](roof-houses-v233.md).

365 additional mapped entrances (349 Steglitz, 7 Dahlem, 6 Lichterfelde and
3 Zehlendorf) bring the total to 3,515 drawn / 1,862 native doors in 183 tiles.
Another 143 mapped curb ways provide 5.25 km of flat edge courses in Steglitz
and Dahlem, with actual surface support and no overlap with buildings.
Mapped entrances and curb edges follow the same source-bound treatment. Existing
entrance recipe rows remain unchanged prefixes; existing raised curb courses and
packets remain identical. See [entrance evidence](house-doors-v233.md) and
[curb evidence](house-curbs-v233.md) for source matching, counts and display limits.
Door sizes, panels and colours, gutter cross-sections and line width remain
illustrative. Mapped curb courses with unknown height are flat markings on the
actual retained ground, with a 1 cm rendering offset, not invented steps.

## Runtime

The existing three preparation modules are reused, including their small eager
packet indices, weak lossless constructor inputs and cancellable ownership
transaction. The additions merge into existing tile buffers and draw calls;
no extra city manifest entry, texture, animation or per-frame task is introduced.
Full drawn detail remains identical on desktop and mobile; Minecraft retains its
separate orthogonal construction. Source packets, previous authored buildings,
terrain/navigation, 93 tour stops, six modes and seven flight starts are retained.
Existing limits of 16 parts, 400,000 vertices and 2,400,000 indices per packet and
all resident CPU/GPU budgets remain unchanged.

An independent comparison of all 472 affected family inputs against v1.0.133
preserves original asset hashes, navigation, lines and mesh identities. Across
all affected packets, the aggregate mesh-buffer increment is 453,702 bytes drawn
and 978,096 bytes native, with 54 changed families each; this is not simultaneous
residency. Maximum packet increments are 79,368 / 152,892 bytes respectively.
There are no new buffers or index-width promotions. Measured packet maxima are
6 parts, 280,328 vertices and 1,332,768 indices. Flat curb edges do not overlap
between packets; detail companions cannot own additions.

The complete extracted offline package is 887,382,699 bytes (846.274 MiB).
Its archive-only ceiling moves from 846 to 847 MiB; no runtime ceiling changes.
Release readiness including the complete ZIP passes. The deterministic tar.gz
stream is checked member by member against all 4,368 staged files. Uploaded ZIP
and tar.gz sizes and SHA-256 digests are verified against the GitHub asset API;
the matching checksums accompany both archives. Previous hashed Pages assets
remain available for older open tabs.

## Validation

The production TypeScript/Vite build passes. All 14 changed house-source Python
tests pass, as do the 14 roof/door/curb/integration Bun tests and 48 relevant
residency, attachment and decode regression tests. Ruff format/check is clean.
Production screenshots check measured roofs in Steglitz and Zehlendorf, plus
night and separate native geometry in Steglitz, without page or context errors.
Close views verify mapped doors in both Ortsteile and flat edges in Steglitz.
Chromium desktop and WebKit with an iPhone 13 profile each complete seven
maximum-zoom samples across all six modes and back to day, with no page error,
context loss or reset. Tracked GPU buffer peaks are 288.92 MiB and 87.28 MiB
respectively (including native mode); differing viewports retain different
visible packets. Fresh normal starts pass in both engines, stay in flight,
and show no minimap or viewer controls during loading. These are automated
browser checks, not measurements on a physical phone or a crash-free guarantee.
The complete Python suite is split between unchanged regression tests
and the four changed house-source files, so source extraction can finish before
the latter checks run: 1,406 + 14 passed, four pre-existing skips, two existing
CRS fixture warnings. No tests are excluded from the combined run. The 101
release/packager tests pass again after the measured archive ceiling update.

Sources: Geoportal Berlin LoD2 and ALKIS (dl-de/zero-2-0), and retained
OpenStreetMap/Geofabrik Berlin data © OpenStreetMap contributors (ODbL-1.0).
No photograph or texture is bundled.

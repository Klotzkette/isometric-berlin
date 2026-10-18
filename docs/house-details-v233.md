# Ordinary house architecture — v1.0.133 / Step 10

This pass refines ordinary buildings in existing modeled coverage of the current
Mitte, Friedrichshain-Kreuzberg and Charlottenburg-Wilmersdorf districts and the
Schöneberg Ortsteil. The complete official ALKIS Ortsteil rings are retained in
`geo_data/regierungsviertel/house-districts-v233.geojson`; they select existing
source packets and do not extend city coverage. The ambiguous name “Wuhledorf”
was left open in v1.0.133. The owner subsequently clarified Steglitz-Zehlendorf;
see [the additive v1.0.134 supplement](house-details-v234.md).

## Source-supported additions

- **128 ordinary houses**, 32 per requested group, receive their complete
  measured LoD2 wall/roof surfaces in place of verified coarse flat envelopes.
  **417 eave courses** carry small gutter hints. All original sheets and exact
  old-owner replacement receipts remain available. The original packed source
  streams remain byte-identical; only receipted obsolete triangles and lines
  retire in the final decoded buffer after earlier material/ownership passes.
- **3,150 mapped entrances** on 157 existing tiles gain shallow doors, frames,
  glass and handles. Their positions follow OSM entrance nodes and actual source
  wall planes; door dimensions, panels and colours are display estimates. The
  independent native family supports 1,681 corresponding placements.
- **66 supported curb courses**, approximately 1,032 metres, follow positively
  raised OSM curb geometry on existing ground, with mapped access gaps retained.
  Already modeled curbs, buildings, water and unsupported terrain are excluded.

This is a measured, bounded improvement, not a claim that every door or roof in
these districts has been independently surveyed. Named and previously authored
buildings retain their existing detail. No fictional shop fronts or generic
pitched roofs are added. Source and selection details:
[roofs](roof-houses-v233.md), [entrances](house-doors-v233.md),
[curbs](house-curbs-v233.md).

## Runtime and preservation

All three supplements join the existing unpublished city-packet generator and
aggregate into its existing mesh buffers. There are no new manifest entries,
resident scene groups, textures, per-frame work or draw calls. Tiny eager ID
indices avoid hydrating unrelated recipe collections; constructor-only data
uses the existing weak, lossless source cache. Cancelled preparations never
publish a partial replacement, and normal packet parking/eviction owns all added
geometry. Byte accounting includes every added vertex and index.

Existing limits remain 16 mesh parts, 400,000 vertices and 2,400,000 indices per
packet, with unchanged global residency budgets. Full drawn detail is shared
by mobile and desktop. Minecraft retains independently generated orthogonal
source geometry. The 93-place catalogue, previous detail, six visual modes and
seven rotating flight starts remain intact. These presentation changes do not
add walk-through doors or new collision barriers; existing building navigation
is retained.

The complete offline package occupies 845.03 MiB extracted. Its archive-only
ceiling moves from 844 to 846 MiB to include the additions; this does not change
any runtime, mobile or GPU allowance.

## Validation

The combined integration suite constructs all **364 affected packet/family
combinations**, verifies source immutability and idempotence, checks every packet
against unchanged geometry limits and compares reported geometry bytes with all
actual buffers. Separate source replays verify roof-owner replacement, entrance
alignment, curb eligibility and source hashes. The production TypeScript/Vite
build and 77 targeted Bun checks pass, including
lossless source-cache round trips and prior facade/ownership preservation.

Chromium desktop and WebKit with an iPhone 13 profile each complete 14 wide-view
samples across all six modes and a return to day, with no page error, context
loss or entry-screen reset. Ten desktop detail views cover the four house
areas, a mapped entrance and curb, including night and native mode. Before/after
images confirm the
measured roof replacement and retained surrounding geometry.

A matched old/new wide-view run waits until the same 278 city tiles have finished
loading. GPU attributes increase by 847,080 bytes (0.81 MiB); resident city
geometry increases by exactly the expected 1,300,362 bytes. Across all 364
packet/family combinations, Drawn increases by 2,660,496 bytes and Native by
2,274,444 bytes, with no index-width changes. Only two bounds expand, each by
9 cm. Earlier short snapshots sampled different loading states and are not a
like-for-like memory comparison.

Browser device profiles do not reproduce physical phone RAM limits and are not
an unconditional crash-free guarantee.

The full Python suite passes **1,417 tests with four skips** (20 min 24 s); two
existing fixture CRS warnings remain. Ruff formatting/lint and whitespace checks
pass. Release readiness passes including the complete ZIP. All 4,368 tar members
were verified byte-for-byte while streaming, and both uploaded archives plus
the checksum file match their SHA-256/size receipts. Streaming avoids a second
large local archive copy. Prepared Pages publication retains 1,542 older hashed
assets so existing browser sessions keep their imported modules.

Sources: Geoportal Berlin LoD2 and ALKIS (`dl-de/zero-2-0`), and retained
OpenStreetMap/Geofabrik Berlin data © OpenStreetMap contributors (`ODbL-1.0`).
No new image or texture is bundled.

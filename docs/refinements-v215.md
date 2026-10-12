# Hospital roof and Kieler Eck corrections — v1.0.115 / Step 10

The owner identified a false pointed roof on the modern Bundeswehrkrankenhaus
ward and inaccurate homes directly beside the Günter Litfin memorial. Baseline:
v1.0.114, commit `55a7a052`. This is a bounded correction inside existing city
coverage. The historic hospital wings, memorial tower, helicopter, mapped
helipad, unrelated earlier facade details and 93-stop tour remain protected.

## Source corrections

The modern ward roof must follow inspected official aerial/height evidence,
with exact obsolete owner transfer and complete retained source receipts.
The immediate Kieler Straße neighbours receive individual source-plane detail.
The additional Bundeswehr new-build is interpreted as the Zentrales
Springergebäude at Golda-Meir-Steg (OSM way 1282540270). This assumption was
stated to the owner; it was not confirmed by an answer. Named source geometry
and [primary facade photographs](https://www.kalzip.com/news/baustelle-der-woche-springergebaeude-bundeswehrkrankenhaus-berlin/)
support its identity and white/anthracite bands with lime-green accents.
The current wide stair-core footprint differs from the old LoD2 interpretation;
an exact owner transfer replaces only `DEBE01YYK0000Eik`. Both source records
remain retained, and official DOP/bDOM evidence anchors the present roof.

## Validation

Individual evidence, receipts, geometry costs and estimates are documented in
[hospital roof](bundeswehr-hospital-v215.md), [Kieler Eck homes](litfin-neighbours-v215.md)
and [Springergebäude](springer-v215.md).

The complete extracted package measures 875,666,013 bytes (835.100 MiB).
The finite archive-only ceiling becomes 836 MiB, leaving 0.900 MiB headroom.
This has no effect on live packet, decode, GPU residency or mobile detail limits.
All canonical city packets, roads, waterways, source sheets and prior textures
remain retained. No replacement photographic textures or animation are added.

Verification before publication:

- Ruff format/check pass across 536 Python files. TypeScript and the final
  production build pass.
- Existing Python regression run: 1,212 passed, four skipped. The separate
  focused building run passes 12 checks; the release suite passes 76.
- Bun ownership, geometry, native preload, cancellation, navigation, mobile
  parity and outline integration checks pass. The worker regression caught
  otherwise unused new navigation data; effect-free declarations now tree-shake
  correctly (48,909 bytes in the existing 100,000-byte probe). No threshold rose.
- Chrome and mobile WebKit each pass 18 views: hospital, Litfin neighbours and
  Springergebäude in day, night, snowstorm, Schwellenraum, flood and Minecraft.
  All five transitions retain the camera, all three required models are present,
  and no page error, context loss or scene fallback occurs. These are automated
  browser/emulation checks, not a physical iPhone endurance test.
- Release readiness, both archives and the complete local launcher package
  pass. The prepared Pages tree retains 1,213 prior hashed assets; all `mesh/`
  and `dzi/` files are byte-identical to the previous published tree.

The final checksums are in `releases/SHA256SUMS.txt`. The APFS clone-copy packaging
path produces independent regular files, with the same complete payload and
archive checks as the standard packager.

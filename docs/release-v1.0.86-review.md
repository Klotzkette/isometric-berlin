# v1.0.86 — modest facade refinement throughout old Mitte

## Delivered scope

The complete retained inventory of the former district Mitte was reviewed:
15,914 source records, including 13,545 official families and 2,369 independent
OSM residual records. These are not additive physical-house counts. The
[inventory audit](alt-mitte-v186-audit.md) distinguishes small structures,
already authored buildings, source conflicts, later transfers and generic
facades. Wedding and Tiergarten are outside this pass.

Existing generic window surrounds, glazing, mullions and sills gain restrained
light/shadow differentiation, using their existing colour buffers. The matcher
requires the exact baked source colour, dimensions, four rectangular vertices
and a valid shared diagonal. Clipped fragments and all original positions and
indices remain unchanged. Existing individual landmark models remain intact.
These generic openings remain source-wall-clipped display estimates, not a
claim that every historical window was independently surveyed.

Another 1,780 measured street-facing walls gain two shallow profiles at their
base and upper edge. Every member fits within the actual wall polygon and
below its roof/gable, with ground datum and existing terrain translation
preserved. Named-street visibility and outward approach checks exclude ordinary
party walls and internal courts. Later authored owners and mapped glass are
protected. Sections and materials remain declared estimates;
[selection and provenance](alt-mitte-edges-v186.md) document the limits.

## Preservation and cost

No previous source packet, building, courtyard, road, path, terrain, viewing
distance or navigation setting is deleted, simplified or replaced. The window
change allocates no additional GPU geometry, texture, shader or frame-time
effect. Its decoding work yields every 4,096 source indices.

The additive edge payload is 226,853 bytes and uses 54 independently culled
cells. Drawn modes add 3,560 instances / 270,560 instance-buffer bytes; the
separate native Minecraft representation adds 28,032 orthogonal contour steps /
2,130,432 instance-buffer bytes. Only the active representation is allocated.
The same static detail is delivered to pointer and touch devices.

## Validation — 8 October 2026

- Full Python regression: **905 passed, four skipped**, in 564.75 seconds.
  Two existing synthetic geodata-export warnings concern omitted CRS metadata
  in a test fixture; no test failed.
- Final targeted Bun suite: 22 tests / 309,939 assertions passed, covering both
  additions, real-packet preservation, older-browser decoding and the previous
  generic colour and Alt-Mitte runtime paths. TypeScript and production build
  passed. Whole-repository Ruff check and format check passed.
- All 45 frozen inventory source hashes and exact current owner sets passed.
  The complete offline window audit matched 1,854,215 existing component quads
  in 60 streamed packets, preserving every position/index byte and stored
  packet hash. This counts window components, not individual windows.
  The separate source-colour audit found no source-shell colour collisions in
  16,708 selected source parts. All 39 tested resident shell meshes were also
  rejected by the relief matcher. The machine-readable result is
  [retained here](../geo_data/regierungsviertel/alt-mitte-v186-relief-qa.json).
- Local Bun decoding measured 345 ms of added relief work across the entire
  district, divided into 2,943 generator slices; the largest measured slice
  was 1.22 ms. These are local measurements, not phone performance guarantees.
- Desktop Chrome traversed six different old-Mitte areas. WebKit with an
  iPhone 13 profile traversed those areas while switching through Day, Night,
  Schwellenraum, Snow, Flood, Minecraft and back to Day. No page/console error
  or WebGL context loss occurred. Both new layers were verified present.
  Instrumented WebGL buffer peaks were 470,022,689 bytes on desktop and
  290,521,898 bytes in the mobile profile. Returning to Day brought the mobile
  allocation down to 145,160,193 bytes. These are buffer allocations, not
  total browser memory, and profiles cannot reproduce physical-device RAM limits.
- Additional close views of Kleine Auguststraße and Borsigstraße confirmed
  restrained window shading and source-seated upper profiles. Independent
  final review found no source-owner conflict or disposal leak in the additions.
- Release readiness and the extracted local package HTTP launch passed for
  v1.0.86.

Final extracted package: **562,947,315 bytes**, within the unchanged 540 MiB
archive allowance. This allowance does not alter runtime residency limits.

SHA-256:

```text
1fe7ab4e893bb0763e36a91200e70bc7b287632b87b2c373c82a0920291f1a08  isometric-berlin-regierungsviertel-local.zip
4629d55c48683d8e3bb4a14a7857431489d5f42f980b96745cc8b0cd200ca293  isometric-berlin-viewer-v1.0.86.tar.gz
```

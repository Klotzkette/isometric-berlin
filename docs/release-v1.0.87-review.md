# v1.0.87 — finite western, southwest and eastern Berlin extension

## Delivered scope

[Coverage and limits](outskirts-v187.md) record 128.764 km² of added presentation
area, including substantial forest and lakes, with 46,551 mapped building
source records in 822 independently delivered 512 m tiles. Available official
LoD2 anchors 8,082 records; remaining outlines use retained OSM geometry,
tagged heights/storeys or documented fallback estimates.

Funkturm receives fine steelwork and platforms. Olympiastadion has its open
roof, sunken blue terraces, pitch, mapped sports grounds, entrance pylons and
Glockenturm. Spandau and the Citadel have initial mapped urban/fortress outlines.
The southwest gains context through Dahlem and Zehlendorf to Mexikoplatz,
complete FU Rost-/Silberlaube and Domäne Dahlem source models, and restrained
Steglitz accents. Grunewald has mapped woodland, paths, smooth source shores and
10,794 illustrative trees; Wannsee includes its opposite shore. Eastern links
reach Tierpark Friedrichsfelde, Köpenick and Müggelsee, with named Tierpark
buildings, mapped enclosures, barriers and gates.

Generic outer buildings remain simple, source-bound volumes. Missing heights,
road widths, colours, tree placement and small architectural annotations are
explicit display estimates. This is not a claim that all new facades or terrain
were surveyed. No photographs or imagery textures are included.

## Preservation and integration corrections

Every v1.0.86 source packet, descriptor and prior coverage polygon remains
byte-exact. Complete source records remain in the new inventory, including the
closed coarse envelopes that conflict with known open landmark structures.
Only their precise newly added footprints are replaced by complete named
models. Integrated visual QA caught and corrected the two false solid Funkturm
shafts and the Olympic infield plate; ownership now uses the exact complete
LoD2 footprints, rather than only smaller OSM outlines. Per-part navigation
preserves lower FU wings and the stadium's open sunken ground.

The existing serial loader, 12 MiB input/decode ceiling and mobile residency
policies are unchanged. The expanded area is not constructed in full at start.
Only the active drawn/native landmark family is allocated; final-sized buffers,
spatial culling and normal family disposal apply. No extra render targets,
textures or per-frame procedural work were added. Full drawn detail is the same
on touch and pointer devices.

## Validation

- New source/coverage Python checks: 16 passed. They check all three landmark
  families, exact old-file preservation, per-part navigation, bounded geometry,
  and real lake triangles with Pfaueninsel/Schwanenwerder kept as holes.
- Actual runtime decoder audited all 1,644 new packets, with immediate disposal
  after each construction: no errors. Maximum allocated geometry per packet is
  439,866 bytes drawn and 1,017,288 bytes native. The entire offline inventory
  totals 61,990,158 / 180,403,830 geometry bytes, respectively; these totals are
  not simultaneous residency. The [machine-readable receipt](../geo_data/regierungsviertel/outskirts-v187-runtime-qa.json)
  records bounds, indices, hashes and buffer accounting.
- Final TypeScript/production build and whole-repository Ruff checks passed.
  The targeted Bun suite passed 40 tests / 767,698 assertions, including older
  browser decoding, cancellation, source navigation and native representations.
- Desktop Chrome traversed 15 views from Funkturm to Müggelsee and returned to
  the retained core. WebKit with an iPhone 13 profile crossed seven areas while
  switching through Day, Night, Schwellenraum, Snow, Flood, Minecraft and Day.
  Neither run reported a page/console error or WebGL context loss. Measured
  WebGL buffer peaks were 578,236,167 bytes on desktop and 231,815,905 bytes in
  the mobile profile; the final mobile core view retained 152,698,953 bytes.
  These routes differ from v186 and are not a comparative performance benchmark.
- A real-viewer walking check reached the Olympic pitch at y=-12.667 m, moved
  with W plus ArrowRight, and preserved position/ground through Minecraft and
  back to Day. Integrated comparison also verified stable Tierpark enclosure
  ground layers after a material-only depth-bias correction.
- Release readiness and the extracted local package HTTP launch passed.
- Complete Python regression run: 920 passed, four skipped. Its one failure
  was the historical v176 manifest audit treating every later independent area
  as a terrain-detail companion. That audit now recognizes the exact v187
  manifest, with disjoint IDs and all hashes/buffer limits still enforced.
  The entire affected terrain-packet module then passed: 38 tests in 85.25 s.
  No application or generated asset changed for that test correction. All 921
  tests are accounted for; the two existing warnings concern missing CRS in
  synthetic geodata fixtures.

Browser profiles exercise engine behaviour, not a physical iPhone's RAM limit.
WebGL counters measure buffers, excluding textures, browser overhead and driver
memory. No claim of guaranteed crash-free operation on every device is made.

The extracted package is **703,310,513 bytes (670.73 MiB)**. The archive-only
allowance is 680 MiB; this does not increase the live rendering/decode budgets.

SHA-256:

```text
d69a506a87d7d5184c77265792fcb39c66cecb5670ecaf3968e59c9aa5148955  isometric-berlin-regierungsviertel-local.zip
2ed1f05b00688300e378e9d79e218bba4ea6bca7d710841a2db1fabc7e9ce6a4  isometric-berlin-viewer-v1.0.87.tar.gz
```

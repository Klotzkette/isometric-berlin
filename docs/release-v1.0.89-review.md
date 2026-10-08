# v1.0.89 — Volksbühne, Suhrkamp, Pfefferberg and Alexanderplatz

## Delivered refinement

The [Volksbühne](volksbuehne-v189.md) gains a source-aligned curved limestone
front, six grounded columns, tall foyer glazing, red banner fields and the
`VOLKSBÜHNE` inscription. Its separate Räuberrad stands at the retained OSM
anchor, with a flat weathered steel ring, six open sectors, two legs and
asymmetric feet. Photographs and measured envelopes remain separate from
estimated ornamental subdivisions. The source's simplified roof is retained.

[Suhrkamp and Pfefferberg](suhrkamp-pfefferberg-v189.md) gain shallow details on
45 measured wall rectangles across eight existing source owners. Suhrkamp has
silver bands, concrete framing and differentiated glazing. Pfefferberg has
brick piers, hall windows, pale surrounds and cornice accents. Pfefferberg's
inherited flattened terrain and closed terrace envelope remain a documented
limitation; this pass does not claim to reconstruct its open colonnade or steps.

The restrained [Alexanderplatz pass](alexanderplatz-v189.md) distinguishes the
Haus des Reisens with blue-grey window bands, a light aluminium grid and its
curved podium eaves. The previously detailed square landmarks remain intact.

All six visual modes receive these additions through the existing local-family
lifecycle. Minecraft has an independent orthogonal version. Mobile and desktop
receive the same drawn detail; no photographic textures are loaded or bundled.

## Preservation and review

All 1,522 surrounding-city descriptors, their 3,044 packet files, the complete
previous manifest and every existing public mesh remain byte-identical to
v1.0.88. No source envelope, street, courtyard, terrain field or tour stop is
removed. Residency budgets, viewing distances and rendering resolution remain
unchanged. Seven freely licensed reference photographs are recorded in both
attribution manifests.

The additions total 385,468 bytes of geometry/instance buffers in drawn mode
and 753,588 bytes in Minecraft. They use six drawn or five native renderables,
without new textures, animation loops or additional loading concurrency.

Close visual review caught a gap under the new column bases and partially
occluded lettering at the Volksbühne. The bases now meet the existing ground
datum, and the lettering is placed clearly in front of its curved stone face.
Suhrkamp and Haus des Reisens also received a local correction where old
generic window marks interfered with their new source-specific facade rhythm.
Thin facing conceals those marks only on the refined wall planes; all source
geometry remains beneath it.

The older local-family lifecycle test still expected the original seven v182
families, although sixteen were already present before this change. It now
captures the actual initial inventory and continues checking disposal,
residency-owner release and exact mode-roundtrip buffer signatures.

The old standalone startup and compact-menu smoke scripts also predated the
startup mode chooser. Their direct wait for the canvas could never start a
fresh session. They now use the real Start control before their existing
runtime/error and menu checks. No application behaviour changes for this fix.

## Validation

- Whole Python regression: **945 passed, four skipped**, with two existing
  synthetic-geodata CRS warnings. After final visual and harness corrections,
  **37 focused Python tests** passed: ten model tests (including the additional
  source-contained facade-skin regression) and 27 startup/menu harness tests.
- Whole-repository Ruff format/check and whitespace checks passed.
- All 3,044 retained drawn/native packet SHA-256 values were checked again.
  Existing mesh inventory and source geometry are unchanged.
- Final production build and TypeScript passed. The targeted Bun suite passed
  **35 tests / 62,431 assertions**, including all three models, real wheel
  apertures, facade depth/normal containment, mode-family disposal and
  surrounding-city cancellation/residency behaviour.
- Release readiness and the extracted local-package HTTP smoke passed.
- Chrome crossed six site views; WebKit with an iPhone 13 profile crossed
  seven views while switching Day, Night, Schwellenraum, Snow, Flood,
  Minecraft and back to Day. Both finished without console/page errors or
  context loss. Their respective measured WebGL buffer peaks were 332,649,832
  and 233,318,329 bytes; the final mobile view retained 114,109,082 bytes.
  These different routes are not a comparative benchmark. The
  [browser receipt](../geo_data/regierungsviertel/rosa-luxemburg-v189-browser-qa.json)
  records each sample. Three final Chrome close views confirm readable theatre
  lettering and removal of the interfering generic facade marks.
- Fresh production-package startup passed in Chrome and touch WebKit, with no
  page errors, console errors or failed critical requests. Final corrected
  startup/menu harness regression tests also pass. The real compact-menu gates
  passed in Chrome and WebKit across five layouts, all six modes and the
  3/6/21 m flood controls, including reload and first-visit source credits.

Browser profiles exercise engine behaviour, not physical-phone RAM limits.
WebGL buffer counters omit textures, browser and driver overhead. This release
does not establish crash-free operation on every physical device.

The extracted package is **709,572,701 bytes (676.70 MiB)**, below the unchanged
680 MiB archive ceiling. Source evidence is committed for audit, not duplicated
as runtime photographic data.

SHA-256:

```text
932142aeb11184744feb57ce3d3474234289e7bb9561f77968a3eefb8952b944  isometric-berlin-regierungsviertel-local.zip
45d9d4a50bf89ef97d1931c146f89a93295679ead2e39e693c3d69500b64e8f5  isometric-berlin-viewer-v1.0.89.tar.gz
```

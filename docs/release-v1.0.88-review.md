# v1.0.88 — covered district facades and western squares

## Delivered refinement

The [district pass](district-facades-v188.md) adds modest window fields and thin
base/eave accents to 7,772 previously blank official street frontages in the
already covered parts of Charlottenburg, Kreuzberg, Schöneberg, Friedrichshain,
Moabit and Wedding. Existing generic core facade strokes become slightly more
legible across those areas and Tiergarten. This is neither an expansion nor a
claim to have surveyed every window or completed all of Wedding. Recorded
materials, named buildings, streets, courtyards and all previous packets remain.

[KaDeWe, Tauentzienstraße and Wittenbergplatz](west-squares-v188.md) gain the
broad glazed roof hall, a source-bound pitched roof collar, stone cornice
registers, four exact mapped paving areas, clearer station entrance details
and continuous surfaces along 27 retained Tauentzien courses. The independent
Ernst-Reuter-Platz geometry remains byte-identical.

[Urania and Lützowplatz](urania-luetzow-v188.md) gain the Urania's missing upper
source envelope and roof, mirrored facade joints/yellow sign, three mapped
basins and narrow edging along retained garden paths and lawn islands. The
older City West group is unchanged. Roof subdivisions, window rhythms, small
sections and basin dimensions remain explicitly unmeasured display estimates.
No new photographic pixels or textures ship.

## Preservation and integration review

All 1,369 prior surrounding-city descriptors, all 2,738 prior packet files,
every earlier manifest field and the complete city footprint remain unchanged.
The 153 new detail companions have empty navigation and use their original
primary tile's bounds and serial loading/disposal path. Global memory budgets,
view distance, resolution and tour membership are unchanged.

Independent review found and corrected native facade selection which could
admit too much of a long wall when one endpoint touched an approved frontage.
Final native panes are clipped to the selected frontage corridor. Per-column
clearance also catches a narrow adjoining building missed by five broad facade
samples. Existing published geometry is unaffected by both corrections.
Visual review caught reversed winding on the new KaDeWe roof collar; its
upward-facing triangles are verified so that the intended pitched roof is
actually visible from above.

The old generic facade tests used two Mitte owners transferred into dedicated
measured models in v169. Their fixtures now exercise current generic owners
and explicitly require transferred old prisms to stay absent. The cumulative
v176 packet audit recognizes only the exact new v188 companion descriptors,
while continuing to check all prior hashes and geometry limits.

## Validation

- Actual runtime decoding passed for all 306 new packets, with immediate
  geometry/material disposal after each. Maximum allocated geometry per packet
  is 222,780 bytes drawn and 90,300 bytes native. The complete new inventory
  totals 9,393,600 / 2,818,320 geometry bytes, respectively, not simultaneous
  residency. The [runtime receipt](../geo_data/regierungsviertel/district-facades-v188-runtime-qa.json)
  records the manifest hash, indices, bounds and final buffer accounting.
- Independent source review checked all 141,016 drawn and 46,972 native pane
  marks against approved street frontages and source wall heights. Native
  panes fit their own frontage corridor; drawn columns do not intersect
  neighbouring buildings. All previous packet hashes remain unchanged.
- Production build, TypeScript and whole-repository Ruff checks passed.
  The final targeted Bun suite passed 73 tests / 46,978 assertions, including
  source models, actual roof winding, readable sign orientation, old generic
  facade transfers, cooperative decoding and cancellation disposal.
- Chrome crossed twelve local views covering all seven requested districts
  and five western landmarks. WebKit with an iPhone 13 profile crossed
  KaDeWe, Wittenbergplatz, Tauentzien, Urania, Lützowplatz, Kreuzberg and
  Schöneberg while switching Day, Night, Schwellenraum, Snow, Flood, Minecraft
  and Day. Both finished without page/console errors or context loss.
  Measured WebGL buffer peaks were 567,194,088 bytes on desktop and
  383,727,412 bytes in the mobile profile; the final mobile view retained
  158,661,268 bytes. These different routes are not a comparative benchmark.
  The [browser receipt](../geo_data/regierungsviertel/district-facades-v188-browser-qa.json)
  records all samples. Final screenshots confirmed the KaDeWe collar and
  street-facing Urania sign after their corrections.
- Release readiness and the extracted local package HTTP launch passed.
- Full Python regression run: 934 passed, four skipped, one failure. The
  failure exposed the older v187 offline builder appending its packets after
  later companions when re-merged. It now replaces its own entries and original
  footprint slice in place, preserving later independent entries and inputs.
  All eight affected tests, including a new synthetic late-entry regression,
  then passed in 3.69 s. All 936 current non-skipped tests are accounted for;
  the two existing warnings concern absent CRS in synthetic geodata fixtures.
  This last correction changed no public manifest, model or release asset.

Browser profiles exercise engine behaviour, not physical-phone RAM limits.
WebGL buffer counters omit textures, browser and driver overhead. No claim of
crash-free operation on every device is made.

The extracted package is **709,396,180 bytes (676.53 MiB)**, below the unchanged
680 MiB archive ceiling. The new facade transfer/evidence inventory adds
5,688,273 bytes; all live loading/residency budgets are unchanged.

SHA-256:

```text
76b553216584e4144d4cdd9b04d62d838534031239cfd83b6e5cb5d315e6e8f9  isometric-berlin-regierungsviertel-local.zip
927ad6abda88d27371779f37a6557cf0713fd30290b3cdfcdec5ddf6d7957d12  isometric-berlin-viewer-v1.0.88.tar.gz
```

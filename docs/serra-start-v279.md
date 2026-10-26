# v1.0.179 — unobstructed Serra flight start

Step 10. The owner approves correction of the obstructed Richard Serra / Berlin
Junction automatic opening reported during v178 verification.

## Cause and bounded correction

The original physical 39-degree approach remains clear. The existing dolly for
the ordinary 16-degree flight lens moves its camera to
`[-158.139528, 31.652751, 1001.162176]`. Its target ray intersects Philharmonie
roof part `XzEkeXsu` after 3.323 metres, before reaching the sculpture. A check
of both plates' full sampled surfaces also reproduces the obstruction.

Only the automatic Serra flight azimuth changes from approximately 32.1394 to
20 degrees. The new position is
`[-173.450322, 31.652751, 1008.652824]`. Target
`[-201.017, 5.7, 932.914]`, height, distance (84.674887 metres), 16-degree lens
and apparent scale remain. This is a presentation choice, not a survey point.
The existing source-backed sculpture and complete Philharmonie are retained.

The original explicit 39-degree approach, all other starts, seven-place
rotation, 93-stop catalogue, deep links, saved navigation priority and mobile
detail are unchanged. No runtime geometry dependency, texture, animation or
residency allowance is added.

## Verification

The existing 28 start-selection, physical-camera and production handover tests
pass (592 assertions). Five additional production-model regressions pass
(153,527 assertions), after reproducing three expected failures with the old
helper. All 980 unique drawn plate vertices and all 18,208 native steel corners
clear the respective complete concert-hall models. Both complete models fit the
desktop and narrow portrait projections. An independent numerical review agrees.

Type checking, Ruff, the production build, package HTTP smoke and complete
deterministic ZIP/tar validators pass. Archive validation is serial in RAM,
without extra archive files on the nearly full disk. The prospective Pages tree
retains both previous asset closures and stays 105,236,985 bytes below 1 GiB.

The internal browser shows both plates unobstructed in the actual built city,
in Day and Minecraft, after returning to Day, and at a 390-by-844 portrait
viewport. Real roof surfaces remain along the bottom edge. No console warnings
or errors were captured. The tab, temporary viewport and local-only QA server
were cleaned up; the QA seed page is never included in the package. This is
desktop responsive testing, not a physical-phone or endurance guarantee.

The full Python suite passes: **2,107 passed, four skipped**, in 2,500.68 seconds.
Two existing pyogrio CRS warnings come from the elevated-road fixture test.
Both draft archives and checksum assets match the local prevalidation exactly.
Final publication results are recorded in `serra-start-v279-verification.json`.

Release v1.0.179 and Pages commit
`1fe20feb9dbbf6eb49a69071f5efcc771fc28a72` are public. Live HTTP byte checks
match the tested package, including the current camera-owning chunks. GitHub's
archive digests match the complete prevalidated downloads. The three withdrawn
Columbiahalle recording URLs still return 404. No external browser was opened.

The historical `scripts/smoke_start_views.py` expects six physical openings and
is not used for this release: the current product has seven automatic flight
openings. Its outdated contract is separate from this correction.

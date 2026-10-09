# v1.0.101 — Sunken venues and Charlottenburger Tor

Step 10 corrects the four explicitly named sites within existing coverage.
Official DGM terrain supplies the raised Olympic plateau and the depressions
at Waldbühne and Wuhlheide. Original source XZ courses, complete source owners,
unrelated landscape relief and the 93-place tour remain retained.

## Source-grounded corrections

The Waldbühne lower-bowl sample is 37.67 m NHN; an upper-rim sample is 61.97 m
NHN, a 24.30 m local difference. The Olympiastadion infield sample is 53.05 m
NHN and the eastern plaza sample 66.08 m NHN. These are identified sample
locations, not asserted global minima/maxima. The old Olympic model normalized
its raised plateau to the ordinary city ground. Its datum, surrounding source
terrain and walking heights must be corrected together.

Wuhlheide's arena sample is approximately 33.85 m NHN and its raised rim
45.6 m NHN. The coarse uncovered grandstand and stage-envelope proxies are
replaced only at their exact documented source owners, retaining the original
records and all unrelated buildings/paths.

Charlottenburger Tor's mapped wing axes differ from the old almost road-parallel
reading. The user's approximate 45-degree request is interpreted as a request
for the actual orientation: the mapped-plan reading uses separate source axes
and source centres, keeping the road opening and retained sculptural detail.

## Preservation and validation

Bounded packet transitions and per-site source evidence are recorded alongside
the completed models. The [independent preservation checks](packet-preservation-v201.md)
verify the full chain against the unchanged earlier sources.

### Geometry and ownership

- [Olympic terrain and Waldbühne evidence](olympic-relief-v201.md): measured
  plateau/bowl datum, original sloping LoD2 seating sheets, open two-peak tent,
  and exact 23-owner transfer. Closed source envelope conflicts stay archived
  in the source receipt; canopy interpolation and bench cues are identified
  display estimates. Original source sheets are not replaced by an invented
  smooth ellipse.
- [Wuhlheide evidence](wuhlheide-v201.md): source-bound sunken amphitheatre,
  raised rim, open stage and corresponding walking heights.
- [Charlottenburger Tor evidence](charlottenburger-tor-v201.md): separate mapped
  wing axes/centres and preserved architectural parts. These require about
  84° and 97° correction relative to the previous placement, rather than a
  literal shared 45° rotation.

The final source manifest has 1,891 bounded cells. All 1,833 untouched previous
cell descriptors remain identical; 43 previous cells change only through the
recorded transitions and 15 bounded terrain companions retain split geometry.
No existing source footprint, tour stop or runtime residency limit changes.

`packet_receipts_v201.py` checks the immutable v1.0.100 packets against every
terrain face, material, height transformation, ink segment and navigation row.
The separate Waldbühne proof reconstructs the pre-transfer checkpoint and
checks exact owner subtraction plus outside fragments in each source triangle's
plane, including vertical Minecraft terrain-step faces. The eleven earlier OSM
seating overlays have a separate reversible clipping receipt. All nonoverlapping
surfaces, paths, trees and building owners remain represented.

Reproduction starts from the unchanged v1.0.100 public packet manifest. Generate
the Olympic terrain/landmarks and Wuhlheide staged
packets, run `apply_amphitheatre_packets_v201.py`, generate/stage the Waldbühne
source replacement, then run `apply_waldbuehne_packets_v201.py`. Both installers
validate hashes and the expected current descriptors before writing public data.
The terrain installer intentionally rejects a final Waldbühne manifest; rerunning
the first stage must use its original checkpoint rather than undoing the final
owner transfer. The final Waldbühne installer is individually idempotent.

### Regression-test maintenance

The full suite exposed old fixtures predating the v192 Zoo entrance and v200
exact central-building transfers. Their historical hashes/counts remain intact:
the tests now verify the exact additions/transferred owners separately and
compare the remaining original buffers byte for byte. The joystick boundary
test starts near the current expanded finite boundary so it still tests actual
clamping. These fixes do not change runtime geometry, movement or quality.

The refined packet assets add 20,899,692 bytes on disk. The complete extracted
package is 861,014,450 bytes (821.13 MiB), so its archive-only ceiling is 824 MiB
with 2.87 MiB headroom. Live packet, decoded-memory and GPU residency limits stay
unchanged; this is stored city coverage, not memory kept resident at once.

### Completed checks

- TypeScript and production Vite build pass; Ruff formatting/check pass.
- All 87 combined source-preservation and historical-transition checks pass
  (403.90 seconds), including the final vertical cutouts and negative regressions.
- 22 focused Python source/terrain/installer checks pass, including independent
  outside-area/plane/material preservation and unchanged unrelated groups.
- 17 Bun site, cache-reconstruction and mode-lifecycle tests pass
  (610,757 assertions). The new Waldbühne model remains under 1 MiB in either
  representation, at two drawn renderables or one native renderable.
- The full Python run completed with 1,102 passes and four skips; its initial
  release-state and historical-transition failures were addressed by the final
  package check and composed preservation proof. The full Bun run completed
  with 3,076 passes; all nine historical-fixture/control-test failures were
  resolved and their containing focused suites rerun successfully (102 + 44
  tests). No runtime geometry or input code was changed to satisfy old fixtures.
- All 76 release-readiness tests and the local launcher/package smoke pass.
- Desktop Chrome passes 28 views across all six modes and the return to Day,
  without page errors or WebGL context loss. Six final drawn/native walking
  probes reach the actual low arenas at Waldbühne, Olympiastadion and Wuhlheide,
  and retain simultaneous forward/look control.

- Mobile WebKit passes the same 28 site/mode views on the final package,
  with no page errors or context loss; mobile controls remain available.

Browser automation is a repeatable engine check, not a hardware test on an
actual iPhone. Tent interpolation and unsurveyed decorative details remain
explicitly identified display approximations in the source notes.

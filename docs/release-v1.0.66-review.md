# v1.0.66 — North Mitte, City West and Moabit

Pipeline step 10. This release refines the requested places within the existing
bounds and keeps the 93-place tour. Movement, viewing distance, all earlier
source detail and the mobile loading budgets remain in place.

## Source-bound additions

- [Alexander north](alexander-north-v166.md): complete Park Inn and podium,
  Pressehaus and surveyed Karl-Liebknecht-Straße/Schönhauser Tor buildings,
  Monsieur Vuong at Alte Schönhauser Straße 46, and the mapped Berlinian shell.
  Berlinian is a current construction shell; future completion is not depicted
  as accomplished. Its identification with the user's replacement tower remains
  provisional. The original clipped outer sliver is not used to truncate the
  building's full current OSM footprint.
- [Mitte streets](mitte-streets-v166.md): 437 LoD2 parents, 1,029 parts and 150
  source street segments through the bounded Mulack-/Alte Schönhauser-/Linien-/
  August-/Acker-/Tucholsky-/Krausnick-/Oranienburger corridors. Existing specially
  authored owners stay excluded. Five missing interior streaming tiles are now
  explicitly registered and every refined part retains its navigation entry.
- [Mitte heritage](mitte-heritage-v166.md): Jandorf, Schinkel's St. Elisabeth,
  Heine, Weinbergspark, Monbijoupark, Krausnickpark and the mapped Ackerstraße
  cemetery grounds. Positions and architecture come from LoD2/OSM; ornament
  proportions, facade subdivisions and furniture remain labelled estimates.
- [City West](citywest-cinemas-v166.md): the complete FÜRST/Ku'damm-Karree
  survey, Savignyplatz fronts and pavilions, Kant Kino and Zoo Palast. Current
  reconstruction versus older survey evidence is recorded rather than silently
  replacing measured walls with a future design.
- [Upbeat](upbeat-v166.md): DKB's handed-over campus keeps its source envelope
  and gains facade fins, ground-floor glazing and recognition detail. The
  announced October opening is distinguished from the August handover.
- [Moabit](moabit-justice-v166.md): complete Kriminalgericht, JVA exterior and
  Lesser-Ury buildings, with the measured roofscape and open courts. The barred
  prison windows are exterior recognition detail. No Tegel prison is substituted.
- [KOSMOS](kosmos-v166.md): the former cinema's surveyed oval hall and low
  glazed foyer, now an event venue. This is a likely but unconfirmed match for
  "Kino der Kosmonauten"; the evidence preserves that uncertainty.

## Retention and bounded construction

The final packet audit moves 478 exact old outer source owners into full global
models or bounded street packets. Twenty chunk pairs change; all unowned
triangle multisets, line segments and navigation records remain intact. The
273-chunk manifest includes the five new core-interior street tiles. Full source
surfaces remain eligible in every mode; no new image textures are bundled.

The four drawn modes have identical pointer/touch static geometry. Separate
Minecraft models use orthogonal surface blocks and lossless runs. Construction
is installed in cancellable stages, and existing live streaming/decode/residency
ceilings are unchanged. The earlier expressly requested Minecraft-only reduction
in tree density remains independent of the complete drawn park tree layer.

A pre-existing stale MuseumLenneArchitecture fixture was checked against both
v1.0.65 and the original v1.0.60 commit: production geometry is unchanged. A
separate evidence-backed override records the previously released 59 blocks;
all historical fixtures remain frozen. See
[native preservation audit](native-museum-preservation-v166.md).

## Validation

- Production TypeScript/Vite build and Ruff format/check pass (227 Python files).
- The complete Python suite passes 639 tests, with two existing fixture CRS
  warnings. Focused model/navigation tests pass 51 tests / 981,057 assertions;
  static-detail and progressive lifecycle checks pass another 102 tests.
- Four synchronous/cooperative full/mobile construction checks and all 50 native
  preservation checks pass. The separate v166 world signatures record
  361,620,446 bytes / 234 renderables (full), and 155,435,570 bytes / 232 renderables
  (mobile). These are full authored CPU buffers, not simultaneously resident GPU
  allocations. Earlier cumulative fixtures remain unchanged.
- Final source packet regression tests cover all changed tiles, full triangle and
  line multiset ownership, preserved unrelated navigation, every refined street
  part and the five new manifest entries. Both attribution manifests retain all
  437 earlier records unchanged and append 15 inspected references.
- The built site is 266.1 MiB; ZIP and TAR are approximately 175 MiB each.
  The finite offline package guard rises from 240 to 275 MiB for these additive
  sources. Live packet, decode and residency ceilings do not change. The package
  launchers and release-readiness checks pass.
- Desktop production Chrome passes 18 close views across all five modes and
  back to Day, including Kant Kino, KOSMOS and Heine; no console errors or
  context loss. Earlier day-view checks cover the larger district ensemble.
- A complete production WebKit iPhone-profile run passes 24 views across Day,
  Schwellenraum, Minecraft, Night, Snowstorm and Day again, without page errors
  or context loss; measured peak GPU buffers are 112,739,724 bytes.

One earlier cold start crashed inside the development WebKit engine's native
JavaScriptCore worker string-interning routine (`WTF::equalInternal` /
`operationMakeAtomString3`, SIGSEGV). The same engine binary and fault signature
occur in a pre-v166 October 1 report. No out-of-memory termination was recorded;
the exact JavaScript trigger is unknown, so the new workload cannot be ruled out.
The subsequent complete run passed. This remains an explicitly documented
intermittent engine-level failure, not a claimed crash fix. A separate dev-server
run was invalidated by source hot reload during generation; production QA uses a
frozen build.
Browser device profiles exercise touch presentation in real desktop browser
engines; they do not reproduce physical iPhone memory limits or establish a
universal no-crash guarantee.

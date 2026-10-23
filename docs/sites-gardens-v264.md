# Step 10 — Prenzlauer Berg landmarks, embassy flags and allotments (v264)

Release: 1.0.164. Scope: six requested existing landmarks and mapped allotments
inside already delivered city coverage. No new district or tour stop.

## Visible changes

- [Prenzlauer Berg](prenzlberg-v264.md): Wasserturm masonry divisions and upper
  frieze; Rykestraße synagogue arcade, gable coping and glazing. The Planetarium
  now has a rounded silver 30 m dome and low adjoining foyer instead of the
  coarse source's tall brown extrusion and pointed roof. All 436 original LoD2
  sheets remain immutable evidence. Two exact old owners transfer only after
  their replacement exists; surrounding buildings and routes remain untouched.
  Dome/foyer vertical dimensions and small facade fittings are photo-based
  estimates, not a new measured survey.
- [Embassies](embassy-gate-v264.md): British purple vertical cylinder, blue glazed
  projection and inclined Union Flag; US limestone/window/canopy details and
  entrance flag; French ribbed base, tall glazing and EU/French flags over the
  entrance. Existing complete shells remain. A missing vertex-colour attribute
  in the older Pariser-Platz native material caused black faces; removing the
  incorrect material switch restores its unchanged instance colours.
- [Allotments](allotments-v264.md): cultivated strips and short low hedge groups
  in 269 mapped areas, within 278 already delivered packets. Original paths,
  buildings, huts, water, trees and navigation remain. Planting groups are
  illustrative, not asserted to be surveyed or cadastral parcel boundaries.

## Integration and resource lifetime

Required Planetarium geometry is built before publishing either world and before
its optional exact-owner transfer is enabled. Matching walking queries use the
new dome/foyer roof surfaces with feet-height guards; unrelated navigation stays.
Embassy replacements are constructed before the narrowly scoped legacy opt-outs.

Garden preparation appends to existing packet geometry and adds no draw call or
new packet descriptor. Its top-level key/kind checks precede weak recipe decoding.
Bounded receipts and geometry generation yield cooperatively. Constructor recipes
reuse the existing lossless packing and collectible weak-cache policy. The native
Planetarium recipe below 64 KiB remains eager under the unchanged threshold.
No new animation, texture or light enters production. Full mobile detail,
independent native geometry, 93 tour stops and all residency/decode/prefetch
ceilings remain unchanged.

## Validation

Internal-browser inspection covered all six landmarks plus Bornholm gardens in
both modes. It found and corrected the coarse Planetarium silhouette and black
Pariser-Platz native faces before release. In the isolated seven-view harness,
repeated native site changes returned to the same garden baseline (one geometry,
one existing renderer texture, one draw call); no new console errors occurred
after fixing the temporary harness. This is a focused resource-lifetime check,
not proof against every device-specific browser memory failure. The temporary
harness is removed before packaging; no external browser was opened.

Final automated checks: **108 Bun tests / 14 files / 228,747 assertions** passed,
including the new models, exact packet transfers, real weak-cache collection,
streaming cancellation and GPU residency. **112 focused Python tests** passed;
the separate complete garden footprint/source audit passed all **4 tests**.
TypeScript, production build, Ruff and source/build/staged-package readiness pass.
Two initial surface-transfer failures were missing existing production bindings
in the extracted test host; those real dependencies are now supplied and all
22 direct consumer tests pass. No production no-op or omitted assertion was used.

The retained deployment preflight includes both previous complete live hashed
asset graphs and remains below 1 GiB. Archives are constructed and fully validated
one at a time in memory, avoiding large duplicate files on this Mac. Publication
sizes and immutable receipts follow below after the actual upload.

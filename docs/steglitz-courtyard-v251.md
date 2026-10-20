# Gymnasium Steglitz courtyard, v251

Five owner-supplied photographs dated 20 October 2026 complete the courtyard
reading alongside the unchanged v250 Heesestraße facade and sports hall:

- Three tall Aula triplets, arched upper lights and round oculi; pale gold
  ornamental fields, green/cream spandrels and masonry courses.
- The existing projecting clock gable with five small arched windows, two
  entrance arches, its central three-light window and the fountain/basin below.
- The modern wing's five continuous window bands, pale concrete divisions
  and brick ground-floor base.
- Both historic courtyard wings have three tall window registers and basement
  openings, pale surrounds/mullions, segmental brick lintels, green/cream
  spandrels and dark courses. The photographed north-wing end stays blank.
- Muted red tiles on 17 identified historic roof sheets. Every roof vertex,
  pitch, ridge and complete native occupied cell stays unchanged.

The five new images agree with the already modelled white two-storey sports
hall; v250's full hall and street facade remain byte-identical. The school-run
[courtyard tour](https://rundgang.gymnasiumsteglitz.de/#g281) remains a contextual
reference. No photograph pixels, textures or third-party image assets ship.
Opening sizes, frame spacing, small ornament and surface colours are restrained
photo estimates, not a measured facade survey.

All target surfaces belong to official LoD2 owner `DEBE06YYB0000AUq` in
`LoD2_386_5813.zip`. The courtyard Aula uses part `DEBE3DaafYxEtad7` sheets
4, 8 and 13. The clock gable uses the two coplanar measured halves 1 and 2
of `DEBE3DE7hShD6utU`; joining their projected outline adds no building mass.
The modern wing uses `DEBE3DKr6xQqvvnx` sheet 0 with its narrow adjacent joint.
The historic side wings use `DEBE3Ddj5cX7Y4kL/2`, `DEBE3DgtLFRQrT77/1,3`,
`DEBE3DAlOSLgfAi1/3`, `DEBE3DpDtepJDvCZ/0,4` and `DEBE3DarKG4lBMOJ/5`.
Their 20 estimated bays have exactly three tall main-storey apertures each;
the west end of `DEBE3DgtLFRQrT77` has masonry courses without invented windows.
The original generator's exact rigid terrain offset is recomputed as
`3.55 - min(part.ground_y_m)` = **-9.922 m**.

Only 372 exact older authored window rows yield. Every source coordinate,
footprint, complete wall/roof sheet, native occupied cell and navigation item
remains. Native changes repaint selected cells and add independently
axis-aligned facade members on the outer source-cell envelope. The fountain
basin and steps retain their own shallow three-dimensional depth in both styles.
The helper hashes original source rows/surfaces/native cells and the complete
v250 payload before applying any change. A changed receipt retains the full
previous rendering and suppresses the whole courtyard refinement. Only a boolean
is cached; no decoded source arrays are held by the helper.

Integration uses the existing v205 school batch:
`appendSteglitzCourtyardV251(entry)` follows the v250 replacement.
`steglitzCourtyardV251SourceBoxes(originalRows)` and
`steglitzCourtyardV251NativeRows(originalRows)` include the corresponding v250
corrections internally; they must receive the original indexed source arrays.
`steglitzCourtyardV251SurfaceColor(index, originalColour)` similarly composes
both material corrections. The enabled predicate is
`steglitzCourtyardV251Enabled()`. No new renderable, streaming region,
animation, texture, mobile quality reduction or live residency budget is added.

Payload: **137,155 bytes**, containing 765 boxes, 721 rods and 2,467 native
rows. Palette indices and local centimetre coordinates keep the payload small.
Large fields use the existing lossless transform: **84,534 bytes** generated
module code. Added instance attributes cost **112,936 bytes drawn** or
**187,492 bytes native**.

Review cameras:

- Aula/gable: eye `[-3247,14,6824]`, target `[-3217,17,6825]`.
- Modern wing: eye `[-3247,16,6812]`, target `[-3264,13,6837]`.

Validation: five focused Python tests, four Bun tests and Ruff pass. They cover
deterministic regeneration, unchanged source/v250 data, measured wall attachment,
the three historic floor registers and the photographed blank end,
exact ownership of removed estimates and repainted roofs, orthogonal native
rows, clearance ahead of old source support cells, bounded payload and an atomic
fallback exercised with a corrupted v250 receipt. The root task owns integrated
browser inspection, full regression, offline-package validation and release.

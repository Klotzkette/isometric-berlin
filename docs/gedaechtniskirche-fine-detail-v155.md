# Gedächtniskirche close-detail finish, v1.0.55

Step 10, a small refinement of the corrected v1.0.54 ruin. The published
71 m height, all source anchors, the different east/west openings, octagonal
bell storey, asymmetric side turrets and exact retained source wings are
unchanged.

The already credited Bulach and Pymouss photographs in the
[v1.0.54 visual audit](gedaechtniskirche-visual-audit-v154.md) were inspected
again, especially `00 1503 Berlin - Kaiser-Wilhelm-Gedächtniskirche.jpg` and
`Berlin 20171030-08 Kaiser-Wilhelm-Gedächtniskirche.jpg`. No additional image,
texture, font or attribution dependency was added. Three bounded additions
improve the near view:

- Thin radial Roman numerals on the four gilt dials, with separated inner
  and outer rings and smaller minute marks. The shared procedural strokes
  also supply the independent block-native Minecraft reading.
- Projecting abaci, darker necks and small bases distinguish the upper
  archivolt supports from uninterrupted rectangular strips.
- Fine horizontal copper-sheet joints follow the taper and avoid the open
  dormers. They supplement the existing standing seams and broken outline.

These small member sizes and engraving strokes are visual display estimates,
not measured architectural detail. Photos remain external reference evidence.

## Storage and checks

The full drawn City West model is identical on touch and pointer devices:
12 draw calls, 114,760 stored vertices and 2,459,832 geometry bytes. Compared
with v1.0.54 this adds 1,244 vertices and 25,272 bytes. Flat gilt numeral faces
keep the church body in a 16-bit index buffer; no prior visible geometry was
removed to achieve that. No per-frame work was added.

The independent native church remains one batch: 16,295 instances and
1,239,260 bytes. Its 6,099 modern-ensemble and retained-source-wing instances
are byte-identical to the frozen earlier reference. Its 71 m maximum,
unequal turrets, eight open bell faces, lower hall entrance, raised breaches,
hollow crown and open dormer continue to pass the geometry/ray checks.

All 30 focused tests in `city-west-details.test.ts`,
`gedaechtniskirche-native.test.ts` and `gedaechtniskirche-pedestrian.test.ts`
passed. TypeScript compilation passed. Isolated Chrome renders before and
after the refinement were inspected from the southwest, close to the clock
and bell stage, and in Minecraft. The actual source images were compared
with the close renders; this is visual QA, not a survey claim.

Measured full drawn City West hash:
`472f10c9537614722ccd4b55e84273bea52f42db4887229442377abff7894a7d`.
Measured native church hash:
`c6b09bcfced497c6f2351b97946012b13e76bdd1a8ea2477fcb1a99040e9e68a`.

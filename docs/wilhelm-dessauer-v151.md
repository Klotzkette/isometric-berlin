# Wilhelmstraße recognition refinement, v1.0.51

Step 10, within the unchanged central-Berlin bounds. The 93-stop catalogue is
unchanged. All existing Berlin LoD2 bodies, roofs, footprints and source data
remain present. The four drawn modes use identical geometry on phones and
computers; native Minecraft receives its own cube-based facade and monument
readings.

## Czech Embassy

The retained Berlin LoD2 parent `DEBE01YYK00001Te` has fifteen parts in tile
`390_5819`, source creation date 2026-03-08. The compact
`czechEmbassyFacadeSource.json` records all fifteen identities, original
millimetre ground rings and the 23 segments on their union's exterior. These
were extracted from the committed `buildings.gpkg`, not inferred from a photo.
The existing decimetre runtime rings remove collinear points; the regression
checks every original exterior endpoint against the runtime boundary within
its rounding tolerance. No source shape is removed or replaced.

The Czech Foreign Ministry's own building description establishes the square,
diagonally organized building, brown glass, granite, steel, projecting
reception rooms and vertical stair core. Věra and Vladimír Machonin designed
it in 1972; it was completed in 1978. The archived ministry description is
used for architectural facts, not current tenancy or construction status.
Fred Romero's licensed 2016 view resolves the continuous bronze-toned office
ribbons, folded granite aprons and thin mullions. Procedural shallow aprons,
slab joints, glazing fields, metal ribs and core colour strips replace the
old generic full-height grid. The full perimeter is detailed. Source bodies
receive a corresponding granite / dark-core palette so the uncovered source
walls and roofs do not read as a second white model.

Local storey subdivisions, pane widths, apron projection and material swatches
are recognition estimates, not a facade survey. The source footprint and
height of every part remain authoritative. The greatest shallow facade offset
is 0.32 m. No photograph, crop or runtime photographic texture is introduced.

## HIT Ullrich

HIT's official store page confirms the current address:
Anton-Wilhelm-Amo-Straße 69, 10117 Berlin. Its original OSM node `1588155369`
and LoD2 parent `DEBE01YYK000028X` remain the identity and metric anchors.
The existing red HIT ULLRICH fascia remains; the retained facade receives
upper transoms, a parapet, paired glazed entry leaves, handles and a threshold.
The door and window subdivisions are explicitly display estimates. The
existing small procedural lettering canvas is preserved in drawn modes;
Minecraft keeps a separate block-native retail facade.

## Leopold I / Alter Dessauer

OSM node `966034352` supplies the exact anchor
`[812.54033181816, 838.494576795]` in the viewer's x/z frame. The original
coarse pedestal/cylinder/cone is replaced, without a second monument beside it.
The current figure is bronze on a polished granite pedestal, not the older
Carrara-marble original. Bildhauerei in Berlin identifies August Kiss's
bronze after Johann Gottfried Schadow and the 2005 restoration/re-erection.
Herbert Heinke participated in the reconstructed pedestal, Roland Luchmann
in the replacement pedestal reliefs, and Bildgießerei Kraas in restoration.

The licensed front photograph shows a tricorne, long uniform coat, diagonal
sash, two separate booted legs, a baton in the right hand and a sword at the
left hip. These are represented by fixed instanced solids and small curved
procedural surfaces. The granite courses, inscription field, side relief cues,
slender posts and sagging chains are differentiated. Inscription geometry
uses only the identifying name, not a copied photograph or relief scan.

No current dimension survey was found in the consulted monument inventory.
The approximately 6.7 m rendered silhouette, anatomy, intermediate pedestal
courses, chain spacing and orientation are photo-proportioned display
interpretations. Ground y = 5.2 m follows the adjacent source datum. This
explicitly corrects the former generic y = 8 m accessory placement.

## Measured budgets and checks

- Wilhelm drawn group, including retained apartment facades, store sign and
  tennis court: 5 draw calls, 38,810 stored/rendered vertices, 697,076 geometry
  bytes (the existing tiny procedural sign canvas is not counted).
- Native Czech/HIT facade group: 2 draw calls, 24,480 vertices, 440,352 bytes.
- Drawn Dessauer: 4 draw calls, 318 instances, 27,058 rendered vertices,
  67,896 geometry/instance bytes.
- Native Dessauer: 1 draw call, 411 blocks, 9,864 rendered vertices,
  32,172 geometry/instance bytes.

`wilhelm-stresemann-details.test.ts` and `wilhelm-refinement-v151.test.ts`:
8 tests pass, 3,164 assertions. They verify source identities and boundary
coverage, successful nonempty merged facades, full/mobile equality,
texture-free new geometry, exact monument anchor, bounds and native budgets.
Full application build, integrated screenshot review and release checks are
recorded in the release review.

# Günter Litfin watchtower refinement — step 10, v1.0.9

The independent former command tower at Kieler Straße 2 now has a continuous
square shaft and observation storey, sixteen silver-framed upper panes, eight
small middle-storey openings, horizontal concrete joints, a thin projecting
roof, two-course silver guard rails and corner gutters/downpipes. The memorial
plaque and entrance occupy separate faces. The source-bounded close layer adds
the adjoining raised terrace, ribbed retaining edge, four steps and an
information panel. No photograph, inscription, portrait or image texture is
bundled or loaded.

## Evidence and dimensions

- OSM way `31347999` supplies identity and location. Berlin LoD2 part
  `DEBE01AL1pC0000R` supplies the retained 8.946 m height and approximately
  4.15 × 4.16 m roof/plan envelope at `[-107.991, 5.2, -1652.087]`, rotation
  `0.46` in the established viewer frame.
- The [monument database, part `09040270,T,010`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040270)
  describes a 3 × 3 m footprint. The current
  [Landesdenkmalamt account](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/fuehrungsstelle-kieler-eck-648149.php)
  gives 4.2 × 4.2 m. Both claims are retained explicitly in the profile; neither
  is silently relabelled as a survey of the wall face. The LoD2 envelope remains
  the independent metric anchor. The 3.65 m local shaft width is a visual
  estimate within that envelope, selected from the modest roof overhang shown
  in the current views. The previous 3 m shaft and enlarged upper cabin made
  the roof disproportionately wide.
- The [Stiftung Berliner Mauer](https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin)
  supplies the present memorial identity. The model remains independent from
  the Invalidenfriedhof and its Wall remnants. Photographed contemporary
  fixtures are used; the historic searchlight is not reconstructed on today's
  roof without evidence of its current presence.
- Opening heights, local facade subdivisions, materials, plaques, terrace,
  stair rise, rails, repair marks and board layout are bounded procedural
  interpretations. They are not claimed as official LoD2 or field survey.
  The 2021 geolocated view and the roof axes identify the plaque's northeast
  face and the doorway's northwest face; the local coordinates express those
  orientations without moving the source anchor.

## Inspected free visual references

All five files were actually inspected at 1,280-pixel width. The 2024 view
controls current external appearance; earlier views clarify obscured lower
fixtures and confirm the persistent structural arrangement. Photos remain
outside runtime and release packages. Per-file metadata is mirrored by the
release's central visual-reference catalogue.

| File | Author | License | Date |
| --- | --- | --- | --- |
| [Gedenkstätte Günter Litfin, Kieler Straße 2, Berlin-Mitte.jpg](https://commons.wikimedia.org/wiki/File:Gedenkst%C3%A4tte_G%C3%BCnter_Litfin,_Kieler_Stra%C3%9Fe_2,_Berlin-Mitte.jpg) | Neuköllner | CC BY 4.0 | 2024-07-15 |
| [Gedenkstätte Günter Litfin Berlin.jpg](https://commons.wikimedia.org/wiki/File:Gedenkst%C3%A4tte_G%C3%BCnter_Litfin_Berlin.jpg) | Singlespeedfahrer | CC0 | 2021-12-10 |
| [Günter Litfin Memorial.jpg](https://commons.wikimedia.org/wiki/File:G%C3%BCnter_Litfin_Memorial.jpg) | Rodngrt | CC BY-SA 4.0 | 2018-09-29 |
| [Watchtower - Berlin - Stierch A 01.jpg](https://commons.wikimedia.org/wiki/File:Watchtower_-_Berlin_-_Stierch_A_01.jpg) | Sarah Stierch | CC BY 4.0 | 2012-06-28 |
| [Watchtower - Berlin - Stierch A 02.jpg](https://commons.wikimedia.org/wiki/File:Watchtower_-_Berlin_-_Stierch_A_02.jpg) | Sarah Stierch | CC BY 4.0 | 2012-06-28 |

## Rendering and navigation

`LitfinWatchtower.ts` supplies independent drawn and Minecraft factories. The
Invalidenfriedhof factory owns integration and removes the earlier tower
signature. All geometry is static and exact-Day protected in Schwellenraum.
The entire upper glass band, small openings, concrete joints, terrace and rails
remain in the structural batch when close marks fade. Only sparse wire-glass
lines, small repair marks and unlettered information cues fade at 65/150 m.

The Minecraft model samples opaque box surfaces onto a shared local cube grid,
with one draw call and no filled hidden volume. Coarse window cells explicitly
retain glass over sub-cell sill detail, and rounded integer grid keys preserve
continuous railing courses. Every source record and its coordinate frame stay
unchanged. Existing source-shell/voxel ownership suppresses the obsolete solid
LoD2 renderer only at the tower footprint. Granular collision covers the core,
upper glazing, roof, terrace, step solids, rail and information panel; public
approaches around the tower remain open.

| Profile | Renderables | Instances | Rendered vertices | Geometry + instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn full | 2 | 279 | 6,696 | 22,500 |
| Drawn mobile | 2 | 197 | 4,728 | 16,268 |
| Minecraft full | 1 | 7,416 | 177,984 | 564,264 |
| Minecraft mobile | 1 | 4,576 | 109,824 | 348,424 |

The existing reversible snow cap remains attached to the retained roof envelope.
These budgets exclude that parent-owned cap.

## Verification

Four focused tests verify the conflicting dimension evidence, retained envelope,
all 32 exterior glass-ray checks across full/mobile after close detail fades,
bounded texture-free meshes, complete Minecraft railing rows and core/terrace
collision with open surrounding approaches. Actual Three.js triangles and
instance matrices were rendered for the front and both Minecraft profiles and
inspected; this is geometry QA, not a browser screenshot. TypeScript passes.

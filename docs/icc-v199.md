# ICC Berlin v1.0.99

Step10 bounded refinement inside existing Messe coverage. The complete official
LoD2 owners `DEBE04YY500001II`, `DEBE04YY500004dG` and `DEBE04YY500006BE`
provide49 measured parts and671 wall/roof sheets. Every original ring is kept
in `icc-v199-source.json.gz`; the independent surface receipt keeps source XZ
vertices and each part's original relative heights at the existing flat Messe
presentation datum3.55m. This is not a terrain survey.

Only the matching prior generic parent packets are substituted. No surrounding
road, building or old outline is removed. `integrate_icc_v199.py` provides
exact geometry and navigation accounting. The Funkturm's separately documented
spurious clipped wall remnants are also removed by their exact owner IDs.

The model adds silver-grey cladding, horizontal glazing and panel seams,
curved-profile transverse ribs, exposed triangular long-side beams, framed
entrance glazing and door zones. Exact overall location, footprints, rounded
circulation towers and source-part heights come from Berlin LoD2. The small
member sections, panel spacing, colors and glazing subdivisions are recognition
estimates, not surveyed engineering dimensions. No interior reconstruction or
future redevelopment scheme is implied.

Sources:

- [Official Berlin LoD2 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_383_5818.zip),
  dl-de/zero-2-0; SHA256 in the source file.
- [Landesdenkmalamt ICC](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-icc/artikel.1361131.en.php).
- [District ICC description](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/kultur-und-wissenschaft/veranstaltungsorte/artikel.1182217.php).
- [LarsMueller, 2026 roof/elevation view](https://commons.wikimedia.org/wiki/File:Berlin_Funkturm_utsikt_2026-04-01_img01.jpg), CC0.
- [Fred Romero, north entrance/elevation](https://commons.wikimedia.org/wiki/File:Berlin_-_ICC_Berlin.jpg), CC BY2.0.

Both photographs were viewed only for appearance QA, not metric tracing or
textures. Credits are mirrored in both Wikimedia manifests. No photographs
ship with the viewer. Native Minecraft uses its independent orthogonal shell
and fittings; Day/Night/Snow/Schwellenraum/Flooded retain all drawn detail.
Three independently culled owner groups use final-sized buffers. Constructor
arrays are weakly cached; separate compact navigation remains strongly owned.

## Bounded source conflict: the skyway

The main LoD2 part `DEBE3DnZRDDQCO1P` projects its west arm down to ground and
up to the main roof, falsely filling Messedamm. Only the exact1563.101m²
source arm between vertices[-6254.006,1465.440] and[-6244.204,1442.095]
is split off; all original source rings remain in the independent receipt.
Its top joins the measured west-hall display height19.895m. The lower face
is displayed at8.5m (estimated4.95m above the local flat road datum), leaving
an open passage in both rendered geometry and navigation. The original arm's
XZ outline is preserved; unrelated main walls/roofs remain at measured heights.
This also replaces the exact old ICC39.5m wire envelope, whose west-arm lines
would otherwise float above the corrected bridge. The complete old outline
source is retained, all other wire features still render unchanged.

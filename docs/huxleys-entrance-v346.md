# Huxleys public entrance

The entrance is now an additive exterior fitting on the **eastern parking-side
wall** of the existing complete venue, rather than at its interior POI. The
fifteen retained LoD2 parts, north-front windows, roof sheets, paths and navigation
are unchanged. This exterior refinement does not open a new traversable interior.

## Evidence and registration

The current [venue operator](https://huxleysneuewelt.de/information) confirms
Hasenheide 107–113. Page 10 of its [technical specification](https://channelmusic.de/wp-content/uploads/2019/03/Venue-Specs-Huxleys-09-2019.pdf)
marks the public entrance at the parking-side end nearest Hasenheide. The
[property operator's ground-floor plan](https://neuewelt-berlin.de/wp-content/uploads/2020/02/SABIV_NW_Lage_200219-1.jpg)
locates the Huxleys entrance beside the Wettarena entrance and immediately before
the small projecting wing. Its north arrow points **down**; the street is north
and the parking court east, verified against retained OSM street ways and parking
way `26832567`. Historical tenants on the plan are used for architectural
registration only, not asserted as a current complete tenant directory.

The [Morgenpost photograph of 9 April 2025](https://www.morgenpost.de/berlin/article404286900/huxleys-neue-welt-parken-anfahrt-garderobe-programm.html)
(credit there: Charlotte Bauer / Unbekannt), together with a wider exterior
reference, shows brown-red glazed double doors, narrow side lights and upper
light, a small black nameboard, and a thin shallow gabled canopy carried by steel
members and tie rods. The model interprets these features procedurally; no image,
poster artwork or logo pixels are distributed.

This resolves the wall-context gap described in `huxleys-entrance-v345-audit.md`.
The actual measured east wall of `DEBE3DjqaXknEpdh`, within complete parent
`DEBE08YYF00009PW`, is bounded by XZ `[3341.666,3656.602]` and
`[3342.495,3645.062]`. The centre is estimated from the entrance/projection photo
relationship **2.6 m north of the southern projecting wing**: scene XZ
`[3341.8523,3654.0087]`. That longitudinal offset, the 3.1 m portal width,
small glazing subdivisions, canopy dimensions and colours are explicitly
photo-derived presentation estimates, not a doorway survey. Venue POI
`975700421` and unrelated entrance `9104186570` remain rejected anchors.

The independent Native wall is the actual exposed rectangle at X=3342,
Z=3652–3656, Y=3–13. Its entrance centre is `[3342,3654]`; all Native elements
are cardinal boxes. Drawn retains its measured skew and thin diagonal ties.

## Preservation and lifetime

`huxleysEntranceV346` uses the ordinary SourceQuarter transaction on
`ring182-6_7`, which also owns the complete V238 venue replacement. Full raw and
prepared meshes, lines and navigation are fingerprinted. A missing/altered
venue suppresses the new entrance; no separate permanent decoration can outlive
its host. No source triangle, roof edge, navigation record, existing facade or
budget is retired. The new geometry contributes 1,248 Drawn triangles and 4,920
Native triangles, texture-free, with identical full Drawn quality on mobile.

The regression checks exercise both positive complete-owner admission and missing
or changed owner rejection, exact preservation of older meshes/lines/navigation,
finite fitting bounds, Native cardinality and the open approach below the canopy.

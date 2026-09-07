# Gropius Bau façade refinement — step 10

The dedicated Gropius Bau layer adds the building's published façade order to
the retained LoD2 geometry. It replaces the old accessory's coarse rectangular
brick body and generic eleven-bay grid. It does not replace a source building
part, close a courtyard, or add an opaque roof.

## Evidence and source boundaries

[Landesdenkmalamt object 09031246](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031246)
describes the four-storey museum by Martin Gropius and Heino Schmieden,
built in 1877–1881. It records seven axes on the north and south façades,
eight on the east and west, a Belgian-granite base, alternating light/dark red
clinker in the two principal storeys, three-part windows, shallow triangular
pediments above the second principal storey, a mosaic mezzanine, and the
projecting terracotta cornice. The north entrance is the principal façade;
the record dates its restoration to 1998–1999. The official
[Gropius Bau history](https://www.berlinerfestspiele.de/gropius-bau/ueber-uns/ueber-den-gropius-bau)
also identifies the architects and reconstruction history.

The actual delivered `lod2-prisms.json` was checked, rather than assuming that
the landmark alignment report was still current. The main prism is
`RQLhhnrF` (`DEBE3DUNRQLhhnrF`), parent `DEBE02YY40000AAS`, source date
2026-03-02. Its delivered ground is 4.8 m, height 29.3 m and top 34.1 m;
the unrounded height in the fusion manifest is 29.294 m. Its complete
28-point exterior ring, both explicit hole rings and roof code 5000 remain.
The related court parts `2CxqUMHy`, `69M53y8n` and `MTJV4dUC` also remain,
including their distinct height and roof codes. All four source parts are
prioritized into the initial exact building batch on desktop and mobile, within
the existing 420/160 initial and 9,000/3,600 total limits. This avoids the far
preview box closing the courts or hiding the facade beneath a solid cap.
The central roofed atrium
receives no new filled geometry. Geometry tests cast vertical rays through
both source courts and the central atrium to verify this additive layer
leaves those regions alone.

The non-bundled visual reference is
[Gropius Bau Berlin 1.jpg](https://commons.wikimedia.org/wiki/File:Gropius_Bau_Berlin_1.jpg),
Manfred Brückels, 2009, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
It was used to check the broad window, masonry, cornice and mosaic register.
The file has an attribution-only record in both the source and public
Wikimedia manifests. No photograph, crop, texture or traced artwork enters
the viewer. Mosaic panels use original abstract tessera arrangements rather
than reproducing the historic allegories or contemporary exhibition art.

## Representation

`gropiusBauProfile.ts` is a small geometry-free source/material contract for
the core building renderer. The main source body receives a red-clinker tone;
the roof keeps a separate muted grey-green tone. Its four façade baselines
are exact exterior corners of the delivered source ring. The relief courses
follow that ring's major wall segments, including the projecting south stair
block, rather than crossing it as a single flat strip.

`createGropiusBauDetails("full" | "mobile")` uses `drawnKit` to batch the
granite base, clinker bands, sixty large three-part windows, thirty mezzanine
triplets, window columns, sills, shallow pediments, mosaic fields, cornice
consoles and the north portal into one coloured mesh and one ink draw call.
Every mesh carries reversible day/night material references and the
`civicBuildingDetail` marker. Day, Night, Snowstorm and Schwellenraum retain
the same source alignment and receive their existing mode presentation.

`createMinecraftGropiusBauDetails("full" | "mobile")` uses one native cuboid
batch. Its pediments are stepped and its detail is coarser. The source
29.3 m height maps to the existing 32 m voxel-column height. A 3.1 m façade
offset clears the measured 4 m raster edge (up to 2.12 m beyond a straight
source wall). The south stair projection also keeps its 4.8 m source offset.
Because rasterisation widens that stair return, its two neighboring block
window triplets are narrowed and shifted outward along the wall. The
seven-axis count is retained. An actual-column SAT test checks the full
window, frame and pediment volumes, not just their centres.

Fixture heights, window widths, moulding thicknesses, abstract mosaic marks
and corner subdivisions are procedural display dimensions. The published
axis counts/material hierarchy and LoD2 envelope are the factual constraints.
Mobile preserves every main window, mezzanine triplet, pediment and mosaic
field, reducing capitals, bases, tesserae and relief repetition.

## Bounded cost and checks

| Representation | Parts/instances | Draw calls | Rendered vertices | Geometry + instance bytes |
|---|---:|---:|---:|---:|
| Drawn full | 2,630 | 2 | 75,720 | 1,287,360 |
| Drawn mobile | 1,588 | 2 | 50,712 | 837,216 |
| Minecraft full | 1,330 | 1 | 31,920 | 101,728 |
| Minecraft mobile | 1,300 | 1 | 31,200 | 99,448 |

`gropius-bau-details.test.ts` checks exact source identity and façade corners,
7/8-axis order, all-mode structural detail counts, court/atrium clearance,
actual voxel-column occlusion, geometry/material budgets, reversible mode
materials and mirrored image credits. The module has no runtime network
request, source-data download, photographic texture or new catalogue entry.

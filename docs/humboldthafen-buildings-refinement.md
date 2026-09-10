# Humboldthafen building refinement

Step 10, v1.0.4. The new facade layer distinguishes HumboldtHafenEins on the
east bank from the two H3/H4 buildings at the northern end of the basin. The
existing LoD2 bodies remain their metric anchors in Day, Night, Snowstorm and
Schwellenraum. Minecraft replaces their coarse source columns with shallow
facade courses and a roof surface fitted to the same source outlines.

## Source identities and boundaries

`src/app/src/humboldthafenBuildingProfile.json` is an 11,040-byte subset of the
delivered `lod2-prisms.json`. All 66 records, including their decimetre rings,
holes, heights, roof codes and source tones, are unchanged copies. All 66 IDs
also match `geo_data/regierungsviertel/buildings.gpkg`.

| Ensemble | Source identity |
| --- | --- |
| HumboldtHafenEins | Ten parts of LoD2 parent `DEBE01YYK00003Qp` |
| H3 | Sixteen parts of parent `DEBE01AL3Np0001k`, plus independent adjoining facade parts |
| H4 | Main body `DEBE01AL3zV00024`, two parts of parent `DEBE01AL3zV00032`, plus independent adjoining facade parts |

The complete selection has 28 parent-associated parts and 38 independent
records. Its world bounds are x = 43.5–166.9 m, z = −959.3–−515.1 m; the shared
coordinate conversion is x = easting − 389500, z = 5820000 − northing in
EPSG:25833. This selection excludes the separate service structures
`DEBE01AL3zV0005Z` and `DEBE01AL3zV0002L`.

Minecraft removes a source column only when its centre belongs to a selected
source footprint outside its holes. It does not remove everything inside the
ensemble's bounding rectangle. The two retained raster cells at [134, −946]
and [66, −914] have small edge overlaps with the selected facades, but their
centres belong to the two excluded service structures. Keeping them avoids
silently deleting independent buildings.

## Architectural evidence

[KSP Engel's project account](https://www.ksp-engel.com/projekte/humboldt-hafen-eins)
describes HumboldtHafenEins's outward-opening upper courts, central public
passage and connection to the promenade. The project manager
[KVL](https://www.kvlgroup.com/referenzen/humboldthafen-eins) additionally
documents the seven/eight-storey mass, two-storey waterfront arcade and
irregular, differently sized vertical glass-fibre-concrete fins bevelled to
one side. The model uses varied fin widths, shallow projecting lips, floor
bands and a glazed base to express that facade system. The two low waterfront
parts retain two facade storeys inside their existing height envelopes.

[Schüco's account of H3B/H4B](https://www.schueco.com/carboncontrol-lu-de/start/humboldthafen)
describes two seven-storey courtyard buildings and the distinct residential
and commercial facade systems. The delivered main bodies `ee9JgIcN` and
`3zV00024` therefore both receive seven facade rows. Broad and narrow windows,
pale panel joints, small projecting balcony parapets and rectangular base
piers distinguish them from HumboldtHafenEins. Earlier competition designs are
not treated as evidence of the built buildings.

The following inspected Commons photographs supply appearance cues only:

- Elisauer, [*Humboldthafen Berlin Blick vom Futurium.jpg*](https://commons.wikimedia.org/wiki/File:Humboldthafen_Berlin_Blick_vom_Futurium.jpg),
  CC BY-SA 4.0: northern harbour facades, variable window widths, pale panel
  grid, dark belt and rectangular colonnade. This September 2019 construction
  photograph is not evidence of today's site status.
- BugWarp, [*Berlín en agosto de 2024 - BugWarp (50).jpg*](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(50).jpg),
  CC BY-SA 4.0: small side balconies and recessed corner loggias.
- Leonhard Lenz, [*Humboldthafen Berlin from Hugo-Preuß-Brücke 2022-10-07 01.jpg*](https://commons.wikimedia.org/wiki/File:Humboldthafen_Berlin_from_Hugo-Preu%C3%9F-Br%C3%BCcke_2022-10-07_01.jpg),
  CC0: HumboldtHafenEins fins, horizontal bands and the glazed waterfront base.

All three have attribution-only records in both Wikimedia manifests. No
photograph, thumbnail, crop, plan artwork or photographic texture is added to
the viewer. Window spacing, fin sections, balcony placement and material
shades are non-surveyed procedural reconstructions.

## Source disagreements and presentation limits

The profile retains source height discrepancies. H3's main delivered body is
26.6 m high, while H4's main body is only 19.1 m. The seven facade rows are
compressed into each existing envelope; they do not establish measured floor
heights or justify raising the source roof. Some narrow adjoining source parts
have different heights. Those parts and their visible steps remain preserved.

Only the H4 main record carries an explicit courtyard hole. The H3 main record
does not. Version 1.0.14 resolves this documented source overlap using the
other delivered LoD2 parts, as described below. Every original source record
and existing hole remains retained.

### H3 upper courtyard and the two mobile harbour blocks, v1.0.14

The owner's overhead screenshot exposed two independent issues. The mobile
city partition previously left all 66 harbour records in permanent oriented
box coverage. The H4 box followed the long diagonal street edge instead of
the actual perimeter and occupied 528.316 m² of the committed OSM water
polygons. Its source footprint occupies no water at the regression probe
x = 188.2751047, z = −898.0614511 m. The source-bound harbour ensemble now
receives exact geometry in the initial partition, so the drawn facade layer
is no longer buried inside those cream-coloured boxes. This also preserves
the existing H4 courtyard from the first interactive view.

The H3 main part `ee9JgIcN` has a separate problem: its 30.8 m top blankets
three lower roof parts of the same parent. These are `fMIvAwPW` (12.2 m top),
`U8FpiULv` (11.8 m) and `OOUdyXFj` (12.4 m). The nine vertices of the
405.245 m² upper courtyard boundary are copied directly from the inner edge
of the delivered enclosing high part `WeZM0Chn`. The presentation resolver
adds this boundary as a hole only in the main upper mass. It retains the
lower parts, whose union covers approximately 403.750 m²; the 1.495 m²
difference consists of seams in the decimetre source rings. No new courtyard
survey, roof height or through-building ground route is asserted.

The original 66-record JSON subset and original global prism payload are
unchanged. The resolver is shared by the exact drawn body, facade planning,
Minecraft roof caps and pedestrian collision. Minecraft suppression still
uses the original footprint to remove the old tall courtyard columns before
adding the corrected wall and lower roof surfaces. It therefore cannot
reintroduce the old filled courtyard on direct Minecraft startup.

The source conflict was checked again against the current
[Berlin LoD2 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip)
and the official [DOP 2025 spring service](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
on 2026-09-10. The bounded orthophoto request used EPSG:25833 extent
389530,5820845–389690,5820975 at 1280 × 1040 pixels. It confirms the recessed
H3 court and the separate long H4 court. The architect's
[completed project account](https://pbp.hamburg/en/1276-2/office-building/humboldthafen-baufeld-h3-and-h4-berlin-2016/)
independently describes both seven-storey courtyard buildings and H4's retained
linden tree. The image is QA only and is not bundled as a texture. Metric
coordinates come from the existing LoD2 parts, not from tracing the image.

Several source parts have pitched or unspecified roof codes despite the
photographed flat-roof appearance. Their runtime presentation uses flat caps
at the original top elevations; source records and height envelopes are not
edited. Generic window, trim and chimney passes are suppressed only for these
66 parts so they cannot obscure or duplicate the authored facades.

The base piers are shallow facade articulation. They do not invent deep
arcades or create a new through-building walking route. Existing public paths,
water protection and source building collision remain unchanged.

## Geometry and mobile profile

Minecraft's facade and roof blocks use one fixed instanced batch. A second
merged surface supplies exact flat caps 0.35 m below the source top; this closes
slivers between oblique walls and the square roof grid while keeping courtyard
holes clear. This backing surface is the deliberate exception to cube-only
geometry. It contains no texture. Mobile uses the same building outlines and
facade identities with a coarser roof grid.

The drawn mobile profile omits secondary window mullions and fin lips while
preserving the window rows, primary fins, joints, balconies and colonnade.
The source subset also supports direct Minecraft startup without first
allocating the drawn city.

Measured overlay budgets:

| Representation | Renderables | Instances | Stored vertices | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn full | 2 | 0 | 200,828 | 4,078,932 |
| Drawn mobile | 2 | 0 | 186,152 | 3,770,736 |
| Minecraft full | 2 | 13,440 | 383 | 1,029,051 |
| Minecraft mobile | 2 | 12,980 | 383 | 994,091 |

The figures count buffer attributes, indices, instance transforms and instance
colours. They exclude the retained generic LoD2 bodies, material objects and
JavaScript allocation overhead. These are the v1.0.14 measurements, including
the newly exposed H3 courtyard walls and lower roofs. Regression rays check
the complete drawn composition and both Minecraft profiles at x = 70,
z = −883 m: the first roof hit is below 13 m rather than the old 30.8 m
blanket. Collision remains solid below that lower roof and open above it.
Release validation records the final measured budget and checks geometry,
source identity, material presentation and holes.

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
does not. The photograph and primary description of an open courtyard do not
provide a surveyed replacement hole, so this refinement does not silently cut
one into the delivered source mass. Every existing hole remains open.

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
| Drawn full | 2 | 0 | 232,012 | 4,751,724 |
| Drawn mobile | 2 | 0 | 177,688 | 3,610,920 |
| Minecraft full | 2 | 12,646 | 374 | 968,506 |
| Minecraft mobile | 2 | 12,182 | 374 | 933,242 |

The figures count buffer attributes, indices, instance transforms and instance
colours. They exclude the retained generic LoD2 bodies, material objects and
JavaScript allocation overhead. Release validation records the final measured
budget and checks geometry, source identity, material presentation and holes.

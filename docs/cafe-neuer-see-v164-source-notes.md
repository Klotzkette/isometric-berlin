# Café am Neuen See: source notes for step 10 / v1.0.64

Research checked on 1 October 2026. This supplement concerns the café's existing
site only; it does not extend the map boundary or tour catalogue. Berlin LoD2
remains the building geometry anchor. OSM provides site, water, deck and
playground identities. Furniture, boat outlines and seasonal canopies are
independently authored recognition detail, not a new survey.

## Current mapped identities

The bounded OSM API response was retrieved from
<https://api.openstreetmap.org/api/0.6/map?bbox=13.3415,52.5092,13.3463,52.5127>.
OSM licence: ODbL 1.0, © OpenStreetMap contributors. The raw response stays
outside published assets. All following positions use the existing EPSG:25833
world frame: `x = easting − 389500`, `z = 5820000 − northing`.

| Feature | OSM identity | World position / xz extent in metres |
| --- | --- | --- |
| Café restaurant building | way 46603834 | x −1885.510…−1821.265; z 868.869…944.450 |
| Biergarten site | way 118616321 | x −1927.370…−1808.900; z 825.142…955.220 |
| Boat hire | node 5911952789 | [−1899.527, 896.011] |
| Pier | way 118603619 | x −1911.957…−1889.851; z 889.105…903.378 |
| Mapped outdoor seating | way 1069887158 | x −1885.252…−1855.810; z 853.736…885.396 |
| Customer sandpit, southern point | node 8968204444 | [−1845.346, 876.423] |
| Customer sandpit, northern point | node 8968204465 | [−1857.727, 855.864] |
| Separate toilet building | way 118603618 | x −1878.115…−1864.747; z 825.805…840.888 |

These extents are not rectangular substitute footprints: retain the actual
OSM rings. There is no mapped swing, climbing tower or slide in this café
extract. The requested children's area is supported by the two sandpit nodes,
not by an invented large municipal playground. Node positions are evidence;
sandpit sizes, edging and loose toys remain display approximations.

## Operator facts

- The [operator's Biergarten page](https://www.cafeamneuensee.de/biergarten)
  expressly lists a children's sandbox and boat rental. The lake lies beside
  the beer garden; the mapped pier fixes the boat-hire approach.
- The [event page](https://www.cafeamneuensee.de/events2) describes the Scheune
  as a wood, glass and stone event space, with a fully opening glazed facade
  and an adjoining 250 m² garden. This supports a glazed hall reading rather
  than an opaque block, but does not give surveyed facade subdivisions.
- The [winter event page](https://www.cafeamneuensee.de/eisstock) identifies six
  roofed, weatherproof ice-stock lanes. Those are seasonal event installations,
  not evidence for six permanent building masses. The owner reports tents;
  small open-sided fabric canopies may represent that observation, but their
  exact count, current shape and placement are not mapped or independently
  measured. Keep this separate from the cream parasols visible in the summer
  reference and from the permanent timber pavilion.

## Inspected freely licensed photographic references

Only the Commons images below were downloaded and visually inspected for
material and recognition cues. No operator photographs, Google imagery,
photo crops or photographic textures are bundled or used as geometry.

- [Café am Neuen See.jpg](https://commons.wikimedia.org/wiki/File:Caf%C3%A9_am_Neuen_See.jpg),
  Lear 21, 6 July 2021, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Shows long honey-coloured wooden table tops and benches on dark metal legs,
  timber decking, separate garden seating, pale parasols, potted flowering
  shrubs and hanging strings of small round lamps. Furniture rows and counts
  are seasonal; they are not cadastral geometry.
- [Cafe am Neuen See Großer Tiergarten Berlin 2.JPG](https://commons.wikimedia.org/wiki/File:Cafe_am_Neuen_See_Gro%C3%9Fer_Tiergarten_Berlin_2.JPG),
  Schlaier, 17 August 2009, public-domain dedication by author (PD-self).
  Shows a timber waterfront deck carried above the bank, vertical timber posts,
  a wooden top rail and thin metal grid infill. A separate low white-painted
  two-rail fence follows another bank segment; these should not become a solid
  wall all around the lake.
- [Tiergarten Café am Neuen See.JPG](https://commons.wikimedia.org/wiki/File:Tiergarten_Caf%C3%A9_am_Neuen_See.JPG),
  Fridolin freudenfett, 28 April 2012,
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Shows an open timber service pavilion with a low grey standing-seam hip roof
  and raised central roof, timber posts, light garden chairs, long wooden
  tables with green metal legs and plant pots. This is historical evidence;
  retain newer LoD2 geometry if the roof/body changed subsequently.
- [Berlin Tiergarten Neuer See 3.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Tiergarten_Neuer_See_3.jpg),
  Schlaier, 17 August 2009, PD-self. A wider waterfront view confirms the
  deck-and-railing reading and irregular planted bank.
- [Berlin Tiergarten Neuer See 2.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Tiergarten_Neuer_See_2.jpg),
  Schlaier, 17 August 2009, PD-self. Shows small low open rowing boats on the
  lake, with reddish hulls and light interior/gunwale accents. This supports a
  recognisable hollow boat with seats and oars, not the previous solid boxes.

## Evidence boundaries

Use the retained official source shells for each current café part and the
separate utility structures. Do not flatten complex roofs to OSM's general
`roof:shape=flat` tag, and do not reconstruct the whole current restaurant from
the pre-refurbishment 2009/2012 photographs. The operator's glass-hall statement
and current LoD2 shell take precedence for present massing, while historical
references contribute only compatible material/typology cues. Record exact
LoD2 parent/part ownership and any old-proxy replacement in the implementation
audit. Chairs, boats and tents should sit within retained site/water polygons,
with no blocked paths or missing bank geometry.

## Toilet height conflict and official orthophoto cross-check

The current [Berlin DOP spring 2025 WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected as an additional official alignment source (layer `dop_2025`,
EPSG:25833, general bbox `[387540,5819020,387710,5819200]` and toilet detail
bbox `[387600,5819135,387660,5819190]`; dl-de/zero-2-0). The aerial view shows
the current flat-roof restaurant wings and rounded extension, waterside deck,
red boats by the pier, and substantial tree cover above the northern toilet
site. It does not establish an exact toilet height because the lower roof is
partly obscured.

Two tiny official building parents occupy the OSM toilet footprint:

| LoD2 parent | Source measured height | Ground / roof y in viewer metres |
| --- | --- | --- |
| DEBE01YYK0002Klw | 29.768 m | 2.709 / 32.476 |
| DEBE01YYK0002KWV | 29.400 m | 2.460 / 31.859 |

Both carry `creationDate=2026-03-01`, `Grundrissaktualitaet=2016-02-26` and
`DatenquelleDachhoehe=5000`. The latter means automatic photogrammetry according
to the [official AdV CityGML profile, page 9](https://sg.geodatenzentrum.de/public/gdz/dokumentation/deu/LoD1-DE_AdV-CityGML-Profil_fuer_3D-Gebaedemodelle.pdf).
Each plan is only about 5.9 m square. Their nearly 30 m heights conflict with
the expressly one-storey toilet building in OSM way 118603618. Dense tree
cover at precisely that position is consistent with an automatic canopy-height
error, but that cause remains an inference rather than a correction published
by Berlin. The orthophoto does not show two exposed tall building roofs there.

An explicitly estimated one-storey display roof is therefore defensible when
the original source polygons, source heights and this conflict record are
retained. A proposed 3.2 m toilet height is a display estimate derived from the
OSM storey count, not a surveyed replacement height. Limit the correction to
these exact two parent identities; do not apply a general height reduction to
the café or nearby buildings.

## Prepared model and path-clearance checks

The offline café supplement retains five display parts, 329 drawn source
surfaces and 2,980 source-clipped facade boxes. Its native surface shell has
3,851 one-metre cells. Glazing colours are assigned only to existing wall
cells whose centres project inside an actual prepared glass pane; roof cells
retain their original palette. This adds 997 glass-coloured cells without
creating, moving or deleting a single native source cell. The navigation
payload is byte-identical before and after that palette refinement.

Three complete mapped footway courses are reserved against furniture:
OSM ways 22792477 (26 points), 118513486 (6 points) and 118686814 (14 points).
None supplies an explicit width, so furniture placement conservatively uses
a labelled 2.2 m path width plus 0.5 m clearance on each side. These corridors
only constrain new garden props; they do not replace or redraw existing path
surfaces. All 42 picnic tables and eight groups of four garden chairs remain.
Fifteen table centres move into unobstructed positions elsewhere within the
mapped garden. Both seasonal canopy footprints avoid the reserved corridors,
source buildings, sandpits and water. Their approximate centres are
`[-1857,842.8]` and `[-1862.8,900.8]`; they are not surveyed tent locations.

All six rowing-boat positions stay unchanged and inside the exact lake polygon,
including a conservative hull-and-outstretched-oar envelope. All actual source
walls, roof planes, facade fields, original source records and legacy ownership
identities remain unchanged by the path-clearance pass.

Six Python checks cover rigid source-plane preservation and triangulated
coverage, the exact two-object toilet exception, unchanged native geometry,
window-edge/roof palette protection, furniture/path clearance and complete
boat/oar containment, and the source-bounded garden floor partition and compact
native sampling. Scoped Ruff format and lint pass. Whole-viewer browser
and release validation remain the integration task's responsibility.

## Source-bounded garden floor and deck

The garden must not read as uninterrupted lawn. The inspected 2021 reference
shows timber decking and gravel, while the older waterfront reference supports
timber posts and railings. The new garden floor is the union of the mapped
Biergarten and outdoor-seating polygons, clipped against every current café
building footprint, the exact pond polygon and the three preserved footway
corridors. The path widths remain the stated 2.2 m display estimates; their
mapped courses are unchanged.

Outdoor-seating way 1069887158 has a 459.477 m² mapped footprint. It overlaps
the retained pond by 4.836 m². Removing that overlap leaves 454.641 m² for the
timber reading; the mapped polygon is retained separately as evidence. The
western long edge meets the water. Only deck-edge segments within two metres
of the mapped pond receive timber railing detail, and those segments remain
clear of the mapped boat-hire pier. The rest of the clipped garden receives
the gravel reading. These materials are inferred from the permitted visual
references, not from a surveyed surface-material field in OSM.

Four prepared surface records contain 224 exact triangles, including all holes.
Gravel is displayed at viewer y = 5.32 m to clear the existing garden bed;
timber is at y = 5.42 m to clear the existing water at y = 5.36 m. These small
display offsets are not surveyed elevations. Fifty-one plank lines at an
estimated 0.35 m spacing follow the deck's long axis and are clipped to its
actual prepared outline. Five shore-facing rail segments use reference-fitted
post spacing and proportions. They do not create a fence around the garden
or close the pier approach.

Minecraft uses 350 compact orthogonal row runs with a one-metre centre-sampled
footprint and a 0.12 m floor thickness. This avoids runtime sampling across a
large polygon and does not change any of the 3,851 native building cells.
Tests compare the expanded runs with independent polygon sampling, verify the
exact drawn triangle coverage, and check that no source building, footway or
water surface is filled by this floor.

The older `RiversideVenues` layer supplied an inferred dense furniture grid
and generic enclosing hedge at this site. Only its exact café record
(`name = Café am Neuen See`, centre `[-18672,8823]` decimetres) is suppressed
when the new complete detail is present. The original source payload remains
unchanged, and other gardens keep their existing representation. Replacing
this generic overlay exposes the 42 detailed tables, 32 separate chairs and
two seasonal canopies without duplicate props or path-blocking inferred hedges.

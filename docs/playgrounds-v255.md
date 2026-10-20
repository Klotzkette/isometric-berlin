# Step 10 — official playground selection and mapped details, v1.0.155

The selection uses the twenty largest **public playground cadastral sites**
in the retained Berlin GRIS inventory, ordered by `katasterfl`, with seven
explicitly requested nearby records added separately. This is a ranking of
gross registered site area. It is not a ranking of equipped play area, all
privately operated playgrounds or the separate `nettospfl` field.

The complete 1,886-record ranking ledger, official twenty complete geometry
records and reproducible ranking script are retained separately. The municipal
source includes youth sports grounds, adventure grounds and water-play sites.
Their actual mapped uses are preserved rather than converting every large
site into a uniform sandpit.

## Official twenty

| Rank | Official site name | Cadastral area, m² |
|---:|---|---:|
| 1 | Werner-Sylten-Weg SP | 21,731 |
| 2 | Park am Buschkrug-Spielplatz I | 17,641 |
| 3 | Peter-Huchel-Str.-Spielplatz | 17,272 |
| 4 | Lessinghöhe | 13,957 |
| 5 | Nordpark-Spielplatz | 13,870 |
| 6 | Senftenberger Str.-Spielplatz | 12,807 |
| 7 | Oderstrasse 174 | 12,495 |
| 8 | Maximilian-Kaller-Str. - Spielplatz | 12,264 |
| 9 | Dammweg/ Plansche Pl KSP | 11,419 |
| 10 | Wiltbergstr. 29A | 11,012 |
| 11 | Zossener Str. Jugendspielplatz | 10,799 |
| 12 | Freizeitpark Tegel (Spielplatz) | 10,335.5 |
| 13 | Hildburghauser Str. | 10,095 |
| 14 | Alt-Treptow 12/ Weltspielplatz AT KSP | 9,847 |
| 15 | Zerbster Straße - Spielplatz | 9,514 |
| 16 | Upstallweg/Erich-Kurz-Str.11a/Ballsp. | 9,373 |
| 17 | Freizeitpark Lübars, Fasanerie (Spielplatz) | 9,253.7 |
| 18 | Eichendorffstr. Wasserspielbereich | 8,911 |
| 19 | BBR-Spielplatz 292 | 8,634 |
| 20 | Marienburger Str. 45 | 8,472 |

The additional records are the Bellevue-area **Bartningallee** and separate
**Lutherbrücken-Kispi / John-Foster-Dulles-Allee**, Helmholtzplatz,
Gipsdreieck at Gipsstraße and Joachimstraße, and Weinbergspark's blue playground
and separate Plansche. “Kiezdreieck” remains a provisional interpretation as
Gipsdreieck. Both Bellevue candidates are represented within their exact sites;
the location is not confused with Bellevuepark in Köpenick. The Zoo adventure
playground is an independently authored v255 addition, outside this public
cadastral ranking.

## Source evidence and interpretation

- [Berlin Open Data: Grünanlagenbestand including public playgrounds](https://daten.berlin.de/datensaetze/grunanlagenbestand-berlin-einschliesslich-der-offentlichen-spielplatze-wfs-737fd0a4),
  Senate department/GRIS, dl-de-zero-2.0. The retained original fields include
  `pitid`, `namenr`, `katasterfl`, `nettospfl`, district and locality.
- [Official technical field description](https://gdi.berlin.de/data/gruenanlagen/docs/Datenformatbeschreibung_Gruenanlagen_Spielplaetze.pdf).
- [Berlin public-playground overview](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/kinderspielplaetze/).
- Retained [29 September 2026 Geofabrik Berlin OSM extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf),
  © OpenStreetMap contributors, ODbL-1.0. The bounded source preserves 1,024
  intersecting mapped features with original identities, complete source
  coordinates and tags.
- The existing official terrain fields, including Weinbergspark's DGM and
  basin heights, supply the same altitudes used by the viewer.

Mapped device nodes receive category-specific recognition: open swing frames
and suspensions, slides with ladder steps, climbers, playhouses, seesaws,
roundabouts, pumps, benches, bars and trampolines. Mapped device ways retain
their actual courses for climbing frames, slides, balancing beams, ropes,
bridges and zipwires. Source anchors and courses are measured map evidence;
small dimensions, colours, structural subdivisions and missing heights are
explicit schematic estimates. No catalogue photographs, plans, sculptures,
character figures, fictitious themed equipment or photographic textures ship.
Unsupported device tags remain retained in the source and explicitly omitted
from new recognition geometry.

Source density differs significantly. Wiltbergstraße, for example, has no
mapped individual equipment in the retained source. Its site boundary and
mapped access survive without an invented array of generic devices. The
official ranking establishes selection and site identity, not a claim that
every piece of current equipment has been surveyed.

## Preservation, geography and streaming

All original packets remain byte-identical. Existing ParkDetails equipment,
v166 rendered equipment/barriers, v174 blue rubber, v176 Weinberg terrain,
v209 Helmholtz building ownership and v252 Gipsdreieck remain retained.
Mapped lawn/sand/pitch/Plansche edge seams add narrow visual distinction;
they are not claimed as newly surveyed kerbs or fences. New fences use only
mapped fence courses, with gaps at mapped gates and crossing paths.

Only the exact portions of the 27 official selected sites outside previous
coverage add ground: approximately **186,351.874 m²**. The WGS84
`bounds-playgrounds-v255.geojson` records this subtraction. The manifest patch
contains its separate scene-XZ `footprint` representation. Existing ground,
lawns, sand, rubber, pitches and actual relief are never covered by a new
whole-site plate.

New ground excludes mapped buildings and water. Dammweg's mapped water owner
`way/1421140132` retains its 79.689 m² new-scope intersection as visible water
and water navigation, rather than being filled with land. New fixture solids
also exclude buildings and water. Ground colours where no material is mapped
are explicit display estimates.

All new geometry uses 39 external `play255-*` packet pairs through the existing
serial city queue. There is no always-resident playground city group, no new
animation loop and no change to live residency, decode or prefetch budgets.
Native models are independently orthogonal, including their surface cells and
stepped rods. Their boundary cells stay wholly inside the permitted site.
Drawn mobile and desktop load identical complete packets.
New native lawns and water retain their 2 m cells. Narrow new path surfaces use
fully contained 0.5 m cells: the coarser grid had removed almost the entire
diagonal Werner-Sylten-Weg path despite retaining its source. The finer path
grid changes 17 native companions only; all drawn packets, other native
triangles, navigation and the prior 2,151 descriptors remain identical.

Granular navigation follows represented fixture solids, not a playground-wide
blocking polygon. Terrain sampling uses the actual shared viewer function for
both families, including fence and material-seam endpoints on Weinbergspark's
slope. The blue rubber, sandpit holes, pitches, basin and hill are preserved.

Browser inspection identified an older depth conflict inside the v166 Weinberg
ground batch: four mapped pitch sheets and the encompassing playground shared
the same 3.23 m source baseline. A bounded display-layer correction raises only
those four pitch sheets and their 47 native runs by 2 cm before the existing
terrain adaptation. This is a rendering separation, not a surveyed elevation.
Every source triangle, XZ course, native cell, colour and relief difference is
retained; no overlapping source area is deleted. The immutable v166 source JSON
is unchanged.

## Reproduction and checks

```
uv run python -m scripts.build_playgrounds_v255 --extract
uv run pytest tests/test_playgrounds_v255.py
cd src/app
bun test tests/playgrounds-v255.test.ts tests/weinberg-playground-layers-v255.test.ts
```

The source extract requires the retained PBF and official selections. Normal
rebuilds omit `--extract` and use the committed bounded source. The baseline
footprint and original descriptor receipts are retained, so integration of the
new footprint does not erase the original new-scope subtraction on rebuild.

Checks cover the official twenty plus seven exceptions, exact prior-source
hashes/descriptors, exact geographic subtraction, building/water voids,
mapped device anchors and gate gaps, shared DGM heights, bounded packed arrays,
all native triangle normals and metadata without runtime geometry allocation.
Camera targets are provided in `playgrounds-v255-camera-views.json` for visual
inspection of both Bellevue sites, Gipsdreieck, Helmholtzplatz, Weinbergspark,
Weltspielplatz, Buschkrug and the new outer sites.
The Weinberg layer tests additionally prove that only the four expected sheets
and 47 native runs change height, with identical source XZ geometry and terrain
relief in both families.

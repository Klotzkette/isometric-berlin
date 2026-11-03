# Northern school, park relief and Thälmann ensemble

This finite refinement adds the current Lessing-Gymnasium at Schöningstraße 17,
the recognisable parts of the Ernst-Thälmann memorial and source-bound fittings
on eleven existing Thälmannpark residential/swimming-hall owners. Four-metre
official terrain samples refine the two existing park hill fields. Earlier
correct geometry remains present.

## Source identity and coverage

The [Berlin school directory](https://www.bildung.berlin.de/Schulverzeichnis/Schulportrait.aspx?IDSchulzweig=30422)
identifies the current school as 01Y08 at Schöningstraße 17. The historical
Pankstraße Lessing building is a different site. The [Landesdenkmalamt entry
09030319](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030319)
describes Ludwig Hoffmann's 1909–1911 ensemble: four-storey classroom wings,
three courts and the three-storey street/teachers' house. Its LDA 2004 photograph
is an architectural reference, not a claim about current paint condition.

The whole named school was outside the previous filled city footprint. The new
`bounds-named-v306.geojson` contains only the mapped school parcel union the two
complete official source-family footprints, minus all previous filled scopes.
Its new area is 5,819.666267 m², with 0 m² previous overlap. No Wedding rectangle
or neighbouring school is added. Both complete LoD2 families are retained:

| Family | Complete leaves |
| --- | ---: |
| DEBE01YYK0003v0c | 8 |
| DEBE01YYK0003uxc | 1 |

The original official wall/roof sheets, plan coordinates, interior court rings
and relative elevations are retained. The school floor is a finite 3.015 m
scene-datum surface, with open courts. Independent native construction uses
actual hollow one-metre surface cells and cardinal floor cells fully contained
by the parcel. Navigation uses its actual cardinal cap footprint, rather than
the smooth drawn outline. Window rhythm, three entrance arches, reveals,
pilasters, transoms and stone/roof tones are reference-guided small estimates.
No school interior is fabricated.

## Thälmannpark and memorial

The [WBM estate history](https://www.wbm.de/neubau-berlin/plattenbau/ernst-thaelmann-park/)
and the DOP 2025 orthophoto distinguish the eight-storey courtyard slabs and
17-/21-storey towers. Finite fittings follow the existing complete source wall
planes of ten main residential owners. Their measured bodies, roofs, original
paint and every lower service annex remain unchanged. The fitting rhythm uses
the mapped floor counts; exact bay dimensions and opaque/reveal tones are
display estimates. Native fittings bind to actual cardinal carrier triangles.

The [Berliner Bäder-Betriebe page](https://www.berlinerbaeder.de/baeder/detail/schwimmhalle-ernst-thaelmann-park/)
identifies the two-storey 1986 hall at Lilli-Henoch-Straße 20 and its 2023
refurbishment. Shallow glazing bays, separate mullions/transoms and low hall
bands refine existing owner DEBE03YY60000BxN. No invented wing or replacement
roof is added. No timetable or time-sensitive opening information is bundled.

The [Museum Pankow record](https://www.berlin.de/museum-pankow/geschichte-vor-ort/gedenktafeln/2023/artikel.1504809.php)
identifies Lew Kerbel's monument and its 14 m overall height. The bounded
original interpretation has stepped granite courses, a swept bronze flag,
shoulders, an individual head with facial relief, a raised fist and four
knuckles. Its orientation faces the actual mapped Greifswalder Straße carrier;
the plinth fits the mapped monument footprint. [Berlin.de/dpa reference
photography](https://www.berlin.de/sehenswuerdigkeiten/5589940-3558930-ernstthaelmanndenkmal.html)
informs proportions only. Sculpture proportions beyond the documented overall
height remain estimates. Transient graffiti is not copied. Native surface and
navigation are separate one-metre cells, not a tall invisible monument box.

The six `northQuarterV306.json` plans cover drawn/native packets 7_-5, 8_-5 and
8_-4. Their raw and prepared predecessors are fully pinned to the published
9727870f79db9c6a6e9d6437668e5ac13229522f construction stage. No matching old v188
panes existed on these selected owners, so all retirement lists are empty.
All original body, ground, ink, water and navigation bytes remain present. Each
new plane is clipped to actual source support. These plans require the common
source-quarter transaction lifetime; overlapping independent appends must be
composed offline by the release integrator.

## Measured hills and retained correct landmarks

The [Humboldthain operator reference](https://www.berliner-unterwelten.de/fuehrungen/oeffentliche-fuehrungen/vom-flakturm-zum-truemmerberg.html)
and the existing mapped surviving bunker/platform outlines were checked against
official DGM1. The existing source bunker envelope and both v190 viewing
platforms remain. A bare-earth terrain sample under a roof does not establish a
new surveyed roof height; it is not used to move or flatten those platforms.

The [Friedrichshain district development study](https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/aemter/umwelt-und-naturschutzamt/naturschutz/entwicklungskonzept_bunkerberge.pdf?ts=1752710437)
and [Berlin park description](https://www.berlin.de/tourismus/parks-und-gaerten/3560363-1740419-volkspark-friedrichshain.html)
provide context. Public descriptions give conflicting heights for the smaller
Bunkerberg; the original official measured DGM samples govern instead of an
invented twenty-metre terrain cut. The new finite profiles are:

| Park field | World bounds [west, north, east, south] | Grid points |
| --- | --- | ---: |
| Humboldthain hill | [840, -3240, 1120, -2960] | 5,041 |
| Both Friedrichshain hills | [3940, -1080, 4632, -520] | 24,534 |

Domains are the exact existing mapped park polygons clipped to these windows,
with every existing complete building footprint buffered by 16 m excluded.
Delta samples are NHN minus 30 m, relative to the unchanged v182 ten-metre
field, feathered only inside the last 16 m. There is no new outside fade or
regional rectangle. Drawn interpolation uses the source NW/SE diagonal; native
uses independent four-metre cell centres. The shared v307 compiler clips old
ground once against the union of disjoint park and rail domains, preserving
actual original UInt16 source paint and every outside fragment.

The [Zeiss-Großplanetarium operator](https://www.planetarium.berlin/en/zeiss-grossplanetarium)
confirms the 30 m exterior dome. The complete existing v264 source families,
30 m dome, low annex and earlier entrance details are already consistent and
remain unchanged. A second overlaid dome is not added.

## Reproduction and validation

Raw primary photographs, orthophotos and archives are ignored external inputs.
No photographic pixels, image textures, timers, animation, tour stop or broad
district fill is introduced. Runtime meshes keep full drawn detail on touch.
Small uncertain dimensions remain explicitly estimated above and in evidence.

New builders write only versioned v306 derivatives:

```sh
uv run python scripts/build_north_sites_v306.py --extract
uv run python -m scripts.build_north_park_terrain_v306
uv run python -m scripts.build_north_quarter_v306
uv run pytest tests/test_north_sites_v306.py -q
cd src/app
bun test tests/north-sites-v306.test.ts
```

The source snapshot and terrain evidence record archive/reference SHA-256
digests. Tests verify complete school families and exact finite coverage,
unchanged original inputs, open courts, contained native floor cells, cardinal
native surfaces and navigation, measured terrain/baseline agreement, zero
terrain changes outside park/building masks, all six actual source-quarter
admissions and rejection of changed predecessors. Required-model admission
uses private child/storage identities and remains valid through legitimate
material bindings and lossless GPU parking.

Primary raw archive: `LoD2_387_5824.zip`, SHA-256
`b46975ee3c72c1e8dbf625c0ed2a51b030b96caef5efe61ff42f9ac2862a3240`,
[Geoportal Berlin LoD2](https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5824.zip),
dl-de/zero-2-0. DGM1 tiles 390_5822, 392_5820 and 394_5820 retain their original
archive digests in `north-park-terrain-v306-source.json.gz`. Mapped parcels,
roads and park bounds retain the original OSM snapshot and ODbL attribution.
The [Geoportal DOP 2025 service](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was used only for roof/court/parcel QA, dl-de/zero-2-0.

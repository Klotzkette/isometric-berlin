# Nordufer, Heizkraftwerk Moabit and Berlin Decks — v277

## Scope and source distinction

Seventeen low presentation prisms are replaced by detailed exterior bodies for
the Robert Koch-Institut at Nordufer 20, the opposite Heizkraftwerk Moabit and
completed Berlin Decks buildings 1, 2 and 4. The first twelve owners use full
retained official LoD2 bodies; the last five use current OSM footprints and
locally evidenced bDOM roof levels. This is exterior recognition work, without
laboratory or plant interiors. It is not a survey of operational configuration.

`geo_data/regierungsviertel/rki-moabit-v277-source.json.gz` preserves all 18
selected CityGML parents, all 87 leaf parts and every original wall and roof
sheet. It also contains the 32 separately labelled reconstructed Decks parts,
grouped under five current OSM owners. These added parts are explicitly **not
LoD2 measurements**. Its canonical digest binds the construction data to this
evidence. `scripts/build_rki_moabit_v277.py` replays the existing official
`LoD2_387_5822.zip` archive; its SHA-256 and download URL are in the evidence.
The archive is Geoportal Berlin LoD2 data, **dl-de/zero-2-0**. No reference
photograph, video or texture is bundled.

The primary references distinguish the existing structures:

- [RKI locations](https://www.rki.de/DE/Institut/Das-RKI/Standorte/standorte.html)
  identifies the historic headquarters and later laboratory extension.
- [RKI history, 1971–1980](https://www.rki.de/DE/Institut/Das-RKI/Geschichte/Geschichte-des-RKI/Bildband_Salon/1971-1980.html)
  explains the triangular laboratory building, opened in 1978. It is retained
  with all its measured parts, rather than replaced by a proposed future tower.
- [Berlin heritage entry 09030308](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030308)
  documents the brick institute ensemble, courtyard, historical alterations and
  separate 1912–13 building.
- [Berlin industrial heritage: RKI](https://industriekultur.berlin/ort/robert-koch-institut/)
  and [Kraftwerk Moabit](https://industriekultur.berlin/ort/kraftwerk-moabit/)
  supply architectural context. These references support recognition materials
  and the distinction between brick halls and later industrial bodies.
- [Berlin heritage entry 09050441](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050441,T)
  identifies the historic power station and later alterations.
- [BEW generating plants](https://www.bew.berlin/fernwaermesystem/erzeugungsanlagen/)
  supplies current operator context. The July 2026 announcement concerning the
  [Putlitzbrücke construction operation](https://www.bew.berlin/aktuelles-und-presse/2026/bauma%C3%9Fnahme-putlitzbruecke/)
  concerns a new 42 m chimney; it does not establish an exact completed footprint
  for this model. No new 42 m stack is invented. The complete existing tall
  source stack is retained separately.

Retained LoD2 heights are not claimed to be independently remeasured in October
2026. The references do not justify a future RKI high-rise or wholesale removal
of existing plant parts. Source dates and completion dates are distinct.

## Berlin Decks evidence and limitations

`geo_data/regierungsviertel/berlin-decks-v277-source.json.gz` is the separate
immutable input contract. It preserves all 32 complete OSM-derived footprint
parts, all 34,650 original one-metre bDOM samples, download hashes, direct WMS
spot checks, the five complete previous presentation prisms, and source URLs.
The old local LoD2 tile contains former industrial buildings and is not used as
a measurement of the new campus.

- [BEOS campus page](https://www.beos.net/objekte/berlin-decks) supplies the campus
  identity, green ceramic architecture and historic building context.
- [BEOS, 30 July 2026](https://www.beos.net/newsroom/pressemitteilungen/innovationscampus-berlin-decks-in-berlin-mitte-vollvermietung-der-gebaeude-1-und-2-mit-planet-labs)
  establishes the completed occupied buildings 1 and 2; its
  [current campus photograph](https://www.beos.net/wp-content/uploads/newsroom/pressemitteilungen/berlin-decks-c-beos-ag.jpg)
  supports the stepped green facade treatment.
- [Berlin Decks / Dreßler Bau, 2026 handover](https://de.linkedin.com/posts/dre%C3%9Fler-bau-gmbh_mit-der-%C3%BCbergabe-des-geb%C3%A4udes-ist-ein-wichtiger-activity-7479795036474384384-S_R2)
  confirms that building 4 rental spaces were handed over to DFFB. This separate
  completion reference is recorded here and in the public reference ledger,
  not in the immutable geometry contract. It does not date the handover to the
  summer-2025 height acquisition or assert that every campus space is occupied.
- [Implenia project reference](https://implenia.com/de-de/referenzen/detail/ref/berlin-decks/)
  distinguishes phased development. An overall planned completion date does not
  prove that every building is complete.
- [Berlin surface-model documentation](https://gdi.berlin.de/data/bdom/docs/dom.pdf)
  documents the raster source. Roof levels come from its one-metre samples;
  internal terrace boundaries are bounded interpretation of that raster, not
  surveyed roof facets or a newly certified as-built drawing.

All old-only footprint edge remnants keep their original 9 m cap (displayed top
14.2 m). Even extremely small polygon components remain in the source and native
coverage; finite Float32 precision can collapse a microscopic drawn triangle.
Building 3, owner `64895468`, remains untouched and protected as a neighbour.
No connecting bridge is invented.

Independent review corrected exactly two initially over-high complement strips
before final generation: `building2-complement-2-0` uses roof 45.4 m NHN /
displayed top 14.6 m; `building2-complement-3-0` uses 45.3 m NHN / top 14.5 m.
Both have two estimated facade storeys. Interior raster sample medians are
45.57 m and 45.30 m respectively. Only four height/method fields of each of
these two parts changed; all 32 XZ parts, the other 30 parts and the original
measurements are identical. Final contract SHA-256 is
`fee4860938f107fb8b52414c938fc07dc369895141ac52f3c4e7cb53a2ffb48b`.
The local review report `berlin-decks-height-correction-v277.json` records the
bounded delta and sample statistics.

## Geometry, heights and recognition details

Coordinates use EPSG:25833 and the established world origin
`x = east − 389500`, `z = 5820000 − north`, `y = NHN − 30`.
One translation per official site meets the existing city ground at 5.2 m:

| Site | Source anchor | Translation |
| --- | --- | --- |
| RKI | `DEBE01YYK00045Yh`, ground 6.101 m | −0.901 m |
| Kraftwerk | `DEBE01YYK0002MVh`, ground 4.630 m | +0.570 m |
| Berlin Decks | Contract already in displayed world coordinates | 0 m |

No official leaf is flattened. Relative basement, wall, connecting and roof
heights remain intact, including source parts partly below the city's simplified
terrain. The industrial block `K0002Lsy` retains its 51.344 m source height; the
highest existing plant roof reaches displayed y = 81.793 m. These are distinct
from the discarded 12 m compound presentation prism.

ALKIS function `51009_1610` identifies four open overhead structures:
`K0004to7`, `K0003VEk`, `K0004taX` and `K0004tlv`. Their full original sheets remain
in the evidence. Display and navigation use the roof surfaces with thin
undersides and explicitly estimated narrow supports. The local underside follows
the local roof height, preserving clearance under the open structures.

Facade colours, bay spacing, windows, arch trims, floor bands and support
dimensions are **display estimates**, not measured openings. Each detail fits
its source wall facet. Restrained brick and sandstone identify the historic
institute; horizontal bands distinguish the laboratory; large hall openings and
industrial materials distinguish the plant. Green ceramic bands, tall window
subdivisions and stepped terraces distinguish the completed Decks buildings.
There are no invented inaccessible interiors, photographs, animations or new
descriptors.

The independent orthogonal native model uses one-metre source-footprint
intersections and quarter-metre roof levels. Official LoD2 bodies use a minimum
cell overlap of 0.035 m²; every positive intersection is retained for the Decks
contract, including microscopic edge components. Courtyard holes remain part of
the test. Equal-section adjoining native boxes are combined without changing
occupied intervals or colours.

Native facade fittings are searched outward only within 0.12–1.76 m and rejected
if they intersect any actual replacement volume, support or preserved shared old
column. Independent review first found 29 estimated fittings intersecting such
mixed-owner columns; the regression failed before the fix. Clearance now includes
those exact columns, retaining the old mixed cells and omitting only invalid
estimated detail pieces. No source body is moved to fit an estimate.

Decks drawn fittings have a separate 0.08–0.8 m outward clearance search. This
keeps windows visible beside thin retained old footprint remnants while rejecting
details blocked by another complete body. Source rings and roof heights never
move to expose a window.

## Documented footprint disagreement

The twelve old RKI/plant presentation contours and complete official LoD2
footprints disagree. Their union areas are 22,171.6899 m² and 22,100.7909 m²;
941.1842 m² lies only in the former coarse contours and 870.2852 m² only in the
official source. Most of the former difference belongs to the coarse plant
compound (`27218732`: 783.576 m²). This does not establish that every discrepancy
is empty ground or a demolished structure.

`rki-moabit-v277-footprint-reconciliation.json` preserves complete difference
polygons and per-owner areas. Six original bDOM spot checks, with query
coordinates, URLs and returned NHN elevations, are retained separately in
`rki-moabit-v277-footprint-bdom.json`. They range from 37.37 to 51.60 m NHN;
several lie in very narrow edge strips. Vegetation, edge sampling and source-date
differences prevent an authoritative empty-ground interpretation. The model
chooses the full official body sheets with their setbacks and separate connecting
parts; no unrecorded whole-structure demolition is asserted. The diagnostic
difference polygons are not used as an erase mask.

## Exact ownership and navigation

The old owners are `27575821`, `27218783`, `27218732`, `84225949`, `27575819`,
`27575820`, `04971191`, `27576685`, `27576684`, `84225947`, `43012631`, `84225945`,
plus Decks owners `01745260`, `01745259`, `64895469`, `64895470`, `64895471`.
All seventeen complete old records, 73 neighbouring records, 1,832 exclusive
native column tuples and twelve retained shared column tuples are independently
bound in `rkiMoabitV277Ownership.json`. Unrelated owner `66743894`, which only
slightly overlaps the cooler vicinity, stays. There is no site-rectangle mask.

`isRkiMoabitSourceV277` requires exact full prism fields.
`createRkiMoabitColumnTesterV277` requires every original owner exactly once, the
original four-metre core grid and a complete old column tuple. Changed, missing
or duplicated owners fail closed. Changed or new neighbours preserve the cells
they can overlap. Shared columns never retire.

`rkiMoabitSolidsV277` binds every replacement part to a real old owner: dominant
footprint overlap for official parts, the exact contract owner for Decks. The
tiny detached roof with no positive old overlap attaches to the retained main
owner. Drawn collision uses full official roof facets or the exact Decks ring
and flat roof level. Native collision uses the actual occupied cell union; its
enclosing ring is only an index bound and returns no solid where there is no
cell. Canopy supports have their own narrow profiles. Live mode switching selects
the matching geometry and retires only the exact old low proxies.

`createRkiMoabitV277`, `isRkiMoabitSourceV277`,
`createRkiMoabitColumnTesterV277` and `rkiMoabitSolidsV277` integrate atomically
through the required-site transaction and core/native/navigation options.

## Focused validation and final accounting

The focused files contain eight Python tests and six Bun tests. They cover full
source replay, common datum, exact native interval/colour preservation, actual
Float32 fitting clearances, courtyard-aware roofs, deterministic data, exact old
ownership and changed/new-neighbour failures. The complete 32-part Decks
contract, corrected heights, tiny remnants, protected building 3 and clearance
from retained mixed-owner columns are included.

Real navigation tests the formerly passable high plant block at 30 m in drawn
and native modes, and verifies that a changed old owner stays protected. Actual
required-site loading attaches the complete family before yielding. The native
constructor test checks that exclusive obsolete columns and generic windows
retire only on activation.

Final submitted buffer accounting includes the 648-byte shared box geometry:

| Mode | Bytes | Draws | Instances |
| --- | ---: | ---: | ---: |
| Drawn | 1,660,000 | 2 | 18,541 |
| Native | 4,900,520 | 1 | 64,472 |

There are 23 source parents and 119 complete parts. The drawn shell has 2,317
triangles (6,951 vertices). Native bodies comprise 33,322 source cells compacted
without changing occupied intervals or colours to 11,103 boxes; 53,369 fitted
detail instances complete that mode. The 2,351 source triangles include 494
explicitly reconstructed Decks triangles. The 34 omitted display triangles are
false wall curtains of the four officially identified open overhead structures;
all original sheets remain in the evidence.

Mobile and desktop geometry/material fingerprints are identical. These focused
checks do not claim whole-world browser endurance or the complete release suite.
Logs and the actual-Float32 RKI/plant diagnostic view are in
`~/.cache/codex-berlin-v277/`: `pytest-rki-moabit.log`, `bun-rki-moabit.log`,
`rki-moabit-model.png`. The release coordinator records the final full Python
suite and integrated Bun run after production freeze. Earlier Decks diagnostic
images are checkpoints and do not certify the two corrected low roof strips.

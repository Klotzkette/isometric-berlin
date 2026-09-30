# Mall of Berlin, Voßpalais and complete Leipziger Platz envelopes — v1.0.51

Step 10. The old building embedded in the Mall's Voßstraße frontage is the
**Voßpalais, Voßstraße 33**, not the modern Mosse-Palais at Leipziger Platz 15.
COPRO identifies Wilhelm Böckmann's 1884–1886 house, its red sandstone facade
and its integration into the 2014 shopping complex. Pechtold's expansion
account independently identifies the retained historic building amongst the
new parcel facades. The existing three Mall parent buildings stay distinct.

## Complete source geometry

`leipzigerPlatzSource.json` preserves all original wall/roof surfaces of 96
parts across 17 parents, plus the 96 previous delivered flat prisms and source
ZIP hashes. The generator reads the retained official Berlin LoD2 ZIPs and
checks approved bounds. No source payload is deleted. The drawn viewer uses
these exact sheets in place of only the corresponding old flat prisms; every
roof slope, court and separate rooftop component remains represented. One
rigid vertical translation per parent maintains the existing street datum.

| Group | LoD2 parent | Parts |
| --- | --- | ---: |
| Mall west | `DEBE00YY1mc0002W` | 4 |
| Mall central | `DEBE00YY1mc0003Y` | 2 |
| Mall east | `DEBE01YYK00000lH` | 20 |
| Mall glass Piazza | `DEBE00YY1mc0004E` | 1 |
| Voßpalais | `DEBE01YYK0000Ao8` | 5 |
| North-west frontage | `DEBE01AL3ya0000B` | 6 |
| Mosse-Palais | `DEBE01YYK00003D7` | 9 |
| North-east frontage | `DEBE01YYK00004OX` | 4 |
| West frontage | `DEBE01AL57c0001B` | 5 |
| South-west frontage | `DEBE01YYK00007OU` | 5 |
| South-middle-west / Deutschlandmuseum, LP7 | `DEBE01YYK00009rL` | 6 |
| LP7 lower independent frontage | `DEBE01YYK0001yp5` | 1 |
| LP7 upper independent frontage | `DEBE00YY1Yq0005f` | 1 |
| South-middle-east / LP8 | `DEBE01YYK00005Cd` | 9 |
| South-east frontage | `DEBE01YYK00001xM` | 6 |
| East chamfer | `DEBE01YYK00002YT` | 4 |
| Eastern entrance | `DEBE01YYK00002wL` | 8 |

The southwest part `DEBE3DP5ii5cXk3Q` and LP7 entrance canopy
`DEBE3DO5h4MjCoj2` are official roof-only sheets: their undercrofts remain open. The covered Mall Piazza roof
`DEBE00YY1mc0004E` formerly appeared as an opaque 24.4 m tall prism. Its exact
three sloping roof planes now use translucent, depth-tested glass without depth
writes. The LoD2's false closure walls below the eave are archived in the source
JSON, not drawn as a solid building: the completed architect's Piazza description
and OSM covered-roof way `380104431` document the open passage. The eave is
21.451 m and ridge is 29.490 m in the aligned scene frame. Navigation uses a
roof-only solid base at 21.251 m. Its steel rib subdivisions are visual detail
sampled on the exact source roof. The complete shell transaction includes this
glass roof from first publication; later facade detail adds only the frame.

Minecraft retains neighboring block bodies, clips only passage columns centered beneath the roof which overlap no other source parent, and renders independent native
roof blocks at the exact sampled roof heights with a translucent material and
block ribs/supports. The passage stays open below the roof in both styles.

The two independent LP7 street facade source strips are retained as separate
parents. Their original closed envelopes previously hid the decorated main
parent behind them; the replacement now preserves both strips at their exact
positions and lets the perimeter module decorate their actual exterior edges.

## Recognition detail and limits

The Voßpalais has the complete five-part envelope at OSM way `503373675`,
including its taller, recessed rear levels. Its roughly 16.21 m street edge
runs from scene `(675.561, 892.023)` to `(691.126, 887.490)`; ground is 5.4 m.
The historic street part is 20.001 m high; the maximum rear height is
26.099 m. The red street facade adds four axes, a projecting central pair,
round-arched ground-floor openings, framed windows, pediments, narrow
pilasters, rustication, cornice brackets, two upper niches and shield reliefs.
The upper rear addition reads as pale render. Intermediate member dimensions
and sculpture silhouettes are procedural interpretation, not a facade survey.

Jörg Zägel's 2009 photo supplies surviving facade form, not its then-temporary
condition: no graffiti, decay, neighbouring demolition or obsolete sign is
copied. COPRO's completed-project account confirms the retained red sandstone.
Membeth's 2017 Mall facade photograph supplies dark paired-window, lighter
mullion and permanent-name cues; seasonal decoration and changing tenant
adverts are omitted. The existing lower facade subdivisions remain; the
previously blank raised Mall residential/hotel levels receive windows tied to
actual source wall edges, excluding interfaces buried in another part. The
perimeter facade refinement is a separate module maintained with the same
source envelopes.

All four drawn modes use the same static model on pointer/touch devices.
Minecraft gets separate facade/frame and glass-roof block batches while its
native neighboring building bodies remain. No photograph, runtime texture, network dependency, or hidden
solid infill is introduced.

## Evidence

- [COPRO's Voßpalais project](https://www.copro-gruppe.de/projekt/vosspalais-khu6p)
  identifies the date, architect, red sandstone and current Mall integration.
- [Pechtold's Mall extension](https://pechtold-architekten.de/projekt/Mall_of_Berlin,_Erweiterung)
  establishes parcel facades, retained Voßpalais and two-storey rooftop housing.
- [Tchoban Voss's completed Mall](https://tchobanvoss.de/de/projects/mall-of-berlin)
  establishes the block-edge arrangement and roofed Piazza facing Bundesrat.
- [Voßpalais photograph](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Vo%C3%9Fstra%C3%9Fe_33,_Wohnhaus_01.jpg),
  Jörg Zägel, 2009-06-23, CC BY-SA 3.0.
- [Mall entrance photograph](https://commons.wikimedia.org/wiki/File:Leipziger.Platz.Mall.of.Berlin.jpg),
  Membeth, 2017-12-08, CC0 1.0.

Individual credits are supplied in `leipziger-platz-v151-sources.json` for
merging into both shipped attribution manifests. Local downloaded inspection
images stay outside the repository. LP7 and LP8 identities are confirmed by
[OSM address node 437371350](https://www.openstreetmap.org/node/437371350) and
[OSM address node 437371519](https://www.openstreetmap.org/node/437371519), each
inside its exact source parent. [Deutschlandmuseum](https://www.deutschlandmuseum.de/kontakt/)
confirms LP7; [Hilmer Sattler](https://www.h-s-a.de/projekte/leipziger_platz_8/1)
confirms the LP8 design.

## Validation and budgets

The 96 original footprints have less than 0.0001 m² symmetric-difference area
against the committed GeoPackage, and all archived prisms match the delivered
payload exactly. Tests protect part count, rigid height translations, the open
Mall axis, separate Voßpalais source identity, no photographic maps and fixed
memory budgets. All existing Canadian Embassy, Taylor Wessing and Magenta
Mitte facade/portal tests remain intact.

- Complete source shells: 16 opaque draws plus 1 transparent glass draw,
  403,380 attribute bytes.
- Mall/Voßpalais added detail: 3 fixed instanced draws, 4,910 instances,
  377,072 attribute bytes.
- Separate Minecraft detail: 2 draws, 5,453 blocks, 415,724 attribute bytes.
- New source JSON: 271,986 bytes before any release metadata updates.

These are static construction budgets, not physical-device memory or speed
measurements. Browser visual checks are recorded in the release review.

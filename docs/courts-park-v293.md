# Courts and Kleiner Tiergarten — Step10 / v293

The bounded companion preserves every v229 Wedding/Charlottenburg court sheet,
the complete v166/v183 Moabit palace and four courtyards, all v269 church detail,
source park paths/trees/benches and native owners. No original owner is retired.
It adds finer four-leaf window divisions on the exact existing pane axes, stone
sills, public entrance identity and small masonry courses/quoins on twelve
actual neighbouring source footprints. The Charlottenburg insolvency identity
belongs at Amtsgerichtsplatz1; the register branch at Hardenbergstraße31 stays
separate. These small fittings and their colours are display estimates, not a
photographic survey of each opening or surrounding address.

Wedding's late-Gothic tracery and Charlottenburg's yellow sandstone/Baroque
identity follow the current court/Landesdenkmalamt accounts. The official court
page's Peuser photograph is explicitly historical: it does not justify inventing
a current pitched roof. Moabit's existing measured tower hierarchy remains.
See `courts-park-v293-evidence.json` for links, full immutable input hashes and
twelve exact neighbouring-owner receipts. No photographic pixels are bundled.

## Park bridge and the two churches

The previously unresolved underpass is now identified by the **Bezirksamt Mitte**
newspaper, [Ecke Turmstraße4/2016, page3](https://www.turmstrasse.de/sites/default/files/2023-03/ecke_nr4-16-turm_web.pdf):
the Rolleracht runs through the small bridge's tube. Its retained exact OSM
bridge `116946775` connects to track `116946778`. This is a children's rolling
circuit, not an invented tunnel under a city road. The complete mapped figure
eight remains visible; a concrete arched crossing and connected approaches
follow the original track nodes. Existing lower ground remains5.245m. The2.5m
deck rise,2.28m central clearance, rail sections, tube arch and11m approaches
are **unsurveyed display estimates**, chosen to preserve a traversable adult
body clearance in the viewer. No excavation, park hill, path deletion or new
U-Bahn shaft is introduced.

St Johannis at the **eastern** park edge is distinct from Heilandskirche at
Thusneldaallee in the **west**. Two complete official St Johannis parents
`DEBE01YYK0002JWo` and `DEBE01YYK0002MC8` are retained in the evidence. A rigid
per-part ground alignment to the existing5.2m park datum supplies their missing
upper walls/roofs above the retained14m nave and9m campanile fallbacks. The
independent native upper roofs interpolate the same source planes. Small brick,
round-arch and louvre fittings remain estimates. The complete v269 Heilandskirche
body/roof is untouched; thin bell-louvre recognition is additive. This does not
replace the separately mapped arcade with an invented closed30m building.

## Integration and checks

- Add `createCourtsParkV293(false/true)` in the required site transaction for
  the respective family. No new timer, texture, source media fetch or tour stop.
- `courtsParkV293GroundAt(x,z,feetY,fallback,native)` supports the deck/actual
  curved approaches with a feet gate; walking through the lower crossing must
  keep the original ground. `courtsParkV293SolidAt` represents concrete cheeks,
  overhead slab/portal and side rails, keeping the lower centre and both ends
  open. Install these helpers with the same required group before navigation.
- Drawn mobile detail is identical. Native transforms are independently cardinal.
  Both families use one exact-count instanced fitting batch; drawn adds one small
  measured upper-surface mesh. Existing source inventory and coverage stay fixed.
- `bun test tests/courts-park-v293.test.ts` checks original-input hashes, exact
  mapped courses, upper-source inventory, actual mesh rays through the complete
  lower tube, curved-ramp support against rendered slabs, lower/deck separation,
  cardinal transforms and finite instance/GPU allowances. Integration performs
  final TypeScript/build/browser and release checks.

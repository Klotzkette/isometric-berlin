# CityWest transport, v281 — Step 10

This bounded change improves existing A100 carriageways near ICC/Funkturm,
the completed ZOB terminal, Hardenbergplatz and Joachimsthaler Straße. It adds
one compact mesh to each affected existing packet; the native family has its
own cardinal cell geometry. It creates no new world coverage, stop, loader,
scene root or residency budget. Mobile receives exactly the same detail.

## Sources and interpretation

The committed `citywest-transport-v281-source.json` freezes 269 selected OSM
features from the retained 29 September 2026 Berlin extract, including every
selected route vertex and tag. Positions are projected to the existing viewer
frame without simplifying their source paths. OSM is © OpenStreetMap
contributors, ODbL 1.0. Local extraction reads only the bounded ICC/Zoo caches;
no external photograph, texture, video or font asset is shipped.

The project architect describes the [completed ZOB](https://diebruecke.berlin/projekt/zentraler-omnibusbahnhof-berlin-zob)
as a two-storey building with basement, individual bus platforms and a new
traffic-control building. Its [reception-building project](https://diebruecke.berlin/projekt/empfangsgebaude-am-zob)
describes three levels in total, not three above-ground floors. These references
support two storeys of facade recognition on the unchanged current reception
envelope, and open bus-platform roofs. The current [operator](https://zob.berlin/de)
confirms the active terminal at Messedamm 8. Its service information is not a
survey of dimensions.

The [DEGES announcement of 29 September 2026](https://www.deges.de/presse/pressemitteilung/ad-funkturm-a-115-a-100-geaenderte-verkehrsfuehrung-ab-05-10/)
states that the old A115 transfer to Halenseestraße Ost closed on 5 October;
traffic is routed via the Avus rest area and Alte Jafféstraße. The Ringbahn
bridge is expected to reopen in summer 2027. The retained OSM snapshot predates
that change. Therefore this release does not turn the stale transfer into a
newly modelled operational road, or depict a future interchange as completed.
The [Hardenbergplatz project](https://gemeinsamdigital.berlin.de/de/smart-space-hardenbergplatz/)
likewise distinguishes the existing public space from future plans. New
forecourt detail uses existing mapped furniture rather than that proposal.

## Actual changes

- The two ZOB `building=roof` fallbacks `OSM-way-693733275` and
  `OSM-way-671765756` were closed, solid 3 m prisms. Complete exact triangle,
  roof-ink and navigation receipts retire only those proxies. Their full
  original outlines remain in the source fixture and become open supported
  roofs. The 4.8 m underside clearance and 0.3 m roof thickness are explicit
  display estimates; the old 3 m height was a generic fallback, not a survey.
  Navigation now permits the space under each roof and retains its posts.
- The reception building `OSM-way-1226659408` keeps its complete envelope and
  9 m fallback height. Two above-ground registers of glass recognition follow
  the existing exterior planes. The hotel and traffic-control building keep
  their existing complete geometry. They are not replaced by generic masses.
- Information-pillar fittings use **32 uniquely named mapped gates**. The
  architect reports a capacity of 33 platforms, but Gate 10 is absent from the
  retained local source; no unverified 33rd position is invented. Gate 33 lies
  north of the packet seam and joins its correct neighbouring packet.
- Around Bahnhof Zoo, six mapped bus shelters, 18 mapped benches and six
  mapped kerb lines are added in both families. The existing station halls,
  measured roofs, platforms, Amerika Haus and U-entrance canopy remain intact.
- Lane separators and motorway edge paint follow mapped road axes and lane
  counts, with mapped width where available. All paint is clipped to actual
  delivered asphalt, away from existing paint and seven metres around source
  junction nodes. Unmapped widths, stripe lengths and fitting dimensions are
  display estimates. No unsupported turning arrows or road elevations are
  introduced.

## Ground and ownership

The Zoo station forecourt uses shared core terrain at y=5.2; its surrounding
packet has no terrain and only an empty navigation fallback at y=3. The source
fixture retains the actual local ground runs and drawn/native asphalt support,
with input hashes, and verifies a uniform y=5.2 over this bounded local area.
Drawn core road paint lies above its actual y=5.34 asphalt plate; native paint
lies above its independent y=5.2 asphalt cells. Outer streets use the actual
delivered y=3.09 surfaces. Existing higher CityWest road plates retain their
separate support and elevation. Native paint only occupies complete cardinal
cells covered by its own support; it is never clipped back to a diagonal edge.

The runtime sidecar is 1,047,173 bytes before bundling. It appends 39,035
triangles across 22 family/packet combinations (11 existing spatial packets).
The exact old ZOB retirement is 164 drawn triangles plus 56 roof-ink segments,
or 782 independently generated native triangles. All other encoded triangles,
ink, road routes, ground polygons, navigation owners and earlier additions stay
unchanged. Original asset hashes and complement hashes are recorded in
`citywest-transport-v281-evidence.json`.

The source's 140 selected road ways have individual inclusion/exclusion
receipts: 53 are eligible paint candidates, 87 remain unchanged because of
missing lane evidence, noncentral lane placement, bridge/tunnel/layer ambiguity
or current construction. Candidate strips may subsequently be clipped away by
actual surface support. The recorded construction exclusion rectangle is a
conservative **renderer exclusion**, not a surveyed construction-site outline.
It and every excluded way's bounding box/reason are in the evidence file.
In particular the A115 ramps and ambiguous raised crossings remain a known
limitation; this release does not claim complete motorway reconstruction.

## Integration and checks

`prepareCityWestTransportV281` runs immediately **before**
`prepareStreetCurvesV276`, because v276 appends its proven road-navigation
crescents during preparation. Earlier encoded streams remain unchanged for
their own receipts. Exact source retirement occurs only in the final decoded
triangle/ink arrays after successful preparation. Navigation replacement is
applied after the earlier adapters and only for the two named ZOB roof owners.

The four Bun tests include the real decoder for all 22 ZOB, Zoo forecourt and
A100 packet/family entries; source mismatch, corrupted replacement and
unauthorized owner cases fail closed. Four Python tests cover source asset
identity, old complement receipts, complete roof plans, open-roof navigation,
geometry budgets, actual asphalt support and cardinal native triangle normals.
The native reception glazing follows its own stepped wall footprint and stays
below the retained native roof, rather than inheriting the taller drawn register.
The v276 street-curve and v192 station-detail regression suites also pass (14
Bun tests including the four new CityWest tests).
Focused checks:

```sh
uv run ruff check scripts/build_citywest_transport_v281.py tests/test_citywest_transport_v281.py
PYTHONPATH=.:scripts uv run pytest tests/test_citywest_transport_v281.py -q
cd src/app
bun test tests/citywest-transport-v281.test.ts
```

Reproduction uses `PYTHONPATH=.:scripts uv run python
scripts/build_citywest_transport_v281.py`; `--extract` additionally requires the
bounded original source caches. No original delivery packet is rewritten.
Visual browser QA belongs to the parent release check; no external browser was
opened by this task.

# V347 — complete mapped A10 junctions and BER light fittings

The A10 already had a complete centre/edge-line model in V200. This change
retains every original course and adds the actual missing interchange ramps,
limited motorway approaches and lane-derived carriageway edges. BER already
has the V205 terminal/roof model and V236 surface/building packets; this change
adds mapped aviation fittings on their existing ground rather than replacing
the airport with a second model.

## Sources and current status

Checked on 15 November 2026:

- [OSM A10 route relation21105](https://www.openstreetmap.org/relation/21105),
  its fourteen child relations and their complete way/node records from the
  [official API](https://api.openstreetmap.org/api/0.6/relation/21105/full.json).
  The eight documented endpoint-recovered V200 members are fetched separately.
  Sixty bounded junction map queries are followed by actual endpoint witnesses.
  Four initially unresolved ramp endpoints required six further continuation
  ways. Every selected ramp endpoint now has an explicit mapped continuation;
  local roads and service roads are witnesses, not invented connector chords.
- [BER operator — Flughafenanlagen](https://corporate.berlin-airport.de/de/unternehmen-presse/ber/flughafenanlagen.html)
  and its [June2025 airport facts](https://corporate.berlin-airport.de/content/dam/corporate/de/unternehmen-presse/ber/flughafenanlagen-ber.pdf).
  T1/T2 are the operational terminals. T5 has been closed since February2021
  and will not reopen. The existing parallel runways, terminal complex,
  two T2 connections and train station remain intact. The new fittings do not
  assert an unbuilt masterplan or a newly opened former terminal.
- [Official bounded BER map capture](https://api.openstreetmap.org/api/0.6/map?bbox=13.48,52.34,13.55,52.385).
  Original node IDs, coordinates, tags, versions and timestamps survive in the
  derived source archive. Raw XML stays in the task audit directory.
- [FAA lighting reference](https://www.faa.gov/Air_traffic/publications/atpubs/aim_html/chap2_section_1.html)
  supplies generic colour interpretation where OSM omits it: blue taxiway
  edges and green taxiway centres. Explicit `light:colour` always wins.
  This is a colour convention, not a BER fixture manufacturer specification.
- [Federal A10/A24 project completion report](https://dserver.bundestag.de/btd/20/087/2008720.pdf)
  confirms the northern expansion opened on11November2022. The model follows
  current source ways/lanes, not the former construction alignment.

No reference photographs become textures; no unverified interiors, future
structures or operational aviation light indications are invented.

## A10 coverage and representation

`a10-transport-v347-source.json.gz` contains1,713 mapped ways. The1,001 A10
carriageway members retain exactly their previous coordinates and form two
closed directed cycles of497 and504 members, totaling390,085.72m in both
travel directions. The712 additional ways total139,996.42m of ramps and limited
approach roads. They include550 motorway links,54 trunk links and108 motorway
approaches. All actual courses are retained; render geometry alone is clipped
to a2km distance from the ring, preventing uncontrolled regional expansion.

The nine named junction groups include Kreuz Oranienburg, Dreieck Barnim,
Dreieck Pankow, Schönefelder Kreuz, Dreieck Potsdam, Dreieck Nuthetal,
Dreieck Spreeau, Dreieck Havelland and Dreieck Werder. Smaller exits and rest-area
ramps are included in the same source audit. The1,208 ramp endpoints have
recorded connection witnesses. The archive also preserves191 bridge-tagged
ways and their layer metadata.

This remains the existing **cartographic transport representation**: thin
source-following strokes at the regional datum, in both Drawn and Native.
It does not claim physically drivable motorway decks or surveyed bridge
heights. Explicit widths are used where present; otherwise mapped lanes ×3.5m
plus an explicitly estimated shoulder determine the new edge lines. Original
V200 centre/edge lines remain intact. The new scope contains only exact courses
with a20m navigation margin, never the2km collection corridor as filled land.

`A10TransportV347.ts` adds23 immutable groups to the existing lazy regional
owner. Its57,336 vertices use860,040 bytes of geometry. Each group is separately
compressed with the existing gzip/Base85 codec and bounded to2MiB decoded;
no new decoder or global parsed-data cache is introduced. The runtime data
is285,621 bytes. Full feature/range metadata is audit-only.

## BER fittings and lifecycle

All5,417 mapped navigation-light anchors lie within the retained BER ground:
1,830 taxiway-edge,1,651 taxiway-centre,294 runway-edge,411 runway-centre,
581 approach,552 touchdown-zone,95 threshold and3 PAPI anchors. The explicit
and convention-derived lens palette contains1,672 white,1,830 blue,1,707 green,
188 red and20 yellow units. No light is silently dropped for mobile.

Drawn uses small eight-sided housings; Native independently uses cardinal
housing/lens boxes at the same original anchors. Inset bodies are0.07m high
and edge/approach bodies0.45m, with0.13/0.18m radii. These dimensions and
material swatches are declared display estimates. A PAPI node remains a single
mapped anchor, not an invented four-unit array. The fittings have no dynamic
lights, blink timers, textures or newly invented collision solids.

The235 holding positions,99 stand anchors and44 gate nodes are retained in the
source archive. They are not expanded into guessed painted extents or signs
at unknown terminal floors. Existing runway markings and terminal details
remain in their original owners.

The94 gzip packets form47 detail companions of existing `ber236-*` hosts.
They add2,781,525 bytes in total; the largest decoded packet is677,144 bytes.
The companion descriptors reuse each host's512m bounds and existing load,
unload and family admission. Their navigation is empty and footprint addition
is empty: old ground, stairs, bridges, buildings and voids remain authoritative.
No live, Worker, startup or public byte ceiling is raised.

## Reproduction and integration

Capture the bounded A10 evidence (existing capture files are reused):

```sh
uv run python scripts/fetch_regional_transport_v347.py --output /absolute/audit/city-v347
```

Save the documented BER XML response as `ber-current.osm` in the same audit
folder, then prepare and build isolated packets:

```sh
uv run python scripts/build_regional_transport_v347.py \
  --prepare /absolute/audit/city-v347 --output /absolute/audit/city-v347/ber-packets
```

Root integration only:

1. Add `createA10TransportV347(native)` to the lazy `createRegionOutlinesV200`
   root, preserving its earlier children and existing disposal path.
2. Add the exact source-course scope from `a10-transport-v347-scope.json` to
   permitted regional navigation if required. Do not render a new ground slab.
3. Copy the94 staged BER gzip files to `public/mesh/surrounding-berlin-v159`;
   append the47 descriptors from `ber-fittings-v347-manifest.json`. These are
   ordinary host companions, requiring no procedural catalogue factory.
4. Update immutable source history, package hashes and release validation.
   Keep original V200/V205/V236 files and all existing descriptors.

Validation covers both closed cycles, every preserved old source course,
all actual ramp-end witnesses, all compiled source offsets, every original
light anchor and explicit colour, all packet hashes/bounds/empty navigation,
Native cardinality, exact runtime buffers, day/night materials and recreation
after disposal. The packet test accepts `BER_V347_PACKETS` before integration.

```sh
BER_V347_PACKETS=/absolute/audit/city-v347/ber-packets \
  uv run pytest -q tests/test_regional_transport_v347.py
cd src/app
bun test tests/a10-transport-v347.test.ts
```

These are source/geometry and lifecycle checks. Public viewer build, on-screen
inspection and publication belong to the root release validation.

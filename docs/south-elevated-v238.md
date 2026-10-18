# Southern elevated U-Bahn — v238

The retained OpenStreetMap railway centre lines now form a continuous, double-track
route from Bülowstraße through Gleisdreieck and east to Kottbusser Tor. The U2 and
U1/U3 cross at different heights; they are not joined by a fictional rail junction.
The eastern extent ends shortly beyond Kottbusser Tor. Museum railway tracks and
the underground U8 remain untouched.

Four station halls follow the exact retained roof envelopes and platform plans:
Bülowstraße, lower Gleisdreieck U2, upper Gleisdreieck U1/U3, and Kottbusser Tor.
The models use thin elevated decks, individual steel supports, separate platform
edges, steel frames, glass ribbons, pitched roofs and central skylights. Bülow
adds its stone entrance pylons; Kottbusser Tor uses light-grey framing and sparse
street-level supports with long open spans. Existing ground, roads and coverage
are unchanged. Source-mapped stairs are represented within the replacement sites;
the unchanged western Kottbusser access body remains in place.

Sources and accuracy boundaries:

- LDA [Bülowstraße](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066412):
  stone entrances, iron hall, 1928–29 eastern extension.
- LDA [Gleisdreieck](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031096):
  intersecting halls, masonry and steel supports, upper glazing and roof lights.
- LDA [Kottbusser Tor](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031103):
  120m hall, 7.5m structural rhythm, steel/glass, central platform and roof light,
  limited street-level supports and restored light-grey finish.
- [BVG Bülowstraße](https://www.bvg.de/de/verbindungen/stationsuebersicht/u-buelowstr)
  confirms the U2 service.
- The participating fire-safety planner's
  [Gleisdreieck project description](https://www.brandwerk.expert/referenzen/projekte/u-bahnstation-gleisdreieck-berlin/)
  gives approximately 10m and 15m platform levels. The Berlin Brandenburg Film
  Commission [location record](https://www.bbfc-cloud.de/de/public/locations/u-bahnhof-gleisdreieck-kreuzberg)
  gives 9.6–10.3m for the lower platform. These are recognition references, not
  a complete surveyed engineering alignment.

At Gleisdreieck, 10m and 15m refer to the platform walking surfaces. The model's
rail/deck levels are 9.08m and 14.08m above the display ground; the 0.92m platform
rise and mapped stair endpoints therefore meet the documented platform levels.

The compact source archive retains the original and clipped geometries of all
24 ways, railway tags, mapped stair levels and exact station plans. The 1.435m
gauge, Bülow minimum height6m and Kottbusser track height6m are OSM tags. Between
stations, track height is a continuous display interpolation. Member dimensions,
support positions, roof rises, glass divisions and material swatches are explicitly
estimated. Local LoD2 aggregate roof records were inspected but not relabelled as
surveyed station-only roofs: they also contain adjacent and intersecting structures.

Three exact older Gleisdreieck core proxies (67972414,67972418,67972417) and two
Kottbusser Tor outer proxies (OSM-way-37739169,OSM-way-382253030) incorrectly filled
the space below the elevated station. Complete replacement models are supplied
separately for atomic integration, with original prism/column receipts and exact
packed-triangle fingerprints. The entire old bridge plan is retained as an
elevated deck. The source files remain immutable; changed fingerprints must fail
closed. The west access OSM-way-382253029 is not retired.

Nine companion tiles follow the existing cancellable packet lifecycle. Every
packet has the mandatory navigation object with thin platforms/decks, mapped
stair treads and individual supports. No full-footprint ground obstacle is added
below a bridge. Core navigation uses world coordinates; existing outer packets
use tile-local coordinates. Native geometry is independently axis-aligned;
the drawn/mobile model is identical. The live byte/residency limits, tour and
start choices do not change. Geometry bytes, hashes and per-part limits are
recorded in `south-elevated-v238-evidence.json`; these counts cover this addition,
not the entire application. Native row sampling and centimetre quantization are
display approximations, not changes to the retained source plans.

Useful world-space review views:

| Place | Camera | Target |
|---|---|---|
| Bülowstraße | [-620,34,2465] | [-600,15,2363] |
| Gleisdreieck crossing | [250,47,2250] | [136,19,2160] |
| Kottbusser Tor | [3140,35,2395] | [3137,14,2284] |

Focused checks: `uv run pytest -q tests/test_south_elevated_v238.py`.

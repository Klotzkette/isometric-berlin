# A111 through Tegel — v1.0.94

The owner requested the motorway through Tegel continuing north. This bounded
cartographic supplement follows all 129 A111 main-carriageway ways in the retained
Geofabrik Berlin extract of 29 September 2026 (OpenStreetMap, ODbL-1.0), from
Dreieck Charlottenburg to the extract's northern Berlin boundary. It does not
extend to the A10 or generate adjacent unrequested districts.

Every source coordinate is retained in `tegel-motorway-v194.json`. The renderer
adds only the portions outside the union of the existing detailed, ring-city,
southern, outskirts and northern scopes. Existing streets therefore retain
their present geometry. The new addition has 3,276 surface-line vertices and
118 tunnel-line vertices, with two static draw calls and under 45 KB of buffers.
The earlier outer motorway and street outlines remain unchanged.

Surface carriageways show their mapped axis and two estimated edge lines.
Widths use each way's tagged number of lanes, at 3.5 m per lane plus a 2.5 m
shoulder allowance. These are drawing estimates, not measured road dimensions.
Mapped tunnels have a dashed projected course, rather than a solid invented
surface road. The 16 tunnel ways include Flughafen Tegel, Ortskern Tegel,
Forstamt Tegel and Beyschlag-Siedlung. Their distinction agrees with the
[Berlin traffic authority's tunnel notices](https://viz.berlin.de/en/aktuelle-meldungen/wartungsarbeiten-auf-der-a111/).
No engineering gradient, tunnel depth, bridge clearance or ramp detail is claimed;
the sparse supplement uses the established cartographic height datum.

The exact source corridor, including a 10 m outline margin beyond the estimated
carriageway edge, is recorded in `bounds-tegel-motorway-v194.geojson` and joined
to the other explicitly requested v194 sites in `bounds-named-v194.geojson`.
Only navigation reach and recessed background paper extend to that finite
envelope. Blank intervening space is not filled with invented streets or houses.

Reproduce with `uv run python scripts/build_tegel_motorway_v194.py`.
Source tests verify complete way identities, retained bends, tunnel classes,
exact previous-scope subtraction and runtime/source agreement. The constructor
test checks bounds, static transforms, tunnel dashes and memory in both families.

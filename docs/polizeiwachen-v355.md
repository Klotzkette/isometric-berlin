# Berlin police station locations

The 16 November 2026 inventory includes 52 public location records. The 37
physical station points from Berlin’s police WFS are all present. The current
police directory confirms that the reorganised regional sections 17/18, 27/28
and 52/53 each retain both staffed locations. The names follow the current
organisation and the scene continues to track the locations individually.
The two permanent district substations at Alexanderplatz and Kottbusser Tor,
the three water police bases, seven federal railway station services, the separate
federal inspectorate on Lange Straße and two headquarters complete the 52 rows.

- [Polizei Berlin – Landespolizeidirektion and station directory](https://www.berlin.de/polizei/dienststellen/landespolizeidirektion/)
- [Geoportal Berlin – Police WFS metadata, dl-de/zero-2-0](https://gdi.berlin.de/geonetwork/geonetwork/api/records/1cc4e86e-6b03-3b66-806b-98e2b763c290)
- [Wasserschutzpolizei – West, Mitte and Ost station contacts](https://www.berlin.de/polizei/_assets/dienststellen/anlagen-dir-e/info_12_innenstadt.pdf)
- [Bundespolizei Berlin – Organisation](https://bundespolizei.de/die-bundespolizei/organisation/bundespolizeidirektion-berlin)
- [Deutsche Bahn – Ostbahnhof station service in the main concourse](https://www.bahnhof.de/berlin-ostbahnhof/bundespolizei)
- [Bundespolizei – Separate Ostbahnhof inspectorate at Lange Straße 30](https://bundespolizei.de/die-bundespolizei/dienststellensuche/bundespolizeiinspektion-berlin-ostbahnhof)

The police WFS coordinate is a station point. Where the supplemental sources
only supply a public address, the exact Geoportal house coordinate is retained
as an address, without claiming a separate exterior or entrance. The number
lookup distinguishes Baumschulenstraße 1 from 1A and 1B. Public railway services
remain tenants within their stations. For five of them, mapped OpenStreetMap
police tenants agree with the federal directory or station operator. The
Hauptbahnhof already has its own station interior frontage. Federal units serving
inside ministries and security compounds, mobile deployments and event-only police
points are outside the physical public station inventory. The Alexwache already
includes a shared workstation for the federal police.

The retail team’s Geofabrik extract was current as of 15 November 2026 at
21:22:28 UTC. Six specific OSM building polygons are entered as candidates,
including the freestanding Alexwache. Other named police land parcels are not
used as building outlines. Five entrances have OSM nodes on the matching source
building. Two generic `entrance=yes` nodes identify a door on the facility
footprint; they do not establish a public route or opening hours. Exact source
IDs remain where the retained building was independently verified. The main
placement compiler must still find the actual rendered façade. Sites can appear
as verified locations even with no unique building match in the current model.

The official Alexanderplatz photograph shows a dark blue fascia above dark glazed
bays and silver panels. Its aerial photograph distinguishes the 70 m² pavilion
from the nearby subway stairwell. The Kottbusser Tor photograph locates the
charcoal frontage above the street in the existing NKZ. The station floor
is confirmed by the police directory, while elevation within the storey and trim
measurements are visual estimates. The Oudenarder Straße reference shows street
level metal frames at the glazed entrance set into the yellow and red brick of the
Osram-Höfe. The Alt-Moabit photograph documents rounded ground-floor arches and
rustication at Wache 28. The entrance coordinates there come from the matching
OSM building. Source photographs and their pixels are not distributed.

- [Alexwache reference, Polizei Berlin](https://www.berlin.de/polizei/dienststellen/landespolizeidirektion/direktion-5/abschnitt-57-nebenwache-am-alexanderplatz/)
- [Kottbusser Tor reference, Polizei Berlin](https://www.berlin.de/polizei/dienststellen/landespolizeidirektion/direktion-5/abschnitt-53-nebenwache-am-kottbusser-tor/)
- [Regionalabschnitt 17/18 façades, Polizei Berlin](https://www.berlin.de/polizei/dienststellen/landespolizeidirektion/direktion-1/regionalabschnitt-17-18/)
- [Regionalabschnitt 27/28 façades, Polizei Berlin](https://www.berlin.de/polizei/dienststellen/landespolizeidirektion/direktion-2/abschnitt-27/)

Rebuild with `uv run --with osmium python scripts/build_polizeiwachen_v355.py
<scratch> --osm-pbf <berlin.osm.pbf> --osm-snapshot <timestamp> --checked <date>`.
The builder queries the Berlin police station layer and 13 exact address queries,
selects the required source objects from the local OSM extract, and emits a small
compressed source receipt with per-feature source URLs and hashes. The facade
inputs remain in `geo_data/regierungsviertel/polizeiwachen-v355-facades.json`.

For the Alexwache and Kottbusser Tor, the facade evidence includes separate
Minecraft spans. Each records the exact retained packet, building owner and
cardinal wall segment. Both original vertical triangles were verified at the
full wall height on each segment. The four-metre Alexwache span faces north.
The four-metre Kottbusser Tor span faces south at the first-floor tenancy. This
keeps photographed Drawn treatments separate from the block dimensions.

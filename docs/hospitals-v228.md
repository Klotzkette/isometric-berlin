# Step 10: six bounded hospital sites (v228)

This change preserves every existing city packet, source envelope, authored
Charité tower and historical campus detail. It does not regenerate a district
or increase live city residency. Facade rhythm, glass, reveals and restrained
material colour are explicitly estimated on the actual supported wall spans.
Drawn detail is identical on desktop and touch devices; Minecraft has its own
orthogonal facade blocks and source-surface voxel skins. Each campus is culled
separately. No new textures or downloaded photographic assets are packaged.

## Identities

* Charité Campus Mitte: the bounded addition concerns the separate central
  emergency building, OSM way 413988641. The v207 Bettenhochhaus is protected.
  [Operator campus](https://www.charite.de/die_charite/campi/campus_charite_mitte/).
* Benjamin Franklin: Hindenburgdamm 30. The operator confirms the five-storey
  ward blocks above the lower building and the concrete sun screens.
  [Operator architecture](https://50-jahre-cbf.charite.de/historisches_bildergalerien/haetten_sies_gewusst/),
  [Berlin heritage authority](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/charite-campus-benjamin-franklin-641031.php).
* Vivantes Klinikum im Friedrichshain: Landsberger Allee 49. This is the named
  Vivantes hospital, rather than an arbitrary second operator campus.
  [Operator](https://www.vivantes.de/gesundheitsnetzwerk/krankenhaeuser/klinikum-im-friedrichshain/).
* The hospital near Osloer Straße is DRK Kliniken Berlin Mitte,
  Drontheimer Straße 39–40. It is not the Jewish hospital.
  [Operator](https://www.drk-kliniken-berlin.de/mitte).
* Jüdisches Krankenhaus: Heinz-Galinski-Straße 1.
  [Operator contact](https://www.juedisches-krankenhaus.de/de/aktuelles/kontakt.html),
  [history](https://www.juedisches-krankenhaus.de/willkommen/geschichte.html).
* Fröbelstraße 15 is the **former** Klinikum Prenzlauer Berg. It is distinct from
  the adjacent Fröbelstraße 17 administrative campus refined in v227. Hospital
  use ended in 2020; the building is not labelled as an active Vivantes clinic.
  [BIM acquisition and reuse](https://www.bim-berlin.de/presse/pressemitteilungen/details/erster-ankauf-des-berliner-bodenfonds-froebelstrasse-15-fuer-die-stadt-erworben).

## Geometry, preservation and limits

`hospitals-osm-v228.json` is a bounded source snapshot of the retained
`berlin-260929.osm.pbf`, including complete original tags, rings and holes.
Simple-3D `building:part` ways are in GDAL's **lines** layer. The old importer
read multipolygons, which explains the incomplete Benjamin Franklin silhouette.
The new extraction explicitly reads closed building-part ways as polygons.

The existing Benjamin Franklin parent, OSM relation 5943188, remains a 6m podium.
Twenty-nine independently mapped upper building parts are added above its top;
their 3/8/9-storey tags and minimum storeys reproduce the differentiated ward and
treatment blocks. Their plan positions are exact OSM, while converting tagged
storeys to 3m is an explicit estimate. No old roof, wall or navigation owner is
removed. A preserved lower roof inside the new opaque volume is not deleted.

The DRK and Jewish sites were absent from all six retained resolved city layers.
Their new bounded bodies follow mapped buildings and building parts. A parent
outline contributes only the remainder outside its mapped parts, so a low wing
is not buried inside a larger parent extrusion. Tagged metre heights take
precedence over tagged storeys; buildings without either use a clearly recorded
9m contextual estimate. Roof surfaces remain a flat abstraction where no metric
roof survey exists. Small outline-following 2m display aprons provide ground
support; they are not surveyed paving or an expansion into surrounding streets.

The official missing LoD2 archives returned HTTP 503 on 2026-10-17, including a
single bounded Benjamin Franklin retry. `hospitals-source-v228.json` retains
these failures, original old owner evidence, every selected part, and the height
provenance. Original measured envelopes at Friedrichshain and Prenzlauer Berg
remain unchanged. Charité lower-facade additions stop conservatively below the
existing roof geometry and do not touch its protected high-rise parts.

Replay: `uv run python scripts/build_hospitals_v228.py`; use `--extract-parts`
to re-extract the bounded OSM line-layer parts. Tests cover exact source hashes,
missing-part footprints, lower/upper level separation, campus coverage, preserved
Charité owners, per-site culling, independent native construction and navigation.

Native collision/support indexes the actual independent surface blocks, including
cells extending beyond the smooth source outline. Only packed numeric bounds and
cell offsets survive first native use; the weak construction payload is not held.
Roof support uses real block tops, rejects buried merge seams and retains the
pedestrian height guard. Drawn navigation continues to use the source polygons
and roof sheets; enclosed source volumes remain solid in both interpretations.

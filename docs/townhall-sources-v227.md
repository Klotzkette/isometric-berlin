# District town-hall geometry v227

Step 10 covers the named administrative sites of the 23 pre-2001 districts and
all 12 current district headquarters. See `townhall-inventory-v227.md` for the
verified identities and the distinction between former and current offices.

## Evidence and limits

`geo_data/regierungsviertel/townhall-osm-v227.json` retains the exact selected
OSM geometries/tags in WGS84, extracted from the retained Berlin PBF. Campus
boundaries are selection boundaries; they are never extruded as building boxes.
The Fröbelstraße administrative campus and Zehlendorf campus retain their actual
individual mapped buildings. Wedding separately includes the old hall, the
modern high-rise and its low assembly podium.

`townhall-source-v227.json` retains full official LoD2 leaf-part wall/roof sheets
where the kilometre archives were available. The retained archive hashes and
unavailable archive names are explicit. New archive requests returned HTTP 503
from the official service; those gaps use the original mapped footprints,
including holes, with tagged heights first. Storey-based heights and otherwise
14.3 m display envelopes are explicitly **unsurveyed estimates**, not measured
roof architecture. No tower is invented to make an incomplete source look final.
The entire original source record remains outside the runtime bundle.

An independent area check compares the union of retained parts with each mapped
site. It caught and corrected the initially partial Spandau selection: the
available 155 m² measured annex covers only 2.3% of the main mapped hall. The
remaining actual footprint is now retained explicitly, while its existing split
OSM envelope stays visible. Wilmersdorf retains its larger existing measured
parent; only the actual mapped Rathaus faces receive new fitting references.

## Ownership and rendering

The renderer emits 224 complete source parts at 16 sites: 8,479 triangles and a
separate 19,253-run native surface interpretation. Each site owns a separate
mesh/batch and bounding sphere, allowing ordinary frustum culling. Drawn touch
and desktop detail are identical. Constructor arrays are read once and are
registered as weak, read-only data; scene objects retain only the GPU-ready
arrays and small owner identifiers.

Twenty-five old surrounding-city owners yield only through independent exact
colored-triangle/line replay receipts. Four old core prisms have separate exact
receipts. Previously detailed Mitte part geometry, dedicated Steglitz/Köpenick
models, and existing fallback envelopes are kept. No geographic bounding box
is used to erase old geometry. Fallback facade references are capped at the
actual retained display roof, so cornices do not float above it.

All measured XZ coordinates and roof sheets are preserved. A single rigid Y
offset per parent aligns it with existing local terrain. Retained Mitte bodies
use their existing authored parent datum. Old and modern Wedding bodies align
at the original core grade of 5.2 m; the 1966 extension receives a separate light
facade palette, with tagged source colors taking priority.

The six formerly absent peripheral halls—Tempelhof, Treptow, Marzahn,
Hellersdorf, Lichtenberg and Reinickendorf—receive their exact mapped shells
and a two-metre outline-following support apron. The apron and elevation are
bounded display estimates, not surveyed paving or district-wide fill. Walking
uses the actual source rings/holes and triangulated roofs; navigation bounds
include every measured wing, even where it extends beyond the OSM outline.
Courtyards stay open, and roof support never lifts a walker up from below.

## Replay and verification

Run with the repository's existing `uv` environment:

```text
uv run python scripts/build_townhall_source_v227.py
uv run python scripts/build_townhall_ownership_v227.py
uv run python scripts/build_townhall_envelopes_v227.py
uv run pytest tests/test_townhall_source_v227.py tests/test_townhall_inventory_v227.py
```

`--extract` on the first command replays retained local official archives and
OSM selections. It never downloads whole-city geometry during ordinary replay.
Python tests verify complete original surface area, source hashes, true rings
and holes, source coverage, ownership and bounded support. Runtime tests cover
independent mesh bounds, separate native geometry, walking support and open
courtyards. No model-wide resolution, view-distance or residency cap changes.

# v1.0.30 — Pariser Platz and western Unter den Linden

Pipeline step 10. The repair replaces the coarse street presentation from the
Brandenburg Gate through Friedrichstraße with continuous public-space surfaces.
It retains the committed buildings, terrain samples, gardens and navigation.

## Cause and bounded correction

The previous district street window stopped at world X=625, near Wilhelmstraße.
The viewer retained its four-metre asphalt raster, and the progressive Worker
deliberately did not build the expensive complete-city asphalt/paving polygons.
Consequently the avenue farther east stayed stepped even after loading finished.
Raster fringes also protruded around the smooth western road bands. Pariser
Platz's polygon paving was absent from the line-only district extractor.

The source axes are already straight. The new local supplement preserves them
and resolves alternating 6.5/9.75m lane-derived widths that formerly introduced
additional steps at OSM way splits. Existing explicit 11m western widths remain;
the eastern avenue uses a continuous 14m display envelope, clipped by the exact
median edges. This is a documented reconstruction from source axes/median
geometry, not a replacement measurement of the road width.

The complete local footprint replaces raster cells only where a clearance disk
encloses the entire four-metre cell. Edge cells and all neighbouring ground stay
intact. Old raster kerb ink is suppressed within the same local footprint. The
offline generator replaces asphalt, paving and kerbs only inside this footprint;
the rest of the existing district geometry remains present.

## Evidence and reconstruction limits

- Retained ALKIS parcels `DEBE01AL23P00005` and `DEBE01AL23V0000H` anchor the
  western public-space perimeter. OSM identifies its use; cadastral boundaries
  do not themselves survey paving materials. The original ALKIS payload is
  unchanged. [Berlin ALKIS service](https://gdi.berlin.de/services/wfs/alkis).
- [OSM plaza way 24240315](https://www.openstreetmap.org/way/24240315),
  [paved median tip 915958607](https://www.openstreetmap.org/way/915958607),
  [gravel promenade 915958593](https://www.openstreetmap.org/way/915958593),
  the six adjacent grass polygons and mapped street/sidewalk axes retain their
  source roles. The two larger authored Pariser Platz garden envelopes are
  preserved, including their established rotation.
- East of the ALKIS extract, mapped outer sidewalk axes bound the narrow
  continuation through Friedrichstraße. Two metres of outward infill and joins
  across crossings are explicitly inferred presentation geometry. They are not
  presented as additional cadastral coverage or surveyed pavement widths.
- Independently mapped paving/grass/gravel overlap by 0.514m² at the median tip.
  Natural-surface edges take precedence there; mapped paving excludes inferred
  asphalt. Every original feature remains in the canonical source files.
- Kerb rise (14cm), width (22cm), paving tones and surface lifts are display
  details. The DGM's gentle grade remains; no flat-height plaza or road slab
  replaces the terrain. Source hashes, IDs, licences and conflicts are exported
  with the supplement. No reference photograph or runtime texture is added.

## Rendering and validation

`scripts/brandenburg_approach.py` constructs the local source partition;
`scripts/build_district_streets.py` triangulates it offline into the existing
street payload. The footprint covers about 51,635m². The full district layer
changes from 188,028 to 191,215 triangles, with the same sixteen-metre maximum
terrain-sampling edge and centimetre coordinate encoding.

The renderer adds three bounded static batches: raised avenue sidewalks, median
gravel and lawn bases. The district street layer now has eight batches, shared
by desktop/touch and Day/Night/Snowstorm/Schwellenraum. Sidewalks meet the kerb
top at terrain+0.32m. Lower plaza paving and lawn bases stay below the existing
authored setts, flowers and fountains. Minecraft keeps its existing native
block terrain. Canonical source datasets, buildings, view distance and controls
are unchanged.

Tests cover exact source envelopes and hashes, disjoint complete surface
coverage, retained gardens/median, explicit versus inferred widths, open road
crossings, triangulation area within the centimetre boundary error bound,
terrain clearance, complete-cell raster removal and unchanged neighbouring
ground. Fixed before/after production views at the plaza and avenue were
visually inspected. All four drawn modes passed production-browser geometry and
visibility checks with desktop and touch profiles (eight combinations), without
runtime errors. The focused frontend suites passed 72 tests; source and release
validation are recorded in the GitHub release notes.

# v1.0.80: connected outer outlines and Ringbahn stations

Narrow street corridors now connect ICC/Funkturm through the Neue Kantstraße
approach to existing City West and Steglitzer Kreisel through Schloßstraße,
Rheinstraße and Hauptstraße to existing Schöneberg. Nearby street-facing
buildings use exact mapped outlines with sparse vertical envelopes. Every
Ringbahn stop has a source-bound platform, roof or station-building outline.
The complete closed S41 trace and both mapped A100 carriageway networks remain.

The Kreisel retains its 118.5 m envelope and open storey registers. A few extra
vertical divisions and mapped podium/parking structures improve recognition.
These are sparse recognition outlines, not a surveyed structural model or a
claim about the building's current construction condition.

No existing city asset is rebuilt, coarsened or removed. The supplement uses
three static batches, one-pixel lines and lazy loading. Previous
v179 segments are preserved numerically. Street border offsets, untagged
heights and structural divisions are labelled display estimates. The original
detailed-city polygon and 93-place tour stay unchanged; the independent
outline scope is recorded in `bounds-outline-v180.geojson`.

The final layer contains 55,964 vertices and 1,026 features. Its 671,568-byte
position buffer is shared by ordinary street/building wires and one subtle
cartographic Ringbahn/station pass. Together with the two index buffers it
uses 783,496 bytes, plus the tiny paper geometry. The rail pass alone ignores
depth occlusion to remain legible where existing halls or bridges cover the
tracks, including Schönhauser Allee. It does not move, remove or replace those
structures. All other outline geometry retains normal depth occlusion.

Sources: [connecting corridors](outer-connectors-v180-sources.md),
[ring stations](ring-stations-v180-sources.md), and the retained
[v179 routes](outer-thin-outlines-v179-sources.md).

## Validation

- Reproducible generation; all previous segments retained; all 27 source station
  names represented; connected street graphs and zero duplicate building area
  inside the detailed city.
- Runtime buffer budget, rail-only overlay indices, original depth behaviour
  for ordinary wires, all-mode shared geometry and backing-plane separation.
- Production TypeScript/Vite build and 46 focused Bun tests (280,250 assertions).
- Six Python tests cover generation, scope, complete source lines, previous
  segment preservation, all station identities and connected corridor graphs.
- Full Python suite: 852 passed, with two pre-existing CRS-fixture warnings.
- Repository-wide Ruff formatting/lint, release readiness and local-package
  smoke passed. Existing public mesh assets and the detailed bounds are unchanged.
- Chrome desktop and WebKit iPhone 13 profile: all six modes plus return to Day;
  correct layer counts, stable per-runtime geometry, no JavaScript errors or
  WebGL context loss. An earlier WebKit startup ended with a target closure;
  the completed rerun passed. These checks do not establish physical iPhone
  memory limits or prove that crashes are impossible.
- Visual inspection: both city seams, Rheinstraße, Kreisel, Ostkreuz,
  Schönhauser Allee and Westend, including occluded station outlines.

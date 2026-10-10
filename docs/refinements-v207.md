# Charité and Kapelle-Ufer ministry — v1.0.107 / Step 10 v207

This release refines two existing buildings within the unchanged detailed city:
the Charité Bettenhochhaus at Campus Mitte, and the former BMBF/current federal
research and space ministry at Kapelle-Ufer 1. The latter matches the owner’s
Spreebogen location; the former aviation ministry on Wilhelmstraße is a distinct
building and is unchanged in this release.

The Charité receives a five-level dark treatment base, pale ward facade with
paired windows and vertical lesenes, and rooftop identity. The primary architect
identifies EG–4. OG as the treatment zone and 5.–20. OG as the ward levels:
https://schweger-architects.com/projects/fassadengestaltung-charite-berlin/.
Retained measured building parts anchor the new details. Facade subdivisions,
color values and lettering placement are proportional interpretations, not
surveyed opening coordinates.

The ministry receives source-bound green/grey material differentiation, thin
vertical fins, glazing, framed entrances and rooftop detail. Its complete
ten-part main envelope, independent entrance portico and courtyard voids remain. The current building
identity and address are confirmed by the government directory:
https://www.bundesregierung.de/breg-de/bundesregierung/bundesministerien/bundesministerium-fuer-forschung-technologie-und-raumfahrt.

Both are texture-free bounded additions. Drawn detail is identical on desktop
and touch devices. Minecraft uses separate orthogonal geometry. Construction
arrays use the existing exact weak decoding cache and final-size instance buffers;
city coverage, navigation, the 93-place tour and residency budgets remain unchanged.

Only the precisely identified older inferred facade recipes yield to these
replacements. All source shells, source inventories and unrelated details remain.
See [Charité source and budgets](charite-bettenhaus-v207.md),
[ministry source and budgets](ministry-spree-v207.md), and
[independent preservation receipts](civic-charite-preservation-v207.md),
including the original v1.0.106 commit and unchanged source/geometry hashes.

## Verification

- Full Python suite: 1,196 passed and four skipped; the only initial failure
  concerned the previous local package version. After packaging v1.0.107, all
  76 release-readiness tests passed.
- Full Bun suite: 3,176 passed on the initial run. Two cooperative snapshots
  needed the final model capture; an unrelated full-city water regression timed
  out under concurrent host load. Focused reruns resolved these failures without
  changing any historical fixtures.
- Focused source, geometry, preservation and lifecycle checks cover the two
  additions. The complete v1.0.106 city complement remains byte-identical.
- Chrome and WebKit with the iPhone 13 viewport completed all six visual modes,
  including actual night-light on/off controls, without JavaScript errors or
  WebGL context loss. A final separate day/Minecraft pass in both browsers confirms facade visibility
  after fitting the retained overlapping source shells.
- TypeScript/Vite build, Ruff, local package smoke and release readiness pass.
  Physical iPhone hardware was not available for this check.

The model-specific receipts linked above distinguish measured source geometry
from proportional facade interpretation and record the final GPU-buffer budgets.

The ministry native regression checks complete glazing extents, including the
night overlay, against both retained shell families. The combined native facade
uses 1,349,212 buffer bytes. Charité uses 364,196 bytes drawn and 565,368 bytes
native; the ministry drawn model uses 1,115,156 bytes.

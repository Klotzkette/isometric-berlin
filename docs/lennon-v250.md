# John-Lennon-Gymnasium street front v250

Step 10 corrects the already modeled public street front at Zehdenicker Straße
17. The old v205/v230 window formulas repeated a 3.25 m storey pitch, producing
five or six rows on some faces. The exterior reference instead shows four
occupied levels, pale plaster, round upper window heads, shallow segmental lower
heads, a simple eave and three dark central entrance portals. Those recognition
features now have one consistent bounded reading.

## Sources and uncertainty

- [Landesdenkmalamt object 09080444](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444):
  Hermann Blankenstein's 1885 school and its public address.
- [School contact page](https://jlgym-berlin.de/jlg/index.php/node/25):
  John-Lennon-Gymnasium, Zehdenicker Straße 17.
- [Kvikk's exterior photograph, 3 March 2013](https://commons.wikimedia.org/wiki/File:Berlin_Mitte_Zehdenicker_Stra%C3%9Fe_17_(09080444).JPG),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), is an external
  visual reference only. It is recorded in the public visual-reference manifest.
  No photograph, pixel, font or texture is bundled or loaded.
- The retained Berlin LoD2 parent `DEBE01YYK000064P` supplies all metric anchors.
  Its eleven complete parts, roofs and courtyard remain unchanged, including
  the exact whole-parent **+6.91 m** existing terrain translation.

Four occupied levels and the material, head and portal types are observed cues.
The 3/4/8/4/3 bay spacing across the five selected front planes, window dimensions,
small square eave vents, fitting elevations and colour values are proportional
**display estimates**, not a newly surveyed opening schedule. No unobserved rear
sports wing, changed roof, extra gable or courtyard fill is invented.

The ten selected source walls include the five distinct ground-storey recessed
faces. Shallow facing and portals attach independently to their actual planes;
the main facade is not extended across the source recesses. Geometry is stored
in a compact local millimetre frame. This encoding applies only to newly authored
fittings; original measured geometry is never requantized or changed.

## Exact former-detail correction

Only these obsolete authored groups yield:

- `schoolsV185.json`: the school's 31 drawn / 139 native accents;
- `schoolsPlacesV205.json`: its 352 boxes, 792 arch strokes / 1,320 native rows;
- `centralNamedV230.json`: its 182 boxes / 304 native rows.

The complete original files remain byte-identical. SHA-256 receipts of all source
files and a dual fixed-precision fingerprint of each eligible row array are in
`geo_data/regierungsviertel/lennon-v250-evidence.json`. Both families must match
before replacement is allowed. Unrelated or modified entries fail open and retain
their old detail. Nothing in a measured city packet is retired.

`createLennonV250(native)` occupies the existing v185 school mesh slot.
`replacesLennonV250(entry,"v205"|"v230")` lets the two newer renderers skip only
the audited superseded groups. The three former batches become one; no streaming
descriptor, material family, texture, animation or frame callback is added.
`lennonV250.json`'s `boxes`, `rods` and `nativeRows` are construction-only weak
fields. No decoded member arrays are retained in the scene or module state.

## Bounds and verification

- Drawn: **1,601** instances, **121,676** transform/colour bytes; full detail is
  identical for mobile and desktop.
- Native: **3,450** independent axis-aligned members, **262,200** instance bytes.
- Source JSON: **186,270** bytes; existing lossless JSON transform: **99,994**
  bytes before final bundle minification. Existing runtime limits remain intact.
- Three Python tests pass: immutable complete source/datum, exact face and arch
  containment, three source-attached portals, bounded buffers and deterministic
  replay. Two Bun tests pass with 20,753 assertions: complete receipt matching,
  changed-input/unrelated-owner protection, frozen finite exact-sized batches,
  no UVs, same full mobile detail and independent orthogonal native matrices.
- Focused Ruff format/check passes. Final integrated build/browser checks belong
  to the parent release run.

Rebuild with `uv run python scripts/build_lennon_v250.py`.

Verified close front camera: eye `[2267.567,24,-1294.211]`, target
`[2261.244,21.5,-1282.624]`, field of view 85 degrees.
Overview: eye `[2310,65,-1355]`, target `[2261,21,-1282]`. The facade faces roughly
`[0.479,0,-0.878]`; a camera south of z=-1282 sees the rear courtyard/nearby roofs,
not the corrected Zehdenicker frontage.

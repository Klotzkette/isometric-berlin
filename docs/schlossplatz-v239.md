# Staatsratsgebäude and Hanns Eisler at Schlossplatz — v239

This Step 10 correction replaces four existing v169 source families with
complete retained Berlin LoD2 parents and richer recognition detail. Their two
older coarse core prisms remain suppressed. The bounded work stays inside existing
coverage. The university's Schlossplatz site is the **Neuer Marstall**, distinct
from its already authored Charlottenstraße 55 / Gendarmenmarkt campus.

| Site | Retired core prism | Official complete parent family | Parts |
|---|---|---|---:|
| Former Staatsratsgebäude / ESMT | `23075450` (OSM way 23075450) | `DEBE01YYK000060j` | 2 |
| Neuer Marstall, northern university / river / transverse wings | `94079583` (OSM way 194079583) | `DEBE01YYK0000Bfk`, `DEBE01YYK00008jV`, `DEBE01YYK0000CnW` | 8 |

All ten parts and 125 original wall/roof sheets, including every source boundary
vertex, are retained in `schlossplatz-v239-source.json.gz` and in the complete
drawn replacement at the established centimetre packing precision. The exact
old prisms and unchanged source-payload SHA-256 hashes remain in the receipt.
The rear ESMT annex, Alter Marstall, southern library wings, Ribbeck-Haus,
Schloss, streets, terrain, and earlier Gendarmenmarkt work are not transferred.
The new source wings preserve the open former carriage court.

## Height and recognition evidence

The source includes basements: Staatsrat's minimum is y=2.727, below the existing
y=5.2 street. **Absolute source elevations are retained**, without translating
the entire building upward. Three 2025 official bDOM checks give roof elevations
63.27, 63.34 and 63.36 m NHN, consistent with the source roof at 63.139 m NHN.
A street check gives 35.22 m NHN. The portal transect has upper samples
64.02–64.35 m NHN; its restrained upper trim ends at viewer y=34.27.
The full 20-point receipt and reproducible GetFeatureInfo URLs are in
`schlossplatz-v239-bdom.json`. These samples corroborate the source; they are
not a new complete roof survey.

The Staatsrat model uses its measured asymmetrical 17.964 m portal frontage,
three-storey sandstone/granite arrangement, large glazed upper fields and the
historic portal's pilasters, central arch, two balcony rails and small heraldic
recognition. The Marstall receives four facade levels, a two-storey rusticated
base, upper pilasters, paired portico columns and three arched entry fields.
The plain bronze fields mark the two relief locations without reproducing their
sculptural compositions. The lost Schlossplatz pediment and roof statues are
not reconstructed. The full existing southern complex remains separate.

Only source geometry and bDOM sample heights are measurements. Window positions,
facade spacing, column dimensions, relief/coat-of-arms abstraction, colour,
balcony detail and original geometric lettering are documented display
estimates. Operator/heritage photographs were inspected as references only;
neither images nor photographic textures, downloaded fonts or copied logos ship.

Primary references, checked 19 October 2026:

- [Berlin monument authority: Staatsratsgebäude](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/staatsratsgebaeude-641123.php)
  — source exterior and Portal IV photographs, credited there to the
  Landesdenkmalamt Berlin / Peter Brinkmann; sandstone and red granite.
- [ESMT campus](https://esmt.berlin/de/ueber-uns/unser-campus)
  — current building identity and integrated historic portal. The modern portal
  inside the reconstructed Schloss is a different architectural location.
- [HfM locations](https://www.hfm-berlin.de/hochschule/ueber-die-hochschule/standorte/)
  and [Marstall history](https://www.hfm-berlin.de/hochschule/ueber-die-hochschule/standorte/geschichte-neuer-marstall/)
  — Schlossplatz 7 campus, present-day portico photographs by Meiko Herrmann and
  Ernst Fesseler, separate Charlottenstraße campus, bronze relief context.
- [Berlin monument inventory 09011237](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011237)
  — four floors, two-storey rusticated base, upper pilasters, paired columns,
  simplified post-war roofline and distinct river-side preservation.
- [Berlin LoD2 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip),
  [official bDOM service](https://gdi.berlin.de/services/wms/bdom),
  and retained bounded [OpenStreetMap map](https://api.openstreetmap.org/api/0.6/map?bbox=13.4001,52.5133,13.4075,52.5171).

The existing source notice remains applicable: © OpenStreetMap contributors;
3D building models and bDOM: Geoportal Berlin (dl-de/zero-2-0). Source OSM
semantics retain ODbL-1.0. No Google imagery is used by this work.

## Integration contract

`src/app/src/data/schlossplatzV239Owners.json` is the small eager index. It holds
the two exact old prism records, ten world-coordinate navigation solids and
506 exact native column tuples. Native source heights are snapped by the
existing `build_minecraft_voxels.snap_up` rule: both old 22 m drawn prisms have
stored native `[low,high,kind] = [52,292,3]`, not `[52,272,3]`. There are 232
Staatsrat and 274 Marstall tuples. Match source ring, old vertical interval and
kind; never retire a different-height neighbour based on location alone.

`src/app/src/data/schlossplatzV239AltMittePrevious.json` separately audits the
active v169 owners: 391 drawn source triangles, 14,766 generic facade triangles,
15,857 native source/facade triangles, and 353 ink segments. All encoded vertices,
colours and indices are matched to regenerated complete source families before
recording exact triangle indices and immutable packet FNV fingerprints. Its
`previousNavigationParts` holds all ten exact prior navigation records. The
source packets stay byte-identical; untouched triangle-order hashes and source
checksums are retained in `schlossplatz-v239-alt-mitte-evidence.json`. Shared
ink needed by another source family survives. The 3_0 and 4_0 streamed window
layers must also apply these receipts, so an obsolete grid cannot reappear later.
The low Staatsrat source wing and short source sides receive bounded fittings
at the corrected datum before their complete old grids yield.

`src/app/src/data/schlossplatzV239Replacement.json` contains `schema: 1`, the
source SHA and `core.drawn` / `core.minecraft` ordinary `SurroundingCityChunk`
payloads. They use origin `[1900,-10,240]` and IDs `schloss239-core-drawn` and
`schloss239-core-minecraft`. Each holds two complete site meshes, with valid
empty packet navigation at y=5.2. There are no outer packet mutations or
companion additions. Integrate these complete owners in the **required core
transaction**, using the same cancellable generator/upload lifetime as v238.
Load the large payload lazily and retain it weakly; import only the ownership
index on hot paths. Replace core navigation from the ten source-ring solids,
skipping the exact ten prior v169 navigation records once the required owner
is active. Do not add both sets of obstacles.
No retired owner can depend on a later optional companion load.

Retirement is explicitly opt-in via `SurroundingOwnershipOptions.schlossplatzV239`.
The v169 builders and surrounding controller default to keeping complete legacy
geometry. ThreeViewer enables the option only in its required-owner transaction
and in the surrounding stream started after city readiness; Minecraft forwards
its existing explicit replacement option. Receipts edit fresh decoded indices
and ink endpoints only. The original packet strings are never modified or
cached with a replacement state, so a later standalone decode remains complete.

| Representation | Meshes | Vertices | Indices | GPU array bytes |
|---|---:|---:|---:|---:|
| Drawn, pointer and touch identical | 2 | 46,543 | 209,001 | 976,518 |
| Independent orthogonal native | 2 | 96,653 | 441,036 | 2,041,908 |

The integration must split each site mesh into its own required packet: the
runtime otherwise concatenates packet meshes into one buffer. Separate packets
keep every geometry below 65,536 vertices, allowing 16-bit GPU indices without
dropping any geometry. The native
skin independently samples measured surfaces into merged metre blocks. Native
window and material courses use orthogonal fittings; tiny drawn joint lines and
crossbars are represented by those block-scale courses. No smooth native
duplicate, mobile reduction, texture, new tour stop, or residency/prefetch
budget increase is introduced.

## Verification

Run `uv run python scripts/build_schlossplatz_alt_mitte_v239.py`,
`uv run python scripts/build_schlossplatz_v239.py` and
`uv run pytest -q tests/test_schlossplatz_v239.py`. The nine focused tests verify
complete source vertices and parent families, absolute heights, immutable old
payload hashes, every exact native tuple, independent orthogonal normals,
per-site index/byte budgets, source-ring navigation, the open court, and the
distinct university campuses, exact v169 packet/triangle preservation, previous
navigation records and continued lower-wing fittings. Formatter/lint pass.
Six Bun ownership tests additionally exercise every exact triangle/ink receipt,
changed attributes and wrong identities failing open, offsets within aggregated
buffers, standalone defaults in both modes, repeated decode independence and
streamed cancellation. TypeScript compilation passes.

Independent drawn/native model previews were inspected at the north frontage
and above the court. The previews remain ignored QA outputs in
`geo_data/regierungsviertel/raw/schlossplatz-v239/`. Runtime integration and
whole-project checks belong to the main v239 integration. Camera targets are
Staatsrat `[2025,18,399]`, portal `[1999.2,20,398.6]`, and HfM
`[2159.5,18,304.4]`; approach the fronts from the northwest.

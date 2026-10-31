# Potsdamer Straße and Schöneberg corridor — v288

This refinement follows Potsdamer Straße south from the Kulturforum through
the Potsdamer/Bülow crossing, Hauptstraße and Dominicusstraße toward Bahnhof
Schöneberg and Sachsendamm/Südkreuz. The Berlin LoD2 bodies, mapped roads and
earlier street-front detail remain the geometric authority. Facade fittings,
window surrounds, material tones and unsurveyed subdivisions are estimates
from the primary references below. No photograph is bundled or used as a
texture.

## Named architecture and complete source bodies

| Site | Retained LoD2 parent | Treatment |
|---|---|---|
| Loeser & Wolff, Potsdamer Straße 58 | `DEBE01YYK0002NK8` | Complete existing seven-part measured body retained; stone horizontal bands, broad serial window surrounds and upper glass-storey divisions added. |
| Hansa-Haus / Mercatorhöfe front, Potsdamer Straße 87 | `DEBE01YYK0002P0X` | All five measured parts replace only exact old OSM fallback `62078076`; pilasters, crown, window framing and iron-grille rhythm added. The photographed blank party wall stays blank. |
| Anton-von-Werner-Haus, Potsdamer Straße 81A | `DEBE01YYK0002Ngg` | All three measured parts replace exact old OSM fallbacks `80225238`, `47397221`, `80225252`; plaster/stone front and retained mapped courtyard service ways guide the fittings. |
| Bank / Finanzamt, Potsdamer Straße 140 at Bülowstraße | `DEBE07YY900001dL` | All four measured parts replace only exact old OSM fallback `59524704`; six-storey front, taller office wing, lower court hall, stone base and serial facade axes remain distinct. |
| Kathreiner-Hochhaus, Potsdamer Straße 186 | `DEBE07YY900007j1` | Identity and existing 48.3 m owner checked; complete earlier measured geometry retained. |

The five old prisms have 99.4–100% plan correspondence with their complete
measured replacements, but used implausible 3–15 m fallback heights. All source
wall and roof sheets, roof vertices and genuine courts remain in the evidence.
Runtime source geometry has 972 complete triangulated vertices, in local
Float32 metres; every original source vertex is retained within 0.0002 m.
All parts and walking solids use the same existing rigid parent terrain datum.

The replacement is admitted only against complete unchanged original owner
records. The required-model transaction must construct and attach the complete
new model before retiring those five records. Native retirement is limited to
162 exact exclusive old columns, guarded by complete affected source rows;
shared/foreign source columns remain. Ownership imports are split from the
heavy constructor data so the worker does not import wall sheets or fitting
recipes.

## Corridor facade detail

The existing v188 companion packets provide 101 mapped street fronts with
1,800 existing drawn glass panes. The new packet pass adds six small surround
and division quads per existing pane. It leaves every earlier mesh, pane,
source packet origin and navigation object unchanged. Full touch and pointer
detail match. The independent native pass adds surrounds to 249 existing
cardinal panes across the 30 eligible source fronts; diagonal measured planes
do not receive floating copies of drawn windows.

Named buildings use 2,388 drawn fitting instances in addition to their complete
measured bodies. The native model independently uses 4,776 source wall/roof
columns and 6,604 fittings, all cardinal, for 11,380 instances and approximately
865 KB of instance buffers. Fittings are fitted outside the actual native body
columns; Loeser & Wolff uses its retained 4 m source columns. Added native
fittings have zero AABB overlap with their own measured native body columns.
The native roofs follow sampled source roof heights and leave real courts open.

`pedestrianNavigation.ts` uses small source-profile modules. Live admission
callbacks retain all original six historic-core and five corridor obstacles
until their required models are active. Complete replacement rings, holes and
roof-aware tops then become active; disabling a callback restores the exact
prior heights without rebuilding the environment. Changed or incomplete owner
receipts retain their original obstacles.

## Ordinary houses: colour and window audit

The broad rainbow appearance came from the unknown-owner v273 palette:
its stable house-ID assignments selected pink, cyan and green fallback tones.
Only those fallback swatches now use twelve distinct subdued plaster/stone
tones. ID assignment and all eight roof choices are unchanged; explicit source
colour and material receipts retain precedence. Geometry and source arrays are
unchanged by this palette edit.

The core ordinary-house builder already authored vertical window axes and
storey positions, but previously emitted bands rather than actual panes.
The streamed v188 corridor already has real illustrative glass; this module
frames that glass without duplicating it. The separate shared v288 ordinary
window pass is owned and checked by the release integration.

## Primary references, checked 31 October 2026

- [ISEK Potsdamer Straße, approved 20 January 2026](https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2021/1125_2026_isek_anlage-klein.pdf?ts=1772011482), printed pp. 19, 29 and 43: government exterior photographs by forward / Studio AAD; includes Finanzamt, Loeser & Wolff, the Mercator party wall and the Bülow office context.
- [POLIS, Potsdamer Straße 58](https://www.polis.de/portfolios/potsdamer-strasse-58/): operator exterior photographs, sandstone bands and upper glass floors. Copyright retained by POLIS / photographer.
- Landesdenkmalamt Berlin heritage records: [Loeser & Wolff](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050309), [Hansa-Haus](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050314), [Anton-von-Werner-Haus](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050279), [bank / Finanzamt](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066659), [Kathreiner-Hochhaus](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066666). Historical use descriptions are not treated as current tenant evidence; no obsolete Tagesspiegel sign is added.
- Retained Berlin LoD2 tile archives `389_5818` and `388_5817` (dl-de/zero-2-0), plus retained OpenStreetMap geometry (ODbL-1.0), including Werner courtyard service ways `380225275`, `380225266`, `380225261`, `380225268`.

Full source records, original replacement receipts, archived-source SHA-256
hashes and runtime counts are in
`geo_data/regierungsviertel/potsdamer-corridor-v288-evidence.json`.

## Reproduction

From the repository root, with the retained local LoD2 tile archives, OSM
GeoPackage, v188 evidence and delivered mesh packets available:

```sh
uv run python scripts/build_potsdamer_corridor_v288.py
```

The repository-native helper resolves its root from its own location and
extracts all four recorded parent/tile pairs directly from the local archives.
It needs no task-output identity cache or downloaded photographs. Running it
regenerates the four corridor runtime JSON files and the corridor evidence;
review their diffs before publication. This reproduction helper was added with
format, lint and syntax checks only; it was not run against the frozen v288
geometry during the release review.

## Checks

- Seven focused corridor tests pass, including all retained pane counts,
  source identity, full-record admission, getter/proxy rejection, cancellation,
  exact native retirement, complete source bodies, native orthogonality and
  clearance, true roof tops and muted palette stability.
- Four focused navigation tests pass for inactive fallback, live admission,
  complete rings/holes/roof tops, changed/partial owners and environment-option
  forwarding.
- Existing explicit source material/colour precedence test passes.
- Production build, packaged sizes, combined browser review and publication
  are checked in the release integration; this isolated module check does not
  claim those release checks.

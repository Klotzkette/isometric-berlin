# Moabit ordinary houses — Step 10 v269 / release 1.0.169

The user's request for **all Moabit** is checked against the complete retained ALKIS Ortsteil (7.7055 km²), including twelve populated LOR quarters. This is a district-wide audit and a substantial, distributed refinement of the existing model. It does not claim that every building, aperture or facade has been individually surveyed. Mierendorffplatz and the two named Moabit churches have separate owners and modules.

## Visible change and complete earlier detail

The western streamed fronts receive **3,507 drawn / 955 independently native window jamb-and-head groups**, on **237 drawn / 91 native source owners**. The union is 242 owners. Each group has only three members: two narrow jambs and a head. The exact existing v188 pane stays exposed; the v209 sill and crossbar remain uncovered and are not duplicated. **17 mapped commercial uses on seven streets** qualify for restrained lower shopfronts; there are **zero new doors or tenant signs**. Shop dimensions, neutral metal/stone tones and small member sections are explicit display estimates. No new historic-material claim is made.

The core receives **4,167 additional head strokes on 1,220 actual source parts**, using the same retained storey rhythm and existing `LoD2 facade axes` batch. The exact-source selector has 1,257 candidates; 37 already have suitable heads or emit no additional stroke. There are no invented glass rectangles. The serial production-factory before/after audit proves a visible addition in **every one of the twelve populated quarters**, with no change to existing body/roof geometry, paint, glass, navigation, renderable count or old axis segments.

Native core detail independently qualifies **5,168 original exposed cardinal voxel faces**; **5,147** also pass the actual source-owner lookup. These are face counts, not window or building counts. A head is added only above an already emitted native pane, after existing neighbour, roof, named-site and storey checks, within that same pane batch. No diagonal drawn line is reused as a native face. Source lookup is lazy and runs only for an exact candidate tuple. There is no new mobile reduction; drawn detail remains identical on touch and pointer devices.

## Whole district accounting

The audit reads **5,564 valid core parts plus 14 retained invalid source outlines**, and **1,268 streamed navigation records representing 1,151 different owner IDs**. Core and stream records are separate source representations and are not added into a household total. All fourteen invalid outlines remain unchanged. The 264 old v188/v209 Moabit fronts and all **3,949 drawn / 1,134 native old panes** remain intact.

| Quarter | Audited valid core parts | Core parts with actual added heads | Added head strokes | New drawn / native stream frame groups |
| --- | ---: | ---: | ---: | ---: |
| Huttenkiez | 332 | 42 | 124 | 133 / 70 |
| Beusselkiez | 193 | 81 | 264 | 735 / 220 |
| Emdener Straße | 221 | 85 | 257 | 1,289 / 434 |
| Bremer Straße | 245 | 114 | 383 | 1,325 / 231 |
| Zwinglistraße | 254 | 97 | 301 | 0 / 0 |
| Elberfelder Straße | 754 | 179 | 660 | 0 / 0 |
| Stephankiez | 853 | 269 | 892 | 0 / 0 |
| Heidestraße | 715 | 19 | 110 | 0 / 0 |
| Lübecker Straße | 271 | 181 | 588 | 25 / 0 |
| Thomasiusstraße | 628 | 108 | 417 | 0 / 0 |
| Zillesiedlung | 420 | 11 | 36 | 0 / 0 |
| Lüneburger Straße | 678 | 34 | 135 | 0 / 0 |

Most central/eastern houses are already in the detailed core, not the outer streaming family. Zero stream frames in those quarters therefore does not mean they were omitted. The tiny Hansaviertel overlap between two administrative boundary vintages contains no audited house and adds no model scope. Primary BA Mitte references identify west/east quarters and Turmstraße's commercial role; the exact LOR geometry is used for this accounting only.

Core omissions are explicit: 2,126 parts have no complete clear public street front; 1,063 fall outside ordinary height/class limits; 860 intersect protected mapped use/material evidence; 255 are authored/named owners; three are already handled streamed owners. Selection never substitutes private courts, short wall fragments or uncertain fronts for missing evidence. The material audit finds **158 core parts with recorded facade material/colour**; their existing source-priority treatment is retained. Existing v225 roof/glass separation, v262/v263 ordinary treatments and measured roof replacements remain unchanged. The 338 rejected streamed pane candidates lack full nearby ground support; three approach mapped entrances. Current named-owner exclusions are applied before this candidate audit, so those counts are not the difference from every old pane.

## Ground, geometry and source guards

Every stream group proves its exact retained pane, complete source wall and a complete narrow nearby public ground strip. Ground is **3.00, 3.09 or 3.12 m**, recorded per object; native stepped edges use their own actual original planes. Core details inherit each actual source `y0_dm` (**3.2–7.0 m** in this selection), rather than assuming a district-wide base. No walking volume is changed.

The new stream preparer appends one mesh after all old preparations. Every original mesh position/colour/index fingerprint, original origin and complete owner-navigation guard must match. Additional earlier meshes are accepted by identity. Unknown, altered, oversized or repeated inputs return unchanged. Hashing/construction yield cooperatively; publication occurs only once preparation finishes. The unchanged **16 meshes / 400,000 vertices / 2,400,000 indices per packet** limits apply after integration. No descriptor, coverage, tour stop, resident/decode/prefetch allowance, texture, animation or per-frame work is added.

| Existing packet | Drawn boxes | Native boxes |
| --- | ---: | ---: |
| `-4_-3` | 1,116 | 219 |
| `-4_-4` | 1,145 | 208 |
| `-5_-3` | 2,671 | 422 |
| `-5_-4` | 1,237 | 332 |
| `-6_-3` | 2,921 | 1,033 |
| `-6_-4` | 1,271 | 616 |
| `-7_-3` | 285 | 141 |
| `-7_-4` | 45 | 30 |

Runtime recipes total 1,258,533 bytes before the release's lossless source encoding; core selectors are 293,330 bytes. Core APIs live separately in `MoabitCoreHousesV269.ts`, so core factories do not import streamed recipes. Three reused core IDs identify different source geometries; exact ring/height signatures distinguish them and refuse the unselected siblings.

## Sources and credits

- Retained Berlin LoD2 and ALKIS Ortsteil geometry: **Geoportal Berlin, dl-de/zero-2-0**. Original source files and every relevant immutable packet are SHA-256 recorded in the evidence/audit.
- Retained Geofabrik Berlin extract and commercial point identities: **© OpenStreetMap contributors, ODbL-1.0**. Actual input SHA-256 is retained; frozen older context hashes are not represented as the newer PBF digest.
- Additional complete LOR-2021 quarter polygons: **Amt für Statistik Berlin-Brandenburg, CC BY 3.0**, [license](https://creativecommons.org/licenses/by/3.0/de/), [official WFS](https://gdi.berlin.de/services/wfs/lor_2021). `GetCapabilities` explicitly names this different license and author. These polygons partition the audit; the retained ALKIS Ortsteil still limits modelling.
- [BA Mitte current district-region inventory](https://www.berlin.de/ba-mitte/politik-und-verwaltung/service-und-organisationseinheiten/sozialraumorientierte-planungskoordination/bezirksregionen/), [Moabit West profile](https://www.berlin.de/ba-mitte/politik-und-verwaltung/service-und-organisationseinheiten/sozialraumorientierte-planungskoordination/bezirksregionen/artikel.1621654.php), and [official funded Moabit-Ost QM profile](https://www.quartiersmanagement-berlin.de/quartiere/moabit-ost.html), checked 25 October 2026, support quarter identities, named street structure and distinct building eras. They are not used to invent house-specific ornament or current paint.

No photograph, protected architectural plan or image texture is copied. References, raw quarter geometry, hashes, exact selectors, preserved original records and candidate/omission counts are retained in the `moabit-houses-v269-*` files.

## Verification and in-app views

Focused verification: **10 Python tests passed** across source, wall/pane/old-sill separation, mapped shops, actual ground, full-quarter inventory and native frozen columns. **Eight stream Bun tests** exercise the actual integrated pipeline, all old transactions, synchronous/cooperative equality, changed-source rejection, native orthogonality and final packet limits. **Four core Bun tests / 16,292 assertions** exercise exact guards, lazy native lookup, twelve-quarter actual owner resolution and before/after factory equality for every non-axis buffer plus retention of every old axis segment. The full serial per-part factory count is in `moabit-houses-v269-runtime-qa.json`. No external browser or compiler was run by this subtask.

These camera rays were checked against complete retained core and streamed footprints; integrated visual review belongs to root's in-app browser:

| View | Eye | Target | Required actual layers |
| --- | --- | --- | --- |
| Birkenstraße ordinary shops and frames | `[-1986.704,11,-1525.299]` | `[-1992.440,9,-1512.857]` | `-4_-3`, `district188--4_-3`, `kiez209--4_-3` |
| Stephankiez / Perleberger Straße | `[-942.024,12,-1893.089]` | `[-933.474,11,-1882.257]` | Actual core factory / native voxel factory; owner `28672179` |
| Thomasiusviertel / Melanchthonstraße | `[-1194.085,12,-275.029]` | `[-1190.896,11,-288.455]` | Actual core factory / native voxel factory; owner `K0002P0d` |

Reproduce the stream with `uv run --no-sync python -m scripts.build_moabit_houses_v269`, then its district/core audit with `uv run --no-sync python -m scripts.audit_moabit_houses_v269`. These write only new v269 artifacts and never an old source packet or shared manifest.

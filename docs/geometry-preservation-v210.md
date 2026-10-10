# Geometry preservation — v1.0.110 / Step 10

The reference release is v1.0.109 at immutable commit
`b2f70b7d7def147b0b1189667bce19fe6f04af3f`. The [v210 scope](refinements-v210.md)
adds bounded recognition inside earlier coverage. Historical source packets,
the earlier outline-signature fixtures, source rings and holes, the 93-place
tour and city residency limits are retained.

## Exact exceptions

| Old representation | Precisely allowed correction | Retained evidence and guard |
| --- | --- | --- |
| Seven coarse Neukölln OSM building owners | Transfer their visible coarse shells and matching navigation to six complete LoD2 parents: all 30 measured parts and 221 original wall/roof sheets, plus the separately labelled estimated belfry | [neukoellnPlacesV210Ownership.json](../src/app/src/data/neukoellnPlacesV210Ownership.json) retains original packet hashes, coloured triangle/ink-segment receipts, runtime fingerprints and full original navigation records. The packet files are unchanged. |
| Ten v182 obelisk box rows and 100 rbb wire-segment rows | Replace the inaccurate ten-cube sculpture and two authored rbb wire envelopes with required, source-supported geometry | [westCivicV210Previous.json](../src/app/src/data/westCivicV210Previous.json) retains original indices, every row value, array lengths and the original JSON SHA-256. Removal requires both the index and every value to match. The four old basin frame lines remain. |
| Three drawn / eighteen native v185 church frontage rows in the receipt | Only **one drawn row / six native fragments** change their Y value; the other two / twelve rows remain byte-identical | `legacyDetailRecords` in the Neukölln receipt retain all original rows and the source-file SHA-256. [The transfer helper](../src/app/src/neukoellnLegacyV185TransferV210.ts) guards the full receipt's float32 matrices, colours and expected mesh count. |

The seven owners, each prefixed `OSM-way-`, are `24315001`, `26824425`,
`334062957`, `334062967`, `334062969`, `47023388` and `88382458`. Transfer
uses exact packet content and owner receipts, never a broad radius or box.
The historical packets remain available unchanged; only the matching runtime
proxy geometry yields to the complete required replacements.

The church receipt covers drawn rows `2557–2559` and native rows `9232–9249`.
The corrected upper cornice changes drawn Y `27.35 → 11.02` and six native
fragment centres Y `26.35 → 11.5`, consistent with the measured north eave
and independent native shell. The historical v185 JSON, generator and
constructors remain unchanged. Reversing the helper restores the exact
original float32 bytes. A failed receipt guard keeps the existing geometry.

## Source completeness outside the exceptions

The [Westend source receipt](../geo_data/regierungsviertel/west-civic-v210-source.json)
keeps all 725 sheets from six parts of three complete official parents. The
rbb additions retain the older measured geometry underneath and alongside
the interpreted taller masses. Only the receipted authored wire estimates
yield; no general rbb or DRV source owner is removed.

The final Theodor-Heuss-Platz context is additive over the unchanged older
ground: mapped park, internal paths, the street ring and 55 mapped OSM trees.
Its exact mask is square `way/377196797` plus 8 m, entirely within the approved
west lobe. [The complete place source](../geo_data/regierungsviertel/west-civic-place-v210-source.json)
retains original polygons, line courses, nodes, tags and source hash;
[its evidence](../geo_data/regierungsviertel/west-civic-place-v210-evidence.json)
records derived coverage. No old packet is rewritten. Road unions precede
curb extraction, and the artificial scope edge does not become a transverse
curb. Native pavement cells preserve their selected coverage when merged.

The [Wedding source receipt](../geo_data/regierungsviertel/wedding-sites-v210-source.json)
keeps 217 existing core prism records and every selected source sheet.
The stadium's added upper shell begins at or above the old hall roof. Both
coincident low source hall records remain, so this addition needs no owner
suppression. Bayer courts, the open rink and mapped gate gaps stay open.

The [Neukölln source receipt](../geo_data/regierungsviertel/neukoelln-places-v210-source.json)
retains every measured replacement sheet, ring and hole. Its eight estimated
belfry sheets are separately identified and do not remove the coarse source
roof. The separate Karstadt garage and forge canopy retain their old models.
Street refinements retain old asphalt, pavement, building and navigation
packets. Existing street layers and the v206 paint scope are excluded from
duplicate additions; final corridor counts belong to its own evidence.

## Historical audit uses the current scene

[outlinePreservationV210.ts](../src/app/tests/helpers/outlinePreservationV210.ts)
reverses only the documented legacy exceptions on the **current** scene.
The civic helper inserts the ten / 100 receipt rows into the current filtered
buffers and copies all unrelated current values. The church helper reverses
only the guarded cornice change. Neither substitutes an old whole-family
snapshot. A dedicated civic test mutates an unrelated vertex and verifies
that the reversal preserves that mutation, so it remains detectable by the
historical signature check.

The v210 preservation test excludes exactly the four named new optional
families, checks that all four exist, then hashes the remaining current tree
against the unchanged
[v209 synchronous fixture](../src/app/tests/fixtures/outline-landmarks-v209-synchronous.json)
in drawn and native representations. Cleanup restores the current buffers and
tree. Earlier v207/v208/v209 preservation tests use the same precise reversal
while retaining their original fixtures and geometry assertions.

[audit-outline-v210.ts](../src/app/scripts/audit-outline-v210.ts) provides an
independent `--baseline` path: it loads the two changed outline/civic
constructors from the immutable v1.0.109 commit and checks their signatures
against that released fixture. A separate new v210 signature records the
current result; it does not replace the historical expected value.

## Required construction, navigation and budgets

[RequiredSiteEnvelopesV209.ts](../src/app/src/RequiredSiteEnvelopesV209.ts)
attaches each complete required v210 model before yielding. Both drawn and
native world construction keep these models inside the provisional-world
transaction. Publication follows required construction; cancellation or
failure disposes the provisional allocations. Optional outline detail is
not a prerequisite for the replacement shell to exist.

The shared exact ownership mechanism combines triangle and ink-line receipts.
Navigation retires only complete matching old records, then uses the new
roof triangles and bounded solids. Added civic and Wedding solids participate
in the common pedestrian check, including inside the old core. The checks do
not turn an entire plaza, campus or sculpture bounding box into occupied space.

Full drawn detail is identical on mobile and desktop; native geometry is
independent. No residency constant, approved coverage or tour count changes.
Constructor-only large arrays use the existing lossless lazy JSON mechanism;
navigation metadata stays strongly available. Per-family bounds and buffer
checks remain in the focused tests. Native curbs keep every accepted 25-cm
pixel; cell-local Uint16 matrices preserve their exact world coordinates,
heights and bounds. All transformed vertices and a negative-cell raycast are
checked against the independent Float32 reference. The four historical v206
outputs reproduce byte-identically with default generator options.

The final extracted local package contains **873,298,912 bytes
(832.842743 MiB)**, below the unchanged **833 MiB** archive ceiling. This
package size does not change the separate city residency limits.

## Verification

Final focused verification passed 29 Bun tests across nine files with 957,041
assertions, six Westend Python tests, Ruff formatting/lint over 514 Python files
and all 76 release-readiness tests; release readiness reports OK. Production
TypeScript/build also passed. The earlier complete-suite results and the
specific assertions resolved by focused reruns are recorded in
[the release verification](refinements-v210.md#verification); they are not
reported as a second complete-suite run.

The whole 150-packet Ringbahn inventory is independently checked in both
representations: only receipt-identified triangle corners, line endpoints and
complete navigation owners may differ from the unchanged source bytes. The
old historical outline fixtures are unchanged.

The earlier integrated browser checks covered 28 views each in Chrome and
WebKit across all six modes without a page error or context loss. After the
last plaza-context addition, Chrome separately passed all six modes without
errors. The corresponding final WebKit check passed all six modes with
presentation ready and no errors or context loss; the inspected day screenshot
confirms the paths, park, street ring and obelisk are visible.

# City fidelity pass v288

The owner's 31 October request covers the DDR housing east of the Holocaust
memorial, Nikolaiviertel/Schwalbennest, the Littenstraße court and ruin context,
DomAquarée, the Potsdamer Straße corridor, both named East Asian embassies and
the Stadtbahn east of Alexanderplatz. The release version is 1.0.187.

See the independent source and geometry receipts in
[Mitte DDR](mitte-ddr-v288.md), [historic centre](berlin-historic-core-v288.md),
[Potsdamer corridor](potsdamer-corridor-v288.md) and
[embassies](mitte-embassies-v288.md). All source geometry, holes, previous
details and mapped material evidence remain. No photograph or media request
is shipped. New facade dimensions, window divisions and material interpretation
are display estimates, distinguished from the complete measured source shells.

## Railway correction

The old `rail-lines.json` viaduct ends at world X=2258.2; it does not cover the
requested Littenstraße stretch around X=2900. Changing its shared Hauptbahnhof
deck elevation would not fix this omission. Five separate retained LoD2
viaduct families already describe the raised masonry there; the new bounded
packet addition supplies 35 retained through-track pieces and their decks.
All original track vertices survive inside the finite X=2850–3160,
Z=−50–515 scope, with intersections only at its and the existing packet edges.

The old outer LoD2 sheets normalize each building's ground to Y=3. They are not
a common rail height survey. Their complete source sheets, vertical transforms
and original records remain in `east-stadtbahn-v288-evidence.json`. The new
rail course interpolates between the existing authored station rail anchors
(Alexanderplatz Y=13.08 and Jannowitzbrücke Y=10.65); this is explicitly a
display fit, not surveyed track gradient. A thin estimated upper fascia joins
the existing viaduct top edges to this deck. Native tracks use independent
cardinal treads above the actual 2 m source solids, with a minimum Y=11.25.

No new pier is placed in a road. Existing mapped road-bridge gaps remain open,
and occupied commercial arches remain buildings rather than invented walking
tunnels. New bridge-floor navigation stays above the street. The original
encoded packet meshes, indices, building/ground/road navigation arrays and
source owners remain; only one bounded mesh and its raised floor register are
appended after exact original mesh/owner admission.

The [architect's VoltAir project photographs](https://jmayerh.de/voltair/),
including Laurian Ghinițoiu's street view at Voltairestraße/Dircksenstraße,
confirm the steel overpass, retained masonry and new building relationship.
The [S-Bahn's historical Stadtbahn account](https://sbahn.berlin/fileadmin/user_upload/Punkt3/PDF-Archiv/2007/punkt3_01_25_07.pdf)
supplies historical commercial-arch context, not current tenant identities.

## Ordinary houses and integration

Unknown primary-house colour fallbacks are muted; explicit recorded colours
and materials still take precedence. The drawn core gains one bounded shared
window batch on its already authored mapped-storey/bay axes. These openings
remain labelled estimates. A source-footprint/height index rejects covered
party faces and internal part seams while retaining actual courtyard holes.
Pinned hero facades and suppressed sources keep their existing interpretation.
The independent native source-column windows remain. Touch and pointer receive
the same new static geometry; no per-frame reconstruction or texture is added.
The frozen source audit finds 56,153 such panes across 1,563 eligible parts,
using approximately 3.43 MiB of shared geometry/instance attributes over the
whole inventory. The 100,000 construction-only fitting allowance never clips
a real source batch; existing renderer residency and byte caps stay unchanged.

Six exactly receipted DomAquarée proxies and five Potsdamer height fallbacks
yield only after their complete required replacement is built. Workers and
distant previews receive the same admitted ownership flags. Exact native
tuples require their complete original source/neighbor guards first. Walking
obstacles follow live model admission and complete roof-aware source profiles;
failed/inactive admission preserves original obstacles. Detached construction
rolls back geometry, instance buffers and alternate materials if a later
factory or completeness check fails. All earlier runtime and release caps stay.

Focused tests cover original source preservation, exact owner and native-cell
admission, exterior fitting clearance, roof/courtyard navigation, changed-source
fallback, detached construction rollback, raised rail packet lifetimes and
the ordinary-window party-wall distinction. Final viewer and release proofs
are recorded with the publication receipts.

The Potsdamer corridor has four individually investigated named buildings.
The additional 101 selected existing street fronts span Potsdamer Straße (16),
Hauptstraße (57), Dominicusstraße (18) and Sachsendamm (10), toward Bahnhof
Schöneberg and Südkreuz. Their 1,800 existing drawn panes gain finer surrounds;
249 existing native panes on 30 eligible fronts gain independent fittings.
Those surrounding fronts retain illustrative source-derived window layouts;
neither railway station is rebuilt or represented as a new photographic model.

The Klosterkirche ruin's old LoD2 dataset describes a low nave cap and sloping
aisle fragments, rather than all surviving standing walls. The final bounded
recognition therefore adds open northern arcades, the broken west portal wall
and polygonal choir using LDA plan/photo references. All 116 original sheets
and their old floor remain. New wall heights and pointed-arch profiles are
documented estimates. Independent native masonry clears every touched original
source cell; matching navigation keeps actual apertures open and activates only
while the corresponding completed Justice group is attached and visible.

Final source checks on 31 October: 58 focused tests / 1,038,244 assertions passed
across the new families, navigation and original Justice host. TypeScript,
three generator Ruff/format checks, lock consistency and diff whitespace passed.
Full-city IAB checks cover drawn and native Nikolaiviertel, DomAquarée, raised
Stadtbahn and the corrected China front; additional drawn views cover the DDR
memorial fronts, DPRK embassy, Potsdamer/Mercator and Bülow, Klostergärten and
the open ruin. A mapped street opening remains visible beneath the rail deck.
These are desktop browser checks, not claims of physical phone/tablet testing.
The final open ruin was checked in both drawn and independent native views.
The published viewer and downloads are verified in the
[v1.0.187 release receipts](release-v1.0.187-review.md).

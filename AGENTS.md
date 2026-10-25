# AGENTS.md — Instructions for Codex, Claude Code, Cursor, Gemini CLI, and Perplexity

> **Read this file completely before doing anything in this repo.**
> If you only read one file, read this one. It is the single source
> of truth for *what* this project is, *why* it exists, *what scope
> you must stay inside*, and *what is forbidden*. The corresponding
> `CLAUDE.md` redirects here on purpose.

---

## 1. Project mission (in one paragraph)

Build a giant, zoomable, freely orbitable **isometric model of central
Berlin**, centred on the Regierungsviertel and derived from open and permitted
city data. It is the Berlin equivalent of
[isometric.nyc](https://isometric.nyc) by Andy Coenen, extended with a true
Three.js scene and downloadable offline packages. The viewer is isometric 3D
only as requested in v1.0.28; archival DZI generation remains optional tooling.
Per owner policy this project uses **additive data fusion**: every permitted
source contributes; the best evidence from each source is kept per tile.

The owner is **Klotzkette**. He intends to publish the finished
viewer through **Perplexity** (likely via the Perplexity website
hosting / `pplx.app` deployment flow), so the pipeline and artefacts
must be friendly to static hosting and to deployment from a Perplexity
agent. See §9.

## 2. Inspiration and lineage

- Upstream: <https://github.com/cannoneyed/isometric-nyc> by Andy
  Coenen, MIT-licensed, © 2025 Andy Coenen.
- This repo follows the upstream **structure** (directory layout,
  agent guidance, docs sections, `pyproject.toml` shape, generation DB
  schema, isometric quadrant model) so that anyone familiar with the
  NYC repo can navigate this one immediately.
- All Berlin-specific code, data, fine-tunes, and rendered tiles are
  produced fresh here. Do not vendor or copy NYC tile data into this
  repo.

## 3. Hard scope rules (v1.0.0)

The release **only** covers the versioned central-Berlin polygon
in [`geo_data/regierungsviertel/bounds.geojson`](geo_data/regierungsviertel/bounds.geojson).
Its presentation radius is 9,250 m. Never generate or bundle geometry outside
that polygon unless the owner explicitly approves another bounds revision.

The owner-requested v1.0.79 supplement explicitly permits only sparse hairlines
outside that detailed-city polygon, within `bounds-outline-v179.geojson`.
Its independent OSM routes and landmark outlines cover A100, the AVUS through
Spanische Allee, Schloßstraße, Ringbahn, Funkturm/ICC, Tempelhof, Kreisel and
Gesundbrunnen/Südkreuz/Westkreuz. It changes neither the 81.457 km² detailed
source footprint nor the 93-place tour. Camera reach and recessed blank paper
extend only to this finite overlay; no surrounding district rebuild is implied.

The owner's 6 October v1.0.80 request additionally permits narrow street links
from Funkturm/ICC to the existing City West and from Steglitzer Kreisel to the
existing Schöneberg, with nearby street-facing building outlines, modest Kreisel
framing/podium outlines and all 27 Ringbahn station outlines. This additive
scope is recorded in `bounds-outline-v180.geojson`. Keep the v179 routes,
original detailed-city polygon and all existing source geometry unchanged.

The owner's 7 October v1.0.82 request additionally permits source-bound simple
building masses and streets inside the mapped Ringbahn course and a 100 m
EPSG:25833 buffer, plus the finite Steglitz, Theodor-Heuss-Platz/rbb and Estrel
lobes recorded in `bounds-ring-v182.geojson` and `docs/ring-city-v182.md`.
This independent 95.968 km² presentation scope adds only the 24.437 km² outside
the existing city; `bounds.geojson`, its 81.457 km² detailed source footprint,
all earlier detail and the 93-place tour remain unchanged. Keep actual parks,
water, courtyards, rail yards and unbuilt land open rather than inventing houses.
Use retained OSM and official LoD2 owners, label missing-height/width estimates,
and preserve bounded serial chunk delivery. Complete named Steglitz hero models
may replace only their documented matching new generic owners/overlap in
`steglitz-v182-exclusions.geojson`; retain the complete source inventory.

The owner's 7 October v1.0.83 request additionally permits the finite southern
Steglitz–Schöneberg–Südkreuz infill, Charlottenburg-palace and Treptowers/Molecule
Man context recorded in `bounds-city-v183.geojson` and `docs/city-coverage-v183.md`.
Only the 10.048 km² outside earlier scopes is added. Existing terrain, source
inventories and the tour remain retained. The named v183 station/department-store
models may substitute only their audited exact prior generic owners, with their
complete source sheets retained in the dedicated models; unrelated packets and
park/water/courtyard voids must remain intact. Fritz-Schloß-Park receives its own
bounded official DGM field. Other named courts, facades, sculpture and gallery
changes are bounded recognition refinements with explicit measured/estimated
provenance, not authorization for an unbounded detail expansion.

The owner's 8 October v1.0.87 request permits the finite west/southwest/east
extension recorded in `bounds-outskirts-v187.geojson`: Olympic site, Spandau
and Citadel, Dahlem/Zehlendorf through Mexikoplatz, the Grunewald and mapped
Wannsee/Havel shores, plus mapped eastern links to Tierpark, Köpenick and
Müggelsee. Existing scopes are subtracted exactly. Keep full source vertices,
all older packets and 93 tour stops; new ordinary buildings remain simple
source-bound outlines. Named new hero models may own only their documented
exact footprints. Woodland crowns are explicitly illustrative, placed strictly
within mapped woods away from water, paths and buildings. Reuse bounded serial
chunk delivery without expanding resident CPU/GPU budgets. This finite request
does not permit unrelated citywide generation.

The owner's v1.0.90 request additionally permits the three exact OSM Ortsteile
Pankow, Prenzlauer Berg and Weißensee in `bounds-north-v190.geojson`, subtracting
all earlier coverage (13.584 km² new). This is not the entire Bezirk Pankow.
Keep source rings and all prior details, bounded serial delivery and unchanged
resident budgets. Complete named rail/cemetery/brewery/Grunewald owners may replace
only their documented exact coarse owners. Grunewald relief may change altitudes
and subdivide surface triangles while retaining all source XZ vertices; see the
versioned preservation receipts. Other sites and the 93-place tour remain intact.

The owner's v1.0.94 request permits the finite named supplement recorded in
`bounds-named-v194.geojson`: Tegel's former airport and runways, the A111 through
Tegel to the northern Berlin source boundary, Tegeler See with Schloss Tegel and
Villa Borsig, complete Wannsee and Pfaueninsel. Tempelhof and Viktoriapark are
refined within existing scopes. Preserve full mapped shore rings and holes,
the official existing Kreuzberg elevation field, all unrelated city geometry
and the 93-place tour. Only documented exact coarse owners may be substituted
with their complete source sheets. No rectangular district fill, new runtime
residency budget or reduced mobile quality is authorized by this supplement.

The owner's v1.0.95 request additionally permits a bounded finer official-DGM
reading of Teufelsberg and Drachenberg within the existing Grunewald coverage,
the former listening station with source-bound tower/radome recognition, and
four illustrative kite fliers on the mapped Drachenberg lawn. Preserve source
XZ courses, unrelated detail and the 93-place tour. Only named station proxies
may be replaced by documented complete source owners; altitude refinements must
retain independently verifiable earlier terrain checkpoints. Kite motion shares
the existing frame loop, bounded reusable buffers and offscreen/reduced-motion
controls; it must not rebuild the city shadow atlas or raise residency budgets.
The exact missing portion of mapped Drachenberg lawn way `15700939` may be
added as a bounded ground supplement; the earlier wooded-area coverage omitted
this part of the requested hill. Existing surfaces and paths remain intact.

The owner's v1.0.98 request permits the finite named supplement in
`bounds-named-v198.geojson`: Schlosspark Schönhausen, Schönholzer Heide and its
Soviet cemetery, mapped Berlin Panke strips and adjacent street context,
Treptower Park with its Soviet memorial, and the exact Tegeler Hafenbrücke.
Other Tegel, Spandau and Köpenick refinements remain in prior coverage. Keep
the distinction between channelled and natural Panke banks, measured terrain
and documented display estimates. Ground/context additions must be clipped to
the new-only footprint; exact documented erroneous proxies may be corrected
without changing unrelated source geometry. No broad district rectangle,
new runtime residency budget, reduced detail or change to the 93-place tour
is authorized. The ambiguous additional place name “Oberschönhausen” does not
authorize an inferred expansion to Hohenschönhausen or Oberschöneweide.

The owner's v1.0.99 request permits the bounded Funkturm/ICC and
Friedhof Grunewald-Forst refinements within existing coverage. The three exact
ICC LoD2 owners and the older ICC wire envelope may be replaced only by their
complete source-bound model with original sheets retained. The source's false
solid skyway arm is corrected at its exact footprint with documented height
estimates and open road clearance. Two already-transferred Funkturm proxy
remnants may be removed by exact ID. Keep unrelated packets and all older
geometric detail. Cemetery markers beyond mapped grave nodes are explicitly
illustrative and restricted to mapped sectors; do not invent named graves.

The owner's v1.0.100 clarification explicitly permits Alt- and
Neu-Hohenschönhausen, Oberschöneweide, Niederschönhausen and Adlershof,
plus initial source-bound outlines of Grünheide (Mark), BER airport and
the A10 Berliner Ring. Document finite versioned scopes and subtract prior
coverage before adding district geometry. The regional ring is a narrow mapped
route, not permission to fill its entire interior. Keep source vertices, all
earlier city detail, the 93-place tour and existing runtime residency budgets.
Unsurveyed heights and cartographic widths remain explicit display estimates.
The same request additionally authorizes a thin complete Berlin state-boundary
outline and a thin red historically sourced Berlin Wall course. These are
cartographic lines, not new filled territory or invented wall structures.
Bounded refinements at Heckmannhöfe, Delivery Hero headquarters, the former
HU barracks on Geschwister-Scholl-Straße, the HU main building/courtyard and
Bebelplatz stay within previous coverage. A false construction at
Oranienburger-/Tucholskystraße may be corrected only after identifying its
exact erroneous owner and preserving all unrelated buildings and road geometry.

The owner's v1.0.104 request permits a reversible click/tap reveal at
Pergamonmuseum: the full source exterior is hidden temporarily, sparse main
contours remain, and a white procedural Berlin west-front altar is shown.
Closing restores every original triangle and detail. Preserve neighbour museums,
all source sheets and existing runtime budgets; load the bounded altar only on
request and retain selection across mobile mode-family remounts. This interaction
is an explicit exception to ordinary exterior visibility, not a data deletion.

The owner's v1.0.105 request permits a 50% larger orbit reach and additive
animated flooding over the complete official Berlin state area plus existing
approved presentation footprints. Preserve the original water and all scene
data, with unchanged city residency budgets. Named schools, Rosenthaler Platz,
Choriner Höfe, be smart academy (Torstraße 134), selected significant religious
sites, BER, Ringbahn stations, western motorways and Kurfürstendamm may receive
bounded source-bound refinements. Complete retained LoD2 parts may replace only
the documented exact erroneous coarse religious-site owners. Keep unrelated
geometry, navigation, sources and 93 tour stops intact. New boulevard trees
must follow official points and exclude existing trees. This is not permission
for an unrelated district rebuild. See `docs/refinements-v205.md`.

The owner's v1.0.128 request permits bounded recognition refinements at the
named Charité, Vivantes, Benjamin Franklin, Friedrichshain, Osloer Straße and
Jewish hospital sites, the two named gymnasiums and Jewish gymnasium, Otto
Weidt's workshop, Sophienkirche and Rosenthaler Platz. Resolve spoken hospital
names against public operator addresses and retain the evidence in the v228
site notes. Preserve source envelopes, roofs, earlier authored details and the
93-place tour. Entrance stairs, pharmacy and St. Oberholz recognition must
follow identified mapped sites; unsurveyed details remain explicit estimates.
No district-wide regeneration, lower mobile quality or increased live residency
budget is implied. Any missing named campus envelope needs its own finite
scope and exact previous-owner receipt before substituting source geometry.

The owner's v1.0.127 request permits source-bound recognition of the town halls
of all 23 pre-2001 boroughs and the present 12 boroughs' main administrative
buildings. This authorizes only their exact named building/site envelopes where
outside earlier coverage, not surrounding district fill. Preserve measured
sources, unrelated geometry, existing authored detail, full drawn mobile quality,
separate native interpretation, the 93-stop tour and v124 residency/lifetime
budgets. Any exact obsolete proxy transfer needs an independently verified
receipt and a complete required replacement; unsurveyed facade subdivisions
remain documented display estimates. Current and former sites remain distinct.

The owner's v1.0.126 request permits restrained refinement of existing ordinary
houses in Kreuzberg and Friedrichshain, the existing Steglitz A103 corridor,
and source-supported pavements in the frozen old-Mitte selection. Preserve
prior house treatments, measured source geometry, open junctions, all original
packets and the v124 memory lifecycle. Untagged facade and road dimensions must
remain documented estimates. Keep full drawn mobile detail, separate native
representation, existing coverage, residency limits and 93 tour stops.

The owner's v1.0.125 request permits restrained refinements to existing ordinary
houses in Moabit, Prenzlauer Berg, Schöneberg, Wilmersdorf and around Gymnasium
Steglitz, plus source-bound recognition of Uber Arena and S-Bahnhof Warschauer
Straße. Preserve measured envelopes, source materials, earlier authored details,
all coverage and the v124 memory-lifetime fixes. New fittings must be compact,
batched and equal in drawn mobile detail, with separate native interpretation.
No residency-budget increase, photographic textures or new tour stop is implied.
Unsurveyed facade subdivisions remain documented display estimates.

The owner's v1.0.124 request remains in Step 10: reduce running memory pressure
without lowering visual quality. Retire exclusive decoded geometry only after
successful synchronous GPU upload; reuse surfaces only after their acknowledged
settled receipt for the same retained world. Finish native site corrections and
lossless matrix parking before navigation allocates. Preserve geometry, source data,
resolution, draw distance and residency budgets. See `docs/live-memory-v224.md`.

The owner's v1.0.123 correction remains in Step 10: ordinary entry floats above
Neue Nationalgalerie at its existing catalogue flight framing; walking is opt-in.
Keep the minimap and navigation HUD unmounted until the real scene is ready.
Reduce redundant source retention, decompression and native-only loading without
changing any geometry, visual quality, coverage or residency budgets. This
supersedes v1.0.120's automatic walking arrival, while keeping its gallery area
and physical podium corrections. See `docs/startup-stability-v223.md`.

The owner's v1.0.122 request remains within Step 10: improve running stability
without lowering visual quality, repair walking recovery and hurdle jumps, enable
orange-joystick double/triple taps, and descend smoothly from flight to walking.
Preserve all source geometry, textures, draw distance, resolution and residency
budgets. Recover temporary WebGL loss in the existing runtime before the bounded
clean-restart fallback. See `docs/runtime-stability-v222.md`.

The owner's v1.0.121 request permits photo-guided procedural recognition of
Alexander Calder's Têtes et Queue and Henry Moore's Archer at their exact
retained OSM terrace anchors outside Neue Nationalgalerie. Only the documented
oversized Archer torus may be replaced. Preserve the gallery, exhibition,
walking start and all unrelated city bytes. Drawn detail stays equal on mobile;
Minecraft uses independent bounded blocks. No new tour stop or residency limit.
See `docs/nationalgalerie-sculptures-v221.md` for dimensional conflicts and sources.

The owner's v1.0.120 request permits a default walking arrival on the mapped
pavement at Potsdamer Straße/Reichpietschufer in front of Neue Nationalgalerie,
with Day preselected and explicit place/theme links preserved. Correct the
exact authored stair support and podium collision without lowering the measured
pavilion or changing its footprint, exhibition, doors, or existing city detail.
The 93-place tour and residency limits remain unchanged. See
`docs/gallery-start-v220.md`.

The owner's continuation in v1.0.119 permits two further exact facade-edge
corrections at Albrechtstraße 12 and Luisenstraße 39, preserving the complete
complement of v1.0.118 facade details and all source geometry. See
`docs/theatre-corners-v219.md`. No coverage or budget expansion.

The owner's v1.0.118 request permits a bounded refinement of the existing
building surroundings of Berliner Ensemble, Heinrich-Böll-Stiftung, Deutsches
Theater and Friedrichstadt-Palast. Preserve source footprints, holes, measured
roofs/heights, dedicated landmark ownership and full mobile detail. Use verified
architectural references for local street-facing recognition; record estimated
subdivisions. No new tour stops, coverage, textures or residency budget.

The owner's v1.0.117 request permits a bounded owner-photo interpretation of the
Cattelan NIGHT exhibition outside and inside Neue Nationalgalerie. Keep the
measured pavilion/terrace, fit photo-derived furniture and art as labelled display
estimates, retain equal drawn mobile detail, separate native models and bounded
texture-free batches. Exact owner navigation may be corrected to permit the
represented stairs, floor and door openings. A restrained citywide ordinary
material/glazing pass preserves all source colours, geometry and authored details.
No new coverage, residency budget or tour stops. See `docs/cattelan-v217.md`.

The owner's v1.0.116 request permits a bounded LEGOLAND entry and yellow LEGO
sculpture refinement at Sony Center. Correct the old indoor-POI placement using
DOP/photo alignment, retaining that OSM identity and every measured building.
Replace only the inaccurate authored giraffe with the current 2022 recognition
model. Keep touch/desktop detail equal, a separate native reading, compact
texture-free batches, existing residency limits and the 93-place tour.
See `docs/legoland-v216.md` for sources and explicit alignment estimates.

The owner's v1.0.115 correction request permits correction of the specifically
identified inaccurate pointed roof on the modern Bundeswehrkrankenhaus ward,
and source-bound recognition of the immediate homes at the Günter Litfin
memorial. Evidence must distinguish the modern ward from historic pavilion
roofs. Retain original source sheets and document any exact obsolete proxy
substitution; preserve all unrelated walls, roofs, earlier fittings, helipad
and helicopter, full drawn mobile detail and existing residency limits.
The additional new-build is provisionally identified as the Zentrales
Springergebäude at Golda-Meir-Steg from its named OSM owner and primary
manufacturer photographs. This stated assumption permits bounded recognition
detail; retain and audit the differing OSM and LoD2 footprints.

The owner's v1.0.114 request permits bounded refinements at Bundeswehrkrankenhaus
Berlin and its mapped canal-side helipad, with an original red rescue helicopter
illustrating a twenty-metre approach, landing and departure. This is not a real
operator's livery or operational flight procedure. Gendarmenmarkt, BND-adjacent
housing, WZB and the two park-side Potsdamer office blocks may gain source-bound
facade fittings. Preserve all measured owners and earlier details, equal drawn
mobile detail and existing residency limits. Motion uses the shared frame loop,
reusable bounded buffers and pause/offscreen controls. This adds no coverage or
tour stop. See `docs/refinements-v214.md`.

The owner's subsequent v1.0.113 request permits a source-bound appearance review
of ordinary buildings throughout the frozen old-Mitte selection, excluding
Wedding and Tiergarten. Correct generic inherited paint only where exact source
surface ownership and role are established, use unambiguous mapped materials,
and make measured roof/wall articulation legible. Authored buildings, original
packets, topology, courts and prior refinements remain protected. Unsurveyed
window arrangements must not be described as individually verified facades.
See `docs/alt-mitte-appearance-v213.md`.

The owner's subsequent v1.0.112 request permits faster background construction
while flying high, preserving all visual/source quality. A bounded two-packet
transport prefetch may overlap the foreground request; reserve at most 4 MiB,
including HTTP-decoded sizes. Keep JSON/geometry decoding and publication serial,
all source bytes/topology and resident budgets unchanged, and cancel obsolete
work on view/family/disposal changes. See `docs/high-flight-v212.md`.

The owner's subsequent v1.0.111 request permits a restrained presentation pass
across the entire already covered city. Generic material families, retained
colour/material tags and existing facade contrast may be refined without new
coverage or inferred site-specific architecture. Preserve all source geometry,
existing windows/details, individually authored material priorities, native
models, resident budgets and 93 tour stops. Do not globalise geographic switches
that also control geometry. See `docs/city-polish-v211.md`.

The owner's 10 October v1.0.110 request permits bounded recognition refinements
at Theodor-Heuss-Platz (the seven-tier blue glass obelisk and its bounded mapped
square, park, paths and immediately surrounding carriageways), rbb Fernsehzentrum
and Haus des Rundfunks, DRV Bund Ruhrstraße 2, Erika-Heß-Eisstadion, the Bayer /
former Schering Nordhafen campus, Richardplatz, Hermannplatz and the current
Karstadt building. Existing measured owners remain complete; only documented
exact inaccurate authored estimates/proxies may yield to required complete
replacements. Preserve all unrelated source geometry and detail. Curbs and
positively source-tagged markings on Kurfürstendamm, Friedrichstraße,
Karl-Marx-Allee and Karl-Marx-Straße remain within earlier approved coverage.
Keep previous street layers, open intersections, full drawn mobile quality,
separate native geometry, unchanged city residency budgets and 93 tour stops.
No district expansion or invented historical/future Karstadt towers is implied.
See `docs/refinements-v210.md` and its linked source/preservation records.

The owner's v1.0.109 request permits the three exact sites in
`bounds-prisons-memorials-v209.geojson`: JVA Tegel, the former Stasi headquarters
in Lichtenberg and the Hohenschönhausen memorial. Only their mapped new-only
footprints extend prior coverage. Source-bound perimeters, public exterior
architecture and complete measured building families remain distinct from
JVA Moabit. Exact old owners may yield only to required complete replacements
with immutable packet receipts. Preserve all unrelated geometry and details.
The request also permits Orankesee shore/lido fittings inside its bounded mapped
site; its exact lake contour may cut only the obsolete artificial presentation
margin that incorrectly covers existing water. Preserve the complete source water
and surrounding margin. Moabit and Weinbergsweg/Kastanienallee/Kollwitzkiez/Helmholtzplatz facade
refinements inside existing coverage; and both distinct Helmholtzplatz houses.
Their documented inaccurate Platzhaus roof may be corrected consistently in
geometry and navigation while retaining its source XZ and original sheets.
Volksbühne retains its complete earlier body, facade and Räuberrad, with upper
volumes from official bDOM evidence and independently clipped roof footprints.
Keep full drawn mobile quality, separate native models, unchanged resident
budgets and the 93-place tour. Explicit `theme` links may enter all six modes
directly; the plain entry keeps its chooser and every mode remains switchable.
See `docs/refinements-v209.md` and its linked source/preservation records.

The owner's v1.0.108 request permits bounded, source-bound facade refinement
between Brandenburg Gate, Dussmann and Friedrichstraße station: the Hungarian
and Russian embassies, ARD Hauptstadtstudio, Aeroflot architectural identity,
BMAS Wilhelmstraße campus and Quartier 206. Only the documented Hungarian
proxy facade/six coarse envelopes, Aeroflot facade recipe and Quartier 206 facade
recipe may yield to verified replacements. The complete Hungarian measured
sheets belong to required city construction, never optional deferred loading.
Retain all unrelated shells, facade details, navigation and source receipts.
Keep full mobile detail, independent native models and unchanged city budgets,
coverage and the 93-place tour. See `docs/refinements-v208.md`.

The owner's v1.0.107 request permits bounded refinements of the Charité
Bettenhochhaus and the modern federal research ministry at Kapelle-Ufer 1.
Use retained measured parts and source-supported facade recognition; preserve
all unrelated campus, ministry, ground and street detail. Only precisely
identified inaccurate authored proxies may be superseded with documented source
owners. Keep full drawn detail on mobile and desktop, separate native geometry,
all existing residency budgets and the 93-place tour. This adds no district
coverage. The location describes the former BMBF/current research and space
ministry, not by itself the former Reichsluftfahrtministerium on Wilhelmstraße.

The owner's v1.0.106 request permits source-bound road markings, documented
crossing styles and traffic-signal refinements throughout the frozen old Mitte
boundary, excluding Wedding and Tiergarten. Source-clipped coarse grass may be
corrected only where it wrongly occludes these retained exact roads/pavements;
preserve its exterior surface and all unrelated terrain. Preserve all prior road geometry;
do not turn unclassified crossings into zebra crossings. The supplied Urania
photos additionally authorize correction of its exact inaccurate authored
proxies, preserving complete measured building sheets and unrelated City West
details, and a source-bound Arc de 124.5° interpretation. Photographs remain
reference-only. Keep all mobile detail, bounded instancing and existing city
residency limits. This request adds no district coverage or tour stops.

The owner's v1.0.102 request authorizes bounded refinement of James-Simon-Galerie,
the Pergamon Panorama, both Staatsbibliothek buildings and the Bendlerblock with
its memorial court. Complete documented source families may replace precisely
identified coarse owners; evidence, source coordinates, unrelated packets and
existing runtime residency/quality limits must remain intact. This adds no tour
stop or district scope. Photograph-derived aperture and facade proportions remain
explicit presentation estimates, separate from measured geometry.

The owner's v1.0.101 correction permits measured, bounded terrain refinement
at Waldbühne, the Olympic site and the Wuhlheide amphitheatre within their
existing coverage. Preserve original source XZ courses, details and every
unrelated terrain field; move surrounding paths, trees and complete building
owners consistently with the corrected ground. Sunken venues must retain their
real open bowls and matching walking heights. Exact false proxies may be
replaced only with source receipts. The Charlottenburger Tor's two wings may
receive a documented orientation/placement correction while retaining their
architectural detail. Keep the existing 93-place tour, packet/residency limits
and full drawn detail on both touch and pointer devices.

The owner-requested v1.0.48 east lobe adds only initial outlines of Bahnhof
Alexanderplatz, Fernsehturm and Rotes Rathaus and their mapped street links.
The complete task-13 bounds remain in `bounds-task13.geojson`; the existing
93-place tour and detailed city must remain intact. This narrow extension is
not authorization for an unbounded whole-city rebuild.
The owner-requested v1.0.59 extension adds rudimentary source-bound outlines
throughout Moabit and Prenzlauer Berg, plus the finite City West/Wilmersdorf,
Schöneberg, Karl-Marx-Allee through Frankfurter Tor and Schlesisches Tor lobes
documented in `docs/bounds.md`. The previous detailed scope is archived as
`bounds-v158.geojson`; its full geometry, source data and 93-place tour stay
intact. Only the new outer districts use the explicitly requested simpler
representation. Their external 512 m chunks must preserve bounded mobile
loading, native Minecraft geometry and source/estimate provenance.
The owner-requested v1.0.49 refinement adds the detailed Fernsehturm, Rotes
Rathaus, St. Marienkirche, Marx-Engels monument, mapped Forum trees and
Neptunbrunnen within this same bounds polygon. Keep existing station outlines
and distinguish current source evidence from future landscape plans.

**Owner quality-preservation policy (v1.0.41):** Performance work must not remove
visible source geometry, roads, paths, shorelines, facade details or monuments.
Retaining source files while omitting their rendered layers is a quality loss.
The drawn modes use the existing full static model detail on both touch
and pointer devices. Use exact indexing, instancing, offline preparation,
bounded transfers and cancellation to reduce memory instead. Camera-following
building residency must leave every source part eligible for exact refinement
and preserve its full source envelope before refinement and before eviction.
The explicitly requested Minecraft tree reduction and existing separate native
Minecraft geometry remain independent.
The owner-requested v1.0.70 Flooded Berlin mode reuses the complete Day city.
Its fictional horizontal water table is clipped to the existing bounds, with
no expanded geography, removed detail or second city copy. Preserve its lazy
texture-free water surface and exact camera/walking continuity. Keep source-area/ownership accounting
and visual checks at Invalidenpark, Otto-Weidt-Platz and Spree/Hauptbahnhof;
never restore coarse raster substitutes as the finished drawn presentation.

Must be inside the polygon and visible in the final map:

- Brandenburger Tor and Pariser Platz
- Reichstagsgebäude (incl. the glass dome — this is a hero tile)
- Bundeskanzleramt
- Paul-Löbe-Haus
- Marie-Elisabeth-Lüders-Haus
- Berlin Hauptbahnhof (incl. the glass roof and the complete five-level
  interior hall — hero tile), Hamburger Bahnhof, Rieckhallen, Sozialgericht
  Berlin, Europacity, KPMG and DKB. Keep the upper rail deck, upper gallery,
  main concourse, lower gallery and deep platforms visibly distinct around the
  daylight slot. Preserve all four cylindrical panoramic lift shafts through
  every level, including their ring frames, landing doors and visible cabins;
  repeated interior detail stays instanced and supplied photographs remain
  non-bundled visual references.
- The Sozialgericht's 58.038 m street-side site boundary from OSM way
  `423490503`, kept distinct from the actual 48.905 m facade and 15.392 m
  risalit of Berlin LoD2 body `DEBE01YYK0002Qys`; retain its 4 + 3 + 4 facade
  hierarchy, Portal 52 and broad three-group roof silhouette. Supplied
  photographs remain reference-only and must never become bundled or runtime
  textures; the touch and Minecraft readings keep explicit bounded budgets.
- The temporary 2026 FUNBOX at the Wunderland-Festplatz, kept wholly outside
  the delivered Heidestraße, Minna-Cauer-Straße and Döberitzer Straße surface
  polygons in both drawn and Minecraft representations
- The Geschichtspark Ehemaliges Zellengefängnis Moabit at exact OSM park way
  `498278335`, retaining its mapped red-brick wall traces, exact Panoptikum way
  `195086492` and Berlin LoD2 cell `DEBE01AL2yz00000`. Present-day interpretive
  details must remain procedural and must not trace or bundle the protected
  landscape plan.
- Haus der Kulturen der Welt ("Schwangere Auster") with its bow-roof
- The complete Großer Tiergarten to Charlottenburger Tor, with Siegessäule,
  Luiseninsel, Rosengarten, Café am Neuen See and the mapped path/tree network
- The Lenné-Eiche (`Quercus petraea Liebl.`) near Carillon at the exact
  Geoportal Berlin tree fingerprint `[-274.82, 3.787, 154.97]`, retaining its
  published 23 m height, 9.5 m crown radius and 0.5 m trunk radius. Its
  dedicated drawn model keeps the photographed root flare, deeply fissured
  trunk, high twin leaders, long horizontal limb, airy asymmetric crown,
  exposed dead tips and small botanical plaque. Owner photographs remain
  reference-only and must never become bundled or runtime textures. Minecraft
  replaces the matching official voxel tree with one draw-call, block-native
  full/mobile variants that preserve the same high fork, reach and open crown.
- The complete 20-work "Skulpturen gegen Krieg und Gewalt" ensemble on the
  former Krolloper grounds between TIPI and the Bundeskanzleramt. Every work
  keeps its current OSM node anchor and an individual procedural silhouette;
  the key Contact, Himmelsschlüssel, Große Knospe III/63 and Todes Mauer Bruch
  models retain their photographed openings, cuts, proportions and ground
  plates. The generic OSM monument pass must not duplicate these 20 works.
  Owner photographs remain reference-only and must never become bundled or
  runtime textures. Full and mobile profiles both retain the entire ensemble;
  touch and pointer profiles retain the same full static detail.
- The ten-metre Beethoven-Haydn-Mozart monument at its committed Tiergarten
  anchor, retaining the rounded granite understructure, chamfered three-sided
  tinted-marble pavilion, three round-arched white-marble half figures,
  restored gilt appliques, swans, scaled cupola, pinecones and putti/laurel
  crown. Published monument facts and procedural local subdivisions must stay
  source-separated.
- The Holocaust Memorial remains completely free of trees, Creepers, Zombies
  and Skeletons in Minecraft. Voxel-tree filtering and all hostile-mob spawn,
  walkability and movement must use the same rotated protected field plus
  conservative edge clearance. The bounded allowed complement is six
  Creepers, sixteen Zombies, five Skeletons and four foxes on desktop, or four
  Creepers, ten Zombies, three Skeletons and three foxes on mobile, as requested
  on 2026-09-05. Each profile remains one fixed-capacity instanced draw call.
  Mobs spawn only near the camera/player in Minecraft and despawn beyond
  95 m / 72 m (desktop/mobile), or immediately when leaving that mode.
  Foxes and loot boxes use the same protected walkability and
  may never appear inside the memorial field.
- The Goethe-Denkmal at exact OSM node `278738513` and the Lessing-Denkmal at
  exact OSM node `884700390`, each as a source-bound close-detail model in the
  four drawn modes plus a separate block-native Minecraft reading; reversible
  Snowstorm accumulation, memorial protection and solid-only pedestrian
  collision must preserve their surrounding mapped paths and approaches. The
  Lessing fence must use the same 28-field, eight-segment chamfered-octagon
  outline for drawn geometry, Minecraft blocks and physical collision.
- The Richard-Wagner-Denkmal at exact OSM node `243487615`, bound to
  Landesdenkmalamt Berlin part object `09046318,T,041`, as the 90th navigable
  sight. The false closed LoD2 shelter envelope `SR00009n` must not survive as
  an occupied building or Minecraft column mass: the source-bound detail model
  keeps the protective canopy open, the front/rear approaches walkable and
  only its authored marble and steel solids collidable.
- The Weidendammer Brücke as the 91st navigable sight, centred on exact OSM
  bridge way `6228081` and bound to Landesdenkmalamt object `09030074`. Its
  current 69.48 x 25.17 m inventory envelope, exactly two forged midspan
  eagles, eight lamp standards and one neo-Baroque railing system must remain
  source-separated from procedural, non-surveyed love-lock placement.
  Minecraft uses one block-native reading without a smooth ornament double.
- Fritz Cremer's Brecht memorial as the 92nd navigable sight at exact OSM node
  `988668382`, retaining the
  published 6 m circular sett platform, the slightly over-life-size seated
  figure on its asymmetric open metal bench and three cylindrical, horizontally
  jointed black-stone steles. Credit Peter Flierl for the installation design,
  Fritz Cremer for the sculpture and Carlo Wloch for stonework/steles; do not
  reproduce the copyrighted poem or quotations.
- The Scharnhorst grave monument as the 93rd navigable sight at exact OSM node
  `273120316`, retaining the
  Berlin-Lexikon's published 5.60 m overall silhouette, two architectural
  piers, Carrara-marble sarcophagus, Friedrich Tieck relief frieze, reclining
  bronze lion and Schinkel iron enclosure. Credit Karl Friedrich Schinkel for
  the architecture, Christian Daniel Rauch for the lion model and Theodor Kalide for its
  execution; use the Schinkel portal for form/material and identify the current
  sarcophagus and frieze as conservation copies.
- The newly established CSD memorial place near Bellevueallee/Ahornsteig at
  exact OSM node `14076715427`, kept separate from the existing owner-supplied
  Queer Rainbow Memorial model and from the 93-place tour catalogue
- Luiseninsel playground opposite the Philharmonie, including mapped paths,
  trees and playground equipment
- Kulturforum, Potsdamer/Leipziger Platz, Anhalter Bahnhof, Kochstraße and the
  WELT balloon
- Both Tiergartentunnel portals and the explicitly labelled approximate
  underground route
- Hauptbahnhof tram/S15 public realm, Futurium and the federal research campus
- Berliner Ensemble and Berlin Friedrichstraße in the bounded north-east lobe
- Friedrichstadt-Palast at its OSM/LoD2 anchor with the documented 110 x 80 m
  main volume, higher stage tower, foyer risalit, stairs, fins and two-storey
  coloured concrete-glass fields; and the Tränenpalast as its separate low
  steel-and-glass pavilion, never swallowed by the Friedrichstraße station
  shell. Full/mobile profiles remain bounded and image-free.
- The Unter den Linden recognition sequence keeps the British Embassy,
  Russian Embassy, Aeroflot / Russian Trade Mission, Haus Pietzsch / Cafe
  Einstein and Dussmann KulturKaufhaus on their committed OSM identities and
  Berlin LoD2 envelopes. Street-facing porticoes, bay rhythms, signs and
  colour fields remain bounded procedural subdivisions. Smooth presentation
  is lazy, instanced and texture-free; Minecraft uses one facade-only batch.
  External photographs remain non-bundled visual references only.
- Bode-Museum and Grill Royal / Riverside remain source-bound recognition
  buildings without becoming additional tour stops. Their complete 2026 LoD2
  supplement retains twelve parts, the museum's five open courts and two dome
  envelopes, and the restaurant building's complete height/roof profile. Both
  drawn and block-native forms stay texture-free; Wikimedia photographs remain
  non-bundled visual references only.
- The bounded City West recognition ensemble: Europa-Center, Allianz-Haus,
  historic Café Kranzler and New Kranzler Eck, Bahnhof Zoologischer Garten,
  Kaiser-Wilhelm-Gedächtniskirche with Breitscheidplatz, and Urania. Each keeps
  OSM/LoD2 as the metric anchor and adds only source-labelled, batched,
  mobile-aware procedural recognition detail.
- The current Helene Weigel installation in the Helene-Weigel-Hof at exact OSM
  node `13841652635`, kept separate from Brecht and from the 93-place tour
  catalogue. Its recognition model must read as a transparent glass cube on a
  white plinth, with the central red folding director's chair and its visible
  crossed scissor frames, the folded red chair/object landscape, light/audio
  elements, cable runs and a large black raster portrait on the glazing. The
  portrait remains procedural geometry; no photograph or portrait texture is
  bundled or loaded.
- Detlev-Rohwedder-Haus, Gropius Bau, Abgeordnetenhaus and Topography of Terror

The committed 93-place landmark catalogue is the release inventory. Keep all
data clipped to the polygon, avoid unbounded whole-city output, and record any
future owner-approved bounds expansion in the changelog and data manifests.

A precise landmark list with coordinates lives in
[`geo_data/regierungsviertel/landmarks.geojson`](geo_data/regierungsviertel/landmarks.geojson)
and [`docs/bounds.md`](docs/bounds.md).

## 4. Hard data / licensing rules — additive source fusion

**Owner policy: additive data fusion.** Use all available permitted
sources together; keep the best evidence from each source per tile. Do
**not** treat any single source as a replacement for another. Do not
silently discard a source because another exists. If sources disagree,
record the conflict and choose evidence according to
[`docs/data.md`](docs/data.md).

### Permitted sources

1. **Berlin LoD2 buildings** — *authoritative building geometry anchor.*
   Source: [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin),
   licensed under [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0)
   (effectively public domain).
2. **OpenStreetMap** — streets, water, parks, rail, POIs, semantic
   context. Pulled via Overpass / OSMnx / Geofabrik, clipped to the
   Regierungsviertel polygon. Licensed under
   [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
3. **ALKIS / DOP / DGM (Berlin official data)** — official alignment,
   parcel context, orthophoto QA, terrain where useful. Geoportal
   Berlin, dl-de/zero-2-0.
   The official Berlin tree catalogues, public-lighting WFS and 1989
   Vorderlandmauer WFS additionally anchor individual trees, lamp positions
   and the double-row Wall trace; unknown object dimensions remain labelled
   display approximations.
4. **Berlin 3D Mesh Model 2025** — optional archival alignment/QA evidence
   from the June 2025 survey, downloaded only after explicit terms acceptance.
   It is not a production viewer asset: do not commit derived photo GLBs,
   texture crops or hidden fallback shells. LoD2 remains the metric building
   anchor. Any separate public output that actually displays the mesh must
   credit Berlin Partner für Wirtschaft und Technologie GmbH.
5. **Google Maps Platform / Photorealistic 3D Tiles** — *opt-in*
   additive source for photorealistic geometry, texture, alignment,
   and visual reference where permitted by Google's terms. **Not** a
   replacement for Berlin LoD2 or OSM.
6. **Wikimedia Commons / Wikipedia media** — additive visual-reference
   source for freely licensed landmark facade, roof, glass, stone,
   vegetation, and colour cues. Use only files with clear free-license
   metadata (CC0, public domain, CC BY, CC BY-SA). Keep per-file
   attribution in the manifest. **Not** a geometry or semantic source.

### Google opt-in rules (strict)

Google Maps Platform is allowed **only** when all of the following are
set in the run environment:

- `GOOGLE_MAPS_API_KEY` is set.
- `GOOGLE_MAPS_3D_TILES_ENABLED=true`.
- `GOOGLE_MAPS_TERMS_ACCEPTED=true`.

Additional Google constraints (non-negotiable):

- **Never** commit Google API keys. Use `.env` (gitignored).
- **Do not** commit Google raw responses, tile caches, screenshots,
  meshes, or other Google-derived intermediate artefacts by default.
- Raw Google downloads live under
  `geo_data/regierungsviertel/raw/google_3d_tiles/` (gitignored).
- Manifest files written under `geo_data/regierungsviertel/raw/...`
  **must omit API keys** — strip query parameters and store URL
  templates with placeholders.
- Any public-facing output that uses or derives from Google Maps
  Platform content **must** include the required Google attribution /
  product notices per Google's terms, **in addition to** the
  OSM/Geoportal Berlin attribution string.

### Mandatory attribution

Every public-facing artefact must retain the complete source notices. Per the
owner's explicit UI request, the web viewer presents these through the built-in
**Quellen & Lizenzen / Sources & licenses** menu on the start screen and in the
desktop/mobile controls. Keep the panel closed initially; do not restore an
automatic credit overlay on the boot screen or viewer. Exported PNGs in a
published gallery, video clips and social previews must display, at minimum:

> © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)

When Google Maps Platform content was used in producing the artefact,
append the appropriate Google attribution per their terms. See
[`NOTICE.md`](NOTICE.md).

When Wikimedia Commons / Wikipedia media was directly used for visual
references, texture cues, published reference plates, or derived
material colours, include the Wikimedia visual-reference notice in that same
viewer panel (or visibly on exported artefacts), and keep the per-file credits
packaged with the artefact.

When the official Berlin 3D Mesh is displayed, append:

> 3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH

### Repository hygiene for geodata

- Do **not** commit raw multi-GB geodata dumps. Only commit small,
  derived, clipped artefacts (GeoJSON, small GeoPackage) for the
  Regierungsviertel polygon.
- Raw downloads (LoD2 CityGML, ALKIS, DOP, DGM, OSM Overpass cache,
  Google 3D Tiles) belong in `geo_data/regierungsviertel/raw/<source>/`
  which is gitignored.
- Wikimedia visual references are the exception for small, explicitly
  licensed thumbnails and QA atlases under `references/wikimedia/`.
  Do not commit arbitrary internet-photo dumps or files with unclear
  rights.

## 5. Pipeline (canonical 10 steps)

If you implement, modify, or debug any step, keep this numbering in
commit messages and PR titles (e.g. `step-4: …`).

1. **Bounds.** Polygon in `geo_data/regierungsviertel/bounds.geojson`.
   Editor TODO: `isometric_berlin.generation.create_bounds`.
2. **LoD2 geometry.** `isometric_berlin.data.fetch_lod2` downloads the
   relevant Berlin LoD2 CityGML tile(s), clips to bounds, writes
   `geo_data/regierungsviertel/buildings.gpkg`.
3. **OSM context.** `isometric_berlin.data.fetch_osm` pulls streets,
   water (Spree), parks (Tiergarten), railway (Hauptbahnhof tracks),
   POIs from Overpass, clipped to bounds. Writes `osm.gpkg`.
4. **ALKIS / DOP / DGM support (optional).**
   `isometric_berlin.data.fetch_official_support` pulls Berlin parcel
   / orthophoto / terrain data for alignment, QA, and terrain.
4a. **Berlin 3D Mesh 2025 (optional archival QA only).**
   `isometric_berlin.data.fetch_berlin_mesh` selects only the source
   tiles intersecting the bounds. Raw OBJ/texture ZIPs remain
   gitignored. Do not publish its derived GLBs or textures in the static
   Three.js viewer; the production scene is procedural LoD2/OSM geometry.
4b. **Official public-space details (official, additive).**
   `isometric_berlin.data.fetch_official_details` clips Berlin's tree,
   public-lighting and Vorderlandmauer WFS layers into
   `geo_data/regierungsviertel/official_details.gpkg`. Raw WFS responses stay
   gitignored.
5. **Google Photorealistic 3D Tiles (opt-in, additive).**
   `isometric_berlin.data.fetch_google_tiles` writes a key-free
   manifest to
   `geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json`.
   Only fetches actual tile content with `--download-content` when
   explicitly approved for the current run.
5a. **Wikimedia visual references (additive, free-license filtered).**
   `isometric_berlin.data.fetch_wikimedia` writes
   `geo_data/regierungsviertel/wikimedia_references.json` plus small
   thumbnails / atlas files in `references/wikimedia/`. These support
   material and facade QA; they do not replace steps 2–4 or the
   Google opt-in source.
6. **Source-fusion manifest.** `isometric_berlin.data.fuse_sources`
   combines all permitted sources into a single fused source-stack
   manifest with provenance per feature/tile (see
   [`docs/data.md`](docs/data.md) and
   [`tasks/done/05-source-fusion-manifest.md`](tasks/done/05-source-fusion-manifest.md)).
   Conflicts are recorded, not silently dropped.
7. **Quadrant grid.** `isometric_berlin.generation.create_grid` builds
   an isometric 512×512 px quadrant grid covering the bounds and
   stores it as placeholder rows in
   `generations/regierungsviertel/quadrants.db`.
8. **Renders.** `isometric_berlin.generation.render_quadrants` builds
   a `pyvista` scene per quadrant from the fused source stack,
   isometric camera, orthographic projection, renders a 1024×1024 PNG
   into the `render` BLOB.
9. **AI tile generation.** `isometric_berlin.generate_tile` POSTs each
   render to a fine-tuned `Qwen/Image-Edit` LoRA on Modal, stores the
   returned pixel-art PNG in the `generation` BLOB. Apply the
   2×2 / 1×2 / 2×1 / 1×1 adjacency rules from the NYC project to
   avoid seams.
10. **Isometric 3D viewer.**
    React + TypeScript + Vite + Three.js under `src/app/` serve the
    measured procedural scene as a static build. No 2D viewer, map engine
    or DZI pyramid is shipped. `generation.export_dzi` remains archival
    tooling; its outputs are not runtime dependencies.

## 6. Tech stack and conventions

- **Python ≥ 3.12**, `uv` for everything. No `pip`, no `poetry`, no
  `conda`. Run code via `uv run …`, never activate the venv manually.
- **`ruff`** for format + lint. Line length 88, 2-space indent (matches
  upstream NYC style).
- **`pytest`** for tests. Place tests under `tests/`.
- **Type hints required** on all public function signatures.
- **Absolute imports** inside the `isometric_berlin` package.
- **Frontend:** `bun` for install/dev/build under `src/app/`. React +
  TypeScript + Vite + Three.js.
- **Geometry stack:** `shapely`, `pyproj`, `geopandas`, `osmnx`,
  `rasterio`, `pyvista`, `pyvips`.

Useful commands:

| Task | Command |
| --- | --- |
| Install Python deps | `uv sync` |
| Run tests | `uv run pytest` |
| Format | `uv run ruff format .` |
| Lint | `uv run ruff check .` |
| Dev viewer | `cd src/app && bun install && bun run dev` |
| Build viewer | `cd src/app && bun run build` |

## 7. Repository layout

```
isometric-berlin/
├── AGENTS.md                 # THIS FILE — read first
├── CLAUDE.md                 # → AGENTS.md
├── README.md                 # Human-facing, bilingual DE/EN
├── NOTICE.md                 # Attribution requirements
├── LICENSE                   # MIT
├── CONTRIBUTING.md
├── pyproject.toml
├── .python-version
├── .env.example
├── docs/
│   ├── setup.md
│   ├── bounds.md
│   ├── data.md               # incl. additive fusion + conflict rules
│   ├── generation.md
│   ├── app.md
│   ├── deployment.md
│   ├── perplexity-hosting.md
│   ├── glossary.md
│   └── agents.md
├── geo_data/
│   └── regierungsviertel/
│       ├── README.md
│       ├── bounds.geojson    # MVP polygon
│       ├── landmarks.geojson # Must-be-visible landmarks
│       ├── fused_sources.json # OUTPUT of step 6 (see docs/data.md)
│       └── raw/              # gitignored, raw downloads, incl.
│                             # google_3d_tiles/, alkis/, dop/, dgm/
├── generations/
│   ├── README.md
│   └── regierungsviertel/    # quadrants.db, renders, tiles
├── references/               # Style refs (self-rendered only)
├── inference/                # Modal serving for Qwen-Image-Edit LoRA
├── src/
│   ├── isometric_berlin/     # Python pipeline package
│   │   ├── data/             # fetch_*, fuse_sources
│   │   └── generation/
│   └── app/                  # React + Three.js viewer
└── tests/
```

## 8. What success looks like (Definition of Done v1.0.0)

- `geo_data/regierungsviertel/bounds.geojson` finalised and reviewed.
- LoD2 buildings clipped, OSM context clipped, both stored as small
  GeoPackages in the repo.
- A fused source-stack manifest at
  `geo_data/regierungsviertel/fused_sources.json` referencing all
  permitted sources that were available at fusion time, with
  per-feature provenance and a recorded conflict log.
- A `quadrants.db` covering the bounds with rendered source PNGs and
  AI-generated pixel-art PNGs for every quadrant. This SQLite DB is a
  regenerated intermediate (`generations/**/*.db` is gitignored): it is
  rebuilt on demand by `create_grid` → `render_quadrants` →
  `generate_tile`, not committed. This archival image-generation pipeline
  is independent of the shipped 3D scene.
- Complete committed procedural 3D payloads under `src/app/public/mesh/`;
  keep the walking minimap, startup image, landmark metadata and credits.
- A working static viewer (`bun run build`) under `src/app/dist/`
  that pans/zooms cleanly, makes the complete required attribution available
  through its built-in source menu (including applicable Google attribution), and
  renders all 93 catalogued sights in the same coordinate frame.
- All four shipped landmark payloads remain synchronised at 93 records; the
  alignment audit passes 41 relative-placement contracts and preserves the
  three established manual-review anchors.
- A true Three.js mode using procedural Berlin LoD2/OSM geometry, with
  progressive loading, complete instanced building coverage, mouse/touch
  orbit, a real below-ground camera and a schematic Tiergartentunnel cutaway.
  Retired GLBs, heavy road plates and the retired 2D engine stay absent.
  Recovery keeps the visitor in 3D; local downloads include 3D launchers.
- All landmarks and required context details from §3 are navigable. Hero
  recognition geometry may supplement, but never displace, the measured
  LoD2/OSM anchors.
- Goethe and Lessing remain independently selectable at their exact OSM
  anchors. Day, Night, Snowstorm and Schwellenraum share the source-bound drawn
  monuments; Minecraft uses block-native counterparts without smooth doubles.
  Snow is reversible, memorial protection stays non-enterable, pedestrian
  collision follows represented core/fence-side solids instead of closing the
  surrounding park paths, and no visual-reference photograph is loaded by the
  viewer.
- The frozen Goethe/Lessing detail profile keeps snow-free heights of 6.08 m
  and 7.00 m. Goethe retains 42 fence fields and three paired allegory
  groups/six figures; Lessing retains five steps, two basins with dolphin
  spouts, three portrait fields, two principal bronze allegories and a
  28-field/eight-segment chamfered-octagon fence shared by drawn, Minecraft and
  collision forms. Their combined Smooth Snowstorm budget is exactly 8
  renderables / 33,306 rendered vertices; Minecraft is one InstancedMesh / 763
  blocks / 18,312 rendered vertices, for 9 stored renderables across both
  representations. Protection
  radii are 4.3 m and 2.95 m; physical collision remains core-plus-fence-side
  only, and all eight sampled approach directions remain free.
- Wagner remains independently selectable at OSM node `243487615` and official
  monument part `09046318,T,041`. Day, Night, Snowstorm and Schwellenraum share
  its source-bound drawn root; Minecraft substitutes a block-native reading.
  The former closed LoD2 shelter `SR00009n` stays removed. Smooth presentation
  is frozen at 6 renderables / 26,304 rendered vertices; Minecraft is one batch
  / 514 blocks. Front, rear, side and high shelter approaches remain open,
  collision follows only authored granular solids, and no reference photograph
  or photographic texture is loaded by the viewer.
- FUNBOX remains on its bounded Wunderland-Festplatz display envelope with a
  measured minimum **2.553 m** clearance from the delivered OSM-derived road
  surfaces. Drawn presentation stays frozen at 5 renderables / 7,921 rendered
  vertices and Minecraft at 62 blocks; both full and mobile-like Minecraft
  profiles use the same structural footprint and remain clear of the northern
  Tiergartentunnel portal and source voxel buildings.
- The Moabit prison memorial park uses all 19 exact mapped wall segments: the
  four segments of OSM way `105495351` retain their explicit 4 m height and the
  other 15 use Berlin's published general 5 m wall height only as a display
  value, not as per-segment survey evidence. Full Smooth presentation is frozen
  at 5 renderables / 20,466 stored vertices on both pointer and touch;
  Minecraft is one batch with 4,040 / 2,273 blocks and 96,960 / 54,552 rendered
  instance vertices for full / mobile. The exact Panoptikum and retained LoD2
  cell do not replace or duplicate source park, lawn, path, tree or cell
  geometry. Ordinary collision keeps the three mapped entrance gaps and cell
  approach open while Schwellenraum retains whole-park protection. No
  photograph, protected plan or photographic texture is bundled or loaded.
- Weidendammer Brücke remains independently selectable as catalogue sight 91,
  after Richard Wagner as sight 90; Brecht and Scharnhorst follow as sights 92
  and 93. The separate CSD memorial place is not added to the tour catalogue.
  Weidendammer's official 69.48 x 25.17 m envelope carries
  exactly two forged eagle reliefs, eight lamp standards and one railing system.
  Full Smooth is frozen at 5 renderables / 46,568 stored vertices / 90,116
  rendered vertices / 192 procedural love locks on both pointer and touch.
  Minecraft is one batch with 344 / 224 blocks and 8,256 / 5,376
  rendered instance vertices for full / mobile. The roadway and pavements stay
  walkable while represented rail, lamp and eagle solids remain collidable. The
  Biermann association is factual cultural context only: no song lyric,
  photograph, plan or texture is reproduced or loaded.
- The Brecht installation keeps its traversable 6 m sett platform around the
  granular seated figure/open bench and three cylindrical steles. Day, Night,
  Snowstorm and Schwellenraum share one drawn public-art root; Minecraft uses a
  deterministic block-native replacement with no smooth duplicate. Full and
  mobile Smooth are identical at 3 renderables / 38,400 stored and rendered
  vertices; Minecraft is 4 batches / 197 blocks / 4,728 rendered instance
  vertices over one 24-vertex cube. The close camera uses 14 m and the fine
  layer 34/105 m hysteresis.
  Fine incision cues carry no poem or quotation text.
- The current Helene Weigel work remains independently anchored at exact OSM
  node `13841652635` in the Helene-Weigel-Hof. Its white plinth supports a
  transparent glass cube containing a central red folding director's chair
  with two visible crossed scissor frames, a folded red chair/object landscape,
  light/audio elements and visible cable runs. A large black procedural raster
  portrait reads on the glass without loading a photograph, portrait crop or
  portrait texture. The installation remains visible in Day, Night, Snowstorm,
  Minecraft and Schwellenraum without becoming a 94th tour stop.
- Bode-Museum retains four official parts, five unroofed courts, 25.480 m main
  envelope and dome tops at 49.512 m and 38.639 m in the viewer frame. Grill
  Royal / Riverside retains all eight official parts and its OSM restaurant
  anchor. Drawn recognition remains below 600 KiB at 14 draw calls; Minecraft
  is one surface-only block batch below 360 KiB, without hidden solid fill.
- The five-building Unter den Linden recognition sequence stays source-bound
  and outside the tour count. Its Smooth overlay remains at 10 draw calls,
  1,669 instances and below 180 KiB; its Minecraft reading remains one
  facade-only batch, 280-500 instances and below 50 KiB. Both are texture-free
  and retain exterior-facing details without hidden solid infill.
- Scharnhorst reads as a 5.60 m architectural tomb rather than a generic lion
  blob: two piers and the Carrara sarcophagus carry the Tieck frieze and a real
  reclining bronze-lion silhouette within the Schinkel railing. The structural
  lion remains visible when close-only mane/face/claw detail fades. All drawn
  modes remain static and protected; Minecraft uses its separate block-native
  signature. Full and mobile Smooth are identical at 8 renderables / 554 stored
  / 15,539 rendered vertices; its Minecraft contribution is 4 batches / 566
  blocks / 13,584 rendered instance vertices over one 24-vertex cube. The 18 m
  focus uses the exact OSM anchor, and collision keeps the centre between the
  two piers open.
  Unpublished part proportions remain procedural display geometry.

## 9. Static hosting

The published viewer uses GitHub Pages. Keep the build portable to other
static hosts, including Perplexity:

- Keep the viewer **fully static** after `bun run build` —
  `index.html` + `assets/*` + `mesh/*` + retained `dzi/regierungsviertel/*`
  metadata and small images. No backend
  required at serve time.
- All paths inside the built viewer must be **relative**
  (`./dzi/regierungsviertel/…`), so the site works under any subdomain
  or sub-path. Configure Vite's `base: './'`.
- Ship the complete 3D geometry without reducing detail, coverage or resolution.
  Exclude retired flat-map tiles and duplicate offline viewers from downloads.
  Target total bundle size **< 200 MB**, ideally **< 50 MB**.
- When a Perplexity agent deploys this, it will run
  `cd src/app && bun install && bun run build`, then deploy
  `src/app/dist/`. Make sure that command sequence always works from
  a clean clone.
- The complete source-credit panel (§4) must be built into the viewer and
  reachable from the start screen, desktop toolbar and mobile menu. Keep all
  notices packaged rather than in a separate footer file that could be stripped
  during deployment; do not open the panel automatically.

## 10. How to behave as an agent in this repo

When you (Codex, Claude Code, Cursor, Gemini CLI, Perplexity) pick up
a task:

1. **Re-read this file** and the relevant `docs/*.md`. Skim
   `README.md` for the bilingual context. Read `NOTICE.md`.
2. **State the plan before editing.** Identify which of the 10
   pipeline steps you are working on. Reference the step number.
3. **Stay in scope.** Regierungsviertel only. Permitted sources only.
   Google only when the three opt-in env vars are set. No raw
   multi-GB commits. No API keys in commits.
4. **Prefer small, reversible changes.** One pipeline step per PR /
   per session.
5. **Use `uv` and `bun` only.** Never invent a new package manager.
6. **Write/extend tests** in `tests/` when you touch Python code.
7. **Run `uv run ruff format .` and `uv run ruff check .`** and
   `uv run pytest` before handing back to the owner.
8. **Never silently broaden scope, never silently switch data
   sources, never silently drop a permitted source, never silently
   change the license.**
9. **Commit messages:** `step-<n>: <short imperative>` (e.g.
   `step-5: fetch Google 3D Tiles manifest for Regierungsviertel`).
10. **Open questions go in `docs/` or in PR descriptions**, not in
    silent code comments that nobody will see.

## 11. Things that will get a PR rejected immediately

- **Silently dropping a permitted source.** Additive fusion is owner
  policy (see §4). If you must skip a source for a given tile,
  record it as a conflict per `docs/data.md`, do not delete it.
- **Treating Google as a replacement** for Berlin LoD2 or OSM, or
  using Google without the three opt-in env vars set
  (`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_3D_TILES_ENABLED=true`,
  `GOOGLE_MAPS_TERMS_ACCEPTED=true`).
- **Committing Google API keys**, Google raw responses, Google tile
  caches, Google-derived meshes/screenshots, or any other
  Google-derived intermediate artefact.
- **Manifest files that contain API keys** — keys must be stripped
  before writing.
- Committing raw `.gml`, `.citygml`, `.osm`, `.osm.pbf`, `.tif`,
  `.tiff`, `.glb`, `.b3dm`, `.json` Google tile responses, or an
  unbounded binary > 5 MiB outside of `references/`. The bounded canonical
  `buildings.gpkg`, `osm.gpkg` and `osm_context_buildings.gpkg` may grow to
  10 MiB, 16 MiB and 8 MiB respectively when an owner-approved bounds revision
  requires the complete clipped source; release tests enforce those ceilings.
  Bounded, derived `src/app/public/mesh/regierungsviertel/*.glb` files remain
  below 5 MiB; lossless prism/Minecraft JSON has a separate measured 7 MiB
  ceiling. All public assets must pass release QA.
- **Removing or altering the required attribution string** — including
  failing to add Google attribution when Google content was used.
- Changing the LICENSE without owner sign-off.
- Replacing `uv` with `pip`/`poetry`, or `bun` with `npm`/`pnpm`.
- Building anything outside the currently committed bounds without explicit
  owner approval and a documented bounds revision.
- Hardcoding absolute URLs for the scene assets that break under
  Perplexity hosting.

## 12. Owner profile (helps with judgement calls)

- Owner: Klotzkette, based in Berlin.
- Communicates primarily in German; code, comments, commit messages,
  and docs in English. The user-facing README is bilingual DE/EN.
- Prefers concise, professional answers without filler.
- Will run most agent sessions through **Codex** for cost reasons,
  occasionally through Claude Code or Perplexity. Treat all three as
  equally privileged readers of this file.

---

If anything in this file is ambiguous for your current task, **stop
and ask the owner before guessing.** Scope discipline beats velocity
on this project.


### Step 10 — v229 named park, river and district-court refinement

The owner's request permits narrowly bounded improvements at Fritz-Schloß-Park,
Stadtbad Tiergarten and its sports grounds, Zellengefängnis Moabit, S-Bahnhof
Wedding/Gerichtstraße, Schönholzer Heide, the Panke to Nordhafen, and all current
Berlin Amtsgerichte including distinct official office buildings. Retained source
rings, older architectural detail and the 93-stop tour remain authoritative.
Park corrections require exact source receipts and the same visible/walking
height; native geometry remains independently orthogonal. No general district
rebuild, broad source deletion or raised runtime residency budgets is authorized.
Material details and heights without direct evidence must be marked estimates.
The Panke branch to Nordhafen must remain distinct from the Südpanke to the Spree;
tunnel and mouth openings must stay clear. See docs/refinements-v229.md.

### Step 10 — v230 named north/west and residential refinement

The owner explicitly requests Eiswerder, the Reuter-West cooling tower near
Siemensstadt, Spandau/Zitadelle, BEHALA Westhafen warehouses, Botanischer Volkspark
Blankenfelde-Pankow, Marzahn housing rows, existing outer residential buildings,
Wasserturm Prenzlauer Berg, Kollwitzplatz, Choriner Höfe and John-Lennon-Gymnasium.
New source coverage is limited to the exact botanical park boundary, the complete
Reuter tower/service footprints and two finite buffers around Marzahner Promenade
and Helene-Weigel-Platz, minus every retained source area. No arbitrary district
fill or expanded runtime residency budget is authorized. Complete measured
replacement shells require immutable exact-owner receipts; surrounding owners
and all earlier detail remain intact. Estimated façade rhythms and material hues
are explicitly distinguished from source-surveyed shapes. See refinements-v230.md.


### Step 10 — v231 museum-island and Spree street refinement

The owner requests more accurate public architecture between Berliner Ensemble,
Berliner Dom and Hackescher Markt, the Alte Nationalgalerie colonnades, both
Monbijou bridge arms and Monbijoupark. This is bounded refinement inside existing
coverage, with no new district scope. Preserve every measured source envelope,
park/water/path area, existing authored detail, all 93 tour stops and live memory
budgets. Only precisely receipted erroneous presentation proxies may yield to
complete source-bound corrections. Ordinary residential fronts remain public
streetscape geometry without identifying occupants or their private homes.
Drawn mobile detail stays complete; native geometry remains independently
orthogonal. Unmeasured recognition details must be documented estimates.


### Step 10 — v232 starts, Ringbahn and outer materials

The owner requests seven varied flight starting views (Kanzleramt, Brandenburger
Tor, Berlin Junction/Richard Serra, Hauptbahnhof, Gedächtniskirche, Rotes Rathaus,
and Neue Nationalgalerie), complete Ringbahn station recognition, improved
wide-zoom stability and restrained outer-house refinement inside existing
coverage. Preserve all 93 tour stops and specific links, all source geometry,
authored models, complete mobile detail and native orthogonal construction.
No coverage expansion or runtime budget increase. A byte-aware offscreen GPU
retention target may reclaim identical re-uploadable copies without changing
visibility. Source material tags may refine positively matched ordinary owners.


### Step 10 — v233 ordinary house architecture

The owner requests more house-like ordinary buildings in existing coverage of
Mitte, Friedrichshain-Kreuzberg, Charlottenburg-Wilmersdorf and Schöneberg:
source-faithful roofs, gutters, entrances and curbs. The spoken “Wuhledorf” is
pending clarification and does not imply a new coverage area. Use retained
measured roof sheets and mapped entrance/pavement evidence; distinguish estimated
fitting dimensions from surveyed geometry. Preserve source owners and earlier
authored detail, all 93 tour stops, full drawn mobile quality, independent native
geometry and existing memory budgets. Only exact documented coarse owners may
yield to a complete measured replacement; no invented roof forms or broad
district regeneration. New ordinary details must follow bounded packet lifetime.

### Step 10 — v234 clarified Steglitz-Zehlendorf house refinement

The owner clarifies that “Wuhledorf” means Steglitz and Zehlendorf. Extend the
existing v233 house treatment to already modeled coverage in the complete
Steglitz-Zehlendorf district, selected by its eight official Ortsteil rings.
Preserve every existing v233 roof, entrance and curb and all earlier detail.
Reuse the same source-bound packet preparation, full drawn mobile quality,
independent native representation and unchanged residency limits. No new city
coverage or invented roof/entrance position is implied by this clarification.

### Step 10 — v235 complete Kurfürstendamm and Tauentzien street fronts

The owner requests better architecture and streetscape along the complete
Kurfürstendamm from Breitscheidplatz to Rathenauplatz and Tauentzienstraße to
Wittenbergplatz, inside existing coverage. Preserve measured roofs, earlier
street surfaces, mapped trees, all authored landmark details and the 93-stop
tour. Add source-bound facade and street recognition only where supported;
unsurveyed window subdivisions and fitting dimensions remain display estimates.
Keep full drawn mobile detail, separate orthogonal native geometry and existing
packet/residency limits. Additions follow the existing cancellable tile lifetime.
No district expansion or replacement of unrelated source geometry is implied.

### Step 10 — v236 complete BER airport

The owner explicitly requests the complete BER airport. Refine the retained
airport footprint and exact mapped terminal/landside access owners in Brandenburg,
including terminals, piers, tower, airport buildings, runways, taxiways and aprons.
This authorizes the finite airport site, not surrounding district development.
Keep original source courses and v200/v205 detail, the 93-stop tour, all six modes,
full drawn mobile quality and independent orthogonal native construction.
Add new geometry through the existing bounded city packets and unchanged live
residency limits. Unmapped heights, widths and facade subdivisions remain explicit
display estimates; do not confuse future masterplan buildings with current ones.

The user's v236 accuracy request also authorizes one source-bound correction: subtract the two mapped elevated T2 connector footprints from the older coarse Nordpier roof cap. Keep the immutable v205 source JSON; apply an audited offline-derived roof replacement only to that exact owner in both drawn and native rendering, so no spurious roof floats over the lower bridges. All other existing caps and details remain.


### Step 10 — v237 Hansaviertel, Moabit and Tiergarten architecture

The owner requests the existing Hansaviertel including Hansabibliothek, the
identified school/fuel-station/high-rise surroundings, Kleiner Tiergarten in
Moabit with its real lower accesses, Rathaus Tiergarten, downstream Spree
waterfront houses near Bellevue, and the Tiergarten embassy quarter around
the CDU headquarters and Saudi Arabian embassy. This is bounded architectural
and public-space refinement inside existing coverage, not a new district.
Resolve ambiguous spoken places against primary sources before assigning them.
Preserve complete LoD2/OSM source geometry, all previous authored details, the
93-stop tour, six modes, full drawn mobile quality and independent orthogonal
native geometry. Exact erroneous owner corrections require complete source
receipts; unmeasured facade/fitting dimensions remain documented estimates.
Use existing cancellable packet lifetime and unchanged live residency limits.

### Step 10 — v238 elevated U-Bahn and music venues

The owner requests source-bound refinement of the U2 elevated railway and real
tunnel ramp at Eberswalder Straße, Bülowstraße and the two levels at Gleisdreieck,
the elevated approach and station at Kottbusser Tor, and Huxleys Neue Welt and
Columbiahalle. The trailing spoken “Hermann” is provisionally Hermannplatz;
keep this bounded to its mapped station entrances and existing square. Preserve
all earlier sources, coverage, six modes, seven starts and 93 tour stops. Correct
only exactly identified erroneous proxies with immutable source receipts and
complete replacement geometry. Track heights not surveyed in the source remain
explicit estimates; source-plan tracks, roof envelopes, open undercrofts and
walkable street clearances must agree. Keep independent native construction,
complete drawn mobile detail and existing byte/residency/prefetch limits.

### Step 10 — v239 Schlossplatz, Nikolaiviertel and northern Mitte fronts

The owner requests Staatsratsgebäude with the transplanted Liebknecht portal,
the nearby Hochschule für Musik Hanns Eisler in Neuer Marstall, Nikolaiviertel
with Nikolaikirche, and Altes Stadthaus. They also request street-facing houses
along Torstraße, Choriner Straße, Zehdenicker Straße, Linienstraße, Koppenplatz,
Fehrbelliner Straße and Veteranenstraße, around Gipsdreieck and Monbijoupark,
including the Delivery Hero/Oranienburger corridor, Google at Tucholskystraße 2
and Leo-Baeck-Haus at Tucholskystraße 9. Interpret the spoken Corinna/Zedernicker
as Choriner/Zehdenicker and Oranienstraße here as Oranienburger Straße.
Keep every retained source and earlier authored detail except exactly receipted
erroneous proxies with complete replacements. No new city coverage, invented
roof form or runtime residency increase. Ground, court holes and walking solids
must agree; source-unmeasured facade fittings remain explicit approximations.

### Step 10 — v240 Staatsoper Unter den Linden and Hotel de Rome

The owner requests more faithful architecture at these two existing central
sites only. Preserve the complete measured envelopes, roof hierarchy and open
hotel court, all neighbouring Bebelplatz models and all unrelated city detail.
Use primary architectural accounts and credited reference-only photographs for
recognition; unsurveyed fitting dimensions remain explicit display estimates.
Any superseded inaccurate decoration requires exact ownership evidence and a
complete replacement. Keep full drawn mobile detail, independent orthogonal
native geometry, cancellable construction and unchanged live memory limits.


### Step 10 — v241 Staatsbibliothek Unter den Linden and Quartier 207

The owner requests more faithful architecture at the renovated Staatsbibliothek
Unter den Linden and the former Galeries Lafayette / Quartier 207 at
Friedrichstraße. These are distinct from the Alte Bibliothek at Bebelplatz and
Quartier 206. Preserve measured envelopes, roof/court structure, unrelated
buildings and previous detail except precisely receipted inaccurate estimates.
Current renovation plans are not evidence of completed future architecture.
Use source-supported recognition, label unsurveyed fitting dimensions, retain
full drawn mobile detail, independent native geometry and unchanged live limits.

The same v241 request additionally includes buildings around the IHZ on
Friedrichstraße, including the former ZEIT office, and the distinct Merantix
ENTER, Phorms Ackerstraße and Deutsche Welle Voltastraße buildings at the AEG
Humboldthain campus. Verify actual addresses and source owners; do not confuse
modern ENTER with the historic red-brick works or label former occupants as
current tenants. Correct only bounded evidenced proxy geometry, preserving
all unrelated source owners and runtime budgets.

### Step 10 — v242 Spree bridge decks and public edges

The owner requests recognisable Spree bridge bodies, railings, road lanes and
kerbs throughout existing city coverage. Use exact mapped bridge rings and
associated road/footway identities; distinguish rail-only and construction
crossings. Preserve all measured source sheets and previously authored bridge
ornament. Only exactly receipted generic bridge estimates may yield to complete
source-bound replacements, with matching walking support and open approaches.
Unsourced railing sections, kerb dimensions and road paint remain labelled
display estimates. Keep full drawn mobile detail, independent orthogonal native
geometry, all tour stops and existing bounded packet/residency lifetimes.

### Step 10 — v243 continued Spree bridge refinement

The owner asks to continue v242. This bounded follow-up refines exactly the
existing generic owners of Mitte’s Schloßbrücke, Eiserne Brücke and
Schleusenbrücke using complete retained bridge rings and associated transport
ways. Do not confuse Schloßbrücke Mitte with Charlottenburg’s v242 crossing.
Preserve all v242 geometry and receipts, both Monbijou arms, all unrelated
city data and budgets. Both required families must decode before an exact
generic owner yields, and walking surfaces/barriers must match the new models.
Unsourced small dimensions remain explicit estimates; no outer packet or
city-coverage expansion belongs to this quick continuation.

### Step 10 — v244 Torstraße and Danziger Straße street fronts

The owner asks to continue with the buildings along Torstraße and Danziger
Straße. Refine their existing source-bound street fronts, retaining complete
measured envelopes, roofs, earlier authored details and mapped public space.
Existing verified openings take priority over new illustrative subdivisions;
ordinary facade fittings must not overwrite dedicated modern or historic owners.
Both drawn mobile and desktop keep full detail, with independent orthogonal
native geometry and unchanged live residency, transfer and prefetch budgets.
Only the finite static descriptor inventory and measured offline-package
allowance may grow for these named streets. No new coverage or tour stop.
Record unsurveyed glazing, material tones and fitting sizes as display estimates.

### Step 10 — v245 distinctive Torstraße and Danziger fronts

The owner asks to continue the two named streets. This small follow-up fills
the specifically evidenced Torstraße 138 and Danziger Straße 57 / Senefelder
Straße 35 facade gaps. Preserve every prior chunk, full measured envelope,
roof, courtyard, navigation solid and earlier street detail. Use reference-only
photographs and primary heritage identity for architectural recognition;
unsurveyed small dimensions remain estimates. Add bounded companions in both
independent families within the existing static and live limits, with no new
coverage, tour stop, texture or per-frame work.


### Step 10 — v246 Kulturforum and civic architecture

The owner requests Gemäldegalerie/Piazzetta, Nordic embassies, KAS headquarters,
party buildings, Robert Koch statue and Steglitz refinement. Preserve existing
complete sources and roofs; correct only the evidenced old Piazzetta owner and
its exact native receipt, together with matching walking heights. Keep the
Rosa-Luxemburg-Stiftung at its actual Ostbahnhof address, distinct from the
Karl-Liebknecht-Haus. Recognition fittings remain explicitly approximate.
Retain all live budgets, full mobile detail, independent orthogonal native
geometry, source credits and existing city coverage. No new descriptors.


### Step 10 — v247 Steglitz public-space continuation

The owner asks to continue v246. Complete bounded, source-supported street
connections around Rathaus Steglitz/Albrechtstraße and refine Hermann-Ehlers-Platz
within existing coverage. Preserve the complete school, Rathaus, Spiegelwand,
Kreisel and prior Schloßstraße sources and authored detail. Use mapped public
space rings, road/lane tags and actual curb courses; never infer crossings,
memorial inscriptions or unbuilt street redesigns. Small fitting dimensions
remain documented estimates. Keep full drawn mobile detail, independent
orthogonal native geometry, existing batches and unchanged live limits. No new
district coverage, streaming descriptor, texture, tour stop or animation loop.

### Step 10 — v248 Hermann-Ehlers-Platz fountain and Albrechtstraße 131

The owner's continuation permits the existing mapped fountain and the evidenced
plaza-facing facade of Albrechtstraße 131, within the retained Steglitz coverage.
Preserve the exact fountain ring and square openings; record conflicts between
mapped dimensions and catalogue measurements rather than enlarging the footprint.
Retain the complete building shell and every earlier packet/detail. Window
subdivisions, small fittings and unmeasured heights remain display estimates.
Fountain collision must follow actual represented solids independently in drawn
and native modes, without blocking the entire basin or lifting nearby ground.
Reuse existing batches and unchanged total byte limits, with identical drawn
mobile detail. No new descriptor, coverage, texture, tour stop or frame loop.

### Step 10 — v249 running stability and ordinary streets

The owner requests continued running stability without quality loss and source-
supported curbs, junction markings, actual zebra crossings, tram rails/stops and
one illustrative tram throughout existing coverage. Keep all older sources,
geometry, detail, tour stops, mode behavior and existing live memory budgets.
Add only verified gaps to current streamed road packets; small widths and fittings
without measured evidence remain explicit display estimates. Danziger railheads
follow retained tracks, with two Husemannstraße platforms and a static tram in
the existing northern batch. Native construction remains independently orthogonal.
No new district, descriptor or animation loop. Recovery deadlines must respect
page suspension; GPU savings may retire only redundant/offscreen storage or
provably invisible draws, never visible detail.

### Step 10 — v250 schools and Choriner courtyards

The owner requests the Choriner Höfe, the distinct evidenced Zehdenicker Straße
new building near Weinbergspark, John-Lennon-Gymnasium and Gymnasium Steglitz
including its actual courtyard sports hall. Use the owner's Heesestraße photos
as reference only. Replace only specifically identified inaccurate authored
facade estimates, with exact-owner receipts and complete replacement details;
retain every measured building part, roof and courtyard. Document unmeasured
small dimensions as display estimates. Keep full drawn mobile detail,
independently orthogonal native construction, existing city coverage and live
memory budgets. No new streaming descriptor, tour stop, texture or animation.

### Step 10 — v251 Gymnasium Steglitz courtyard photographs

The owner's additional five courtyard views permit bounded refinement of the
rear Aula facade and clock gable, the modern five-storey school wing and the
red sports court with its visible markings and furnishings. Preserve all
measured source parts, roofs, courtyard openings and the v250 street front and
gym. Photographs are reference-only; unmeasured small dimensions remain explicit
display estimates. Supersede only exactly receipted inaccurate authored details.
Reuse the existing school batch, full drawn mobile detail, independent orthogonal
native construction and unchanged live budgets. No new coverage or tour stop.

### Step 10 — v252 Gipsdreieck, Koppenplatz, Kulturbrauerei and Hauptbahnhof

The owner requests the Kastanienbaum-Grundschule, Gipsdreieck and Milchhalle,
Koppenplatz with its school, and the existing Kulturbrauerei/Oderberger Straße,
Eberswalder Straße and Sredzkistraße context. Hauptbahnhof receives source-
supported road-edge/marking refinements and clearer interior stair connections.
Retain all measured source envelopes, roofs, open courts, existing station
levels and navigation clearance. Only exactly receipted incorrect authored
details may yield. Identify actual streets, entrances and crossings from the
retained sources; unmeasured fittings remain explicit display estimates.
Keep full drawn mobile detail, independent orthogonal native construction,
existing batch delivery and unchanged live memory limits. No new city coverage,
tour stop, texture or animation loop is included.

The v252 station interior correction additionally gives the already modelled
atrium openings precedence over exactly receipted coarse drawn-ground cells.
Keep their full outside complements, original height/paint, source payload,
bridge/service landings and navigation; native ground remains unchanged.

### Step 10 — v253 one illustrative BVG bus

The owner requests one BVG bus. Add a stationary recognition model at a retained
mapped stop inside existing coverage, sharing existing drawn/native batches,
materials and disposal. Keep all existing vehicles, geometry and live budgets.
Vehicle dimensions are illustrative estimates; no timetable or live-service
claim, new animation loop, texture, tour stop or descriptor is intended.

### Step 10 — v254 six main streets and ordinary outer houses

The owner requests shopfront, curb and traffic-signal refinement along
Kastanienallee, Torstraße, Danziger Straße, Kurfürstendamm, Tauentzienstraße
and Kantstraße, plus more individual ordinary outer houses. Use retained
source identities, mapped commercial use, delivered street surfaces and
explicit material evidence. Preserve all previous source geometry and authored
detail. Unknown fitting dimensions and centreline-to-verge signal offsets are
display estimates, not surveyed pole positions. Keep full drawn mobile detail,
independent orthogonal native construction, existing packet/batch lifetimes,
coverage, 93 tour stops and all live residency/decode/prefetch budgets.

### Step 10 — v255 twenty large playgrounds, Zoo and Tierpark

The owner requests Berlin's twenty largest playgrounds plus Bellevue,
Helmholtzplatz, the previously requested Gipsdreieck (provisional interpretation
of “Kiezdreieck”), Weinbergspark and Zoo West's adventure playground, together
with recognisable Zoo Berlin and Tierpark Friedrichsfelde architecture and
green areas. Rank the complete official GRIS playground inventory by its stated
cadastral gross area, distinguishing that from net playable area. New coverage
is limited to the selected exact site footprints, with finite source-bound
streaming descriptors where necessary, never surrounding district fill.
Retain previous ground, equipment, buildings, gardens, paths and terrain;
keep small unmeasured equipment and decorative dimensions labelled estimates.
Keep full drawn mobile detail, independently orthogonal native geometry and
all existing live geometry, packet transfer and prefetch limits. The finite
catalogue may grow to 2,208 descriptors and 2.125 MiB for these exact new sites;
this changes no resident geometry allowance. No new tour stop,
photographic texture, animation loop or quality reduction is authorised.

### Step 10 — v256 Nilpferdhaus and Reichstag public realm

The owner requests the existing Zoo Berlin hippopotamus house, Reichstag
surroundings, mapped Forum fountains, unity flag, existing visitor area and
the Sinti and Roma memorial. Preserve source envelopes, terrain, trees,
all previous architecture, paths and live budgets. Identify the existing
hippo house separately from the new rhino pagoda and planned BIZ. Replace
only precisely receipted erroneous memorial decoration, preserving its
protected walking behavior. Small fittings remain documented estimates.
Keep full drawn mobile detail and independent orthogonal native additions;
reuse existing batches without new coverage, descriptors or tour stops.

### Step 10 — v257 Littenstraße, Alexanderplatz and Leipziger Straße

The owner requests the surviving Littenstraße courthouse and Zur letzten
Instanz, street context behind Rotes Rathaus, CUBIX and the Rathausstraße
commercial/housing row, Fernsehturm base, Alte Münze and the Leipziger Straße
fronts up to the finance ministry. Identify the actual current building owners
and distinguish the surviving court from its demolished wings/towers. Preserve
complete measured geometry, roofs, courts, earlier detail and all live budgets.
Replace only specifically evidenced erroneous authored estimates with exact
receipts. Small unsurveyed facade and shop fittings remain labelled estimates;
current tenants require public source verification. Reuse existing batches,
full drawn mobile detail and independent orthogonal native geometry. No new
district coverage, tour stop, photographic texture or animation loop.

The owner's additional v257 request includes Columbiahalle's supplied facade
photographs and a silent, repeating illustrative concert interior, plus the
transport ministry at Invalidenpark and the Scharnhorststraße heating plant.
A bounded local concert animation is expressly authorised, with no audio and
no work while offscreen/hidden or after disposal. Use supplied media as evidence;
retain full mobile detail and independent native construction. Identify the
current plant chimney configuration from evidence and supersede only exactly
receipted obsolete authored parts. No unrelated coverage or live memory policy
changes are permitted.

### Step 10 — v258 additional Columbiahalle references

The owner's additional four photos and two videos refine only the existing
Columbiahalle facade/interior interpretation. Preserve the facade when the photos
repeat prior evidence. Additional silent recordings may be selected individually,
with one video element/decoder and no media prefetch. Preserve aspect ratios,
manual pause and hidden-view suspension. Interior fittings remain illustrative,
compact and independently drawn/native; retain all earlier source geometry,
city limits and 93 tour stops.

### Step 10 — v259 evidenced missing church and high-rise tops

The owner requests a citywide audit for truncated churches and taller buildings.
Correct only verified gaps inside existing coverage: Emmauskirche, Apostel-Paulus
and LUX/Narva tower. Preserve every prior packet, source envelope and navigation
solid; append compact streamed upper structures above the retained coarse bodies.
Use parish heights (74 m / 86 m) and the explicit mapped LUX height (63 m), keeping
unmeasured shafts, ornaments and storey subdivisions labelled display estimates.
Existing complete towers, including St Thomas, remain untouched. Full mobile
quality, independent orthogonal native construction, 93 tour stops and all live
residency/transfer limits stay unchanged. Three companions fit the existing
2,208-descriptor and 2.125 MiB catalogue limits. No additional coverage, textures,
animations or blanket height inflation is included.

### Step 10 — v260 City West theatres and Karl-Marx-Allee cinemas

The owner requests Ludwig-Erhard-Haus, Renaissance-Theater, the nearby old
cinema (identified as Delphi Filmpalast), Zoo Palast, Kino International and
Café Moskau. Refine these six exact sites within existing coverage, preserving
complete measured source envelopes, earlier details and navigation. Retain
source provenance and distinguish photographic recognition estimates from
surveyed dimensions. Exact coarse proxies may yield only to complete source
owners with immutable preservation receipts. Keep full mobile detail and
independent orthogonal native geometry, all live budgets and 93 tour stops.
No unrelated coverage, new textures or animations are included. Any necessary
finite archive allowance must be measured and documented independently of live
residency; prefer compact source-bound additions and existing streaming.

The owner's v260 follow-up withdraws all Columbiahalle video recordings from
the viewer and GitHub. The current product must contain no recording player,
decoder or media download: use a compact silent procedural stage/light loop
with hidden/offscreen suspension and explicit pause. Refine the entrance's
blue outline lettering and cream/red Sisters of Mercy programme board against
the supplied photograph. Historical repository/release cleanup is separately
scoped with the owner because it affects old tags and published downloads.

### Step 10 — v261 Adlershof, Kühn, Tempelhof, station entrances and Charité

The owner requests more accurate Adlershof technical monuments, the exact Kühn
smithy in Bohnsdorf, Tempelhof main entrance and Luftbrückendenkmal, mapped U6
Naturkundemuseum and Brandenburger Tor entrances, and Charité railway facades.
Preserve complete prior source owners and unrelated packets. Only exact receipted
coarse Adlershof owners may yield to their full measured replacements. New coverage
is limited to the named Kühn workshop parcel, with one bounded streamed packet
pair. Retain all live residency/decode limits, 93 tour stops and full mobile detail;
native additions remain independently orthogonal. Small unmeasured fittings are
display estimates. Stair apertures must retain surrounding pavement and accessible
walking return paths. The user explicitly prohibits external Safari and external
browser test processes on this Mac; use only the app's internal browser for UI QA.

### Step 10 — v262 outer-house appearance and EUREF campus

The owner requests a further appearance pass on existing outer-district houses
and source-bound refinement of the EUREF campus at the Schöneberg Gasometer.
Replace only generic fallback paint with restrained varied facade/roof tones;
retain explicit material evidence and individually authored colours. Preserve
all existing source geometry, roofs, details, mapped positions and open spaces.
Additional ordinary-house windows may be fitted only to verified complete
untreated street-facing walls in a bounded set of existing packets. Their layout
is illustrative; mapped entrances and measured roofs must not be invented.
Additional exact LoD2 roof replacements require full source-preservation receipts
and must leave the earlier v233 recipes intact.
Campus refinements must follow verified current site identities and complete
measured owners, with exact preservation receipts for any coarse-owner transfer.
Unsurveyed facade fittings remain display estimates. Keep independent native
geometry, full mobile detail, the 93-place tour and every live residency/decode
limit. No unrelated coverage, new animation or photographic texture is implied.

### Step 10 — v263 remaining generic house clusters

The owner requests more realistic and individually coloured existing generic
house clusters throughout the current city coverage. Prefer retained explicit
facade/roof colours and materials with exact owner receipts, preserving earlier
authored detail and source geometry. Additional windows may occupy only verified
complete street-facing ordinary walls, with unsurveyed subdivisions labelled
display estimates. Keep the restrained v262 unknown-material palette, all prior
roof/detail transactions, full mobile quality, independent native geometry,
93 tour stops and every live packet/residency limit. No invented building-specific
colour claim, unrelated coverage, source simplification or external browser.

### Step 10 — v264 Prenzlauer Berg landmarks, embassies and allotments

The owner requests more accurate Wasserturm, Rykestraße synagogue and Zeiss-
Großplanetarium, British/US/French embassies with their correct flags, and the
existing Berlin allotments. Preserve complete measured owners and earlier details.
Only the two exact receipted planetarium owners DEBE03YY6000044a and
DEBE00YYMM000010 may yield to their reconstructed silver 30-m dome and low foyer.
Keep all 436 original LoD2 sheets immutable as evidence, preserving measured XZ
footprints. The coarse source roof conflicts with the official exterior: dome and
foyer vertical dimensions are documented photo-based estimates. Construct the
replacement before source retirement, retaining packet receipts and matching
walking surfaces. Replace only specifically evidenced wrong
embassy forms/flags, retaining the remaining facades. Garden cultivation accents
must stay inside mapped allotments and delivered ground, clear of water, buildings
and paths; these are illustrative planting groups, not surveyed cadastral parcels.
Keep full mobile quality, independent orthogonal native construction, 93 tour stops
and every live residency/decode/prefetch budget. No new coverage or photographic
texture; unsurveyed fittings remain documented estimates. Internal browser QA only.

### Step 10 — v265 Charité historic campus and Scheunenviertel

The owner requests the old Charité virology and museum buildings by the
Humboldthafen, the elevated old/new campus connections, and more accurate
Scheunenviertel streetside buildings. Identify bridge owners and clearances
against the retained complete source and public campus evidence. Correct only
precisely receipted earlier authored facade/bridge estimates; retain all original
source sheets, unrelated roofs, navigation and detail. Do not infer an RKI
Nordufer expansion from the spoken harbour name. Scheunenviertel additions stay
within its existing v168 footprint, fitting mapped entrances and measured wall
edges rather than inventing doors or repeating existing window grids. Keep full
mobile detail, independent orthogonal native construction, the 93-place tour
and every live residency/decode/prefetch limit. Small unsurveyed fittings remain
explicit display estimates. No new coverage or textures; internal browser QA only.

For the evidenced elevated crossings, the three exact coarse parts EWePLFPr
(Luisenstraße) and gQwBfdam/4gyC0jjm (Hufelandweg 3) may yield to open-underneath
models and matching walking volumes. Retain their original source sheets and
exact source/native-column receipts. Clearance and fitting dimensions that are
not surveyed must remain labelled estimates. The separate eastern L2e097lj
connector and every unrelated owner remain unchanged.

The same exact Hufeland parts in the older Alt-Mitte packets must also yield.
Native merged triangles require a fingerprinted transfer of their four-part
parent family; republish the two unrelated parts completely with the identical
original native construction, while replacing only the two bridge volumes.
Retain all four original source sheets and the exact triangle/line receipts.

### Step 10 — v266 Tempodrom, Anhalter Bahnhof and east/west streets

The owner requests a more accurate Tempodrom and surviving Anhalter Bahnhof
portal, the named Potsdamer Platz buildings west of Tilla-Durieux-Park including
the former Daimler/debis ensemble and its green-cube ventilation tower, and
existing Ostkreuz, Boxhagener Platz and Friedrichshain context. Resolve company
names against actual building identities and public architectural evidence.
Preserve complete measured owners, all earlier details and source provenance;
only precisely receipted inaccurate proxies may yield to complete required
replacements. Streamed ordinary fittings follow mapped entrances and measured
wall/roof edges. Unsurveyed subdivisions and recognition dimensions remain
explicit display estimates. Keep full mobile detail, independent orthogonal
native construction, 93 tour stops and every live residency/decode/prefetch
limit. No unrelated coverage, textures or animation; internal browser QA only.

The same v266 turn additionally requests Dorotheenstädtischer Friedhof, Brecht-Haus,
Hannoversche Straße and the former Ständige Vertretung, the HU/Mensa quarter south
of Naturkundemuseum, plus the Mauerpark/Nordbahnhof context, MYJUMP, DB offices
and Ernst Busch theatre sites. Verify distinct addresses before modelling. Preserve
existing complete owners, grave/park paths and all earlier details; additions remain
bounded, source-bound, static and texture-free within existing coverage. Unsurveyed
facade fittings and grave markers are illustrative, never measured or named graves.
All source-retention, native geometry, mobile quality and runtime limits above apply.

### Step 10 — v267 Schlesisches Tor and Kreuzberg streets

The owner requests more accurate Schlesisches Tor station, Görlitzer Park
surroundings, Wiener Straße including Feuerwache Kreuzberg, and Oranienstraße.
Identify station and fire-station owners against retained complete sources and
public architectural evidence. Preserve all earlier v167/v185/v188 street fronts,
park paths and furniture; fit new details into evidenced gaps without duplicating
window grids or obscuring mapped entrances. Only documented exact inaccurate
proxies may yield to complete replacement owners with preservation receipts.
Keep independent orthogonal native construction, full mobile detail, 93 tour
stops and every live residency/decode/prefetch limit. No new coverage, texture
or animation. Unsurveyed facade subdivisions remain explicit display estimates.
The spoken “Dominikanerstraße” is unresolved and must not be silently replaced
by a different address. Internal-browser QA only.

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

### Step 10 — v268 Köpenicker Straße and power-station context

The owner explicitly corrects the unresolved “Dominikanerstraße” to Köpenicker
Straße in Kreuzberg and requests the power station there. Refine the existing
street fronts, former Kraftwerk Berlin hall and distinct active Heizkraftwerk
Mitte against their exact source owners and primary public references. The
historic Heeresbäckerei is a named architectural companion on this street.
Precisely receipted inaccurate coarse owners may yield atomically to their
complete measured parts, retaining all original source sheets and matching
navigation. Earlier unrelated detail and source geometry remain intact.
Preserve full mobile quality, independent orthogonal native construction,
93 tour stops and all live residency/decode/prefetch limits. No unrelated
coverage, photographic textures or animation. Unmeasured fittings are explicit
display estimates. Internal-browser QA only; never launch external Safari.

### Step 10 — v269 Moabit and Mierendorffplatz

The owner requests all Moabit and the Mierendorffplatz surroundings. Audit the
official Moabit boundary and its distinct neighbourhoods, including existing core
houses rather than only outer streamed fronts. Preserve measured footprints,
roofs, source colours and previous window grids; add bounded missing fittings to
exact public street-facing owners. Mierendorffplatz is a separate Charlottenburg
site: retain its earlier streetscape and verify mapped fountain and U-Bahn exits.
Open stairwells require exact ground transfers, complete outside complements and
matching local walking floors. The two confirmed 14-m church fallbacks, Sankt
Paulus and Heilandskirche, may yield only to complete retained measured parts and
evidenced tower/roof forms, with original source receipts and matching navigation.
Unsurveyed fittings remain display estimates. Keep full mobile quality,
independent orthogonal native geometry, 93 tour stops and all residency, decode
and prefetch budgets. Audited immutable construction data may be compressed
losslessly without altering any geometry. No new coverage or photo textures;
internal browser QA only, never external Safari.

### Step 10 — v270 Tacheles photographic sightlines

The owner's ten photographs request a faithful view from Tacheles over
Oranienburger Straße and its Auguststraße junction, including the photographed
historic fronts, red rounded corner, Bring Them Home mural and church skyline.
Use these photographs as reference only, with complete retained official building
parts and exact public source identities. Correct only precisely receipted
inaccurate fallback owners or authored details, retaining complete original
evidence and unrelated sources. The mural is a compact independently authored
procedural interpretation at its verified Auguststraße 92 gable; no photographic
pixels or texture is bundled. Distinguish Sophienkirche, Golgathakirche and
Zionskirche along their actual sightlines. Unsurveyed small details remain
documented estimates. Keep existing full mobile quality, separate orthogonal
native geometry, all 93 tour stops, coverage and runtime memory limits.
Internal-browser visual QA only; no external Safari or browser process.

The finite v270 eager-field encoding audit may compress source literals only;
preserve eager evaluation, strong ownership, ordinary data descriptors and
per-field tree shaking. Existing lazy/weak fields retain their contracts.
Keep the initial landmark catalogue outside this encoding to avoid pulling
the Three.js decoder into the startup graph. Retain both preceding live asset
closures and the unchanged Pages/package ceilings; never trade detail for size.

### Step 10 — v271 northern grey-house correction

The owner's viewer screenshots identify monotonous ordinary houses around
Weinbergspark, Zionskirchplatz, Kastanienallee and Kollwitzplatz. The owner confirmed
that the dictated “Altonaer Platz” means nearby Arkonaplatz. Correct
the distinct measured v169 and legacy v166/v168 source layers plus the separate
Kollwitz primary packets, including the source-bound northern Kastanienallee
corridor to Eberswalder Straße. Preserve complete source geometry, individual authored
facades, mapped colour/material evidence, all earlier windows and linework.
Only exact immutable source-bound existing colour cells may change. Unknown
wall and roof colours are restrained contextual display estimates, not claimed
photographic surveys. Keep independent native proofs, full mobile quality,
93 stops and every existing residency/decode/prefetch limit. No new geometry,
texture, per-frame work or coverage. Compare identical before/after views in
the internal browser only. New colour receipts may use the established weak
construction-field encoding with a separate eager packet-key rejection index.

### Step 10 — v272 theatres, Technikmuseum and newspaper buildings

The owner requests HAU1/2/3, GRIPS, the complete Technikmuseum outdoor and rail
heritage ensemble, Axel-Springer tower, old and current taz houses and Peter
Lenk's wall sculpture, Friedrichstraße/Kochstraße, and Alexanderplatz north with
the publisher's rotating crown. Resolve exact retained official owners and
replace only receipted coarse proxies, retaining complete original evidence.
Keep each venue at its actual address; distinguish the current BERLINER VERLAG
rotating crown from the requested historic BERLINER ZEITUNG lettering.
Use primary operator/architect/heritage references; unsurveyed fine details are
explicit estimates. All source parts, roofs, courtyards, full mobile detail,
independent orthogonal native geometry, 93 stops and runtime budgets remain.
Animation uses the existing shared loop with offscreen/hidden/reduced-motion
and disposal guards. No raw media or textures. Internal-browser QA only.

### Step 10 — v273 citywide existing grey-house audit

The owner requests the same missed-colour-layer diagnosis throughout all retained
coverage, especially Moabit, Schöneberg, Steglitz, Kreuzberg and Friedrichshain.
Audit every existing primary packet and the older city-front, Alt-Mitte and core
building paths. Replace only proved fallback paint or obsolete rendered-image
samples on positively identified ordinary core/legacy housing; preserve mapped
materials, named/authored models, earlier v271 refinements and all source geometry.
Unknown house paint remains a restrained contextual estimate, never a surveyed
per-address claim. This request supersedes the earlier fixed fallback swatches
where they still read as uniform grey. Roof and wall palettes may vary independently.
Exact original source, topology and navigation receipts must guard shared corners;
true ambiguity stays unchanged. Keep source packets byte-identical, independent
native geometry, every previous detail, full mobile quality, all 93 stops and
existing residency/decode budgets. No new coverage, animation or external browser.

The follow-up additionally requests consistent photograph-based windows on all
remaining Gymnasium Steglitz historic wings. Replace only the exact old generic
window fittings and corresponding old facade cells proved to belong to those
untreated historic faces. Keep the modern extension's independent window bands,
measured school envelopes, courtyard gym, v250/v251 Aula and courtyard details.
The supplied Heesestraße/courtyard photographs govern proportions and decorative
style; unseen openings remain reference-based estimates, not measured surveys.

The finite v273 colour receipts may use the existing Base85 lossless source
encoding. The hot core owner map must retain eager strong ownership and ordinary
data descriptors; construction-only shard fields retain their weak lifetime.
Keep the existing extracted-package and Pages ceilings without dropping detail.

### Step 10 — v274 named schools, theatres and northern Mitte architecture

The owner requests another source-supported architectural pass at Gymnasium
Tiergarten, GRIPS, Deutsches Theater, Berliner Ensemble, Kastanienbaum school,
the identified Fürstenberger Straße nursery near Arkonaplatz, Be Smart Academy,
Berlin Metropolitan School, Herz-Jesu at Fehrbelliner Straße, John-Lennon school,
Choriner Höfe, Grober Unfug Torstraße, Schönhauser Tor, Suhrkamp headquarters,
Volksbühne and its immediate surroundings, Schiller-Theater, all three opera
houses, Heinrich-Böll-Stiftung, Friedrichstadt-Palast and the existing Neue
Synagoge/Auguststraße/Linienstraße context. Identify distinct actual sites and
current buildings against operator, architectural and retained measured sources;
do not substitute proposed redevelopment or temporary venues. Preserve all
source envelopes, previous details, roof/court openings and navigation. Replace
only exactly evidenced wrong authored estimates with receipted complete models.
Bühnenhaus height and silhouette must be represented where source-supported;
unmeasured recognition fittings remain explicit estimates. Keep full mobile
detail, independently orthogonal native geometry, 93 stops and every existing
residency/decode/prefetch limit. No new city coverage, textures, animation or
external browser. The owner clarified Volksbühne 'Theaterbuchmacher' as its
stage tower and stage roof structures, not a bookshop. Use the existing batches
and bounded lifetimes.

The finite v274 build-only stronger Gzip encoding must preserve exact JSON
(including negative zero), the original zlib admission decision, all existing
codecs and eager/strong/weak field contracts. Bind candidates to exact source
field hashes; keep the compressor outside the runtime and startup graphs.
Retain both preceding public asset closures and all existing release ceilings.

### Step 10 — v275 Großer Tiergarten maintenance compound

The owner's screenshot identifies the Werkhof at Straße des 17. Juni 31,
OSM way118034165, rather than an office complex. Correct its exact twenty
retained source owners using the complete original LoD2 sheets, mapped use and
storeys, official orthophoto and independent height evidence where available.
Several official source heights conflict with garage/canopy use; retain those
original sheets as evidence and clearly distinguish corrected display estimates
from measurements. Do not flatten the actual house or other evidenced roofs.
Replace inappropriate glass semantics and only exactly receipted old prisms and
native columns, with complete replacements and matching walking surfaces.
Keep open service yards, paths, water and existing trees. Additional illustrative
shrubs must fit the mapped compound and cannot conceal uncorrected high proxies.
Keep full mobile detail, independent orthogonal native construction, all prior
city sources, 93 stops and unchanged residency/decode/prefetch limits. No new
coverage, texture, animation or external browser.

### Step 10 — v276 road joints, Verkehrskanzel and both zoos

The owner requests more natural curbs and road alignment throughout retained
coverage, particularly Mitte, Friedrichshain-Kreuzberg, Steglitz-Zehlendorf and
Charlottenburg. Audit the shared paths; correct proven join defects without
moving original source nodes, true sharp corners, junction openings or existing
markings. Any bounded outer-road corrections require exact old/new surface and
navigation receipts; do not claim untouched districts as newly reconstructed.
Add the historic Verkehrskanzel at Joachimsthaler Straße/Kurfürstendamm using
mapped position and heritage references. Retain complete measured bodies;
unmeasured small fittings remain explicitly estimated. At Zoo and Tierpark,
retain all earlier houses, high aviaries, restaurants, grounds and details while
adding source-supported enclosures and visible, static animals. Verify present
species rather than silently depicting historical stock as current. Operator
maps/photos establish identity and appearance only, never metric tracing or
bundled textures. Any restaurant proxy retirement is finite, source-receipted,
complete and paired with navigation. Exact merging of adjacent same-colour
native boxes may save memory only with proven identical occupied volume and
colour, without raster coarsening. Keep full mobile detail, orthogonal native
geometry, 93 stops, previous source data and all existing runtime/release limits.
No new coverage, animation, raw media or external browser.

### Step 10 — v277 Nordufer, Moabit power station, Lehrter Straße and Bayer

The owner requests the Robert Koch-Institut at Nordufer, the opposite Moabit
power station and its adjacent modern working campus, the Lehrter Straße
streetscape including its police buildings and Kulturfabrik with Filmrauschpalast
and Slaughterhouse, and the retained Bayer/former Schering works. Identify each
actual present site with operator, heritage and retained mapped/measured sources.
Separate existing construction from proposed redevelopment; do not invent the
proposed RKI high-rise or future office projects. Preserve every complete source
envelope, earlier facade and roof detail, original road nodes, open yards and
navigation. Replace only exactly evidenced wrong authored elements or generic
owners with complete source-receipted replacements and matching walking geometry.
Small unmeasured recognition details must be explicitly identified as estimates.
Keep independent orthogonal native construction, full mobile detail, existing
resident/decode/prefetch limits and the 93-place tour. No new coverage, animation,
raw media or external browser. Use public exterior architecture only.


### Step 10 — v278 bounded continuation: repeated curb nodes and native wolf

The owner's continuation permits correction of two proved defects in existing
v276 presentation. Repeated consecutive street points must share the same
cross-section from their nearest distinct neighbours, including closed seams;
keep all original points, true corners, mesh/index counts and heights. Native
Zoo wolves retain every component in connected independent orthogonal poses;
drawn animal bytes remain unchanged. No new source coverage, descriptor,
animation, texture, tour stop or runtime/release budget is added. Unconfirmed
Tierpark roof profiles and Decks bridge undersides remain documented research
limits rather than inferred new geometry. Use only the internal browser for QA.

### Step 10 — v279 unobstructed Serra flight start

The owner approves correction of the reported Serra startup occlusion. Change
only the automatic flight approach azimuth, preserving the sculpture target,
camera elevation, distance and 16-degree lens. Keep the original explicit
39-degree approach, every other start, rotation/persistence/recovery priority,
all source geometry, full mobile detail and runtime/release limits. Verify the
two plates' sightlines against retained concert-hall geometry and inspect the
actual built city in the internal browser. No external browser or new coverage.

### Step 10 — v280 outer-city loading recovery

The owner reports slow or stalled outer-city construction near Reuter-West,
Eiswerder and Zitadelle Spandau. Audit actual regional packets and the shared
streaming lifecycle. Recover proved transport stalls without abandoning any
visible source geometry or lowering detail. Keep serial decoding/publication,
existing bounded prefetch and residency limits, source bytes, both independent
families and all 93 stops. Cancellation, hidden-page suspension and retries must
release blocked work safely, with no stale publication or repeated request storm.
Verify simulated stalls separately from ordinary local/browser timings. Use only
the internal browser; do not launch external Safari or another browser process.


### Step 10 — v281 Mitte, City West and transit detail

The owner requests the existing east/south-IHZ and Berliner Ensemble blocks,
Ganymed and the rear Kantine, ICC/Funkturm motorway, ZOB, Zoo forecourt,
Joachimsthaler Straße, Weltkugelbrunnen, tram rails and evidenced U-Bahn portals.
Keep all source sheets, genuine courtyards, routes and prior details. Only exactly
receipted obsolete fountain/platform-roof proxies may yield to complete bounded
replacements with corresponding navigation. Differentiate completed buildings
from current roadworks; unmeasured small fittings remain explicit estimates.
Keep full mobile quality, independent orthogonal native geometry, 93 stops, six
modes and unchanged runtime/package limits. No new geographic coverage is
authorized by this turn; the Reuter-West proposal remains pending. Use only the
internal browser and bounded source/build work on this nearly full disk.

The owner's 28 October continuation additionally permits bounded refinements of
Schlosspark Charlottenburg, the mapped waterside coal handling at Heizkraftwerk
Moabit, the Kanzleramt entrance lawns/fence and Chillida sculpture, the outer
enclosures of JVA Moabit and the Hohenschönhausen memorial, Topographie des
Terrors, the WELT balloon and the BMF/17 June 1953 memorial forecourt. Resolve
the ambiguous nearby triangular square before changing it. Preserve the open
Geschichtspark Lehrter Straße as a separate present-day memorial, all source
owners, public routes and existing runtime/release limits. Publicly documented
external recognition details only; dimensions lacking measurements are labelled
display estimates. Continue in the same unpublished v281 release.

The spoken “Pickingplatz” is resolved from the district's explicit triangular
green square/playground account and the nearby Deichgraf operator address as
Pekinger Platz at Nordufer (OSM way4751040). The interpretation was stated to
the owner while the optional clarification remained unanswered. Add only
bounded source-supported details there; preserve the distinct Sprengelpark,
existing park/playground/path rings and all prior ground geometry.

### Step 10 — v282 moving zoo animals in every presentation

The owner's continuation explicitly authorizes moving animals in Zoo Berlin
and Tierpark Berlin in every existing presentation, including Minecraft, night,
snow and underwater. Use one shared species/route identity across independent
drawn and orthogonal native models. Transfer precisely identified existing
animal members rather than duplicating them or changing unrelated architecture.
Keep full mapped enclosure boundaries, source buildings, water and navigation;
movement routes must include body clearance. Verify species and distinguish
historical stock from current holdings. Retain existing residency/package limits,
full mobile detail and 93 stops. Use the existing animation loop with bounded
updates, shared clocks, offscreen/hidden/reduced-motion suspension and permanent
disposal. Animal animation must not rebuild the city shadow atlas. Only use the
internal browser. This remains part of the unpublished v1.0.181 work; storage
remains critically constrained, so avoid redundant packages and heavy parallel
builds.

The same request includes Pinguinwelt and the former Alfred-Brehm lion house,
now Regenwaldhaus. Correct only the four exactly receipted Penguin prisms and
their exclusively owned native columns using all retained official source
sheets, with a documented rigid datum alignment that keeps the basement below
the park and matching roof-aware navigation. Construct the complete replacement
inside the required-site transaction. Keep the Brehm envelope intact; bounded
source-edge entrance/eaves recognition does not authorize an invented upper
tropical hall roof. Preserve the original source evidence and all unrelated
geometry. These houses add no new geographic coverage or tour stop.

The v282 package-size correction may losslessly encode only the six audited
eager fields in City West transport, Mitte Ensemble, tram ground rails,
Gendarmenmarkt perimeter buildings and east-outline native cells. Preserve
eager strong ownership, ordinary property descriptors, named-export identity,
per-field tree shaking, exact numbers and all original source files. Keep the
existing codec/admission rules and initial startup budget; do not change the
classification or lifetime of any lazy/weak field or raise a release limit.

The owner's further continuation permits the exactly identified low rear aviary
at the Zoo Hühner-/Taubenhaus (LoD2 `DEBE01YYK0003Uqa`), with one illustrative
chicken on a fully contained route. Retain all five measured source sheets as
evidence and their complete edges in an open wire interpretation, with one
documented rigid park-datum alignment. The main house and existing native corner
column remain untouched; routes must clear both. Add matching cage collision
within the existing required-house transaction, without retiring unrelated owners.

The same continuation permits the upper Regenwaldhaus hall on the complete
retained OSM roof ring `way/520730043`, previously missed in the source's lines
layer. Bounded official bDOM/DGM samples establish the raised roof; preserve
every original lower LoD2 sheet. Align heights with the local ground samples,
not the old lower-envelope datum. Label interpolated roof surfaces, robust eave
estimates and small frame spacing as such; do not claim a surveyed structural
grid. Use independent native roof geometry and matching navigation. No new
coverage, residency limit, photograph, raw media or external browser is permitted.
New drawn limb movement and paused family synchronization use the existing
shared clock and dynamic buffers, with retained animal geometry unchanged.

### Step 10 — v283 Fernsehturm horizon and Steppengarten shelter

The owner requests that the Fernsehturm remain visible when looking toward
central Berlin from distant existing coverage, including BER, Teufelsberg,
Spandau and Marzahn. Correct evidenced rendering or atmosphere defects while
retaining its real source position, dimensions, normal scene occlusion and
independent native geometry. This does not authorize broader world residency,
an enlarged tower, an always-on-top icon or lower city detail.

The same request identifies the incorrectly tall small building northeast of
the Beethoven-Haydn-Mozart memorial. Correct only the verified Steppengarten
shelter owner DEBE00YYT600005H using its full retained footprint and original
source sheets, mapped shelter use and public photographic evidence. Original
source heights and tree-contaminated surface elevations must remain evidence;
unmeasured replacement eaves, ridge and fittings are explicit display estimates.
Use an open shelter model, independent native geometry and matching walking
surfaces. Retire only exactly receipted old prisms/native columns. Keep all
unrelated geometry, coverage, 93 stops and existing runtime/release limits.
Use one internal browser view at a time and atomic replacement for any
hardlinked public source file. Preserve the verified v181 package until the
v182 replacement is validated; no redundant disk archives or broad cleanup.


The v283 remote-build portability correction fixes only the operating-system
metadata byte of standard build-time gzip output to the established v181 marker.
Keep every compressed payload/CRC/length byte, prepared Zopfli stream, codec,
admission rule, source value and field ownership unchanged. This prevents
platform-only asset renaming; no source reduction or release-limit increase.

### Step 10 — v284 Potsdamer Platz owner photographs

The owner's three 29 October street photographs permit bounded refinement of
the existing Torhaus/Leipziger Platz 1, TRION, Beisheim office podium and southern
station entrance. Resolve the photographed southern hall separately from the
northern pavilion. Its original LoD2 minimum includes a subterranean floor;
preserve the complete sheets and original minimum/height, but place the roof at
its actual source elevation rather than adding the full height to street level.
Retain every source footprint, unrelated roof, courtyard, previous detail and
walking approach. New facade subdivisions, steel fittings and material tones are
explicit photo-guided estimates. Exact native station columns may yield only to
a complete source-receipted open replacement after exclusive ownership is proved;
unexpected foreign columns remain unchanged. The exactly audited adjoining OSM
way 464904393 is a separate narrow roof-edge/support strip with a 9 m display
fallback, not measured massing. Retain its complete original four-vertex ring
and source metadata; only its two exact native columns and exact drawn proxy
may yield to a complete independent open frame in the same required transaction.
Aligning this strip with the adjacent measured station roof is a labelled
photo/context estimate, not a surveyed strip height. Keep independent orthogonal native additions,
full drawn mobile detail, the 93-place tour and existing live/release limits.
Photographs remain reference-only; no pixels, textures or media downloads ship.
Use only the internal browser, one full-city view at a time.

### Step 10 — v285 Reichstag owner photograph

The owner's 29 October Reichstag photograph permits bounded refinement of the
existing photographed facade, roof and glass dome within its retained site.
Preserve measured anchors, complete source envelopes, roof hierarchy, courts,
existing architectural detail and walking approaches. The official dome envelope,
rib/ring counts, open crown and complete interior remain authoritative; small
steel sections, facade subdivisions and material tones guided by the photograph are
explicit display estimates, not surveyed dimensions. Correct only exactly
identified erroneous authored fittings with complete bounded replacements;
retain unrelated geometry and earlier details. Keep independent orthogonal
native construction, full drawn mobile detail, all six modes, 93 tour stops and
every existing residency/decode/prefetch and release limit. This authorizes no
new geographic coverage, animation or photographic texture. The supplied photograph
remains reference-only; no image pixels, media files or downloads ship. Use only
the internal browser, one full-city view at a time.

### Step 10 — v286 government-quarter street-furniture photographs

The owner's seven photographs permit bounded street-lamp refinement along
Heinrich-von-Gagern-Straße and at its Paul-Löbe-Allee corner, plus one mapped
guidepost after its photographic identity is audited. Preserve the ten exact
municipal lamp-owner receipts (three Heinrich points and seven immediate
Paul-Löbe-Allee corner points visible in the same photographs); their former 6.8 m height is a display fallback,
not a measured source height. Ten further photo-estimated lamp anchors remain
bounded to the evidenced verges and must be labelled estimates rather than
surveyed municipal points. Keep all original source records, kerbs, roads,
trees, measured geometry and earlier details. Only exactly matched generic drawn
lamps may yield within the same ParkDetails construction transaction, after the
complete replacement passes its guarded factory; a failure preserves the
original owners. Keep independent orthogonal native models, full drawn touch
detail, all six modes, 93 tour stops and every existing residency/decode/prefetch
and release limit. No new geographic coverage, animation or photographic
texture is authorized. All seven photographs remain reference-only; no image
pixels, media files or downloads ship. Use only the internal browser, one
full-city view at a time.


### Step 10 — v287 Chancellery owner photographs

The owner's nine 31 October photographs permit bounded recognition refinement
of the Chancellery Ehrenhof climbing vegetation, photographed facade fittings
and source-bound surrounding trees/public-space context. Render the depicted
red autumn Wildwein as green foliage as explicitly requested. Preserve the
measured building anchors, envelopes, openings, existing lawns, grille, Chillida
sculpture, routes, recent street lamps and all earlier detail. Resolve the
photographed Paul-Löbe-Haus separately from Marie-Elisabeth-Lüders-Haus; no
relocation of buildings or artificial visibility clearing is authorised. Any
correction to old authored ivy or generic trees requires exact ownership and
a complete guarded replacement, with original source records retained.
Unsurveyed foliage profiles, branches and small facade sections are labelled
photo-guided estimates. Keep full drawn touch quality, independent orthogonal
native geometry, 93 tour stops, every runtime/release cap and one internal
full-city browser view at a time. All nine photographs remain reference-only;
no image pixels, photographic textures, animation or new coverage is added.


### Step 10 — v288 owner-requested city fidelity pass

The owner requests photographic/source comparison and bounded recognition
correction of the actual DDR housing east of the Holocaust memorial, the
Schwalbennest restaurant oriels and Nikolaiviertel, the Littenstraße courts,
Klosterruine and neighbouring modern buildings, DomAquarée, Potsdamer Straße
through existing Schöneberg/Südkreuz coverage, the Chinese and DPRK embassies,
and the elevated Stadtbahn between Alexanderplatz and Jannowitzbrücke.
Preserve complete source sheets, source datums, rings/holes, roofs, neighbouring
owners and prior detail. Exactly receipted height-fallback owners may yield
only after the complete drawn/native replacement is constructed, with full-cell
exclusive native ownership and guarded original fallback. Do not remove whole
bindings or source families because one legacy prism overlaps a new model.

The explicit request for more windows permits restrained, labelled estimated
openings on already authored ordinary-house storey/bay axes; retain special
facades, covered party walls and source-mapped materials. Unknown fallback
swatches may be muted while preserving explicit recorded colour evidence.
The Stadtbahn's original local-ground LoD2 normalization is not a common rail
height survey: retain those sheets and label any bounded interstation fit to
existing station rail anchors as a display estimate. Keep mapped road bridge
gaps open; occupied commercial arches are not invented pedestrian tunnels.
No photographic pixels/textures, new coverage, animation, lower touch quality,
new tour stops or higher runtime/release limits. Use one internal full-city
browser view at a time. Append reference credits; replace hardlinked public
ledgers atomically.

### Step 10 — v289 Ehrenhof canopy and detached Reichstag fittings

The owner's 1 November correction identifies the front entrance canopy between
the Chancellery office wings, not its side vehicle entrance. Replace only the
exactly admitted closed canopy extrusion with a complete open, thin roof using
its retained source footprint and roof sheets, the existing DGM datum and the
owner's reference photographs. Preserve the actual rear entrance, neighbouring
architecture, green climbing cover, sculpture, lawns, grille and real flags.
Unsurveyed membrane thickness and support fittings remain explicit estimates.
Native replacement requires exclusive source-cell ownership, a complete
independent orthogonal roof and matching open-under-roof walking clearance;
failed admission keeps the original owner. Source records remain intact.

The small black flag-like objects on the Reichstag forecourt are sixteen
detached authored basement-window planes and their frames. Remove exactly those
two incorrect batches, retaining the source facade, all other architectural
detail, the four rooftop flags and the Flagge der Einheit. Keep all six modes,
full drawn touch detail, existing coverage, 93 stops and every runtime/release
limit. Use one internal full-city browser view at a time; no photo pixels ship.

### Step 10 — v290 lossless loading and storage

The owner's 1 November request permits lossless storage and loading work for
startup and higher-altitude exploration, with no loss of quality anywhere.
Preserve every source file, coordinate, index, material, architectural detail,
independent native model, walking route, visual mode and all 93 tour stops.
Resolution, sight distance, geometry, residency, decode, prefetch and release
limits remain unchanged.

The finite implementation may decode exactly identical Base64 bytes through
a feature-detected native operation with the established
fallback, and reuse source-part fingerprints only while all exact input fields
remain identical. Mutated or corrupt source fields must still be checked.
The road-gzip experiment is excluded: Pages already compresses its transfer,
and a second application-level inflater adds CPU without reducing that transfer.

Keep original evidence and all Git history. Local object repacking must not
prune objects or change refs. Hosted assets may be retired only with an exact
closure audit proving they fall outside the current-plus-two-live-release
compatibility window. Do not remove public releases or their usable downloads.

The owner's direct continuation explicitly permits closing or disregarding old
viewer tabs. This supersedes the previous-two-live-release asset retention
requirement for the hosted tree: exact old hashed assets may be removed after
the complete current v1.0.189 package and every current asset dependency are
proved unchanged. Keep all nonasset files, sources, Git history and public
release downloads. Old sessions may reload the current viewer; no current
detail, mode or runtime limit may change.

### Step 10 — v291 Hauptbahnhof public interior and moving circulation

The owner requests automatic sliding entrances at Europaplatz and Washingtonplatz
for walking and flying approaches, a continuously walkable five-level interior,
connected stairs, running escalators in both directions and moving panoramic
lift cabins. Current official DB/S-Bahn evidence identifies six full-height
panoramic lifts connecting all five levels, three upper island platforms with
six tracks and four deep islands with eight tracks. This supersedes the old
four-shaft/two-upper-island authored display estimates. Preserve the complete
original evidence, unchanged source anchors/rail curve/roof envelope and four
existing upper track courses; add the two outer courses and correct only the
exact old estimated platform/shaft fittings with complete connected replacements.

Use one shared finite circulation layout for geometry and navigation, with
actual represented floor tops and exact slab/rail openings. The old coarse
native north-south floor and forty schematic descent strokes may yield only
to the complete independent native interior in the same unpublished transaction.
An exact bounded terrain complement may clear false ground within that hall
and its foyers while retaining every outside fragment and original paint/height.
Exact coarse office envelopes may yield only within source-pinned actual upper
platform/flight volumes; other offices and unknown owners stay physical.

Tenant identities and level/entrance directions follow current operator/DB
records. Do not invent Dussmann, Steinecke or a supposed Eurobank location where
the evidence identifies RELAY, current bakeries and Reisebank. Small bay offsets,
stair widths, cabin timing and equipment fittings remain explicit display
estimates; no copyrighted plan/photo pixels or new media requests ship.
Moving fixtures share the existing frame loop and a bounded station clock,
with reusable dynamic buffers, hidden/offscreen suspension, reduced-motion
access and correct family transitions/disposal. Do not rebuild the city shadow
atlas for these small moving fixtures. Keep full drawn touch detail, independent
orthogonal native geometry, 93 tour stops, coverage and all live memory, decode,
prefetch and startup limits. A finite measured offline-package ceiling adjustment
for these requested features must be documented separately from live budgets.
Only the internal browser may be used, one full-city view at a time.

The four native upper rail courses retain their source recipe, gauge, material
and track offsets. Their former four-metre bow quantisation is corrected to the
unchanged source-fitted curve because quantisation placed a rail through the
new platform stair path. Original sample evidence and rail source data remain
intact; the complete cardinal replacement below preserves their coverage.

The complete independent native six-course rail model replaces exactly the
328 former coarse cue cubes for the four inner courses, in the same unpublished
world transaction as the full interior. All four original track offsets, gauge,
elevation, iron palette, source-fitted curve and coverage remain represented
at higher continuous cardinal resolution. The two outer courses are retained.
Drawn rails and original source data remain intact. This removes an exact
replaced owner and keeps the seven legacy architecture batches below their
unchanged 5,500-instance ceiling; no runtime limit is raised.


### Step 10 — v292 Hauptbahnhof flower shop follow-up

The owner identifies the missing flower shop on the upper shopping level near
Europaplatz, the police station and a bakery. Add the current evidenced Blumen
Röwer tenant with a bounded, recognisable flower/plant display and matching
independent native geometry. Resolve the contradictory visitor-left/west wording
against the official station plan; keep exact local bay offsets labelled display
estimates. Neighbouring police/bakery recognition must follow current evidence.
Preserve all existing tenants, circulation, sources, station motion, six modes,
full mobile detail and every live/offline release limit. No plan/photo pixels,
new media fetch, coverage, timer or unrelated station rebuild is authorised.

The complete native retail interior may replace the exact old opaque
`two-course north-south side glazing` cue only through the current authored
shop-bay widths, from each represented floor top to 3.6 m above it, including
the retained complete Einstein frontage. The legacy factory remains closed by
default; enable this bounded complement only after the independent full native
interior is attached to the same unpublished world transaction. Preserve every
outside wall fragment, upper office, other landmark and original source record.
The seven legacy batches retain their unchanged 5,500-instance ceiling.


### Step 10 — v293–v296 courts, public routes and parliamentary interiors

The owner's November request authorizes source-bound refinement of Wedding,
Charlottenburg and Moabit courts and their immediate public surroundings,
Kleiner Tiergarten and its actual churches/over-under Rolleracht crossing;
Gustav-Heinemann-Brücke approaches and the Alexanderufer/Humboldthafen route
beside SPIEGEL toward Futurium; both evidenced parliamentary waterside dining
spaces; publicly documented Reichstag and Abgeordnetenhaus interiors, entrances,
plenary rooms and dome access; the named south-city stations, parks, theatres,
Potsdamer Platz buildings, Philharmonie and Technikmuseum roof aircraft.
Resolve dictated place names against primary sources. Keep measured source
sheets, all previous detail, actual open space and every unrelated owner.

Publicly documented interior/entrance air may replace only the exactly proved
old occupied owner volume, with its complete outside complement, retained source
receipt and full new interior attached before the legacy owner yields. Geometry
and walking must share represented floors, stairs, railings and clearances in
both full drawn and independent orthogonal native families. Never merely turn
off collision through an opaque old wall. Preserve the complete existing dome
mirror/ramp construction and all station motion. Small reference-derived room,
facade and furniture dimensions remain explicit display estimates. No new
photographic pixels, texture requests, scene timers, geographic coverage, tour
stops or higher live residency/decode/prefetch limits. Keep equal full drawn
mobile detail and the existing offline/package ceilings. One internal browser
city view at a time; preserve preceding packages by rename, without redundant
large copies. Root coordinates shared world/navigation integration and release.

The exact old estimated Abgeordnetenhaus glass roof/frame may be refitted only
to its source-bound central clear strip, keeping all six courtyard holes and
adjacent roofs. The official hall area supports room scale, not surveyed roof
dimensions; every unsurveyed roof dimension stays labelled a display estimate.
The Gustav-Heinemann source centreline may correct the rounded old alignment,
with short exact-node approach joints, and the old illustrative Panoramaweg
height fit may meet the bridge at its mapped junction while retaining all XZ
nodes, lower-promenade ordinates and the entire outer height complement.
Publicly evidenced restaurant glazing may replace only admitted exact old
opaque lower wall volumes after complete dining interiors/glazing exist.

The documented public two-storey HumboldtHafenEins arcade may
open only the exact original eGZXjFeA owner along the retained lower footway
and its northern rise. Keep the complete source record, eight exclusive
native tuples, outside wall/roof complement and changed/foreign-owner rejection.
A complete new underside/portal and route must precede admission; all absolute
fit dimensions remain labelled estimates. Published central dining facades must
be staged as detached complete copies: open only the copy, and gate the intact
original's visibility at the atomic world commit with rollback restoration.

Only with complete v295 interiors, the four old estimated native observation
platform bars may yield to a complete independent cardinal annulus at the shared
floor elevation, retaining both real terminal-ramp headrooms, the default factory
and the unchanged 5,500-instance landmark ceiling.


### Step 10 — v297–v299 historic Mitte, Wall sites and eastern waterfront

The owner's named follow-up authorizes source-bound detail at Zur letzten
Instanz and its three Waisenstraße houses, the existing Littenstraße court
context, Altes Stadthaus and its actual rear neighbours, and Alte Münze;
Mauerpark, East Side Gallery with its identifiable mural sequence and actual
existing modern buildings behind it, and the surviving Wall at Topographie
des Terrors; Stralauer Allee, Stralau's waterfront and evidenced mooring places,
and the actual Sisyphos site at Hauptstraße 15 in Rummelsburg. An exact finite
Sisyphos-site coverage complement may be added if the existing sources omit it;
this is no permission for general Rummelsburg expansion. The dictated
“Lederla” remains unresolved and does not identify an invented extra site.

Preserve complete source envelopes, roofs, open yards, park/water/path courses
and earlier details. Present-day completed architecture must be distinguished
from planned Molkenmarkt buildings and ongoing Mauerpark works. Mural positions,
compositions and named artists follow primary work references; careful bounded
code/vector interpretations must be recognisable rather than interchangeable
generic colour panels. Never describe procedural interpretations as photographs
or bundle unlicensed reference pixels. Keep precise reference/artist credits.
Houseboats follow evidenced moorings, not arbitrary water positions or invented
private occupants. Do not infer permanent 24/7 club opening from the request.

Only exactly receipted false or superseded owners may yield after a complete
required replacement exists, with closed defaults, outside complements, source
retention and matching granular navigation. Keep full drawn touch quality,
independent orthogonal native geometry, 93 tour stops, six modes and unchanged
startup/Worker/residency/decode/prefetch/package limits. One internal browser
city view at a time; preserve the prior v192 package by same-filesystem rename
when final build inputs are frozen, without redundant large copies.


### Step 10 — v300–v302 ordinary neighbourhood houses

The owner's November request authorizes a source-supported architectural pass
for Moabit, Mitte, the Karl-Marx-Allee hinterland, Friedrichshain, Kreuzberg,
Schöneberg and streets behind Kurfürstendamm/Kantstraße. Within existing source
coverage, complete official families may replace only exact proved active low
OSM fallback owners after complete drawn/native models and matching navigation
are attached. Retain every original record, complete wall/roof/court sheets,
all unrelated details and all runtime/package limits. Correct measured Lehrter
bodies remain; only their exact actual-constructor street-fitting receipts may
yield. Ambiguous Tucholskystraße 38 remains unchanged. Do not mistake already
suppressed master-prism evidence for an active low fallback.

Finite ordinary-front packet transactions require full raw mesh, nav and line
receipts, complete new fittings before precise old fitting retirement, unchanged
body/roof complements and the same serial cancellation/publication lifetime.
Core-dependent West fittings require complete live Core admission and must be
revoked/reloaded with that admission. Construction recipes are weak per tile;
small eager indices and ownership/navigation objects remain strong. All native
members are independently cardinal, with actual stepped roof navigation. Small
unmeasured window dimensions and back/court rhythms remain explicit estimates.
The separate finite v194 gzip audit changes only 96 wire encodings after exact
full-byte decompression proofs; no new runtime codec or source reduction.

### Step 10 — v303–v305 Friedrichshain and Rixdorf

The owner's next November request names Rigaer Straße, Silvio-Meier-Straße,
Simon-Dach-Straße and the Boxhagener Viertel; Richardplatz, Schudomastraße and
the old Böhmisch-Rixdorf quarter by Karl-Marx-Straße in Neukölln; Neukölln
Arcaden and Rathaus Neukölln. The corrected Karl-Marx-Straße location takes
precedence over the initial dictated Karl-Marx-Allee. Refine these finite
sites inside existing coverage using complete retained official geometry,
mapped context and attributed architectural/photo references. Old village
yards, low roofs, garden/park/path voids and complete neighbouring owners must
not become generic perimeter fill.

Correct only exactly identified false or superseded delivered owners after
their complete source-supported drawn and independent cardinal native
replacements exist, with complete outside complements and matching granular
navigation. Keep original source records and roofs/court holes, earlier authored
details, full drawn touch quality, all six views, 93 tour stops and every live
and archive limit. No new photographic pixels, textures, timer, district bounds
or unbounded regeneration. Small unsurveyed facade details remain explicit
display estimates. Root owns shared integration, source-history capture and
release; region implementations use isolated versioned files and existing
bounded packet lifetimes wherever possible. Any further finite lossless wire
audit must prove complete decompressed byte equality without changing geometry
or weakening old immutable history controls.

### Step 10 — v306–v309 northern sites, rail cuttings and desktop startup

The owner's next request names Lessing-Gymnasium in Wedding, Humboldthain and
its flak tower, the measured hills of Volkspark Friedrichshain, the Thälmann
monument/housing/swimming hall and Zeiss-Großplanetarium, Ringbahn alignment and
stations (especially Wedding and the deep Gesundbrunnen cutting), SSE and
Velodrom, and the existing Bundeswehr, Vivantes Friedrichshain, Benjamin Franklin
and Charité hospital sites. Refine these finite sites inside retained coverage
from attributed primary architectural references, complete official building
families and bounded official terrain samples. Resolve spoken names against
actual addresses. Preserve earlier correct planetarium, hospital and park work;
do not duplicate models or turn paths, courts and landscaped roofs into fill.
The explicitly named Lessing-Gymnasium at Schöningstraße 17 is missing from the
previous coverage. The request permits only its exact mapped school parcel and
complete official building families as a finite named-site supplement in
`bounds-named-v306.geojson`, subtracting all previous scopes. Preserve the old
bounds; do not infer an adjoining Wedding district expansion.
Any exact false terrain/owner correction needs a complete replacement, original
source evidence, unchanged outside complements and matching drawn/native walking
geometry. Unsurveyed facade details and interstation elevation fits stay labelled
estimates. Keep all existing source records, full drawn touch detail, independent
cardinal native forms, six modes, 93 tour stops and every runtime/package ceiling.

The owner also requests faster, smoother desktop startup and rendering, with
honest continuous loading feedback instead of the old 0/50/83-percent stalls.
Measure actual stages and long CPU tasks; report completed work and readiness,
never fabricate timer-driven progress or open the curtain before the required
city exists. Reduce redundant work and bound main-thread slices without lowering
resolution, geometry, visible distance, shadows or existing quality. Root owns
shared integration, progress/performance work, immutable history capture and
publication. Region agents edit isolated versioned modules. Use one internal
full-city browser at a time, and no photographic pixels or new coverage.

### Step 10 — v311–v314 loading, landmarks and northern Mitte

The owner requests a single loading bar without work counters, photo-guided
material colours for the Reichstag, Chancellery and Brandenburg Gate, and
bounded refinement around Helmholtzplatz, Danziger Straße, Nordbahnhof, the BND
and Otto-Weidt-Platz. In Europacity, distinguish the measured rail levels and
Perleberger Brücke approaches. Display the DKB or SAP signs only where an
external reference establishes the sign and its location. Retain source
building sheets, rail courses outside the exact corrected owners, all earlier
details and the existing touch, native, residency and release limits. Keep
references outside the rendered assets. Keep the real startup readiness gate.

### Step 10 — v315–v318 Reichstag section and named central/eastern places

The owner requests a reversible click/tap longitudinal section of the Reichstag,
recognisable parliamentary levels, plenary furniture and normal public interiors,
and grass-like detail on its existing lawn. Temporarily clip only the finite
western display volume; retain every original buffer and restore the exact
exterior and material state on close/disposal. No invented public route through
closed functional wings is implied. Every new slab retains all six source courts
and existing public-room/stair air. Interior heights and small fittings remain
explicit display estimates. Preserve the complete dome, mirrors and ramps.

The same request authorizes source-bound refinement along Unter den Linden,
at the named east-Dom/Hackescher Markt and Mohrenstraße buildings, Computerspiele-
museum and its evidenced neighbouring garden, Strausberger Platz fountain,
Treptowers, Arena and Badeschiff. Differentiate current restoration from an
illustrative intact fountain and verify current tenants/signs. Complete measured
leaves may replace only exactly admitted old combined-height owners, retaining
all source sheets and full outside complements. Attach both complete independent
families before any gate opens; changed/foreign sources and missing/disposed
models keep the original owners. Matching granular navigation and stale-publication
checks are required. Keep all previous architecture, full drawn mobile detail,
93 stops and every runtime/release ceiling. No extra bounds, timer, reference
pixels or external browser. Root coordinates integration, immutable-history
capture, build and publication; retain the preceding package until verified.

The finite v318 archive audit may encode only the six exactly named eager fields
in court/park detail, legacy fittings, the canopy receipt and the new Treptow
packet plan. Preserve eager evaluation, strong ownership, ordinary writable
data descriptors, named-export identity, every source byte and all numeric
values including negative zero. Use the existing gzip/base85 decoder and
admission decision; no new codec, weak reclassification or higher ceiling.


### Step 10 — v319 furnished Reichstag section and underground links

The owner requests a more complete longitudinal section through furnished rooms,
offices and the basement, including publicly evidenced underground connections.
Keep the v318 controller/floors and every original source sheet as evidence;
add bounded on-request room geometry and reversible finite terrain/exterior
reveal volumes. Preserve all six measured courts and the existing public foyer,
chamber, stairs, dome, mirrors and ramps. Whole room footprints, not just their
centres, must clear the retained source voids and public circulation. Unknown
interior dimensions and room positions remain explicit display estimates.

Distinguish the documented pedestrian links to Jakob-Kaiser-Haus and Paul-Löbe-
Haus from the mapped goods/vehicle UES network that also reaches Marie-Elisabeth-
Lüders-Haus. Preserve all mapped route vertices; public endpoint-fitted pedestrian
connections and unsurveyed vertical fits remain schematic. The east basement's
Boltanski archive is a credited procedural interpretation, with no photograph,
plan page, private occupant or unsupported operational-room inventory.

Additional basement/connection view controls may remove only their finite
display volumes while open. Close/disposal restores exact material/shader and
shadow state, full source terrain/exterior and normal walking. Do not invent
public navigation through restricted parliamentary rooms. Retain selected view
through mobile family remounts, full drawn touch detail and separate orthogonal
native construction. Existing v295 room and v318 floor ceilings remain; the
new lazy exhibit is finite at20,000members per family. Keep every runtime city,
package and release ceiling, all93tourstops, source records and older immutable
history fixtures. No coverage expansion, texture, media request, new scene timer
or external browser. Root owns shared integration/build/publication.

The finite v319 lossless archive offset may encode only the exact ordinary
eager `penguin` field in retained `zooHousesV282.json`. Preserve complete
source bytes, eager/strong ownership, writable descriptors, named identity and
all numbers including negative zero. Reuse the established gzip/base85 codec
and admission decision; no source edit, new codec, weak reclassification or
higher package ceiling is authorised. Prove decoded equality against published198.

The same real-browser verification identified an older exact Worker fitting
receipt mismatch for one Moabit facade-axis endpoint at source owner sN3KUQ9U.
A bounded v319 compatibility reader may admit only the independently captured
V8 Float32 word21.50322151184082 for that exact line, retaining the canonical
JSC word21.503223419189453 and its jointly captured night-strip height/centre words, with every other
literal owner/line/instance check intact. Both alternative records must match
together; partial hybrid, duplicate and foreign-owner variants stay rejected.
Keep original source arrays, complete outside bytes and the immutable old
receipt. No epsilon, user-agent switch, general rounding, source normalisation
or permissive missing-row acceptance. The actual constructor tests must prove
both complete variants and reject changed, duplicate and foreign-owner words.
Northern late transfer must wait for its17actual attached source-owner batches
and retain every full hash/admission/lifetime check. This does not authorise
omitting source surfaces, silently accepting a failed Worker or raising budgets.

To expose the separately built room bays in the native filled-column model,
the reversible longitudinal view may additionally cut only the two finite wing
strips x−8…13.2m, absolute z44…63.5m, y4.9…27.9m in the existing Reichstag frame.
Use the same drawn/native openings, retaining every outside source fragment and
exact full restoration. This is a display cut, not a permanent source or normal
walking exemption. The close room camera must avoid existing neighbouring trees
without removing or relocating them.

### Step 10 — v320 fifty ordinary-building clusters

The owner's next request authorizes a finite accuracy and appearance pass on
50 distinct remaining generic ordinary-building groups within existing source
coverage, both inside and outside the S-Bahn Ring. Identify all 50 nonempty
groups and their exact source owners; sampling 50 groups while silently leaving
some unchanged does not fulfil the request. Prefer complete retained measured
street walls and independently verified native spans. Use attributed public
architectural references for distinct local proportions and fitting styles;
unsurveyed window layouts and small dimensions remain explicit display estimates.

Complete new fronts may replace only exactly receipted old generic window
fittings through the existing closed, atomic packet transaction. Preserve all
original source files, bodies, roofs, courts, lines, navigation and every
unrelated or individually authored facade. Do not repeat a global palette,
invent roof shapes or entrances, cover mapped material evidence, add duplicate
window grids or treat navigation polygons alone as proof of a visible wall.
Keep equal full drawn touch detail, independent cardinal native construction,
the 93 tour stops, existing streaming lifetimes and all runtime/archive limits.
No new coverage, photograph pixels, texture requests, timer or quality reduction.
Use one internal full-city browser at a time. Root owns shared runtime/history
integration, build and publication; regional profiles remain isolated files.

The finite v320 archive offset may encode only seven exact ordinary eager
fields matched independently to published199: `surfaces` in
`districtStreets.json`; `source`, `surfaces` and `blank_extension`
in `schlossEastStreets.json`, `hill` in `wallGalleryV298.json`, `offsets` in
`weinbergBuildingOffsetsV176.json`, and `native` in `mitteDdrV288Profile.json`.
Preserve eager strong ownership, writable data
descriptors, named-export aliases, every original source byte and all numbers.
Reuse the existing gzip/Base85 codec, admission decision and OS marker; do not
reclassify any old lazy/weak source or change a runtime or package ceiling.


### Step 10 — v321 ministries and state representations

The owner requests a completeness and architectural-accuracy review of every
current federal ministry's Berlin service seat, all Berlin Senatsverwaltungen
and every Land's Berlin representation. Use current official ministry/state
directories and public contact/building references, distinguishing primary Bonn
seats from Berlin offices, co-located departments and shared representation
houses. Berlin's own representation remains the separately retained Senate
Chancellery/Rotes Rathaus; do not invent a sixteenth separate house. This is
bounded public exterior refinement within existing coverage, with no Bonn
geography or general district generation.

Preserve every complete measured envelope, roof, court, source record, earlier
authored feature, public approach and navigation. Correct only specifically
evidenced wrong or generic fittings with complete source-bound replacements
and exact old component/owner receipts; defaults stay closed and failed source
admission retains the existing model. Existing complete ministry architecture
remains authoritative. Current institutional names, addresses and building
identities must not be inferred from stale ministry abbreviations or tenants.
Unsurveyed small facade details and material tones remain explicit estimates.
Keep full drawn touch detail, independent cardinal native construction, all
93 tour stops, six modes and every startup/Worker/residency/decode/prefetch and
archive ceiling. No photograph pixels, new media request, timer or unrelated
source deletion. Root owns shared integration, immutable-history capture and
publication; regional audits/implementations use isolated versioned files.
Use one internal full-city viewer at a time and preserve the preceding complete
package by rename until the replacement is verified.

The X8/BMWSB audit identifies exactly three obsolete same-building OSM coarse
owners, 32698095, 32698102 and 74476580. Their complete measured replacement
is the 26 lower leaves of official family DEBE02YY4000042k; its two previously
authored V272 tower leaves remain under their existing ownership. The small
OSM/LoD2 boundary slivers are documented same-owner source conflicts, not new
independent buildings: retain their original records/polygons as evidence while
correcting these three complete coarse owners to the measured outline. Do not
leave false 27-metre ghost wall fragments. Exact generic-fitting retirement
follows all older validators and preserves every unrelated word; missing,
duplicate, foreign or changed receipts keep the original geometry. Native
columns require exclusive source-contribution proof and exact full signatures;
mixed foreign/tower columns remain intact. Complete replacement construction
and matching granular navigation must precede the private gate.

The same finite whole-owner correction applies to the two demonstrated coarse
BMJV owners 41953739 and n-280071, using their complete official source families
while retaining the four already-authored ABQ leaves and all original records.
Oranienstraße 106 similarly replaces only its evidenced n-400426 coarse owner
with the complete eight-leaf source family; unrelated native contributors remain.
The confirmed low-height source defects at Bildung/Bernhard-Weiß-Straße and the
Württembergische-Straße tower may receive finite independently evidenced roof
and upper-floor corrections. Preserve all original source planes/footprints and
courts as evidence, every unaffected leaf and low wing. Use the exact existing
family datum offset, independent bDOM elevations and attributed public roof/
setback references; interpreted terrace splits and roof boundaries are not a
survey and must be labelled accordingly. No whole-family scale or blind lift.
Twenty-one unchanged published200 eager fields may use the existing lossless source
encoding with literal source/field pins; keep their eager strong ownership,
property descriptors, aliases and every decoded number/word unchanged.

Mode-boundary shader-program retirement must not invalidate complete ministry
or Senate roots. Distinguish only the synchronous private material-retirement
scope of the existing real cache pass from authored resource disposal; ordinary
disposal must still revoke provenance and exact-owner receipts. Preserve actual
GPU program release, all material properties, source words and cache ceilings.

### Step 10 — v322 universities, youth theatres and public memorials

The owner requests source-supported refinement of the important HU and FU
buildings, Rost-/Silberlaube and Adlershof, the major applied-sciences campuses
including HWR, Alice Salomon and the former Beuth/current BHT; the named GRIPS,
Podewil and ATZE theatres with other important children's/youth venues; and the
Archenhold observatory in Treptower Park. Resolve the spoken Grünau location
against an actual institution before assigning a new campus. Verify current
addresses and completed architecture; preserve the complete earlier HU/FU,
Adlershof, GRIPS and Podewil models and all unrelated source sheets and detail.

The same request includes the three major Soviet memorials at Treptow,
Schönholzer Heide (provisional identification of the northern spoken name) and
Straße des 17. Juni, publicly evidenced American/French/British remembrance
sites, Institut français/Maison de France and the actual Kurfürstendamm/
Tauentzien sculpture ensemble. Identify the intertwined tube sculpture from
primary public art records and distinguish extant works from removed historic
installations. Do not invent equivalent national memorials, inscriptions or
burial inventories. Earlier complete memorial architecture stays authoritative.

Only actual, exactly identified erroneous owners may yield to complete
source-bound replacements with strict private admission, retained originals,
full outside complements and matching granular walking geometry. All other
recognition additions must fit their real measured wall/roof/site anchors and
must not duplicate existing facade grids or obstruct source openings. Any
necessary new geographic complement is limited to an expressly requested,
verified named campus/site footprint minus every previous approved scope,
documented separately; no adjoining district regeneration is authorised.

Keep full drawn touch detail, independent orthogonal native construction,
93 tour stops, six modes and every startup/Worker/residency/decode/prefetch and
archive limit. Small unmeasured architectural or sculpture dimensions remain
explicit display estimates. No reference pixels, new media fetch or scene timer.
Use one internal full-city browser and one heavy build at a time. Reuse raw
archives, preserve the preceding complete package by rename, and leave older
published source-history fixtures and Git/release history untouched. Root owns
shared integration, new immutable-history capture, build and publication.

#### Step10 finite lossless source offsets
The following 80 exact published v1.0.201 ordinary eager fields are approved only for lossless source encoding through the existing gzip/Base64 or already-selected Base85 codec and admission rule. Their full raw source and field SHA-256 pins are recorded in losslessEagerFieldsV322.ts. Preserve eager strong data descriptors, named/default alias identity, mutations, property order and negative zero. Do not reclassify any source cache, weak lifetime, packed AltMitte strings, or public payload. External before/after production mini-builds verified every selected value; the final byte saving is recorded in the build evidence. These fields are finite, with no filename patterns:

- data/mitteHeritageV166Source.json.paths
- data/southFidelityV294Packets.json.packets
- data/moabitMitteV300Profile.json.fronts
- data/mitteHeritageV166Navigation.json.roofTriangles
- data/spanishEmbassyV164Source.json.parts
- data/mitteEmbassiesV288Profile.json.chinaPackets
- data/zooAnimalsV282.json.habitats
- data/concertHallsNavigation.json.roofTriangles
- data/southFidelityV294.json.huxleys
- data/cafeNeuerSeeV164Source.json.gardenSurfaces
- data/zooGroundsV165Source.json.paths
- data/grosserSternGatehousesV164Source.json.parts
- data/zooWestV276.json.surfaces
- data/huthmacherSource.json.surfaces
- data/europacityRailV313.json.track
- data/districtStreets.json.source
- data/concertHallsSource.json.goldJoints
- data/districtStreets.json.scope_rings_m
- data/wuhlheideTerrainV201.json.profiles
- data/rkiMoabitV277Ownership.json.neighbours
- data/railBridgeApproachV307Profile.json.pavedDomain
- data/zooAnimalsV282.json.retainedRoutes
- data/technikmuseumV272.json.columns
- data/theatresV272Navigation.json.roofTriangles
- data/lehrterV277.json.ribSegments
- data/neukoellnLandmarksV305Profile.json.towerNavigation
- data/zooAnimalsV282.json.animals
- data/hbfNorthApproachSources.json.tracks
- data/eastCinemasV260Minecraft.json.meshes
- data/tierparkAnimalTransferV282.json.families
- data/concertHallsSource.json.roofEdges
- data/lehrterV277Navigation.json.parts
- data/breitscheidTowersSource.json.parts
- data/zooWestV276.json.fittings
- data/moabitMitteV300Owners.json.nativeColumns
- data/westSquaresV188Detail.json.roofCollar
- data/steppengartenShelterV283.json.nativeBoxes
- data/zooWestV276Ownership.json.neighbours
- data/tiergartenWerkhofV275.json.detailRoles
- data/cafeNeuerSeeV164Source.json.gardenNativeRuns
- data/westSquaresV188Detail.json.facadeBands
- data/southFidelityV294.json.plans
- data/verkehrskanzelV276.json.nativeCabinBoxes
- data/coreTerrainActualV310.json.variants
- data/districtStreets.json.elevated_path_ids
- data/hbfStreetDetailsV252.json.curbCaps
- data/parliamentaryDiningV296.json.nativeColumns
- data/berlinHistoricCoreV288Ownership.json.nativeNearbyColumns
- data/southFidelityV294.json.metropolParts
- data/zooGroundsV165Source.json.barriers
- data/pressQuarterV272Navigation.json.nativeRoofCells
- data/theatresV272Navigation.json.nativeRoofCells
- data/zooHippoV256Source.json.edges
- data/chancelleryPhotoV287Owners.json.drawn
- data/zooStationV165Source.json.osmEvidence
- data/westKiezV302CoreOwners.json.nativeColumns
- data/potsdamerCorridorV288Profile.json.navigation
- data/berlinHistoricCoreV288Ownership.json.nativeColumns
- data/verkehrskanzelV276.json.nativeFittingReceipts
- data/technikmuseumV272.json.sites
- data/kulturforumPiazzettaV246.json.triangles
- data/steglitzWindowsV273.json.nativeColors
- data/bayerCampusV277.json.nativeFootprints
- data/mitteHeritageV166Source.json.barriers
- data/moabitJusticeV166Source.json.parts
- data/eastStadtbahnV288.json.packets
- data/northTerrainPropsV309.json.rows
- data/southFidelityV294.json.nkzOwners
- data/bayerCampusV277.json.parts
- data/kulturforumPiazzettaV246.json.positions
- data/railBridgeApproachV307Profile.json.domain
- data/concertHallsNavigation.json.parts
- data/concertHallsSource.json.parts
- data/mitteHeritageV166Navigation.json.parts
- data/mitteHeritageV166Source.json.parts

New v322 constructor-only models may use the existing audited weak construction codec; new university sites/navigation/oldBodies/sourcePrisms retain ordinary eager ownership. New university streamed recipes use the unchanged per-packet weak plan codec. Do not change any older cache lifetime or raise archive, Worker, prefetch, decode, startup or scene budgets.

New exact authored record fields memorialPreviousV322.families and universitiesPreviousV322.plans retain ordinary eager, strong ownership while using the existing lossless source codec. Native-only Berlin sculpture is a new additive model authorized by its complete literal-pinned compiled POI/ground-source record; it performs no old-owner transfer and fetches no drawn payload. Drawn Berlin still requires the actual original street/ground inputs.

Step10 explicitly requested named theatre coverage may add only the complete verified official building-family footprints of Theater an der Parkaue (Parkaue 29), Theater Strahl Ostkreuz hall (Marktstraße 11), and the officially verified Strahl venue at Kyffhäuserstraße 23. Their lack of older body coverage is not a reason to invent surrounding districts, rectangular fills or streets; bind source geometry and granular navigation to these named sites only.

The additional already ordinary eager object data/federalMinistriesV321.json.nativeColumns (116735 decoded bytes) is explicitly included in the same v322 pin registry after a separate real before/after production audit: identical full values/descriptors/aliases; 94510 bytes saved. It is an original eager object rather than a lazy construction field; no cache lifetime or native column is changed.

The new youthTheatresV322.navigation record retains its ordinary eager, strongly owned object identity while using the existing lossless source codec. New youthTheatreFrontsV322Packets recipes use the unchanged per-packet weak plan codec and share admission with the complete combined required university/theatre model; original Kyffhäuser building/roof/door sources remain untouched.

Four additional exact published201 native-only ordinary eager fields are approved after a separate complete before/after production audit: data/altMitteV169Native/packet-042.json.meshes, packet-041.json.meshes, packet-043.json.meshes and packet-071.json.meshes. Only these full raw-source/field-SHA-pinned fields may override the usual packed-packet literal exception. Use the existing gzip/Base64 codec, eager ordinary strong data properties, exact named/default aliases and unchanged full packed strings. Do not use uncompressed JSON.parse wrapping or Base85 for these four fields; metadata-only imports must eliminate all new decode work. No old native mesh word, string, packet split or ownership lifetime may change. Maximum single decoded JSON field is below 840 KiB; module evaluation is sequential in the existing native-only preload, never the geometry Worker or initial bootstrap. Every decoded value and actual binary source string must remain exact. Existing startup/Worker/archive/residency caps stay fixed.

Step10 full native RLE intervals: actual BHT cells contain several original vertical intervals. Binding and composition use the full exact five-word original tuple (X/Z/low/high/class), never XY-only deduplication. A selected XY cell must include every actual original interval, without duplicates, missing/extra rows or inconsistent contributors/retirement metadata. Matrix retirement requires every interval of that cell to belong exclusively to proven obsolete owners; mixed foreign cells remain complete. Multi-interval source row-list topology is pinned for live revocation. Original matrix, colour, outside complement, controls and existing tolerances remain unchanged. This is complete-source support, not an RLE admission waiver.

Step10 Allied additions are finite: mapped Max Bill monument node/9671927947, British Cross of Sacrifice node/7503268449 and Stone of Remembrance footprint way/802156616 within cemetery way/5077552. Preserve existing Luftbrücke monument. Maison de France has only new source-bound fittings on the seven original blank rounded facets; no old body, roof or door retirement. Berlin and Pyramide share one exact Drawn authored-host transaction; Cadillac, French and British works have no invented old-owner plans. Native-first compiled author sources stay distinct from unchanged strict Drawn old-input proofs.

V322 admission performance must preserve full positive gates: one atomic office/university readiness read per relevant checkpoint, no timed admission cache; no duplicate full proof for the two flags. Only residents with a relevant source-quarter recipe require readiness polling. Negative navigation broad-phase bounds derive from completed actual render bounds, conservatively expanded for Float32 edge rounding; they never authorize positive admission or alter exact owner-word comparisons. All positive queries and hook/await checkpoints retain fresh complete validation.


## V324 — finite Wilhelm housing correction (v1.0.205)

The owner requests the existing residential families east/southeast of the
Holocaust Memorial, west of Wilhelmstraße, including An der Kolonnade and the
Georg-Elser memorial/tennis-court context. The complete finite audit is seventeen
historic families (45 original leaves) plus the two modern Embassy of Exchange
families DEBE01AL1H500002/DEBE01AL1H500005 (38 leaves). It does not authorize a
new district, courtyard fill, roof replacement, street or navigation change.
Keep every original prism, source wall, roof, passage and walking surface.

New fittings bind all 83 literal original prism records; Native additionally
binds the eight original packet records and complete original positive-area
voxel intervals/contributors/exposure topology. Original native body surfaces
are borrowed independently for cardinal fitting support; no rotated Drawn clone.
Full/touch have identical new fitting coverage. Fine joinery, colors and shopfront
rhythms are attributed display estimates, not survey measurements. Reference
photographs stay outside the product; no photographic pixels or new texture.

A full private model/source receipt precedes any old-fitting transfer. Only
modeled wall masks retire generic Drawn packet fittings in 1_0/1_1; the Source
Quarter recipe remains retire-only and required, with default-closed admission.
Dedicated old V288 west fittings retire only their three covered runs; the
unmodeled fourth west face remains. The exact old modern slab fittings were
incorrect DDR illustrations and may retire in full once both complete modern
families admit. Clip obsolete An-der-Kolonnade fittings only to the modeled mask
and replay their geometric outside complement; retain Czech-embassy, HIT,
tennis and every other original component. Native old generic glass coloring
on structural Alt-Mitte facets requires exact neutral-backing replay with the
same original facets; no body/index hole, whole-cell or broad owner deletion.

The twenty Core owners with positively selected obsolete fittings join the
existing Government/University ExactOwners composition. Keep all their original
body and ink components with retireBody=false; do not create a competing index
transaction on shared Core. The other audited original prism records remain
source-bound and unchanged. Native full retires only whole actual pane instances
inside independently proven cardinal support; Native touch has no old panes and
retains all original body rows. Pending, cancelled, detached or revoked models
restore all previous complements; late Worker/cultural arrivals use the same
private gates. Hidden mode ancestors and legitimate GPU/lossless parking do not
invalidate a complete model. No recurring scene timer or admission time cache.

Only new wilhelmHousingV324.drawn/native, wilhelmHousingV324Core.drawn/nativeFull/
nativeMobile and new retirement constructor inputs may use the established weak
construction codec. New .runs and literal source-binding metadata retain ordinary
strong own-data descriptors. No older cache lifetime or eager field is changed.
Retain v306/311/318–323 immutable source fixtures and capture a new v324 bridge
after the final finite production delta. Keep the 894 MiB archive ceiling,
400 KiB bootstrap ceiling, 16 MiB Worker ceiling, existing streaming/scene limits,
all six views, full touch detail and all 93 tour stops. Preserve the preceding
complete package by rename and publish the public release as latest only after
Pages, exact artifacts and the visible viewer have been verified.

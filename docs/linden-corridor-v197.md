# Unter den Linden corridor facades — v1.0.97 / Step 10

This bounded pass refines currently generic street fronts between Pariser Platz
and Friedrichstraße, including directly adjoining fronts on Wilhelmstraße,
Schadowstraße, Neustädtische Kirchstraße, Mittelstraße and Behrenstraße. It does
not claim complete neighbourhood coverage. The existing Brandenburger Tor,
Pariser Platz, embassies, Adlon, Einstein, Dussmann and other authored models are
outside the selected owner set.

The thirteen selected source parents contain **123 original wall polygons**.
Two polygons straddle the two Kaiserhöfe address fronts, giving **125 presentation
intervals**, around 1,179 metres of selected street frontage. The complete
source rings, courtyard holes, roofs, building navigation and terrain datum
remain unchanged. The generator writes only the two new v197 JSON files.

## Evidence and limits

The full source book is
[`linden-corridor-v197-source.json`](../geo_data/regierungsviertel/linden-corridor-v197-source.json).
It includes URLs, concise architectural facts and an explicit estimate statement
for every owner. Sources were checked on 9 October 2026. No image was downloaded,
used as a visual reference or bundled; no new Wikimedia photo attribution is
needed for this pass.

All IDs below have prefix `DEBE01YYK000`. Exact source wall contours and source
height/datum are measured LoD2. OSM provides address/material context and retained
street lines, not replacement ownership or new building footprints.

| Owner suffix | Front / documented basis | Rendering interpretation |
| --- | --- | --- |
| `01Jp` | UDL74, Deubzer König, completed 2001; parliamentary design describes broad lower glazing and fine steel/glass profiles | Pale mineral colour and exact dimensions estimated; design intent is not claimed as verified as-built sandstone |
| `05PJ` | Matthias-Erzberger-Haus, UDL71; Bundestag describes the 1993–94 restrained neoclassical remodelling | Current classical division; no return to its original 1961 grid facade |
| `04mj` | Friedländer, UDL67; LDA09075013: five storeys, high shop base, side projections, belt cornice and pilasters | Warm pale colour and detailed measurements estimated |
| `046j` | Otto-Wels-Haus, UDL48–56; Bundestag: current reconstruction, two-storey retail base, Italian-neoclassical composition | OSM pale colour, bounded window axes and continuous courses; includes adjoining street fronts |
| `0D1e` | Wagon-Lit, UDL40; LDA09030019: seven axes, dressed stone, tall ground arches and giant order | Seven shared avenue axes; simpler Mittelstraße return |
| `06Zy` | Zollernhof, UDL36–38; LDA09030018 and restoration/inventory texts: twelve axes, limestone, paired upper windows | Twelve axes across both halves, yielding 24 logical glass fields per upper row; no invented sculptures |
| `0BWA` | UDL32–34; Tchoban Voss: renewed natural-stone street facade and accessible main entrance | Street cladding only; black/gold courtyard treatment excluded |
| `06UP` | Two separate fronts: UDL28–30 / Daimler, LDA09075016, and UDL26 / Central-Bodenkredit, LDA09075015 | Separate palettes and five-axis plans; eastern count is a display estimate. Main-front giant orders are not copied to Mittelstraße |
| `04F9` | Haus der Schweiz, UDL24 / Friedrich155–156; LDA09030017: Muschelkalk, plain grid/window bands and arched retail passage | Restrained stone bands and stepped arch caps; no detailed sculpture |
| `0Amq` | Friedrich154 / Mittel55, Topas Arkade; LDA09095982: present pier composition and altered upper storey | Current simplified front; lost historic ornament not reconstructed |
| `0Bc9` | Upper Eastside, UDL14–16 / Friedrich88–89; gmp: several travertines, burnished bronze and commercial base | Distinct retained source planes, bronze framing and stone bands; source roofs/setbacks unchanged |
| `03zi` | Westin Grand, UDL37 / Friedrich157–164; LDA09040297: arcades, pilasters, cornices; sandstone-clad avenue piers | Sandstone evidence applies to piers; other wall colour is explicitly estimated |
| `02o1` | Schadowhaus10–11; LDA09065050 and inventory text: three storeys, seven axes, rustication/courses, northern portal | Seven shared front axes and asymmetric portal; no reconstruction of former courtyard buildings or speculative transfer to12–13 |

The Kaiserhöfe's shared LoD2 parent is not mistaken for one architectural front.
Retained OSM way 56179619 identifies UDL28–30 / LDA09075016 and way 56179624 identifies
UDL26 / LDA09075015. Their nearest subfront boundary is projected onto each
unchanged source wall. Paint and detail are clipped to those intervals rather
than assigning an entire crossing polygon by its midpoint.

UDL62–68's demolished Wiratex facade is deliberately not reconstructed. UDL39/41
are deferred because the checked text evidence did not establish a dependable
current facade programme. The present pass makes no claim to cover these gaps.

All RGB values, exact window sizes, storey spacing, member thickness and portal
placement are proportional display estimates. The documented axis counts and
architectural hierarchy are distinguished from those estimates. No tenancy,
interior, window survey or precise accessible entrance location is asserted.

## Source preservation and geometry

[`build_linden_corridor_v197.py`](../scripts/build_linden_corridor_v197.py) reads
the retained v169 source tiles 389_5819, 390_5819 and 390_5820. Only `core` parents in
the explicit profile are eligible. Ground-connected source walls must face an
allowed street with unobstructed approach rays. Sub-bay interval checks and
tests of every emitted glass opening guard against hidden/party-wall detail.

Shallow source-clipped coloured planes refine generic presentation; their source
walls and the original generic details remain stored beneath. Rectangular members
are clipped at source polygon seams, not dropped wholesale. Actual emitted glass
pieces are indexed in the evidence file, so the tests verify the visible fields,
not just an intended axis count. Small existing wall gaps remain visible.

The drawn member layers have deliberate physical separation between opaque frame
backing, glass and mullions for the viewer's large depth range. Only their outward
display offset changes; their measured wall projection does not. Native Minecraft
uses its own common 0.5m exterior lattice, with exact touching same-colour boxes
coalesced horizontally and vertically. No interior or gap is filled by coalescing.

Every parent keeps `buildingTerrainOffset` and its source datum (all thirteen
offsets are currently zero). No global height constant, camera change, texture,
new navigation surface, resident tile or city-coverage extension is introduced.

## Runtime and verification

`createLindenCorridorV197(native=false)` in
[`LindenCorridorV197.ts`](../src/app/src/LindenCorridorV197.ts) is one lazy object
in the existing outline-landmark lifecycle. Drawn uses one coloured plane mesh
plus one instanced member mesh; native uses one orthogonal instanced box mesh.
Day/night material pairs and disposal ownership follow the existing pipeline.
Touch receives the same detail.

| Property | Drawn | Native Minecraft |
| --- | ---: | ---: |
| Source-clipped paint triangles |500|—|
| Instanced boxes / exact coalesced runs |9,726|8,948|
| Additional draw calls |2|1|
| Geometry / instance GPU bytes |793,824|680,696|

The shared runtime JSON is 1,592,382 bytes raw / 148,964 bytes gzip. The detailed
offline evidence receipt is not imported by the runtime. No existing application
or package budget is increased.

Checks: nine Python source/ownership/visibility/axis/seam/depth-clearance/voxel-union/budget and
reproducibility tests; three Bun runtime datum/batch/ownership tests; TypeScript
and Ruff. Independent review checked actual glass fields, all drawn wall bounds,
OSM subfront attribution, owner exclusion and datums. Final scene screenshots
and mode/device checks are recorded by the main release audit.

Reproduce with:

```sh
uv run python scripts/build_linden_corridor_v197.py
uv run pytest -q tests/test_linden_corridor_v197.py
cd src/app
bun test tests/linden-corridor-v197.test.ts
```

# ULAP park and northern quarter — v1.0.57 sources

This step-10 refinement uses the present park and retained building envelopes
west of Hauptbahnhof. The ULAP park south of the railway and the planning area
north of the railway are distinct. Neither the 2022 competition proposals nor
the later framework plan are evidence of completed buildings.

## Source geometry

The retained `osm.gpkg` park way **4791783**, named
`Universum Landes-Ausstellungs-Park`, remains the metric park boundary. Its
world-space outline, in metres, is:

```text
[-368.698, -437.391]
[-471.357, -460.581]
[-491.615, -469.386]
[-454.860, -494.881]
[-407.000, -524.599]
[-365.023, -552.347]
```

The coordinate convention remains `x = easting - 389500` and
`z = 5820000 - northing`, with source coordinates in EPSG:25833.
Existing mapped vegetation and approach paths are retained.

A bounded [OpenStreetMap API snapshot](https://api.openstreetmap.org/api/0.6/map.json?bbox=13.3635,52.5225,13.3665,52.5238)
retrieved on 1 October 2026 supplies **31 bench positions** inside this
boundary. Nodes `3659325001`–`3659325005` and
`11750006489`–`11750006512` are backless benches without a material tag;
nodes `12917583798` and `12956905452` explicitly specify concrete. The
wooden treatment of the other 29 is a visual interpretation supported by the
landscape architect and photographs, not a newly surveyed OSM material value.
Bench lengths, orientation, slat spacing and light placement are display
estimates; exact node positions remain source-bound.

The main stair centreline comprises ways `1395945051`, `1395945053` and
`985355687`, from the park towards Alt-Moabit. Their recorded step counts are
5, 4 and 5. Connecting footways `1395945052` and `1395945054` also carry
`step_count=2`; `1395945055` branches sideways. All three stair ways specify
upward travel, stone paving and no handrail. Western ways `342098481` and
`342098512` specify 10 and 11 steps with handrails; footway `342098505`
connects them. Upper approach `361460040` is classified as a footway but
explicitly carries 11 steps and connects the main flight to Alt-Moabit.
Broad historic tread width,
fine tread subdivision and interruptions are procedural recognition detail;
they do not replace the recorded centreline or claim a measured stair survey.

## Existing landscape evidence

[Rehwaldt Landschaftsarchitekten](https://rehwaldt.de/de/p/ULA), the authors of
the completed 2008 park, describe a thin gravel surface over gently uneven
ground, a planted road embankment, retained trees on the old stairs and timber
box benches with night lighting. Their account supports these material and
spatial cues. No protected landscape drawing is traced or reproduced.

Berlin's [ULAP competition task description](https://www.berlin.de/sen/bauen/_assets/wettbewerbe/2022/ulap-quartier/a-ulap_quartier_aufgabenbeschreibung.pdf?ts=1752674593)
is used only for its description of the existing site: paragraphs 056–058
describe the grove and the partly accessible historic stairs; paragraph 109
states that the park lies approximately four metres below Alt-Moabit.
Paragraphs 033–039 distinguish the police complex, retained Urania hall,
single-storey Aldi and former laboratory. Proposed future layouts are excluded.

## Unresolved vertical-source conflict

The delivered park-path elevations are inconsistent with that published
four-metre relationship:

| Point | Source world coordinate, metres |
| --- | --- |
| Main stair toe | `[-424.980, 4.315, -479.050]` |
| Upper endpoint of the third main flight | `[-438.410, 3.936, -461.600]` |
| Nearby embankment tree root | `[-433.650, 6.541, -459.330]` |
| Nearby embankment tree root | `[-440.720, 6.717, -466.240]` |

The retained 16 m terrain grid interpolates to approximately 4.39–4.51 m
through the main stair. Nearby road-side tree roots are around 3.9–4.0 m.
An isolated four-metre stair rise would therefore float above the current
street representation. Raising a small terrain patch would create an
unsupported hump in the road and disconnect paths or vegetation.

This refinement retains the existing shared terrain and source tree heights.
Stair vertical subdivisions fit the delivered surface and remain approximate.
It does **not** claim to have reconstructed the full historic vertical grade.
A future correction needs verified Alt-Moabit cross-sections and consistent
ground, street, path, tree, walking and Minecraft elevations together.

Fifteen existing tree-position and trunk-radius fingerprints are retained
verbatim from the delivered `park-details.json` to leave openings through
the stair treads and landings. They do not create duplicate trees. A small
root clearance is an explicit display estimate. Western handrails follow
the same local grade as their treads. The 29 timber benches share a single
recessed-light batch; its night illumination follows the viewer's lights toggle.

## Northern quarter identities

Existing Geoportal Berlin LoD2 envelopes remain the metric building source.
The following associations were checked against bounded current OSM geometry
and the official site description:

| Building or complex | LoD2 parent | Additional source |
| --- | --- | --- |
| Landespolizeidirektion, Invalidenstraße 57 | `DEBE01YYK0002MpW` | OSM police site `4675996` |
| Retained Urania hall, Invalidenstraße 58 | `DEBE01YYK0002MoE` | OSM building `477318832`; LDA `09050426` |
| Adjacent four-storey office wing | `DEBE01YYK0002LQf` | OSM building `107225471` |
| Three-storey southern office | `DEBE01YYK0002Nle` | OSM building `477317194` |
| Southern police complex | `DEBE01YYK0002Lrm` | OSM police site `280370840`; site association only |
| Aldi, Invalidenstraße 59 | `DEBE01YYK0002NRe` | OSM building `142947685` |

The [Landesdenkmalamt record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050426)
identifies the old Urania hall within Rainer Gerhard Rümmler's police building.
The high hall reads as a blank red-brick volume, with curved, stepped masses,
light coping and a lower frontage. Window rhythms added to neighboring office
envelopes must not turn this hall into a generic glazed office block.

The former Landeslabor parent `DEBE01YYK0002Kui` remains in the committed
LoD2 evidence. It is absent as a standing building in the bounded current OSM
snapshot; [February 2026 reporting](https://www.entwicklungsstadt.de/abriss-fast-abgeschlossen-berlins-landeslabor-macht-platz-fuer-neues-hochhaus-quartier/)
describes its demolition as nearly complete. This conflict is recorded rather
than silently deleting the older source. The release does not add new detail
to that obsolete envelope or imply that a proposed replacement is built.

Berlin's [current planning page](https://www.berlin.de/sen/stadtentwicklung/staedtebau/umfeld-hauptbahnhof/ulap-quartier/)
distinguishes the framework plan and planning procedure from present buildings.
Unverified northern-quarter parts are left unchanged.

## Inspected, freely licensed visual references

All three photographs are external recognition references only. No photograph,
crop, photographic texture or protected plan is bundled or loaded at runtime.
Exact geometry continues to come from OSM and Geoportal Berlin.

| File | Author and licence | Use |
| --- | --- | --- |
| [ULAP Freitreppe.jpg](https://commons.wikimedia.org/wiki/File:ULAP_Freitreppe.jpg), May 2010 | S. Wetzel; [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Broad weathered stone treads, tree interruptions, narrow clearer passage |
| [ULAP Treppe zu Alt-Moabit.jpg](https://commons.wikimedia.org/wiki/File:ULAP_Treppe_zu_Alt-Moabit.jpg), March 2014 | Ulf Heinsohn; [public domain, PD-self](https://commons.wikimedia.org/wiki/Template:PD-self) | Gravel grove, low backless timber benches, planted bank |
| [Invalidenstraße 58 (Berlin-Moabit).jpg](https://commons.wikimedia.org/wiki/File:Invalidenstra%C3%9Fe_58_(Berlin-Moabit).jpg), July 2014 | Bodo Kubrak; [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Blank curved brick hall, pale coping and lower brick frontage |

Individual credits are to be mirrored in the packaged Wikimedia manifests.
Reference age limits certainty about temporary site furniture and construction
conditions; it does not establish current surveyed dimensions.

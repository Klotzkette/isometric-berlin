# Charité Bettenhochhaus — step 10, v1.0.107

The Campus Mitte tower receives a bounded procedural facade and roof-identity
overlay. Its previous 16 source prisms, original roof envelopes, ink contours,
native columns, campus buildings and Luisenstraße bridge remain unchanged.
There is no additional coverage, tour stop, photographic texture or resident
city-budget increase.

## Evidence and source retention

The [architect's project account](https://schweger-architects.com/projects/fassadengestaltung-charite-berlin/)
identifies the treatment zone as **EG–4.OG**, the ward zone as **5.–20.OG**, and
describes aluminium cladding with fine vertical lesenes and differentiated
profiles. Construction was 2015–2016. Thus the earlier four-level treatment
reading was incomplete; the new dark zone has five levels including the ground
floor. The [Charité construction report of 23 May 2016](https://www.charite.de/service/pressemitteilung/artikel/detail/charite_bauprojekte_kommen_weiter_gut_voran)
confirms the facade refurbishment and the separate bridge renewal.

External, actually inspected visual references are Leonhard Lenz's
[2021-04-29 02](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_Bettenhochhaus_Berlin_2021-04-29_02.jpg)
and [2021-04-29 05](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_Bettenhochhaus_Berlin_2021-04-29_05.jpg),
both [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
They guide paired narrow glazing, pale vertical profiles, the recessed plant
crown and the Charité wordmark. Photographs remain external; no pixels, traced
logo or font asset are included. The wordmark is original procedural block
lettering, including the acute accent. Per-file attribution records are retained
in the evidence receipt for the viewer's packaged reference manifest.

`geo_data/regierungsviertel/charite-bettenhaus-v207-source.json` preserves all
**28 official parts and 179 wall/roof sheets** of parent `DEBE00YY1Mr0004R`,
including original ground rings and holes, from Geoportal Berlin archive
`LoD2_390_5820.zip` (dl-de/zero-2-0). It also retains the exact earlier 16
runtime prism records and a bridge control record. The overlay uses only these
existing tall-owner IDs:

```
7b3ZwNAB 7zddOe6j 979qTCbp CNtAYPkO DQZmfONt FurjqyeB NDxiQ2xg OVVpwBo2
RE3bNP55 SgItUCXH Sorg80ps X4o3aH3m ZSiiyE0H aOZAupOd jwLw3UEy zq8O5Jct
```

The full source parent includes low campus attachments outside those IDs; the
new renderer does not take ownership of them. Bridge `L2e097lj` stays separate.
Source-suppression IDs are empty. Source coordinates and official NHN elevations
are retained independently of the existing viewer's `y0=5.2 m` presentation
datum. No source envelope is shortened to reconcile the historical published
82 m height with the taller technical source envelope.

## Display interpretation

The 21 facade levels share the existing 3.7 m presentation pitch. The treatment
zone ends at world `y=23.7 m`; sixteen ward levels sit above it. Exact source
wall courses receive 250 broad treatment panes, 2,144 paired ward panes, 92
continuous vertical lesenes and 1,072 fine paired-window mullions. Shared walls
and small rounding seams are excluded by testing a source-parallel line 20 cm
outside each wall against the retained neighbouring footprints.

The roof screen follows the three existing higher core owners. It has 104
uprights and 24 horizontal rails; the original core surfaces remain visible.
The procedural wordmark is placed on both long central core faces. Floor,
pane, profile, screen and lettering dimensions and palette are display estimates,
not additional survey measurements. Source-bound positions and architect-level
facts are kept separate in the receipt.

The source footprint spans world x **537.5–618.4 m** and z
**−868.4–−825.1 m**. Facade members remain within 0.5 m of this footprint;
the rooftop screen reaches world `y=97.15 m`. Thin decoration does not change
the existing source-derived roof or walking collision model.

## Native representation and budget

Minecraft uses axis-aligned thin facade tiles. Each tile is placed immediately
outside the actual retained 4 m tower column it would otherwise intersect.
The measured maximum source-column clearance is **2.9919 m**. Small outer
finish offsets keep panes, mullions and lettering outside their backing; the
maximum finished source-plane offset is **3.1919 m**. A further 130
derived decoration tiles inside recesses already closed by the old coarse cells
stay occluded rather than being projected outside the outer facade. No original
column, source recess record, building part or earlier native detail is removed.
Lower neighbouring clinics continue to occlude tower decoration naturally.
The native screen starts just above the retained coarse roof at `y=97.25 m`
and ends at `99.95 m`; its 2.8 m lift relative to the drawn screen is an explicit
native quantisation accommodation. The original roof cap remains unchanged.

| Representation | Main instances | Optional night instances | Stored GPU buffers | Batches |
| --- | ---: | ---: | ---: | ---: |
| Drawn, desktop and touch | 4,434 | 341 | 364,196 bytes | 2 |
| Minecraft, desktop and touch | 7,057 | 365 | 565,368 bytes | 2 |

Only the main batch is visible by day. Lit panes use the existing central
`nightOnly` / lights-off behavior and introduce no timer or animation loop.
Buffers have final counts, a single cube per batch, no UV attributes, static
transforms and finite culling bounds. Full static detail is identical on touch
and pointer devices.

## Integration and verification

`createChariteBettenhausV207(minecraft = false)` returns the bounded group.
`CHARITE_BETTENHAUS_V207_IDS` exports only the sixteen exact owners.
The production source builder disables only its old inferred four-level
facade through `includeLegacyChariteFacade: false`; the default remains true
for independent legacy callers. This flag must not gate source shells, original
ink or any other campus model. The new module is a separately lazy named-site
family. No native-column filter or navigation override is required.

Reproduction:

```bash
uv run python scripts/build_charite_bettenhaus_v207.py
uv run pytest tests/test_charite_bettenhaus_v207.py -q
cd src/app
bun test tests/charite-bettenhaus-v207.test.ts
```

Seven Python tests verify reproducibility, all retained tower/bridge records,
original voxel bytes, source-plane alignment, floor zones, bounded geometry
actual native-column clearance, visible lettering beyond its plaque and the
screen above the native roof. Three Bun tests verify exact allocated
buffers, complete static-mode parity, native axis alignment, finite culling
bounds, deterministic reconstruction and reversible night lighting. Production
daylight preview inspected during integration shows the paired panes, dark
base, source roof steps, open screen and readable wordmark. Full release and
multi-mode/mobile verification are recorded in the release review.

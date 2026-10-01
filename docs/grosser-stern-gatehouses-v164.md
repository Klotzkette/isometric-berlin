# Großer Stern gatehouses — v1.0.64

Pipeline step 10. Four separately anchored tunnel houses replace the earlier
oversized, closed sandstone boxes and round-column temple interpretation.
The new porticoes have four **square piers**, shallow pediments, restrained
entablatures, hipped rear roofs, narrow upper and lower side windows, stone
sills, ashlar joints, gutters, rear service doors and visible stair balustrades.
The front openings are actual empty geometry. Sixty-four individual treads
descend inside four bounded stair wells; no undocumented connecting tunnel
route is invented. The same full static model serves all four drawn modes on
pointer and touch devices. Minecraft has an independent orthogonal block model.

## Evidence and conflicts

- [Landesdenkmalamt Berlin, object 09050419](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419)
  identifies the four sandstone gatehouses, Johannes Huntemüller's restrained
  classical architecture and the 1939–1941 ensemble. Several Commons captions
  assign them directly to Albert Speer; the official architectural attribution
  takes precedence over those captions.
- Exact OSM ways `106952577`, `106952579`, `106953928`, `106953934` retain their
  four identities, complete outlines, two-level and hipped-roof tags. Original
  API extracts are retained locally under the ignored `raw/gatehouses-v164/`.
- Eight exact Berlin LoD2 parents from tiles `387_5819` and `388_5819` retain
  every source wall, roof and ground ring in the 25,306-byte source extract.
  Footprints supply the roughly 7.9 m width, 12.55 m main-body depth and
  approximately 2.2 m portico depth, separately oriented for each house.
- The eastern raw roofs rise 16.6–19.9 m above their source ground, incompatible
  with the western counterparts (7.9–8.4 m) and the inspected exterior. Their
  extraction likely includes vegetation, but that cause is an inference. **All
  incompatible raw surfaces remain in the source evidence**. The displayed
  7.98 m ridge and 6.65 m eave are explicit reference-bounded elevation fits,
  not a claim that the complete LoD2 roofs have been reproduced unchanged.
  The western north roof also has an asymmetric source ridge; the same
  photo-supported regular roof vocabulary replaces that display anomaly.
- Ground placement follows the existing path at world y = 5.245 m. Local
  window pitches, ashlar joints, column widths, stair depth, mouldings and
  small information-panel proportions remain procedural display estimates.
  Drawn pediment mouldings and stair handrails use continuous prisms; the
  separate native reading retains its orthogonal steps.
  The information panel contains geometric line cues, not copied plaque text.

The source export and checks are reproducible with
`uv run python scripts/build_grosser_stern_gatehouses_v164.py` after the
recorded local OSM extracts and official archives are available. No photograph,
texture, raw GML archive or external runtime URL is bundled.

## Inspected freely licensed references

| Commons file | Author | License | Used for |
|---|---|---|---|
| [Victorycolumnsubwayentrance.jpg](https://commons.wikimedia.org/wiki/File:Victorycolumnsubwayentrance.jpg) | Me677 | Public domain, author's release | Four square piers, shallow temple roof, upper/lower window rhythm, grey sandstone and cornices |
| [2018-08-04 DE Berlin-Mitte, Großer Tiergarten, Großer Stern (49488995837).jpg](https://commons.wikimedia.org/wiki/File:2018-08-04_DE_Berlin-Mitte,_Gro%C3%9Fer_Tiergarten,_Gro%C3%9Fer_Stern_(49488995837).jpg) | Paul Korecky | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | Open stair hall, descending stairs, thin dark handrails and staggered internal ashlar |

Both references are attribution-only records, mirrored in the source and
public Commons manifests by the release integration. Their photographic
pixels are not included in the viewer.

## Exact replacement and navigation contract

Only these eight prism identities are replaced:
`K0002QbK`, `K0003UBR`, `K0002ODQ`, `K0003Url`, `K0002UGA`, `K0003UFM`,
`K0002Ovc`, `K0003VYp`. The unrelated low wall `K0002RhR`, all roads,
park paths, the Siegessäule and monuments remain untouched.

`grosserSternGatehousesV164Profile.ts` exports their navigation envelopes,
source-column matcher, roof sampler, granular physical solids, entrance
clearance, four small central stair-well cut rings and a matching stair-floor
sampler. Stone floor margins surround the wells without bridging them, and
the retaining faces extend 2–7 cm inside the cut edge to cover the exposed
soil-coloured terrain faces. Outside those rings existing terrain stays intact. Original heavy
whole-footprint colliders must not close the newly open porticoes. The model
has no closed gate across its central walking approach.

## Verification and bounded cost

Five Bun geometry/source tests pass, including actual Three.js raycasts through
all four entrances, stone retaining faces covering the cut edges, granular
collision and entrance checks, exact replacement
identity, retained height conflict and native matrix orthogonality. Two Python
source tests pass; focused Ruff format/check pass. Independent CPU triangle
views from both sides were inspected; full scene GPU review belongs to root
integration.

| Reading | Draw calls | Instances | Stored geometry vertices | Rendered triangles | GPU attribute/index bytes |
|---|---:|---:|---:|---:|---:|
| Drawn, identical pointer/touch | 2 | 1,716 | 684 | 20,812 | 146,616 |
| Native Minecraft, identical pointer/touch | 1 | 24,635 | 24 | 295,620 | 1,872,620 |

One final local constructor sample took 4.9 ms drawn / 10.8 ms native. These are
host observations, not physical-iPhone performance guarantees. Geometry uses
one shared unit cube for repetitions, no photographic textures, immutable
transforms and no animation loop or persistent cache.

The deferred restored-road builder bypasses `createSmoothSurfaces`, so it now
applies the same exact four aperture cuts after decoding/indexing its original
paving/asphalt triangles. A cheap batch bounding-box guard avoids scanning
unrelated city batches. The production-data regression uses the actual
`restored-paving--4-0` and `restored-paving--3-0` batches at y = 5.30 m:
all original source vertices and unaffected index triples survive, every shaft
is open, and paving present 2 cm outside the cut remains. Kerbs stay unchanged.
No ParkDetails code or path-ribbon audit fixture changed; its complete audit
remains `17c5343aaf3fbbd9255bf12fee53c9733305d20f4699fbb0d25986ce295e26d0`
(3,233,924 bytes, 11 draws, 86,200 stored vertices).

A live production-scene ray probe identified the former green patch in the
stair hall as the rear vertical terrain-cut face sitting 3 cm in front of the
stone retaining wall. The local retaining-face adjustment corrects that exact
ownership conflict. The beige cap appeared only after the full seven-view QA
route loaded deferred restored paving: the centre ray hit `smooth paved paths`
under `restored-paving--4-0` at y = 5.30 m before the real tread at y = 2.89 m.
This was an independently constructed source-paving layer, not missing stair
geometry or a GPU rendering artefact. The restored-road aperture integration
fixes that precise branch. Visual QA must wait for the optional park root to
publish (`parkDetails.parent` and `parkDetails.userData.pathCount > 0`), the
core scene and surrounding-city queue, and trace the shaft after following the
full camera route so a direct-view pass cannot hide deferred-layer conflicts.

# Urania and Lützowplatz — v1.0.88

Pipeline step 10. This bounded addition preserves the complete prior City West
group, including every Urania entrance member, the source building packets,
all roads, paths, trees, public-art markers and the 93-place tour.

## Evidence and treatment

- **Urania:** retained OSM way [11687794](https://www.openstreetmap.org/way/11687794)
  identifies the venue. The retained official
  [LoD2 tile 387/5818](https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5818.zip)
  supplies parent `DEBE07YY900005Dq`, its 1,388.039 m² footprint and all 21
  original ground/wall/roof surfaces. Its NHN range is 34.676–49.411 m.
  The taller roof is 978.693 m² and is distinct from the lower rear wing.
  `urania-luetzow-v188-source.json` keeps every source vertex and the archive
  hash; the viewer translation is `y = NHN − 34.676 + 5.2`.
- The old `11687794` source prism and authored Urania model use a 9 m
  fallback. The new source-bound upper walls start at their existing
  `y=14.2 m` top and finish at the official `y=19.935 m` roof. The entire
  older model stays byte-identical. No new full footprint slab closes the
  entrance, and the lower rear wing is not raised to the main roof height.
  The northward part of the old proportional model remains an inherited
  approximation rather than being silently removed in this modest revision.
- The operator's [venue account](https://www.urania.de/urania-berlin/) supplies
  institutional identity. Its own freely licensed 2019 photograph supports
  the mirrored front/return, dark square joints, yellow sign and low colourful
  entrance. Thin source-plane grids and a code-built `URANIA` sign refine the
  existing entrance. Grid pitch, sign size, colour swatches and subdivisions
  are display estimates. Roy Zuo's 2024 photograph shows temporary scaffold:
  it is recorded as dated condition evidence, not copied into an asserted
  current construction state. No competition proposal is modelled.
- **Lützowplatz:** exact retained OSM park
  [11405245](https://www.openstreetmap.org/way/11405245) contains all additions.
  [LDA record 09097834](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09097834)
  identifies Eberhard Fink's listed 1965–1966 garden.
  [Haus am Lützowplatz's account](https://www.hal-berlin.de/ueber-uns/der-luetzowplatz/)
  distinguishes the destroyed historical Herkulesbrunnen from the present
  sculptures. This revision does not invent a restored historical fountain.
- The three current basins use exact nodes
  [4360435502](https://www.openstreetmap.org/node/4360435502),
  [4360435503](https://www.openstreetmap.org/node/4360435503) and
  [4360435504](https://www.openstreetmap.org/node/4360435504).
  Singlespeedfahrer's 2022 CC0 photograph confirms separate square exposed-
  aggregate rims and single central jets. The 4 m display side, 0.56 m rim,
  water tint and small static jet are conservative estimates, not a surveyed
  basin polygon or live claim about fountain operation.
- Thirteen actual small OSM lawn islands get thin edge members, and eight
  mapped internal paths get narrow edging. Exact original and clipped courses
  remain in evidence. Untagged path widths use an explicit 2 m display value.
  All members use the retained local ground datum `y=5.2 m`. No replacement
  lawn/paving plate, speculative flowerbed, extra tree, furniture or sculpture
  occupies the preserved open garden. Existing neighbourhood buildings remain
  eligible for the separate source-bound district facade pass.

## External visual references

All three records are supplied in `urania-luetzow-v188-credits.json` for the
source and shipped attribution manifests. Photographs remain ignored local QA
references; no image, crop, logo, font, photograph-derived texture or scaffold
scan is bundled or loaded.

| File | Author/date | Licence | Role |
| --- | --- | --- | --- |
| [Gebäude der Urania Berlin .jpg](https://commons.wikimedia.org/wiki/File:Geb%C3%A4ude_der_Urania_Berlin_.jpg) | UraniaeV, 8 May 2019 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Permanent mirrored facade/sign hierarchy |
| [(20240407) Berlin 12.jpg](https://commons.wikimedia.org/wiki/File:(20240407)_Berlin_12.jpg) | Roy Zuo, 7 April 2024 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Dated scaffold conflict; no asserted 2026 scaffold |
| [Fountain Lützowplatz Eberhard Fink Berlin-Tiergarten.jpg](https://commons.wikimedia.org/wiki/File:Fountain_L%C3%BCtzowplatz_Eberhard_Fink_Berlin-Tiergarten.jpg) | Singlespeedfahrer, 5 September 2022 | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Three independent square basins and rims |

## Delivery and checks

`createUraniaLuetzowV188(minecraft)` installs only the active representation.
Urania and the garden use two independent final-count instance batches; their
bounding spheres stay below 90 m for ordinary spatial culling. Drawn modes add
one exact official roof mesh. Minecraft uses axis-aligned segmented members
and a surface-only roof, with no smooth double or hidden building fill.

| Representation | Calls | Instances | Instance bytes |
| --- | ---: | ---: | ---: |
| Drawn, same detail on pointer/touch | 3 | 458 | 34,808 |
| Native Minecraft | 2 | 2,708 | 205,808 |

Including cube/roof attributes and indices, drawn geometry stays below 38,000
bytes and native below 210,000 bytes. There is no new texture or larger global
residency budget. Source reconstruction uses
`uv run python scripts/build_urania_luetzow_v188.py`; committed bounded evidence
allows rebuilding the runtime data without raw downloads.

Focused checks cover exact roof vertices/upward normals, source parent and
original surface completeness, upper-extension start, garden containment,
three distinct OSM basin anchors, native axis alignment, final-sized buffers
and local culling bounds. The existing full City West preservation tests also
pass, including its frozen unrelated model hashes.

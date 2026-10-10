# Russian Embassy and Aeroflot / Trade Mission — v1.0.108

Pipeline step 10. This bounded refinement uses the existing sixteen-part
Russian Embassy parent `DEBE01YYK00003En` and Aeroflot / Russian Trade Mission
owner `DEBE01YYK00001vY`. No district coverage, source packet, road, ground,
tree, navigation barrier or tour stop changes.

## Evidence and visible correction

The [Landesdenkmalamt record 09075006](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075006)
establishes the embassy's recessed court, rusticated podium, colossal order,
stone facade and tower. The existing v148 front, lantern, four figures and
forecourt fence remain. Its complete source shell already retained every roof,
wall and courtyard, but return and rear walls had little architectural detail.
This addition gives exposed source-bound return walls pale stone courses,
recessed blue-grey panes, jambs, transoms, sills and cornices. The five existing
front axes receive small rustication joints and shaped column collars/capitals.
The real chimney stays a chimney, without invented windows.

The retained Aeroflot front recipe used **eight** equal window axes. Inspection
of the existing freely licensed photograph shows **twelve** framed axes over
four floors, narrow blue lower window fields, a wider square concrete screen,
cream panels, separate roof letters and a repeated chevron rail. The new model
corrects that exact authored recipe, keeps its original measured envelope and
adds the separate Glinkastraße return. It does not assert present-day airline
operations; Aeroflot is the owner-requested architectural identity evidenced by
the 2010 reference. The free-standing letters have supports and no solid sign
board. The concrete screen uses separate members above a recessed shadow plane;
its physical backing remains the original coarse source wall, not a new
invented opening cut through the retained LoD2 shell.
Both inscriptions read left-to-right from Unter den Linden; their glyph X
direction is opposite the retained source edge order, keeping their centres,
heights, supports and all facade geometry unchanged.

Metric edges and vertical envelopes come from the unchanged
`unterDenLindenSource.json`. The embassy's established +3.527 m source-to-viewer
translation and Aeroflot's established 5.2 m display facade datum are retained.
The generator uses each return's actual source wall eaves rather than a higher
roof ridge to constrain upper windows. Aperture positions, stone subdivisions,
colours, lattice pitch and ornaments remain reference-guided display estimates,
not surveyed architectural drawings.

## Retention and Minecraft

`geo_data/regierungsviertel/embassies-v208-source.json` retains the entire earlier
source supplement, original Aeroflot prism, the relevant native columns and
SHA-256 receipts for all unchanged inputs. All seventeen named source parts and
their complete sheets remain available and rendered. The only substitution is
`addAeroflot` in the two earlier facade factories; their new
`includeLegacyAeroflot` option defaults to true so historical constructors and
fixtures stay unchanged. Production passes false and attaches the v208 model.
All unrelated Unter-den-Linden contributors are unchanged.

Minecraft uses its own orthogonal, surface-only geometry. The Aeroflot detail
is fitted outside the full retained four-metre column envelope, not merely at
window centres. The maximum additional source-column clearance is 2.314568 m.
The seventeen named owners are explicitly absent from the separate v169
ownership set; no overlapping v169 source shell is assumed away. The retained
embassy's independent thin native wall/roof shell remains unchanged. Native
lettering and chevrons are small axis-aligned blocks. There is no hidden solid
infill or native smooth double.

## Visual references and licence

Both photographs were re-opened and inspected on 10 October 2026. Existing
per-file credits in both Wikimedia attribution manifests are reused. No new
photograph, crop, atlas, pixel texture or image loader is packaged.

- [Russian Embassy, Unter den Linden 55–65](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_55-65,_Russische_Botschaft.jpg),
  Jörg Zägel, 2 April 2010, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- [Trade Mission / Aeroflot, Unter den Linden 51–53](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_51-53,_Handelvertretung_der_Russischen_Foederation.jpg),
  Jörg Zägel, 25 March 2010, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

Official Berlin LoD2 remains dl-de/zero-2-0; the existing OSM identities remain
ODbL-1.0. Earlier source and reference dates are distinguished from this model's
2026 revision.

## Budget and checks

| New v208 family | Draws | Instances | Rendered vertices | Typed-buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Full drawn / touch / pointer | 2 | 4,938 | 122,976 | 379,920 |
| Separate native | 1 | 16,518 | 396,432 | 1,256,304 |

The figure is the additive family before subtracting the exact superseded
Aeroflot recipe. Materials/buffers are world-owned, frozen and texture-free;
there is no camera-distance geometry population or touch-detail reduction.
The compact prepared JSON is 1,505,613 bytes, SHA-256
`2667d8e4dd302ab715cf9e865183c5bc1b1655e433157a9be64bf1c157576afb`.

Reproduce with `uv run python scripts/build_embassies_v208.py`. Four focused
Python checks pass for exact regeneration/source retention, twelve-by-four
apertures, complete native pane/source-column separation, and actual-eaves
constraints. Five focused Bun checks pass for bounded/frozen buffers, native
orthogonality including letters, street-facing lettering direction in both
representations, the exact Aeroflot opt-out/unrelated facade preservation and
world-owned disposal. The lettering check reproduced the mirrored failure
before correction using the front-facing camera's screen-right vector.
Ruff passes for the generator and tests.
Integrated viewer screenshots and complete release checks are handled by the
parent release review; these unit checks do not claim a physical iPhone test.

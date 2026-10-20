# Kulturbrauerei and nearby street fronts — v252 / Step 10

The spoken “oder Berger Straße” is interpreted as **Oderberger Straße**, next
to the requested Eberswalder Straße, Sredzkistraße and Kulturbrauerei. This
bounded addition preserves all existing measured bodies, roofs, open courts,
street surfaces, navigation solids and earlier facade details.

## Source and architectural distinctions

The brewery operator's [history](https://www.kulturbrauerei.de/gelaende/geschichte/)
identifies the nineteenth-century industrial ensemble, restored clinker
facades and six courts. Its [visitor guide](https://www.kulturbrauerei.de/gelaende/guide/)
identifies the entrances at Sredzkistraße 1, Knaackstraße 97 and Schönhauser
Allee 36. The [Berlin account](https://www.berlin.de/sehenswuerdigkeiten/3560308-3558930-kulturbrauerei.html)
confirms the red-brick industrial character. These references were checked
20 October 2026; no website photograph, site plan, lettering or texture is used.

The twenty measured brewery owners and their complete v190 source sheets
remain. Each new brewery member follows an existing v185 arched aperture:
one fine crossbar and one small reflection in its rectangular lower portion.
The arch, central mullion, surrounding masonry, roof and court remain visible.
The new members are graphic display estimates, not surveyed glazing bars.

The retained OSM road inventory selects nearby ordinary street fronts.
Each new face must have both complete wall triangles present in its current
delivered source packet. Party walls, blocked approaches, authored owners,
source-marked public buildings and mapped material-specific buildings are
excluded. Buildings such as the former Stadtbad and fire station cannot acquire
an ordinary window grid merely because they face Oderberger Straße.

There are **70 previously unfitted faces on 61 source owners**:
45 Oderberger, 24 Eberswalder and one Sredzkistraße face. Glazing, lintels, sills
and central mullions remain shallow against the original wall. Storey counts
use unambiguous mapped levels where they fit the retained envelope; untagged
window spacing, fitting sizes and colours are explicit display estimates.

Sredzkistraße already has 36 v209 fitted fronts. Their **560 drawn / 413 native
panes** are independently matched against both actual delivered triangles
before adding a narrow lintel and side reveal. There is no second window grid,
replacement pane or overwritten sill/transom. All old OSM/LoD2 sources retain
their existing ODbL-1.0 and dl-de/zero-2-0 notices.

## Compact integration and preservation

`appendKulturbrauereiV252(rows, native)` appends to the existing
`NorthV185` Kulturbrauerei box batch. It adds no streaming descriptor, mesh,
material, texture, animation, navigation body or tour stop.

| Family | New ordinary panes | Retained Sredzki panes accented | Added instances | Added matrix/colour bytes |
|---|---:|---:|---:|---:|
| Full drawn desktop/mobile | 1,048 | 560 | 6,236 | 473,936 |
| Independent native | 1,192 | 413 | 6,518 | 495,368 |

The native street faces use **209 separate actual orthogonal source-wall
spans**, plus the independently retained v209 native glazing. Brewery details
follow the previous block reading with axis-aligned boxes; no rotated drawn
box becomes a native building. The runtime recipe is **150,137 bytes**
(22,680 bytes as deterministic gzip). Full offline source evidence is 204,092
bytes compressed. Existing batch lifetime, mobile quality and live residency
budgets remain unchanged.

The source snapshot stores current packet SHA-256 receipts, full ordinary
source-building records including court holes, old glazing evidence and all
48 selected brewery wall polygons. No old packet or authoring file is edited.
The four Python checks verify unchanged inputs/packets, complete source-wall
matches, both triangles of old panes and member containment. Three Bun tests
verify fixed instance counts, finite transforms, deterministic additive output
and independent native wall axes.

Rebuild with `uv run python scripts/build_kulturbrauerei_v252.py`.
Validation: `uv run pytest -q tests/test_kulturbrauerei_v252.py` and
`bun test tests/kulturbrauerei-v252.test.ts` inside `src/app`.

| Camera | Eye | Target |
|---|---|---|
| Brewery overview | 2800, 50, -2050 | 2910, 14, -2210 |
| Oderberger | 2420, 24, -2290 | 2480, 11, -2220 |
| Eberswalder | 2500, 30, -2420 | 2470, 12, -2375 |
| Sredzki | 3080, 25, -2020 | 3080, 12, -2140 |

# Hippo Bay / Flusspferdhaus — Step 10, v256

This bounded addition refines the existing Zoo Berlin west hippopotamus house
at OSM way `17042389`, inside the retained v165 Zoo site. It preserves both
complete official owners, `DEBE01YYK0002NM4` and `DEBE01YYK0003VAC`, all 480
wall/roof surfaces, their transparent treatment, every earlier zoo detail and
the unchanged walking/roof profile. There is no new footprint, source owner,
streaming descriptor, render call, animation or texture.

## Identity, evidence and limitation

The [Zoo's current Hippo Bay account](https://www.zoo-berlin.de/en/explore-the-zoo/hippo-bay)
identifies the existing double-glass-dome house as opened in **1997**, with
approximately 1,000 m² of glass and more than 800 panes. The user's “new”
hippopotamus house is interpreted as this building. The inspected sources do
not establish a new or completed replacement in 2026. It remains distinct
from the 2023 Nashorn-Pagode, whose v255 geometry is unchanged.

[Structural engineer schlaich bergermann partner](https://www.sbp.de/en/project/house-for-hippopotamus-zoo-berlin/)
credits architect J. Gribl and gives two unequal 29 m / 21 m spans, a 1.20 m
quadrangular mesh and 60 × 40 mm steel grid beams. Its aerial reference
photograph, **© SNOWBOUND**, shows the joined roof and concave visitor facade.
The [Glas Trösch / OKALUX project account, 23 September 2016](https://www.glastroesch.com/de/de/referenzen/okalux-referenzobjekte/okalux-referenz/flusspferdhaus-zoologischer-garten)
also describes the continuous doubly curved glazed net shell and the hall
cutting into the two basins. These are reference accounts; no photographs,
protected plans, image pixels or textures are bundled.

**Geometric limitation:** retained LoD2 represents this curved roof with three
broad triangulated sheets (230 roof triangles), rather than the actual smooth
double curvature. The new grid follows those exact elevations. This improves
the steel-and-glass reading but does not turn the existing roof into a surveyed
curved reconstruction. No overlapping second dome or hidden replacement sheet
conceals the complete source.

The addition contains 2,630 source-plane-clipped roof-frame segments, all 227
exact perimeter segments and 66 slim facade posts. The 1.20 m grid pitch follows
the engineer's published nominal mesh. Its fitted 35° bearing, phase, visible
60 mm strip width, 130 mm perimeter trim, muted steel hue and 3 m post spacing
are display estimates; the model does not claim individual surveyed panes or
an exact as-built panel count. All original source coordinates are unchanged.
Trim sits 18–25 mm above source sheets, as decorative facade/roof fittings.

## Preservation and budgets

Drawn trim shares the existing structural/surface batches, with identical full
detail on touch and pointer devices. Only the existing decorative surface
batch now shares vertices with exactly identical Float32 positions and colours.
Its indexed triangle order and winding reproduce every prior v165/v255
position and colour. Source building and ground batches remain untouched.
The immutable render receipt was measured independently from commit `c68145d6`;
tests expand the new index and verify the complete old triangle/instance hashes.

Native uses 1,120 separate orthogonal roof bars on 3 m grid courses and 66 posts.
The bars occupy retained one-metre source cells and finish flush with the
existing native roof ceilings. It contains no smooth mesh, rotated native
member or raised replacement roof; existing navigation remains authoritative.
This is a separately constructed native interpretation, without a mobile split.

| Complete Zoo family | Render calls | Instances | GPU buffer bytes | Unchanged ceiling |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 6 | 9,985 | 2,297,524 | 3,300,000 |
| Native | 3 | 98,374 | 7,477,504 | 7,500,000 |

The compact source addition is 266,682 JSON bytes. All v165 source/evidence/
navigation bytes, the v255 recognition source and implementation, and both
existing roof profiles have independent unchanged SHA-256 receipts in
`geo_data/regierungsviertel/zoo-hippo-v256-evidence.json`. The rendered
preservation fixture is `zoo-hippo-v256-render-preservation.json`.

Ten Zoo Python tests and eight Zoo scene/navigation tests pass, including
independent roof-plane interpolation at every new bar's endpoints/midpoint,
exact perimeter preservation, native source-cell/roof agreement, orthogonal
output, old rendered triangle/instance hashes and fixed total buffer ceilings.
TypeScript compilation passes. Parent release checks cover the complete viewer.

Rebuild with `uv run python scripts/build_zoo_hippo_v256.py`. Suggested camera:
target `[-2397, 11, 1030]`, distance 70–90 m, from west/southwest to see both
unequal roof lobes and the concave public side. A lower east-facing view from
`[-2448, 24, 1050]` toward the same target shows the retained glass enclosure.

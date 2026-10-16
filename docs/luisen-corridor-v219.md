# Luisenstraße 39 corner correction — v219 / step 10

This continuation changes **one** still-generic exterior edge in the retained
Luisen/Schumann/Reinhardt corridor. The `K6XkZ7CC` edge from `(581.7,-308.4)`
to `(581.5,-310.7)` is 2.308679276 m long and faces Luisenstraße. It belongs to
the small retained corner wedge of the Mori-Ôgai building, not a new building.
The diagonal adjoining `NOebyeyV` edge is an internal join covered by this
wedge and must not receive a second facade. None of the four v218 edges changes.

## Evidence and exact correction

Verified 16 October 2026:

- Humboldt-Universität's [Mori-Ôgai contact page](https://www.ogai.hu-berlin.de/contact-en)
  confirms the memorial's Luisenstraße 39 identity.
- [Berlin, Mitte, Luisenstrasse 39, Mietshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Luisenstrasse_39,_Mietshaus.jpg),
  **Jörg Zägel**, **24 April 2010**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  The original 1739 × 1446 image was inspected. Commons SHA-1:
  `d3717dbebcf6bf0491cb2b8acf79956e310ffce9`.

The reference shows a closed first upper corner and two tall brick-colour
fields above, separated by pale horizontal bands. The previous generic recipe
placed three upper glazed window groups there, with surrounds, sills and
individual cornices, plus three drawn eaves dentils. Only those inaccurate
corner fittings yield to the more specific reference. The ground shop group
and continuous eaves remain unchanged. No lettering or present occupant sign
is inferred. The other side of the corner and every neighbouring street/window
row retain their previous geometry.

Two shallow alternating ochre/red-brown fields replace the upper window groups.
Their widths, heights, colour swatches and band subdivisions are proportional
display estimates, not measured brick courses. The drawn form uses 16 bands per
field; the separate block-native form uses eight. Both fit the same original
source edge and eaves. The source wedge retains its exact planar envelope; no
surveyed rounded facade or current 2026 condition is claimed from a 2010 image.

The photo is already credited in both
`geo_data/regierungsviertel/wikimedia_references.json` and the packaged
`src/app/public/dzi/regierungsviertel/wikimedia_attribution.json`. Retain those
credits and the viewer's existing Wikimedia notice. No new image, crop,
texture, font, source part, fetch or scene root is shipped.

## Preservation and measurements

The 120 source parts, all holes, heights, roofs, road axes and dedicated landmark
owners remain unchanged. The new regression records SHA-256 hashes captured
from v218 for the entire ordered block plans outside the single selected edge,
covering drawn and native geometry. This also protects all v218 details and
courtyard facades. Touch and pointer plans remain identical within each family.

| Family | Instances | Geometry / instance array bytes | Existing ceiling |
| --- | ---: | ---: | ---: |
| Drawn | 24,020 | 1,826,168 | 1,840,000 |
| Native blocks | 11,293 | 858,916 | 860,000 |

The drawn difference is **+5 instances / +380 bytes**; native is **−2 instances /
−152 bytes**. Each retains two draw calls and one shared 24-vertex cube. No
global residency allowance changes. The three removed panes per family are
the documented false corner windows, not a performance detail reduction.

The dedicated regression checks exact scope, unchanged neighbouring block
hashes, closed upper corner, both brick fields, source-envelope limits, no
neighbour-body intersection, actual native-cell ray visibility, mobile equality
and both unchanged storage ceilings.

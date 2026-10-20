# Zoo Berlin west recognition — Step 10, v255

This bounded addition refines the existing Zoologischer Garten Berlin, distinct
from Tierpark Friedrichsfelde. It shares the complete v165 Zoo root and its
existing six drawn / three native batches. There is no new streaming descriptor,
texture, animation, tour stop or coverage. Both drawn device profiles receive
the same detail. The complete previous sources and earlier authored geometry
remain present.

## Source-bound additions

**Nashorn-Pagode.** The retained OSM evidence contains tower part `1557644530`,
with `height=25`, inside rhino-house way `1102580371`. The v165 LoD2 body reaches
only 12.35 m above its display ground. That height conflict is recorded in
`geo_data/regierungsviertel/zoo-recognition-v255-evidence.json`; it does not
justify deleting or flattening the complete measured house. The addition fits
inside the complete mapped tower ring, centred at `[-2478.571958, 1068.200260]`.
The operator's [23 June 2023 opening account](https://www.zoo-berlin.de/de/aktuelles/news/artikel/eroeffnung-der-nashorn-pagode-im-zoo-berlin)
documents a 25 m red concrete tower of 18 levels and lotus ornament. Its
[construction account and photograph](https://www.zoo-berlin.de/de/aktuelles/news/artikel/einblicke-in-neue-erlebniswelt)
show the taper, open horizontal bands and gold crown above the low circular
ETFE roof. The model adds those recognition features with estimated 7.05 m
fitted base width, band spacing, taper and relief strokes. It does not alter the
existing measured house or roof. The crown ends at world `y=30.2`, preserving
the published 25 m relative to the existing `y=5.2` ground.

**Antilopenhaus.** The operator's
[current house photograph and history](https://www.zoo-berlin.de/de/aktuelles/news/artikel/180-jahre-berlin-antilopenhaus)
support the pale pointed entrance surround, alternating blue and buff pier
bands, slender minarets and green onion finials. The fittings use the actual
corner vertices and front plane of retained part `DEBE3DlyqEefwivU`, inside
house way `16970136`. All six existing building parts, their complete roofs
and their previous facade windows remain. The four minaret shafts and finials
rise an estimated 6.2 m above the retained pavilion roof; their radii, arch
subdivisions, colours and shallow band depths are display estimates, not
survey measurements. The documented 21 historical doors are not used to invent
a new 21-door distribution on the current facade.

**Main adventure playground.** The full retained way `25415847` is authoritative
for its outline. The existing park-details payload already contains the same
site with no mapped equipment. The Zoo's
[2019 annual report, printed page 50](https://www.zoo-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_AG_2019.pdf)
documents completion of the present playground, after replacement of the former
ship, and shows timber climbing towers, open timber roofs and steel slides.
Three restrained towers with plank/rope links and slides represent this current
type of equipment. Their internal positions and dimensions are explicit display
estimates within the middle of the mapped playground, not surveyed fixtures or
a traced plan. Every equipment envelope lies inside the source ring and outside
all retained path corridors. Existing source trees, sand/ground and surrounding
habitats are untouched.

**Green habitat details.** Eighteen small illustrative reed clusters are
restricted to the mapped rhino habitat `1185284028`, beside retained pond
boundaries, and excluded from water, measured buildings and path corridors.
Their positions are repeatable estimates, not a new tree inventory. Every
existing pond, green surface and route remains intact.

The [official Zoo overview](https://www.zoo-berlin.de/de/tickets-service/zoo-plan)
is identity/orientation evidence only. No protected visitor map is traced.
Operator photographs and annual-report illustrations are reference-only;
no pixels, copyrighted plan or texture are bundled or loaded by the viewer.
Metric evidence remains OpenStreetMap contributors (ODbL-1.0) and retained
Geoportal Berlin LoD2 (dl-de/zero-2-0).

## Lifetime, navigation and validation

`appendZooRecognitionV255` appends instances and surfaces to v165's existing
details arrays before those arrays are packed. The same disposal, freezing,
lighting and runtime visibility apply. Native geometry is independently
orthogonal; turned ornaments use bounded stacked blocks and sloping slides use
separate steps. It never adds smooth meshes to Minecraft.

The pagoda's structural bands and crown add matching roof support to the
existing Zoo roof query. The independent native query follows the actual
axis-aligned row cells. It takes the maximum with the unchanged retained roof;
outside this tiny tower the old query is unchanged. Tiny ornament, playground
furnishing and minaret trim follow the existing decorative v165 treatment.

Measured complete Zoo model after this addition:

| Family | Existing render calls | Instances | Buffer bytes |
| --- | ---: | ---: | ---: |
| Drawn | 6 | 9,919 | 3,221,284 |
| Native | 3 | 97,188 | 7,387,368 |

These remain below the already enforced 3,300,000 / 7,500,000 byte ceilings.
The v165 source JSON, evidence JSON, navigation JSON and delivered park-details
hashes are unchanged and independently checked. Seven Python source/placement
tests and six Zoo scene/navigation tests pass; `bun --bun tsc -b --pretty false`
passes. The native roof test samples actual output matrices independently of
the roof formula. General release/browser verification belongs to the parent
v255 release review.

Suggested camera targets, in the existing world coordinates:

- Pagoda: `[-2478.57, 18, 1068.20]`, distance 70–100 m, view from the southeast.
- Antilopenhaus entrance: `[-2328.37, 14, 1223.56]`, distance 65–85 m,
  view from east/northeast.
- Main playground: `[-2278, 8, 1025]`, distance 50–75 m, view from south.

Rebuild the small anchor and preservation receipt with
`uv run python scripts/build_zoo_recognition_v255.py`.

# Russian Embassy and Altes Museum — v1.0.48

Pipeline step 10. The owner requested a further, bounded architectural
refinement. No release-boundary or 93-stop catalogue change is involved.
Original `unterDenLindenSource.json` and `domAltesMuseumSource.json` are
unchanged. The Dom, granite bowl, Aeroflot, Einstein, Komische Oper and Dussmann
keep their existing model contributions.

## Embassy: the actual source roofs and the misplaced lantern

The complete sixteen-part LoD2 parent `DEBE01YYK00003En` was already retained in
v147, but still displayed through generic height prisms. The new
`RussianEmbassySourceGeometry.ts` renders every original wall and roof sheet.
The exact source rings, roof slopes, sixteen identities and intervening courts
remain. Source ground 1.673 m receives one documented +3.527 m translation to
the established 5.2 m street datum; source heights and roof pitches are
unchanged. Original source data remains packaged. Only the matching old runtime
prisms / source-intersecting native columns are superseded. Native replacement
is exterior walls and one thin roof course, not filled building volumes.

The [Landesdenkmalamt record 09075006](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075006)
establishes the four-storey composition, recessed Ehrenhof, colossal fluted
half-columns, square lantern, four sandstone figures and enclosure with paired
porter houses. The existing permitted Jörg Zägel photograph was inspected again.
It supports five window axes between six colossal columns on the outer
pavilions, the tall central window group, stone joints, arch heads and stepped
cornices. These are procedural subdivisions fitted to the existing five exact
street-facing LoD2 edges, not new measured facade data.

A concrete placement error was corrected: the previous authored lantern used
`[797.78,357.151]`, the narrow rear source chimney
`DEBE3DmaCMlAOled`. The [official DOP 2025 spring aerial](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
(`dop_2025`, EPSG:25833 box `390240,5819580,390380,5819730`, inspected
30 September 2026) shows the actual square lantern on the **front central
risalit**, about 33 m north. Its new display centre `[805.25,325.5]` is an
aerial fit with approximately one-metre placement uncertainty. The former
anchor remains explicit as conflict metadata. The real rear chimney remains
in the exact source shell. The square open lantern, four corner figures and
flag receive procedural subdivisions. Their local heights/member sizes are
visual fits, not surveyed heights. The enclosure follows the two retained
front-wing source corners; its bars, small guardhouses and gates are display
fits to the documented forecourt. No district-wide terrain or road is removed.

## Altes Museum: Ionic order and two different bronze groups

The 18-column source-bound colonnade retains its full deck and both courts.
Each drawn shaft now has 24 taper-following grooves, moulded base courses,
four spiral faces, an ovolo/egg rhythm and an abacus. Minecraft has its own
bounded, coarser block-native spiral and groove reading.

Close WebGL inspection found the previous authored entablature extended to
local `v=6.85`, while the original deck ends near `v=3.42` and the columns are
at `v=2.6`. This oversized, 4.25 m front overhang hid the capitals. The
procedural entablature now runs from `v=-3.85` to `v=3.85`, with inscription,
dentils and coffers following it. Source roof sheets are untouched; collision
and elevated support use the same corrected width. The local moulding and
capital dimensions remain procedural estimates.

The two groups are **cast bronze**, not marble. Their measured location comes
from the previously retained exact OSM anchors; the existing generic monument
suppression already delegates both nodes to this family.

| Side | OSM node / world X,Z | Work / source | Published sculpture height |
| --- | --- | --- | --- |
| West | `4353173360` / `1860.436566,15.845902` | [Löwenkämpfer](https://bildhauerei-in-berlin.de/bildwerk/loewenkaempfer-5364/), Albert Wolff after Christian Daniel Rauch | 4.45 m |
| East | `4353173363` / `1887.187458,-0.040784` | [Amazone](https://bildhauerei-in-berlin.de/bildwerk/amazone-4936/), August Kiß | 3.6 m excluding lance |

The western horse faces outward west and rears above a supine lion with a
large mane and raised paws. The eastern horse faces outward east while a
panther attacks its chest; the curled tail, draped rider and transverse lance
keep this group distinct. Both receive separate shoulder/quarter/neck masses,
jointed open legs, hooves, muzzles, ears, reins, rider limbs and drapery. The
published heights are retained as evidence; individual anatomical proportions
and exact lance angles are procedural approximations. No sculpture scan,
photographic texture, inscriptions or protected text is copied. A single shared
bronze primitive uses bounded vertex-tone shading so the modelling remains
legible in the unlit isometric daytime style. The existing Dom sphere primitive
and its materials remain untouched.

## External photographs and licensing

All photographs were inspected locally as external visual references only.
No image, crop, texture or image loader is bundled or used at runtime.

- Reused [Berlin, Mitte, Unter den Linden 55–65, Russische Botschaft.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_55-65,_Russische_Botschaft.jpg),
  Jörg Zägel, 2 April 2010, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- New [Löwenkämpfer (Berlin, Altes Museum).jpg](https://commons.wikimedia.org/wiki/File:L%C3%B6wenk%C3%A4mpfer_(Berlin,_Altes_Museum).jpg),
  Yair Haklai, 27 July 2019, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- New [Amazone zu Pferde by August Kiss (Berlin, Altes Museum).jpg](https://commons.wikimedia.org/wiki/File:Amazone_zu_Pferde_by_August_Kiss_(Berlin,_Altes_Museum).jpg),
  Yair Haklai, 27 July 2019, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The new per-file records are mirrored in both attribution manifests. The
original Berlin LoD2 archive and official aerial remain dl-de/zero-2-0; OSM
identities remain ODbL-1.0.

## Bounded geometry and checks

All four drawn modes and both drawn device profiles use the complete same
geometry. Minecraft has separate surface-only geometry. The table counts
retained geometry/instance typed arrays, not browser or driver overhead.

| Contribution | Draws | Instances | Rendered vertices | Buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Complete Dom/Altes/bowl drawn family | 16 | 8,670 | 353,304 | 1,037,604 |
| Same native family full | 1 | 17,420 | 418,080 | 1,324,568 |
| Same native family mobile | 1 | 11,962 | 287,088 | 909,760 |
| Complete UDL drawn facade family | 13 | 3,711 | 95,744 | 284,460 |
| Same native facade family | 1 | 636 | 15,264 | 48,984 |
| Complete Embassy source sheets | 2 | 0 | 1,200 | 28,800 |
| Native Embassy exterior full | 1 | 2,822 | 67,728 | 215,120 |
| Native Embassy exterior mobile | 1 | 1,747 | 41,928 | 133,420 |

The historical v147 Dom/Altes/bowl budget was 14 draws / 6,830 instances /
876,008 bytes and its full native family 15,922 blocks / 1,210,720 bytes. The
v147 UDL family was 13 draws / 2,457 instances / 189,156 bytes and native 507
blocks / 39,180 bytes. These requested additions are explicit deltas, not
weakened historical fixtures. No part population grows while moving.

Focused tests verify all sixteen roof envelopes by direct downward raycasts,
original rear-chimney retention, open source courts, visible capital spirals,
matching overhang collision, exact bronze anchors/opposite orientations,
texture-free bounded native forms and identical drawn-device budgets.
Local Chrome WebGL renders inspect the complete Embassy, native Embassy,
Altes ensemble, both bronze groups and the close capital. Full-viewer/browser
integration is covered by the release review; these checks do not claim a test
on a physical iPhone.


Historical appearance checks retain the v147 constants and JSON files. Separate
v148 overrides cover only the requested Dom/Altes family in the drawn and two
native profiles. Independently generated v147 component fingerprints prove that
the Berliner Dom, granite bowl and all four unrelated Unter-den-Linden buildings
(including their facade layers) remain byte-for-byte unchanged. The generic
monument test keeps the exact two Altes OSM keys, excludes duplicate fallback
geometry and accounts for 87/89 anatomical instances plus five thin base/lance/
rein parts per group. The targeted historical and ownership checks pass.

The final integrated long-distance camera review exposed depth interference between
the original v148 painted flute bars and their shafts. Drawn Altes columns now
use one closed, 96-segment shaft profile with 24 actual recessed grooves. This
removes overlapping flute faces and their diagonal moiré without dropping
detail. The native shaft geometry and all unrelated components remain identical.

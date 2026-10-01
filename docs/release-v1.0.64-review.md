# v1.0.64 source and release review

Pipeline step 10: a bounded refinement of Café am Neuen See, the adjacent
Spanish Embassy and the pedestrian tunnel gatehouses at the Siegessäule.
The approved map boundary, 93-place tour, movement controls, viewing distance
and existing city detail remain unchanged. The new work uses procedural
vector geometry with no photographic textures or downloaded fonts.

## Places and source contracts

| Area | Model work | Evidence and limits |
| --- | --- | --- |
| Café am Neuen See | Retained current building parts, glazing and source roof profiles; waterfront deck, garden furniture and pier | Berlin LoD2 and OSM restaurant way 46603834 / Biergarten way 118616321; operator descriptions and inspected freely licensed references guide material and recognition detail |
| Neuer See boats | Open rowing-boat hulls, seats and oars near the actual hire pier | Pier way 118603619 and rental node 5911952789; boat count, dimensions and positions are display estimates confined to the mapped lake |
| Children's areas and canopies | Two sandpit areas and a small seasonal canopy reading | OSM nodes 8968204444 / 8968204465 and the operator's sandbox description; the owner reports tents and the operator documents covered winter lanes, but no surveyed current tent layout is claimed |
| Café toilet buildings | Exact correction of the two anomalously high source objects | LoD2 DEBE01YYK0002Klw / DEBE01YYK0002KWV conflict with OSM way 118603618's one-storey use; source surfaces and original heights are retained as evidence, and the replacement height is explicitly estimated |
| Spanish Embassy | Complete five-part main-building source envelope, separately retained entrance envelope, stone facade hierarchy, open four-column corner entrance, roof and current coat-of-arms detail | LoD2 parent DEBE01YYK0002NgP, portico envelope DEBE01YYK0003Ul3 and heritage record 09050276; fine facade subdivisions remain authored visual estimates |
| Siegessäule tunnel gatehouses | Four source-bound stone pavilions, square piers, narrow windows, cornices and descending entrance stairs | Four exact OSM identities and eight retained LoD2 parts; source-height conflicts and reference-fitted architectural elevations are explicit |

The [Café am Neuen See source notes](cafe-neuer-see-v164-source-notes.md)
identify mapped features, reference dates and uncertainty. The 2009/2012
photographs predate the café refurbishment and are used only for compatible
material and waterfront furniture cues. They do not override the current
LoD2 restaurant parts or the operator's documented glazed event hall.

The toilet height correction is deliberately limited to two exact source
identities. Their source heights are 29.768 m and 29.400 m over small plans.
Their metadata identifies automatic photogrammetry; official DOP imagery
shows substantial tree canopy at the same location. A canopy-height error is
an inference, not an official published correction. The chosen one-storey
display height is not claimed as a measured replacement.

The [gatehouse source contract](grosser-stern-gatehouses-v164.md) records the
four mapped houses and eight original source parts. The model keeps sixteen
square piers, eighty narrow side windows and sixty-four descending treads.
The eastern source roofs reach 16.6–19.9 m above source ground, in conflict
with the matching low pavilions and western source roofs at 7.9–8.4 m above
source ground. Raw
surfaces are retained, while the display uses the source plans with an explicit
uniform 7.98 m roof fit. Fine architectural elevations remain approximations.
Berlin's monument record 09050419 attributes the 1941 buildings to Johannes
Huntemüller; broad photo-caption attribution to Albert Speer is not copied
as the direct design credit.

The [Spanish Embassy source contract](spanish-embassy-v164.md) retains all 144
source boundary surfaces: 138 across the five main-building parts and six
from the separately recorded portico envelope. It renders the main building's
101 exposed wall/roof polygons and an open four-column portico instead of the
old solid entrance proxy. The exact six displaced prism identities are owned
by this replacement; unrelated source buildings remain eligible. The former
5.5 m inner-part anchor is not treated as the
whole embassy height; the full composition reaches viewer y = 30.860 m.
The current crowned Spanish shield follows the post-2003 facade, rather than
reintroducing the earlier political emblem. Its relief, stone joints and
window subdivisions are source-bounded visual estimates. The embassy is not
presented as a publicly accessible interior.

The café's 42 detailed picnic tables, 32 individual garden chairs and two
seasonal canopies replace only the former generic furniture grid and enclosing
hedge for the exact `Café am Neuen See` record at `[-18672,8823]` decimetres.
That grid and hedge were inferred display detail, not measured source objects;
the original street-details payload remains unchanged. The replacement leaves
three complete mapped footway courses open. Its gravel garden and timber deck
are clipped to the mapped site/seating polygons and exclude buildings, water
and paths. Timber material, plank spacing and fine railing proportions are
reference-based display estimates. All six rowing boats remain within the
actual lake, including their outstretched oars.

## Source and representation preservation

Berlin LoD2 and the spring 2025 official orthophoto are used under
dl-de/zero-2-0. OSM supplies building, water, site, pier and playground
identities under ODbL 1.0. The original building rings and surfaces remain in
the source records; targeted replacements take over only their explicitly
listed prior display identities. Existing roads, paths, lake edges and nearby
monuments remain in place.

Day, Night, Snowstorm and Schwellenraum share the same complete static drawn
detail on desktop and touch devices. Minecraft uses separate orthogonal
geometry. The established progressive construction, cancellation, static
transform reuse and bounded streaming/residency safeguards remain in place.
No change to movement, image resolution, visibility range or general source
detail is part of this release. Added detail still has a rendering cost; the
release makes no universal frame-rate or crash-free claim.

The final browser route exposed an initialization-order race after a mobile
Minecraft-to-drawn remount: progressive construction could finish before the
secondary setup installed the real deferred park starter. Its early completion
signal then called the initial no-op. Secondary setup now rechecks the starter
after its idempotent world calls; the existing loading, hidden-tab and
duplicate-start guards remain in charge. This restores eligible park detail
without changing geometry, construction order or residency limits.

The stair openings are shared by the exact terrain, smooth surfaces, deferred
restored paving and snow cover. Checking the actual rendered scene caught both
a deferred paving cap and a seasonal snow cap over the wells. The narrow
apertures preserve surrounding geometry rather than deleting entire ground
cells or hiding the city-wide surface layers.

The [static-model baseline audit](static-model-v164-baseline.md) reconciles two
stale test fixtures for already-released v1.0.60/v1.0.61 models. Their production
files and runtime source dependencies match HEAD byte-for-byte. A new separate
fixture records their cumulative current signatures; all prior fixtures remain
frozen. This changes no city geometry or rendering quality.

Small furniture, boat and canopy geometry is procedural. Furniture layouts
vary with the season; no present-day chair inventory, tent count or exact
equipment dimensions have been surveyed. Sandpit positions are mapped, while
their edging and loose play objects are illustrative. No large playground
apparatus is inferred from the sandbox evidence.

## Visual-reference credits

Nine new per-file records are mirrored in the source and public Wikimedia
manifests, bringing each to 425. All 416 entries from v1.0.63 remain unchanged
within their original manifest. Exact file URLs were deduplicated before
appending. The references are attribution-only and are not bundled as images
or loaded by the viewer.

| Subject / file | Photographer | Licence |
| --- | --- | --- |
| [Café am Neuen See.jpg](https://commons.wikimedia.org/wiki/File:Caf%C3%A9_am_Neuen_See.jpg) | Lear 21 | CC BY-SA 4.0 |
| [Cafe am Neuen See Großer Tiergarten Berlin 2.JPG](https://commons.wikimedia.org/wiki/File:Cafe_am_Neuen_See_Gro%C3%9Fer_Tiergarten_Berlin_2.JPG) | Schlaier | Public domain |
| [Tiergarten Café am Neuen See.JPG](https://commons.wikimedia.org/wiki/File:Tiergarten_Caf%C3%A9_am_Neuen_See.JPG) | Fridolin freudenfett | CC BY-SA 4.0 |
| [Berlin Tiergarten Neuer See 3.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Tiergarten_Neuer_See_3.jpg) | Schlaier | Public domain |
| [Berlin Tiergarten Neuer See 2.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Tiergarten_Neuer_See_2.jpg) | Schlaier | Public domain |
| [Berlin - Spanische Botschaft.jpg](https://commons.wikimedia.org/wiki/File:Berlin_-_Spanische_Botschaft.jpg) | Marek Śliwecki | CC BY-SA 4.0 |
| [SpanishEmbassyBerlinDetailCoatofArms.png](https://commons.wikimedia.org/wiki/File:SpanishEmbassyBerlinDetailCoatofArms.png) | Sargoth | Public domain |
| [Victorycolumnsubwayentrance.jpg](https://commons.wikimedia.org/wiki/File:Victorycolumnsubwayentrance.jpg) | Me677 | Public domain |
| [2018-08-04 DE Berlin-Mitte, Großer Tiergarten, Großer Stern (49488995837).jpg](https://commons.wikimedia.org/wiki/File:2018-08-04_DE_Berlin-Mitte,_Gro%C3%9Fer_Tiergarten,_Gro%C3%9Fer_Stern_(49488995837).jpg) | Paul Korecky | CC BY-SA 2.0 |

## Validation

- Production TypeScript/Vite build passed. Repository Ruff format/check passed
  for all 201 Python files, and the complete Python suite passed 601 tests.
- The focused integration run passed 122 tests / 464,650 assertions covering
  the models, source ownership, navigation, exact ground/paving cuts, deferred
  construction and full static-detail parity. Four native-world construction
  tests passed against the separately recorded v164 full/mobile baselines.
- Seventeen final park-lifecycle and snow tests passed / 745 assertions. They
  reproduce the early progressive-completion race and verify exactly one park
  publication, cancellation/disposal, and all four snow openings plus coverage
  immediately outside their edges.
- Desktop Chrome passed all seven café, embassy and gatehouse views. Mobile
  WebKit with the iPhone 13 profile passed eighteen view samples across Day,
  Schwellenraum, Minecraft, Night, Snowstorm and return to Day; mobile Chrome
  with the Pixel 5 profile passed six samples across Day and Schwellenraum.
  The snow/return views were completed after the targeted snow-cover correction.
  Every new model appeared exactly once in the matching representation; shaft
  rays reached the descending stairs rather than late paving or snow caps.
- All recorded final samples have zero page/console errors, crashes or WebGL
  context losses. Peak observed WebGL buffer allocations were 163,659,825 bytes
  for the WebKit route and 155,145,538 bytes for the mobile Chrome route.
  These measurements exclude textures, framebuffers and driver allocations.
- The [browser-check record](neuer-see-v164-browser-checks.json) retains the
  observations and resolved findings. The production-build inspection can be
  repeated with `scripts/smoke_neuer_see_v164.py`.
- Static-package readiness, local HTTP/package integrity and fresh-context
  desktop Chrome and mobile WebKit startup gates passed. The fresh starts had
  zero page/console errors or failed critical requests.
- Independent read-only review found no blocking model ownership, navigation,
  disposal, source-preservation or deferred paving issue.

Browser profiles running on the development host are not physical-device
checks and cannot establish universal compatibility or memory safety.

## Release artifacts

Both downloads and the hosted viewer use the same production build.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `isometric-berlin-regierungsviertel-local.zip` | 168,521,348 | `93850775dee29a8b352dfbe5e2cb38a8cfd5286fa7169210981790024b7563b0` |
| `isometric-berlin-viewer-v1.0.64.tar.gz` | 168,303,313 | `e792f1e5565f53a12a674050fbd6843722f8ed42cc86534d5f7763e1194596c8` |

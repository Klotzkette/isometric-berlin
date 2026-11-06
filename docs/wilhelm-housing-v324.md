# Wilhelmstraße / An der Kolonnade: finite facade fittings (v324)

This is a facade treatment of the surviving housing **west of Wilhelmstraße**,
east of the Holocaust memorial and around An der Kolonnade / the tennis courts.
The actual Georg Elser corner is the measured family `DEBE01YYK00005Ge`,
Wilhelmstraße 91/92 / An der Kolonnade 2. The photograph titled
“Wilhelmstraße 87” also shows this corner; its filename and a shop's postal
label are not a building-ownership proof.

The finite inventory contains 17 historical families (16 residential and the
lower kindergarten) with 45 complete official leaves, and the two modern
Embassy of Exchange families with 38 complete leaves. The modern houses are
kept distinct from the 1980s architecture. The older `slab1` / `slab2` labels
were attached to these modern families; that label does not authorize adding
DDR loggias to their walls. The former Wilhelmstraße 56–59 on the opposite
side of the street were demolished in **2016**, according to the LDA report,
and are not reconstructed.

## Evidence and precision

The [Landesdenkmalamt explanation](https://www.berlin.de/sen/stadtentwicklung/denkmal/landesdenkmalamt/erklaerungsbogen_wohnquartier.pdf?ts=1691738889)
and [official monument record 09075020](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075020)
describe the WBS-70-derived construction, differentiated window groups,
canted bays, loggias, French railings, red pitched roofs and dormers.
This architectural context does not survey individual window centres.

The photographic alignment uses these individually attributed references:

| Reference | Author, date, licence | What it supports |
| --- | --- | --- |
| [Wilhelmstraße / Hannah-Arendt-Straße, August 2017](https://commons.wikimedia.org/wiki/File:Wohnbebauung-Wilhelmstr-Hannah-Arendt-Str-Berlin-Mitte-08-2017a.jpg) | Gunnar Klack, 2 August 2017, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Measured `01jc` / `03XD` corner; pale panel walls, contrasting bay joinery, upper balcony and existing roof articulation. |
| [Mitte Wilhelmstraße 87](https://commons.wikimedia.org/wiki/File:Mitte_Wilhelmstra%C3%9Fe_87.jpg) | Fridolinfreudenfett, 8 April 2026, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Actual `05Ge` Elser corner, grouped canted glazing, ordinary light frames and shallow French rails. |
| [An der Kolonnade](https://commons.wikimedia.org/wiki/File:Berlin-Mitte_An_der_Kolonnade.jpg) | Assenmacher, 2 April 2011, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | South-facing `05zY` / `0Ch1` street walls; grouped dark joinery, lighter ordinary windows and open railings. The old photograph is not evidence of current tenants. |

The city's [Georg Elser monument page](https://www.berlin.de/sehenswuerdigkeiten/3561913-3558930-georg-elser-denkmal.html)
provides an additional public view of the real corner (photo credit dpa,
reference only). No photograph pixels, textures, shop logos or inscriptions
are included in the model.

All body coordinates, wall rings, hole boundaries, roof masses and the existing
family datums come from the unchanged full official source sheet
`alt-mitte-v169/source-390_5819-00.json.gz`. The compiler binds every selected
patch to its original polygon ID. Small fitting dimensions, repeated bay
positions, frame colours, subdued glass tones and night occupancy are **display
estimates** guided by these references. They are not a measured reconstruction
of every apartment. Neither an unlocated ground-floor passage nor a balcony
cut is invented. Canted joinery follows existing canted source planes; shallow
rails add no solid balcony mass or new navigation obstacle. Existing dormer
and bay bodies remain unchanged.

## Finite geometry and preservation

The 38 directed street runs include 276 original wall polygons over multiple
official leaves. They are not merely the largest two small sheets per family.
Each whole fitting rectangle must be covered by one complete original polygon,
including its holes; outward orientation is checked against the full family
footprints and neighbouring families remain exclusion geometry. The lower
kindergarten receives a separate, low rhythm rather than a tall housing grid.
The modern houses receive restrained independent joinery.

`wilhelm-housing-v324-evidence.json.gz` retains the full 19-family source
records, original source SHA, inventory SHA, all run checks, derived controls
and the current geometry metrics. The small runtime profile contains only
the actual fitting recipes and their finite wall anchors. Existing walls,
roofs, source colours, courts, mapped doors and navigation stay under their
old owners. Old generic fittings may be transferred **only within the exact
run masks** after both old-source and complete new-model admission; an owner
ID alone never permits deleting all of that family's other fronts.

The native model is a separate cardinal construction supported by the actual
prepared native packet faces and original voxel intervals. It does not rotate
or copy the drawn instances. The source binder requires all 83 exact original
prism records and, for native, the actual prepared packet and voxel inputs.
Any native generic-glass backing replay must retain the exact original XYZ,
winding and normals in a separate atomic transaction; new fittings do not
remove structural native wall faces themselves.

The final drawn recipe has 3,784 fitted window groups / 26,389 boxes
(2,005,564 bytes of matrix and colour attributes). Native has 2,518 independent
cardinal window groups / 15,108 boxes (1,148,208 bytes). Both modes use two
draws and identical full/touch data. The native evidence includes 933 connected
original glass-face unions for 16 families, and 34 exposed original 4 m column
surfaces for `05zY` and the two modern families. All 38 native runs are nonempty.
The latter are checked against the complete actual Full (931 nearby rows) and
Touch (312 rows) body captures. New support polygons are intersected with the
actual Float32 body union; a total 0.000000544739 m² quantisation sliver is
excluded from the new support, with zero remaining missing area. No original
matrix, triangle, roof or column is modified by this clipping.

The previously authored west-facing `01jc` V288 front remains authoritative
and unchanged; its new runs refine the northern Hannah-Arendt and eastern
Wilhelm street sides. Retirement masks never include that retained west front.

## Runtime contract

`createWilhelmHousingV324Steps({ native, sourcePrisms, nativeSource?,
sourceReceipt?, mobileLike? }, onCreate?)` returns a complete static group or
`null` for unadmitted inputs. The optional opaque source receipt reuses the
single real source-binding pass. Drawn admission does not read the native
recipe. `hasCompleteWilhelmHousingV324(root, native)` uses private source,
metadata, pose, buffer-word, storage and material receipts. Forged public tags,
changed words, foreign materials and authored disposal close the gate.

The two instanced material batches preserve full touch detail. They are
interleaved and frozen before receipts are issued. Normal static parking,
real GPU retirement and real shader-program retirement preserve admission;
canonical privately parked storage does not need to be inflated by a live
check. Warm glazing uses the existing `nightEmissive` / light-on-off contract.
`disposeWilhelmHousingV324` releases only the newly owned resources. Generator
cancellation disposes its unpublished partial group.

The compiler is reproducible with `build_wilhelm_housing_v324.py --source …
--inventory … --native-support … --native-core-support …`; its two pure helper
functions `native_core_support` and `verify_actual_native_core_support` derive
and validate the latter file from the exact source bindings, original voxels
and actual Full/Touch captures. The complete raw official-family extraction remains external,
while its compressed exact evidence is retained in the repository. The code
changes no source packet, old fixture, body, roof or walking surface.

Focused checks include full original-polygon support for every drawn box,
closed 83-owner/packet/voxel admission, all-run native coverage, raw word and
material/pose/disposal negatives, cancellation, real interleave/parking and
material-program retirement, and exact Full/Touch output hashes. A bounded
production Vite build additionally proves ordinary strong metadata aliases,
zero constructor decoding on metadata import, zero native decoding for Day,
and complete decoded values including negative zero. No full city is built by
these feature tests.

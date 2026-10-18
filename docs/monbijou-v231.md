# Step 10 — Monbijou bridges and park, v231

The two bridges now retain their own exact OSM plans and different structural
identities. The northern bridge is one clear steel box-girder span with sandstone
facing and balustrades. It has no middle pier. The southern bridge is a single
stone arch with an 18 m opening. Both retain complete mapped end connections,
stone parapets, restrained pavement joints and four illustrative lamp standards.

## Evidence and limits

- [GRASSL, northern bridge design](https://www.grassl-ing.de/projekt/noerdliche_monbijoubruecke_ueber_die_spree_584.html)
  publishes 41.10 m overall length, 40.50 m structural span, 15.30 m width and
  1.90–2.30 m construction depth, with steel box-girder construction. The model
  keeps the independently mapped OSM plan instead of stretching it to fit these
  different engineering dimensions. The published depth constrains the model.
- [Berlin monument record 09030060](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030060)
  identifies the two crossings and their historical context.
- [Berlin bridge inventory, 2025](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf)
  identifies the southern stone arch as BW3446021, 18 m long and 14 m wide.
- [Berlin's park description](https://www.berlin.de/tourismus/parks-und-gaerten/5802991-1740419-monbijoupark.html)
  confirms the lawns, old trees, paths, promenade, sports and children's bath.
- Retained OSM `berlin-260929.osm.pbf` / `candidate.gpkg`: northern bridge outline
  way195397553 and path23852032; southern outline195397546 and path23852038;
  park340138573 and protected children's bath30876915.

All original mapped outline vertices remain in the source sheet and the complete
drawn body. A 5.2 m viewer bank datum comes from the unchanged core ground field.
Camber, the southern arch rise, masonry joints, baluster profiles, lamp shape and
placement, and furniture dimensions are explicitly unsurveyed display estimates.
No photographs, protected plans, image crops or textures are included.

The park's paths, trees, ground and other furniture are already present in v166.
Consequently no second path carpet, lawn, tree layer or playground was added.
Exactly 17 existing mapped benches outside the children's bath get complete
replacement furniture, with individual timber slats, supports rotated together
with the seat and the mapped presence/absence of a backrest. Tagged seat count
sets a bounded estimated width; mapped seated viewing bearing determines yaw.
One bench rests on an existing 5.48 m path edging rather than sinking into it;
its original 5.2 m source record remains retained separately.

## Exact previous owners and integration

`monbijouV231Receipt.json` retains both original ground-cell clusters (11 north,
4 south), their ground/grid/height fingerprint and all original bench records.
`monbijouPreviousV231.ts` accepts only complete exact matches. The generic bridge
constructor must skip the two matched clusters only after the mandatory new
root is available. Drawn ground already omits the coarse bridge slabs. Native
ground must skip exactly these 15 old bridge cells with
`createMonbijouGroundCellTesterV231`; its additional radius-two halo rejects any
new connected bridge cells. Raw ground/source payloads are unchanged. Unmatched
and changed owners fail closed and retain the older presentation.

The previous `MitteHeritageV166` bench branch uses `isMonbijouBenchV231` at the
exact owner loop; ID, coordinates and the complete tag record must agree.
The replacement does not change unrelated properties or park bodies.

Required factory: `createMonbijouV231(native)`.
Navigation: `monbijouV231DeckAt(x,z,native)` for the real water-crossing surface,
`monbijouV231GroundAt(x,z,feet,native)` with the existing 0.45 m stepping guard,
and `monbijouV231SolidAt(x,y,z,radius,native)` for body/actual rail and lamp solids.
The middle of either span stays open below the bridge. Native navigation indexes
the actual final block bounds; it does not round a separate smooth roof estimate.

Construction-only weak JSON fields are `monbijouV231.json.sites`,
`monbijouV231Native.json.sites` and `monbijouV231Navigation.json.bridges`.
The scene does not retain these arrays. Navigation copies only compact necessary
typed fields and spatial indices; old global residency budgets are unchanged.

## Verification and size

Rebuild with `uv run python -m scripts.build_monbijou_v231`; `--extract` explicitly
re-reads the retained geodata and records the original sources. The bounded
source sheet makes ordinary replay independent of raw downloads.

`uv run pytest tests/test_monbijou_v231.py -q` passes three checks: retained source
corners and bench ownership, byte-exact replay, and actual Three.js raycasts.
The latter tests 156 continuous bridge-centre samples in both interpretations,
matching visible deck/support heights and no phantom middle pier, then repeats
representative upper/under-bridge rays after real lossless geometry and instance
parking. Both `ground-context.json` and cold `minecraft-voxels.json` accept the
same exact cluster and native ground receipts; changed records are rejected.

Drawn: five batches, 1,320 body triangles and 1,435 boxes, unchanged on touch.
Native: five independent orthogonal batches, 9,545 boxes. Compiled JSON is
692,940 bytes including the ownership receipt and compact navigation. No runtime
network request, animation loop, photographic texture or new tour stop.

QA cameras (world eye / target): north `[1490,45,-410]` / `[1544,4,-348]`;
south `[1460,38,-340]` / `[1514,4,-301]`;
park `[1690,110,-240]` / `[1730,5.2,-440]`.

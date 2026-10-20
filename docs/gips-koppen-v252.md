# Gipsdreieck and Koppenplatz — v1.0.152 / Step 10

This finite pass uses the existing school batch for the Kastanienbaum school,
the Gipsdreieck plant beds, the requested Milchhalle frontage at Auguststraße 50,
Koppenplatz and its school. No source shell, measured roof, courtyard, ground
polygon, street, playground, tree, tour stop or streaming descriptor changes.

## Evidence and retained ownership

| Site | Retained source and bounded change |
| --- | --- |
| Kastanienbaum main school | Berlin LoD2 `DEBE01YYK00001Eq`, both original parts. The selected Gipsstraße-facing wall is `DEBE3Dhltny3kcZ5`, sheet 23. Correct the v205 six-row facade estimate to the four occupied levels described by the heritage authority; retain its complete measured envelope, roof and v185 cornice. Six further original faces gain only shallow eave/console members, without another window grid. |
| Kastanienbaum director's house | Existing rendered OSM `23991547` and the complete v185/v205 details remain. Shallow panels distinguish the existing closed left door; the right courtyard passage receives no added infill. Terracotta accents follow the existing four-bay register. The older official/legacy-height conflict remains documented in v185. |
| Koppenplatz school | Berlin LoD2 `DEBE01YYK0000AxW`, all five original parts. The exact 56 earlier openings are verified against all 112 original packet triangles. A thin facing on only their six measured walls corrects the inaccurate apparent five-row register to three occupied levels, including taller central Aula windows. The central source face `DEBE3DG94v6wivJl` sheet 1 anchors the entrance surround. A separate bounded clock turret supplies the documented silhouette missing from the retained LoD2 roof. |
| Historical Milchhalle frontage | Auguststraße 50, not a Gipsstraße postal address. Source owner `DEBE01YYK0000DXF`, all five parts; front plane `DEBE3DXK5LluHLmv` sheet 12. A shallow dark shop fascia carries procedural `MILCHHALLE` lettering and narrow jambs. |
| Gipsdreieck and Koppenplatz | Complete retained OSM grass rings `1065187943`, `1065187944` and flowerbed rings `1146128553`, `1146128554`. Twenty-eight original segments get a thin edge finish. The complete park/playground rings, basketball pitch, school boundaries and café/address nodes are retained as the finite evidence context. |

The [Kastanienbaum heritage record, 09035166](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035166)
identifies the 1872–73 Blankenstein complex: separate three-storey director's
house, four-storey main school, two courts, segmental window heads, sill courses,
console cornice and restrained terracotta. The reference-only
[director's-house photograph](https://denkmaldatenbank.berlin.de/media/uploads/Mit/04/09035166b.jpg)
is credited **LDA-Archiv, Bittner 2008**.

The [Koppenplatz school heritage record, 09035078](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035078)
identifies Ludwig Hoffmann's three-part school with raised central Aula, Renaissance
portal, clock tower and restored mansard silhouette. Its
[reference photograph](https://denkmaldatenbank.berlin.de/media/uploads/Mit/02/09035078a.jpg),
**Landesdenkmalamt Berlin, 1999**, supports the clock base, louvred lantern and
bulbous upper profile. The [Berlin renewal project](https://www.nachhaltige-erneuerung.berlin.de/ruhende-foerdergebiete/spandauer-vorstadt/projekte/schule-am-koppenplatz)
confirms the copper-covered turret and the retained roof's eyebrow dormers.
The [school's contact page](https://schule-am-koppenplatz.de/kontakt/) identifies
the specific Koppenplatz 12 site, distinct from its Bergstraße and Auguststraße
sites. Existing measured roof facets remain unchanged.

The [district's Gipsdreieck notice](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2023/pressemitteilung.1299717.php)
confirms its lawn-based public recreation role. The [Koppenplatz heritage entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065283)
records the historic urban square. This pass uses exact mapped plant beds and
leaves their surrounding paths, sports/play areas and memorial space untouched.

**Café identity conflict:** the retained 2026 OSM node `3902472802` at Auguststraße
50 is named **Symple Coffee Mitte**, with the [operator link](https://symplecoffeeroasters.com/).
The user's requested familiar **Milchhalle** name is represented as historical
recognition. The current OSM name and café metadata are preserved. The old
Milchhalle domain could not be retrieved, so it is not evidence of present
operation or current branding.

No photograph, logo, external font, plan or texture is bundled. The two official
photographs are reference-only; their credits should appear with the release's
source notes. Geometry continues to use Geoportal Berlin **dl-de/zero-2-0** and
© OpenStreetMap contributors **ODbL-1.0**.

## Exact correction and estimates

`gips-koppen-v252-source.json` freezes original selected LoD2 sheets, complete
source rings, all 56 old opening receipts, part counts and SHA-256 receipts of
the old source files. Only `schoolsPlacesV205.json`'s exact
`DEBE01YYK00001Eq` authored row group is superseded. Three independent numeric
row receipts must match before the complete replacement and additions apply;
a changed/unrelated entry retains all previous details.

The old six-row glazing estimate is replaced completely by twelve windows on
four levels. The measured school remains untouched. Opening widths, heights,
three-bay subdivision and fitting depths are proportional display estimates.
Koppenplatz receives a complete 76-opening replacement on three photo-supported
levels. The old 56 openings, frames and v239 reflections remain in their
unaltered packets behind six thin, exactly source-clipped facade finishes.
All 112 old pane triangles are reverified during generation and the affected
packet hashes are retained in the evidence. The corrections cannot extend to
other buildings, roofs or courtyards. Window spacing and fitting sizes remain
proportional estimates; no surveyed elevation is claimed. Its turret occupies a bounded roughly
4.5 m square above the middle source roof, centered at `[1793.4, -950.4]`, with
an estimated top at world Y **42.625 m**. Copper tones, clock diameter and hands,
louvers and bulb proportions are reference-guided estimates. It does not
substitute or lower the source roof.

The retained native roof spans under the turret have an actual maximum top of
**31.0 m**. Native presentation alone lifts the complete 547-member turret by
**1.25 m**, the minimum centimetre increment giving its lowest clock member
at least **0.15 m** clearance above that roof. Its native top is consequently
**43.875 m**. The exact roof-packet receipts and overlapping spans are recorded;
the native source roof, drawn tower, all other members and instance counts are
unchanged. A reversal test restores the exact preceding native-array hash, and
the drawn boxes, rods and lettering retain their exact hashes.

The four ground-edge rings use a **4.5 cm** finish over the existing **5.2 m**
ground datum, independently verified at every endpoint. There is no new floor,
raised park platform, barrier across an entrance or collision volume. Native
members are independently axis-aligned, including the tower and plant-bed edges.

## Integration and checks

Run `uv run python scripts/build_gips_koppen_v252.py`. The bounded committed
source is sufficient; no network or raw PBF is needed for replay. Integrate
`appendGipsKoppenV252(entry)` in the existing `appendSchoolPlaceV205` entry path
after earlier school transforms. It allocates no mesh, material, texture or
per-frame work; the existing exact-count batch constructor handles its rows and
lettering. All drawn profiles receive the same complete geometry.

Before lettering: **1,150 boxes + 163 rods = 1,313 drawn instances / 99,788 bytes**;
**3,293 native members / 250,268 bytes**. The compact JSON is **173,469 bytes**.
These are gross replacement counts; the obsolete main-school group yields.
The existing lettering helper adds 35 drawn strokes or 96 native members for
the nine-letter sign in the same batch. Final gross counts are **1,348 drawn /
102,448 bytes** and **3,389 native / 257,564 bytes**. The exact old group had
246 drawn and 285 native members; net additions are 1,102 and 3,104 respectively.
Live residency, transfer and prefetch limits remain unchanged.

Six Python tests cover deterministic replay, immutable full owners, exact face
containment, complete coverage of the 56 receipted old panes on six walls, the
actual three-level replacement panes, whole plant-bed contours, source ground
height, native clock clearance without unrelated changes and fixed budgets.
Two Bun tests cover exact-owner fail-open replacement, finite orthogonal native
matrices and procedural sign width. Final integrated screenshots and complete
viewer checks belong to the release.

World-metre QA targets:

- Kastanienbaum director house: eye `[2071, 10, -799]`, target `[2079.85, 9.7, -817.1]`, FOV 55.
- Milchhalle: eye `[1996.5, 9.4, -925]`, target `[1992.5, 8.6, -941.45]`, FOV 55.
- Gipsdreieck overview: `[1980, 13, -914]`, view from the south.
- Koppenplatz school: `[1795, 22, -951]`, view from the square/east side.

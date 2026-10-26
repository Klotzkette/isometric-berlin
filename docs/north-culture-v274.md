# Northern culture architecture v274

Four finite additions/corrections are connected to their existing rendered owners: Herz-Jesu-Kirche at Fehrbelliner Straße, Grober Unfug at Torstraße 75, the built Schönhauser Tor complex at Torstraße 49, and the Suhrkamp headquarters at Torstraße 44. All previous measured source shells, courtyards, roofs and unrelated fittings remain. No photographic texture, media, animation, city coverage or device-specific detail reduction is introduced.

## Sources and estimation boundary

* Herz Jesu: [Landesdenkmalamt building history and ground plan](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/sakralbauten/herz-jesu-kirche-639367.php) explicitly records the **55 m campanile**, Romanesque church and sandstone/shell-limestone street frontage. The retained 2025 Berlin DOP request in the evidence file supports a red four-sided tower roof. The source height, owner and measured church plan are distinguished from estimated tower width/depth, roof courses, openings, cross and decorative proportions.
* Grober Unfug: [operator locations](https://www.groberunfug.de/filialen/) and the [operator's exterior photograph](https://www.groberunfug.de/wp-content/uploads/2025/02/grober-unfug-mitte-aussen-01-700px.jpg) govern the pale corner surround, comic displays, arched door and two geometric inscriptions. Fine divisions and lettering are interpretations, not a measured photograph reconstruction. The operator page was inaccessible through the review web reader; the exact photo/source references remain recorded.
* Suhrkamp: [Bundschuh Architekten](https://bundschuh.net/project/suhrkamp-ensemble/) and [publisher contact](https://www.suhrkamp.de/kontakt-s-63) identify the built headquarters. Exactly two western source faces receive seven broad glass openings apiece beside the concrete strip; one upper blind is represented. Other v189 faces, including residential/Pfefferberg fronts, retain their existing construction.
* Schönhauser Tor: [current operator/property page](https://deka-sterne-berlin.de/sterne/Schoenhauser_Tor), [material project](https://www.lxhausys.com/eu-en/project/himacs-schonhauser-tor/) and the recorded existing-building image govern the crown profiles. No 2026 redevelopment proposal or invented entrance is substituted.

The complete finite evidence is `geo_data/regierungsviertel/north-culture-v274-source.json.gz` (6,627 bytes). It retains four measured leaf profiles across two new named owners, the existing Tor source parts, original source digests, packet placement hashes, references and the DOP request. Runtime source data is `src/app/src/data/northCultureV274Source.json` (11,666 bytes).

## Placement and visible attachment

Herz Jesu's retained primary owner `DEBE03YY6000006I` is in packet `5_-3`; its scene ground is **3 m**, and its previous source envelope height is **25.567 m**. The added shaft starts at scene Y25, overlapping the existing lower church, and its cross reaches Y58, giving the documented 55 m from the local scene ground. The stone front follows retained street endpoints. The older church is neither removed nor raised.

Grober Unfug's complete owner `DEBE03YY600009HQ` is in packet `4_-3`. That original packet explicitly supplies **3.93 m** terrain lift above the 3 m base, so the visible shop starts at **6.93 m**. The generator now derives and receipts the two actual packet datums; an earlier evidence-only 3 m shop datum was corrected. Source profiles remain unchanged.

Two initially selected northern Tor facets were hidden behind the other retained 33.442 m source part. Review against the actual old roof function confirmed the obstruction. Only those two selections changed; the four final edge receipts are all on `DEBE3DYRpubWolUn`:

1. `[2645.984,-1045.327] → [2642.281,-1059.306]`
2. `[2640.051,-1067.708] → [2637.541,-1077.195]`
3. `[2658.751,-1040.494] → [2647.71,-1043.514]`
4. `[2694.478,-1032.045] → [2672.662,-1037.99]`

The fourth face has a 43 cm ground strip outside it, not a tall adjacent wall. Tests distinguish that low strip from a false full-height obstruction.

The retained independent native source skin has 2 m cells and can protrude beyond measured wall axes. The native Tor constructor receives the **actual unchanged `source.nativeRuns`** from AlexanderNorthV166. It adjusts only the 2,107 new fittings along the four receipted outward normals until their full boxes clear those exact cell boxes by 3 cm, with a fixed 3.1 m allowance. There is no new source import, copied native payload, old-cell removal, invented broad rectangle or reduced native detail. Missing native source runs fail explicitly. All fittings remain orthogonal. A regression checks that none of their volumes intersects any retained native Tor cell.

The local COMICS! inscription originally threw because the shared alphabet has no exclamation glyph. The local renderer now builds its two punctuation strokes geometrically and centres the already-centred shared paths correctly. The shared alphabet is untouched. The actual complete NorthCulture constructor is exercised by tests, so this startup exception cannot recur unnoticed.

## Integration and navigation

`RequiredSiteEnvelopesV209` attaches the complete NorthCulture group before yielding. `AlexanderNorthV166` attaches the Tor crown, and `SuhrkampPfefferbergV189` invokes the exact two-face correction. The Suhrkamp match checks both endpoints, elevations **and normal direction**, rejecting changed faces without emitting replacement detail.

`herzJesuV274Profile.ts` shares the renderer's finite structural sections. Navigation receives **33 drawn rotated sections** and **375 native row rectangles made only from occupied cells/short members**, with their actual bottom and top heights. Live mode callbacks activate only the correct representation. This preserves empty AABB corners and does not fill the space beneath projecting eaves. Tiny cross and window trims remain decorative, consistent with other architectural fittings.

The explicit `northCultureV274` navigation option is enabled in both real viewer navigation construction paths. Existing lower church/streamed navigation is unchanged. An unrelated synthetic world without this option gains no tower obstacles. The BMS and opera navigation integrations remain intact.

## Focused validation

* **5 Python tests passed** in 0.68 s: exact deterministic regeneration, source digests and retained profiles, actual primary-packet elevations, shop/tower source attachment, four genuinely external upper Tor faces and exact existing Suhrkamp faces/reference scope.
* **7 Bun tests passed** in 949 ms, with 120,273 assertions: actual constructors and complete static geometry, COMICS! centring, exact tower collision volume and spatial occupancy against constructed matrices in both modes, live navigation and empty corners, actual old Tor roof visibility, all 2,107 native fittings outside original cells, and exact Suhrkamp match/rejection.
* `ruff check` passes for the generator, Python test and preview; `git diff --check` passes. Full project build/release verification is coordinated separately by the root task.

Actual geometry-array counts include indices, instance matrices and instance colours. The Suhrkamp column includes its **entire existing Suhrkamp/Pfefferberg group**, not merely the incremental change:

| Construction | Drawn instances / bytes | Native instances / bytes | Draw calls |
|---|---:|---:|---:|
| Herz Jesu + Grober Unfug | 751 / 58,372 | 5,078 / 387,224 | 2 |
| Four Tor crown facets | 89 / 7,412 | 2,107 / 160,780 | 1 |
| Complete existing Suhrkamp/Pfefferberg group | 2,098 / 160,744 | 7,084 / 539,680 | 2 |
| Total audited groups | 2,938 / **226,528** | 14,269 / **1,087,684** | **5** |

No mobile geometry switch exists for these constructors; every device receives the same full arrays. No runtime budget was changed.

Local logs:

* `/Users/klotzkette/.cache/codex-berlin-v274/north-culture-python.log`
* `/Users/klotzkette/.cache/codex-berlin-v274/north-culture-bun.log`

## Actual-matrix visual inspection

`src/app/scripts/preview-north-culture-v274.ts` exports the actual instantiated Float32 matrices, original source packet triangles and existing Tor construction. `scripts/preview_north_culture_v274.py` rasterizes those faces with depth testing; no illustrative replacement model is used. The drawn and native views use equal camera directions.

Output: `/Users/klotzkette/.cache/codex-berlin-v274/north-culture-v274-models.png`.

This is an offline geometry check, not a browser screenshot or a mobile stability test. It shows the two corrected Suhrkamp west faces alone; the full city, other recognition layers and viewer lighting are omitted. No browser was opened.

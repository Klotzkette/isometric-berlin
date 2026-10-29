# Step 10 — Potsdamer Platz from owner photographs (v284)

Three street photographs supplied on 29 October 2026 guide this bounded update
for v1.0.183. They remain references: no photograph, pixel texture or runtime
media request is included in the viewer. File hashes, complete original station
source sheets, archive hash and building identities are retained in
`geo_data/regierungsviertel/potsdamer-photos-v284-evidence.json`.

## Identification and source boundary

The foreground pavilion is the **south** station entrance
`DEBE01YYK0000BRX`, centred at world `[295.739475, 1138.368472]`. The separate
north entrance `DEBE01YYK0002SCt` is not the photographed foreground building.
The existing north construction and lettering recipes remain unchanged.

The white framed corner is TRION (`DEBE01AL57c0001B`, perimeter profile `west`).
The large right-hand street front is Torhaus/Leipziger Platz 1, with the adjoining
Stadtpalais continuation (`DEBE01YYK00007OU`, profile `southWest`). The grey stepped
Beisheim office is `DEBE01YYK0002Mbg`; the cream tower next to it is the separate
Ritz/Tower Apartments owner. The Canadian Embassy is largely occluded in these
photos; its facade and the BahnTower are unchanged.

Existing source wall planes, complete footprint vertices, heights and roofs
determine the additions. Torhaus's narrow dark glazing and bronze-toned jambs,
TRION's pale piers and paired mullions, and the broader Stadtpalais bays remain
photographic display estimates. The inner court stays open. Its upper setback
detail starts above the retained adjacent shoulder at 30.223 m; the lower court
does not acquire a street facade.

The missing Beisheim office podium follows the consecutive original source
edge `[[321.8,922],[313.9,972.3],[308.2,972.9]]` on source part `gAwitON0`,
ground 5.1 m and height 34.6 m. The ten earlier drawn facade recipes and all
3,707 earlier native instances remain byte-identical.

## Station height and replacement

The complete original LoD2 sheet starts below street level. Its values are:

| Quantity | World metres |
| --- | ---: |
| Original minimum elevation | -0.518 |
| Original total height | 14.696 |
| Original absolute roof elevation | 14.178 |
| Existing street datum | 5.400 |
| Roof height above that street | 8.778 |

World altitude is source altitude minus 30 m. The previous drawn model added the
entire 14.696 m to the street datum and displayed a 20.096 m roof. The correction
uses the original 14.178 m roof without translating or rewriting any source
sheet. This is a measured datum correction; steel dimensions, pane divisions,
sills, brace junctions and fascia lettering are photographic estimates.
Existing stair banks and approaches remain.

The complete drawn south hall is created inside the required unpublished city
transaction. Its exact old glass prism is omitted only with the matching source
receipt; later coverage and worker detail use the same admission. The optional
expanded-detail path retains the north hall and does not add a second south hall.
Import, construction or cancellation failures cannot publish a source hole.

Minecraft has its own hollow, world-axis-aligned steel, glass, lettering and
stair construction. It is not a second smooth hall. The original raster generator's
cell-centre ownership convention assigns exactly 43 class-4 columns to this hall.
Only their exact original tuples may yield after the full replacement is built.
The two neighbouring class-3 columns at `[77,284]` and `[77,285]` belong to a
separate, completely retained source: OSM way 464904393, runtime ID `64904393`.
A full-city check exposed its false four-storey appearance. The original
`building=yes` tag has no height/levels; 9 m was a display fallback, rounded to
12 m by the old native generator. This 29.86 m², roughly 1 m wide strip is
strictly outside the official hall, at least 0.424 m away. It is not treated as
covered by the LoD2 footprint.

The supplied photographs and a bounded official DOP 2025 comparison show the
station-side edge/support structure rather than an adjacent solid tower. A
separate complete open frame retains all four source vertices. Its 14.178 m roof
alignment with the adjacent station is an explicit photo/context interpretation,
not an independently measured strip height. Only after both complete models are
admitted may the exact strip proxy and its two independently receipted native
columns yield. Every other native tuple remains. Missing/changed receipts or a
new foreign cell-centre owner reject the transfer. Walking roof support uses the
admission and roof datum of the visible model family.

## Preservation and limits

All source mesh/voxel payloads remain untouched. Ten unrelated Leipziger perimeter
profile buffers and all 1,927 earlier drawn southwest-profile instances remain
byte-identical. Native pier coalescing merges only identical-colour boxes with
the same XZ rectangle and overlapping vertical ranges; an independent occupied
coloured-volume comparison verifies the exact union.

| Model | Instances | Instance bytes | Existing limit |
| --- | ---: | ---: | ---: |
| Leipziger perimeter, drawn | 11,548 | 877,648 | 950,000 bytes |
| Leipziger perimeter, native | 12,164 | 924,464 | 950,000 bytes |
| Sony/Beisheim surroundings, drawn | 6,949 | 528,124 | 7,000 instances |
| Sony/Beisheim surroundings, native | 3,867 | 293,892 | 4,000 instances |

The station native pair contains 7,596 instances, 578,592 instance/geometry
bytes and two draws, below its unchanged 580,000-byte budget. The 178 new edge
frame blocks append to 7,418 unchanged hall blocks; their earlier recipe hash
is retained by test. The drawn hall/frame pair uses six draws.

The geographic coverage, 93 tour stops, six presentations, full drawn touch detail,
source delivery, residency/decode budgets and release limits remain unchanged.
The photos do not establish surveyed window openings or exact material colours.

## Validation and publication status

The combined focused model, preservation, source coverage, worker and construction
lifecycle run passed 165 tests in ten files, with 617,151 assertions. A separate native-world,
walking, entrance-access and native-loading run passed 76 tests in four files,
with 5,386,137 assertions. Thirteen additional release/model/lossless suites
passed 61 tests and 50,949 assertions. Together these focused runs cover 302
tests in 27 files. Later
admission tests include both exact source owners and their 45 native tuples.

Full-city internal-browser checks confirmed the daytime street view, TRION and
Torhaus fronts, the Beisheim office wing and the southern station in both drawn
and Minecraft families. The first check exposed hidden steel behind opaque glass;
the three south glazing planes now sit behind their existing steel members.
A subsequent native check exposed the old strip tower; the final check confirms
its complete open replacement. Day and native screenshots and camera telemetry
are retained in the task's `potsdamer-v284-qa` directory. A prior night check
confirmed facade and hall visibility; the final edge-frame change is additional.
These are desktop checks, not a physical mobile-device test. The street camera
is an approximate reference view with the viewer's ordinary 66-degree walking
field of view, not a calibrated pixel-for-pixel reconstruction.

The final TypeScript build and Vite 8.1.4 production build passed. The build
contains 4,745 files / 935,310,388 bytes, with 318 hashed assets. It was built in
a separate temporary directory; the prior v181 canonical dist was retained by
rename before installing the fresh build. Both archive readiness and the HTTP package smoke passed. The selected Python
package/readiness tests passed 101 cases, including the current-tree check after
the fresh dist and package were installed. This is not a complete repository-wide
Python test run.

## References

- [Geoportal Berlin LoD2](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin),
  source archive `LoD2_389_5818.zip`, SHA256
  `827a94eda224f55ec638b1b4de8c440c80405ea6797068efe7558c83a4fd30c1`,
  Datenlizenz Deutschland Zero 2.0.
- Three owner photographs, SHA256 identities in the evidence file.
- [OSM way 464904393](https://www.openstreetmap.org/way/464904393), complete
  original context ring and native receipts in the evidence file.
- [Geoportal Berlin DOP 2025 Frühjahr](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr),
  bounded comparison BBOX `389770,5818830,389830,5818900` in EPSG:25833.
  No aerial image pixels are redistributed.
- [Müller Reimann: Leipziger Platz 1–3](https://www.mueller-reimann.de/projekte/leipziger-platz).
- [SCHOLLGLAS: TRION](https://www.schollglas.com/referenzen/buero-und-geschaeftshaus-trion-berlin-de/).
- [Beisheim Center: background](https://www.beisheim-center.de/de/background).
- Existing station reference links and credits remain in the station profile and
  public `visual_reference_attribution.json`.


## Publication evidence — 29 October 2026

Tested source and version tag: `dbb27c18d8711adfd662e47cf2897d74fc7e12e6`,
[v1.0.183](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.183).
This record and the README are a subsequent documentation-only update; the tag
remains on the tested build source.

Release ID 428416446 was published at 2026-10-29T21:39:16Z and independently
confirmed as the latest public release. GitHub's uploaded asset byte counts and
server SHA256 digests match both locally verified archives:

| Archive | Asset ID | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| isometric-berlin-regierungsviertel-local.zip | 689969389 | 765,498,850 | `68d23652840a86c629803a8651a8a7961d69f7434b888d7ccdf7207d1f2b1f3f` |
| isometric-berlin-viewer-v1.0.183.tar.gz | 689969388 | 764,729,167 | `3e5ff17223fdf17a3bab3d570c30b034506d0aa03c997e8200dcef315bdaac56` |

The extracted package contains 4,754 files / 935,331,533 bytes. Manifest SHA256:
`6dc17f480ee75ac2017a86f8b4ca7266ff0449dec53a9ae15f5fc5b25c770b2c`.
The prior v181 package and dist were preserved by rename, not overwritten during
candidate construction.

Pages commit `227e368a94df4b0f4aea4715ab07a0f322ceaf93` has sole parent
`5d5fab22dbae7c8e60f64588ef6bb713acef0836` and tree
`174258cf3f5e97c6e52b6972571d5a21a3a8c927`. Its complete 4,780-file tree was
checked against every expected path, mode, Git blob and byte count before the
non-force, expected-parent ref advance. It contains 1,024,544,103 bytes,
49,197,721 bytes below the unchanged 1 GiB limit.

Both actual previous live closures, v181 and v182, retain all 327 distinct assets.
An independent broad filename graph reconstructed v181/v182/v183 as respectively
316/316/318 complete asset chains, including their workers and the unchanged
street NDJSON. Exactly 20 exclusively v180 assets (74,529,726 bytes) were retired;
none is referenced by any retained chain. All three executable launcher/server
modes remain `100755`. Only 21 new blobs / 54,844,310 bytes were uploaded.
The complete target path/mode/blob/size fingerprint is
`675fe159ce3cfe623a0f58ab957d9d3fd49c6a77bf596759937f958e52d8cd96`.

[Pages deployment 40959023930](https://github.com/Klotzkette/isometric-berlin/actions/runs/40959023930)
completed successfully on this exact Pages commit. Public HTTP verification at
2026-10-29T21:38:22Z checked all 21 newly uploaded paths (including index and
manifest), plus the scene and both prior worker URLs: 24 distinct files / 77,301,180 bytes, all matching the
expected content hashes and sizes. The normal public index and manifest expose
v1.0.183. A separate full production-package browser check confirmed the runtime
v1.0.183 label, 93 sights, the delivered city and no new console errors from that
origin. The final live viewer is opened in the task's internal browser.

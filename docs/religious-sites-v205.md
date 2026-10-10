# Six religious sites in v1.0.105

This bounded refinement covers Gethsemanekirche and Samariterkirche (East Berlin civic-movement churches), Passionskirche (a West Berlin Protestant church), Wilmersdorfer Moschee, Şehitlik-Moschee and the Rykestraße synagogue. It does not claim district-wide religious coverage. Erlöserkirche, Omar mosque, Lutherkirche and an additional Buddhist site are not part of this change.

## Source ownership and exact correction

| Site | Retained OSM building | Complete LoD2 parent(s) |
| --- | --- | --- |
| Gethsemane | way23495060 | DEBE03YY6000009u |
| Samariter | way28296808 | DEBE02YY2000000L |
| Passion | way106818297 | DEBE02YY4000000y |
| Wilmersdorf | way30098331 | DEBE04YY50003AIw, DEBE04YY50003LLr, DEBE04YY50003Ue3 |
| Şehitlik | way30900412 | DEBE00YY1Cw0002e |
| Rykestraße | way23175400 | DEBE03YY600004DV |

The source evidence retains all 18 leaf parts, original wall/roof coordinates, holes, archive SHA-256 values and OSM geometry/tags. The 2,136 original source triangles remain in runtime evidence as well. Each parent uses the existing outer-world ground at y=3; relative source heights are preserved. No fresh city-wide acquisition or source replacement is performed.

The seven-chunk packet patch subtracts only reconstructed exact-owner proxy signatures: 1,590 drawn triangles, 536 ink segments and ten old navigation fragments; 1,377 native triangles and nine old navigation fragments. It adds the 18 exact source navigation parts as 19 clipped fragments per mode because Gethsemane crosses a chunk boundary. Full original packets are frozen under `/tmp/v205-religious-packets/original/`; the committed receipt retains their hashes, removed navigation and complete source records. Unrelated triangles, ink and navigation must remain unchanged. Apply the candidate descriptors only after comparing all `oldSha256` values; do not regenerate a shared manifest from scratch.

The Wilmersdorf source itself represents the central crown as a tall coarse prism and both minaret crowns as flat caps. Rendering those surfaces inside the new curved profiles would conceal the domes. A separate explicit runtime correction therefore clips only these upper sheets: central part DEBE3DXWJoAJ15h3 at y=12.5; minaret parents DEBE04YY50003LLr at y=25.762 and DEBE04YY50003Ue3 at y=24.277. The 138 original affected triangles remain in the complete source array; 140 clipped lower triangles are used for display. Curved display profiles respect the respective source maximum heights. This is a documented visual correction, not a claim that those curves were surveyed. All five other sites display every original source triangle.

## What is measured and what is estimated

The plans, source wall planes, parent/part ownership and source height differences are data-derived. Window rectangles are tested wholly within their corresponding source wall polygon. Both church upper-tower plans stay within the exact western footprint lobes. Şehitlik's dome and both minarets use the three circular inner rings of retained OSM relation14114110; the ring-centroid differences are below 3 cm. Its 37.1 m OSM building height provides the displayed minaret envelope.

Arch subdivisions, pale frames, rose tracery, cornices, balcony sections and curved roof profiles are small visual estimates. The tall Gethsemane and Samariter spires and Passion's central octagonal belfry are missing from the retained coarse source sheets, so their heights and divisions are explicitly photograph-proportioned estimates. Gethsemane and Samariter's displayed top y=62.4 is not asserted as a surveyed height; Passion's displayed top y=49 is also an estimate. Şehitlik's dome subdivisions are estimated, and its retained flat cultural-centre source remains coarse; this release does not claim a complete reconstruction of the architect's eight-half-dome system or annex elevations.

Primary context and architecture references:

- [Gethsemane parish](https://ekpn.de/vier-kirchen/gethsemane/) and [Deutsche Stiftung Denkmalschutz](https://www.denkmalschutz.de/denkmal/gethsemanekirche.html): brick hall church, western tower, civic-movement history.
- [Samariter heritage entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010013) and [parish history](https://www.ekfhn.de/unsere-geschichte/geschichte-der-samaritergemeinde): Gothic-revival west tower and peace-movement association.
- [Passion heritage entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031196) and [parish](https://www.kght.de/informieren/unsere-orte/passionskirche): square central plan, octagonal central belfry and Romanesque-revival architecture.
- [Wilmersdorf restoration architects](https://d-4.de/moschee-wilmersdorf/) and [architects' project paper](https://www.aiv-berlin-brandenburg.de/wp-content/uploads/2018/05/Forum_2_2017_D4_Moschee_Nitschke.pdf): Mughal domed mosque and detached minarets.
- [Şehitlik original architects](https://hassa.com/tr/proje/berlin-sehitlik-camii-ve-kultur-merkezi): central dome and two single-balcony minarets.
- [Jewish community](https://jg-berlin.org/religion/synagogen-in-berlin/synagoge-rykestrasse/) and [Rykestraße heritage entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070254): courtyard brick basilica and neo-Romanesque architecture.

Seven permitted photograph references and precise authors/licenses are recorded in `religious-sites-v205-recognition-evidence.json`. They inform shape/color only; no photo pixels, texture, image fetch or image viewer is shipped. The custom-Attribution Wilmersdorf image inspected during source research was excluded; only the public-domain frontal image is used there. The original procedural recognition code and geometry are not traced photographic textures.

## Runtime and integration

Import `createReligiousSitesV205(minecraft)` and `RELIGIOUS_SITES_V205_GROUP` from `ReligiousSitesV205.ts`. Add it through the existing static source-details lifecycle so cancellation, style visibility and disposal match adjacent families. Its six independently bounded site groups each contain source sheets, estimated sheets and one final-sized member batch in drawn mode. Native mode instead contains one axis-aligned surface-cell batch per site, with no hidden smooth double model or filled interior volume. All static detail is identical on touch and desktop.

Final buffers contain 8,694 drawn triangles and 5,915 thin members: 1,388,492 bytes of position/normal/color/instance payload, plus small unit-box geometry and normal Three.js overhead. Native mode has 41,150 unique 0.9 m surface cells, using 3,127,400 instance bytes plus six small unit boxes. Drawn mode has 18 render objects; native mode has six. The standalone compact runtime JSON gzips to 435,468 bytes. These are bounded six-site allocations; no global render-distance, pixel-ratio, shadow or interaction-budget change is included.

Checks: eight source/model Python tests plus six packet-preservation tests; two TypeScript runtime tests covering exact drawn counts, six local bounds, final buffer capacities, desktop/touch parity metadata and every native transform's axis alignment. All source vertices remain in complete evidence; every displayed source/estimated triangle vertex has a corresponding native surface cell. The crown regression confirms that suppressed flat caps cannot remain inside the dome. Independent six-site geometry plots were inspected, including a corrected Wilmersdorf crown view.

The historical preservation chain now first invokes `tests/packet_receipts_v205.py`. It independently reconstructs all fourteen live packets from immutable `v1.0.104` Git bytes and retained exact source records, verifies every surviving coloured primitive, source ink segment, navigation record and other packet field, and checks all replacement part footprints and heights. Only after that proof may older verifiers receive the byte-exact v104 predecessor. Seven additional regressions cover complete replay, missing packet/mode receipts, forged hashes that attempt to hide an unrelated triangle removal or altered navigation height, a falsely attributed owner shape or height, and a changed asset URL or encoding. Reconstructed owner navigation must match the immutable original records exactly, including IDs, coordinates, heights and metadata. The older v201 counts and geometry assertions remain unchanged.

The 384 drawn Şehitlik main-dome faces use three restrained, outward-normal-based shades from the same roof palette so their curvature remains legible with MeshBasicMaterial. This changes colour only; a frozen position hash and whole-runtime comparison verify unchanged geometry, source/navigation data and native cells. Regeneration is byte-reproducible.

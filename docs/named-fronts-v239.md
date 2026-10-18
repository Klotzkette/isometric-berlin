# Step 10 — three named Mitte fronts, v239

This finite additive pass clarifies the existing Google Gropius ensemble, Leo-Baeck-Haus and Delivery Hero fronts. It adds slim jamb and lintel profiles to exactly retained pane positions, plus eave members on retained source prism edges. There is no new pane grid, shell, roof, source replacement, navigation, footprint or mobile simplification.

## Attribution and architectural interpretation

- [Google's opening report](https://blog.google/intl/de-de/unternehmen/inside-google/sundar-pichai-eroeffnet-berliner-google-buero/) establishes the Berlin office in the Gropius ensemble. [The estate's Gropius project description](https://www.forum-museumsinsel.de/gropius-ensemble/) identifies the 1879–1882 Gropius/Schmieden Neo-Renaissance clinic, the round lecture theatre and the later Chipperfield work. The selected existing Tucholskystraße ensemble receives restrained stone profile depth; its actual polygonal curves and long modern volume remain intact. No guessed circular auditorium or northern Haupttelegraphenamt is substituted.
- [The Zentralrat's Leo-Baeck-Haus history](https://www.zentralratderjuden.de/der-zentralrat/ueber-uns/leo-baeck-haus/) identifies Tucholskystraße 9, architect Johann Hoeniger, and the former Hochschule für die Wissenschaft des Judentums. Existing openings receive pale stone reveal edges. The previous geometry is retained; this is not a surveyed recreation of architectural ornament.
- [The estate's Fernsprechamt description](https://www.forum-museumsinsel.de/fernsprechamt/) distinguishes Felix Gentzen's 1926–1927 expressionist/Art Deco building from the postwar addition at the Oranienburger corner. [Delivery Hero's contact page](https://www.deliveryhero.com/newsroom-contact/) confirms Oranienburger Straße 70. The existing v200 clinker and postwar front styles receive different reveal profiles without changing glazing, mullions, apertures or bodies.

All references checked 19 October 2026. Colours and profile sections are explicit display estimates; no photographic colour sampling or texture is used. Existing procedural window positions are not claimed to be a measured window inventory.

## Exact retained ownership and anchors

Google reference families: `DEBE01YYK0000CJs`, `DEBE01YYK00005AW`, `DEBE00YY1HJ000Bw`, `DEBE01YYK0000DK5`, `DEBE01YYK0000Ddl`, `DEBE01YYK000088B`. Active retained source prisms are `04991246`, `39201189`, `39201190`, `52086750`. Their official source families participate in a larger shared binding marked `retain-old-mass-source-conflict`. They remain reference evidence; this pass does not substitute incomplete families or move their datums.

Leo reference family `DEBE01YYK00001R6` also belongs to a retained shared binding; only its exact current prism `05733795` is targeted. Delivery Hero uses the existing complete v200 source composition for `DEBE01YYK00004EC` and `DEBE01YYK0000C4T`.

The compressed source freezes nine official family records verbatim, five retained prisms, the existing Gropius OSM context, 12 v200 Delivery Hero faces and 800 exact old pane records. The v166/v169 pane candidates must match actual published triangle coordinate multisets; candidates missing from published geometry are rejected. Delivery panes refer to the original `windowFields` box IDs and store each unchanged source box, source plane ID, width, height and normal. Of 800 apertures, 764 receive profiles: Google 414, Leo 18, Delivery Hero 332. The remaining 36 narrow clipped Delivery fragments retain their existing treatment.

The source stores SHA-256 preservation receipts for input catalogues, v200 runtime geometry/evidence, all affected previous drawn/native leaf packets and both core geometry files. No existing file is rewritten. Google/Leo eaves follow retained prism edges, not an unverified LoD2 replacement roof.

## Delivery and integration

Run `uv run python scripts/build_named_fronts_v239.py`. The source extraction is frozen after first creation. The generator checks all prior hashes before producing complete static drawn and independently orthogonal native packets.

Integrate `geo_data/regierungsviertel/named-fronts-v239-manifest-addition.json` with these descriptor IDs:

- `namedfront239-2_-2`
- `namedfront239-2_-1`
- `namedfront239-3_-1`

Mesh kind: `named-fronts-v239`. Every packet has empty navigation and the addition has an empty footprint. Root integration must register normal streamed visibility for all modes and complete mobile drawing. There are no suppression or replacement receipts. No residency setting changes are needed.

Total extra GPU payload is **400,512 bytes drawn** and **1,147,440 bytes native**, with three meshes per mode across the three bounded leaves. Largest decoded packet is 1,346,872 bytes. Native frame and edge members are constructed independently from orthogonal pieces at at most 0.75 m spacing; they are not rotated drawn triangles or mobile wireframes.

Useful views: Google `[1455, 24, -438]`, Leo `[1398, 17, -535]`, Delivery Hero corner `[1463, 24, -622]`, clinker Tucholsky front `[1436, 24, -552]`.

## Verification

`tests/test_named_fronts_v239.py` checks original pane-triangle membership, exact v200 box anchors, finite official/prism owner sets, byte-for-byte preservation, descriptor hashes and byte sizes, complete empty navigation, bounded GPU memory, native orthogonality and absence of new glazing or shell roles. Shared runtime and browser checks belong to the root v239 integration.

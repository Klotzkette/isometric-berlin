# Charité and HU Campus Nord, v1.0.55

This bounded Step 10 refinement covers both sides of Luisenstraße. The eleven existing western families gain shallow brick-bond courses, raised piers and eaves dentils. Their original windows, portals, roof data and exact source parts remain. Six eastern families add 35 existing LoD2 parts; no world bounds or source payloads were regenerated.

| Eastern family | Address / primary identity | LoD2 parent suffix | Parts |
| --- | --- | --- | --- |
| Wilhelm-Waldeyer-Haus / I. Anatomisches Institut | Philippstraße 11; [LDA09055049](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055049) | 05dM | 11 |
| Oskar-Hertwig-Haus / II. Anatomisches Institut | Philippstraße 12; [LDA09055048](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055048) | 06zH | 8 |
| Humboldt Graduate School / Lehrgebäude der Tierarzneischule | Luisenstraße 56; [LDA09055025](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055025) | 0236 | 8 |
| Tieranatomisches Theater / Gerlachbau | Philippstraße 13; [LDA09055030](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055030) | 09Ws | 2 |
| Institut für Tieranatomie / Haus 2 | Luisenstraße 56; [LDA09055031](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055031) | 0FLf | 2 |
| Ostertaghaus / former Hygienisches Institut | Luisenstraße 56; [LDA09055033](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055033) | 05vH | 4 |

The first institute distinguishes its red/yellow masonry from the pale postwar central wing. Its existing rounded south projection receives three arched entry bays, four fluted column indications and a balcony rail. The second institute has taller round-headed lecture openings. The Graduate School separates its pale U-shaped wings from the central six large arched bays and eleven small upper openings. Bay dimensions, surface colours and modest relief subdivisions are display estimates; this is not a measured restoration model. Existing clinic heights, source roof fits and source-plan wings remain intact.

## Tieranatomisches Theater source conflict

`chariteTheatreSource.json` retains both full official LoD2 surface records from `LoD2_390_5820.zip`, including every ring/wing vertex and the archive SHA256. The low square body plus Gerlach wing was delivered as a 3 m default extrusion, while the circular part has 17.179 m height. The [HU theatre](https://tieranatomisches-theater.de/ueber-uns/), LDA description and licensed photographs clearly show a two-storey square body, elevated round light drum and patinated dome.

The renderer therefore interprets those two existing source plans: base 5.2 m, body top 14.6 m, drum top 18 m, dome and small rooflight within the already established 22.4 m overall top. Intermediate heights are unsurveyed visual estimates, explicitly separate from immutable raw measurements. The attached wing is retained in full. The roof has 96 angular divisions and 14 vertical courses in drawn modes; eight arched drum lights and restrained classical reliefs make the form identifiable. Minecraft uses its own complete source walls, clipped body roof, stepped drum and connected square dome skin, with no detached radial roof samples or holes.

`CHARITE_THEATRE_REPLACEMENT_IDS` owns exactly `sFAYdHwz` and `uBD055gq` in both drawn prism paths. Native voxel ownership excludes the same source shapes before the detailed source model is added. Generic facade details skip them. The shared `chariteTheatreProfile.ts` also supplies pedestrian roof heights using the exact raw source rings, faceted drawn dome and native stepped surface. This prevents obsolete flat cylinder collision above the visible dome. The root metadata reports retained raw source records and explicitly lists those two interpreted-envelope exceptions.

## Preservation and rendering cost

Independent comparison against v1.0.54 found all 11 western profile records / 146 source parts and all 152 old records in each of the two roof tables unchanged. Adding the east brings facade coverage to 17 families / 181 parts; native includes the six already present Ruska source parts for 187 parts. The compact prism, building, voxel and raw mesh payloads are unchanged.

All 39,067 previously delivered western drawn detail records remain byte-for-byte identical after filtering the three new additive roles. The focused regression fixes their canonical sorted-record SHA256 to `0264798a4ff48a176aa4c6126844e919e1cc3d5b499d518445b19339c55043f5`. All 72 prior loggias remain. No older source record or roof sample was removed.

The complete facade layer plus new theatre uses 5,332,936 attribute/index/instance bytes and 4 draw calls in drawn modes; the native facade/source-shell/theatre layer uses 8,328,110 bytes and 6 calls. Drawn full/mobile geometry is identical. Geometry is static and texture-free, instance arrays allocate only the required size, and diagnostics are retained only when requested. This is additional architectural detail, not a reduction in old quality.

## Reference and validation record

Four actually inspected freely licensed external photographs are attributed in the central Wikimedia manifest: Manfred Brückels's Langhans theatre side view (CC BY-SA 3.0), Kvikk's Graduate School courtyard/front (CC BY-SA 3.0), Immanuel Giel's `Anatomie Charite.jpg` (public domain), and Schibo's `Charité CCM, Philippstraße 11.jpg` (CC BY-SA 4.0). Images are visual references only; none is bundled or used as a runtime texture.

Isolated Chrome renders checked drawn/native theatre, Graduate School, Anatomy I and the overall west/east campus. The resulting corrections included outward-facing roof normals, actual upper drum glazing, a connected native dome skin, visible upper Graduate School arcade, and the pale Anatomy I portico. These checks do not claim physical iPhone testing. 34 focused Charité tests pass, including source retention, shared-wall suppression, native source-footprint area, full/mobile parity, exact old-detail hash, and drawn/native pedestrian collision rays.

The user's report of a dismantled temporary HU lecture tent is retained as current user evidence, not an invented construction model. The [official 2022 HU meeting invitation](https://gremien.hu-berlin.de/de/konzil/tagesordnungen/tagesordnungen-der-sitzungen-des-konzils/einladungkonzil_01_08-02-2022_und_02_15-02-2022.pdf) identifies Audimax II (Hörsaalzelt), Campus Nord, Philippstraße 13. Existing source part `80075215` (OSM way 880075215 / Haus 33) is unchanged; no speculative frames, newly erected tent, or undocumented removal was introduced. A dated source or user clarification is needed for its precise current dismantling stage.

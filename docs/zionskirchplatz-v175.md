# Four restrained frontages at Zionskirchplatz

Step 10 adds small, texture-free facade details to four already-present
buildings. The full LoD2 shells, roof polygons, courtyards, source packets,
street geometry, trees, church and all unrelated city details remain unchanged.
Only eleven explicitly selected public street wall planes receive thin plaster
colours, window divisions, entrance/shop glazing, cornices and a few balconies.

| Address | OSM way | Retained LoD2 owner |
|---|---|---|
| Kastanienallee 49, former Café 103 corner | 28987958 | DEBE01YYK0000CIk |
| Kastanienallee 50, opposite corner | 29097995 | DEBE01YYK00005G6 |
| Zionskirchstraße 21, cream/peach corner | 27764546 | DEBE01YYK0000C4w |
| Zionskirchstraße 22/24, pink corner | 42112366 | DEBE01YYK00008CV |

Geometry uses the complete retained Berlin LoD2 tile `391_5821`, licensed
dl-de/zero-2-0, and the existing world ground at y=3 m. Address and shop identity
use the retained OSM extract of 2026-09-29 (ODbL). Exact selected source wall IDs,
source-record hashes and retained roof counts are in the small profile/evidence
JSON files. No building envelope is replaced, scaled or exported twice.

Two inspected freely licensed photographs guide independently authored detail:

- [Bars Kastanienallee Berlin](https://commons.wikimedia.org/wiki/File:Bars_Kastanienallee_Berlin.jpg),
  Oh-Berlin.com, 2011, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/):
  pale blue/cream No.49, white frames, narrow balcony stack, mustard awning
  and large divided glazing; cream/peach No.50 with warm wood frames and orange
  awnings.
- [Zionskirchplatz panorama](https://commons.wikimedia.org/wiki/File:Zionskirchplatz,_Berlin-Mitte,_160328,_ako.jpg),
  Ansgar Koreng, 2016, [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/):
  peach raised rusticated base and cream upper No.21; pink No.22/24 with pale
  window frames, small attic windows and narrow horizontal bands.

Both credits are mirrored in the source and public Wikimedia manifests. No
photographs, crops, texture atlases, commercial font or interior are bundled.
Colours, window counts, fine dimensions and shop divisions are restrained
visual estimates, not a measured facade survey or current business inventory.

The owner specifically requested the **old Café 103**. Its small geometric
window mark and mustard awning are an intentional historical reference to the
2011 photograph. The mark is confined to one former corner café bay. It is not
a claim that Café 103 operates there today: [Nauta's imprint](https://nautaberlin.com/impressum)
lists Kastanienallee 49, and [W–Der Imbiss](https://www.w-der-imbiss.de/) occupies a
separate unit at that address. No current tenant branding is invented for the
rest of the building. The opposite corner's address is confirmed by
[Aapka](https://www.aapka.de/).

The drawn version adds two static batches. Minecraft uses a separate one-batch
orthogonal skin, with a small eighth-metre historical sign. Equal-colour
adjacent native cells coalesce without filling gaps. Source native walls stay
beneath the overlay. Both representations use the same complete details on
touch and pointer. Arrays decode only for the requested representation, with
exact final typed-buffer allocation and no photographic textures.

Reproduce with `uv run python scripts/build_zionskirchplatz_v175.py`. The
generator only writes its three new derived JSON payloads. Tests independently
check four-owner scope, source hashes, roof retention, wall-plane proximity,
sign retention in Minecraft, bounded allocations and mirrored attribution.

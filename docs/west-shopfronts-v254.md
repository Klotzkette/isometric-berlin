# Existing west-street shopfront fittings — v254 / Step 10

Narrow metal frames, shallow inner reveals, transoms and dark lower plinths
make the existing commercial openings more legible on Kurfürstendamm and
Tauentzienstraße. Kantstraße receives the same treatment on positively mapped
commercial owners; its other retained lower windows receive neutral reveal
frames. No tenant names, merchandise, new door positions or second window grid
are introduced.

## Source ownership and limits

The complete retained OSM named-road courses select existing owners. Ku’damm
and Tauentzien use the original v163/v165 `shopfront glazing` fields, with the
same exact protected building owners as v235. Each accepted rectangle must
match two actually delivered source triangles, accepting either triangulation.
Matching permits only an exact common vertical translation when the delivered
vertices prove it; the current accepted fields all retain their original Y.
There is no restoration of old source altitudes.

Kantstraße replays the exact first opening row on all **69 eligible v188
frontages**. Each rectangle is independently verified against its immutable
drawn or native companion packet, including its original centimetre rounding.
Occluded/omitted opening columns stay omitted. Native spans come from the
actual orthogonal exposed faces already recorded by v188.

The retained [29 September 2026 OSM extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
supplies shop/café/restaurant nodes. A commercial indication requires a
ground-level node inside that precise original building footprint, allowing
only the existing 0.5 m source alignment tolerance. The evidence retains
identities, classifications and points without displaying tenant names.
205 drawn and 178 native Kant openings have this positive commercial evidence;
22 and 19 remain neutral window fittings.

This is an audit of eligible existing openings over the complete named street
courses, not a claim to have surveyed every shop. In particular, the protected
v163 source selection contains only five eligible shop panes in West/Halensee
and one at Lehniner Platz. Its many upper windows and protected landmark owners
remain unchanged; missing lower grids are not inferred from the street name.

| Section | Drawn openings | Independent native faces |
| --- | ---: | ---: |
| West / Halensee | 5 | 4 |
| Lehniner Platz | 1 | 2 |
| Central Ku’damm | 678 | 1,000 |
| Breitscheidplatz | 542 | 812 |
| Tauentzienstraße | 343 | 885 |
| Kantstraße | 227 | 197 |
| Total | 1,796 | 2,900 |

Metal colours, 4.5 cm frame widths, 2 cm inner reveal depth, 20 cm lower
plinths and transom subdivisions are **display estimates**, not surveyed
joinery. The fittings remain inside their existing opening footprint.
Split transoms/plinths leave the old central mullions exposed; v235’s outer
reveals, original glass, sills and every source part remain present. Mapped
v233 doors retain a 2.2 m exclusion around their existing opening anchors.

## Delivery and validation

`prepareWestShopfrontsV254` checks exact original encoded-part fingerprints
before appending one packed part to each affected existing packet. It uses
the established cancellable preparation, shared material batch, GPU upload,
parking and disposal lifecycle. All drawn devices use identical geometry;
native plans contain only orthogonal faces. No descriptor, texture, source
packet, navigation solid, live budget, coverage or animation loop changes.

The compact runtime recipe is 289,925 bytes, with a 113,408-byte compressed
evidence receipt across **26 existing mode packets**. Added decoded geometry
totals 1,287,840 drawn and 2,083,440 native bytes over all packets, not concurrent
residency. Original packets plus v235 and this pass reach at most 160,715
vertices, 621,405 indices and four parts, below the unchanged 400,000 /
2,400,000 / 16 packet caps. The release integration also checks the other
independent packet preparations.

Focused Python tests replay actual original triangles, immutable packet/source
hashes, all six geographic sections and exact owner/POI containment. Focused
Bun tests exercise every runtime plan, preserve all old object identities and
v235 detail, verify narrow in-opening bounds and native orthogonality, and
check corruption, invalid recipes, cancellation and idempotence.

Sources remain Berlin LoD2, dl-de/zero-2-0, and OpenStreetMap contributors,
ODbL-1.0. No external image or photographic texture is used.

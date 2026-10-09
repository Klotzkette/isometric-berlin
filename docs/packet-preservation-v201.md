# v201 packet preservation checks

`tests/packet_receipts_v201.py` keeps the published `v1.0.100` manifest and
packet bytes as immutable checkpoints. It permits only the finite Olympic
terrain, Wuhlheide and final Waldbühne transitions. Every other descriptor and
its actual published payload must retain its old hash. The existing 650,000 B
compressed / 2,600,000 B decoded packet limits, 2 MiB manifest limit and 2,048
descriptor limit remain unchanged.

The Olympic proof reads the original v189 source geometry, independently checks
every retained triangle's colour and XZ coverage through terrain subdivision,
checks measured heights and rigid source-owner offsets, preserves the complete
old water triangle multiset and checks empty navigation in geometry companions.
Building navigation keeps its original rings and holes; the six existing hero
owners receive only their declared vertical datum corrections. In particular,
the stadium building ring must not be intersected with the walkable-ground
cutout inside that same ring.

The Wuhlheide proof reconstructs the two exact old owner extrusions from their
retained source records, subtracts only those triangles and ink segments, and
checks all remaining geometry, source-parent offsets and navigation. All six
packet IDs and both representations must be audited. The descriptor building
count follows the original drawn source-owner count: the native reading already
had fewer sub-cell navigation slivers in two v100 packets.

The separate Waldbühne proof verifies the exact source-owner transfer and bounded
floor cutouts against its terrain checkpoint. The Olympic proof then validates
those same checkpoint bytes against the original source. Thus an intermediate
hash alone cannot authorize a new final replacement. Historical v190/v195/v200
checks receive the byte-exact v100 predecessor only after this whole final chain
has passed; historical baseline receipts are not rewritten.

Negative checks reject omitted packet/mode audits, duplicated ground,
recoloured faces, a building wall falsely labelled as a water bank, and a rigid
translation that disagrees with its independently located source owner.

Focused command:

```sh
uv run pytest -q tests/test_packet_receipts_v201.py tests/test_packet_waldbuehne_v201.py tests/test_weinberg_terrain_packets_v176.py tests/test_v200_preservation.py tests/test_district_facades_v188.py tests/test_outskirts_v187.py tests/test_city_coverage_v183.py tests/test_teufelsberg_packets_v195.py tests/test_grunewald_v190.py tests/test_east_city_v200.py
```

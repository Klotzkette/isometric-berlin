# Park paths and surfaces in Berlin

This pass refines paths in seven existing parks across four boroughs. It covers Volkspark Hasenheide, Körnerpark, Volkspark Prenzlauer Berg, Park am Weißen See, Bürgerpark Pankow, Lietzenseepark and the part of Stadtpark Steglitz served by the existing tiles. The park boundaries come from the Berlin green-space register. The path courses, surface tags and mapped areas come from the OpenStreetMap extracts taken on 10 November 2026. [Berlin green-space register](https://daten.berlin.de/datensaetze/grunanlagenbestand-berlin-einschliesslich-der-offentlichen-spielplatze-wfs-737fd0a4) · [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright)

In Hasenheide, new visible surfaces cover about 1,497 m² in Drawn and 1,372 m² in Native. Drawn includes the mapped paved area, using its actual closed outline. Native also represents missing path sections on the half-metre grid. Across the seven parks, material changes cover about 53,524 m² of existing paths in Drawn and 32,633 m² in Native. Surface colours are stylized. Where a line has no mapped width, the compiler uses the existing road-class width estimate. It fits the result to the old surface and the registered park boundary. [Mapped Hasenheide paved area](https://www.openstreetmap.org/way/132647406)

The 53 mode-specific recipes use the existing streamed tiles. A surface must match original packed ground or a generic path face. New surfaces stay clear of existing roads, buildings, water, bridges and earlier detailed additions. Native uses complete half-metre cells. The original path and terrain geometry, tree cover, linework and walking data stay in place. Fennpfuhlpark, Volkspark Mariendorf, Schäferseepark, Schillerpark and Stadtpark Lichtenberg were also checked. Their sites had no qualifying original streamed ground in this audit, so this pass adds no surfaces there.

The offline evidence in `geo_data/regierungsviertel/park-paths-v329-source.json.gz` retains the 12 park boundaries, the relevant OSM paths and the exact input packet hashes. The compiler checks those hashes and uses the existing runtime to capture the preceding packet state. Reproduce into a separate destination from the repository root.

```sh
uv run python scripts/build_park_paths_v329.py \
  --output /tmp/parkPathsV329Packets.json \
  --audit /tmp/park-paths-v329-audit.json
```

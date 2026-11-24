"""Bind photographic street elevations to the actually delivered Alt-Mitte wall triangles."""
import json
from pathlib import Path

from build_gendarmen_second_row_v344 import hosts, packets

ROOT = Path(__file__).resolve().parents[1]
SURVEY = ROOT / "geo_data/regierungsviertel/schloss-quartier-v383.json"
DATA = ROOT / "src/app/src/data/schlossQuartierV383.json"


def build():
  survey = json.loads(SURVEY.read_text())
  drawn, native = packets(False), packets(True)
  fronts = []
  for record in survey["fronts"]:
    a, b = record["a"], record["b"]
    dx, dz = b[0] - a[0], b[1] - a[1]
    nx, nz = record["normal"]
    side = 1 if -dz * nx + dx * nz > 0 else -1
    edge = {"startXZ": a, "endXZ": b, "outwardSide": side,
            "wallBaseY": record["low"], "wallTopY": record["high"],
            "street": record["street"], "prismId": record["id"]}
    drawn_receipts, _ = hosts(edge, drawn, False)
    native_receipts, steps = hosts(edge, native, True)
    if record["style"] == "kur17":
      # The full-height block facade belongs to the apartment building. The
      # separate narrow gable contributes shorter, stepped fragments farther out.
      native_receipts = [r for r in native_receipts if r["packetId"] == "3_1-piece-0"]
      steps = [s for s in steps if s["top"] >= edge["wallTopY"] - .02]
    if not drawn_receipts or not steps:
      continue
    fronts.append({"edge":edge,"surface":record["surface"],"drawnHosts":drawn_receipts,
                   "nativeHosts":native_receipts,"steps":steps,
                   "kurRange":record.get("kurRange",[]),
                   **{k:record[k] for k in ("style","color","cols","rows","width","height")}})
  assert len(fronts) >= 15
  DATA.write_text(json.dumps({"fronts":fronts,"sites":survey["sites"]},separators=(",",":"),ensure_ascii=False)+"\n")
  print(len(fronts),"fronts from",len({f['edge']['prismId'] for f in fronts}),"actual buildings;",
        sum(len(f["rows"])*len(f["cols"]) for f in fronts),"window centres",DATA.stat().st_size,"bytes")

if __name__ == "__main__":
  build()

"""Exact v229 transfers; replay unchanged prior owners and keep every unmatched row."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_townhall_core_previous_v227 as core
import build_townhall_ownership_v227 as packets
from build_townhall_source_v227 import DATA, GEO, write

if __name__ == "__main__":
  core.OWNERS = {"-6874671": "DEBE01YYK00041Iw"}
  core_receipt = core.build()
  core_receipt["schema"] = "district-court-core-transfer-v229/1"
  write(DATA / "districtCourtsV229CorePrevious.json", core_receipt)
  packets.SOURCE = GEO / "district-courts-source-v229.json"
  result = packets.build()
  write(DATA / "districtCourtsV229Ownership.json", result)
  print("Authorised", result["authorizedOwners"], "blocked", result["blocked"])

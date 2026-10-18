"""Replay only the exact old Wedding station roof and uncontested native columns."""

import build_townhall_core_previous_v227 as core
from build_townhall_source_v227 import DATA, write

if __name__ == "__main__":
  core.OWNERS = {
    "26556185": "wedding-station-v190-roof-elevated-v229",
    "73863640": "wedding-station-eastern-stair-canopy-v229",
    "65379920": "wedding-station-eastern-lower-access-canopy-v229",
  }
  receipt = core.build()
  receipt["schema"] = "wedding-station-core-transfer-v229/1"
  receipt["policy"] = (
    "Exact full original station-roof row equality and exact uncontested native columns. "
    "Required WeddingMoabitV229 retains the three mapped roof polygons as thin elevated roofs; "
    "the complete v190 station roof edges and platform remain at their corrected elevation."
  )
  write(DATA / "weddingStationCorePreviousV229.json", receipt)
  print({owner["prism"]["id"]: len(owner["columns"]) for owner in receipt["owners"]})

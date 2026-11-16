"""Add bounded borough, address and architectural evidence to the official office list."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlencode

from pyproj import Transformer

from scripts.build_aemter_v355 import archive, download, sha
from scripts.build_pharmacies_v350 import read

MITTE = "https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/amt-fuer-buergerdienste/buergeraemter/artikel.244730.php"
PANKOW = "https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/amt-fuer-buergerdienste/buergeramt/"
FINANZ_KREUZBERG = (
  "https://www.berlin.de/sen/finanzen/steuern/finanzaemter/friedrichshain-kreuzberg/"
)
FINANZ_KOE_II = "https://www.berlin.de/sen/finanzen/steuern/finanzaemter/finanzamt-fuer-koerperschaften-ii/"
RBS = "https://gdi.berlin.de/services/wfs/adressen_rbs"
RBS_FILTER = (
  "(strnam='Klosterstraße' AND hausnr='71' AND postleit='10179') OR "
  "(strnam='Breite Straße' AND hausnr IN ('24','26') AND postleit='13187') OR "
  "(strnam='Mehringdamm' AND hausnr IN ('110','112') AND postleit='10965')"
)
RBS_URL = (
  RBS
  + "?"
  + urlencode(
    {
      "service": "WFS",
      "version": "2.0.0",
      "request": "GetFeature",
      "typeNames": "adressen_rbs:adressen_rbs",
      "outputFormat": "application/json",
      "srsName": "EPSG:4326",
      "CQL_FILTER": RBS_FILTER,
    }
  )
)
OFFICIAL_POINTS = {
  351065: ([13.4127113, 52.5180484], MITTE, "mitte-buergeraemter.html"),
  122301: ([13.4025222, 52.5690782], PANKOW, "pankow-buergeraemter.html"),
}
TOWNHALL_V227 = {
  122280: "mitte",
  122282: "tiergarten",
  122243: "friedrichshain",
  122231: "kreuzberg",
  122301: "pankow",
  122297: "prenzlauer-berg",
  122294: "weissensee",
  122281: "spandau",
  122274: "steglitz",
  122267: "zehlendorf",
  122251: "schoeneberg",
  122257: "tempelhof",
  122285: "neukoelln",
  122273: "hellersdorf",
  122254: "hohenschoenhausen",
  122304: "reinickendorf",
  354937: "koepenick",
}
TRANSFORM = Transformer.from_crs("EPSG:4326", "EPSG:25833", always_xy=True)


def world(pair: tuple | list) -> list[float]:
  x, north = TRANSFORM.transform(*pair)
  return [round(x - 389500, 5), round(5820000 - north, 5)]


def source_photo(
  file: str, image_url: str, page: str, credit: str, directory: Path
) -> dict:
  return {
    "pageUrl": page,
    "imageUrl": image_url,
    "credit": credit,
    "sha256": sha((directory / file).read_bytes()),
    "photoBundled": False,
  }


def facades(directory: Path) -> dict[int, dict]:
  lda = "https://denkmaldatenbank.berlin.de"
  return {
    122937: {
      "street": "Bismarckstraße",
      "outward": [0.088, 0.996],
      "osmBuildingId": "way/35557895",
      "retainedOwner": {"drawnHost": "-10_1", "drawnSourceId": "DEBE04YY500004v1"},
      "mainEntranceSourceUrl": "https://www.openstreetmap.org/node/933101753",
      "mainEntranceWorld": world([13.3036358, 52.511628]),
      "facadeWorld": [world([13.3030175, 52.511585]), world([13.3042321, 52.5116684])],
      "photo": source_photo(
        "charlottenburg.jpg",
        lda + "/media/uploads/Web06/09096101.jpg",
        lda + "/daobj.php?obj_dok_nr=09096101",
        "LDA-Fotoarchiv, Bittner 2017",
        directory,
      ),
      "cues": [
        "Pale warm-gray render, four floors and tall narrow top-row windows, paired lower windows, close dentil eaves under a dark saddle roof.",
        "Five gray natural-stone entrance bays with four square piers, iron railings and red-brown doors set behind the façade line.",
      ],
      "portal": {
        "widthM": 21,
        "heightM": 11.4,
        "piers": 4,
        "pierWidthM": 0.9,
        "stone": "#a8a699",
        "doors": "#683c2e",
      },
      "geometryEvidence": "Outline and main entrance from OSM, 83 m street front in monument description, other dimensions and colours estimated from photograph.",
    },
    324113: {
      "street": "Mehringdamm",
      "outward": [0.869, 0.495],
      "osmBuildingId": "way/24926736",
      "retainedOwner": {"corePrismId": "24926736"},
      "mainEntranceSourceUrl": "https://www.openstreetmap.org/node/7059827485",
      "mainEntranceWorld": world([13.3886334, 52.4947449]),
      "facadeWorld": [world([13.3880866, 52.4941274]), world([13.3891808, 52.4953623])],
      "photo": source_photo(
        "kreuzberg-lda-b.jpg",
        lda + "/media/uploads/Kre/01/09031098b.jpg",
        lda + "/daobj.php?obj_dok_nr=09031098",
        "LDA-Archiv, Bittner 2013",
        directory,
      ),
      "cues": [
        "Former barracks' pale beige rusticated rendering and light joints around three tall rows of paired arched windows with brown-red frames.",
        "Round corbel row directly below eaves, dark roof and crenellations on the central and end towers; separate rear yellow-brick stables.",
      ],
      "window": {
        "rows": 3,
        "arch": "round",
        "pair": True,
        "trim": "#a69177",
        "frames": "#654531",
        "wall": "#bdad94",
      },
      "geometryEvidence": "OSM center entrance and street-facing extent; front steps and projecting towers break the facade into multiple separate wall segments.",
    },
    122282: {
      "street": "Mathilde-Jacob-Platz (courtyard north of Turmstraße)",
      "outward": [-0.182, 0.983],
      "osmBuildingId": "way/311048538",
      "retainedOwner": {
        "corePrismId": "11048538",
        "townhallV227": "tiergarten",
        "lod2Root": "DEBE01YYK0002O8g",
        "lod2CourtLeaf": "DEBE3DxQUEt451DE",
      },
      "mainEntranceSourceUrl": "https://www.openstreetmap.org/node/1776326062",
      "mainEntranceWorld": world([13.3385081, 52.5270044]),
      "facadeWorld": [world([13.338182, 52.5270379]), world([13.3388192, 52.5269751])],
      "photo": source_photo(
        "tiergarten-current.jpg",
        "https://www.berlin.de/ba-mitte/politik-und-verwaltung/beauftragte/integration/gefluechtete-menschen/rathaus-mit-kirschblueten.jpg",
        MITTE,
        "Bezirksamt Mitte",
        directory,
      ),
      "architectureSourceUrl": lda + "/daobj.php?obj_dok_nr=09050351",
      "cues": [
        "Warm gray-brown stucco, gray stone door and window surrounds and five facade rows; steep charcoal hipped roof with evenly spaced light-framed dormers.",
        "South-facing court centered on the balcony and stone portico; light clock tower with three elongated arched openings in the visible front.",
      ],
      "serviceLocation": "The district documents the Bürgeramt at ground level in the left wing. The photographed portico and map node are the townhall main entrance.",
      "geometryEvidence": "Historic townhall already uses the retained V227 envelope and authored detail. Primary references may only supply checked additive details.",
    },
  }


def charlottenburg_glazing(photo: dict) -> list[dict]:
  """Three central courses fitted to the literal walls of retained host -10_1.

  The source wall breakpoints bracket each of the inner glass bays and leave
  the four stone pier strips clear. Native uses its independent 20 m south wall.
  """
  inverse = Transformer.from_crs("EPSG:25833", "EPSG:4326", always_xy=True)

  def point(x: float, z: float) -> list[float]:
    return list(inverse.transform(x + 389500, 5820000 - z))

  bays = [
    ([-4626.49, 702.87], [-4622.63, 702.53]),
    ([-4622.0, 702.47], [-4618.3, 702.14]),
    ([-4617.66, 702.09], [-4613.88, 701.75]),
  ]
  courses = []
  for i, (a, b) in enumerate(bays):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = (dx * dx + dz * dz) ** 0.5
    courses.append(
      {
        "point": point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
        "normal": [-dz / length, dx / length],
        "width": 3.02,
        "bottom": 0.35,
        "top": 10.85,
        "finish": {
          "type": "glazing",
          "color": [70, 68, 58],
          "frame": [130, 112, 94],
          "count": 3,
        },
        "url": photo["imageUrl"],
        "hostHint": "-10_1",
        "ownerHint": "DEBE04YY500004v1",
        "native": {
          "point": point(-4618 + (i - 1) * 3.85, 702),
          "normal": [0, 1],
          "width": 3.02,
        },
      }
    )
  return courses


def supplement(data: dict, directory: Path) -> None:
  raw = (directory / "rbs-selected.json").read_bytes()
  data["sources"].append(
    {
      "url": RBS_URL,
      "sha256": sha(raw),
      "license": "dl-de/zero-2-0",
      "credit": "Amt für Statistik Berlin-Brandenburg / Geoportal Berlin",
    }
  )
  addr = {f["properties"]["adr_ident"]: f for f in json.loads(raw)["features"]}
  assignments = {351065: ["0000144010"], 122301: ["0000077709", "0000077710"]}

  def points(ids: list[str]) -> list[dict]:
    rows = []
    for identity in ids:
      feature = addr[identity]
      p = feature["properties"]
      lon, lat = feature["geometry"]["coordinates"]
      if not 12.9 < lon < 13.9 or not 52.3 < lat < 52.7:
        raise ValueError(f"RBS point outside Berlin for {identity}")
      rows.append(
        {
          "lon": lon,
          "lat": lat,
          "sourceUrl": RBS,
          "sourceId": identity,
          "street": p["strnam"],
          "houseNumber": p["hausnr"] + (p["hausnrz"] or ""),
          "postcode": p["postleit"],
          "evidence": "official-rbs-address-point",
        }
      )
    return rows

  by_id = {site["portalId"]: site for site in data["sites"]}
  references = facades(directory)
  for identity, site in by_id.items():
    if identity in assignments:
      point, page, filename = OFFICIAL_POINTS[identity]
      snapshot = (directory / filename).read_bytes()
      if not all(str(coordinate) in snapshot.decode() for coordinate in point):
        raise ValueError(f"Borough coordinates changed for {identity}")
      data["sources"].append({"url": page, "sha256": sha(snapshot)})
      site["alternateOfficialPoints"] = [
        {
          "lon": point[0],
          "lat": point[1],
          "sourceUrl": page,
          "evidence": "official-borough-map-point",
        },
        *points(assignments[identity]),
      ]
    if identity in TOWNHALL_V227:
      site["existingTownhallV227"] = TOWNHALL_V227[identity]
    if identity == 122937:
      site["facadeDocumentation"] = references[identity]
      site["facadeReference"] = charlottenburg_glazing(references[identity]["photo"])
    elif identity in references:
      site["facadeReference"] = references[identity]
  branch_page = (directory / "senfin-pages/friedrichshain-kreuzberg.html").read_bytes()
  if (
    b"Mehringdamm 110/112" not in branch_page
    or b"kein Publikumsverkehr" not in branch_page
  ):
    raise ValueError("Kreuzberg branch address/access has changed")
  branch_points = points(["0000189456", "0000189457"])
  if [(p["street"], p["houseNumber"], p["postcode"]) for p in branch_points] != [
    ("Mehringdamm", "110", "10965"),
    ("Mehringdamm", "112", "10965"),
  ]:
    raise ValueError("Kreuzberg branch RBS addresses have changed")
  data["sources"].append({"url": FINANZ_KREUZBERG, "sha256": sha(branch_page)})
  data["sites"].append(
    {
      "id": "berlin-senfin-mehringdamm-110-112",
      "kind": "tax-office",
      "name": "Finanzamt Friedrichshain-Kreuzberg (Außenstelle)",
      "address": "Mehringdamm 110/112, 10965 Berlin",
      "addressKey": "mehringdamm|110/112|10965",
      "houseNumber": "110/112",
      "postcode": "10965",
      "sourceUrl": FINANZ_KREUZBERG,
      "lon": branch_points[0]["lon"],
      "lat": branch_points[0]["lat"],
      "coordinateEvidence": "official-rbs-address-point",
      "publicAccess": False,
      "alternateOfficialPoints": branch_points,
      "services": [],
    }
  )
  shared_page = (
    directory / "senfin-pages/finanzamt-fuer-koerperschaften-ii.html"
  ).read_bytes()
  if b"Josef-Orlopp-Str. 62" not in shared_page or b"Betriebspr" not in shared_page:
    raise ValueError("Shared Finanzamt branch address has changed")
  data["sources"].append({"url": FINANZ_KOE_II, "sha256": sha(shared_page)})
  by_id[324134]["additionalOccupants"] = [
    {
      "name": "Finanzamt für Körperschaften II (Außenstelle)",
      "sourceUrl": FINANZ_KOE_II,
      "scope": "Betriebsprüfungsstelle at the same address",
    }
  ]
  data["audit"]["tax-office"]["additionalSenFinAddresses"] = 1
  data["audit"]["tax-office"]["additionalSharedOffice"] = 1
  data["audit"]["referenceFacades"] = len(references)
  data["sites"].sort(key=lambda site: (site["kind"], site["name"], site["id"]))


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("inventory", type=Path)
  parser.add_argument("directory", type=Path)
  parser.add_argument("output", type=Path)
  parser.add_argument("--fetch-rbs", action="store_true")
  args = parser.parse_args()
  if args.fetch_rbs:
    (args.directory / "rbs-selected.json").write_bytes(download(RBS_URL))
  data = read(args.inventory)
  supplement(data, args.directory)
  archive(args.output, data)
  print(
    len(data["sites"]),
    "sites with",
    data["audit"]["referenceFacades"],
    "primary facade references",
  )


if __name__ == "__main__":
  main()
